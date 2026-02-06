/**
 * E2E UI Stores Index
 * @module e2e/ui/stores
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

export {
  useTestDashboardStore,
  useTestDashboardFilters,
  useTestDashboardSort,
  useTestDashboardPagination,
  useTestDashboardSelection,
  useTestDashboardPreferences,
  useHasActiveFilters,
  type TestDashboardState,
  type DashboardViewMode,
  type SortOptions,
  type FilterState,
  type SelectionState,
  type PaginationState as StorePaginationState,
  type DashboardPreferences,
} from './test-dashboard.store';
