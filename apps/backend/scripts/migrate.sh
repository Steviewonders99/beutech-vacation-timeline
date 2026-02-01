#!/bin/bash
# Database migration script
#
# Usage:
#   ./scripts/migrate.sh                    # Uses DATABASE_URL from environment
#   DATABASE_URL=... ./scripts/migrate.sh   # Explicit connection string
#
# For production, set DATABASE_URL from Azure Key Vault or similar.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL environment variable is required"
    echo ""
    echo "Usage:"
    echo "  DATABASE_URL=postgres://user:pass@host/db ./scripts/migrate.sh"
    exit 1
fi

echo "Running database migrations..."
npx ts-node scripts/migrate.ts

echo ""
echo "Migration completed!"
