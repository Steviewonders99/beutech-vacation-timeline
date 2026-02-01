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

# Run deployment
if [ "${ACTION}" = "what-if" ]; then
    echo ""
    echo "Running What-If analysis..."
    az deployment group what-if \
        --resource-group "${RESOURCE_GROUP}" \
        --template-file "infra/bicep/main.bicep" \
        --parameters "infra/config/${ENVIRONMENT}.parameters.json"
elif [ "${ACTION}" = "deploy" ]; then
    echo ""
    echo "Deploying infrastructure..."
    az deployment group create \
        --resource-group "${RESOURCE_GROUP}" \
        --template-file "infra/bicep/main.bicep" \
        --parameters "infra/config/${ENVIRONMENT}.parameters.json" \
        --name "deployment-$(date +%Y%m%d%H%M%S)"

    echo ""
    echo "================================================"
    echo "Deployment Complete!"
    echo ""
    echo "Resources created in: ${RESOURCE_GROUP}"
    echo ""
    echo "Next steps:"
    echo "1. Configure Azure AD App Registration secrets"
    echo "2. Set API_KEY in Function App settings"
    echo "3. Deploy the backend: ./scripts/deploy-backend.sh ${ENVIRONMENT}"
    echo "4. Deploy the widget: ./scripts/deploy-widget.sh ${ENVIRONMENT}"
    echo "================================================"
else
    echo "Error: Unknown action '${ACTION}'. Use 'what-if' or 'deploy'."
    exit 1
fi
