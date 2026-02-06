/**
 * Scan History Hook Types
 * Type definitions for custom hooks
 * @module features/scan-history/types/hooks
 */

import type { ScanId, Scan, ScanHistoryFilters, DateRange } from './domain';
import type {
  FetchScanHistoryRequest,
  ScanDiff,
  TimelineDataPoint,
} from './api';
import type {
  PaginationState,
  TimelineZoom,
  ExportFormat,
  SortField,
  SortDirection,
} from './store';

// ============================================================================
// useScanHistory Hook Types
// ============================================================================

/**
 * Options for useScanHistory hook
 */
export interface UseScanHistoryOptions {
  /** Request parameters for fetching */
  params?: FetchScanHistoryRequest;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Cache stale time in milliseconds */
  staleTime?: number;
  /** Refetch on window focus */
  refetchOnWindowFocus?: boolean;
  /** Refetch on mount */
  refetchOnMount?: boolean;
  /** Retry count on failure */
  retryCount?: number;
}

/**
 * Return type for useScanHistory hook
 */
export interface UseScanHistoryReturn {
  /** Array of loaded scans */
  scans: Scan[];
  /** Current pagination state */
  pagination: PaginationState;
  /** Initial loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Background fetching state */
  isFetching: boolean;
  /** Refetch function */
  refetch: () => void;
  /** Fetch next page (for infinite scroll) */
  fetchNextPage: () => void;
  /** Whether next page is available */
  hasNextPage: boolean;
  /** Whether next page is being fetched */
  isFetchingNextPage: boolean;
}

// ============================================================================
// useScanDetail Hook Types
// ============================================================================

/**
 * Options for useScanDetail hook
 */
export interface UseScanDetailOptions {
  /** Scan ID to fetch details for */
  scanId: ScanId | null;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Include related scans in response */
  includeRelated?: boolean;
}

/**
 * Return type for useScanDetail hook
 */
export interface UseScanDetailReturn {
  /** Scan detail data */
  scan: Scan | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Refetch function */
  refetch: () => void;
}

// ============================================================================
// useScanDiff Hook Types
// ============================================================================

/**
 * Options for useScanDiff hook
 */
export interface UseScanDiffOptions {
  /** Baseline scan ID */
  baselineScanId: ScanId | null;
  /** Comparison scan ID */
  comparisonScanId: ScanId | null;
  /** Enable/disable the query */
  enabled?: boolean;
  /** Include unchanged items in diff */
  includeUnchanged?: boolean;
  /** Include detailed metrics diff */
  includeMetricsDiff?: boolean;
}

/**
 * Return type for useScanDiff hook
 */
export interface UseScanDiffReturn {
  /** Computed diff */
  diff: ScanDiff | null;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Manually trigger diff computation */
  compute: () => void;
  /** Clear cached diff */
  clear: () => void;
}

// ============================================================================
// useScanFilters Hook Types
// ============================================================================

/**
 * Options for useScanFilters hook
 */
export interface UseScanFiltersOptions {
  /** Initial filter values */
  initialFilters?: Partial<ScanHistoryFilters>;
  /** Persist to URL search params */
  persistToUrl?: boolean;
  /** Debounce delay for search in ms */
  searchDebounce?: number;
  /** Callback when filters change */
  onFiltersChange?: (filters: ScanHistoryFilters) => void;
}

/**
 * Return type for useScanFilters hook
 */
export interface UseScanFiltersReturn {
  /** Current filters */
  filters: ScanHistoryFilters;
  /** Set date range filter */
  setDateRange: (range: DateRange | null) => void;
  /** Set repositories filter */
  setRepositories: (ids: string[]) => void;
  /** Set statuses filter */
  setStatuses: (statuses: string[]) => void;
  /** Set search query */
  setSearchQuery: (query: string) => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Whether any filters are active */
  hasActiveFilters: boolean;
  /** Count of active filters */
  activeFilterCount: number;
  /** Debounced search query */
  debouncedSearchQuery: string;
}

// ============================================================================
// useScanSort Hook Types
// ============================================================================

/**
 * Options for useScanSort hook
 */
export interface UseScanSortOptions {
  /** Initial sort field */
  initialField?: SortField;
  /** Initial sort direction */
  initialDirection?: SortDirection;
  /** Persist to URL */
  persistToUrl?: boolean;
  /** Callback when sort changes */
  onSortChange?: (field: SortField, direction: SortDirection) => void;
}

/**
 * Return type for useScanSort hook
 */
export interface UseScanSortReturn {
  /** Current sort field */
  sortField: SortField;
  /** Current sort direction */
  sortDirection: SortDirection;
  /** Set sort field */
  setSortField: (field: SortField) => void;
  /** Set sort direction */
  setSortDirection: (direction: SortDirection) => void;
  /** Toggle sort direction */
  toggleDirection: () => void;
  /** Set both field and direction */
  setSort: (field: SortField, direction: SortDirection) => void;
  /** Reset to defaults */
  resetSort: () => void;
}

// ============================================================================
// useScanPagination Hook Types
// ============================================================================

/**
 * Options for useScanPagination hook
 */
export interface UseScanPaginationOptions {
  /** Initial page number */
  initialPage?: number;
  /** Initial page size */
  initialLimit?: number;
  /** Total items (for calculating page count) */
  totalItems?: number;
  /** Persist to URL */
  persistToUrl?: boolean;
  /** Callback when pagination changes */
  onPageChange?: (page: number, limit: number) => void;
}

/**
 * Return type for useScanPagination hook
 */
export interface UseScanPaginationReturn {
  /** Current page (1-indexed) */
  page: number;
  /** Current page size */
  limit: number;
  /** Total number of items */
  total: number;
  /** Total number of pages */
  pageCount: number;
  /** Whether there's a next page */
  hasNextPage: boolean;
  /** Whether there's a previous page */
  hasPreviousPage: boolean;
  /** Go to specific page */
  goToPage: (page: number) => void;
  /** Go to next page */
  nextPage: () => void;
  /** Go to previous page */
  previousPage: () => void;
  /** Set page size */
  setLimit: (limit: number) => void;
  /** Update total (usually from API response) */
  setTotal: (total: number) => void;
  /** Reset to first page */
  resetPagination: () => void;
}

// ============================================================================
// useScanTimeline Hook Types
// ============================================================================

/**
 * Options for useScanTimeline hook
 */
export interface UseScanTimelineOptions {
  /** Date range to fetch data for */
  dateRange: DateRange;
  /** Repository filter */
  repositoryIds?: string[];
  /** Status filter */
  statuses?: string[];
  /** Enable/disable query */
  enabled?: boolean;
}

/**
 * Return type for useScanTimeline hook
 */
export interface UseScanTimelineReturn {
  /** Timeline data points */
  dataPoints: TimelineDataPoint[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Current zoom level */
  zoom: TimelineZoom;
  /** Set zoom level */
  setZoom: (zoom: TimelineZoom) => void;
  /** Visible date range */
  visibleRange: DateRange;
  /** Set visible range (pan/zoom) */
  setVisibleRange: (range: DateRange) => void;
  /** Refetch data */
  refetch: () => void;
}

// ============================================================================
// useScanExport Hook Types
// ============================================================================

/**
 * Options for useScanExport hook
 */
export interface UseScanExportOptions {
  /** Scans to export */
  scanIds: ScanId[];
  /** Default filename */
  defaultFilename?: string;
  /** Callback on successful export */
  onSuccess?: (format: ExportFormat, filename: string) => void;
  /** Callback on export error */
  onError?: (error: Error) => void;
}

/**
 * Return type for useScanExport hook
 */
export interface UseScanExportReturn {
  /** Trigger export */
  exportScans: (format: ExportFormat) => Promise<void>;
  /** Cancel ongoing export */
  cancelExport: () => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Current export progress (0-100) */
  progress: number;
  /** Export error */
  error: Error | null;
  /** Last successful export filename */
  lastExportedFile: string | null;
}

// ============================================================================
// useScanComparison Hook Types
// ============================================================================

/**
 * Options for useScanComparison hook
 */
export interface UseScanComparisonOptions {
  /** Initial baseline scan ID */
  initialBaselineId?: ScanId;
  /** Initial comparison scan ID */
  initialComparisonId?: ScanId;
  /** Auto-compute diff when both scans selected */
  autoCompute?: boolean;
  /** Callback when comparison changes */
  onComparisonChange?: (baselineId: ScanId | null, comparisonId: ScanId | null) => void;
}

/**
 * Return type for useScanComparison hook
 */
export interface UseScanComparisonReturn {
  /** Baseline scan ID */
  baselineId: ScanId | null;
  /** Comparison scan ID */
  comparisonId: ScanId | null;
  /** Baseline scan data */
  baselineScan: Scan | null;
  /** Comparison scan data */
  comparisonScan: Scan | null;
  /** Computed diff */
  diff: ScanDiff | null;
  /** Whether comparison mode is active */
  isComparing: boolean;
  /** Whether diff is being computed */
  isLoadingDiff: boolean;
  /** Set baseline scan */
  setBaseline: (scanId: ScanId | null) => void;
  /** Set comparison scan */
  setComparison: (scanId: ScanId | null) => void;
  /** Swap baseline and comparison */
  swapScans: () => void;
  /** Clear comparison selection */
  clearComparison: () => void;
  /** Manually trigger diff computation */
  computeDiff: () => void;
}

// ============================================================================
// useScanSelection Hook Types
// ============================================================================

/**
 * Options for useScanSelection hook
 */
export interface UseScanSelectionOptions {
  /** Allow multi-select */
  multiSelect?: boolean;
  /** Maximum selections allowed */
  maxSelections?: number;
  /** Initial selection */
  initialSelection?: ScanId[];
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: ScanId[]) => void;
}

/**
 * Return type for useScanSelection hook
 */
export interface UseScanSelectionReturn {
  /** Set of selected scan IDs */
  selectedIds: Set<ScanId>;
  /** Select a scan */
  select: (scanId: ScanId) => void;
  /** Deselect a scan */
  deselect: (scanId: ScanId) => void;
  /** Toggle scan selection */
  toggle: (scanId: ScanId) => void;
  /** Select multiple scans */
  selectMany: (scanIds: ScanId[]) => void;
  /** Select all provided scans */
  selectAll: (scanIds: ScanId[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Check if scan is selected */
  isSelected: (scanId: ScanId) => boolean;
  /** Number of selected items */
  selectionCount: number;
  /** Whether max selections reached */
  isMaxReached: boolean;
}

// ============================================================================
// useScanUrlState Hook Types
// ============================================================================

/**
 * URL state shape for scan history
 */
export interface ScanHistoryUrlState {
  /** Current page */
  page?: number;
  /** Page size */
  limit?: number;
  /** Sort field */
  sortBy?: SortField;
  /** Sort direction */
  sortOrder?: SortDirection;
  /** Date range start */
  dateStart?: string;
  /** Date range end */
  dateEnd?: string;
  /** Selected repositories (comma-separated) */
  repos?: string;
  /** Selected statuses (comma-separated) */
  statuses?: string;
  /** Search query */
  q?: string;
  /** View mode */
  view?: string;
  /** Selected scan ID */
  selected?: string;
}

/**
 * Options for useScanUrlState hook
 */
export interface UseScanUrlStateOptions {
  /** Keys to persist to URL */
  keys?: (keyof ScanHistoryUrlState)[];
  /** Debounce delay for URL updates */
  debounce?: number;
}

/**
 * Return type for useScanUrlState hook
 */
export interface UseScanUrlStateReturn {
  /** Current URL state */
  state: ScanHistoryUrlState;
  /** Set URL state */
  setState: (state: Partial<ScanHistoryUrlState>) => void;
  /** Clear URL state */
  clearState: () => void;
  /** Get typed state value */
  getParam: <K extends keyof ScanHistoryUrlState>(key: K) => ScanHistoryUrlState[K];
  /** Set single param */
  setParam: <K extends keyof ScanHistoryUrlState>(key: K, value: ScanHistoryUrlState[K]) => void;
}
