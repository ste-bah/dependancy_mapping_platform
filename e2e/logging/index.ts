/**
 * E2E Logging Module
 * @module e2e/logging
 *
 * Exports logging infrastructure for E2E testing:
 * - E2E Logger: Structured test logging
 * - Test Reporter: Multi-format report generation
 * - Metrics Collector: Performance and execution metrics
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #28 of 47 | Phase 4: Implementation
 */

// ============================================================================
// E2E Logger
// ============================================================================

export {
  // Types
  type LogLevel,
  type E2ELogContext,
  type LogEntry,
  type LogEntryError,
  type E2ELoggerConfig,
  type ILogTransport,
  type IE2ELogger,
  // Constants
  DEFAULT_E2E_LOGGER_CONFIG,
  // Classes
  E2ELogger,
  // Factory functions
  createE2ELogger,
  getE2ELogger,
  initE2ELogger,
  resetE2ELogger,
  createTestLogger,
  createSuiteLogger,
  createRunLogger,
  // Utilities
  withLogging,
} from './e2e-logger.js';

// ============================================================================
// Test Reporter
// ============================================================================

export {
  // Types
  type ReporterConfig,
  type JsonReport,
  type ITestReporter,
  type ReportGenerationResult,
  // Constants
  DEFAULT_REPORTER_CONFIG,
  // Classes
  TestReporter,
  // Factory functions
  createTestReporter,
  getTestReporter,
  initTestReporter,
} from './test-reporter.js';

// ============================================================================
// Metrics Collector
// ============================================================================

export {
  // Types
  type TimingMetric,
  type CounterMetric,
  type GaugeMetric,
  type HistogramMetric,
  type TestRunMetrics,
  type TestSuiteMetrics,
  type TestMetricsSummary,
  type TrendDataPoint,
  type RunComparison,
  type PerformanceThresholds,
  type ThresholdViolation,
  type IMetricsCollector,
  type TimerHandle,
  type MetricsExport,
  type MetricsSummary,
  // Constants
  DEFAULT_PERFORMANCE_THRESHOLDS,
  // Classes
  MetricsCollector,
  TestMetricsScope,
  // Factory functions
  createMetricsCollector,
  getMetricsCollector,
  initMetricsCollector,
  resetMetricsCollector,
  // Utilities
  timeAsync,
  timeSync,
  createTestMetricsScope,
  generateMetricsSummary,
} from './metrics.js';

// ============================================================================
// Convenience Re-exports
// ============================================================================

import { getE2ELogger, type IE2ELogger } from './e2e-logger.js';
import { getTestReporter, type ITestReporter } from './test-reporter.js';
import { getMetricsCollector, type IMetricsCollector } from './metrics.js';

/**
 * Default logger instance
 */
export const logger: IE2ELogger = getE2ELogger();

/**
 * Default reporter instance
 */
export const reporter: ITestReporter = getTestReporter();

/**
 * Default metrics collector instance
 */
export const metrics: IMetricsCollector = getMetricsCollector();
