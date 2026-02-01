/**
 * Azure Function: GET /api/vacations
 *
 * Returns vacation events for the specified date range.
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
import { parseDateRange, parseViewType, parseUserList } from '../../utils/dateRangeParser';
import { validateApiKey, getCorsHeaders } from '../../auth/apiKeyValidator';
import { getVacations } from '../../graph/vacationService';
import { enrichWithUserNames } from '../../graph/userService';
import { VacationsResponse } from '../../models/VacationEvent';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';
import { ApiVersion } from '../../config/constants';

/**
 * Handler for GET /api/vacations
 */
async function getVacationsHandler(
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

  logger.startOperation('getVacations');
  const startTime = Date.now();

  try {
    // Validate API key
    validateApiKey(request, logger);

    // Parse query parameters
    const url = new URL(request.url);
    const start = url.searchParams.get('start') ?? undefined;
    const end = url.searchParams.get('end') ?? undefined;
    const view = url.searchParams.get('view') ?? undefined;
    const users = url.searchParams.get('users') ?? undefined;
    const timezone = url.searchParams.get('timezone') ?? undefined;

    logger.debug('Request parameters', { start, end, view, users, timezone });

    // Validate and parse parameters
    const dateRange = parseDateRange(start, end, config.maxDateRangeDays);
    const viewType = parseViewType(view);
    const userList = parseUserList(users);

    // Fetch vacation events
    const events = await getVacations(
      {
        startDateTime: dateRange.startISO,
        endDateTime: dateRange.endISO,
        users: userList.length > 0 ? userList : undefined,
        timezone: timezone || config.defaultTimezone,
      },
      logger
    );

    // Enrich with user display names if needed
    await enrichWithUserNames(events, logger);

    // Build response
    const response: VacationsResponse = {
      events,
      meta: {
        start: dateRange.startISO,
        end: dateRange.endISO,
        generatedAt: new Date().toISOString(),
      },
    };

    logger.endOperation('getVacations', startTime, {
      eventCount: events.length,
      view: viewType,
    });

    return {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        [ApiVersion.HEADER]: ApiVersion.CURRENT,
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
          [ApiVersion.HEADER]: ApiVersion.CURRENT,
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
        [ApiVersion.HEADER]: ApiVersion.CURRENT,
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
app.http('getVacations', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous', // We handle auth via API key
  route: 'vacations',
  handler: getVacationsHandler,
});

export default getVacationsHandler;
