/**
 * Scan History Store Types
 * Type definitions for state management
 * @module features/scan-history/types/store
 */

import type {
  ScanId,
  RepositoryId,
  Scan,
  ScanHistoryFilters,
  DateRange,
  ScanStatus,
} from './domain';
import type { ScanDiff, FetchScanHistoryRequest } from './api';

// ============================================================================
// Pagination State
// ============================================================================

/**
 * Pagination state for scan history list
 */
export interface PaginationState {
  /** Current page number (1-indexed) */
  page: number;
  /** Number of items per page */
  limit: number;
  /** Total number of items across all pages */
  total: number;
  /** Whether more pages are available */
  hasMore: boolean;
}

/**
 * Default pagination state
 */
export const DEFAULT_PAGINATION_STATE: PaginationState = {
  page: 1,
  limit: 20,
  total: 0,
  hasMore: false,
};

// ============================================================================
// Timeline State
// ============================================================================

/**
 * Available zoom levels for timeline visualization
 */
export type TimelineZoom = 'day' | 'week' | 'month' | 'quarter' | 'year';

/**
 * All available timeline zoom levels
 */
export const ALL_TIMELINE_ZOOMS: readonly TimelineZoom[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;

/**
 * State for timeline view configuration
 */
export interface TimelineViewState {
  /** Current zoom level */
  zoom: TimelineZoom;
  /** Currently visible date range */
  visibleRange: DateRange;
  /** Horizontal scroll position (percentage 0-100) */
  scrollPosition: number;
}

// ============================================================================
// Comparison State
// ============================================================================

/**
 * State for scan comparison feature
 */
export interface ComparisonSelection {
  /** ID of the baseline (older) scan */
  baselineScanId: ScanId | null;
  /** ID of the comparison (newer) scan */
  comparisonScanId: ScanId | null;
  /** Whether comparison mode is active */
  isComparing: boolean;
}

/**
 * Default comparison selection state
 */
export const DEFAULT_COMPARISON_SELECTION: ComparisonSelection = {
  baselineScanId: null,
  comparisonScanId: null,
  isComparing: false,
};

// ============================================================================
// Export State
// ============================================================================

/**
 * Available export formats
 */
export type ExportFormat = 'csv' | 'json' | 'pdf';

/**
 * All available export formats
 */
export const ALL_EXPORT_FORMATS: readonly ExportFormat[] = [
  'csv',
  'json',
  'pdf',
] as const;

/**
 * State for export operation
 */
export interface ExportState {
  /** Whether an export is currently in progress */
  isExporting: boolean;
  /** Format being exported (null if not exporting) */
  format: ExportFormat | null;
  /** Export progress percentage (0-100) */
  progress: number;
  /** Error message if export failed */
  error: string | null;
}

/**
 * Default export state
 */
export const DEFAULT_EXPORT_STATE: ExportState = {
  isExporting: false,
  format: null,
  progress: 0,
  error: null,
};

// ============================================================================
// Sort State
// ============================================================================

/**
 * Available sort fields for scan list
 */
export type SortField = 'startedAt' | 'completedAt' | 'duration' | 'issuesFound';

/**
 * Sort direction
 */
export type SortDirection = 'asc' | 'desc';

/**
 * Sort configuration state
 */
export interface SortState {
  /** Field to sort by */
  field: SortField;
  /** Sort direction */
  direction: SortDirection;
}

/**
 * Default sort state
 */
export const DEFAULT_SORT_STATE: SortState = {
  field: 'startedAt',
  direction: 'desc',
};

// ============================================================================
// View Mode State
// ============================================================================

/**
 * Available view modes for scan history
 */
export type ViewMode = 'list' | 'timeline';

// ============================================================================
// Full Store State
// ============================================================================

/**
 * Complete state for scan history feature
 */
export interface ScanHistoryState {
  // Data state
  /** Array of loaded scans */
  scans: Scan[];
  /** Currently selected scan ID */
  selectedScanId: ScanId | null;
  /** Selected scan details (hydrated object) */
  selectedScan: Scan | null;

  // View state
  /** Current view mode */
  viewMode: ViewMode;
  /** Timeline view configuration */
  timelineView: TimelineViewState;

  // Filter state
  /** Current filter configuration */
  filters: ScanHistoryFilters;

  // Sort state
  /** Current sort configuration */
  sort: SortState;

  // Pagination state
  /** Current pagination state */
  pagination: PaginationState;

  // Comparison state
  /** Scan comparison selection */
  comparison: ComparisonSelection;
  /** Computed diff between selected scans */
  diff: ScanDiff | null;

  // Export state
  /** Export operation state */
  export: ExportState;

  // Loading states
  /** Whether initial data is loading */
  isLoading: boolean;
  /** Whether data is being fetched (including background) */
  isFetching: boolean;
  /** Whether diff is being computed */
  isLoadingDiff: boolean;

  // Error state
  /** Current error (null if no error) */
  error: string | null;
}

// ============================================================================
// Store Actions
// ============================================================================

/**
 * Actions available on the scan history store
 */
export interface ScanHistoryActions {
  // Data actions
  /** Set the list of scans */
  setScans: (scans: Scan[]) => void;
  /** Append more scans (for infinite scroll) */
  appendScans: (scans: Scan[]) => void;
  /** Clear all loaded scans */
  clearScans: () => void;

  // Selection actions
  /** Select a scan by ID */
  selectScan: (scanId: ScanId | null) => void;
  /** Clear current selection */
  clearSelection: () => void;

  // View actions
  /** Switch between list and timeline view */
  setViewMode: (mode: ViewMode) => void;
  /** Update timeline zoom level */
  setTimelineZoom: (zoom: TimelineZoom) => void;
  /** Update timeline visible range */
  setTimelineRange: (range: DateRange) => void;
  /** Update timeline scroll position */
  setTimelineScroll: (position: number) => void;

  // Filter actions
  /** Update filter state */
  setFilters: (filters: Partial<ScanHistoryFilters>) => void;
  /** Set date range filter */
  setDateRange: (range: DateRange | null) => void;
  /** Set repository filter */
  setRepositories: (repositories: RepositoryId[]) => void;
  /** Set status filter */
  setStatuses: (statuses: ScanStatus[]) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Reset all filters to defaults */
  resetFilters: () => void;

  // Sort actions
  /** Set sort field */
  setSortField: (field: SortField) => void;
  /** Set sort direction */
  setSortDirection: (direction: SortDirection) => void;
  /** Toggle sort direction */
  toggleSortDirection: () => void;

  // Pagination actions
  /** Set current page */
  setPage: (page: number) => void;
  /** Set page size */
  setLimit: (limit: number) => void;
  /** Update pagination from response */
  updatePagination: (pagination: Partial<PaginationState>) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  previousPage: () => void;

  // Comparison actions
  /** Select baseline scan for comparison */
  setBaselineScan: (scanId: ScanId | null) => void;
  /** Select comparison scan */
  setComparisonScan: (scanId: ScanId | null) => void;
  /** Swap baseline and comparison scans */
  swapComparisonScans: () => void;
  /** Enable/disable comparison mode */
  setComparing: (isComparing: boolean) => void;
  /** Clear comparison selection */
  clearComparison: () => void;
  /** Set computed diff result */
  setDiff: (diff: ScanDiff | null) => void;

  // Export actions
  /** Start export with given format */
  startExport: (format: ExportFormat) => void;
  /** Update export progress */
  setExportProgress: (progress: number) => void;
  /** Complete export */
  completeExport: () => void;
  /** Set export error */
  setExportError: (error: string | null) => void;
  /** Cancel current export */
  cancelExport: () => void;

  // Loading state actions
  /** Set loading state */
  setLoading: (isLoading: boolean) => void;
  /** Set fetching state */
  setFetching: (isFetching: boolean) => void;
  /** Set diff loading state */
  setLoadingDiff: (isLoading: boolean) => void;

  // Error actions
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear error state */
  clearError: () => void;

  // Derived/computed actions
  /** Get current request params from state */
  getRequestParams: () => FetchScanHistoryRequest;
  /** Reset entire store to initial state */
  reset: () => void;
}

/**
 * Combined store type (state + actions)
 */
export type ScanHistoryStore = ScanHistoryState & ScanHistoryActions;

// ============================================================================
// Initial State
// ============================================================================

/**
 * Initial state for the scan history store
 */
export const INITIAL_SCAN_HISTORY_STATE: ScanHistoryState = {
  scans: [],
  selectedScanId: null,
  selectedScan: null,
  viewMode: 'list',
  timelineView: {
    zoom: 'week',
    visibleRange: {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    },
    scrollPosition: 100,
  },
  filters: {
    dateRange: null,
    repositories: [],
    statuses: [],
    searchQuery: '',
  },
  sort: DEFAULT_SORT_STATE,
  pagination: DEFAULT_PAGINATION_STATE,
  comparison: DEFAULT_COMPARISON_SELECTION,
  diff: null,
  export: DEFAULT_EXPORT_STATE,
  isLoading: false,
  isFetching: false,
  isLoadingDiff: false,
  error: null,
};
