#!/bin/bash
# Deploy Infrastructure using Bicep
# Usage: ./scripts/deploy-infra.sh [environment] [action]
# Example: ./scripts/deploy-infra.sh dev deploy
# Actions: what-if (default), deploy

set -e

ENVIRONMENT=${1:-dev}
ACTION=${2:-what-if}
RESOURCE_GROUP="rg-vacationtimeline-${ENVIRONMENT}"
LOCATION=${AZURE_LOCATION:-eastus}

echo "================================================"
echo "Deploying Infrastructure"
echo "Environment: ${ENVIRONMENT}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "Location: ${LOCATION}"
echo "Action: ${ACTION}"
echo "================================================"

# Check if logged in to Azure
if ! az account show &>/dev/null; then
    echo "Error: Not logged in to Azure. Run 'az login' first."
    exit 1
fi

# Navigate to repo root
cd "$(dirname "$0")/.."

# Create resource group if it doesn't exist
echo ""
echo "Ensuring resource group exists..."
az group create \
    --name "${RESOURCE_GROUP}" \
    --location "${LOCATION}" \
    --tags environment="${ENVIRONMENT}" project=vacation-timeline

# Generate or prompt for PostgreSQL password
if [ "${ACTION}" = "deploy" ]; then
    echo ""
    echo "PostgreSQL Database Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if password is provided via environment variable
    if [ -z "${POSTGRES_PASSWORD}" ]; then
        # Generate a secure random password
        POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)
        echo "Generated PostgreSQL password (save this securely!):"
        echo ""
        echo "  ${POSTGRES_PASSWORD}"
        echo ""
        echo "This password will be used for: vtadmin@psql-vacationtimeline-${ENVIRONMENT}"
        echo ""
        read -p "Press Enter to continue with this password, or Ctrl+C to cancel..."
    else
        echo "Using PostgreSQL password from POSTGRES_PASSWORD environment variable"
    fi
fi

# Run deployment
if [ "${ACTION}" = "what-if" ]; then
    echo ""
    echo "Running What-If analysis..."
    # For what-if, use a dummy password
    az deployment group what-if \
        --resource-group "${RESOURCE_GROUP}" \
        --template-file "infra/bicep/main.bicep" \
        --parameters "infra/config/${ENVIRONMENT}.parameters.json" \
        --parameters postgresPassword="DummyPassword123!"

elif [ "${ACTION}" = "deploy" ]; then
    echo ""
    echo "Deploying infrastructure..."

    # Deploy with the PostgreSQL password
    DEPLOYMENT_OUTPUT=$(az deployment group create \
        --resource-group "${RESOURCE_GROUP}" \
        --template-file "infra/bicep/main.bicep" \
        --parameters "infra/config/${ENVIRONMENT}.parameters.json" \
        --parameters postgresPassword="${POSTGRES_PASSWORD}" \
        --name "deployment-$(date +%Y%m%d%H%M%S)" \
        --output json)

    # Extract outputs
    FUNCTION_APP_URL=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.properties.outputs.functionAppUrl.value')
    POSTGRES_FQDN=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.properties.outputs.postgresServerFqdn.value')
    POSTGRES_DB=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.properties.outputs.postgresDatabaseName.value')
    STORAGE_ACCOUNT=$(echo "${DEPLOYMENT_OUTPUT}" | jq -r '.properties.outputs.storageAccountName.value')

    # Build connection string
    DATABASE_URL="postgresql://vtadmin:${POSTGRES_PASSWORD}@${POSTGRES_FQDN}/${POSTGRES_DB}?sslmode=require"

    echo ""
    echo "Running database migrations..."
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    # Check if psql is available
    if command -v psql &> /dev/null; then
        PSQL_CMD="psql"
    elif [ -f "/opt/homebrew/opt/libpq/bin/psql" ]; then
        PSQL_CMD="/opt/homebrew/opt/libpq/bin/psql"
    else
        echo "Warning: psql not found. Please run migrations manually:"
        echo "  psql '${DATABASE_URL}' -f apps/backend/migrations/001_initial_schema.sql"
        PSQL_CMD=""
    fi

    if [ -n "${PSQL_CMD}" ]; then
        # Wait for PostgreSQL to be ready (can take a few seconds after deployment)
        echo "Waiting for PostgreSQL to be ready..."
        sleep 10

        # Run migration
        if ${PSQL_CMD} "${DATABASE_URL}" -f apps/backend/migrations/001_initial_schema.sql 2>&1; then
            echo "✓ Database migrations completed successfully"
        else
            echo "Warning: Migration may have failed. Check the output above."
            echo "You can retry manually with:"
            echo "  psql '${DATABASE_URL}' -f apps/backend/migrations/001_initial_schema.sql"
        fi
    fi

    echo ""
    echo "================================================"
    echo "          DEPLOYMENT COMPLETE!"
    echo "================================================"
    echo ""
    echo "Resources Created:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  Resource Group:    ${RESOURCE_GROUP}"
    echo "  Function App:      func-vacationtimeline-${ENVIRONMENT}"
    echo "  Storage Account:   ${STORAGE_ACCOUNT}"
    echo "  PostgreSQL Server: psql-vacationtimeline-${ENVIRONMENT}"
    echo "  Database:          ${POSTGRES_DB}"
    echo ""
    echo "URLs:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  API:      ${FUNCTION_APP_URL}"
    echo "  Postgres: ${POSTGRES_FQDN}"
    echo ""
    echo "Database Connection String (for Function App settings):"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  DATABASE_URL=${DATABASE_URL}"
    echo ""
    echo "IMPORTANT: Save the PostgreSQL password securely!"
    echo "  Username: vtadmin"
    echo "  Password: ${POSTGRES_PASSWORD}"
    echo ""
    echo "Next steps:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  1. Run: ./scripts/configure-env.sh ${ENVIRONMENT}"
    echo "  2. Run: ./scripts/deploy-backend.sh ${ENVIRONMENT}"
    echo "  3. Run: ./scripts/deploy-widget.sh ${ENVIRONMENT}"
    echo "================================================"
else
    echo "Error: Unknown action '${ACTION}'. Use 'what-if' or 'deploy'."
    exit 1
fi
