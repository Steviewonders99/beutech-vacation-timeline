/**
 * Diagnostics utilities for debugging production issues.
 * Each diagnostic code corresponds to a known issue in KNOWN-ISSUES-AND-PITFALLS.md
 */

import { Logger } from './logger';

/**
 * Diagnostic error codes mapped to known issues.
 * Format: DIAG-XX where XX corresponds to the issue number in documentation.
 */
export enum DiagnosticCode {
  // Critical Issues (Will Break the App)
  CORS_WILDCARD = 'DIAG-01',           // ALLOWED_ORIGINS set to wildcard
  MISSING_CALENDAR_MAILBOX = 'DIAG-02', // Missing SHARED_CALENDAR_MAILBOX
  GRAPH_PERMISSION_DENIED = 'DIAG-03',  // Azure AD missing permissions
  DATABASE_URL_INVALID = 'DIAG-04',     // Wrong DATABASE_URL format
  DATABASE_TABLE_MISSING = 'DIAG-05',   // Database tables don't exist

  // Major Bugs (App Works But Behaves Wrong)
  API_KEY_MISMATCH = 'DIAG-06',         // API key mismatch
  CORS_ORIGIN_MISMATCH = 'DIAG-07',     // CORS origin doesn't match
  TIMEZONE_MISMATCH = 'DIAG-08',        // Timezone issues
  ACTION_TOKEN_WEAK = 'DIAG-09',        // ACTION_TOKEN_SECRET not set
  EMAIL_SEND_FAILED = 'DIAG-10',        // Notification email permission

  // Edge Cases
  HEALTH_MISLEADING = 'DIAG-11',        // Health OK but app broken
  ROUTE_CONFLICT = 'DIAG-12',           // Route conflict (fixed)
  CALENDAR_EVENTS_MISSING = 'DIAG-13',  // Events not showing
  MANAGER_NOT_DETECTED = 'DIAG-14',     // Supervisor not detected
}

/**
 * Detailed diagnostic messages with remediation steps.
 */
export const DiagnosticMessages: Record<DiagnosticCode, {
  title: string;
  description: string;
  remediation: string;
  docLink: string;
}> = {
  [DiagnosticCode.CORS_WILDCARD]: {
    title: 'CORS Wildcard Not Allowed in Production',
    description: 'ALLOWED_ORIGINS is set to "*" which is blocked in production for security.',
    remediation: 'Set ALLOWED_ORIGINS to your exact Staffbase domain(s), e.g., "https://yourcompany.staffbase.com"',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#1-allowed_origins-set-to-wildcard-',
  },
  [DiagnosticCode.MISSING_CALENDAR_MAILBOX]: {
    title: 'Shared Calendar Mailbox Not Configured',
    description: 'CALENDAR_MODE is "shared" but VACATION_CALENDAR_MAILBOX is not set or the mailbox does not exist.',
    remediation: 'Set VACATION_CALENDAR_MAILBOX to a valid shared mailbox email, e.g., "leave-calendar@yourcompany.com"',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#2-missing-or-incorrect-shared_calendar_mailbox',
  },
  [DiagnosticCode.GRAPH_PERMISSION_DENIED]: {
    title: 'Microsoft Graph API Permission Denied',
    description: 'The Azure AD app registration is missing required API permissions.',
    remediation: 'In Azure Portal > App Registration > API Permissions, add: Calendars.Read, Calendars.ReadWrite, Mail.Send, User.Read.All. Then click "Grant admin consent".',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#3-azure-ad-app-missing-required-permissions',
  },
  [DiagnosticCode.DATABASE_URL_INVALID]: {
    title: 'Database Connection Failed',
    description: 'DATABASE_URL is invalid or the database server is unreachable.',
    remediation: 'Verify DATABASE_URL format: postgresql://user:pass@server:5432/dbname?sslmode=require',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#4-wrong-database_url-format',
  },
  [DiagnosticCode.DATABASE_TABLE_MISSING]: {
    title: 'Database Tables Not Found',
    description: 'The time_off_requests table does not exist. Migrations may not have been run.',
    remediation: 'Run database migrations: cd apps/backend && npm run migrate',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#5-database-tables-dont-exist',
  },
  [DiagnosticCode.API_KEY_MISMATCH]: {
    title: 'API Key Authentication Failed',
    description: 'The API key provided in the request does not match the configured API_KEY.',
    remediation: 'Ensure the widget apiKey config EXACTLY matches the backend API_KEY environment variable (case-sensitive).',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#6-api_key-mismatch-between-widget-and-backend',
  },
  [DiagnosticCode.CORS_ORIGIN_MISMATCH]: {
    title: 'CORS Origin Rejected',
    description: 'The request origin is not in the ALLOWED_ORIGINS list.',
    remediation: 'Add the exact origin (including https://) to ALLOWED_ORIGINS. Check browser console for the actual origin.',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#7-cors-origin-doesnt-match-staffbase-domain-exactly',
  },
  [DiagnosticCode.TIMEZONE_MISMATCH]: {
    title: 'Timezone Configuration Issue',
    description: 'Events may appear on wrong dates due to timezone handling.',
    remediation: 'Set DEFAULT_TIMEZONE to match your users timezone, e.g., "America/New_York" or "Europe/Berlin".',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#8-timezone-mismatch',
  },
  [DiagnosticCode.ACTION_TOKEN_WEAK]: {
    title: 'Action Token Secret Not Configured',
    description: 'ACTION_TOKEN_SECRET is not set or is using a weak default. Email action links may be vulnerable.',
    remediation: 'Set ACTION_TOKEN_SECRET to a strong random string: openssl rand -base64 32',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#9-action_token_secret-not-set-or-too-weak',
  },
  [DiagnosticCode.EMAIL_SEND_FAILED]: {
    title: 'Email Notification Failed',
    description: 'Failed to send email notification. The app may lack Mail.Send permission.',
    remediation: 'Ensure NOTIFICATION_FROM_EMAIL is a valid mailbox and the app has Mail.Send permission.',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#10-notification_from_email-doesnt-have-send-permission',
  },
  [DiagnosticCode.HEALTH_MISLEADING]: {
    title: 'Health Check Incomplete',
    description: 'Health endpoint only checks config and database. Graph API issues are not detected.',
    remediation: 'Run the full validation script: npm run validate',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#11-health-endpoint-shows-healthy-but-app-doesnt-work',
  },
  [DiagnosticCode.ROUTE_CONFLICT]: {
    title: 'Route Conflict Detected',
    description: 'Multiple functions are registered for the same route.',
    remediation: 'This issue was fixed in commit a941f07. Pull the latest code.',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#12-duplicate-route-registration-already-fixed',
  },
  [DiagnosticCode.CALENDAR_EVENTS_MISSING]: {
    title: 'Calendar Events Not Found',
    description: 'No leave request events returned for the requested date range.',
    remediation: 'Check: 1) Events exist in the calendar, 2) Events have the leave request category, 3) User email matches M365 UPN.',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#13-calendar-events-not-showing-for-some-users',
  },
  [DiagnosticCode.MANAGER_NOT_DETECTED]: {
    title: 'Manager/Supervisor Not Detected',
    description: 'User does not appear as a supervisor even though they manage direct reports.',
    remediation: 'Ensure Staffbase user sync includes manager relationships from Active Directory.',
    docLink: 'docs/KNOWN-ISSUES-AND-PITFALLS.md#14-managersupervisor-not-detected',
  },
};

/**
 * Logs a diagnostic error with full context.
 */
export function logDiagnostic(
  logger: Logger | undefined,
  code: DiagnosticCode,
  context: Record<string, unknown> = {}
): void {
  const diagnostic = DiagnosticMessages[code];

  const message = `[${code}] ${diagnostic.title}`;
  const data = {
    diagnosticCode: code,
    description: diagnostic.description,
    remediation: diagnostic.remediation,
    documentation: diagnostic.docLink,
    ...context,
  };

  if (logger) {
    logger.error(message, data);
  } else {
    console.error(`[ERROR] ${message}`, JSON.stringify(data, null, 2));
  }
}

/**
 * Creates a diagnostic error response for API endpoints.
 */
export function createDiagnosticError(
  code: DiagnosticCode,
  additionalInfo?: string
): { code: string; message: string; remediation: string; documentation: string } {
  const diagnostic = DiagnosticMessages[code];
  return {
    code,
    message: additionalInfo ? `${diagnostic.description} ${additionalInfo}` : diagnostic.description,
    remediation: diagnostic.remediation,
    documentation: diagnostic.docLink,
  };
}

/**
 * Startup diagnostics - logs configuration state on first request.
 */
let startupDiagnosticsRun = false;

export function runStartupDiagnostics(logger?: Logger): void {
  if (startupDiagnosticsRun) return;
  startupDiagnosticsRun = true;

  const log = (level: 'info' | 'warn' | 'error', message: string, data?: Record<string, unknown>) => {
    if (logger) {
      logger[level](message, data);
    } else {
      console[level](`[STARTUP] ${message}`, data ? JSON.stringify(data) : '');
    }
  };

  log('info', '=== STARTUP DIAGNOSTICS ===');

  // Check environment
  const env = process.env.NODE_ENV || 'development';
  const azureEnv = process.env.AZURE_FUNCTIONS_ENVIRONMENT || 'unknown';
  log('info', 'Environment', { nodeEnv: env, azureEnv });

  // Check critical env vars (without exposing secrets)
  const criticalVars = [
    'TENANT_ID',
    'CLIENT_ID',
    'CLIENT_SECRET',
    'API_KEY',
    'DATABASE_URL',
    'ALLOWED_ORIGINS',
    'CALENDAR_MODE',
    'VACATION_CALENDAR_MAILBOX',
    'ACTION_TOKEN_SECRET',
    'NOTIFICATION_FROM_EMAIL',
    'API_BASE_URL',
  ];

  const envStatus: Record<string, string> = {};
  for (const varName of criticalVars) {
    const value = process.env[varName];
    if (!value) {
      envStatus[varName] = 'NOT SET';
    } else if (varName.includes('SECRET') || varName.includes('KEY') || varName.includes('PASSWORD')) {
      envStatus[varName] = `SET (${value.length} chars)`;
    } else if (varName === 'DATABASE_URL') {
      // Mask password in URL
      envStatus[varName] = value.replace(/:[^:@]+@/, ':***@');
    } else {
      envStatus[varName] = value;
    }
  }
  log('info', 'Environment Variables', envStatus);

  // Check for common misconfigurations
  const warnings: string[] = [];

  if (!process.env.ACTION_TOKEN_SECRET) {
    warnings.push(`${DiagnosticCode.ACTION_TOKEN_WEAK}: ACTION_TOKEN_SECRET not set`);
  } else if (process.env.ACTION_TOKEN_SECRET.length < 32) {
    warnings.push(`${DiagnosticCode.ACTION_TOKEN_WEAK}: ACTION_TOKEN_SECRET is short (${process.env.ACTION_TOKEN_SECRET.length} chars, recommend 32+)`);
  }

  if (process.env.ALLOWED_ORIGINS === '*') {
    warnings.push(`${DiagnosticCode.CORS_WILDCARD}: ALLOWED_ORIGINS is wildcard`);
  }

  if (process.env.CALENDAR_MODE === 'shared' && !process.env.VACATION_CALENDAR_MAILBOX) {
    warnings.push(`${DiagnosticCode.MISSING_CALENDAR_MAILBOX}: Shared mode but no mailbox configured`);
  }

  if (!process.env.API_BASE_URL) {
    warnings.push(`${DiagnosticCode.EMAIL_SEND_FAILED}: API_BASE_URL not set - email action links will not work`);
  }

  if (!process.env.DATABASE_URL) {
    warnings.push(`${DiagnosticCode.DATABASE_URL_INVALID}: DATABASE_URL not set - time-off requests will fail`);
  }

  if (warnings.length > 0) {
    log('warn', 'Configuration Warnings', { warnings });
  } else {
    log('info', 'No configuration warnings detected');
  }

  log('info', '=== END STARTUP DIAGNOSTICS ===');
}

/**
 * Extracts diagnostic info from Graph API errors.
 */
export function diagnoseGraphError(
  error: unknown,
  operation: string
): { code: DiagnosticCode; context: Record<string, unknown> } {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errorString = JSON.stringify(error);

  // Check for common Graph API error patterns
  if (errorString.includes('403') || errorMessage.includes('Forbidden') || errorMessage.includes('Access denied')) {
    return {
      code: DiagnosticCode.GRAPH_PERMISSION_DENIED,
      context: {
        operation,
        errorMessage,
        hint: 'Check Azure AD app permissions and admin consent',
      },
    };
  }

  if (errorString.includes('404') || errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
    if (operation.includes('calendar') || operation.includes('Calendar')) {
      return {
        code: DiagnosticCode.MISSING_CALENDAR_MAILBOX,
        context: {
          operation,
          errorMessage,
          hint: 'Verify VACATION_CALENDAR_MAILBOX email exists in M365',
        },
      };
    }
    return {
      code: DiagnosticCode.CALENDAR_EVENTS_MISSING,
      context: { operation, errorMessage },
    };
  }

  if (errorString.includes('401') || errorMessage.includes('Unauthorized') || errorMessage.includes('token')) {
    return {
      code: DiagnosticCode.GRAPH_PERMISSION_DENIED,
      context: {
        operation,
        errorMessage,
        hint: 'Azure AD credentials may be invalid or expired',
      },
    };
  }

  // Default to permission denied for unknown Graph errors
  return {
    code: DiagnosticCode.GRAPH_PERMISSION_DENIED,
    context: { operation, errorMessage },
  };
}

/**
 * Extracts diagnostic info from database errors.
 */
export function diagnoseDatabaseError(
  error: unknown
): { code: DiagnosticCode; context: Record<string, unknown> } {
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
    return {
      code: DiagnosticCode.DATABASE_TABLE_MISSING,
      context: {
        errorMessage,
        hint: 'Run migrations: npm run migrate',
      },
    };
  }

  if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
    return {
      code: DiagnosticCode.DATABASE_URL_INVALID,
      context: {
        errorMessage,
        hint: 'Check DATABASE_URL and ensure database server is reachable',
      },
    };
  }

  if (errorMessage.includes('password') || errorMessage.includes('authentication')) {
    return {
      code: DiagnosticCode.DATABASE_URL_INVALID,
      context: {
        errorMessage,
        hint: 'Check database username and password in DATABASE_URL',
      },
    };
  }

  if (errorMessage.includes('SSL') || errorMessage.includes('certificate')) {
    return {
      code: DiagnosticCode.DATABASE_URL_INVALID,
      context: {
        errorMessage,
        hint: 'Add ?sslmode=require to DATABASE_URL for Azure PostgreSQL',
      },
    };
  }

  return {
    code: DiagnosticCode.DATABASE_URL_INVALID,
    context: { errorMessage },
  };
}

/**
 * Debug helper to log request details.
 */
export function logRequestDebug(
  logger: Logger,
  request: { url: string; method: string; headers: Headers },
  label: string
): void {
  const origin = request.headers.get('origin') || 'none';
  const apiKey = request.headers.get('x-api-key');
  const contentType = request.headers.get('content-type');

  logger.debug(`[REQUEST DEBUG] ${label}`, {
    method: request.method,
    url: request.url,
    origin,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    contentType,
  });
}
