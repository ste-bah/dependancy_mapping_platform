/**
 * E2E Test Configuration Presets
 * @module e2e/config/test-presets
 *
 * Pre-configured test presets for different testing scenarios:
 * - Fast: Minimal fixtures for rapid iteration
 * - Full: Complete fixtures for comprehensive testing
 * - CI: Optimized for continuous integration
 * - Debug: Verbose logging for troubleshooting
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #27 of 47 | Phase 4: Implementation
 */

import { z } from 'zod';
import {
  E2EConfigSchema,
  type E2EConfig,
  createE2EConfig,
  mergeE2EConfigs,
  DEFAULT_E2E_CONFIG,
} from './e2e-config.js';
import {
  resolveEnvironment,
  getCurrentEnvironment,
  isCI,
  type TestEnvironment,
} from './environment.js';

// ============================================================================
// Preset Types
// ============================================================================

/**
 * Available preset names
 */
export type PresetName = 'fast' | 'full' | 'ci' | 'debug' | 'smoke' | 'integration' | 'e2e' | 'performance';

/**
 * Preset configuration
 */
export interface TestPreset {
  /** Preset name */
  name: PresetName;
  /** Human-readable description */
  description: string;
  /** Base E2E configuration */
  config: Partial<E2EConfig>;
  /** Tags/categories for this preset */
  tags: string[];
  /** Whether this preset is suitable for CI */
  ciCompatible: boolean;
}

// ============================================================================
// Preset Definitions
// ============================================================================

/**
 * Fast preset - Minimal fixtures for rapid iteration
 *
 * Use this preset during active development for quick feedback.
 * Skips expensive operations and uses minimal data.
 */
export const FAST_PRESET: TestPreset = {
  name: 'fast',
  description: 'Minimal fixtures for rapid iteration during development',
  tags: ['development', 'quick', 'minimal'],
  ciCompatible: false,
  config: {
    name: 'fast',
    timeouts: {
      testTimeout: 10000, // Short timeout
      hookTimeout: 10000,
      setupTimeout: 15000,
      teardownTimeout: 10000,
      requestTimeout: 5000,
      databaseTimeout: 5000,
      assertionTimeout: 2000,
      browserTimeout: 10000,
      navigationTimeout: 15000,
      elementTimeout: 2000,
    },
    parallel: {
      enabled: false,
      workers: 1,
      maxConcurrency: 1,
      isolation: 'thread', // Lighter isolation
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: true, // Stop on first failure
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
      poolMax: 2, // Minimal pool
      runMigrations: false, // Skip migrations
      cleanBeforeTest: false, // Skip cleanup
      useTransactions: true, // Use transactions for speed
      resetSequences: false,
      truncateOrder: [],
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
      retries: 0, // No retries
      retryOnErrors: [],
      retryDelay: 0,
      backoffMultiplier: 1,
      maxRetryDelay: 0,
    },
    logging: {
      level: 'error', // Minimal logging
      file: false,
      timestamps: false,
      logBodies: false,
      logLifecycle: false,
      logFixtures: false,
      logDatabase: false,
      pretty: false,
    },
    coverage: {
      enabled: false,
      reporters: [],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: false, // No artifacts
      outputDir: './test-results',
      screenshotsOnFailure: false,
      videoOnFailure: false,
      traceOnFailure: false,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 1,
    },
    reporters: {
      reporters: ['basic'], // Minimal reporter
      htmlOutputPath: './reports/test-report.html',
      jsonOutputPath: './reports/test-results.json',
      junitOutputPath: './reports/junit.xml',
      includeStackTraces: false,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: false,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

/**
 * Full preset - All fixtures for comprehensive testing
 *
 * Use this preset for thorough testing before releases.
 * Includes all fixtures, full database setup, and comprehensive coverage.
 */
export const FULL_PRESET: TestPreset = {
  name: 'full',
  description: 'Complete fixtures for comprehensive testing before releases',
  tags: ['release', 'comprehensive', 'full'],
  ciCompatible: true,
  config: {
    name: 'full',
    timeouts: {
      testTimeout: 60000, // Long timeout
      hookTimeout: 60000,
      setupTimeout: 120000,
      teardownTimeout: 60000,
      requestTimeout: 30000,
      databaseTimeout: 30000,
      assertionTimeout: 15000,
      browserTimeout: 30000,
      navigationTimeout: 60000,
      elementTimeout: 15000,
    },
    parallel: {
      enabled: false, // Sequential for reliability
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: false, // Run all tests
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 2,
      poolMax: 10, // Full pool
      runMigrations: true, // Run migrations
      cleanBeforeTest: true, // Clean before each test
      useTransactions: false, // Real commits
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
      mockDelay: 50, // Simulate network latency
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 2, // Retry flaky tests
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT'],
      retryDelay: 2000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'info',
      file: true,
      filePath: './test-results/full-e2e.log',
      timestamps: true,
      logBodies: true,
      logLifecycle: true,
      logFixtures: true,
      logDatabase: true,
      pretty: false,
    },
    coverage: {
      enabled: true,
      reporters: ['text', 'html', 'lcov', 'json'],
      reportsDirectory: './coverage',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
      failOnThreshold: true,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results',
      screenshotsOnFailure: true,
      videoOnFailure: true,
      traceOnFailure: true,
      collectHar: true,
      retainOnPass: true, // Keep all artifacts
      maxAgeInDays: 14,
    },
    reporters: {
      reporters: ['verbose', 'html', 'json', 'junit'],
      htmlOutputPath: './reports/full-test-report.html',
      jsonOutputPath: './reports/full-test-results.json',
      junitOutputPath: './reports/full-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: true,
    },
    features: {
      experimentalFeatures: true,
      visualTesting: true,
      performanceTesting: true,
      accessibilityTesting: true,
      contractTesting: true,
      snapshotTesting: true,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

/**
 * CI preset - Optimized for continuous integration
 *
 * Use this preset in CI/CD pipelines.
 * Parallel execution, coverage, and machine-readable reports.
 */
export const CI_PRESET: TestPreset = {
  name: 'ci',
  description: 'Optimized configuration for CI/CD pipelines',
  tags: ['ci', 'cd', 'pipeline', 'automation'],
  ciCompatible: true,
  config: {
    name: 'ci',
    environment: 'ci',
    timeouts: {
      testTimeout: 60000,
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
      enabled: true, // Parallel for speed
      workers: 4,
      maxConcurrency: 2,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: true, // Detect order dependencies
      failFast: false,
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 2,
      poolMax: 8,
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
      retries: 2,
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT'],
      retryDelay: 2000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'warn',
      file: true,
      filePath: './test-results/ci-e2e.log',
      timestamps: true,
      logBodies: false,
      logLifecycle: false,
      logFixtures: false,
      logDatabase: false,
      pretty: false, // JSON for parsing
    },
    coverage: {
      enabled: true,
      reporters: ['text', 'lcov', 'json'],
      reportsDirectory: './coverage',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 60, functions: 60, branches: 60, statements: 60 },
      failOnThreshold: true, // Fail if below threshold
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results',
      screenshotsOnFailure: true,
      videoOnFailure: false, // Save space
      traceOnFailure: true,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 3,
    },
    reporters: {
      reporters: ['default', 'json', 'junit', 'github-actions'],
      htmlOutputPath: './reports/ci-test-report.html',
      jsonOutputPath: './reports/ci-test-results.json',
      junitOutputPath: './reports/ci-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: true,
      accessibilityTesting: true,
      contractTesting: true,
      snapshotTesting: true,
      testQuarantine: true, // Skip known flaky
      parallelCleanup: true,
      dataFactories: true,
    },
  },
};

/**
 * Debug preset - Verbose logging for troubleshooting
 *
 * Use this preset when debugging test failures.
 * Maximum verbosity, all artifacts, and detailed logging.
 */
export const DEBUG_PRESET: TestPreset = {
  name: 'debug',
  description: 'Verbose logging and artifacts for troubleshooting test failures',
  tags: ['debug', 'troubleshoot', 'verbose'],
  ciCompatible: false,
  config: {
    name: 'debug',
    timeouts: {
      testTimeout: 120000, // Extra long for debugging
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
      enabled: false, // Sequential for clarity
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: true, // Stop on first to investigate
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
      useTransactions: false, // See actual data
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
      recordRequests: true, // Record everything
      mockExternalServices: true,
      mockGitHub: true,
      mockGitLab: true,
      mockTerraformRegistry: true,
      mockDelay: 100, // Slow down to observe
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 0, // No retries - see failures
      retryOnErrors: [],
      retryDelay: 0,
      backoffMultiplier: 1,
      maxRetryDelay: 0,
    },
    logging: {
      level: 'debug', // Maximum verbosity
      file: true,
      filePath: './test-results/debug-e2e.log',
      timestamps: true,
      logBodies: true, // All request/response bodies
      logLifecycle: true, // All lifecycle events
      logFixtures: true,
      logDatabase: true, // All DB queries
      pretty: true, // Pretty print for readability
    },
    coverage: {
      enabled: false, // Skip coverage
      reporters: [],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/debug',
      screenshotsOnFailure: true,
      videoOnFailure: true, // Full video
      traceOnFailure: true,
      collectHar: true, // Network HAR
      retainOnPass: true, // Keep everything
      maxAgeInDays: 30,
    },
    reporters: {
      reporters: ['verbose'],
      htmlOutputPath: './reports/debug-test-report.html',
      jsonOutputPath: './reports/debug-test-results.json',
      junitOutputPath: './reports/debug-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: true, // All console output
    },
    features: {
      experimentalFeatures: true,
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: true,
      testQuarantine: false, // Run everything
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

/**
 * Smoke preset - Quick sanity check
 *
 * Use this preset for quick smoke tests.
 * Tests critical paths only with minimal setup.
 */
export const SMOKE_PRESET: TestPreset = {
  name: 'smoke',
  description: 'Quick sanity check of critical paths',
  tags: ['smoke', 'quick', 'critical'],
  ciCompatible: true,
  config: {
    name: 'smoke',
    timeouts: {
      testTimeout: 15000,
      hookTimeout: 15000,
      setupTimeout: 30000,
      teardownTimeout: 15000,
      requestTimeout: 10000,
      databaseTimeout: 10000,
      assertionTimeout: 5000,
      browserTimeout: 15000,
      navigationTimeout: 20000,
      elementTimeout: 5000,
    },
    parallel: {
      enabled: false,
      workers: 1,
      maxConcurrency: 1,
      isolation: 'thread',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: true, // Stop on first failure
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
      poolMax: 3,
      runMigrations: false,
      cleanBeforeTest: false,
      useTransactions: true,
      resetSequences: false,
      truncateOrder: [],
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
      retries: 1,
      retryOnErrors: ['TimeoutError', 'NetworkError'],
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 5000,
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
      reporters: [],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/smoke',
      screenshotsOnFailure: true,
      videoOnFailure: false,
      traceOnFailure: false,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 1,
    },
    reporters: {
      reporters: ['basic'],
      htmlOutputPath: './reports/smoke-test-report.html',
      jsonOutputPath: './reports/smoke-test-results.json',
      junitOutputPath: './reports/smoke-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: false,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

/**
 * Integration preset - API integration tests
 *
 * Use this preset for API integration tests.
 * Focuses on API interactions without UI testing.
 */
export const INTEGRATION_PRESET: TestPreset = {
  name: 'integration',
  description: 'API integration tests without UI testing',
  tags: ['integration', 'api', 'backend'],
  ciCompatible: true,
  config: {
    name: 'integration',
    timeouts: {
      testTimeout: 30000,
      hookTimeout: 30000,
      setupTimeout: 60000,
      teardownTimeout: 30000,
      requestTimeout: 15000,
      databaseTimeout: 15000,
      assertionTimeout: 5000,
      browserTimeout: 0, // No browser tests
      navigationTimeout: 0,
      elementTimeout: 0,
    },
    parallel: {
      enabled: true,
      workers: 4,
      maxConcurrency: 4,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: true,
      failFast: false,
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 2,
      poolMax: 10,
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
      retries: 1,
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED'],
      retryDelay: 1000,
      backoffMultiplier: 2,
      maxRetryDelay: 10000,
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
      enabled: true,
      reporters: ['text', 'lcov'],
      reportsDirectory: './coverage/integration',
      include: ['../api/src/**/*.ts'],
      exclude: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.spec.ts'],
      thresholds: { lines: 70, functions: 70, branches: 60, statements: 70 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/integration',
      screenshotsOnFailure: false,
      videoOnFailure: false,
      traceOnFailure: false,
      collectHar: false,
      retainOnPass: false,
      maxAgeInDays: 7,
    },
    reporters: {
      reporters: ['verbose', 'json'],
      htmlOutputPath: './reports/integration-test-report.html',
      jsonOutputPath: './reports/integration-test-results.json',
      junitOutputPath: './reports/integration-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: false,
      accessibilityTesting: false,
      contractTesting: true, // API contracts
      snapshotTesting: true,
      testQuarantine: true,
      parallelCleanup: true,
      dataFactories: true,
    },
  },
};

/**
 * E2E preset - Full end-to-end tests
 *
 * Use this preset for full end-to-end tests including UI.
 * Tests complete user flows.
 */
export const E2E_PRESET: TestPreset = {
  name: 'e2e',
  description: 'Full end-to-end tests including UI flows',
  tags: ['e2e', 'ui', 'user-flow'],
  ciCompatible: true,
  config: {
    name: 'e2e',
    timeouts: {
      testTimeout: 60000,
      hookTimeout: 60000,
      setupTimeout: 120000,
      teardownTimeout: 60000,
      requestTimeout: 30000,
      databaseTimeout: 30000,
      assertionTimeout: 15000,
      browserTimeout: 30000,
      navigationTimeout: 60000,
      elementTimeout: 15000,
    },
    parallel: {
      enabled: true,
      workers: 2,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: false,
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 2,
      poolMax: 8,
      runMigrations: true,
      cleanBeforeTest: true,
      useTransactions: false,
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
      recordRequests: true,
      mockExternalServices: true,
      mockGitHub: true,
      mockGitLab: true,
      mockTerraformRegistry: true,
      mockDelay: 50,
      handlers: [],
      passthroughUrls: [],
    },
    retry: {
      retries: 2,
      retryOnErrors: ['TimeoutError', 'NetworkError', 'ECONNREFUSED', 'ETIMEDOUT'],
      retryDelay: 2000,
      backoffMultiplier: 2,
      maxRetryDelay: 30000,
    },
    logging: {
      level: 'info',
      file: true,
      filePath: './test-results/e2e.log',
      timestamps: true,
      logBodies: false,
      logLifecycle: true,
      logFixtures: false,
      logDatabase: false,
      pretty: false,
    },
    coverage: {
      enabled: false, // E2E coverage is complex
      reporters: [],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/e2e',
      screenshotsOnFailure: true,
      videoOnFailure: true,
      traceOnFailure: true,
      collectHar: true,
      retainOnPass: false,
      maxAgeInDays: 7,
    },
    reporters: {
      reporters: ['verbose', 'html', 'json'],
      htmlOutputPath: './reports/e2e-test-report.html',
      jsonOutputPath: './reports/e2e-test-results.json',
      junitOutputPath: './reports/e2e-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: true,
      performanceTesting: false,
      accessibilityTesting: true,
      contractTesting: false,
      snapshotTesting: true,
      testQuarantine: true,
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

/**
 * Performance preset - Performance testing configuration
 *
 * Use this preset for performance testing.
 * Includes timing measurements and load testing configuration.
 */
export const PERFORMANCE_PRESET: TestPreset = {
  name: 'performance',
  description: 'Performance testing with timing measurements',
  tags: ['performance', 'load', 'timing'],
  ciCompatible: true,
  config: {
    name: 'performance',
    timeouts: {
      testTimeout: 300000, // 5 minutes for load tests
      hookTimeout: 120000,
      setupTimeout: 180000,
      teardownTimeout: 120000,
      requestTimeout: 60000,
      databaseTimeout: 60000,
      assertionTimeout: 30000,
      browserTimeout: 60000,
      navigationTimeout: 120000,
      elementTimeout: 30000,
    },
    parallel: {
      enabled: false, // Sequential for accurate measurements
      workers: 1,
      maxConcurrency: 1,
      isolation: 'process',
      shard: { enabled: false, current: 1, total: 1 },
      shuffle: false,
      failFast: false,
    },
    database: {
      connectionString: 'postgresql://test:test@localhost:5433/test_db',
      host: 'localhost',
      port: 5433,
      database: 'test_db',
      username: 'test',
      password: 'test',
      ssl: false,
      poolMin: 5,
      poolMax: 20, // Large pool for load testing
      runMigrations: true,
      cleanBeforeTest: true,
      useTransactions: false,
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
      enabled: false, // Use real services for accurate timing
      recordRequests: true,
      mockExternalServices: false,
      mockGitHub: false,
      mockGitLab: false,
      mockTerraformRegistry: false,
      mockDelay: 0,
      handlers: [],
      passthroughUrls: ['*'],
    },
    retry: {
      retries: 0, // No retries - measure actual performance
      retryOnErrors: [],
      retryDelay: 0,
      backoffMultiplier: 1,
      maxRetryDelay: 0,
    },
    logging: {
      level: 'info',
      file: true,
      filePath: './test-results/performance.log',
      timestamps: true,
      logBodies: false,
      logLifecycle: true,
      logFixtures: false,
      logDatabase: true, // Log DB timings
      pretty: false,
    },
    coverage: {
      enabled: false,
      reporters: [],
      reportsDirectory: './coverage',
      include: [],
      exclude: [],
      thresholds: { lines: 0, functions: 0, branches: 0, statements: 0 },
      failOnThreshold: false,
    },
    artifacts: {
      enabled: true,
      outputDir: './test-results/performance',
      screenshotsOnFailure: false,
      videoOnFailure: false,
      traceOnFailure: true, // Trace for timing analysis
      collectHar: true, // HAR for network timing
      retainOnPass: true, // Keep all for analysis
      maxAgeInDays: 30,
    },
    reporters: {
      reporters: ['verbose', 'json'],
      htmlOutputPath: './reports/performance-test-report.html',
      jsonOutputPath: './reports/performance-test-results.json',
      junitOutputPath: './reports/performance-junit.xml',
      includeStackTraces: true,
      includeConsoleOutput: false,
    },
    features: {
      experimentalFeatures: false,
      visualTesting: false,
      performanceTesting: true,
      accessibilityTesting: false,
      contractTesting: false,
      snapshotTesting: false,
      testQuarantine: false,
      parallelCleanup: false,
      dataFactories: true,
    },
  },
};

// ============================================================================
// Preset Registry
// ============================================================================

/**
 * All available presets
 */
export const PRESETS: Record<PresetName, TestPreset> = {
  fast: FAST_PRESET,
  full: FULL_PRESET,
  ci: CI_PRESET,
  debug: DEBUG_PRESET,
  smoke: SMOKE_PRESET,
  integration: INTEGRATION_PRESET,
  e2e: E2E_PRESET,
  performance: PERFORMANCE_PRESET,
};

// ============================================================================
// Preset Functions
// ============================================================================

/**
 * Get a preset by name
 */
export function getPreset(name: PresetName): TestPreset {
  const preset = PRESETS[name];
  if (!preset) {
    throw new Error(`Unknown preset: ${name}. Available: ${Object.keys(PRESETS).join(', ')}`);
  }
  return preset;
}

/**
 * Get all available presets
 */
export function getAllPresets(): TestPreset[] {
  return Object.values(PRESETS);
}

/**
 * Get presets suitable for CI
 */
export function getCICompatiblePresets(): TestPreset[] {
  return getAllPresets().filter((preset) => preset.ciCompatible);
}

/**
 * Get presets by tag
 */
export function getPresetsByTag(tag: string): TestPreset[] {
  return getAllPresets().filter((preset) => preset.tags.includes(tag));
}

/**
 * Load a preset configuration
 */
export function loadPreset(name: PresetName): E2EConfig {
  const preset = getPreset(name);
  return createE2EConfig(preset.config);
}

/**
 * Load a preset with environment overrides
 */
export function loadPresetWithEnvironment(
  name: PresetName,
  environment?: TestEnvironment
): E2EConfig {
  const preset = getPreset(name);
  const envConfig = resolveEnvironment({ environment });
  return mergeE2EConfigs(preset.config, envConfig);
}

/**
 * Create a custom preset by extending an existing one
 */
export function extendPreset(
  baseName: PresetName,
  overrides: Partial<E2EConfig>,
  customName?: string
): E2EConfig {
  const basePreset = getPreset(baseName);
  const config = mergeE2EConfigs(basePreset.config, overrides);
  if (customName) {
    config.name = customName;
  }
  return config;
}

/**
 * Get the recommended preset for the current environment
 */
export function getRecommendedPreset(): PresetName {
  if (isCI()) {
    return 'ci';
  }
  const env = getCurrentEnvironment();
  switch (env) {
    case 'ci':
      return 'ci';
    case 'staging':
      return 'full';
    case 'local':
      return 'fast';
    default:
      return 'fast';
  }
}

/**
 * Auto-select preset based on environment
 */
export function autoSelectPreset(): E2EConfig {
  const presetName = getRecommendedPreset();
  return loadPresetWithEnvironment(presetName);
}

// ============================================================================
// Exports
// ============================================================================

export type { PresetName, TestPreset };
