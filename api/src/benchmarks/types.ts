/**
 * Benchmark Type Definitions
 * @module benchmarks/types
 *
 * TypeBox schemas and type definitions for the performance benchmark system.
 * Implements comprehensive benchmarking capabilities for search, rollup, and scan operations.
 *
 * TASK-FINAL-002: Performance Validation
 */

import { Type, Static } from '@sinclair/typebox';
import { Brand } from '../types/utility.js';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded type for Benchmark Run IDs
 * @example
 * const runId = 'bench_run_01HXYZ...' as BenchmarkRunId;
 */
export type BenchmarkRunId = Brand<string, 'BenchmarkRunId'>;

/**
 * Branded type for Benchmark Suite IDs
 * @example
 * const suiteId = 'bench_suite_01HXYZ...' as BenchmarkSuiteId;
 */
export type BenchmarkSuiteId = Brand<string, 'BenchmarkSuiteId'>;

// ============================================================================
// Benchmark Type Enum
// ============================================================================

/**
 * Available benchmark operation types
 */
export const BenchmarkType = {
  /** Graph search operations */
  SEARCH: 'search',
  /** Cross-repository rollup operations */
  ROLLUP: 'rollup',
  /** Repository scan operations */
  SCAN: 'scan',
  /** Node traversal operations */
  TRAVERSAL: 'traversal',
  /** Database query operations */
  QUERY: 'query',
  /** API endpoint operations */
  API: 'api',
} as const;

export type BenchmarkType = typeof BenchmarkType[keyof typeof BenchmarkType];

/**
 * TypeBox schema for benchmark type
 */
export const BenchmarkTypeSchema = Type.Union([
  Type.Literal('search'),
  Type.Literal('rollup'),
  Type.Literal('scan'),
  Type.Literal('traversal'),
  Type.Literal('query'),
  Type.Literal('api'),
], { description: 'Type of benchmark operation' });

// ============================================================================
// Benchmark Status Enum
// ============================================================================

/**
 * Benchmark execution status
 */
export const BenchmarkStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type BenchmarkStatus = typeof BenchmarkStatus[keyof typeof BenchmarkStatus];

/**
 * TypeBox schema for benchmark status
 */
export const BenchmarkStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('running'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
], { description: 'Current status of the benchmark run' });

// ============================================================================
// Scale Configuration
// ============================================================================

/**
 * Benchmark scale levels for testing different workload sizes
 */
export const BenchmarkScale = {
  SMALL: 'small',
  MEDIUM: 'medium',
  LARGE: 'large',
  XLARGE: 'xlarge',
} as const;

export type BenchmarkScale = typeof BenchmarkScale[keyof typeof BenchmarkScale];

/**
 * TypeBox schema for benchmark scale
 */
export const BenchmarkScaleSchema = Type.Union([
  Type.Literal('small'),
  Type.Literal('medium'),
  Type.Literal('large'),
  Type.Literal('xlarge'),
], { description: 'Scale level for benchmark workload' });

/**
 * Default node counts for each scale level
 */
export const SCALE_NODE_COUNTS: Record<BenchmarkScale, number> = {
  small: 100,
  medium: 1000,
  large: 10000,
  xlarge: 100000,
};

/**
 * Default edge counts for each scale level
 */
export const SCALE_EDGE_COUNTS: Record<BenchmarkScale, number> = {
  small: 200,
  medium: 3000,
  large: 30000,
  xlarge: 300000,
};

// ============================================================================
// Aggregated Metrics
// ============================================================================

/**
 * Statistical metrics aggregated from multiple benchmark iterations
 */
export interface AggregatedMetrics {
  /** Number of samples in this aggregation */
  readonly count: number;
  /** Minimum value in milliseconds */
  readonly min: number;
  /** Maximum value in milliseconds */
  readonly max: number;
  /** Mean (average) value in milliseconds */
  readonly mean: number;
  /** Standard deviation */
  readonly stdDev: number;
  /** Median (50th percentile) in milliseconds */
  readonly p50: number;
  /** 90th percentile in milliseconds */
  readonly p90: number;
  /** 95th percentile in milliseconds */
  readonly p95: number;
  /** 99th percentile in milliseconds */
  readonly p99: number;
  /** Operations per second */
  readonly throughput: number;
  /** Variance */
  readonly variance: number;
}

/**
 * TypeBox schema for aggregated metrics
 */
export const AggregatedMetricsSchema = Type.Object({
  count: Type.Number({ minimum: 0 }),
  min: Type.Number({ minimum: 0 }),
  max: Type.Number({ minimum: 0 }),
  mean: Type.Number({ minimum: 0 }),
  stdDev: Type.Number({ minimum: 0 }),
  p50: Type.Number({ minimum: 0 }),
  p90: Type.Number({ minimum: 0 }),
  p95: Type.Number({ minimum: 0 }),
  p99: Type.Number({ minimum: 0 }),
  throughput: Type.Number({ minimum: 0 }),
  variance: Type.Number({ minimum: 0 }),
});

// ============================================================================
// Benchmark Configuration
// ============================================================================

/**
 * Configuration options for benchmark execution
 */
export interface BenchmarkConfig {
  /** Number of iterations to run */
  readonly iterations: number;
  /** Number of warmup iterations (not counted in results) */
  readonly warmupIterations: number;
  /** Maximum time allowed per iteration in milliseconds */
  readonly timeoutMs: number;
  /** Scale level for workload generation */
  readonly scale: BenchmarkScale;
  /** Whether to collect memory metrics */
  readonly collectMemoryMetrics: boolean;
  /** Whether to collect CPU metrics */
  readonly collectCpuMetrics: boolean;
  /** Delay between iterations in milliseconds */
  readonly delayBetweenIterations: number;
  /** Whether to run garbage collection before each iteration */
  readonly gcBeforeIteration: boolean;
  /** Tags for categorizing this benchmark */
  readonly tags: readonly string[];
}

/**
 * TypeBox schema for benchmark configuration
 */
export const BenchmarkConfigSchema = Type.Object({
  iterations: Type.Number({ minimum: 1, default: 100 }),
  warmupIterations: Type.Number({ minimum: 0, default: 10 }),
  timeoutMs: Type.Number({ minimum: 100, default: 30000 }),
  scale: BenchmarkScaleSchema,
  collectMemoryMetrics: Type.Boolean({ default: true }),
  collectCpuMetrics: Type.Boolean({ default: false }),
  delayBetweenIterations: Type.Number({ minimum: 0, default: 0 }),
  gcBeforeIteration: Type.Boolean({ default: false }),
  tags: Type.Array(Type.String(), { default: [] }),
});

export type BenchmarkConfigDTO = Static<typeof BenchmarkConfigSchema>;

/**
 * Default benchmark configuration
 */
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  iterations: 100,
  warmupIterations: 10,
  timeoutMs: 30000,
  scale: 'medium',
  collectMemoryMetrics: true,
  collectCpuMetrics: false,
  delayBetweenIterations: 0,
  gcBeforeIteration: false,
  tags: [],
};

// ============================================================================
// Benchmark Result
// ============================================================================

/**
 * Result of a single benchmark run
 */
export interface BenchmarkResult {
  /** Benchmark name/identifier */
  readonly name: string;
  /** Type of benchmark operation */
  readonly type: BenchmarkType;
  /** Number of nodes processed */
  readonly nodeCount: number;
  /** Number of edges processed */
  readonly edgeCount: number;
  /** Number of iterations completed */
  readonly iterations: number;
  /** Aggregated timing metrics */
  readonly timing: AggregatedMetrics;
  /** Whether the benchmark passed threshold requirements */
  readonly passed: boolean;
  /** Performance threshold in milliseconds */
  readonly threshold: number;
  /** Threshold type (p50, p95, p99, mean) */
  readonly thresholdType: 'p50' | 'p95' | 'p99' | 'mean';
  /** Memory metrics (if collected) */
  readonly memory?: MemoryMetrics;
  /** CPU metrics (if collected) */
  readonly cpu?: CpuMetrics;
  /** Additional metadata */
  readonly metadata: Record<string, unknown>;
}

/**
 * TypeBox schema for benchmark result
 */
export const BenchmarkResultSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  type: BenchmarkTypeSchema,
  nodeCount: Type.Number({ minimum: 0 }),
  edgeCount: Type.Number({ minimum: 0 }),
  iterations: Type.Number({ minimum: 1 }),
  timing: AggregatedMetricsSchema,
  passed: Type.Boolean(),
  threshold: Type.Number({ minimum: 0 }),
  thresholdType: Type.Union([
    Type.Literal('p50'),
    Type.Literal('p95'),
    Type.Literal('p99'),
    Type.Literal('mean'),
  ], { default: 'p95' }),
  memory: Type.Optional(Type.Object({
    heapUsedAvg: Type.Number(),
    heapUsedMax: Type.Number(),
    heapTotalAvg: Type.Number(),
    externalAvg: Type.Number(),
    arrayBuffersAvg: Type.Number(),
  })),
  cpu: Type.Optional(Type.Object({
    userAvg: Type.Number(),
    systemAvg: Type.Number(),
  })),
  metadata: Type.Record(Type.String(), Type.Unknown(), { default: {} }),
});

export type BenchmarkResultDTO = Static<typeof BenchmarkResultSchema>;

// ============================================================================
// Memory and CPU Metrics
// ============================================================================

/**
 * Memory usage metrics during benchmark execution
 */
export interface MemoryMetrics {
  /** Average heap used in bytes */
  readonly heapUsedAvg: number;
  /** Maximum heap used in bytes */
  readonly heapUsedMax: number;
  /** Average total heap size in bytes */
  readonly heapTotalAvg: number;
  /** Average external memory in bytes */
  readonly externalAvg: number;
  /** Average array buffer memory in bytes */
  readonly arrayBuffersAvg: number;
}

/**
 * TypeBox schema for memory metrics
 */
export const MemoryMetricsSchema = Type.Object({
  heapUsedAvg: Type.Number({ minimum: 0 }),
  heapUsedMax: Type.Number({ minimum: 0 }),
  heapTotalAvg: Type.Number({ minimum: 0 }),
  externalAvg: Type.Number({ minimum: 0 }),
  arrayBuffersAvg: Type.Number({ minimum: 0 }),
});

/**
 * CPU usage metrics during benchmark execution
 */
export interface CpuMetrics {
  /** Average user CPU time in milliseconds */
  readonly userAvg: number;
  /** Average system CPU time in milliseconds */
  readonly systemAvg: number;
}

/**
 * TypeBox schema for CPU metrics
 */
export const CpuMetricsSchema = Type.Object({
  userAvg: Type.Number({ minimum: 0 }),
  systemAvg: Type.Number({ minimum: 0 }),
});

// ============================================================================
// Benchmark Suite
// ============================================================================

/**
 * Collection of related benchmarks that run together
 */
export interface BenchmarkSuite {
  /** Unique suite identifier */
  readonly id: BenchmarkSuiteId;
  /** Suite name */
  readonly name: string;
  /** Suite description */
  readonly description?: string;
  /** Individual benchmark configurations */
  readonly benchmarks: readonly BenchmarkDefinition[];
  /** Default configuration for all benchmarks in suite */
  readonly defaultConfig: Partial<BenchmarkConfig>;
  /** Whether to stop on first failure */
  readonly stopOnFailure: boolean;
  /** Suite-level tags */
  readonly tags: readonly string[];
  /** Created timestamp */
  readonly createdAt: Date;
}

/**
 * TypeBox schema for benchmark suite
 */
export const BenchmarkSuiteSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  benchmarks: Type.Array(Type.Object({
    name: Type.String(),
    type: BenchmarkTypeSchema,
    config: Type.Optional(BenchmarkConfigSchema),
    threshold: Type.Number({ minimum: 0 }),
    thresholdType: Type.Optional(Type.Union([
      Type.Literal('p50'),
      Type.Literal('p95'),
      Type.Literal('p99'),
      Type.Literal('mean'),
    ])),
  })),
  defaultConfig: Type.Optional(Type.Partial(BenchmarkConfigSchema)),
  stopOnFailure: Type.Boolean({ default: false }),
  tags: Type.Array(Type.String(), { default: [] }),
  createdAt: Type.String({ format: 'date-time' }),
});

/**
 * Definition of a single benchmark within a suite
 */
export interface BenchmarkDefinition {
  /** Benchmark name */
  readonly name: string;
  /** Benchmark type */
  readonly type: BenchmarkType;
  /** Override configuration for this benchmark */
  readonly config?: Partial<BenchmarkConfig>;
  /** Performance threshold in milliseconds */
  readonly threshold: number;
  /** Threshold type */
  readonly thresholdType: 'p50' | 'p95' | 'p99' | 'mean';
  /** Setup function to run before benchmark */
  readonly setup?: () => Promise<void>;
  /** Teardown function to run after benchmark */
  readonly teardown?: () => Promise<void>;
}

// ============================================================================
// Benchmark Run
// ============================================================================

/**
 * Complete benchmark run with all results
 */
export interface BenchmarkRun {
  /** Unique run identifier */
  readonly id: BenchmarkRunId;
  /** Suite ID (if part of a suite) */
  readonly suiteId?: BenchmarkSuiteId;
  /** Run status */
  readonly status: BenchmarkStatus;
  /** Run configuration */
  readonly config: BenchmarkConfig;
  /** Individual results */
  readonly results: readonly BenchmarkResult[];
  /** Overall summary */
  readonly summary: BenchmarkSummary;
  /** Environment information */
  readonly environment: EnvironmentInfo;
  /** Error message (if failed) */
  readonly errorMessage?: string;
  /** Error stack trace (if failed) */
  readonly errorStack?: string;
  /** Started timestamp */
  readonly startedAt: Date;
  /** Completed timestamp */
  readonly completedAt?: Date;
  /** Total duration in milliseconds */
  readonly durationMs: number;
}

/**
 * TypeBox schema for benchmark run
 */
export const BenchmarkRunSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  suiteId: Type.Optional(Type.String({ format: 'uuid' })),
  status: BenchmarkStatusSchema,
  config: BenchmarkConfigSchema,
  results: Type.Array(BenchmarkResultSchema),
  summary: Type.Object({
    totalBenchmarks: Type.Number(),
    passed: Type.Number(),
    failed: Type.Number(),
    passRate: Type.Number({ minimum: 0, maximum: 100 }),
    totalIterations: Type.Number(),
    averageThroughput: Type.Number(),
  }),
  environment: Type.Object({
    nodeVersion: Type.String(),
    platform: Type.String(),
    arch: Type.String(),
    cpus: Type.Number(),
    totalMemory: Type.Number(),
    freeMemory: Type.Number(),
  }),
  errorMessage: Type.Optional(Type.String()),
  errorStack: Type.Optional(Type.String()),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  durationMs: Type.Number({ minimum: 0 }),
});

export type BenchmarkRunDTO = Static<typeof BenchmarkRunSchema>;

// ============================================================================
// Summary Types
// ============================================================================

/**
 * Summary of benchmark run results
 */
export interface BenchmarkSummary {
  /** Total number of benchmarks executed */
  readonly totalBenchmarks: number;
  /** Number of benchmarks that passed */
  readonly passed: number;
  /** Number of benchmarks that failed */
  readonly failed: number;
  /** Pass rate percentage (0-100) */
  readonly passRate: number;
  /** Total iterations across all benchmarks */
  readonly totalIterations: number;
  /** Average throughput across all benchmarks */
  readonly averageThroughput: number;
  /** Slowest benchmark name */
  readonly slowestBenchmark?: string;
  /** Fastest benchmark name */
  readonly fastestBenchmark?: string;
}

/**
 * Environment information captured during benchmark run
 */
export interface EnvironmentInfo {
  /** Node.js version */
  readonly nodeVersion: string;
  /** Operating system platform */
  readonly platform: string;
  /** CPU architecture */
  readonly arch: string;
  /** Number of CPU cores */
  readonly cpus: number;
  /** Total system memory in bytes */
  readonly totalMemory: number;
  /** Free system memory at start in bytes */
  readonly freeMemory: number;
  /** Hostname (optional) */
  readonly hostname?: string;
  /** Git commit SHA (optional) */
  readonly gitCommit?: string;
  /** Git branch (optional) */
  readonly gitBranch?: string;
}

// ============================================================================
// Threshold Configuration
// ============================================================================

/**
 * Performance thresholds by benchmark type and scale
 */
export interface ThresholdConfig {
  /** Benchmark type */
  readonly type: BenchmarkType;
  /** Scale level */
  readonly scale: BenchmarkScale;
  /** P95 threshold in milliseconds */
  readonly p95Threshold: number;
  /** P99 threshold in milliseconds */
  readonly p99Threshold: number;
  /** Mean threshold in milliseconds */
  readonly meanThreshold: number;
  /** Minimum throughput (ops/sec) */
  readonly minThroughput: number;
}

/**
 * TypeBox schema for threshold configuration
 */
export const ThresholdConfigSchema = Type.Object({
  type: BenchmarkTypeSchema,
  scale: BenchmarkScaleSchema,
  p95Threshold: Type.Number({ minimum: 0 }),
  p99Threshold: Type.Number({ minimum: 0 }),
  meanThreshold: Type.Number({ minimum: 0 }),
  minThroughput: Type.Number({ minimum: 0 }),
});

/**
 * Default performance thresholds
 */
export const DEFAULT_THRESHOLDS: Record<BenchmarkType, Record<BenchmarkScale, ThresholdConfig>> = {
  search: {
    small: { type: 'search', scale: 'small', p95Threshold: 10, p99Threshold: 20, meanThreshold: 5, minThroughput: 1000 },
    medium: { type: 'search', scale: 'medium', p95Threshold: 50, p99Threshold: 100, meanThreshold: 25, minThroughput: 500 },
    large: { type: 'search', scale: 'large', p95Threshold: 200, p99Threshold: 500, meanThreshold: 100, minThroughput: 100 },
    xlarge: { type: 'search', scale: 'xlarge', p95Threshold: 1000, p99Threshold: 2000, meanThreshold: 500, minThroughput: 20 },
  },
  rollup: {
    small: { type: 'rollup', scale: 'small', p95Threshold: 100, p99Threshold: 200, meanThreshold: 50, minThroughput: 100 },
    medium: { type: 'rollup', scale: 'medium', p95Threshold: 500, p99Threshold: 1000, meanThreshold: 250, minThroughput: 20 },
    large: { type: 'rollup', scale: 'large', p95Threshold: 2000, p99Threshold: 5000, meanThreshold: 1000, minThroughput: 5 },
    xlarge: { type: 'rollup', scale: 'xlarge', p95Threshold: 10000, p99Threshold: 20000, meanThreshold: 5000, minThroughput: 1 },
  },
  scan: {
    small: { type: 'scan', scale: 'small', p95Threshold: 500, p99Threshold: 1000, meanThreshold: 250, minThroughput: 10 },
    medium: { type: 'scan', scale: 'medium', p95Threshold: 2000, p99Threshold: 5000, meanThreshold: 1000, minThroughput: 5 },
    large: { type: 'scan', scale: 'large', p95Threshold: 10000, p99Threshold: 20000, meanThreshold: 5000, minThroughput: 1 },
    xlarge: { type: 'scan', scale: 'xlarge', p95Threshold: 60000, p99Threshold: 120000, meanThreshold: 30000, minThroughput: 0.1 },
  },
  traversal: {
    small: { type: 'traversal', scale: 'small', p95Threshold: 5, p99Threshold: 10, meanThreshold: 2, minThroughput: 2000 },
    medium: { type: 'traversal', scale: 'medium', p95Threshold: 20, p99Threshold: 50, meanThreshold: 10, minThroughput: 1000 },
    large: { type: 'traversal', scale: 'large', p95Threshold: 100, p99Threshold: 200, meanThreshold: 50, minThroughput: 200 },
    xlarge: { type: 'traversal', scale: 'xlarge', p95Threshold: 500, p99Threshold: 1000, meanThreshold: 250, minThroughput: 50 },
  },
  query: {
    small: { type: 'query', scale: 'small', p95Threshold: 5, p99Threshold: 10, meanThreshold: 2, minThroughput: 2000 },
    medium: { type: 'query', scale: 'medium', p95Threshold: 20, p99Threshold: 50, meanThreshold: 10, minThroughput: 1000 },
    large: { type: 'query', scale: 'large', p95Threshold: 100, p99Threshold: 200, meanThreshold: 50, minThroughput: 200 },
    xlarge: { type: 'query', scale: 'xlarge', p95Threshold: 500, p99Threshold: 1000, meanThreshold: 250, minThroughput: 50 },
  },
  api: {
    small: { type: 'api', scale: 'small', p95Threshold: 50, p99Threshold: 100, meanThreshold: 25, minThroughput: 500 },
    medium: { type: 'api', scale: 'medium', p95Threshold: 100, p99Threshold: 200, meanThreshold: 50, minThroughput: 200 },
    large: { type: 'api', scale: 'large', p95Threshold: 200, p99Threshold: 500, meanThreshold: 100, minThroughput: 100 },
    xlarge: { type: 'api', scale: 'xlarge', p95Threshold: 500, p99Threshold: 1000, meanThreshold: 250, minThroughput: 50 },
  },
};

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Comparison between two benchmark runs
 */
export interface BenchmarkComparison {
  /** Base run ID */
  readonly baseRunId: BenchmarkRunId;
  /** Comparison run ID */
  readonly comparisonRunId: BenchmarkRunId;
  /** Individual benchmark comparisons */
  readonly benchmarks: readonly BenchmarkMetricComparison[];
  /** Overall regression detected */
  readonly hasRegression: boolean;
  /** Overall improvement detected */
  readonly hasImprovement: boolean;
  /** Summary statistics */
  readonly summary: ComparisonSummary;
}

/**
 * Comparison of metrics between two benchmark runs
 */
export interface BenchmarkMetricComparison {
  /** Benchmark name */
  readonly name: string;
  /** Benchmark type */
  readonly type: BenchmarkType;
  /** Base metrics */
  readonly base: AggregatedMetrics;
  /** Comparison metrics */
  readonly comparison: AggregatedMetrics;
  /** Percentage change in mean (positive = slower) */
  readonly meanChange: number;
  /** Percentage change in p95 (positive = slower) */
  readonly p95Change: number;
  /** Percentage change in throughput (positive = faster) */
  readonly throughputChange: number;
  /** Whether this represents a regression */
  readonly isRegression: boolean;
  /** Whether this represents an improvement */
  readonly isImprovement: boolean;
}

/**
 * Summary of comparison results
 */
export interface ComparisonSummary {
  /** Number of benchmarks compared */
  readonly totalCompared: number;
  /** Number of regressions */
  readonly regressions: number;
  /** Number of improvements */
  readonly improvements: number;
  /** Number with no significant change */
  readonly unchanged: number;
  /** Average mean change percentage */
  readonly averageMeanChange: number;
  /** Average p95 change percentage */
  readonly averageP95Change: number;
  /** Average throughput change percentage */
  readonly averageThroughputChange: number;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for BenchmarkRunId
 */
export function isBenchmarkRunId(value: unknown): value is BenchmarkRunId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for BenchmarkSuiteId
 */
export function isBenchmarkSuiteId(value: unknown): value is BenchmarkSuiteId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for BenchmarkType
 */
export function isBenchmarkType(value: unknown): value is BenchmarkType {
  return (
    value === 'search' ||
    value === 'rollup' ||
    value === 'scan' ||
    value === 'traversal' ||
    value === 'query' ||
    value === 'api'
  );
}

/**
 * Type guard for BenchmarkStatus
 */
export function isBenchmarkStatus(value: unknown): value is BenchmarkStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

/**
 * Type guard for BenchmarkScale
 */
export function isBenchmarkScale(value: unknown): value is BenchmarkScale {
  return (
    value === 'small' ||
    value === 'medium' ||
    value === 'large' ||
    value === 'xlarge'
  );
}

/**
 * Type guard for BenchmarkResult
 */
export function isBenchmarkResult(value: unknown): value is BenchmarkResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    'type' in value &&
    'timing' in value &&
    'passed' in value
  );
}

/**
 * Type guard for BenchmarkRun
 */
export function isBenchmarkRun(value: unknown): value is BenchmarkRun {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'status' in value &&
    'results' in value &&
    'summary' in value
  );
}

/**
 * Type guard for AggregatedMetrics
 */
export function isAggregatedMetrics(value: unknown): value is AggregatedMetrics {
  return (
    typeof value === 'object' &&
    value !== null &&
    'count' in value &&
    'min' in value &&
    'max' in value &&
    'mean' in value &&
    'p95' in value &&
    'throughput' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a BenchmarkRunId
 */
export function createBenchmarkRunId(id: string): BenchmarkRunId {
  return id as BenchmarkRunId;
}

/**
 * Create a BenchmarkSuiteId
 */
export function createBenchmarkSuiteId(id: string): BenchmarkSuiteId {
  return id as BenchmarkSuiteId;
}

/**
 * Create empty aggregated metrics
 */
export function createEmptyAggregatedMetrics(): AggregatedMetrics {
  return {
    count: 0,
    min: 0,
    max: 0,
    mean: 0,
    stdDev: 0,
    p50: 0,
    p90: 0,
    p95: 0,
    p99: 0,
    throughput: 0,
    variance: 0,
  };
}

/**
 * Create default benchmark config
 */
export function createDefaultBenchmarkConfig(
  overrides?: Partial<BenchmarkConfig>
): BenchmarkConfig {
  return {
    ...DEFAULT_BENCHMARK_CONFIG,
    ...overrides,
  };
}

/**
 * Create empty benchmark summary
 */
export function createEmptyBenchmarkSummary(): BenchmarkSummary {
  return {
    totalBenchmarks: 0,
    passed: 0,
    failed: 0,
    passRate: 0,
    totalIterations: 0,
    averageThroughput: 0,
  };
}

/**
 * Create environment info from current process
 */
export async function createEnvironmentInfo(): Promise<EnvironmentInfo> {
  const os = await import('node:os');
  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    hostname: os.hostname(),
  };
}

/**
 * Get threshold for a specific benchmark type and scale
 */
export function getThreshold(
  type: BenchmarkType,
  scale: BenchmarkScale
): ThresholdConfig {
  return DEFAULT_THRESHOLDS[type][scale];
}

/**
 * Get node count for a scale level
 */
export function getNodeCount(scale: BenchmarkScale): number {
  return SCALE_NODE_COUNTS[scale];
}

/**
 * Get edge count for a scale level
 */
export function getEdgeCount(scale: BenchmarkScale): number {
  return SCALE_EDGE_COUNTS[scale];
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Benchmark-specific error codes
 */
export const BenchmarkErrorCodes = {
  // Execution errors
  EXECUTION_FAILED: 'BENCHMARK_EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'BENCHMARK_EXECUTION_TIMEOUT',
  ITERATION_FAILED: 'BENCHMARK_ITERATION_FAILED',

  // Validation errors
  INVALID_CONFIGURATION: 'BENCHMARK_INVALID_CONFIGURATION',
  INVALID_THRESHOLD: 'BENCHMARK_INVALID_THRESHOLD',
  INVALID_SCALE: 'BENCHMARK_INVALID_SCALE',

  // Resource errors
  RUN_NOT_FOUND: 'BENCHMARK_RUN_NOT_FOUND',
  SUITE_NOT_FOUND: 'BENCHMARK_SUITE_NOT_FOUND',

  // Threshold errors
  THRESHOLD_EXCEEDED: 'BENCHMARK_THRESHOLD_EXCEEDED',
  REGRESSION_DETECTED: 'BENCHMARK_REGRESSION_DETECTED',

  // System errors
  OUT_OF_MEMORY: 'BENCHMARK_OUT_OF_MEMORY',
  SETUP_FAILED: 'BENCHMARK_SETUP_FAILED',
  TEARDOWN_FAILED: 'BENCHMARK_TEARDOWN_FAILED',
} as const;

export type BenchmarkErrorCode = typeof BenchmarkErrorCodes[keyof typeof BenchmarkErrorCodes];
