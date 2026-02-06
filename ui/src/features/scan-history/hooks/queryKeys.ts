/**
 * Scan History Query Keys
 * Type-safe query key factory for React Query cache management
 * @module features/scan-history/hooks/queryKeys
 */

import type {
  FetchScanHistoryRequest,
  CreateScanDiffRequest,
} from '../types/api';
import type { ScanId } from '../types/domain';

// ============================================================================
// Query Key Factory
// ============================================================================

/**
 * Query key factory for all scan history-related queries
 *
 * Follows the pattern of hierarchical key arrays for proper
 * cache invalidation granularity:
 * - `all`: Invalidates all scan history queries
 * - `lists`: Invalidates all list queries
 * - `list`: Specific list with filters
 * - `details`: All detail queries
 * - `detail`: Specific scan detail
 * - `diffs`: All diff queries
 * - `diff`: Specific diff between two scans
 * - `timeline`: Timeline data queries
 *
 * @example
 * ```ts
 * // Use in useQuery
 * useQuery({
 *   queryKey: scanHistoryQueryKeys.list(filters),
 *   queryFn: () => fetchScans(filters),
 * });
 *
 * // Invalidate all scan history data
 * queryClient.invalidateQueries({
 *   queryKey: scanHistoryQueryKeys.all,
 * });
 *
 * // Invalidate only list queries (preserves details in cache)
 * queryClient.invalidateQueries({
 *   queryKey: scanHistoryQueryKeys.lists(),
 * });
 * ```
 */
export const scanHistoryQueryKeys = {
  /**
   * Root key for all scan history queries
   * Use for invalidating entire scan history cache
   */
  all: ['scan-history'] as const,

  /**
   * All list queries
   * Use for invalidating all paginated list queries
   */
  lists: () =>
    [...scanHistoryQueryKeys.all, 'list'] as const,

  /**
   * Specific list query with filters and pagination
   * @param params - Request parameters including filters, pagination, and sorting
   */
  list: (params?: FetchScanHistoryRequest) =>
    [...scanHistoryQueryKeys.lists(), params ?? {}] as const,

  /**
   * All detail queries
   * Use for invalidating all individual scan detail queries
   */
  details: () =>
    [...scanHistoryQueryKeys.all, 'detail'] as const,

  /**
   * Specific scan detail query
   * @param scanId - The scan identifier
   */
  detail: (scanId: ScanId | string) =>
    [...scanHistoryQueryKeys.details(), scanId] as const,

  /**
   * All diff queries
   * Use for invalidating all scan comparison queries
   */
  diffs: () =>
    [...scanHistoryQueryKeys.all, 'diff'] as const,

  /**
   * Specific diff query between two scans
   * @param baselineScanId - The baseline (older) scan ID
   * @param comparisonScanId - The comparison (newer) scan ID
   */
  diff: (baselineScanId: ScanId | string, comparisonScanId: ScanId | string) =>
    [...scanHistoryQueryKeys.diffs(), baselineScanId, comparisonScanId] as const,

  /**
   * Diff query from request object
   * @param request - The diff creation request
   */
  diffFromRequest: (request: CreateScanDiffRequest) =>
    scanHistoryQueryKeys.diff(request.baselineScanId, request.comparisonScanId),

  /**
   * All timeline queries
   * Use for invalidating all timeline visualization data
   */
  timelines: () =>
    [...scanHistoryQueryKeys.all, 'timeline'] as const,

  /**
   * Specific timeline data query
   * @param startDate - Start date in YYYY-MM-DD format
   * @param endDate - End date in YYYY-MM-DD format
   * @param granularity - Optional aggregation granularity
   */
  timeline: (
    startDate: string,
    endDate: string,
    granularity?: 'day' | 'week' | 'month'
  ) =>
    [...scanHistoryQueryKeys.timelines(), startDate, endDate, granularity ?? 'day'] as const,

  /**
   * Timeline data for a specific date range
   * @param dateRange - Object with start and end dates
   */
  timelineData: (dateRange: { start: string; end: string }) =>
    scanHistoryQueryKeys.timeline(dateRange.start, dateRange.end),

  /**
   * All export queries (for tracking export status)
   */
  exports: () =>
    [...scanHistoryQueryKeys.all, 'export'] as const,

  /**
   * Specific export query
   * @param exportId - The export operation identifier
   */
  export: (exportId: string) =>
    [...scanHistoryQueryKeys.exports(), exportId] as const,

  /**
   * Repository-scoped queries
   * @param repositoryId - The repository identifier
   */
  repository: (repositoryId: string) =>
    [...scanHistoryQueryKeys.all, 'repository', repositoryId] as const,

  /**
   * Scans for a specific repository
   * @param repositoryId - The repository identifier
   * @param params - Optional filter parameters
   */
  repositoryScans: (repositoryId: string, params?: FetchScanHistoryRequest) =>
    [...scanHistoryQueryKeys.repository(repositoryId), 'scans', params ?? {}] as const,

  /**
   * Summary/aggregate data queries
   */
  summaries: () =>
    [...scanHistoryQueryKeys.all, 'summary'] as const,

  /**
   * Summary for a specific time period
   * @param period - Time period identifier (e.g., 'today', 'week', 'month')
   */
  summary: (period: string) =>
    [...scanHistoryQueryKeys.summaries(), period] as const,
} as const;

// ============================================================================
// Query Filter Types
// ============================================================================

/**
 * Filter configuration used in query keys
 * Subset of FetchScanHistoryRequest that affects data fetching
 */
export interface ScanHistoryQueryFilters {
  /** Filter: start date (ISO 8601) */
  dateStart?: string;
  /** Filter: end date (ISO 8601) */
  dateEnd?: string;
  /** Filter: repository IDs */
  repositories?: string[];
  /** Filter: scan statuses */
  statuses?: string[];
  /** Filter: search query */
  search?: string;
}

/**
 * Extract query-relevant filters from full request parameters
 * Excludes pagination and sorting which don't affect the underlying data
 * @param params - Full request parameters
 * @returns Filters that affect data fetching
 */
export function toQueryFilters(params: FetchScanHistoryRequest): ScanHistoryQueryFilters {
  const result: ScanHistoryQueryFilters = {};

  if (params.dateStart) {
    result.dateStart = params.dateStart;
  }
  if (params.dateEnd) {
    result.dateEnd = params.dateEnd;
  }
  if (params.repositories && params.repositories.length > 0) {
    result.repositories = params.repositories;
  }
  if (params.statuses && params.statuses.length > 0) {
    result.statuses = params.statuses;
  }
  if (params.search) {
    result.search = params.search;
  }

  return result;
}

/**
 * Create a stable query key for filtered lists
 * Uses only filter parameters (not pagination) for cache sharing
 * @param filters - Query filters
 * @returns Query key for the filtered list
 */
export function filteredListKey(filters: ScanHistoryQueryFilters) {
  return [...scanHistoryQueryKeys.lists(), 'filtered', filters] as const;
}

// ============================================================================
// Query Key Type Helpers
// ============================================================================

/**
 * Type for the root query key
 */
export type ScanHistoryAllKey = typeof scanHistoryQueryKeys.all;

/**
 * Type for list query keys
 */
export type ScanHistoryListsKey = ReturnType<typeof scanHistoryQueryKeys.lists>;

/**
 * Type for specific list query key with params
 */
export type ScanHistoryListKey = ReturnType<typeof scanHistoryQueryKeys.list>;

/**
 * Type for details query keys
 */
export type ScanHistoryDetailsKey = ReturnType<typeof scanHistoryQueryKeys.details>;

/**
 * Type for specific detail query key
 */
export type ScanHistoryDetailKey = ReturnType<typeof scanHistoryQueryKeys.detail>;

/**
 * Type for diffs query keys
 */
export type ScanHistoryDiffsKey = ReturnType<typeof scanHistoryQueryKeys.diffs>;

/**
 * Type for specific diff query key
 */
export type ScanHistoryDiffKey = ReturnType<typeof scanHistoryQueryKeys.diff>;

/**
 * Type for timelines query keys
 */
export type ScanHistoryTimelinesKey = ReturnType<typeof scanHistoryQueryKeys.timelines>;

/**
 * Type for specific timeline query key
 */
export type ScanHistoryTimelineKey = ReturnType<typeof scanHistoryQueryKeys.timeline>;

/**
 * Type for export query keys
 */
export type ScanHistoryExportsKey = ReturnType<typeof scanHistoryQueryKeys.exports>;

/**
 * Type for specific export query key
 */
export type ScanHistoryExportKey = ReturnType<typeof scanHistoryQueryKeys.export>;

/**
 * Type for repository-scoped query key
 */
export type ScanHistoryRepositoryKey = ReturnType<typeof scanHistoryQueryKeys.repository>;

/**
 * Type for repository scans query key
 */
export type ScanHistoryRepositoryScansKey = ReturnType<typeof scanHistoryQueryKeys.repositoryScans>;

/**
 * Type for summary query keys
 */
export type ScanHistorySummariesKey = ReturnType<typeof scanHistoryQueryKeys.summaries>;

/**
 * Type for specific summary query key
 */
export type ScanHistorySummaryKey = ReturnType<typeof scanHistoryQueryKeys.summary>;

/**
 * Union type of all possible query keys
 */
export type ScanHistoryQueryKey =
  | ScanHistoryAllKey
  | ScanHistoryListsKey
  | ScanHistoryListKey
  | ScanHistoryDetailsKey
  | ScanHistoryDetailKey
  | ScanHistoryDiffsKey
  | ScanHistoryDiffKey
  | ScanHistoryTimelinesKey
  | ScanHistoryTimelineKey
  | ScanHistoryExportsKey
  | ScanHistoryExportKey
  | ScanHistoryRepositoryKey
  | ScanHistoryRepositoryScansKey
  | ScanHistorySummariesKey
  | ScanHistorySummaryKey;

export default scanHistoryQueryKeys;
