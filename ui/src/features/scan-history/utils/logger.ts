/**
 * Scan History Logger
 * Feature-specific logging utility with structured logging for the scan history feature
 * @module features/scan-history/utils/logger
 */

import { isDevelopment, isProduction } from '../config/env';
import { logScanHistoryError, trackErrorMetrics, type ErrorContext } from './errorLogging';
import { type ScanHistoryError } from './errorHandler';

// ============================================================================
// Constants
// ============================================================================

/**
 * Log prefix for filtering scan history logs
 */
const LOG_PREFIX = '[ScanHistory]';

/**
 * Performance timing labels storage
 */
const performanceTimers = new Map<string, number>();

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels for the scan history logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context information for log entries
 */
export interface LogContext {
  /** Scan identifier */
  scanId?: string;
  /** Operation being performed */
  operation?: string;
  /** Component where the log originated */
  component?: string;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * API request context for logging
 */
export interface ApiRequestContext {
  /** Request method */
  method: string;
  /** Request URL */
  url: string;
  /** Request parameters */
  params?: unknown;
  /** Request headers (sanitized) */
  headers?: Record<string, string>;
}

/**
 * API response context for logging
 */
export interface ApiResponseContext {
  /** Response status code */
  status: number;
  /** Response duration in milliseconds */
  duration: number;
  /** Response size in bytes (if available) */
  size?: number;
}

/**
 * User action tracking data
 */
export interface UserActionData {
  /** Action name */
  action: string;
  /** Component where action occurred */
  component?: string;
  /** Additional action metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Feature usage tracking data
 */
export interface FeatureUsageData {
  /** Feature name */
  feature: string;
  /** Action performed on feature */
  action: string;
  /** Additional usage metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Feature name (always 'scan-history') */
  feature: 'scan-history';
  /** Optional context */
  context?: LogContext;
  /** Error information if present */
  error?: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Enable console output */
  enableConsole: boolean;
  /** Enable structured JSON output */
  enableJson: boolean;
  /** Enable colored console output (development only) */
  enableColors: boolean;
  /** Enable API logging */
  enableApiLogging: boolean;
  /** Enable user action tracking */
  enableUserTracking: boolean;
  /** Enable feature usage analytics */
  enableFeatureAnalytics: boolean;
  /** Custom log handler for external integrations */
  customHandler?: (entry: LogEntry) => void;
}

// ============================================================================
// Configuration
// ============================================================================

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Console colors for log levels (ANSI escape codes)
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const RESET_COLOR = '\x1b[0m';

/**
 * Default configuration based on environment
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: isDevelopment() ? 'debug' : 'warn',
  enableConsole: true,
  enableJson: isProduction(),
  enableColors: isDevelopment(),
  enableApiLogging: isDevelopment(),
  enableUserTracking: true,
  enableFeatureAnalytics: isProduction(),
  customHandler: undefined,
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// Sensitive Data Handling
// ============================================================================

/**
 * List of sensitive keys to redact from logs
 */
const SENSITIVE_KEYS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'authorization',
  'cookie',
  'email',
  'ssn',
  'creditCard',
  'bearer',
];

/**
 * Sanitize data to remove potentially sensitive information
 * Ensures no PII is logged
 */
function sanitizeData(data?: unknown): unknown {
  if (data === undefined || data === null) return data;

  if (typeof data !== 'object') return data;

  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_KEYS.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a log level should be output based on current config
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentConfig.minLevel];
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error | ScanHistoryError
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    feature: 'scan-history',
  };

  if (context && Object.keys(context).length > 0) {
    entry.context = sanitizeData(context) as LogContext;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      // Include error code if it's a ScanHistoryError
      ...('code' in error && { code: error.code }),
      // Only include stack in development
      ...(isDevelopment() && error.stack && { stack: error.stack }),
    };
  }

  return entry;
}

/**
 * Format log entry for console output
 */
function formatForConsole(entry: LogEntry): string {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const time = entry.timestamp.split('T')[1]?.slice(0, 12) ?? entry.timestamp;

  let contextStr = '';
  if (entry.context) {
    const parts: string[] = [];
    if (entry.context.scanId) parts.push(`scan:${String(entry.context.scanId).slice(0, 8)}`);
    if (entry.context.operation) parts.push(`op:${entry.context.operation}`);
    if (entry.context.component) parts.push(`comp:${entry.context.component}`);
    if (entry.context.duration !== undefined) parts.push(`${entry.context.duration}ms`);
    if (parts.length > 0) {
      contextStr = ` [${parts.join(' ')}]`;
    }
  }

  if (currentConfig.enableColors && isDevelopment()) {
    const color = LOG_LEVEL_COLORS[entry.level];
    return `${color}[${time}] ${levelStr}${RESET_COLOR} ${LOG_PREFIX}${contextStr} ${entry.message}`;
  }

  return `[${time}] ${levelStr} ${LOG_PREFIX}${contextStr} ${entry.message}`;
}

/**
 * Output log entry to console
 */
function outputToConsole(entry: LogEntry): void {
  if (!currentConfig.enableConsole) return;

  const consoleMethod = entry.level === 'error' ? console.error
    : entry.level === 'warn' ? console.warn
    : entry.level === 'debug' ? console.debug
    : console.log;

  if (currentConfig.enableJson && isProduction()) {
    // Structured JSON output for production log aggregation
    consoleMethod(JSON.stringify(entry));
  } else {
    // Human-readable output for development
    consoleMethod(formatForConsole(entry));

    // Log additional details in development
    if (isDevelopment()) {
      if (entry.context && Object.keys(entry.context).length > 3) {
        console.debug('  Context:', entry.context);
      }
      if (entry.error) {
        console.debug('  Error:', entry.error);
      }
    }
  }
}

/**
 * Process a log entry through all outputs
 */
function processLogEntry(entry: LogEntry): void {
  outputToConsole(entry);

  if (currentConfig.customHandler) {
    try {
      currentConfig.customHandler(entry);
    } catch {
      // Silently fail - don't let logging cause errors
    }
  }
}

// ============================================================================
// Main Logger Interface
// ============================================================================

/**
 * Scan History logger for feature-specific logging
 *
 * Provides structured logging with context, automatic PII redaction,
 * and environment-appropriate output formatting.
 *
 * @example
 * ```ts
 * // Basic logging
 * scanHistoryLogger.info('Scan list loaded', { count: 50 });
 *
 * // Error logging
 * scanHistoryLogger.error('Failed to fetch scan', error, { scanId });
 *
 * // API logging
 * scanHistoryLogger.apiRequest('GET', '/api/scans', { page: 1 });
 * scanHistoryLogger.apiResponse('GET', '/api/scans', 200, 125);
 *
 * // Performance timing
 * scanHistoryLogger.time('fetchScans');
 * await fetchScans();
 * scanHistoryLogger.timeEnd('fetchScans');
 * ```
 */
export const scanHistoryLogger = {
  /**
   * Log a debug message
   * Only output in development mode by default
   */
  debug(message: string, data?: unknown): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, data as LogContext);
    processLogEntry(entry);
  },

  /**
   * Log an info message
   */
  info(message: string, data?: unknown): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, data as LogContext);
    processLogEntry(entry);
  },

  /**
   * Log a warning message
   */
  warn(message: string, data?: unknown): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, data as LogContext);
    processLogEntry(entry);
  },

  /**
   * Log an error message
   * Integrates with errorLogging for error tracking
   *
   * @param message - Error description
   * @param error - Optional Error object
   * @param context - Optional context
   */
  error(message: string, error?: Error | ScanHistoryError, context?: unknown): void {
    if (!shouldLog('error')) return;

    const entry = createLogEntry('error', message, context as LogContext, error ?? undefined);
    processLogEntry(entry);

    // Integrate with error logging system
    if (error) {
      const errorContext: ErrorContext = {
        operation: (context as LogContext)?.operation,
        scanId: (context as LogContext)?.scanId,
        component: (context as LogContext)?.component,
        metadata: sanitizeData(context) as Record<string, unknown>,
      };
      logScanHistoryError(error, errorContext);
      trackErrorMetrics(error, errorContext);
    }
  },

  // ==========================================================================
  // Performance Timing
  // ==========================================================================

  /**
   * Start a performance timer
   * Only active in development mode
   *
   * @param label - Timer label
   */
  time(label: string): void {
    if (isDevelopment()) {
      performanceTimers.set(label, performance.now());
      console.time(`${LOG_PREFIX} ${label}`);
    }
  },

  /**
   * End a performance timer and log the duration
   * Only active in development mode
   *
   * @param label - Timer label
   * @returns Duration in milliseconds, or undefined if not in development
   */
  timeEnd(label: string): number | undefined {
    if (isDevelopment()) {
      const startTime = performanceTimers.get(label);
      performanceTimers.delete(label);
      console.timeEnd(`${LOG_PREFIX} ${label}`);

      if (startTime !== undefined) {
        return Math.round(performance.now() - startTime);
      }
    }
    return undefined;
  },

  /**
   * Measure the duration of an async operation
   *
   * @param label - Operation label
   * @param operation - Async function to measure
   * @returns The result of the operation
   */
  async measure<T>(label: string, operation: () => Promise<T>): Promise<T> {
    const startTime = performance.now();

    try {
      const result = await operation();
      const duration = Math.round(performance.now() - startTime);

      if (shouldLog('debug')) {
        this.debug(`${label} completed`, { duration, operation: label });
      }

      return result;
    } catch (error) {
      const duration = Math.round(performance.now() - startTime);

      if (shouldLog('error')) {
        this.error(`${label} failed`, error as Error, { duration, operation: label });
      }

      throw error;
    }
  },

  // ==========================================================================
  // API Logging
  // ==========================================================================

  /**
   * Log an API request
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param params - Optional request parameters
   */
  apiRequest(method: string, url: string, params?: unknown): void {
    if (!currentConfig.enableApiLogging || !isDevelopment()) return;

    const sanitizedParams = sanitizeData(params);
    this.debug(`API Request: ${method} ${url}`, {
      operation: 'api-request',
      method,
      url,
      params: sanitizedParams,
    });
  },

  /**
   * Log an API response
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param status - Response status code
   * @param duration - Request duration in milliseconds
   */
  apiResponse(method: string, url: string, status: number, duration: number): void {
    if (!currentConfig.enableApiLogging && !isProduction()) return;

    const level: LogLevel = status >= 400 ? 'warn' : 'debug';
    const message = `API Response: ${method} ${url} ${status}`;

    if (!shouldLog(level)) return;

    const entry = createLogEntry(level, message, {
      operation: 'api-response',
      method,
      url,
      status,
      duration,
    });
    processLogEntry(entry);
  },

  /**
   * Log an API error
   *
   * @param method - HTTP method
   * @param url - Request URL
   * @param error - The error that occurred
   */
  apiError(method: string, url: string, error: Error): void {
    this.error(`API Error: ${method} ${url}`, error, {
      operation: 'api-error',
      method,
      url,
    });
  },

  // ==========================================================================
  // User Action Tracking
  // ==========================================================================

  /**
   * Log a user action for analytics
   *
   * @param action - Action name (e.g., 'click_export', 'filter_change')
   * @param data - Optional action data
   */
  userAction(action: string, data?: unknown): void {
    if (!currentConfig.enableUserTracking) return;

    const sanitizedData = sanitizeData(data);

    if (isDevelopment()) {
      this.debug(`User Action: ${action}`, {
        operation: 'user-action',
        action,
        ...((sanitizedData as object) ?? {}),
      });
    }

    // In production, this would send to analytics service
    if (isProduction()) {
      try {
        // Placeholder for analytics integration
        // e.g., analytics.track('scan_history_action', { action, ...sanitizedData });
        if (typeof window !== 'undefined' && (window as { analytics?: { track: (name: string, data: unknown) => void } }).analytics) {
          (window as { analytics: { track: (name: string, data: unknown) => void } }).analytics.track('scan_history_action', {
            action,
            ...(sanitizedData as object),
            timestamp: new Date().toISOString(),
          });
        }
      } catch {
        // Silently fail analytics
      }
    }
  },

  // ==========================================================================
  // Feature Usage Tracking
  // ==========================================================================

  /**
   * Track feature usage for analytics
   *
   * @param feature - Feature name (e.g., 'timeline', 'export', 'comparison')
   * @param action - Action performed (e.g., 'view', 'click', 'toggle')
   */
  trackFeatureUsage(feature: string, action: string): void {
    if (!currentConfig.enableFeatureAnalytics) {
      if (isDevelopment()) {
        this.debug(`Feature Usage: ${feature}.${action}`, {
          operation: 'feature-usage',
          feature,
          action,
        });
      }
      return;
    }

    // In production, track feature usage
    try {
      if (typeof window !== 'undefined' && (window as { analytics?: { track: (name: string, data: unknown) => void } }).analytics) {
        (window as { analytics: { track: (name: string, data: unknown) => void } }).analytics.track('scan_history_feature', {
          feature,
          action,
          timestamp: new Date().toISOString(),
        });
      }

      // Also use navigator.sendBeacon for reliability
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const data = JSON.stringify({
          type: 'feature_usage',
          feature: `scan_history.${feature}`,
          action,
          timestamp: new Date().toISOString(),
        });
        navigator.sendBeacon('/api/analytics/feature', data);
      }
    } catch {
      // Silently fail analytics
    }
  },

  // ==========================================================================
  // Child Logger
  // ==========================================================================

  /**
   * Create a child logger with preset context
   * Useful for adding consistent context across multiple log calls
   *
   * @example
   * ```ts
   * const scanLogger = scanHistoryLogger.child({ scanId: 'abc123' });
   * scanLogger.info('Processing started');
   * scanLogger.info('Processing complete', { duration: 500 });
   * ```
   */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        scanHistoryLogger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        scanHistoryLogger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        scanHistoryLogger.warn(message, { ...baseContext, ...context }),
      error: (message: string, error?: Error | ScanHistoryError, context?: LogContext) =>
        scanHistoryLogger.error(message, error, { ...baseContext, ...context }),
      time: (label: string) => scanHistoryLogger.time(`${baseContext.component ?? 'child'}:${label}`),
      timeEnd: (label: string) => scanHistoryLogger.timeEnd(`${baseContext.component ?? 'child'}:${label}`),
      apiRequest: scanHistoryLogger.apiRequest.bind(scanHistoryLogger),
      apiResponse: scanHistoryLogger.apiResponse.bind(scanHistoryLogger),
      apiError: scanHistoryLogger.apiError.bind(scanHistoryLogger),
      userAction: scanHistoryLogger.userAction.bind(scanHistoryLogger),
      trackFeatureUsage: scanHistoryLogger.trackFeatureUsage.bind(scanHistoryLogger),
    };
  },

  // ==========================================================================
  // Configuration
  // ==========================================================================

  /**
   * Configure the logger
   * @param config - Partial configuration to merge
   */
  configure(config: Partial<LoggerConfig>): void {
    currentConfig = { ...currentConfig, ...config };
  },

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...currentConfig };
  },

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    currentConfig = { ...DEFAULT_CONFIG };
  },
};

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Create a component-specific logger
 *
 * @example
 * ```ts
 * const logger = createComponentLogger('ScanHistoryList');
 * logger.info('Component mounted');
 * ```
 */
export function createComponentLogger(component: string) {
  return scanHistoryLogger.child({ component });
}

/**
 * Create an operation-specific logger with timing support
 *
 * @example
 * ```ts
 * const opLogger = createOperationLogger('fetchScans', { page: 1 });
 * // ... do work ...
 * opLogger.complete({ count: 50 });
 * ```
 */
export function createOperationLogger(operation: string, context?: LogContext) {
  const startTime = performance.now();
  const baseContext = { ...context, operation };

  scanHistoryLogger.debug(`${operation} started`, baseContext);

  return {
    log: (message: string, additionalContext?: LogContext) =>
      scanHistoryLogger.debug(message, { ...baseContext, ...additionalContext }),

    warn: (message: string, additionalContext?: LogContext) =>
      scanHistoryLogger.warn(message, { ...baseContext, ...additionalContext }),

    error: (message: string, error?: Error | ScanHistoryError, additionalContext?: LogContext) =>
      scanHistoryLogger.error(message, error, { ...baseContext, ...additionalContext }),

    complete: (additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - startTime);
      scanHistoryLogger.debug(`${operation} completed`, {
        ...baseContext,
        ...additionalContext,
        duration,
      });
      return duration;
    },

    fail: (error: Error | ScanHistoryError, additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - startTime);
      scanHistoryLogger.error(`${operation} failed`, error, {
        ...baseContext,
        ...additionalContext,
        duration,
      });
      return duration;
    },
  };
}

/**
 * Create a hook-specific logger for React hooks
 *
 * @example
 * ```ts
 * const logger = createHookLogger('useScanHistory');
 * logger.debug('Hook initialized');
 * ```
 */
export function createHookLogger(hookName: string) {
  return scanHistoryLogger.child({ component: hookName, hookType: 'react-hook' });
}

// ============================================================================
// Development Tools
// ============================================================================

/**
 * Expose debug utilities in development mode
 */
if (isDevelopment() && typeof window !== 'undefined') {
  (window as { __scanHistoryLogger?: unknown }).__scanHistoryLogger = {
    logger: scanHistoryLogger,
    configure: scanHistoryLogger.configure,
    getConfig: scanHistoryLogger.getConfig,
    reset: scanHistoryLogger.resetConfig,
    setLevel: (level: LogLevel) => scanHistoryLogger.configure({ minLevel: level }),
  };
}

export default scanHistoryLogger;
