/**
 * Vitest Configuration for E2E Tests
 * @module e2e/vitest.config
 *
 * Configuration for running E2E/integration tests with Vitest.
 * Uses Fastify inject for API testing without running a real server.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Test file patterns
    include: ['tests/**/*.spec.ts', 'tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Use Node environment for API testing
    environment: 'node',

    // Global test setup
    globals: true,

    // Timeout for E2E tests (longer than unit tests)
    testTimeout: 30000,
    hookTimeout: 30000,

    // Retry failed tests once
    retry: 1,

    // Run tests sequentially (E2E tests may have dependencies)
    sequence: {
      shuffle: false,
    },

    // Concurrent test execution within files
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // Single process for E2E tests
      },
    },

    // Coverage configuration
    coverage: {
      enabled: false, // Enable with --coverage flag
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        '../api/src/**/*.ts',
      ],
      exclude: [
        '**/node_modules/**',
        '**/*.d.ts',
        '**/__tests__/**',
        '**/tests/**',
        '**/*.test.ts',
        '**/*.spec.ts',
      ],
      thresholds: {
        lines: 60,
        branches: 60,
        functions: 60,
        statements: 60,
      },
    },

    // Reporter configuration
    reporters: ['verbose', 'html'],
    outputFile: {
      html: './reports/test-report.html',
    },

    // TypeScript transformation
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.json',
    },

    // Watch mode configuration
    watch: false,
    watchExclude: ['**/node_modules/**', '**/dist/**', '**/coverage/**'],

    // Isolate tests
    isolate: true,

    // Setup files (run before each test file)
    setupFiles: ['./support/setup.ts'],

    // Global setup (run once before all tests)
    globalSetup: './support/global-setup.ts',
  },

  // Path aliases
  resolve: {
    alias: {
      '@support': resolve(__dirname, './support'),
      '@fixtures': resolve(__dirname, './fixtures'),
      '@api': resolve(__dirname, '../api/src'),
    },
  },

  // esbuild configuration for TypeScript
  esbuild: {
    target: 'node18',
  },

  // Define environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify('test'),
    'process.env.LOG_LEVEL': JSON.stringify('silent'),
  },
});
