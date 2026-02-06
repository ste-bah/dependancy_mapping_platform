/**
 * Core Benchmark Utilities
 * @module benchmarks/benchmark-utils
 *
 * Performance measurement and statistical analysis utilities for benchmarking.
 * Implements NFR-PERF-008 compliant measurement patterns.
 *
 * NFR-PERF-008: Performance benchmarks for large-scale graph operations
 * - Search 10K nodes < 100ms
 * - Search 50K nodes < 200ms
 * - Search 100K nodes < 500ms (CRITICAL)
 * - Rollup depth 3 < 500ms
 * - Scan 1000 files < 60s
 */

import {
  type BenchmarkResult,
  type BenchmarkIteration,
  type PercentileStats,
  type BenchmarkConfig,
  type BenchmarkEnvironment,
  type PerformanceTargetKey,
  PERFORMANCE_TARGETS,
  DEFAULT_BENCHMARK_CONFIG,
} from './benchmark-types.js';

// ============================================================================
// Latency Measurement
// ============================================================================

/**
 * Measures the latency of an async operation with warmup support.
 *
 * @param fn - The async function to measure
 * @param iterations - Number of measurement iterations (default: 100)
 * @param warmupIterations - Number of warmup iterations before measurement (default: 10)
 * @returns Benchmark result with latency statistics
 *
 * @example
 * const result = await measureLatency(
 *   async () => { await searchNodes(10000); },
 *   100,
 *   10
 * );
 * console.log(`p95 latency: ${result.latency.p95}ms`);
 */
export async function measureLatency<T>(
  fn: () => Promise<T>,
  iterations: number = 100,
  warmupIterations: number = 10
): Promise<BenchmarkResult> {
  const iterationResults: BenchmarkIteration[] = [];
  const measurementLatencies: number[] = [];
  const startTime = performance.now();

  // Warmup iterations
  for (let i = 0; i < warmupIterations; i++) {
    const iterStart = performance.now();
    try {
      await fn();
      const latencyMs = performance.now() - iterStart;
      iterationResults.push({
        index: i,
        latencyMs,
        isWarmup: true,
      });
    } catch (error) {
      iterationResults.push({
        index: i,
        latencyMs: performance.now() - iterStart,
        isWarmup: true,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  // Measurement iterations
  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now();
    try {
      await fn();
      const latencyMs = performance.now() - iterStart;
      measurementLatencies.push(latencyMs);
      iterationResults.push({
        index: warmupIterations + i,
        latencyMs,
        isWarmup: false,
      });
    } catch (error) {
      const latencyMs = performance.now() - iterStart;
      measurementLatencies.push(latencyMs);
      iterationResults.push({
        index: warmupIterations + i,
        latencyMs,
        isWarmup: false,
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  const totalDurationMs = performance.now() - startTime;
  const latencyStats = calculatePercentileStats(measurementLatencies);

  return {
    name: 'anonymous',
    suite: 'default',
    iterations,
    warmupIterations,
    latency: latencyStats,
    throughputPerSec: latencyStats.avg > 0 ? 1000 / latencyStats.avg : 0,
    iterationResults,
    passed: true,
    timestamp: new Date(),
    totalDurationMs,
    config: {
      ...DEFAULT_BENCHMARK_CONFIG,
      iterations,
      warmupIterations,
    },
  };
}

/**
 * Measures latency with a target threshold, returning pass/fail status.
 *
 * @param fn - The async function to measure
 * @param targetMs - Target threshold in milliseconds
 * @param iterations - Number of iterations
 * @param warmupIterations - Number of warmup iterations
 * @returns Benchmark result with pass/fail based on p95 vs target
 */
export async function measureLatencyAgainstTarget<T>(
  fn: () => Promise<T>,
  targetMs: number,
  iterations: number = 100,
  warmupIterations: number = 10
): Promise<BenchmarkResult> {
  const result = await measureLatency(fn, iterations, warmupIterations);
  const passed = result.latency.p95 <= targetMs;
  const performanceRatio = result.latency.p95 / targetMs;

  return {
    ...result,
    targetMs,
    passed,
    performanceRatio,
  };
}

/**
 * Measures latency against a named NFR-PERF-008 target.
 *
 * @param fn - The async function to measure
 * @param target - NFR performance target key
 * @param iterations - Number of iterations
 * @param warmupIterations - Number of warmup iterations
 * @returns Benchmark result with NFR target comparison
 */
export async function measureAgainstNfrTarget<T>(
  fn: () => Promise<T>,
  target: PerformanceTargetKey,
  iterations: number = 100,
  warmupIterations: number = 10
): Promise<BenchmarkResult> {
  const targetMs = PERFORMANCE_TARGETS[target];
  const result = await measureLatencyAgainstTarget(fn, targetMs, iterations, warmupIterations);

  return {
    ...result,
    name: target,
    metadata: {
      nfrTarget: target,
      nfrTargetMs: targetMs,
    },
  };
}

// ============================================================================
// Memory Measurement
// ============================================================================

/**
 * Gets the current heap memory usage in bytes.
 * Uses process.memoryUsage() for Node.js environments.
 *
 * @returns Current heap used in bytes, or 0 if unavailable
 */
export function getMemoryUsage(): number {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    return process.memoryUsage().heapUsed;
  }
  return 0;
}

/**
 * Gets detailed memory usage information.
 *
 * @returns Object with memory metrics or undefined if unavailable
 */
export function getDetailedMemoryUsage(): {
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
  rss: number;
} | undefined {
  if (typeof process !== 'undefined' && process.memoryUsage) {
    const mem = process.memoryUsage();
    return {
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
      arrayBuffers: mem.arrayBuffers,
      rss: mem.rss,
    };
  }
  return undefined;
}

/**
 * Forces garbage collection if available (requires --expose-gc flag).
 * Safe to call even when GC is not exposed.
 */
export function forceGC(): void {
  if (typeof global !== 'undefined' && (global as { gc?: () => void }).gc) {
    (global as { gc: () => void }).gc();
  }
}

/**
 * Measures memory usage of a function execution.
 *
 * @param fn - The function to measure
 * @param forceGcBefore - Whether to force GC before measurement
 * @returns Memory usage delta in bytes
 */
export async function measureMemory<T>(
  fn: () => Promise<T>,
  forceGcBefore: boolean = true
): Promise<{
  result: T;
  memoryDelta: number;
  peakMemory: number;
}> {
  if (forceGcBefore) {
    forceGC();
  }

  const beforeMemory = getMemoryUsage();
  let peakMemory = beforeMemory;

  // Periodically check for peak memory during execution
  const peakChecker = setInterval(() => {
    const current = getMemoryUsage();
    if (current > peakMemory) {
      peakMemory = current;
    }
  }, 10);

  try {
    const result = await fn();
    clearInterval(peakChecker);

    const afterMemory = getMemoryUsage();
    if (afterMemory > peakMemory) {
      peakMemory = afterMemory;
    }

    return {
      result,
      memoryDelta: afterMemory - beforeMemory,
      peakMemory: peakMemory - beforeMemory,
    };
  } catch (error) {
    clearInterval(peakChecker);
    throw error;
  }
}

// ============================================================================
// Statistical Calculations
// ============================================================================

/**
 * Calculates a specific percentile from an array of values.
 *
 * @param values - Array of numeric values (will be sorted)
 * @param percentile - Percentile to calculate (0-100)
 * @returns The percentile value
 *
 * @example
 * const p95 = calculatePercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95);
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));

  return sorted[clampedIndex] ?? 0;
}

/**
 * Calculates the standard deviation of an array of values.
 *
 * @param values - Array of numeric values
 * @returns Standard deviation
 */
export function calculateStdDev(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calculates comprehensive percentile statistics for an array of values.
 *
 * @param values - Array of numeric values
 * @returns Complete percentile statistics
 */
export function calculatePercentileStats(values: number[]): PercentileStats {
  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      avg: 0,
      p50: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
      stdDev: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);

  return {
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    avg: values.reduce((sum, val) => sum + val, 0) / values.length,
    p50: calculatePercentile(sorted, 50),
    p75: calculatePercentile(sorted, 75),
    p90: calculatePercentile(sorted, 90),
    p95: calculatePercentile(sorted, 95),
    p99: calculatePercentile(sorted, 99),
    stdDev: calculateStdDev(values),
  };
}

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Formats a duration in milliseconds to a human-readable string.
 *
 * @param ms - Duration in milliseconds
 * @returns Formatted string (e.g., "1.23s", "456ms", "12.3us")
 */
export function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)}s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(2)}ms`;
  }
  if (ms >= 0.001) {
    return `${(ms * 1000).toFixed(2)}us`;
  }
  return `${(ms * 1000000).toFixed(2)}ns`;
}

/**
 * Formats bytes to a human-readable string.
 *
 * @param bytes - Size in bytes
 * @returns Formatted string (e.g., "1.23 GB", "456 MB", "789 KB")
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let unitIndex = 0;
  let value = Math.abs(bytes);

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  const formatted = value.toFixed(2);
  return `${bytes < 0 ? '-' : ''}${formatted} ${units[unitIndex]}`;
}

/**
 * Formats a number with thousand separators.
 *
 * @param num - Number to format
 * @returns Formatted string (e.g., "1,234,567")
 */
export function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Formats a percentage value.
 *
 * @param value - Decimal value (0-1)
 * @param decimals - Number of decimal places
 * @returns Formatted percentage string (e.g., "95.50%")
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Formats throughput value.
 *
 * @param opsPerSec - Operations per second
 * @returns Formatted string (e.g., "12.34K ops/s", "1.23M ops/s")
 */
export function formatThroughput(opsPerSec: number): string {
  if (opsPerSec >= 1000000) {
    return `${(opsPerSec / 1000000).toFixed(2)}M ops/s`;
  }
  if (opsPerSec >= 1000) {
    return `${(opsPerSec / 1000).toFixed(2)}K ops/s`;
  }
  return `${opsPerSec.toFixed(2)} ops/s`;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Collects environment information for benchmark reports.
 *
 * @returns Environment information object
 */
export function collectEnvironmentInfo(): BenchmarkEnvironment {
  const os = typeof process !== 'undefined' ? process : undefined;

  let v8HeapStats: BenchmarkEnvironment['v8HeapStats'] | undefined;

  // Try to get V8 heap statistics if available
  if (typeof process !== 'undefined') {
    try {
      // Dynamic import to avoid issues in non-Node environments
      const v8 = require('v8');
      const stats = v8.getHeapStatistics();
      v8HeapStats = {
        totalHeapSize: stats.total_heap_size,
        usedHeapSize: stats.used_heap_size,
        heapSizeLimit: stats.heap_size_limit,
      };
    } catch {
      // V8 module not available
    }
  }

  return {
    nodeVersion: os?.version ?? 'unknown',
    platform: os?.platform ?? 'unknown',
    arch: os?.arch ?? 'unknown',
    totalMemory: typeof process !== 'undefined' && process.memoryUsage
      ? process.memoryUsage().rss
      : 0,
    freeMemory: 0, // Would need os module
    cpuModel: 'unknown', // Would need os module
    cpuCores: 1, // Would need os module
    v8HeapStats,
  };
}

// ============================================================================
// Benchmark Helpers
// ============================================================================

/**
 * Runs a function multiple times and collects results.
 *
 * @param fn - Function to run
 * @param count - Number of times to run
 * @returns Array of results
 */
export async function runMultiple<T>(
  fn: () => Promise<T>,
  count: number
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < count; i++) {
    results.push(await fn());
  }
  return results;
}

/**
 * Runs a function until a condition is met or timeout is reached.
 *
 * @param fn - Function to run
 * @param condition - Condition to check after each run
 * @param timeoutMs - Timeout in milliseconds
 * @returns Final result
 */
export async function runUntil<T>(
  fn: () => Promise<T>,
  condition: (result: T) => boolean,
  timeoutMs: number = 30000
): Promise<T> {
  const startTime = performance.now();

  while (performance.now() - startTime < timeoutMs) {
    const result = await fn();
    if (condition(result)) {
      return result;
    }
  }

  throw new Error(`Timeout after ${timeoutMs}ms waiting for condition`);
}

/**
 * Creates a timeout wrapper for a promise.
 *
 * @param promise - Promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param message - Error message on timeout
 * @returns Promise that rejects on timeout
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(message)), timeoutMs)
    ),
  ]);
}

/**
 * Delays execution for a specified duration.
 *
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the delay
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a comparison summary between two benchmark results.
 *
 * @param baseline - Baseline benchmark result
 * @param current - Current benchmark result
 * @returns Comparison summary object
 */
export function compareBenchmarkResults(
  baseline: BenchmarkResult,
  current: BenchmarkResult
): {
  latencyChange: number;
  latencyChangePercent: number;
  throughputChange: number;
  throughputChangePercent: number;
  improved: boolean;
  regression: boolean;
  regressionThreshold: number;
} {
  const latencyChange = current.latency.p95 - baseline.latency.p95;
  const latencyChangePercent = baseline.latency.p95 > 0
    ? (latencyChange / baseline.latency.p95) * 100
    : 0;

  const throughputChange = current.throughputPerSec - baseline.throughputPerSec;
  const throughputChangePercent = baseline.throughputPerSec > 0
    ? (throughputChange / baseline.throughputPerSec) * 100
    : 0;

  const regressionThreshold = 20; // 20% regression threshold

  return {
    latencyChange,
    latencyChangePercent,
    throughputChange,
    throughputChangePercent,
    improved: latencyChangePercent < -5, // 5% improvement threshold
    regression: latencyChangePercent > regressionThreshold,
    regressionThreshold,
  };
}

/**
 * Validates that a benchmark result meets NFR-PERF-008 targets.
 *
 * @param result - Benchmark result to validate
 * @param target - NFR target key
 * @returns Validation result with details
 */
export function validateAgainstNfrTarget(
  result: BenchmarkResult,
  target: PerformanceTargetKey
): {
  valid: boolean;
  targetMs: number;
  actualMs: number;
  marginMs: number;
  marginPercent: number;
  status: 'pass' | 'fail' | 'warning';
} {
  const targetMs = PERFORMANCE_TARGETS[target];
  const actualMs = result.latency.p95;
  const marginMs = targetMs - actualMs;
  const marginPercent = (marginMs / targetMs) * 100;

  let status: 'pass' | 'fail' | 'warning';
  if (actualMs <= targetMs) {
    status = marginPercent < 10 ? 'warning' : 'pass';
  } else {
    status = 'fail';
  }

  return {
    valid: actualMs <= targetMs,
    targetMs,
    actualMs,
    marginMs,
    marginPercent,
    status,
  };
}

// ============================================================================
// Node Count Scale Helpers
// ============================================================================

/**
 * Gets the node count for a benchmark scale.
 *
 * @param scale - Benchmark scale
 * @param customCount - Custom count when scale is 'custom'
 * @returns Node count
 */
export function getNodeCountForScale(
  scale: '1k' | '10k' | '50k' | '100k' | 'custom',
  customCount?: number
): number {
  switch (scale) {
    case '1k':
      return 1000;
    case '10k':
      return 10000;
    case '50k':
      return 50000;
    case '100k':
      return 100000;
    case 'custom':
      return customCount ?? 10000;
    default:
      return 10000;
  }
}

/**
 * Gets the target threshold for a given scale.
 *
 * @param scale - Benchmark scale
 * @returns Target threshold in milliseconds
 */
export function getSearchTargetForScale(
  scale: '1k' | '10k' | '50k' | '100k' | 'custom'
): number {
  switch (scale) {
    case '1k':
      return 50; // Sub-target for 1K
    case '10k':
      return PERFORMANCE_TARGETS.SEARCH_10K_MS;
    case '50k':
      return PERFORMANCE_TARGETS.SEARCH_50K_MS;
    case '100k':
      return PERFORMANCE_TARGETS.SEARCH_100K_MS;
    case 'custom':
      return PERFORMANCE_TARGETS.SEARCH_10K_MS; // Default to 10K target
    default:
      return PERFORMANCE_TARGETS.SEARCH_10K_MS;
  }
}
