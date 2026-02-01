/**
 * Service for fetching vacation events from Microsoft Graph.
 * Supports both shared calendar and per-user calendar modes.
 */

import { graphGetWithParams } from './graphClient';
import { getConfig } from '../utils/env';
import { Logger } from '../utils/logger';
import {
  VacationEvent,
  GraphCalendarEvent,
  toVacationEvent,
} from '../models/VacationEvent';
import { ApiError, ErrorCodes } from '../models/ErrorResponse';

/**
 * Parameters for fetching vacations.
 */
export interface GetVacationsParams {
  /** Start of date range (ISO 8601) */
  startDateTime: string;
  /** End of date range (ISO 8601) */
  endDateTime: string;
  /** Optional list of specific user emails/IDs to fetch for */
  users?: string[];
  /** Optional timezone */
  timezone?: string;
}

/**
 * Graph API response for calendar view.
 */
interface CalendarViewResponse {
  value: GraphCalendarEvent[];
  '@odata.nextLink'?: string;
}

/**
 * Fetches vacation events from a shared calendar.
 */
async function getVacationsFromSharedCalendar(
  params: GetVacationsParams,
  logger?: Logger
): Promise<VacationEvent[]> {
  const config = getConfig();
  const { startDateTime, endDateTime, timezone } = params;

  if (!config.vacationCalendarMailbox) {
    throw new ApiError(
      ErrorCodes.ConfigurationError,
      'Shared calendar mailbox not configured.',
      500
    );
  }

  logger?.info('Fetching vacations from shared calendar', {
    mailbox: config.vacationCalendarMailbox,
    startDateTime,
    endDateTime,
  });

  const endpoint = `/users/${config.vacationCalendarMailbox}/calendarView`;

  try {
    const queryParams: Record<string, string> = {
      startDateTime,
      endDateTime,
      $select: 'id,subject,start,end,isAllDay,organizer,attendees,categories',
      $top: '500', // Max events per request
    };

    if (timezone) {
      queryParams['$header'] = `Prefer: outlook.timezone="${timezone}"`;
    }

    const response = await graphGetWithParams<CalendarViewResponse>(
      endpoint,
      queryParams,
      logger
    );

    // Transform to VacationEvent format
    // For shared calendar, we need to extract user info from organizer or attendees
    const events = response.value.map((event) => {
      const organizerEmail = event.organizer?.emailAddress?.address || 'unknown';
      const organizerName = event.organizer?.emailAddress?.name || 'Unknown';

      return toVacationEvent(event, organizerEmail, organizerName);
    });

    logger?.info('Retrieved vacations from shared calendar', {
      count: events.length,
    });

    // Filter by specific users if requested
    if (params.users && params.users.length > 0) {
      const userSet = new Set(params.users.map((u) => u.toLowerCase()));
      return events.filter((e) => userSet.has(e.userId.toLowerCase()));
    }

    return events;
  } catch (error) {
    logger?.error('Failed to fetch from shared calendar', {
      error: error instanceof Error ? error.message : String(error),
    });

    throw new ApiError(
      ErrorCodes.GraphError,
      `Failed to fetch vacations from shared calendar: ${error instanceof Error ? error.message : 'Unknown error'}`,
      502
    );
  }
}

/**
 * Fetches vacation events from a user's personal calendar.
 */
async function getVacationsFromUserCalendar(
  userEmail: string,
  params: GetVacationsParams,
  logger?: Logger
): Promise<VacationEvent[]> {
  const config = getConfig();
  const { startDateTime, endDateTime, timezone } = params;

  logger?.debug('Fetching vacations from user calendar', {
    user: userEmail,
    startDateTime,
    endDateTime,
  });

  const endpoint = `/users/${userEmail}/calendarView`;

  try {
    const queryParams: Record<string, string> = {
      startDateTime,
      endDateTime,
      $select: 'id,subject,start,end,isAllDay,categories',
      $filter: `categories/any(c:c eq '${config.vacationCategory}')`,
      $top: '100',
    };

    if (timezone) {
      queryParams['$header'] = `Prefer: outlook.timezone="${timezone}"`;
    }

    const response = await graphGetWithParams<CalendarViewResponse>(
      endpoint,
      queryParams,
      logger
    );

    // Transform to VacationEvent format
    return response.value.map((event) =>
      toVacationEvent(event, userEmail, userEmail.split('@')[0] || userEmail)
    );
  } catch (error) {
    // Log but don't fail for individual user errors
    logger?.warn('Failed to fetch from user calendar', {
      user: userEmail,
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}

/**
 * Fetches vacation events from per-user calendars.
 */
async function getVacationsFromPerUserCalendars(
  params: GetVacationsParams,
  logger?: Logger
): Promise<VacationEvent[]> {
  const { users } = params;

  if (!users || users.length === 0) {
    logger?.warn('No users specified for per-user calendar mode');
    return [];
  }

  logger?.info('Fetching vacations from per-user calendars', {
    userCount: users.length,
  });

  // Fetch in parallel for all users
  const results = await Promise.all(
    users.map((user) => getVacationsFromUserCalendar(user, params, logger))
  );

  // Flatten results
  const allEvents = results.flat();

  logger?.info('Retrieved vacations from per-user calendars', {
    totalCount: allEvents.length,
    userCount: users.length,
  });

  return allEvents;
}

/**
 * Main function to fetch vacation events.
 * Automatically uses the configured calendar mode.
 */
export async function getVacations(
  params: GetVacationsParams,
  logger?: Logger
): Promise<VacationEvent[]> {
  const config = getConfig();

  logger?.startOperation('getVacations', {
    mode: config.calendarMode,
    startDateTime: params.startDateTime,
    endDateTime: params.endDateTime,
    userCount: params.users?.length,
  });

  const startTime = Date.now();

  try {
    let events: VacationEvent[];

    if (config.calendarMode === 'shared') {
      events = await getVacationsFromSharedCalendar(params, logger);
    } else {
      events = await getVacationsFromPerUserCalendars(params, logger);
    }

    // Sort by start date
    events.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    logger?.endOperation('getVacations', startTime, {
      eventCount: events.length,
    });

    return events;
  } catch (error) {
    logger?.error('getVacations failed', {
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}
