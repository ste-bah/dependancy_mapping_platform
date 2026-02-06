/**
 * E2E Test Types Index
 * @module e2e/types
 *
 * Central export file for all E2E test type definitions.
 * Provides comprehensive type coverage for testing infrastructure.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #20 of 47 | Phase 4: Implementation
 *
 * Type Categories:
 * - test-types: Core test configuration, context, and result types
 * - api-types: HTTP request/response and API testing types
 * - fixture-types: Test fixture and data generation types
 * - assertion-types: Assertion helpers and validation types
 */

// ============================================================================
// Test Types
// ============================================================================

export type {
  // Branded Types
  TestRunId,
  TestSuiteId,
  TestCaseId,
  FixtureId,
  // Configuration Types
  E2ETestConfig,
  ParallelConfig,
  DatabaseConfig,
  MockingConfig,
  LoggingConfig,
  CoverageConfig,
  CoverageThresholds,
  EnvironmentConfig,
  // Fixture Types
  TestFixture,
  FixtureMetadata,
  FixtureFactory,
  AsyncFixtureFactory,
  // Context Types
  TestContext,
  TenantContext,
  UserContext,
  TestState,
  TestPhase,
  TestError,
  TestWarning,
  TestArtifact,
  ArtifactType,
  // Result Types
  TestResult,
  TestStatus,
  TestResultError,
  RetryInfo,
  PreviousAttempt,
  TestMetrics,
  TestSuiteResult,
  TestSuiteStats,
  TestRunResult,
  TestRunStats,
  CoverageData,
  CoverageMetric,
  FileCoverage,
  EnvironmentInfo,
  // Utility Types
  DeepPartial,
  E2ETestConfigOverride,
  FixtureData,
} from './test-types.js';

export {
  // Factory Functions
  createTestRunId,
  createTestSuiteId,
  createTestCaseId,
  createFixtureId,
  // Type Guards
  isTestResult,
  isTestSuiteResult,
  isTestRunResult,
  isTestStatus,
  isTestPhase,
  // Constants
  DEFAULT_E2E_CONFIG,
} from './test-types.js';

// ============================================================================
// API Types
// ============================================================================

export type {
  // Branded Types
  RequestId,
  CorrelationId,
  // HTTP Types
  HttpMethod,
  HttpStatusCategory,
  HttpStatusCode,
  // Response Types
  ApiResponse,
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiError,
  ResponseMeta,
  DeprecationWarning,
  PaginatedApiResponse,
  PaginationInfo,
  PaginationParams,
  // Request Types
  RequestOptions,
  AuthenticatedRequest,
  AuthContext,
  TenantRequest,
  // Response Wrapper Types
  TestResponse,
  StreamResponse,
  BatchResponse,
  BatchFailure,
  BatchSummary,
  // Error Types
  ApiErrorCodeType,
  // Content Types
  ContentTypeValue,
  // Rate Limiting
  RateLimitInfo,
  // Interceptors
  RequestInterceptor,
  ResponseInterceptor,
  ErrorInterceptor,
  // Configuration
  ApiClientConfig,
  RetryConfig,
  // Utility Types
  ResponseData,
  AsApiResponse,
  AsPaginatedResponse,
  UnauthenticatedRequest,
} from './api-types.js';

export {
  // Factory Functions
  createRequestId,
  createCorrelationId,
  // Type Guards
  isApiResponse,
  isApiSuccessResponse,
  isApiErrorResponse,
  isApiError,
  isPaginatedResponse,
  isAuthContext,
  // Constants
  HttpStatus,
  ApiErrorCode,
  ContentType,
  RateLimitHeaders,
  DEFAULT_API_CLIENT_CONFIG,
} from './api-types.js';

// ============================================================================
// Fixture Types
// ============================================================================

export type {
  // Branded Types
  FixtureFileId,
  MockResponseId,
  // Terraform Types
  TerraformFixture,
  TerraformFixtureTag,
  TerraformProvider,
  TerraformResourceFixture,
  TerraformVariableFixture,
  TerraformValidation,
  TerraformOutputFixture,
  TerraformModuleFixture,
  TerraformDataSourceFixture,
  // Helm Types
  HelmFixture,
  HelmFixtureTag,
  HelmChartMetadata,
  HelmMaintainer,
  HelmDependency,
  HelmTemplateFixture,
  HelmValuesFixture,
  // User Types
  UserFixture,
  UserRole,
  Permission,
  UserSettings,
  NotificationSettings,
  TenantFixture,
  TenantPlan,
  TenantSettings,
  TenantLimits,
  // Graph Types
  GraphFixture,
  GraphFixtureTag,
  GraphNodeFixture,
  NodeType,
  NodeMetadata,
  GraphEdgeFixture,
  EdgeType,
  EdgeEvidence,
  DetectionMethod,
  GraphExpectations,
  // Repository Types
  RepositoryFixture,
  ScanFixture,
  // Common Types
  FileLocation,
  LoadedFixture,
  // Generation Types
  FixtureGenerationOptions,
  GraphGenerationOptions,
} from './fixture-types.js';

export {
  // Factory Functions
  createFixtureFileId,
  createMockResponseId,
  // Type Guards
  isTerraformFixture,
  isHelmFixture,
  isUserFixture,
  isGraphNodeFixture,
  isGraphEdgeFixture,
  isNodeType,
  isEdgeType,
} from './fixture-types.js';

// ============================================================================
// Assertion Types
// ============================================================================

export type {
  // Branded Types
  AssertionId,
  BenchmarkId,
  // Result Types
  AssertionResult,
  AssertionContext,
  CompoundAssertionResult,
  AssertionSummary,
  AssertionError,
  AssertionOperator,
  // Graph Assertion Types
  GraphAssertionConfig,
  NodeComparator,
  EdgeComparator,
  GraphStructure,
  GraphAssertionResult,
  NodeAssertionDetails,
  NodeMismatch,
  PropertyDifference,
  EdgeAssertionDetails,
  EdgeMismatch,
  InvalidEdgeReference,
  StructuralAssertionDetails,
  // API Assertion Types
  ApiAssertionOptions,
  ApiAssertionResult,
  HeaderAssertionResult,
  SchemaValidationResult,
  SchemaValidationError,
  ErrorAssertionOptions,
  PaginationAssertionOptions,
  // Performance Types
  PerformanceThreshold,
  ThresholdComparator,
  PerformanceAssertionOptions,
  PerformanceAssertionResult,
  PerformanceStatistics,
  BenchmarkConfig,
  BenchmarkResult,
  IterationResult,
  // Database Types
  DatabaseAssertionOptions,
  RetryConfig as AssertionRetryConfig,
  DatabaseAssertionResult,
  // Evidence Types
  EvidenceAssertionOptions,
  LocationAssertionOptions,
  // Custom Assertion Types
  CustomAssertion,
  AsyncCustomAssertion,
  AssertionChain,
  // Utility Types
  AssertionValue,
  AssertionBuilderOptions,
} from './assertion-types.js';

export {
  // Factory Functions
  createAssertionId,
  createBenchmarkId,
  // Type Guards
  isAssertionResult,
  isGraphAssertionResult,
  isPerformanceAssertionResult,
  isAssertionError,
  // Constants
  DEFAULT_GRAPH_ASSERTION_CONFIG,
  DEFAULT_ASSERTION_BUILDER_OPTIONS,
} from './assertion-types.js';

// ============================================================================
// Re-export Domain Types (for convenience)
// ============================================================================

export type {
  TenantId,
  RepositoryId,
  ScanId,
  UserId,
  DbNodeId,
  DbEdgeId,
  ScanStatus,
  GitProvider,
} from '../../api/src/types/entities.js';

export type {
  Brand,
  Result,
  AsyncResult,
  NonEmptyArray,
} from '../../api/src/types/utility.js';
