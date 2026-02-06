/**
 * Benchmark Utils Tests
 * @module benchmarks/__tests__/benchmark-utils
 *
 * Unit tests for benchmark utility functions implementing NFR-PERF-008.
 * Tests latency measurement, statistical calculations, and formatting utilities.
 *
 * Coverage targets: 90%+ for all utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  measureLatency,
  measureLatencyAgainstTarget,
  measureAgainstNfrTarget,
  getMemoryUsage,
  getDetailedMemoryUsage,
  forceGC,
  measureMemory,
  calculatePercentile,
  calculateStdDev,
  calculatePercentileStats,
  formatDuration,
  formatBytes,
  formatNumber,
  formatPercentage,
  formatThroughput,
  collectEnvironmentInfo,
  runMultiple,
  runUntil,
  withTimeout,
  delay,
  compareBenchmarkResults,
  validateAgainstNfrTarget,
  getNodeCountForScale,
  getSearchTargetForScale,
} from '../benchmark-utils.js';
import {
  PERFORMANCE_TARGETS,
  type BenchmarkResult,
  type PercentileStats,
} from '../benchmark-types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockBenchmarkResult = (overrides: Partial<BenchmarkResult> = {}): BenchmarkResult => ({
  name: 'test-benchmark',
  suite: 'test-suite',
  iterations: 100,
  warmupIterations: 10,
  latency: {
    min: 10,
    max: 100,
    avg: 50,
    p50: 45,
    p75: 60,
    p90: 80,
    p95: 90,
    p99: 95,
    stdDev: 15,
  },
  throughputPerSec: 20,
  iterationResults: [],
  passed: true,
  timestamp: new Date(),
  totalDurationMs: 5000,
  config: {
    iterations: 100,
    warmupIterations: 10,
    measureMemory: true,
    forceGcBetweenIterations: false,
    iterationDelayMs: 0,
    timeoutMs: 60000,
    enableParallel: false,
    scale: '10k',
  },
  ...overrides,
});

// ============================================================================
// measureLatency Tests
// ============================================================================

describe('measureLatency', () => {
  describe('basic functionality', () => {
    it('should measure function execution time', async () => {
      const targetDelay = 10;
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, targetDelay));
      };

      const result = await measureLatency(fn, 5, 2);

      expect(result.iterations).toBe(5);
      expect(result.warmupIterations).toBe(2);
      expect(result.latency.avg).toBeGreaterThanOrEqual(targetDelay * 0.8);
      expect(result.iterationResults.length).toBe(7); // 5 + 2 warmup
    });

    it('should exclude warmup iterations from statistics', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount <= 2) {
          // Warmup iterations are slow
          await new Promise((resolve) => setTimeout(resolve, 50));
        } else {
          // Measurement iterations are fast
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      };

      const result = await measureLatency(fn, 3, 2);

      // The measurement latency should reflect the faster iterations
      expect(result.latency.avg).toBeLessThan(30);
      expect(callCount).toBe(5);
    });

    it('should mark warmup iterations correctly', async () => {
      const fn = async () => Promise.resolve();

      const result = await measureLatency(fn, 3, 2);

      const warmupIterations = result.iterationResults.filter((i) => i.isWarmup);
      const measurementIterations = result.iterationResults.filter((i) => !i.isWarmup);

      expect(warmupIterations.length).toBe(2);
      expect(measurementIterations.length).toBe(3);
      expect(warmupIterations.every((i) => i.index < 2)).toBe(true);
    });

    it('should calculate throughput correctly', async () => {
      const fn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      };

      const result = await measureLatency(fn, 5, 1);

      // Throughput should be approximately 1000 / avg_latency_ms
      const expectedThroughput = 1000 / result.latency.avg;
      expect(Math.abs(result.throughputPerSec - expectedThroughput)).toBeLessThan(1);
    });

    it('should use default values when not specified', async () => {
      const fn = async () => Promise.resolve();

      const result = await measureLatency(fn);

      expect(result.iterations).toBe(100);
      expect(result.warmupIterations).toBe(10);
    });
  });

  describe('error handling', () => {
    it('should handle errors during measurement', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount === 3) {
          throw new Error('Test error');
        }
      };

      const result = await measureLatency(fn, 5, 1);

      const errorIterations = result.iterationResults.filter((i) => i.error);
      expect(errorIterations.length).toBe(1);
      expect(errorIterations[0]!.error?.message).toBe('Test error');
    });

    it('should continue measuring after errors', async () => {
      let callCount = 0;
      const fn = async () => {
        callCount++;
        if (callCount === 2) {
          throw new Error('Test error');
        }
      };

      const result = await measureLatency(fn, 5, 0);

      expect(result.iterationResults.length).toBe(5);
    });

    it('should convert non-Error throws to Error objects', async () => {
      const fn = async () => {
        throw 'string error';
      };

      const result = await measureLatency(fn, 1, 0);

      expect(result.iterationResults[0]!.error).toBeInstanceOf(Error);
    });
  });

  describe('result structure', () => {
    it('should include all required fields', async () => {
      const fn = async () => Promise.resolve();

      const result = await measureLatency(fn, 5, 1);

      expect(result).toHaveProperty('name');
      expect(result).toHaveProperty('suite');
      expect(result).toHaveProperty('iterations');
      expect(result).toHaveProperty('warmupIterations');
      expect(result).toHaveProperty('latency');
      expect(result).toHaveProperty('throughputPerSec');
      expect(result).toHaveProperty('iterationResults');
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('totalDurationMs');
      expect(result).toHaveProperty('config');
    });

    it('should have default name and suite', async () => {
      const fn = async () => Promise.resolve();

      const result = await measureLatency(fn, 1, 0);

      expect(result.name).toBe('anonymous');
      expect(result.suite).toBe('default');
    });
  });
});

// ============================================================================
// measureLatencyAgainstTarget Tests
// ============================================================================

describe('measureLatencyAgainstTarget', () => {
  it('should pass when p95 is below target', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    };

    const result = await measureLatencyAgainstTarget(fn, 100, 5, 1);

    expect(result.passed).toBe(true);
    expect(result.targetMs).toBe(100);
    expect(result.performanceRatio).toBeLessThan(1);
  });

  it('should fail when p95 exceeds target', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    };

    const result = await measureLatencyAgainstTarget(fn, 10, 5, 1);

    expect(result.passed).toBe(false);
    expect(result.targetMs).toBe(10);
    expect(result.performanceRatio).toBeGreaterThan(1);
  });

  it('should calculate performance ratio correctly', async () => {
    const fn = async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    };

    const result = await measureLatencyAgainstTarget(fn, 100, 5, 1);

    expect(result.performanceRatio).toBe(result.latency.p95 / 100);
  });
});

// ============================================================================
// measureAgainstNfrTarget Tests
// ============================================================================

describe('measureAgainstNfrTarget', () => {
  it('should use correct NFR target for SEARCH_10K_MS', async () => {
    const fn = async () => Promise.resolve();

    const result = await measureAgainstNfrTarget(fn, 'SEARCH_10K_MS', 5, 1);

    expect(result.name).toBe('SEARCH_10K_MS');
    expect(result.targetMs).toBe(PERFORMANCE_TARGETS.SEARCH_10K_MS);
    expect(result.metadata).toHaveProperty('nfrTarget', 'SEARCH_10K_MS');
    expect(result.metadata).toHaveProperty('nfrTargetMs', 100);
  });

  it('should use correct NFR target for SEARCH_100K_MS', async () => {
    const fn = async () => Promise.resolve();

    const result = await measureAgainstNfrTarget(fn, 'SEARCH_100K_MS', 5, 1);

    expect(result.targetMs).toBe(PERFORMANCE_TARGETS.SEARCH_100K_MS);
    expect(result.targetMs).toBe(500);
  });

  it('should validate against all NFR targets', async () => {
    const fn = async () => Promise.resolve();

    const targets: Array<keyof typeof PERFORMANCE_TARGETS> = [
      'SEARCH_10K_MS',
      'SEARCH_50K_MS',
      'SEARCH_100K_MS',
      'ROLLUP_DEPTH3_MS',
      'SCAN_1000_FILES_MS',
    ];

    for (const target of targets) {
      const result = await measureAgainstNfrTarget(fn, target, 3, 1);
      expect(result.targetMs).toBe(PERFORMANCE_TARGETS[target]);
    }
  });
});

// ============================================================================
// Memory Measurement Tests
// ============================================================================

describe('getMemoryUsage', () => {
  it('should return heap used bytes', () => {
    const memory = getMemoryUsage();

    expect(typeof memory).toBe('number');
    expect(memory).toBeGreaterThan(0);
  });
});

describe('getDetailedMemoryUsage', () => {
  it('should return detailed memory information', () => {
    const memory = getDetailedMemoryUsage();

    expect(memory).toBeDefined();
    expect(memory).toHaveProperty('heapUsed');
    expect(memory).toHaveProperty('heapTotal');
    expect(memory).toHaveProperty('external');
    expect(memory).toHaveProperty('arrayBuffers');
    expect(memory).toHaveProperty('rss');
  });
});

describe('forceGC', () => {
  it('should not throw when called', () => {
    expect(() => forceGC()).not.toThrow();
  });
});

describe('measureMemory', () => {
  it('should measure memory usage of a function', async () => {
    const fn = async () => {
      // Allocate some memory
      const arr = new Array(10000).fill('test');
      return arr.length;
    };

    const result = await measureMemory(fn);

    expect(result.result).toBe(10000);
    expect(typeof result.memoryDelta).toBe('number');
    expect(typeof result.peakMemory).toBe('number');
  });

  it('should respect forceGcBefore option', async () => {
    const fn = async () => 'result';

    const result1 = await measureMemory(fn, true);
    const result2 = await measureMemory(fn, false);

    expect(result1.result).toBe('result');
    expect(result2.result).toBe('result');
  });

  it('should propagate errors', async () => {
    const fn = async () => {
      throw new Error('Memory test error');
    };

    await expect(measureMemory(fn)).rejects.toThrow('Memory test error');
  });
});

// ============================================================================
// Statistical Calculation Tests
// ============================================================================

describe('calculatePercentile', () => {
  it('should calculate p50 correctly', () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    const p50 = calculatePercentile(values, 50);

    expect(p50).toBe(5);
  });

  it('should calculate p95 correctly', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    const p95 = calculatePercentile(values, 95);

    expect(p95).toBe(95);
  });

  it('should calculate p99 correctly', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    const p99 = calculatePercentile(values, 99);

    expect(p99).toBe(99);
  });

  it('should handle empty arrays', () => {
    expect(calculatePercentile([], 50)).toBe(0);
    expect(calculatePercentile([], 95)).toBe(0);
  });

  it('should handle single element arrays', () => {
    expect(calculatePercentile([42], 50)).toBe(42);
    expect(calculatePercentile([42], 95)).toBe(42);
  });

  it('should not modify original array', () => {
    const values = [5, 3, 1, 4, 2];
    const original = [...values];

    calculatePercentile(values, 50);

    expect(values).toEqual(original);
  });

  it('should handle unsorted arrays', () => {
    const values = [5, 1, 4, 2, 3];

    const p50 = calculatePercentile(values, 50);

    expect(p50).toBe(3);
  });

  it('should handle edge percentiles', () => {
    const values = [1, 2, 3, 4, 5];

    expect(calculatePercentile(values, 0)).toBe(1);
    expect(calculatePercentile(values, 100)).toBe(5);
  });
});

describe('calculateStdDev', () => {
  it('should calculate standard deviation correctly', () => {
    const values = [2, 4, 4, 4, 5, 5, 7, 9];

    const stdDev = calculateStdDev(values);

    // Expected std dev for this dataset is 2
    expect(Math.abs(stdDev - 2)).toBeLessThan(0.01);
  });

  it('should return 0 for empty array', () => {
    expect(calculateStdDev([])).toBe(0);
  });

  it('should return 0 for single element', () => {
    expect(calculateStdDev([5])).toBe(0);
  });

  it('should return 0 for uniform values', () => {
    const values = [5, 5, 5, 5, 5];

    expect(calculateStdDev(values)).toBe(0);
  });
});

describe('calculatePercentileStats', () => {
  it('should calculate all percentile stats correctly', () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    const stats = calculatePercentileStats(values);

    expect(stats.min).toBe(1);
    expect(stats.max).toBe(100);
    expect(stats.avg).toBe(50.5);
    expect(stats.p50).toBe(50);
    expect(stats.p75).toBe(75);
    expect(stats.p90).toBe(90);
    expect(stats.p95).toBe(95);
    expect(stats.p99).toBe(99);
    expect(stats.stdDev).toBeGreaterThan(0);
  });

  it('should return zeros for empty array', () => {
    const stats = calculatePercentileStats([]);

    expect(stats.min).toBe(0);
    expect(stats.max).toBe(0);
    expect(stats.avg).toBe(0);
    expect(stats.p50).toBe(0);
    expect(stats.p75).toBe(0);
    expect(stats.p90).toBe(0);
    expect(stats.p95).toBe(0);
    expect(stats.p99).toBe(0);
    expect(stats.stdDev).toBe(0);
  });

  it('should handle single element', () => {
    const stats = calculatePercentileStats([42]);

    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.avg).toBe(42);
    expect(stats.p50).toBe(42);
  });
});

// ============================================================================
// Formatting Utility Tests
// ============================================================================

describe('formatDuration', () => {
  it('should format seconds correctly', () => {
    expect(formatDuration(1000)).toBe('1.00s');
    expect(formatDuration(2500)).toBe('2.50s');
    expect(formatDuration(60000)).toBe('60.00s');
  });

  it('should format milliseconds correctly', () => {
    expect(formatDuration(100)).toBe('100.00ms');
    expect(formatDuration(1)).toBe('1.00ms');
    expect(formatDuration(500)).toBe('500.00ms');
  });

  it('should format microseconds correctly', () => {
    expect(formatDuration(0.1)).toBe('100.00us');
    expect(formatDuration(0.001)).toBe('1.00us');
    expect(formatDuration(0.5)).toBe('500.00us');
  });

  it('should format nanoseconds correctly', () => {
    expect(formatDuration(0.0001)).toBe('100.00ns');
    expect(formatDuration(0.000001)).toBe('1.00ns');
  });
});

describe('formatBytes', () => {
  it('should format bytes correctly', () => {
    expect(formatBytes(500)).toBe('500.00 B');
  });

  it('should format kilobytes correctly', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(2048)).toBe('2.00 KB');
  });

  it('should format megabytes correctly', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.00 MB');
  });

  it('should format gigabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
  });

  it('should format terabytes correctly', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
  });

  it('should handle negative values', () => {
    expect(formatBytes(-1024)).toBe('-1.00 KB');
  });
});

describe('formatNumber', () => {
  it('should format numbers with thousand separators', () => {
    expect(formatNumber(1000)).toBe('1,000');
    expect(formatNumber(1000000)).toBe('1,000,000');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('should format small numbers correctly', () => {
    expect(formatNumber(100)).toBe('100');
    expect(formatNumber(1)).toBe('1');
  });
});

describe('formatPercentage', () => {
  it('should format percentages correctly', () => {
    expect(formatPercentage(0.5)).toBe('50.00%');
    expect(formatPercentage(0.95)).toBe('95.00%');
    expect(formatPercentage(1)).toBe('100.00%');
  });

  it('should respect decimal places', () => {
    expect(formatPercentage(0.5, 0)).toBe('50%');
    expect(formatPercentage(0.5, 1)).toBe('50.0%');
    expect(formatPercentage(0.5, 3)).toBe('50.000%');
  });
});

describe('formatThroughput', () => {
  it('should format operations per second', () => {
    expect(formatThroughput(100)).toBe('100.00 ops/s');
  });

  it('should format thousands', () => {
    expect(formatThroughput(1000)).toBe('1.00K ops/s');
    expect(formatThroughput(5000)).toBe('5.00K ops/s');
  });

  it('should format millions', () => {
    expect(formatThroughput(1000000)).toBe('1.00M ops/s');
    expect(formatThroughput(2500000)).toBe('2.50M ops/s');
  });
});

// ============================================================================
// Environment Detection Tests
// ============================================================================

describe('collectEnvironmentInfo', () => {
  it('should collect environment information', () => {
    const info = collectEnvironmentInfo();

    expect(info).toHaveProperty('nodeVersion');
    expect(info).toHaveProperty('platform');
    expect(info).toHaveProperty('arch');
    expect(info).toHaveProperty('totalMemory');
    expect(typeof info.nodeVersion).toBe('string');
    expect(typeof info.platform).toBe('string');
    expect(typeof info.arch).toBe('string');
  });
});

// ============================================================================
// Benchmark Helper Tests
// ============================================================================

describe('runMultiple', () => {
  it('should run function multiple times', async () => {
    let count = 0;
    const fn = async () => {
      count++;
      return count;
    };

    const results = await runMultiple(fn, 5);

    expect(results).toEqual([1, 2, 3, 4, 5]);
    expect(count).toBe(5);
  });

  it('should return empty array for zero count', async () => {
    const fn = async () => 'result';

    const results = await runMultiple(fn, 0);

    expect(results).toEqual([]);
  });
});

describe('runUntil', () => {
  it('should run until condition is met', async () => {
    let count = 0;
    const fn = async () => {
      count++;
      return count;
    };
    const condition = (result: number) => result >= 5;

    const result = await runUntil(fn, condition, 10000);

    expect(result).toBe(5);
    expect(count).toBe(5);
  });

  it('should timeout if condition not met', async () => {
    const fn = async () => 0;
    const condition = (result: number) => result > 0;

    await expect(runUntil(fn, condition, 100)).rejects.toThrow('Timeout after 100ms');
  });
});

describe('withTimeout', () => {
  it('should resolve if promise completes before timeout', async () => {
    const promise = new Promise<string>((resolve) => setTimeout(() => resolve('done'), 10));

    const result = await withTimeout(promise, 1000);

    expect(result).toBe('done');
  });

  it('should reject if promise exceeds timeout', async () => {
    const promise = new Promise<string>((resolve) => setTimeout(() => resolve('done'), 1000));

    await expect(withTimeout(promise, 10)).rejects.toThrow('Operation timed out');
  });

  it('should use custom timeout message', async () => {
    const promise = new Promise<string>((resolve) => setTimeout(() => resolve('done'), 1000));

    await expect(withTimeout(promise, 10, 'Custom timeout')).rejects.toThrow('Custom timeout');
  });
});

describe('delay', () => {
  it('should delay execution', async () => {
    const start = performance.now();

    await delay(50);

    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });
});

// ============================================================================
// Benchmark Comparison Tests
// ============================================================================

describe('compareBenchmarkResults', () => {
  it('should detect improvement', () => {
    const baseline = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 100 } });
    const current = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 80 } });

    const comparison = compareBenchmarkResults(baseline, current);

    expect(comparison.improved).toBe(true);
    expect(comparison.regression).toBe(false);
    expect(comparison.latencyChangePercent).toBe(-20);
  });

  it('should detect regression', () => {
    const baseline = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 100 } });
    const current = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 150 } });

    const comparison = compareBenchmarkResults(baseline, current);

    expect(comparison.improved).toBe(false);
    expect(comparison.regression).toBe(true);
    expect(comparison.latencyChangePercent).toBe(50);
  });

  it('should handle no change', () => {
    const baseline = createMockBenchmarkResult();
    const current = createMockBenchmarkResult();

    const comparison = compareBenchmarkResults(baseline, current);

    expect(comparison.improved).toBe(false);
    expect(comparison.regression).toBe(false);
    expect(comparison.latencyChangePercent).toBe(0);
  });

  it('should handle zero baseline values', () => {
    const baseline = createMockBenchmarkResult({
      latency: { ...createMockBenchmarkResult().latency, p95: 0 },
      throughputPerSec: 0,
    });
    const current = createMockBenchmarkResult();

    const comparison = compareBenchmarkResults(baseline, current);

    expect(comparison.latencyChangePercent).toBe(0);
    expect(comparison.throughputChangePercent).toBe(0);
  });
});

describe('validateAgainstNfrTarget', () => {
  it('should pass when actual is below target', () => {
    const result = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 80 } });

    const validation = validateAgainstNfrTarget(result, 'SEARCH_10K_MS');

    expect(validation.valid).toBe(true);
    expect(validation.status).toBe('pass');
    expect(validation.targetMs).toBe(100);
    expect(validation.actualMs).toBe(80);
    expect(validation.marginMs).toBe(20);
  });

  it('should warn when actual is close to target', () => {
    const result = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 95 } });

    const validation = validateAgainstNfrTarget(result, 'SEARCH_10K_MS');

    expect(validation.valid).toBe(true);
    expect(validation.status).toBe('warning');
    expect(validation.marginPercent).toBeLessThan(10);
  });

  it('should fail when actual exceeds target', () => {
    const result = createMockBenchmarkResult({ latency: { ...createMockBenchmarkResult().latency, p95: 150 } });

    const validation = validateAgainstNfrTarget(result, 'SEARCH_10K_MS');

    expect(validation.valid).toBe(false);
    expect(validation.status).toBe('fail');
    expect(validation.marginMs).toBeLessThan(0);
  });
});

// ============================================================================
// Scale Helper Tests
// ============================================================================

describe('getNodeCountForScale', () => {
  it('should return correct node counts for each scale', () => {
    expect(getNodeCountForScale('1k')).toBe(1000);
    expect(getNodeCountForScale('10k')).toBe(10000);
    expect(getNodeCountForScale('50k')).toBe(50000);
    expect(getNodeCountForScale('100k')).toBe(100000);
  });

  it('should use custom count for custom scale', () => {
    expect(getNodeCountForScale('custom', 25000)).toBe(25000);
  });

  it('should use default for custom scale without count', () => {
    expect(getNodeCountForScale('custom')).toBe(10000);
  });
});

describe('getSearchTargetForScale', () => {
  it('should return correct targets for each scale', () => {
    expect(getSearchTargetForScale('1k')).toBe(50);
    expect(getSearchTargetForScale('10k')).toBe(PERFORMANCE_TARGETS.SEARCH_10K_MS);
    expect(getSearchTargetForScale('50k')).toBe(PERFORMANCE_TARGETS.SEARCH_50K_MS);
    expect(getSearchTargetForScale('100k')).toBe(PERFORMANCE_TARGETS.SEARCH_100K_MS);
  });

  it('should use default for custom scale', () => {
    expect(getSearchTargetForScale('custom')).toBe(PERFORMANCE_TARGETS.SEARCH_10K_MS);
  });
});

// ============================================================================
// PERFORMANCE_TARGETS Tests (NFR-PERF-008)
// ============================================================================

describe('PERFORMANCE_TARGETS', () => {
  it('should have correct NFR-PERF-008 values', () => {
    expect(PERFORMANCE_TARGETS.SEARCH_10K_MS).toBe(100);
    expect(PERFORMANCE_TARGETS.SEARCH_50K_MS).toBe(200);
    expect(PERFORMANCE_TARGETS.SEARCH_100K_MS).toBe(500);
    expect(PERFORMANCE_TARGETS.ROLLUP_DEPTH3_MS).toBe(500);
    expect(PERFORMANCE_TARGETS.SCAN_1000_FILES_MS).toBe(60000);
  });

  it('should have index building targets', () => {
    expect(PERFORMANCE_TARGETS.INDEX_BUILD_1K_MS).toBe(100);
    expect(PERFORMANCE_TARGETS.INDEX_BUILD_10K_MS).toBe(1000);
  });

  it('should have memory budget target', () => {
    expect(PERFORMANCE_TARGETS.MEMORY_10K_NODES_BYTES).toBe(27 * 1024 * 1024);
  });

  it('should have throughput target', () => {
    expect(PERFORMANCE_TARGETS.MIN_THROUGHPUT_NODES_PER_SEC).toBe(10000);
  });

  it('should have diff targets', () => {
    expect(PERFORMANCE_TARGETS.DIFF_10K_NODES_MS).toBe(5000);
    expect(PERFORMANCE_TARGETS.DIFF_100K_LOOKUP_MS).toBe(500);
  });

  it('should be readonly via as const assertion', () => {
    // PERFORMANCE_TARGETS uses 'as const' for compile-time immutability
    expect(typeof PERFORMANCE_TARGETS).toBe('object');
    expect(Object.keys(PERFORMANCE_TARGETS).length).toBeGreaterThan(5);
  });
});
