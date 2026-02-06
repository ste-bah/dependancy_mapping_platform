/**
 * Graph Performance Logger
 * Track and log performance metrics for graph operations
 * @module features/graph/utils/performanceLogger
 */

import { isDevelopment, isProduction } from '../config/env';
import { graphLogger, type LogContext } from './logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Performance timing entry
 */
export interface TimingEntry {
  /** Operation name */
  operation: string;
  /** Start timestamp (performance.now()) */
  startTime: number;
  /** End timestamp */
  endTime?: number;
  /** Duration in milliseconds */
  duration?: number;
  /** Additional context */
  context?: LogContext;
}

/**
 * Aggregated performance metrics
 */
export interface PerformanceMetrics {
  /** Total operations tracked */
  totalOperations: number;
  /** Total time spent in tracked operations */
  totalDuration: number;
  /** Average operation duration */
  averageDuration: number;
  /** Metrics by operation type */
  byOperation: Record<string, OperationMetrics>;
  /** Slowest operations (top 10) */
  slowestOperations: Array<{
    operation: string;
    duration: number;
    timestamp: string;
  }>;
  /** Session start time */
  sessionStart: string;
}

/**
 * Metrics for a specific operation type
 */
export interface OperationMetrics {
  /** Number of times operation was called */
  count: number;
  /** Total time spent in this operation */
  totalDuration: number;
  /** Average duration */
  averageDuration: number;
  /** Minimum duration */
  minDuration: number;
  /** Maximum duration */
  maxDuration: number;
  /** Last recorded duration */
  lastDuration: number;
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  /** Warn if operation takes longer than this (ms) */
  warn: number;
  /** Error if operation takes longer than this (ms) */
  error: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Default thresholds for different operation types
 */
const DEFAULT_THRESHOLDS: Record<string, PerformanceThresholds> = {
  'fetch-graph': { warn: 2000, error: 5000 },
  'layout-calculation': { warn: 500, error: 2000 },
  'filter-nodes': { warn: 100, error: 500 },
  'search-nodes': { warn: 200, error: 1000 },
  'blast-radius': { warn: 1000, error: 3000 },
  'render': { warn: 50, error: 200 },
  'transform-data': { warn: 100, error: 500 },
  default: { warn: 1000, error: 5000 },
};

/**
 * Maximum number of slowest operations to track
 */
const MAX_SLOW_OPERATIONS = 10;

/**
 * Maximum number of metrics history entries
 */
const MAX_HISTORY_ENTRIES = 100;

// ============================================================================
// State
// ============================================================================

/**
 * In-memory metrics storage
 */
let metrics: {
  totalOperations: number;
  totalDuration: number;
  byOperation: Record<string, OperationMetrics>;
  slowestOperations: Array<{
    operation: string;
    duration: number;
    timestamp: string;
  }>;
  sessionStart: string;
} = {
  totalOperations: 0,
  totalDuration: 0,
  byOperation: {},
  slowestOperations: [],
  sessionStart: new Date().toISOString(),
};

/**
 * Active timers map
 */
const activeTimers: Map<string, TimingEntry> = new Map();

/**
 * Custom thresholds
 */
let customThresholds: Record<string, PerformanceThresholds> = {};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique timer ID
 */
function generateTimerId(operation: string): string {
  return `${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get threshold for an operation
 */
function getThreshold(operation: string): PerformanceThresholds {
  return customThresholds[operation]
    ?? DEFAULT_THRESHOLDS[operation]
    ?? DEFAULT_THRESHOLDS.default;
}

/**
 * Update metrics with a new timing
 */
function updateMetrics(operation: string, duration: number): void {
  // Update totals
  metrics.totalOperations++;
  metrics.totalDuration += duration;

  // Update operation-specific metrics
  if (!metrics.byOperation[operation]) {
    metrics.byOperation[operation] = {
      count: 0,
      totalDuration: 0,
      averageDuration: 0,
      minDuration: Infinity,
      maxDuration: 0,
      lastDuration: 0,
    };
  }

  const opMetrics = metrics.byOperation[operation];
  opMetrics.count++;
  opMetrics.totalDuration += duration;
  opMetrics.averageDuration = opMetrics.totalDuration / opMetrics.count;
  opMetrics.minDuration = Math.min(opMetrics.minDuration, duration);
  opMetrics.maxDuration = Math.max(opMetrics.maxDuration, duration);
  opMetrics.lastDuration = duration;

  // Track slowest operations
  metrics.slowestOperations.push({
    operation,
    duration,
    timestamp: new Date().toISOString(),
  });

  // Sort and trim slowest operations
  metrics.slowestOperations.sort((a, b) => b.duration - a.duration);
  if (metrics.slowestOperations.length > MAX_SLOW_OPERATIONS) {
    metrics.slowestOperations = metrics.slowestOperations.slice(0, MAX_SLOW_OPERATIONS);
  }
}

/**
 * Check thresholds and log appropriately
 */
function checkThresholds(
  operation: string,
  duration: number,
  context?: LogContext
): void {
  const threshold = getThreshold(operation);

  if (duration >= threshold.error) {
    graphLogger.error(
      `Performance critical: ${operation} took ${duration}ms (threshold: ${threshold.error}ms)`,
      undefined,
      { ...context, duration, threshold: threshold.error }
    );
  } else if (duration >= threshold.warn) {
    graphLogger.warn(
      `Performance warning: ${operation} took ${duration}ms (threshold: ${threshold.warn}ms)`,
      { ...context, duration, threshold: threshold.warn }
    );
  }
}

// ============================================================================
// Main API
// ============================================================================

/**
 * Start a performance timer for an operation
 * Returns a function to stop the timer and log the duration
 *
 * @param operation - Name of the operation being timed
 * @param context - Optional context for logging
 * @returns Function to stop the timer
 *
 * @example
 * ```ts
 * const stopTimer = startTimer('layout-calculation');
 * // ... perform layout calculation ...
 * stopTimer(); // Logs duration and updates metrics
 * ```
 */
export function startTimer(
  operation: string,
  context?: LogContext
): () => number {
  const timerId = generateTimerId(operation);
  const entry: TimingEntry = {
    operation,
    startTime: performance.now(),
    context,
  };

  activeTimers.set(timerId, entry);

  // Return stop function
  return () => {
    const timer = activeTimers.get(timerId);
    if (!timer) {
      graphLogger.warn(`Timer not found: ${timerId}`);
      return 0;
    }

    activeTimers.delete(timerId);

    const endTime = performance.now();
    const duration = Math.round(endTime - timer.startTime);

    // Log the performance
    logPerformance(operation, duration, timer.context);

    return duration;
  };
}

/**
 * Log a performance measurement directly
 * Use when you already have the duration calculated
 *
 * @param operation - Name of the operation
 * @param durationMs - Duration in milliseconds
 * @param context - Optional context
 *
 * @example
 * ```ts
 * const start = performance.now();
 * await fetchData();
 * logPerformance('fetch-graph', performance.now() - start, { scanId });
 * ```
 */
export function logPerformance(
  operation: string,
  durationMs: number,
  context?: LogContext
): void {
  const duration = Math.round(durationMs);

  // Update metrics
  updateMetrics(operation, duration);

  // Check thresholds
  checkThresholds(operation, duration, context);

  // Log debug info in development
  if (isDevelopment()) {
    graphLogger.debug(`Performance: ${operation}`, {
      ...context,
      duration,
      action: operation,
    });
  }
}

/**
 * Get current performance metrics
 *
 * @returns Aggregated performance metrics
 *
 * @example
 * ```ts
 * const metrics = getPerformanceMetrics();
 * console.log(`Average duration: ${metrics.averageDuration}ms`);
 * console.log(`Slowest operation: ${metrics.slowestOperations[0]?.operation}`);
 * ```
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  return {
    totalOperations: metrics.totalOperations,
    totalDuration: Math.round(metrics.totalDuration),
    averageDuration: metrics.totalOperations > 0
      ? Math.round(metrics.totalDuration / metrics.totalOperations)
      : 0,
    byOperation: { ...metrics.byOperation },
    slowestOperations: [...metrics.slowestOperations],
    sessionStart: metrics.sessionStart,
  };
}

/**
 * Get metrics for a specific operation
 *
 * @param operation - Operation name
 * @returns Operation metrics or undefined if not tracked
 */
export function getOperationMetrics(operation: string): OperationMetrics | undefined {
  return metrics.byOperation[operation]
    ? { ...metrics.byOperation[operation] }
    : undefined;
}

/**
 * Reset all performance metrics
 * Useful for testing or when starting a new session
 */
export function resetPerformanceMetrics(): void {
  metrics = {
    totalOperations: 0,
    totalDuration: 0,
    byOperation: {},
    slowestOperations: [],
    sessionStart: new Date().toISOString(),
  };
  activeTimers.clear();
}

/**
 * Set custom thresholds for operations
 *
 * @param operation - Operation name
 * @param thresholds - Custom thresholds
 *
 * @example
 * ```ts
 * setThreshold('custom-operation', { warn: 500, error: 2000 });
 * ```
 */
export function setThreshold(
  operation: string,
  thresholds: PerformanceThresholds
): void {
  customThresholds[operation] = thresholds;
}

/**
 * Clear custom thresholds
 */
export function clearCustomThresholds(): void {
  customThresholds = {};
}

// ============================================================================
// Higher-Order Function Wrappers
// ============================================================================

/**
 * Wrap a function to automatically track its performance
 *
 * @param operation - Operation name for logging
 * @param fn - Function to wrap
 * @returns Wrapped function with performance tracking
 *
 * @example
 * ```ts
 * const trackedFetch = withPerformanceTracking(
 *   'fetch-graph',
 *   fetchGraphData
 * );
 * const data = await trackedFetch(scanId);
 * ```
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => unknown>(
  operation: string,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    const stopTimer = startTimer(operation);

    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result
          .then((value) => {
            stopTimer();
            return value;
          })
          .catch((error) => {
            stopTimer();
            throw error;
          });
      }

      stopTimer();
      return result;
    } catch (error) {
      stopTimer();
      throw error;
    }
  }) as T;
}

/**
 * Measure performance of an async operation
 *
 * @param operation - Operation name
 * @param fn - Async function to measure
 * @param context - Optional context
 * @returns Result of the function
 *
 * @example
 * ```ts
 * const data = await measureAsync('fetch-graph', async () => {
 *   return await api.fetchGraph(scanId);
 * }, { scanId });
 * ```
 */
export async function measureAsync<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: LogContext
): Promise<T> {
  const stopTimer = startTimer(operation, context);
  try {
    const result = await fn();
    stopTimer();
    return result;
  } catch (error) {
    stopTimer();
    throw error;
  }
}

/**
 * Measure performance of a synchronous operation
 *
 * @param operation - Operation name
 * @param fn - Sync function to measure
 * @param context - Optional context
 * @returns Result of the function
 */
export function measureSync<T>(
  operation: string,
  fn: () => T,
  context?: LogContext
): T {
  const stopTimer = startTimer(operation, context);
  try {
    const result = fn();
    stopTimer();
    return result;
  } catch (error) {
    stopTimer();
    throw error;
  }
}

// ============================================================================
// Performance Report
// ============================================================================

/**
 * Generate a performance report summary
 *
 * @returns Formatted performance report string
 */
export function generatePerformanceReport(): string {
  const m = getPerformanceMetrics();

  const lines = [
    '=== Graph Performance Report ===',
    `Session started: ${m.sessionStart}`,
    `Total operations: ${m.totalOperations}`,
    `Total duration: ${m.totalDuration}ms`,
    `Average duration: ${m.averageDuration}ms`,
    '',
    '--- By Operation ---',
  ];

  for (const [op, opMetrics] of Object.entries(m.byOperation)) {
    lines.push(
      `${op}:`,
      `  Count: ${opMetrics.count}`,
      `  Avg: ${Math.round(opMetrics.averageDuration)}ms`,
      `  Min: ${Math.round(opMetrics.minDuration)}ms`,
      `  Max: ${Math.round(opMetrics.maxDuration)}ms`,
    );
  }

  if (m.slowestOperations.length > 0) {
    lines.push('', '--- Slowest Operations ---');
    for (const slow of m.slowestOperations) {
      lines.push(`  ${slow.operation}: ${slow.duration}ms at ${slow.timestamp}`);
    }
  }

  return lines.join('\n');
}

// ============================================================================
// Development Tools
// ============================================================================

/**
 * Expose performance tools in development mode
 */
if (isDevelopment() && typeof window !== 'undefined') {
  (window as { __graphPerformance?: unknown }).__graphPerformance = {
    getMetrics: getPerformanceMetrics,
    getOperationMetrics,
    reset: resetPerformanceMetrics,
    report: generatePerformanceReport,
    setThreshold,
    startTimer,
    logPerformance,
  };
}
