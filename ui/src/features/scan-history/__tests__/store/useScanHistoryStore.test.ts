/**
 * Scan History Store Tests
 * Tests for Zustand store state and actions
 * @module features/scan-history/__tests__/store/useScanHistoryStore.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import {
  useScanHistoryStore,
  // Selectors
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
  selectIsAnyLoading,
  selectTotalScans,
  selectHasMorePages,
  selectCurrentPage,
  selectHasActiveFilters,
  selectActiveFilterCount,
  selectBaselineScan,
  selectComparisonScan,
  selectCanCompare,
  selectScansByStatus,
} from '../../store/useScanHistoryStore';
import {
  DEFAULT_SCAN_HISTORY_FILTERS,
  DEFAULT_PAGINATION_STATE,
  DEFAULT_SORT_STATE,
  DEFAULT_COMPARISON_SELECTION,
  DEFAULT_EXPORT_STATE,
  INITIAL_SCAN_HISTORY_STATE,
} from '../../types';
import {
  resetIdCounters,
  createMockScan,
  createMockScans,
  createMockScanDiff,
  createMockDateRange,
} from '../utils/test-helpers';
import type { ScanId, ScanStatus } from '../../types';

describe('useScanHistoryStore', () => {
  beforeEach(() => {
    resetIdCounters();
    // Reset store to initial state
    act(() => {
      useScanHistoryStore.getState().reset();
    });
  });

  // ==========================================================================
  // Initial State
  // ==========================================================================

  describe('initial state', () => {
    it('should have correct initial state', () => {
      const state = useScanHistoryStore.getState();

      expect(state.scans).toEqual([]);
      expect(state.selectedScanId).toBeNull();
      expect(state.selectedScan).toBeNull();
      expect(state.viewMode).toBe('list');
      expect(state.filters).toEqual(INITIAL_SCAN_HISTORY_STATE.filters);
      expect(state.sort).toEqual(DEFAULT_SORT_STATE);
      expect(state.pagination).toEqual(DEFAULT_PAGINATION_STATE);
      expect(state.comparison).toEqual(DEFAULT_COMPARISON_SELECTION);
      expect(state.diff).toBeNull();
      expect(state.export).toEqual(DEFAULT_EXPORT_STATE);
      expect(state.isLoading).toBe(false);
      expect(state.isFetching).toBe(false);
      expect(state.isLoadingDiff).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  // ==========================================================================
  // Data Actions
  // ==========================================================================

  describe('data actions', () => {
    describe('setScans', () => {
      it('should set scans array', () => {
        const scans = createMockScans(5);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
        });

        expect(useScanHistoryStore.getState().scans).toEqual(scans);
      });

      it('should replace existing scans', () => {
        const oldScans = createMockScans(3);
        const newScans = createMockScans(5);

        act(() => {
          useScanHistoryStore.getState().setScans(oldScans);
          useScanHistoryStore.getState().setScans(newScans);
        });

        expect(useScanHistoryStore.getState().scans).toEqual(newScans);
      });
    });

    describe('appendScans', () => {
      it('should append to existing scans', () => {
        const initialScans = createMockScans(3);
        const moreScans = createMockScans(2);

        act(() => {
          useScanHistoryStore.getState().setScans(initialScans);
          useScanHistoryStore.getState().appendScans(moreScans);
        });

        expect(useScanHistoryStore.getState().scans).toHaveLength(5);
      });

      it('should work with empty initial array', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().appendScans(scans);
        });

        expect(useScanHistoryStore.getState().scans).toEqual(scans);
      });
    });

    describe('clearScans', () => {
      it('should clear all scans', () => {
        act(() => {
          useScanHistoryStore.getState().setScans(createMockScans(5));
          useScanHistoryStore.getState().clearScans();
        });

        expect(useScanHistoryStore.getState().scans).toEqual([]);
      });

      it('should clear selection when clearing scans', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
          useScanHistoryStore.getState().selectScan(scans[0].id);
          useScanHistoryStore.getState().clearScans();
        });

        expect(useScanHistoryStore.getState().selectedScanId).toBeNull();
        expect(useScanHistoryStore.getState().selectedScan).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Selection Actions
  // ==========================================================================

  describe('selection actions', () => {
    describe('selectScan', () => {
      it('should select scan by ID', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
          useScanHistoryStore.getState().selectScan(scans[1].id);
        });

        expect(useScanHistoryStore.getState().selectedScanId).toBe(scans[1].id);
        expect(useScanHistoryStore.getState().selectedScan).toEqual(scans[1]);
      });

      it('should set selectedScan to null if ID not found', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
          useScanHistoryStore.getState().selectScan('non-existent' as ScanId);
        });

        expect(useScanHistoryStore.getState().selectedScanId).toBe('non-existent');
        expect(useScanHistoryStore.getState().selectedScan).toBeNull();
      });

      it('should clear selection with null', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
          useScanHistoryStore.getState().selectScan(scans[0].id);
          useScanHistoryStore.getState().selectScan(null);
        });

        expect(useScanHistoryStore.getState().selectedScanId).toBeNull();
        expect(useScanHistoryStore.getState().selectedScan).toBeNull();
      });
    });

    describe('clearSelection', () => {
      it('should clear selection', () => {
        const scans = createMockScans(3);

        act(() => {
          useScanHistoryStore.getState().setScans(scans);
          useScanHistoryStore.getState().selectScan(scans[0].id);
          useScanHistoryStore.getState().clearSelection();
        });

        expect(useScanHistoryStore.getState().selectedScanId).toBeNull();
        expect(useScanHistoryStore.getState().selectedScan).toBeNull();
      });
    });
  });

  // ==========================================================================
  // View Actions
  // ==========================================================================

  describe('view actions', () => {
    describe('setViewMode', () => {
      it('should switch to timeline view', () => {
        act(() => {
          useScanHistoryStore.getState().setViewMode('timeline');
        });

        expect(useScanHistoryStore.getState().viewMode).toBe('timeline');
      });

      it('should switch to list view', () => {
        act(() => {
          useScanHistoryStore.getState().setViewMode('timeline');
          useScanHistoryStore.getState().setViewMode('list');
        });

        expect(useScanHistoryStore.getState().viewMode).toBe('list');
      });
    });

    describe('setTimelineZoom', () => {
      it('should update timeline zoom', () => {
        act(() => {
          useScanHistoryStore.getState().setTimelineZoom('day');
        });

        expect(useScanHistoryStore.getState().timelineView.zoom).toBe('day');
      });
    });

    describe('setTimelineRange', () => {
      it('should update visible range', () => {
        const range = createMockDateRange(7, 0);

        act(() => {
          useScanHistoryStore.getState().setTimelineRange(range);
        });

        expect(useScanHistoryStore.getState().timelineView.visibleRange).toEqual(range);
      });
    });

    describe('setTimelineScroll', () => {
      it('should update scroll position', () => {
        act(() => {
          useScanHistoryStore.getState().setTimelineScroll(50);
        });

        expect(useScanHistoryStore.getState().timelineView.scrollPosition).toBe(50);
      });

      it('should clamp to 0-100 range', () => {
        act(() => {
          useScanHistoryStore.getState().setTimelineScroll(-10);
        });
        expect(useScanHistoryStore.getState().timelineView.scrollPosition).toBe(0);

        act(() => {
          useScanHistoryStore.getState().setTimelineScroll(150);
        });
        expect(useScanHistoryStore.getState().timelineView.scrollPosition).toBe(100);
      });
    });
  });

  // ==========================================================================
  // Filter Actions
  // ==========================================================================

  describe('filter actions', () => {
    describe('setFilters', () => {
      it('should update filters partially', () => {
        act(() => {
          useScanHistoryStore.getState().setFilters({
            searchQuery: 'test',
          });
        });

        expect(useScanHistoryStore.getState().filters.searchQuery).toBe('test');
        expect(useScanHistoryStore.getState().filters.dateRange).toBeNull();
      });

      it('should reset pagination to page 1', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(5);
          useScanHistoryStore.getState().setFilters({ searchQuery: 'test' });
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });

    describe('setDateRange', () => {
      it('should set date range', () => {
        const range = createMockDateRange(7, 0);

        act(() => {
          useScanHistoryStore.getState().setDateRange(range);
        });

        expect(useScanHistoryStore.getState().filters.dateRange).toEqual(range);
      });

      it('should clear date range with null', () => {
        const range = createMockDateRange(7, 0);

        act(() => {
          useScanHistoryStore.getState().setDateRange(range);
          useScanHistoryStore.getState().setDateRange(null);
        });

        expect(useScanHistoryStore.getState().filters.dateRange).toBeNull();
      });
    });

    describe('setRepositories', () => {
      it('should set repository filter', () => {
        act(() => {
          useScanHistoryStore.getState().setRepositories(['repo-1', 'repo-2'] as any);
        });

        expect(useScanHistoryStore.getState().filters.repositories).toEqual([
          'repo-1',
          'repo-2',
        ]);
      });
    });

    describe('setStatuses', () => {
      it('should set status filter', () => {
        act(() => {
          useScanHistoryStore.getState().setStatuses(['completed', 'failed']);
        });

        expect(useScanHistoryStore.getState().filters.statuses).toEqual([
          'completed',
          'failed',
        ]);
      });
    });

    describe('setSearchQuery', () => {
      it('should set search query', () => {
        act(() => {
          useScanHistoryStore.getState().setSearchQuery('test query');
        });

        expect(useScanHistoryStore.getState().filters.searchQuery).toBe('test query');
      });
    });

    describe('resetFilters', () => {
      it('should reset all filters to defaults', () => {
        act(() => {
          useScanHistoryStore.getState().setFilters({
            searchQuery: 'test',
            statuses: ['completed'],
          });
          useScanHistoryStore.getState().setDateRange(createMockDateRange());
          useScanHistoryStore.getState().resetFilters();
        });

        expect(useScanHistoryStore.getState().filters).toEqual(
          DEFAULT_SCAN_HISTORY_FILTERS
        );
      });
    });
  });

  // ==========================================================================
  // Sort Actions
  // ==========================================================================

  describe('sort actions', () => {
    describe('setSortField', () => {
      it('should set sort field', () => {
        act(() => {
          useScanHistoryStore.getState().setSortField('issuesFound');
        });

        expect(useScanHistoryStore.getState().sort.field).toBe('issuesFound');
      });

      it('should reset pagination', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(3);
          useScanHistoryStore.getState().setSortField('duration');
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });

    describe('setSortDirection', () => {
      it('should set sort direction', () => {
        act(() => {
          useScanHistoryStore.getState().setSortDirection('asc');
        });

        expect(useScanHistoryStore.getState().sort.direction).toBe('asc');
      });
    });

    describe('toggleSortDirection', () => {
      it('should toggle from desc to asc', () => {
        act(() => {
          useScanHistoryStore.getState().setSortDirection('desc');
          useScanHistoryStore.getState().toggleSortDirection();
        });

        expect(useScanHistoryStore.getState().sort.direction).toBe('asc');
      });

      it('should toggle from asc to desc', () => {
        act(() => {
          useScanHistoryStore.getState().setSortDirection('asc');
          useScanHistoryStore.getState().toggleSortDirection();
        });

        expect(useScanHistoryStore.getState().sort.direction).toBe('desc');
      });
    });
  });

  // ==========================================================================
  // Pagination Actions
  // ==========================================================================

  describe('pagination actions', () => {
    describe('setPage', () => {
      it('should set current page', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(5);
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(5);
      });

      it('should enforce minimum of 1', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(0);
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });

    describe('setLimit', () => {
      it('should set page size', () => {
        act(() => {
          useScanHistoryStore.getState().setLimit(50);
        });

        expect(useScanHistoryStore.getState().pagination.limit).toBe(50);
      });

      it('should cap at 100', () => {
        act(() => {
          useScanHistoryStore.getState().setLimit(200);
        });

        expect(useScanHistoryStore.getState().pagination.limit).toBe(100);
      });

      it('should reset to page 1', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(5);
          useScanHistoryStore.getState().setLimit(50);
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });

    describe('updatePagination', () => {
      it('should update pagination partially', () => {
        act(() => {
          useScanHistoryStore.getState().updatePagination({
            total: 100,
            hasMore: true,
          });
        });

        expect(useScanHistoryStore.getState().pagination.total).toBe(100);
        expect(useScanHistoryStore.getState().pagination.hasMore).toBe(true);
      });
    });

    describe('nextPage', () => {
      it('should increment page when hasMore is true', () => {
        act(() => {
          useScanHistoryStore.getState().updatePagination({ hasMore: true });
          useScanHistoryStore.getState().nextPage();
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(2);
      });

      it('should not increment when hasMore is false', () => {
        act(() => {
          useScanHistoryStore.getState().updatePagination({ hasMore: false });
          useScanHistoryStore.getState().nextPage();
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });

    describe('previousPage', () => {
      it('should decrement page when page > 1', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(3);
          useScanHistoryStore.getState().previousPage();
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(2);
      });

      it('should not decrement when page is 1', () => {
        act(() => {
          useScanHistoryStore.getState().setPage(1);
          useScanHistoryStore.getState().previousPage();
        });

        expect(useScanHistoryStore.getState().pagination.page).toBe(1);
      });
    });
  });

  // ==========================================================================
  // Comparison Actions
  // ==========================================================================

  describe('comparison actions', () => {
    describe('setBaselineScan', () => {
      it('should set baseline scan', () => {
        act(() => {
          useScanHistoryStore.getState().setBaselineScan('baseline-1' as ScanId);
        });

        expect(useScanHistoryStore.getState().comparison.baselineScanId).toBe(
          'baseline-1'
        );
      });

      it('should enable comparison when both scans selected', () => {
        act(() => {
          useScanHistoryStore.getState().setComparisonScan('comparison-1' as ScanId);
          useScanHistoryStore.getState().setBaselineScan('baseline-1' as ScanId);
        });

        expect(useScanHistoryStore.getState().comparison.isComparing).toBe(true);
      });

      it('should clear diff when selection changes', () => {
        act(() => {
          useScanHistoryStore.getState().setDiff(createMockScanDiff());
          useScanHistoryStore.getState().setBaselineScan('new-baseline' as ScanId);
        });

        expect(useScanHistoryStore.getState().diff).toBeNull();
      });
    });

    describe('setComparisonScan', () => {
      it('should set comparison scan', () => {
        act(() => {
          useScanHistoryStore.getState().setComparisonScan('comparison-1' as ScanId);
        });

        expect(useScanHistoryStore.getState().comparison.comparisonScanId).toBe(
          'comparison-1'
        );
      });
    });

    describe('swapComparisonScans', () => {
      it('should swap baseline and comparison', () => {
        act(() => {
          useScanHistoryStore.getState().setBaselineScan('A' as ScanId);
          useScanHistoryStore.getState().setComparisonScan('B' as ScanId);
          useScanHistoryStore.getState().swapComparisonScans();
        });

        expect(useScanHistoryStore.getState().comparison.baselineScanId).toBe('B');
        expect(useScanHistoryStore.getState().comparison.comparisonScanId).toBe('A');
      });
    });

    describe('setComparing', () => {
      it('should set comparing flag', () => {
        act(() => {
          useScanHistoryStore.getState().setComparing(true);
        });

        expect(useScanHistoryStore.getState().comparison.isComparing).toBe(true);
      });
    });

    describe('clearComparison', () => {
      it('should clear all comparison state', () => {
        act(() => {
          useScanHistoryStore.getState().setBaselineScan('baseline' as ScanId);
          useScanHistoryStore.getState().setComparisonScan('comparison' as ScanId);
          useScanHistoryStore.getState().setDiff(createMockScanDiff());
          useScanHistoryStore.getState().clearComparison();
        });

        expect(useScanHistoryStore.getState().comparison).toEqual(
          DEFAULT_COMPARISON_SELECTION
        );
        expect(useScanHistoryStore.getState().diff).toBeNull();
      });
    });

    describe('setDiff', () => {
      it('should set diff result', () => {
        const diff = createMockScanDiff();

        act(() => {
          useScanHistoryStore.getState().setDiff(diff);
        });

        expect(useScanHistoryStore.getState().diff).toEqual(diff);
      });
    });
  });

  // ==========================================================================
  // Export Actions
  // ==========================================================================

  describe('export actions', () => {
    describe('startExport', () => {
      it('should initialize export state', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
        });

        const exportState = useScanHistoryStore.getState().export;
        expect(exportState.isExporting).toBe(true);
        expect(exportState.format).toBe('csv');
        expect(exportState.progress).toBe(0);
        expect(exportState.error).toBeNull();
      });
    });

    describe('setExportProgress', () => {
      it('should update export progress', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
          useScanHistoryStore.getState().setExportProgress(50);
        });

        expect(useScanHistoryStore.getState().export.progress).toBe(50);
      });

      it('should clamp to 0-100', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
          useScanHistoryStore.getState().setExportProgress(150);
        });

        expect(useScanHistoryStore.getState().export.progress).toBe(100);
      });
    });

    describe('completeExport', () => {
      it('should mark export as complete', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
          useScanHistoryStore.getState().completeExport();
        });

        expect(useScanHistoryStore.getState().export.isExporting).toBe(false);
        expect(useScanHistoryStore.getState().export.progress).toBe(100);
      });
    });

    describe('setExportError', () => {
      it('should set export error', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
          useScanHistoryStore.getState().setExportError('Export failed');
        });

        expect(useScanHistoryStore.getState().export.isExporting).toBe(false);
        expect(useScanHistoryStore.getState().export.error).toBe('Export failed');
      });
    });

    describe('cancelExport', () => {
      it('should reset export state', () => {
        act(() => {
          useScanHistoryStore.getState().startExport('csv');
          useScanHistoryStore.getState().setExportProgress(50);
          useScanHistoryStore.getState().cancelExport();
        });

        expect(useScanHistoryStore.getState().export).toEqual(DEFAULT_EXPORT_STATE);
      });
    });
  });

  // ==========================================================================
  // Loading State Actions
  // ==========================================================================

  describe('loading state actions', () => {
    describe('setLoading', () => {
      it('should set loading state', () => {
        act(() => {
          useScanHistoryStore.getState().setLoading(true);
        });

        expect(useScanHistoryStore.getState().isLoading).toBe(true);
      });
    });

    describe('setFetching', () => {
      it('should set fetching state', () => {
        act(() => {
          useScanHistoryStore.getState().setFetching(true);
        });

        expect(useScanHistoryStore.getState().isFetching).toBe(true);
      });
    });

    describe('setLoadingDiff', () => {
      it('should set diff loading state', () => {
        act(() => {
          useScanHistoryStore.getState().setLoadingDiff(true);
        });

        expect(useScanHistoryStore.getState().isLoadingDiff).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Error Actions
  // ==========================================================================

  describe('error actions', () => {
    describe('setError', () => {
      it('should set error message', () => {
        act(() => {
          useScanHistoryStore.getState().setError('Something went wrong');
        });

        expect(useScanHistoryStore.getState().error).toBe('Something went wrong');
      });
    });

    describe('clearError', () => {
      it('should clear error', () => {
        act(() => {
          useScanHistoryStore.getState().setError('Error');
          useScanHistoryStore.getState().clearError();
        });

        expect(useScanHistoryStore.getState().error).toBeNull();
      });
    });
  });

  // ==========================================================================
  // getRequestParams
  // ==========================================================================

  describe('getRequestParams', () => {
    it('should generate request params from state', () => {
      act(() => {
        // Set sort first since it resets pagination
        useScanHistoryStore.getState().setSortField('issuesFound');
        useScanHistoryStore.getState().setSortDirection('asc');
        // Set limit (also resets to page 1)
        useScanHistoryStore.getState().setLimit(50);
        // Set page last since other operations reset it
        useScanHistoryStore.getState().setPage(2);
      });

      const params = useScanHistoryStore.getState().getRequestParams();

      expect(params.page).toBe(2);
      expect(params.limit).toBe(50);
      expect(params.sortBy).toBe('issuesFound');
      expect(params.sortOrder).toBe('asc');
    });

    it('should include date range when set', () => {
      const range = createMockDateRange(7, 0);

      act(() => {
        useScanHistoryStore.getState().setDateRange(range);
      });

      const params = useScanHistoryStore.getState().getRequestParams();

      expect(params.dateStart).toBeDefined();
      expect(params.dateEnd).toBeDefined();
    });

    it('should omit empty arrays', () => {
      const params = useScanHistoryStore.getState().getRequestParams();

      expect(params.repositories).toBeUndefined();
      expect(params.statuses).toBeUndefined();
    });

    it('should include filters when set', () => {
      act(() => {
        useScanHistoryStore.getState().setStatuses(['completed', 'failed']);
        useScanHistoryStore.getState().setSearchQuery('test');
      });

      const params = useScanHistoryStore.getState().getRequestParams();

      expect(params.statuses).toEqual(['completed', 'failed']);
      expect(params.search).toBe('test');
    });
  });

  // ==========================================================================
  // Selectors
  // ==========================================================================

  describe('selectors', () => {
    it('should select scans', () => {
      const scans = createMockScans(3);
      act(() => {
        useScanHistoryStore.getState().setScans(scans);
      });

      expect(selectScans(useScanHistoryStore.getState())).toEqual(scans);
    });

    it('should select selected scan ID', () => {
      const scans = createMockScans(3);
      act(() => {
        useScanHistoryStore.getState().setScans(scans);
        useScanHistoryStore.getState().selectScan(scans[1].id);
      });

      expect(selectSelectedScanId(useScanHistoryStore.getState())).toBe(scans[1].id);
    });

    it('should select selected scan', () => {
      const scans = createMockScans(3);
      act(() => {
        useScanHistoryStore.getState().setScans(scans);
        useScanHistoryStore.getState().selectScan(scans[1].id);
      });

      expect(selectSelectedScan(useScanHistoryStore.getState())).toEqual(scans[1]);
    });

    it('should select view mode', () => {
      act(() => {
        useScanHistoryStore.getState().setViewMode('timeline');
      });

      expect(selectViewMode(useScanHistoryStore.getState())).toBe('timeline');
    });

    it('should select has active filters', () => {
      expect(selectHasActiveFilters(useScanHistoryStore.getState())).toBe(false);

      act(() => {
        useScanHistoryStore.getState().setSearchQuery('test');
      });

      expect(selectHasActiveFilters(useScanHistoryStore.getState())).toBe(true);
    });

    it('should count active filters', () => {
      expect(selectActiveFilterCount(useScanHistoryStore.getState())).toBe(0);

      act(() => {
        useScanHistoryStore.getState().setSearchQuery('test');
        useScanHistoryStore.getState().setStatuses(['completed']);
        useScanHistoryStore.getState().setDateRange(createMockDateRange());
      });

      expect(selectActiveFilterCount(useScanHistoryStore.getState())).toBe(3);
    });

    it('should select can compare', () => {
      expect(selectCanCompare(useScanHistoryStore.getState())).toBe(false);

      act(() => {
        useScanHistoryStore.getState().setBaselineScan('A' as ScanId);
      });

      expect(selectCanCompare(useScanHistoryStore.getState())).toBe(false);

      act(() => {
        useScanHistoryStore.getState().setComparisonScan('B' as ScanId);
      });

      expect(selectCanCompare(useScanHistoryStore.getState())).toBe(true);
    });

    it('should select is any loading', () => {
      expect(selectIsAnyLoading(useScanHistoryStore.getState())).toBe(false);

      act(() => {
        useScanHistoryStore.getState().setLoading(true);
      });

      expect(selectIsAnyLoading(useScanHistoryStore.getState())).toBe(true);
    });

    it('should select scans by status', () => {
      const scans = [
        createMockScan({ status: 'completed' }),
        createMockScan({ status: 'completed' }),
        createMockScan({ status: 'failed' }),
      ];

      act(() => {
        useScanHistoryStore.getState().setScans(scans);
      });

      const byStatus = selectScansByStatus(useScanHistoryStore.getState());

      expect(byStatus.completed).toHaveLength(2);
      expect(byStatus.failed).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Reset
  // ==========================================================================

  describe('reset', () => {
    it('should reset entire store', () => {
      act(() => {
        useScanHistoryStore.getState().setScans(createMockScans(5));
        useScanHistoryStore.getState().setSearchQuery('test');
        useScanHistoryStore.getState().setPage(5);
        useScanHistoryStore.getState().setError('error');
        useScanHistoryStore.getState().reset();
      });

      const state = useScanHistoryStore.getState();

      expect(state.scans).toEqual([]);
      expect(state.filters.searchQuery).toBe('');
      expect(state.pagination.page).toBe(1);
      expect(state.error).toBeNull();
    });
  });
});
