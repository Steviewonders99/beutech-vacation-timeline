/**
 * Azure Function: POST /api/requests/{id}/cancel
 *
 * Cancels a time-off request (by the requester).
 * Pending and approved requests can be cancelled.
 * If the request was approved, the associated Outlook calendar event is also deleted.
 * Only the requester can cancel their own requests.
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
import { cancelRequest } from '../../services/requestService';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

interface CancelRequestInput {
  requesterEmail: string;
}

interface CancelTimeOffResponse {
  request: {
    id: string;
    status: string;
  };
  message: string;
}

/**
 * Handler for POST /api/requests/{id}/cancel
 */
async function cancelRequestHandler(
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

  logger.startOperation('cancelRequest');
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
    const body = JSON.parse(await request.text()) as CancelRequestInput;

    if (!body.requesterEmail) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'requesterEmail is required',
        400
      );
    }

    logger.debug('Cancelling request', {
      requestId,
      requesterEmail: body.requesterEmail,
    });

    // Cancel the request
    const timeOffRequest = await cancelRequest(
      requestId,
      body.requesterEmail,
      logger
    );

    const response: CancelTimeOffResponse = {
      request: {
        id: timeOffRequest.id,
        status: timeOffRequest.status,
      },
      message: 'Time-off request cancelled successfully.',
    };

    logger.endOperation('cancelRequest', startTime, {
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
app.http('cancelRequest', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'requests/{id}/cancel',
  handler: cancelRequestHandler,
});

export default cancelRequestHandler;
