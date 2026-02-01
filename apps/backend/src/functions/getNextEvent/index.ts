/**
 * Azure Function: GET /api/vacations/next-event
 *
 * Returns the first future date that has a vacation event.
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
import { getVacations } from '../../graph/vacationService';
import { NextEventResponse } from '../../models/VacationEvent';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

/**
 * Handler for GET /api/vacations/next-event
 * Finds the first future vacation event and returns its start date.
 */
async function getNextEventHandler(
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

  logger.startOperation('getNextEvent');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Parse optional query parameters
    const url = new URL(request.url);
    const timezone = url.searchParams.get('timezone') ?? undefined;

    // Calculate date range: today to 1 year from now
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const oneYearFromNow = new Date(today);
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    logger.debug('Searching for next event', {
      startDateTime: today.toISOString(),
      endDateTime: oneYearFromNow.toISOString(),
    });

    // Fetch vacation events for the next year
    const events = await getVacations(
      {
        startDateTime: today.toISOString(),
        endDateTime: oneYearFromNow.toISOString(),
        timezone: timezone || config.defaultTimezone,
      },
      logger
    );

    // Find the first event that starts today or in the future
    // Events are already sorted by start date from getVacations
    let nextEventDate: string | null = null;

    for (const event of events) {
      const eventStart = new Date(event.start);
      // Only consider events that start today or later
      if (eventStart >= today) {
        // Return just the date portion (YYYY-MM-DD)
        nextEventDate = event.start.split('T')[0];
        break;
      }
    }

    const response: NextEventResponse = {
      nextEventDate,
      generatedAt: new Date().toISOString(),
    };

    logger.endOperation('getNextEvent', startTime, {
      foundEvent: nextEventDate !== null,
      nextEventDate,
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

    // Handle known API errors
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

    // Handle unexpected errors
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
app.http('getNextEvent', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous', // We handle auth via API key
  route: 'vacations/next-event',
  handler: getNextEventHandler,
});

export default getNextEventHandler;
