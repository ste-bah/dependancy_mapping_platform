/**
 * Test Orchestrator Service
 * @module e2e/services/test-orchestrator
 *
 * Orchestrates E2E test execution lifecycle including:
 * - Fixture setup coordination
 * - Parallel test execution support
 * - Result aggregation
 * - Cleanup management
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #22 of 47 | Phase 4: Implementation
 */

import {
  TestSession,
  createTestSession,
  type SessionConfig,
  type SessionState,
  type SessionError,
} from '../domain/test-session.js';
import {
  FixtureRegistry,
  getFixtureRegistry,
  type FixtureId,
  type FixtureDefinition,
  type RegistryError,
} from '../domain/fixture-registry.js';
import {
  TestDatabase,
  createTestDatabase,
  type TestDatabaseConfig,
  type SeedData,
  type SeedResult,
  type DatabaseError,
} from '../domain/test-database.js';
import {
  MockProvider,
  createMockProvider,
  type MockProviderConfig,
  type MockProviderError,
} from '../domain/mock-provider.js';
import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure, isSuccess } from '../../api/src/types/utility.js';
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

// ============================================================================
// Types
// ============================================================================

/**
 * Test orchestrator configuration
 */
export interface TestOrchestratorConfig {
  /** Maximum parallel test suites */
  readonly maxParallelSuites: number;
  /** Maximum parallel test cases within a suite */
  readonly maxParallelCases: number;
  /** Global test timeout in milliseconds */
  readonly globalTimeout: number;
  /** Suite timeout in milliseconds */
  readonly suiteTimeout: number;
  /** Case timeout in milliseconds */
  readonly caseTimeout: number;
  /** Retry failed tests */
  readonly retryFailedTests: boolean;
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Stop on first failure */
  readonly stopOnFirstFailure: boolean;
  /** Generate coverage report */
  readonly collectCoverage: boolean;
  /** Verbose logging */
  readonly verbose: boolean;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: TestOrchestratorConfig = {
  maxParallelSuites: 4,
  maxParallelCases: 8,
  globalTimeout: 600000, // 10 minutes
  suiteTimeout: 120000, // 2 minutes
  caseTimeout: 30000, // 30 seconds
  retryFailedTests: true,
  maxRetries: 2,
  stopOnFirstFailure: false,
  collectCoverage: true,
  verbose: false,
};

/**
 * Test suite definition for execution
 */
export interface TestSuiteDefinition {
  readonly id: TestSuiteId;
  readonly name: string;
  readonly description?: string;
  readonly cases: ReadonlyArray<TestCaseDefinition>;
  readonly setup?: () => Promise<void>;
  readonly teardown?: () => Promise<void>;
  readonly fixtures?: ReadonlyArray<FixtureId>;
  readonly tags?: ReadonlyArray<string>;
  readonly timeout?: number;
  readonly parallel?: boolean;
}

/**
 * Test case definition
 */
export interface TestCaseDefinition {
  readonly id: TestCaseId;
  readonly name: string;
  readonly description?: string;
  readonly fn: TestCaseFunction;
  readonly fixtures?: ReadonlyArray<FixtureId>;
  readonly tags?: ReadonlyArray<string>;
  readonly timeout?: number;
  readonly skip?: boolean;
  readonly only?: boolean;
  readonly retries?: number;
}

/**
 * Test case function signature
 */
export type TestCaseFunction = (context: TestCaseContext) => Promise<void>;

/**
 * Context provided to test cases
 */
export interface TestCaseContext {
  readonly session: TestSession;
  readonly database: TestDatabase;
  readonly mocks: MockProvider;
  readonly fixtures: ReadonlyMap<FixtureId, unknown>;
  readonly log: (message: string, data?: Record<string, unknown>) => void;
}

/**
 * Test run input
 */
export interface TestRunInput {
  readonly suites: ReadonlyArray<TestSuiteDefinition>;
  readonly filter?: TestFilter;
  readonly seed?: SeedData;
  readonly config?: Partial<TestOrchestratorConfig>;
  readonly onProgress?: TestProgressCallback;
}

/**
 * Test filter
 */
export interface TestFilter {
  readonly suiteIds?: ReadonlyArray<TestSuiteId>;
  readonly caseIds?: ReadonlyArray<TestCaseId>;
  readonly tags?: ReadonlyArray<string>;
  readonly skipTags?: ReadonlyArray<string>;
}

/**
 * Progress callback
 */
export type TestProgressCallback = (progress: TestRunProgress) => void | Promise<void>;

/**
 * Test run progress
 */
export interface TestRunProgress {
  readonly runId: TestRunId;
  readonly phase: 'setup' | 'running' | 'teardown' | 'completed';
  readonly totalSuites: number;
  readonly completedSuites: number;
  readonly totalCases: number;
  readonly completedCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly skippedCases: number;
  readonly currentSuite?: string;
  readonly currentCase?: string;
  readonly elapsedMs: number;
}

/**
 * Orchestrator error
 */
export interface OrchestratorError {
  readonly code: OrchestratorErrorCode;
  readonly message: string;
  readonly suiteId?: TestSuiteId;
  readonly caseId?: TestCaseId;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}

/**
 * Error codes
 */
export type OrchestratorErrorCode =
  | 'SETUP_FAILED'
  | 'FIXTURE_RESOLUTION_FAILED'
  | 'DATABASE_ERROR'
  | 'MOCK_ERROR'
  | 'SUITE_TIMEOUT'
  | 'CASE_TIMEOUT'
  | 'GLOBAL_TIMEOUT'
  | 'TEARDOWN_FAILED'
  | 'CANCELLED'
  | 'INTERNAL_ERROR';

// ============================================================================
// Orchestrator Interface
// ============================================================================

/**
 * Test orchestrator interface
 */
export interface ITestOrchestrator {
  /**
   * Execute a complete test run
   */
  executeRun(input: TestRunInput): AsyncResult<TestRunResult, OrchestratorError>;

  /**
   * Execute a single test suite
   */
  executeSuite(
    suite: TestSuiteDefinition,
    context: TestCaseContext
  ): AsyncResult<TestSuiteResult, OrchestratorError>;

  /**
   * Execute a single test case
   */
  executeCase(
    testCase: TestCaseDefinition,
    context: TestCaseContext
  ): AsyncResult<TestResult, OrchestratorError>;

  /**
   * Cancel the current run
   */
  cancelRun(runId: TestRunId): Result<void, OrchestratorError>;

  /**
   * Get current run status
   */
  getRunStatus(runId: TestRunId): Result<TestRunProgress, OrchestratorError>;
}

// ============================================================================
// Test Orchestrator Implementation
// ============================================================================

/**
 * Test orchestrator coordinates E2E test execution
 */
export class TestOrchestrator implements ITestOrchestrator {
  private readonly config: TestOrchestratorConfig;
  private readonly fixtureRegistry: FixtureRegistry;
  private readonly runningRuns: Map<string, AbortController>;
  private readonly runProgress: Map<string, TestRunProgress>;

  constructor(
    private readonly databaseConfig?: Partial<TestDatabaseConfig>,
    private readonly mockConfig?: Partial<MockProviderConfig>,
    config?: Partial<TestOrchestratorConfig>
  ) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.fixtureRegistry = getFixtureRegistry();
    this.runningRuns = new Map();
    this.runProgress = new Map();
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Execute a complete test run
   */
  async executeRun(input: TestRunInput): AsyncResult<TestRunResult, OrchestratorError> {
    const runId = createTestRunId(`run_${Date.now()}`);
    const startTime = Date.now();
    const abortController = new AbortController();

    this.runningRuns.set(runId, abortController);

    const mergedConfig = { ...this.config, ...input.config };

    // Initialize progress
    const progress: TestRunProgress = {
      runId,
      phase: 'setup',
      totalSuites: input.suites.length,
      completedSuites: 0,
      totalCases: input.suites.reduce((sum, s) => sum + s.cases.length, 0),
      completedCases: 0,
      passedCases: 0,
      failedCases: 0,
      skippedCases: 0,
      elapsedMs: 0,
    };
    this.runProgress.set(runId, progress);

    const session = createTestSession({
      name: `Test Run ${runId}`,
      timeout: mergedConfig.globalTimeout,
    });

    const database = createTestDatabase(this.databaseConfig);
    const mocks = createMockProvider(this.mockConfig);

    const suiteResults: TestSuiteResult[] = [];
    let hasFailure = false;

    try {
      // Initialize session
      const initResult = session.initialize();
      if (!initResult.success) {
        return failure(this.toOrchestratorError(initResult.error, 'SETUP_FAILED'));
      }

      // Connect database
      const dbConnectResult = await database.connect();
      if (!dbConnectResult.success) {
        return failure(this.toOrchestratorError(dbConnectResult.error, 'DATABASE_ERROR'));
      }

      // Initialize database schema
      const schemaResult = await database.initializeSchema();
      if (!schemaResult.success) {
        return failure(this.toOrchestratorError(schemaResult.error, 'DATABASE_ERROR'));
      }

      // Seed data if provided
      let seedResult: SeedResult | undefined;
      if (input.seed) {
        const seedResultOrError = await database.seed(input.seed);
        if (!seedResultOrError.success) {
          return failure(this.toOrchestratorError(seedResultOrError.error, 'DATABASE_ERROR'));
        }
        seedResult = seedResultOrError.value;
      }

      // Start mock provider
      const mockStartResult = await mocks.start();
      if (!mockStartResult.success) {
        return failure(this.toOrchestratorError(mockStartResult.error, 'MOCK_ERROR'));
      }

      // Start session
      const startResult = session.start();
      if (!startResult.success) {
        return failure(this.toOrchestratorError(startResult.error, 'SETUP_FAILED'));
      }

      // Update progress
      await this.updateProgress(runId, { phase: 'running' }, input.onProgress);

      // Filter suites
      const filteredSuites = this.filterSuites(input.suites, input.filter);

      // Execute suites
      if (mergedConfig.maxParallelSuites > 1 && filteredSuites.length > 1) {
        // Parallel execution
        const results = await this.executeParallelSuites(
          filteredSuites,
          session,
          database,
          mocks,
          mergedConfig,
          runId,
          input.onProgress,
          abortController.signal
        );
        suiteResults.push(...results);
      } else {
        // Sequential execution
        for (const suite of filteredSuites) {
          if (abortController.signal.aborted) {
            break;
          }

          await this.updateProgress(
            runId,
            { currentSuite: suite.name },
            input.onProgress
          );

          const context = await this.createTestContext(
            session,
            database,
            mocks,
            suite.fixtures
          );

          if (!context.success) {
            hasFailure = true;
            continue;
          }

          const suiteResult = await this.executeSuite(suite, context.value);

          if (suiteResult.success) {
            suiteResults.push(suiteResult.value);

            // Update progress counts
            const stats = this.calculateSuiteStats(suiteResult.value);
            await this.updateProgress(
              runId,
              {
                completedSuites: suiteResults.length,
                completedCases: progress.completedCases + stats.total,
                passedCases: progress.passedCases + stats.passed,
                failedCases: progress.failedCases + stats.failed,
                skippedCases: progress.skippedCases + stats.skipped,
              },
              input.onProgress
            );

            if (stats.failed > 0) {
              hasFailure = true;
              if (mergedConfig.stopOnFirstFailure) {
                break;
              }
            }
          } else {
            hasFailure = true;
            if (mergedConfig.stopOnFirstFailure) {
              break;
            }
          }
        }
      }

      // Teardown phase
      await this.updateProgress(runId, { phase: 'teardown' }, input.onProgress);

      // Complete session
      if (hasFailure) {
        session.fail({
          code: 'TESTS_FAILED',
          message: 'One or more tests failed',
        });
      } else {
        session.complete();
      }

      // Stop mocks
      await mocks.stop();

      // Cleanup database
      await database.clean();
      await database.disconnect();

      // Run cleanup handlers
      await session.runCleanup();

      const durationMs = Date.now() - startTime;

      await this.updateProgress(
        runId,
        {
          phase: 'completed',
          elapsedMs: durationMs,
        },
        input.onProgress
      );

      // Build result
      const runResult = this.buildRunResult(runId, suiteResults, durationMs, seedResult);

      this.runningRuns.delete(runId);

      return success(runResult);
    } catch (error) {
      this.runningRuns.delete(runId);

      session.fail({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
      });

      await mocks.stop();
      await database.disconnect();
      await session.runCleanup();

      return failure({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute a single test suite
   */
  async executeSuite(
    suite: TestSuiteDefinition,
    context: TestCaseContext
  ): AsyncResult<TestSuiteResult, OrchestratorError> {
    const startTime = Date.now();
    const timeout = suite.timeout ?? this.config.suiteTimeout;

    try {
      // Run suite setup
      if (suite.setup) {
        await this.withTimeout(suite.setup(), timeout, 'Suite setup');
      }

      // Filter cases
      const filteredCases = this.filterCases(suite.cases);

      // Execute cases
      const caseResults: TestResult[] = [];

      if (suite.parallel && this.config.maxParallelCases > 1) {
        // Parallel case execution
        const results = await this.executeParallelCases(
          filteredCases,
          context,
          timeout
        );
        caseResults.push(...results);
      } else {
        // Sequential case execution
        for (const testCase of filteredCases) {
          const caseResult = await this.executeCase(testCase, context);
          if (caseResult.success) {
            caseResults.push(caseResult.value);
          } else {
            caseResults.push(this.createFailedCaseResult(testCase, caseResult.error));
          }
        }
      }

      // Run suite teardown
      if (suite.teardown) {
        await this.withTimeout(suite.teardown(), timeout, 'Suite teardown');
      }

      const durationMs = Date.now() - startTime;

      return success({
        id: suite.id,
        name: suite.name,
        status: this.calculateSuiteStatus(caseResults),
        results: caseResults,
        stats: this.calculateSuiteStats({ id: suite.id, name: suite.name, status: 'passed', results: caseResults, stats: { total: 0, passed: 0, failed: 0, skipped: 0, duration: 0 }, startedAt: new Date(), completedAt: new Date() }),
        startedAt: new Date(startTime),
        completedAt: new Date(),
      });
    } catch (error) {
      return failure({
        code: 'SUITE_TIMEOUT',
        message: error instanceof Error ? error.message : String(error),
        suiteId: suite.id,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  /**
   * Execute a single test case
   */
  async executeCase(
    testCase: TestCaseDefinition,
    context: TestCaseContext
  ): AsyncResult<TestResult, OrchestratorError> {
    if (testCase.skip) {
      return success(this.createSkippedCaseResult(testCase));
    }

    const startTime = Date.now();
    const timeout = testCase.timeout ?? this.config.caseTimeout;
    const maxRetries = testCase.retries ?? (this.config.retryFailedTests ? this.config.maxRetries : 0);

    let lastError: Error | undefined;
    let attempts = 0;

    while (attempts <= maxRetries) {
      attempts++;

      try {
        await this.withTimeout(testCase.fn(context), timeout, `Test case: ${testCase.name}`);

        const durationMs = Date.now() - startTime;

        return success({
          id: testCase.id,
          name: testCase.name,
          status: 'passed' as TestStatus,
          duration: durationMs,
          startedAt: new Date(startTime),
          completedAt: new Date(),
          retryInfo: attempts > 1 ? { attempts, maxRetries: maxRetries + 1 } : undefined,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempts <= maxRetries) {
          // Wait before retry
          await this.delay(100 * attempts);
        }
      }
    }

    const durationMs = Date.now() - startTime;

    return success({
      id: testCase.id,
      name: testCase.name,
      status: 'failed' as TestStatus,
      duration: durationMs,
      startedAt: new Date(startTime),
      completedAt: new Date(),
      error: {
        message: lastError?.message ?? 'Unknown error',
        stack: lastError?.stack,
      },
      retryInfo: attempts > 1 ? { attempts, maxRetries: maxRetries + 1 } : undefined,
    });
  }

  /**
   * Cancel the current run
   */
  cancelRun(runId: TestRunId): Result<void, OrchestratorError> {
    const controller = this.runningRuns.get(runId);

    if (!controller) {
      return failure({
        code: 'INTERNAL_ERROR',
        message: `Run ${runId} not found`,
      });
    }

    controller.abort();
    this.runningRuns.delete(runId);

    return success(undefined);
  }

  /**
   * Get current run status
   */
  getRunStatus(runId: TestRunId): Result<TestRunProgress, OrchestratorError> {
    const progress = this.runProgress.get(runId);

    if (!progress) {
      return failure({
        code: 'INTERNAL_ERROR',
        message: `Run ${runId} not found`,
      });
    }

    return success(progress);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async createTestContext(
    session: TestSession,
    database: TestDatabase,
    mocks: MockProvider,
    fixtureIds?: ReadonlyArray<FixtureId>
  ): AsyncResult<TestCaseContext, OrchestratorError> {
    const resolvedFixtures = new Map<FixtureId, unknown>();

    if (fixtureIds) {
      for (const fixtureId of fixtureIds) {
        const result = await this.fixtureRegistry.resolve(fixtureId);
        if (!result.success) {
          return failure({
            code: 'FIXTURE_RESOLUTION_FAILED',
            message: `Failed to resolve fixture ${fixtureId}: ${result.error.message}`,
            context: { fixtureId },
          });
        }
        resolvedFixtures.set(fixtureId, result.value);
      }
    }

    return success({
      session,
      database,
      mocks,
      fixtures: resolvedFixtures,
      log: (message: string, data?: Record<string, unknown>) => {
        if (this.config.verbose) {
          console.log(`[TEST] ${message}`, data ?? '');
        }
      },
    });
  }

  private async executeParallelSuites(
    suites: ReadonlyArray<TestSuiteDefinition>,
    session: TestSession,
    database: TestDatabase,
    mocks: MockProvider,
    config: TestOrchestratorConfig,
    runId: TestRunId,
    onProgress?: TestProgressCallback,
    signal?: AbortSignal
  ): Promise<TestSuiteResult[]> {
    const results: TestSuiteResult[] = [];
    const chunks = this.chunkArray(suites, config.maxParallelSuites);

    for (const chunk of chunks) {
      if (signal?.aborted) break;

      const chunkPromises = chunk.map(async (suite) => {
        const context = await this.createTestContext(
          session,
          database,
          mocks,
          suite.fixtures
        );

        if (!context.success) {
          return null;
        }

        const result = await this.executeSuite(suite, context.value);
        return result.success ? result.value : null;
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults.filter((r): r is TestSuiteResult => r !== null));
    }

    return results;
  }

  private async executeParallelCases(
    cases: ReadonlyArray<TestCaseDefinition>,
    context: TestCaseContext,
    _timeout: number
  ): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const chunks = this.chunkArray(cases, this.config.maxParallelCases);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (testCase) => {
        const result = await this.executeCase(testCase, context);
        return result.success ? result.value : this.createFailedCaseResult(testCase, result.error);
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  private filterSuites(
    suites: ReadonlyArray<TestSuiteDefinition>,
    filter?: TestFilter
  ): TestSuiteDefinition[] {
    if (!filter) return [...suites];

    return suites.filter((suite) => {
      if (filter.suiteIds && !filter.suiteIds.includes(suite.id)) {
        return false;
      }

      if (filter.tags && suite.tags) {
        const hasMatchingTag = filter.tags.some((tag) => suite.tags?.includes(tag));
        if (!hasMatchingTag) return false;
      }

      if (filter.skipTags && suite.tags) {
        const hasSkipTag = filter.skipTags.some((tag) => suite.tags?.includes(tag));
        if (hasSkipTag) return false;
      }

      return true;
    });
  }

  private filterCases(cases: ReadonlyArray<TestCaseDefinition>): TestCaseDefinition[] {
    // Check for 'only' cases
    const onlyCases = cases.filter((c) => c.only);
    if (onlyCases.length > 0) {
      return onlyCases;
    }
    return [...cases];
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    description: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Timeout: ${description} exceeded ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async updateProgress(
    runId: TestRunId,
    update: Partial<TestRunProgress>,
    callback?: TestProgressCallback
  ): Promise<void> {
    const current = this.runProgress.get(runId);
    if (current) {
      const updated = {
        ...current,
        ...update,
        elapsedMs: Date.now() - (current.elapsedMs || 0),
      };
      this.runProgress.set(runId, updated);

      if (callback) {
        try {
          await callback(updated);
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  private calculateSuiteStatus(results: TestResult[]): TestStatus {
    const hasFailure = results.some((r) => r.status === 'failed');
    const allSkipped = results.every((r) => r.status === 'skipped');

    if (hasFailure) return 'failed';
    if (allSkipped) return 'skipped';
    return 'passed';
  }

  private calculateSuiteStats(result: TestSuiteResult): { total: number; passed: number; failed: number; skipped: number } {
    const results = result.results;
    return {
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    };
  }

  private buildRunResult(
    runId: TestRunId,
    suiteResults: TestSuiteResult[],
    durationMs: number,
    _seedResult?: SeedResult
  ): TestRunResult {
    const allCases = suiteResults.flatMap((s) => s.results);

    return {
      id: runId,
      status: this.calculateSuiteStatus(allCases),
      suites: suiteResults,
      stats: {
        totalSuites: suiteResults.length,
        passedSuites: suiteResults.filter((s) => s.status === 'passed').length,
        failedSuites: suiteResults.filter((s) => s.status === 'failed').length,
        skippedSuites: suiteResults.filter((s) => s.status === 'skipped').length,
        totalCases: allCases.length,
        passedCases: allCases.filter((c) => c.status === 'passed').length,
        failedCases: allCases.filter((c) => c.status === 'failed').length,
        skippedCases: allCases.filter((c) => c.status === 'skipped').length,
        duration: durationMs,
      },
      startedAt: new Date(Date.now() - durationMs),
      completedAt: new Date(),
    };
  }

  private createSkippedCaseResult(testCase: TestCaseDefinition): TestResult {
    return {
      id: testCase.id,
      name: testCase.name,
      status: 'skipped' as TestStatus,
      duration: 0,
      startedAt: new Date(),
      completedAt: new Date(),
    };
  }

  private createFailedCaseResult(testCase: TestCaseDefinition, error: OrchestratorError): TestResult {
    return {
      id: testCase.id,
      name: testCase.name,
      status: 'failed' as TestStatus,
      duration: 0,
      startedAt: new Date(),
      completedAt: new Date(),
      error: {
        message: error.message,
      },
    };
  }

  private toOrchestratorError(
    error: SessionError | DatabaseError | MockProviderError | RegistryError,
    code: OrchestratorErrorCode
  ): OrchestratorError {
    return {
      code,
      message: error.message,
      context: 'context' in error ? error.context : undefined,
    };
  }

  private chunkArray<T>(array: ReadonlyArray<T>, size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size) as T[]);
    }
    return chunks;
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new test orchestrator
 */
export function createTestOrchestrator(
  databaseConfig?: Partial<TestDatabaseConfig>,
  mockConfig?: Partial<MockProviderConfig>,
  config?: Partial<TestOrchestratorConfig>
): ITestOrchestrator {
  return new TestOrchestrator(databaseConfig, mockConfig, config);
}

/**
 * Create a test suite definition
 */
export function defineSuite(options: Omit<TestSuiteDefinition, 'id'>): TestSuiteDefinition {
  return {
    id: createTestSuiteId(`suite_${options.name.toLowerCase().replace(/\s+/g, '_')}`),
    ...options,
  };
}

/**
 * Create a test case definition
 */
export function defineCase(options: Omit<TestCaseDefinition, 'id'>): TestCaseDefinition {
  return {
    id: createTestCaseId(`case_${options.name.toLowerCase().replace(/\s+/g, '_')}`),
    ...options,
  };
}

/**
 * Type guard for OrchestratorError
 */
export function isOrchestratorError(value: unknown): value is OrchestratorError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
