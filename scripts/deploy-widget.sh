#!/bin/bash
# Deploy Widget to Azure Blob Storage
# Usage: ./scripts/deploy-widget.sh [environment]
# Example: ./scripts/deploy-widget.sh dev

set -e

ENVIRONMENT=${1:-dev}
STORAGE_ACCOUNT="stvacationtimeline${ENVIRONMENT}"
CONTAINER='$web'

echo "================================================"
echo "Deploying Widget to Azure Blob Storage"
echo "Environment: ${ENVIRONMENT}"
echo "Storage Account: ${STORAGE_ACCOUNT}"
echo "================================================"

# Check if logged in to Azure
if ! az account show &>/dev/null; then
    echo "Error: Not logged in to Azure. Run 'az login' first."
    exit 1
fi

# Navigate to widget directory
cd "$(dirname "$0")/../apps/widget"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm ci

# Build the widget
echo ""
echo "Building widget..."
npm run build

# Enable static website hosting (if not already enabled)
echo ""
echo "Ensuring static website hosting is enabled..."
az storage blob service-properties update \
    --account-name "${STORAGE_ACCOUNT}" \
    --static-website \
    --index-document "index.html" \
    --404-document "404.html" \
    --auth-mode login 2>/dev/null || true

# Upload widget bundle with correct filename (beautech, not beutech)
# Also upload under legacy name for backward compatibility with existing Staffbase configs
BUNDLE_FILE="dist/beautech.vacation-timeline.js"

echo ""
echo "Uploading widget bundle..."
az storage blob upload \
    --account-name "${STORAGE_ACCOUNT}" \
    --container-name "${CONTAINER}" \
    --name "beautech.vacation-timeline.js" \
    --file "${BUNDLE_FILE}" \
    --overwrite \
    --auth-mode login

echo "Uploading legacy-named copy (beutech) for backward compatibility..."
az storage blob upload \
    --account-name "${STORAGE_ACCOUNT}" \
    --container-name "${CONTAINER}" \
    --name "beutech.vacation-timeline.js" \
    --file "${BUNDLE_FILE}" \
    --overwrite \
    --auth-mode login

# Get the static website URL
STATIC_URL=$(az storage account show \
    --name "${STORAGE_ACCOUNT}" \
    --query "primaryEndpoints.web" \
    --output tsv)

echo ""
echo "================================================"
echo "Deployment Complete!"
echo "Widget URL: ${STATIC_URL}beautech.vacation-timeline.js"
echo "Legacy URL: ${STATIC_URL}beutech.vacation-timeline.js"
echo ""
echo "Use either URL in Staffbase Studio when registering"
echo "the custom widget."
echo "================================================"
