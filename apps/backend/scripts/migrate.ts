#!/usr/bin/env npx ts-node
/**
 * Database migration script.
 *
 * Usage:
 *   npx ts-node scripts/migrate.ts
 *   DATABASE_URL=... npx ts-node scripts/migrate.ts
 *
 * This script runs all pending migrations in order.
 * Works with both Neon and Azure PostgreSQL.
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface Migration {
  version: string;
  filename: string;
  sql: string;
}

interface AppliedMigration {
  version: string;
  applied_at: string;
}

async function getAppliedMigrations(pool: Pool): Promise<Set<string>> {
  const client = await pool.connect();
  try {
    // Check if migrations table exists
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) as exists
    `);

    if (!tableCheck.rows[0]?.exists) {
      console.log('Creating schema_migrations table...');
      await client.query(`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      return new Set();
    }

    const result = await client.query<AppliedMigration>(`
      SELECT version, applied_at::text FROM schema_migrations ORDER BY version
    `);

    return new Set(result.rows.map(r => r.version));
  } finally {
    client.release();
  }
}

function loadMigrations(): Migration[] {
  const migrationsDir = path.join(__dirname, '..', 'migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.log('No migrations directory found');
    return [];
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(filename => {
    const version = filename.replace('.sql', '');
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf8');

    return { version, filename, sql };
  });
}

async function runMigration(pool: Pool, migration: Migration): Promise<void> {
  console.log(`Running migration: ${migration.version}`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Run the migration SQL
    // Note: We run the entire SQL file as one statement to preserve transactions
    // within the migration file itself
    await client.query(migration.sql);

    await client.query('COMMIT');
    console.log(`  ✓ Migration ${migration.version} completed`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`  ✗ Migration ${migration.version} failed:`, error);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    console.error('');
    console.error('Usage:');
    console.error('  DATABASE_URL=postgresql://user:pass@host/db npx ts-node scripts/migrate.ts');
    process.exit(1);
  }

  console.log('Connecting to database...');

  // Create connection pool with SSL for Azure PostgreSQL
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseUrl.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    // Test connection
    const client = await pool.connect();
    const result = await client.query('SELECT NOW() as now');
    console.log(`Connected at ${result.rows[0]?.now}`);
    client.release();

    // Get applied migrations
    const applied = await getAppliedMigrations(pool);
    console.log(`Found ${applied.size} applied migrations`);

    // Load all migrations
    const migrations = loadMigrations();
    console.log(`Found ${migrations.length} migration files`);

    // Find pending migrations
    const pending = migrations.filter(m => !applied.has(m.version));

    if (pending.length === 0) {
      console.log('No pending migrations');
      return;
    }

    console.log(`Running ${pending.length} pending migrations...`);

    for (const migration of pending) {
      await runMigration(pool, migration);
    }

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
