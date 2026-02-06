/**
 * Scan History Test Utilities
 * Mock data factories and render helpers for scan history feature tests
 * @module features/scan-history/__tests__/utils/testUtils
 */

import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import { ReactNode, ReactElement } from 'react';
import { vi } from 'vitest';
import type {
  ScanId,
  RepositoryId,
  Scan,
  ScanMetrics,
  ScanStatus,
  ScanHistoryFilters,
  DateRange,
} from '../../types';
import {
  DEFAULT_SCAN_HISTORY_FILTERS,
  ALL_SCAN_STATUSES,
  createScanId,
  createRepositoryId,
} from '../../types';
import type {
  ScanHistoryResponse,
  ScanDiffResponse,
  TimelineDataResponse,
  TimelineDataPoint,
  ScanDiff,
  DiffMetrics,
  MetricComparison,
  ScanMetricsDiff,
} from '../../types/api';
import type {
  PaginationState,
  TimelineZoom,
  ViewMode,
  SortState,
  SortField,
  SortDirection,
} from '../../types/store';

// ============================================================================
// Query Client Factory
// ============================================================================

/**
 * Create a test-specific QueryClient with disabled retries and caching
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

// ============================================================================
// Provider Wrapper
// ============================================================================

interface WrapperProps {
  children: ReactNode;
}

interface RenderWithProvidersOptions extends RenderOptions {
  queryClient?: QueryClient;
  routerProps?: Omit<MemoryRouterProps, 'children'>;
  initialEntries?: string[];
}

/**
 * Render component with all required providers
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): ReturnType<typeof render> & { queryClient: QueryClient } {
  const {
    queryClient = createTestQueryClient(),
    routerProps = {},
    initialEntries = ['/'],
    ...renderOptions
  } = options;

  function Wrapper({ children }: WrapperProps): JSX.Element {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries} {...routerProps}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}

// ============================================================================
// ID Counters
// ============================================================================

let scanIdCounter = 0;
let repositoryIdCounter = 0;
let diffIdCounter = 0;

/**
 * Reset all ID counters (call in beforeEach)
 */
export function resetIdCounters(): void {
  scanIdCounter = 0;
  repositoryIdCounter = 0;
  diffIdCounter = 0;
}

// ============================================================================
// Mock Data Factories - Metrics
// ============================================================================

/**
 * Create mock ScanMetrics
 */
export function createMockMetrics(
  overrides: Partial<ScanMetrics> = {}
): ScanMetrics {
  return {
    totalFiles: overrides.totalFiles ?? 100,
    analyzedFiles: overrides.analyzedFiles ?? 95,
    issuesFound: overrides.issuesFound ?? 12,
    criticalIssues: overrides.criticalIssues ?? 2,
    warningCount: overrides.warningCount ?? 5,
  };
}

// ============================================================================
// Mock Data Factories - Scans
// ============================================================================

interface CreateMockScanOptions {
  id?: string;
  repositoryId?: string;
  repositoryName?: string;
  status?: ScanStatus;
  startedAt?: string;
  completedAt?: string | null;
  duration?: number | null;
  metrics?: Partial<ScanMetrics>;
}

/**
 * Create a mock Scan with configurable properties
 */
export function createMockScan(
  overrides: CreateMockScanOptions = {}
): Scan {
  const id = overrides.id ?? `scan-${++scanIdCounter}`;
  const repositoryId =
    overrides.repositoryId ?? `repo-${++repositoryIdCounter}`;
  const status = overrides.status ?? 'completed';
  const now = new Date();
  const startedAt =
    overrides.startedAt ?? new Date(now.getTime() - 60000).toISOString();
  const completedAt =
    overrides.completedAt !== undefined
      ? overrides.completedAt
      : status === 'completed'
        ? now.toISOString()
        : null;

  return {
    id: createScanId(id),
    repositoryId: createRepositoryId(repositoryId),
    repositoryName: overrides.repositoryName ?? `test-repo-${repositoryId}`,
    status,
    startedAt,
    completedAt,
    duration:
      overrides.duration !== undefined
        ? overrides.duration
        : completedAt
          ? 60000
          : null,
    metrics: createMockMetrics(overrides.metrics),
  };
}

/**
 * Create multiple mock scans
 */
export function createMockScans(
  count: number,
  overrides: CreateMockScanOptions = {}
): Scan[] {
  return Array.from({ length: count }, () => createMockScan(overrides));
}

/**
 * Create scans with different statuses
 */
export function createMockScansWithStatuses(): Scan[] {
  return ALL_SCAN_STATUSES.map((status) =>
    createMockScan({ status })
  );
}

// ============================================================================
// Mock Data Factories - API Responses
// ============================================================================

/**
 * Create mock ScanHistoryResponse
 */
export function createMockScanHistoryResponse(
  overrides: Partial<ScanHistoryResponse> = {}
): ScanHistoryResponse {
  const scans = overrides.scans ?? createMockScans(5);
  return {
    scans,
    total: overrides.total ?? scans.length,
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
    hasMore: overrides.hasMore ?? false,
  };
}

/**
 * Create mock MetricComparison
 */
export function createMockMetricComparison(
  before: number,
  after: number
): MetricComparison {
  return {
    before,
    after,
    delta: after - before,
  };
}

/**
 * Create mock ScanMetricsDiff
 */
export function createMockScanMetricsDiff(
  overrides: Partial<ScanMetricsDiff> = {}
): ScanMetricsDiff {
  return {
    issuesFound:
      overrides.issuesFound ?? createMockMetricComparison(10, 8),
    criticalIssues:
      overrides.criticalIssues ?? createMockMetricComparison(2, 1),
    warningCount:
      overrides.warningCount ?? createMockMetricComparison(5, 4),
  };
}

/**
 * Create mock DiffMetrics
 */
export function createMockDiffMetrics(
  overrides: Partial<DiffMetrics> = {}
): DiffMetrics {
  return {
    added: overrides.added ?? 3,
    removed: overrides.removed ?? 2,
    changed: overrides.changed ?? 5,
    unchanged: overrides.unchanged ?? 90,
  };
}

/**
 * Create mock ScanDiff
 * IMPORTANT: This must match the ScanDiff type from api.ts which requires:
 * - id: string
 * - baselineScanId: ScanId
 * - comparisonScanId: ScanId
 * - createdAt: string
 * - metrics: DiffMetrics (added, removed, changed, unchanged)
 * - metricsDiff: ScanMetricsDiff
 */
export function createMockScanDiff(
  overrides: Partial<ScanDiff> = {}
): ScanDiff {
  const id = overrides.id ?? `diff-${++diffIdCounter}`;
  const baselineScanId = overrides.baselineScanId ?? createScanId('baseline-1');
  const comparisonScanId =
    overrides.comparisonScanId ?? createScanId('comparison-1');

  return {
    id,
    baselineScanId,
    comparisonScanId,
    createdAt: overrides.createdAt ?? new Date().toISOString(),
    metrics: overrides.metrics ?? createMockDiffMetrics(),
    metricsDiff: overrides.metricsDiff ?? createMockScanMetricsDiff(),
  };
}

/**
 * Create mock ScanDiffResponse
 */
export function createMockScanDiffResponse(
  overrides: Partial<ScanDiffResponse> = {}
): ScanDiffResponse {
  return {
    success: overrides.success ?? true,
    data: overrides.data ?? createMockScanDiff(),
    cached: overrides.cached ?? false,
  };
}

/**
 * Create mock TimelineDataPoint
 */
export function createMockTimelineDataPoint(
  date: string,
  overrides: Partial<TimelineDataPoint> = {}
): TimelineDataPoint {
  return {
    date,
    scanCount: overrides.scanCount ?? Math.floor(Math.random() * 10) + 1,
    completedCount:
      overrides.completedCount ?? Math.floor(Math.random() * 8) + 1,
    failedCount: overrides.failedCount ?? Math.floor(Math.random() * 2),
    averageDuration: overrides.averageDuration ?? Math.floor(Math.random() * 60000) + 10000,
    totalIssues: overrides.totalIssues ?? Math.floor(Math.random() * 50),
  };
}

/**
 * Create mock TimelineDataResponse
 */
export function createMockTimelineDataResponse(
  dayCount: number = 7,
  overrides: Partial<TimelineDataResponse> = {}
): TimelineDataResponse {
  const now = new Date();
  const dataPoints = Array.from({ length: dayCount }, (_, i) => {
    const date = new Date(now.getTime() - (dayCount - 1 - i) * 24 * 60 * 60 * 1000);
    return createMockTimelineDataPoint(date.toISOString().split('T')[0]);
  });

  return {
    dataPoints: overrides.dataPoints ?? dataPoints,
    startDate:
      overrides.startDate ?? dataPoints[0]?.date ?? now.toISOString().split('T')[0],
    endDate:
      overrides.endDate ??
      dataPoints[dataPoints.length - 1]?.date ??
      now.toISOString().split('T')[0],
    granularity: overrides.granularity ?? 'day',
  };
}

// ============================================================================
// Mock Data Factories - Filters
// ============================================================================

/**
 * Create mock ScanHistoryFilters
 */
export function createMockFilters(
  overrides: Partial<ScanHistoryFilters> = {}
): ScanHistoryFilters {
  return {
    ...DEFAULT_SCAN_HISTORY_FILTERS,
    ...overrides,
  };
}

/**
 * Create mock DateRange
 */
export function createMockDateRange(
  startDaysAgo: number = 7,
  endDaysAgo: number = 0
): DateRange {
  const now = new Date();
  return {
    start: new Date(now.getTime() - startDaysAgo * 24 * 60 * 60 * 1000),
    end: new Date(now.getTime() - endDaysAgo * 24 * 60 * 60 * 1000),
  };
}

// ============================================================================
// Mock Data Factories - Store State
// ============================================================================

/**
 * Create mock PaginationState
 */
export function createMockPagination(
  overrides: Partial<PaginationState> = {}
): PaginationState {
  return {
    page: overrides.page ?? 1,
    limit: overrides.limit ?? 20,
    total: overrides.total ?? 100,
    hasMore: overrides.hasMore ?? true,
  };
}

/**
 * Create mock SortState
 */
export function createMockSort(
  overrides: Partial<SortState> = {}
): SortState {
  return {
    field: overrides.field ?? 'startedAt',
    direction: overrides.direction ?? 'desc',
  };
}

// ============================================================================
// Mock Functions
// ============================================================================

/**
 * Create mock useNavigate function
 */
export function createMockNavigate() {
  return vi.fn();
}

/**
 * Create mock useSearchParams
 */
export function createMockSearchParams(
  initialParams: Record<string, string> = {}
) {
  const params = new URLSearchParams(initialParams);
  const setParams = vi.fn(
    (
      newParams:
        | URLSearchParams
        | ((prev: URLSearchParams) => URLSearchParams),
      options?: { replace?: boolean }
    ) => {
      if (typeof newParams === 'function') {
        const updated = newParams(params);
        params.forEach((_, key) => params.delete(key));
        updated.forEach((value, key) => params.set(key, value));
      } else {
        params.forEach((_, key) => params.delete(key));
        newParams.forEach((value, key) => params.set(key, value));
      }
    }
  );

  return [params, setParams] as const;
}

/**
 * Create mock localStorage
 */
export function createMockLocalStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    reset: () => {
      store = {};
    },
  };
}

// ============================================================================
// Wait Utilities
// ============================================================================

/**
 * Wait for specified milliseconds
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wait for next tick
 */
export function waitForNextTick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  createTestQueryClient,
  renderWithProviders,
  resetIdCounters,
  createMockMetrics,
  createMockScan,
  createMockScans,
  createMockScansWithStatuses,
  createMockScanHistoryResponse,
  createMockMetricComparison,
  createMockScanMetricsDiff,
  createMockDiffMetrics,
  createMockScanDiff,
  createMockScanDiffResponse,
  createMockTimelineDataPoint,
  createMockTimelineDataResponse,
  createMockFilters,
  createMockDateRange,
  createMockPagination,
  createMockSort,
  createMockNavigate,
  createMockSearchParams,
  createMockLocalStorage,
  wait,
  waitForNextTick,
};
