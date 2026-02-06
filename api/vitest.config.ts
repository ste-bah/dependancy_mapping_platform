/**
 * Vitest Configuration
 * @module vitest.config
 *
 * Test configuration for the IaC Dependency Detection API.
 * Includes path aliases, coverage thresholds, and test environment setup.
 */

import { resolve } from 'path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment
    globals: true,
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts', 'tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist', '**/*.d.ts'],

    // Setup files
    setupFiles: ['./tests/setup.ts'],

    // Timeout configuration
    testTimeout: 30000,
    hookTimeout: 30000,

    // Reporter configuration
    reporters: ['verbose'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json', 'json-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/index.ts', // Barrel exports
        'src/types/**/*.ts', // Type definitions
        'tests/**/*.ts',
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        // Per-file thresholds for critical modules
        'src/parsers/**/*.ts': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        'src/detectors/**/*.ts': {
          lines: 85,
          functions: 85,
          branches: 80,
          statements: 85,
        },
        'src/services/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
        'src/repositories/**/*.ts': {
          lines: 80,
          functions: 80,
          branches: 75,
          statements: 80,
        },
      },
      all: true,
      clean: true,
      skipFull: false,
    },

    // Pool configuration for parallel execution
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        isolate: true,
      },
    },

    // Sequence configuration
    sequence: {
      shuffle: false,
      concurrent: false,
    },

    // Mock configuration
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,

    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false,
      escapeString: false,
    },

    // Type checking
    typecheck: {
      enabled: false, // Enable when needed for type-level tests
      include: ['**/*.test-d.ts'],
    },

    // Dependency optimization
    deps: {
      optimizer: {
        web: {
          include: [],
        },
        ssr: {
          include: [],
        },
      },
    },
  },

  // Path resolution
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/parsers': resolve(__dirname, './src/parsers'),
      '@/detectors': resolve(__dirname, './src/detectors'),
      '@/services': resolve(__dirname, './src/services'),
      '@/repositories': resolve(__dirname, './src/repositories'),
      '@/routes': resolve(__dirname, './src/routes'),
      '@/config': resolve(__dirname, './src/config'),
      '@/logging': resolve(__dirname, './src/logging'),
      '@/errors': resolve(__dirname, './src/errors'),
      '@/middleware': resolve(__dirname, './src/middleware'),
      '@/adapters': resolve(__dirname, './src/adapters'),
      '@/graph': resolve(__dirname, './src/graph'),
      '@/scoring': resolve(__dirname, './src/scoring'),
      '@/cache': resolve(__dirname, './src/cache'),
      '@/db': resolve(__dirname, './src/db'),
      '@/client': resolve(__dirname, './src/client'),
    },
  },

  // ESBuild configuration for TypeScript
  esbuild: {
    target: 'node20',
  },
});
