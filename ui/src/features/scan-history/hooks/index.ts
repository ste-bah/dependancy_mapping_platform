/**
 * Scan History Hooks
 * Re-exports all custom hooks for the scan history feature
 * @module features/scan-history/hooks
 */

// Query keys factory and helpers
export {
  scanHistoryQueryKeys,
  toQueryFilters,
  filteredListKey,
} from './queryKeys';

// Query key types - use explicit naming to avoid conflicts with api types
export type {
  ScanHistoryQueryFilters,
  ScanHistoryAllKey,
  ScanHistoryListsKey,
  ScanHistoryListKey,
  ScanHistoryDetailsKey,
  ScanHistoryDetailKey,
  ScanHistoryDiffsKey,
  ScanHistoryDiffKey,
  ScanHistoryTimelinesKey,
  ScanHistoryTimelineKey,
  ScanHistoryExportsKey,
  ScanHistoryExportKey,
  ScanHistoryRepositoryKey,
  ScanHistoryRepositoryScansKey,
  ScanHistorySummariesKey,
  ScanHistorySummaryKey,
  // Note: ScanHistoryQueryKey also exported from types/api - using that definition
} from './queryKeys';

// Query hooks
export {
  // Main hooks
  useScanHistory,
  useScanHistoryInfinite,
  useScanDetail,
  useScanDiff,
  useScanDiffMutation,
  useScanTimeline,
  useExportScans,
  // Cache management
  useInvalidateScanHistory,
  usePrefetchScan,
  useScanHistoryOptimisticUpdate,
  // Query options factories
  scanHistoryListQueryOptions,
  scanDetailQueryOptions,
  scanDiffQueryOptions,
  timelineQueryOptions,
  // Configuration
  SCAN_HISTORY_CACHE_TIMES,
  scanHistoryQueryDefaults,
} from './queries';

// URL state synchronization hook
export {
  useScanHistoryUrlState,
  URL_PARAM_KEYS as SCAN_HISTORY_URL_PARAM_KEYS,
} from './useScanHistoryUrlState';

export type {
  UseScanHistoryUrlStateOptions,
  UseScanHistoryUrlStateReturn,
} from './useScanHistoryUrlState';

// Error handling hook
export {
  useScanHistoryErrorHandler,
  useScanHistoryErrorState,
} from './useScanHistoryErrorHandler';

export type {
  ToastConfig,
  UseScanHistoryErrorHandlerOptions,
  ParsedError,
  UseScanHistoryErrorHandlerReturn,
} from './useScanHistoryErrorHandler';
