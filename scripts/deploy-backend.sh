#!/bin/bash
# Deploy Backend to Azure Functions
# Usage: ./scripts/deploy-backend.sh [environment]
# Example: ./scripts/deploy-backend.sh dev

set -e

ENVIRONMENT=${1:-dev}
FUNCTION_APP_NAME="func-vacationtimeline-${ENVIRONMENT}"
RESOURCE_GROUP="rg-vacationtimeline-${ENVIRONMENT}"

echo "================================================"
echo "Deploying Backend to Azure Functions"
echo "Environment: ${ENVIRONMENT}"
echo "Function App: ${FUNCTION_APP_NAME}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo "================================================"

# Check if logged in to Azure
if ! az account show &>/dev/null; then
    echo "Error: Not logged in to Azure. Run 'az login' first."
    exit 1
fi

# Navigate to backend directory
cd "$(dirname "$0")/../apps/backend"

# Install production dependencies
echo ""
echo "Installing production dependencies..."
npm ci --omit=dev

# Build the backend
echo ""
echo "Building backend..."
npm run build

# Deploy to Azure Functions
echo ""
echo "Deploying to Azure Functions..."
func azure functionapp publish "${FUNCTION_APP_NAME}"

# Verify deployment
echo ""
echo "Verifying deployment..."
FUNCTION_URL=$(az functionapp show \
    --name "${FUNCTION_APP_NAME}" \
    --resource-group "${RESOURCE_GROUP}" \
    --query "defaultHostName" \
    --output tsv)

echo ""
echo "================================================"
echo "Deployment Complete!"
echo "Function App URL: https://${FUNCTION_URL}"
echo "API Endpoint: https://${FUNCTION_URL}/api/vacations"
echo "================================================"
