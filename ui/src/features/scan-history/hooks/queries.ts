/**
 * Scan History Query Hooks
 * React Query hooks for fetching and managing scan history data
 * @module features/scan-history/hooks/queries
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  useInfiniteQuery,
  queryOptions,
} from '@tanstack/react-query';
import { useCallback } from 'react';
import {
  fetchScans,
  fetchScan,
  createDiff,
  fetchDiff,
  exportScans,
  fetchTimeline,
} from '../api';
import type { ScanDetailResponse, FetchTimelineOptions } from '../api';
import type { ScanId, Scan } from '../types/domain';
import type {
  FetchScanHistoryRequest,
  ScanHistoryResponse,
  ScanDiffResponse,
  ExportScansRequest,
  TimelineDataResponse,
  CreateScanDiffRequest,
} from '../types/api';
import type {
  UseScanHistoryOptions,
  UseScanHistoryReturn,
  UseScanDetailOptions,
  UseScanDetailReturn,
  UseScanDiffOptions,
  UseScanDiffReturn,
  UseScanTimelineOptions,
  UseScanTimelineReturn,
  UseScanExportOptions,
  UseScanExportReturn,
} from '../types/hooks';
import type { PaginationState, ExportFormat, TimelineZoom } from '../types/store';
import { scanHistoryQueryKeys } from './queryKeys';
import { SCAN_HISTORY_CONFIG } from '../config';

// ============================================================================
// Cache Time Constants
// ============================================================================

/**
 * Cache time configuration for scan history queries
 * Uses centralized configuration from config module
 */
export const SCAN_HISTORY_CACHE_TIMES = {
  /** Stale time for scan list queries */
  listStale: SCAN_HISTORY_CONFIG.cache.listStaleTime,
  /** Stale time for scan detail queries */
  detailStale: SCAN_HISTORY_CONFIG.cache.detailStaleTime,
  /** Stale time for diff queries */
  diffStale: SCAN_HISTORY_CONFIG.cache.diffStaleTime,
  /** Stale time for timeline queries */
  timelineStale: SCAN_HISTORY_CONFIG.cache.timelineStaleTime,
  /** Garbage collection time */
  gc: SCAN_HISTORY_CONFIG.cache.gcTime,
} as const;

// ============================================================================
// Query Options Factories
// ============================================================================

/**
 * Create query options for fetching scan history list
 * @param params - Request parameters
 * @returns Query options for use with useQuery
 */
export function scanHistoryListQueryOptions(params?: FetchScanHistoryRequest) {
  return queryOptions<ScanHistoryResponse, Error>({
    queryKey: scanHistoryQueryKeys.list(params),
    queryFn: () => fetchScans(params),
    staleTime: SCAN_HISTORY_CACHE_TIMES.listStale,
    gcTime: SCAN_HISTORY_CACHE_TIMES.gc,
  });
}

/**
 * Create query options for fetching scan details
 * @param scanId - The scan identifier
 * @returns Query options for use with useQuery
 */
export function scanDetailQueryOptions(scanId: ScanId | string | null) {
  return queryOptions<ScanDetailResponse, Error>({
    queryKey: scanHistoryQueryKeys.detail(scanId ?? ''),
    queryFn: () => {
      if (!scanId) {
        throw new Error('Scan ID is required');
      }
      return fetchScan(scanId);
    },
    staleTime: SCAN_HISTORY_CACHE_TIMES.detailStale,
    gcTime: SCAN_HISTORY_CACHE_TIMES.gc,
    enabled: Boolean(scanId),
  });
}

/**
 * Create query options for fetching scan diff
 * @param baselineScanId - Baseline scan ID
 * @param comparisonScanId - Comparison scan ID
 * @returns Query options for use with useQuery
 */
export function scanDiffQueryOptions(
  baselineScanId: ScanId | string | null,
  comparisonScanId: ScanId | string | null
) {
  return queryOptions<ScanDiffResponse | null, Error>({
    queryKey: scanHistoryQueryKeys.diff(
      baselineScanId ?? '',
      comparisonScanId ?? ''
    ),
    queryFn: () => {
      if (!baselineScanId || !comparisonScanId) {
        throw new Error('Both baseline and comparison scan IDs are required');
      }
      return fetchDiff(baselineScanId, comparisonScanId);
    },
    staleTime: SCAN_HISTORY_CACHE_TIMES.diffStale,
    gcTime: SCAN_HISTORY_CACHE_TIMES.gc,
    enabled: Boolean(baselineScanId) && Boolean(comparisonScanId),
  });
}

/**
 * Create query options for fetching timeline data
 * @param options - Timeline fetch options
 * @returns Query options for use with useQuery
 */
export function timelineQueryOptions(options: FetchTimelineOptions) {
  return queryOptions<TimelineDataResponse, Error>({
    queryKey: scanHistoryQueryKeys.timeline(
      options.startDate,
      options.endDate,
      options.granularity
    ),
    queryFn: () => fetchTimeline(options),
    staleTime: SCAN_HISTORY_CACHE_TIMES.timelineStale,
    gcTime: SCAN_HISTORY_CACHE_TIMES.gc,
    enabled: Boolean(options.startDate) && Boolean(options.endDate),
  });
}

// ============================================================================
// useScanHistory Hook
// ============================================================================

/**
 * Hook for fetching paginated scan history
 *
 * Provides automatic caching, background refetching, and pagination support.
 *
 * @param options - Query options
 * @returns Query result with scans and pagination info
 *
 * @example
 * ```tsx
 * function ScanHistoryList() {
 *   const {
 *     scans,
 *     pagination,
 *     isLoading,
 *     isError,
 *     refetch,
 *   } = useScanHistory({
 *     params: { page: 1, limit: 20, statuses: ['completed'] },
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *   if (isError) return <Error />;
 *
 *   return (
 *     <ScanTable scans={scans} pagination={pagination} />
 *   );
 * }
 * ```
 */
export function useScanHistory(
  options: UseScanHistoryOptions = {}
): UseScanHistoryReturn {
  const {
    params,
    enabled = true,
    staleTime = SCAN_HISTORY_CACHE_TIMES.listStale,
    refetchOnWindowFocus = true,
    refetchOnMount = false,
    retryCount = 3,
  } = options;

  const query = useQuery({
    ...scanHistoryListQueryOptions(params),
    enabled,
    staleTime,
    refetchOnWindowFocus,
    refetchOnMount,
    retry: retryCount,
  });

  // Extract pagination from response
  const pagination: PaginationState = query.data
    ? {
        page: query.data.page,
        limit: query.data.limit,
        total: query.data.total,
        hasMore: query.data.hasMore,
      }
    : {
        page: params?.page ?? 1,
        limit: params?.limit ?? 20,
        total: 0,
        hasMore: false,
      };

  return {
    scans: query.data?.scans ?? [],
    pagination,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isFetching: query.isFetching,
    refetch: query.refetch,
    // Placeholder for infinite query - implement if needed
    fetchNextPage: () => {},
    hasNextPage: pagination.hasMore,
    isFetchingNextPage: false,
  };
}

/**
 * Hook for infinite scrolling scan history
 *
 * @param options - Query options
 * @returns Infinite query result
 */
export function useScanHistoryInfinite(
  options: Omit<UseScanHistoryOptions, 'params'> & {
    params?: Omit<FetchScanHistoryRequest, 'page'>;
  } = {}
) {
  const { params, enabled = true, staleTime } = options;

  // Build params without page for the infinite query key
  const baseParams: FetchScanHistoryRequest = params ? { ...params } : {};
  delete baseParams.page;

  return useInfiniteQuery({
    queryKey: scanHistoryQueryKeys.list(baseParams),
    queryFn: ({ pageParam }) =>
      fetchScans({ ...params, page: pageParam as number }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? lastPage.page + 1 : undefined,
    getPreviousPageParam: (firstPage) =>
      firstPage.page > 1 ? firstPage.page - 1 : undefined,
    enabled,
    staleTime: staleTime ?? SCAN_HISTORY_CACHE_TIMES.listStale,
  });
}

// ============================================================================
// useScanDetail Hook
// ============================================================================

/**
 * Hook for fetching detailed information about a specific scan
 *
 * @param options - Query options including scanId
 * @returns Query result with scan detail
 *
 * @example
 * ```tsx
 * function ScanDetailPanel({ scanId }: { scanId: ScanId }) {
 *   const { scan, isLoading, isError } = useScanDetail({ scanId });
 *
 *   if (isLoading) return <Spinner />;
 *   if (isError) return <Error />;
 *   if (!scan) return <NotFound />;
 *
 *   return (
 *     <div>
 *       <h2>{scan.repositoryName}</h2>
 *       <p>Issues: {scan.metrics.issuesFound}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useScanDetail(
  options: UseScanDetailOptions
): UseScanDetailReturn {
  const { scanId, enabled = true } = options;
  // Note: includeRelated option available for future enhancement

  const query = useQuery({
    ...scanDetailQueryOptions(scanId),
    enabled: Boolean(scanId) && enabled,
  });

  return {
    scan: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// useScanDiff Hook
// ============================================================================

/**
 * Hook for comparing two scans and computing diff
 *
 * Supports both query (for cached diffs) and mutation (for on-demand computation).
 *
 * @param options - Comparison options
 * @returns Diff result with compute/clear functions
 *
 * @example
 * ```tsx
 * function ComparisonView({ baseline, comparison }: Props) {
 *   const {
 *     diff,
 *     isLoading,
 *     compute,
 *     clear,
 *   } = useScanDiff({
 *     baselineScanId: baseline.id,
 *     comparisonScanId: comparison.id,
 *   });
 *
 *   return (
 *     <div>
 *       {diff && (
 *         <DiffMetrics metrics={diff.metricsDiff} />
 *       )}
 *       <button onClick={compute}>Recompute</button>
 *       <button onClick={clear}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useScanDiff(options: UseScanDiffOptions): UseScanDiffReturn {
  const {
    baselineScanId,
    comparisonScanId,
    enabled = true,
    includeUnchanged = false,
    includeMetricsDiff = true,
  } = options;

  const queryClient = useQueryClient();

  // Query for existing/cached diff
  const query = useQuery({
    ...scanDiffQueryOptions(baselineScanId, comparisonScanId),
    enabled: Boolean(baselineScanId) && Boolean(comparisonScanId) && enabled,
  });

  // Mutation for computing new diff
  const mutation = useMutation({
    mutationFn: (request: CreateScanDiffRequest) => createDiff(request),
    onSuccess: (data) => {
      // Cache the result
      if (baselineScanId && comparisonScanId) {
        queryClient.setQueryData(
          scanHistoryQueryKeys.diff(baselineScanId, comparisonScanId),
          data
        );
      }
    },
  });

  const compute = useCallback(() => {
    if (baselineScanId && comparisonScanId) {
      mutation.mutate({
        baselineScanId: baselineScanId as ScanId,
        comparisonScanId: comparisonScanId as ScanId,
        options: {
          includeUnchanged,
          includeMetricsDiff,
        },
      });
    }
  }, [baselineScanId, comparisonScanId, includeUnchanged, includeMetricsDiff, mutation]);

  const clear = useCallback(() => {
    if (baselineScanId && comparisonScanId) {
      queryClient.removeQueries({
        queryKey: scanHistoryQueryKeys.diff(baselineScanId, comparisonScanId),
      });
    }
  }, [baselineScanId, comparisonScanId, queryClient]);

  return {
    diff: query.data?.data ?? mutation.data?.data ?? null,
    isLoading: query.isLoading || mutation.isPending,
    isError: query.isError || mutation.isError,
    error: query.error ?? mutation.error ?? null,
    compute,
    clear,
  };
}

/**
 * Hook for creating a diff with mutation pattern
 * Use when you need on-demand diff computation
 *
 * @param options - Mutation options
 * @returns Mutation result
 */
export function useScanDiffMutation(options?: {
  onSuccess?: (data: ScanDiffResponse, request: CreateScanDiffRequest) => void;
  onError?: (error: Error, request: CreateScanDiffRequest) => void;
}) {
  const queryClient = useQueryClient();
  const { onSuccess, onError } = options ?? {};

  return useMutation({
    mutationFn: (request: CreateScanDiffRequest) => createDiff(request),
    onSuccess: (data, request) => {
      // Cache the computed diff
      queryClient.setQueryData(
        scanHistoryQueryKeys.diff(request.baselineScanId, request.comparisonScanId),
        data
      );
      onSuccess?.(data, request);
    },
    onError: (error: Error, request: CreateScanDiffRequest) => {
      onError?.(error, request);
    },
  });
}

// ============================================================================
// useScanTimeline Hook
// ============================================================================

/**
 * Hook for fetching timeline/trend data for visualization
 *
 * @param options - Timeline options including date range
 * @returns Timeline data with zoom controls
 *
 * @example
 * ```tsx
 * function TimelineChart({ dateRange }: Props) {
 *   const {
 *     dataPoints,
 *     isLoading,
 *     zoom,
 *     setZoom,
 *   } = useScanTimeline({
 *     dateRange,
 *     enabled: true,
 *   });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <div>
 *       <ZoomControls value={zoom} onChange={setZoom} />
 *       <Chart data={dataPoints} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useScanTimeline(
  options: UseScanTimelineOptions
): UseScanTimelineReturn {
  const {
    dateRange,
    repositoryIds,
    // statuses filter available for future enhancement
    enabled = true,
  } = options;

  // Format dates for API - ensure string type
  const startDateStr = dateRange.start.toISOString().split('T')[0] as string;
  const endDateStr = dateRange.end.toISOString().split('T')[0] as string;

  // Determine granularity based on date range span
  const daysDiff = Math.ceil(
    (dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24)
  );
  const autoGranularity: 'day' | 'week' | 'month' =
    daysDiff <= 14 ? 'day' : daysDiff <= 90 ? 'week' : 'month';

  const timelineOptions: FetchTimelineOptions = {
    startDate: startDateStr,
    endDate: endDateStr,
    granularity: autoGranularity,
  };
  if (repositoryIds && repositoryIds.length > 0) {
    timelineOptions.repositories = repositoryIds;
  }

  const query = useQuery({
    ...timelineQueryOptions(timelineOptions),
    enabled,
  });

  return {
    dataPoints: query.data?.dataPoints ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    zoom: autoGranularity as TimelineZoom,
    setZoom: () => {}, // Implement with local state if needed
    visibleRange: dateRange,
    setVisibleRange: () => {}, // Implement with local state if needed
    refetch: query.refetch,
  };
}

// ============================================================================
// useExportScans Hook
// ============================================================================

/**
 * Hook for exporting scan data in various formats
 *
 * @param options - Export options
 * @returns Export function with progress tracking
 *
 * @example
 * ```tsx
 * function ExportButton({ selectedScans }: Props) {
 *   const {
 *     exportScans,
 *     isExporting,
 *     progress,
 *     error,
 *   } = useExportScans({
 *     scanIds: selectedScans,
 *     onSuccess: (format, filename) => {
 *       toast.success(`Exported to ${filename}`);
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <button
 *         onClick={() => exportScans('csv')}
 *         disabled={isExporting}
 *       >
 *         {isExporting ? `Exporting ${progress}%` : 'Export CSV'}
 *       </button>
 *       {error && <ErrorMessage error={error} />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useExportScans(options: UseScanExportOptions): UseScanExportReturn {
  const { scanIds, onSuccess, onError } = options;
  // Note: defaultFilename option available for future enhancement

  const mutation = useMutation({
    mutationFn: (request: ExportScansRequest) => exportScans(request),
    onSuccess: (data) => {
      onSuccess?.(data.format, data.filename);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });

  const exportFn = useCallback(
    async (format: ExportFormat) => {
      await mutation.mutateAsync({
        scanIds: scanIds as ScanId[],
        format,
        includeMetrics: true,
      });
    },
    [scanIds, mutation]
  );

  const cancelExport = useCallback(() => {
    // Note: Cancellation would require AbortController integration
    mutation.reset();
  }, [mutation]);

  return {
    exportScans: exportFn,
    cancelExport,
    isExporting: mutation.isPending,
    progress: mutation.isPending ? 50 : mutation.isSuccess ? 100 : 0, // Simplified progress
    error: mutation.error,
    lastExportedFile: mutation.data?.filename ?? null,
  };
}

// ============================================================================
// Cache Invalidation Hooks
// ============================================================================

/**
 * Hook for invalidating scan history cache
 *
 * Provides granular cache invalidation functions.
 *
 * @returns Cache invalidation functions
 *
 * @example
 * ```tsx
 * function RefreshControls() {
 *   const {
 *     invalidateAll,
 *     invalidateList,
 *     invalidateScan,
 *   } = useInvalidateScanHistory();
 *
 *   return (
 *     <div>
 *       <button onClick={invalidateAll}>
 *         Clear All Cache
 *       </button>
 *       <button onClick={invalidateList}>
 *         Refresh List
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useInvalidateScanHistory() {
  const queryClient = useQueryClient();

  const invalidateAll = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: scanHistoryQueryKeys.all,
    });
  }, [queryClient]);

  const invalidateList = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: scanHistoryQueryKeys.lists(),
    });
  }, [queryClient]);

  const invalidateScan = useCallback(
    (scanId: ScanId | string) => {
      return queryClient.invalidateQueries({
        queryKey: scanHistoryQueryKeys.detail(scanId),
      });
    },
    [queryClient]
  );

  const invalidateDiffs = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: scanHistoryQueryKeys.diffs(),
    });
  }, [queryClient]);

  const invalidateDiff = useCallback(
    (baselineScanId: ScanId | string, comparisonScanId: ScanId | string) => {
      return queryClient.invalidateQueries({
        queryKey: scanHistoryQueryKeys.diff(baselineScanId, comparisonScanId),
      });
    },
    [queryClient]
  );

  const invalidateTimelines = useCallback(() => {
    return queryClient.invalidateQueries({
      queryKey: scanHistoryQueryKeys.timelines(),
    });
  }, [queryClient]);

  const invalidateRepository = useCallback(
    (repositoryId: string) => {
      return queryClient.invalidateQueries({
        queryKey: scanHistoryQueryKeys.repository(repositoryId),
      });
    },
    [queryClient]
  );

  return {
    invalidateAll,
    invalidateList,
    invalidateScan,
    invalidateDiffs,
    invalidateDiff,
    invalidateTimelines,
    invalidateRepository,
  };
}

// ============================================================================
// Prefetch Hooks
// ============================================================================

/**
 * Hook for prefetching scan data on hover
 *
 * Useful for preloading data for anticipated navigation.
 *
 * @returns Prefetch functions
 *
 * @example
 * ```tsx
 * function ScanListItem({ scan }: { scan: Scan }) {
 *   const { prefetchScan } = usePrefetchScan();
 *
 *   return (
 *     <Link
 *       to={`/scans/${scan.id}`}
 *       onMouseEnter={() => prefetchScan(scan.id)}
 *     >
 *       {scan.repositoryName}
 *     </Link>
 *   );
 * }
 * ```
 */
export function usePrefetchScan() {
  const queryClient = useQueryClient();

  const prefetchScan = useCallback(
    async (scanId: ScanId | string) => {
      await queryClient.prefetchQuery(scanDetailQueryOptions(scanId));
    },
    [queryClient]
  );

  const prefetchScanList = useCallback(
    async (params?: FetchScanHistoryRequest) => {
      await queryClient.prefetchQuery(scanHistoryListQueryOptions(params));
    },
    [queryClient]
  );

  const prefetchTimeline = useCallback(
    async (options: FetchTimelineOptions) => {
      await queryClient.prefetchQuery(timelineQueryOptions(options));
    },
    [queryClient]
  );

  return {
    prefetchScan,
    prefetchScanList,
    prefetchTimeline,
  };
}

// ============================================================================
// Optimistic Update Helpers
// ============================================================================

/**
 * Hook for optimistic updates on scan history data
 *
 * @returns Optimistic update helpers
 */
export function useScanHistoryOptimisticUpdate() {
  const queryClient = useQueryClient();

  /**
   * Optimistically update a scan in the list
   */
  const updateScanInList = useCallback(
    (
      scanId: ScanId | string,
      updates: Partial<Scan>,
      params?: FetchScanHistoryRequest
    ) => {
      const queryKey = scanHistoryQueryKeys.list(params);

      // Snapshot for rollback
      const previousData = queryClient.getQueryData<ScanHistoryResponse>(queryKey);

      // Optimistically update
      queryClient.setQueryData<ScanHistoryResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          scans: old.scans.map((scan) =>
            scan.id === scanId ? { ...scan, ...updates } : scan
          ),
        };
      });

      // Return rollback function
      return () => {
        if (previousData) {
          queryClient.setQueryData(queryKey, previousData);
        }
      };
    },
    [queryClient]
  );

  /**
   * Optimistically remove a scan from the list
   */
  const removeScanFromList = useCallback(
    (scanId: ScanId | string, params?: FetchScanHistoryRequest) => {
      const queryKey = scanHistoryQueryKeys.list(params);

      const previousData = queryClient.getQueryData<ScanHistoryResponse>(queryKey);

      queryClient.setQueryData<ScanHistoryResponse>(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          scans: old.scans.filter((scan) => scan.id !== scanId),
          total: old.total - 1,
        };
      });

      return () => {
        if (previousData) {
          queryClient.setQueryData(queryKey, previousData);
        }
      };
    },
    [queryClient]
  );

  return {
    updateScanInList,
    removeScanFromList,
  };
}

// ============================================================================
// Query Defaults
// ============================================================================

/**
 * Common default options for all scan history queries
 */
export const scanHistoryQueryDefaults = {
  /** Retry failed requests up to 3 times */
  retry: 3,
  /** Exponential backoff for retries */
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
  /** Refetch on window focus for fresh data */
  refetchOnWindowFocus: true,
  /** Don't refetch on mount if data exists */
  refetchOnMount: false,
  /** Keep previous data during refetch */
  placeholderData: <T>(previousData: T): T | undefined => previousData,
} as const;

// ============================================================================
// Default Export
// ============================================================================

export default {
  useScanHistory,
  useScanHistoryInfinite,
  useScanDetail,
  useScanDiff,
  useScanDiffMutation,
  useScanTimeline,
  useExportScans,
  useInvalidateScanHistory,
  usePrefetchScan,
  useScanHistoryOptimisticUpdate,
  // Query options factories
  scanHistoryListQueryOptions,
  scanDetailQueryOptions,
  scanDiffQueryOptions,
  timelineQueryOptions,
  // Cache configuration
  SCAN_HISTORY_CACHE_TIMES,
  scanHistoryQueryDefaults,
};
