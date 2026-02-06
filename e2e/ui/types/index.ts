/**
 * E2E Test Dashboard Types
 * @module e2e/ui/types
 *
 * Type definitions for E2E test dashboard UI components.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import type {
  TestRunId,
  TestSuiteId,
  TestCaseId,
  TestStatus,
  TestRunResult,
  TestSuiteResult,
  TestResult,
  TestRunStats,
} from '../../types/test-types';

// ============================================================================
// Test Run Types
// ============================================================================

/**
 * Test run display status
 */
export type TestRunDisplayStatus =
  | 'pending'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

/**
 * Test run summary for list view
 */
export interface TestRunSummary {
  readonly id: TestRunId;
  readonly name: string;
  readonly status: TestRunDisplayStatus;
  readonly progress: TestRunProgress;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly duration: number;
  readonly stats: TestRunStats;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Test run progress information
 */
export interface TestRunProgress {
  readonly phase: 'setup' | 'running' | 'teardown' | 'completed' | 'failed';
  readonly totalCases: number;
  readonly completedCases: number;
  readonly passedCases: number;
  readonly failedCases: number;
  readonly skippedCases: number;
  readonly currentSuite?: string;
  readonly currentCase?: string;
  readonly elapsedMs: number;
  readonly estimatedRemainingMs?: number;
}

// ============================================================================
// Test Result Types for Display
// ============================================================================

/**
 * Test case result for table display
 */
export interface TestCaseDisplay {
  readonly id: TestCaseId;
  readonly name: string;
  readonly suiteName: string;
  readonly suiteId: TestSuiteId;
  readonly status: TestStatus;
  readonly duration: number;
  readonly startedAt: Date;
  readonly completedAt?: Date;
  readonly error?: TestErrorDisplay;
  readonly retryAttempts?: number;
}

/**
 * Test error display information
 */
export interface TestErrorDisplay {
  readonly name?: string;
  readonly message: string;
  readonly stack?: string;
  readonly expected?: string;
  readonly actual?: string;
  readonly diff?: string;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Test run filter criteria
 */
export interface TestRunFilters {
  readonly status?: TestRunDisplayStatus[];
  readonly search?: string;
  readonly dateRange?: {
    readonly start?: Date;
    readonly end?: Date;
  };
  readonly sortBy?: 'startedAt' | 'completedAt' | 'duration' | 'passRate';
  readonly sortOrder?: 'asc' | 'desc';
}

/**
 * Test case filter criteria
 */
export interface TestCaseFilters {
  readonly status?: TestStatus[];
  readonly suiteId?: TestSuiteId;
  readonly search?: string;
  readonly sortBy?: 'name' | 'duration' | 'status';
  readonly sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination state
 */
export interface PaginationState {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  readonly data: ReadonlyArray<T>;
  readonly pagination: PaginationState;
}

// ============================================================================
// Component Props Types
// ============================================================================

/**
 * Test Dashboard Page props
 */
export interface TestDashboardPageProps {
  readonly className?: string;
}

/**
 * Test Run Card props
 */
export interface TestRunCardProps {
  readonly run: TestRunSummary;
  readonly isSelected?: boolean;
  readonly isCompact?: boolean;
  readonly onSelect?: (id: TestRunId) => void;
  readonly onViewDetails?: (id: TestRunId) => void;
  readonly onCancel?: (id: TestRunId) => void;
  readonly className?: string;
}

/**
 * Test Results Table props
 */
export interface TestResultsTableProps {
  readonly results: ReadonlyArray<TestCaseDisplay>;
  readonly isLoading?: boolean;
  readonly filters?: TestCaseFilters;
  readonly pagination?: PaginationState;
  readonly selectedId?: TestCaseId;
  readonly onSelectResult?: (id: TestCaseId) => void;
  readonly onFilterChange?: (filters: TestCaseFilters) => void;
  readonly onPageChange?: (page: number) => void;
  readonly onSortChange?: (field: string, order: 'asc' | 'desc') => void;
  readonly className?: string;
  readonly emptyMessage?: string;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Use test runs hook return type
 */
export interface UseTestRunsReturn {
  readonly runs: ReadonlyArray<TestRunSummary>;
  readonly pagination: PaginationState;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<void>;
}

/**
 * Use test run details hook return type
 */
export interface UseTestRunDetailsReturn {
  readonly run: TestRunResult | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
  readonly refetch: () => Promise<void>;
}

/**
 * Use create test run hook return type
 */
export interface UseCreateTestRunReturn {
  readonly createRun: (request: CreateTestRunRequest) => Promise<TestRunSummary>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

/**
 * Use cancel test run hook return type
 */
export interface UseCancelTestRunReturn {
  readonly cancelRun: (id: TestRunId) => Promise<void>;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: Error | null;
}

// ============================================================================
// Request Types
// ============================================================================

/**
 * Create test run request
 */
export interface CreateTestRunRequest {
  readonly name?: string;
  readonly suites: ReadonlyArray<string>;
  readonly filter?: {
    readonly suiteIds?: ReadonlyArray<string>;
    readonly caseIds?: ReadonlyArray<string>;
    readonly tags?: ReadonlyArray<string>;
    readonly skipTags?: ReadonlyArray<string>;
  };
  readonly config?: {
    readonly timeout?: number;
    readonly retries?: number;
    readonly parallel?: {
      readonly enabled?: boolean;
      readonly workers?: number;
    };
    readonly stopOnFirstFailure?: boolean;
    readonly verbose?: boolean;
  };
  readonly environment?: {
    readonly baseUrl?: string;
    readonly variables?: Record<string, string>;
  };
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Status Label Mappings
// ============================================================================

/**
 * Status labels for display
 */
export const TEST_STATUS_LABELS: Record<TestRunDisplayStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  passed: 'Passed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  timeout: 'Timeout',
};

/**
 * Status colors for badges
 */
export const TEST_STATUS_COLORS: Record<TestRunDisplayStatus, 'success' | 'error' | 'warning' | 'default'> = {
  pending: 'default',
  running: 'warning',
  passed: 'success',
  failed: 'error',
  cancelled: 'default',
  timeout: 'error',
};

/**
 * Test case status labels
 */
export const TEST_CASE_STATUS_LABELS: Record<TestStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  skipped: 'Skipped',
  pending: 'Pending',
  timeout: 'Timeout',
};

/**
 * Test case status colors
 */
export const TEST_CASE_STATUS_COLORS: Record<TestStatus, 'success' | 'error' | 'warning' | 'default'> = {
  passed: 'success',
  failed: 'error',
  skipped: 'default',
  pending: 'warning',
  timeout: 'error',
};
