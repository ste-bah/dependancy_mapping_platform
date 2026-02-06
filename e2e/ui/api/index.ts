/**
 * E2E UI API Index
 * @module e2e/ui/api
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

export {
  testRunsApi,
  listTestRuns,
  getTestRunDetails,
  getTestRunProgress,
  createTestRun,
  cancelTestRun,
  retryTestRun,
  deleteTestRun,
  TestRunsApiError,
} from './test-runs-api';
