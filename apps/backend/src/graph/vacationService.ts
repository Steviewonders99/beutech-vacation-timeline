/**
 * Service for fetching vacation events from Microsoft Graph.
 * Supports both shared calendar and per-user calendar modes.
 */

import { graphGetWithParams, graphPost, graphDelete } from './graphClient';
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
    // For shared calendar, extract user info from the event subject
    // Subject format: "Name - Vacation", "Name - PTO", "Name - Time Off", etc.
    const events = response.value.map((event) => {
      let userName = 'Unknown';
      let userEmail = event.organizer?.emailAddress?.address || 'unknown';

      // Parse the subject to extract the person's name
      // Common patterns: "Name - Vacation", "Name - PTO", "Name - Time Off"
      // Require spaces around the dash to avoid splitting hyphenated names
      // like "Philip Hix-Coquet" at the inner hyphen.
      if (event.subject) {
        const subjectMatch = event.subject.match(/^(.+?)\s+[-–—]\s+/);
        if (subjectMatch && subjectMatch[1]) {
          userName = subjectMatch[1].trim();
        } else {
          // If no dash separator, use the whole subject as the name
          userName = event.subject.trim();
        }
      }

      // Try to find the actual user email from attendees
      // The first attendee (not the organizer/mailbox) is the person taking vacation
      let foundAttendee = false;
      if (event.attendees && event.attendees.length > 0) {
        const attendee = event.attendees.find(
          (a) => a.emailAddress?.address?.toLowerCase() !== config.vacationCalendarMailbox?.toLowerCase()
        );
        if (attendee?.emailAddress?.address) {
          userEmail = attendee.emailAddress.address;
          foundAttendee = true;
          // If we didn't get a name from subject, use attendee name
          if (userName === 'Unknown' && attendee.emailAddress.name) {
            userName = attendee.emailAddress.name;
          }
        }
      }

      // Fallback: if no attendee found AND the organizer is the shared mailbox,
      // derive a unique user ID from the parsed name so that events for
      // different people are not collapsed into one user.
      if (
        !foundAttendee &&
        userName !== 'Unknown' &&
        userEmail.toLowerCase() === config.vacationCalendarMailbox?.toLowerCase()
      ) {
        userEmail = userName.toLowerCase().replace(/\s+/g, '.') + '@calendar.local';
      }

      return toVacationEvent(event, userEmail, userName);
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


/**
 * Cancels and deletes a calendar event from the shared calendar.
 * First sends a cancellation notice to attendees (removes from their Outlook),
 * then deletes the event from the shared calendar.
 *
 * @param eventId - The Graph API event ID
 * @param logger - Optional logger
 */
export async function deleteCalendarEvent(
  eventId: string,
  logger?: Logger
): Promise<void> {
  const config = getConfig();

  if (!config.vacationCalendarMailbox) {
    throw new ApiError(
      ErrorCodes.ConfigurationError,
      "Shared calendar mailbox not configured",
      500
    );
  }

  logger?.info("Cancelling and deleting calendar event", {
    eventId,
    mailbox: config.vacationCalendarMailbox,
  });

  const eventPath = `/users/${encodeURIComponent(config.vacationCalendarMailbox)}/calendar/events/${encodeURIComponent(eventId)}`;

  // Step 1: Cancel the event — sends cancellation notices to all attendees,
  // which removes the event from their personal Outlook calendars.
  try {
    await graphPost(
      `${eventPath}/cancel`,
      { Comment: "This time-off request has been cancelled." },
      logger
    );
    logger?.info("Cancellation notice sent to attendees", { eventId });
  } catch (cancelError) {
    // Log but continue to deletion — the event may have no attendees
    // or already been removed from attendee calendars.
    logger?.warn("Failed to send cancellation notice (continuing to delete)", {
      eventId,
      error: cancelError instanceof Error ? cancelError.message : String(cancelError),
    });
  }

  // Step 2: Delete the event from the shared calendar.
  await graphDelete(eventPath, logger);

  logger?.info("Calendar event deleted successfully", { eventId });
}

/**
 * Finds and deletes calendar events by subject search.
 * Useful for cleaning up test data.
 * 
 * @param searchTerm - Text to search for in event subjects
 * @param logger - Optional logger
 * @returns Number of events deleted
 */
export async function deleteEventsBySubject(
  searchTerm: string,
  logger?: Logger
): Promise<{ deleted: number; events: Array<{ id: string; subject: string }> }> {
  const config = getConfig();

  if (!config.vacationCalendarMailbox) {
    throw new ApiError(
      ErrorCodes.ConfigurationError,
      "Shared calendar mailbox not configured",
      500
    );
  }

  logger?.info("Searching for events to delete", { searchTerm });

  // Search for events with the subject
  const endpoint = `/users/${encodeURIComponent(config.vacationCalendarMailbox)}/calendar/events`;
  const response = await graphGetWithParams<{ value: GraphCalendarEvent[] }>(
    endpoint,
    {
      "$filter": `contains(subject, '${searchTerm}')`,
      "$select": "id,subject,start,end",
      "$top": "50",
    },
    logger
  );

  const events = response.value || [];
  const deletedEvents: Array<{ id: string; subject: string }> = [];

  for (const event of events) {
    try {
      await deleteCalendarEvent(event.id, logger);
      deletedEvents.push({ id: event.id, subject: event.subject });
    } catch (error) {
      logger?.warn("Failed to delete event", {
        eventId: event.id,
        subject: event.subject,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { deleted: deletedEvents.length, events: deletedEvents };
}
