/**
 * E2E Test Environment Handler
 * @module e2e/config/environment
 *
 * Environment variable loading and validation for E2E tests.
 * Supports environment-specific overrides (test, ci, local) with
 * comprehensive validation of required variables.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #27 of 47 | Phase 4: Implementation
 */

import { z } from 'zod';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import { E2EConfigSchema, type E2EConfig } from './e2e-config.js';
import { SetupError } from '../errors/e2e-errors.js';

// ============================================================================
// Environment Types
// ============================================================================

/**
 * Test environment names
 */
export type TestEnvironment = 'test' | 'ci' | 'local' | 'staging';

/**
 * Environment variable schema for E2E tests
 */
export const E2EEnvSchema = z.object({
  // -------------------------------------------------------------------------
  // Core Environment
  // -------------------------------------------------------------------------
  /** Node environment */
  NODE_ENV: z.enum(['test', 'development', 'staging', 'production']).default('test'),
  /** E2E test environment */
  E2E_ENV: z.enum(['test', 'ci', 'local', 'staging']).default('test'),
  /** Enable debug mode */
  E2E_DEBUG: z.coerce.boolean().default(false),
  /** Enable verbose logging */
  VERBOSE: z.coerce.boolean().default(false),
  /** CI environment flag */
  CI: z.coerce.boolean().default(false),

  // -------------------------------------------------------------------------
  // Timeouts
  // -------------------------------------------------------------------------
  /** Test timeout in milliseconds */
  E2E_TEST_TIMEOUT: z.coerce.number().int().min(1000).optional(),
  /** Hook timeout in milliseconds */
  E2E_HOOK_TIMEOUT: z.coerce.number().int().min(1000).optional(),
  /** Request timeout in milliseconds */
  E2E_REQUEST_TIMEOUT: z.coerce.number().int().min(1000).optional(),
  /** Database timeout in milliseconds */
  E2E_DATABASE_TIMEOUT: z.coerce.number().int().min(1000).optional(),

  // -------------------------------------------------------------------------
  // Parallel Execution
  // -------------------------------------------------------------------------
  /** Enable parallel execution */
  E2E_PARALLEL: z.coerce.boolean().default(false),
  /** Number of workers */
  E2E_WORKERS: z.coerce.number().int().min(1).optional(),
  /** Current shard index */
  E2E_SHARD_CURRENT: z.coerce.number().int().min(1).optional(),
  /** Total shards */
  E2E_SHARD_TOTAL: z.coerce.number().int().min(1).optional(),
  /** Fail fast on first failure */
  E2E_FAIL_FAST: z.coerce.boolean().default(false),

  // -------------------------------------------------------------------------
  // Database Configuration
  // -------------------------------------------------------------------------
  /** Test database URL */
  TEST_DATABASE_URL: z.string().optional(),
  /** Database host */
  E2E_DB_HOST: z.string().optional(),
  /** Database port */
  E2E_DB_PORT: z.coerce.number().int().min(1).max(65535).optional(),
  /** Database name */
  E2E_DB_NAME: z.string().optional(),
  /** Database user */
  E2E_DB_USER: z.string().optional(),
  /** Database password */
  E2E_DB_PASSWORD: z.string().optional(),
  /** Run migrations */
  E2E_DB_MIGRATIONS: z.coerce.boolean().default(true),
  /** Clean database before tests */
  E2E_DB_CLEAN: z.coerce.boolean().default(true),

  // -------------------------------------------------------------------------
  // API Configuration
  // -------------------------------------------------------------------------
  /** API base URL */
  E2E_API_URL: z.string().url().optional(),
  /** API host */
  E2E_API_HOST: z.string().optional(),
  /** API port */
  E2E_API_PORT: z.coerce.number().int().min(1).max(65535).optional(),

  // -------------------------------------------------------------------------
  // Mocking Configuration
  // -------------------------------------------------------------------------
  /** Enable mocking */
  E2E_MOCKING: z.coerce.boolean().default(true),
  /** Record mock requests */
  E2E_MOCK_RECORD: z.coerce.boolean().default(false),
  /** Mock GitHub API */
  E2E_MOCK_GITHUB: z.coerce.boolean().default(true),
  /** Mock delay in ms */
  E2E_MOCK_DELAY: z.coerce.number().int().min(0).optional(),

  // -------------------------------------------------------------------------
  // Retry Configuration
  // -------------------------------------------------------------------------
  /** Number of retries */
  E2E_RETRIES: z.coerce.number().int().min(0).max(5).optional(),
  /** Retry delay in ms */
  E2E_RETRY_DELAY: z.coerce.number().int().min(0).optional(),

  // -------------------------------------------------------------------------
  // Logging Configuration
  // -------------------------------------------------------------------------
  /** Log level */
  E2E_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error', 'silent']).optional(),
  /** Log to file */
  E2E_LOG_FILE: z.coerce.boolean().default(false),
  /** Log file path */
  E2E_LOG_PATH: z.string().optional(),
  /** Pretty print logs */
  E2E_LOG_PRETTY: z.coerce.boolean().default(false),

  // -------------------------------------------------------------------------
  // Coverage Configuration
  // -------------------------------------------------------------------------
  /** Enable coverage */
  E2E_COVERAGE: z.coerce.boolean().default(false),
  /** Coverage reporters (comma-separated) */
  E2E_COVERAGE_REPORTERS: z.string().optional(),

  // -------------------------------------------------------------------------
  // Artifact Configuration
  // -------------------------------------------------------------------------
  /** Enable artifacts */
  E2E_ARTIFACTS: z.coerce.boolean().default(true),
  /** Artifact output directory */
  E2E_ARTIFACTS_DIR: z.string().optional(),
  /** Screenshots on failure */
  E2E_SCREENSHOTS: z.coerce.boolean().default(true),
  /** Video on failure */
  E2E_VIDEO: z.coerce.boolean().default(false),

  // -------------------------------------------------------------------------
  // Reporter Configuration
  // -------------------------------------------------------------------------
  /** Reporters (comma-separated) */
  E2E_REPORTERS: z.string().optional(),

  // -------------------------------------------------------------------------
  // Feature Flags
  // -------------------------------------------------------------------------
  /** Enable experimental features */
  E2E_EXPERIMENTAL: z.coerce.boolean().default(false),
  /** Enable visual testing */
  E2E_VISUAL_TESTING: z.coerce.boolean().default(false),
  /** Enable performance testing */
  E2E_PERF_TESTING: z.coerce.boolean().default(false),
  /** Enable accessibility testing */
  E2E_A11Y_TESTING: z.coerce.boolean().default(false),
});

export type E2EEnv = z.infer<typeof E2EEnvSchema>;

// ============================================================================
// Environment-Specific Defaults
// ============================================================================

/**
 * Default configuration for each environment
 */
export const ENVIRONMENT_DEFAULTS: Record<TestEnvironment, Partial<E2EConfig>> = {
  /**
   * Local development environment
   * Optimized for developer experience
   */
  local: {
    name: 'local',
    environment: 'local',
    timeouts: {
      testTimeout: 30000,
      hookTimeout: 30000,
      setupTimeout: 60000,
      teardownTimeout: 30000,
      requestTimeout: 10000,
      databaseTimeout: 15000,
      assertionTimeout: 5000,
      browserTimeout: 15000,
      navigationTimeout: 30000,
      elementTimeout: 5000,
    },
    parallel: {
      enabled: false,
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: true, // Stop on first failure for faster feedback
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 1,
      poolMax: 5,
      runMigrations: true,
      cleanBeforeTest: true,
      useTransactions: true,
      resetSequences: true,
      truncateOrder: [
        'scan_results',
        'scans',
        'repositories',
        'api_keys',
        'user_tenants',
        'users',
        'tenants',
      ],
    },
    mocking: {
      enabled: true,
      recordRequests: true, // Record for debugging
      mockExternalServices: true,
      mockGitHub: true,
      mockGitLab: true,
      mockTerraformRegistry: true,
      mockDelay: 0,
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 0, // No retries for local - fail fast
      retryOnErrors: ['TimeoutError', 'NetworkError'],
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'debug', // Verbose for development
      file: false,
      timestamps: true,
      logBodies: true, // Show request/response bodies
      logLifecycle: true,
      logFixtures: true,
      logDatabase: true,
      pretty: true, // Pretty print for readability
    },
    coverage: {
      enabled: false,
      reporters: ['text'],
      reportsDirectory: './coverage',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results',
      screenshotsOnFailure: true,
      videoOnFailure: true, // Enable video for local debugging
      traceOnFailure: true,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 7,
    },
    reporters: {
      reporters: ['verbose'],
      htmlOutputPath: './reports/test-report.html',
      jsonOutputPath: './reports/test-results.json',
      junitOutputPath: './reports/junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: true,
    },
    features: {
      experimentalFeatures: true, // Enable experimental locally
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: true,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },

  /**
   * Test environment
   * Balanced for testing scenarios
   */
  test: {
    name: 'test',
    environment: 'test',
    timeouts: {
      testTimeout: 30000,
      hookTimeout: 30000,
      setupTimeout: 60000,
      teardownTimeout: 30000,
      requestTimeout: 10000,
      databaseTimeout: 15000,
      assertionTimeout: 5000,
      browserTimeout: 15000,
      navigationTimeout: 30000,
      elementTimeout: 5000,
    },
    parallel: {
      enabled: false,
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: false,
    },
    mocking: {
      enabled: true,
      recordRequests: false,
      mockExternalServices: true,
      mockGitHub: true,
      mockGitLab: true,
      mockTerraformRegistry: true,
      mockDelay: 0,
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 1, // One retry for flaky tests
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT'],
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'warn',
      file: false,
      timestamps: true,
      logBodies: false,
      logLifecycle: false,
      logFixtures: false,
      logDatabase: false,
      pretty: false,
    },
    coverage: {
      enabled: false,
      reporters: ['text'],
      reportsDirectory: './coverage',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results',
      screenshotsOnFailure: true,
      videoOnFailure: false,
      traceOnFailure: false,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 7,
    },
    reporters: {
      reporters: ['verbose'],
      htmlOutputPath: './reports/test-report.html',
      jsonOutputPath: './reports/test-results.json',
      junitOutputPath: './reports/junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: true,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },

  /**
   * CI environment
   * Optimized for CI/CD pipelines
   */
  ci: {
    name: 'ci',
    environment: 'ci',
    timeouts: {
      testTimeout: 60000, // Longer timeout for CI
      hookTimeout: 60000,
      setupTimeout: 120000,
      teardownTimeout: 60000,
      requestTimeout: 30000,
      databaseTimeout: 30000,
      assertionTimeout: 10000,
      browserTimeout: 30000,
      navigationTimeout: 60000,
      elementTimeout: 10000,
    },
    parallel: {
      enabled: true, // Enable parallel for CI
      workers: 4, // Multiple workers
      maxConcurrency: 2,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: true, // Shuffle to detect order dependencies
      failFast: false, // Run all tests to get full picture
    },
    mocking: {
      enabled: true,
      recordRequests: false,
      mockExternalServices: true,
      mockGitHub: true,
      mockGitLab: true,
      mockTerraformRegistry: true,
      mockDelay: 0,
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 2, // More retries for CI flakiness
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT'],
      retryDelay: 2000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'warn', // Minimal logging for CI
      file: true, // Log to file for artifacts
      filePath: './test-results/e2e.log',
      timestamps: true,
      logBodies: false,
      logLifecycle: false,
      logFixtures: false,
      logDatabase: false,
      pretty: false, // JSON format for parsing
    },
    coverage: {
      enabled: true, // Enable coverage in CI
      reporters: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
      failOnThreshold: true, // Fail CI if thresholds not met
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results',
      screenshotsOnFailure: true,
      videoOnFailure: false, // Disable video to save space
      traceOnFailure: true,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 3, // Short retention in CI
    },
    reporters: {
      reporters: ['default', 'json', 'junit', 'github-actions'],
      htmlOutputPath: './reports/test-report.html',
      jsonOutputPath: './reports/test-results.json',
      junitOutputPath: './reports/junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: true, // Enable perf testing in CI
      accessibilityTesting: true, // Enable a11y testing in CI
      contractTesting: true, // Enable contract testing in CI
      snapshotTesting: true,
      testQuarantine: true, // Enable quarantine for known flaky
      parallelCleanup: true, // Parallel cleanup for speed
      dataFactories: true,
    },
  },

  /**
   * Staging environment
   * Tests against staging infrastructure
   */
  staging: {
    name: 'staging',
    environment: 'staging',
    timeouts: {
      testTimeout: 120000, // Much longer for real infrastructure
      hookTimeout: 120000,
      setupTimeout: 180000,
      teardownTimeout: 60000,
      requestTimeout: 60000,
      databaseTimeout: 60000,
      assertionTimeout: 30000,
      browserTimeout: 60000,
      navigationTimeout: 120000,
      elementTimeout: 30000,
    },
    parallel: {
      enabled: false, // Sequential for staging
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: true, // Stop early on failure
    },
    mocking: {
      enabled: false, // Use real services
      recordRequests: true, // Record for debugging
      mockExternalServices: false,
      mockGitHub: false,
      mockGitLab: false,
      mockTerraformRegistry: false,
      mockDelay: 0,
      handlers: [],
      passthroughUrls: ['*'], // All URLs pass through
    },
    retry: {
      retries: 3, // More retries for real infrastructure
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT', '503', '502'],
      retryDelay: 5000, // Longer delay between retries
      backoffMultiplier: 2,
      maxRetryDelay: 60000,
    },
    logging: {
      level: 'info',
      file: true,
      filePath: './test-results/staging-e2e.log',
      timestamps: true,
      logBodies: false,
      logLifecycle: true,
      logFixtures: false,
      logDatabase: false,
      pretty: false,
    },
    coverage: {
      enabled: false, // No coverage for staging
      reporters: ['text'],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/staging',
      screenshotsOnFailure: true,
      videoOnFailure: true, // Full artifacts for staging
      traceOnFailure: true,
      collectHar: true,
      retainOnPass: true, // Keep all artifacts
      maxAgeInDays: 14,
    },
    reporters: {
      reporters: ['verbose', 'html', 'json'],
      htmlOutputPath: './reports/staging-report.html',
      jsonOutputPath: './reports/staging-results.json',
      junitOutputPath: './reports/staging-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: true,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: true, // Visual testing against staging
      performanceTesting: true,
      accessibilityTesting: true,
      contractTesting: false, // Real APIs, no contracts
      snapshotTesting: false, // Staging data is dynamic
      testQuarantine: true,
      parallelCleanup: false,
      dataFactories: false, // Use real data
    },
  },
};

// ============================================================================
// Environment Loading
// ============================================================================

/**
 * Load environment variables from .env files
 */
export function loadEnvFile(envPath: string): void {
  if (!existsSync(envPath)) {
    return;
  }

  try {
    const content = readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) {
        continue;
      }

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // Remove surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      // Handle escaped newlines
      value = value.replace(/\\n/g, '\n');

      // Only set if not already defined
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch (error) {
    // Ignore errors loading env file
  }
}

/**
 * Load all environment files in order of priority
 */
export function loadEnvironmentFiles(): void {
  const cwd = process.cwd();
  const e2eDir = join(cwd, 'e2e');
  const nodeEnv = process.env.NODE_ENV ?? 'test';
  const e2eEnv = process.env.E2E_ENV ?? 'test';

  // Load in order of priority (lowest first, highest overrides)
  const envFiles = [
    join(cwd, '.env'),
    join(cwd, `.env.${nodeEnv}`),
    join(e2eDir, '.env'),
    join(e2eDir, `.env.${e2eEnv}`),
    join(cwd, '.env.local'),
    join(e2eDir, '.env.local'),
  ];

  for (const envFile of envFiles) {
    loadEnvFile(envFile);
  }
}

/**
 * Parse and validate environment variables
 */
export function parseEnvironment(): E2EEnv {
  const result = E2EEnvSchema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    throw SetupError.config(
      'environment',
      `Environment validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join(', ')}`
    );
  }

  return result.data;
}

// ============================================================================
// Environment Configuration Resolver
// ============================================================================

/**
 * Environment configuration options
 */
export interface EnvironmentOptions {
  /** Override environment name */
  environment?: TestEnvironment;
  /** Custom environment variables */
  envOverrides?: Record<string, string>;
  /** Skip loading .env files */
  skipEnvFiles?: boolean;
}

/**
 * Resolve E2E configuration from environment
 */
export function resolveEnvironment(options: EnvironmentOptions = {}): E2EConfig {
  // Apply environment overrides
  if (options.envOverrides) {
    for (const [key, value] of Object.entries(options.envOverrides)) {
      process.env[key] = value;
    }
  }

  // Load environment files
  if (!options.skipEnvFiles) {
    loadEnvironmentFiles();
  }

  // Parse environment variables
  const env = parseEnvironment();

  // Determine environment
  const environment = options.environment ?? env.E2E_ENV ?? 'test';

  // Get base configuration for environment
  const baseConfig = ENVIRONMENT_DEFAULTS[environment];

  // Apply environment variable overrides
  const envConfig = mapEnvToConfig(env);

  // Merge configurations
  const mergedConfig = deepMerge(baseConfig, envConfig);

  // Validate final configuration
  return E2EConfigSchema.parse(mergedConfig);
}

/**
 * Map environment variables to E2E configuration
 */
function mapEnvToConfig(env: E2EEnv): Partial<E2EConfig> {
  const config: Partial<E2EConfig> = {
    environment: env.E2E_ENV,
  };

  // Timeouts
  if (
    env.E2E_TEST_TIMEOUT ||
    env.E2E_HOOK_TIMEOUT ||
    env.E2E_REQUEST_TIMEOUT ||
    env.E2E_DATABASE_TIMEOUT
  ) {
    config.timeouts = {
      testTimeout: env.E2E_TEST_TIMEOUT,
      hookTimeout: env.E2E_HOOK_TIMEOUT,
      requestTimeout: env.E2E_REQUEST_TIMEOUT,
      databaseTimeout: env.E2E_DATABASE_TIMEOUT,
    } as E2EConfig['timeouts'];
  }

  // Parallel
  if (env.E2E_PARALLEL || env.E2E_WORKERS || env.E2E_FAIL_FAST) {
    config.parallel = {
      enabled: env.E2E_PARALLEL,
      workers: env.E2E_WORKERS,
      failFast: env.E2E_FAIL_FAST,
    } as E2EConfig['parallel'];

    if (env.E2E_SHARD_CURRENT && env.E2E_SHARD_TOTAL) {
      config.parallel.shard = {
        enabled: true,
        current: env.E2E_SHARD_CURRENT,
        total: env.E2E_SHARD_TOTAL,
      };
    }
  }

  // Database
  if (env.TEST_DATABASE_URL || env.E2E_DB_HOST) {
    config.database = {
      connectionString: env.TEST_DATABASE_URL,
      host: env.E2E_DB_HOST,
      port: env.E2E_DB_PORT,
      database: env.E2E_DB_NAME,
      username: env.E2E_DB_USER,
      password: env.E2E_DB_PASSWORD,
      runMigrations: env.E2E_DB_MIGRATIONS,
      cleanBeforeTest: env.E2E_DB_CLEAN,
    } as E2EConfig['database'];
  }

  // Endpoints
  if (env.E2E_API_URL || env.E2E_API_HOST || env.E2E_API_PORT) {
    const baseUrl = env.E2E_API_URL ??
      (env.E2E_API_HOST && env.E2E_API_PORT
        ? `http://${env.E2E_API_HOST}:${env.E2E_API_PORT}`
        : undefined);

    if (baseUrl) {
      config.endpoints = { baseUrl } as E2EConfig['endpoints'];
    }
  }

  // Mocking
  if (env.E2E_MOCKING !== undefined || env.E2E_MOCK_RECORD || env.E2E_MOCK_GITHUB !== undefined) {
    config.mocking = {
      enabled: env.E2E_MOCKING,
      recordRequests: env.E2E_MOCK_RECORD,
      mockGitHub: env.E2E_MOCK_GITHUB,
      mockDelay: env.E2E_MOCK_DELAY,
    } as E2EConfig['mocking'];
  }

  // Retry
  if (env.E2E_RETRIES !== undefined || env.E2E_RETRY_DELAY) {
    config.retry = {
      retries: env.E2E_RETRIES,
      retryDelay: env.E2E_RETRY_DELAY,
    } as E2EConfig['retry'];
  }

  // Logging
  if (env.E2E_LOG_LEVEL || env.E2E_LOG_FILE || env.E2E_LOG_PRETTY) {
    config.logging = {
      level: env.E2E_LOG_LEVEL,
      file: env.E2E_LOG_FILE,
      filePath: env.E2E_LOG_PATH,
      pretty: env.E2E_LOG_PRETTY,
    } as E2EConfig['logging'];
  }

  // Coverage
  if (env.E2E_COVERAGE) {
    config.coverage = {
      enabled: env.E2E_COVERAGE,
      reporters: env.E2E_COVERAGE_REPORTERS?.split(',').map((r) => r.trim()) as any,
    } as E2EConfig['coverage'];
  }

  // Artifacts
  if (env.E2E_ARTIFACTS !== undefined || env.E2E_ARTIFACTS_DIR || env.E2E_SCREENSHOTS) {
    config.artifacts = {
      enabled: env.E2E_ARTIFACTS,
      outputDir: env.E2E_ARTIFACTS_DIR,
      screenshotsOnFailure: env.E2E_SCREENSHOTS,
      videoOnFailure: env.E2E_VIDEO,
    } as E2EConfig['artifacts'];
  }

  // Reporters
  if (env.E2E_REPORTERS) {
    config.reporters = {
      reporters: env.E2E_REPORTERS.split(',').map((r) => r.trim()) as any,
    } as E2EConfig['reporters'];
  }

  // Features
  if (
    env.E2E_EXPERIMENTAL ||
    env.E2E_VISUAL_TESTING ||
    env.E2E_PERF_TESTING ||
    env.E2E_A11Y_TESTING
  ) {
    config.features = {
      experimentalFeatures: env.E2E_EXPERIMENTAL,
      visualTesting: env.E2E_VISUAL_TESTING,
      performanceTesting: env.E2E_PERF_TESTING,
      accessibilityTesting: env.E2E_A11Y_TESTING,
    } as E2EConfig['features'];
  }

  return filterUndefined(config);
}

/**
 * Recursively filter undefined values from object
 */
function filterUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      const filtered = filterUndefined(value as Record<string, unknown>);
      if (Object.keys(filtered).length > 0) {
        result[key] = filtered;
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Deep merge utility
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

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Required environment variables by environment
 */
export const REQUIRED_ENV_VARS: Record<TestEnvironment, string[]> = {
  local: [],
  test: [],
  ci: ['CI'],
  staging: ['E2E_API_URL'],
};

/**
 * Validate required environment variables
 */
export function validateRequiredEnvVars(environment: TestEnvironment): void {
  const required = REQUIRED_ENV_VARS[environment];
  const missing: string[] = [];

  for (const envVar of required) {
    if (!process.env[envVar]) {
      missing.push(envVar);
    }
  }

  if (missing.length > 0) {
    throw SetupError.config(
      'environment',
      `Missing required environment variables for ${environment}: ${missing.join(', ')}`
    );
  }
}

/**
 * Validate database connection is available
 */
export async function validateDatabaseConnection(config: E2EConfig): Promise<void> {
  // Import dynamically to avoid circular dependencies
  const { default: pg } = await import('pg');

  const client = new pg.Client({
    connectionString: config.database.connectionString,
    connectionTimeoutMillis: 5000,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch (error) {
    throw SetupError.database(
      `Failed to connect to test database: ${(error as Error).message}`,
      'connection_check',
      error as Error
    );
  } finally {
    await client.end().catch(() => {});
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get current test environment
 */
export function getCurrentEnvironment(): TestEnvironment {
  return (process.env.E2E_ENV as TestEnvironment) ?? 'test';
}

/**
 * Check if running in CI
 */
export function isCI(): boolean {
  return process.env.CI === 'true' || process.env.CI === '1';
}

/**
 * Check if debug mode is enabled
 */
export function isDebug(): boolean {
  return process.env.E2E_DEBUG === 'true' || process.env.DEBUG === 'true';
}

/**
 * Get environment-specific configuration
 */
export function getEnvironmentConfig(
  environment: TestEnvironment = getCurrentEnvironment()
): Partial<E2EConfig> {
  return ENVIRONMENT_DEFAULTS[environment];
}

// ============================================================================
// Exports
// ============================================================================

export type { E2EEnv, TestEnvironment };
