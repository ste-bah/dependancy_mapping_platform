/**
 * Scan History URL State Hook
 * Bidirectional synchronization between scan history state and URL search parameters
 * @module features/scan-history/hooks/useScanHistoryUrlState
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import type {
  ScanId,
  ScanHistoryFilters,
  TimelineZoom,
  ViewMode,
  PaginationState,
} from '../types';
import {
  DEFAULT_SCAN_HISTORY_FILTERS,
  DEFAULT_PAGINATION_STATE,
  createScanId,
  isScanId,
} from '../types';
import {
  serializeFilters,
  parseFilters,
  hasActiveFilters as checkActiveFilters,
} from '../utils/filterHelpers';

// ============================================================================
// URL Parameter Keys
// ============================================================================

/**
 * URL parameter key constants for scan history state
 */
export const URL_PARAM_KEYS = {
  // Date range (from filterHelpers)
  dateStart: 'from',
  dateEnd: 'to',
  // Filters
  repositories: 'repos',
  statuses: 'status',
  search: 'q',
  // Pagination
  page: 'page',
  limit: 'limit',
  // View state
  viewMode: 'view',
  timelineZoom: 'zoom',
  // Selection
  selectedScan: 'scan',
  // Comparison
  baselineScan: 'base',
  compareScan: 'cmp',
} as const;

/**
 * Array separator for URL parameters
 */
const ARRAY_SEPARATOR = ',';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for useScanHistoryUrlState hook
 */
export interface UseScanHistoryUrlStateOptions {
  /** Enable URL synchronization (default: true) */
  enabled?: boolean;
  /** Replace history entry instead of push (default: true) */
  replaceState?: boolean;
  /** Debounce URL updates in milliseconds (default: 300) */
  debounceMs?: number;
  /** Default filters if not in URL */
  defaultFilters?: Partial<ScanHistoryFilters>;
  /** Default view mode */
  defaultViewMode?: ViewMode;
  /** Default timeline zoom */
  defaultTimelineZoom?: TimelineZoom;
  /** Default pagination */
  defaultPagination?: Partial<PaginationState>;
  /** Callback when filters change */
  onFiltersChange?: (filters: ScanHistoryFilters) => void;
  /** Callback when selection changes */
  onSelectionChange?: (scanId: ScanId | null) => void;
  /** Callback when view mode changes */
  onViewModeChange?: (mode: ViewMode) => void;
}

/**
 * Return type for useScanHistoryUrlState hook
 */
export interface UseScanHistoryUrlStateReturn {
  /** Current filter state */
  filters: ScanHistoryFilters;
  /** Currently selected scan ID */
  selectedScanId: ScanId | null;
  /** Comparison scan ID for diff view */
  compareScanId: ScanId | null;
  /** Current view mode (list or timeline) */
  viewMode: ViewMode;
  /** Current timeline zoom level */
  timelineZoom: TimelineZoom;
  /** Current pagination state */
  pagination: Pick<PaginationState, 'page' | 'limit'>;
  /** Set all filters at once */
  setFilters: (filters: ScanHistoryFilters) => void;
  /** Update a single filter field */
  updateFilter: <K extends keyof ScanHistoryFilters>(
    key: K,
    value: ScanHistoryFilters[K]
  ) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;
  /** Set selected scan ID */
  setSelectedScanId: (id: ScanId | null) => void;
  /** Set comparison scan ID */
  setCompareScanId: (id: ScanId | null) => void;
  /** Set view mode */
  setViewMode: (mode: ViewMode) => void;
  /** Set timeline zoom level */
  setTimelineZoom: (zoom: TimelineZoom) => void;
  /** Set pagination page */
  setPage: (page: number) => void;
  /** Set pagination page size */
  setLimit: (limit: number) => void;
  /** Generate shareable URL for current state */
  getShareableUrl: () => string;
  /** Whether any filters are currently active */
  hasActiveFilters: boolean;
  /** Clear all URL state */
  clearUrlState: () => void;
}

// ============================================================================
// Parsing Utilities
// ============================================================================

/**
 * Parse view mode from URL parameter
 */
function parseViewMode(param: string | null): ViewMode {
  if (param === 'timeline') return 'timeline';
  return 'list';
}

/**
 * Parse timeline zoom from URL parameter
 */
function parseTimelineZoom(param: string | null): TimelineZoom {
  const validZooms: TimelineZoom[] = ['day', 'week', 'month', 'quarter', 'year'];
  if (param && validZooms.includes(param as TimelineZoom)) {
    return param as TimelineZoom;
  }
  return 'month';
}

/**
 * Parse pagination from URL parameters
 */
function parsePagination(
  params: URLSearchParams,
  defaults: Pick<PaginationState, 'page' | 'limit'>
): Pick<PaginationState, 'page' | 'limit'> {
  const pageParam = params.get(URL_PARAM_KEYS.page);
  const limitParam = params.get(URL_PARAM_KEYS.limit);

  let page = defaults.page;
  let limit = defaults.limit;

  if (pageParam) {
    const parsed = parseInt(pageParam, 10);
    if (!isNaN(parsed) && parsed >= 1) {
      page = parsed;
    }
  }

  if (limitParam) {
    const parsed = parseInt(limitParam, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 100) {
      limit = parsed;
    }
  }

  return { page, limit };
}

/**
 * Parse scan ID from URL parameter
 */
function parseScanId(param: string | null): ScanId | null {
  if (!param || param.trim() === '') {
    return null;
  }
  const trimmed = param.trim();
  if (isScanId(trimmed)) {
    return createScanId(trimmed);
  }
  return null;
}

// ============================================================================
// Serialization Utilities
// ============================================================================

/**
 * Serialize complete scan history state to URL search params
 */
function serializeState(
  filters: ScanHistoryFilters,
  pagination: Pick<PaginationState, 'page' | 'limit'>,
  viewMode: ViewMode,
  timelineZoom: TimelineZoom,
  selectedScanId: ScanId | null,
  compareScanId: ScanId | null,
  defaults: {
    pagination: Pick<PaginationState, 'page' | 'limit'>;
    viewMode: ViewMode;
    timelineZoom: TimelineZoom;
  }
): URLSearchParams {
  // Start with filter params
  const params = serializeFilters(filters);

  // Add pagination (only if non-default)
  if (pagination.page !== defaults.pagination.page) {
    params.set(URL_PARAM_KEYS.page, pagination.page.toString());
  }
  if (pagination.limit !== defaults.pagination.limit) {
    params.set(URL_PARAM_KEYS.limit, pagination.limit.toString());
  }

  // Add view mode (only if non-default)
  if (viewMode !== defaults.viewMode) {
    params.set(URL_PARAM_KEYS.viewMode, viewMode);
  }

  // Add timeline zoom (only if non-default or in timeline view)
  if (viewMode === 'timeline' && timelineZoom !== defaults.timelineZoom) {
    params.set(URL_PARAM_KEYS.timelineZoom, timelineZoom);
  }

  // Add selected scan
  if (selectedScanId) {
    params.set(URL_PARAM_KEYS.selectedScan, selectedScanId);
  }

  // Add comparison scan
  if (compareScanId) {
    params.set(URL_PARAM_KEYS.compareScan, compareScanId);
  }

  return params;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for synchronizing scan history state with URL parameters
 *
 * Provides two-way binding between scan history state and URL search params,
 * enabling shareable URLs and browser history navigation.
 *
 * @param options - Configuration options
 * @returns State and update functions
 *
 * @example
 * ```tsx
 * function ScanHistoryPage() {
 *   const {
 *     filters,
 *     selectedScanId,
 *     viewMode,
 *     setFilters,
 *     setViewMode,
 *     getShareableUrl,
 *     hasActiveFilters,
 *   } = useScanHistoryUrlState({
 *     onFiltersChange: (filters) => {
 *       // Refetch data when filters change
 *       refetch();
 *     },
 *   });
 *
 *   return (
 *     <div>
 *       <FilterPanel
 *         filters={filters}
 *         onChange={setFilters}
 *         hasActive={hasActiveFilters}
 *       />
 *       <ViewToggle mode={viewMode} onChange={setViewMode} />
 *       <ScanList selectedId={selectedScanId} />
 *       <button onClick={() => navigator.clipboard.writeText(getShareableUrl())}>
 *         Copy Link
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useScanHistoryUrlState(
  options: UseScanHistoryUrlStateOptions = {}
): UseScanHistoryUrlStateReturn {
  const {
    enabled = true,
    replaceState = true,
    debounceMs = 300,
    defaultFilters,
    defaultViewMode = 'list',
    defaultTimelineZoom = 'month',
    defaultPagination,
    onFiltersChange,
    onSelectionChange,
    onViewModeChange,
  } = options;

  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();

  // Refs for debouncing and preventing internal update loops
  const updateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInternalUpdateRef = useRef(false);

  // Compute default values
  const computedDefaultFilters: ScanHistoryFilters = useMemo(
    () => ({
      ...DEFAULT_SCAN_HISTORY_FILTERS,
      ...defaultFilters,
    }),
    [defaultFilters]
  );

  const computedDefaultPagination = useMemo(
    () => ({
      page: defaultPagination?.page ?? DEFAULT_PAGINATION_STATE.page,
      limit: defaultPagination?.limit ?? DEFAULT_PAGINATION_STATE.limit,
    }),
    [defaultPagination]
  );

  // Parse initial state from URL (only on mount)
  const initialState = useMemo(() => {
    const urlFilters = parseFilters(searchParams);
    const mergedFilters: ScanHistoryFilters = {
      ...computedDefaultFilters,
      ...urlFilters,
    };

    // Only use URL values if they were actually present
    // For fields not in URL, use defaults
    if (!searchParams.has(URL_PARAM_KEYS.repositories)) {
      mergedFilters.repositories = computedDefaultFilters.repositories;
    }
    if (!searchParams.has(URL_PARAM_KEYS.statuses)) {
      mergedFilters.statuses = computedDefaultFilters.statuses;
    }
    if (!searchParams.has(URL_PARAM_KEYS.search)) {
      mergedFilters.searchQuery = computedDefaultFilters.searchQuery;
    }

    return {
      filters: mergedFilters,
      pagination: parsePagination(searchParams, computedDefaultPagination),
      viewMode: parseViewMode(searchParams.get(URL_PARAM_KEYS.viewMode)),
      timelineZoom: parseTimelineZoom(searchParams.get(URL_PARAM_KEYS.timelineZoom)),
      selectedScanId: parseScanId(searchParams.get(URL_PARAM_KEYS.selectedScan)),
      compareScanId: parseScanId(searchParams.get(URL_PARAM_KEYS.compareScan)),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only compute on mount

  // State
  const [filters, setFiltersState] = useState<ScanHistoryFilters>(initialState.filters);
  const [pagination, setPaginationState] = useState(initialState.pagination);
  const [viewMode, setViewModeState] = useState<ViewMode>(initialState.viewMode);
  const [timelineZoom, setTimelineZoomState] = useState<TimelineZoom>(initialState.timelineZoom);
  const [selectedScanId, setSelectedScanIdState] = useState<ScanId | null>(
    initialState.selectedScanId
  );
  const [compareScanId, setCompareScanIdState] = useState<ScanId | null>(
    initialState.compareScanId
  );

  // Handle browser back/forward navigation (popstate)
  useEffect(() => {
    if (!enabled) return;

    const handlePopState = () => {
      // Skip if this was triggered by our own URL update
      if (isInternalUpdateRef.current) {
        isInternalUpdateRef.current = false;
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const urlFilters = parseFilters(params);
      const newFilters: ScanHistoryFilters = {
        ...computedDefaultFilters,
        ...urlFilters,
      };

      setFiltersState(newFilters);
      setPaginationState(parsePagination(params, computedDefaultPagination));
      setViewModeState(parseViewMode(params.get(URL_PARAM_KEYS.viewMode)));
      setTimelineZoomState(parseTimelineZoom(params.get(URL_PARAM_KEYS.timelineZoom)));
      setSelectedScanIdState(parseScanId(params.get(URL_PARAM_KEYS.selectedScan)));
      setCompareScanIdState(parseScanId(params.get(URL_PARAM_KEYS.compareScan)));

      // Notify callbacks
      onFiltersChange?.(newFilters);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [enabled, computedDefaultFilters, computedDefaultPagination, onFiltersChange]);

  // Debounced URL update function
  const updateUrl = useCallback(
    (
      newFilters: ScanHistoryFilters,
      newPagination: Pick<PaginationState, 'page' | 'limit'>,
      newViewMode: ViewMode,
      newTimelineZoom: TimelineZoom,
      newSelectedScanId: ScanId | null,
      newCompareScanId: ScanId | null
    ) => {
      if (!enabled) return;

      // Clear any pending update
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }

      updateTimeoutRef.current = setTimeout(() => {
        isInternalUpdateRef.current = true;

        const params = serializeState(
          newFilters,
          newPagination,
          newViewMode,
          newTimelineZoom,
          newSelectedScanId,
          newCompareScanId,
          {
            pagination: computedDefaultPagination,
            viewMode: defaultViewMode,
            timelineZoom: defaultTimelineZoom,
          }
        );

        setSearchParams(params, { replace: replaceState });
      }, debounceMs);
    },
    [
      enabled,
      debounceMs,
      replaceState,
      setSearchParams,
      computedDefaultPagination,
      defaultViewMode,
      defaultTimelineZoom,
    ]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  // ========================================================================
  // Filter Actions
  // ========================================================================

  const setFilters = useCallback(
    (newFilters: ScanHistoryFilters) => {
      setFiltersState(newFilters);
      // Reset to page 1 when filters change
      const resetPagination = { ...pagination, page: 1 };
      setPaginationState(resetPagination);
      updateUrl(
        newFilters,
        resetPagination,
        viewMode,
        timelineZoom,
        selectedScanId,
        compareScanId
      );
      onFiltersChange?.(newFilters);
    },
    [
      pagination,
      viewMode,
      timelineZoom,
      selectedScanId,
      compareScanId,
      updateUrl,
      onFiltersChange,
    ]
  );

  const updateFilter = useCallback(
    <K extends keyof ScanHistoryFilters>(key: K, value: ScanHistoryFilters[K]) => {
      setFiltersState((prev) => {
        const next = { ...prev, [key]: value };
        // Reset to page 1 when filters change
        const resetPagination = { ...pagination, page: 1 };
        setPaginationState(resetPagination);
        updateUrl(
          next,
          resetPagination,
          viewMode,
          timelineZoom,
          selectedScanId,
          compareScanId
        );
        onFiltersChange?.(next);
        return next;
      });
    },
    [pagination, viewMode, timelineZoom, selectedScanId, compareScanId, updateUrl, onFiltersChange]
  );

  const resetFilters = useCallback(() => {
    const reset = { ...computedDefaultFilters };
    const resetPagination = { ...computedDefaultPagination };
    setFiltersState(reset);
    setPaginationState(resetPagination);
    updateUrl(
      reset,
      resetPagination,
      viewMode,
      timelineZoom,
      selectedScanId,
      compareScanId
    );
    onFiltersChange?.(reset);
  }, [
    computedDefaultFilters,
    computedDefaultPagination,
    viewMode,
    timelineZoom,
    selectedScanId,
    compareScanId,
    updateUrl,
    onFiltersChange,
  ]);

  // ========================================================================
  // Selection Actions
  // ========================================================================

  const setSelectedScanId = useCallback(
    (id: ScanId | null) => {
      setSelectedScanIdState(id);
      updateUrl(filters, pagination, viewMode, timelineZoom, id, compareScanId);
      onSelectionChange?.(id);
    },
    [filters, pagination, viewMode, timelineZoom, compareScanId, updateUrl, onSelectionChange]
  );

  const setCompareScanId = useCallback(
    (id: ScanId | null) => {
      setCompareScanIdState(id);
      updateUrl(filters, pagination, viewMode, timelineZoom, selectedScanId, id);
    },
    [filters, pagination, viewMode, timelineZoom, selectedScanId, updateUrl]
  );

  // ========================================================================
  // View Actions
  // ========================================================================

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setViewModeState(mode);
      updateUrl(filters, pagination, mode, timelineZoom, selectedScanId, compareScanId);
      onViewModeChange?.(mode);
    },
    [filters, pagination, timelineZoom, selectedScanId, compareScanId, updateUrl, onViewModeChange]
  );

  const setTimelineZoom = useCallback(
    (zoom: TimelineZoom) => {
      setTimelineZoomState(zoom);
      updateUrl(filters, pagination, viewMode, zoom, selectedScanId, compareScanId);
    },
    [filters, pagination, viewMode, selectedScanId, compareScanId, updateUrl]
  );

  // ========================================================================
  // Pagination Actions
  // ========================================================================

  const setPage = useCallback(
    (page: number) => {
      const newPagination = { ...pagination, page };
      setPaginationState(newPagination);
      updateUrl(filters, newPagination, viewMode, timelineZoom, selectedScanId, compareScanId);
    },
    [filters, pagination, viewMode, timelineZoom, selectedScanId, compareScanId, updateUrl]
  );

  const setLimit = useCallback(
    (limit: number) => {
      // Reset to page 1 when changing page size
      const newPagination = { page: 1, limit };
      setPaginationState(newPagination);
      updateUrl(filters, newPagination, viewMode, timelineZoom, selectedScanId, compareScanId);
    },
    [filters, viewMode, timelineZoom, selectedScanId, compareScanId, updateUrl]
  );

  // ========================================================================
  // Utility Actions
  // ========================================================================

  const clearUrlState = useCallback(() => {
    setFiltersState({ ...computedDefaultFilters });
    setPaginationState({ ...computedDefaultPagination });
    setViewModeState(defaultViewMode);
    setTimelineZoomState(defaultTimelineZoom);
    setSelectedScanIdState(null);
    setCompareScanIdState(null);

    if (enabled) {
      setSearchParams(new URLSearchParams(), { replace: true });
    }
  }, [
    enabled,
    computedDefaultFilters,
    computedDefaultPagination,
    defaultViewMode,
    defaultTimelineZoom,
    setSearchParams,
  ]);

  const getShareableUrl = useCallback(() => {
    const params = serializeState(
      filters,
      pagination,
      viewMode,
      timelineZoom,
      selectedScanId,
      compareScanId,
      {
        pagination: computedDefaultPagination,
        viewMode: defaultViewMode,
        timelineZoom: defaultTimelineZoom,
      }
    );

    const base = `${window.location.origin}${location.pathname}`;
    const query = params.toString();
    return query ? `${base}?${query}` : base;
  }, [
    filters,
    pagination,
    viewMode,
    timelineZoom,
    selectedScanId,
    compareScanId,
    computedDefaultPagination,
    defaultViewMode,
    defaultTimelineZoom,
    location.pathname,
  ]);

  // ========================================================================
  // Computed Values
  // ========================================================================

  const hasActiveFilters = useMemo(() => checkActiveFilters(filters), [filters]);

  // ========================================================================
  // Return
  // ========================================================================

  return {
    // State
    filters,
    selectedScanId,
    compareScanId,
    viewMode,
    timelineZoom,
    pagination,
    // Filter actions
    setFilters,
    updateFilter,
    resetFilters,
    // Selection actions
    setSelectedScanId,
    setCompareScanId,
    // View actions
    setViewMode,
    setTimelineZoom,
    // Pagination actions
    setPage,
    setLimit,
    // Utilities
    getShareableUrl,
    hasActiveFilters,
    clearUrlState,
  };
}

export default useScanHistoryUrlState;
