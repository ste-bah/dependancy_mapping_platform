/**
 * E2E Test Support Module Exports
 * @module e2e/support
 *
 * Central export file for all E2E test support modules.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

// Test Context
export {
  E2ETestContext,
  TestAppBuilder,
  createTestContext,
  createTestAppBuilder,
  type TestDatabaseConfig,
  type TestContextConfig,
  type TestAuthHelper,
  type TestUserData,
  type TestRequestOptions,
  type TestResponse,
  type TestDatabaseHelper,
  type TestRepositoryData,
  type TestScanData,
  type MockHandlerHelper,
  type GitHubMockConfig,
  type MockResponse,
  type RecordedRequest,
} from './test-context.js';

// Fixtures
export {
  FixtureLoader,
  createFixtureLoader,
  createRepositoryFixture,
  createScanFixture,
  generateTerraformFixtureContent,
  generateHelmFixtureContent,
  generateGraphNodeFixtures,
  generateGraphEdgeFixtures,
  TERRAFORM_FIXTURES,
  HELM_FIXTURES,
  USER_FIXTURES,
  type TerraformFixture,
  type HelmFixture,
  type UserFixture,
  type RepositoryFixture,
  type ScanFixture,
  type LoadedFixture,
  type GraphNodeFixture,
  type GraphEdgeFixture,
} from './fixtures.js';

// Assertions
export {
  GraphAssertion,
  assertGraph,
  createGraphStructure,
  assertSuccessResponse,
  assertErrorResponse,
  assertPaginatedResponse,
  assertResponseHeaders,
  assertPerformance,
  measureDuration,
  assertRecordExists,
  assertRecordNotExists,
  assertRecordCount,
  assertEdgeEvidence,
  assertNodeLocation,
  type GraphAssertionOptions,
  type GraphStructure,
  type ApiErrorResponse,
  type PaginatedResponse,
  type PerformanceAssertionOptions,
} from './assertions.js';

// API Client
export {
  TestApiClient,
  createApiClient,
  type HealthResponse,
  type DetailedHealthResponse,
  type LivenessResponse,
  type ReadinessResponse,
  type RepositoryResponse,
  type RepositoryCreateRequest,
  type RepositoryListResponse,
  type ScanResponse,
  type ScanCreateRequest,
  type ScanListResponse,
  type GraphNodeResponse,
  type GraphEdgeResponse,
  type GraphResponse,
  type RollupResponse,
  type RollupCreateRequest,
  type RollupExecutionResponse,
  type BlastRadiusResponse,
  type PaginationMeta,
  type ErrorResponse,
} from './api-client.js';

// Domain Entities (re-export for convenience)
export {
  // Test Session
  TestSession,
  createTestSession,
  createSessionId,
  generateSessionId,
  isValidTransition,
  isSessionState,
  isSessionError,
  DEFAULT_SESSION_CONFIG,
  type SessionId,
  type SessionState,
  type SessionConfig,
  type SessionTiming,
  type CleanupHandler,
  type SessionError,
  type FixtureEntry,
  // Fixture Registry
  FixtureRegistry,
  getFixtureRegistry,
  registerFixture,
  resolveFixture,
  isRegistryError,
  type FixtureDefinition,
  type FixtureFactory,
  type FixtureRegistrationOptions,
  type RegistryError,
  // Mock Provider
  MockProvider,
  createMockProvider,
  createMockHandlerId,
  isMockProviderError,
  isRecordedRequest,
  DEFAULT_MOCK_PROVIDER_CONFIG,
  type MockHandlerId,
  type HttpMethod,
  type RequestMatcher,
  type BodyMatcher,
  type MockHandler,
  type MockResponseGenerator,
  type RecordedResponse,
  type MockProviderConfig,
  type MockProviderError,
  // Test Database
  TestDatabase,
  createTestDatabase,
  createConnectionId,
  createTransactionId,
  isDatabaseError,
  isDatabaseState,
  DEFAULT_TEST_DATABASE_CONFIG,
  type ConnectionId,
  type TransactionId,
  type TestDatabaseConfig as DomainTestDatabaseConfig,
  type DatabaseState,
  type PoolStats,
  type QueryResult,
  type FieldInfo,
  type TransactionOptions,
  type IsolationLevel,
  type SeedData,
  type TenantSeedData,
  type UserSeedData,
  type RepositorySeedData,
  type ScanSeedData,
  type SeedResult,
  type DatabaseError,
  // Result type utilities
  success,
  failure,
  isSuccess,
  isFailure,
  unwrap,
  unwrapOr,
  type Result,
  type AsyncResult,
} from '../domain/index.js';

// Error Handling
export {
  // Error Classes
  E2ETestError,
  FixtureError,
  TimeoutError,
  AssertionError,
  SetupError,
  RetryExhaustedError,
  FlakyTestError,
  ApiTestError,

  // Error Codes
  E2EErrorCodes,

  // Type Guards
  isE2ETestError,
  isFixtureError,
  isTimeoutError,
  isAssertionError,
  isSetupError,
  isRecoverableError,
  isRetryableE2EError,

  // Error Utilities
  wrapAsE2EError,

  // Retry Strategies
  withE2ERetry,
  E2ERetry,
  DEFAULT_E2E_RETRY_OPTIONS,

  // Fallback Strategies
  withE2EFallback,
  E2EFallback,

  // Error Handler
  E2EErrorHandler,
  createErrorHandler,
  DEFAULT_ERROR_HANDLER_CONFIG,

  // Error Aggregation
  ErrorAggregator,
  AggregatedE2EError,
  createErrorAggregator,

  // Cleanup
  CleanupRegistry,
  createCleanupRegistry,

  // Error Boundary
  withErrorBoundary,

  // Error Reporter
  E2EErrorReporter,
  createErrorReporter,
  ContextCapturer,
  createContextCapturer,
  formatE2EError,
  generateE2EErrorReport,
  DEFAULT_REPORT_CONFIG,

  // Error Types
  type E2EErrorCode,
  type E2EErrorContext,
  type SerializedE2EError,
  type AssertionDiff,
  type E2ERetryOptions,
  type RetryResult,
  type E2EErrorHandlerConfig,
  type CleanupHandler as E2ECleanupHandler,
  type ErrorHandlerContext,
  type ErrorSummary,
  type FallbackOptions,
  type AggregatedErrorSummary,
  type CleanupResult,
  type ErrorReportFormat,
  type ErrorReportConfig,
  type ErrorReport,
  type FormattedError,
  type ProcessedStackTrace,
  type StackFrame,
  type TestInfo,
  type CapturedContext,
} from '../errors/index.js';

// Logging Infrastructure
export {
  // E2E Logger
  E2ELogger,
  createE2ELogger,
  getE2ELogger,
  initE2ELogger,
  resetE2ELogger,
  createTestLogger,
  createSuiteLogger,
  createRunLogger,
  withLogging,
  DEFAULT_E2E_LOGGER_CONFIG,
  type LogLevel,
  type E2ELogContext,
  type LogEntry,
  type LogEntryError,
  type E2ELoggerConfig,
  type ILogTransport,
  type IE2ELogger,

  // Test Reporter
  TestReporter,
  createTestReporter,
  getTestReporter,
  initTestReporter,
  DEFAULT_REPORTER_CONFIG,
  type ReporterConfig,
  type JsonReport,
  type ITestReporter,
  type ReportGenerationResult,

  // Metrics Collector
  MetricsCollector,
  TestMetricsScope,
  createMetricsCollector,
  getMetricsCollector,
  initMetricsCollector,
  resetMetricsCollector,
  timeAsync,
  timeSync,
  createTestMetricsScope,
  generateMetricsSummary,
  DEFAULT_PERFORMANCE_THRESHOLDS,
  type TimingMetric,
  type CounterMetric,
  type GaugeMetric,
  type HistogramMetric,
  type TestRunMetrics,
  type TestSuiteMetrics,
  type TestMetricsSummary,
  type TrendDataPoint,
  type RunComparison,
  type PerformanceThresholds,
  type ThresholdViolation,
  type IMetricsCollector,
  type TimerHandle,
  type MetricsExport,
  type MetricsSummary,

  // Convenience re-exports
  logger,
  reporter,
  metrics,
} from '../logging/index.js';
