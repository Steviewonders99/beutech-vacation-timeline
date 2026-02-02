/**
 * Azure PostgreSQL Flexible Server for Vacation Timeline.
 * Uses the Burstable tier for cost-effective development/production workloads.
 */

@description('PostgreSQL server name')
param serverName string

@description('Azure region')
param location string

@description('Resource tags')
param tags object

@description('Administrator login name')
param administratorLogin string = 'vtadmin'

@description('Administrator password')
@secure()
param administratorPassword string

@description('Database name')
param databaseName string = 'vacationtimeline'

@description('PostgreSQL version')
@allowed(['14', '15', '16'])
param postgresVersion string = '16'

@description('SKU name (Burstable B1ms is cost-effective for small workloads)')
param skuName string = 'Standard_B1ms'

@description('SKU tier')
@allowed(['Burstable', 'GeneralPurpose', 'MemoryOptimized'])
param skuTier string = 'Burstable'

@description('Storage size in GB')
param storageSizeGB int = 32

@description('Backup retention days')
param backupRetentionDays int = 7

@description('Enable high availability')
param highAvailability bool = false

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: serverName
  location: location
  tags: tags
  sku: {
    name: skuName
    tier: skuTier
  }
  properties: {
    version: postgresVersion
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: highAvailability ? 'ZoneRedundant' : 'Disabled'
    }
    // Allow Azure services to connect
    network: {
      publicNetworkAccess: 'Enabled'
    }
  }
}

// Firewall rule to allow Azure services
resource allowAzureServices 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Firewall rule to allow all IPs (for development - restrict in production)
resource allowAll 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAll'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

// Database
resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: databaseName
  properties: {
    charset: 'UTF8'
    collation: 'en_US.utf8'
  }
}

// Configure server parameters for better performance
resource requireSsl 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  name: 'require_secure_transport'
  properties: {
    value: 'ON'
    source: 'user-override'
  }
}

// Outputs
output serverName string = postgresServer.name
output serverFqdn string = postgresServer.properties.fullyQualifiedDomainName
output databaseName string = database.name
output administratorLogin string = administratorLogin

// Connection string format (password must be appended)
output connectionStringTemplate string = 'postgresql://${administratorLogin}@${serverName}:{PASSWORD}@${postgresServer.properties.fullyQualifiedDomainName}/${databaseName}?sslmode=require'
