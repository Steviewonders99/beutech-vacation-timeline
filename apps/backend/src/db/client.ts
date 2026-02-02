/**
 * PostgreSQL database client for serverless environments.
 * Uses the pg driver which works with both Neon and Azure PostgreSQL.
 */

import { Pool, PoolClient } from 'pg';
import { getConfig } from '../utils/env';
import { Logger } from '../utils/logger';
import { diagnoseDatabaseError, logDiagnostic, DiagnosticCode } from '../utils/diagnostics';

// Connection pool singleton
let pool: Pool | null = null;

/**
 * Gets or creates a PostgreSQL connection pool.
 * The pool is cached for connection reuse across function invocations.
 */
export function getPool(logger?: Logger): Pool {
  if (!pool) {
    const config = getConfig();

    if (!config.databaseUrl) {
      logDiagnostic(logger, DiagnosticCode.DATABASE_URL_INVALID, {
        reason: 'DATABASE_URL environment variable is not configured',
      });
      throw new Error('DATABASE_URL environment variable is not configured');
    }

    // Log connection details (without exposing password)
    const maskedUrl = config.databaseUrl.replace(/:[^:@]+@/, ':***@');
    logger?.debug('Creating new PostgreSQL connection pool', {
      connectionString: maskedUrl,
      hasSSL: config.databaseUrl.includes('sslmode=require'),
    });

    pool = new Pool({
      connectionString: config.databaseUrl,
      // Enable SSL for Azure PostgreSQL and Neon
      ssl: config.databaseUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
      // Optimize for serverless
      max: 5, // Maximum connections in pool
      idleTimeoutMillis: 30000, // Close idle connections after 30s
      connectionTimeoutMillis: 10000, // Timeout after 10s if can't connect
    });

    // Handle pool errors with diagnostics
    pool.on('error', (err) => {
      const diagnostic = diagnoseDatabaseError(err);
      logDiagnostic(logger, diagnostic.code, {
        ...diagnostic.context,
        poolEvent: 'error',
      });
    });

    pool.on('connect', () => {
      logger?.debug('Database pool: new connection established');
    });
  }

  return pool;
}

/**
 * Executes a parameterized SQL query with logging.
 */
export async function query<T = unknown>(
  sql: string,
  params: unknown[] = [],
  logger?: Logger
): Promise<T[]> {
  const dbPool = getPool(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Executing SQL query', {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      paramCount: params.length,
    });

    const result = await dbPool.query(sql, params);

    logger?.debug('Query completed', {
      rowCount: result.rowCount,
      durationMs: Date.now() - startTime,
    });

    return result.rows as T[];
  } catch (error) {
    const diagnostic = diagnoseDatabaseError(error);
    logDiagnostic(logger, diagnostic.code, {
      ...diagnostic.context,
      sql: sql.substring(0, 100),
      paramCount: params.length,
      durationMs: Date.now() - startTime,
    });
    throw error;
  }
}

/**
 * Executes a query and returns the first row, or null if no rows.
 */
export async function queryOne<T = unknown>(
  sql: string,
  params: unknown[] = [],
  logger?: Logger
): Promise<T | null> {
  const results = await query<T>(sql, params, logger);
  return results.length > 0 ? results[0] : null;
}

/**
 * Executes an INSERT query and returns the inserted row.
 */
export async function insert<T = unknown>(
  table: string,
  data: Record<string, unknown>,
  logger?: Logger
): Promise<T> {
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const columnNames = columns.map(toSnakeCase).join(', ');

  const sql = `
    INSERT INTO ${table} (${columnNames})
    VALUES (${placeholders})
    RETURNING *
  `;

  const result = await query<T>(sql, values, logger);

  if (result.length === 0) {
    throw new Error(`Insert into ${table} did not return a row`);
  }

  return result[0];
}

/**
 * Executes an UPDATE query and returns the updated row.
 */
export async function update<T = unknown>(
  table: string,
  id: string,
  data: Record<string, unknown>,
  logger?: Logger
): Promise<T | null> {
  const columns = Object.keys(data);
  const values = Object.values(data);

  const setClause = columns
    .map((col, i) => `${toSnakeCase(col)} = $${i + 1}`)
    .join(', ');

  const sql = `
    UPDATE ${table}
    SET ${setClause}, updated_at = NOW()
    WHERE id = $${columns.length + 1}
    RETURNING *
  `;

  return queryOne<T>(sql, [...values, id], logger);
}

/**
 * Executes a transaction with the provided callback.
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
  logger?: Logger
): Promise<T> {
  const dbPool = getPool(logger);
  const client = await dbPool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Converts camelCase to snake_case.
 */
function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Converts snake_case database row to camelCase object.
 */
export function toCamelCase<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) =>
      letter.toUpperCase()
    );
    result[camelKey] = value;
  }

  return result as T;
}

/**
 * Converts multiple rows from snake_case to camelCase.
 */
export function toCamelCaseArray<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => toCamelCase<T>(row));
}

/**
 * Closes the connection pool (useful for testing or graceful shutdown).
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
