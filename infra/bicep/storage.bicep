/**
 * Storage Account for Azure Functions.
 */

@description('Storage account name')
param storageAccountName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    networkAcls: {
      defaultAction: 'Allow'
      bypass: 'AzureServices'
    }
  }
}

output storageAccountName string = storageAccount.name
output storageAccountKey string = storageAccount.listKeys().keys[0].value
