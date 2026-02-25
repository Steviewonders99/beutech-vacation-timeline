/**
 * Azure Function: GET /api/requests
 *
 * Lists time-off requests for the authenticated user.
 * Requires x-api-key header for authentication.
 *
 * Query parameters:
 * - role: 'requester' | 'supervisor' (required)
 * - email: user's email address (required)
 * - status: 'pending' | 'approved' | 'rejected' | 'all' (optional, default 'all')
 * - limit: number (optional, default 50)
 * - offset: number (optional, default 0)
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
import { listRequests } from '../../services/requestService';
import { ListTimeOffResponse, ListRequestsParams, RequestStatus } from '../../models/TimeOffRequest';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

/**
 * Handler for GET /api/requests
 */
async function getRequestsHandler(
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

  logger.startOperation('getRequests');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Parse query parameters
    const url = new URL(request.url);
    const role = url.searchParams.get('role');
    const email = url.searchParams.get('email');
    const status = url.searchParams.get('status') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const offset = parseInt(url.searchParams.get('offset') || '0', 10);

    // Validate required parameters
    if (!role || (role !== 'requester' && role !== 'supervisor')) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        "role query parameter is required and must be 'requester' or 'supervisor'",
        400
      );
    }

    if (!email) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'email query parameter is required',
        400
      );
    }

    // Validate status
    const validStatuses = ['pending', 'approved', 'rejected', 'cancelled', 'all'];
    if (!validStatuses.includes(status)) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        400
      );
    }

    logger.debug('Listing requests', { role, email, status, limit, offset });

    const params: ListRequestsParams = {
      role: role as 'requester' | 'supervisor',
      email,
      status: status as RequestStatus | 'all',
      limit: Math.min(limit, 100), // Cap at 100
      offset,
    };

    const requests = await listRequests(params, logger);

    const response: ListTimeOffResponse = {
      requests,
      count: requests.length,
    };

    logger.endOperation('getRequests', startTime, {
      count: requests.length,
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
app.http('getRequests', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'requests',
  handler: getRequestsHandler,
});

export default getRequestsHandler;
