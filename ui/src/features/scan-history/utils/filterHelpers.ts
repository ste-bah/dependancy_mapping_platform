/**
 * Filter Helpers
 * Pure utility functions for serializing, parsing, and managing scan history filters
 * @module features/scan-history/utils/filterHelpers
 */

import type {
  ScanHistoryFilters,
  ScanStatus,
  RepositoryId,
  DateRange,
  ALL_SCAN_STATUSES,
} from '../types/domain';
import { DEFAULT_SCAN_HISTORY_FILTERS, isScanStatus, createRepositoryId } from '../types/domain';

// ============================================================================
// URL Parameter Keys
// ============================================================================

/**
 * URL parameter key constants for filter serialization
 */
export const FILTER_PARAM_KEYS = {
  dateStart: 'from',
  dateEnd: 'to',
  repositories: 'repos',
  statuses: 'status',
  search: 'q',
} as const;

/**
 * Separator for array values in URL parameters
 */
export const ARRAY_SEPARATOR = ',';

// ============================================================================
// Serialization
// ============================================================================

/**
 * Serializes scan history filters to URL search parameters
 * Only includes non-default values to keep URLs clean
 *
 * @param filters - ScanHistoryFilters to serialize
 * @returns URLSearchParams with filter values
 *
 * @example
 * ```ts
 * const filters = {
 *   dateRange: { start: new Date('2024-01-01'), end: new Date('2024-01-31') },
 *   repositories: ['repo1', 'repo2'],
 *   statuses: ['completed', 'failed'],
 *   searchQuery: 'test',
 * };
 * const params = serializeFilters(filters);
 * // params.toString() = "from=2024-01-01&to=2024-01-31&repos=repo1,repo2&status=completed,failed&q=test"
 * ```
 */
export function serializeFilters(filters: ScanHistoryFilters): URLSearchParams {
  const params = new URLSearchParams();

  // Date range
  if (filters.dateRange) {
    params.set(FILTER_PARAM_KEYS.dateStart, toISODateOnly(filters.dateRange.start));
    params.set(FILTER_PARAM_KEYS.dateEnd, toISODateOnly(filters.dateRange.end));
  }

  // Repositories (only if not empty)
  if (filters.repositories.length > 0) {
    params.set(
      FILTER_PARAM_KEYS.repositories,
      filters.repositories.join(ARRAY_SEPARATOR)
    );
  }

  // Statuses (only if not empty)
  if (filters.statuses.length > 0) {
    params.set(
      FILTER_PARAM_KEYS.statuses,
      filters.statuses.join(ARRAY_SEPARATOR)
    );
  }

  // Search query (only if not empty)
  if (filters.searchQuery.trim() !== '') {
    params.set(FILTER_PARAM_KEYS.search, filters.searchQuery.trim());
  }

  return params;
}

/**
 * Converts a Date to ISO date string (YYYY-MM-DD)
 */
function toISODateOnly(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============================================================================
// Parsing
// ============================================================================

/**
 * Parses URL search parameters into ScanHistoryFilters
 * Invalid values are ignored and defaults are used
 *
 * @param params - URLSearchParams to parse
 * @returns ScanHistoryFilters with parsed values
 *
 * @example
 * ```ts
 * const params = new URLSearchParams('from=2024-01-01&to=2024-01-31&status=completed&q=test');
 * const filters = parseFilters(params);
 * // filters.dateRange = { start: Date, end: Date }
 * // filters.statuses = ['completed']
 * // filters.searchQuery = 'test'
 * ```
 */
export function parseFilters(params: URLSearchParams): ScanHistoryFilters {
  // Parse date range
  const dateRange = parseDateRange(
    params.get(FILTER_PARAM_KEYS.dateStart),
    params.get(FILTER_PARAM_KEYS.dateEnd)
  );

  // Parse repositories
  const repositories = parseRepositories(
    params.get(FILTER_PARAM_KEYS.repositories)
  );

  // Parse statuses
  const statuses = parseStatuses(
    params.get(FILTER_PARAM_KEYS.statuses)
  );

  // Parse search query
  const searchQuery = params.get(FILTER_PARAM_KEYS.search)?.trim() ?? '';

  return {
    dateRange,
    repositories,
    statuses,
    searchQuery,
  };
}

/**
 * Parses date range from URL parameter strings
 *
 * @param startStr - Start date string (ISO format)
 * @param endStr - End date string (ISO format)
 * @returns DateRange or null if invalid/missing
 */
function parseDateRange(
  startStr: string | null,
  endStr: string | null
): DateRange | null {
  if (!startStr || !endStr) {
    return null;
  }

  const start = new Date(startStr);
  const end = new Date(endStr);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  // Ensure end is not before start
  if (end < start) {
    return null;
  }

  return { start, end };
}

/**
 * Parses repository IDs from URL parameter string
 *
 * @param reposStr - Comma-separated repository IDs
 * @returns Array of RepositoryId
 */
function parseRepositories(reposStr: string | null): RepositoryId[] {
  if (!reposStr || reposStr.trim() === '') {
    return [];
  }

  return reposStr
    .split(ARRAY_SEPARATOR)
    .map(id => id.trim())
    .filter(id => id.length > 0)
    .map(id => createRepositoryId(id));
}

/**
 * Parses scan statuses from URL parameter string
 *
 * @param statusStr - Comma-separated status values
 * @returns Array of valid ScanStatus values
 */
function parseStatuses(statusStr: string | null): ScanStatus[] {
  if (!statusStr || statusStr.trim() === '') {
    return [];
  }

  return statusStr
    .split(ARRAY_SEPARATOR)
    .map(s => s.trim().toLowerCase())
    .filter(isScanStatus);
}

// ============================================================================
// Merging
// ============================================================================

/**
 * Merges partial filter updates into a base filter state
 * Handles null values correctly to clear filters
 *
 * @param base - Base filter state
 * @param updates - Partial updates to apply
 * @returns New merged filter state
 *
 * @example
 * ```ts
 * const base = { dateRange: null, repositories: [], statuses: [], searchQuery: '' };
 * const updates = { statuses: ['completed'], searchQuery: 'test' };
 * const merged = mergeFilters(base, updates);
 * // merged.statuses = ['completed']
 * // merged.searchQuery = 'test'
 * // merged.dateRange = null (unchanged)
 * ```
 */
export function mergeFilters(
  base: ScanHistoryFilters,
  updates: Partial<ScanHistoryFilters>
): ScanHistoryFilters {
  return {
    dateRange: updates.dateRange !== undefined ? updates.dateRange : base.dateRange,
    repositories: updates.repositories !== undefined ? updates.repositories : base.repositories,
    statuses: updates.statuses !== undefined ? updates.statuses : base.statuses,
    searchQuery: updates.searchQuery !== undefined ? updates.searchQuery : base.searchQuery,
  };
}

/**
 * Creates a new filter state with one field updated
 *
 * @param base - Base filter state
 * @param field - Field to update
 * @param value - New value for the field
 * @returns New filter state with the field updated
 */
export function updateFilter<K extends keyof ScanHistoryFilters>(
  base: ScanHistoryFilters,
  field: K,
  value: ScanHistoryFilters[K]
): ScanHistoryFilters {
  return {
    ...base,
    [field]: value,
  };
}

// ============================================================================
// Active Filter Detection
// ============================================================================

/**
 * Checks if any filters are currently active (non-default)
 *
 * @param filters - Filter state to check
 * @returns True if at least one filter is active
 *
 * @example
 * ```ts
 * hasActiveFilters({ dateRange: null, repositories: [], statuses: [], searchQuery: '' });
 * // false
 *
 * hasActiveFilters({ dateRange: null, repositories: [], statuses: ['completed'], searchQuery: '' });
 * // true
 * ```
 */
export function hasActiveFilters(filters: ScanHistoryFilters): boolean {
  return countActiveFilters(filters) > 0;
}

/**
 * Counts the number of active (non-default) filters
 *
 * @param filters - Filter state to count
 * @returns Number of active filters
 *
 * @example
 * ```ts
 * countActiveFilters({
 *   dateRange: { start: new Date(), end: new Date() },
 *   repositories: ['repo1'],
 *   statuses: ['completed', 'failed'],
 *   searchQuery: 'test',
 * });
 * // 4 (all four filters are active)
 * ```
 */
export function countActiveFilters(filters: ScanHistoryFilters): number {
  let count = 0;

  if (filters.dateRange !== null) {
    count++;
  }

  if (filters.repositories.length > 0) {
    count++;
  }

  if (filters.statuses.length > 0) {
    count++;
  }

  if (filters.searchQuery.trim() !== '') {
    count++;
  }

  return count;
}

/**
 * Gets a list of active filter names
 *
 * @param filters - Filter state to check
 * @returns Array of active filter names
 */
export function getActiveFilterNames(filters: ScanHistoryFilters): string[] {
  const names: string[] = [];

  if (filters.dateRange !== null) {
    names.push('dateRange');
  }

  if (filters.repositories.length > 0) {
    names.push('repositories');
  }

  if (filters.statuses.length > 0) {
    names.push('statuses');
  }

  if (filters.searchQuery.trim() !== '') {
    names.push('search');
  }

  return names;
}

// ============================================================================
// Filter Comparison
// ============================================================================

/**
 * Compares two filter states for equality
 *
 * @param a - First filter state
 * @param b - Second filter state
 * @returns True if filters are equal
 */
export function filtersEqual(
  a: ScanHistoryFilters,
  b: ScanHistoryFilters
): boolean {
  // Compare date ranges
  if (!dateRangesEqual(a.dateRange, b.dateRange)) {
    return false;
  }

  // Compare repositories
  if (!arraysEqual(a.repositories, b.repositories)) {
    return false;
  }

  // Compare statuses
  if (!arraysEqual(a.statuses, b.statuses)) {
    return false;
  }

  // Compare search query
  if (a.searchQuery.trim() !== b.searchQuery.trim()) {
    return false;
  }

  return true;
}

/**
 * Compares two date ranges for equality
 */
function dateRangesEqual(a: DateRange | null, b: DateRange | null): boolean {
  if (a === null && b === null) {
    return true;
  }

  if (a === null || b === null) {
    return false;
  }

  return (
    a.start.getTime() === b.start.getTime() &&
    a.end.getTime() === b.end.getTime()
  );
}

/**
 * Compares two arrays for equality (order-independent)
 */
function arraysEqual<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const sortedA = [...a].sort();
  const sortedB = [...b].sort();

  return sortedA.every((val, idx) => val === sortedB[idx]);
}

// ============================================================================
// Filter Clearing
// ============================================================================

/**
 * Clears all filters, returning default state
 *
 * @returns Default filter state
 */
export function clearAllFilters(): ScanHistoryFilters {
  return { ...DEFAULT_SCAN_HISTORY_FILTERS };
}

/**
 * Clears a specific filter field
 *
 * @param filters - Current filter state
 * @param field - Field to clear
 * @returns New filter state with field cleared
 */
export function clearFilter<K extends keyof ScanHistoryFilters>(
  filters: ScanHistoryFilters,
  field: K
): ScanHistoryFilters {
  return {
    ...filters,
    [field]: DEFAULT_SCAN_HISTORY_FILTERS[field],
  };
}

// ============================================================================
// Filter Validation
// ============================================================================

/**
 * Validates a filter state and returns validation errors
 *
 * @param filters - Filter state to validate
 * @returns Object with validation errors (empty if valid)
 */
export function validateFilters(filters: ScanHistoryFilters): Record<string, string> {
  const errors: Record<string, string> = {};

  // Validate date range
  if (filters.dateRange) {
    if (filters.dateRange.end < filters.dateRange.start) {
      errors.dateRange = 'End date cannot be before start date';
    }

    const now = new Date();
    if (filters.dateRange.start > now) {
      errors.dateRange = 'Start date cannot be in the future';
    }
  }

  // Validate search query length
  if (filters.searchQuery.length > 200) {
    errors.searchQuery = 'Search query is too long (max 200 characters)';
  }

  // Validate statuses
  for (const status of filters.statuses) {
    if (!isScanStatus(status)) {
      errors.statuses = `Invalid status: ${status}`;
      break;
    }
  }

  return errors;
}

/**
 * Checks if a filter state is valid
 *
 * @param filters - Filter state to check
 * @returns True if filter state is valid
 */
export function isValidFilters(filters: ScanHistoryFilters): boolean {
  const errors = validateFilters(filters);
  return Object.keys(errors).length === 0;
}

// ============================================================================
// Filter Descriptions
// ============================================================================

/**
 * Gets a human-readable description of active filters
 *
 * @param filters - Filter state
 * @returns Array of filter description strings
 */
export function getFilterDescriptions(filters: ScanHistoryFilters): string[] {
  const descriptions: string[] = [];

  if (filters.dateRange) {
    const start = formatDateShort(filters.dateRange.start);
    const end = formatDateShort(filters.dateRange.end);
    descriptions.push(`Date: ${start} - ${end}`);
  }

  if (filters.repositories.length > 0) {
    const count = filters.repositories.length;
    descriptions.push(`${count} ${count === 1 ? 'repository' : 'repositories'}`);
  }

  if (filters.statuses.length > 0) {
    const statusList = filters.statuses.map(capitalizeFirst).join(', ');
    descriptions.push(`Status: ${statusList}`);
  }

  if (filters.searchQuery.trim()) {
    descriptions.push(`Search: "${filters.searchQuery.trim()}"`);
  }

  return descriptions;
}

/**
 * Formats a date in short format (Jan 15, 2024)
 */
function formatDateShort(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Capitalizes the first letter of a string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// ============================================================================
// URL State Utilities
// ============================================================================

/**
 * Updates URL search params with new filter values without page navigation
 *
 * @param filters - New filter state
 * @param replace - Use replaceState instead of pushState
 */
export function updateUrlWithFilters(
  filters: ScanHistoryFilters,
  replace: boolean = false
): void {
  const params = serializeFilters(filters);
  const newUrl = `${window.location.pathname}?${params.toString()}`;

  if (replace) {
    window.history.replaceState(null, '', newUrl);
  } else {
    window.history.pushState(null, '', newUrl);
  }
}

/**
 * Gets current filters from URL search params
 *
 * @returns ScanHistoryFilters parsed from current URL
 */
export function getFiltersFromUrl(): ScanHistoryFilters {
  const params = new URLSearchParams(window.location.search);
  return parseFilters(params);
}

/**
 * Clears filter-related URL parameters
 *
 * @returns URLSearchParams with filter params removed
 */
export function clearFilterParams(): URLSearchParams {
  const current = new URLSearchParams(window.location.search);

  // Remove all filter params
  for (const key of Object.values(FILTER_PARAM_KEYS)) {
    current.delete(key);
  }

  return current;
}
