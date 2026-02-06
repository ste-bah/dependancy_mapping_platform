/**
 * Benchmark Types Schema Tests
 * @module benchmarks/__tests__/types
 *
 * Unit tests for TypeBox schemas, type guards, and factory functions in types.ts.
 * Tests benchmark type definitions, branded IDs, and default configurations.
 *
 * Coverage targets: 90%+ for all type guards and factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  // Branded ID Types
  type BenchmarkRunId,
  type BenchmarkSuiteId,

  // Enums and Constants
  BenchmarkType,
  BenchmarkStatus,
  BenchmarkScale,
  SCALE_NODE_COUNTS,
  SCALE_EDGE_COUNTS,
  DEFAULT_BENCHMARK_CONFIG,
  DEFAULT_THRESHOLDS,
  BenchmarkErrorCodes,

  // Type Guards
  isBenchmarkRunId,
  isBenchmarkSuiteId,
  isBenchmarkType,
  isBenchmarkStatus,
  isBenchmarkScale,
  isBenchmarkResult,
  isBenchmarkRun,
  isAggregatedMetrics,

  // Factory Functions
  createBenchmarkRunId,
  createBenchmarkSuiteId,
  createEmptyAggregatedMetrics,
  createDefaultBenchmarkConfig,
  createEmptyBenchmarkSummary,
  createEnvironmentInfo,
  getThreshold,
  getNodeCount,
  getEdgeCount,

  // Types
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkRun,
  type AggregatedMetrics,
  type BenchmarkSummary,
  type EnvironmentInfo,
  type ThresholdConfig,
} from '../types.js';

// ============================================================================
// Branded ID Type Tests
// ============================================================================

describe('BenchmarkRunId', () => {
  it('should create BenchmarkRunId from string', () => {
    const id = createBenchmarkRunId('run_123');

    expect(id).toBe('run_123');
  });

  it('should be usable as string', () => {
    const id = createBenchmarkRunId('run_456');

    expect(`ID: ${id}`).toBe('ID: run_456');
  });
});

describe('BenchmarkSuiteId', () => {
  it('should create BenchmarkSuiteId from string', () => {
    const id = createBenchmarkSuiteId('suite_123');

    expect(id).toBe('suite_123');
  });
});

// ============================================================================
// BenchmarkType Enum Tests
// ============================================================================

describe('BenchmarkType', () => {
  it('should have all expected types', () => {
    expect(BenchmarkType.SEARCH).toBe('search');
    expect(BenchmarkType.ROLLUP).toBe('rollup');
    expect(BenchmarkType.SCAN).toBe('scan');
    expect(BenchmarkType.TRAVERSAL).toBe('traversal');
    expect(BenchmarkType.QUERY).toBe('query');
    expect(BenchmarkType.API).toBe('api');
  });

  it('should be readonly via as const assertion', () => {
    expect(typeof BenchmarkType).toBe('object');
    expect(Object.keys(BenchmarkType).length).toBe(6);
  });
});

describe('isBenchmarkType', () => {
  it('should return true for valid types', () => {
    expect(isBenchmarkType('search')).toBe(true);
    expect(isBenchmarkType('rollup')).toBe(true);
    expect(isBenchmarkType('scan')).toBe(true);
    expect(isBenchmarkType('traversal')).toBe(true);
    expect(isBenchmarkType('query')).toBe(true);
    expect(isBenchmarkType('api')).toBe(true);
  });

  it('should return false for invalid types', () => {
    expect(isBenchmarkType('invalid')).toBe(false);
    expect(isBenchmarkType('SEARCH')).toBe(false);
    expect(isBenchmarkType('')).toBe(false);
    expect(isBenchmarkType(null)).toBe(false);
    expect(isBenchmarkType(undefined)).toBe(false);
    expect(isBenchmarkType(123)).toBe(false);
  });
});

// ============================================================================
// BenchmarkStatus Enum Tests
// ============================================================================

describe('BenchmarkStatus', () => {
  it('should have all expected statuses', () => {
    expect(BenchmarkStatus.PENDING).toBe('pending');
    expect(BenchmarkStatus.RUNNING).toBe('running');
    expect(BenchmarkStatus.COMPLETED).toBe('completed');
    expect(BenchmarkStatus.FAILED).toBe('failed');
    expect(BenchmarkStatus.CANCELLED).toBe('cancelled');
  });
});

describe('isBenchmarkStatus', () => {
  it('should return true for valid statuses', () => {
    expect(isBenchmarkStatus('pending')).toBe(true);
    expect(isBenchmarkStatus('running')).toBe(true);
    expect(isBenchmarkStatus('completed')).toBe(true);
    expect(isBenchmarkStatus('failed')).toBe(true);
    expect(isBenchmarkStatus('cancelled')).toBe(true);
  });

  it('should return false for invalid statuses', () => {
    expect(isBenchmarkStatus('invalid')).toBe(false);
    expect(isBenchmarkStatus('RUNNING')).toBe(false);
    expect(isBenchmarkStatus('')).toBe(false);
    expect(isBenchmarkStatus(null)).toBe(false);
  });
});

// ============================================================================
// BenchmarkScale Enum Tests
// ============================================================================

describe('BenchmarkScale', () => {
  it('should have all expected scales', () => {
    expect(BenchmarkScale.SMALL).toBe('small');
    expect(BenchmarkScale.MEDIUM).toBe('medium');
    expect(BenchmarkScale.LARGE).toBe('large');
    expect(BenchmarkScale.XLARGE).toBe('xlarge');
  });
});

describe('isBenchmarkScale', () => {
  it('should return true for valid scales', () => {
    expect(isBenchmarkScale('small')).toBe(true);
    expect(isBenchmarkScale('medium')).toBe(true);
    expect(isBenchmarkScale('large')).toBe(true);
    expect(isBenchmarkScale('xlarge')).toBe(true);
  });

  it('should return false for invalid scales', () => {
    expect(isBenchmarkScale('1k')).toBe(false);
    expect(isBenchmarkScale('10k')).toBe(false);
    expect(isBenchmarkScale('SMALL')).toBe(false);
    expect(isBenchmarkScale('')).toBe(false);
    expect(isBenchmarkScale(null)).toBe(false);
  });
});

// ============================================================================
// Scale Constants Tests
// ============================================================================

describe('SCALE_NODE_COUNTS', () => {
  it('should have correct node counts for each scale', () => {
    expect(SCALE_NODE_COUNTS.small).toBe(100);
    expect(SCALE_NODE_COUNTS.medium).toBe(1000);
    expect(SCALE_NODE_COUNTS.large).toBe(10000);
    expect(SCALE_NODE_COUNTS.xlarge).toBe(100000);
  });
});

describe('SCALE_EDGE_COUNTS', () => {
  it('should have correct edge counts for each scale', () => {
    expect(SCALE_EDGE_COUNTS.small).toBe(200);
    expect(SCALE_EDGE_COUNTS.medium).toBe(3000);
    expect(SCALE_EDGE_COUNTS.large).toBe(30000);
    expect(SCALE_EDGE_COUNTS.xlarge).toBe(300000);
  });
});

// ============================================================================
// ID Type Guard Tests
// ============================================================================

describe('isBenchmarkRunId', () => {
  it('should return true for non-empty strings', () => {
    expect(isBenchmarkRunId('run_123')).toBe(true);
    expect(isBenchmarkRunId('any-string')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isBenchmarkRunId('')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isBenchmarkRunId(null)).toBe(false);
    expect(isBenchmarkRunId(undefined)).toBe(false);
    expect(isBenchmarkRunId(123)).toBe(false);
    expect(isBenchmarkRunId({})).toBe(false);
  });
});

describe('isBenchmarkSuiteId', () => {
  it('should return true for non-empty strings', () => {
    expect(isBenchmarkSuiteId('suite_123')).toBe(true);
    expect(isBenchmarkSuiteId('any-string')).toBe(true);
  });

  it('should return false for empty string', () => {
    expect(isBenchmarkSuiteId('')).toBe(false);
  });

  it('should return false for non-strings', () => {
    expect(isBenchmarkSuiteId(null)).toBe(false);
    expect(isBenchmarkSuiteId(undefined)).toBe(false);
    expect(isBenchmarkSuiteId(123)).toBe(false);
  });
});

// ============================================================================
// isAggregatedMetrics Tests
// ============================================================================

describe('isAggregatedMetrics', () => {
  it('should return true for valid metrics', () => {
    const metrics = createEmptyAggregatedMetrics();

    expect(isAggregatedMetrics(metrics)).toBe(true);
  });

  it('should return true for minimal valid object', () => {
    const metrics = {
      count: 10,
      min: 1,
      max: 100,
      mean: 50,
      p95: 90,
      throughput: 20,
    };

    expect(isAggregatedMetrics(metrics)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isAggregatedMetrics(null)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isAggregatedMetrics('string')).toBe(false);
    expect(isAggregatedMetrics(123)).toBe(false);
  });

  it('should return false for missing count', () => {
    const metrics = {
      min: 1,
      max: 100,
      mean: 50,
      p95: 90,
      throughput: 20,
    };

    expect(isAggregatedMetrics(metrics)).toBe(false);
  });

  it('should return false for missing throughput', () => {
    const metrics = {
      count: 10,
      min: 1,
      max: 100,
      mean: 50,
      p95: 90,
    };

    expect(isAggregatedMetrics(metrics)).toBe(false);
  });
});

// ============================================================================
// isBenchmarkResult Tests (types.ts version)
// ============================================================================

describe('isBenchmarkResult (types.ts)', () => {
  it('should return true for valid result', () => {
    const result = {
      name: 'test',
      type: 'search',
      timing: createEmptyAggregatedMetrics(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(true);
  });

  it('should return false for missing name', () => {
    const result = {
      type: 'search',
      timing: createEmptyAggregatedMetrics(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for missing type', () => {
    const result = {
      name: 'test',
      timing: createEmptyAggregatedMetrics(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for missing timing', () => {
    const result = {
      name: 'test',
      type: 'search',
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for missing passed', () => {
    const result = {
      name: 'test',
      type: 'search',
      timing: createEmptyAggregatedMetrics(),
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });
});

// ============================================================================
// isBenchmarkRun Tests
// ============================================================================

describe('isBenchmarkRun', () => {
  it('should return true for valid run', () => {
    const run = {
      id: 'run_123',
      status: 'completed',
      results: [],
      summary: createEmptyBenchmarkSummary(),
    };

    expect(isBenchmarkRun(run)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isBenchmarkRun(null)).toBe(false);
  });

  it('should return false for missing id', () => {
    const run = {
      status: 'completed',
      results: [],
      summary: createEmptyBenchmarkSummary(),
    };

    expect(isBenchmarkRun(run)).toBe(false);
  });

  it('should return false for missing status', () => {
    const run = {
      id: 'run_123',
      results: [],
      summary: createEmptyBenchmarkSummary(),
    };

    expect(isBenchmarkRun(run)).toBe(false);
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createEmptyAggregatedMetrics', () => {
  it('should create empty metrics with all zeros', () => {
    const metrics = createEmptyAggregatedMetrics();

    expect(metrics.count).toBe(0);
    expect(metrics.min).toBe(0);
    expect(metrics.max).toBe(0);
    expect(metrics.mean).toBe(0);
    expect(metrics.stdDev).toBe(0);
    expect(metrics.p50).toBe(0);
    expect(metrics.p90).toBe(0);
    expect(metrics.p95).toBe(0);
    expect(metrics.p99).toBe(0);
    expect(metrics.throughput).toBe(0);
    expect(metrics.variance).toBe(0);
  });
});

describe('createDefaultBenchmarkConfig', () => {
  it('should create config with defaults', () => {
    const config = createDefaultBenchmarkConfig();

    expect(config.iterations).toBe(DEFAULT_BENCHMARK_CONFIG.iterations);
    expect(config.warmupIterations).toBe(DEFAULT_BENCHMARK_CONFIG.warmupIterations);
    expect(config.timeoutMs).toBe(DEFAULT_BENCHMARK_CONFIG.timeoutMs);
    expect(config.scale).toBe(DEFAULT_BENCHMARK_CONFIG.scale);
  });

  it('should allow overrides', () => {
    const config = createDefaultBenchmarkConfig({
      iterations: 50,
      scale: 'large',
    });

    expect(config.iterations).toBe(50);
    expect(config.scale).toBe('large');
    expect(config.warmupIterations).toBe(DEFAULT_BENCHMARK_CONFIG.warmupIterations);
  });
});

describe('createEmptyBenchmarkSummary', () => {
  it('should create empty summary', () => {
    const summary = createEmptyBenchmarkSummary();

    expect(summary.totalBenchmarks).toBe(0);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(0);
    expect(summary.passRate).toBe(0);
    expect(summary.totalIterations).toBe(0);
    expect(summary.averageThroughput).toBe(0);
  });
});

describe('createEnvironmentInfo', () => {
  it('should create environment info', async () => {
    const info = await createEnvironmentInfo();

    expect(info.nodeVersion).toBeDefined();
    expect(info.platform).toBeDefined();
    expect(info.arch).toBeDefined();
    expect(info.cpus).toBeGreaterThan(0);
    expect(info.totalMemory).toBeGreaterThan(0);
    expect(info.freeMemory).toBeGreaterThanOrEqual(0);
  });

  it('should include hostname', async () => {
    const info = await createEnvironmentInfo();

    expect(info.hostname).toBeDefined();
    expect(typeof info.hostname).toBe('string');
  });
});

// ============================================================================
// Threshold Functions Tests
// ============================================================================

describe('getThreshold', () => {
  it('should return correct threshold for search/small', () => {
    const threshold = getThreshold('search', 'small');

    expect(threshold.type).toBe('search');
    expect(threshold.scale).toBe('small');
    expect(threshold.p95Threshold).toBe(10);
    expect(threshold.minThroughput).toBe(1000);
  });

  it('should return correct threshold for rollup/large', () => {
    const threshold = getThreshold('rollup', 'large');

    expect(threshold.type).toBe('rollup');
    expect(threshold.scale).toBe('large');
    expect(threshold.p95Threshold).toBe(2000);
  });

  it('should return correct threshold for scan/xlarge', () => {
    const threshold = getThreshold('scan', 'xlarge');

    expect(threshold.type).toBe('scan');
    expect(threshold.scale).toBe('xlarge');
    expect(threshold.p95Threshold).toBe(60000);
  });

  it('should return thresholds for all type/scale combinations', () => {
    const types: BenchmarkType[] = ['search', 'rollup', 'scan', 'traversal', 'query', 'api'];
    const scales: BenchmarkScale[] = ['small', 'medium', 'large', 'xlarge'];

    for (const type of types) {
      for (const scale of scales) {
        const threshold = getThreshold(type as BenchmarkType, scale as BenchmarkScale);

        expect(threshold).toBeDefined();
        expect(threshold.type).toBe(type);
        expect(threshold.scale).toBe(scale);
        expect(threshold.p95Threshold).toBeGreaterThan(0);
      }
    }
  });
});

describe('getNodeCount', () => {
  it('should return correct node counts', () => {
    expect(getNodeCount('small')).toBe(100);
    expect(getNodeCount('medium')).toBe(1000);
    expect(getNodeCount('large')).toBe(10000);
    expect(getNodeCount('xlarge')).toBe(100000);
  });
});

describe('getEdgeCount', () => {
  it('should return correct edge counts', () => {
    expect(getEdgeCount('small')).toBe(200);
    expect(getEdgeCount('medium')).toBe(3000);
    expect(getEdgeCount('large')).toBe(30000);
    expect(getEdgeCount('xlarge')).toBe(300000);
  });
});

// ============================================================================
// DEFAULT_BENCHMARK_CONFIG Tests
// ============================================================================

describe('DEFAULT_BENCHMARK_CONFIG', () => {
  it('should have all required properties', () => {
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('iterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('warmupIterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('timeoutMs');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('scale');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('collectMemoryMetrics');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('collectCpuMetrics');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('delayBetweenIterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('gcBeforeIteration');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('tags');
  });

  it('should have sensible defaults', () => {
    expect(DEFAULT_BENCHMARK_CONFIG.iterations).toBe(100);
    expect(DEFAULT_BENCHMARK_CONFIG.warmupIterations).toBe(10);
    expect(DEFAULT_BENCHMARK_CONFIG.timeoutMs).toBe(30000);
    expect(DEFAULT_BENCHMARK_CONFIG.scale).toBe('medium');
    expect(DEFAULT_BENCHMARK_CONFIG.collectMemoryMetrics).toBe(true);
    expect(DEFAULT_BENCHMARK_CONFIG.collectCpuMetrics).toBe(false);
    expect(DEFAULT_BENCHMARK_CONFIG.delayBetweenIterations).toBe(0);
    expect(DEFAULT_BENCHMARK_CONFIG.gcBeforeIteration).toBe(false);
    expect(DEFAULT_BENCHMARK_CONFIG.tags).toEqual([]);
  });
});

// ============================================================================
// DEFAULT_THRESHOLDS Tests
// ============================================================================

describe('DEFAULT_THRESHOLDS', () => {
  it('should have thresholds for all benchmark types', () => {
    expect(DEFAULT_THRESHOLDS).toHaveProperty('search');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('rollup');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('scan');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('traversal');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('query');
    expect(DEFAULT_THRESHOLDS).toHaveProperty('api');
  });

  it('should have all scales for each type', () => {
    const types = ['search', 'rollup', 'scan', 'traversal', 'query', 'api'];

    for (const type of types) {
      expect(DEFAULT_THRESHOLDS[type as BenchmarkType]).toHaveProperty('small');
      expect(DEFAULT_THRESHOLDS[type as BenchmarkType]).toHaveProperty('medium');
      expect(DEFAULT_THRESHOLDS[type as BenchmarkType]).toHaveProperty('large');
      expect(DEFAULT_THRESHOLDS[type as BenchmarkType]).toHaveProperty('xlarge');
    }
  });

  it('should have increasing thresholds as scale increases', () => {
    const searchThresholds = DEFAULT_THRESHOLDS.search;

    expect(searchThresholds.small.p95Threshold).toBeLessThan(searchThresholds.medium.p95Threshold);
    expect(searchThresholds.medium.p95Threshold).toBeLessThan(searchThresholds.large.p95Threshold);
    expect(searchThresholds.large.p95Threshold).toBeLessThan(searchThresholds.xlarge.p95Threshold);
  });

  it('should have decreasing throughput as scale increases', () => {
    const searchThresholds = DEFAULT_THRESHOLDS.search;

    expect(searchThresholds.small.minThroughput).toBeGreaterThan(searchThresholds.medium.minThroughput);
    expect(searchThresholds.medium.minThroughput).toBeGreaterThan(searchThresholds.large.minThroughput);
    expect(searchThresholds.large.minThroughput).toBeGreaterThan(searchThresholds.xlarge.minThroughput);
  });
});

// ============================================================================
// BenchmarkErrorCodes Tests
// ============================================================================

describe('BenchmarkErrorCodes', () => {
  it('should have execution error codes', () => {
    expect(BenchmarkErrorCodes.EXECUTION_FAILED).toBe('BENCHMARK_EXECUTION_FAILED');
    expect(BenchmarkErrorCodes.EXECUTION_TIMEOUT).toBe('BENCHMARK_EXECUTION_TIMEOUT');
    expect(BenchmarkErrorCodes.ITERATION_FAILED).toBe('BENCHMARK_ITERATION_FAILED');
  });

  it('should have validation error codes', () => {
    expect(BenchmarkErrorCodes.INVALID_CONFIGURATION).toBe('BENCHMARK_INVALID_CONFIGURATION');
    expect(BenchmarkErrorCodes.INVALID_THRESHOLD).toBe('BENCHMARK_INVALID_THRESHOLD');
    expect(BenchmarkErrorCodes.INVALID_SCALE).toBe('BENCHMARK_INVALID_SCALE');
  });

  it('should have resource error codes', () => {
    expect(BenchmarkErrorCodes.RUN_NOT_FOUND).toBe('BENCHMARK_RUN_NOT_FOUND');
    expect(BenchmarkErrorCodes.SUITE_NOT_FOUND).toBe('BENCHMARK_SUITE_NOT_FOUND');
  });

  it('should have threshold error codes', () => {
    expect(BenchmarkErrorCodes.THRESHOLD_EXCEEDED).toBe('BENCHMARK_THRESHOLD_EXCEEDED');
    expect(BenchmarkErrorCodes.REGRESSION_DETECTED).toBe('BENCHMARK_REGRESSION_DETECTED');
  });

  it('should have system error codes', () => {
    expect(BenchmarkErrorCodes.OUT_OF_MEMORY).toBe('BENCHMARK_OUT_OF_MEMORY');
    expect(BenchmarkErrorCodes.SETUP_FAILED).toBe('BENCHMARK_SETUP_FAILED');
    expect(BenchmarkErrorCodes.TEARDOWN_FAILED).toBe('BENCHMARK_TEARDOWN_FAILED');
  });

  it('should be readonly via as const assertion', () => {
    expect(typeof BenchmarkErrorCodes).toBe('object');
    expect(Object.keys(BenchmarkErrorCodes).length).toBeGreaterThan(5);
  });
});

// ============================================================================
// Type Structure Tests
// ============================================================================

describe('type structures', () => {
  it('should allow creating valid BenchmarkConfig', () => {
    const config: BenchmarkConfig = {
      iterations: 50,
      warmupIterations: 5,
      timeoutMs: 10000,
      scale: 'medium',
      collectMemoryMetrics: true,
      collectCpuMetrics: false,
      delayBetweenIterations: 0,
      gcBeforeIteration: false,
      tags: ['test'],
    };

    expect(config.iterations).toBe(50);
    expect(config.scale).toBe('medium');
  });

  it('should allow creating valid ThresholdConfig', () => {
    const threshold: ThresholdConfig = {
      type: 'search',
      scale: 'large',
      p95Threshold: 200,
      p99Threshold: 500,
      meanThreshold: 100,
      minThroughput: 100,
    };

    expect(threshold.type).toBe('search');
    expect(threshold.p95Threshold).toBe(200);
  });

  it('should allow creating valid EnvironmentInfo', () => {
    const env: EnvironmentInfo = {
      nodeVersion: 'v20.0.0',
      platform: 'linux',
      arch: 'x64',
      cpus: 8,
      totalMemory: 16 * 1024 * 1024 * 1024,
      freeMemory: 8 * 1024 * 1024 * 1024,
      hostname: 'test-host',
      gitCommit: 'abc123',
      gitBranch: 'main',
    };

    expect(env.nodeVersion).toBe('v20.0.0');
    expect(env.cpus).toBe(8);
  });
});
