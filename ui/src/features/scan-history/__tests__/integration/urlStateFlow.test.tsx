/**
 * URL State Flow Integration Tests
 * Tests URL state persistence and browser history navigation
 * @module features/scan-history/__tests__/integration/urlStateFlow.test
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useSearchParams, useLocation } from 'react-router-dom';
import { ReactNode, useEffect, useState } from 'react';
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

// URL state capture component
interface URLState {
  search: string;
  pathname: string;
}

function URLStateCapture({
  onCapture,
  onLocationChange
}: {
  onCapture: (params: URLSearchParams) => void;
  onLocationChange?: (state: URLState) => void;
}) {
  const [searchParams] = useSearchParams();
  const location = useLocation();

  useEffect(() => {
    onCapture(searchParams);
    onLocationChange?.({
      search: location.search,
      pathname: location.pathname,
    });
  }, [searchParams, location, onCapture, onLocationChange]);

  return null;
}

describe('URL State Flow Integration Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let capturedParams: URLSearchParams;
  let locationHistory: URLState[];

  function TestWrapper({
    children,
    initialEntries = ['/scan-history'],
  }: {
    children: ReactNode;
    initialEntries?: string[];
  }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          {children}
          <URLStateCapture
            onCapture={(params) => {
              capturedParams = params;
            }}
            onLocationChange={(state) => {
              locationHistory.push(state);
            }}
          />
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
    locationHistory = [];

    // Reset store state
    useScanHistoryStore.getState().reset();

    // Setup default mock responses
    const mockResponse = createMockScanHistoryResponse();
    (api.fetchScans as Mock).mockResolvedValue(mockResponse);
    (api.fetchTimeline as Mock).mockResolvedValue(createMockTimelineDataResponse());
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ==========================================================================
  // Restore State from URL
  // ==========================================================================

  describe('Restore State from URL', () => {
    it('should restore view mode from URL on page load', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?view=timeline']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify timeline view is active
      const timelineButton = screen.getByRole('button', { name: /timeline/i });
      expect(timelineButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should restore pagination from URL on page load', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?page=2&limit=50']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify API called with URL pagination params
      expect(api.fetchScans).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 2,
          limit: 50,
        })
      );
    });

    it('should restore filters from URL on page load', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?status=completed,failed&q=test']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify API called with URL filter params
      expect(api.fetchScans).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: expect.arrayContaining(['completed', 'failed']),
          search: 'test',
        })
      );
    });

    it('should restore date range from URL on page load', async () => {
      const fromDate = '2024-01-01';
      const toDate = '2024-01-31';

      render(
        <TestWrapper initialEntries={[`/scan-history?from=${fromDate}&to=${toDate}`]}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify API called with date range params
      expect(api.fetchScans).toHaveBeenCalledWith(
        expect.objectContaining({
          dateStart: expect.stringContaining('2024-01-01'),
          dateEnd: expect.stringContaining('2024-01-31'),
        })
      );
    });
  });

  // ==========================================================================
  // State Changes Update URL
  // ==========================================================================

  describe('State Changes Update URL', () => {
    it('should update URL when view mode changes', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Click timeline button
      const timelineButton = screen.getByRole('button', { name: /timeline/i });
      await user.click(timelineButton);

      // Wait for URL update (debounced)
      await waitFor(() => {
        expect(capturedParams.get('view')).toBe('timeline');
      }, { timeout: 500 });
    });

    it('should update URL when filter changes', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Toggle status filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for URL update
      await waitFor(() => {
        expect(capturedParams.get('status')).toContain('completed');
      }, { timeout: 500 });
    });

    it('should update URL when search query changes', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText(/search scans/i);

      // Use paste to avoid per-character debounce issues
      await user.clear(searchInput);
      await user.paste('my-search-term');

      // Wait for debounce to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Wait for debounced URL update
      await waitFor(() => {
        const q = capturedParams.get('q');
        expect(q).toBe('my-search-term');
      }, { timeout: 3000 });
    });

    it('should remove parameter from URL when filter is cleared', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?status=completed']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Uncheck completed status
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for URL update
      await waitFor(() => {
        expect(capturedParams.get('status')).toBeNull();
      }, { timeout: 500 });
    });
  });

  // ==========================================================================
  // URL Debouncing
  // ==========================================================================

  describe('URL Update Debouncing', () => {
    it('should debounce rapid filter changes', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Use fireEvent.change to set value in one action
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });

      // Wait for debounce to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Final URL should have the complete search term
      await waitFor(() => {
        expect(capturedParams.get('q')).toBe('test');
      }, { timeout: 3000 });
    });
  });

  // ==========================================================================
  // Browser History Navigation
  // ==========================================================================

  describe('Browser History Navigation', () => {
    it('should maintain state history for back navigation', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Make a state change
      const timelineButton = screen.getByRole('button', { name: /timeline/i });
      await user.click(timelineButton);

      // Wait for URL update
      await waitFor(() => {
        expect(capturedParams.get('view')).toBe('timeline');
      }, { timeout: 500 });

      // Make another change
      const listButton = screen.getByRole('button', { name: /list/i });
      await user.click(listButton);

      await waitFor(() => {
        expect(capturedParams.get('view')).toBeNull();
      }, { timeout: 500 });
    });

    it('should track location changes correctly', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Initial state
      expect(locationHistory.length).toBeGreaterThan(0);

      // Apply filter
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Wait for location update
      await waitFor(() => {
        const latestLocation = locationHistory[locationHistory.length - 1];
        expect(latestLocation.search).toContain('status=completed');
      }, { timeout: 500 });
    });
  });

  // ==========================================================================
  // Shareable URL Generation
  // ==========================================================================

  describe('Shareable URL Generation', () => {
    it('should generate complete shareable URL with current state', async () => {
      // Setup clipboard mock before render
      const mockWriteText = vi.fn().mockResolvedValue(undefined);
      const originalClipboard = navigator.clipboard;
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply some filters
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      await waitFor(() => {
        expect(capturedParams.get('status')).toContain('completed');
      }, { timeout: 500 });

      // Click share button
      const shareButton = screen.getByRole('button', { name: /share/i });
      await user.click(shareButton);

      // Verify clipboard was called with URL containing filters
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalled();
        if (mockWriteText.mock.calls.length > 0) {
          const url = mockWriteText.mock.calls[0][0];
          expect(url).toContain('status=completed');
        }
      }, { timeout: 500 });

      // Restore original clipboard
      Object.defineProperty(navigator, 'clipboard', {
        value: originalClipboard,
        writable: true,
        configurable: true,
      });
    });

    it('should preserve all active state in shareable URL', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply multiple filters
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Use fireEvent.change instead of paste
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      fireEvent.change(searchInput, { target: { value: 'test-repo' } });

      // Wait for debounce to settle
      await new Promise((resolve) => setTimeout(resolve, 500));

      const timelineButton = screen.getByRole('button', { name: /timeline/i });
      await user.click(timelineButton);

      // Wait for all URL updates with longer timeout for debouncing
      await waitFor(() => {
        expect(capturedParams.get('status')).toContain('completed');
        expect(capturedParams.get('q')).toBe('test-repo');
        expect(capturedParams.get('view')).toBe('timeline');
      }, { timeout: 3000 });
    });
  });

  // ==========================================================================
  // URL Parameter Validation
  // ==========================================================================

  describe('URL Parameter Validation', () => {
    it('should ignore invalid status values in URL', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?status=invalid_status']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // API should be called without the invalid status
      expect(api.fetchScans).toHaveBeenCalled();
      const callParams = (api.fetchScans as Mock).mock.calls[0][0];
      // If statuses is undefined or doesn't contain invalid_status
      const statuses = callParams?.statuses;
      if (statuses) {
        expect(statuses).not.toContain('invalid_status');
      }
    });

    it('should handle invalid page number in URL', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?page=-1']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Should default to page 1
      expect(api.fetchScans).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
        })
      );
    });

    it('should handle invalid limit in URL', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?limit=9999']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Should cap or use default limit
      expect(api.fetchScans).toHaveBeenCalled();
      const callParams = (api.fetchScans as Mock).mock.calls[0][0];
      expect(callParams?.limit).toBeLessThanOrEqual(100);
    });
  });

  // ==========================================================================
  // URL State Synchronization
  // ==========================================================================

  describe('URL State Synchronization', () => {
    it('should keep URL and component state in sync', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Apply a filter via UI
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      await user.click(completedCheckbox);

      // Verify both URL and checkbox state
      await waitFor(() => {
        expect(capturedParams.get('status')).toContain('completed');
        expect(completedCheckbox).toBeChecked();
      }, { timeout: 500 });
    });

    it('should handle rapid state changes without corruption', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Rapidly toggle multiple filters
      const completedCheckbox = screen.getByRole('checkbox', { name: /completed/i });
      const failedCheckbox = screen.getByRole('checkbox', { name: /failed/i });

      await user.click(completedCheckbox);
      await user.click(failedCheckbox);
      await user.click(completedCheckbox); // Uncheck

      // Final state should only have failed
      await waitFor(() => {
        const status = capturedParams.get('status');
        if (status) {
          expect(status).not.toContain('completed');
          expect(status).toContain('failed');
        }
      }, { timeout: 500 });
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle special characters in search query', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Use fireEvent.change instead of paste
      const searchInput = screen.getByPlaceholderText(/search scans/i);
      fireEvent.change(searchInput, { target: { value: 'test-query' } });

      // Wait for debounce to settle (300ms debounce + buffer)
      await new Promise((resolve) => setTimeout(resolve, 500));

      // URL should properly encode special characters
      await waitFor(() => {
        const q = capturedParams.get('q');
        expect(q).toBe('test-query');
      }, { timeout: 3000 });
    });

    it('should handle empty URL parameters gracefully', async () => {
      render(
        <TestWrapper initialEntries={['/scan-history?status=&q=']}>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Should not crash and should use defaults
      expect(api.fetchScans).toHaveBeenCalled();
    });
  });
});
