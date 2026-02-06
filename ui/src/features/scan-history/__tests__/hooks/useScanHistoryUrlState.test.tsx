/**
 * useScanHistoryUrlState Hook Tests
 * Tests for URL parameter synchronization hook
 * @module features/scan-history/__tests__/hooks/useScanHistoryUrlState.test
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  useScanHistoryUrlState,
  URL_PARAM_KEYS,
} from '../../hooks/useScanHistoryUrlState';
import { DEFAULT_SCAN_HISTORY_FILTERS, createScanId } from '../../types';
import type { ScanId, ScanHistoryFilters } from '../../types';
import { resetIdCounters, createMockDateRange } from '../utils/test-helpers';

// Mock react-router-dom hooks
const mockSetSearchParams = vi.fn();
const mockSearchParams = new URLSearchParams();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [mockSearchParams, mockSetSearchParams],
    useLocation: () => ({ pathname: '/scan-history', search: '' }),
  };
});

describe('useScanHistoryUrlState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    resetIdCounters();
    // Clear all params
    Array.from(mockSearchParams.keys()).forEach((key) => {
      mockSearchParams.delete(key);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return <MemoryRouter>{children}</MemoryRouter>;
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================

  describe('initialization', () => {
    it('should initialize with default filters', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.filters).toEqual(DEFAULT_SCAN_HISTORY_FILTERS);
      expect(result.current.selectedScanId).toBeNull();
      expect(result.current.compareScanId).toBeNull();
      expect(result.current.viewMode).toBe('list');
      expect(result.current.timelineZoom).toBe('month');
    });

    it('should parse filters from URL params', () => {
      mockSearchParams.set(URL_PARAM_KEYS.search, 'test-query');
      mockSearchParams.set(URL_PARAM_KEYS.statuses, 'completed,failed');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.filters.searchQuery).toBe('test-query');
      expect(result.current.filters.statuses).toContain('completed');
      expect(result.current.filters.statuses).toContain('failed');
    });

    it('should parse selected scan from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.selectedScan, 'scan-123');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.selectedScanId).toBe('scan-123');
    });

    it('should parse comparison scan from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.compareScan, 'scan-456');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.compareScanId).toBe('scan-456');
    });

    it('should parse view mode from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.viewMode, 'timeline');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.viewMode).toBe('timeline');
    });

    it('should parse timeline zoom from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.timelineZoom, 'week');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.timelineZoom).toBe('week');
    });

    it('should parse pagination from URL', () => {
      mockSearchParams.set(URL_PARAM_KEYS.page, '3');
      mockSearchParams.set(URL_PARAM_KEYS.limit, '50');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.pagination.page).toBe(3);
      expect(result.current.pagination.limit).toBe(50);
    });

    it('should use default filters when provided in options', () => {
      const options = {
        defaultFilters: {
          statuses: ['completed' as const],
        },
      };

      const { result } = renderHook(() => useScanHistoryUrlState(options), {
        wrapper,
      });

      expect(result.current.filters.statuses).toContain('completed');
    });

    it('should ignore invalid page values', () => {
      mockSearchParams.set(URL_PARAM_KEYS.page, 'invalid');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.pagination.page).toBe(1);
    });

    it('should ignore page values less than 1', () => {
      mockSearchParams.set(URL_PARAM_KEYS.page, '0');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.pagination.page).toBe(1);
    });

    it('should cap limit at 100', () => {
      mockSearchParams.set(URL_PARAM_KEYS.limit, '200');

      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.pagination.limit).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // Filter Actions
  // ==========================================================================

  describe('setFilters', () => {
    it('should update filters state', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      const newFilters: ScanHistoryFilters = {
        ...DEFAULT_SCAN_HISTORY_FILTERS,
        searchQuery: 'new search',
      };

      act(() => {
        result.current.setFilters(newFilters);
      });

      expect(result.current.filters.searchQuery).toBe('new search');
    });

    it('should reset pagination to page 1', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      // First set page to something other than 1
      act(() => {
        result.current.setPage(5);
      });

      expect(result.current.pagination.page).toBe(5);

      // Now update filters
      act(() => {
        result.current.setFilters({
          ...result.current.filters,
          searchQuery: 'search',
        });
      });

      expect(result.current.pagination.page).toBe(1);
    });

    it('should update URL after debounce', async () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ debounceMs: 100 }),
        { wrapper }
      );

      act(() => {
        result.current.setFilters({
          ...DEFAULT_SCAN_HISTORY_FILTERS,
          searchQuery: 'test',
        });
      });

      // URL not updated yet
      expect(mockSetSearchParams).not.toHaveBeenCalled();

      // Fast forward past debounce
      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
    });

    it('should call onFiltersChange callback', () => {
      const onFiltersChange = vi.fn();

      const { result } = renderHook(
        () => useScanHistoryUrlState({ onFiltersChange }),
        { wrapper }
      );

      act(() => {
        result.current.setFilters({
          ...DEFAULT_SCAN_HISTORY_FILTERS,
          searchQuery: 'callback test',
        });
      });

      expect(onFiltersChange).toHaveBeenCalledWith(
        expect.objectContaining({
          searchQuery: 'callback test',
        })
      );
    });
  });

  describe('updateFilter', () => {
    it('should update a single filter field', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('searchQuery', 'partial update');
      });

      expect(result.current.filters.searchQuery).toBe('partial update');
      // Other filters should remain unchanged
      expect(result.current.filters.dateRange).toBeNull();
    });

    it('should reset pagination', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setPage(3);
      });

      act(() => {
        result.current.updateFilter('searchQuery', 'search');
      });

      expect(result.current.pagination.page).toBe(1);
    });
  });

  describe('resetFilters', () => {
    it('should reset to default filters', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      // Modify filters
      act(() => {
        result.current.setFilters({
          ...DEFAULT_SCAN_HISTORY_FILTERS,
          searchQuery: 'some search',
          statuses: ['completed'],
        });
      });

      // Reset
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.searchQuery).toBe('');
      expect(result.current.filters.statuses).toEqual([]);
    });

    it('should reset to custom default filters', () => {
      const customDefaults = {
        statuses: ['completed' as const],
      };

      const { result } = renderHook(
        () => useScanHistoryUrlState({ defaultFilters: customDefaults }),
        { wrapper }
      );

      act(() => {
        result.current.updateFilter('searchQuery', 'temporary');
      });

      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters.statuses).toContain('completed');
    });
  });

  // ==========================================================================
  // Selection Actions
  // ==========================================================================

  describe('setSelectedScanId', () => {
    it('should update selected scan', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setSelectedScanId(createScanId('scan-456'));
      });

      expect(result.current.selectedScanId).toBe('scan-456');
    });

    it('should clear selected scan with null', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setSelectedScanId(createScanId('scan-456'));
      });

      act(() => {
        result.current.setSelectedScanId(null);
      });

      expect(result.current.selectedScanId).toBeNull();
    });

    it('should call onSelectionChange callback', () => {
      const onSelectionChange = vi.fn();

      const { result } = renderHook(
        () => useScanHistoryUrlState({ onSelectionChange }),
        { wrapper }
      );

      act(() => {
        result.current.setSelectedScanId(createScanId('scan-789'));
      });

      expect(onSelectionChange).toHaveBeenCalledWith('scan-789');
    });
  });

  describe('setCompareScanId', () => {
    it('should update comparison scan', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setCompareScanId(createScanId('compare-123'));
      });

      expect(result.current.compareScanId).toBe('compare-123');
    });

    it('should clear comparison scan with null', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setCompareScanId(createScanId('compare-123'));
      });

      act(() => {
        result.current.setCompareScanId(null);
      });

      expect(result.current.compareScanId).toBeNull();
    });
  });

  // ==========================================================================
  // View Actions
  // ==========================================================================

  describe('setViewMode', () => {
    it('should switch to timeline view', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setViewMode('timeline');
      });

      expect(result.current.viewMode).toBe('timeline');
    });

    it('should switch to list view', () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ defaultViewMode: 'timeline' }),
        { wrapper }
      );

      act(() => {
        result.current.setViewMode('list');
      });

      expect(result.current.viewMode).toBe('list');
    });

    it('should call onViewModeChange callback', () => {
      const onViewModeChange = vi.fn();

      const { result } = renderHook(
        () => useScanHistoryUrlState({ onViewModeChange }),
        { wrapper }
      );

      act(() => {
        result.current.setViewMode('timeline');
      });

      expect(onViewModeChange).toHaveBeenCalledWith('timeline');
    });
  });

  describe('setTimelineZoom', () => {
    it('should update timeline zoom level', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setTimelineZoom('week');
      });

      expect(result.current.timelineZoom).toBe('week');
    });

    it('should support all zoom levels', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      const zoomLevels = ['day', 'week', 'month', 'quarter', 'year'] as const;

      zoomLevels.forEach((zoom) => {
        act(() => {
          result.current.setTimelineZoom(zoom);
        });
        expect(result.current.timelineZoom).toBe(zoom);
      });
    });
  });

  // ==========================================================================
  // Pagination Actions
  // ==========================================================================

  describe('setPage', () => {
    it('should update current page', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setPage(5);
      });

      expect(result.current.pagination.page).toBe(5);
    });
  });

  describe('setLimit', () => {
    it('should update page size', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setLimit(50);
      });

      expect(result.current.pagination.limit).toBe(50);
    });

    it('should reset to page 1 when changing limit', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setPage(5);
      });

      act(() => {
        result.current.setLimit(50);
      });

      expect(result.current.pagination.page).toBe(1);
    });
  });

  // ==========================================================================
  // Utility Actions
  // ==========================================================================

  describe('clearUrlState', () => {
    it('should clear all state', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      // Set various state
      act(() => {
        result.current.updateFilter('searchQuery', 'test');
        result.current.setSelectedScanId(createScanId('scan-1'));
        result.current.setViewMode('timeline');
        result.current.setPage(5);
      });

      // Clear all
      act(() => {
        result.current.clearUrlState();
      });

      expect(result.current.filters.searchQuery).toBe('');
      expect(result.current.selectedScanId).toBeNull();
      expect(result.current.viewMode).toBe('list');
      expect(result.current.pagination.page).toBe(1);
    });

    it('should clear URL params', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('searchQuery', 'test');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      act(() => {
        result.current.clearUrlState();
      });

      // Should call setSearchParams with empty params
      expect(mockSetSearchParams).toHaveBeenCalledWith(
        expect.any(URLSearchParams),
        { replace: true }
      );
    });
  });

  describe('getShareableUrl', () => {
    it('should generate shareable URL with current state', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('searchQuery', 'test');
        result.current.setSelectedScanId(createScanId('scan-1'));
      });

      const url = result.current.getShareableUrl();

      expect(url).toContain('q=test');
      expect(url).toContain('scan=scan-1');
    });

    it('should return base URL when no state is active', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      const url = result.current.getShareableUrl();

      // Should be base path without query params
      expect(url).toMatch(/^http.*\/scan-history$/);
    });

    it('should include page in shareable URL when not default', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.setPage(3);
      });

      const url = result.current.getShareableUrl();

      expect(url).toContain('page=3');
    });
  });

  // ==========================================================================
  // Computed Values
  // ==========================================================================

  describe('hasActiveFilters', () => {
    it('should return false when filters match defaults', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      expect(result.current.hasActiveFilters).toBe(false);
    });

    it('should return true when search is active', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('searchQuery', 'active search');
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when statuses differ', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('statuses', ['completed']);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when date range is set', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('dateRange', createMockDateRange());
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should return true when repositories are filtered', () => {
      const { result } = renderHook(() => useScanHistoryUrlState(), { wrapper });

      act(() => {
        result.current.updateFilter('repositories', ['repo-1'] as any);
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });
  });

  // ==========================================================================
  // Enabled Option
  // ==========================================================================

  describe('enabled option', () => {
    it('should not update URL when disabled', () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ enabled: false }),
        { wrapper }
      );

      act(() => {
        result.current.updateFilter('searchQuery', 'disabled test');
      });

      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(mockSetSearchParams).not.toHaveBeenCalled();
    });

    it('should still update local state when disabled', () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ enabled: false }),
        { wrapper }
      );

      act(() => {
        result.current.updateFilter('searchQuery', 'disabled test');
      });

      expect(result.current.filters.searchQuery).toBe('disabled test');
    });
  });

  // ==========================================================================
  // Debouncing
  // ==========================================================================

  describe('debouncing', () => {
    it('should debounce URL updates', async () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ debounceMs: 200 }),
        { wrapper }
      );

      // Make multiple rapid updates
      act(() => {
        result.current.updateFilter('searchQuery', 'a');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.updateFilter('searchQuery', 'ab');
      });

      act(() => {
        vi.advanceTimersByTime(50);
        result.current.updateFilter('searchQuery', 'abc');
      });

      // Should not have called yet
      expect(mockSetSearchParams).not.toHaveBeenCalled();

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(250);
      });

      // Should have been called only once
      expect(mockSetSearchParams).toHaveBeenCalledTimes(1);
    });

    it('should use custom debounce time', () => {
      const { result } = renderHook(
        () => useScanHistoryUrlState({ debounceMs: 500 }),
        { wrapper }
      );

      act(() => {
        result.current.updateFilter('searchQuery', 'test');
      });

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(mockSetSearchParams).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(mockSetSearchParams).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // URL Parameter Keys
  // ==========================================================================

  describe('URL_PARAM_KEYS', () => {
    it('should have all expected keys', () => {
      expect(URL_PARAM_KEYS.dateStart).toBeDefined();
      expect(URL_PARAM_KEYS.dateEnd).toBeDefined();
      expect(URL_PARAM_KEYS.repositories).toBeDefined();
      expect(URL_PARAM_KEYS.statuses).toBeDefined();
      expect(URL_PARAM_KEYS.search).toBeDefined();
      expect(URL_PARAM_KEYS.page).toBeDefined();
      expect(URL_PARAM_KEYS.limit).toBeDefined();
      expect(URL_PARAM_KEYS.viewMode).toBeDefined();
      expect(URL_PARAM_KEYS.timelineZoom).toBeDefined();
      expect(URL_PARAM_KEYS.selectedScan).toBeDefined();
      expect(URL_PARAM_KEYS.baselineScan).toBeDefined();
      expect(URL_PARAM_KEYS.compareScan).toBeDefined();
    });
  });
});
