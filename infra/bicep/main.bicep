/**
 * Main Bicep template for Vacation Timeline infrastructure.
 * Deploys: Storage Account, Function App, App Insights, PostgreSQL, and optionally Key Vault.
 */

@description('Environment name (dev, staging, prod)')
@allowed(['dev', 'staging', 'prod'])
param environment string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Base name for resources')
param baseName string = 'vacationtimeline'

@description('Whether to deploy Key Vault')
param deployKeyVault bool = false

@description('Allowed CORS origins (comma-separated)')
param allowedOrigins string = '*'

@description('PostgreSQL administrator password')
@secure()
param postgresPassword string

@description('PostgreSQL SKU tier (Burstable is cost-effective for small workloads)')
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param postgresSkuTier string = 'Burstable'

// Resource naming
var resourceSuffix = '${baseName}-${environment}'
var storageAccountName = replace('st${baseName}${environment}', '-', '')
var functionAppName = 'func-${resourceSuffix}'
var appServicePlanName = 'asp-${resourceSuffix}'
var appInsightsName = 'ai-${resourceSuffix}'
var keyVaultName = 'kv-${resourceSuffix}'
var postgresServerName = 'psql-${resourceSuffix}'

// Tags
var tags = {
  Environment: environment
  Application: 'VacationTimeline'
  ManagedBy: 'Bicep'
}

// Storage Account
module storage 'storage.bicep' = {
  name: 'storage-deployment'
  params: {
    storageAccountName: storageAccountName
    location: location
    tags: tags
  }
}

// Application Insights
module appInsights 'appInsights.bicep' = {
  name: 'appinsights-deployment'
  params: {
    appInsightsName: appInsightsName
    location: location
    tags: tags
  }
}

// Function App
module functionApp 'functionApp.bicep' = {
  name: 'functionapp-deployment'
  params: {
    functionAppName: functionAppName
    appServicePlanName: appServicePlanName
    location: location
    tags: tags
    storageAccountName: storage.outputs.storageAccountName
    storageAccountKey: storage.outputs.storageAccountKey
    appInsightsInstrumentationKey: appInsights.outputs.instrumentationKey
    appInsightsConnectionString: appInsights.outputs.connectionString
    allowedOrigins: allowedOrigins
  }
}

// PostgreSQL Database
module postgresql 'postgresql.bicep' = {
  name: 'postgresql-deployment'
  params: {
    serverName: postgresServerName
    location: location
    tags: tags
    administratorPassword: postgresPassword
    skuTier: postgresSkuTier
  }
}

// Key Vault (optional)
module keyVault 'keyVault.bicep' = if (deployKeyVault) {
  name: 'keyvault-deployment'
  params: {
    keyVaultName: keyVaultName
    location: location
    tags: tags
    functionAppPrincipalId: functionApp.outputs.principalId
  }
}

// Outputs
output functionAppName string = functionApp.outputs.functionAppName
output functionAppUrl string = functionApp.outputs.functionAppUrl
output storageAccountName string = storage.outputs.storageAccountName
output appInsightsName string = appInsights.outputs.appInsightsName
output keyVaultName string = deployKeyVault ? keyVault.outputs.keyVaultName : ''
output postgresServerName string = postgresql.outputs.serverName
output postgresServerFqdn string = postgresql.outputs.serverFqdn
output postgresDatabaseName string = postgresql.outputs.databaseName
output postgresConnectionStringTemplate string = postgresql.outputs.connectionStringTemplate
