/**
 * Azure Function: GET/POST /api/requests/action
 *
 * Handles approve/reject actions via secure token links.
 * Allows managers to approve or reject requests directly from email or Teams.
 *
 * GET with action=approve: Directly approves the request
 * GET with action=reject_form: Shows a form to enter rejection reason
 * POST with action=reject_form: Processes the rejection with reason
 *
 * Returns an HTML page showing the result or form.
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
import { TimeOffRequest } from '../../models/TimeOffRequest';

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
  <title>${title} - Leave Request Timeline</title>
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
      Beutech Leave Request Timeline
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Formats a date for display.
 */
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Generates the rejection form HTML page.
 */
function generateRejectFormHtml(
  request: TimeOffRequest,
  token: string,
  error?: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Decline Request - Leave Request Timeline</title>
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
      background: #ef4444;
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .header p {
      opacity: 0.9;
      font-size: 14px;
    }
    .content {
      padding: 30px;
    }
    .request-info {
      background: #f9fafb;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
    }
    .request-info p {
      margin: 4px 0;
      font-size: 14px;
      color: #374151;
    }
    .request-info strong {
      color: #111827;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-group label {
      display: block;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
      font-size: 14px;
    }
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      min-height: 100px;
      transition: border-color 0.2s;
    }
    .form-group textarea:focus {
      outline: none;
      border-color: #ef4444;
    }
    .form-group textarea::placeholder {
      color: #9ca3af;
    }
    .error-message {
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #dc2626;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .buttons {
      display: flex;
      gap: 12px;
    }
    .btn {
      flex: 1;
      padding: 14px 24px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-primary {
      background: #ef4444;
      color: white;
    }
    .btn-secondary {
      background: #e5e7eb;
      color: #374151;
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
      <h1>Decline Time-Off Request</h1>
      <p>Please provide a reason for declining</p>
    </div>
    <div class="content">
      <div class="request-info">
        <p><strong>Employee:</strong> ${request.requesterName}</p>
        <p><strong>Dates:</strong> ${formatDate(request.startDate)} - ${formatDate(request.endDate)}</p>
        <p><strong>Type:</strong> ${request.leaveType === 'vacation' ? 'Time Off' : request.leaveType === 'sick' ? 'Sick Leave' : request.leaveType === 'personal' ? 'Personal Day' : request.leaveType === 'other' ? 'Other' : request.leaveType.charAt(0).toUpperCase() + request.leaveType.slice(1)}</p>
      </div>

      ${error ? `<div class="error-message">${error}</div>` : ''}

      <form method="POST" action="">
        <input type="hidden" name="token" value="${token}">
        <div class="form-group">
          <label for="reason">Reason for declining <span style="color: #ef4444;">*</span></label>
          <textarea
            id="reason"
            name="reason"
            required
            placeholder="Please explain why this request cannot be approved (e.g., scheduling conflict, staffing needs, etc.)"
          ></textarea>
        </div>
        <div class="buttons">
          <button type="button" class="btn btn-secondary" onclick="window.close(); window.history.back();">Cancel</button>
          <button type="submit" class="btn btn-primary">Decline Request</button>
        </div>
      </form>
    </div>
    <div class="footer">
      Beutech Leave Request Timeline
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Parses form data from POST request body.
 */
async function parseFormData(request: HttpRequest): Promise<Record<string, string>> {
  const body = await request.text();
  const params = new URLSearchParams(body);
  const result: Record<string, string> = {};
  params.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

/**
 * Handler for GET/POST /api/requests/action
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
    // Get token from query parameter (GET) or form body (POST)
    let token: string | null = request.query.get('token');
    let rejectionReason: string | undefined;

    // Handle POST request (form submission)
    if (request.method === 'POST') {
      const formData = await parseFormData(request);
      token = formData.token || token;
      rejectionReason = formData.reason?.trim();
    }

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
            ? 'Action links expire after 24 hours. Please approve or reject the request from the Leave Request Timeline widget.'
            : 'The link may have been corrupted. Please try again from the original email.'
        ),
      };
    }

    logger.debug('Token validated', {
      requestId: payload.requestId,
      action: payload.action,
      supervisorEmail: payload.supervisorEmail,
      method: request.method,
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

    // Handle different actions
    if (payload.action === 'approve') {
      // Direct approval
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
    } else if (payload.action === 'reject_form') {
      // Show rejection form or process form submission
      if (request.method === 'POST') {
        // Validate that a reason was provided
        if (!rejectionReason || rejectionReason.length < 5) {
          return {
            status: 400,
            headers: { 'Content-Type': 'text/html' },
            body: generateRejectFormHtml(
              existingRequest,
              token,
              'Please provide a reason for declining (at least 5 characters).'
            ),
          };
        }

        // Process the rejection with reason
        const rejectedRequest = await rejectRequest(
          payload.requestId,
          payload.supervisorEmail,
          rejectionReason,
          logger
        );

        logger.endOperation('requestAction', startTime, {
          action: 'reject',
          requestId: payload.requestId,
          hasReason: true,
        });

        return {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
          body: generateHtmlResponse(
            true,
            'Request Declined',
            `You have declined ${rejectedRequest.requesterName}'s time-off request.`,
            `${rejectedRequest.startDate} - ${rejectedRequest.endDate}<br><br><strong>Reason:</strong> ${rejectionReason}<br><br>${rejectedRequest.requesterName} has been notified.`
          ),
        };
      }

      // GET request - show the rejection form
      logger.debug('Showing rejection form', { requestId: payload.requestId });

      return {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
        body: generateRejectFormHtml(existingRequest, token),
      };
    } else if (payload.action === 'reject') {
      // Direct rejection (legacy support, no reason)
      const rejectedRequest = await rejectRequest(
        payload.requestId,
        payload.supervisorEmail,
        undefined,
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

    // Unknown action
    return {
      status: 400,
      headers: { 'Content-Type': 'text/html' },
      body: generateHtmlResponse(
        false,
        'Invalid Action',
        'The requested action is not recognized.',
        'Please use the links from your email notification.'
      ),
    };
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
          'Please try again or use the Leave Request Timeline widget to manage this request.'
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
        'Please try again later or use the Leave Request Timeline widget.'
      ),
    };
  }
}

// Register the function - supports both GET (link click) and POST (form submit)
app.http('requestAction', {
  methods: ['GET', 'POST'],
  authLevel: 'anonymous',
  route: 'requests/action',
  handler: requestActionHandler,
});

export default requestActionHandler;
