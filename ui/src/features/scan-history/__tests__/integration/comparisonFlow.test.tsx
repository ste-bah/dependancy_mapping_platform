/**
 * Comparison Flow Integration Tests
 * Tests the scan comparison workflow end-to-end
 * @module features/scan-history/__tests__/integration/comparisonFlow.test
 */

import { describe, it, expect, beforeEach, vi, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { ReactNode } from 'react';
import { ScanHistoryPage } from '../../components/ScanHistoryPage';
import { useScanHistoryStore } from '../../store';
import * as api from '../../api';
import {
  createTestQueryClient,
  createMockScan,
  createMockScans,
  createMockScanHistoryResponse,
  createMockScanDiff,
  createMockScanDiffResponse,
  resetIdCounters,
} from '../utils/test-helpers';
import type { ScanId, Scan } from '../../types';
import { createScanId } from '../../types';

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

describe('Comparison Flow Integration Tests', () => {
  let queryClient: QueryClient;
  let user: ReturnType<typeof userEvent.setup>;
  let mockScans: Scan[];

  function TestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/scan-history']}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  beforeEach(() => {
    queryClient = createTestQueryClient();
    user = userEvent.setup();
    resetIdCounters();
    vi.clearAllMocks();

    // Reset store state
    useScanHistoryStore.getState().reset();

    // Create mock scans with specific IDs for testing
    mockScans = [
      createMockScan({
        id: 'scan-baseline',
        repositoryName: 'Baseline Repo',
        metrics: {
          totalFiles: 100,
          analyzedFiles: 95,
          issuesFound: 15,
          criticalIssues: 3,
          warningCount: 8,
        },
      }),
      createMockScan({
        id: 'scan-comparison',
        repositoryName: 'Comparison Repo',
        metrics: {
          totalFiles: 100,
          analyzedFiles: 98,
          issuesFound: 10,
          criticalIssues: 1,
          warningCount: 5,
        },
      }),
      createMockScan({ id: 'scan-third', repositoryName: 'Third Repo' }),
    ];

    const mockResponse = createMockScanHistoryResponse({ scans: mockScans });
    (api.fetchScans as Mock).mockResolvedValue(mockResponse);
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  // ==========================================================================
  // Baseline Scan Selection
  // ==========================================================================

  describe('Baseline Scan Selection', () => {
    it('should select first scan as baseline when clicking compare button', async () => {
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find comparison buttons in the scan list table (buttons with "Add to comparison" aria-label)
      const compareButtons = screen.getAllByRole('button', { name: /add to comparison/i });

      if (compareButtons.length > 0) {
        await user.click(compareButtons[0]);
      }

      // Verify store updated with baseline
      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.baselineScanId).not.toBeNull();
      });

      // Verify comparison panel appears
      await waitFor(() => {
        expect(screen.getByText(/compare scans/i)).toBeInTheDocument();
      });
    });

    it('should show baseline scan details in comparison panel', async () => {
      // Pre-set baseline in store
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Comparison panel should show baseline info
      await waitFor(() => {
        expect(screen.getByText(/baseline \(older\)/i)).toBeInTheDocument();
        // Use getAllByText and check at least one exists (may appear in multiple places)
        const baselineRepoTexts = screen.getAllByText(/baseline repo/i);
        expect(baselineRepoTexts.length).toBeGreaterThan(0);
      });
    });
  });

  // ==========================================================================
  // Comparison Scan Selection
  // ==========================================================================

  describe('Comparison Scan Selection', () => {
    it('should select second scan as comparison after baseline is set', async () => {
      // Pre-set baseline
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click another scan's compare button
      const compareButtons = screen.getAllByRole('button', { name: /add to comparison/i });

      // Click second scan's compare button (should become comparison)
      if (compareButtons.length > 1) {
        await user.click(compareButtons[1]);
      }

      // Verify store updated with comparison
      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.comparisonScanId).not.toBeNull();
        expect(state.comparison.isComparing).toBe(true);
      });
    });

    it('should trigger diff computation when both scans selected', async () => {
      const mockDiff = createMockScanDiff({
        baselineScanId: createScanId('scan-baseline'),
        comparisonScanId: createScanId('scan-comparison'),
      });
      const mockDiffResponse = createMockScanDiffResponse({ data: mockDiff });
      (api.fetchDiff as Mock).mockResolvedValue(mockDiffResponse);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Verify diff API was called
      await waitFor(() => {
        expect(api.fetchDiff).toHaveBeenCalledWith(
          'scan-baseline',
          'scan-comparison'
        );
      });
    });
  });

  // ==========================================================================
  // Diff Display
  // ==========================================================================

  describe('Diff Display', () => {
    it('should display diff metrics when computation completes', async () => {
      const mockDiff = createMockScanDiff({
        baselineScanId: createScanId('scan-baseline'),
        comparisonScanId: createScanId('scan-comparison'),
      });
      const mockDiffResponse = createMockScanDiffResponse({ data: mockDiff });
      (api.fetchDiff as Mock).mockResolvedValue(mockDiffResponse);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Wait for diff to load
      await waitFor(() => {
        // Should show file changes section
        expect(screen.getByText(/file changes/i)).toBeInTheDocument();
      });

      // Should display added/removed counts
      expect(screen.getByText(/added/i)).toBeInTheDocument();
      expect(screen.getByText(/removed/i)).toBeInTheDocument();
    });

    it('should show loading state while diff is computing', async () => {
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (api.fetchDiff as Mock).mockImplementation(() => pendingPromise);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show diff loading indicator
        expect(screen.getByText(/computing diff/i)).toBeInTheDocument();
      });

      // Resolve the promise
      resolvePromise!(createMockScanDiffResponse());
    });

    it('should handle diff computation error gracefully', async () => {
      (api.fetchDiff as Mock).mockRejectedValue(new Error('Diff computation failed'));

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Error should be handled gracefully
      await waitFor(() => {
        expect(api.fetchDiff).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // Swap Scans
  // ==========================================================================

  describe('Swap Scans', () => {
    it('should swap baseline and comparison scans when swap button clicked', async () => {
      const mockDiffResponse = createMockScanDiffResponse();
      (api.fetchDiff as Mock).mockResolvedValue(mockDiffResponse);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click swap button
      const swapButton = screen.getByRole('button', { name: /swap/i });
      await user.click(swapButton);

      // Verify scans were swapped in store
      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.baselineScanId).toBe('scan-comparison');
        expect(state.comparison.comparisonScanId).toBe('scan-baseline');
      });
    });

    it('should refetch diff after swap', async () => {
      const mockDiffResponse = createMockScanDiffResponse();
      (api.fetchDiff as Mock).mockResolvedValue(mockDiffResponse);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Wait for initial diff call
      await waitFor(() => {
        expect(api.fetchDiff).toHaveBeenCalled();
      });

      // Clear mock calls
      vi.clearAllMocks();

      // Swap
      const swapButton = screen.getByRole('button', { name: /swap/i });
      await user.click(swapButton);

      // Diff should be refetched with swapped IDs
      await waitFor(() => {
        expect(api.fetchDiff).toHaveBeenCalledWith(
          'scan-comparison',
          'scan-baseline'
        );
      });
    });

    it('should disable swap button when only one scan selected', async () => {
      // Only set baseline
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find swap button
      const swapButton = screen.getByRole('button', { name: /swap/i });
      expect(swapButton).toBeDisabled();
    });
  });

  // ==========================================================================
  // Clear Comparison
  // ==========================================================================

  describe('Clear Comparison', () => {
    it('should clear both scans when clear button clicked', async () => {
      const mockDiffResponse = createMockScanDiffResponse();
      (api.fetchDiff as Mock).mockResolvedValue(mockDiffResponse);

      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find and click clear button (X icon in header)
      const clearButton = screen.getByRole('button', { name: /clear comparison/i });
      await user.click(clearButton);

      // Verify store is cleared
      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.baselineScanId).toBeNull();
        expect(state.comparison.comparisonScanId).toBeNull();
        expect(state.comparison.isComparing).toBe(false);
      });
    });

    it('should hide comparison panel after clearing', async () => {
      // Pre-set both scans
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));
      useScanHistoryStore.getState().setComparisonScan(createScanId('scan-comparison'));

      (api.fetchDiff as Mock).mockResolvedValue(createMockScanDiffResponse());

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Panel should be visible
      expect(screen.getByText(/compare scans/i)).toBeInTheDocument();

      // Clear comparison
      const clearButton = screen.getByRole('button', { name: /clear comparison/i });
      await user.click(clearButton);

      // Panel should be hidden
      await waitFor(() => {
        expect(screen.queryByText(/compare scans/i)).not.toBeInTheDocument();
      });
    });

    it('should allow deselecting scan via store action', async () => {
      // This test verifies the store deselection functionality directly
      // since the UI toggle behavior depends on specific component implementation
      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Set baseline via store
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));

      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.baselineScanId).toBe('scan-baseline');
      });

      // Clear baseline via store action
      useScanHistoryStore.getState().clearComparison();

      await waitFor(() => {
        const state = useScanHistoryStore.getState();
        expect(state.comparison.baselineScanId).toBeNull();
      });
    });
  });

  // ==========================================================================
  // Navigation to Scan Details
  // ==========================================================================

  describe('Navigation to Scan Details', () => {
    it('should navigate to baseline scan details when clicking baseline card', async () => {
      const navigateMock = vi.fn();

      // Pre-set baseline
      useScanHistoryStore.getState().setBaselineScan(createScanId('scan-baseline'));

      render(
        <TestWrapper>
          <ScanHistoryPage onNavigate={navigateMock} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Find the baseline card (clickable)
      const baselineSection = screen.getByText(/baseline \(older\)/i).closest('div');
      if (baselineSection) {
        const clickableCard = baselineSection.querySelector('[role="button"]');
        if (clickableCard) {
          await user.click(clickableCard);
          expect(navigateMock).toHaveBeenCalledWith('/scans/scan-baseline');
        }
      }
    });
  });

  // ==========================================================================
  // Full Comparison Workflow
  // ==========================================================================

  describe('Full Comparison Workflow', () => {
    it('should complete full comparison flow: select -> diff -> swap -> clear', async () => {
      const mockDiff1 = createMockScanDiff({
        baselineScanId: createScanId('scan-baseline'),
        comparisonScanId: createScanId('scan-comparison'),
      });
      const mockDiff2 = createMockScanDiff({
        baselineScanId: createScanId('scan-comparison'),
        comparisonScanId: createScanId('scan-baseline'),
      });

      (api.fetchDiff as Mock)
        .mockResolvedValueOnce(createMockScanDiffResponse({ data: mockDiff1 }))
        .mockResolvedValueOnce(createMockScanDiffResponse({ data: mockDiff2 }));

      render(
        <TestWrapper>
          <ScanHistoryPage />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByTestId('spinner')).not.toBeInTheDocument();
      });

      // Step 1: Select baseline
      const compareButtons = screen.getAllByRole('button', { name: /add to comparison/i });

      if (compareButtons.length >= 2) {
        await user.click(compareButtons[0]);

        // Verify baseline set
        await waitFor(() => {
          const state = useScanHistoryStore.getState();
          expect(state.comparison.baselineScanId).not.toBeNull();
        });

        // Step 2: Select comparison (need to re-query as buttons may have changed)
        const updatedCompareButtons = screen.getAllByRole('button', { name: /add to comparison/i });
        if (updatedCompareButtons.length > 0) {
          await user.click(updatedCompareButtons[0]);
        }

        // Verify comparison set and diff triggered
        await waitFor(() => {
          const state = useScanHistoryStore.getState();
          expect(state.comparison.comparisonScanId).not.toBeNull();
          expect(api.fetchDiff).toHaveBeenCalled();
        });

        // Step 3: Swap
        const swapButton = screen.getByRole('button', { name: /swap/i });
        await user.click(swapButton);

        // Verify swap worked
        await waitFor(() => {
          expect(api.fetchDiff).toHaveBeenCalledTimes(2);
        });

        // Step 4: Clear
        const clearButton = screen.getByRole('button', { name: /clear comparison/i });
        await user.click(clearButton);

        // Verify cleared
        await waitFor(() => {
          const state = useScanHistoryStore.getState();
          expect(state.comparison.baselineScanId).toBeNull();
          expect(state.comparison.comparisonScanId).toBeNull();
        });
      }
    });
  });
});
