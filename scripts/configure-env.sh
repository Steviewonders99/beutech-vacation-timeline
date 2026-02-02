#!/bin/bash
# Configure Azure Function App Environment Variables
# Usage: ./scripts/configure-env.sh [environment]
#
# This script sets all required environment variables on the Azure Function App.
# You'll be prompted for sensitive values like secrets.

set -e

ENVIRONMENT=${1:-prod}
RESOURCE_GROUP="rg-vacationtimeline-${ENVIRONMENT}"
FUNCTION_APP_NAME="func-vacationtimeline-${ENVIRONMENT}"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       CONFIGURE ENVIRONMENT VARIABLES                       ║"
echo "║       Function App: ${FUNCTION_APP_NAME}                    ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Check Azure login
if ! az account show &>/dev/null; then
    echo "Not logged in to Azure. Running 'az login'..."
    az login
fi

# Verify function app exists
if ! az functionapp show --name "${FUNCTION_APP_NAME}" --resource-group "${RESOURCE_GROUP}" &>/dev/null; then
    echo "Error: Function App '${FUNCTION_APP_NAME}' not found in resource group '${RESOURCE_GROUP}'"
    echo "Run deploy-infra.sh first to create the infrastructure."
    exit 1
fi

echo "This script will configure the following environment variables:"
echo ""
echo "  REQUIRED:"
echo "  ─────────"
echo "  • TENANT_ID - Azure AD tenant ID"
echo "  • CLIENT_ID - Azure AD app registration client ID"
echo "  • CLIENT_SECRET - Azure AD app registration secret"
echo "  • DATABASE_URL - Neon PostgreSQL connection string"
echo "  • API_KEY - API key for widget authentication"
echo "  • VACATION_CALENDAR_MAILBOX - Shared mailbox for calendar events"
echo "  • ALLOWED_ORIGINS - Staffbase domain(s) for CORS"
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Enter the values below (or press Enter to skip):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Azure AD Configuration
read -p "TENANT_ID: " TENANT_ID
read -p "CLIENT_ID: " CLIENT_ID
read -s -p "CLIENT_SECRET: " CLIENT_SECRET
echo ""

# Database (Azure PostgreSQL)
echo ""
echo "For DATABASE_URL, use the connection string from infrastructure deployment:"
echo "Format: postgresql://vtadmin:{PASSWORD}@psql-vacationtimeline-${ENVIRONMENT}.postgres.database.azure.com/vacationtimeline?sslmode=require"
echo ""
read -p "DATABASE_URL: " DATABASE_URL

# API Security
read -p "API_KEY [generate a strong key]: " API_KEY

# Calendar
read -p "VACATION_CALENDAR_MAILBOX [e.g., vacations@company.com]: " VACATION_CALENDAR_MAILBOX

# CORS
read -p "ALLOWED_ORIGINS [e.g., https://company.staffbase.com]: " ALLOWED_ORIGINS

# API Base URL (for email action buttons)
echo ""
echo "API_BASE_URL enables Approve/Reject buttons in email notifications."
echo "Format: https://func-vacationtimeline-${ENVIRONMENT}.azurewebsites.net/api"
echo ""
read -p "API_BASE_URL: " API_BASE_URL

# Build settings string
SETTINGS=""

if [ -n "${TENANT_ID}" ]; then
    SETTINGS="${SETTINGS} TENANT_ID=${TENANT_ID}"
fi

if [ -n "${CLIENT_ID}" ]; then
    SETTINGS="${SETTINGS} CLIENT_ID=${CLIENT_ID}"
fi

if [ -n "${CLIENT_SECRET}" ]; then
    SETTINGS="${SETTINGS} CLIENT_SECRET=${CLIENT_SECRET}"
fi

if [ -n "${DATABASE_URL}" ]; then
    SETTINGS="${SETTINGS} DATABASE_URL=${DATABASE_URL}"
fi

if [ -n "${API_KEY}" ]; then
    SETTINGS="${SETTINGS} API_KEY=${API_KEY}"
fi

if [ -n "${VACATION_CALENDAR_MAILBOX}" ]; then
    SETTINGS="${SETTINGS} VACATION_CALENDAR_MAILBOX=${VACATION_CALENDAR_MAILBOX}"
fi

if [ -n "${ALLOWED_ORIGINS}" ]; then
    SETTINGS="${SETTINGS} ALLOWED_ORIGINS=${ALLOWED_ORIGINS}"
fi

if [ -n "${API_BASE_URL}" ]; then
    SETTINGS="${SETTINGS} API_BASE_URL=${API_BASE_URL}"
fi

# Add default settings
SETTINGS="${SETTINGS} CALENDAR_MODE=shared"
SETTINGS="${SETTINGS} VACATION_CATEGORY=Vacation"
SETTINGS="${SETTINGS} DEFAULT_TIMEZONE=UTC"
SETTINGS="${SETTINGS} MAX_DATE_RANGE_DAYS=90"
SETTINGS="${SETTINGS} LOG_LEVEL=info"

if [ -z "${SETTINGS}" ]; then
    echo "No settings provided. Exiting."
    exit 0
fi

echo ""
echo "Applying settings to ${FUNCTION_APP_NAME}..."
echo ""

# Apply settings
az functionapp config appsettings set \
    --name "${FUNCTION_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --settings ${SETTINGS} \
    --output table

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment variables configured successfully!"
echo ""
echo "You can verify settings in Azure Portal:"
echo "https://portal.azure.com/#@/resource/subscriptions/.../resourceGroups/${RESOURCE_GROUP}/providers/Microsoft.Web/sites/${FUNCTION_APP_NAME}/configuration"
echo ""
