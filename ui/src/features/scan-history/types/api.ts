/**
 * Scan History API Types
 * Type definitions for API requests and responses
 * @module features/scan-history/types/api
 */

import type {
  ScanId,
  RepositoryId,
  ScanStatus,
  Scan,
  DateRange,
} from './domain';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Parameters for fetching scan history
 */
export interface FetchScanHistoryRequest {
  /** Page number (1-indexed) */
  page?: number;
  /** Number of items per page */
  limit?: number;
  /** Filter: start date (ISO 8601) */
  dateStart?: string;
  /** Filter: end date (ISO 8601) */
  dateEnd?: string;
  /** Filter: repository IDs */
  repositories?: string[];
  /** Filter: scan statuses */
  statuses?: ScanStatus[];
  /** Filter: search query */
  search?: string;
  /** Sort field */
  sortBy?: 'startedAt' | 'completedAt' | 'duration' | 'issuesFound';
  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}

/**
 * Parameters for creating a scan diff comparison
 */
export interface CreateScanDiffRequest {
  /** ID of the baseline (older) scan */
  baselineScanId: ScanId;
  /** ID of the comparison (newer) scan */
  comparisonScanId: ScanId;
  /** Diff calculation options */
  options?: {
    /** Include unchanged items in the diff */
    includeUnchanged?: boolean;
    /** Include detailed metrics comparison */
    includeMetricsDiff?: boolean;
  };
}

/**
 * Parameters for exporting scan data
 */
export interface ExportScansRequest {
  /** IDs of scans to export */
  scanIds: ScanId[];
  /** Export file format */
  format: 'csv' | 'json' | 'pdf';
  /** Include detailed metrics in export */
  includeMetrics?: boolean;
  /** Limit export to date range */
  dateRange?: DateRange;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Paginated response for scan history
 */
export interface ScanHistoryResponse {
  /** Array of scan records */
  scans: Scan[];
  /** Total number of scans matching filters */
  total: number;
  /** Current page number */
  page: number;
  /** Items per page */
  limit: number;
  /** Whether more pages exist */
  hasMore: boolean;
}

/**
 * Metrics breakdown for a diff operation
 */
export interface DiffMetrics {
  /** Number of items added */
  added: number;
  /** Number of items removed */
  removed: number;
  /** Number of items changed */
  changed: number;
  /** Number of items unchanged */
  unchanged: number;
}

/**
 * Metric comparison showing before/after values
 */
export interface MetricComparison {
  /** Value before (baseline scan) */
  before: number;
  /** Value after (comparison scan) */
  after: number;
  /** Numeric difference (after - before) */
  delta: number;
}

/**
 * Detailed metrics diff between two scans
 */
export interface ScanMetricsDiff {
  /** Issues found comparison */
  issuesFound: MetricComparison;
  /** Critical issues comparison */
  criticalIssues: MetricComparison;
  /** Warning count comparison */
  warningCount: MetricComparison;
}

/**
 * Scan diff result showing differences between two scans
 */
export interface ScanDiff {
  /** Unique identifier for this diff */
  id: string;
  /** ID of the baseline scan */
  baselineScanId: ScanId;
  /** ID of the comparison scan */
  comparisonScanId: ScanId;
  /** ISO 8601 timestamp when diff was created */
  createdAt: string;
  /** File-level diff metrics */
  metrics: DiffMetrics;
  /** Scan metrics comparison */
  metricsDiff: ScanMetricsDiff;
}

/**
 * Response wrapper for scan diff creation
 */
export interface ScanDiffResponse {
  /** Whether the operation succeeded */
  success: boolean;
  /** The computed diff data */
  data: ScanDiff;
  /** Whether result was served from cache */
  cached: boolean;
}

/**
 * Response for export operation
 */
export interface ExportResponse {
  /** Whether the export succeeded */
  success: boolean;
  /** Format of the exported data */
  format: 'csv' | 'json' | 'pdf';
  /** Exported data (string for csv/json, Blob for pdf) */
  data: string | Blob;
  /** Suggested filename for download */
  filename: string;
  /** Number of scans included in export */
  scanCount: number;
}

// ============================================================================
// Timeline Types
// ============================================================================

/**
 * Data point for timeline visualization
 * Represents aggregated scan data for a single date
 */
export interface TimelineDataPoint {
  /** Date in YYYY-MM-DD format */
  date: string;
  /** Total number of scans on this date */
  scanCount: number;
  /** Number of completed scans */
  completedCount: number;
  /** Number of failed scans */
  failedCount: number;
  /** Average scan duration in milliseconds */
  averageDuration: number;
  /** Total issues found across all scans */
  totalIssues: number;
}

/**
 * Response for timeline data endpoint
 */
export interface TimelineDataResponse {
  /** Array of timeline data points */
  dataPoints: TimelineDataPoint[];
  /** Start of the date range */
  startDate: string;
  /** End of the date range */
  endDate: string;
  /** Aggregation granularity */
  granularity: 'day' | 'week' | 'month';
}

// ============================================================================
// Query Key Types
// ============================================================================

/**
 * Query key for scan history list
 */
export type ScanHistoryQueryKey = readonly [
  'scan-history',
  'list',
  FetchScanHistoryRequest | undefined
];

/**
 * Query key for single scan details
 */
export type ScanDetailQueryKey = readonly ['scan-history', 'detail', string];

/**
 * Query key for scan diff
 */
export type ScanDiffQueryKey = readonly [
  'scan-history',
  'diff',
  string,
  string
];

/**
 * Query key for timeline data
 */
export type TimelineQueryKey = readonly [
  'scan-history',
  'timeline',
  string,
  string
];

// ============================================================================
// Error Types
// ============================================================================

/**
 * Scan history specific error codes
 */
export const ScanHistoryErrorCodes = {
  SCAN_NOT_FOUND: 'SCAN_NOT_FOUND',
  REPOSITORY_NOT_FOUND: 'REPOSITORY_NOT_FOUND',
  INVALID_DATE_RANGE: 'INVALID_DATE_RANGE',
  DIFF_COMPUTATION_FAILED: 'DIFF_COMPUTATION_FAILED',
  EXPORT_FAILED: 'EXPORT_FAILED',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_FILTER: 'INVALID_FILTER',
} as const;

export type ScanHistoryErrorCode =
  (typeof ScanHistoryErrorCodes)[keyof typeof ScanHistoryErrorCodes];

/**
 * Scan history specific error
 */
export interface ScanHistoryError {
  /** Error code for programmatic handling */
  code: ScanHistoryErrorCode;
  /** Human-readable error message */
  message: string;
  /** Related scan ID if applicable */
  scanId?: string;
  /** Related repository ID if applicable */
  repositoryId?: string;
  /** Additional error details */
  details?: Record<string, unknown>;
}

/**
 * Type guard for ScanHistoryError
 * @param value - Value to check
 * @returns True if value is a ScanHistoryError
 */
export function isScanHistoryError(value: unknown): value is ScanHistoryError {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === 'string' &&
    Object.values(ScanHistoryErrorCodes).includes(
      obj.code as ScanHistoryErrorCode
    ) &&
    typeof obj.message === 'string'
  );
}

// ============================================================================
// API Response Wrapper
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether the request succeeded */
  success: boolean;
  /** Response data (present on success) */
  data?: T;
  /** Error information (present on failure) */
  error?: ScanHistoryError;
  /** Request metadata */
  meta?: {
    /** Unique request identifier */
    requestId: string;
    /** ISO 8601 timestamp */
    timestamp: string;
    /** Request duration in milliseconds */
    duration: number;
  };
}
