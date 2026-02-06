/**
 * Performance Test Service
 * @module e2e/services/performance-test-service
 *
 * Service for E2E performance testing:
 * - Search benchmark execution
 * - Rollup performance tests
 * - Memory profiling
 * - Result reporting and comparison
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #22 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure, isSuccess } from '../../api/src/types/utility.js';
import type { TenantId, ScanId, RepositoryId } from '../../api/src/types/entities.js';
import type { TestDatabase } from '../domain/test-database.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Performance test service configuration
 */
export interface PerformanceTestServiceConfig {
  /** Base URL for the API */
  readonly apiBaseUrl: string;
  /** Default number of iterations for benchmarks */
  readonly defaultIterations: number;
  /** Warmup iterations (not counted in results) */
  readonly warmupIterations: number;
  /** Maximum benchmark duration in milliseconds */
  readonly maxBenchmarkDuration: number;
  /** Memory sampling interval in milliseconds */
  readonly memorySampleInterval: number;
  /** P99 percentile threshold */
  readonly p99Threshold: number;
  /** Verbose logging */
  readonly verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceTestServiceConfig = {
  apiBaseUrl: 'http://localhost:3000',
  defaultIterations: 100,
  warmupIterations: 5,
  maxBenchmarkDuration: 60000, // 1 minute
  memorySampleInterval: 100,
  p99Threshold: 0.99,
  verbose: false,
};

/**
 * Benchmark input
 */
export interface BenchmarkInput {
  /** Benchmark name */
  readonly name: string;
  /** Description */
  readonly description?: string;
  /** Number of iterations */
  readonly iterations?: number;
  /** Warmup iterations */
  readonly warmupIterations?: number;
  /** Target operation */
  readonly operation: BenchmarkOperation;
  /** Performance thresholds */
  readonly thresholds?: BenchmarkThresholds;
  /** Authentication token */
  readonly authToken: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
}

/**
 * Benchmark operation
 */
export type BenchmarkOperation =
  | SearchBenchmarkOperation
  | RollupBenchmarkOperation
  | GraphQueryBenchmarkOperation
  | ApiBenchmarkOperation
  | CustomBenchmarkOperation;

/**
 * Search benchmark operation
 */
export interface SearchBenchmarkOperation {
  readonly type: 'search';
  readonly query: string;
  readonly filters?: Record<string, unknown>;
  readonly limit?: number;
}

/**
 * Rollup benchmark operation
 */
export interface RollupBenchmarkOperation {
  readonly type: 'rollup';
  readonly scanId: ScanId;
  readonly strategy?: 'full' | 'incremental';
}

/**
 * Graph query benchmark operation
 */
export interface GraphQueryBenchmarkOperation {
  readonly type: 'graphQuery';
  readonly scanId: ScanId;
  readonly queryType: 'dependencies' | 'dependents' | 'blastRadius' | 'path';
  readonly nodeId?: string;
  readonly depth?: number;
}

/**
 * API benchmark operation
 */
export interface ApiBenchmarkOperation {
  readonly type: 'api';
  readonly method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

/**
 * Custom benchmark operation
 */
export interface CustomBenchmarkOperation {
  readonly type: 'custom';
  readonly fn: () => Promise<void>;
}

/**
 * Benchmark thresholds
 */
export interface BenchmarkThresholds {
  /** Maximum mean latency in milliseconds */
  readonly maxMeanMs?: number;
  /** Maximum P50 latency in milliseconds */
  readonly maxP50Ms?: number;
  /** Maximum P95 latency in milliseconds */
  readonly maxP95Ms?: number;
  /** Maximum P99 latency in milliseconds */
  readonly maxP99Ms?: number;
  /** Maximum memory increase in MB */
  readonly maxMemoryIncreaseMb?: number;
  /** Minimum throughput (operations per second) */
  readonly minThroughput?: number;
}

/**
 * Benchmark result
 */
export interface BenchmarkResult {
  readonly name: string;
  readonly passed: boolean;
  readonly iterations: number;
  readonly warmupIterations: number;
  readonly statistics: LatencyStatistics;
  readonly memoryProfile?: MemoryProfile;
  readonly thresholdViolations: ReadonlyArray<ThresholdViolation>;
  readonly rawLatencies: ReadonlyArray<number>;
  readonly errors: ReadonlyArray<BenchmarkError>;
  readonly durationMs: number;
}

/**
 * Latency statistics
 */
export interface LatencyStatistics {
  readonly min: number;
  readonly max: number;
  readonly mean: number;
  readonly median: number;
  readonly stdDev: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly p95: number;
  readonly p99: number;
  readonly throughput: number; // operations per second
}

/**
 * Memory profile
 */
export interface MemoryProfile {
  readonly initialHeapUsedMb: number;
  readonly finalHeapUsedMb: number;
  readonly peakHeapUsedMb: number;
  readonly heapIncreaseMb: number;
  readonly samples: ReadonlyArray<MemorySample>;
  readonly gcCount?: number;
}

/**
 * Memory sample
 */
export interface MemorySample {
  readonly timestamp: number;
  readonly heapUsedMb: number;
  readonly heapTotalMb: number;
  readonly externalMb: number;
}

/**
 * Threshold violation
 */
export interface ThresholdViolation {
  readonly metric: string;
  readonly threshold: number;
  readonly actual: number;
  readonly severity: 'warning' | 'error';
}

/**
 * Benchmark error
 */
export interface BenchmarkError {
  readonly iteration: number;
  readonly message: string;
  readonly timestamp: Date;
}

/**
 * Search performance test input
 */
export interface SearchPerformanceTestInput {
  /** Test name */
  readonly name: string;
  /** Scan ID to search within */
  readonly scanId: ScanId;
  /** Search queries to test */
  readonly queries: ReadonlyArray<SearchQuery>;
  /** Performance thresholds */
  readonly thresholds?: BenchmarkThresholds;
  /** Authentication token */
  readonly authToken: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
}

/**
 * Search query
 */
export interface SearchQuery {
  readonly name: string;
  readonly query: string;
  readonly filters?: Record<string, unknown>;
  readonly expectedMinResults?: number;
  readonly expectedMaxResults?: number;
}

/**
 * Search performance test result
 */
export interface SearchPerformanceTestResult {
  readonly passed: boolean;
  readonly name: string;
  readonly queryResults: ReadonlyArray<QueryBenchmarkResult>;
  readonly aggregateStatistics: LatencyStatistics;
  readonly failures: ReadonlyArray<PerformanceTestFailure>;
  readonly durationMs: number;
}

/**
 * Query benchmark result
 */
export interface QueryBenchmarkResult {
  readonly queryName: string;
  readonly passed: boolean;
  readonly statistics: LatencyStatistics;
  readonly resultCount: number;
  readonly meetsExpectations: boolean;
  readonly violations: ReadonlyArray<ThresholdViolation>;
}

/**
 * Rollup performance test input
 */
export interface RollupPerformanceTestInput {
  /** Test name */
  readonly name: string;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** Scans to test rollup on */
  readonly scanIds: ReadonlyArray<ScanId>;
  /** Performance thresholds */
  readonly thresholds?: RollupThresholds;
  /** Authentication token */
  readonly authToken: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
}

/**
 * Rollup-specific thresholds
 */
export interface RollupThresholds extends BenchmarkThresholds {
  /** Maximum rollup duration per node in milliseconds */
  readonly maxMsPerNode?: number;
  /** Maximum rollup duration per edge in milliseconds */
  readonly maxMsPerEdge?: number;
}

/**
 * Rollup performance test result
 */
export interface RollupPerformanceTestResult {
  readonly passed: boolean;
  readonly name: string;
  readonly scanResults: ReadonlyArray<RollupScanResult>;
  readonly aggregateStatistics: LatencyStatistics;
  readonly scalingAnalysis: ScalingAnalysis;
  readonly failures: ReadonlyArray<PerformanceTestFailure>;
  readonly durationMs: number;
}

/**
 * Rollup scan result
 */
export interface RollupScanResult {
  readonly scanId: ScanId;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly msPerNode: number;
  readonly msPerEdge: number;
  readonly violations: ReadonlyArray<ThresholdViolation>;
}

/**
 * Scaling analysis
 */
export interface ScalingAnalysis {
  /** Correlation coefficient for nodes vs duration */
  readonly nodeScalingCorrelation: number;
  /** Correlation coefficient for edges vs duration */
  readonly edgeScalingCorrelation: number;
  /** Estimated complexity */
  readonly estimatedComplexity: 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'unknown';
  /** Linear regression slope (ms per node) */
  readonly linearSlope: number;
}

/**
 * Memory profiling input
 */
export interface MemoryProfilingInput {
  /** Test name */
  readonly name: string;
  /** Operation to profile */
  readonly operation: BenchmarkOperation;
  /** Sampling interval in milliseconds */
  readonly sampleIntervalMs?: number;
  /** Maximum profiling duration */
  readonly maxDurationMs?: number;
  /** Memory thresholds */
  readonly thresholds?: MemoryThresholds;
  /** Authentication token */
  readonly authToken: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
}

/**
 * Memory thresholds
 */
export interface MemoryThresholds {
  /** Maximum heap used in MB */
  readonly maxHeapUsedMb?: number;
  /** Maximum heap increase in MB */
  readonly maxHeapIncreaseMb?: number;
  /** Maximum external memory in MB */
  readonly maxExternalMb?: number;
  /** Detect memory leaks */
  readonly detectLeaks?: boolean;
  /** Leak detection threshold (% increase over baseline) */
  readonly leakThresholdPercent?: number;
}

/**
 * Memory profiling result
 */
export interface MemoryProfilingResult {
  readonly passed: boolean;
  readonly name: string;
  readonly profile: MemoryProfile;
  readonly leakDetected: boolean;
  readonly leakAnalysis?: LeakAnalysis;
  readonly violations: ReadonlyArray<ThresholdViolation>;
  readonly durationMs: number;
}

/**
 * Leak analysis
 */
export interface LeakAnalysis {
  readonly trend: 'increasing' | 'stable' | 'decreasing';
  readonly growthRateMbPerSec: number;
  readonly sustainedGrowthPeriodMs: number;
  readonly confidence: number;
}

/**
 * Performance test failure
 */
export interface PerformanceTestFailure {
  readonly category: 'latency' | 'throughput' | 'memory' | 'error';
  readonly message: string;
  readonly metric?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
}

/**
 * Performance report
 */
export interface PerformanceReport {
  readonly generatedAt: Date;
  readonly environment: EnvironmentInfo;
  readonly benchmarks: ReadonlyArray<BenchmarkResult>;
  readonly summary: ReportSummary;
  readonly comparison?: ReportComparison;
}

/**
 * Environment info
 */
export interface EnvironmentInfo {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly cpuCount: number;
  readonly totalMemoryMb: number;
  readonly freeMemoryMb: number;
}

/**
 * Report summary
 */
export interface ReportSummary {
  readonly totalBenchmarks: number;
  readonly passedBenchmarks: number;
  readonly failedBenchmarks: number;
  readonly totalIterations: number;
  readonly totalDurationMs: number;
  readonly averageLatencyMs: number;
  readonly overallThroughput: number;
}

/**
 * Report comparison
 */
export interface ReportComparison {
  readonly baselineDate: Date;
  readonly latencyChange: number; // percentage
  readonly throughputChange: number; // percentage
  readonly memoryChange: number; // percentage
  readonly regressions: ReadonlyArray<string>;
  readonly improvements: ReadonlyArray<string>;
}

/**
 * Service error
 */
export interface PerformanceTestServiceError {
  readonly code: PerformanceTestServiceErrorCode;
  readonly message: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}

/**
 * Error codes
 */
export type PerformanceTestServiceErrorCode =
  | 'BENCHMARK_FAILED'
  | 'TIMEOUT'
  | 'API_ERROR'
  | 'MEMORY_ERROR'
  | 'ANALYSIS_ERROR'
  | 'INTERNAL_ERROR';

// ============================================================================
// Interface
// ============================================================================

/**
 * Performance test service interface
 */
export interface IPerformanceTestService {
  /**
   * Run a benchmark
   */
  runBenchmark(input: BenchmarkInput): AsyncResult<BenchmarkResult, PerformanceTestServiceError>;

  /**
   * Run search performance tests
   */
  runSearchPerformanceTest(
    input: SearchPerformanceTestInput
  ): AsyncResult<SearchPerformanceTestResult, PerformanceTestServiceError>;

  /**
   * Run rollup performance tests
   */
  runRollupPerformanceTest(
    input: RollupPerformanceTestInput
  ): AsyncResult<RollupPerformanceTestResult, PerformanceTestServiceError>;

  /**
   * Run memory profiling
   */
  runMemoryProfiling(
    input: MemoryProfilingInput
  ): AsyncResult<MemoryProfilingResult, PerformanceTestServiceError>;

  /**
   * Generate performance report
   */
  generateReport(
    results: ReadonlyArray<BenchmarkResult>,
    baseline?: PerformanceReport
  ): Result<PerformanceReport, PerformanceTestServiceError>;

  /**
   * Calculate statistics from latencies
   */
  calculateStatistics(latencies: ReadonlyArray<number>): LatencyStatistics;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Performance test service implementation
 */
export class PerformanceTestService implements IPerformanceTestService {
  private readonly config: PerformanceTestServiceConfig;

  constructor(
    private readonly database?: TestDatabase,
    config?: Partial<PerformanceTestServiceConfig>
  ) {
    this.config = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Run a benchmark
   */
  async runBenchmark(
    input: BenchmarkInput
  ): AsyncResult<BenchmarkResult, PerformanceTestServiceError> {
    const startTime = Date.now();
    const iterations = input.iterations ?? this.config.defaultIterations;
    const warmupIterations = input.warmupIterations ?? this.config.warmupIterations;
    const latencies: number[] = [];
    const errors: BenchmarkError[] = [];
    let memoryProfile: MemoryProfile | undefined;

    try {
      this.log(`Starting benchmark: ${input.name}`, { iterations, warmupIterations });

      // Capture initial memory
      const initialMemory = this.getMemoryUsage();

      // Warmup phase
      for (let i = 0; i < warmupIterations; i++) {
        try {
          await this.executeOperation(input.operation, input.authToken, input.tenantId);
        } catch (error) {
          // Ignore warmup errors
          this.log('Warmup error (ignored)', { iteration: i, error: String(error) });
        }
      }

      // Force GC if available
      this.forceGC();

      // Benchmark phase
      const benchmarkStart = Date.now();

      for (let i = 0; i < iterations; i++) {
        // Check timeout
        if (Date.now() - benchmarkStart > this.config.maxBenchmarkDuration) {
          this.log('Benchmark timeout', { completedIterations: i });
          break;
        }

        const iterationStart = performance.now();

        try {
          await this.executeOperation(input.operation, input.authToken, input.tenantId);
          const duration = performance.now() - iterationStart;
          latencies.push(duration);
        } catch (error) {
          errors.push({
            iteration: i,
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          });
        }
      }

      // Capture final memory
      const finalMemory = this.getMemoryUsage();

      // Calculate memory profile
      memoryProfile = {
        initialHeapUsedMb: initialMemory.heapUsedMb,
        finalHeapUsedMb: finalMemory.heapUsedMb,
        peakHeapUsedMb: Math.max(initialMemory.heapUsedMb, finalMemory.heapUsedMb),
        heapIncreaseMb: finalMemory.heapUsedMb - initialMemory.heapUsedMb,
        samples: [
          { timestamp: benchmarkStart, ...initialMemory },
          { timestamp: Date.now(), ...finalMemory },
        ],
      };

      // Calculate statistics
      const statistics = this.calculateStatistics(latencies);

      // Check thresholds
      const violations = this.checkThresholds(statistics, memoryProfile, input.thresholds);

      const durationMs = Date.now() - startTime;

      return success({
        name: input.name,
        passed: violations.length === 0 && errors.length === 0,
        iterations: latencies.length,
        warmupIterations,
        statistics,
        memoryProfile,
        thresholdViolations: violations,
        rawLatencies: latencies,
        errors,
        durationMs,
      });
    } catch (error) {
      return failure({
        code: 'BENCHMARK_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Run search performance tests
   */
  async runSearchPerformanceTest(
    input: SearchPerformanceTestInput
  ): AsyncResult<SearchPerformanceTestResult, PerformanceTestServiceError> {
    const startTime = Date.now();
    const queryResults: QueryBenchmarkResult[] = [];
    const failures: PerformanceTestFailure[] = [];
    const allLatencies: number[] = [];

    try {
      for (const query of input.queries) {
        const benchmarkInput: BenchmarkInput = {
          name: `Search: ${query.name}`,
          operation: {
            type: 'search',
            query: query.query,
            filters: query.filters,
          },
          thresholds: input.thresholds,
          authToken: input.authToken,
          tenantId: input.tenantId,
          iterations: 50, // Fewer iterations for search
        };

        const result = await this.runBenchmark(benchmarkInput);

        if (result.success) {
          allLatencies.push(...result.value.rawLatencies);

          // Check result count expectations
          let meetsExpectations = true;
          const resultCount = await this.getSearchResultCount(
            input.scanId,
            query.query,
            query.filters,
            input.authToken,
            input.tenantId
          );

          if (query.expectedMinResults !== undefined && resultCount < query.expectedMinResults) {
            meetsExpectations = false;
            failures.push({
              category: 'error',
              message: `Query "${query.name}" returned ${resultCount} results, expected at least ${query.expectedMinResults}`,
              expected: query.expectedMinResults,
              actual: resultCount,
            });
          }

          if (query.expectedMaxResults !== undefined && resultCount > query.expectedMaxResults) {
            meetsExpectations = false;
            failures.push({
              category: 'error',
              message: `Query "${query.name}" returned ${resultCount} results, expected at most ${query.expectedMaxResults}`,
              expected: query.expectedMaxResults,
              actual: resultCount,
            });
          }

          queryResults.push({
            queryName: query.name,
            passed: result.value.passed && meetsExpectations,
            statistics: result.value.statistics,
            resultCount,
            meetsExpectations,
            violations: result.value.thresholdViolations,
          });
        } else {
          failures.push({
            category: 'error',
            message: `Benchmark failed for query "${query.name}": ${result.error.message}`,
          });
        }
      }

      const aggregateStatistics = this.calculateStatistics(allLatencies);
      const durationMs = Date.now() - startTime;

      return success({
        passed: failures.length === 0 && queryResults.every((q) => q.passed),
        name: input.name,
        queryResults,
        aggregateStatistics,
        failures,
        durationMs,
      });
    } catch (error) {
      return failure({
        code: 'BENCHMARK_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Run rollup performance tests
   */
  async runRollupPerformanceTest(
    input: RollupPerformanceTestInput
  ): AsyncResult<RollupPerformanceTestResult, PerformanceTestServiceError> {
    const startTime = Date.now();
    const scanResults: RollupScanResult[] = [];
    const failures: PerformanceTestFailure[] = [];
    const allLatencies: number[] = [];

    try {
      for (const scanId of input.scanIds) {
        const iterationStart = Date.now();

        // Get scan statistics first
        const scanStats = await this.getScanStatistics(scanId, input.authToken, input.tenantId);

        // Run rollup
        const rollupResult = await this.executeRollup(scanId, input.authToken, input.tenantId);

        const durationMs = Date.now() - iterationStart;
        allLatencies.push(durationMs);

        const msPerNode = scanStats.nodeCount > 0 ? durationMs / scanStats.nodeCount : 0;
        const msPerEdge = scanStats.edgeCount > 0 ? durationMs / scanStats.edgeCount : 0;

        const violations: ThresholdViolation[] = [];

        if (input.thresholds?.maxMsPerNode && msPerNode > input.thresholds.maxMsPerNode) {
          violations.push({
            metric: 'msPerNode',
            threshold: input.thresholds.maxMsPerNode,
            actual: msPerNode,
            severity: 'error',
          });
        }

        if (input.thresholds?.maxMsPerEdge && msPerEdge > input.thresholds.maxMsPerEdge) {
          violations.push({
            metric: 'msPerEdge',
            threshold: input.thresholds.maxMsPerEdge,
            actual: msPerEdge,
            severity: 'error',
          });
        }

        scanResults.push({
          scanId,
          passed: rollupResult && violations.length === 0,
          durationMs,
          nodeCount: scanStats.nodeCount,
          edgeCount: scanStats.edgeCount,
          msPerNode,
          msPerEdge,
          violations,
        });

        if (!rollupResult) {
          failures.push({
            category: 'error',
            message: `Rollup failed for scan ${scanId}`,
          });
        }
      }

      const aggregateStatistics = this.calculateStatistics(allLatencies);
      const scalingAnalysis = this.analyzeScaling(scanResults);
      const durationMs = Date.now() - startTime;

      return success({
        passed: failures.length === 0 && scanResults.every((s) => s.passed),
        name: input.name,
        scanResults,
        aggregateStatistics,
        scalingAnalysis,
        failures,
        durationMs,
      });
    } catch (error) {
      return failure({
        code: 'BENCHMARK_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Run memory profiling
   */
  async runMemoryProfiling(
    input: MemoryProfilingInput
  ): AsyncResult<MemoryProfilingResult, PerformanceTestServiceError> {
    const startTime = Date.now();
    const sampleInterval = input.sampleIntervalMs ?? this.config.memorySampleInterval;
    const maxDuration = input.maxDurationMs ?? this.config.maxBenchmarkDuration;
    const samples: MemorySample[] = [];
    const violations: ThresholdViolation[] = [];

    try {
      // Start memory sampling
      const samplingInterval = setInterval(() => {
        const memory = this.getMemoryUsage();
        samples.push({
          timestamp: Date.now(),
          ...memory,
        });
      }, sampleInterval);

      // Execute operation multiple times
      const iterations = Math.min(20, Math.floor(maxDuration / 1000));
      for (let i = 0; i < iterations; i++) {
        if (Date.now() - startTime > maxDuration) break;
        await this.executeOperation(input.operation, input.authToken, input.tenantId);
      }

      // Stop sampling
      clearInterval(samplingInterval);

      // Calculate profile
      const initialSample = samples[0] || this.getMemorySample();
      const finalSample = samples[samples.length - 1] || this.getMemorySample();
      const peakHeapUsed = Math.max(...samples.map((s) => s.heapUsedMb));

      const profile: MemoryProfile = {
        initialHeapUsedMb: initialSample.heapUsedMb,
        finalHeapUsedMb: finalSample.heapUsedMb,
        peakHeapUsedMb: peakHeapUsed,
        heapIncreaseMb: finalSample.heapUsedMb - initialSample.heapUsedMb,
        samples,
      };

      // Check thresholds
      if (input.thresholds?.maxHeapUsedMb && profile.peakHeapUsedMb > input.thresholds.maxHeapUsedMb) {
        violations.push({
          metric: 'peakHeapUsedMb',
          threshold: input.thresholds.maxHeapUsedMb,
          actual: profile.peakHeapUsedMb,
          severity: 'error',
        });
      }

      if (input.thresholds?.maxHeapIncreaseMb && profile.heapIncreaseMb > input.thresholds.maxHeapIncreaseMb) {
        violations.push({
          metric: 'heapIncreaseMb',
          threshold: input.thresholds.maxHeapIncreaseMb,
          actual: profile.heapIncreaseMb,
          severity: 'error',
        });
      }

      // Leak detection
      let leakDetected = false;
      let leakAnalysis: LeakAnalysis | undefined;

      if (input.thresholds?.detectLeaks && samples.length >= 10) {
        leakAnalysis = this.analyzeMemoryLeak(samples);
        const leakThreshold = input.thresholds.leakThresholdPercent ?? 10;
        const percentIncrease =
          ((finalSample.heapUsedMb - initialSample.heapUsedMb) / initialSample.heapUsedMb) * 100;

        if (leakAnalysis.trend === 'increasing' && percentIncrease > leakThreshold) {
          leakDetected = true;
          violations.push({
            metric: 'memoryLeak',
            threshold: leakThreshold,
            actual: percentIncrease,
            severity: 'error',
          });
        }
      }

      const durationMs = Date.now() - startTime;

      return success({
        passed: violations.length === 0,
        name: input.name,
        profile,
        leakDetected,
        leakAnalysis,
        violations,
        durationMs,
      });
    } catch (error) {
      return failure({
        code: 'MEMORY_ERROR',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Generate performance report
   */
  generateReport(
    results: ReadonlyArray<BenchmarkResult>,
    baseline?: PerformanceReport
  ): Result<PerformanceReport, PerformanceTestServiceError> {
    try {
      const environment = this.getEnvironmentInfo();

      const totalIterations = results.reduce((sum, r) => sum + r.iterations, 0);
      const totalDuration = results.reduce((sum, r) => sum + r.durationMs, 0);
      const allLatencies = results.flatMap((r) => r.rawLatencies);
      const overallStats = this.calculateStatistics(allLatencies);

      const summary: ReportSummary = {
        totalBenchmarks: results.length,
        passedBenchmarks: results.filter((r) => r.passed).length,
        failedBenchmarks: results.filter((r) => !r.passed).length,
        totalIterations,
        totalDurationMs: totalDuration,
        averageLatencyMs: overallStats.mean,
        overallThroughput: overallStats.throughput,
      };

      let comparison: ReportComparison | undefined;
      if (baseline) {
        comparison = this.compareWithBaseline(summary, baseline);
      }

      return success({
        generatedAt: new Date(),
        environment,
        benchmarks: [...results],
        summary,
        comparison,
      });
    } catch (error) {
      return failure({
        code: 'ANALYSIS_ERROR',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Calculate statistics from latencies
   */
  calculateStatistics(latencies: ReadonlyArray<number>): LatencyStatistics {
    if (latencies.length === 0) {
      return {
        min: 0,
        max: 0,
        mean: 0,
        median: 0,
        stdDev: 0,
        p50: 0,
        p75: 0,
        p90: 0,
        p95: 0,
        p99: 0,
        throughput: 0,
      };
    }

    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const mean = sum / sorted.length;

    const squaredDiffs = sorted.map((v) => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / sorted.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    const percentile = (p: number): number => {
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, index)];
    };

    const totalDuration = sum;
    const throughput = totalDuration > 0 ? (sorted.length / totalDuration) * 1000 : 0;

    return {
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean,
      median: percentile(50),
      stdDev,
      p50: percentile(50),
      p75: percentile(75),
      p90: percentile(90),
      p95: percentile(95),
      p99: percentile(99),
      throughput,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async executeOperation(
    operation: BenchmarkOperation,
    authToken: string,
    tenantId: TenantId
  ): Promise<void> {
    switch (operation.type) {
      case 'search':
        await this.executeSearch(operation, authToken, tenantId);
        break;
      case 'rollup':
        await this.executeRollup(operation.scanId, authToken, tenantId);
        break;
      case 'graphQuery':
        await this.executeGraphQuery(operation, authToken, tenantId);
        break;
      case 'api':
        await this.executeApiRequest(operation, authToken, tenantId);
        break;
      case 'custom':
        await operation.fn();
        break;
    }
  }

  private async executeSearch(
    operation: SearchBenchmarkOperation,
    authToken: string,
    tenantId: TenantId
  ): Promise<void> {
    const params = new URLSearchParams({ q: operation.query });
    if (operation.limit) params.set('limit', String(operation.limit));

    await fetch(`${this.config.apiBaseUrl}/api/v1/search?${params}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
    });
  }

  private async executeRollup(
    scanId: ScanId,
    authToken: string,
    tenantId: TenantId
  ): Promise<boolean> {
    const response = await fetch(`${this.config.apiBaseUrl}/api/v1/scans/${scanId}/rollup`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
    });
    return response.ok;
  }

  private async executeGraphQuery(
    operation: GraphQueryBenchmarkOperation,
    authToken: string,
    tenantId: TenantId
  ): Promise<void> {
    const path = this.getGraphQueryPath(operation);
    await fetch(`${this.config.apiBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        'X-Tenant-Id': tenantId,
      },
    });
  }

  private getGraphQueryPath(operation: GraphQueryBenchmarkOperation): string {
    switch (operation.queryType) {
      case 'dependencies':
        return `/api/v1/scans/${operation.scanId}/graph/nodes/${operation.nodeId}/dependencies`;
      case 'dependents':
        return `/api/v1/scans/${operation.scanId}/graph/nodes/${operation.nodeId}/dependents`;
      case 'blastRadius':
        return `/api/v1/scans/${operation.scanId}/graph/nodes/${operation.nodeId}/blast-radius`;
      case 'path':
        return `/api/v1/scans/${operation.scanId}/graph`;
      default:
        return `/api/v1/scans/${operation.scanId}/graph`;
    }
  }

  private async executeApiRequest(
    operation: ApiBenchmarkOperation,
    authToken: string,
    tenantId: TenantId
  ): Promise<void> {
    await fetch(`${this.config.apiBaseUrl}${operation.path}`, {
      method: operation.method,
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
        ...operation.headers,
      },
      body: operation.body ? JSON.stringify(operation.body) : undefined,
    });
  }

  private async getSearchResultCount(
    scanId: ScanId,
    query: string,
    filters: Record<string, unknown> | undefined,
    authToken: string,
    tenantId: TenantId
  ): Promise<number> {
    try {
      const params = new URLSearchParams({ q: query, scanId });
      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/search?${params}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-Id': tenantId,
        },
      });

      if (!response.ok) return 0;
      const data = await response.json();
      return data.results?.length ?? data.total ?? 0;
    } catch {
      return 0;
    }
  }

  private async getScanStatistics(
    scanId: ScanId,
    authToken: string,
    tenantId: TenantId
  ): Promise<{ nodeCount: number; edgeCount: number }> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/scans/${scanId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-Id': tenantId,
        },
      });

      if (!response.ok) return { nodeCount: 0, edgeCount: 0 };
      const data = await response.json();
      return {
        nodeCount: data.resultSummary?.totalNodes ?? 0,
        edgeCount: data.resultSummary?.totalEdges ?? 0,
      };
    } catch {
      return { nodeCount: 0, edgeCount: 0 };
    }
  }

  private checkThresholds(
    statistics: LatencyStatistics,
    memoryProfile: MemoryProfile | undefined,
    thresholds?: BenchmarkThresholds
  ): ThresholdViolation[] {
    const violations: ThresholdViolation[] = [];

    if (!thresholds) return violations;

    if (thresholds.maxMeanMs && statistics.mean > thresholds.maxMeanMs) {
      violations.push({
        metric: 'mean',
        threshold: thresholds.maxMeanMs,
        actual: statistics.mean,
        severity: 'error',
      });
    }

    if (thresholds.maxP50Ms && statistics.p50 > thresholds.maxP50Ms) {
      violations.push({
        metric: 'p50',
        threshold: thresholds.maxP50Ms,
        actual: statistics.p50,
        severity: 'warning',
      });
    }

    if (thresholds.maxP95Ms && statistics.p95 > thresholds.maxP95Ms) {
      violations.push({
        metric: 'p95',
        threshold: thresholds.maxP95Ms,
        actual: statistics.p95,
        severity: 'error',
      });
    }

    if (thresholds.maxP99Ms && statistics.p99 > thresholds.maxP99Ms) {
      violations.push({
        metric: 'p99',
        threshold: thresholds.maxP99Ms,
        actual: statistics.p99,
        severity: 'error',
      });
    }

    if (thresholds.minThroughput && statistics.throughput < thresholds.minThroughput) {
      violations.push({
        metric: 'throughput',
        threshold: thresholds.minThroughput,
        actual: statistics.throughput,
        severity: 'error',
      });
    }

    if (
      memoryProfile &&
      thresholds.maxMemoryIncreaseMb &&
      memoryProfile.heapIncreaseMb > thresholds.maxMemoryIncreaseMb
    ) {
      violations.push({
        metric: 'memoryIncrease',
        threshold: thresholds.maxMemoryIncreaseMb,
        actual: memoryProfile.heapIncreaseMb,
        severity: 'error',
      });
    }

    return violations;
  }

  private analyzeScaling(scanResults: RollupScanResult[]): ScalingAnalysis {
    if (scanResults.length < 2) {
      return {
        nodeScalingCorrelation: 0,
        edgeScalingCorrelation: 0,
        estimatedComplexity: 'unknown',
        linearSlope: 0,
      };
    }

    const nodes = scanResults.map((r) => r.nodeCount);
    const edges = scanResults.map((r) => r.edgeCount);
    const durations = scanResults.map((r) => r.durationMs);

    const nodeCorrelation = this.pearsonCorrelation(nodes, durations);
    const edgeCorrelation = this.pearsonCorrelation(edges, durations);

    // Estimate complexity based on correlation and growth pattern
    let complexity: 'O(n)' | 'O(n log n)' | 'O(n^2)' | 'unknown' = 'unknown';
    if (Math.abs(nodeCorrelation) > 0.9) {
      // Check if linear or superlinear
      const slope = this.linearRegression(nodes, durations).slope;
      const avgMsPerNode = durations.reduce((a, b) => a + b, 0) / nodes.reduce((a, b) => a + b, 0);

      if (Math.abs(slope - avgMsPerNode) / avgMsPerNode < 0.2) {
        complexity = 'O(n)';
      } else {
        complexity = 'O(n log n)';
      }
    }

    const { slope } = this.linearRegression(nodes, durations);

    return {
      nodeScalingCorrelation: nodeCorrelation,
      edgeScalingCorrelation: edgeCorrelation,
      estimatedComplexity: complexity,
      linearSlope: slope,
    };
  }

  private analyzeMemoryLeak(samples: MemorySample[]): LeakAnalysis {
    const heapUsed = samples.map((s) => s.heapUsedMb);
    const timestamps = samples.map((s) => s.timestamp);

    // Calculate linear regression
    const { slope } = this.linearRegression(timestamps, heapUsed);
    const growthRateMbPerSec = slope * 1000;

    // Determine trend
    let trend: 'increasing' | 'stable' | 'decreasing' = 'stable';
    if (growthRateMbPerSec > 0.01) {
      trend = 'increasing';
    } else if (growthRateMbPerSec < -0.01) {
      trend = 'decreasing';
    }

    // Estimate sustained growth period
    let sustainedGrowthStart = 0;
    for (let i = 1; i < heapUsed.length; i++) {
      if (heapUsed[i] > heapUsed[i - 1]) {
        if (sustainedGrowthStart === 0) {
          sustainedGrowthStart = timestamps[i - 1];
        }
      } else {
        sustainedGrowthStart = 0;
      }
    }

    const sustainedGrowthPeriodMs =
      sustainedGrowthStart > 0 ? timestamps[timestamps.length - 1] - sustainedGrowthStart : 0;

    // Calculate confidence based on R-squared
    const correlation = this.pearsonCorrelation(timestamps, heapUsed);
    const confidence = Math.abs(correlation);

    return {
      trend,
      growthRateMbPerSec,
      sustainedGrowthPeriodMs,
      confidence,
    };
  }

  private compareWithBaseline(summary: ReportSummary, baseline: PerformanceReport): ReportComparison {
    const baselineSummary = baseline.summary;

    const latencyChange =
      baselineSummary.averageLatencyMs > 0
        ? ((summary.averageLatencyMs - baselineSummary.averageLatencyMs) / baselineSummary.averageLatencyMs) * 100
        : 0;

    const throughputChange =
      baselineSummary.overallThroughput > 0
        ? ((summary.overallThroughput - baselineSummary.overallThroughput) / baselineSummary.overallThroughput) * 100
        : 0;

    const regressions: string[] = [];
    const improvements: string[] = [];

    if (latencyChange > 10) {
      regressions.push(`Latency increased by ${latencyChange.toFixed(1)}%`);
    } else if (latencyChange < -10) {
      improvements.push(`Latency decreased by ${Math.abs(latencyChange).toFixed(1)}%`);
    }

    if (throughputChange < -10) {
      regressions.push(`Throughput decreased by ${Math.abs(throughputChange).toFixed(1)}%`);
    } else if (throughputChange > 10) {
      improvements.push(`Throughput increased by ${throughputChange.toFixed(1)}%`);
    }

    return {
      baselineDate: baseline.generatedAt,
      latencyChange,
      throughputChange,
      memoryChange: 0, // Would need to track memory in summary
      regressions,
      improvements,
    };
  }

  private getMemoryUsage(): { heapUsedMb: number; heapTotalMb: number; externalMb: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsedMb: usage.heapUsed / (1024 * 1024),
        heapTotalMb: usage.heapTotal / (1024 * 1024),
        externalMb: usage.external / (1024 * 1024),
      };
    }
    return { heapUsedMb: 0, heapTotalMb: 0, externalMb: 0 };
  }

  private getMemorySample(): MemorySample {
    return {
      timestamp: Date.now(),
      ...this.getMemoryUsage(),
    };
  }

  private forceGC(): void {
    if (typeof global !== 'undefined' && typeof (global as { gc?: () => void }).gc === 'function') {
      (global as { gc: () => void }).gc();
    }
  }

  private getEnvironmentInfo(): EnvironmentInfo {
    return {
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
      platform: typeof process !== 'undefined' ? process.platform : 'unknown',
      arch: typeof process !== 'undefined' ? process.arch : 'unknown',
      cpuCount: typeof require !== 'undefined' ? require('os').cpus().length : 1,
      totalMemoryMb: typeof require !== 'undefined' ? require('os').totalmem() / (1024 * 1024) : 0,
      freeMemoryMb: typeof require !== 'undefined' ? require('os').freemem() / (1024 * 1024) : 0,
    };
  }

  private pearsonCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    if (n === 0) return 0;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);
    const sumY2 = y.reduce((acc, yi) => acc + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private linearRegression(x: number[], y: number[]): { slope: number; intercept: number } {
    const n = x.length;
    if (n === 0) return { slope: 0, intercept: 0 };

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((acc, xi, i) => acc + xi * y[i], 0);
    const sumX2 = x.reduce((acc, xi) => acc + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return { slope: isNaN(slope) ? 0 : slope, intercept: isNaN(intercept) ? 0 : intercept };
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verbose) {
      console.log(`[PerformanceTestService] ${message}`, data ?? '');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new performance test service
 */
export function createPerformanceTestService(
  database?: TestDatabase,
  config?: Partial<PerformanceTestServiceConfig>
): IPerformanceTestService {
  return new PerformanceTestService(database, config);
}

/**
 * Type guard for PerformanceTestServiceError
 */
export function isPerformanceTestServiceError(value: unknown): value is PerformanceTestServiceError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
