/**
 * Scan History Error Logging
 * Error logging and metrics tracking for debugging and analytics
 * @module features/scan-history/utils/errorLogging
 */

import { ScanHistoryError, type ScanHistoryErrorCode } from './errorHandler';

// ============================================================================
// Error Context Types
// ============================================================================

/**
 * Context information for error logging
 */
export interface ErrorContext {
  /** Operation being performed when error occurred */
  operation?: string;
  /** Scan ID if applicable */
  scanId?: string;
  /** Component where error occurred */
  component?: string;
  /** User action that triggered the error */
  userAction?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Structured log entry for errors
 */
export interface ErrorLogEntry {
  /** Unique error ID */
  id: string;
  /** Timestamp of the error */
  timestamp: string;
  /** Error code */
  code: ScanHistoryErrorCode | string;
  /** Error message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Error context */
  context: ErrorContext;
  /** Stack trace (only in development) */
  stack?: string;
  /** Browser/environment info */
  environment: {
    userAgent: string;
    url: string;
    isDevelopment: boolean;
  };
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Generate a unique error ID
 */
function generateErrorId(): string {
  return `scan_err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get environment information
 */
function getEnvironmentInfo(): ErrorLogEntry['environment'] {
  return {
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    url: typeof window !== 'undefined' ? window.location.href : 'unknown',
    isDevelopment: import.meta.env.DEV,
  };
}

/**
 * Log a scan history error with full context
 *
 * @param error - The error to log
 * @param context - Additional context information
 *
 * @example
 * ```ts
 * try {
 *   await fetchScanHistory();
 * } catch (error) {
 *   logScanHistoryError(error, {
 *     operation: 'fetchScanHistory',
 *     component: 'ScanHistoryPage',
 *   });
 *   throw error;
 * }
 * ```
 */
export function logScanHistoryError(
  error: ScanHistoryError | Error | unknown,
  context: ErrorContext = {}
): void {
  const scanError = normalizeError(error);
  const entry = createLogEntry(scanError, context);

  // Console logging with appropriate level
  if (scanError.retryable) {
    console.warn('[Scan History Error]', entry);
  } else {
    console.error('[Scan History Error]', entry);
  }

  // In development, log additional details
  if (import.meta.env.DEV) {
    console.group('Error Details');
    console.log('Code:', scanError.code);
    console.log('Type:', scanError.type);
    console.log('Message:', scanError.message);
    console.log('Context:', context);
    if (scanError.details) {
      console.log('Details:', scanError.details);
    }
    if (scanError.cause) {
      console.log('Cause:', scanError.cause);
    }
    console.groupEnd();
  }

  // Send to error tracking service (if configured)
  sendToErrorService(entry);
}

/**
 * Normalize any error to a ScanHistoryError
 */
function normalizeError(error: unknown): ScanHistoryError {
  if (error instanceof ScanHistoryError) {
    return error;
  }

  if (error instanceof Error) {
    return new ScanHistoryError(
      error.message,
      'UNKNOWN_ERROR',
      { cause: error }
    );
  }

  return new ScanHistoryError(
    String(error),
    'UNKNOWN_ERROR'
  );
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  error: ScanHistoryError,
  context: ErrorContext
): ErrorLogEntry {
  const isDevelopment = import.meta.env.DEV;

  return {
    id: generateErrorId(),
    timestamp: new Date().toISOString(),
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    statusCode: error.statusCode,
    context,
    // Only include stack in development
    ...(isDevelopment && error.stack && { stack: error.stack }),
    environment: getEnvironmentInfo(),
  };
}

/**
 * Send error to external error tracking service
 * This is a placeholder for integration with services like Sentry, DataDog, etc.
 */
function sendToErrorService(entry: ErrorLogEntry): void {
  // Check if error reporting is enabled
  const errorServiceEnabled = import.meta.env.VITE_ERROR_REPORTING_ENABLED === 'true';

  if (!errorServiceEnabled) {
    return;
  }

  // Example: Send to error tracking endpoint
  // This should be replaced with your actual error tracking integration
  try {
    // Don't block on error reporting
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(
        '/api/errors',
        JSON.stringify(entry)
      );
    }
  } catch {
    // Silently fail - don't let error reporting cause more errors
  }
}

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Error metrics for tracking error patterns
 */
interface ErrorMetrics {
  /** Total error count */
  total: number;
  /** Errors by code */
  byCode: Record<string, number>;
  /** Errors by operation */
  byOperation: Record<string, number>;
  /** Recent errors (last 10) */
  recent: Array<{
    timestamp: string;
    code: string;
    operation?: string;
  }>;
  /** Session start time */
  sessionStart: string;
}

/**
 * In-memory metrics storage
 */
let metrics: ErrorMetrics = {
  total: 0,
  byCode: {},
  byOperation: {},
  recent: [],
  sessionStart: new Date().toISOString(),
};

/**
 * Track error metrics for analytics
 *
 * @param error - The error to track
 * @param context - Optional context
 */
export function trackErrorMetrics(
  error: ScanHistoryError | Error,
  context?: ErrorContext
): void {
  const scanError = error instanceof ScanHistoryError
    ? error
    : new ScanHistoryError(error.message, 'UNKNOWN_ERROR');

  // Increment total
  metrics.total++;

  // Track by code
  metrics.byCode[scanError.code] = (metrics.byCode[scanError.code] ?? 0) + 1;

  // Track by operation
  if (context?.operation) {
    metrics.byOperation[context.operation] =
      (metrics.byOperation[context.operation] ?? 0) + 1;
  }

  // Add to recent (keep last 10)
  metrics.recent.push({
    timestamp: new Date().toISOString(),
    code: scanError.code,
    operation: context?.operation,
  });
  if (metrics.recent.length > 10) {
    metrics.recent.shift();
  }
}

/**
 * Get current error metrics
 *
 * @returns Current error metrics
 */
export function getErrorMetrics(): Readonly<ErrorMetrics> {
  return { ...metrics };
}

/**
 * Reset error metrics (useful for testing)
 */
export function resetErrorMetrics(): void {
  metrics = {
    total: 0,
    byCode: {},
    byOperation: {},
    recent: [],
    sessionStart: new Date().toISOString(),
  };
}

/**
 * Get error rate for a specific code
 *
 * @param code - The error code to check
 * @returns Percentage of errors with this code
 */
export function getErrorRate(code: ScanHistoryErrorCode | string): number {
  if (metrics.total === 0) return 0;
  return ((metrics.byCode[code] ?? 0) / metrics.total) * 100;
}

/**
 * Check if errors are occurring frequently (possible issue)
 *
 * @param threshold - Number of errors considered frequent (default: 5)
 * @param windowMs - Time window in milliseconds (default: 60000 = 1 minute)
 * @returns Whether errors are occurring frequently
 */
export function hasFrequentErrors(
  threshold: number = 5,
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const recentCount = metrics.recent.filter(
    (e) => now - new Date(e.timestamp).getTime() < windowMs
  ).length;

  return recentCount >= threshold;
}

// ============================================================================
// Debug Helpers
// ============================================================================

/**
 * Format error for display in development tools
 *
 * @param error - The error to format
 * @returns Formatted string representation
 */
export function formatErrorForDebug(error: ScanHistoryError | Error): string {
  if (error instanceof ScanHistoryError) {
    const parts = [
      `[${error.code}] ${error.message}`,
      `Type: ${error.type}`,
      error.statusCode ? `Status: ${error.statusCode}` : null,
      error.retryable ? 'Retryable: Yes' : 'Retryable: No',
      error.details ? `Details: ${JSON.stringify(error.details)}` : null,
    ].filter(Boolean);

    return parts.join('\n');
  }

  return `[Error] ${error.message}`;
}

/**
 * Create a debug summary of recent errors
 */
export function getErrorDebugSummary(): string {
  const stats = getErrorMetrics();

  const lines = [
    `=== Scan History Error Summary ===`,
    `Session started: ${stats.sessionStart}`,
    `Total errors: ${stats.total}`,
    ``,
    `By Error Code:`,
    ...Object.entries(stats.byCode).map(
      ([code, count]) => `  ${code}: ${count}`
    ),
    ``,
    `By Operation:`,
    ...Object.entries(stats.byOperation).map(
      ([op, count]) => `  ${op}: ${count}`
    ),
    ``,
    `Recent Errors:`,
    ...stats.recent.map(
      (e) => `  ${e.timestamp} - ${e.code}${e.operation ? ` (${e.operation})` : ''}`
    ),
  ];

  return lines.join('\n');
}

// ============================================================================
// Development Tools
// ============================================================================

/**
 * Expose debug utilities in development mode
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  (window as { __scanHistoryErrorDebug?: unknown }).__scanHistoryErrorDebug = {
    getMetrics: getErrorMetrics,
    getSummary: getErrorDebugSummary,
    reset: resetErrorMetrics,
    hasFrequentErrors,
  };
}
