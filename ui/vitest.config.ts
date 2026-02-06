/**
 * Vitest Configuration
 * Test runner configuration for UI tests
 */

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    // Environment
    environment: 'jsdom',

    // Setup files
    setupFiles: ['./src/__tests__/setup.ts'],

    // Globals for testing-library
    globals: true,

    // Include patterns
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{ts,tsx}',
    ],

    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.git',
      '.cache',
      // Exclude test helper/utility files
      'src/**/__tests__/**/test-helpers.{ts,tsx}',
      'src/**/__tests__/**/testUtils.{ts,tsx}',
      'src/**/__tests__/**/helpers.{ts,tsx}',
      'src/**/__tests__/**/mocks.{ts,tsx}',
      'src/**/__tests__/**/fixtures.{ts,tsx}',
      'src/**/__tests__/**/setup.{ts,tsx}',
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/core/**/*.{ts,tsx}',
        'src/shared/**/*.{ts,tsx}',
        'src/features/**/*.{ts,tsx}',
        'src/pages/**/*.{ts,tsx}',
      ],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/__tests__/**',
        'src/**/*.d.ts',
        'src/types/**',
        'src/**/*.stories.tsx',
      ],
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
    },

    // Reporter
    reporters: ['verbose'],

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Threading - use separate processes for better isolation
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: false,
        isolate: true,
      },
    },

    // Ensure mocks are properly reset
    sequence: {
      shuffle: false,
    },

    // Type checking
    typecheck: {
      enabled: false,
    },

    // Mock configuration
    mockReset: true,
    restoreMocks: true,
    clearMocks: true,
  },

  // Path aliases matching tsconfig
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@/types': resolve(__dirname, './src/types'),
      '@/core': resolve(__dirname, './src/core'),
      '@/shared': resolve(__dirname, './src/shared'),
      '@/__tests__': resolve(__dirname, './src/__tests__'),
    },
  },
});
