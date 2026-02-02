/**
 * Azure Function: GET /api/requests/action
 *
 * Handles approve/reject actions via secure token links.
 * Allows managers to approve or reject requests directly from email or Teams.
 * Returns an HTML page showing the result.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getConfig } from '../../utils/env';
import { createLogger } from '../../utils/logger';
import { validateActionToken, ActionTokenPayload } from '../../utils/actionToken';
import { approveRequest, rejectRequest, getRequestById } from '../../services/requestService';
import { ApiError } from '../../models/ErrorResponse';

/**
 * Generates an HTML response page.
 */
function generateHtmlResponse(
  success: boolean,
  title: string,
  message: string,
  details?: string
): string {
  const bgColor = success ? '#22c55e' : '#ef4444';
  const icon = success ? '✓' : '✗';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Vacation Timeline</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.1);
      max-width: 500px;
      width: 100%;
      overflow: hidden;
    }
    .header {
      background: ${bgColor};
      color: white;
      padding: 40px 30px;
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 30px;
      text-align: center;
    }
    .content p {
      color: #374151;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 16px;
    }
    .details {
      background: #f3f4f6;
      border-radius: 8px;
      padding: 16px;
      font-size: 14px;
      color: #6b7280;
      margin-top: 16px;
    }
    .footer {
      padding: 20px 30px;
      background: #f9fafb;
      text-align: center;
      font-size: 12px;
      color: #9ca3af;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
    </div>
    <div class="content">
      <p>${message}</p>
      ${details ? `<div class="details">${details}</div>` : ''}
    </div>
    <div class="footer">
      Beutech Vacation Timeline
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Handler for GET /api/requests/action
 */
async function requestActionHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);

  logger.startOperation('requestAction');
  const startTime = Date.now();

  try {
    // Get token from query parameter
    const token = request.query.get('token');
    if (!token) {
      return {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          false,
          'Invalid Request',
          'No action token provided.',
          'Please use the link from your email or Teams notification.'
        ),
      };
    }

    // Validate token
    let payload: ActionTokenPayload;
    try {
      payload = validateActionToken(token);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid token';
      logger.warn('Token validation failed', { error: errorMessage });

      return {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          false,
          'Invalid or Expired Link',
          'This action link is no longer valid.',
          errorMessage === 'Token has expired'
            ? 'Action links expire after 24 hours. Please approve or reject the request from the Vacation Timeline widget.'
            : 'The link may have been corrupted. Please try again from the original email.'
        ),
      };
    }

    logger.debug('Token validated', {
      requestId: payload.requestId,
      action: payload.action,
      supervisorEmail: payload.supervisorEmail,
    });

    // Check if request still exists and is pending
    const existingRequest = await getRequestById(payload.requestId, logger);
    if (!existingRequest) {
      return {
        status: 404,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          false,
          'Request Not Found',
          'This time-off request no longer exists.',
          'It may have been deleted or the ID is incorrect.'
        ),
      };
    }

    if (existingRequest.status !== 'pending') {
      return {
        status: 400,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          existingRequest.status === 'approved',
          existingRequest.status === 'approved' ? 'Already Approved' : 'Already Processed',
          `This request has already been ${existingRequest.status}.`,
          `${existingRequest.requesterName}'s request for ${existingRequest.startDate} - ${existingRequest.endDate} was ${existingRequest.status} on ${existingRequest.statusChangedAt || 'an earlier date'}.`
        ),
      };
    }

    // Perform the action
    if (payload.action === 'approve') {
      const { request: approvedRequest, calendarEventId } = await approveRequest(
        payload.requestId,
        payload.supervisorEmail,
        logger
      );

      logger.endOperation('requestAction', startTime, {
        action: 'approve',
        requestId: payload.requestId,
        calendarEventId,
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          true,
          'Request Approved!',
          `You have approved ${approvedRequest.requesterName}'s time-off request.`,
          `${approvedRequest.startDate} - ${approvedRequest.endDate}<br>A calendar event has been created and ${approvedRequest.requesterName} has been notified.`
        ),
      };
    } else {
      // Reject action
      const rejectedRequest = await rejectRequest(
        payload.requestId,
        payload.supervisorEmail,
        undefined, // No rejection reason from email link
        logger
      );

      logger.endOperation('requestAction', startTime, {
        action: 'reject',
        requestId: payload.requestId,
      });

      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          true,
          'Request Declined',
          `You have declined ${rejectedRequest.requesterName}'s time-off request.`,
          `${rejectedRequest.startDate} - ${rejectedRequest.endDate}<br>${rejectedRequest.requesterName} has been notified.`
        ),
      };
    }
  } catch (error) {
    logger.error('Request action failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: { 'Content-Type': 'text/html' },
        body: generateHtmlResponse(
          false,
          'Action Failed',
          error.message,
          'Please try again or use the Vacation Timeline widget to manage this request.'
        ),
      };
    }

    return {
      status: 500,
      headers: { 'Content-Type': 'text/html' },
      body: generateHtmlResponse(
        false,
        'Something Went Wrong',
        'An unexpected error occurred while processing your request.',
        'Please try again later or use the Vacation Timeline widget.'
      ),
    };
  }
}

// Register the function
app.http('requestAction', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'requests/action',
  handler: requestActionHandler,
});

export default requestActionHandler;
