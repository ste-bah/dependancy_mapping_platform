/**
 * Benchmark Type Definitions
 * @module benchmarks/benchmark-types
 *
 * Core type definitions for the performance benchmark system.
 * Implements NFR-PERF-008 performance targets and validation interfaces.
 *
 * NFR-PERF-008: Performance benchmarks for large-scale graph operations
 * - Search 10K nodes < 100ms
 * - Search 50K nodes < 200ms
 * - Search 100K nodes < 500ms (CRITICAL)
 * - Rollup depth 3 < 500ms
 * - Scan 1000 files < 60s
 */

// ============================================================================
// Performance Targets (NFR-PERF-008)
// ============================================================================

/**
 * NFR-PERF-008 Performance Targets
 * Critical thresholds for production performance validation.
 */
export const PERFORMANCE_TARGETS = {
  /** Search 10K nodes must complete in < 100ms */
  SEARCH_10K_MS: 100,
  /** Search 50K nodes must complete in < 200ms */
  SEARCH_50K_MS: 200,
  /** Search 100K nodes must complete in < 500ms (CRITICAL) */
  SEARCH_100K_MS: 500,
  /** Rollup at depth 3 must complete in < 500ms */
  ROLLUP_DEPTH3_MS: 500,
  /** Scan 1000 files must complete in < 60 seconds */
  SCAN_1000_FILES_MS: 60000,
  /** Index building for 1000 nodes < 100ms */
  INDEX_BUILD_1K_MS: 100,
  /** Index building for 10K nodes < 1000ms */
  INDEX_BUILD_10K_MS: 1000,
  /** Memory budget for 10K nodes (~27MB) */
  MEMORY_10K_NODES_BYTES: 27 * 1024 * 1024,
  /** Minimum throughput: 10K nodes per second */
  MIN_THROUGHPUT_NODES_PER_SEC: 10000,
  /** Graph diff 10K nodes < 5000ms */
  DIFF_10K_NODES_MS: 5000,
  /** Graph diff 100K nodes < 500ms (NFR-PERF-008 lookup target) */
  DIFF_100K_LOOKUP_MS: 500,
} as const;

/**
 * Type for performance target keys
 */
export type PerformanceTargetKey = keyof typeof PERFORMANCE_TARGETS;

// ============================================================================
// Benchmark Result Types
// ============================================================================

/**
 * Result of a single benchmark iteration
 */
export interface BenchmarkIteration {
  /** Iteration index (0-based) */
  readonly index: number;
  /** Latency in milliseconds */
  readonly latencyMs: number;
  /** Memory used in bytes (if measured) */
  readonly memoryBytes?: number;
  /** Whether this was a warmup iteration */
  readonly isWarmup: boolean;
  /** Any error that occurred */
  readonly error?: Error;
}

/**
 * Percentile statistics for benchmark results
 */
export interface PercentileStats {
  /** Minimum value */
  readonly min: number;
  /** Maximum value */
  readonly max: number;
  /** Average (mean) value */
  readonly avg: number;
  /** Median (50th percentile) */
  readonly p50: number;
  /** 75th percentile */
  readonly p75: number;
  /** 90th percentile */
  readonly p90: number;
  /** 95th percentile */
  readonly p95: number;
  /** 99th percentile */
  readonly p99: number;
  /** Standard deviation */
  readonly stdDev: number;
}

/**
 * Complete benchmark result with statistics
 */
export interface BenchmarkResult {
  /** Benchmark name/identifier */
  readonly name: string;
  /** Suite this benchmark belongs to */
  readonly suite: string;
  /** Number of iterations performed */
  readonly iterations: number;
  /** Number of warmup iterations */
  readonly warmupIterations: number;
  /** Latency statistics in milliseconds */
  readonly latency: PercentileStats;
  /** Memory statistics in bytes (if measured) */
  readonly memory?: PercentileStats;
  /** Throughput (operations per second) */
  readonly throughputPerSec: number;
  /** Individual iteration results */
  readonly iterationResults: readonly BenchmarkIteration[];
  /** Target threshold in ms (if applicable) */
  readonly targetMs?: number;
  /** Whether the benchmark passed the target */
  readonly passed: boolean;
  /** Performance ratio (actual / target) */
  readonly performanceRatio?: number;
  /** Timestamp when benchmark was run */
  readonly timestamp: Date;
  /** Total benchmark duration including warmup */
  readonly totalDurationMs: number;
  /** Benchmark configuration */
  readonly config: BenchmarkConfig;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Configuration for running a benchmark
 */
export interface BenchmarkConfig {
  /** Number of iterations to run */
  readonly iterations: number;
  /** Number of warmup iterations before measurement */
  readonly warmupIterations: number;
  /** Target performance threshold in milliseconds */
  readonly targetMs?: number;
  /** Whether to measure memory usage */
  readonly measureMemory: boolean;
  /** Whether to force garbage collection between iterations */
  readonly forceGcBetweenIterations: boolean;
  /** Delay between iterations in milliseconds */
  readonly iterationDelayMs: number;
  /** Timeout per iteration in milliseconds */
  readonly timeoutMs: number;
  /** Enable parallel execution where applicable */
  readonly enableParallel: boolean;
  /** Scale factor for data generation */
  readonly scale: BenchmarkScale;
}

/**
 * Scale levels for benchmarks
 */
export type BenchmarkScale = '1k' | '10k' | '50k' | '100k' | 'custom';

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  iterations: 100,
  warmupIterations: 10,
  measureMemory: true,
  forceGcBetweenIterations: false,
  iterationDelayMs: 0,
  timeoutMs: 60000,
  enableParallel: false,
  scale: '10k',
};

// ============================================================================
// Benchmark Suite Types
// ============================================================================

/**
 * Available benchmark suites
 */
export type BenchmarkSuiteType =
  | 'search'
  | 'rollup'
  | 'scan'
  | 'diff'
  | 'index'
  | 'memory'
  | 'all';

/**
 * Definition of a benchmark suite
 */
export interface BenchmarkSuite {
  /** Suite name */
  readonly name: string;
  /** Suite description */
  readonly description: string;
  /** Suite type */
  readonly type: BenchmarkSuiteType;
  /** Individual benchmarks in the suite */
  readonly benchmarks: readonly BenchmarkDefinition[];
  /** Setup function run once before all benchmarks */
  readonly setup?: () => Promise<void>;
  /** Teardown function run once after all benchmarks */
  readonly teardown?: () => Promise<void>;
}

/**
 * Definition of a single benchmark
 */
export interface BenchmarkDefinition {
  /** Benchmark name */
  readonly name: string;
  /** Benchmark description */
  readonly description: string;
  /** The function to benchmark */
  readonly fn: () => Promise<void>;
  /** NFR target this benchmark validates (if applicable) */
  readonly target?: PerformanceTargetKey;
  /** Setup function run before each iteration */
  readonly beforeEach?: () => Promise<void>;
  /** Teardown function run after each iteration */
  readonly afterEach?: () => Promise<void>;
  /** Whether this benchmark is enabled */
  readonly enabled?: boolean;
  /** Tags for filtering */
  readonly tags?: readonly string[];
}

// ============================================================================
// Report Types
// ============================================================================

/**
 * Complete benchmark report
 */
export interface BenchmarkReport {
  /** Report title */
  readonly title: string;
  /** When the report was generated */
  readonly generatedAt: Date;
  /** Environment information */
  readonly environment: BenchmarkEnvironment;
  /** Overall summary */
  readonly summary: BenchmarkSummary;
  /** Results by suite */
  readonly suiteResults: readonly BenchmarkSuiteResult[];
  /** Performance comparison against targets */
  readonly targetComparison: readonly TargetComparisonResult[];
}

/**
 * Environment information for the benchmark
 */
export interface BenchmarkEnvironment {
  /** Node.js version */
  readonly nodeVersion: string;
  /** Platform (darwin, linux, win32) */
  readonly platform: string;
  /** Architecture (x64, arm64) */
  readonly arch: string;
  /** Total memory in bytes */
  readonly totalMemory: number;
  /** Available memory in bytes */
  readonly freeMemory: number;
  /** CPU model */
  readonly cpuModel: string;
  /** Number of CPU cores */
  readonly cpuCores: number;
  /** V8 heap statistics */
  readonly v8HeapStats?: {
    readonly totalHeapSize: number;
    readonly usedHeapSize: number;
    readonly heapSizeLimit: number;
  };
}

/**
 * Summary of all benchmark results
 */
export interface BenchmarkSummary {
  /** Total benchmarks run */
  readonly totalBenchmarks: number;
  /** Benchmarks that passed */
  readonly passed: number;
  /** Benchmarks that failed */
  readonly failed: number;
  /** Benchmarks that were skipped */
  readonly skipped: number;
  /** Total duration in milliseconds */
  readonly totalDurationMs: number;
  /** Pass rate (0-1) */
  readonly passRate: number;
  /** Critical failures (100K node targets) */
  readonly criticalFailures: number;
}

/**
 * Results for a benchmark suite
 */
export interface BenchmarkSuiteResult {
  /** Suite name */
  readonly suiteName: string;
  /** Suite type */
  readonly suiteType: BenchmarkSuiteType;
  /** Individual benchmark results */
  readonly results: readonly BenchmarkResult[];
  /** Suite duration in milliseconds */
  readonly durationMs: number;
  /** Suite pass status */
  readonly passed: boolean;
}

/**
 * Comparison of actual performance against target
 */
export interface TargetComparisonResult {
  /** NFR target name */
  readonly target: PerformanceTargetKey;
  /** Target value in milliseconds */
  readonly targetMs: number;
  /** Actual measured value in milliseconds */
  readonly actualMs: number;
  /** Whether the target was met */
  readonly passed: boolean;
  /** Percentage of target (actual / target * 100) */
  readonly percentage: number;
  /** Margin (target - actual, positive is headroom) */
  readonly marginMs: number;
  /** Status: 'critical' if 100K target, otherwise 'normal' */
  readonly status: 'critical' | 'normal';
}

// ============================================================================
// Runner Options
// ============================================================================

/**
 * Options for the benchmark runner CLI
 */
export interface BenchmarkRunnerOptions {
  /** Suites to run */
  readonly suites: readonly BenchmarkSuiteType[];
  /** Scale for benchmarks */
  readonly scale: BenchmarkScale;
  /** Custom node count (when scale is 'custom') */
  readonly customNodeCount?: number;
  /** Output format */
  readonly format: 'json' | 'table' | 'markdown';
  /** Output file path (stdout if not specified) */
  readonly outputFile?: string;
  /** Verbose output */
  readonly verbose: boolean;
  /** Only run benchmarks matching these tags */
  readonly tags?: readonly string[];
  /** Skip warmup iterations */
  readonly skipWarmup: boolean;
  /** Number of iterations to run */
  readonly iterations: number;
  /** Fail fast on first failure */
  readonly failFast: boolean;
  /** Compare against baseline file */
  readonly baseline?: string;
  /** Save results as new baseline */
  readonly saveBaseline?: string;
}

/**
 * Default runner options
 */
export const DEFAULT_RUNNER_OPTIONS: BenchmarkRunnerOptions = {
  suites: ['all'],
  scale: '10k',
  format: 'table',
  verbose: false,
  skipWarmup: false,
  iterations: 100,
  failFast: false,
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for BenchmarkResult
 */
export function isBenchmarkResult(value: unknown): value is BenchmarkResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'suite' in value &&
    'iterations' in value &&
    'latency' in value &&
    'passed' in value
  );
}

/**
 * Type guard for BenchmarkSuite
 */
export function isBenchmarkSuite(value: unknown): value is BenchmarkSuite {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value &&
    'benchmarks' in value &&
    Array.isArray((value as BenchmarkSuite).benchmarks)
  );
}

/**
 * Type guard for BenchmarkReport
 */
export function isBenchmarkReport(value: unknown): value is BenchmarkReport {
  return (
    typeof value === 'object' &&
    value !== null &&
    'title' in value &&
    'generatedAt' in value &&
    'environment' in value &&
    'summary' in value &&
    'suiteResults' in value
  );
}

/**
 * Check if a scale is valid
 */
export function isValidScale(value: unknown): value is BenchmarkScale {
  return (
    value === '1k' ||
    value === '10k' ||
    value === '50k' ||
    value === '100k' ||
    value === 'custom'
  );
}

/**
 * Check if a suite type is valid
 */
export function isValidSuiteType(value: unknown): value is BenchmarkSuiteType {
  return (
    value === 'search' ||
    value === 'rollup' ||
    value === 'scan' ||
    value === 'diff' ||
    value === 'index' ||
    value === 'memory' ||
    value === 'all'
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Callback for progress reporting during benchmark runs
 */
export type BenchmarkProgressCallback = (progress: BenchmarkProgress) => void;

/**
 * Progress information during benchmark execution
 */
export interface BenchmarkProgress {
  /** Current benchmark name */
  readonly benchmarkName: string;
  /** Current suite name */
  readonly suiteName: string;
  /** Current iteration */
  readonly currentIteration: number;
  /** Total iterations */
  readonly totalIterations: number;
  /** Percentage complete (0-100) */
  readonly percentComplete: number;
  /** Elapsed time in milliseconds */
  readonly elapsedMs: number;
  /** Estimated remaining time in milliseconds */
  readonly estimatedRemainingMs: number;
  /** Current status */
  readonly status: 'warmup' | 'running' | 'complete' | 'failed';
}
