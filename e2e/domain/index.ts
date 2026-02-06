/**
 * E2E Domain Module Index
 * @module e2e/domain
 *
 * Central export file for all E2E domain entities and value objects.
 * Provides the foundational building blocks for E2E testing infrastructure.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #21 of 47 | Phase 4: Implementation
 *
 * Domain Components:
 * - TestSession: Test session lifecycle management
 * - FixtureRegistry: Fixture storage and dependency resolution
 * - MockProvider: External API mocking with MSW
 * - TestDatabase: Database management with Testcontainers
 */

// ============================================================================
// Test Session
// ============================================================================

export {
  // Class
  TestSession,
  // Factory Functions
  createTestSession,
  createSessionId,
  generateSessionId,
  isValidTransition,
  // Type Guards
  isSessionState,
  isSessionError,
  // Types
  type SessionId,
  type SessionState,
  type SessionConfig,
  type SessionTiming,
  type CleanupHandler,
  type SessionError,
  type FixtureEntry,
  // Constants
  DEFAULT_SESSION_CONFIG,
} from './test-session.js';

// ============================================================================
// Fixture Registry
// ============================================================================

export {
  // Class
  FixtureRegistry,
  // Factory Functions
  getFixtureRegistry,
  registerFixture,
  resolveFixture,
  // Type Guards
  isRegistryError,
  // Types
  type FixtureDefinition,
  type FixtureFactory,
  type FixtureRegistrationOptions,
  type RegistryError,
} from './fixture-registry.js';

// ============================================================================
// Mock Provider
// ============================================================================

export {
  // Class
  MockProvider,
  // Factory Functions
  createMockProvider,
  createMockHandlerId,
  // Type Guards
  isMockProviderError,
  isRecordedRequest,
  // Types
  type MockHandlerId,
  type HttpMethod,
  type RequestMatcher,
  type BodyMatcher,
  type MockResponse,
  type MockHandler,
  type MockResponseGenerator,
  type RecordedRequest,
  type RecordedResponse,
  type MockProviderConfig,
  type MockProviderError,
  // Constants
  DEFAULT_MOCK_PROVIDER_CONFIG,
} from './mock-provider.js';

// ============================================================================
// Test Database
// ============================================================================

export {
  // Class
  TestDatabase,
  // Factory Functions
  createTestDatabase,
  createConnectionId,
  createTransactionId,
  // Type Guards
  isDatabaseError,
  isDatabaseState,
  // Types
  type ConnectionId,
  type TransactionId,
  type TestDatabaseConfig,
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
  // Constants
  DEFAULT_TEST_DATABASE_CONFIG,
} from './test-database.js';

// ============================================================================
// Re-exports from Types
// ============================================================================

export type {
  FixtureId,
  TestRunId,
  TestSuiteId,
  TestCaseId,
} from '../types/test-types.js';

export {
  createFixtureId,
  createTestRunId,
  createTestSuiteId,
  createTestCaseId,
} from '../types/test-types.js';

// ============================================================================
// Re-exports from Entity Types
// ============================================================================

export type {
  TenantId,
  RepositoryId,
  ScanId,
  UserId,
} from '../../api/src/types/entities.js';

export {
  createTenantId,
  createRepositoryId,
  createScanId,
  createUserId,
} from '../../api/src/types/entities.js';

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
  unwrap,
  unwrapOr,
} from '../../api/src/types/utility.js';

// ============================================================================
// Re-exports from Data Layer
// ============================================================================

export * from '../data/index.js';
