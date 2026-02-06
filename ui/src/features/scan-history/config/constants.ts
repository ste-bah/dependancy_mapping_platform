/**
 * Scan History Constants
 * Static constants for scan history feature
 * @module features/scan-history/config/constants
 */

import type { ScanStatus } from '../types/domain';
import type { TimelineZoomLevel, ExportFormat } from './types';

// ============================================================================
// Status Constants
// ============================================================================

/**
 * Status colors for visualization
 * Maps each scan status to a hex color code
 */
export const STATUS_COLORS: Record<ScanStatus, string> = {
  completed: '#22c55e',   // green-500
  failed: '#ef4444',      // red-500
  in_progress: '#3b82f6', // blue-500
  cancelled: '#6b7280',   // gray-500
} as const;

/**
 * Status background colors (lighter variants)
 * For use in badges and highlights
 */
export const STATUS_BG_COLORS: Record<ScanStatus, string> = {
  completed: '#dcfce7',   // green-100
  failed: '#fee2e2',      // red-100
  in_progress: '#dbeafe', // blue-100
  cancelled: '#f3f4f6',   // gray-100
} as const;

/**
 * Status labels for display
 * Maps each scan status to a human-readable label
 */
export const STATUS_LABELS: Record<ScanStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  in_progress: 'In Progress',
  cancelled: 'Cancelled',
} as const;

/**
 * Status icons (using common icon library naming)
 * Maps each scan status to an icon identifier
 */
export const STATUS_ICONS: Record<ScanStatus, string> = {
  completed: 'check-circle',
  failed: 'x-circle',
  in_progress: 'loader',
  cancelled: 'minus-circle',
} as const;

// ============================================================================
// Date Format Constants
// ============================================================================

/**
 * Date format strings for consistent formatting
 */
export const DATE_FORMATS = {
  /** Short date format: "1/15/24" */
  short: 'M/d/yy',
  /** Medium date format: "Jan 15, 2024" */
  medium: 'MMM d, yyyy',
  /** Long date format: "January 15, 2024" */
  long: 'MMMM d, yyyy',
  /** Full date format: "Monday, January 15, 2024" */
  full: 'EEEE, MMMM d, yyyy',
  /** ISO date format: "2024-01-15" */
  iso: 'yyyy-MM-dd',
  /** DateTime format: "Jan 15, 2024, 2:30 PM" */
  datetime: 'MMM d, yyyy, h:mm a',
  /** Time only format: "2:30 PM" */
  time: 'h:mm a',
  /** API date format for requests */
  api: "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'",
} as const;

/**
 * Locale for date formatting
 */
export const DEFAULT_LOCALE = 'en-US';

// ============================================================================
// Route Constants
// ============================================================================

/**
 * Route paths for scan history feature
 */
export const ROUTES = {
  /** Base scan history route */
  base: '/scans',
  /** Scan history list view */
  list: '/scans/history',
  /** Single scan detail view */
  detail: '/scans/:scanId',
  /** Scan comparison view */
  compare: '/scans/compare',
  /** Scan timeline view */
  timeline: '/scans/timeline',
  /** Scan export view */
  export: '/scans/export',
} as const;

/**
 * Build scan detail route
 * @param scanId - The scan identifier
 * @returns Full route path
 */
export function buildScanDetailRoute(scanId: string): string {
  return `/scans/${scanId}`;
}

/**
 * Build scan comparison route
 * @param baselineId - Baseline scan ID
 * @param comparisonId - Comparison scan ID
 * @returns Full route path with query params
 */
export function buildCompareRoute(baselineId: string, comparisonId: string): string {
  return `/scans/compare?baseline=${baselineId}&comparison=${comparisonId}`;
}

// ============================================================================
// URL Parameter Constants
// ============================================================================

/**
 * URL query parameter keys for state persistence
 */
export const URL_PARAMS = {
  /** Current page number */
  page: 'page',
  /** Items per page */
  limit: 'limit',
  /** Search query */
  search: 'q',
  /** Selected statuses (comma-separated) */
  statuses: 'status',
  /** Selected repositories (comma-separated) */
  repositories: 'repos',
  /** Start date for date range filter */
  dateStart: 'from',
  /** End date for date range filter */
  dateEnd: 'to',
  /** Sort field */
  sortBy: 'sort',
  /** Sort order (asc/desc) */
  sortOrder: 'order',
  /** Selected scan ID */
  selectedScan: 'selected',
  /** Timeline zoom level */
  zoom: 'zoom',
  /** Baseline scan ID for comparison */
  baseline: 'baseline',
  /** Comparison scan ID for comparison */
  comparison: 'comparison',
} as const;

/**
 * Separator for array values in URL parameters
 */
export const URL_ARRAY_SEPARATOR = ',';

// ============================================================================
// Timeline Constants
// ============================================================================

/**
 * All available timeline zoom levels
 */
export const TIMELINE_ZOOM_LEVELS: readonly TimelineZoomLevel[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
] as const;

/**
 * Timeline zoom level labels
 */
export const TIMELINE_ZOOM_LABELS: Record<TimelineZoomLevel, string> = {
  day: 'Daily',
  week: 'Weekly',
  month: 'Monthly',
  quarter: 'Quarterly',
  year: 'Yearly',
} as const;

/**
 * Timeline colors for different metrics
 */
export const TIMELINE_COLORS = {
  scans: '#3b82f6',      // blue-500
  issues: '#ef4444',     // red-500
  files: '#8b5cf6',      // purple-500
  duration: '#10b981',   // emerald-500
} as const;

// ============================================================================
// Export Constants
// ============================================================================

/**
 * Available export formats
 */
export const EXPORT_FORMATS: readonly ExportFormat[] = [
  'csv',
  'json',
  'pdf',
] as const;

/**
 * Export format labels
 */
export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
  csv: 'CSV',
  json: 'JSON',
  pdf: 'PDF Report',
} as const;

/**
 * Export format MIME types
 */
export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  pdf: 'application/pdf',
} as const;

/**
 * Export format file extensions
 */
export const EXPORT_FILE_EXTENSIONS: Record<ExportFormat, string> = {
  csv: '.csv',
  json: '.json',
  pdf: '.pdf',
} as const;

// ============================================================================
// Metric Constants
// ============================================================================

/**
 * Severity level colors
 */
export const SEVERITY_COLORS = {
  critical: '#dc2626', // red-600
  high: '#ea580c',     // orange-600
  medium: '#ca8a04',   // yellow-600
  low: '#16a34a',      // green-600
  info: '#2563eb',     // blue-600
} as const;

/**
 * Severity level labels
 */
export const SEVERITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  info: 'Info',
} as const;

/**
 * Trend indicator colors
 */
export const TREND_COLORS = {
  positive: '#16a34a', // green-600
  negative: '#dc2626', // red-600
  neutral: '#6b7280',  // gray-500
} as const;

// ============================================================================
// Filter Constants
// ============================================================================

/**
 * Date range preset options
 */
export const DATE_RANGE_PRESETS = [
  { value: 'today', label: 'Today', days: 0 },
  { value: 'yesterday', label: 'Yesterday', days: 1 },
  { value: 'last7days', label: 'Last 7 days', days: 7 },
  { value: 'last30days', label: 'Last 30 days', days: 30 },
  { value: 'last90days', label: 'Last 90 days', days: 90 },
  { value: 'thisMonth', label: 'This month', days: -1 },
  { value: 'thisYear', label: 'This year', days: -2 },
  { value: 'custom', label: 'Custom range', days: -3 },
] as const;

/**
 * Sort field options for scan list
 */
export const SORT_OPTIONS = [
  { value: 'startedAt', label: 'Start Date' },
  { value: 'completedAt', label: 'Completion Date' },
  { value: 'duration', label: 'Duration' },
  { value: 'repositoryName', label: 'Repository' },
  { value: 'issuesFound', label: 'Issues Found' },
  { value: 'analyzedFiles', label: 'Files Analyzed' },
] as const;

/**
 * Sort order options
 */
export const SORT_ORDERS = [
  { value: 'asc', label: 'Ascending' },
  { value: 'desc', label: 'Descending' },
] as const;

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

/**
 * Keyboard shortcuts for scan history feature
 */
export const KEYBOARD_SHORTCUTS = {
  /** Focus search input */
  search: 'Ctrl+K',
  /** Export selected scans */
  export: 'Ctrl+E',
  /** Refresh data */
  refresh: 'Ctrl+R',
  /** Navigate to next scan */
  nextScan: 'ArrowDown',
  /** Navigate to previous scan */
  prevScan: 'ArrowUp',
  /** Open scan details */
  openDetails: 'Enter',
  /** Close modal/panel */
  close: 'Escape',
  /** Toggle timeline view */
  toggleTimeline: 'T',
  /** Toggle filters panel */
  toggleFilters: 'F',
} as const;

// ============================================================================
// Accessibility Constants
// ============================================================================

/**
 * ARIA labels for interactive elements
 */
export const ARIA_LABELS = {
  scanList: 'Scan history list',
  scanItem: 'Scan item',
  filterPanel: 'Filter panel',
  timeline: 'Scan timeline chart',
  comparison: 'Scan comparison panel',
  searchInput: 'Search scans',
  statusFilter: 'Filter by status',
  dateFilter: 'Filter by date range',
  sortSelect: 'Sort scans by',
  pageSize: 'Items per page',
  pagination: 'Pagination controls',
  exportButton: 'Export scans',
  refreshButton: 'Refresh scan list',
} as const;
