/**
 * Mock Utilities Index
 * @module tests/mocks
 *
 * Centralized exports for all mock utilities used in testing
 * the IaC Dependency Detection system.
 *
 * TASK-DETECT-001 through TASK-DETECT-010 implementation
 * Agent #33 of 47 | Phase 5: Testing
 */

// Database mocks
export {
  // Types
  type MockPoolClient,
  type MockPool,
  type MockTransaction,
  type MockRepository,
  type MockRedisClient,
  // Factory functions
  createMockPoolClient,
  createMockPool,
  createMockTransaction,
  createMockRepository,
  createMockRedisClient,
  // Default instances
  mockPool,
  mockTransaction,
  mockRedis,
} from './database.mock';

// Service mocks
export {
  // Types
  type MockParserOrchestrator,
  type MockDetectionOrchestrator,
  type MockScoringService,
  type MockGraphService,
  type MockScanService,
  type MockFileService,
  type MockLogger,
  // Factory functions
  createMockParserOrchestrator,
  createMockDetectionOrchestrator,
  createMockScoringService,
  createMockGraphService,
  createMockScanService,
  createMockFileService,
  createMockLogger,
  // Default instances
  mockParserOrchestrator,
  mockDetectionOrchestrator,
  mockScoringService,
  mockGraphService,
  mockScanService,
  mockFileService,
  mockLogger,
} from './services.mock';

/**
 * Reset all mock instances to their initial state.
 * Call this in beforeEach() to ensure test isolation.
 * 
 * @example
 * ```typescript
 * import { resetAllMocks } from '../mocks';
 * 
 * beforeEach(() => {
 *   resetAllMocks();
 * });
 * ```
 */
export async function resetAllMocks(): Promise<void> {
  const { vi } = await import('vitest');
  vi.clearAllMocks();
}

/**
 * Configure common mock behaviors for integration testing.
 * Sets up realistic responses for a typical scan workflow.
 * 
 * @example
 * ```typescript
 * import { setupIntegrationMocks } from '../mocks';
 * 
 * beforeAll(() => {
 *   setupIntegrationMocks();
 * });
 * ```
 */
export function setupIntegrationMocks(): void {
  // Reset all mocks to ensure clean state
  mockParserOrchestrator.parseFiles.mockClear();
  mockDetectionOrchestrator.detect.mockClear();
  mockScoringService.scoreEdges.mockClear();
  mockGraphService.buildGraph.mockClear();
  mockScanService.createScan.mockClear();
}
