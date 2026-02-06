/**
 * E2E Test Core Types
 * @module e2e/types/test-types
 *
 * Core type definitions for E2E testing infrastructure:
 * - E2ETestConfig - Test configuration options
 * - TestFixture<T> - Generic fixture wrapper
 * - TestContext - Current test context
 * - TestResult - Test execution result
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #20 of 47 | Phase 4: Implementation
 */

import type { TenantId, RepositoryId, ScanId, UserId } from '../../api/src/types/entities.js';
import type { Brand } from '../../api/src/types/utility.js';

// ============================================================================
// Branded Types for E2E Testing
// ============================================================================

/**
 * Branded type for Test Run IDs
 * @example
 * const testRunId = 'test_run_01HXYZ...' as TestRunId;
 */
export type TestRunId = Brand<string, 'TestRunId'>;

/**
 * Branded type for Test Suite IDs
 * @example
 * const suiteId = 'suite_01HXYZ...' as TestSuiteId;
 */
export type TestSuiteId = Brand<string, 'TestSuiteId'>;

/**
 * Branded type for Test Case IDs
 * @example
 * const caseId = 'case_01HXYZ...' as TestCaseId;
 */
export type TestCaseId = Brand<string, 'TestCaseId'>;

/**
 * Branded type for Fixture IDs
 * @example
 * const fixtureId = 'fixture_01HXYZ...' as FixtureId;
 */
export type FixtureId = Brand<string, 'FixtureId'>;

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

/**
 * Create a TestRunId from a string
 */
export function createTestRunId(id: string): TestRunId {
  return id as TestRunId;
}

/**
 * Create a TestSuiteId from a string
 */
export function createTestSuiteId(id: string): TestSuiteId {
  return id as TestSuiteId;
}

/**
 * Create a TestCaseId from a string
 */
export function createTestCaseId(id: string): TestCaseId {
  return id as TestCaseId;
}

/**
 * Create a FixtureId from a string
 */
export function createFixtureId(id: string): FixtureId {
  return id as FixtureId;
}

// ============================================================================
// Test Configuration Types
// ============================================================================

/**
 * E2E test configuration options
 */
export interface E2ETestConfig {
  /** Test run unique identifier */
  readonly runId?: TestRunId;
  /** Test timeout in milliseconds */
  readonly timeout: number;
  /** Number of retry attempts for flaky tests */
  readonly retries: number;
  /** Parallel execution configuration */
  readonly parallel: ParallelConfig;
  /** Database configuration */
  readonly database: DatabaseConfig;
  /** Mocking configuration */
  readonly mocking: MockingConfig;
  /** Logging configuration */
  readonly logging: LoggingConfig;
  /** Coverage configuration */
  readonly coverage: CoverageConfig;
  /** Environment configuration */
  readonly environment: EnvironmentConfig;
}

/**
 * Parallel execution configuration
 */
export interface ParallelConfig {
  /** Whether parallel execution is enabled */
  readonly enabled: boolean;
  /** Number of parallel workers */
  readonly workers: number;
  /** Test isolation level */
  readonly isolation: 'none' | 'thread' | 'process';
}

/**
 * Database configuration for tests
 */
export interface DatabaseConfig {
  /** PostgreSQL connection string */
  readonly connectionString: string;
  /** Database name */
  readonly database: string;
  /** Run migrations on setup */
  readonly runMigrations: boolean;
  /** Clean database before each test */
  readonly cleanBeforeTest: boolean;
  /** Use transactions for test isolation */
  readonly useTransactions: boolean;
  /** Connection pool size */
  readonly poolSize: number;
}

/**
 * Mocking configuration
 */
export interface MockingConfig {
  /** Enable MSW mocking */
  readonly enabled: boolean;
  /** Record requests for debugging */
  readonly recordRequests: boolean;
  /** Mock external services by default */
  readonly mockExternalServices: boolean;
  /** Mock handlers to load */
  readonly handlers: ReadonlyArray<string>;
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Logging level */
  readonly level: 'debug' | 'info' | 'warn' | 'error' | 'silent';
  /** Log to file */
  readonly file: boolean;
  /** Log file path */
  readonly filePath?: string;
  /** Include timestamps */
  readonly timestamps: boolean;
  /** Include request/response bodies */
  readonly logBodies: boolean;
}

/**
 * Coverage configuration
 */
export interface CoverageConfig {
  /** Enable coverage collection */
  readonly enabled: boolean;
  /** Coverage reporters */
  readonly reporters: ReadonlyArray<'text' | 'html' | 'lcov' | 'json'>;
  /** Coverage thresholds */
  readonly thresholds: CoverageThresholds;
  /** Paths to include */
  readonly include: ReadonlyArray<string>;
  /** Paths to exclude */
  readonly exclude: ReadonlyArray<string>;
}

/**
 * Coverage thresholds
 */
export interface CoverageThresholds {
  readonly lines: number;
  readonly functions: number;
  readonly branches: number;
  readonly statements: number;
}

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  /** Environment name */
  readonly name: 'test' | 'development' | 'staging' | 'production';
  /** Base URL for API */
  readonly baseUrl: string;
  /** Default tenant ID */
  readonly defaultTenantId: TenantId;
  /** Default user ID */
  readonly defaultUserId: UserId;
  /** Environment variables */
  readonly variables: Readonly<Record<string, string>>;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default E2E test configuration
 */
export const DEFAULT_E2E_CONFIG: E2ETestConfig = {
  timeout: 30000,
  retries: 0,
  parallel: {
    enabled: false,
    workers: 1,
    isolation: 'thread',
  },
  database: {
    connectionString: process.env.TEST_DATABASE_URL ?? 'postgresql://test:test@localhost:5433/test_db',
    database: 'test_db',
    runMigrations: true,
    cleanBeforeTest: true,
    useTransactions: true,
    poolSize: 5,
  },
  mocking: {
    enabled: true,
    recordRequests: false,
    mockExternalServices: true,
    handlers: [],
  },
  logging: {
    level: 'warn',
    file: false,
    timestamps: true,
    logBodies: false,
  },
  coverage: {
    enabled: false,
    reporters: ['text'],
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
    include: ['src/**/*.ts'],
    exclude: ['**/*.spec.ts', '**/*.test.ts'],
  },
  environment: {
    name: 'test',
    baseUrl: 'http://localhost:3000',
    defaultTenantId: '00000000-0000-0000-0000-000000000001' as TenantId,
    defaultUserId: '00000000-0000-0000-0000-000000000001' as UserId,
    variables: {},
  },
};

// ============================================================================
// Test Fixture Types
// ============================================================================

/**
 * Generic test fixture wrapper
 */
export interface TestFixture<T> {
  /** Unique fixture identifier */
  readonly id: FixtureId;
  /** Fixture name */
  readonly name: string;
  /** Fixture description */
  readonly description: string;
  /** Fixture data */
  readonly data: T;
  /** Fixture tags for filtering */
  readonly tags: ReadonlyArray<string>;
  /** Fixture metadata */
  readonly metadata: FixtureMetadata;
  /** Setup function (called before using fixture) */
  readonly setup?: () => Promise<void>;
  /** Teardown function (called after using fixture) */
  readonly teardown?: () => Promise<void>;
}

/**
 * Fixture metadata
 */
export interface FixtureMetadata {
  /** Created timestamp */
  readonly createdAt: Date;
  /** Last modified timestamp */
  readonly modifiedAt: Date;
  /** Fixture version */
  readonly version: string;
  /** Source file path */
  readonly sourcePath?: string;
  /** Dependencies on other fixtures */
  readonly dependencies: ReadonlyArray<FixtureId>;
  /** Custom metadata */
  readonly custom: Readonly<Record<string, unknown>>;
}

/**
 * Fixture factory function type
 */
export type FixtureFactory<T, TOptions = Record<string, unknown>> = (
  options?: Partial<TOptions>
) => TestFixture<T>;

/**
 * Async fixture factory function type
 */
export type AsyncFixtureFactory<T, TOptions = Record<string, unknown>> = (
  options?: Partial<TOptions>
) => Promise<TestFixture<T>>;

// ============================================================================
// Test Context Types
// ============================================================================

/**
 * Current test context
 */
export interface TestContext {
  /** Test run ID */
  readonly runId: TestRunId;
  /** Test suite ID */
  readonly suiteId: TestSuiteId;
  /** Test case ID */
  readonly caseId: TestCaseId;
  /** Test name */
  readonly testName: string;
  /** Test file path */
  readonly testFile: string;
  /** Test configuration */
  readonly config: E2ETestConfig;
  /** Start time */
  readonly startTime: Date;
  /** Current tenant context */
  readonly tenant: TenantContext;
  /** Current user context */
  readonly user: UserContext;
  /** Test state */
  readonly state: TestState;
  /** Accumulated artifacts */
  readonly artifacts: ReadonlyArray<TestArtifact>;
}

/**
 * Tenant context for tests
 */
export interface TenantContext {
  readonly id: TenantId;
  readonly name: string;
  readonly settings: Readonly<Record<string, unknown>>;
}

/**
 * User context for tests
 */
export interface UserContext {
  readonly id: UserId;
  readonly email: string;
  readonly name: string;
  readonly githubId: number;
  readonly tenantId: TenantId;
  readonly permissions: ReadonlyArray<string>;
}

/**
 * Test state during execution
 */
export interface TestState {
  /** Current phase */
  readonly phase: TestPhase;
  /** Whether test is running */
  readonly running: boolean;
  /** Errors accumulated during test */
  readonly errors: ReadonlyArray<TestError>;
  /** Warnings accumulated during test */
  readonly warnings: ReadonlyArray<TestWarning>;
  /** Custom state data */
  readonly data: Readonly<Record<string, unknown>>;
}

/**
 * Test execution phase
 */
export type TestPhase =
  | 'setup'
  | 'beforeAll'
  | 'beforeEach'
  | 'test'
  | 'afterEach'
  | 'afterAll'
  | 'teardown'
  | 'completed'
  | 'failed';

/**
 * Test error
 */
export interface TestError {
  readonly code: string;
  readonly message: string;
  readonly stack?: string;
  readonly timestamp: Date;
  readonly phase: TestPhase;
  readonly context?: Readonly<Record<string, unknown>>;
}

/**
 * Test warning
 */
export interface TestWarning {
  readonly code: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly phase: TestPhase;
}

/**
 * Test artifact (screenshots, logs, etc.)
 */
export interface TestArtifact {
  readonly id: string;
  readonly type: ArtifactType;
  readonly name: string;
  readonly path: string;
  readonly mimeType: string;
  readonly size: number;
  readonly createdAt: Date;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Test artifact types
 */
export type ArtifactType =
  | 'screenshot'
  | 'video'
  | 'log'
  | 'trace'
  | 'har'
  | 'coverage'
  | 'report'
  | 'custom';

// ============================================================================
// Test Result Types
// ============================================================================

/**
 * Test execution result
 */
export interface TestResult {
  /** Test run ID */
  readonly runId: TestRunId;
  /** Test suite ID */
  readonly suiteId: TestSuiteId;
  /** Test case ID */
  readonly caseId: TestCaseId;
  /** Test name */
  readonly testName: string;
  /** Test file path */
  readonly testFile: string;
  /** Result status */
  readonly status: TestStatus;
  /** Duration in milliseconds */
  readonly duration: number;
  /** Start time */
  readonly startTime: Date;
  /** End time */
  readonly endTime: Date;
  /** Error if test failed */
  readonly error?: TestResultError;
  /** Retry information */
  readonly retry: RetryInfo;
  /** Performance metrics */
  readonly metrics: TestMetrics;
  /** Test artifacts */
  readonly artifacts: ReadonlyArray<TestArtifact>;
  /** Custom metadata */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Test status
 */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'pending' | 'timeout';

/**
 * Test result error
 */
export interface TestResultError {
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly diff?: string;
  readonly matcherName?: string;
}

/**
 * Retry information
 */
export interface RetryInfo {
  readonly attempt: number;
  readonly maxRetries: number;
  readonly retriedDueToFailure: boolean;
  readonly previousAttempts: ReadonlyArray<PreviousAttempt>;
}

/**
 * Previous test attempt
 */
export interface PreviousAttempt {
  readonly attempt: number;
  readonly status: TestStatus;
  readonly duration: number;
  readonly error?: TestResultError;
}

/**
 * Test performance metrics
 */
export interface TestMetrics {
  /** Total test duration */
  readonly totalDuration: number;
  /** Setup duration */
  readonly setupDuration: number;
  /** Teardown duration */
  readonly teardownDuration: number;
  /** Network requests count */
  readonly networkRequests: number;
  /** Database queries count */
  readonly databaseQueries: number;
  /** Memory usage (bytes) */
  readonly memoryUsage: number;
  /** Custom metrics */
  readonly custom: Readonly<Record<string, number>>;
}

// ============================================================================
// Test Suite Types
// ============================================================================

/**
 * Test suite result
 */
export interface TestSuiteResult {
  /** Suite ID */
  readonly suiteId: TestSuiteId;
  /** Suite name */
  readonly name: string;
  /** Suite file path */
  readonly file: string;
  /** Suite status */
  readonly status: TestStatus;
  /** Total duration */
  readonly duration: number;
  /** Start time */
  readonly startTime: Date;
  /** End time */
  readonly endTime: Date;
  /** Test results */
  readonly tests: ReadonlyArray<TestResult>;
  /** Nested suites */
  readonly suites: ReadonlyArray<TestSuiteResult>;
  /** Summary statistics */
  readonly stats: TestSuiteStats;
}

/**
 * Test suite statistics
 */
export interface TestSuiteStats {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
  readonly pending: number;
  readonly timeout: number;
  readonly passRate: number;
  readonly averageDuration: number;
}

// ============================================================================
// Test Run Types
// ============================================================================

/**
 * Complete test run result
 */
export interface TestRunResult {
  /** Run ID */
  readonly runId: TestRunId;
  /** Run name */
  readonly name: string;
  /** Run status */
  readonly status: TestStatus;
  /** Total duration */
  readonly duration: number;
  /** Start time */
  readonly startTime: Date;
  /** End time */
  readonly endTime: Date;
  /** Configuration used */
  readonly config: E2ETestConfig;
  /** Suite results */
  readonly suites: ReadonlyArray<TestSuiteResult>;
  /** Overall statistics */
  readonly stats: TestRunStats;
  /** Coverage data */
  readonly coverage?: CoverageData;
  /** Environment info */
  readonly environment: EnvironmentInfo;
}

/**
 * Test run statistics
 */
export interface TestRunStats extends TestSuiteStats {
  readonly suitesTotal: number;
  readonly suitesPassed: number;
  readonly suitesFailed: number;
  readonly flakyTests: number;
  readonly retriedTests: number;
}

/**
 * Coverage data
 */
export interface CoverageData {
  readonly lines: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly statements: CoverageMetric;
  readonly files: ReadonlyArray<FileCoverage>;
}

/**
 * Coverage metric
 */
export interface CoverageMetric {
  readonly total: number;
  readonly covered: number;
  readonly percentage: number;
}

/**
 * File coverage data
 */
export interface FileCoverage {
  readonly path: string;
  readonly lines: CoverageMetric;
  readonly functions: CoverageMetric;
  readonly branches: CoverageMetric;
  readonly statements: CoverageMetric;
  readonly uncoveredLines: ReadonlyArray<number>;
}

/**
 * Environment info
 */
export interface EnvironmentInfo {
  readonly nodeVersion: string;
  readonly platform: string;
  readonly arch: string;
  readonly hostname: string;
  readonly ci: boolean;
  readonly ciName?: string;
  readonly gitBranch?: string;
  readonly gitCommit?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for TestResult
 */
export function isTestResult(value: unknown): value is TestResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'runId' in value &&
    'suiteId' in value &&
    'caseId' in value &&
    'status' in value &&
    'duration' in value
  );
}

/**
 * Type guard for TestSuiteResult
 */
export function isTestSuiteResult(value: unknown): value is TestSuiteResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'suiteId' in value &&
    'tests' in value &&
    'stats' in value
  );
}

/**
 * Type guard for TestRunResult
 */
export function isTestRunResult(value: unknown): value is TestRunResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'runId' in value &&
    'suites' in value &&
    'stats' in value
  );
}

/**
 * Type guard for TestStatus
 */
export function isTestStatus(value: unknown): value is TestStatus {
  return (
    typeof value === 'string' &&
    ['passed', 'failed', 'skipped', 'pending', 'timeout'].includes(value)
  );
}

/**
 * Type guard for TestPhase
 */
export function isTestPhase(value: unknown): value is TestPhase {
  return (
    typeof value === 'string' &&
    [
      'setup',
      'beforeAll',
      'beforeEach',
      'test',
      'afterEach',
      'afterAll',
      'teardown',
      'completed',
      'failed',
    ].includes(value)
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Deep partial type for configuration overrides
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends ReadonlyArray<infer U>
      ? ReadonlyArray<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

/**
 * Configuration override type
 */
export type E2ETestConfigOverride = DeepPartial<E2ETestConfig>;

/**
 * Extract fixture data type
 */
export type FixtureData<T extends TestFixture<unknown>> = T extends TestFixture<infer D> ? D : never;
