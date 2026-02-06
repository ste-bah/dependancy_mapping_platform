/**
 * Benchmark Module Exports
 * @module benchmarks
 *
 * Central export point for benchmark types, schemas, utilities, and CLI runner.
 * Implements NFR-PERF-008 performance targets and validation.
 *
 * NFR-PERF-008 Performance Targets:
 * - Search 10K nodes < 100ms
 * - Search 50K nodes < 200ms
 * - Search 100K nodes < 500ms (CRITICAL)
 * - Rollup depth 3 < 500ms
 * - Scan 1000 files < 60s
 *
 * TASK-FINAL-002: Performance Validation
 *
 * @example
 * ```typescript
 * import {
 *   measureLatency,
 *   measureAgainstNfrTarget,
 *   PERFORMANCE_TARGETS,
 *   formatDuration,
 * } from '@code-reviewer/api/benchmarks';
 *
 * // Basic latency measurement
 * const result = await measureLatency(
 *   async () => { await searchNodes(10000); },
 *   100, // iterations
 *   10   // warmup
 * );
 * console.log(`p95 latency: ${formatDuration(result.latency.p95)}`);
 * ```
 *
 * CLI Usage:
 * ```bash
 * npm run benchmark -- --suite=search --scale=100k
 * npm run benchmark -- --suite=all --format=json --output=results.json
 * ```
 */

// Export all types, schemas, guards, and factory functions
export * from './types.js';

// Export NFR-PERF-008 performance targets and utilities
export {
  // Performance Targets (NFR-PERF-008)
  PERFORMANCE_TARGETS,
  type PerformanceTargetKey,

  // Benchmark Result Types (extended)
  type BenchmarkResult as NfrBenchmarkResult,
  type BenchmarkIteration,
  type PercentileStats,
  type BenchmarkConfig as NfrBenchmarkConfig,
  DEFAULT_BENCHMARK_CONFIG as NFR_DEFAULT_BENCHMARK_CONFIG,

  // Suite Types
  type BenchmarkSuiteType as NfrBenchmarkSuiteType,
  type BenchmarkScale as NfrBenchmarkScale,

  // Report Types
  type BenchmarkReport,
  type BenchmarkEnvironment,
  type BenchmarkSummary as NfrBenchmarkSummary,
  type BenchmarkSuiteResult,
  type TargetComparisonResult,

  // Runner Types
  type BenchmarkRunnerOptions,
  DEFAULT_RUNNER_OPTIONS,

  // Progress Types
  type BenchmarkProgress,
  type BenchmarkProgressCallback,

  // Type Guards (extended)
  isBenchmarkResult as isNfrBenchmarkResult,
  isBenchmarkSuite as isNfrBenchmarkSuite,
  isBenchmarkReport,
  isValidScale,
  isValidSuiteType,
} from './benchmark-types.js';

// Export measurement utilities
export {
  // Latency Measurement
  measureLatency,
  measureLatencyAgainstTarget,
  measureAgainstNfrTarget,

  // Memory Measurement
  getMemoryUsage,
  getDetailedMemoryUsage,
  measureMemory,
  forceGC,

  // Statistical Calculations
  calculatePercentile,
  calculateStdDev,
  calculatePercentileStats,

  // Formatting
  formatDuration,
  formatBytes,
  formatNumber,
  formatPercentage,
  formatThroughput,

  // Environment
  collectEnvironmentInfo,

  // Helpers
  runMultiple,
  runUntil,
  withTimeout,
  delay,
  compareBenchmarkResults,
  validateAgainstNfrTarget,

  // Scale Helpers
  getNodeCountForScale,
  getSearchTargetForScale,
} from './benchmark-utils.js';

// Export runner (for programmatic use)
export {
  runSearchBenchmark,
  runDiffBenchmark,
  runIndexBenchmark,
  runMemoryBenchmark,
  runRollupBenchmark,
  runSuite,
  generateReport,
  formatTableOutput,
  formatMarkdownOutput,
  parseArgs,
} from './run-benchmarks.js';

// Export benchmark service
export {
  // Service Implementation
  BenchmarkService,
  createBenchmarkService,
  createMinimalBenchmarkService,

  // Interfaces
  type IBenchmarkService,
  type IBenchmarkPersistence,
  type IBenchmarkEventEmitter,

  // Configuration
  type BenchmarkServiceConfig,
  DEFAULT_BENCHMARK_SERVICE_CONFIG,

  // Input Types
  type SearchBenchmarkInput,
  type RollupBenchmarkInput,
  type ScanBenchmarkInput,
  type SuiteInput,

  // Progress Types
  type BenchmarkProgressCallback as ServiceProgressCallback,
  type BenchmarkProgress as ServiceBenchmarkProgress,

  // Event Types
  type BenchmarkEvent,
  type BenchmarkEventType,

  // Comparison Types
  type BenchmarkComparison,
  type MetricComparison,

  // NFR Validation Types
  type NfrValidationResult,
  type NfrTargetValidation,

  // Error Types
  BenchmarkServiceError,
  type BenchmarkServiceErrorCode,

  // Dependency Types
  type BenchmarkServiceDependencies,
} from './benchmark-service.js';
