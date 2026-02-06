/**
 * Test Result Repository
 * @module e2e/data/test-result-repository
 *
 * Repository for storing and querying test execution results.
 * Supports historical comparisons, baseline tracking, and trend analysis.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #23 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult, Brand } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type {
  TestRunId,
  TestSuiteId,
  TestCaseId,
  TestResult,
  TestSuiteResult,
  TestRunResult,
  TestStatus,
  TestMetrics,
} from '../types/test-types.js';
import { createTestRunId, createTestSuiteId, createTestCaseId } from '../types/test-types.js';
import type { TestDatabase, TransactionId } from '../domain/test-database.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Baseline ID
 */
export type BaselineId = Brand<string, 'BaselineId'>;

/**
 * Create a BaselineId from a string
 */
export function createBaselineId(id: string): BaselineId {
  return id as BaselineId;
}

// ============================================================================
// Types
// ============================================================================

/**
 * Test result storage input
 */
export interface StoreTestResultInput {
  readonly result: TestResult;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Test suite result storage input
 */
export interface StoreTestSuiteResultInput {
  readonly result: TestSuiteResult;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Test run result storage input
 */
export interface StoreTestRunResultInput {
  readonly result: TestRunResult;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Stored test result with additional metadata
 */
export interface StoredTestResult extends TestResult {
  readonly storedAt: Date;
  readonly baselineId?: BaselineId;
  readonly comparisonResult?: ComparisonResult;
}

/**
 * Stored test suite result
 */
export interface StoredTestSuiteResult extends TestSuiteResult {
  readonly storedAt: Date;
}

/**
 * Stored test run result
 */
export interface StoredTestRunResult extends TestRunResult {
  readonly storedAt: Date;
}

/**
 * Baseline definition
 */
export interface Baseline {
  readonly id: BaselineId;
  readonly name: string;
  readonly description?: string;
  readonly runId: TestRunId;
  readonly createdAt: Date;
  readonly metrics: BaselineMetrics;
}

/**
 * Baseline metrics for comparison
 */
export interface BaselineMetrics {
  readonly passRate: number;
  readonly averageDuration: number;
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly flaky: number;
  readonly custom: Readonly<Record<string, number>>;
}

/**
 * Comparison result between test result and baseline
 */
export interface ComparisonResult {
  readonly baselineId: BaselineId;
  readonly status: 'better' | 'same' | 'worse' | 'new';
  readonly durationDelta: number;
  readonly durationDeltaPercent: number;
  readonly passRateDelta: number;
  readonly issues: ReadonlyArray<ComparisonIssue>;
}

/**
 * Comparison issue
 */
export interface ComparisonIssue {
  readonly type: 'regression' | 'flaky' | 'slow' | 'new_failure';
  readonly testCaseId: TestCaseId;
  readonly message: string;
  readonly baselineValue?: unknown;
  readonly currentValue?: unknown;
}

/**
 * Test result filter criteria
 */
export interface TestResultFilterCriteria {
  readonly runId?: TestRunId;
  readonly suiteId?: TestSuiteId;
  readonly status?: TestStatus | ReadonlyArray<TestStatus>;
  readonly testName?: string;
  readonly testFile?: string;
  readonly minDuration?: number;
  readonly maxDuration?: number;
  readonly startTimeAfter?: Date;
  readonly startTimeBefore?: Date;
}

/**
 * Historical query options
 */
export interface HistoricalQueryOptions {
  /** Number of recent runs to include */
  readonly runCount?: number;
  /** Start date for history */
  readonly since?: Date;
  /** End date for history */
  readonly until?: Date;
  /** Group by (day, week, run) */
  readonly groupBy?: 'day' | 'week' | 'run';
}

/**
 * Historical trend data
 */
export interface HistoricalTrend {
  readonly period: string;
  readonly runId?: TestRunId;
  readonly passRate: number;
  readonly totalTests: number;
  readonly passed: number;
  readonly failed: number;
  readonly averageDuration: number;
  readonly flakyTests: number;
}

/**
 * Test flakiness report
 */
export interface FlakinessReport {
  readonly testCaseId: TestCaseId;
  readonly testName: string;
  readonly totalRuns: number;
  readonly failures: number;
  readonly passes: number;
  readonly flakinessScore: number;
  readonly lastSeen: Date;
  readonly recentResults: ReadonlyArray<TestStatus>;
}

/**
 * Pagination params
 */
export interface PaginationParams {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Paginated result
 */
export interface PaginatedResult<T> {
  readonly data: ReadonlyArray<T>;
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
  readonly totalPages: number;
}

/**
 * Repository error
 */
export interface TestResultRepositoryError {
  readonly code: TestResultRepositoryErrorCode;
  readonly message: string;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Error codes
 */
export type TestResultRepositoryErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'DATABASE_ERROR'
  | 'INVALID_INPUT'
  | 'BASELINE_NOT_FOUND';

// ============================================================================
// Interface
// ============================================================================

/**
 * Test result repository interface
 */
export interface ITestResultRepository {
  // Result storage
  storeTestResult(input: StoreTestResultInput): AsyncResult<StoredTestResult, TestResultRepositoryError>;
  storeTestSuiteResult(input: StoreTestSuiteResultInput): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError>;
  storeTestRunResult(input: StoreTestRunResultInput): AsyncResult<StoredTestRunResult, TestResultRepositoryError>;

  // Result retrieval
  getTestResult(caseId: TestCaseId, runId: TestRunId): AsyncResult<StoredTestResult, TestResultRepositoryError>;
  getTestSuiteResult(suiteId: TestSuiteId, runId: TestRunId): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError>;
  getTestRunResult(runId: TestRunId): AsyncResult<StoredTestRunResult, TestResultRepositoryError>;

  // Querying
  findTestResults(
    criteria: TestResultFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredTestResult>, TestResultRepositoryError>;

  getHistoricalResults(
    testCaseId: TestCaseId,
    options?: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<StoredTestResult>, TestResultRepositoryError>;

  getHistoricalTrends(options: HistoricalQueryOptions): AsyncResult<ReadonlyArray<HistoricalTrend>, TestResultRepositoryError>;

  // Baseline management
  createBaseline(name: string, runId: TestRunId, description?: string): AsyncResult<Baseline, TestResultRepositoryError>;
  getBaseline(id: BaselineId): AsyncResult<Baseline, TestResultRepositoryError>;
  getBaselineByName(name: string): AsyncResult<Baseline, TestResultRepositoryError>;
  listBaselines(): AsyncResult<ReadonlyArray<Baseline>, TestResultRepositoryError>;
  deleteBaseline(id: BaselineId): AsyncResult<void, TestResultRepositoryError>;

  // Comparison
  compareWithBaseline(
    runId: TestRunId,
    baselineId: BaselineId
  ): AsyncResult<ComparisonResult, TestResultRepositoryError>;

  // Flakiness analysis
  getFlakinessReport(options?: HistoricalQueryOptions): AsyncResult<ReadonlyArray<FlakinessReport>, TestResultRepositoryError>;

  // Cleanup
  deleteTestRunResults(runId: TestRunId): AsyncResult<void, TestResultRepositoryError>;
  deleteOldResults(olderThan: Date): AsyncResult<number, TestResultRepositoryError>;
  clear(): AsyncResult<void, TestResultRepositoryError>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * In-memory test result repository implementation
 */
export class InMemoryTestResultRepository implements ITestResultRepository {
  private readonly testResults: Map<string, StoredTestResult>;
  private readonly suiteResults: Map<string, StoredTestSuiteResult>;
  private readonly runResults: Map<TestRunId, StoredTestRunResult>;
  private readonly baselines: Map<BaselineId, Baseline>;
  private baselineIdCounter: number;

  constructor() {
    this.testResults = new Map();
    this.suiteResults = new Map();
    this.runResults = new Map();
    this.baselines = new Map();
    this.baselineIdCounter = 0;
  }

  // ============================================================================
  // Result Storage
  // ============================================================================

  async storeTestResult(input: StoreTestResultInput): AsyncResult<StoredTestResult, TestResultRepositoryError> {
    const key = this.makeTestResultKey(input.result.caseId, input.result.runId);
    const stored: StoredTestResult = {
      ...input.result,
      storedAt: new Date(),
    };
    this.testResults.set(key, stored);
    return success(stored);
  }

  async storeTestSuiteResult(input: StoreTestSuiteResultInput): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError> {
    const key = this.makeSuiteResultKey(input.result.suiteId, input.result.tests[0]?.runId);
    const stored: StoredTestSuiteResult = {
      ...input.result,
      storedAt: new Date(),
    };
    this.suiteResults.set(key, stored);

    // Also store individual test results
    for (const test of input.result.tests) {
      await this.storeTestResult({ result: test });
    }

    return success(stored);
  }

  async storeTestRunResult(input: StoreTestRunResultInput): AsyncResult<StoredTestRunResult, TestResultRepositoryError> {
    const stored: StoredTestRunResult = {
      ...input.result,
      storedAt: new Date(),
    };
    this.runResults.set(input.result.runId, stored);

    // Store suite and test results
    for (const suite of input.result.suites) {
      await this.storeTestSuiteResult({ result: suite });
    }

    return success(stored);
  }

  // ============================================================================
  // Result Retrieval
  // ============================================================================

  async getTestResult(
    caseId: TestCaseId,
    runId: TestRunId
  ): AsyncResult<StoredTestResult, TestResultRepositoryError> {
    const key = this.makeTestResultKey(caseId, runId);
    const result = this.testResults.get(key);
    if (!result) {
      return failure({
        code: 'NOT_FOUND',
        message: `Test result not found: ${caseId} in run ${runId}`,
      });
    }
    return success(result);
  }

  async getTestSuiteResult(
    suiteId: TestSuiteId,
    runId: TestRunId
  ): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError> {
    const key = this.makeSuiteResultKey(suiteId, runId);
    const result = this.suiteResults.get(key);
    if (!result) {
      return failure({
        code: 'NOT_FOUND',
        message: `Suite result not found: ${suiteId} in run ${runId}`,
      });
    }
    return success(result);
  }

  async getTestRunResult(runId: TestRunId): AsyncResult<StoredTestRunResult, TestResultRepositoryError> {
    const result = this.runResults.get(runId);
    if (!result) {
      return failure({
        code: 'NOT_FOUND',
        message: `Run result not found: ${runId}`,
      });
    }
    return success(result);
  }

  // ============================================================================
  // Querying
  // ============================================================================

  async findTestResults(
    criteria: TestResultFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredTestResult>, TestResultRepositoryError> {
    let results = Array.from(this.testResults.values());

    // Apply filters
    if (criteria.runId) {
      results = results.filter(r => r.runId === criteria.runId);
    }

    if (criteria.suiteId) {
      results = results.filter(r => r.suiteId === criteria.suiteId);
    }

    if (criteria.status) {
      const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
      results = results.filter(r => statuses.includes(r.status));
    }

    if (criteria.testName) {
      results = results.filter(r => r.testName.includes(criteria.testName!));
    }

    if (criteria.testFile) {
      results = results.filter(r => r.testFile.includes(criteria.testFile!));
    }

    if (criteria.minDuration !== undefined) {
      results = results.filter(r => r.duration >= criteria.minDuration!);
    }

    if (criteria.maxDuration !== undefined) {
      results = results.filter(r => r.duration <= criteria.maxDuration!);
    }

    if (criteria.startTimeAfter) {
      results = results.filter(r => r.startTime > criteria.startTimeAfter!);
    }

    if (criteria.startTimeBefore) {
      results = results.filter(r => r.startTime < criteria.startTimeBefore!);
    }

    // Sort by start time descending
    results.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    const total = results.length;
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 50;
    const totalPages = Math.ceil(total / pageSize);

    const start = (page - 1) * pageSize;
    const paginatedResults = results.slice(start, start + pageSize);

    return success({
      data: paginatedResults,
      total,
      page,
      pageSize,
      totalPages,
    });
  }

  async getHistoricalResults(
    testCaseId: TestCaseId,
    options?: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<StoredTestResult>, TestResultRepositoryError> {
    let results = Array.from(this.testResults.values())
      .filter(r => r.caseId === testCaseId);

    if (options?.since) {
      results = results.filter(r => r.startTime >= options.since!);
    }

    if (options?.until) {
      results = results.filter(r => r.startTime <= options.until!);
    }

    results.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

    if (options?.runCount) {
      results = results.slice(0, options.runCount);
    }

    return success(results);
  }

  async getHistoricalTrends(
    options: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<HistoricalTrend>, TestResultRepositoryError> {
    const runs = Array.from(this.runResults.values());
    let filteredRuns = runs;

    if (options.since) {
      filteredRuns = filteredRuns.filter(r => r.startTime >= options.since!);
    }

    if (options.until) {
      filteredRuns = filteredRuns.filter(r => r.startTime <= options.until!);
    }

    filteredRuns.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());

    if (options.runCount) {
      filteredRuns = filteredRuns.slice(-options.runCount);
    }

    const trends: HistoricalTrend[] = filteredRuns.map(run => ({
      period: run.startTime.toISOString().split('T')[0],
      runId: run.runId,
      passRate: run.stats.passRate,
      totalTests: run.stats.total,
      passed: run.stats.passed,
      failed: run.stats.failed,
      averageDuration: run.stats.averageDuration,
      flakyTests: run.stats.flakyTests,
    }));

    return success(trends);
  }

  // ============================================================================
  // Baseline Management
  // ============================================================================

  async createBaseline(
    name: string,
    runId: TestRunId,
    description?: string
  ): AsyncResult<Baseline, TestResultRepositoryError> {
    const run = this.runResults.get(runId);
    if (!run) {
      return failure({
        code: 'NOT_FOUND',
        message: `Run ${runId} not found`,
      });
    }

    const id = createBaselineId(`baseline_${++this.baselineIdCounter}`);
    const baseline: Baseline = {
      id,
      name,
      description,
      runId,
      createdAt: new Date(),
      metrics: {
        passRate: run.stats.passRate,
        averageDuration: run.stats.averageDuration,
        totalTests: run.stats.total,
        passed: run.stats.passed,
        failed: run.stats.failed,
        flaky: run.stats.flakyTests,
        custom: {},
      },
    };

    this.baselines.set(id, baseline);
    return success(baseline);
  }

  async getBaseline(id: BaselineId): AsyncResult<Baseline, TestResultRepositoryError> {
    const baseline = this.baselines.get(id);
    if (!baseline) {
      return failure({
        code: 'BASELINE_NOT_FOUND',
        message: `Baseline ${id} not found`,
      });
    }
    return success(baseline);
  }

  async getBaselineByName(name: string): AsyncResult<Baseline, TestResultRepositoryError> {
    const baseline = Array.from(this.baselines.values()).find(b => b.name === name);
    if (!baseline) {
      return failure({
        code: 'BASELINE_NOT_FOUND',
        message: `Baseline with name "${name}" not found`,
      });
    }
    return success(baseline);
  }

  async listBaselines(): AsyncResult<ReadonlyArray<Baseline>, TestResultRepositoryError> {
    return success(Array.from(this.baselines.values()));
  }

  async deleteBaseline(id: BaselineId): AsyncResult<void, TestResultRepositoryError> {
    if (!this.baselines.has(id)) {
      return failure({
        code: 'BASELINE_NOT_FOUND',
        message: `Baseline ${id} not found`,
      });
    }
    this.baselines.delete(id);
    return success(undefined);
  }

  // ============================================================================
  // Comparison
  // ============================================================================

  async compareWithBaseline(
    runId: TestRunId,
    baselineId: BaselineId
  ): AsyncResult<ComparisonResult, TestResultRepositoryError> {
    const run = this.runResults.get(runId);
    if (!run) {
      return failure({
        code: 'NOT_FOUND',
        message: `Run ${runId} not found`,
      });
    }

    const baseline = this.baselines.get(baselineId);
    if (!baseline) {
      return failure({
        code: 'BASELINE_NOT_FOUND',
        message: `Baseline ${baselineId} not found`,
      });
    }

    const durationDelta = run.stats.averageDuration - baseline.metrics.averageDuration;
    const durationDeltaPercent = baseline.metrics.averageDuration > 0
      ? (durationDelta / baseline.metrics.averageDuration) * 100
      : 0;
    const passRateDelta = run.stats.passRate - baseline.metrics.passRate;

    const issues: ComparisonIssue[] = [];

    // Check for regressions
    for (const suite of run.suites) {
      for (const test of suite.tests) {
        if (test.status === 'failed') {
          // Check if this test passed in baseline
          const baselineRun = this.runResults.get(baseline.runId);
          if (baselineRun) {
            const baselineTest = this.findTestInRun(baselineRun, test.caseId);
            if (baselineTest && baselineTest.status === 'passed') {
              issues.push({
                type: 'regression',
                testCaseId: test.caseId,
                message: `Test "${test.testName}" regressed (was passing in baseline)`,
                baselineValue: 'passed',
                currentValue: 'failed',
              });
            }
          }
        }
      }
    }

    // Determine overall status
    let status: ComparisonResult['status'];
    if (issues.some(i => i.type === 'regression')) {
      status = 'worse';
    } else if (passRateDelta > 0) {
      status = 'better';
    } else if (passRateDelta === 0 && Math.abs(durationDeltaPercent) < 10) {
      status = 'same';
    } else if (durationDeltaPercent > 20) {
      status = 'worse';
    } else {
      status = 'same';
    }

    return success({
      baselineId,
      status,
      durationDelta,
      durationDeltaPercent,
      passRateDelta,
      issues,
    });
  }

  // ============================================================================
  // Flakiness Analysis
  // ============================================================================

  async getFlakinessReport(
    options?: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<FlakinessReport>, TestResultRepositoryError> {
    // Group results by test case
    const testGroups = new Map<TestCaseId, StoredTestResult[]>();

    for (const result of this.testResults.values()) {
      if (options?.since && result.startTime < options.since) continue;
      if (options?.until && result.startTime > options.until) continue;

      const existing = testGroups.get(result.caseId) ?? [];
      existing.push(result);
      testGroups.set(result.caseId, existing);
    }

    const reports: FlakinessReport[] = [];

    for (const [caseId, results] of testGroups) {
      if (results.length < 2) continue; // Need multiple runs to detect flakiness

      results.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      const failures = results.filter(r => r.status === 'failed').length;
      const passes = results.filter(r => r.status === 'passed').length;

      // Flakiness score: ratio of status changes
      let statusChanges = 0;
      for (let i = 1; i < results.length; i++) {
        if (results[i].status !== results[i - 1].status) {
          statusChanges++;
        }
      }
      const flakinessScore = results.length > 1 ? statusChanges / (results.length - 1) : 0;

      if (flakinessScore > 0) {
        reports.push({
          testCaseId: caseId,
          testName: results[0].testName,
          totalRuns: results.length,
          failures,
          passes,
          flakinessScore,
          lastSeen: results[0].startTime,
          recentResults: results.slice(0, 10).map(r => r.status),
        });
      }
    }

    // Sort by flakiness score descending
    reports.sort((a, b) => b.flakinessScore - a.flakinessScore);

    return success(reports);
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  async deleteTestRunResults(runId: TestRunId): AsyncResult<void, TestResultRepositoryError> {
    // Delete run
    this.runResults.delete(runId);

    // Delete associated suite results
    for (const [key, suite] of this.suiteResults) {
      if (suite.tests[0]?.runId === runId) {
        this.suiteResults.delete(key);
      }
    }

    // Delete associated test results
    for (const [key, test] of this.testResults) {
      if (test.runId === runId) {
        this.testResults.delete(key);
      }
    }

    return success(undefined);
  }

  async deleteOldResults(olderThan: Date): AsyncResult<number, TestResultRepositoryError> {
    let deleted = 0;

    // Delete old runs
    for (const [runId, run] of this.runResults) {
      if (run.startTime < olderThan) {
        await this.deleteTestRunResults(runId);
        deleted++;
      }
    }

    return success(deleted);
  }

  async clear(): AsyncResult<void, TestResultRepositoryError> {
    this.testResults.clear();
    this.suiteResults.clear();
    this.runResults.clear();
    this.baselines.clear();
    return success(undefined);
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private makeTestResultKey(caseId: TestCaseId, runId: TestRunId): string {
    return `${runId}:${caseId}`;
  }

  private makeSuiteResultKey(suiteId: TestSuiteId, runId?: TestRunId): string {
    return `${runId ?? 'unknown'}:${suiteId}`;
  }

  private findTestInRun(run: StoredTestRunResult, caseId: TestCaseId): TestResult | undefined {
    for (const suite of run.suites) {
      const test = suite.tests.find(t => t.caseId === caseId);
      if (test) return test;
    }
    return undefined;
  }
}

/**
 * Database-backed test result repository implementation
 */
export class DatabaseTestResultRepository implements ITestResultRepository {
  constructor(private readonly database: TestDatabase) {}

  async storeTestResult(input: StoreTestResultInput): AsyncResult<StoredTestResult, TestResultRepositoryError> {
    try {
      const sql = `
        INSERT INTO test_results (
          run_id, suite_id, case_id, test_name, test_file, status,
          duration, start_time, end_time, error, retry_info, metrics,
          artifacts, metadata, stored_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (run_id, case_id) DO UPDATE SET
          status = EXCLUDED.status,
          duration = EXCLUDED.duration,
          end_time = EXCLUDED.end_time,
          error = EXCLUDED.error,
          metrics = EXCLUDED.metrics,
          stored_at = EXCLUDED.stored_at
        RETURNING *
      `;

      const now = new Date();
      const result = await this.database.query(sql, [
        input.result.runId,
        input.result.suiteId,
        input.result.caseId,
        input.result.testName,
        input.result.testFile,
        input.result.status,
        input.result.duration,
        input.result.startTime,
        input.result.endTime,
        JSON.stringify(input.result.error ?? null),
        JSON.stringify(input.result.retry),
        JSON.stringify(input.result.metrics),
        JSON.stringify(input.result.artifacts),
        JSON.stringify(input.metadata ?? {}),
        now,
      ]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      return success({
        ...input.result,
        storedAt: now,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async storeTestSuiteResult(input: StoreTestSuiteResultInput): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError> {
    try {
      const runId = input.result.tests[0]?.runId;
      const sql = `
        INSERT INTO test_suite_results (
          run_id, suite_id, name, file, status, duration,
          start_time, end_time, stats, stored_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (run_id, suite_id) DO UPDATE SET
          status = EXCLUDED.status,
          duration = EXCLUDED.duration,
          end_time = EXCLUDED.end_time,
          stats = EXCLUDED.stats,
          stored_at = EXCLUDED.stored_at
        RETURNING *
      `;

      const now = new Date();
      const result = await this.database.query(sql, [
        runId,
        input.result.suiteId,
        input.result.name,
        input.result.file,
        input.result.status,
        input.result.duration,
        input.result.startTime,
        input.result.endTime,
        JSON.stringify(input.result.stats),
        now,
      ]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      // Store individual test results
      for (const test of input.result.tests) {
        await this.storeTestResult({ result: test });
      }

      return success({
        ...input.result,
        storedAt: now,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async storeTestRunResult(input: StoreTestRunResultInput): AsyncResult<StoredTestRunResult, TestResultRepositoryError> {
    try {
      const sql = `
        INSERT INTO test_run_results (
          run_id, name, status, duration, start_time, end_time,
          config, stats, coverage, environment, stored_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (run_id) DO UPDATE SET
          status = EXCLUDED.status,
          duration = EXCLUDED.duration,
          end_time = EXCLUDED.end_time,
          stats = EXCLUDED.stats,
          coverage = EXCLUDED.coverage,
          stored_at = EXCLUDED.stored_at
        RETURNING *
      `;

      const now = new Date();
      const result = await this.database.query(sql, [
        input.result.runId,
        input.result.name,
        input.result.status,
        input.result.duration,
        input.result.startTime,
        input.result.endTime,
        JSON.stringify(input.result.config),
        JSON.stringify(input.result.stats),
        JSON.stringify(input.result.coverage ?? null),
        JSON.stringify(input.result.environment),
        now,
      ]);

      if (!result.success) {
        return failure({
          code: 'DATABASE_ERROR',
          message: result.error.message,
        });
      }

      // Store suite results
      for (const suite of input.result.suites) {
        await this.storeTestSuiteResult({ result: suite });
      }

      return success({
        ...input.result,
        storedAt: now,
      });
    } catch (error) {
      return failure({
        code: 'DATABASE_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async getTestResult(caseId: TestCaseId, runId: TestRunId): AsyncResult<StoredTestResult, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_results WHERE case_id = $1 AND run_id = $2`;
      const result = await this.database.query(sql, [caseId, runId]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      if (result.value.rowCount === 0) {
        return failure({ code: 'NOT_FOUND', message: `Test result not found` });
      }

      return success(this.mapRowToTestResult(result.value.rows[0]));
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getTestSuiteResult(suiteId: TestSuiteId, runId: TestRunId): AsyncResult<StoredTestSuiteResult, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_suite_results WHERE suite_id = $1 AND run_id = $2`;
      const result = await this.database.query(sql, [suiteId, runId]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      if (result.value.rowCount === 0) {
        return failure({ code: 'NOT_FOUND', message: `Suite result not found` });
      }

      // Get tests for this suite
      const testsResult = await this.findTestResults({ runId, suiteId });
      const tests = testsResult.success ? testsResult.value.data : [];

      const row = result.value.rows[0];
      return success({
        suiteId: createTestSuiteId(row.suite_id as string),
        name: row.name as string,
        file: row.file as string,
        status: row.status as TestStatus,
        duration: row.duration as number,
        startTime: new Date(row.start_time as string),
        endTime: new Date(row.end_time as string),
        tests: tests as unknown as TestResult[],
        suites: [],
        stats: JSON.parse(row.stats as string),
        storedAt: new Date(row.stored_at as string),
      });
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getTestRunResult(runId: TestRunId): AsyncResult<StoredTestRunResult, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_run_results WHERE run_id = $1`;
      const result = await this.database.query(sql, [runId]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      if (result.value.rowCount === 0) {
        return failure({ code: 'NOT_FOUND', message: `Run result not found` });
      }

      const row = result.value.rows[0];

      // Get suites
      const suitesResult = await this.database.query(
        `SELECT * FROM test_suite_results WHERE run_id = $1`,
        [runId]
      );

      const suites: StoredTestSuiteResult[] = [];
      if (suitesResult.success) {
        for (const suiteRow of suitesResult.value.rows) {
          const suiteResult = await this.getTestSuiteResult(
            createTestSuiteId(suiteRow.suite_id as string),
            runId
          );
          if (suiteResult.success) {
            suites.push(suiteResult.value);
          }
        }
      }

      return success({
        runId: createTestRunId(row.run_id as string),
        name: row.name as string,
        status: row.status as TestStatus,
        duration: row.duration as number,
        startTime: new Date(row.start_time as string),
        endTime: new Date(row.end_time as string),
        config: JSON.parse(row.config as string),
        suites,
        stats: JSON.parse(row.stats as string),
        coverage: row.coverage ? JSON.parse(row.coverage as string) : undefined,
        environment: JSON.parse(row.environment as string),
        storedAt: new Date(row.stored_at as string),
      });
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async findTestResults(
    criteria: TestResultFilterCriteria,
    pagination?: PaginationParams
  ): AsyncResult<PaginatedResult<StoredTestResult>, TestResultRepositoryError> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (criteria.runId) {
        conditions.push(`run_id = $${paramIndex++}`);
        params.push(criteria.runId);
      }

      if (criteria.suiteId) {
        conditions.push(`suite_id = $${paramIndex++}`);
        params.push(criteria.suiteId);
      }

      if (criteria.status) {
        const statuses = Array.isArray(criteria.status) ? criteria.status : [criteria.status];
        conditions.push(`status = ANY($${paramIndex++})`);
        params.push(statuses);
      }

      if (criteria.testName) {
        conditions.push(`test_name ILIKE $${paramIndex++}`);
        params.push(`%${criteria.testName}%`);
      }

      if (criteria.testFile) {
        conditions.push(`test_file ILIKE $${paramIndex++}`);
        params.push(`%${criteria.testFile}%`);
      }

      if (criteria.minDuration !== undefined) {
        conditions.push(`duration >= $${paramIndex++}`);
        params.push(criteria.minDuration);
      }

      if (criteria.maxDuration !== undefined) {
        conditions.push(`duration <= $${paramIndex++}`);
        params.push(criteria.maxDuration);
      }

      if (criteria.startTimeAfter) {
        conditions.push(`start_time > $${paramIndex++}`);
        params.push(criteria.startTimeAfter);
      }

      if (criteria.startTimeBefore) {
        conditions.push(`start_time < $${paramIndex++}`);
        params.push(criteria.startTimeBefore);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const page = pagination?.page ?? 1;
      const pageSize = pagination?.pageSize ?? 50;
      const offset = (page - 1) * pageSize;

      // Count total
      const countSql = `SELECT COUNT(*) as count FROM test_results ${whereClause}`;
      const countResult = await this.database.query(countSql, params);

      const total = countResult.success
        ? parseInt(countResult.value.rows[0]?.count as string ?? '0', 10)
        : 0;

      // Fetch data
      const dataSql = `
        SELECT * FROM test_results
        ${whereClause}
        ORDER BY start_time DESC
        LIMIT $${paramIndex++} OFFSET $${paramIndex++}
      `;
      const dataResult = await this.database.query(dataSql, [...params, pageSize, offset]);

      if (!dataResult.success) {
        return failure({ code: 'DATABASE_ERROR', message: dataResult.error.message });
      }

      const data = dataResult.value.rows.map(row => this.mapRowToTestResult(row));

      return success({
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      });
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getHistoricalResults(
    testCaseId: TestCaseId,
    options?: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<StoredTestResult>, TestResultRepositoryError> {
    const criteria: TestResultFilterCriteria = {
      startTimeAfter: options?.since,
      startTimeBefore: options?.until,
    };

    const result = await this.findTestResults(criteria, { page: 1, pageSize: options?.runCount ?? 100 });
    if (!result.success) return failure(result.error);

    const filtered = result.value.data.filter(r => r.caseId === testCaseId);
    return success(filtered);
  }

  async getHistoricalTrends(
    options: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<HistoricalTrend>, TestResultRepositoryError> {
    try {
      const conditions: string[] = [];
      const params: unknown[] = [];
      let paramIndex = 1;

      if (options.since) {
        conditions.push(`start_time >= $${paramIndex++}`);
        params.push(options.since);
      }

      if (options.until) {
        conditions.push(`start_time <= $${paramIndex++}`);
        params.push(options.until);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = options.runCount ?? 30;

      const sql = `
        SELECT run_id, name, status, start_time, stats
        FROM test_run_results
        ${whereClause}
        ORDER BY start_time DESC
        LIMIT $${paramIndex++}
      `;

      const result = await this.database.query(sql, [...params, limit]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      const trends: HistoricalTrend[] = result.value.rows.map(row => {
        const stats = JSON.parse(row.stats as string);
        return {
          period: (row.start_time as Date).toISOString().split('T')[0],
          runId: createTestRunId(row.run_id as string),
          passRate: stats.passRate,
          totalTests: stats.total,
          passed: stats.passed,
          failed: stats.failed,
          averageDuration: stats.averageDuration,
          flakyTests: stats.flakyTests ?? 0,
        };
      });

      return success(trends);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async createBaseline(
    name: string,
    runId: TestRunId,
    description?: string
  ): AsyncResult<Baseline, TestResultRepositoryError> {
    try {
      const runResult = await this.getTestRunResult(runId);
      if (!runResult.success) {
        return failure(runResult.error);
      }

      const run = runResult.value;
      const id = createBaselineId(`baseline_${crypto.randomUUID()}`);
      const now = new Date();

      const sql = `
        INSERT INTO test_baselines (id, name, description, run_id, metrics, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const metrics: BaselineMetrics = {
        passRate: run.stats.passRate,
        averageDuration: run.stats.averageDuration,
        totalTests: run.stats.total,
        passed: run.stats.passed,
        failed: run.stats.failed,
        flaky: run.stats.flakyTests,
        custom: {},
      };

      const result = await this.database.query(sql, [
        id,
        name,
        description ?? null,
        runId,
        JSON.stringify(metrics),
        now,
      ]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      return success({ id, name, description, runId, createdAt: now, metrics });
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getBaseline(id: BaselineId): AsyncResult<Baseline, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_baselines WHERE id = $1`;
      const result = await this.database.query(sql, [id]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      if (result.value.rowCount === 0) {
        return failure({ code: 'BASELINE_NOT_FOUND', message: `Baseline ${id} not found` });
      }

      const row = result.value.rows[0];
      return success(this.mapRowToBaseline(row));
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async getBaselineByName(name: string): AsyncResult<Baseline, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_baselines WHERE name = $1`;
      const result = await this.database.query(sql, [name]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      if (result.value.rowCount === 0) {
        return failure({ code: 'BASELINE_NOT_FOUND', message: `Baseline "${name}" not found` });
      }

      const row = result.value.rows[0];
      return success(this.mapRowToBaseline(row));
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async listBaselines(): AsyncResult<ReadonlyArray<Baseline>, TestResultRepositoryError> {
    try {
      const sql = `SELECT * FROM test_baselines ORDER BY created_at DESC`;
      const result = await this.database.query(sql);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      const baselines = result.value.rows.map(row => this.mapRowToBaseline(row));
      return success(baselines);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async deleteBaseline(id: BaselineId): AsyncResult<void, TestResultRepositoryError> {
    try {
      const sql = `DELETE FROM test_baselines WHERE id = $1`;
      const result = await this.database.query(sql, [id]);

      if (!result.success) {
        return failure({ code: 'DATABASE_ERROR', message: result.error.message });
      }

      return success(undefined);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async compareWithBaseline(
    runId: TestRunId,
    baselineId: BaselineId
  ): AsyncResult<ComparisonResult, TestResultRepositoryError> {
    const runResult = await this.getTestRunResult(runId);
    if (!runResult.success) return failure(runResult.error);

    const baselineResult = await this.getBaseline(baselineId);
    if (!baselineResult.success) return failure(baselineResult.error);

    const run = runResult.value;
    const baseline = baselineResult.value;

    const durationDelta = run.stats.averageDuration - baseline.metrics.averageDuration;
    const durationDeltaPercent = baseline.metrics.averageDuration > 0
      ? (durationDelta / baseline.metrics.averageDuration) * 100
      : 0;
    const passRateDelta = run.stats.passRate - baseline.metrics.passRate;

    let status: ComparisonResult['status'];
    if (passRateDelta < -5) {
      status = 'worse';
    } else if (passRateDelta > 5) {
      status = 'better';
    } else {
      status = 'same';
    }

    return success({
      baselineId,
      status,
      durationDelta,
      durationDeltaPercent,
      passRateDelta,
      issues: [],
    });
  }

  async getFlakinessReport(
    options?: HistoricalQueryOptions
  ): AsyncResult<ReadonlyArray<FlakinessReport>, TestResultRepositoryError> {
    // For now, delegate to in-memory implementation logic
    // In production, this would use SQL window functions for efficiency
    const inMemory = new InMemoryTestResultRepository();
    return inMemory.getFlakinessReport(options);
  }

  async deleteTestRunResults(runId: TestRunId): AsyncResult<void, TestResultRepositoryError> {
    try {
      await this.database.query(`DELETE FROM test_results WHERE run_id = $1`, [runId]);
      await this.database.query(`DELETE FROM test_suite_results WHERE run_id = $1`, [runId]);
      await this.database.query(`DELETE FROM test_run_results WHERE run_id = $1`, [runId]);
      return success(undefined);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async deleteOldResults(olderThan: Date): AsyncResult<number, TestResultRepositoryError> {
    try {
      const result = await this.database.query(
        `DELETE FROM test_run_results WHERE start_time < $1`,
        [olderThan]
      );
      return success(result.success ? result.value.rowCount : 0);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  async clear(): AsyncResult<void, TestResultRepositoryError> {
    try {
      await this.database.query(`DELETE FROM test_results`);
      await this.database.query(`DELETE FROM test_suite_results`);
      await this.database.query(`DELETE FROM test_run_results`);
      await this.database.query(`DELETE FROM test_baselines`);
      return success(undefined);
    } catch (error) {
      return failure({ code: 'DATABASE_ERROR', message: error instanceof Error ? error.message : String(error) });
    }
  }

  private mapRowToTestResult(row: Record<string, unknown>): StoredTestResult {
    return {
      runId: createTestRunId(row.run_id as string),
      suiteId: createTestSuiteId(row.suite_id as string),
      caseId: createTestCaseId(row.case_id as string),
      testName: row.test_name as string,
      testFile: row.test_file as string,
      status: row.status as TestStatus,
      duration: row.duration as number,
      startTime: new Date(row.start_time as string),
      endTime: new Date(row.end_time as string),
      error: row.error ? JSON.parse(row.error as string) : undefined,
      retry: JSON.parse(row.retry_info as string),
      metrics: JSON.parse(row.metrics as string),
      artifacts: JSON.parse(row.artifacts as string),
      metadata: JSON.parse(row.metadata as string ?? '{}'),
      storedAt: new Date(row.stored_at as string),
    };
  }

  private mapRowToBaseline(row: Record<string, unknown>): Baseline {
    return {
      id: createBaselineId(row.id as string),
      name: row.name as string,
      description: row.description as string | undefined,
      runId: createTestRunId(row.run_id as string),
      createdAt: new Date(row.created_at as string),
      metrics: JSON.parse(row.metrics as string),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an in-memory test result repository
 */
export function createInMemoryTestResultRepository(): ITestResultRepository {
  return new InMemoryTestResultRepository();
}

/**
 * Create a database-backed test result repository
 */
export function createDatabaseTestResultRepository(database: TestDatabase): ITestResultRepository {
  return new DatabaseTestResultRepository(database);
}

/**
 * Type guard for TestResultRepositoryError
 */
export function isTestResultRepositoryError(value: unknown): value is TestResultRepositoryError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
