/**
 * Azure Function: GET /api/diagnostics
 *
 * Detailed diagnostic endpoint for troubleshooting.
 * Requires API key authentication.
 * Returns comprehensive system state information.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { Pool } from 'pg';
import { getConfig } from '../../utils/env';
import { createLogger } from '../../utils/logger';
import { validateApiKey, getCorsHeaders } from '../../auth/apiKeyValidator';
import { DiagnosticCode, DiagnosticMessages } from '../../utils/diagnostics';
import { ApiError, ErrorCodes, createErrorResponse } from '../../models/ErrorResponse';

interface DiagnosticResult {
  status: 'ok' | 'warning' | 'error';
  message: string;
  details?: Record<string, unknown>;
  diagnosticCode?: DiagnosticCode;
}

interface DiagnosticsResponse {
  timestamp: string;
  environment: string;
  overall: 'healthy' | 'degraded' | 'unhealthy';
  checks: {
    configuration: DiagnosticResult;
    database: DiagnosticResult;
    graphApi: DiagnosticResult;
    actionTokens: DiagnosticResult;
    cors: DiagnosticResult;
  };
  warnings: string[];
  configuredFeatures: {
    timeOffRequests: boolean;
    emailNotifications: boolean;
    teamsNotifications: boolean;
    actionableEmailLinks: boolean;
  };
}

/**
 * Check configuration completeness
 */
function checkConfiguration(): DiagnosticResult {
  try {
    const config = getConfig();
    const warnings: string[] = [];

    // Check for missing optional but important settings
    if (!process.env.ACTION_TOKEN_SECRET) {
      warnings.push('ACTION_TOKEN_SECRET not set - using derived key');
    }
    if (!process.env.API_BASE_URL) {
      warnings.push('API_BASE_URL not set - email action links disabled');
    }
    if (!process.env.NOTIFICATION_FROM_EMAIL) {
      warnings.push('NOTIFICATION_FROM_EMAIL not set - using default');
    }

    if (warnings.length > 0) {
      return {
        status: 'warning',
        message: 'Configuration loaded with warnings',
        details: { warnings, calendarMode: config.calendarMode },
      };
    }

    return {
      status: 'ok',
      message: 'All configuration loaded successfully',
      details: {
        calendarMode: config.calendarMode,
        hasDatabase: !!config.databaseUrl,
        originsConfigured: config.allowedOrigins.length,
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Configuration failed to load',
      diagnosticCode: DiagnosticCode.CORS_WILDCARD,
    };
  }
}

/**
 * Check database connectivity and tables
 */
async function checkDatabase(): Promise<DiagnosticResult> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      status: 'warning',
      message: 'Database not configured (time-off requests disabled)',
      diagnosticCode: DiagnosticCode.DATABASE_URL_INVALID,
    };
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();

    // Check connectivity
    await client.query('SELECT 1');

    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'time_off_requests'
    `);

    client.release();
    await pool.end();

    if (tableCheck.rows.length === 0) {
      return {
        status: 'error',
        message: 'Database connected but tables missing. Run: npm run migrate',
        diagnosticCode: DiagnosticCode.DATABASE_TABLE_MISSING,
      };
    }

    return {
      status: 'ok',
      message: 'Database connected and tables exist',
    };
  } catch (error) {
    await pool.end().catch(() => {});
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Provide specific hints based on error
    let hint = '';
    if (errorMsg.includes('ECONNREFUSED')) {
      hint = 'Database server is not reachable';
    } else if (errorMsg.includes('password')) {
      hint = 'Check database credentials in DATABASE_URL';
    } else if (errorMsg.includes('SSL') || errorMsg.includes('certificate')) {
      hint = 'Add ?sslmode=require to DATABASE_URL';
    } else if (errorMsg.includes('timeout')) {
      hint = 'Database server is slow or unreachable';
    }

    return {
      status: 'error',
      message: `Database connection failed: ${errorMsg}`,
      details: hint ? { hint } : undefined,
      diagnosticCode: DiagnosticCode.DATABASE_URL_INVALID,
    };
  }
}

/**
 * Check Graph API connectivity (lightweight check)
 */
async function checkGraphApi(): Promise<DiagnosticResult> {
  try {
    const config = getConfig();

    // Try to get an access token
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          scope: 'https://graph.microsoft.com/.default',
          grant_type: 'client_credentials',
        }),
      }
    );

    if (!tokenResponse.ok) {
      const error = await tokenResponse.json().catch(() => ({}));
      return {
        status: 'error',
        message: `Failed to acquire Graph API token: ${error.error_description || tokenResponse.statusText}`,
        details: {
          statusCode: tokenResponse.status,
          error: error.error,
          hint: 'Check TENANT_ID, CLIENT_ID, and CLIENT_SECRET',
        },
        diagnosticCode: DiagnosticCode.GRAPH_PERMISSION_DENIED,
      };
    }

    // Token acquired successfully - try a simple Graph call
    const tokenData = await tokenResponse.json();
    const graphResponse = await fetch(
      'https://graph.microsoft.com/v1.0/organization',
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (graphResponse.ok) {
      return {
        status: 'ok',
        message: 'Graph API authentication successful',
      };
    }

    return {
      status: 'warning',
      message: 'Graph API token acquired but API call failed',
      details: {
        statusCode: graphResponse.status,
        hint: 'Token works but may lack some permissions',
      },
    };
  } catch (error) {
    return {
      status: 'error',
      message: `Graph API check failed: ${error instanceof Error ? error.message : String(error)}`,
      diagnosticCode: DiagnosticCode.GRAPH_PERMISSION_DENIED,
    };
  }
}

/**
 * Check action token configuration
 */
function checkActionTokens(): DiagnosticResult {
  const secret = process.env.ACTION_TOKEN_SECRET;
  const apiBaseUrl = process.env.API_BASE_URL;

  if (!apiBaseUrl) {
    return {
      status: 'warning',
      message: 'API_BASE_URL not set - email action links will not work',
      diagnosticCode: DiagnosticCode.EMAIL_SEND_FAILED,
    };
  }

  if (!secret) {
    return {
      status: 'warning',
      message: 'ACTION_TOKEN_SECRET not set - using derived key from API_KEY',
      details: { hint: 'Set ACTION_TOKEN_SECRET for better security' },
      diagnosticCode: DiagnosticCode.ACTION_TOKEN_WEAK,
    };
  }

  if (secret.length < 32) {
    return {
      status: 'warning',
      message: `ACTION_TOKEN_SECRET is short (${secret.length} chars, recommend 32+)`,
      diagnosticCode: DiagnosticCode.ACTION_TOKEN_WEAK,
    };
  }

  return {
    status: 'ok',
    message: 'Action tokens properly configured',
  };
}

/**
 * Check CORS configuration
 */
function checkCors(): DiagnosticResult {
  const origins = process.env.ALLOWED_ORIGINS;
  const isProduction = process.env.NODE_ENV === 'production' ||
                       process.env.AZURE_FUNCTIONS_ENVIRONMENT === 'Production';

  if (!origins) {
    if (isProduction) {
      return {
        status: 'error',
        message: 'ALLOWED_ORIGINS not set in production',
        diagnosticCode: DiagnosticCode.CORS_WILDCARD,
      };
    }
    return {
      status: 'warning',
      message: 'ALLOWED_ORIGINS not set (using permissive defaults for development)',
    };
  }

  if (origins === '*') {
    if (isProduction) {
      return {
        status: 'error',
        message: 'ALLOWED_ORIGINS cannot be "*" in production',
        diagnosticCode: DiagnosticCode.CORS_WILDCARD,
      };
    }
    return {
      status: 'warning',
      message: 'ALLOWED_ORIGINS is "*" - only acceptable for development',
    };
  }

  const originList = origins.split(',').map(o => o.trim());
  const httpOrigins = originList.filter(o => o.startsWith('http://'));

  if (httpOrigins.length > 0 && isProduction) {
    return {
      status: 'warning',
      message: 'Some origins use http:// instead of https://',
      details: { httpOrigins },
    };
  }

  return {
    status: 'ok',
    message: `CORS configured with ${originList.length} origin(s)`,
    details: { origins: originList },
  };
}

/**
 * Handler for GET /api/diagnostics
 */
async function diagnosticsHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const config = getConfig();
  const logger = createLogger(context, config.logLevel);
  const corsHeaders = getCorsHeaders(request, logger);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return { status: 204, headers: corsHeaders };
  }

  try {
    // Require API key for diagnostics (contains sensitive info)
    validateApiKey(request, logger);

    logger.info('Running diagnostics');

    // Run all checks
    const [dbResult, graphResult] = await Promise.all([
      checkDatabase(),
      checkGraphApi(),
    ]);

    const configResult = checkConfiguration();
    const tokenResult = checkActionTokens();
    const corsResult = checkCors();

    // Collect warnings
    const warnings: string[] = [];
    const allChecks = [configResult, dbResult, graphResult, tokenResult, corsResult];
    for (const check of allChecks) {
      if (check.diagnosticCode) {
        const diag = DiagnosticMessages[check.diagnosticCode];
        warnings.push(`[${check.diagnosticCode}] ${diag.title}: ${diag.remediation}`);
      }
    }

    // Determine overall status
    const hasErrors = allChecks.some(c => c.status === 'error');
    const hasWarnings = allChecks.some(c => c.status === 'warning');
    const overall = hasErrors ? 'unhealthy' : hasWarnings ? 'degraded' : 'healthy';

    const response: DiagnosticsResponse = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      overall,
      checks: {
        configuration: configResult,
        database: dbResult,
        graphApi: graphResult,
        actionTokens: tokenResult,
        cors: corsResult,
      },
      warnings,
      configuredFeatures: {
        timeOffRequests: !!process.env.DATABASE_URL,
        emailNotifications: !!process.env.NOTIFICATION_FROM_EMAIL,
        teamsNotifications: true, // Always enabled if Graph works
        actionableEmailLinks: !!process.env.API_BASE_URL,
      },
    };

    return {
      status: overall === 'unhealthy' ? 503 : 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
      body: JSON.stringify(response, null, 2),
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
        body: JSON.stringify(error.toResponse()),
      };
    }

    logger.error('Diagnostics failed', { error: error instanceof Error ? error.message : String(error) });

    return {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify(createErrorResponse(ErrorCodes.InternalError, 'Diagnostics failed')),
    };
  }
}

// Register the function
app.http('diagnostics', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'diagnostics',
  handler: diagnosticsHandler,
});

export default diagnosticsHandler;
