#!/usr/bin/env npx ts-node
/**
 * Database migration script.
 *
 * Usage:
 *   npx ts-node scripts/migrate.ts
 *   DATABASE_URL=... npx ts-node scripts/migrate.ts
 *
 * This script runs all pending migrations in order.
 */

import { neon, neonConfig } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Disable connection pooling for migrations
neonConfig.fetchConnectionCache = true;

interface Migration {
  version: string;
  filename: string;
  sql: string;
}

interface AppliedMigration {
  version: string;
  applied_at: string;
}

async function getAppliedMigrations(sql: ReturnType<typeof neon>): Promise<Set<string>> {
  try {
    // Check if migrations table exists
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'schema_migrations'
      ) as exists
    `;

    if (!tableCheck[0]?.exists) {
      console.log('Creating schema_migrations table...');
      await sql`
        CREATE TABLE schema_migrations (
          version VARCHAR(255) PRIMARY KEY,
          applied_at TIMESTAMPTZ DEFAULT NOW()
        )
      `;
      return new Set();
    }

    const result = await sql<AppliedMigration[]>`
      SELECT version, applied_at::text FROM schema_migrations ORDER BY version
    `;

    return new Set(result.map(r => r.version));
  } catch (error) {
    console.error('Error checking migrations:', error);
    return new Set();
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

async function runMigration(
  sql: ReturnType<typeof neon>,
  migration: Migration
): Promise<void> {
  console.log(`Running migration: ${migration.version}`);

  try {
    // Run the migration SQL
    await sql.transaction(async (tx) => {
      // Split by semicolons and run each statement
      // Note: This is a simple approach. For complex migrations, consider using a proper migration tool.
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        await tx.unsafe(statement);
      }
    });

    console.log(`  ✓ Migration ${migration.version} completed`);
  } catch (error) {
    console.error(`  ✗ Migration ${migration.version} failed:`, error);
    throw error;
  }
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  console.log('Connecting to database...');
  const sql = neon(databaseUrl);

  try {
    // Test connection
    const result = await sql`SELECT NOW() as now`;
    console.log(`Connected at ${result[0]?.now}`);

    // Get applied migrations
    const applied = await getAppliedMigrations(sql);
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
      await runMigration(sql, migration);
    }

    console.log('\nAll migrations completed successfully!');
  } catch (error) {
    console.error('\nMigration failed:', error);
    process.exit(1);
  }
}

main();
