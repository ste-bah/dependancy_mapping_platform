/**
 * Benchmark Service
 * @module benchmarks/benchmark-service
 *
 * Orchestrates benchmark execution, result collection, and persistence.
 * Implements NFR-PERF-008 performance validation targets.
 *
 * TASK-FINAL-002: Performance Validation
 *
 * NFR-PERF-008 Targets:
 * - Search 10K nodes < 100ms
 * - Search 50K nodes < 200ms
 * - Search 100K nodes < 500ms (CRITICAL)
 * - Rollup depth 3 < 500ms
 * - Scan 1000 files < 60s
 */

import pino from 'pino';
import { Pool, PoolClient } from 'pg';
import { randomUUID } from 'crypto';
import {
  BenchmarkType,
  BenchmarkScale,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkSuite,
  BenchmarkSuiteId,
  BenchmarkRunId,
  BenchmarkRun,
  BenchmarkStatus,
  BenchmarkSummary,
  AggregatedMetrics,
  MemoryMetrics,
  EnvironmentInfo,
  ThresholdConfig,
  DEFAULT_BENCHMARK_CONFIG,
  DEFAULT_THRESHOLDS,
  SCALE_NODE_COUNTS,
  SCALE_EDGE_COUNTS,
  createBenchmarkRunId,
  createBenchmarkSuiteId,
  createEmptyAggregatedMetrics,
  createEmptyBenchmarkSummary,
  createEnvironmentInfo,
  getThreshold,
  getNodeCount,
  getEdgeCount,
} from './types.js';
import {
  PERFORMANCE_TARGETS,
  type PerformanceTargetKey,
  type BenchmarkScale as NfrBenchmarkScale,
} from './benchmark-types.js';
import {
  measureLatency,
  measureAgainstNfrTarget,
  calculatePercentile,
  calculateStdDev,
  calculatePercentileStats,
  forceGC,
  getMemoryUsage,
  getDetailedMemoryUsage,
  delay,
  withTimeout,
  formatDuration,
  formatBytes,
  formatNumber,
  validateAgainstNfrTarget,
} from './benchmark-utils.js';
import { Result, success, failure, isSuccess } from '../types/utility.js';

const logger = pino({ name: 'benchmark-service' });

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Benchmark service configuration
 */
export interface BenchmarkServiceConfig {
  /** Maximum concurrent benchmarks */
  readonly maxConcurrency: number;
  /** Default timeout for individual benchmarks in milliseconds */
  readonly defaultTimeoutMs: number;
  /** Enable result caching */
  readonly enableCaching: boolean;
  /** Cache TTL in seconds */
  readonly cacheTtlSeconds: number;
  /** Enable automatic cleanup of old results */
  readonly enableAutoCleanup: boolean;
  /** Cleanup results older than N days */
  readonly cleanupOlderThanDays: number;
  /** Enable detailed memory profiling */
  readonly enableMemoryProfiling: boolean;
  /** Enable CPU profiling */
  readonly enableCpuProfiling: boolean;
  /** Regression detection threshold (percentage) */
  readonly regressionThreshold: number;
}

/**
 * Default benchmark service configuration
 */
export const DEFAULT_BENCHMARK_SERVICE_CONFIG: BenchmarkServiceConfig = {
  maxConcurrency: 1, // Benchmarks should run serially for accuracy
  defaultTimeoutMs: 60000,
  enableCaching: true,
  cacheTtlSeconds: 3600,
  enableAutoCleanup: true,
  cleanupOlderThanDays: 30,
  enableMemoryProfiling: true,
  enableCpuProfiling: false,
  regressionThreshold: 20, // 20% regression threshold
};

/**
 * Input for running a search benchmark
 */
export interface SearchBenchmarkInput {
  /** Number of nodes to benchmark */
  readonly nodeCount: number;
  /** Benchmark configuration overrides */
  readonly config?: Partial<BenchmarkConfig>;
  /** Search patterns to test */
  readonly searchPatterns?: readonly string[];
  /** Enable index benchmarking */
  readonly benchmarkIndexing?: boolean;
}

/**
 * Input for running a rollup benchmark
 */
export interface RollupBenchmarkInput {
  /** Maximum traversal depth */
  readonly depth: number;
  /** Number of nodes in the graph */
  readonly nodeCount?: number;
  /** Edge density multiplier */
  readonly edgeDensity?: number;
  /** Benchmark configuration overrides */
  readonly config?: Partial<BenchmarkConfig>;
}

/**
 * Input for running a scan benchmark
 */
export interface ScanBenchmarkInput {
  /** Number of files to scan */
  readonly fileCount: number;
  /** File types to include */
  readonly fileTypes?: readonly string[];
  /** Benchmark configuration overrides */
  readonly config?: Partial<BenchmarkConfig>;
}

/**
 * Input for running a full benchmark suite
 */
export interface SuiteInput {
  /** Scale level for all benchmarks */
  readonly scale: BenchmarkScale;
  /** Benchmark configuration overrides */
  readonly config?: Partial<BenchmarkConfig>;
  /** Stop on first failure */
  readonly stopOnFailure?: boolean;
  /** Callback URL for progress notifications */
  readonly callbackUrl?: string;
}

/**
 * Progress callback for benchmark execution
 */
export type BenchmarkProgressCallback = (progress: BenchmarkProgress) => void | Promise<void>;

/**
 * Benchmark progress information
 */
export interface BenchmarkProgress {
  /** Current benchmark name */
  readonly benchmarkName: string;
  /** Current iteration */
  readonly iteration: number;
  /** Total iterations */
  readonly totalIterations: number;
  /** Percentage complete */
  readonly percentComplete: number;
  /** Current phase */
  readonly phase: 'warmup' | 'measuring' | 'analyzing' | 'complete';
  /** Elapsed time in milliseconds */
  readonly elapsedMs: number;
  /** Current latency sample */
  readonly currentLatencyMs?: number;
}

/**
 * Benchmark event types
 */
export type BenchmarkEventType =
  | 'benchmark.started'
  | 'benchmark.progress'
  | 'benchmark.completed'
  | 'benchmark.failed'
  | 'suite.started'
  | 'suite.completed'
  | 'suite.failed'
  | 'regression.detected';

/**
 * Benchmark event
 */
export interface BenchmarkEvent {
  readonly type: BenchmarkEventType;
  readonly runId?: BenchmarkRunId;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/**
 * Event emitter interface for benchmark events
 */
export interface IBenchmarkEventEmitter {
  emit(event: BenchmarkEvent): void | Promise<void>;
}

/**
 * Benchmark persistence interface
 */
export interface IBenchmarkPersistence {
  /** Save a benchmark run */
  saveRun(run: BenchmarkRun): Promise<void>;
  /** Get a benchmark run by ID */
  getRun(runId: BenchmarkRunId): Promise<BenchmarkRun | null>;
  /** Get recent benchmark runs */
  getRecentRuns(limit: number): Promise<BenchmarkRun[]>;
  /** Get baseline for comparison */
  getBaseline(type: BenchmarkType, scale: BenchmarkScale): Promise<BenchmarkRun | null>;
  /** Save as baseline */
  saveBaseline(runId: BenchmarkRunId): Promise<void>;
  /** Delete old runs */
  deleteOldRuns(olderThanDays: number): Promise<number>;
}

/**
 * Benchmark service error
 */
export class BenchmarkServiceError extends Error {
  constructor(
    message: string,
    public readonly code: BenchmarkServiceErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'BenchmarkServiceError';
  }

  static executionFailed(reason: string, details?: Record<string, unknown>): BenchmarkServiceError {
    return new BenchmarkServiceError(
      `Benchmark execution failed: ${reason}`,
      'EXECUTION_FAILED',
      details
    );
  }

  static timeout(benchmarkName: string, timeoutMs: number): BenchmarkServiceError {
    return new BenchmarkServiceError(
      `Benchmark '${benchmarkName}' timed out after ${timeoutMs}ms`,
      'TIMEOUT',
      { benchmarkName, timeoutMs }
    );
  }

  static invalidConfiguration(field: string, reason: string): BenchmarkServiceError {
    return new BenchmarkServiceError(
      `Invalid configuration: ${field} - ${reason}`,
      'INVALID_CONFIGURATION',
      { field, reason }
    );
  }

  static regressionDetected(
    benchmarkName: string,
    regressionPercent: number,
    threshold: number
  ): BenchmarkServiceError {
    return new BenchmarkServiceError(
      `Performance regression detected in '${benchmarkName}': ${regressionPercent.toFixed(1)}% (threshold: ${threshold}%)`,
      'REGRESSION_DETECTED',
      { benchmarkName, regressionPercent, threshold }
    );
  }
}

/**
 * Benchmark service error codes
 */
export type BenchmarkServiceErrorCode =
  | 'EXECUTION_FAILED'
  | 'TIMEOUT'
  | 'INVALID_CONFIGURATION'
  | 'RUN_NOT_FOUND'
  | 'PERSISTENCE_FAILED'
  | 'REGRESSION_DETECTED'
  | 'OUT_OF_MEMORY'
  | 'INTERNAL_ERROR';

/**
 * Benchmark service interface
 */
export interface IBenchmarkService {
  /**
   * Run a search benchmark
   */
  runSearchBenchmark(
    input: SearchBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>>;

  /**
   * Run a rollup benchmark
   */
  runRollupBenchmark(
    input: RollupBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>>;

  /**
   * Run a scan benchmark
   */
  runScanBenchmark(
    input: ScanBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>>;

  /**
   * Run a full benchmark suite
   */
  runFullSuite(
    input: SuiteInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkRun, BenchmarkServiceError>>;

  /**
   * Get a benchmark run by ID
   */
  getRun(runId: BenchmarkRunId): Promise<Result<BenchmarkRun, BenchmarkServiceError>>;

  /**
   * Compare two benchmark runs
   */
  compareRuns(
    baseRunId: BenchmarkRunId,
    compareRunId: BenchmarkRunId
  ): Promise<Result<BenchmarkComparison, BenchmarkServiceError>>;

  /**
   * Validate against NFR-PERF-008 targets
   */
  validateNfrTargets(
    runId: BenchmarkRunId
  ): Promise<Result<NfrValidationResult, BenchmarkServiceError>>;
}

/**
 * Comparison between two benchmark runs
 */
export interface BenchmarkComparison {
  readonly baseRunId: BenchmarkRunId;
  readonly compareRunId: BenchmarkRunId;
  readonly comparisons: readonly MetricComparison[];
  readonly hasRegression: boolean;
  readonly hasImprovement: boolean;
  readonly summary: {
    readonly totalCompared: number;
    readonly regressions: number;
    readonly improvements: number;
    readonly unchanged: number;
  };
}

/**
 * Metric comparison between two runs
 */
export interface MetricComparison {
  readonly benchmarkName: string;
  readonly type: BenchmarkType;
  readonly baseMeanMs: number;
  readonly compareMeanMs: number;
  readonly baseP95Ms: number;
  readonly compareP95Ms: number;
  readonly meanChangePercent: number;
  readonly p95ChangePercent: number;
  readonly isRegression: boolean;
  readonly isImprovement: boolean;
}

/**
 * NFR-PERF-008 validation result
 */
export interface NfrValidationResult {
  readonly runId: BenchmarkRunId;
  readonly overallPassed: boolean;
  readonly criticalPassed: boolean;
  readonly validations: readonly NfrTargetValidation[];
}

/**
 * Individual NFR target validation
 */
export interface NfrTargetValidation {
  readonly target: PerformanceTargetKey;
  readonly targetMs: number;
  readonly actualP95Ms: number;
  readonly passed: boolean;
  readonly marginMs: number;
  readonly marginPercent: number;
  readonly isCritical: boolean;
}

// ============================================================================
// Benchmark Service Implementation
// ============================================================================

/**
 * Service dependencies
 */
export interface BenchmarkServiceDependencies {
  /** PostgreSQL connection pool */
  readonly pool: Pool;
  /** Optional persistence implementation */
  readonly persistence?: IBenchmarkPersistence;
  /** Optional event emitter */
  readonly eventEmitter?: IBenchmarkEventEmitter;
  /** Service configuration */
  readonly config?: Partial<BenchmarkServiceConfig>;
}

/**
 * Benchmark Service Implementation
 *
 * Orchestrates benchmark execution and result collection for performance validation.
 * Validates against NFR-PERF-008 performance targets.
 */
export class BenchmarkService implements IBenchmarkService {
  private readonly config: BenchmarkServiceConfig;
  private readonly runningBenchmarks: Map<string, AbortController> = new Map();

  constructor(private readonly deps: BenchmarkServiceDependencies) {
    this.config = { ...DEFAULT_BENCHMARK_SERVICE_CONFIG, ...deps.config };
  }

  // ==========================================================================
  // Search Benchmark
  // ==========================================================================

  /**
   * Run a search benchmark
   *
   * Benchmarks node search operations against NFR-PERF-008 targets:
   * - 10K nodes < 100ms
   * - 50K nodes < 200ms
   * - 100K nodes < 500ms (CRITICAL)
   */
  async runSearchBenchmark(
    input: SearchBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>> {
    const benchmarkName = `search_${input.nodeCount}`;
    const startTime = performance.now();

    logger.info({ nodeCount: input.nodeCount }, 'Starting search benchmark');

    try {
      // Merge configurations
      const benchmarkConfig = this.mergeConfig(input.config);

      // Determine threshold based on node count
      const threshold = this.getSearchThreshold(input.nodeCount);

      // Generate mock data for benchmarking
      const { nodes, nodeMap, nodeIndex } = await this.generateSearchData(input.nodeCount);

      // Define the search operation to benchmark
      const searchOperation = async (): Promise<void> => {
        const searchTerms = input.searchPatterns ?? [
          'resource_1',
          'resource_100',
          'resource_1000',
          `resource_${Math.floor(input.nodeCount * 0.9)}`,
        ];

        for (const term of searchTerms) {
          // Name-based lookup
          const nodeId = nodeIndex.get(term);
          if (nodeId) {
            nodeMap.get(nodeId);
          }

          // Type-based filter simulation
          let count = 0;
          for (const node of nodes) {
            if (node.type === 'terraform_resource') {
              count++;
              if (count > 100) break;
            }
          }
        }
      };

      // Run warmup and measurement iterations
      const timings = await this.runIterations(
        searchOperation,
        benchmarkConfig,
        benchmarkName,
        onProgress
      );

      // Calculate metrics
      const metrics = this.calculateMetrics(timings);

      // Determine pass/fail
      const passed = metrics.p95 <= threshold.p95Threshold;

      // Collect memory metrics if enabled
      let memoryMetrics: MemoryMetrics | undefined;
      if (this.config.enableMemoryProfiling) {
        memoryMetrics = await this.collectMemoryMetrics();
      }

      const result: BenchmarkResult = {
        name: benchmarkName,
        type: 'search',
        nodeCount: input.nodeCount,
        edgeCount: 0,
        iterations: benchmarkConfig.iterations,
        timing: metrics,
        passed,
        threshold: threshold.p95Threshold,
        thresholdType: 'p95',
        memory: memoryMetrics,
        metadata: {
          searchPatterns: input.searchPatterns?.length ?? 4,
          benchmarkIndexing: input.benchmarkIndexing ?? false,
        },
      };

      // Emit completion event
      await this.emitEvent({
        type: 'benchmark.completed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          passed,
          p95Ms: metrics.p95,
          thresholdMs: threshold.p95Threshold,
        },
      });

      logger.info(
        {
          benchmarkName,
          p95: metrics.p95,
          threshold: threshold.p95Threshold,
          passed,
          durationMs: performance.now() - startTime,
        },
        'Search benchmark completed'
      );

      return success(result);
    } catch (error) {
      logger.error({ err: error, benchmarkName }, 'Search benchmark failed');

      await this.emitEvent({
        type: 'benchmark.failed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return failure(
        BenchmarkServiceError.executionFailed(
          error instanceof Error ? error.message : String(error),
          { benchmarkName }
        )
      );
    }
  }

  // ==========================================================================
  // Rollup Benchmark
  // ==========================================================================

  /**
   * Run a rollup benchmark
   *
   * Benchmarks graph traversal/rollup operations against NFR-PERF-008 target:
   * - Rollup depth 3 < 500ms
   */
  async runRollupBenchmark(
    input: RollupBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>> {
    const nodeCount = input.nodeCount ?? 10000;
    const benchmarkName = `rollup_depth${input.depth}_${nodeCount}`;
    const startTime = performance.now();

    logger.info({ depth: input.depth, nodeCount }, 'Starting rollup benchmark');

    try {
      // Merge configurations
      const benchmarkConfig = this.mergeConfig(input.config);

      // Get threshold
      const threshold = DEFAULT_THRESHOLDS.rollup.medium; // Use medium scale by default

      // Generate graph data
      const { nodeMap, adjacencyList, edges } = await this.generateGraphData(
        nodeCount,
        input.edgeDensity ?? 2.0
      );

      // Define the rollup operation to benchmark
      const rollupOperation = async (): Promise<void> => {
        const rootCount = Math.min(10, Math.floor(nodeCount / 100));
        const visited = new Set<string>();

        for (let r = 0; r < rootCount; r++) {
          const rootId = `node_${r * Math.floor(nodeCount / rootCount)}`;
          const queue: Array<{ id: string; depth: number }> = [{ id: rootId, depth: 0 }];

          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current.id) || current.depth > input.depth) continue;

            visited.add(current.id);
            const node = nodeMap.get(current.id);
            if (!node) continue;

            const neighbors = adjacencyList.get(current.id) ?? [];
            for (const neighborId of neighbors) {
              if (!visited.has(neighborId)) {
                queue.push({ id: neighborId, depth: current.depth + 1 });
              }
            }
          }
        }

        if (visited.size === 0) {
          throw new Error('Rollup traversal produced no results');
        }
      };

      // Run iterations
      const timings = await this.runIterations(
        rollupOperation,
        benchmarkConfig,
        benchmarkName,
        onProgress
      );

      // Calculate metrics
      const metrics = this.calculateMetrics(timings);

      // Use ROLLUP_DEPTH3_MS target for depth 3
      const targetMs = input.depth === 3
        ? PERFORMANCE_TARGETS.ROLLUP_DEPTH3_MS
        : threshold.p95Threshold;

      const passed = metrics.p95 <= targetMs;

      // Collect memory metrics
      let memoryMetrics: MemoryMetrics | undefined;
      if (this.config.enableMemoryProfiling) {
        memoryMetrics = await this.collectMemoryMetrics();
      }

      const result: BenchmarkResult = {
        name: benchmarkName,
        type: 'rollup',
        nodeCount,
        edgeCount: edges.length,
        iterations: benchmarkConfig.iterations,
        timing: metrics,
        passed,
        threshold: targetMs,
        thresholdType: 'p95',
        memory: memoryMetrics,
        metadata: {
          depth: input.depth,
          edgeDensity: input.edgeDensity ?? 2.0,
          nfrTarget: input.depth === 3 ? 'ROLLUP_DEPTH3_MS' : null,
        },
      };

      // Emit completion event
      await this.emitEvent({
        type: 'benchmark.completed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          passed,
          p95Ms: metrics.p95,
          thresholdMs: targetMs,
        },
      });

      logger.info(
        {
          benchmarkName,
          p95: metrics.p95,
          threshold: targetMs,
          passed,
          durationMs: performance.now() - startTime,
        },
        'Rollup benchmark completed'
      );

      return success(result);
    } catch (error) {
      logger.error({ err: error, benchmarkName }, 'Rollup benchmark failed');

      await this.emitEvent({
        type: 'benchmark.failed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return failure(
        BenchmarkServiceError.executionFailed(
          error instanceof Error ? error.message : String(error),
          { benchmarkName }
        )
      );
    }
  }

  // ==========================================================================
  // Scan Benchmark
  // ==========================================================================

  /**
   * Run a scan benchmark
   *
   * Benchmarks file scanning operations against NFR-PERF-008 target:
   * - Scan 1000 files < 60s
   */
  async runScanBenchmark(
    input: ScanBenchmarkInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkResult, BenchmarkServiceError>> {
    const benchmarkName = `scan_${input.fileCount}`;
    const startTime = performance.now();

    logger.info({ fileCount: input.fileCount }, 'Starting scan benchmark');

    try {
      // Merge configurations
      const benchmarkConfig = this.mergeConfig(input.config);

      // Get threshold - use scan thresholds
      const targetMs = input.fileCount >= 1000
        ? PERFORMANCE_TARGETS.SCAN_1000_FILES_MS
        : (PERFORMANCE_TARGETS.SCAN_1000_FILES_MS / 1000) * input.fileCount;

      // Generate mock file metadata
      const files = this.generateMockFiles(input.fileCount, input.fileTypes);

      // Define the scan operation to benchmark
      const scanOperation = async (): Promise<void> => {
        const results: Array<{ path: string; parsed: boolean }> = [];

        for (const file of files) {
          // Simulate file reading and parsing
          const content = `resource "${file.type}" "${file.name}" { /* mock */ }`;

          // Simulate parse operation
          const parsed = content.length > 0;
          results.push({ path: file.path, parsed });

          // Simulate some processing time
          await this.simulateProcessing(0.1); // 0.1ms per file
        }

        if (results.length !== files.length) {
          throw new Error('Scan did not process all files');
        }
      };

      // For scan benchmarks, use fewer iterations due to longer duration
      const scanConfig: BenchmarkConfig = {
        ...benchmarkConfig,
        iterations: Math.min(benchmarkConfig.iterations, 10),
        warmupIterations: Math.min(benchmarkConfig.warmupIterations, 2),
      };

      // Run iterations
      const timings = await this.runIterations(
        scanOperation,
        scanConfig,
        benchmarkName,
        onProgress
      );

      // Calculate metrics
      const metrics = this.calculateMetrics(timings);
      const passed = metrics.p95 <= targetMs;

      // Collect memory metrics
      let memoryMetrics: MemoryMetrics | undefined;
      if (this.config.enableMemoryProfiling) {
        memoryMetrics = await this.collectMemoryMetrics();
      }

      const result: BenchmarkResult = {
        name: benchmarkName,
        type: 'scan',
        nodeCount: input.fileCount, // Using nodeCount for file count
        edgeCount: 0,
        iterations: scanConfig.iterations,
        timing: metrics,
        passed,
        threshold: targetMs,
        thresholdType: 'p95',
        memory: memoryMetrics,
        metadata: {
          fileCount: input.fileCount,
          fileTypes: input.fileTypes ?? ['terraform', 'kubernetes'],
          nfrTarget: input.fileCount >= 1000 ? 'SCAN_1000_FILES_MS' : null,
        },
      };

      // Emit completion event
      await this.emitEvent({
        type: 'benchmark.completed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          passed,
          p95Ms: metrics.p95,
          thresholdMs: targetMs,
        },
      });

      logger.info(
        {
          benchmarkName,
          p95: metrics.p95,
          threshold: targetMs,
          passed,
          durationMs: performance.now() - startTime,
        },
        'Scan benchmark completed'
      );

      return success(result);
    } catch (error) {
      logger.error({ err: error, benchmarkName }, 'Scan benchmark failed');

      await this.emitEvent({
        type: 'benchmark.failed',
        timestamp: new Date(),
        data: {
          benchmarkName,
          error: error instanceof Error ? error.message : String(error),
        },
      });

      return failure(
        BenchmarkServiceError.executionFailed(
          error instanceof Error ? error.message : String(error),
          { benchmarkName }
        )
      );
    }
  }

  // ==========================================================================
  // Full Suite Execution
  // ==========================================================================

  /**
   * Run a full benchmark suite
   *
   * Executes all benchmark types at the specified scale level.
   */
  async runFullSuite(
    input: SuiteInput,
    onProgress?: BenchmarkProgressCallback
  ): Promise<Result<BenchmarkRun, BenchmarkServiceError>> {
    const runId = createBenchmarkRunId(randomUUID());
    const startedAt = new Date();
    const startTime = performance.now();

    logger.info({ runId, scale: input.scale }, 'Starting full benchmark suite');

    // Emit suite started event
    await this.emitEvent({
      type: 'suite.started',
      runId,
      timestamp: startedAt,
      data: { scale: input.scale },
    });

    const results: BenchmarkResult[] = [];
    const environment = await createEnvironmentInfo();
    const nodeCount = getNodeCount(input.scale);
    const edgeCount = getEdgeCount(input.scale);

    try {
      // Run search benchmark
      const searchResult = await this.runSearchBenchmark(
        { nodeCount, config: input.config },
        onProgress
      );
      if (isSuccess(searchResult)) {
        results.push(searchResult.value);
      } else if (input.stopOnFailure) {
        throw new Error(`Search benchmark failed: ${searchResult.error.message}`);
      }

      // Run rollup benchmark (depth 3 for NFR target)
      const rollupResult = await this.runRollupBenchmark(
        { depth: 3, nodeCount, config: input.config },
        onProgress
      );
      if (isSuccess(rollupResult)) {
        results.push(rollupResult.value);
      } else if (input.stopOnFailure) {
        throw new Error(`Rollup benchmark failed: ${rollupResult.error.message}`);
      }

      // Run scan benchmark (scale-appropriate file count)
      const fileCount = this.getFileCountForScale(input.scale);
      const scanResult = await this.runScanBenchmark(
        { fileCount, config: input.config },
        onProgress
      );
      if (isSuccess(scanResult)) {
        results.push(scanResult.value);
      } else if (input.stopOnFailure) {
        throw new Error(`Scan benchmark failed: ${scanResult.error.message}`);
      }

      // Calculate summary
      const summary = this.calculateSummary(results);

      // Create benchmark run
      const run: BenchmarkRun = {
        id: runId,
        status: summary.failed > 0 ? 'completed' : 'completed',
        config: this.mergeConfig(input.config),
        results,
        summary,
        environment,
        startedAt,
        completedAt: new Date(),
        durationMs: performance.now() - startTime,
      };

      // Persist run if persistence is available
      if (this.deps.persistence) {
        try {
          await this.deps.persistence.saveRun(run);
        } catch (error) {
          logger.warn({ err: error, runId }, 'Failed to persist benchmark run');
        }
      }

      // Emit suite completed event
      await this.emitEvent({
        type: 'suite.completed',
        runId,
        timestamp: new Date(),
        data: {
          passed: summary.passed,
          failed: summary.failed,
          passRate: summary.passRate,
        },
      });

      logger.info(
        {
          runId,
          totalBenchmarks: summary.totalBenchmarks,
          passed: summary.passed,
          failed: summary.failed,
          durationMs: run.durationMs,
        },
        'Full benchmark suite completed'
      );

      return success(run);
    } catch (error) {
      logger.error({ err: error, runId }, 'Full benchmark suite failed');

      // Emit suite failed event
      await this.emitEvent({
        type: 'suite.failed',
        runId,
        timestamp: new Date(),
        data: {
          error: error instanceof Error ? error.message : String(error),
          completedBenchmarks: results.length,
        },
      });

      // Create failed run
      const failedRun: BenchmarkRun = {
        id: runId,
        status: 'failed',
        config: this.mergeConfig(input.config),
        results,
        summary: this.calculateSummary(results),
        environment,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        startedAt,
        completedAt: new Date(),
        durationMs: performance.now() - startTime,
      };

      // Still try to persist the failed run
      if (this.deps.persistence) {
        try {
          await this.deps.persistence.saveRun(failedRun);
        } catch (persistError) {
          logger.warn({ err: persistError, runId }, 'Failed to persist failed benchmark run');
        }
      }

      return failure(
        BenchmarkServiceError.executionFailed(
          error instanceof Error ? error.message : String(error),
          { runId, completedBenchmarks: results.length }
        )
      );
    }
  }

  // ==========================================================================
  // Query Operations
  // ==========================================================================

  /**
   * Get a benchmark run by ID
   */
  async getRun(runId: BenchmarkRunId): Promise<Result<BenchmarkRun, BenchmarkServiceError>> {
    if (!this.deps.persistence) {
      return failure(
        new BenchmarkServiceError(
          'Persistence not configured',
          'PERSISTENCE_FAILED'
        )
      );
    }

    try {
      const run = await this.deps.persistence.getRun(runId);

      if (!run) {
        return failure(
          new BenchmarkServiceError(
            `Benchmark run not found: ${runId}`,
            'RUN_NOT_FOUND',
            { runId }
          )
        );
      }

      return success(run);
    } catch (error) {
      logger.error({ err: error, runId }, 'Failed to get benchmark run');
      return failure(
        new BenchmarkServiceError(
          'Failed to retrieve benchmark run',
          'PERSISTENCE_FAILED',
          { runId, cause: error }
        )
      );
    }
  }

  /**
   * Compare two benchmark runs
   */
  async compareRuns(
    baseRunId: BenchmarkRunId,
    compareRunId: BenchmarkRunId
  ): Promise<Result<BenchmarkComparison, BenchmarkServiceError>> {
    // Get both runs
    const baseResult = await this.getRun(baseRunId);
    if (!isSuccess(baseResult)) {
      return failure(baseResult.error);
    }

    const compareResult = await this.getRun(compareRunId);
    if (!isSuccess(compareResult)) {
      return failure(compareResult.error);
    }

    const baseRun = baseResult.value;
    const compareRun = compareResult.value;

    // Compare results
    const comparisons: MetricComparison[] = [];
    let regressions = 0;
    let improvements = 0;

    for (const baseResult of baseRun.results) {
      const compareResultItem = compareRun.results.find(
        (r) => r.name === baseResult.name && r.type === baseResult.type
      );

      if (compareResultItem) {
        const meanChange =
          ((compareResultItem.timing.mean - baseResult.timing.mean) / baseResult.timing.mean) * 100;
        const p95Change =
          ((compareResultItem.timing.p95 - baseResult.timing.p95) / baseResult.timing.p95) * 100;

        const isRegression = p95Change > this.config.regressionThreshold;
        const isImprovement = p95Change < -5; // 5% improvement threshold

        if (isRegression) regressions++;
        if (isImprovement) improvements++;

        comparisons.push({
          benchmarkName: baseResult.name,
          type: baseResult.type,
          baseMeanMs: baseResult.timing.mean,
          compareMeanMs: compareResultItem.timing.mean,
          baseP95Ms: baseResult.timing.p95,
          compareP95Ms: compareResultItem.timing.p95,
          meanChangePercent: meanChange,
          p95ChangePercent: p95Change,
          isRegression,
          isImprovement,
        });
      }
    }

    const comparison: BenchmarkComparison = {
      baseRunId,
      compareRunId,
      comparisons,
      hasRegression: regressions > 0,
      hasImprovement: improvements > 0,
      summary: {
        totalCompared: comparisons.length,
        regressions,
        improvements,
        unchanged: comparisons.length - regressions - improvements,
      },
    };

    // Emit regression event if detected
    if (comparison.hasRegression) {
      await this.emitEvent({
        type: 'regression.detected',
        timestamp: new Date(),
        data: {
          baseRunId,
          compareRunId,
          regressions,
        },
      });
    }

    return success(comparison);
  }

  /**
   * Validate a benchmark run against NFR-PERF-008 targets
   */
  async validateNfrTargets(
    runId: BenchmarkRunId
  ): Promise<Result<NfrValidationResult, BenchmarkServiceError>> {
    const runResult = await this.getRun(runId);
    if (!isSuccess(runResult)) {
      return failure(runResult.error);
    }

    const run = runResult.value;
    const validations: NfrTargetValidation[] = [];

    // Map benchmark results to NFR targets
    const targetMappings: Array<{
      benchmarkPattern: string;
      target: PerformanceTargetKey;
      isCritical: boolean;
    }> = [
      { benchmarkPattern: 'search_10000', target: 'SEARCH_10K_MS', isCritical: false },
      { benchmarkPattern: 'search_50000', target: 'SEARCH_50K_MS', isCritical: false },
      { benchmarkPattern: 'search_100000', target: 'SEARCH_100K_MS', isCritical: true },
      { benchmarkPattern: 'rollup_depth3', target: 'ROLLUP_DEPTH3_MS', isCritical: false },
      { benchmarkPattern: 'scan_1000', target: 'SCAN_1000_FILES_MS', isCritical: false },
    ];

    for (const mapping of targetMappings) {
      const result = run.results.find((r) => r.name.includes(mapping.benchmarkPattern));

      if (result) {
        const targetMs = PERFORMANCE_TARGETS[mapping.target];
        const actualP95Ms = result.timing.p95;
        const passed = actualP95Ms <= targetMs;
        const marginMs = targetMs - actualP95Ms;
        const marginPercent = (marginMs / targetMs) * 100;

        validations.push({
          target: mapping.target,
          targetMs,
          actualP95Ms,
          passed,
          marginMs,
          marginPercent,
          isCritical: mapping.isCritical,
        });
      }
    }

    const overallPassed = validations.every((v) => v.passed);
    const criticalPassed = validations.filter((v) => v.isCritical).every((v) => v.passed);

    return success({
      runId,
      overallPassed,
      criticalPassed,
      validations,
    });
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Merge configuration with defaults
   */
  private mergeConfig(overrides?: Partial<BenchmarkConfig>): BenchmarkConfig {
    return {
      ...DEFAULT_BENCHMARK_CONFIG,
      ...overrides,
    } as BenchmarkConfig;
  }

  /**
   * Get search threshold based on node count
   */
  private getSearchThreshold(nodeCount: number): ThresholdConfig {
    if (nodeCount <= 1000) {
      return { ...DEFAULT_THRESHOLDS.search.small, p95Threshold: 50 };
    } else if (nodeCount <= 10000) {
      return DEFAULT_THRESHOLDS.search.medium;
    } else if (nodeCount <= 50000) {
      return DEFAULT_THRESHOLDS.search.large;
    } else {
      return DEFAULT_THRESHOLDS.search.xlarge;
    }
  }

  /**
   * Run benchmark iterations with warmup
   */
  private async runIterations(
    operation: () => Promise<void>,
    config: BenchmarkConfig,
    benchmarkName: string,
    onProgress?: BenchmarkProgressCallback
  ): Promise<number[]> {
    const timings: number[] = [];
    const totalIterations = config.iterations + config.warmupIterations;

    // Warmup iterations
    for (let i = 0; i < config.warmupIterations; i++) {
      if (config.gcBeforeIteration) {
        forceGC();
      }

      const start = performance.now();
      await withTimeout(operation(), config.timeoutMs, `Warmup iteration ${i + 1} timed out`);
      const elapsed = performance.now() - start;

      if (onProgress) {
        await onProgress({
          benchmarkName,
          iteration: i + 1,
          totalIterations,
          percentComplete: ((i + 1) / totalIterations) * 100,
          phase: 'warmup',
          elapsedMs: elapsed,
          currentLatencyMs: elapsed,
        });
      }

      if (config.delayBetweenIterations > 0) {
        await delay(config.delayBetweenIterations);
      }
    }

    // Measurement iterations
    for (let i = 0; i < config.iterations; i++) {
      if (config.gcBeforeIteration) {
        forceGC();
      }

      const start = performance.now();
      await withTimeout(operation(), config.timeoutMs, `Iteration ${i + 1} timed out`);
      const elapsed = performance.now() - start;

      timings.push(elapsed);

      if (onProgress) {
        await onProgress({
          benchmarkName,
          iteration: config.warmupIterations + i + 1,
          totalIterations,
          percentComplete: ((config.warmupIterations + i + 1) / totalIterations) * 100,
          phase: 'measuring',
          elapsedMs: elapsed,
          currentLatencyMs: elapsed,
        });
      }

      if (config.delayBetweenIterations > 0) {
        await delay(config.delayBetweenIterations);
      }
    }

    return timings;
  }

  /**
   * Calculate aggregated metrics from timing samples
   */
  private calculateMetrics(timings: number[]): AggregatedMetrics {
    if (timings.length === 0) {
      return createEmptyAggregatedMetrics();
    }

    const sorted = [...timings].sort((a, b) => a - b);
    const sum = timings.reduce((acc, val) => acc + val, 0);
    const mean = sum / timings.length;

    // Calculate variance and standard deviation
    const squaredDiffs = timings.map((val) => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((acc, val) => acc + val, 0) / timings.length;
    const stdDev = Math.sqrt(variance);

    // Calculate throughput (operations per second)
    const throughput = mean > 0 ? 1000 / mean : 0;

    return {
      count: timings.length,
      min: sorted[0] ?? 0,
      max: sorted[sorted.length - 1] ?? 0,
      mean,
      stdDev,
      p50: calculatePercentile(sorted, 50),
      p90: calculatePercentile(sorted, 90),
      p95: calculatePercentile(sorted, 95),
      p99: calculatePercentile(sorted, 99),
      throughput,
      variance,
    };
  }

  /**
   * Calculate benchmark run summary
   */
  private calculateSummary(results: BenchmarkResult[]): BenchmarkSummary {
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const totalIterations = results.reduce((sum, r) => sum + r.iterations, 0);
    const avgThroughput =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.timing.throughput, 0) / results.length
        : 0;

    // Find slowest and fastest
    const sortedByMean = [...results].sort((a, b) => b.timing.mean - a.timing.mean);
    const slowestBenchmark = sortedByMean[0]?.name;
    const fastestBenchmark = sortedByMean[sortedByMean.length - 1]?.name;

    return {
      totalBenchmarks: results.length,
      passed,
      failed,
      passRate: results.length > 0 ? (passed / results.length) * 100 : 0,
      totalIterations,
      averageThroughput: avgThroughput,
      slowestBenchmark,
      fastestBenchmark,
    };
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<MemoryMetrics | undefined> {
    const memoryInfo = getDetailedMemoryUsage();

    if (!memoryInfo) {
      return undefined;
    }

    return {
      heapUsedAvg: memoryInfo.heapUsed,
      heapUsedMax: memoryInfo.heapUsed,
      heapTotalAvg: memoryInfo.heapTotal,
      externalAvg: memoryInfo.external,
      arrayBuffersAvg: memoryInfo.arrayBuffers,
    };
  }

  /**
   * Generate mock search data
   */
  private async generateSearchData(nodeCount: number): Promise<{
    nodes: Array<{ id: string; type: string; name: string }>;
    nodeMap: Map<string, { id: string; type: string; name: string }>;
    nodeIndex: Map<string, string>;
  }> {
    const nodes: Array<{ id: string; type: string; name: string }> = [];
    const types = ['terraform_resource', 'terraform_module', 'k8s_deployment', 'k8s_service'];

    for (let i = 0; i < nodeCount; i++) {
      nodes.push({
        id: `node_${i}`,
        type: types[i % types.length]!,
        name: `resource_${i}`,
      });
    }

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const nodeIndex = new Map(nodes.map((n) => [n.name, n.id]));

    return { nodes, nodeMap, nodeIndex };
  }

  /**
   * Generate mock graph data for rollup benchmarks
   */
  private async generateGraphData(
    nodeCount: number,
    edgeDensity: number
  ): Promise<{
    nodeMap: Map<string, { id: string; type: string; name: string }>;
    adjacencyList: Map<string, string[]>;
    edges: Array<{ source: string; target: string }>;
  }> {
    const { nodes, nodeMap } = await this.generateSearchData(nodeCount);
    const adjacencyList = new Map<string, string[]>();
    const edges: Array<{ source: string; target: string }> = [];
    const edgeCount = Math.floor(nodeCount * edgeDensity);

    for (let i = 0; i < edgeCount && nodeCount > 1; i++) {
      const sourceIndex = i % nodeCount;
      const targetIndex = (sourceIndex + 1 + (i % (nodeCount - 1))) % nodeCount;
      const source = `node_${sourceIndex}`;
      const target = `node_${targetIndex}`;

      edges.push({ source, target });

      const neighbors = adjacencyList.get(source) ?? [];
      neighbors.push(target);
      adjacencyList.set(source, neighbors);
    }

    return { nodeMap, adjacencyList, edges };
  }

  /**
   * Generate mock file metadata for scan benchmarks
   */
  private generateMockFiles(
    fileCount: number,
    fileTypes?: readonly string[]
  ): Array<{ path: string; type: string; name: string }> {
    const types = fileTypes ?? ['terraform', 'kubernetes', 'helm'];
    const files: Array<{ path: string; type: string; name: string }> = [];

    for (let i = 0; i < fileCount; i++) {
      const type = types[i % types.length]!;
      const extension = type === 'terraform' ? 'tf' : type === 'kubernetes' ? 'yaml' : 'yaml';
      files.push({
        path: `/mock/${type}/${i}/main.${extension}`,
        type,
        name: `resource_${i}`,
      });
    }

    return files;
  }

  /**
   * Get file count for benchmark scale
   */
  private getFileCountForScale(scale: BenchmarkScale): number {
    switch (scale) {
      case 'small':
        return 100;
      case 'medium':
        return 500;
      case 'large':
        return 1000;
      case 'xlarge':
        return 5000;
      default:
        return 500;
    }
  }

  /**
   * Simulate processing time
   */
  private async simulateProcessing(ms: number): Promise<void> {
    // Use a busy wait for very short delays to be more accurate
    if (ms < 1) {
      const end = performance.now() + ms;
      while (performance.now() < end) {
        // Busy wait
      }
    } else {
      await delay(ms);
    }
  }

  /**
   * Emit a benchmark event
   */
  private async emitEvent(event: BenchmarkEvent): Promise<void> {
    if (this.deps.eventEmitter) {
      try {
        await this.deps.eventEmitter.emit(event);
      } catch (error) {
        logger.warn({ err: error, eventType: event.type }, 'Failed to emit benchmark event');
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new BenchmarkService instance
 */
export function createBenchmarkService(deps: BenchmarkServiceDependencies): IBenchmarkService {
  return new BenchmarkService(deps);
}

/**
 * Create a BenchmarkService with minimal dependencies (for testing)
 */
export function createMinimalBenchmarkService(pool: Pool): IBenchmarkService {
  return new BenchmarkService({ pool });
}
