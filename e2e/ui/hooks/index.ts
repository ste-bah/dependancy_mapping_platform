/**
 * E2E UI Hooks Index
 * @module e2e/ui/hooks
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

export {
  // Query keys
  testRunsQueryKeys,
  // List hooks
  useTestRuns,
  type UseTestRunsParams,
  // Detail hooks
  useTestRunDetails,
  type UseTestRunDetailsParams,
  // Progress hook
  useTestRunProgress,
  type UseTestRunProgressParams,
  // Mutation hooks
  useCreateTestRun,
  useCancelTestRun,
  useRetryTestRun,
  useDeleteTestRun,
  // Prefetch functions
  prefetchTestRuns,
  prefetchTestRunDetails,
} from './use-test-runs';
