/**
 * Playwright Global Setup
 * @module e2e/support/playwright-global-setup
 *
 * Global setup for Playwright browser tests.
 * Ensures the test environment is ready for UI testing.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import { chromium, FullConfig } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Global setup function for Playwright
 */
async function globalSetup(config: FullConfig): Promise<void> {
  console.log('[Playwright] Starting global setup...');

  const startTime = Date.now();

  // Create necessary directories
  await ensureDirectories();

  // Verify the application is accessible (if running local server)
  const baseURL = config.projects[0]?.use?.baseURL || 'http://localhost:3000';

  if (!process.env.CI) {
    // Wait for the server to be ready
    await waitForServer(baseURL, 30000);
  }

  // Create test state storage directory
  const storageDir = join(process.cwd(), 'e2e', '.auth');
  await mkdir(storageDir, { recursive: true });

  // Record setup info
  const setupInfo = {
    startedAt: new Date().toISOString(),
    baseURL,
    projectCount: config.projects.length,
    browsers: config.projects.map(p => p.name),
  };

  await writeFile(
    join(process.cwd(), 'e2e', '.playwright-setup.json'),
    JSON.stringify(setupInfo, null, 2)
  );

  const duration = Date.now() - startTime;
  console.log(`[Playwright] Global setup complete in ${duration}ms`);
}

/**
 * Ensure required directories exist
 */
async function ensureDirectories(): Promise<void> {
  const dirs = [
    'e2e/reports/playwright',
    'e2e/test-results',
    'e2e/.auth',
  ];

  for (const dir of dirs) {
    try {
      await mkdir(join(process.cwd(), dir), { recursive: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
        console.warn(`[Playwright] Warning: Could not create directory ${dir}`);
      }
    }
  }
}

/**
 * Wait for the server to be ready
 */
async function waitForServer(url: string, timeout: number): Promise<void> {
  const startTime = Date.now();
  const healthUrl = `${url}/health`;

  console.log(`[Playwright] Waiting for server at ${healthUrl}...`);

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(healthUrl);
      if (response.ok) {
        console.log('[Playwright] Server is ready');
        return;
      }
    } catch {
      // Server not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.warn('[Playwright] Warning: Server not responding, tests may fail');
}

export default globalSetup;
