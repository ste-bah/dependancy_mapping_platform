/**
 * Playwright Configuration for E2E Browser Tests
 * @module e2e/playwright.config
 *
 * Configuration for running E2E browser tests with Playwright.
 * Used for testing the UI graph visualization and user interactions.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { defineConfig, devices } from '@playwright/test';

/**
 * Read environment variables
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const CI = process.env.CI === 'true';

export default defineConfig({
  // Test directory
  testDir: './tests/ui',

  // Test file patterns
  testMatch: '**/*.pw.ts',

  // Fail the build on test.only in CI
  forbidOnly: CI,

  // Retry on CI only
  retries: CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: CI ? 1 : undefined,

  // Reporter configuration
  reporter: CI
    ? [['github'], ['html', { outputFolder: './reports/playwright' }]]
    : [['list'], ['html', { outputFolder: './reports/playwright' }]],

  // Shared settings for all projects
  use: {
    // Base URL for all tests
    baseURL: BASE_URL,

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video recording
    video: CI ? 'on-first-retry' : 'off',

    // Viewport size
    viewport: { width: 1280, height: 720 },

    // Timeout for actions
    actionTimeout: 10000,

    // Navigation timeout
    navigationTimeout: 30000,

    // Ignore HTTPS errors
    ignoreHTTPSErrors: true,

    // Additional HTTP headers
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Test against mobile viewports
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },

    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // Global timeout
  timeout: 60000,

  // Expect timeout
  expect: {
    timeout: 10000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
  },

  // Output folder for test artifacts
  outputDir: './test-results',

  // Preserve output on failure
  preserveOutput: 'failures-only',

  // Web server configuration (start dev server before tests)
  webServer: CI
    ? undefined // In CI, server should already be running
    : {
        command: 'npm run dev',
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 120000,
        stdout: 'ignore',
        stderr: 'pipe',
      },

  // Global setup/teardown
  globalSetup: './support/playwright-global-setup.ts',
  globalTeardown: './support/playwright-global-teardown.ts',
});
