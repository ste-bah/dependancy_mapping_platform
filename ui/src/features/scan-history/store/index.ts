/**
 * Scan History Store Index
 * Barrel export for store and selectors
 * @module features/scan-history/store
 */

export {
  // Store hook
  useScanHistoryStore,

  // State selectors
  selectScans,
  selectSelectedScanId,
  selectSelectedScan,
  selectViewMode,
  selectTimelineView,
  selectTimelineZoom,
  selectFilters,
  selectSort,
  selectPagination,
  selectComparison,
  selectIsComparing,
  selectBaselineScanId,
  selectComparisonScanId,
  selectDiff,
  selectExportState,
  selectIsExporting,
  selectIsLoading,
  selectIsFetching,
  selectIsLoadingDiff,
  selectError,

  // Computed selectors
  selectIsAnyLoading,
  selectTotalScans,
  selectHasMorePages,
  selectCurrentPage,
  selectHasActiveFilters,
  selectActiveFilterCount,

  // Derived selectors
  selectBaselineScan,
  selectComparisonScan,
  selectCanCompare,
  selectScansByStatus,

  // Utilities
  createScanHistorySelector,
} from './useScanHistoryStore';
