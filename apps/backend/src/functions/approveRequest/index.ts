/**
 * Azure Function: POST /api/requests/{id}/approve
 *
 * Approves a time-off request.
 * Creates a calendar event and notifies the requester.
 * Requires x-api-key header for authentication.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { getConfig } from '../../utils/env';
import { createLogger } from '../../utils/logger';
import { validateApiKey, getCorsHeaders } from '../../auth/apiKeyValidator';
import { approveRequest } from '../../services/requestService';
import {
  ApproveRequestInput,
  ApproveTimeOffResponse,
} from '../../models/TimeOffRequest';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

/**
 * Handler for POST /api/requests/{id}/approve
 */
async function approveRequestHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);
  const corsHeaders = getCorsHeaders(request, logger);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  logger.startOperation('approveRequest');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Get request ID from route
    const requestId = request.params.id;
    if (!requestId) {
      throw new ApiError(ErrorCodes.ValidationError, 'Request ID is required', 400);
    }

    // Parse request body (use request.text() to support text/plain Content-Type
    // which the widget sends to avoid CORS preflight)
    const body = JSON.parse(await request.text()) as ApproveRequestInput;

    if (!body.supervisorEmail) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'supervisorEmail is required',
        400
      );
    }

    logger.debug('Approving request', {
      requestId,
      supervisorEmail: body.supervisorEmail,
    });

    // Approve the request
    const { request: timeOffRequest, calendarEventId } = await approveRequest(
      requestId,
      body.supervisorEmail,
      logger
    );

    const response: ApproveTimeOffResponse = {
      request: timeOffRequest,
      calendarEventId,
      message: 'Time-off request approved. Calendar event created and requester notified.',
    };

    logger.endOperation('approveRequest', startTime, {
      requestId,
      calendarEventId,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    logger.error('Request failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
        body: JSON.stringify(error.toResponse()),
      };
    }

    return {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(
        createErrorResponse(
          ErrorCodes.InternalError,
          'An unexpected error occurred. Please try again later.'
        )
      ),
    };
  }
}

// Register the function
app.http('approveRequest', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'requests/{id}/approve',
  handler: approveRequestHandler,
});

export default approveRequestHandler;
