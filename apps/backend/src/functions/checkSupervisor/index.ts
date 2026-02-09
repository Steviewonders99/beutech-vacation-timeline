/**
 * Azure Function: GET /api/users/is-supervisor
 *
 * Checks if a user is a supervisor (has any requests where they are the supervisor).
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
import { checkIsSupervisor } from '../../services/requestService';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

interface CheckSupervisorResponse {
  isSupervisor: boolean;
  email: string;
}

/**
 * Handler for GET /api/users/is-supervisor
 */
async function checkSupervisorHandler(
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

  logger.startOperation('checkSupervisor');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Get email from query parameter
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (!email) {
      throw new ApiError(
        ErrorCodes.ValidationError,
        'email query parameter is required',
        400
      );
    }

    logger.debug('Checking supervisor status', { email });

    // Check if user is a supervisor
    const isSupervisor = await checkIsSupervisor(email, logger);

    const response: CheckSupervisorResponse = {
      isSupervisor,
      email,
    };

    logger.endOperation('checkSupervisor', startTime, {
      email,
      isSupervisor,
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
app.http('checkSupervisor', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'users/is-supervisor',
  handler: checkSupervisorHandler,
});

export default checkSupervisorHandler;
