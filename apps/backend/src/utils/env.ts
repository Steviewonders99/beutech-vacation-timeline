/**
 * Environment variable utilities.
 * Provides type-safe access to environment variables with validation.
 */

import { Defaults, LogLevel } from '../config/constants';

/**
 * Configuration loaded from environment variables.
 */
export interface AppConfig {
  // Staffbase User API (for user/manager info)
  staffbaseApiKey?: string;
  staffbaseApiUrl?: string;

  // Azure AD (for Microsoft Graph / Calendar API)
  tenantId: string;
  clientId: string;
  clientSecret: string;

  // Calendar
  calendarMode: 'shared' | 'perUser';
  vacationCalendarMailbox?: string;
  vacationCategory: string;

  // Database
  databaseUrl?: string;

  // Security
  apiKey: string;
  allowedOrigins: string[];

  // API Configuration
  apiBaseUrl?: string; // Base URL for action links in emails

  // Auto-approve
  autoApproveEmails: string[];
  autoApproveDepartments: string[];

  // Settings
  maxDateRangeDays: number;
  defaultTimezone: string;
  logLevel: LogLevel;
}

/**
 * Gets a required environment variable.
 * Throws an error if the variable is not set.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Gets an optional environment variable with a default value.
 */
export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * Gets an integer environment variable with a default value.
 */
export function getIntEnv(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Gets a comma-separated list environment variable.
 */
export function getListEnv(name: string, defaultValue: string[] = []): string[] {
  const value = process.env[name];
  if (!value) return defaultValue;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Validates that CORS origins are properly configured.
 * Throws an error if using wildcard or empty in production.
 */
function validateCorsOrigins(origins: string[]): void {
  const isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production';

  if (isProduction) {
    if (origins.length === 0) {
      throw new Error(
        'ALLOWED_ORIGINS must be configured in production. ' +
        'Set it to your Staffbase domain(s), e.g., "https://yourcompany.staffbase.com"'
      );
    }

    if (origins.includes('*')) {
      throw new Error(
        'ALLOWED_ORIGINS cannot be "*" (wildcard) in production. ' +
        'Specify explicit domain(s), e.g., "https://yourcompany.staffbase.com"'
      );
    }
  }
}

/**
 * Loads and validates the application configuration from environment variables.
 */
export function loadConfig(): AppConfig {
  const calendarMode = getOptionalEnv('CALENDAR_MODE', Defaults.CALENDAR_MODE);
  if (calendarMode !== 'shared' && calendarMode !== 'perUser') {
    throw new Error(`Invalid CALENDAR_MODE: ${calendarMode}. Must be 'shared' or 'perUser'.`);
  }

  const logLevel = getOptionalEnv('LOG_LEVEL', Defaults.LOG_LEVEL) as LogLevel;
  if (!['error', 'warn', 'info', 'debug'].includes(logLevel)) {
    throw new Error(`Invalid LOG_LEVEL: ${logLevel}. Must be 'error', 'warn', 'info', or 'debug'.`);
  }

  // Validate CORS configuration
  const allowedOrigins = getListEnv('ALLOWED_ORIGINS');
  validateCorsOrigins(allowedOrigins);

  return {
    // Staffbase User API (for user/manager info)
    staffbaseApiKey: process.env.STAFFBASE_API_KEY,
    staffbaseApiUrl: process.env.STAFFBASE_API_URL,

    // Azure AD (required for Microsoft Graph / Calendar API)
    tenantId: getRequiredEnv('TENANT_ID'),
    clientId: getRequiredEnv('CLIENT_ID'),
    clientSecret: getRequiredEnv('CLIENT_SECRET'),

    // Calendar
    calendarMode,
    vacationCalendarMailbox: calendarMode === 'shared'
      ? getRequiredEnv('VACATION_CALENDAR_MAILBOX')
      : undefined,
    vacationCategory: getOptionalEnv('VACATION_CATEGORY', Defaults.VACATION_CATEGORY),

    // Database (optional - only needed for time-off request feature)
    databaseUrl: process.env.DATABASE_URL,

    // Security
    apiKey: getRequiredEnv('API_KEY'),
    allowedOrigins,

    // API Configuration (for email action links)
    apiBaseUrl: process.env.API_BASE_URL,

    // Auto-approve (lowercased for case-insensitive comparison)
    autoApproveEmails: getListEnv('AUTO_APPROVE_EMAILS').map((e) => e.toLowerCase()),
    autoApproveDepartments: getListEnv('AUTO_APPROVE_DEPARTMENTS', ['Technical']).map((d) => d.toLowerCase()),

    // Settings
    maxDateRangeDays: getIntEnv('MAX_DATE_RANGE_DAYS', Defaults.MAX_DATE_RANGE_DAYS),
    defaultTimezone: getOptionalEnv('DEFAULT_TIMEZONE', Defaults.TIMEZONE),
    logLevel,
  };
}

// Singleton config instance (lazy loaded)
let _config: AppConfig | null = null;

/**
 * Gets the application configuration.
 * Loads from environment variables on first call.
 */
export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}

/**
 * Resets the configuration (useful for testing).
 */
export function resetConfig(): void {
  _config = null;
}
