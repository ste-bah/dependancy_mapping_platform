/**
 * E2E Configuration Schema
 * @module e2e/config/e2e-config
 *
 * Comprehensive configuration schema for E2E testing with type-safe
 * validation using Zod. Covers test timeouts, parallel execution,
 * database connections, and API endpoints.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #27 of 47 | Phase 4: Implementation
 */

import { z } from 'zod';
import type { TenantId, UserId } from '../../api/src/types/entities.js';

// ============================================================================
// Timeout Configuration Schema
// ============================================================================

/**
 * Timeout configuration for various test operations
 */
export const TimeoutConfigSchema = z.object({
  /** Default test case timeout in milliseconds */
  testTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Hook timeout (beforeAll, afterAll, etc.) in milliseconds */
  hookTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Setup timeout in milliseconds */
  setupTimeout: z.coerce.number().int().min(1000).default(60000),
  /** Teardown timeout in milliseconds */
  teardownTimeout: z.coerce.number().int().min(1000).default(30000),
  /** API request timeout in milliseconds */
  requestTimeout: z.coerce.number().int().min(1000).default(10000),
  /** Database query timeout in milliseconds */
  databaseTimeout: z.coerce.number().int().min(1000).default(15000),
  /** Assertion wait timeout in milliseconds */
  assertionTimeout: z.coerce.number().int().min(500).default(5000),
  /** Browser action timeout (for Playwright) in milliseconds */
  browserTimeout: z.coerce.number().int().min(1000).default(15000),
  /** Navigation timeout in milliseconds */
  navigationTimeout: z.coerce.number().int().min(1000).default(30000),
  /** Element wait timeout in milliseconds */
  elementTimeout: z.coerce.number().int().min(500).default(5000),
});

export type TimeoutConfig = z.infer<typeof TimeoutConfigSchema>;

// ============================================================================
// Parallel Execution Configuration Schema
// ============================================================================

/**
 * Parallel test execution configuration
 */
export const ParallelConfigSchema = z.object({
  /** Enable parallel test execution */
  enabled: z.coerce.boolean().default(false),
  /** Number of worker processes */
  workers: z.coerce.number().int().min(1).max(32).default(1),
  /** Maximum concurrent tests per worker */
  maxConcurrency: z.coerce.number().int().min(1).max(16).default(1),
  /** Test isolation level */
  isolation: z.enum(['none', 'thread', 'process']).default('process'),
  /** Shard configuration for distributed testing */
  shard: z.object({
    /** Enable test sharding */
    enabled: z.coerce.boolean().default(false),
    /** Current shard index (1-based) */
    current: z.coerce.number().int().min(1).default(1),
    /** Total number of shards */
    total: z.coerce.number().int().min(1).default(1),
  }).default({}),
  /** Run tests in random order */
  shuffle: z.coerce.boolean().default(false),
  /** Seed for random order (for reproducibility) */
  shuffleSeed: z.coerce.number().int().optional(),
  /** Fail fast - stop on first failure */
  failFast: z.coerce.boolean().default(false),
});

export type ParallelConfig = z.infer<typeof ParallelConfigSchema>;

// ============================================================================
// Database Configuration Schema
// ============================================================================

/**
 * Test database configuration
 */
export const TestDatabaseConfigSchema = z.object({
  /** PostgreSQL connection string */
  connectionString: z.string().default('postgresql://test:test@localhost:5433/test_db'),
  /** Database host */
  host: z.string().default('localhost'),
  /** Database port */
  port: z.coerce.number().int().min(1).max(65535).default(5433),
  /** Database name */
  database: z.string().default('test_db'),
  /** Database user */
  username: z.string().default('test'),
  /** Database password */
  password: z.string().default('test'),
  /** Enable SSL */
  ssl: z.coerce.boolean().default(false),
  /** Connection pool minimum size */
  poolMin: z.coerce.number().int().min(0).default(1),
  /** Connection pool maximum size */
  poolMax: z.coerce.number().int().min(1).default(5),
  /** Run migrations on setup */
  runMigrations: z.coerce.boolean().default(true),
  /** Clean database before each test */
  cleanBeforeTest: z.coerce.boolean().default(true),
  /** Use transactions for test isolation */
  useTransactions: z.coerce.boolean().default(true),
  /** Reset sequences after cleanup */
  resetSequences: z.coerce.boolean().default(true),
  /** Truncate tables in order (handles foreign keys) */
  truncateOrder: z.array(z.string()).default([
    'scan_results',
    'scans',
    'repositories',
    'api_keys',
    'user_tenants',
    'users',
    'tenants',
  ]),
});

export type TestDatabaseConfig = z.infer<typeof TestDatabaseConfigSchema>;

// ============================================================================
// API Endpoints Configuration Schema
// ============================================================================

/**
 * API endpoint configuration for tests
 */
export const ApiEndpointsConfigSchema = z.object({
  /** Base URL for API requests */
  baseUrl: z.string().url().default('http://localhost:3000'),
  /** API version prefix */
  apiPrefix: z.string().default('/api/v1'),
  /** Health check endpoint */
  healthEndpoint: z.string().default('/health'),
  /** Auth endpoints */
  auth: z.object({
    login: z.string().default('/auth/login'),
    logout: z.string().default('/auth/logout'),
    refresh: z.string().default('/auth/refresh'),
    callback: z.string().default('/auth/github/callback'),
  }).default({}),
  /** Repository endpoints */
  repositories: z.object({
    list: z.string().default('/repositories'),
    get: z.string().default('/repositories/:id'),
    create: z.string().default('/repositories'),
    delete: z.string().default('/repositories/:id'),
    sync: z.string().default('/repositories/:id/sync'),
  }).default({}),
  /** Scan endpoints */
  scans: z.object({
    list: z.string().default('/scans'),
    get: z.string().default('/scans/:id'),
    create: z.string().default('/scans'),
    cancel: z.string().default('/scans/:id/cancel'),
    results: z.string().default('/scans/:id/results'),
  }).default({}),
  /** Graph endpoints */
  graph: z.object({
    get: z.string().default('/graph/:scanId'),
    nodes: z.string().default('/graph/:scanId/nodes'),
    edges: z.string().default('/graph/:scanId/edges'),
    blast: z.string().default('/graph/:scanId/blast-radius'),
  }).default({}),
  /** Tenant endpoints */
  tenants: z.object({
    get: z.string().default('/tenants/:id'),
    settings: z.string().default('/tenants/:id/settings'),
  }).default({}),
});

export type ApiEndpointsConfig = z.infer<typeof ApiEndpointsConfigSchema>;

// ============================================================================
// Mocking Configuration Schema
// ============================================================================

/**
 * Mock service configuration
 */
export const MockingConfigSchema = z.object({
  /** Enable MSW mocking */
  enabled: z.coerce.boolean().default(true),
  /** Record requests for debugging */
  recordRequests: z.coerce.boolean().default(false),
  /** Mock external services by default */
  mockExternalServices: z.coerce.boolean().default(true),
  /** Mock GitHub API */
  mockGitHub: z.coerce.boolean().default(true),
  /** Mock GitLab API */
  mockGitLab: z.coerce.boolean().default(true),
  /** Mock Terraform Registry */
  mockTerraformRegistry: z.coerce.boolean().default(true),
  /** Mock delay in milliseconds (simulates network latency) */
  mockDelay: z.coerce.number().int().min(0).default(0),
  /** Custom mock handlers to load */
  handlers: z.array(z.string()).default([]),
  /** Pass through URLs (not mocked) */
  passthroughUrls: z.array(z.string()).default([]),
});

export type MockingConfig = z.infer<typeof MockingConfigSchema>;

// ============================================================================
// Retry Configuration Schema
// ============================================================================

/**
 * Test retry configuration
 */
export const RetryConfigSchema = z.object({
  /** Number of retry attempts for failed tests */
  retries: z.coerce.number().int().min(0).max(5).default(0),
  /** Only retry on specific error types */
  retryOnErrors: z.array(z.string()).default([
    'TimeoutError',
    'NetworkError',
    'ECONNREFUSED',
    'ETIMEDOUT',
  ]),
  /** Delay between retries in milliseconds */
  retryDelay: z.coerce.number().int().min(0).default(1000),
  /** Exponential backoff multiplier */
  backoffMultiplier: z.coerce.number().min(1).default(2),
  /** Maximum delay between retries */
  maxRetryDelay: z.coerce.number().int().min(0).default(30000),
});

export type RetryConfig = z.infer<typeof RetryConfigSchema>;

// ============================================================================
// Logging Configuration Schema
// ============================================================================

/**
 * Test logging configuration
 */
export const TestLoggingConfigSchema = z.object({
  /** Log level */
  level: z.enum(['debug', 'info', 'warn', 'error', 'silent']).default('warn'),
  /** Log to file */
  file: z.coerce.boolean().default(false),
  /** Log file path */
  filePath: z.string().optional(),
  /** Include timestamps */
  timestamps: z.coerce.boolean().default(true),
  /** Include request/response bodies */
  logBodies: z.coerce.boolean().default(false),
  /** Log test lifecycle events */
  logLifecycle: z.coerce.boolean().default(false),
  /** Log fixture operations */
  logFixtures: z.coerce.boolean().default(false),
  /** Log database operations */
  logDatabase: z.coerce.boolean().default(false),
  /** Pretty print logs */
  pretty: z.coerce.boolean().default(false),
});

export type TestLoggingConfig = z.infer<typeof TestLoggingConfigSchema>;

// ============================================================================
// Coverage Configuration Schema
// ============================================================================

/**
 * Coverage collection configuration
 */
export const CoverageConfigSchema = z.object({
  /** Enable coverage collection */
  enabled: z.coerce.boolean().default(false),
  /** Coverage reporters */
  reporters: z.array(z.enum(['text', 'html', 'lcov', 'json', 'cobertura'])).default(['text']),
  /** Coverage reports directory */
  reportsDirectory: z.string().default('./coverage'),
  /** Paths to include in coverage */
  include: z.array(z.string()).default(['../api/src/**/*.ts']),
  /** Paths to exclude from coverage */
  exclude: z.array(z.string()).default([
    '**/node_modules/**',
    '**/*.d.ts',
    '**/__tests__/**',
    '**/tests/**',
    '**/*.test.ts',
    '**/*.spec.ts',
  ]),
  /** Coverage thresholds */
  thresholds: z.object({
    lines: z.coerce.number().min(0).max(100).default(60),
    functions: z.coerce.number().min(0).max(100).default(60),
    branches: z.coerce.number().min(0).max(100).default(60),
    statements: z.coerce.number().min(0).max(100).default(60),
  }).default({}),
  /** Fail if thresholds not met */
  failOnThreshold: z.coerce.boolean().default(false),
});

export type CoverageConfig = z.infer<typeof CoverageConfigSchema>;

// ============================================================================
// Artifact Configuration Schema
// ============================================================================

/**
 * Test artifact configuration
 */
export const ArtifactConfigSchema = z.object({
  /** Enable artifact collection */
  enabled: z.coerce.boolean().default(true),
  /** Artifact output directory */
  outputDir: z.string().default('./test-results'),
  /** Collect screenshots on failure */
  screenshotsOnFailure: z.coerce.boolean().default(true),
  /** Collect video on failure */
  videoOnFailure: z.coerce.boolean().default(false),
  /** Collect trace on failure */
  traceOnFailure: z.coerce.boolean().default(false),
  /** Collect HAR files */
  collectHar: z.coerce.boolean().default(false),
  /** Retain artifacts for passed tests */
  retainOnPass: z.coerce.boolean().default(false),
  /** Maximum artifact age in days */
  maxAgeInDays: z.coerce.number().int().min(1).default(7),
});

export type ArtifactConfig = z.infer<typeof ArtifactConfigSchema>;

// ============================================================================
// Reporter Configuration Schema
// ============================================================================

/**
 * Test reporter configuration
 */
export const ReporterConfigSchema = z.object({
  /** Reporter types to use */
  reporters: z.array(z.enum([
    'default',
    'verbose',
    'basic',
    'json',
    'html',
    'junit',
    'dot',
    'tap',
    'github-actions',
  ])).default(['verbose']),
  /** HTML report output path */
  htmlOutputPath: z.string().default('./reports/test-report.html'),
  /** JSON report output path */
  jsonOutputPath: z.string().default('./reports/test-results.json'),
  /** JUnit report output path */
  junitOutputPath: z.string().default('./reports/junit.xml'),
  /** Include stack traces in reports */
  includeStackTraces: z.coerce.boolean().default(true),
  /** Include console output in reports */
  includeConsoleOutput: z.coerce.boolean().default(false),
});

export type ReporterConfig = z.infer<typeof ReporterConfigSchema>;

// ============================================================================
// Test Context Configuration Schema
// ============================================================================

/**
 * Default test context configuration
 */
export const TestContextConfigSchema = z.object({
  /** Default tenant ID for tests */
  defaultTenantId: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
  /** Default user ID for tests */
  defaultUserId: z.string().uuid().default('00000000-0000-0000-0000-000000000001'),
  /** Default user email */
  defaultUserEmail: z.string().email().default('test@example.com'),
  /** Default user name */
  defaultUserName: z.string().default('Test User'),
  /** Default GitHub ID */
  defaultGitHubId: z.coerce.number().int().default(12345),
  /** Default repository owner */
  defaultRepoOwner: z.string().default('test-org'),
  /** Default repository name */
  defaultRepoName: z.string().default('test-repo'),
});

export type TestContextConfig = z.infer<typeof TestContextConfigSchema>;

// ============================================================================
// Feature Flags Schema
// ============================================================================

/**
 * E2E test feature flags
 */
export const E2EFeatureFlagsSchema = z.object({
  /** Enable experimental test features */
  experimentalFeatures: z.coerce.boolean().default(false),
  /** Enable visual regression testing */
  visualTesting: z.coerce.boolean().default(false),
  /** Enable performance testing */
  performanceTesting: z.coerce.boolean().default(false),
  /** Enable accessibility testing */
  accessibilityTesting: z.coerce.boolean().default(false),
  /** Enable API contract testing */
  contractTesting: z.coerce.boolean().default(false),
  /** Enable snapshot testing */
  snapshotTesting: z.coerce.boolean().default(true),
  /** Enable test quarantine (skip flaky tests) */
  testQuarantine: z.coerce.boolean().default(false),
  /** Enable parallel database cleanup */
  parallelCleanup: z.coerce.boolean().default(false),
  /** Enable test data factories */
  dataFactories: z.coerce.boolean().default(true),
});

export type E2EFeatureFlags = z.infer<typeof E2EFeatureFlagsSchema>;

// ============================================================================
// Complete E2E Configuration Schema
// ============================================================================

/**
 * Complete E2E test configuration schema
 */
export const E2EConfigSchema = z.object({
  /** Configuration name/identifier */
  name: z.string().default('default'),
  /** Environment name */
  environment: z.enum(['test', 'ci', 'local', 'staging']).default('test'),
  /** Timeout configuration */
  timeouts: TimeoutConfigSchema.default({}),
  /** Parallel execution configuration */
  parallel: ParallelConfigSchema.default({}),
  /** Database configuration */
  database: TestDatabaseConfigSchema.default({}),
  /** API endpoints configuration */
  endpoints: ApiEndpointsConfigSchema.default({}),
  /** Mocking configuration */
  mocking: MockingConfigSchema.default({}),
  /** Retry configuration */
  retry: RetryConfigSchema.default({}),
  /** Logging configuration */
  logging: TestLoggingConfigSchema.default({}),
  /** Coverage configuration */
  coverage: CoverageConfigSchema.default({}),
  /** Artifact configuration */
  artifacts: ArtifactConfigSchema.default({}),
  /** Reporter configuration */
  reporters: ReporterConfigSchema.default({}),
  /** Test context defaults */
  context: TestContextConfigSchema.default({}),
  /** Feature flags */
  features: E2EFeatureFlagsSchema.default({}),
});

export type E2EConfig = z.infer<typeof E2EConfigSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default E2E configuration
 */
export const DEFAULT_E2E_CONFIG: E2EConfig = E2EConfigSchema.parse({});

// ============================================================================
// Configuration Builder
// ============================================================================

/**
 * Builder for creating E2E configurations with fluent API
 */
export class E2EConfigBuilder {
  private config: Partial<E2EConfig> = {};

  /**
   * Set configuration name
   */
  withName(name: string): this {
    this.config.name = name;
    return this;
  }

  /**
   * Set environment
   */
  withEnvironment(env: 'test' | 'ci' | 'local' | 'staging'): this {
    this.config.environment = env;
    return this;
  }

  /**
   * Set timeout configuration
   */
  withTimeouts(timeouts: Partial<TimeoutConfig>): this {
    this.config.timeouts = { ...this.config.timeouts, ...timeouts };
    return this;
  }

  /**
   * Set parallel configuration
   */
  withParallel(parallel: Partial<ParallelConfig>): this {
    this.config.parallel = { ...this.config.parallel, ...parallel };
    return this;
  }

  /**
   * Set database configuration
   */
  withDatabase(database: Partial<TestDatabaseConfig>): this {
    this.config.database = { ...this.config.database, ...database };
    return this;
  }

  /**
   * Set API endpoints configuration
   */
  withEndpoints(endpoints: Partial<ApiEndpointsConfig>): this {
    this.config.endpoints = { ...this.config.endpoints, ...endpoints };
    return this;
  }

  /**
   * Set mocking configuration
   */
  withMocking(mocking: Partial<MockingConfig>): this {
    this.config.mocking = { ...this.config.mocking, ...mocking };
    return this;
  }

  /**
   * Set retry configuration
   */
  withRetry(retry: Partial<RetryConfig>): this {
    this.config.retry = { ...this.config.retry, ...retry };
    return this;
  }

  /**
   * Set logging configuration
   */
  withLogging(logging: Partial<TestLoggingConfig>): this {
    this.config.logging = { ...this.config.logging, ...logging };
    return this;
  }

  /**
   * Set coverage configuration
   */
  withCoverage(coverage: Partial<CoverageConfig>): this {
    this.config.coverage = { ...this.config.coverage, ...coverage };
    return this;
  }

  /**
   * Set artifact configuration
   */
  withArtifacts(artifacts: Partial<ArtifactConfig>): this {
    this.config.artifacts = { ...this.config.artifacts, ...artifacts };
    return this;
  }

  /**
   * Set reporter configuration
   */
  withReporters(reporters: Partial<ReporterConfig>): this {
    this.config.reporters = { ...this.config.reporters, ...reporters };
    return this;
  }

  /**
   * Set test context defaults
   */
  withContext(context: Partial<TestContextConfig>): this {
    this.config.context = { ...this.config.context, ...context };
    return this;
  }

  /**
   * Set feature flags
   */
  withFeatures(features: Partial<E2EFeatureFlags>): this {
    this.config.features = { ...this.config.features, ...features };
    return this;
  }

  /**
   * Build and validate the configuration
   */
  build(): E2EConfig {
    return E2EConfigSchema.parse(this.config);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an E2E config builder
 */
export function createE2EConfigBuilder(): E2EConfigBuilder {
  return new E2EConfigBuilder();
}

/**
 * Create an E2E configuration from partial options
 */
export function createE2EConfig(options: Partial<E2EConfig> = {}): E2EConfig {
  return E2EConfigSchema.parse(options);
}

/**
 * Merge multiple E2E configurations
 */
export function mergeE2EConfigs(...configs: Partial<E2EConfig>[]): E2EConfig {
  const merged = configs.reduce((acc, config) => deepMerge(acc, config), {});
  return E2EConfigSchema.parse(merged);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target } as Record<string, unknown>;

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = target[key as keyof T];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      result[key] = sourceValue;
    }
  }

  return result as T;
}

/**
 * Validate an E2E configuration
 */
export function validateE2EConfig(config: unknown): z.SafeParseReturnType<unknown, E2EConfig> {
  return E2EConfigSchema.safeParse(config);
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  TimeoutConfig,
  ParallelConfig,
  TestDatabaseConfig,
  ApiEndpointsConfig,
  MockingConfig,
  RetryConfig,
  TestLoggingConfig,
  CoverageConfig,
  ArtifactConfig,
  ReporterConfig,
  TestContextConfig,
  E2EFeatureFlags,
  E2EConfig,
};
