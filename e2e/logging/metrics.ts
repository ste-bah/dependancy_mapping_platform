/**
 * E2E Test Metrics Collection
 * @module e2e/logging/metrics
 *
 * Provides test metrics collection and analysis:
 * - Execution time tracking
 * - Success/failure counts
 * - Performance metrics aggregation
 * - Trend analysis and comparison
 * - Percentile calculations
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #28 of 47 | Phase 4: Implementation
 */

import type {
  TestRunId,
  TestSuiteId,
  TestCaseId,
  TestStatus,
  TestRunResult,
  TestSuiteResult,
  TestResult,
} from '../types/test-types.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Timing metric
 */
export interface TimingMetric {
  /** Metric name */
  readonly name: string;
  /** Duration in milliseconds */
  readonly duration: number;
  /** Start timestamp */
  readonly startTime: number;
  /** End timestamp */
  readonly endTime: number;
  /** Additional context */
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Counter metric
 */
export interface CounterMetric {
  /** Metric name */
  readonly name: string;
  /** Counter value */
  readonly value: number;
  /** Labels for grouping */
  readonly labels?: Readonly<Record<string, string>>;
}

/**
 * Gauge metric (point-in-time value)
 */
export interface GaugeMetric {
  /** Metric name */
  readonly name: string;
  /** Current value */
  readonly value: number;
  /** Timestamp */
  readonly timestamp: number;
  /** Labels for grouping */
  readonly labels?: Readonly<Record<string, string>>;
}

/**
 * Histogram metric (distribution)
 */
export interface HistogramMetric {
  /** Metric name */
  readonly name: string;
  /** Count of samples */
  readonly count: number;
  /** Sum of all values */
  readonly sum: number;
  /** Minimum value */
  readonly min: number;
  /** Maximum value */
  readonly max: number;
  /** Average (mean) value */
  readonly mean: number;
  /** Percentile values */
  readonly percentiles: Readonly<Record<string, number>>;
  /** Labels for grouping */
  readonly labels?: Readonly<Record<string, string>>;
}

/**
 * Test run metrics
 */
export interface TestRunMetrics {
  /** Run identifier */
  readonly runId: TestRunId;
  /** Total duration in milliseconds */
  readonly totalDuration: number;
  /** Setup duration in milliseconds */
  readonly setupDuration: number;
  /** Test execution duration in milliseconds */
  readonly testDuration: number;
  /** Teardown duration in milliseconds */
  readonly teardownDuration: number;
  /** Total number of suites */
  readonly totalSuites: number;
  /** Passed suites */
  readonly passedSuites: number;
  /** Failed suites */
  readonly failedSuites: number;
  /** Total number of tests */
  readonly totalTests: number;
  /** Passed tests */
  readonly passedTests: number;
  /** Failed tests */
  readonly failedTests: number;
  /** Skipped tests */
  readonly skippedTests: number;
  /** Retried tests */
  readonly retriedTests: number;
  /** Flaky tests (inconsistent results) */
  readonly flakyTests: number;
  /** Pass rate percentage */
  readonly passRate: number;
  /** Average test duration */
  readonly averageTestDuration: number;
  /** Median test duration */
  readonly medianTestDuration: number;
  /** 95th percentile duration */
  readonly p95Duration: number;
  /** 99th percentile duration */
  readonly p99Duration: number;
  /** Suite-level metrics */
  readonly suiteMetrics: ReadonlyArray<TestSuiteMetrics>;
}

/**
 * Test suite metrics
 */
export interface TestSuiteMetrics {
  /** Suite identifier */
  readonly suiteId: TestSuiteId;
  /** Suite name */
  readonly suiteName: string;
  /** Total duration in milliseconds */
  readonly duration: number;
  /** Total tests in suite */
  readonly totalTests: number;
  /** Passed tests */
  readonly passedTests: number;
  /** Failed tests */
  readonly failedTests: number;
  /** Skipped tests */
  readonly skippedTests: number;
  /** Pass rate */
  readonly passRate: number;
  /** Average test duration */
  readonly averageTestDuration: number;
  /** Slowest test */
  readonly slowestTest?: TestMetricsSummary;
  /** Fastest test */
  readonly fastestTest?: TestMetricsSummary;
}

/**
 * Test metrics summary
 */
export interface TestMetricsSummary {
  readonly caseId: TestCaseId;
  readonly testName: string;
  readonly duration: number;
  readonly status: TestStatus;
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  /** Run identifier */
  readonly runId: TestRunId;
  /** Timestamp */
  readonly timestamp: Date;
  /** Pass rate */
  readonly passRate: number;
  /** Total tests */
  readonly totalTests: number;
  /** Total duration */
  readonly totalDuration: number;
  /** Average duration */
  readonly averageDuration: number;
  /** Failed tests count */
  readonly failedTests: number;
}

/**
 * Comparison result between two runs
 */
export interface RunComparison {
  /** Current run ID */
  readonly currentRunId: TestRunId;
  /** Baseline run ID */
  readonly baselineRunId: TestRunId;
  /** Pass rate delta (positive = improvement) */
  readonly passRateDelta: number;
  /** Duration delta (positive = slower) */
  readonly durationDelta: number;
  /** Duration delta percentage */
  readonly durationDeltaPercent: number;
  /** New failures (tests that passed before, failed now) */
  readonly newFailures: ReadonlyArray<string>;
  /** Fixed tests (tests that failed before, passed now) */
  readonly fixedTests: ReadonlyArray<string>;
  /** New tests */
  readonly newTests: ReadonlyArray<string>;
  /** Removed tests */
  readonly removedTests: ReadonlyArray<string>;
  /** Overall status */
  readonly status: 'better' | 'same' | 'worse';
}

/**
 * Performance threshold configuration
 */
export interface PerformanceThresholds {
  /** Maximum allowed test duration (ms) */
  readonly maxTestDuration: number;
  /** Maximum allowed suite duration (ms) */
  readonly maxSuiteDuration: number;
  /** Maximum allowed run duration (ms) */
  readonly maxRunDuration: number;
  /** Minimum required pass rate (%) */
  readonly minPassRate: number;
  /** Maximum allowed failure count */
  readonly maxFailures: number;
  /** Maximum allowed flaky test count */
  readonly maxFlakyTests: number;
}

/**
 * Threshold violation
 */
export interface ThresholdViolation {
  readonly type: 'duration' | 'passRate' | 'failures' | 'flaky';
  readonly threshold: number;
  readonly actual: number;
  readonly message: string;
  readonly severity: 'warning' | 'error';
}

// ============================================================================
// Default Values
// ============================================================================

/**
 * Default performance thresholds
 */
export const DEFAULT_PERFORMANCE_THRESHOLDS: PerformanceThresholds = {
  maxTestDuration: 30000,  // 30 seconds
  maxSuiteDuration: 120000, // 2 minutes
  maxRunDuration: 600000,  // 10 minutes
  minPassRate: 80,
  maxFailures: 10,
  maxFlakyTests: 5,
};

// ============================================================================
// Metrics Collector Interface
// ============================================================================

/**
 * Metrics collector interface
 */
export interface IMetricsCollector {
  // Timing
  startTimer(name: string, context?: Record<string, unknown>): TimerHandle;
  recordTiming(metric: TimingMetric): void;

  // Counters
  incrementCounter(name: string, labels?: Record<string, string>): void;
  decrementCounter(name: string, labels?: Record<string, string>): void;
  setCounter(name: string, value: number, labels?: Record<string, string>): void;
  getCounter(name: string, labels?: Record<string, string>): number;

  // Gauges
  setGauge(name: string, value: number, labels?: Record<string, string>): void;
  getGauge(name: string, labels?: Record<string, string>): number | undefined;

  // Histograms
  recordHistogramValue(name: string, value: number, labels?: Record<string, string>): void;
  getHistogram(name: string, labels?: Record<string, string>): HistogramMetric | undefined;

  // Analysis
  calculateRunMetrics(result: TestRunResult): TestRunMetrics;
  calculateSuiteMetrics(suite: TestSuiteResult): TestSuiteMetrics;
  getTrends(runResults: ReadonlyArray<TestRunResult>): ReadonlyArray<TrendDataPoint>;
  compareRuns(current: TestRunResult, baseline: TestRunResult): RunComparison;
  checkThresholds(metrics: TestRunMetrics, thresholds?: PerformanceThresholds): ReadonlyArray<ThresholdViolation>;

  // Export
  exportMetrics(): MetricsExport;
  reset(): void;
}

/**
 * Timer handle for tracking duration
 */
export interface TimerHandle {
  stop(): TimingMetric;
  elapsed(): number;
}

/**
 * Exported metrics format
 */
export interface MetricsExport {
  readonly timestamp: string;
  readonly timings: ReadonlyArray<TimingMetric>;
  readonly counters: ReadonlyArray<CounterMetric>;
  readonly gauges: ReadonlyArray<GaugeMetric>;
  readonly histograms: ReadonlyArray<HistogramMetric>;
}

// ============================================================================
// Metrics Collector Implementation
// ============================================================================

/**
 * Metrics collector implementation
 */
export class MetricsCollector implements IMetricsCollector {
  private readonly timings: TimingMetric[] = [];
  private readonly counters: Map<string, CounterMetric> = new Map();
  private readonly gauges: Map<string, GaugeMetric> = new Map();
  private readonly histogramData: Map<string, number[]> = new Map();

  // ============================================================================
  // Timing Methods
  // ============================================================================

  startTimer(name: string, context?: Record<string, unknown>): TimerHandle {
    const startTime = performance.now();

    return {
      stop: (): TimingMetric => {
        const endTime = performance.now();
        const metric: TimingMetric = {
          name,
          duration: endTime - startTime,
          startTime,
          endTime,
          context,
        };
        this.recordTiming(metric);
        return metric;
      },
      elapsed: (): number => {
        return performance.now() - startTime;
      },
    };
  }

  recordTiming(metric: TimingMetric): void {
    this.timings.push(metric);
    this.recordHistogramValue(`timing.${metric.name}`, metric.duration);
  }

  // ============================================================================
  // Counter Methods
  // ============================================================================

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const current = this.counters.get(key);
    const value = (current?.value ?? 0) + 1;
    this.counters.set(key, { name, value, labels });
  }

  decrementCounter(name: string, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const current = this.counters.get(key);
    const value = Math.max(0, (current?.value ?? 0) - 1);
    this.counters.set(key, { name, value, labels });
  }

  setCounter(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, { name, value, labels });
  }

  getCounter(name: string, labels?: Record<string, string>): number {
    const key = this.makeKey(name, labels);
    return this.counters.get(key)?.value ?? 0;
  }

  // ============================================================================
  // Gauge Methods
  // ============================================================================

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, { name, value, timestamp: Date.now(), labels });
  }

  getGauge(name: string, labels?: Record<string, string>): number | undefined {
    const key = this.makeKey(name, labels);
    return this.gauges.get(key)?.value;
  }

  // ============================================================================
  // Histogram Methods
  // ============================================================================

  recordHistogramValue(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const data = this.histogramData.get(key) ?? [];
    data.push(value);
    this.histogramData.set(key, data);
  }

  getHistogram(name: string, labels?: Record<string, string>): HistogramMetric | undefined {
    const key = this.makeKey(name, labels);
    const data = this.histogramData.get(key);

    if (!data || data.length === 0) {
      return undefined;
    }

    const sorted = [...data].sort((a, b) => a - b);
    const sum = data.reduce((a, b) => a + b, 0);

    return {
      name,
      count: data.length,
      sum,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      mean: sum / data.length,
      percentiles: {
        p50: this.percentile(sorted, 50),
        p75: this.percentile(sorted, 75),
        p90: this.percentile(sorted, 90),
        p95: this.percentile(sorted, 95),
        p99: this.percentile(sorted, 99),
      },
      labels,
    };
  }

  // ============================================================================
  // Analysis Methods
  // ============================================================================

  calculateRunMetrics(result: TestRunResult): TestRunMetrics {
    const allTests = result.suites.flatMap(s => s.tests);
    const durations = allTests.map(t => t.duration).sort((a, b) => a - b);

    const passedTests = allTests.filter(t => t.status === 'passed').length;
    const failedTests = allTests.filter(t => t.status === 'failed').length;
    const skippedTests = allTests.filter(t => t.status === 'skipped').length;
    const retriedTests = allTests.filter(t => (t.retry?.attempt ?? 0) > 1).length;

    return {
      runId: result.runId,
      totalDuration: result.duration,
      setupDuration: 0, // Would need separate tracking
      testDuration: result.duration,
      teardownDuration: 0, // Would need separate tracking
      totalSuites: result.suites.length,
      passedSuites: result.suites.filter(s => s.status === 'passed').length,
      failedSuites: result.suites.filter(s => s.status === 'failed').length,
      totalTests: allTests.length,
      passedTests,
      failedTests,
      skippedTests,
      retriedTests,
      flakyTests: this.countFlakyTests(allTests),
      passRate: allTests.length > 0 ? (passedTests / allTests.length) * 100 : 0,
      averageTestDuration: allTests.length > 0 ? durations.reduce((a, b) => a + b, 0) / allTests.length : 0,
      medianTestDuration: durations.length > 0 ? this.percentile(durations, 50) : 0,
      p95Duration: durations.length > 0 ? this.percentile(durations, 95) : 0,
      p99Duration: durations.length > 0 ? this.percentile(durations, 99) : 0,
      suiteMetrics: result.suites.map(s => this.calculateSuiteMetrics(s)),
    };
  }

  calculateSuiteMetrics(suite: TestSuiteResult): TestSuiteMetrics {
    const tests = suite.tests;
    const passedTests = tests.filter(t => t.status === 'passed').length;
    const failedTests = tests.filter(t => t.status === 'failed').length;
    const skippedTests = tests.filter(t => t.status === 'skipped').length;
    const durations = tests.map(t => t.duration).sort((a, b) => a - b);

    const slowest = tests.length > 0
      ? tests.reduce((max, t) => t.duration > max.duration ? t : max, tests[0])
      : undefined;

    const fastest = tests.length > 0
      ? tests.reduce((min, t) => t.duration < min.duration ? t : min, tests[0])
      : undefined;

    return {
      suiteId: suite.suiteId,
      suiteName: suite.name,
      duration: suite.duration,
      totalTests: tests.length,
      passedTests,
      failedTests,
      skippedTests,
      passRate: tests.length > 0 ? (passedTests / tests.length) * 100 : 0,
      averageTestDuration: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
      slowestTest: slowest ? {
        caseId: slowest.caseId,
        testName: slowest.testName,
        duration: slowest.duration,
        status: slowest.status,
      } : undefined,
      fastestTest: fastest ? {
        caseId: fastest.caseId,
        testName: fastest.testName,
        duration: fastest.duration,
        status: fastest.status,
      } : undefined,
    };
  }

  getTrends(runResults: ReadonlyArray<TestRunResult>): ReadonlyArray<TrendDataPoint> {
    return runResults.map(result => {
      const allTests = result.suites.flatMap(s => s.tests);
      const passedTests = allTests.filter(t => t.status === 'passed').length;
      const failedTests = allTests.filter(t => t.status === 'failed').length;

      return {
        runId: result.runId,
        timestamp: result.startTime,
        passRate: allTests.length > 0 ? (passedTests / allTests.length) * 100 : 0,
        totalTests: allTests.length,
        totalDuration: result.duration,
        averageDuration: allTests.length > 0
          ? allTests.reduce((sum, t) => sum + t.duration, 0) / allTests.length
          : 0,
        failedTests,
      };
    }).sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  compareRuns(current: TestRunResult, baseline: TestRunResult): RunComparison {
    const currentMetrics = this.calculateRunMetrics(current);
    const baselineMetrics = this.calculateRunMetrics(baseline);

    const currentTests = new Map(
      current.suites.flatMap(s => s.tests).map(t => [t.testName, t])
    );
    const baselineTests = new Map(
      baseline.suites.flatMap(s => s.tests).map(t => [t.testName, t])
    );

    const newFailures: string[] = [];
    const fixedTests: string[] = [];
    const newTests: string[] = [];
    const removedTests: string[] = [];

    // Find new failures and fixed tests
    for (const [name, test] of currentTests) {
      const baselineTest = baselineTests.get(name);

      if (!baselineTest) {
        newTests.push(name);
      } else if (test.status === 'failed' && baselineTest.status === 'passed') {
        newFailures.push(name);
      } else if (test.status === 'passed' && baselineTest.status === 'failed') {
        fixedTests.push(name);
      }
    }

    // Find removed tests
    for (const name of baselineTests.keys()) {
      if (!currentTests.has(name)) {
        removedTests.push(name);
      }
    }

    const passRateDelta = currentMetrics.passRate - baselineMetrics.passRate;
    const durationDelta = current.duration - baseline.duration;
    const durationDeltaPercent = baseline.duration > 0
      ? (durationDelta / baseline.duration) * 100
      : 0;

    let status: 'better' | 'same' | 'worse';
    if (newFailures.length > 0 || passRateDelta < -5) {
      status = 'worse';
    } else if (fixedTests.length > 0 || passRateDelta > 5) {
      status = 'better';
    } else {
      status = 'same';
    }

    return {
      currentRunId: current.runId,
      baselineRunId: baseline.runId,
      passRateDelta,
      durationDelta,
      durationDeltaPercent,
      newFailures,
      fixedTests,
      newTests,
      removedTests,
      status,
    };
  }

  checkThresholds(
    metrics: TestRunMetrics,
    thresholds: PerformanceThresholds = DEFAULT_PERFORMANCE_THRESHOLDS
  ): ReadonlyArray<ThresholdViolation> {
    const violations: ThresholdViolation[] = [];

    // Check run duration
    if (metrics.totalDuration > thresholds.maxRunDuration) {
      violations.push({
        type: 'duration',
        threshold: thresholds.maxRunDuration,
        actual: metrics.totalDuration,
        message: `Total run duration (${this.formatDuration(metrics.totalDuration)}) exceeds threshold (${this.formatDuration(thresholds.maxRunDuration)})`,
        severity: 'warning',
      });
    }

    // Check pass rate
    if (metrics.passRate < thresholds.minPassRate) {
      violations.push({
        type: 'passRate',
        threshold: thresholds.minPassRate,
        actual: metrics.passRate,
        message: `Pass rate (${metrics.passRate.toFixed(1)}%) is below threshold (${thresholds.minPassRate}%)`,
        severity: 'error',
      });
    }

    // Check failure count
    if (metrics.failedTests > thresholds.maxFailures) {
      violations.push({
        type: 'failures',
        threshold: thresholds.maxFailures,
        actual: metrics.failedTests,
        message: `Failure count (${metrics.failedTests}) exceeds threshold (${thresholds.maxFailures})`,
        severity: 'error',
      });
    }

    // Check flaky tests
    if (metrics.flakyTests > thresholds.maxFlakyTests) {
      violations.push({
        type: 'flaky',
        threshold: thresholds.maxFlakyTests,
        actual: metrics.flakyTests,
        message: `Flaky test count (${metrics.flakyTests}) exceeds threshold (${thresholds.maxFlakyTests})`,
        severity: 'warning',
      });
    }

    // Check individual suite durations
    for (const suite of metrics.suiteMetrics) {
      if (suite.duration > thresholds.maxSuiteDuration) {
        violations.push({
          type: 'duration',
          threshold: thresholds.maxSuiteDuration,
          actual: suite.duration,
          message: `Suite "${suite.suiteName}" duration (${this.formatDuration(suite.duration)}) exceeds threshold (${this.formatDuration(thresholds.maxSuiteDuration)})`,
          severity: 'warning',
        });
      }
    }

    // Check for slow tests
    if (metrics.p95Duration > thresholds.maxTestDuration) {
      violations.push({
        type: 'duration',
        threshold: thresholds.maxTestDuration,
        actual: metrics.p95Duration,
        message: `P95 test duration (${this.formatDuration(metrics.p95Duration)}) exceeds threshold (${this.formatDuration(thresholds.maxTestDuration)})`,
        severity: 'warning',
      });
    }

    return violations;
  }

  // ============================================================================
  // Export Methods
  // ============================================================================

  exportMetrics(): MetricsExport {
    return {
      timestamp: new Date().toISOString(),
      timings: [...this.timings],
      counters: Array.from(this.counters.values()),
      gauges: Array.from(this.gauges.values()),
      histograms: Array.from(this.histogramData.keys())
        .map(key => {
          const [name, ...labelParts] = key.split(':');
          const labels = labelParts.length > 0
            ? JSON.parse(labelParts.join(':'))
            : undefined;
          return this.getHistogram(name, labels);
        })
        .filter((h): h is HistogramMetric => h !== undefined),
    };
  }

  reset(): void {
    this.timings.length = 0;
    this.counters.clear();
    this.gauges.clear();
    this.histogramData.clear();
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private makeKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }
    return `${name}:${JSON.stringify(labels)}`;
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private countFlakyTests(tests: ReadonlyArray<TestResult>): number {
    // A test is considered flaky if it has retry info indicating multiple attempts
    return tests.filter(t => {
      if (!t.retry) return false;
      return t.retry.retriedDueToFailure && t.status === 'passed';
    }).length;
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Global metrics collector instance
 */
let globalCollector: MetricsCollector | null = null;

/**
 * Create a new metrics collector
 */
export function createMetricsCollector(): IMetricsCollector {
  return new MetricsCollector();
}

/**
 * Get the global metrics collector instance
 */
export function getMetricsCollector(): IMetricsCollector {
  if (!globalCollector) {
    globalCollector = new MetricsCollector();
  }
  return globalCollector;
}

/**
 * Initialize the global metrics collector
 */
export function initMetricsCollector(): IMetricsCollector {
  globalCollector = new MetricsCollector();
  return globalCollector;
}

/**
 * Reset the global metrics collector
 */
export function resetMetricsCollector(): void {
  if (globalCollector) {
    globalCollector.reset();
  }
  globalCollector = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Time an async function and record the metric
 */
export async function timeAsync<T>(
  collector: IMetricsCollector,
  name: string,
  fn: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  const timer = collector.startTimer(name, context);
  try {
    return await fn();
  } finally {
    timer.stop();
  }
}

/**
 * Time a sync function and record the metric
 */
export function timeSync<T>(
  collector: IMetricsCollector,
  name: string,
  fn: () => T,
  context?: Record<string, unknown>
): T {
  const timer = collector.startTimer(name, context);
  try {
    return fn();
  } finally {
    timer.stop();
  }
}

/**
 * Create a scoped metrics collector for a test
 */
export function createTestMetricsScope(
  collector: IMetricsCollector,
  testName: string,
  caseId?: TestCaseId
): TestMetricsScope {
  return new TestMetricsScope(collector, testName, caseId);
}

/**
 * Scoped metrics collector for a single test
 */
export class TestMetricsScope {
  private readonly startTime: number;
  private readonly timers: Map<string, TimerHandle> = new Map();

  constructor(
    private readonly collector: IMetricsCollector,
    private readonly testName: string,
    private readonly caseId?: TestCaseId
  ) {
    this.startTime = performance.now();
    this.collector.incrementCounter('test.started', { test: testName });
  }

  /**
   * Start a timer for an operation within the test
   */
  startOperation(operation: string): TimerHandle {
    const timer = this.collector.startTimer(`test.${operation}`, {
      testName: this.testName,
      caseId: this.caseId,
    });
    this.timers.set(operation, timer);
    return timer;
  }

  /**
   * Stop a timer for an operation
   */
  stopOperation(operation: string): TimingMetric | undefined {
    const timer = this.timers.get(operation);
    if (timer) {
      this.timers.delete(operation);
      return timer.stop();
    }
    return undefined;
  }

  /**
   * Record a custom metric for this test
   */
  recordMetric(name: string, value: number): void {
    this.collector.recordHistogramValue(`test.${name}`, value, {
      test: this.testName,
    });
  }

  /**
   * Mark test as passed
   */
  markPassed(): void {
    this.collector.incrementCounter('test.passed', { test: this.testName });
    this.recordDuration();
  }

  /**
   * Mark test as failed
   */
  markFailed(): void {
    this.collector.incrementCounter('test.failed', { test: this.testName });
    this.recordDuration();
  }

  /**
   * Mark test as skipped
   */
  markSkipped(): void {
    this.collector.incrementCounter('test.skipped', { test: this.testName });
  }

  /**
   * Get elapsed time since test started
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  private recordDuration(): void {
    const duration = this.elapsed();
    this.collector.recordHistogramValue('test.duration', duration, {
      test: this.testName,
    });
  }
}

/**
 * Generate a summary report from metrics
 */
export function generateMetricsSummary(
  collector: IMetricsCollector,
  runResult: TestRunResult
): MetricsSummary {
  const metrics = collector.calculateRunMetrics(runResult);
  const violations = collector.checkThresholds(metrics);

  return {
    runId: runResult.runId,
    timestamp: new Date().toISOString(),
    status: violations.some(v => v.severity === 'error') ? 'failed' : 'passed',
    metrics: {
      totalTests: metrics.totalTests,
      passRate: metrics.passRate,
      totalDuration: metrics.totalDuration,
      averageDuration: metrics.averageTestDuration,
      p95Duration: metrics.p95Duration,
    },
    violations,
    trends: {
      passRateTrend: 'stable', // Would need historical data
      durationTrend: 'stable', // Would need historical data
    },
  };
}

/**
 * Metrics summary format
 */
export interface MetricsSummary {
  readonly runId: TestRunId;
  readonly timestamp: string;
  readonly status: 'passed' | 'failed';
  readonly metrics: {
    readonly totalTests: number;
    readonly passRate: number;
    readonly totalDuration: number;
    readonly averageDuration: number;
    readonly p95Duration: number;
  };
  readonly violations: ReadonlyArray<ThresholdViolation>;
  readonly trends: {
    readonly passRateTrend: 'improving' | 'stable' | 'degrading';
    readonly durationTrend: 'faster' | 'stable' | 'slower';
  };
}
