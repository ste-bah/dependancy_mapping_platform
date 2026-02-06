/**
 * Scan History Store
 * Zustand store for managing scan history state
 * @module features/scan-history/store/useScanHistoryStore
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

import type {
  ScanId,
  RepositoryId,
  ScanStatus,
  Scan,
  ScanHistoryFilters,
  DateRange,
  ScanDiff,
  FetchScanHistoryRequest,
} from '../types';

import {
  DEFAULT_SCAN_HISTORY_FILTERS,
} from '../types';

import type {
  ScanHistoryState,
  ScanHistoryActions,
  ScanHistoryStore,
  ViewMode,
  TimelineZoom,
  TimelineViewState,
  ComparisonSelection,
  ExportState,
  ExportFormat,
  SortState,
  SortField,
  SortDirection,
  PaginationState,
} from '../types';

import {
  INITIAL_SCAN_HISTORY_STATE,
  DEFAULT_PAGINATION_STATE,
  DEFAULT_COMPARISON_SELECTION,
  DEFAULT_EXPORT_STATE,
  DEFAULT_SORT_STATE,
} from '../types';

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Scan history store with devtools support
 * Uses subscribeWithSelector for optimized subscriptions
 */
export const useScanHistoryStore = create<ScanHistoryStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ========================================================================
      // Initial State
      // ========================================================================
      ...INITIAL_SCAN_HISTORY_STATE,

      // ========================================================================
      // Data Actions
      // ========================================================================

      /**
       * Set the list of scans (replaces existing)
       */
      setScans: (scans: Scan[]) => {
        set(
          { scans },
          false,
          'setScans'
        );
      },

      /**
       * Append more scans (for infinite scroll/pagination)
       */
      appendScans: (scans: Scan[]) => {
        set(
          (state) => ({
            scans: [...state.scans, ...scans],
          }),
          false,
          'appendScans'
        );
      },

      /**
       * Clear all loaded scans
       */
      clearScans: () => {
        set(
          {
            scans: [],
            selectedScanId: null,
            selectedScan: null,
          },
          false,
          'clearScans'
        );
      },

      // ========================================================================
      // Selection Actions
      // ========================================================================

      /**
       * Select a scan by ID
       */
      selectScan: (scanId: ScanId | null) => {
        const { scans } = get();
        const selectedScan = scanId
          ? scans.find((s) => s.id === scanId) ?? null
          : null;

        set(
          {
            selectedScanId: scanId,
            selectedScan,
          },
          false,
          'selectScan'
        );
      },

      /**
       * Clear current selection
       */
      clearSelection: () => {
        set(
          {
            selectedScanId: null,
            selectedScan: null,
          },
          false,
          'clearSelection'
        );
      },

      // ========================================================================
      // View Actions
      // ========================================================================

      /**
       * Switch between list and timeline view
       */
      setViewMode: (mode: ViewMode) => {
        set(
          { viewMode: mode },
          false,
          'setViewMode'
        );
      },

      /**
       * Update timeline zoom level
       */
      setTimelineZoom: (zoom: TimelineZoom) => {
        set(
          (state) => ({
            timelineView: {
              ...state.timelineView,
              zoom,
            },
          }),
          false,
          'setTimelineZoom'
        );
      },

      /**
       * Update timeline visible range
       */
      setTimelineRange: (range: DateRange) => {
        set(
          (state) => ({
            timelineView: {
              ...state.timelineView,
              visibleRange: range,
            },
          }),
          false,
          'setTimelineRange'
        );
      },

      /**
       * Update timeline scroll position
       */
      setTimelineScroll: (position: number) => {
        set(
          (state) => ({
            timelineView: {
              ...state.timelineView,
              scrollPosition: Math.max(0, Math.min(100, position)),
            },
          }),
          false,
          'setTimelineScroll'
        );
      },

      // ========================================================================
      // Filter Actions
      // ========================================================================

      /**
       * Update filter state (partial update)
       */
      setFilters: (filters: Partial<ScanHistoryFilters>) => {
        set(
          (state) => ({
            filters: {
              ...state.filters,
              ...filters,
            },
            // Reset pagination when filters change
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setFilters'
        );
      },

      /**
       * Set date range filter
       */
      setDateRange: (range: DateRange | null) => {
        set(
          (state) => ({
            filters: {
              ...state.filters,
              dateRange: range,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setDateRange'
        );
      },

      /**
       * Set repository filter
       */
      setRepositories: (repositories: RepositoryId[]) => {
        set(
          (state) => ({
            filters: {
              ...state.filters,
              repositories,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setRepositories'
        );
      },

      /**
       * Set status filter
       */
      setStatuses: (statuses: ScanStatus[]) => {
        set(
          (state) => ({
            filters: {
              ...state.filters,
              statuses,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setStatuses'
        );
      },

      /**
       * Set search query
       */
      setSearchQuery: (query: string) => {
        set(
          (state) => ({
            filters: {
              ...state.filters,
              searchQuery: query,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setSearchQuery'
        );
      },

      /**
       * Reset all filters to defaults
       */
      resetFilters: () => {
        set(
          {
            filters: { ...DEFAULT_SCAN_HISTORY_FILTERS },
            pagination: {
              ...get().pagination,
              page: 1,
            },
          },
          false,
          'resetFilters'
        );
      },

      // ========================================================================
      // Sort Actions
      // ========================================================================

      /**
       * Set sort field
       */
      setSortField: (field: SortField) => {
        set(
          (state) => ({
            sort: {
              ...state.sort,
              field,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setSortField'
        );
      },

      /**
       * Set sort direction
       */
      setSortDirection: (direction: SortDirection) => {
        set(
          (state) => ({
            sort: {
              ...state.sort,
              direction,
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'setSortDirection'
        );
      },

      /**
       * Toggle sort direction
       */
      toggleSortDirection: () => {
        set(
          (state) => ({
            sort: {
              ...state.sort,
              direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
            },
            pagination: {
              ...state.pagination,
              page: 1,
            },
          }),
          false,
          'toggleSortDirection'
        );
      },

      // ========================================================================
      // Pagination Actions
      // ========================================================================

      /**
       * Set current page
       */
      setPage: (page: number) => {
        set(
          (state) => ({
            pagination: {
              ...state.pagination,
              page: Math.max(1, page),
            },
          }),
          false,
          'setPage'
        );
      },

      /**
       * Set page size/limit
       */
      setLimit: (limit: number) => {
        set(
          (state) => ({
            pagination: {
              ...state.pagination,
              limit: Math.max(1, Math.min(100, limit)),
              page: 1, // Reset to first page when changing limit
            },
          }),
          false,
          'setLimit'
        );
      },

      /**
       * Update pagination from API response
       */
      updatePagination: (pagination: Partial<PaginationState>) => {
        set(
          (state) => ({
            pagination: {
              ...state.pagination,
              ...pagination,
            },
          }),
          false,
          'updatePagination'
        );
      },

      /**
       * Go to next page
       */
      nextPage: () => {
        const { pagination } = get();
        if (pagination.hasMore) {
          set(
            {
              pagination: {
                ...pagination,
                page: pagination.page + 1,
              },
            },
            false,
            'nextPage'
          );
        }
      },

      /**
       * Go to previous page
       */
      previousPage: () => {
        const { pagination } = get();
        if (pagination.page > 1) {
          set(
            {
              pagination: {
                ...pagination,
                page: pagination.page - 1,
              },
            },
            false,
            'previousPage'
          );
        }
      },

      // ========================================================================
      // Comparison Actions
      // ========================================================================

      /**
       * Select baseline scan for comparison
       */
      setBaselineScan: (scanId: ScanId | null) => {
        set(
          (state) => ({
            comparison: {
              ...state.comparison,
              baselineScanId: scanId,
              isComparing:
                scanId !== null && state.comparison.comparisonScanId !== null,
            },
            diff: null, // Clear diff when selection changes
          }),
          false,
          'setBaselineScan'
        );
      },

      /**
       * Select comparison scan
       */
      setComparisonScan: (scanId: ScanId | null) => {
        set(
          (state) => ({
            comparison: {
              ...state.comparison,
              comparisonScanId: scanId,
              isComparing:
                scanId !== null && state.comparison.baselineScanId !== null,
            },
            diff: null, // Clear diff when selection changes
          }),
          false,
          'setComparisonScan'
        );
      },

      /**
       * Swap baseline and comparison scans
       */
      swapComparisonScans: () => {
        set(
          (state) => ({
            comparison: {
              ...state.comparison,
              baselineScanId: state.comparison.comparisonScanId,
              comparisonScanId: state.comparison.baselineScanId,
            },
            diff: null, // Clear diff when swapping
          }),
          false,
          'swapComparisonScans'
        );
      },

      /**
       * Enable/disable comparison mode
       */
      setComparing: (isComparing: boolean) => {
        set(
          (state) => ({
            comparison: {
              ...state.comparison,
              isComparing,
            },
          }),
          false,
          'setComparing'
        );
      },

      /**
       * Clear comparison selection
       */
      clearComparison: () => {
        set(
          {
            comparison: { ...DEFAULT_COMPARISON_SELECTION },
            diff: null,
          },
          false,
          'clearComparison'
        );
      },

      /**
       * Set computed diff result
       */
      setDiff: (diff: ScanDiff | null) => {
        set(
          { diff },
          false,
          'setDiff'
        );
      },

      // ========================================================================
      // Export Actions
      // ========================================================================

      /**
       * Start export with given format
       */
      startExport: (format: ExportFormat) => {
        set(
          {
            export: {
              isExporting: true,
              format,
              progress: 0,
              error: null,
            },
          },
          false,
          'startExport'
        );
      },

      /**
       * Update export progress
       */
      setExportProgress: (progress: number) => {
        set(
          (state) => ({
            export: {
              ...state.export,
              progress: Math.max(0, Math.min(100, progress)),
            },
          }),
          false,
          'setExportProgress'
        );
      },

      /**
       * Complete export successfully
       */
      completeExport: () => {
        set(
          (state) => ({
            export: {
              ...state.export,
              isExporting: false,
              progress: 100,
            },
          }),
          false,
          'completeExport'
        );
      },

      /**
       * Set export error
       */
      setExportError: (error: string | null) => {
        set(
          (state) => ({
            export: {
              ...state.export,
              isExporting: false,
              error,
            },
          }),
          false,
          'setExportError'
        );
      },

      /**
       * Cancel current export
       */
      cancelExport: () => {
        set(
          { export: { ...DEFAULT_EXPORT_STATE } },
          false,
          'cancelExport'
        );
      },

      // ========================================================================
      // Loading State Actions
      // ========================================================================

      /**
       * Set loading state (initial load)
       */
      setLoading: (isLoading: boolean) => {
        set(
          { isLoading },
          false,
          'setLoading'
        );
      },

      /**
       * Set fetching state (background fetching)
       */
      setFetching: (isFetching: boolean) => {
        set(
          { isFetching },
          false,
          'setFetching'
        );
      },

      /**
       * Set diff loading state
       */
      setLoadingDiff: (isLoadingDiff: boolean) => {
        set(
          { isLoadingDiff },
          false,
          'setLoadingDiff'
        );
      },

      // ========================================================================
      // Error Actions
      // ========================================================================

      /**
       * Set error state
       */
      setError: (error: string | null) => {
        set(
          { error },
          false,
          'setError'
        );
      },

      /**
       * Clear error state
       */
      clearError: () => {
        set(
          { error: null },
          false,
          'clearError'
        );
      },

      // ========================================================================
      // Derived/Computed Actions
      // ========================================================================

      /**
       * Get current request params from state
       * Converts store state to API request format
       */
      getRequestParams: (): FetchScanHistoryRequest => {
        const { filters, sort, pagination } = get();

        const params: FetchScanHistoryRequest = {
          page: pagination.page,
          limit: pagination.limit,
          sortBy: sort.field,
          sortOrder: sort.direction,
        };

        // Add date range if set
        if (filters.dateRange) {
          params.dateStart = filters.dateRange.start.toISOString();
          params.dateEnd = filters.dateRange.end.toISOString();
        }

        // Add repository filter if not empty
        if (filters.repositories.length > 0) {
          params.repositories = filters.repositories;
        }

        // Add status filter if not empty
        if (filters.statuses.length > 0) {
          params.statuses = filters.statuses;
        }

        // Add search query if not empty
        if (filters.searchQuery.trim()) {
          params.search = filters.searchQuery.trim();
        }

        return params;
      },

      /**
       * Reset entire store to initial state
       */
      reset: () => {
        set(
          { ...INITIAL_SCAN_HISTORY_STATE },
          false,
          'reset'
        );
      },
    })),
    {
      name: 'scan-history-store',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
);

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select scans array
 */
export const selectScans = (state: ScanHistoryStore): Scan[] => state.scans;

/**
 * Select selected scan ID
 */
export const selectSelectedScanId = (state: ScanHistoryStore): ScanId | null =>
  state.selectedScanId;

/**
 * Select selected scan object
 */
export const selectSelectedScan = (state: ScanHistoryStore): Scan | null =>
  state.selectedScan;

/**
 * Select current view mode
 */
export const selectViewMode = (state: ScanHistoryStore): ViewMode =>
  state.viewMode;

/**
 * Select timeline view state
 */
export const selectTimelineView = (state: ScanHistoryStore): TimelineViewState =>
  state.timelineView;

/**
 * Select timeline zoom level
 */
export const selectTimelineZoom = (state: ScanHistoryStore): TimelineZoom =>
  state.timelineView.zoom;

/**
 * Select current filters
 */
export const selectFilters = (state: ScanHistoryStore): ScanHistoryFilters =>
  state.filters;

/**
 * Select current sort configuration
 */
export const selectSort = (state: ScanHistoryStore): SortState => state.sort;

/**
 * Select current pagination state
 */
export const selectPagination = (state: ScanHistoryStore): PaginationState =>
  state.pagination;

/**
 * Select comparison state
 */
export const selectComparison = (state: ScanHistoryStore): ComparisonSelection =>
  state.comparison;

/**
 * Select whether comparison mode is active
 */
export const selectIsComparing = (state: ScanHistoryStore): boolean =>
  state.comparison.isComparing;

/**
 * Select baseline scan ID for comparison
 */
export const selectBaselineScanId = (state: ScanHistoryStore): ScanId | null =>
  state.comparison.baselineScanId;

/**
 * Select comparison scan ID
 */
export const selectComparisonScanId = (state: ScanHistoryStore): ScanId | null =>
  state.comparison.comparisonScanId;

/**
 * Select computed diff
 */
export const selectDiff = (state: ScanHistoryStore): ScanDiff | null => state.diff;

/**
 * Select export state
 */
export const selectExportState = (state: ScanHistoryStore): ExportState =>
  state.export;

/**
 * Select whether export is in progress
 */
export const selectIsExporting = (state: ScanHistoryStore): boolean =>
  state.export.isExporting;

/**
 * Select loading state
 */
export const selectIsLoading = (state: ScanHistoryStore): boolean =>
  state.isLoading;

/**
 * Select fetching state
 */
export const selectIsFetching = (state: ScanHistoryStore): boolean =>
  state.isFetching;

/**
 * Select diff loading state
 */
export const selectIsLoadingDiff = (state: ScanHistoryStore): boolean =>
  state.isLoadingDiff;

/**
 * Select error state
 */
export const selectError = (state: ScanHistoryStore): string | null => state.error;

/**
 * Select whether any loading is in progress
 */
export const selectIsAnyLoading = (state: ScanHistoryStore): boolean =>
  state.isLoading || state.isFetching || state.isLoadingDiff;

/**
 * Select total scan count from pagination
 */
export const selectTotalScans = (state: ScanHistoryStore): number =>
  state.pagination.total;

/**
 * Select whether there are more pages
 */
export const selectHasMorePages = (state: ScanHistoryStore): boolean =>
  state.pagination.hasMore;

/**
 * Select current page number
 */
export const selectCurrentPage = (state: ScanHistoryStore): number =>
  state.pagination.page;

/**
 * Select whether filters are active (non-default)
 */
export const selectHasActiveFilters = (state: ScanHistoryStore): boolean => {
  const { filters } = state;
  return (
    filters.dateRange !== null ||
    filters.repositories.length > 0 ||
    filters.statuses.length > 0 ||
    filters.searchQuery.trim() !== ''
  );
};

/**
 * Select count of active filters
 */
export const selectActiveFilterCount = (state: ScanHistoryStore): number => {
  const { filters } = state;
  let count = 0;
  if (filters.dateRange !== null) count += 1;
  if (filters.repositories.length > 0) count += 1;
  if (filters.statuses.length > 0) count += 1;
  if (filters.searchQuery.trim() !== '') count += 1;
  return count;
};

// ============================================================================
// Derived Selectors (for complex computations)
// ============================================================================

/**
 * Select baseline scan object (derived from scans and comparison)
 */
export const selectBaselineScan = (state: ScanHistoryStore): Scan | null => {
  const { scans, comparison } = state;
  if (!comparison.baselineScanId) return null;
  return scans.find((s) => s.id === comparison.baselineScanId) ?? null;
};

/**
 * Select comparison scan object (derived from scans and comparison)
 */
export const selectComparisonScan = (state: ScanHistoryStore): Scan | null => {
  const { scans, comparison } = state;
  if (!comparison.comparisonScanId) return null;
  return scans.find((s) => s.id === comparison.comparisonScanId) ?? null;
};

/**
 * Select whether both comparison scans are selected
 */
export const selectCanCompare = (state: ScanHistoryStore): boolean =>
  state.comparison.baselineScanId !== null &&
  state.comparison.comparisonScanId !== null;

/**
 * Select scans grouped by status (for visualization)
 */
export const selectScansByStatus = (
  state: ScanHistoryStore
): Record<string, Scan[]> => {
  const { scans } = state;
  return scans.reduce(
    (acc, scan) => {
      const status = scan.status;
      if (!acc[status]) {
        acc[status] = [];
      }
      acc[status].push(scan);
      return acc;
    },
    {} as Record<string, Scan[]>
  );
};

// ============================================================================
// Hook Utilities
// ============================================================================

/**
 * Create a shallow equality selector for specific state slices
 * Use this to prevent unnecessary re-renders
 */
export function createScanHistorySelector<T>(
  selector: (state: ScanHistoryStore) => T
): (state: ScanHistoryStore) => T {
  return selector;
}
