/**
 * Benchmark Types Tests
 * @module benchmarks/__tests__/benchmark-types
 *
 * Unit tests for benchmark type definitions, type guards, and factory functions.
 * Validates NFR-PERF-008 performance targets and schema validation.
 *
 * Coverage targets: 90%+ for all type guards and factory functions
 */

import { describe, it, expect } from 'vitest';
import {
  // Performance Targets
  PERFORMANCE_TARGETS,
  type PerformanceTargetKey,

  // Benchmark Config
  DEFAULT_BENCHMARK_CONFIG,
  type BenchmarkConfig,
  type BenchmarkScale,

  // Result Types
  type BenchmarkResult,
  type BenchmarkIteration,
  type PercentileStats,

  // Suite Types
  type BenchmarkSuiteType,
  type BenchmarkSuite,
  type BenchmarkDefinition,

  // Report Types
  type BenchmarkReport,
  type BenchmarkEnvironment,
  type BenchmarkSummary,
  type BenchmarkSuiteResult,
  type TargetComparisonResult,

  // Runner Types
  type BenchmarkRunnerOptions,
  DEFAULT_RUNNER_OPTIONS,

  // Progress Types
  type BenchmarkProgress,
  type BenchmarkProgressCallback,

  // Type Guards
  isBenchmarkResult,
  isBenchmarkSuite,
  isBenchmarkReport,
  isValidScale,
  isValidSuiteType,
} from '../benchmark-types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockPercentileStats = (): PercentileStats => ({
  min: 10,
  max: 100,
  avg: 50,
  p50: 45,
  p75: 60,
  p90: 80,
  p95: 90,
  p99: 95,
  stdDev: 15,
});

const createMockBenchmarkIteration = (overrides: Partial<BenchmarkIteration> = {}): BenchmarkIteration => ({
  index: 0,
  latencyMs: 50,
  isWarmup: false,
  ...overrides,
});

const createMockBenchmarkResult = (overrides: Partial<BenchmarkResult> = {}): BenchmarkResult => ({
  name: 'test-benchmark',
  suite: 'test-suite',
  iterations: 100,
  warmupIterations: 10,
  latency: createMockPercentileStats(),
  throughputPerSec: 20,
  iterationResults: [createMockBenchmarkIteration()],
  passed: true,
  timestamp: new Date(),
  totalDurationMs: 5000,
  config: { ...DEFAULT_BENCHMARK_CONFIG },
  ...overrides,
});

const createMockBenchmarkDefinition = (): BenchmarkDefinition => ({
  name: 'test-definition',
  description: 'Test benchmark definition',
  fn: async () => { },
  target: 'SEARCH_10K_MS',
  enabled: true,
  tags: ['test'],
});

const createMockBenchmarkSuite = (): BenchmarkSuite => ({
  name: 'test-suite',
  description: 'Test benchmark suite',
  type: 'search',
  benchmarks: [createMockBenchmarkDefinition()],
});

const createMockBenchmarkEnvironment = (): BenchmarkEnvironment => ({
  nodeVersion: 'v20.0.0',
  platform: 'linux',
  arch: 'x64',
  totalMemory: 16 * 1024 * 1024 * 1024,
  freeMemory: 8 * 1024 * 1024 * 1024,
  cpuModel: 'Intel Core i7',
  cpuCores: 8,
});

const createMockBenchmarkSummary = (): BenchmarkSummary => ({
  totalBenchmarks: 10,
  passed: 8,
  failed: 2,
  skipped: 0,
  totalDurationMs: 60000,
  passRate: 0.8,
  criticalFailures: 1,
});

const createMockBenchmarkSuiteResult = (): BenchmarkSuiteResult => ({
  suiteName: 'search',
  suiteType: 'search',
  results: [createMockBenchmarkResult()],
  durationMs: 10000,
  passed: true,
});

const createMockTargetComparison = (): TargetComparisonResult => ({
  target: 'SEARCH_10K_MS',
  targetMs: 100,
  actualMs: 80,
  passed: true,
  percentage: 80,
  marginMs: 20,
  status: 'normal',
});

const createMockBenchmarkReport = (): BenchmarkReport => ({
  title: 'Test Report',
  generatedAt: new Date(),
  environment: createMockBenchmarkEnvironment(),
  summary: createMockBenchmarkSummary(),
  suiteResults: [createMockBenchmarkSuiteResult()],
  targetComparison: [createMockTargetComparison()],
});

// ============================================================================
// PERFORMANCE_TARGETS Tests
// ============================================================================

describe('PERFORMANCE_TARGETS', () => {
  it('should have all required NFR-PERF-008 targets', () => {
    expect(PERFORMANCE_TARGETS).toHaveProperty('SEARCH_10K_MS');
    expect(PERFORMANCE_TARGETS).toHaveProperty('SEARCH_50K_MS');
    expect(PERFORMANCE_TARGETS).toHaveProperty('SEARCH_100K_MS');
    expect(PERFORMANCE_TARGETS).toHaveProperty('ROLLUP_DEPTH3_MS');
    expect(PERFORMANCE_TARGETS).toHaveProperty('SCAN_1000_FILES_MS');
  });

  it('should have correct search target values', () => {
    expect(PERFORMANCE_TARGETS.SEARCH_10K_MS).toBe(100);
    expect(PERFORMANCE_TARGETS.SEARCH_50K_MS).toBe(200);
    expect(PERFORMANCE_TARGETS.SEARCH_100K_MS).toBe(500);
  });

  it('should have correct rollup target value', () => {
    expect(PERFORMANCE_TARGETS.ROLLUP_DEPTH3_MS).toBe(500);
  });

  it('should have correct scan target value', () => {
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
    // PERFORMANCE_TARGETS is defined with 'as const' which makes it readonly at compile time
    // At runtime, we verify the object has expected structure (immutability is TypeScript-enforced)
    expect(typeof PERFORMANCE_TARGETS).toBe('object');
    expect(Object.keys(PERFORMANCE_TARGETS).length).toBeGreaterThan(5);
  });

  it('should allow type-safe access via PerformanceTargetKey', () => {
    const keys: PerformanceTargetKey[] = [
      'SEARCH_10K_MS',
      'SEARCH_50K_MS',
      'SEARCH_100K_MS',
      'ROLLUP_DEPTH3_MS',
      'SCAN_1000_FILES_MS',
    ];

    for (const key of keys) {
      expect(typeof PERFORMANCE_TARGETS[key]).toBe('number');
    }
  });
});

// ============================================================================
// DEFAULT_BENCHMARK_CONFIG Tests
// ============================================================================

describe('DEFAULT_BENCHMARK_CONFIG', () => {
  it('should have all required config properties', () => {
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('iterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('warmupIterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('measureMemory');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('forceGcBetweenIterations');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('iterationDelayMs');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('timeoutMs');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('enableParallel');
    expect(DEFAULT_BENCHMARK_CONFIG).toHaveProperty('scale');
  });

  it('should have sensible default values', () => {
    expect(DEFAULT_BENCHMARK_CONFIG.iterations).toBe(100);
    expect(DEFAULT_BENCHMARK_CONFIG.warmupIterations).toBe(10);
    expect(DEFAULT_BENCHMARK_CONFIG.measureMemory).toBe(true);
    expect(DEFAULT_BENCHMARK_CONFIG.forceGcBetweenIterations).toBe(false);
    expect(DEFAULT_BENCHMARK_CONFIG.iterationDelayMs).toBe(0);
    expect(DEFAULT_BENCHMARK_CONFIG.timeoutMs).toBe(60000);
    expect(DEFAULT_BENCHMARK_CONFIG.enableParallel).toBe(false);
    expect(DEFAULT_BENCHMARK_CONFIG.scale).toBe('10k');
  });
});

// ============================================================================
// DEFAULT_RUNNER_OPTIONS Tests
// ============================================================================

describe('DEFAULT_RUNNER_OPTIONS', () => {
  it('should have all required options', () => {
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('suites');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('scale');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('format');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('verbose');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('skipWarmup');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('iterations');
    expect(DEFAULT_RUNNER_OPTIONS).toHaveProperty('failFast');
  });

  it('should have sensible default values', () => {
    expect(DEFAULT_RUNNER_OPTIONS.suites).toEqual(['all']);
    expect(DEFAULT_RUNNER_OPTIONS.scale).toBe('10k');
    expect(DEFAULT_RUNNER_OPTIONS.format).toBe('table');
    expect(DEFAULT_RUNNER_OPTIONS.verbose).toBe(false);
    expect(DEFAULT_RUNNER_OPTIONS.skipWarmup).toBe(false);
    expect(DEFAULT_RUNNER_OPTIONS.iterations).toBe(100);
    expect(DEFAULT_RUNNER_OPTIONS.failFast).toBe(false);
  });
});

// ============================================================================
// isBenchmarkResult Type Guard Tests
// ============================================================================

describe('isBenchmarkResult', () => {
  it('should return true for valid BenchmarkResult', () => {
    const result = createMockBenchmarkResult();

    expect(isBenchmarkResult(result)).toBe(true);
  });

  it('should return true for minimal BenchmarkResult', () => {
    const result = {
      name: 'test',
      suite: 'test',
      iterations: 10,
      latency: createMockPercentileStats(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isBenchmarkResult(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBenchmarkResult(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isBenchmarkResult('string')).toBe(false);
    expect(isBenchmarkResult(123)).toBe(false);
    expect(isBenchmarkResult(true)).toBe(false);
  });

  it('should return false for object missing name', () => {
    const result = {
      suite: 'test',
      iterations: 10,
      latency: createMockPercentileStats(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for object missing suite', () => {
    const result = {
      name: 'test',
      iterations: 10,
      latency: createMockPercentileStats(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for object missing iterations', () => {
    const result = {
      name: 'test',
      suite: 'test',
      latency: createMockPercentileStats(),
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for object missing latency', () => {
    const result = {
      name: 'test',
      suite: 'test',
      iterations: 10,
      passed: true,
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for object missing passed', () => {
    const result = {
      name: 'test',
      suite: 'test',
      iterations: 10,
      latency: createMockPercentileStats(),
    };

    expect(isBenchmarkResult(result)).toBe(false);
  });

  it('should return false for empty object', () => {
    expect(isBenchmarkResult({})).toBe(false);
  });

  it('should return false for array', () => {
    expect(isBenchmarkResult([])).toBe(false);
  });
});

// ============================================================================
// isBenchmarkSuite Type Guard Tests
// ============================================================================

describe('isBenchmarkSuite', () => {
  it('should return true for valid BenchmarkSuite', () => {
    const suite = createMockBenchmarkSuite();

    expect(isBenchmarkSuite(suite)).toBe(true);
  });

  it('should return true for minimal BenchmarkSuite', () => {
    const suite = {
      name: 'test',
      type: 'search',
      benchmarks: [],
    };

    expect(isBenchmarkSuite(suite)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isBenchmarkSuite(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBenchmarkSuite(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isBenchmarkSuite('string')).toBe(false);
    expect(isBenchmarkSuite(123)).toBe(false);
  });

  it('should return false for object missing name', () => {
    const suite = {
      type: 'search',
      benchmarks: [],
    };

    expect(isBenchmarkSuite(suite)).toBe(false);
  });

  it('should return false for object missing type', () => {
    const suite = {
      name: 'test',
      benchmarks: [],
    };

    expect(isBenchmarkSuite(suite)).toBe(false);
  });

  it('should return false for object missing benchmarks', () => {
    const suite = {
      name: 'test',
      type: 'search',
    };

    expect(isBenchmarkSuite(suite)).toBe(false);
  });

  it('should return false for object with non-array benchmarks', () => {
    const suite = {
      name: 'test',
      type: 'search',
      benchmarks: 'not-an-array',
    };

    expect(isBenchmarkSuite(suite)).toBe(false);
  });
});

// ============================================================================
// isBenchmarkReport Type Guard Tests
// ============================================================================

describe('isBenchmarkReport', () => {
  it('should return true for valid BenchmarkReport', () => {
    const report = createMockBenchmarkReport();

    expect(isBenchmarkReport(report)).toBe(true);
  });

  it('should return true for minimal BenchmarkReport', () => {
    const report = {
      title: 'Test',
      generatedAt: new Date(),
      environment: createMockBenchmarkEnvironment(),
      summary: createMockBenchmarkSummary(),
      suiteResults: [],
    };

    expect(isBenchmarkReport(report)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isBenchmarkReport(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isBenchmarkReport(undefined)).toBe(false);
  });

  it('should return false for non-object', () => {
    expect(isBenchmarkReport('string')).toBe(false);
  });

  it('should return false for object missing title', () => {
    const report = {
      generatedAt: new Date(),
      environment: createMockBenchmarkEnvironment(),
      summary: createMockBenchmarkSummary(),
      suiteResults: [],
    };

    expect(isBenchmarkReport(report)).toBe(false);
  });

  it('should return false for object missing generatedAt', () => {
    const report = {
      title: 'Test',
      environment: createMockBenchmarkEnvironment(),
      summary: createMockBenchmarkSummary(),
      suiteResults: [],
    };

    expect(isBenchmarkReport(report)).toBe(false);
  });

  it('should return false for object missing environment', () => {
    const report = {
      title: 'Test',
      generatedAt: new Date(),
      summary: createMockBenchmarkSummary(),
      suiteResults: [],
    };

    expect(isBenchmarkReport(report)).toBe(false);
  });

  it('should return false for object missing summary', () => {
    const report = {
      title: 'Test',
      generatedAt: new Date(),
      environment: createMockBenchmarkEnvironment(),
      suiteResults: [],
    };

    expect(isBenchmarkReport(report)).toBe(false);
  });

  it('should return false for object missing suiteResults', () => {
    const report = {
      title: 'Test',
      generatedAt: new Date(),
      environment: createMockBenchmarkEnvironment(),
      summary: createMockBenchmarkSummary(),
    };

    expect(isBenchmarkReport(report)).toBe(false);
  });
});

// ============================================================================
// isValidScale Type Guard Tests
// ============================================================================

describe('isValidScale', () => {
  it('should return true for valid scales', () => {
    expect(isValidScale('1k')).toBe(true);
    expect(isValidScale('10k')).toBe(true);
    expect(isValidScale('50k')).toBe(true);
    expect(isValidScale('100k')).toBe(true);
    expect(isValidScale('custom')).toBe(true);
  });

  it('should return false for invalid scales', () => {
    expect(isValidScale('5k')).toBe(false);
    expect(isValidScale('1000k')).toBe(false);
    expect(isValidScale('small')).toBe(false);
    expect(isValidScale('large')).toBe(false);
    expect(isValidScale('')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidScale(null)).toBe(false);
    expect(isValidScale(undefined)).toBe(false);
    expect(isValidScale(10)).toBe(false);
    expect(isValidScale(true)).toBe(false);
    expect(isValidScale({})).toBe(false);
    expect(isValidScale([])).toBe(false);
  });

  it('should be usable as type guard', () => {
    const value: unknown = '10k';

    if (isValidScale(value)) {
      // TypeScript should narrow type to BenchmarkScale
      const scale: BenchmarkScale = value;
      expect(scale).toBe('10k');
    } else {
      throw new Error('Expected value to be valid scale');
    }
  });
});

// ============================================================================
// isValidSuiteType Type Guard Tests
// ============================================================================

describe('isValidSuiteType', () => {
  it('should return true for valid suite types', () => {
    expect(isValidSuiteType('search')).toBe(true);
    expect(isValidSuiteType('rollup')).toBe(true);
    expect(isValidSuiteType('scan')).toBe(true);
    expect(isValidSuiteType('diff')).toBe(true);
    expect(isValidSuiteType('index')).toBe(true);
    expect(isValidSuiteType('memory')).toBe(true);
    expect(isValidSuiteType('all')).toBe(true);
  });

  it('should return false for invalid suite types', () => {
    expect(isValidSuiteType('benchmark')).toBe(false);
    expect(isValidSuiteType('performance')).toBe(false);
    expect(isValidSuiteType('unit')).toBe(false);
    expect(isValidSuiteType('')).toBe(false);
    expect(isValidSuiteType('SEARCH')).toBe(false);
  });

  it('should return false for non-string values', () => {
    expect(isValidSuiteType(null)).toBe(false);
    expect(isValidSuiteType(undefined)).toBe(false);
    expect(isValidSuiteType(10)).toBe(false);
    expect(isValidSuiteType(true)).toBe(false);
    expect(isValidSuiteType({})).toBe(false);
  });

  it('should be usable as type guard', () => {
    const value: unknown = 'search';

    if (isValidSuiteType(value)) {
      // TypeScript should narrow type to BenchmarkSuiteType
      const suiteType: BenchmarkSuiteType = value;
      expect(suiteType).toBe('search');
    } else {
      throw new Error('Expected value to be valid suite type');
    }
  });
});

// ============================================================================
// Type Structure Tests
// ============================================================================

describe('BenchmarkIteration type structure', () => {
  it('should have correct shape', () => {
    const iteration: BenchmarkIteration = createMockBenchmarkIteration();

    expect(iteration).toHaveProperty('index');
    expect(iteration).toHaveProperty('latencyMs');
    expect(iteration).toHaveProperty('isWarmup');
  });

  it('should support optional memoryBytes', () => {
    const iteration: BenchmarkIteration = createMockBenchmarkIteration({
      memoryBytes: 1024,
    });

    expect(iteration.memoryBytes).toBe(1024);
  });

  it('should support optional error', () => {
    const error = new Error('Test error');
    const iteration: BenchmarkIteration = createMockBenchmarkIteration({
      error,
    });

    expect(iteration.error).toBe(error);
  });
});

describe('PercentileStats type structure', () => {
  it('should have all required percentile fields', () => {
    const stats: PercentileStats = createMockPercentileStats();

    expect(stats).toHaveProperty('min');
    expect(stats).toHaveProperty('max');
    expect(stats).toHaveProperty('avg');
    expect(stats).toHaveProperty('p50');
    expect(stats).toHaveProperty('p75');
    expect(stats).toHaveProperty('p90');
    expect(stats).toHaveProperty('p95');
    expect(stats).toHaveProperty('p99');
    expect(stats).toHaveProperty('stdDev');
  });

  it('should have correct types for all fields', () => {
    const stats: PercentileStats = createMockPercentileStats();

    expect(typeof stats.min).toBe('number');
    expect(typeof stats.max).toBe('number');
    expect(typeof stats.avg).toBe('number');
    expect(typeof stats.p50).toBe('number');
    expect(typeof stats.p75).toBe('number');
    expect(typeof stats.p90).toBe('number');
    expect(typeof stats.p95).toBe('number');
    expect(typeof stats.p99).toBe('number');
    expect(typeof stats.stdDev).toBe('number');
  });
});

describe('BenchmarkConfig type structure', () => {
  it('should have all required fields', () => {
    const config: BenchmarkConfig = { ...DEFAULT_BENCHMARK_CONFIG };

    expect(typeof config.iterations).toBe('number');
    expect(typeof config.warmupIterations).toBe('number');
    expect(typeof config.measureMemory).toBe('boolean');
    expect(typeof config.forceGcBetweenIterations).toBe('boolean');
    expect(typeof config.iterationDelayMs).toBe('number');
    expect(typeof config.timeoutMs).toBe('number');
    expect(typeof config.enableParallel).toBe('boolean');
    expect(typeof config.scale).toBe('string');
  });

  it('should support optional targetMs', () => {
    const config: BenchmarkConfig = {
      ...DEFAULT_BENCHMARK_CONFIG,
      targetMs: 100,
    };

    expect(config.targetMs).toBe(100);
  });
});

describe('BenchmarkEnvironment type structure', () => {
  it('should have all required fields', () => {
    const env: BenchmarkEnvironment = createMockBenchmarkEnvironment();

    expect(typeof env.nodeVersion).toBe('string');
    expect(typeof env.platform).toBe('string');
    expect(typeof env.arch).toBe('string');
    expect(typeof env.totalMemory).toBe('number');
    expect(typeof env.freeMemory).toBe('number');
    expect(typeof env.cpuModel).toBe('string');
    expect(typeof env.cpuCores).toBe('number');
  });

  it('should support optional v8HeapStats', () => {
    const env: BenchmarkEnvironment = {
      ...createMockBenchmarkEnvironment(),
      v8HeapStats: {
        totalHeapSize: 100000000,
        usedHeapSize: 50000000,
        heapSizeLimit: 200000000,
      },
    };

    expect(env.v8HeapStats).toBeDefined();
    expect(env.v8HeapStats!.totalHeapSize).toBe(100000000);
  });
});

describe('BenchmarkProgress type structure', () => {
  it('should have all required fields', () => {
    const progress: BenchmarkProgress = {
      benchmarkName: 'test',
      suiteName: 'suite',
      currentIteration: 50,
      totalIterations: 100,
      percentComplete: 50,
      elapsedMs: 5000,
      estimatedRemainingMs: 5000,
      status: 'running',
    };

    expect(progress.benchmarkName).toBe('test');
    expect(progress.suiteName).toBe('suite');
    expect(progress.currentIteration).toBe(50);
    expect(progress.totalIterations).toBe(100);
    expect(progress.percentComplete).toBe(50);
    expect(progress.elapsedMs).toBe(5000);
    expect(progress.estimatedRemainingMs).toBe(5000);
    expect(progress.status).toBe('running');
  });

  it('should support all status values', () => {
    const statuses: BenchmarkProgress['status'][] = ['warmup', 'running', 'complete', 'failed'];

    for (const status of statuses) {
      const progress: BenchmarkProgress = {
        benchmarkName: 'test',
        suiteName: 'suite',
        currentIteration: 1,
        totalIterations: 100,
        percentComplete: 1,
        elapsedMs: 100,
        estimatedRemainingMs: 9900,
        status,
      };

      expect(progress.status).toBe(status);
    }
  });
});

describe('BenchmarkSummary type structure', () => {
  it('should have all required fields', () => {
    const summary: BenchmarkSummary = createMockBenchmarkSummary();

    expect(typeof summary.totalBenchmarks).toBe('number');
    expect(typeof summary.passed).toBe('number');
    expect(typeof summary.failed).toBe('number');
    expect(typeof summary.skipped).toBe('number');
    expect(typeof summary.totalDurationMs).toBe('number');
    expect(typeof summary.passRate).toBe('number');
    expect(typeof summary.criticalFailures).toBe('number');
  });
});

describe('TargetComparisonResult type structure', () => {
  it('should have all required fields', () => {
    const comparison: TargetComparisonResult = createMockTargetComparison();

    expect(comparison.target).toBe('SEARCH_10K_MS');
    expect(comparison.targetMs).toBe(100);
    expect(comparison.actualMs).toBe(80);
    expect(comparison.passed).toBe(true);
    expect(comparison.percentage).toBe(80);
    expect(comparison.marginMs).toBe(20);
    expect(comparison.status).toBe('normal');
  });

  it('should support critical status', () => {
    const comparison: TargetComparisonResult = {
      ...createMockTargetComparison(),
      status: 'critical',
    };

    expect(comparison.status).toBe('critical');
  });
});

describe('BenchmarkRunnerOptions type structure', () => {
  it('should have all required fields', () => {
    const options: BenchmarkRunnerOptions = { ...DEFAULT_RUNNER_OPTIONS };

    expect(Array.isArray(options.suites)).toBe(true);
    expect(typeof options.scale).toBe('string');
    expect(['json', 'table', 'markdown']).toContain(options.format);
    expect(typeof options.verbose).toBe('boolean');
    expect(typeof options.skipWarmup).toBe('boolean');
    expect(typeof options.iterations).toBe('number');
    expect(typeof options.failFast).toBe('boolean');
  });

  it('should support optional fields', () => {
    const options: BenchmarkRunnerOptions = {
      ...DEFAULT_RUNNER_OPTIONS,
      customNodeCount: 25000,
      outputFile: 'results.json',
      tags: ['critical'],
      baseline: 'baseline.json',
      saveBaseline: 'new-baseline.json',
    };

    expect(options.customNodeCount).toBe(25000);
    expect(options.outputFile).toBe('results.json');
    expect(options.tags).toEqual(['critical']);
    expect(options.baseline).toBe('baseline.json');
    expect(options.saveBaseline).toBe('new-baseline.json');
  });
});
