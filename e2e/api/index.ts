/**
 * E2E Test Management API
 * @module e2e/api
 *
 * Public exports for E2E test management API.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #24 of 47 | Phase 4: Implementation
 */

// Routes
export {
  default as e2eRoutes,
  e2eRoutes as testRunRoutes,
  fixtureRoutes,
  cleanupRoutes,
  getE2EOpenAPISpec,
  type E2ERoutesOptions,
} from './routes.js';

// Handlers
export {
  createE2EHandlers,
  mapErrorToStatus,
  formatErrorResponse,
  type HandlerDependencies,
  type HandlerError,
  type ApiResponse,
  type E2EHandlers,
} from './handlers.js';

// Schemas
export {
  // Common
  PaginationQuerySchema,
  PaginationInfoSchema,
  ErrorResponseSchema,
  UuidParamSchema,
  EmptySuccessSchema,
  MessageResponseSchema,
  createPaginationInfo,
  type PaginationQuery,
  type PaginationInfo,
  type ErrorResponse,
  type UuidParam,
  type EmptySuccess,
  type MessageResponse,

  // Test Status
  TestStatusSchema,
  TestRunPhaseSchema,
  type TestStatusType,
  type TestRunPhaseType,

  // Configuration
  ParallelConfigSchema,
  TestExecutionConfigSchema,
  TestFilterSchema,
  type ParallelConfig,
  type TestExecutionConfig,
  type TestFilter,

  // Test Run
  CreateTestRunRequestSchema,
  TestRunProgressSchema,
  TestErrorSchema,
  TestResultSchema,
  TestSuiteResultSchema,
  TestRunResponseSchema,
  TestRunResultResponseSchema,
  TestRunListResponseSchema,
  ListTestRunsQuerySchema,
  TestRunIdParamSchema,
  type CreateTestRunRequest,
  type TestRunProgress,
  type TestError,
  type TestResultType,
  type TestSuiteResultType,
  type TestRunResponse,
  type TestRunResultResponse,
  type ListTestRunsQuery,
  type TestRunIdParam,

  // Fixtures
  FixtureTypeSchema,
  LoadFixturesRequestSchema,
  FixtureResponseSchema,
  LoadFixturesResponseSchema,
  type FixtureType,
  type LoadFixturesRequest,
  type FixtureResponse,
  type LoadFixturesResponse,

  // Cleanup
  CleanupRequestSchema,
  CleanupResultSchema,
  type CleanupRequest,
  type CleanupResult,
} from './schemas.js';
