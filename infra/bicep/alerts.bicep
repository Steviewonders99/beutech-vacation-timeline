// Azure Monitor Alerts for Vacation Timeline
// Deploy with: az deployment group create -g <rg> -f alerts.bicep -p @alerts.parameters.json

@description('Base name for resources')
param baseName string

@description('Environment (dev, prod)')
param environment string

@description('Application Insights resource ID')
param appInsightsId string

@description('Action group resource ID for notifications')
param actionGroupId string

@description('Tags to apply to all resources')
param tags object = {}

// Naming
var alertPrefix = 'alert-${baseName}-${environment}'

// High Error Rate Alert
resource highErrorRateAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${alertPrefix}-high-error-rate'
  location: 'global'
  tags: tags
  properties: {
    description: 'Triggers when the error rate exceeds 5% for 5 minutes'
    severity: 1 // Critical
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'HighErrorRate'
          metricName: 'requests/failed'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5
          timeAggregation: 'Count'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// Slow Response Alert
resource slowResponseAlert 'Microsoft.Insights/metricAlerts@2018-03-01' = {
  name: '${alertPrefix}-slow-response'
  location: 'global'
  tags: tags
  properties: {
    description: 'Triggers when p95 response time exceeds 5 seconds for 5 minutes'
    severity: 2 // Warning
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT1M'
    windowSize: 'PT5M'
    criteria: {
      'odata.type': 'Microsoft.Azure.Monitor.SingleResourceMultipleMetricCriteria'
      allOf: [
        {
          name: 'SlowResponse'
          metricName: 'requests/duration'
          metricNamespace: 'microsoft.insights/components'
          operator: 'GreaterThan'
          threshold: 5000 // 5 seconds in ms
          timeAggregation: 'Average'
          criterionType: 'StaticThresholdCriterion'
        }
      ]
    }
    actions: [
      {
        actionGroupId: actionGroupId
      }
    ]
  }
}

// Health Check Failed Alert (using availability test)
resource healthCheckAlert 'Microsoft.Insights/scheduledqueryrules@2022-06-15' = {
  name: '${alertPrefix}-health-check-failed'
  location: resourceGroup().location
  tags: tags
  properties: {
    description: 'Triggers when health check fails 3 consecutive times'
    severity: 1 // Critical
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: '''
            requests
            | where name == "health"
            | where success == false
            | summarize FailureCount = count() by bin(timestamp, 5m)
            | where FailureCount >= 3
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 0
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// Unauthorized Access Alert
resource unauthorizedAccessAlert 'Microsoft.Insights/scheduledqueryrules@2022-06-15' = {
  name: '${alertPrefix}-unauthorized-access'
  location: resourceGroup().location
  tags: tags
  properties: {
    description: 'Triggers when there are more than 50 unauthorized (401) errors per hour'
    severity: 2 // Warning
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT15M'
    windowSize: 'PT1H'
    criteria: {
      allOf: [
        {
          query: '''
            requests
            | where resultCode == "401"
            | summarize UnauthorizedCount = count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 50
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// Graph API Errors Alert
resource graphApiErrorsAlert 'Microsoft.Insights/scheduledqueryrules@2022-06-15' = {
  name: '${alertPrefix}-graph-api-errors'
  location: resourceGroup().location
  tags: tags
  properties: {
    description: 'Triggers when Graph API errors exceed 10 per 15 minutes'
    severity: 2 // Warning
    enabled: true
    scopes: [appInsightsId]
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    criteria: {
      allOf: [
        {
          query: '''
            exceptions
            | where type contains "Graph" or message contains "Graph"
            | summarize ErrorCount = count()
          '''
          timeAggregation: 'Count'
          operator: 'GreaterThan'
          threshold: 10
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [actionGroupId]
    }
  }
}

// Outputs
output highErrorRateAlertId string = highErrorRateAlert.id
output slowResponseAlertId string = slowResponseAlert.id
output healthCheckAlertId string = healthCheckAlert.id
output unauthorizedAccessAlertId string = unauthorizedAccessAlert.id
output graphApiErrorsAlertId string = graphApiErrorsAlert.id
