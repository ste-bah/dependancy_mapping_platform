/**
 * Scan History API Functions
 * API functions for scan history data fetching and manipulation
 * @module features/scan-history/api
 */

import { get, post, buildQueryString } from '@/core/api/client';
import type { ScanId, Scan } from './types/domain';
import type {
  FetchScanHistoryRequest,
  ScanHistoryResponse,
  CreateScanDiffRequest,
  ScanDiffResponse,
  ExportScansRequest,
  ExportResponse,
  TimelineDataResponse,
} from './types/api';

// ============================================================================
// Types
// ============================================================================

/**
 * Detailed scan response from API
 * Extends Scan with additional metadata
 */
export interface ScanDetailResponse extends Scan {
  /** Full path to the repository */
  repositoryPath: string;
  /** Branch that was scanned */
  branch: string;
  /** Commit SHA at time of scan */
  commitSha: string;
  /** User who initiated the scan */
  initiatedBy: string;
  /** Configuration used for the scan */
  scanConfig: ScanConfiguration;
  /** Detailed file breakdown */
  fileBreakdown: FileBreakdown;
}

/**
 * Scan configuration details
 */
export interface ScanConfiguration {
  /** Enabled analysis rules */
  enabledRules: string[];
  /** File patterns to include */
  includePatterns: string[];
  /** File patterns to exclude */
  excludePatterns: string[];
  /** Maximum file size to analyze (bytes) */
  maxFileSize: number;
  /** Analysis depth setting */
  depth: 'shallow' | 'standard' | 'deep';
}

/**
 * File type breakdown for a scan
 */
export interface FileBreakdown {
  /** Files grouped by extension */
  byExtension: Record<string, number>;
  /** Files grouped by directory */
  byDirectory: Record<string, number>;
  /** Files that were skipped */
  skippedCount: number;
  /** Reasons for skipped files */
  skippedReasons: Record<string, number>;
}

/**
 * Timeline fetch options
 */
export interface FetchTimelineOptions {
  /** Start date in YYYY-MM-DD format */
  startDate: string;
  /** End date in YYYY-MM-DD format */
  endDate: string;
  /** Aggregation granularity */
  granularity?: 'day' | 'week' | 'month';
  /** Filter to specific repositories */
  repositories?: string[];
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch paginated scan history
 * @param params - Request parameters including filters, pagination, and sorting
 * @returns Paginated list of scans
 *
 * @example
 * ```ts
 * const { scans, total, hasMore } = await fetchScans({
 *   page: 1,
 *   limit: 20,
 *   statuses: ['completed', 'failed'],
 *   sortBy: 'startedAt',
 *   sortOrder: 'desc',
 * });
 * ```
 */
export async function fetchScans(
  params: FetchScanHistoryRequest = {}
): Promise<ScanHistoryResponse> {
  const queryParams: Record<string, string | number | undefined> = {
    page: params.page,
    limit: params.limit,
    dateStart: params.dateStart,
    dateEnd: params.dateEnd,
    search: params.search,
    sortBy: params.sortBy,
    sortOrder: params.sortOrder,
  };

  // Handle array parameters
  if (params.repositories && params.repositories.length > 0) {
    queryParams.repositories = params.repositories.join(',');
  }

  if (params.statuses && params.statuses.length > 0) {
    queryParams.statuses = params.statuses.join(',');
  }

  const queryString = buildQueryString(queryParams);
  return get<ScanHistoryResponse>(`/scans${queryString}`);
}

/**
 * Fetch detailed information for a specific scan
 * @param scanId - The scan ID to fetch details for
 * @returns Detailed scan information
 *
 * @example
 * ```ts
 * const scan = await fetchScan('scan-123');
 * console.log(scan.metrics.issuesFound);
 * ```
 */
export async function fetchScan(
  scanId: ScanId | string
): Promise<ScanDetailResponse> {
  return get<ScanDetailResponse>(`/scans/${scanId}`);
}

/**
 * Create a diff comparison between two scans
 * @param request - Diff creation request with baseline and comparison scan IDs
 * @returns Diff computation result
 *
 * @example
 * ```ts
 * const { data: diff, cached } = await createDiff({
 *   baselineScanId: 'scan-old',
 *   comparisonScanId: 'scan-new',
 *   options: { includeMetricsDiff: true },
 * });
 * console.log(`Issues delta: ${diff.metricsDiff.issuesFound.delta}`);
 * ```
 */
export async function createDiff(
  request: CreateScanDiffRequest
): Promise<ScanDiffResponse> {
  return post<ScanDiffResponse, CreateScanDiffRequest>(
    '/scans/diff',
    request
  );
}

/**
 * Fetch an existing diff between two scans (if cached)
 * @param baselineScanId - The baseline scan ID
 * @param comparisonScanId - The comparison scan ID
 * @returns Cached diff or null if not found
 */
export async function fetchDiff(
  baselineScanId: ScanId | string,
  comparisonScanId: ScanId | string
): Promise<ScanDiffResponse | null> {
  try {
    return await get<ScanDiffResponse>(
      `/scans/diff/${baselineScanId}/${comparisonScanId}`
    );
  } catch (error) {
    // Return null if diff doesn't exist (404)
    if (
      error instanceof Error &&
      'statusCode' in error &&
      (error as { statusCode: number }).statusCode === 404
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Export scan data in various formats
 * @param request - Export request with scan IDs and format
 * @returns Export result with data and filename
 *
 * @example
 * ```ts
 * const { data, filename, format } = await exportScans({
 *   scanIds: ['scan-1', 'scan-2'],
 *   format: 'csv',
 *   includeMetrics: true,
 * });
 *
 * // Trigger download
 * const blob = new Blob([data], { type: 'text/csv' });
 * downloadBlob(blob, filename);
 * ```
 */
export async function exportScans(
  request: ExportScansRequest
): Promise<ExportResponse> {
  return post<ExportResponse, ExportScansRequest>(
    '/scans/export',
    request
  );
}

/**
 * Fetch timeline/trend data for visualization
 * @param options - Timeline fetch options
 * @returns Aggregated timeline data points
 *
 * @example
 * ```ts
 * const timeline = await fetchTimeline({
 *   startDate: '2024-01-01',
 *   endDate: '2024-01-31',
 *   granularity: 'day',
 * });
 *
 * timeline.dataPoints.forEach(point => {
 *   console.log(`${point.date}: ${point.scanCount} scans`);
 * });
 * ```
 */
export async function fetchTimeline(
  options: FetchTimelineOptions
): Promise<TimelineDataResponse> {
  const queryParams: Record<string, string | number | undefined> = {
    startDate: options.startDate,
    endDate: options.endDate,
    granularity: options.granularity,
  };

  if (options.repositories && options.repositories.length > 0) {
    queryParams.repositories = options.repositories.join(',');
  }

  const queryString = buildQueryString(queryParams);
  return get<TimelineDataResponse>(`/scans/timeline${queryString}`);
}

/**
 * Cancel a running scan
 * @param scanId - The scan ID to cancel
 * @returns Updated scan with cancelled status
 */
export async function cancelScan(
  scanId: ScanId | string
): Promise<Scan> {
  return post<Scan>(`/scans/${scanId}/cancel`);
}

/**
 * Retry a failed scan
 * @param scanId - The scan ID to retry
 * @returns New scan instance
 */
export async function retryScan(
  scanId: ScanId | string
): Promise<Scan> {
  return post<Scan>(`/scans/${scanId}/retry`);
}

/**
 * Delete a scan record
 * @param scanId - The scan ID to delete
 * @returns Success confirmation
 */
export async function deleteScan(
  scanId: ScanId | string
): Promise<{ success: boolean; deletedAt: string }> {
  // Using POST for delete operations to avoid browser caching issues
  // and to allow request body for audit logging
  return post<{ success: boolean; deletedAt: string }>(
    `/scans/${scanId}/delete`
  );
}

/**
 * Bulk delete multiple scans
 * @param scanIds - Array of scan IDs to delete
 * @returns Deletion result summary
 */
export async function deleteScans(
  scanIds: (ScanId | string)[]
): Promise<{
  success: boolean;
  deletedCount: number;
  failedIds: string[];
}> {
  return post<{
    success: boolean;
    deletedCount: number;
    failedIds: string[];
  }>('/scans/delete', { scanIds });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Build export filename based on format and date
 * @param format - Export format
 * @param scanCount - Number of scans being exported
 * @returns Suggested filename
 */
export function buildExportFilename(
  format: ExportScansRequest['format'],
  scanCount: number
): string {
  const date = new Date().toISOString().split('T')[0];
  const extension = format === 'pdf' ? 'pdf' : format === 'csv' ? 'csv' : 'json';
  return `scan-history-${scanCount}-scans-${date}.${extension}`;
}

/**
 * Format scan duration for display
 * @param durationMs - Duration in milliseconds
 * @returns Human-readable duration string
 */
export function formatScanDuration(durationMs: number | null): string {
  if (durationMs === null) {
    return 'In progress';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  const seconds = Math.floor(durationMs / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0
      ? `${minutes}m ${remainingSeconds}s`
      : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}h ${remainingMinutes}m`
    : `${hours}h`;
}

/**
 * Calculate success rate from scan history response
 * @param response - Scan history response
 * @returns Success rate as a percentage (0-100)
 */
export function calculateSuccessRate(response: ScanHistoryResponse): number {
  if (response.scans.length === 0) {
    return 0;
  }

  const completedCount = response.scans.filter(
    scan => scan.status === 'completed'
  ).length;

  return Math.round((completedCount / response.scans.length) * 100);
}
