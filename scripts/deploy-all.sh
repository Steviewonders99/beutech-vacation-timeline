#!/bin/bash
# Master Deployment Script for Vacation Timeline
# Usage: ./scripts/deploy-all.sh [environment]
# Example: ./scripts/deploy-all.sh prod
#
# This script performs a complete deployment:
# 1. Pre-flight checks
# 2. Infrastructure deployment (if needed)
# 3. Backend deployment to Azure Functions
# 4. Widget deployment to Azure Blob Storage
# 5. Post-deployment verification

set -e

ENVIRONMENT=${1:-prod}
SCRIPT_DIR="$(dirname "$0")"

echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║       BEUTECH VACATION TIMELINE - DEPLOYMENT               ║"
echo "║       Environment: ${ENVIRONMENT}                                      ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Pre-flight checks
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 1: Pre-flight Checks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Azure CLI
if ! command -v az &> /dev/null; then
    echo -e "${RED}✗ Azure CLI not installed${NC}"
    echo "  Install: brew install azure-cli"
    exit 1
fi
echo -e "${GREEN}✓${NC} Azure CLI installed"

# Check Azure Functions Core Tools
if ! command -v func &> /dev/null; then
    echo -e "${RED}✗ Azure Functions Core Tools not installed${NC}"
    echo "  Install: npm install -g azure-functions-core-tools@4"
    exit 1
fi
echo -e "${GREEN}✓${NC} Azure Functions Core Tools installed"

# Check Azure login
if ! az account show &>/dev/null; then
    echo -e "${YELLOW}! Not logged in to Azure${NC}"
    echo "  Running 'az login'..."
    az login
fi
echo -e "${GREEN}✓${NC} Azure authenticated"

# Display current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo -e "${GREEN}✓${NC} Subscription: ${SUBSCRIPTION}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗ Node.js not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓${NC} Node.js: ${NODE_VERSION}"

echo ""
read -p "Continue with deployment to ${ENVIRONMENT}? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Infrastructure deployment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 2: Infrastructure Deployment (incl. Azure PostgreSQL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

RESOURCE_GROUP="rg-vacationtimeline-${ENVIRONMENT}"
POSTGRES_SERVER="psql-vacationtimeline-${ENVIRONMENT}"

# Check if PostgreSQL server already exists
if az postgres flexible-server show --name "${POSTGRES_SERVER}" --resource-group "${RESOURCE_GROUP}" &>/dev/null; then
    echo -e "${GREEN}✓${NC} PostgreSQL server exists: ${POSTGRES_SERVER}"
    echo -e "${GREEN}✓${NC} Resource group exists: ${RESOURCE_GROUP}"
else
    echo "Creating infrastructure (this includes Azure PostgreSQL)..."
    echo ""
    echo -e "${YELLOW}NOTE:${NC} Infrastructure deployment will:"
    echo "  • Create Azure PostgreSQL Flexible Server (~3-5 min)"
    echo "  • Generate a secure database password"
    echo "  • Run database migrations automatically"
    echo ""
    bash "${SCRIPT_DIR}/deploy-infra.sh" "${ENVIRONMENT}" deploy
fi

# Backend deployment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 3: Backend Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "${SCRIPT_DIR}/deploy-backend.sh" "${ENVIRONMENT}"

# Widget deployment
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 4: Widget Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

bash "${SCRIPT_DIR}/deploy-widget.sh" "${ENVIRONMENT}"

# Post-deployment verification
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "STEP 5: Post-Deployment Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FUNCTION_APP_NAME="func-vacationtimeline-${ENVIRONMENT}"
STORAGE_ACCOUNT="stvacationtimeline${ENVIRONMENT}"

# Get URLs
FUNCTION_URL=$(az functionapp show \
    --name "${FUNCTION_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "defaultHostName" \
    --output tsv 2>/dev/null || echo "")

WIDGET_URL=$(az storage account show \
    --name "${STORAGE_ACCOUNT}" \
    --query "primaryEndpoints.web" \
    --output tsv 2>/dev/null || echo "")

# Health check
echo "Testing API health endpoint..."
if [ -n "${FUNCTION_URL}" ]; then
    HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://${FUNCTION_URL}/api/health" 2>/dev/null || echo "000")
    if [ "${HEALTH_STATUS}" = "200" ]; then
        echo -e "${GREEN}✓${NC} API health check passed"
    else
        echo -e "${YELLOW}!${NC} API health check returned: ${HEALTH_STATUS}"
        echo "  This may be normal if environment variables aren't configured yet."
    fi
fi

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                 DEPLOYMENT COMPLETE                         ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "Resources:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Resource Group:   ${RESOURCE_GROUP}"
echo "  Function App:     ${FUNCTION_APP_NAME}"
echo "  Storage Account:  ${STORAGE_ACCOUNT}"
echo "  PostgreSQL:       ${POSTGRES_SERVER}"
echo ""
echo "URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  API Base URL:    https://${FUNCTION_URL}/api"
echo "  Widget URL:      ${WIDGET_URL}beutech.vacation-timeline.js"
echo ""
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  1. Configure environment variables (if not done):"
echo "     Run: ./scripts/configure-env.sh ${ENVIRONMENT}"
echo ""
echo "     Required variables:"
echo "     - TENANT_ID, CLIENT_ID, CLIENT_SECRET (Azure AD)"
echo "     - DATABASE_URL (from infra deployment output)"
echo "     - API_KEY (generate a secure key)"
echo "     - VACATION_CALENDAR_MAILBOX"
echo "     - ALLOWED_ORIGINS (Staffbase domain)"
echo ""
echo "  2. Register widget in Staffbase Studio:"
echo "     - URL: ${WIDGET_URL}beutech.vacation-timeline.js"
echo "     - Configure: apiBaseUrl = https://${FUNCTION_URL}/api"
echo ""
