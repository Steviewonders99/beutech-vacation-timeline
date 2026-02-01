/**
 * Vacation event model representing a normalized vacation from Microsoft Graph.
 */

/**
 * Represents a single vacation event.
 * This is the normalized format returned by the API.
 */
export interface VacationEvent {
  /** Unique identifier from Microsoft Graph */
  id: string;
  /** User's Microsoft 365 ID or email (UPN) */
  userId: string;
  /** User's display name for the timeline row label */
  userDisplayName: string;
  /** Consistent color key for this user (typically email) */
  userColorKey: string;
  /** Event title (usually "Vacation" or similar) */
  title: string;
  /** Start date/time in ISO 8601 format */
  start: string;
  /** End date/time in ISO 8601 format */
  end: string;
}

/**
 * Response metadata for the vacations endpoint.
 */
export interface VacationsMeta {
  /** Requested range start (ISO 8601) */
  start: string;
  /** Requested range end (ISO 8601) */
  end: string;
  /** When the response was generated (ISO 8601) */
  generatedAt: string;
}

/**
 * Full API response from GET /api/vacations.
 */
export interface VacationsResponse {
  events: VacationEvent[];
  meta: VacationsMeta;
}

/**
 * Response from GET /api/vacations/next-event.
 * Returns the first future date that has a vacation event.
 */
export interface NextEventResponse {
  /** The start date of the first future event (ISO 8601 date), or null if none found */
  nextEventDate: string | null;
  /** When the response was generated (ISO 8601) */
  generatedAt: string;
}

/**
 * Query parameters for the vacations endpoint.
 */
export interface VacationsQueryParams {
  /** Start date (ISO 8601) */
  start: string;
  /** End date (ISO 8601) */
  end: string;
  /** View type */
  view: 'day' | 'week' | 'month' | 'timeline';
  /** Optional comma-separated list of user IDs/emails */
  users?: string;
  /** Optional timezone (Olson ID) */
  timezone?: string;
}

/**
 * Raw event from Microsoft Graph calendar API.
 */
export interface GraphCalendarEvent {
  id: string;
  subject: string;
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  isAllDay: boolean;
  categories?: string[];
  organizer?: {
    emailAddress: {
      name: string;
      address: string;
    };
  };
  attendees?: Array<{
    emailAddress: {
      name: string;
      address: string;
    };
    type: string;
  }>;
}

/**
 * Transforms a Graph calendar event to our VacationEvent format.
 */
export function toVacationEvent(
  graphEvent: GraphCalendarEvent,
  userId: string,
  userDisplayName: string
): VacationEvent {
  return {
    id: graphEvent.id,
    userId,
    userDisplayName,
    userColorKey: userId.toLowerCase(),
    title: graphEvent.subject || 'Vacation',
    start: graphEvent.start.dateTime,
    end: graphEvent.end.dateTime,
  };
}
