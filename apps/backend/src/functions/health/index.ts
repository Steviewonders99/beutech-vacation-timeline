/**
 * Azure Function: GET /api/health
 *
 * Health check endpoint for monitoring and deployment verification.
 * Does not require authentication.
 */

import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from '@azure/functions';
import { Pool } from 'pg';
import { getConfig, resetConfig } from '../../utils/env';
import { getCorsHeaders } from '../../auth/apiKeyValidator';

/**
 * Health status values.
 */
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Individual check result.
 */
interface CheckResult {
  status: 'ok' | 'error';
  latencyMs?: number;
  error?: string;
}

/**
 * Health check response.
 */
interface HealthResponse {
  status: HealthStatus;
  version: string;
  timestamp: string;
  uptime: number;
  checks: {
    config: CheckResult;
    database?: CheckResult;
  };
}

// Track startup time for uptime calculation
const startupTime = Date.now();

// Version from package.json (set during build)
const VERSION = process.env.npm_package_version || '1.0.0';

/**
 * Checks if configuration can be loaded.
 */
function checkConfig(): CheckResult {
  const start = Date.now();
  try {
    // Reset config to force reload (useful for detecting config changes)
    resetConfig();
    getConfig();
    return {
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Configuration load failed',
    };
  }
}

/**
 * Checks database connectivity.
 */
async function checkDatabase(): Promise<CheckResult> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      status: 'ok',
      latencyMs: 0,
      error: 'Database not configured (optional)',
    };
  }

  const start = Date.now();
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
    max: 1,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query('SELECT 1 as health_check');
    client.release();
    await pool.end();
    return {
      status: 'ok',
      latencyMs: Date.now() - start,
    };
  } catch (error) {
    await pool.end().catch(() => {}); // Ignore cleanup errors
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
}

/**
 * Determines overall health status from individual checks.
 */
function determineOverallStatus(checks: HealthResponse['checks']): HealthStatus {
  const checkResults = Object.values(checks);

  // If config fails, we're unhealthy (can't function at all)
  if (checks.config.status === 'error') {
    return 'unhealthy';
  }

  // If database fails but it's optional, we're degraded
  if (checks.database?.status === 'error' && !checks.database.error?.includes('not configured')) {
    return 'degraded';
  }

  // All checks passed
  const hasErrors = checkResults.some((c) => c.status === 'error');
  return hasErrors ? 'degraded' : 'healthy';
}

/**
 * Handler for GET /api/health
 */
async function healthHandler(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  // Get CORS headers (but don't validate API key for health checks)
  let corsHeaders: Record<string, string> = {};
  try {
    corsHeaders = getCorsHeaders(request);
  } catch {
    // If CORS headers fail, continue without them for health checks
  }

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return {
      status: 204,
      headers: corsHeaders,
    };
  }

  context.log('Health check requested');

  // Run all checks
  const configCheck = checkConfig();
  const databaseCheck = await checkDatabase();

  const checks: HealthResponse['checks'] = {
    config: configCheck,
    database: databaseCheck,
  };

  const response: HealthResponse = {
    status: determineOverallStatus(checks),
    version: VERSION,
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startupTime) / 1000),
    checks,
  };

  // Return 200 for healthy/degraded, 503 for unhealthy
  const statusCode = response.status === 'unhealthy' ? 503 : 200;

  return {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      ...corsHeaders,
    },
    body: JSON.stringify(response),
  };
}

// Register the function
app.http('health', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'health',
  handler: healthHandler,
});

export default healthHandler;
