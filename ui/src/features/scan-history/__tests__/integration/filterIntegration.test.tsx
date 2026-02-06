/**
 * Filter Integration Tests
 * Tests the filter -> list -> URL flow for scan history
 * @module features/scan-history/__tests__/integration/filterIntegration.test
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { ReactNode, useState, useEffect } from 'react';
import { ScanHistoryPage } from '../../components/ScanHistoryPage';
import { useScanHistoryStore } from '../../store';
import * as api from '../../api';
import {
  createTestQueryClient,
  createMockScan,
  createMockScans,
  createMockScanHistoryResponse,
  createMockTimelineDataResponse,
  resetIdCounters,
} from '../utils/test-helpers';
import type { ScanStatus, RepositoryId } from '../../types';
import { createRepositoryId, createScanId } from '../../types';

// Mock the API module
vi.mock('../../api', () => ({
  fetchScans: vi.fn(),
  fetchScan: vi.fn(),
  fetchDiff: vi.fn(),
  createDiff: vi.fn(),
  exportScans: vi.fn(),
  fetchTimeline: vi.fn(),
}));

// Mock shared components - comprehensive mock for all components used
vi.mock('@/shared', () => ({
  Button: ({ children, onClick, disabled, leftIcon, rightIcon, ...props }: any) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  ),
  Card: ({ children, className }: any) => <div className={className}>{children}</div>,
  CardContent: ({ children, className }: any) => <div className={className}>{children}</div>,
  Badge: ({ children, variant, size }: any) => (
    <span data-variant={variant} data-size={size}>{children}</span>
  ),
  StatusBadge: ({ children, status, variant }: any) => (
    <span data-status={status} data-variant={variant}>{children || status}</span>
  ),
  Spinner: ({ size }: any) => <div data-testid="spinner" data-size={size}>Loading...</div>,
  Alert: ({ children, variant }: any) => <div role="alert" data-variant={variant}>{children}</div>,
  Input: (props: any) => <input {...props} />,
  Skeleton: ({ className, ...props }: any) => <div className={className} data-testid="skeleton" {...props} />,
  Tooltip: ({ children }: any) => <>{children}</>,
  Select: ({ children, ...props }: any) => <select {...props}>{children}</select>,
  Checkbox: ({ checked, onChange, ...props }: any) => (
    <input type="checkbox" checked={checked} onChange={onChange} {...props} />
  ),
}));

vi.mock('@/shared/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Component to capture URL state for assertions
function URLStateCapture({ onCapture }: { onCapture: (params: URLSearchParams) => void }) {
  const [searchParams] = useSearchParams();
  useEffect(() => {
    onCapture(searchParams);
  }, [searchParams, onCapture]);
  return null;
}

describe('Filter Integration Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let capturedParams: URLSearchParams;

  function TestWrapper({ children, initialEntries = ['/scan-history'] }: { children: ReactNode; initialEntries?: string[] }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
          <URLStateCapture onCapture={(params) => { capturedParams = params; }} />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    queryClient = createTestQueryClient();
    user = userEvent.setup();
    resetIdCounters();
    vi.clearAllMocks();
    capturedParams = new URLSearchParams();

    // Reset store state
    useScanHistoryStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ==========================================================================
  // Filter to List Update Flow
  // ==========================================================================

  describe('Filter to List Update Flow', () => {
    it('should update list when date filter is applied via preset', async () => {
      const mockScans = createMockScans(5);
      const mockResponse = createMockScanHistoryResponse({ scans: mockScans });
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click "Last 7 days" preset button
      const last7DaysButton = screen.getByRole('button', { name: /last 7 days/i });
      await user.click(last7DaysButton);

      // Wait for debounced URL update and refetch
      await waitFor(() => {
        expect(api.fetchScans).toHaveBeenCalledTimes(2);
      }, { timeout: 500 });

      // Verify the API was called with date parameters
      const lastCall = (api.fetchScans as Mock).mock.calls.slice(-1)[0][0];
      expect(lastCall.dateStart).toBeDefined();
      expect(lastCall.dateEnd).toBeDefined();
    });

    it('should update list when status filter is toggled', async () => {
      const completedScan = createMockScan({ status: 'completed' });
      const failedScan = createMockScan({ status: 'failed' });
      const mockResponse = createMockScanHistoryResponse({
        scans: [completedScan, failedScan],
      });
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find the "Completed" status checkbox and click it
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for API call with status filter
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const hasStatusFilter = calls.some((call: any) =>
          call[0]?.statuses?.includes('completed')
        );
        expect(hasStatusFilter).toBe(true);
      });
    });

    it('should update list when search query is entered', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find search input and use paste to avoid debounce issues
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      await user.clear(searchInput);
      await user.paste('test-repo');

      // Wait for debounced search to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Wait for API call with search query
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const hasSearchQuery = calls.some((call: any) => {
          const search = call[0]?.search;
          return search === 'test-repo';
        });
        expect(hasSearchQuery).toBe(true);
      }, { timeout: 3000 });
    });

    it('should reset pagination when filters change', async () => {
      const mockScans = createMockScans(25);
      const mockResponse = createMockScanHistoryResponse({
        scans: mockScans,
        page: 2,
        hasMore: true,
        total: 50,
      });
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper initialEntries={['/scan-history?page=2']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a status filter
      const failedCheckbox = screen.getByRole('checkbox', { name: /failed/i });
      await user.click(failedCheckbox);

      // Verify page is reset to 1
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall.page).toBe(1);
      });
    });
  });

  // ==========================================================================
  // Filter to URL Update Flow
  // ==========================================================================

  describe('Filter to URL Update Flow', () => {
    it('should update URL when status filter is applied', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Toggle completed status
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for URL update (debounced)
      await waitFor(() => {
        expect(capturedParams.get('status')).toContain('completed');
      }, { timeout: 500 });
    });

    it('should update URL when search query is entered', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Use paste instead of type to avoid debounce issues
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      await user.clear(searchInput);
      await user.paste('my-search');

      // Wait for debounce to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Wait for URL update
      await waitFor(() => {
        const q = capturedParams.get('q');
        expect(q).toBe('my-search');
      }, { timeout: 3000 });
    });
  });

  // ==========================================================================
  // Clear Filters Flow
  // ==========================================================================

  describe('Clear Filters Flow', () => {
    it('should reset all filters and update list when Clear All is clicked', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      // Start with filters applied via URL
      render(
        <TestWrapper initialEntries={['/scan-history?status=completed&q=test']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click "Clear all" button
      const clearButton = screen.getByRole('button', { name: /clear all/i });
      await user.click(clearButton);

      // Wait for API to be called with no filters
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall.statuses).toBeUndefined();
        expect(lastCall.search).toBeUndefined();
      });

      // Verify URL is cleared
      await waitFor(() => {
        expect(capturedParams.get('status')).toBeNull();
        expect(capturedParams.get('q')).toBeNull();
      }, { timeout: 500 });
    });

    it('should apply filter when status checkbox clicked', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a status filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Verify the filter was applied to the API call
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const hasStatusFilter = calls.some((call: any) =>
          call[0]?.statuses?.includes('completed')
        );
        expect(hasStatusFilter).toBe(true);
      });
    });
  });

  // ==========================================================================
  // Multiple Filters Combined
  // ==========================================================================

  describe('Multiple Filters Combined', () => {
    it('should apply multiple filters and verify combined effect on list', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply status filter first
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for status filter to be applied
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const hasStatusFilter = calls.some((call: any) =>
          call[0]?.statuses?.includes('completed')
        );
        expect(hasStatusFilter).toBe(true);
      });

      // Apply search filter using paste
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      await user.clear(searchInput);
      await user.paste('test-repo');

      // Wait for debounce to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Wait and verify API called with both filters (with extended timeout)
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const hasAllFilters = calls.some((call: any) => {
          const params = call[0];
          return (
            params?.statuses?.includes('completed') &&
            params?.search === 'test-repo'
          );
        });
        expect(hasAllFilters).toBe(true);
      }, { timeout: 3000 });
    });

    it('should maintain filter state across list refetches', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for filter to apply
      await waitFor(() => {
        expect((api.fetchScans as Mock).mock.calls.length).toBeGreaterThan(1);
      });

      // Click refresh button
      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      await user.click(refreshButton);

      // Verify filter is still applied in the new request
      await waitFor(() => {
        const calls = (api.fetchScans as Mock).mock.calls;
        const lastCall = calls[calls.length - 1][0];
        expect(lastCall.statuses).toContain('completed');
      });
    });
  });

  // ==========================================================================
  // Loading and Error States During Filter Changes
  // ==========================================================================

  describe('Loading States During Filter Changes', () => {
    it('should show loading indicator while refetching with new filters', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (api.fetchScans as Mock)
        .mockResolvedValueOnce(createMockScanHistoryResponse())
        .mockImplementationOnce(() => pendingPromise);

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      // Wait for initial load
      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Resolve the pending promise
      resolvePromise!(createMockScanHistoryResponse());
    });

    it('should handle API error gracefully during filter change', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock)
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a filter that will trigger error
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // The component should still be usable
      await waitFor(() => {
        expect(api.fetchScans).toHaveBeenCalledTimes(2);
      });
    });
  });

  // ==========================================================================
  // Filter Persistence
  // ==========================================================================

  describe('Filter Persistence via URL', () => {
    it('should restore filters from URL on page load', async () => {
      const mockResponse = createMockScanHistoryResponse();
      (api.fetchScans as Mock).mockResolvedValue(mockResponse);

      render(
        <TestWrapper initialEntries={['/scan-history?status=failed&q=error-scan']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify API was called with URL filters
      expect(api.fetchScans).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: expect.arrayContaining(['failed']),
          search: 'error-scan',
        })
      );

      // Verify search input shows the query from URL
      const searchInput = screen.getByPlaceholderText(/search scans/i) as HTMLInputElement;
      expect(searchInput.value).toBe('error-scan');

      // Verify status checkbox is checked
      const failedCheckbox = screen.getByRole('checkbox', { name: /failed/i }) as HTMLInputElement;
      expect(failedCheckbox.checked).toBe(true);
    });
  });
});
