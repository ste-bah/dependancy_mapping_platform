/**
 * Test Dashboard Store
 * Zustand store for E2E test dashboard state management
 * @module e2e/ui/stores/test-dashboard.store
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { TestRunId, TestCaseId } from '../../types/test-types';
import type { TestRunDisplayStatus, TestCaseFilters } from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * View mode for the dashboard
 */
export type DashboardViewMode = 'list' | 'grid' | 'compact';

/**
 * Sort options for test runs
 */
export interface SortOptions {
  readonly field: 'startedAt' | 'completedAt' | 'duration' | 'passRate' | 'name';
  readonly direction: 'asc' | 'desc';
}

/**
 * Filter state
 */
export interface FilterState {
  readonly search: string;
  readonly statusFilters: TestRunDisplayStatus[];
  readonly dateRange: {
    readonly start: Date | null;
    readonly end: Date | null;
  };
}

/**
 * Selection state
 */
export interface SelectionState {
  readonly selectedRunId: TestRunId | null;
  readonly selectedCaseId: TestCaseId | null;
  readonly expandedSuites: Set<string>;
}

/**
 * Pagination state
 */
export interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
}

/**
 * Dashboard preferences
 */
export interface DashboardPreferences {
  readonly viewMode: DashboardViewMode;
  readonly autoRefresh: boolean;
  readonly refreshInterval: number;
  readonly showPassedTests: boolean;
  readonly showSkippedTests: boolean;
  readonly compactMode: boolean;
}

/**
 * Test Dashboard Store State
 */
export interface TestDashboardState {
  // Filter state
  filters: FilterState;
  sort: SortOptions;
  pagination: PaginationState;

  // Selection state
  selection: SelectionState;

  // UI preferences
  preferences: DashboardPreferences;

  // Modal state
  isCreateModalOpen: boolean;
  isDeleteModalOpen: boolean;
  runToDelete: TestRunId | null;

  // Actions - Filters
  setSearch: (search: string) => void;
  setStatusFilters: (statuses: TestRunDisplayStatus[]) => void;
  toggleStatusFilter: (status: TestRunDisplayStatus) => void;
  setDateRange: (start: Date | null, end: Date | null) => void;
  clearFilters: () => void;

  // Actions - Sort
  setSort: (field: SortOptions['field'], direction: SortOptions['direction']) => void;
  toggleSortDirection: () => void;

  // Actions - Pagination
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  nextPage: () => void;
  prevPage: () => void;

  // Actions - Selection
  selectRun: (id: TestRunId | null) => void;
  selectCase: (id: TestCaseId | null) => void;
  toggleSuiteExpanded: (suiteId: string) => void;
  clearSelection: () => void;

  // Actions - Preferences
  setViewMode: (mode: DashboardViewMode) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  togglePreference: (key: keyof Pick<DashboardPreferences, 'showPassedTests' | 'showSkippedTests' | 'compactMode'>) => void;

  // Actions - Modals
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openDeleteModal: (runId: TestRunId) => void;
  closeDeleteModal: () => void;

  // Reset
  reset: () => void;
}

// ============================================================================
// Default Values
// ============================================================================

const DEFAULT_FILTERS: FilterState = {
  search: '',
  statusFilters: [],
  dateRange: {
    start: null,
    end: null,
  },
};

const DEFAULT_SORT: SortOptions = {
  field: 'startedAt',
  direction: 'desc',
};

const DEFAULT_PAGINATION: PaginationState = {
  page: 1,
  pageSize: 20,
};

const DEFAULT_SELECTION: SelectionState = {
  selectedRunId: null,
  selectedCaseId: null,
  expandedSuites: new Set(),
};

const DEFAULT_PREFERENCES: DashboardPreferences = {
  viewMode: 'list',
  autoRefresh: true,
  refreshInterval: 30000,
  showPassedTests: true,
  showSkippedTests: true,
  compactMode: false,
};

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Test Dashboard Zustand Store
 *
 * Manages all UI state for the E2E test dashboard including:
 * - Filter and search state
 * - Sort configuration
 * - Pagination
 * - Selection state
 * - User preferences (persisted)
 * - Modal visibility
 *
 * @example
 * const { filters, setSearch, selectRun } = useTestDashboardStore();
 *
 * // Update search
 * setSearch('auth tests');
 *
 * // Select a test run
 * selectRun(runId);
 */
export const useTestDashboardStore = create<TestDashboardState>()(
  persist(
    (set, get) => ({
      // Initial state
      filters: DEFAULT_FILTERS,
      sort: DEFAULT_SORT,
      pagination: DEFAULT_PAGINATION,
      selection: DEFAULT_SELECTION,
      preferences: DEFAULT_PREFERENCES,
      isCreateModalOpen: false,
      isDeleteModalOpen: false,
      runToDelete: null,

      // Filter actions
      setSearch: (search) =>
        set((state) => ({
          filters: { ...state.filters, search },
          pagination: { ...state.pagination, page: 1 }, // Reset to first page
        })),

      setStatusFilters: (statusFilters) =>
        set((state) => ({
          filters: { ...state.filters, statusFilters },
          pagination: { ...state.pagination, page: 1 },
        })),

      toggleStatusFilter: (status) =>
        set((state) => {
          const current = state.filters.statusFilters;
          const statusFilters = current.includes(status)
            ? current.filter((s) => s !== status)
            : [...current, status];
          return {
            filters: { ...state.filters, statusFilters },
            pagination: { ...state.pagination, page: 1 },
          };
        }),

      setDateRange: (start, end) =>
        set((state) => ({
          filters: { ...state.filters, dateRange: { start, end } },
          pagination: { ...state.pagination, page: 1 },
        })),

      clearFilters: () =>
        set({
          filters: DEFAULT_FILTERS,
          pagination: { ...get().pagination, page: 1 },
        }),

      // Sort actions
      setSort: (field, direction) =>
        set({ sort: { field, direction } }),

      toggleSortDirection: () =>
        set((state) => ({
          sort: {
            ...state.sort,
            direction: state.sort.direction === 'asc' ? 'desc' : 'asc',
          },
        })),

      // Pagination actions
      setPage: (page) =>
        set((state) => ({
          pagination: { ...state.pagination, page },
        })),

      setPageSize: (pageSize) =>
        set((state) => ({
          pagination: { ...state.pagination, pageSize, page: 1 },
        })),

      nextPage: () =>
        set((state) => ({
          pagination: { ...state.pagination, page: state.pagination.page + 1 },
        })),

      prevPage: () =>
        set((state) => ({
          pagination: {
            ...state.pagination,
            page: Math.max(1, state.pagination.page - 1),
          },
        })),

      // Selection actions
      selectRun: (selectedRunId) =>
        set((state) => ({
          selection: {
            ...state.selection,
            selectedRunId,
            selectedCaseId: null, // Clear case selection when changing run
          },
        })),

      selectCase: (selectedCaseId) =>
        set((state) => ({
          selection: { ...state.selection, selectedCaseId },
        })),

      toggleSuiteExpanded: (suiteId) =>
        set((state) => {
          const expandedSuites = new Set(state.selection.expandedSuites);
          if (expandedSuites.has(suiteId)) {
            expandedSuites.delete(suiteId);
          } else {
            expandedSuites.add(suiteId);
          }
          return {
            selection: { ...state.selection, expandedSuites },
          };
        }),

      clearSelection: () =>
        set({ selection: DEFAULT_SELECTION }),

      // Preference actions
      setViewMode: (viewMode) =>
        set((state) => ({
          preferences: { ...state.preferences, viewMode },
        })),

      setAutoRefresh: (autoRefresh) =>
        set((state) => ({
          preferences: { ...state.preferences, autoRefresh },
        })),

      setRefreshInterval: (refreshInterval) =>
        set((state) => ({
          preferences: { ...state.preferences, refreshInterval },
        })),

      togglePreference: (key) =>
        set((state) => ({
          preferences: {
            ...state.preferences,
            [key]: !state.preferences[key],
          },
        })),

      // Modal actions
      openCreateModal: () => set({ isCreateModalOpen: true }),
      closeCreateModal: () => set({ isCreateModalOpen: false }),

      openDeleteModal: (runToDelete) =>
        set({ isDeleteModalOpen: true, runToDelete }),

      closeDeleteModal: () =>
        set({ isDeleteModalOpen: false, runToDelete: null }),

      // Reset
      reset: () =>
        set({
          filters: DEFAULT_FILTERS,
          sort: DEFAULT_SORT,
          pagination: DEFAULT_PAGINATION,
          selection: DEFAULT_SELECTION,
          isCreateModalOpen: false,
          isDeleteModalOpen: false,
          runToDelete: null,
          // Preserve preferences
        }),
    }),
    {
      name: 'e2e-test-dashboard',
      storage: createJSONStorage(() => localStorage),
      // Only persist preferences
      partialize: (state) => ({
        preferences: state.preferences,
      }),
    }
  )
);

// ============================================================================
// Selector Hooks
// ============================================================================

/**
 * Select filters state
 */
export const useTestDashboardFilters = () =>
  useTestDashboardStore((state) => state.filters);

/**
 * Select sort options
 */
export const useTestDashboardSort = () =>
  useTestDashboardStore((state) => state.sort);

/**
 * Select pagination state
 */
export const useTestDashboardPagination = () =>
  useTestDashboardStore((state) => state.pagination);

/**
 * Select selection state
 */
export const useTestDashboardSelection = () =>
  useTestDashboardStore((state) => state.selection);

/**
 * Select preferences
 */
export const useTestDashboardPreferences = () =>
  useTestDashboardStore((state) => state.preferences);

/**
 * Check if any filters are active
 */
export const useHasActiveFilters = () =>
  useTestDashboardStore((state) => {
    const { search, statusFilters, dateRange } = state.filters;
    return (
      search.length > 0 ||
      statusFilters.length > 0 ||
      dateRange.start !== null ||
      dateRange.end !== null
    );
  });
