/**
 * Scan History Utilities Index
 * Barrel export for all scan history utility functions
 * @module features/scan-history/utils
 */

// ============================================================================
// Date Helpers
// ============================================================================

export {
  // Formatting
  formatDate,
  formatRelativeTime,
  formatDuration,
  formatDurationCompact,

  // Date range presets
  getDateRangePreset,

  // Date range utilities
  isDateInRange,
  getDaysBetween,
  getRangeDays,

  // Timeline buckets
  getTimelineBuckets,
  getBucketLabel,

  // ISO string utilities
  toISODateString,
  dateRangeToISO,
  parseISOToDateRange,

  // Types
  type DateFormatOptions,
  type DateFormatPattern,
  type DateRangePresetName,
} from './dateHelpers';

// ============================================================================
// Diff Helpers
// ============================================================================

export {
  // Metric comparison
  calculateMetricsDelta,
  calculateScanMetricsDiff,

  // Delta formatting
  formatDelta,
  formatDeltaPercent,
  formatComparison,

  // Delta colors
  getDeltaColor,
  getDeltaColorClass,
  DELTA_COLORS,

  // Trend indicators
  getTrendIndicator,
  getTrendSemantics,
  getTrendArrow,
  getTrendLabel,

  // Diff metrics utilities
  getTotalChanges,
  hasChanges,
  getDiffSummary,
  createEmptyDiffMetrics,

  // Comparison helpers
  isImprovement,
  isRegression,
  getOverallDiffStatus,

  // Types
  type TrendDirection,
  type TrendSemantics,
  type MetricsDelta,
} from './diffHelpers';

// ============================================================================
// Filter Helpers
// ============================================================================

export {
  // URL parameter constants
  FILTER_PARAM_KEYS,
  ARRAY_SEPARATOR,

  // Serialization
  serializeFilters,

  // Parsing
  parseFilters,

  // Merging
  mergeFilters,
  updateFilter,

  // Active filter detection
  hasActiveFilters,
  countActiveFilters,
  getActiveFilterNames,

  // Filter comparison
  filtersEqual,

  // Filter clearing
  clearAllFilters,
  clearFilter,

  // Filter validation
  validateFilters,
  isValidFilters,

  // Filter descriptions
  getFilterDescriptions,

  // URL state utilities
  updateUrlWithFilters,
  getFiltersFromUrl,
  clearFilterParams,
} from './filterHelpers';

// ============================================================================
// Error Handler
// ============================================================================

export {
  // Error class
  ScanHistoryError,

  // Error handling functions
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  getPrimaryRecoveryAction,

  // Error classification
  isRetryableError,
  isAuthError,
  isValidationError,
  isNotFoundError,
  getErrorType,

  // Type guards
  isScanHistoryError,
  hasErrorCode,

  // Types
  type ScanHistoryErrorCode,
  type ScanHistoryErrorType,
  type RecoveryAction,
  type RecoveryActionType,
} from './errorHandler';

// ============================================================================
// Error Logging
// ============================================================================

export {
  // Logging
  logScanHistoryError,

  // Metrics
  trackErrorMetrics,
  getErrorMetrics,
  resetErrorMetrics,
  getErrorRate,
  hasFrequentErrors,

  // Debug helpers
  formatErrorForDebug,
  getErrorDebugSummary,

  // Types
  type ErrorContext,
  type ErrorLogEntry,
} from './errorLogging';

// ============================================================================
// Logger
// ============================================================================

export {
  // Main logger
  scanHistoryLogger,

  // Factory functions
  createComponentLogger,
  createOperationLogger,
  createHookLogger,

  // Types
  type LogLevel,
  type LogContext,
  type LogEntry,
  type LoggerConfig,
  type ApiRequestContext,
  type ApiResponseContext,
  type UserActionData,
  type FeatureUsageData,
} from './logger';
