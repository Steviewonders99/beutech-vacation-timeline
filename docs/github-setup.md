# GitHub Repository Setup

This guide walks you through configuring GitHub Actions for automated CI/CD deployments.

## Prerequisites

1. GitHub repository created
2. Azure subscription with appropriate permissions
3. Azure CLI installed locally
4. Azure AD App Registration created (see main setup docs)

## Step 1: Create Azure Service Principal

Create a service principal for GitHub Actions to authenticate with Azure.

### For Development Environment

```bash
# Login to Azure
az login

# Create service principal with Contributor role
az ad sp create-for-rbac \
  --name "sp-vacationtimeline-github-dev" \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-vacationtimeline-dev \
  --sdk-auth
```

Save the JSON output - you'll need it for GitHub secrets.

### For Production Environment

```bash
az ad sp create-for-rbac \
  --name "sp-vacationtimeline-github-prod" \
  --role Contributor \
  --scopes /subscriptions/{subscription-id}/resourceGroups/rg-vacationtimeline-prod \
  --sdk-auth
```

## Step 2: Configure GitHub Secrets

Navigate to your GitHub repository → **Settings** → **Secrets and variables** → **Actions**.

### Repository Secrets

| Secret Name | Description | Value |
|-------------|-------------|-------|
| `AZURE_CREDENTIALS_DEV` | Service principal JSON for dev | Full JSON output from Step 1 |
| `AZURE_CREDENTIALS_PROD` | Service principal JSON for prod | Full JSON output from Step 1 |

## Step 3: Configure GitHub Variables

Navigate to **Settings** → **Secrets and variables** → **Actions** → **Variables** tab.

### Repository Variables

| Variable Name | Dev Value | Prod Value |
|---------------|-----------|------------|
| `AZURE_FUNCTIONAPP_NAME_DEV` | `func-vacationtimeline-dev` | - |
| `AZURE_FUNCTIONAPP_NAME_PROD` | - | `func-vacationtimeline-prod` |
| `AZURE_STORAGE_ACCOUNT_DEV` | `stvacationtimelinedev` | - |
| `AZURE_STORAGE_ACCOUNT_PROD` | - | `stvacationtimelineprod` |
| `AZURE_RESOURCE_GROUP_DEV` | `rg-vacationtimeline-dev` | - |
| `AZURE_RESOURCE_GROUP_PROD` | - | `rg-vacationtimeline-prod` |
| `AZURE_LOCATION` | `eastus` | `eastus` |

### Optional CDN Variables (if using Azure CDN)

| Variable Name | Description |
|---------------|-------------|
| `AZURE_CDN_PROFILE_DEV` | CDN profile name for dev |
| `AZURE_CDN_ENDPOINT_DEV` | CDN endpoint name for dev |
| `AZURE_CDN_PROFILE_PROD` | CDN profile name for prod |
| `AZURE_CDN_ENDPOINT_PROD` | CDN endpoint name for prod |

## Step 4: Configure GitHub Environments

Navigate to **Settings** → **Environments**.

### Create "development" Environment

1. Click **New environment** → Name: `development`
2. No protection rules required
3. Add environment-specific secrets if needed

### Create "production" Environment

1. Click **New environment** → Name: `production`
2. Enable **Required reviewers** and add team members
3. Optionally enable **Wait timer** (e.g., 5 minutes)
4. Add environment-specific secrets if needed

## Step 5: Verify Branch Protection

Navigate to **Settings** → **Branches** → **Add branch protection rule**.

For `main` branch:
- [x] Require a pull request before merging
- [x] Require status checks to pass before merging
  - Add: `Build & Test`
- [x] Require branches to be up to date before merging

## Workflow Overview

### CI/CD Pipeline (`ci-cd.yml`)

| Trigger | Jobs | Description |
|---------|------|-------------|
| Push to `main` | Build → Deploy Dev | Automatically deploys to development |
| Pull Request | Build only | Validates changes without deploying |
| Manual dispatch | Build → Deploy (env) | Deploy to selected environment |

### Infrastructure Pipeline (`infra-deploy.yml`)

| Trigger | Actions | Description |
|---------|---------|-------------|
| Manual dispatch | what-if | Preview infrastructure changes |
| Manual dispatch | deploy | Apply infrastructure changes |

## Running Deployments

### Automatic Deployment (Development)

Push or merge to `main` branch triggers automatic deployment to development.

### Manual Deployment (Production)

1. Go to **Actions** → **CI/CD Pipeline**
2. Click **Run workflow**
3. Select `prod` environment
4. Click **Run workflow**
5. Approve the deployment in the production environment

### Infrastructure Deployment

1. Go to **Actions** → **Infrastructure Deployment**
2. Click **Run workflow**
3. Select environment and action (`what-if` or `deploy`)
4. Click **Run workflow**

## Troubleshooting

### "Azure Login Failed"

- Verify service principal credentials are correctly copied
- Check that the service principal has Contributor role on the resource group
- Ensure the secret hasn't expired

### "Function App Not Found"

- Verify the Function App name in variables matches the deployed resource
- Ensure infrastructure was deployed before app deployment

### "Storage Upload Failed"

- Verify storage account name is correct
- Ensure static website hosting is enabled on the storage account
- Check that service principal has Storage Blob Data Contributor role

### Adding Storage Blob Permissions

If uploads fail, grant the service principal access to storage:

```bash
# Get service principal object ID
SP_ID=$(az ad sp list --display-name "sp-vacationtimeline-github-dev" --query "[0].id" -o tsv)

# Grant Storage Blob Data Contributor role
az role assignment create \
  --role "Storage Blob Data Contributor" \
  --assignee-object-id $SP_ID \
  --assignee-principal-type ServicePrincipal \
  --scope /subscriptions/{subscription-id}/resourceGroups/rg-vacationtimeline-dev/providers/Microsoft.Storage/storageAccounts/stvacationtimelinedev
```

## Security Best Practices

1. **Rotate Credentials**: Regenerate service principal secrets periodically
2. **Least Privilege**: Only grant necessary permissions to service principals
3. **Environment Protection**: Use required reviewers for production
4. **Secret Scanning**: Enable GitHub secret scanning on the repository
5. **Branch Protection**: Require PR reviews before merging to main
