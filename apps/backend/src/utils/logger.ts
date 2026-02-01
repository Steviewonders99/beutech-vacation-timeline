/**
 * Logging utilities for the Azure Functions backend.
 * Provides structured logging with correlation IDs and Application Insights integration.
 */

import { InvocationContext } from '@azure/functions';
import { LogLevels, LogLevel } from '../config/constants';
import { trackException, trackEvent, trackMetric, MetricNames } from '../telemetry/appInsights';

/**
 * Log entry structure.
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  correlationId?: string;
  data?: Record<string, unknown>;
}

/**
 * Creates a logger instance for a function invocation.
 */
export function createLogger(context: InvocationContext, configuredLevel: LogLevel = 'info') {
  const correlationId = context.invocationId;
  const configuredLevelValue = LogLevels[configuredLevel];

  function shouldLog(level: LogLevel): boolean {
    return LogLevels[level] <= configuredLevelValue;
  }

  function formatEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level.toUpperCase()}]`,
      entry.correlationId ? `[${entry.correlationId}]` : '',
      entry.message,
    ].filter(Boolean);

    if (entry.data) {
      parts.push(JSON.stringify(entry.data));
    }

    return parts.join(' ');
  }

  function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
    if (!shouldLog(level)) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      correlationId,
      data,
    };

    const formatted = formatEntry(entry);

    switch (level) {
      case 'error':
        context.error(formatted);
        // Track errors in Application Insights
        if (data?.error) {
          const errorObj = data.error instanceof Error
            ? data.error
            : new Error(String(data.error));
          trackException(errorObj, {
            correlationId: correlationId || '',
            message,
            ...Object.fromEntries(
              Object.entries(data)
                .filter(([k]) => k !== 'error')
                .map(([k, v]) => [k, String(v)])
            ),
          });
        }
        break;
      case 'warn':
        context.warn(formatted);
        break;
      case 'info':
        context.info(formatted);
        break;
      case 'debug':
        context.debug(formatted);
        break;
    }
  }

  return {
    error: (message: string, data?: Record<string, unknown>) => log('error', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),

    /** Log the start of an operation */
    startOperation: (operation: string, data?: Record<string, unknown>) => {
      log('info', `Starting: ${operation}`, data);
    },

    /** Log the end of an operation with duration */
    endOperation: (operation: string, startTime: number, data?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      log('info', `Completed: ${operation}`, { ...data, durationMs: duration });

      // Track operation metrics in Application Insights
      trackMetric(MetricNames.API_REQUEST_DURATION, duration, {
        operation,
        correlationId: correlationId || '',
      });

      // Track specific metrics based on operation
      if (operation === 'getVacations' && typeof data?.eventCount === 'number') {
        trackMetric(MetricNames.VACATION_EVENTS_FETCHED, data.eventCount as number);
      }
      if (operation === 'approveRequest') {
        trackMetric(MetricNames.REQUEST_APPROVAL_LATENCY, duration);
        trackEvent('RequestApproved', { correlationId: correlationId || '' });
      }
      if (operation === 'rejectRequest') {
        trackMetric(MetricNames.REQUEST_REJECTION_LATENCY, duration);
        trackEvent('RequestRejected', { correlationId: correlationId || '' });
      }
      if (operation === 'createRequest') {
        trackMetric(MetricNames.REQUESTS_CREATED, 1);
        trackEvent('RequestCreated', { correlationId: correlationId || '' });
      }
    },

    /** Get the correlation ID for this invocation */
    getCorrelationId: () => correlationId,
  };
}

export type Logger = ReturnType<typeof createLogger>;
