/**
 * Application Insights telemetry integration.
 * Provides custom metrics, events, and enhanced logging for Azure monitoring.
 */

import * as appInsights from 'applicationinsights';

// Singleton instance
let isInitialized = false;
let client: appInsights.TelemetryClient | null = null;

/**
 * Initializes Application Insights.
 * Should be called at application startup.
 */
export function initializeAppInsights(): void {
  if (isInitialized) {
    return;
  }

  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  const instrumentationKey = process.env.APPINSIGHTS_INSTRUMENTATIONKEY;

  if (!connectionString && !instrumentationKey) {
    console.log('Application Insights not configured, telemetry disabled');
    return;
  }

  try {
    appInsights
      .setup(connectionString || instrumentationKey)
      .setAutoDependencyCorrelation(true)
      .setAutoCollectRequests(true)
      .setAutoCollectPerformance(true, true)
      .setAutoCollectExceptions(true)
      .setAutoCollectDependencies(true)
      .setAutoCollectConsole(true, true)
      .setUseDiskRetryCaching(true)
      .setSendLiveMetrics(false) // Disable live metrics for cost savings
      .start();

    client = appInsights.defaultClient;
    isInitialized = true;

    console.log('Application Insights initialized');
  } catch (error) {
    console.error('Failed to initialize Application Insights:', error);
  }
}

/**
 * Gets the Application Insights client.
 * Returns null if not initialized.
 */
export function getClient(): appInsights.TelemetryClient | null {
  return client;
}

/**
 * Custom metric names for the application.
 */
export const MetricNames = {
  /** Number of vacation events fetched */
  VACATION_EVENTS_FETCHED: 'vacation_events_fetched',
  /** Latency for request approval operations */
  REQUEST_APPROVAL_LATENCY: 'request_approval_latency_ms',
  /** Latency for request rejection operations */
  REQUEST_REJECTION_LATENCY: 'request_rejection_latency_ms',
  /** Number of Graph API errors */
  GRAPH_API_ERRORS: 'graph_api_errors',
  /** API request duration */
  API_REQUEST_DURATION: 'api_request_duration_ms',
  /** Number of active users */
  ACTIVE_USERS: 'active_users',
  /** Time-off requests created */
  REQUESTS_CREATED: 'requests_created',
  /** Health check status */
  HEALTH_CHECK_STATUS: 'health_check_status',
} as const;

/**
 * Custom event names for the application.
 */
export const EventNames = {
  /** Vacation data fetch completed */
  VACATIONS_FETCHED: 'VacationsFetched',
  /** Time-off request created */
  REQUEST_CREATED: 'RequestCreated',
  /** Time-off request approved */
  REQUEST_APPROVED: 'RequestApproved',
  /** Time-off request rejected */
  REQUEST_REJECTED: 'RequestRejected',
  /** Graph API call made */
  GRAPH_API_CALL: 'GraphApiCall',
  /** Authentication failure */
  AUTH_FAILURE: 'AuthFailure',
  /** Configuration error */
  CONFIG_ERROR: 'ConfigError',
} as const;

/**
 * Tracks a custom metric.
 *
 * @param name - Metric name
 * @param value - Metric value
 * @param properties - Additional properties
 */
export function trackMetric(
  name: string,
  value: number,
  properties?: Record<string, string>
): void {
  if (!client) return;

  client.trackMetric({
    name,
    value,
    properties,
  });
}

/**
 * Tracks a custom event.
 *
 * @param name - Event name
 * @param properties - Event properties
 * @param measurements - Event measurements
 */
export function trackEvent(
  name: string,
  properties?: Record<string, string>,
  measurements?: Record<string, number>
): void {
  if (!client) return;

  client.trackEvent({
    name,
    properties,
    measurements,
  });
}

/**
 * Tracks an exception.
 *
 * @param error - The error to track
 * @param properties - Additional properties
 */
export function trackException(
  error: Error,
  properties?: Record<string, string>
): void {
  if (!client) return;

  client.trackException({
    exception: error,
    properties,
  });
}

/**
 * Tracks a dependency call (external API, database, etc.).
 *
 * @param options - Dependency tracking options
 */
export function trackDependency(options: {
  name: string;
  target: string;
  duration: number;
  success: boolean;
  resultCode?: string;
  data?: string;
  dependencyTypeName?: string;
}): void {
  if (!client) return;

  client.trackDependency({
    name: options.name,
    target: options.target,
    duration: options.duration,
    success: options.success,
    resultCode: options.resultCode ?? 0,
    data: options.data ?? '',
    dependencyTypeName: options.dependencyTypeName || 'HTTP',
  });
}

/**
 * Flushes pending telemetry.
 * Call this before process exit.
 */
export function flush(): Promise<void> {
  return new Promise((resolve) => {
    if (!client) {
      resolve();
      return;
    }

    client.flush({
      callback: () => resolve(),
    });
  });
}

/**
 * Helper to track operation timing.
 *
 * @param operationName - Name of the operation
 * @returns Object with start and end functions
 */
export function createOperationTracker(operationName: string) {
  const startTime = Date.now();

  return {
    /**
     * Ends the operation and tracks the duration.
     *
     * @param success - Whether the operation succeeded
     * @param properties - Additional properties
     */
    end(success: boolean, properties?: Record<string, string>): void {
      const duration = Date.now() - startTime;

      trackMetric(MetricNames.API_REQUEST_DURATION, duration, {
        operation: operationName,
        success: success.toString(),
        ...properties,
      });

      if (!success) {
        trackEvent(EventNames.GRAPH_API_CALL, {
          operation: operationName,
          status: 'failed',
          durationMs: duration.toString(),
          ...properties,
        });
      }
    },
  };
}
