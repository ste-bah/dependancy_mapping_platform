/**
 * Scan History Types Index
 * Barrel export for all scan history type definitions
 * @module features/scan-history/types
 */

// ============================================================================
// Domain Types
// ============================================================================

export type {
  // Branded types
  ScanId,
  RepositoryId,

  // Status type
  ScanStatus,

  // Core entities
  ScanMetrics,
  Scan,

  // Value objects
  DateRange,
  ScanHistoryFilters,

  // Preset type
  DateRangePreset,
} from './domain';

export {
  // Type guards
  isScanId,
  isRepositoryId,
  isScanStatus,
  isScan,

  // Factory functions
  createScanId,
  createRepositoryId,
  createDateRange,

  // Constants
  ALL_SCAN_STATUSES,
  DEFAULT_SCAN_HISTORY_FILTERS,
  SCAN_STATUS_COLORS,
  SCAN_STATUS_LABELS,
  DATE_RANGE_PRESETS,
} from './domain';

// ============================================================================
// API Types
// ============================================================================

export type {
  // Request types
  FetchScanHistoryRequest,
  CreateScanDiffRequest,
  ExportScansRequest,

  // Response types
  ScanHistoryResponse,
  DiffMetrics,
  MetricComparison,
  ScanMetricsDiff,
  ScanDiff,
  ScanDiffResponse,
  ExportResponse,

  // Timeline types
  TimelineDataPoint,
  TimelineDataResponse,

  // Query key types
  ScanHistoryQueryKey,
  ScanDetailQueryKey,
  ScanDiffQueryKey,
  TimelineQueryKey,

  // Error types
  ScanHistoryErrorCode,
  ScanHistoryError,

  // Response wrapper
  ApiResponse,
} from './api';

export {
  // Error codes
  ScanHistoryErrorCodes,

  // Type guards
  isScanHistoryError,
} from './api';

// ============================================================================
// Store Types
// ============================================================================

export type {
  // Pagination
  PaginationState,

  // Timeline
  TimelineZoom,
  TimelineViewState,

  // Comparison
  ComparisonSelection,

  // Export
  ExportFormat,
  ExportState,

  // Sort
  SortField,
  SortDirection,
  SortState,

  // View
  ViewMode,

  // Full store types
  ScanHistoryState,
  ScanHistoryActions,
  ScanHistoryStore,
} from './store';

export {
  // Default states
  DEFAULT_PAGINATION_STATE,
  DEFAULT_COMPARISON_SELECTION,
  DEFAULT_EXPORT_STATE,
  DEFAULT_SORT_STATE,
  INITIAL_SCAN_HISTORY_STATE,

  // Constants
  ALL_TIMELINE_ZOOMS,
  ALL_EXPORT_FORMATS,
} from './store';

// ============================================================================
// Component Props Types
// ============================================================================

export type {
  // Page props
  ScanHistoryPageProps,

  // Timeline props
  ScanTimelineChartProps,
  TimelineDataPointProps,

  // List props
  ScanListTableProps,
  ScanRowProps,

  // Filter props
  ScanFilterPanelProps,
  StatusFilterProps,
  RepositoryFilterProps,

  // Comparison props
  ScanComparisonPanelProps,
  MetricDiffDisplayProps,

  // Date picker props
  DateRangePickerProps,

  // Export props
  ExportButtonProps,
  ExportFormatSelectorProps,

  // View toggle props
  ViewModeToggleProps,

  // State props
  ScanHistoryLoadingProps,
  ScanHistoryErrorProps,
  ScanHistoryEmptyProps,

  // Detail props
  ScanDetailPanelProps,
  ScanMetricsCardProps,

  // Toolbar props
  ScanHistoryToolbarProps,
} from './components';

// ============================================================================
// Hook Types
// ============================================================================

export type {
  // useScanHistory
  UseScanHistoryOptions,
  UseScanHistoryReturn,

  // useScanDetail
  UseScanDetailOptions,
  UseScanDetailReturn,

  // useScanDiff
  UseScanDiffOptions,
  UseScanDiffReturn,

  // useScanFilters
  UseScanFiltersOptions,
  UseScanFiltersReturn,

  // useScanSort
  UseScanSortOptions,
  UseScanSortReturn,

  // useScanPagination
  UseScanPaginationOptions,
  UseScanPaginationReturn,

  // useScanTimeline
  UseScanTimelineOptions,
  UseScanTimelineReturn,

  // useScanExport
  UseScanExportOptions,
  UseScanExportReturn,

  // useScanComparison
  UseScanComparisonOptions,
  UseScanComparisonReturn,

  // useScanSelection
  UseScanSelectionOptions,
  UseScanSelectionReturn,

  // useScanUrlState
  ScanHistoryUrlState,
  UseScanUrlStateOptions,
  UseScanUrlStateReturn,
} from './hooks';
