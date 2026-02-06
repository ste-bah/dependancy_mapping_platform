/**
 * Scan History Component Props Types
 * Type definitions for component props
 * @module features/scan-history/types/components
 */

import type { ReactNode } from 'react';
import type {
  ScanId,
  RepositoryId,
  Scan,
  ScanHistoryFilters,
  DateRange,
  ScanStatus,
} from './domain';
import type { ScanDiff, TimelineDataPoint } from './api';
import type {
  PaginationState,
  TimelineZoom,
  ExportFormat,
  ViewMode,
  SortField,
  SortDirection,
} from './store';

// ============================================================================
// Page Component Props
// ============================================================================

/**
 * Props for the main ScanHistoryPage component
 */
export interface ScanHistoryPageProps {
  /** Initial view mode */
  defaultView?: ViewMode;
  /** Initial scan ID to select */
  initialScanId?: ScanId;
  /** Initial repository filter */
  initialRepositoryId?: RepositoryId;
  /** Callback when navigation occurs */
  onNavigate?: (path: string) => void;
}

// ============================================================================
// Timeline Component Props
// ============================================================================

/**
 * Props for the ScanTimelineChart component
 */
export interface ScanTimelineChartProps {
  /** Timeline data points to render */
  data: TimelineDataPoint[];
  /** Current zoom level */
  zoom: TimelineZoom;
  /** Callback when zoom level changes */
  onZoomChange: (zoom: TimelineZoom) => void;
  /** Callback when visible date range changes */
  onDateRangeChange: (range: DateRange) => void;
  /** Currently selected scan ID */
  selectedScanId?: ScanId | null;
  /** Callback when a scan is selected from the timeline */
  onScanSelect?: (scanId: ScanId) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Chart height */
  height?: number;
  /** Show legend */
  showLegend?: boolean;
  /** Enable brush selection */
  enableBrush?: boolean;
  /** Enable zoom controls */
  enableZoomControls?: boolean;
}

/**
 * Props for individual timeline bar/point component
 */
export interface TimelineDataPointProps {
  /** The data point to render */
  dataPoint: TimelineDataPoint;
  /** Whether this point is selected */
  isSelected: boolean;
  /** Whether this point is hovered */
  isHovered: boolean;
  /** Callback when point is clicked */
  onClick: () => void;
  /** Callback when point is hovered */
  onHover: (hovered: boolean) => void;
}

// ============================================================================
// List Component Props
// ============================================================================

/**
 * Props for the ScanListTable component
 */
export interface ScanListTableProps {
  /** Array of scans to display */
  scans: Scan[];
  /** Currently selected scan ID */
  selectedScanId: ScanId | null;
  /** Callback when a scan row is selected */
  onScanSelect: (scanId: ScanId) => void;
  /** Callback when a scan is selected for comparison */
  onCompareSelect: (scanId: ScanId) => void;
  /** Loading state */
  isLoading?: boolean;
  /** Pagination state */
  pagination: PaginationState;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Current sort field */
  sortField?: SortField;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Callback when sort changes */
  onSortChange?: (field: SortField, direction: SortDirection) => void;
  /** Additional CSS class names */
  className?: string;
  /** Enable row selection checkboxes */
  enableSelection?: boolean;
  /** Selected row IDs (for multi-select) */
  selectedIds?: Set<ScanId>;
  /** Callback when selection changes */
  onSelectionChange?: (selectedIds: Set<ScanId>) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Show compact rows */
  compact?: boolean;
}

/**
 * Props for individual scan row component
 */
export interface ScanRowProps {
  /** Scan data to display */
  scan: Scan;
  /** Whether this row is selected */
  isSelected: boolean;
  /** Whether this row is selected for comparison */
  isCompareSelected: boolean;
  /** Callback when row is clicked */
  onClick: () => void;
  /** Callback when compare button is clicked */
  onCompareClick: () => void;
  /** Show compact layout */
  compact?: boolean;
}

// ============================================================================
// Filter Component Props
// ============================================================================

/**
 * Props for the ScanFilterPanel component
 */
export interface ScanFilterPanelProps {
  /** Current filter values */
  filters: ScanHistoryFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: ScanHistoryFilters) => void;
  /** Callback to reset all filters */
  onReset: () => void;
  /** Available repositories for filtering */
  repositories: Array<{ id: RepositoryId; name: string }>;
  /** Additional CSS class names */
  className?: string;
  /** Collapsed state */
  collapsed?: boolean;
  /** Callback when collapsed state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Show active filter count badge */
  showFilterCount?: boolean;
  /** Disable filter controls */
  disabled?: boolean;
}

/**
 * Props for status filter component
 */
export interface StatusFilterProps {
  /** Selected statuses */
  selectedStatuses: ScanStatus[];
  /** Callback when selection changes */
  onChange: (statuses: ScanStatus[]) => void;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Props for repository filter component
 */
export interface RepositoryFilterProps {
  /** Selected repository IDs */
  selectedRepositories: RepositoryId[];
  /** Available repositories */
  repositories: Array<{ id: RepositoryId; name: string }>;
  /** Callback when selection changes */
  onChange: (repositories: RepositoryId[]) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Enable search within dropdown */
  searchable?: boolean;
}

// ============================================================================
// Comparison Component Props
// ============================================================================

/**
 * Props for the ScanComparisonPanel component
 */
export interface ScanComparisonPanelProps {
  /** Baseline scan (older) */
  baseline: Scan | null;
  /** Comparison scan (newer) */
  comparison: Scan | null;
  /** Computed diff between scans */
  diff: ScanDiff | null;
  /** Whether diff is being computed */
  isLoading: boolean;
  /** Callback to swap baseline and comparison */
  onSwap: () => void;
  /** Callback to clear comparison selection */
  onClear: () => void;
  /** Callback when baseline scan is clicked */
  onBaselineClick?: () => void;
  /** Callback when comparison scan is clicked */
  onComparisonClick?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Show detailed metrics breakdown */
  showDetailedMetrics?: boolean;
}

/**
 * Props for metric diff display component
 */
export interface MetricDiffDisplayProps {
  /** Label for the metric */
  label: string;
  /** Value before (baseline) */
  before: number;
  /** Value after (comparison) */
  after: number;
  /** Delta value */
  delta: number;
  /** Whether increase is good (green) or bad (red) */
  increaseIsGood?: boolean;
  /** Format function for values */
  formatValue?: (value: number) => string;
}

// ============================================================================
// Date Range Component Props
// ============================================================================

/**
 * Props for the DateRangePicker component
 */
export interface DateRangePickerProps {
  /** Current selected date range */
  value: DateRange | null;
  /** Callback when date range changes */
  onChange: (range: DateRange | null) => void;
  /** Quick selection presets */
  presets?: Array<{ label: string; range: DateRange }>;
  /** Minimum selectable date */
  minDate?: Date;
  /** Maximum selectable date */
  maxDate?: Date;
  /** Additional CSS class names */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Format for displaying dates */
  dateFormat?: string;
  /** Show clear button */
  clearable?: boolean;
}

// ============================================================================
// Export Component Props
// ============================================================================

/**
 * Props for the ExportButton component
 */
export interface ExportButtonProps {
  /** Callback to trigger export */
  onExport: (format: ExportFormat) => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress percentage (0-100) */
  progress: number;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
  /** Available formats */
  formats?: ExportFormat[];
  /** Button size variant */
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Props for export format selector
 */
export interface ExportFormatSelectorProps {
  /** Selected format */
  selectedFormat: ExportFormat | null;
  /** Callback when format is selected */
  onSelect: (format: ExportFormat) => void;
  /** Available formats */
  formats: ExportFormat[];
  /** Disabled state */
  disabled?: boolean;
}

// ============================================================================
// View Toggle Component Props
// ============================================================================

/**
 * Props for view mode toggle component
 */
export interface ViewModeToggleProps {
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback when view mode changes */
  onChange: (mode: ViewMode) => void;
  /** Disabled state */
  disabled?: boolean;
  /** Additional CSS class names */
  className?: string;
}

// ============================================================================
// Empty/Loading/Error State Props
// ============================================================================

/**
 * Props for scan history loading skeleton
 */
export interface ScanHistoryLoadingProps {
  /** View mode to show skeleton for */
  viewMode: ViewMode;
  /** Number of skeleton rows/items */
  count?: number;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for scan history error state
 */
export interface ScanHistoryErrorProps {
  /** Error message or Error object */
  error: Error | string;
  /** Callback to retry failed operation */
  onRetry?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Props for scan history empty state
 */
export interface ScanHistoryEmptyProps {
  /** Empty state title */
  title?: string;
  /** Empty state message */
  message?: string;
  /** Whether filters are active (affects messaging) */
  hasActiveFilters?: boolean;
  /** Callback to clear filters */
  onClearFilters?: () => void;
  /** Callback to trigger scan */
  onStartScan?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Custom icon */
  icon?: ReactNode;
}

// ============================================================================
// Scan Detail Component Props
// ============================================================================

/**
 * Props for scan detail panel/modal
 */
export interface ScanDetailPanelProps {
  /** Scan to display */
  scan: Scan | null;
  /** Loading state */
  isLoading?: boolean;
  /** Callback to close panel */
  onClose: () => void;
  /** Callback to navigate to graph view */
  onViewGraph?: (scanId: ScanId) => void;
  /** Callback to add to comparison */
  onAddToComparison?: (scanId: ScanId) => void;
  /** Callback to export single scan */
  onExport?: (scanId: ScanId, format: ExportFormat) => void;
  /** Additional CSS class names */
  className?: string;
  /** Panel position */
  position?: 'left' | 'right' | 'bottom';
}

/**
 * Props for scan metrics card
 */
export interface ScanMetricsCardProps {
  /** Scan to display metrics for */
  scan: Scan;
  /** Show trend indicators */
  showTrend?: boolean;
  /** Previous scan for trend comparison */
  previousScan?: Scan | null;
  /** Additional CSS class names */
  className?: string;
  /** Compact display mode */
  compact?: boolean;
}

// ============================================================================
// Toolbar Component Props
// ============================================================================

/**
 * Props for scan history toolbar
 */
export interface ScanHistoryToolbarProps {
  /** Current view mode */
  viewMode: ViewMode;
  /** Callback to change view mode */
  onViewModeChange: (mode: ViewMode) => void;
  /** Export handler */
  onExport: (format: ExportFormat) => void;
  /** Whether export is in progress */
  isExporting: boolean;
  /** Export progress */
  exportProgress: number;
  /** Refresh handler */
  onRefresh: () => void;
  /** Whether data is refreshing */
  isRefreshing: boolean;
  /** Number of selected scans */
  selectedCount: number;
  /** Additional CSS class names */
  className?: string;
}
