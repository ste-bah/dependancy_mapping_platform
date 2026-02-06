/**
 * Vitest Setup File
 * @module e2e/support/setup
 *
 * Setup file that runs before each test file.
 * Configures the test environment and global utilities.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Environment Configuration
// ============================================================================

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Disable color output in CI
if (process.env.CI) {
  process.env.NO_COLOR = '1';
}

// ============================================================================
// Global Mocks
// ============================================================================

// Mock console methods to reduce noise (can be re-enabled per test)
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
  info: console.info,
};

beforeAll(() => {
  // Suppress console output during tests unless verbose mode
  if (!process.env.VERBOSE) {
    console.log = vi.fn();
    console.debug = vi.fn();
    console.info = vi.fn();
    // Keep warn and error for important messages
  }
});

afterAll(() => {
  // Restore console
  console.log = originalConsole.log;
  console.warn = originalConsole.warn;
  console.error = originalConsole.error;
  console.debug = originalConsole.debug;
  console.info = originalConsole.info;
});

// ============================================================================
// Test Lifecycle Hooks
// ============================================================================

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Clear any timers
  vi.clearAllTimers();
});

// ============================================================================
// Global Test Utilities
// ============================================================================

/**
 * Wait for a specified duration
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  options: { timeout?: number; interval?: number } = {}
): Promise<void> {
  const { timeout = 5000, interval = 100 } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return;
    }
    await wait(interval);
  }

  throw new Error(`waitFor timeout after ${timeout}ms`);
}

/**
 * Create a deferred promise
 */
export function createDeferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void;
  let reject: (reason: unknown) => void;

  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve: resolve!, reject: reject! };
}

// ============================================================================
// Error Handling
// ============================================================================

// Handle unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
});

// ============================================================================
// Exports
// ============================================================================

export { originalConsole };
