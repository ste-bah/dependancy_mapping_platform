/**
 * Scan History Domain Types
 * Core domain entities and value objects for scan history feature
 * @module features/scan-history/types/domain
 */

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for scan identifiers
 * Provides type safety to prevent mixing scan IDs with other string types
 */
export type ScanId = string & { readonly __brand: 'ScanId' };

/**
 * Branded type for repository identifiers
 * Provides type safety to prevent mixing repository IDs with other string types
 */
export type RepositoryId = string & { readonly __brand: 'RepositoryId' };

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a string is a valid ScanId
 * @param value - String value to check
 * @returns True if value is a valid ScanId
 */
export function isScanId(value: string): value is ScanId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard to check if a string is a valid RepositoryId
 * @param value - String value to check
 * @returns True if value is a valid RepositoryId
 */
export function isRepositoryId(value: string): value is RepositoryId {
  return typeof value === 'string' && value.length > 0;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Creates a type-safe ScanId from a string
 * @param value - String value to convert to ScanId
 * @returns Branded ScanId
 * @throws Error if value is invalid
 */
export function createScanId(value: string): ScanId {
  if (!isScanId(value)) {
    throw new Error(`Invalid ScanId: "${value}" must be a non-empty string`);
  }
  return value as ScanId;
}

/**
 * Creates a type-safe RepositoryId from a string
 * @param value - String value to convert to RepositoryId
 * @returns Branded RepositoryId
 * @throws Error if value is invalid
 */
export function createRepositoryId(value: string): RepositoryId {
  if (!isRepositoryId(value)) {
    throw new Error(`Invalid RepositoryId: "${value}" must be a non-empty string`);
  }
  return value as RepositoryId;
}

// ============================================================================
// Domain Enums and Unions
// ============================================================================

/**
 * Possible scan execution statuses
 */
export type ScanStatus = 'completed' | 'failed' | 'in_progress' | 'cancelled';

/**
 * All valid scan status values as an array (for iteration/validation)
 */
export const ALL_SCAN_STATUSES: readonly ScanStatus[] = [
  'completed',
  'failed',
  'in_progress',
  'cancelled',
] as const;

/**
 * Type guard to check if a value is a valid ScanStatus
 * @param value - Value to check
 * @returns True if value is a valid ScanStatus
 */
export function isScanStatus(value: unknown): value is ScanStatus {
  return (
    typeof value === 'string' &&
    ALL_SCAN_STATUSES.includes(value as ScanStatus)
  );
}

// ============================================================================
// Domain Entities
// ============================================================================

/**
 * Metrics summary for a scan execution
 */
export interface ScanMetrics {
  /** Total number of files in the repository */
  totalFiles: number;
  /** Number of files successfully analyzed */
  analyzedFiles: number;
  /** Total number of issues found across all severities */
  issuesFound: number;
  /** Number of critical severity issues */
  criticalIssues: number;
  /** Number of warning level issues */
  warningCount: number;
}

/**
 * Core scan record entity
 * Represents a single scan execution in the system
 */
export interface Scan {
  /** Unique scan identifier */
  id: ScanId;
  /** Repository this scan belongs to */
  repositoryId: RepositoryId;
  /** Human-readable repository name */
  repositoryName: string;
  /** Current status of the scan */
  status: ScanStatus;
  /** ISO 8601 timestamp when scan started */
  startedAt: string;
  /** ISO 8601 timestamp when scan completed (null if still running) */
  completedAt: string | null;
  /** Duration of scan in milliseconds (null if still running) */
  duration: number | null;
  /** Metrics summary for the scan */
  metrics: ScanMetrics;
}

/**
 * Type guard to check if an object is a valid Scan
 * @param value - Value to check
 * @returns True if value is a valid Scan object
 */
export function isScan(value: unknown): value is Scan {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.repositoryId === 'string' &&
    typeof obj.repositoryName === 'string' &&
    isScanStatus(obj.status) &&
    typeof obj.startedAt === 'string' &&
    (obj.completedAt === null || typeof obj.completedAt === 'string') &&
    (obj.duration === null || typeof obj.duration === 'number') &&
    typeof obj.metrics === 'object' &&
    obj.metrics !== null
  );
}

// ============================================================================
// Value Objects
// ============================================================================

/**
 * Date range filter value object
 */
export interface DateRange {
  /** Start date (inclusive) */
  start: Date;
  /** End date (inclusive) */
  end: Date;
}

/**
 * Creates a DateRange with validation
 * @param start - Start date
 * @param end - End date
 * @returns DateRange object
 * @throws Error if end date is before start date
 */
export function createDateRange(start: Date, end: Date): DateRange {
  if (end < start) {
    throw new Error('DateRange end date cannot be before start date');
  }
  return { start, end };
}

/**
 * Filter state for scan history queries
 */
export interface ScanHistoryFilters {
  /** Date range filter (null for no date filtering) */
  dateRange: DateRange | null;
  /** Filter to specific repositories */
  repositories: RepositoryId[];
  /** Filter to specific scan statuses */
  statuses: ScanStatus[];
  /** Text search query for repository name or scan metadata */
  searchQuery: string;
}

/**
 * Default filter state for scan history
 */
export const DEFAULT_SCAN_HISTORY_FILTERS: ScanHistoryFilters = {
  dateRange: null,
  repositories: [],
  statuses: [],
  searchQuery: '',
};

// ============================================================================
// Constants
// ============================================================================

/**
 * Status colors for visualization
 * Maps each scan status to a hex color code
 */
export const SCAN_STATUS_COLORS: Record<ScanStatus, string> = {
  completed: '#22c55e',   // green-500
  failed: '#ef4444',      // red-500
  in_progress: '#3b82f6', // blue-500
  cancelled: '#6b7280',   // gray-500
};

/**
 * Status labels for display
 * Maps each scan status to a human-readable label
 */
export const SCAN_STATUS_LABELS: Record<ScanStatus, string> = {
  completed: 'Completed',
  failed: 'Failed',
  in_progress: 'In Progress',
  cancelled: 'Cancelled',
};

/**
 * Preset date range options for quick selection
 */
export const DATE_RANGE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This year', days: 365 },
] as const;

/**
 * Type for date range preset entries
 */
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];
