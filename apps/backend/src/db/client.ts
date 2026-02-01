/**
 * Neon PostgreSQL database client for serverless environments.
 * Uses the @neondatabase/serverless driver optimized for edge/serverless functions.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import { getConfig } from '../utils/env';
import { Logger } from '../utils/logger';

// Configure Neon for Azure Functions environment
neonConfig.fetchConnectionCache = true;

// Type for the Neon SQL function
type NeonSqlFunction = ReturnType<typeof neon>;

let sqlClient: NeonSqlFunction | null = null;

/**
 * Gets or creates a Neon SQL client singleton.
 * The client is cached for connection reuse across function invocations.
 */
export function getDbClient(logger?: Logger): NeonSqlFunction {
  if (!sqlClient) {
    const config = getConfig();

    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not configured');
    }

    logger?.debug('Creating new Neon database client');
    sqlClient = neon(config.databaseUrl);
  }

  return sqlClient;
}

/**
 * Executes a parameterized SQL query with logging.
 * Uses Neon's tagged template literal syntax under the hood.
 */
export async function query<T = unknown>(
  sql: string,
  params: unknown[] = [],
  logger?: Logger
): Promise<T[]> {
  const client = getDbClient(logger);
  const startTime = Date.now();

  try {
    logger?.debug('Executing SQL query', {
      sql: sql.substring(0, 100) + (sql.length > 100 ? '...' : ''),
      paramCount: params.length,
    });

    // Neon client expects tagged template literal, but we can call it with
    // an array that looks like a template strings array
    const templateStrings = [sql] as unknown as TemplateStringsArray;
    // For parameterized queries, we use the raw SQL approach
    // The neon function can be called with (sql, params) for parameterized queries
    const result = await client(templateStrings, ...params);

    logger?.debug('Query completed', {
      rowCount: Array.isArray(result) ? result.length : 0,
      durationMs: Date.now() - startTime,
    });

    return (Array.isArray(result) ? result : []) as T[];
  } catch (error) {
    logger?.error('Database query failed', {
      error: error instanceof Error ? error.message : String(error),
      sql: sql.substring(0, 100),
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
