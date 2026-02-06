/**
 * E2E Test API Schemas
 * @module e2e/api/schemas
 *
 * TypeBox schemas for E2E test management API endpoints.
 * Provides request/response validation for test operations.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #24 of 47 | Phase 4: Implementation
 */

import { Type, Static } from '@sinclair/typebox';

// ============================================================================
// Common Schemas
// ============================================================================

/**
 * Pagination query parameters
 */
export const PaginationQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1, description: 'Page number' })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20, description: 'Items per page' })),
});

export type PaginationQuery = Static<typeof PaginationQuerySchema>;

/**
 * Pagination info in response
 */
export const PaginationInfoSchema = Type.Object({
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
  totalPages: Type.Number(),
  hasNext: Type.Boolean(),
  hasPrevious: Type.Boolean(),
});

export type PaginationInfo = Static<typeof PaginationInfoSchema>;

/**
 * Create pagination info from results
 */
export function createPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * API Error response schema
 */
export const ErrorResponseSchema = Type.Object({
  statusCode: Type.Number({ description: 'HTTP status code' }),
  error: Type.String({ description: 'Error type' }),
  message: Type.String({ description: 'Human-readable error message' }),
  code: Type.Optional(Type.String({ description: 'Error code for programmatic handling' })),
  details: Type.Optional(Type.Unknown({ description: 'Additional error details' })),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * UUID parameter schema
 */
export const UuidParamSchema = Type.Object({
  id: Type.String({ format: 'uuid', description: 'Resource UUID' }),
});

export type UuidParam = Static<typeof UuidParamSchema>;

/**
 * Empty success response
 */
export const EmptySuccessSchema = Type.Object({
  success: Type.Literal(true),
});

export type EmptySuccess = Static<typeof EmptySuccessSchema>;

/**
 * Message response schema
 */
export const MessageResponseSchema = Type.Object({
  success: Type.Boolean(),
  message: Type.String(),
});

export type MessageResponse = Static<typeof MessageResponseSchema>;

// ============================================================================
// Test Status Schema
// ============================================================================

/**
 * Test status enum
 */
export const TestStatusSchema = Type.Union([
  Type.Literal('passed'),
  Type.Literal('failed'),
  Type.Literal('skipped'),
  Type.Literal('pending'),
  Type.Literal('timeout'),
  Type.Literal('running'),
]);

export type TestStatusType = Static<typeof TestStatusSchema>;

/**
 * Test run phase enum
 */
export const TestRunPhaseSchema = Type.Union([
  Type.Literal('setup'),
  Type.Literal('running'),
  Type.Literal('teardown'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);

export type TestRunPhaseType = Static<typeof TestRunPhaseSchema>;

// ============================================================================
// Test Configuration Schemas
// ============================================================================

/**
 * Parallel execution configuration
 */
export const ParallelConfigSchema = Type.Object({
  enabled: Type.Optional(Type.Boolean({ default: false, description: 'Enable parallel execution' })),
  workers: Type.Optional(Type.Number({ minimum: 1, maximum: 16, default: 1, description: 'Number of parallel workers' })),
  isolation: Type.Optional(Type.Union([
    Type.Literal('none'),
    Type.Literal('thread'),
    Type.Literal('process'),
  ], { default: 'thread', description: 'Test isolation level' })),
});

export type ParallelConfig = Static<typeof ParallelConfigSchema>;

/**
 * Test execution configuration
 */
export const TestExecutionConfigSchema = Type.Object({
  timeout: Type.Optional(Type.Number({ minimum: 1000, maximum: 600000, default: 30000, description: 'Test timeout in milliseconds' })),
  retries: Type.Optional(Type.Number({ minimum: 0, maximum: 5, default: 0, description: 'Number of retry attempts' })),
  parallel: Type.Optional(ParallelConfigSchema),
  stopOnFirstFailure: Type.Optional(Type.Boolean({ default: false, description: 'Stop execution on first failure' })),
  collectCoverage: Type.Optional(Type.Boolean({ default: false, description: 'Collect coverage data' })),
  verbose: Type.Optional(Type.Boolean({ default: false, description: 'Enable verbose logging' })),
});

export type TestExecutionConfig = Static<typeof TestExecutionConfigSchema>;

/**
 * Test filter criteria
 */
export const TestFilterSchema = Type.Object({
  suiteIds: Type.Optional(Type.Array(Type.String(), { description: 'Filter by suite IDs' })),
  caseIds: Type.Optional(Type.Array(Type.String(), { description: 'Filter by case IDs' })),
  tags: Type.Optional(Type.Array(Type.String(), { description: 'Include tests with these tags' })),
  skipTags: Type.Optional(Type.Array(Type.String(), { description: 'Exclude tests with these tags' })),
});

export type TestFilter = Static<typeof TestFilterSchema>;

// ============================================================================
// Create Test Run Schemas
// ============================================================================

/**
 * Create test run request body
 */
export const CreateTestRunRequestSchema = Type.Object({
  name: Type.Optional(Type.String({ minLength: 1, maxLength: 200, description: 'Test run name' })),
  suites: Type.Array(Type.String(), { minItems: 1, description: 'Suite identifiers to run' }),
  filter: Type.Optional(TestFilterSchema),
  config: Type.Optional(TestExecutionConfigSchema),
  environment: Type.Optional(Type.Object({
    baseUrl: Type.Optional(Type.String({ format: 'uri', description: 'Base API URL' })),
    variables: Type.Optional(Type.Record(Type.String(), Type.String(), { description: 'Environment variables' })),
  })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: 'Custom metadata' })),
});

export type CreateTestRunRequest = Static<typeof CreateTestRunRequestSchema>;

// ============================================================================
// Test Run Response Schemas
// ============================================================================

/**
 * Test run progress schema
 */
export const TestRunProgressSchema = Type.Object({
  phase: TestRunPhaseSchema,
  totalSuites: Type.Number({ description: 'Total number of suites' }),
  completedSuites: Type.Number({ description: 'Completed suites count' }),
  totalCases: Type.Number({ description: 'Total number of test cases' }),
  completedCases: Type.Number({ description: 'Completed test cases count' }),
  passedCases: Type.Number({ description: 'Passed test cases count' }),
  failedCases: Type.Number({ description: 'Failed test cases count' }),
  skippedCases: Type.Number({ description: 'Skipped test cases count' }),
  currentSuite: Type.Optional(Type.String({ description: 'Currently running suite' })),
  currentCase: Type.Optional(Type.String({ description: 'Currently running test case' })),
  elapsedMs: Type.Number({ description: 'Elapsed time in milliseconds' }),
  estimatedRemainingMs: Type.Optional(Type.Number({ description: 'Estimated remaining time in milliseconds' })),
});

export type TestRunProgress = Static<typeof TestRunProgressSchema>;

/**
 * Test error schema
 */
export const TestErrorSchema = Type.Object({
  name: Type.Optional(Type.String({ description: 'Error name' })),
  message: Type.String({ description: 'Error message' }),
  stack: Type.Optional(Type.String({ description: 'Error stack trace' })),
  expected: Type.Optional(Type.Unknown({ description: 'Expected value' })),
  actual: Type.Optional(Type.Unknown({ description: 'Actual value' })),
  diff: Type.Optional(Type.String({ description: 'Value diff' })),
});

export type TestError = Static<typeof TestErrorSchema>;

/**
 * Test result schema
 */
export const TestResultSchema = Type.Object({
  id: Type.String({ description: 'Test case ID' }),
  name: Type.String({ description: 'Test case name' }),
  status: TestStatusSchema,
  duration: Type.Number({ description: 'Test duration in milliseconds' }),
  startedAt: Type.String({ format: 'date-time', description: 'Start timestamp' }),
  completedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Completion timestamp' })),
  error: Type.Optional(TestErrorSchema),
  retryInfo: Type.Optional(Type.Object({
    attempts: Type.Number({ description: 'Number of attempts' }),
    maxRetries: Type.Number({ description: 'Maximum retries allowed' }),
  })),
});

export type TestResultType = Static<typeof TestResultSchema>;

/**
 * Test suite result schema
 */
export const TestSuiteResultSchema = Type.Object({
  id: Type.String({ description: 'Suite ID' }),
  name: Type.String({ description: 'Suite name' }),
  status: TestStatusSchema,
  duration: Type.Number({ description: 'Suite duration in milliseconds' }),
  startedAt: Type.String({ format: 'date-time', description: 'Start timestamp' }),
  completedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Completion timestamp' })),
  results: Type.Array(TestResultSchema, { description: 'Test case results' }),
  stats: Type.Object({
    total: Type.Number(),
    passed: Type.Number(),
    failed: Type.Number(),
    skipped: Type.Number(),
    duration: Type.Number(),
  }),
});

export type TestSuiteResultType = Static<typeof TestSuiteResultSchema>;

/**
 * Test run response schema
 */
export const TestRunResponseSchema = Type.Object({
  id: Type.String({ description: 'Test run ID' }),
  name: Type.Optional(Type.String({ description: 'Test run name' })),
  status: TestStatusSchema,
  progress: TestRunProgressSchema,
  config: TestExecutionConfigSchema,
  createdAt: Type.String({ format: 'date-time', description: 'Creation timestamp' }),
  startedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Start timestamp' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time', description: 'Completion timestamp' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type TestRunResponse = Static<typeof TestRunResponseSchema>;

/**
 * Test run result response (detailed)
 */
export const TestRunResultResponseSchema = Type.Object({
  id: Type.String({ description: 'Test run ID' }),
  name: Type.Optional(Type.String({ description: 'Test run name' })),
  status: TestStatusSchema,
  duration: Type.Number({ description: 'Total duration in milliseconds' }),
  startedAt: Type.String({ format: 'date-time' }),
  completedAt: Type.String({ format: 'date-time' }),
  suites: Type.Array(TestSuiteResultSchema, { description: 'Suite results' }),
  stats: Type.Object({
    totalSuites: Type.Number(),
    passedSuites: Type.Number(),
    failedSuites: Type.Number(),
    skippedSuites: Type.Number(),
    totalCases: Type.Number(),
    passedCases: Type.Number(),
    failedCases: Type.Number(),
    skippedCases: Type.Number(),
    duration: Type.Number(),
    passRate: Type.Number({ description: 'Pass rate as percentage' }),
  }),
  coverage: Type.Optional(Type.Object({
    lines: Type.Object({
      total: Type.Number(),
      covered: Type.Number(),
      percentage: Type.Number(),
    }),
    branches: Type.Object({
      total: Type.Number(),
      covered: Type.Number(),
      percentage: Type.Number(),
    }),
  })),
  environment: Type.Optional(Type.Object({
    nodeVersion: Type.String(),
    platform: Type.String(),
    ci: Type.Boolean(),
  })),
});

export type TestRunResultResponse = Static<typeof TestRunResultResponseSchema>;

/**
 * Test run list response
 */
export const TestRunListResponseSchema = Type.Object({
  data: Type.Array(TestRunResponseSchema),
  pagination: PaginationInfoSchema,
});

export type TestRunListResponse = Static<typeof TestRunListResponseSchema>;

// ============================================================================
// Fixture Schemas
// ============================================================================

/**
 * Fixture type enum
 */
export const FixtureTypeSchema = Type.Union([
  Type.Literal('terraform'),
  Type.Literal('helm'),
  Type.Literal('user'),
  Type.Literal('tenant'),
  Type.Literal('repository'),
  Type.Literal('scan'),
  Type.Literal('graph'),
  Type.Literal('custom'),
]);

export type FixtureType = Static<typeof FixtureTypeSchema>;

/**
 * Load fixtures request
 */
export const LoadFixturesRequestSchema = Type.Object({
  fixtures: Type.Array(Type.Object({
    type: FixtureTypeSchema,
    name: Type.String({ minLength: 1, maxLength: 100, description: 'Fixture name' }),
    data: Type.Unknown({ description: 'Fixture data' }),
    tags: Type.Optional(Type.Array(Type.String(), { description: 'Fixture tags' })),
    description: Type.Optional(Type.String({ maxLength: 500, description: 'Fixture description' })),
    dependencies: Type.Optional(Type.Array(Type.String(), { description: 'Dependent fixture names' })),
  }), { minItems: 1, description: 'Fixtures to load' }),
  options: Type.Optional(Type.Object({
    replaceExisting: Type.Optional(Type.Boolean({ default: false, description: 'Replace existing fixtures with same name' })),
    validateDependencies: Type.Optional(Type.Boolean({ default: true, description: 'Validate fixture dependencies' })),
    dryRun: Type.Optional(Type.Boolean({ default: false, description: 'Validate without persisting' })),
  })),
});

export type LoadFixturesRequest = Static<typeof LoadFixturesRequestSchema>;

/**
 * Fixture response schema
 */
export const FixtureResponseSchema = Type.Object({
  id: Type.String({ description: 'Fixture ID' }),
  type: FixtureTypeSchema,
  name: Type.String({ description: 'Fixture name' }),
  version: Type.String({ description: 'Fixture version' }),
  tags: Type.Array(Type.String()),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type FixtureResponse = Static<typeof FixtureResponseSchema>;

/**
 * Load fixtures response
 */
export const LoadFixturesResponseSchema = Type.Object({
  success: Type.Boolean(),
  loaded: Type.Number({ description: 'Number of fixtures loaded' }),
  fixtures: Type.Array(FixtureResponseSchema),
  errors: Type.Optional(Type.Array(Type.Object({
    index: Type.Number({ description: 'Index of fixture in request' }),
    name: Type.String({ description: 'Fixture name' }),
    error: Type.String({ description: 'Error message' }),
  }))),
});

export type LoadFixturesResponse = Static<typeof LoadFixturesResponseSchema>;

// ============================================================================
// Cleanup Schemas
// ============================================================================

/**
 * Cleanup request
 */
export const CleanupRequestSchema = Type.Object({
  scope: Type.Optional(Type.Union([
    Type.Literal('all'),
    Type.Literal('fixtures'),
    Type.Literal('results'),
    Type.Literal('orphans'),
  ], { default: 'all', description: 'Cleanup scope' })),
  olderThan: Type.Optional(Type.String({ format: 'date-time', description: 'Clean data older than this timestamp' })),
  testRunId: Type.Optional(Type.String({ description: 'Clean specific test run' })),
  tenantId: Type.Optional(Type.String({ format: 'uuid', description: 'Clean specific tenant data' })),
  preserveBaselines: Type.Optional(Type.Boolean({ default: true, description: 'Preserve baseline data' })),
  dryRun: Type.Optional(Type.Boolean({ default: false, description: 'Report what would be cleaned without deleting' })),
});

export type CleanupRequest = Static<typeof CleanupRequestSchema>;

/**
 * Cleanup result schema
 */
export const CleanupResultSchema = Type.Object({
  success: Type.Boolean(),
  deleted: Type.Object({
    testRuns: Type.Number({ description: 'Test runs deleted' }),
    suiteResults: Type.Number({ description: 'Suite results deleted' }),
    testResults: Type.Number({ description: 'Test results deleted' }),
    fixtures: Type.Number({ description: 'Fixtures deleted' }),
    orphans: Type.Number({ description: 'Orphan records deleted' }),
  }),
  duration: Type.Number({ description: 'Cleanup duration in milliseconds' }),
  dryRun: Type.Boolean({ description: 'Whether this was a dry run' }),
  errors: Type.Optional(Type.Array(Type.String(), { description: 'Errors encountered during cleanup' })),
});

export type CleanupResult = Static<typeof CleanupResultSchema>;

// ============================================================================
// Query Schemas
// ============================================================================

/**
 * List test runs query
 */
export const ListTestRunsQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    status: Type.Optional(TestStatusSchema),
    since: Type.Optional(Type.String({ format: 'date-time', description: 'Filter by start date' })),
    until: Type.Optional(Type.String({ format: 'date-time', description: 'Filter by end date' })),
    sortBy: Type.Optional(Type.Union([
      Type.Literal('createdAt'),
      Type.Literal('startedAt'),
      Type.Literal('completedAt'),
      Type.Literal('duration'),
    ], { default: 'createdAt' })),
    sortOrder: Type.Optional(Type.Union([
      Type.Literal('asc'),
      Type.Literal('desc'),
    ], { default: 'desc' })),
  }),
]);

export type ListTestRunsQuery = Static<typeof ListTestRunsQuerySchema>;

// ============================================================================
// Route Parameter Schemas
// ============================================================================

/**
 * Test run ID parameter
 */
export const TestRunIdParamSchema = Type.Object({
  id: Type.String({ description: 'Test run ID' }),
});

export type TestRunIdParam = Static<typeof TestRunIdParamSchema>;
