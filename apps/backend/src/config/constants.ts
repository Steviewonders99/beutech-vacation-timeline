/**
 * Application constants and configuration defaults.
 */

/**
 * API version information.
 */
export const ApiVersion = {
  /** Current API version */
  CURRENT: '1.0',
  /** API version header name */
  HEADER: 'X-API-Version',
} as const;

/**
 * Default values for configuration.
 */
export const Defaults = {
  /** Default timezone if not specified */
  TIMEZONE: 'UTC',
  /** Maximum date range in days */
  MAX_DATE_RANGE_DAYS: 90,
  /** Default calendar mode */
  CALENDAR_MODE: 'shared' as const,
  /** Default leave request category name */
  VACATION_CATEGORY: 'Leave Request',
  /** Default log level */
  LOG_LEVEL: 'info' as const,
} as const;

/**
 * Microsoft Graph API endpoints.
 */
export const GraphEndpoints = {
  /** Base URL for Microsoft Graph */
  BASE_URL: 'https://graph.microsoft.com/v1.0',
  /** Calendar view endpoint template */
  CALENDAR_VIEW: '/users/{userId}/calendarView',
  /** Events endpoint template */
  EVENTS: '/users/{userId}/events',
  /** Shared calendar endpoint template */
  SHARED_CALENDAR_VIEW: '/users/{mailbox}/calendars/{calendarId}/calendarView',
  /** User endpoint */
  USER: '/users/{userId}',
  /** Users list endpoint */
  USERS: '/users',
} as const;

/**
 * HTTP headers used in the API.
 */
export const HttpHeaders = {
  API_KEY: 'x-api-key',
  CONTENT_TYPE: 'Content-Type',
  CORRELATION_ID: 'x-correlation-id',
} as const;

/**
 * Log levels for the application.
 */
export const LogLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
} as const;

export type LogLevel = keyof typeof LogLevels;
