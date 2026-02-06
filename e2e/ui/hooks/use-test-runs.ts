/**
 * Test Runs Hooks
 * React Query hooks for E2E test run management
 * @module e2e/ui/hooks/use-test-runs
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TestRunId } from '../../types/test-types';
import type {
  TestRunSummary,
  TestRunFilters,
  PaginatedResponse,
  UseTestRunsReturn,
  UseTestRunDetailsReturn,
  UseCreateTestRunReturn,
  UseCancelTestRunReturn,
  CreateTestRunRequest,
} from '../types';
import { testRunsApi } from '../api/test-runs-api';

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for test runs
 */
export const testRunsQueryKeys = {
  all: ['testRuns'] as const,
  lists: () => [...testRunsQueryKeys.all, 'list'] as const,
  list: (filters?: TestRunFilters, page?: number, pageSize?: number) =>
    [...testRunsQueryKeys.lists(), { filters, page, pageSize }] as const,
  details: () => [...testRunsQueryKeys.all, 'detail'] as const,
  detail: (id: TestRunId) => [...testRunsQueryKeys.details(), id] as const,
  progress: (id: TestRunId) => [...testRunsQueryKeys.all, 'progress', id] as const,
} as const;

// ============================================================================
// List Hooks
// ============================================================================

/**
 * Hook parameters for test runs list
 */
export interface UseTestRunsParams {
  readonly filters?: TestRunFilters;
  readonly page?: number;
  readonly pageSize?: number;
  readonly enabled?: boolean;
}

/**
 * Hook to fetch paginated list of test runs
 *
 * @example
 * const { runs, isLoading, pagination } = useTestRuns({
 *   filters: { status: ['running', 'failed'] },
 *   page: 1,
 *   pageSize: 20,
 * });
 */
export function useTestRuns(params: UseTestRunsParams = {}): UseTestRunsReturn {
  const {
    filters,
    page = 1,
    pageSize = 20,
    enabled = true,
  } = params;

  const query = useQuery<PaginatedResponse<TestRunSummary>, Error>({
    queryKey: testRunsQueryKeys.list(filters, page, pageSize),
    queryFn: () => testRunsApi.listTestRuns({
      ...filters,
      page,
      pageSize,
    }),
    enabled,
    staleTime: 30_000, // 30 seconds
    refetchInterval: (data) => {
      // Refetch more frequently if there are running tests
      const hasRunningTests = data?.data.some((run) =>
        run.status === 'running' || run.status === 'pending'
      );
      return hasRunningTests ? 5_000 : 30_000;
    },
  });

  return {
    runs: query.data?.data ?? [],
    pagination: query.data?.pagination ?? {
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrevious: false,
    },
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// Detail Hooks
// ============================================================================

/**
 * Hook parameters for test run details
 */
export interface UseTestRunDetailsParams {
  readonly id: TestRunId;
  readonly enabled?: boolean;
}

/**
 * Hook to fetch detailed test run information
 *
 * @example
 * const { run, isLoading, error } = useTestRunDetails({
 *   id: 'test_run_01HXYZ...' as TestRunId,
 * });
 */
export function useTestRunDetails(params: UseTestRunDetailsParams): UseTestRunDetailsReturn {
  const { id, enabled = true } = params;

  const query = useQuery({
    queryKey: testRunsQueryKeys.detail(id),
    queryFn: () => testRunsApi.getTestRunDetails(id),
    enabled: enabled && !!id,
    staleTime: 10_000, // 10 seconds for details
    refetchInterval: (data) => {
      // Refetch if test is still running
      if (data?.status === 'running' || data?.status === 'pending') {
        return 3_000; // Every 3 seconds while running
      }
      return false; // Don't auto-refetch when complete
    },
  });

  return {
    run: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: async () => {
      await query.refetch();
    },
  };
}

// ============================================================================
// Progress Hook
// ============================================================================

/**
 * Hook parameters for test run progress
 */
export interface UseTestRunProgressParams {
  readonly id: TestRunId;
  readonly enabled?: boolean;
  readonly refetchInterval?: number;
}

/**
 * Hook to track real-time test run progress
 *
 * @example
 * const { progress, isLoading } = useTestRunProgress({
 *   id: runId,
 *   refetchInterval: 2000,
 * });
 */
export function useTestRunProgress(params: UseTestRunProgressParams) {
  const { id, enabled = true, refetchInterval = 2_000 } = params;

  return useQuery({
    queryKey: testRunsQueryKeys.progress(id),
    queryFn: () => testRunsApi.getTestRunProgress(id),
    enabled: enabled && !!id,
    staleTime: 1_000,
    refetchInterval: (data) => {
      // Stop polling when test is complete
      if (data?.phase === 'completed' || data?.phase === 'failed') {
        return false;
      }
      return refetchInterval;
    },
  });
}

// ============================================================================
// Mutation Hooks
// ============================================================================

/**
 * Hook to create a new test run
 *
 * @example
 * const { createRun, isLoading } = useCreateTestRun();
 * await createRun({
 *   name: 'CI Test Run',
 *   suites: ['auth', 'scan'],
 *   config: { parallel: { enabled: true, workers: 4 } },
 * });
 */
export function useCreateTestRun(): UseCreateTestRunReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (request: CreateTestRunRequest) =>
      testRunsApi.createTestRun(request),
    onSuccess: () => {
      // Invalidate list queries to refetch
      queryClient.invalidateQueries({
        queryKey: testRunsQueryKeys.lists(),
      });
    },
  });

  return {
    createRun: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * Hook to cancel a running test run
 *
 * @example
 * const { cancelRun, isLoading } = useCancelTestRun();
 * await cancelRun(runId);
 */
export function useCancelTestRun(): UseCancelTestRunReturn {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: TestRunId) => testRunsApi.cancelTestRun(id),
    onSuccess: (_, id) => {
      // Invalidate specific run and list queries
      queryClient.invalidateQueries({
        queryKey: testRunsQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: testRunsQueryKeys.lists(),
      });
    },
  });

  return {
    cancelRun: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * Hook to retry a failed test run
 *
 * @example
 * const { retryRun, isLoading } = useRetryTestRun();
 * await retryRun(runId);
 */
export function useRetryTestRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: TestRunId) => testRunsApi.retryTestRun(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: testRunsQueryKeys.lists(),
      });
    },
  });

  return {
    retryRun: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

/**
 * Hook to delete a test run
 *
 * @example
 * const { deleteRun, isLoading } = useDeleteTestRun();
 * await deleteRun(runId);
 */
export function useDeleteTestRun() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (id: TestRunId) => testRunsApi.deleteTestRun(id),
    onSuccess: (_, id) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: testRunsQueryKeys.detail(id),
      });
      queryClient.invalidateQueries({
        queryKey: testRunsQueryKeys.lists(),
      });
    },
  });

  return {
    deleteRun: mutation.mutateAsync,
    isLoading: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}

// ============================================================================
// Prefetch Functions
// ============================================================================

/**
 * Prefetch test runs list
 */
export async function prefetchTestRuns(
  queryClient: ReturnType<typeof useQueryClient>,
  params: UseTestRunsParams = {}
): Promise<void> {
  const { filters, page = 1, pageSize = 20 } = params;

  await queryClient.prefetchQuery({
    queryKey: testRunsQueryKeys.list(filters, page, pageSize),
    queryFn: () => testRunsApi.listTestRuns({
      ...filters,
      page,
      pageSize,
    }),
    staleTime: 30_000,
  });
}

/**
 * Prefetch test run details
 */
export async function prefetchTestRunDetails(
  queryClient: ReturnType<typeof useQueryClient>,
  id: TestRunId
): Promise<void> {
  await queryClient.prefetchQuery({
    queryKey: testRunsQueryKeys.detail(id),
    queryFn: () => testRunsApi.getTestRunDetails(id),
    staleTime: 10_000,
  });
}
