/**
 * Test Runs API Client
 * API functions for E2E test run management
 * @module e2e/ui/api/test-runs-api
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import type { TestRunId } from '../../types/test-types';
import type {
  TestRunSummary,
  TestRunFilters,
  TestRunProgress,
  PaginatedResponse,
  CreateTestRunRequest,
} from '../types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * API configuration
 */
const API_CONFIG = {
  baseUrl: typeof process !== 'undefined'
    ? process.env.E2E_API_URL ?? 'http://localhost:3000/api/e2e'
    : '/api/e2e',
  timeout: 30000,
};

// ============================================================================
// HTTP Client
// ============================================================================

/**
 * API error class
 */
export class TestRunsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'TestRunsApiError';
  }
}

/**
 * Make an API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_CONFIG.baseUrl}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData: { message?: string; code?: string; details?: Record<string, unknown> } = {};

    try {
      errorData = await response.json();
    } catch {
      // Ignore JSON parsing errors
    }

    throw new TestRunsApiError(
      errorData.message ?? `API request failed: ${response.status}`,
      response.status,
      errorData.code,
      errorData.details
    );
  }

  return response.json();
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * List test runs with filtering and pagination
 */
export async function listTestRuns(
  params: TestRunFilters & { page?: number; pageSize?: number }
): Promise<PaginatedResponse<TestRunSummary>> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.set('page', String(params.page));
  if (params.pageSize) queryParams.set('pageSize', String(params.pageSize));
  if (params.status?.length) queryParams.set('status', params.status.join(','));
  if (params.search) queryParams.set('search', params.search);
  if (params.dateRange?.start) queryParams.set('since', params.dateRange.start.toISOString());
  if (params.dateRange?.end) queryParams.set('until', params.dateRange.end.toISOString());
  if (params.sortBy) queryParams.set('sortBy', params.sortBy);
  if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);

  const queryString = queryParams.toString();
  const endpoint = `/test-runs${queryString ? `?${queryString}` : ''}`;

  const response = await apiRequest<{
    data: Array<{
      id: string;
      name: string;
      status: string;
      progress: TestRunProgress;
      startedAt: string;
      completedAt?: string;
      duration: number;
      stats: TestRunSummary['stats'];
      metadata?: Record<string, unknown>;
    }>;
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }>(endpoint);

  // Transform dates from strings
  return {
    data: response.data.map((run) => ({
      id: run.id as TestRunId,
      name: run.name,
      status: run.status as TestRunSummary['status'],
      progress: run.progress,
      startedAt: new Date(run.startedAt),
      completedAt: run.completedAt ? new Date(run.completedAt) : undefined,
      duration: run.duration,
      stats: run.stats,
      metadata: run.metadata,
    })),
    pagination: response.pagination,
  };
}

/**
 * Get test run details
 */
export async function getTestRunDetails(id: TestRunId): Promise<TestRunSummary> {
  const response = await apiRequest<{
    id: string;
    name: string;
    status: string;
    progress: TestRunProgress;
    startedAt: string;
    completedAt?: string;
    duration: number;
    stats: TestRunSummary['stats'];
    suites?: Array<unknown>;
    metadata?: Record<string, unknown>;
  }>(`/test-runs/${id}`);

  return {
    id: response.id as TestRunId,
    name: response.name,
    status: response.status as TestRunSummary['status'],
    progress: response.progress,
    startedAt: new Date(response.startedAt),
    completedAt: response.completedAt ? new Date(response.completedAt) : undefined,
    duration: response.duration,
    stats: response.stats,
    metadata: response.metadata,
  };
}

/**
 * Get test run progress (lightweight endpoint for polling)
 */
export async function getTestRunProgress(id: TestRunId): Promise<TestRunProgress> {
  return apiRequest<TestRunProgress>(`/test-runs/${id}/progress`);
}

/**
 * Create a new test run
 */
export async function createTestRun(
  request: CreateTestRunRequest
): Promise<TestRunSummary> {
  const response = await apiRequest<{
    id: string;
    name: string;
    status: string;
    progress: TestRunProgress;
    startedAt: string;
    completedAt?: string;
    duration: number;
    stats: TestRunSummary['stats'];
    metadata?: Record<string, unknown>;
  }>('/test-runs', {
    method: 'POST',
    body: JSON.stringify(request),
  });

  return {
    id: response.id as TestRunId,
    name: response.name,
    status: response.status as TestRunSummary['status'],
    progress: response.progress,
    startedAt: new Date(response.startedAt),
    completedAt: response.completedAt ? new Date(response.completedAt) : undefined,
    duration: response.duration,
    stats: response.stats,
    metadata: response.metadata,
  };
}

/**
 * Cancel a running test run
 */
export async function cancelTestRun(id: TestRunId): Promise<void> {
  await apiRequest<void>(`/test-runs/${id}/cancel`, {
    method: 'POST',
  });
}

/**
 * Retry a failed test run
 */
export async function retryTestRun(id: TestRunId): Promise<TestRunSummary> {
  const response = await apiRequest<{
    id: string;
    name: string;
    status: string;
    progress: TestRunProgress;
    startedAt: string;
    completedAt?: string;
    duration: number;
    stats: TestRunSummary['stats'];
    metadata?: Record<string, unknown>;
  }>(`/test-runs/${id}/retry`, {
    method: 'POST',
  });

  return {
    id: response.id as TestRunId,
    name: response.name,
    status: response.status as TestRunSummary['status'],
    progress: response.progress,
    startedAt: new Date(response.startedAt),
    completedAt: response.completedAt ? new Date(response.completedAt) : undefined,
    duration: response.duration,
    stats: response.stats,
    metadata: response.metadata,
  };
}

/**
 * Delete a test run
 */
export async function deleteTestRun(id: TestRunId): Promise<void> {
  await apiRequest<void>(`/test-runs/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Export test runs API for hooks
 */
export const testRunsApi = {
  listTestRuns,
  getTestRunDetails,
  getTestRunProgress,
  createTestRun,
  cancelTestRun,
  retryTestRun,
  deleteTestRun,
};
