/**
 * Playwright Global Teardown
 * @module e2e/support/playwright-global-teardown
 *
 * Global teardown for Playwright browser tests.
 * Cleans up resources after all tests complete.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { FullConfig } from '@playwright/test';
import { rm, readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Global teardown function for Playwright
 */
async function globalTeardown(config: FullConfig): Promise<void> {
  console.log('[Playwright] Starting global teardown...');

  const startTime = Date.now();

  // Read setup info for logging
  try {
    const setupInfoPath = join(process.cwd(), 'e2e', '.playwright-setup.json');
    const setupInfo = JSON.parse(await readFile(setupInfoPath, 'utf-8'));
    const testDuration = Date.now() - new Date(setupInfo.startedAt).getTime();
    console.log(`[Playwright] Total test run duration: ${testDuration}ms`);
  } catch {
    // Setup info may not exist
  }

  // Cleanup temporary files
  await cleanupTempFiles();

  const duration = Date.now() - startTime;
  console.log(`[Playwright] Global teardown complete in ${duration}ms`);
}

/**
 * Clean up temporary files created during tests
 */
async function cleanupTempFiles(): Promise<void> {
  const filesToClean = [
    'e2e/.playwright-setup.json',
  ];

  for (const file of filesToClean) {
    try {
      await rm(join(process.cwd(), file));
    } catch {
      // File may not exist
    }
  }

  // Clean up auth state if not in CI (preserve for debugging)
  if (!process.env.CI) {
    try {
      await rm(join(process.cwd(), 'e2e', '.auth'), { recursive: true });
    } catch {
      // Directory may not exist
    }
  }
}

export default globalTeardown;
