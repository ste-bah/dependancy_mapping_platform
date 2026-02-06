/**
 * E2E Test API Handlers
 * @module e2e/api/handlers
 *
 * Request handlers for E2E test management API endpoints.
 * Coordinates with test orchestrator and repositories.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #24 of 47 | Phase 4: Implementation
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import {
  createTestOrchestrator,
  defineSuite,
  defineCase,
  type ITestOrchestrator,
  type TestOrchestratorConfig,
  type TestRunInput,
  type TestRunProgress as OrchestratorProgress,
  type OrchestratorError,
} from '../services/test-orchestrator.js';
import {
  createInMemoryTestResultRepository,
  type ITestResultRepository,
  type StoredTestRunResult,
  type TestResultRepositoryError,
} from '../data/test-result-repository.js';
import {
  createInMemoryFixtureRepository,
  type IFixtureRepository,
  type CreateFixtureInput,
  type StoredFixture,
  type FixtureRepositoryError,
} from '../data/fixture-repository.js';
import {
  createCleanupService,
  type ICleanupService,
  type CleanupResult as CleanupServiceResult,
  type CleanupError,
} from '../data/cleanup.js';
import type { TestDatabase } from '../domain/test-database.js';
import type { TestRunId, TestSuiteId, TestCaseId } from '../types/test-types.js';
import { createTestRunId, createTestSuiteId, createTestCaseId } from '../types/test-types.js';
import type {
  CreateTestRunRequest,
  TestRunResponse,
  TestRunResultResponse,
  TestRunProgress,
  LoadFixturesRequest,
  LoadFixturesResponse,
  FixtureResponse,
  CleanupRequest,
  CleanupResult,
  ListTestRunsQuery,
  TestRunIdParam,
  TestStatusType,
  PaginationInfo,
} from './schemas.js';
import { createPaginationInfo } from './schemas.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Handler dependencies
 */
export interface HandlerDependencies {
  readonly orchestrator: ITestOrchestrator;
  readonly resultRepository: ITestResultRepository;
  readonly fixtureRepository: IFixtureRepository;
  readonly cleanupService?: ICleanupService;
  readonly database?: TestDatabase;
}

/**
 * Handler error
 */
export interface HandlerError {
  readonly code: string;
  readonly message: string;
  readonly statusCode: number;
  readonly details?: unknown;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: {
    readonly code: string;
    readonly message: string;
    readonly details?: unknown;
  };
}

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create E2E API handlers with dependencies
 */
export function createE2EHandlers(deps: Partial<HandlerDependencies> = {}) {
  // Initialize default dependencies
  const orchestrator = deps.orchestrator ?? createTestOrchestrator();
  const resultRepository = deps.resultRepository ?? createInMemoryTestResultRepository();
  const fixtureRepository = deps.fixtureRepository ?? createInMemoryFixtureRepository();

  // Track active runs for status queries
  const activeRuns = new Map<string, {
    progress: OrchestratorProgress;
    startTime: Date;
    config: CreateTestRunRequest;
  }>();

  // ============================================================================
  // Test Run Handlers
  // ============================================================================

  /**
   * POST /e2e/runs - Create and start a test run
   */
  async function createTestRun(
    request: FastifyRequest<{ Body: CreateTestRunRequest }>,
    reply: FastifyReply
  ): Promise<TestRunResponse> {
    const { name, suites, filter, config, environment, metadata } = request.body;

    const runId = createTestRunId(`run_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);
    const now = new Date();

    // Initialize progress tracking
    const initialProgress: TestRunProgress = {
      phase: 'setup',
      totalSuites: suites.length,
      completedSuites: 0,
      totalCases: 0, // Will be updated when suites are loaded
      completedCases: 0,
      passedCases: 0,
      failedCases: 0,
      skippedCases: 0,
      elapsedMs: 0,
    };

    // Store active run info
    activeRuns.set(runId as string, {
      progress: {
        runId,
        phase: 'setup',
        totalSuites: suites.length,
        completedSuites: 0,
        totalCases: 0,
        completedCases: 0,
        passedCases: 0,
        failedCases: 0,
        skippedCases: 0,
        elapsedMs: 0,
      },
      startTime: now,
      config: request.body,
    });

    // Build test run input
    const testRunInput: TestRunInput = {
      suites: [], // Would be populated by resolving suite identifiers
      filter: filter ? {
        suiteIds: filter.suiteIds?.map(id => createTestSuiteId(id)),
        caseIds: filter.caseIds?.map(id => createTestCaseId(id)),
        tags: filter.tags,
        skipTags: filter.skipTags,
      } : undefined,
      config: config ? {
        maxParallelSuites: config.parallel?.workers ?? 1,
        maxParallelCases: config.parallel?.enabled ? 8 : 1,
        globalTimeout: config.timeout ?? 30000,
        suiteTimeout: config.timeout ?? 120000,
        caseTimeout: config.timeout ?? 30000,
        retryFailedTests: (config.retries ?? 0) > 0,
        maxRetries: config.retries ?? 0,
        stopOnFirstFailure: config.stopOnFirstFailure ?? false,
        collectCoverage: config.collectCoverage ?? false,
        verbose: config.verbose ?? false,
      } : undefined,
      onProgress: async (progress) => {
        // Update active run progress
        const activeRun = activeRuns.get(runId as string);
        if (activeRun) {
          activeRun.progress = progress;
        }
      },
    };

    // Start execution asynchronously
    // In a real implementation, this would be queued to a job processor
    setImmediate(async () => {
      try {
        const result = await orchestrator.executeRun(testRunInput);

        if (result.success) {
          // Store result
          await resultRepository.storeTestRunResult({ result: result.value });
        }

        // Clean up active run tracking
        activeRuns.delete(runId as string);
      } catch (error) {
        // Log error and clean up
        console.error('Test run execution failed:', error);
        activeRuns.delete(runId as string);
      }
    });

    const response: TestRunResponse = {
      id: runId as string,
      name: name ?? `Test Run ${runId}`,
      status: 'pending',
      progress: initialProgress,
      config: {
        timeout: config?.timeout ?? 30000,
        retries: config?.retries ?? 0,
        parallel: config?.parallel,
        stopOnFirstFailure: config?.stopOnFirstFailure,
        collectCoverage: config?.collectCoverage,
        verbose: config?.verbose,
      },
      createdAt: now.toISOString(),
      metadata,
    };

    reply.status(201);
    return response;
  }

  /**
   * GET /e2e/runs/:id - Get test run status
   */
  async function getTestRun(
    request: FastifyRequest<{ Params: TestRunIdParam }>,
    reply: FastifyReply
  ): Promise<TestRunResponse> {
    const { id } = request.params;
    const runId = createTestRunId(id);

    // Check active runs first
    const activeRun = activeRuns.get(id);
    if (activeRun) {
      const now = Date.now();
      const elapsedMs = now - activeRun.startTime.getTime();

      return {
        id,
        name: activeRun.config.name ?? `Test Run ${id}`,
        status: 'running',
        progress: {
          phase: activeRun.progress.phase as TestRunProgress['phase'],
          totalSuites: activeRun.progress.totalSuites,
          completedSuites: activeRun.progress.completedSuites,
          totalCases: activeRun.progress.totalCases,
          completedCases: activeRun.progress.completedCases,
          passedCases: activeRun.progress.passedCases,
          failedCases: activeRun.progress.failedCases,
          skippedCases: activeRun.progress.skippedCases,
          currentSuite: activeRun.progress.currentSuite,
          currentCase: activeRun.progress.currentCase,
          elapsedMs,
        },
        config: {
          timeout: activeRun.config.config?.timeout ?? 30000,
          retries: activeRun.config.config?.retries ?? 0,
          parallel: activeRun.config.config?.parallel,
          stopOnFirstFailure: activeRun.config.config?.stopOnFirstFailure,
          collectCoverage: activeRun.config.config?.collectCoverage,
          verbose: activeRun.config.config?.verbose,
        },
        createdAt: activeRun.startTime.toISOString(),
        startedAt: activeRun.startTime.toISOString(),
        metadata: activeRun.config.metadata,
      };
    }

    // Check completed runs in repository
    const result = await resultRepository.getTestRunResult(runId);

    if (!result.success) {
      reply.status(404);
      throw {
        statusCode: 404,
        error: 'Not Found',
        message: `Test run '${id}' not found`,
        code: 'TEST_RUN_NOT_FOUND',
      };
    }

    const run = result.value;

    return {
      id: run.runId as string,
      name: run.name,
      status: run.status as TestStatusType,
      progress: {
        phase: 'completed',
        totalSuites: run.stats.suitesTotal,
        completedSuites: run.stats.suitesTotal,
        totalCases: run.stats.total,
        completedCases: run.stats.total,
        passedCases: run.stats.passed,
        failedCases: run.stats.failed,
        skippedCases: run.stats.skipped,
        elapsedMs: run.duration,
      },
      config: {
        timeout: run.config.timeout,
        retries: run.config.retries,
        parallel: run.config.parallel,
      },
      createdAt: run.startTime.toISOString(),
      startedAt: run.startTime.toISOString(),
      completedAt: run.endTime.toISOString(),
    };
  }

  /**
   * GET /e2e/runs/:id/results - Get detailed test results
   */
  async function getTestRunResults(
    request: FastifyRequest<{ Params: TestRunIdParam }>,
    reply: FastifyReply
  ): Promise<TestRunResultResponse> {
    const { id } = request.params;
    const runId = createTestRunId(id);

    // Check if run is still active
    if (activeRuns.has(id)) {
      reply.status(202);
      throw {
        statusCode: 202,
        error: 'Accepted',
        message: 'Test run is still in progress',
        code: 'TEST_RUN_IN_PROGRESS',
      };
    }

    const result = await resultRepository.getTestRunResult(runId);

    if (!result.success) {
      reply.status(404);
      throw {
        statusCode: 404,
        error: 'Not Found',
        message: `Test run '${id}' not found`,
        code: 'TEST_RUN_NOT_FOUND',
      };
    }

    const run = result.value;
    const passRate = run.stats.total > 0
      ? (run.stats.passed / run.stats.total) * 100
      : 0;

    return {
      id: run.runId as string,
      name: run.name,
      status: run.status as TestStatusType,
      duration: run.duration,
      startedAt: run.startTime.toISOString(),
      completedAt: run.endTime.toISOString(),
      suites: run.suites.map(suite => ({
        id: suite.suiteId as string,
        name: suite.name,
        status: suite.status as TestStatusType,
        duration: suite.duration,
        startedAt: suite.startTime.toISOString(),
        completedAt: suite.endTime.toISOString(),
        results: suite.tests.map(test => ({
          id: test.caseId as string,
          name: test.testName,
          status: test.status as TestStatusType,
          duration: test.duration,
          startedAt: test.startTime.toISOString(),
          completedAt: test.endTime?.toISOString(),
          error: test.error ? {
            name: test.error.name,
            message: test.error.message,
            stack: test.error.stack,
            expected: test.error.expected,
            actual: test.error.actual,
            diff: test.error.diff,
          } : undefined,
          retryInfo: test.retry ? {
            attempts: test.retry.attempt,
            maxRetries: test.retry.maxRetries,
          } : undefined,
        })),
        stats: {
          total: suite.stats.total,
          passed: suite.stats.passed,
          failed: suite.stats.failed,
          skipped: suite.stats.skipped,
          duration: suite.duration,
        },
      })),
      stats: {
        totalSuites: run.stats.suitesTotal,
        passedSuites: run.stats.suitesPassed,
        failedSuites: run.stats.suitesFailed,
        skippedSuites: run.stats.skippedSuites ?? 0,
        totalCases: run.stats.total,
        passedCases: run.stats.passed,
        failedCases: run.stats.failed,
        skippedCases: run.stats.skipped,
        duration: run.duration,
        passRate,
      },
      coverage: run.coverage ? {
        lines: run.coverage.lines,
        branches: run.coverage.branches,
      } : undefined,
      environment: run.environment ? {
        nodeVersion: run.environment.nodeVersion,
        platform: run.environment.platform,
        ci: run.environment.ci,
      } : undefined,
    };
  }

  /**
   * GET /e2e/runs - List test runs
   */
  async function listTestRuns(
    request: FastifyRequest<{ Querystring: ListTestRunsQuery }>,
    reply: FastifyReply
  ): Promise<{ data: TestRunResponse[]; pagination: PaginationInfo }> {
    const { page = 1, pageSize = 20, status, since, until, sortBy, sortOrder } = request.query;

    // Get historical trends which contain run info
    const trendsResult = await resultRepository.getHistoricalTrends({
      since: since ? new Date(since) : undefined,
      until: until ? new Date(until) : undefined,
      runCount: 100,
    });

    let runs: TestRunResponse[] = [];

    // Get active runs
    for (const [runId, activeRun] of activeRuns) {
      const elapsedMs = Date.now() - activeRun.startTime.getTime();
      runs.push({
        id: runId,
        name: activeRun.config.name ?? `Test Run ${runId}`,
        status: 'running',
        progress: {
          phase: activeRun.progress.phase as TestRunProgress['phase'],
          totalSuites: activeRun.progress.totalSuites,
          completedSuites: activeRun.progress.completedSuites,
          totalCases: activeRun.progress.totalCases,
          completedCases: activeRun.progress.completedCases,
          passedCases: activeRun.progress.passedCases,
          failedCases: activeRun.progress.failedCases,
          skippedCases: activeRun.progress.skippedCases,
          elapsedMs,
        },
        config: {
          timeout: activeRun.config.config?.timeout ?? 30000,
          retries: activeRun.config.config?.retries ?? 0,
        },
        createdAt: activeRun.startTime.toISOString(),
        startedAt: activeRun.startTime.toISOString(),
      });
    }

    // Get completed runs from trends
    if (trendsResult.success) {
      for (const trend of trendsResult.value) {
        if (trend.runId) {
          const runResult = await resultRepository.getTestRunResult(trend.runId);
          if (runResult.success) {
            const run = runResult.value;
            runs.push({
              id: run.runId as string,
              name: run.name,
              status: run.status as TestStatusType,
              progress: {
                phase: 'completed',
                totalSuites: run.stats.suitesTotal,
                completedSuites: run.stats.suitesTotal,
                totalCases: run.stats.total,
                completedCases: run.stats.total,
                passedCases: run.stats.passed,
                failedCases: run.stats.failed,
                skippedCases: run.stats.skipped,
                elapsedMs: run.duration,
              },
              config: {
                timeout: run.config.timeout,
                retries: run.config.retries,
              },
              createdAt: run.startTime.toISOString(),
              startedAt: run.startTime.toISOString(),
              completedAt: run.endTime.toISOString(),
            });
          }
        }
      }
    }

    // Filter by status
    if (status) {
      runs = runs.filter(r => r.status === status);
    }

    // Sort
    const sortField = sortBy ?? 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;
    runs.sort((a, b) => {
      const aVal = a[sortField as keyof TestRunResponse] ?? '';
      const bVal = b[sortField as keyof TestRunResponse] ?? '';
      if (aVal < bVal) return -1 * sortDir;
      if (aVal > bVal) return 1 * sortDir;
      return 0;
    });

    // Paginate
    const total = runs.length;
    const start = (page - 1) * pageSize;
    const paginatedRuns = runs.slice(start, start + pageSize);

    return {
      data: paginatedRuns,
      pagination: createPaginationInfo(page, pageSize, total),
    };
  }

  // ============================================================================
  // Fixture Handlers
  // ============================================================================

  /**
   * POST /e2e/fixtures - Load test fixtures
   */
  async function loadFixtures(
    request: FastifyRequest<{ Body: LoadFixturesRequest }>,
    reply: FastifyReply
  ): Promise<LoadFixturesResponse> {
    const { fixtures, options } = request.body;
    const replaceExisting = options?.replaceExisting ?? false;
    const validateDependencies = options?.validateDependencies ?? true;
    const dryRun = options?.dryRun ?? false;

    const loadedFixtures: FixtureResponse[] = [];
    const errors: Array<{ index: number; name: string; error: string }> = [];

    // Validate dependencies first if requested
    if (validateDependencies) {
      const fixtureNames = new Set(fixtures.map(f => f.name));
      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];
        if (fixture.dependencies) {
          for (const dep of fixture.dependencies) {
            if (!fixtureNames.has(dep)) {
              // Check if dependency exists in repository
              const existing = await fixtureRepository.retrieveByName(dep);
              if (!existing.success) {
                errors.push({
                  index: i,
                  name: fixture.name,
                  error: `Missing dependency: ${dep}`,
                });
              }
            }
          }
        }
      }

      if (errors.length > 0) {
        reply.status(400);
        return {
          success: false,
          loaded: 0,
          fixtures: [],
          errors,
        };
      }
    }

    // Load fixtures (unless dry run)
    if (!dryRun) {
      for (let i = 0; i < fixtures.length; i++) {
        const fixture = fixtures[i];

        // Check for existing
        const existing = await fixtureRepository.retrieveByName(fixture.name);
        if (existing.success && !replaceExisting) {
          errors.push({
            index: i,
            name: fixture.name,
            error: 'Fixture already exists',
          });
          continue;
        }

        // Delete existing if replacing
        if (existing.success && replaceExisting) {
          await fixtureRepository.delete(existing.value.id);
        }

        // Store new fixture
        const input: CreateFixtureInput = {
          type: fixture.type,
          name: fixture.name,
          data: fixture.data,
          tags: fixture.tags,
          description: fixture.description,
          dependencies: fixture.dependencies,
        };

        const result = await fixtureRepository.store(input);
        if (result.success) {
          loadedFixtures.push({
            id: result.value.id as string,
            type: result.value.type,
            name: result.value.name,
            version: result.value.version as string,
            tags: [...result.value.tags],
            createdAt: result.value.createdAt.toISOString(),
            updatedAt: result.value.updatedAt.toISOString(),
          });
        } else {
          errors.push({
            index: i,
            name: fixture.name,
            error: result.error.message,
          });
        }
      }
    } else {
      // Dry run - just validate and return what would be loaded
      for (const fixture of fixtures) {
        loadedFixtures.push({
          id: `fixture_${fixture.name}_dryrun`,
          type: fixture.type,
          name: fixture.name,
          version: '1.0.0',
          tags: fixture.tags ?? [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    const success = errors.length === 0;
    reply.status(success ? 201 : 207); // 207 Multi-Status if partial success

    return {
      success,
      loaded: loadedFixtures.length,
      fixtures: loadedFixtures,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============================================================================
  // Cleanup Handlers
  // ============================================================================

  /**
   * DELETE /e2e/cleanup - Clean up test data
   */
  async function cleanup(
    request: FastifyRequest<{ Body: CleanupRequest }>,
    reply: FastifyReply
  ): Promise<CleanupResult> {
    const { scope = 'all', olderThan, testRunId, tenantId, preserveBaselines = true, dryRun = false } = request.body;

    const deleted = {
      testRuns: 0,
      suiteResults: 0,
      testResults: 0,
      fixtures: 0,
      orphans: 0,
    };
    const errors: string[] = [];
    const startTime = Date.now();

    try {
      // Clean specific test run
      if (testRunId) {
        const runId = createTestRunId(testRunId);
        if (!dryRun) {
          const result = await resultRepository.deleteTestRunResults(runId);
          if (result.success) {
            deleted.testRuns = 1;
          } else {
            errors.push(`Failed to delete test run ${testRunId}: ${result.error.message}`);
          }
        } else {
          deleted.testRuns = 1; // Would delete
        }
      }

      // Clean old data
      if (olderThan && (scope === 'all' || scope === 'results')) {
        const cutoffDate = new Date(olderThan);
        if (!dryRun) {
          const result = await resultRepository.deleteOldResults(cutoffDate);
          if (result.success) {
            deleted.testRuns += result.value;
          } else {
            errors.push(`Failed to delete old results: ${result.error.message}`);
          }
        }
      }

      // Clean fixtures
      if (scope === 'all' || scope === 'fixtures') {
        if (!dryRun) {
          const clearResult = await fixtureRepository.clear();
          if (!clearResult.success) {
            errors.push(`Failed to clear fixtures: ${clearResult.error.message}`);
          } else {
            // Get count before clear for reporting
            deleted.fixtures = await fixtureRepository.count();
          }
        }
      }

      // Clean orphans (if cleanup service available and database provided)
      if ((scope === 'all' || scope === 'orphans') && deps.cleanupService) {
        if (!dryRun) {
          const orphanResult = await deps.cleanupService.removeOrphans();
          if (orphanResult.success) {
            deleted.orphans = orphanResult.value.totalDeleted;
          } else {
            errors.push(`Failed to remove orphans: ${orphanResult.error.message}`);
          }
        }
      }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }

    const duration = Date.now() - startTime;
    const success = errors.length === 0;

    reply.status(success ? 200 : 207);

    return {
      success,
      deleted,
      duration,
      dryRun,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ============================================================================
  // Return Handler Collection
  // ============================================================================

  return {
    createTestRun,
    getTestRun,
    getTestRunResults,
    listTestRuns,
    loadFixtures,
    cleanup,
  };
}

// ============================================================================
// Error Mapping Utilities
// ============================================================================

/**
 * Map repository error to HTTP status code
 */
export function mapErrorToStatus(code: string): number {
  const statusMap: Record<string, number> = {
    NOT_FOUND: 404,
    ALREADY_EXISTS: 409,
    FIXTURE_NOT_FOUND: 404,
    FIXTURE_EXISTS: 409,
    BASELINE_NOT_FOUND: 404,
    VALIDATION_ERROR: 400,
    INVALID_INPUT: 400,
    DATABASE_ERROR: 500,
    SERIALIZATION_ERROR: 500,
    TRANSACTION_ERROR: 500,
    INTERNAL_ERROR: 500,
  };
  return statusMap[code] ?? 500;
}

/**
 * Format error response
 */
export function formatErrorResponse(
  error: OrchestratorError | TestResultRepositoryError | FixtureRepositoryError | CleanupError
): {
  statusCode: number;
  error: string;
  message: string;
  code: string;
} {
  const statusCode = mapErrorToStatus(error.code);
  const errorNames: Record<number, string> = {
    400: 'Bad Request',
    404: 'Not Found',
    409: 'Conflict',
    500: 'Internal Server Error',
  };

  return {
    statusCode,
    error: errorNames[statusCode] ?? 'Error',
    message: error.message,
    code: error.code,
  };
}

// ============================================================================
// Export Types
// ============================================================================

export type E2EHandlers = ReturnType<typeof createE2EHandlers>;
