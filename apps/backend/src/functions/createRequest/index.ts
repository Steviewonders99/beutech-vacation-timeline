/**
 * Azure Function: POST /api/requests
 *
 * Creates a new time-off request.
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
import { createRequest } from '../../services/requestService';
import {
  CreateTimeOffRequestInput,
  CreateTimeOffResponse,
} from '../../models/TimeOffRequest';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

/**
 * Handler for POST /api/requests
 */
async function createRequestHandler(
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

  logger.startOperation('createRequest');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Parse request body
    const body = (await request.json()) as CreateTimeOffRequestInput;

    // Validate required fields
    if (!body.requesterEmail) {
      throw new ApiError(ErrorCodes.ValidationError, 'requesterEmail is required', 400);
    }
    if (!body.requesterName) {
      throw new ApiError(ErrorCodes.ValidationError, 'requesterName is required', 400);
    }
    if (!body.startDate) {
      throw new ApiError(ErrorCodes.ValidationError, 'startDate is required', 400);
    }
    if (!body.endDate) {
      throw new ApiError(ErrorCodes.ValidationError, 'endDate is required', 400);
    }

    logger.debug('Creating time-off request', {
      requesterEmail: body.requesterEmail,
      startDate: body.startDate,
      endDate: body.endDate,
    });

    // Create the request
    const timeOffRequest = await createRequest(body, logger);

    const response: CreateTimeOffResponse = {
      request: timeOffRequest,
      message: 'Time-off request created successfully. Your supervisor has been notified.',
    };

    logger.endOperation('createRequest', startTime, {
      requestId: timeOffRequest.id,
    });

    return {
      status: 201,
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
app.http('createRequest', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'requests',
  handler: createRequestHandler,
});

export default createRequestHandler;
