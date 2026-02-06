/**
 * E2E Services Module Index
 * @module e2e/services
 *
 * Central export file for all E2E testing services.
 * Provides domain services for test orchestration, scan testing,
 * authentication testing, and performance testing.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #22 of 47 | Phase 4: Implementation
 *
 * Service Components:
 * - TestOrchestrator: Test execution lifecycle coordination
 * - ScanTestService: Scan pipeline E2E testing
 * - AuthTestService: Authentication flow testing
 * - PerformanceTestService: Performance benchmarking
 */

// ============================================================================
// Test Orchestrator
// ============================================================================

export {
  // Class
  TestOrchestrator,
  // Factory Functions
  createTestOrchestrator,
  defineSuite,
  defineCase,
  // Type Guards
  isOrchestratorError,
  // Types
  type ITestOrchestrator,
  type TestOrchestratorConfig,
  type TestSuiteDefinition,
  type TestCaseDefinition,
  type TestCaseFunction,
  type TestCaseContext,
  type TestRunInput,
  type TestFilter,
  type TestProgressCallback,
  type TestRunProgress,
  type OrchestratorError,
  type OrchestratorErrorCode,
  // Constants
  DEFAULT_ORCHESTRATOR_CONFIG,
} from './test-orchestrator.js';

// ============================================================================
// Scan Test Service
// ============================================================================

export {
  // Class
  ScanTestService,
  // Factory Functions
  createScanTestService,
  // Type Guards
  isScanTestServiceError,
  // Types
  type IScanTestService,
  type ScanTestServiceConfig,
  type ScanTestInput,
  type ScanRepositoryInput,
  type ScanExpectations,
  type ScanTestResult,
  type GraphValidationResult,
  type EvidenceValidationResult,
  type ConfidenceDistribution,
  type ScanPerformanceMetrics,
  type ScanTestFailure,
  type ScanStatusResponse,
  type GraphResponse,
  type GraphNodeResponse,
  type GraphEdgeResponse,
  type ScanTestServiceError,
  type ScanTestServiceErrorCode,
  // Constants
  DEFAULT_SCAN_TEST_CONFIG,
} from './scan-test-service.js';

// ============================================================================
// Auth Test Service
// ============================================================================

export {
  // Class
  AuthTestService,
  // Factory Functions
  createAuthTestService,
  // Type Guards
  isAuthTestServiceError,
  // Types
  type IAuthTestService,
  type AuthTestServiceConfig,
  type OAuthProvider,
  type OAuthFlowTestInput,
  type MockOAuthUser,
  type MockOAuthOrg,
  type OAuthFlowTestResult,
  type OAuthStageResult,
  type OAuthStage,
  type ApiKeyTestInput,
  type ApiKeyTestResult,
  type ApiKeyValidationResult,
  type SessionTestInput,
  type SessionTestResult,
  type SessionValidationResult,
  type TenantIsolationTestInput,
  type TenantIsolationTenant,
  type TenantResources,
  type TenantIsolationTestResult,
  type IsolationCheckResult,
  type AuthTestFailure,
  type AuthTestServiceError,
  type AuthTestServiceErrorCode,
  // Constants
  DEFAULT_AUTH_TEST_CONFIG,
} from './auth-test-service.js';

// ============================================================================
// Performance Test Service
// ============================================================================

export {
  // Class
  PerformanceTestService,
  // Factory Functions
  createPerformanceTestService,
  // Type Guards
  isPerformanceTestServiceError,
  // Types
  type IPerformanceTestService,
  type PerformanceTestServiceConfig,
  type BenchmarkInput,
  type BenchmarkOperation,
  type SearchBenchmarkOperation,
  type RollupBenchmarkOperation,
  type GraphQueryBenchmarkOperation,
  type ApiBenchmarkOperation,
  type CustomBenchmarkOperation,
  type BenchmarkThresholds,
  type BenchmarkResult,
  type LatencyStatistics,
  type MemoryProfile,
  type MemorySample,
  type ThresholdViolation,
  type BenchmarkError,
  type SearchPerformanceTestInput,
  type SearchQuery,
  type SearchPerformanceTestResult,
  type QueryBenchmarkResult,
  type RollupPerformanceTestInput,
  type RollupThresholds,
  type RollupPerformanceTestResult,
  type RollupScanResult,
  type ScalingAnalysis,
  type MemoryProfilingInput,
  type MemoryThresholds,
  type MemoryProfilingResult,
  type LeakAnalysis,
  type PerformanceTestFailure,
  type PerformanceReport,
  type EnvironmentInfo,
  type ReportSummary,
  type ReportComparison,
  type PerformanceTestServiceError,
  type PerformanceTestServiceErrorCode,
  // Constants
  DEFAULT_PERFORMANCE_CONFIG,
} from './performance-test-service.js';

// ============================================================================
// Re-exports from Domain for Convenience
// ============================================================================

export {
  // Test Session
  TestSession,
  createTestSession,
  type SessionConfig,
  type SessionState,
  type SessionError,
  // Fixture Registry
  FixtureRegistry,
  getFixtureRegistry,
  registerFixture,
  resolveFixture,
  type FixtureDefinition,
  type FixtureRegistrationOptions,
  type RegistryError,
  // Mock Provider
  MockProvider,
  createMockProvider,
  type MockProviderConfig,
  type MockHandler,
  type MockResponse,
  type MockProviderError,
  // Test Database
  TestDatabase,
  createTestDatabase,
  type TestDatabaseConfig,
  type SeedData,
  type SeedResult,
  type DatabaseError,
  type QueryResult,
} from '../domain/index.js';

// ============================================================================
// Re-exports from Types for Convenience
// ============================================================================

export type {
  TestRunId,
  TestSuiteId,
  TestCaseId,
  FixtureId,
  TestResult,
  TestStatus,
  TestSuiteResult,
  TestRunResult,
} from '../types/test-types.js';

export {
  createTestRunId,
  createTestSuiteId,
  createTestCaseId,
  createFixtureId,
} from '../types/test-types.js';

// ============================================================================
// Re-exports from Utility Types
// ============================================================================

export type {
  Result,
  AsyncResult,
} from '../../api/src/types/utility.js';

export {
  success,
  failure,
  isSuccess,
  isFailure,
} from '../../api/src/types/utility.js';
