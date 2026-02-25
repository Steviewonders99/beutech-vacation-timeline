/**
 * Azure Function: POST /api/requests/{id}/reject
 *
 * Rejects a time-off request.
 * Notifies the requester of the rejection.
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
import { rejectRequest } from '../../services/requestService';
import {
  RejectRequestInput,
  RejectTimeOffResponse,
} from '../../models/TimeOffRequest';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

/**
 * Handler for POST /api/requests/{id}/reject
 */
async function rejectRequestHandler(
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

  logger.startOperation('rejectRequest');
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
    const body = JSON.parse(await request.text()) as RejectRequestInput;

    if (!body.supervisorEmail) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'supervisorEmail is required',
        400
      );
    }

    logger.debug('Rejecting request', {
      requestId,
      supervisorEmail: body.supervisorEmail,
      hasReason: !!body.reason,
    });

    // Reject the request
    const timeOffRequest = await rejectRequest(
      requestId,
      body.supervisorEmail,
      body.reason,
      logger
    );

    const response: RejectTimeOffResponse = {
      request: timeOffRequest,
      message: 'Time-off request rejected. Requester has been notified.',
    };

    logger.endOperation('rejectRequest', startTime, {
      requestId,
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
app.http('rejectRequest', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'requests/{id}/reject',
  handler: rejectRequestHandler,
});

export default rejectRequestHandler;
