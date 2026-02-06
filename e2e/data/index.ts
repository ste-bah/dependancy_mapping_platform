/**
 * E2E Data Layer
 * @module e2e/data
 *
 * Data persistence layer for E2E testing infrastructure.
 * Exports repositories, seeders, and cleanup utilities.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #23 of 47 | Phase 4: Implementation
 */

// ============================================================================
// Fixture Repository
// ============================================================================

export type {
  FixtureType,
  StoredFixture,
  FixtureMetadata,
  FixtureFilterCriteria,
  PaginatedResult,
  PaginationParams,
  BulkOperationResult,
  CreateFixtureInput,
  UpdateFixtureInput,
  FixtureRepositoryError,
  FixtureRepositoryErrorCode,
  IFixtureRepository,
} from './fixture-repository.js';

export {
  FixtureVersion,
  createFixtureVersion,
  InMemoryFixtureRepository,
  DatabaseFixtureRepository,
  createInMemoryFixtureRepository,
  createDatabaseFixtureRepository,
  isFixtureRepositoryError,
} from './fixture-repository.js';

// ============================================================================
// Test Result Repository
// ============================================================================

export type {
  StoreTestResultInput,
  StoreTestSuiteResultInput,
  StoreTestRunResultInput,
  StoredTestResult,
  StoredTestSuiteResult,
  StoredTestRunResult,
  Baseline,
  BaselineMetrics,
  ComparisonResult,
  ComparisonIssue,
  TestResultFilterCriteria,
  HistoricalQueryOptions,
  HistoricalTrend,
  FlakinessReport,
  TestResultRepositoryError,
  TestResultRepositoryErrorCode,
  ITestResultRepository,
} from './test-result-repository.js';

export {
  BaselineId,
  createBaselineId,
  InMemoryTestResultRepository,
  DatabaseTestResultRepository,
  createInMemoryTestResultRepository,
  createDatabaseTestResultRepository,
  isTestResultRepositoryError,
} from './test-result-repository.js';

// ============================================================================
// Seed Data
// ============================================================================

export type {
  SeederConfig,
  SeedingResult,
  SeededEntityResult,
  TerraformSeedOptions,
  HelmSeedOptions,
  GraphSeedOptions,
  TestEnvironmentSeed,
  SeederError,
  SeederErrorCode,
} from './seed-data.js';

export {
  DEFAULT_SEEDER_CONFIG,
  DEFAULT_TEST_TENANT,
  DEFAULT_TEST_USER,
  DEFAULT_TEST_REPOSITORY,
  SAMPLE_TERRAFORM_FIXTURE,
  SAMPLE_HELM_FIXTURE,
  MINIMAL_TEST_ENVIRONMENT,
  DatabaseSeeder,
  createDatabaseSeeder,
  quickSeedMinimal,
  isSeederError,
} from './seed-data.js';

// ============================================================================
// Cleanup
// ============================================================================

export type {
  CleanupConfig,
  PreserveConfig,
  CleanupResult,
  TableCleanupResult,
  OrphanDetectionResult,
  CleanupError,
  CleanupErrorCode,
  TransactionCleanupHandle,
  ICleanupService,
  CleanupSchedule,
} from './cleanup.js';

export {
  DEFAULT_CLEANUP_CONFIG,
  CleanupService,
  createCleanupService,
  quickCleanup,
  withTestIsolation,
  DEFAULT_CLEANUP_SCHEDULE,
  runScheduledCleanup,
  isCleanupError,
} from './cleanup.js';
