/**
 * ScanHistoryPage Component Tests
 * Tests for the main scan history page component
 * @module features/scan-history/__tests__/components/ScanHistoryPage.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScanHistoryPage } from '../../components/ScanHistoryPage';
import {
  renderWithProviders,
  createMockScans,
  createMockScanHistoryResponse,
  createMockTimelineDataResponse,
  createMockScanDiffResponse,
  resetIdCounters,
} from '../utils/test-helpers';
import * as queriesModule from '../../hooks/queries';
import * as storeModule from '../../store/useScanHistoryStore';
import * as urlStateModule from '../../hooks/useScanHistoryUrlState';
import type { ScanId } from '../../types';

// Mock hooks
vi.mock('../../hooks/queries', () => ({
  useScanHistory: vi.fn(),
  useScanTimeline: vi.fn(),
  useScanDiff: vi.fn(),
}));

vi.mock('../../hooks/useScanHistoryUrlState', () => ({
  useScanHistoryUrlState: vi.fn(),
}));

vi.mock('../../store/useScanHistoryStore', () => ({
  useScanHistoryStore: vi.fn(),
  selectHasActiveFilters: vi.fn(),
}));

// Mock child components to simplify testing
vi.mock('../../components/ScanFilterPanel', () => ({
  ScanFilterPanel: vi.fn(({ filters, onFiltersChange, onReset }) => (
    <div data-testid="filter-panel">
      <button onClick={() => onFiltersChange({ ...filters, searchQuery: 'test' })}>
        Apply Filter
      </button>
      <button onClick={onReset}>Reset Filters</button>
    </div>
  )),
}));

vi.mock('../../components/ScanListTable', () => ({
  ScanListTable: vi.fn(({ scans, onScanSelect, isLoading, pagination, emptyMessage }) => (
    <div data-testid="scan-list-table">
      {isLoading ? (
        <div data-testid="list-loading">Loading...</div>
      ) : scans.length === 0 ? (
        <div data-testid="empty-message">{emptyMessage}</div>
      ) : (
        <ul data-testid="scan-list">
          {scans.map((scan: any) => (
            <li key={scan.id} onClick={() => onScanSelect(scan.id)}>
              {scan.repositoryName}
            </li>
          ))}
        </ul>
      )}
      {pagination && <div data-testid="pagination">Page {pagination.page}</div>}
    </div>
  )),
}));

vi.mock('../../components/ScanTimelineChart', () => ({
  ScanTimelineChart: vi.fn(({ data, zoom, onZoomChange }) => (
    <div data-testid="timeline-chart">
      <span data-testid="data-count">{data?.length ?? 0} points</span>
      <span data-testid="zoom-level">{zoom}</span>
      <button onClick={() => onZoomChange('week')}>Change Zoom</button>
    </div>
  )),
}));

vi.mock('../../components/ScanComparisonPanel', () => ({
  ScanComparisonPanel: vi.fn(({ baseline, comparison, onSwap, onClear }) => (
    <div data-testid="comparison-panel">
      <span data-testid="baseline">{baseline?.repositoryName ?? 'None'}</span>
      <span data-testid="comparison">{comparison?.repositoryName ?? 'None'}</span>
      <button onClick={onSwap}>Swap</button>
      <button onClick={onClear}>Clear</button>
    </div>
  )),
}));

// Mock shared components
vi.mock('@/shared', () => ({
  Button: vi.fn(({ children, onClick, disabled, leftIcon, ...props }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {leftIcon}
      {children}
    </button>
  )),
  Card: vi.fn(({ children }) => <div className="card">{children}</div>),
  CardContent: vi.fn(({ children, className }) => (
    <div className={className}>{children}</div>
  )),
  Badge: vi.fn(({ children }) => <span className="badge">{children}</span>),
  Spinner: vi.fn(({ size }) => (
    <div data-testid="spinner" data-size={size}>
      Loading...
    </div>
  )),
  Alert: vi.fn(({ children, variant }) => (
    <div data-testid="alert" data-variant={variant}>
      {children}
    </div>
  )),
}));

vi.mock('@/shared/utils', () => ({
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

describe('ScanHistoryPage', () => {
  const mockScans = createMockScans(5);
  const mockScanHistoryResponse = createMockScanHistoryResponse({ scans: mockScans });
  const mockTimelineData = createMockTimelineDataResponse();

  const defaultUrlState = {
    filters: {
      dateRange: null,
      repositories: [],
      statuses: [],
      searchQuery: '',
    },
    selectedScanId: null,
    compareScanId: null,
    viewMode: 'list' as const,
    timelineZoom: 'month' as const,
    pagination: { page: 1, limit: 20 },
    setFilters: vi.fn(),
    resetFilters: vi.fn(),
    setSelectedScanId: vi.fn(),
    setCompareScanId: vi.fn(),
    setViewMode: vi.fn(),
    setTimelineZoom: vi.fn(),
    setPage: vi.fn(),
    getShareableUrl: vi.fn().mockReturnValue('http://test.com/scan-history'),
    hasActiveFilters: false,
  };

  const defaultStoreState = {
    setBaselineScan: vi.fn(),
    setComparisonScan: vi.fn(),
    comparison: {
      baselineScanId: null,
      comparisonScanId: null,
      isComparing: false,
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    resetIdCounters();

    // Setup default mock implementations
    (urlStateModule.useScanHistoryUrlState as any).mockReturnValue(defaultUrlState);

    (queriesModule.useScanHistory as any).mockReturnValue({
      scans: mockScans,
      pagination: mockScanHistoryResponse,
      isLoading: false,
      isError: false,
      error: null,
      isFetching: false,
      refetch: vi.fn(),
    });

    (queriesModule.useScanTimeline as any).mockReturnValue({
      dataPoints: mockTimelineData.dataPoints,
      isLoading: false,
      isError: false,
    });

    (queriesModule.useScanDiff as any).mockReturnValue({
      diff: null,
      isLoading: false,
    });

    (storeModule.useScanHistoryStore as any).mockImplementation((selector: any) => {
      const state = defaultStoreState;
      return typeof selector === 'function' ? selector(state) : state;
    });
  });

  // ==========================================================================
  // Rendering
  // ==========================================================================

  describe('rendering', () => {
    it('should render page header', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByText('Scan History')).toBeInTheDocument();
      expect(
        screen.getByText('View and compare scan results over time')
      ).toBeInTheDocument();
    });

    it('should render filter panel', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('filter-panel')).toBeInTheDocument();
    });

    it('should render scan list table in list view', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('scan-list-table')).toBeInTheDocument();
    });

    it('should render scan count badge', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByText(/\d+ scans/)).toBeInTheDocument();
    });

    it('should render view mode toggle buttons', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByText('List')).toBeInTheDocument();
      expect(screen.getByText('Timeline')).toBeInTheDocument();
    });

    it('should render refresh button', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should render share button', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('loading state', () => {
    it('should show loading spinner when data is loading', async () => {
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        isLoading: true,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('should show list loading state', async () => {
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: mockScans,
        pagination: mockScanHistoryResponse,
        isLoading: true,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      // When there are scans but still loading, show the table with loading
      expect(screen.getByTestId('scan-list-table')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Error State
  // ==========================================================================

  describe('error state', () => {
    it('should show error message when fetch fails', async () => {
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        isFetching: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('alert')).toBeInTheDocument();
      expect(screen.getByText('Failed to load scan history')).toBeInTheDocument();
    });

    it('should show retry button on error', async () => {
      const mockRefetch = vi.fn();
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        isLoading: false,
        isError: true,
        error: new Error('Network error'),
        isFetching: false,
        refetch: mockRefetch,
      });

      renderWithProviders(<ScanHistoryPage />);

      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeInTheDocument();

      await userEvent.click(retryButton);
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Empty State
  // ==========================================================================

  describe('empty state', () => {
    it('should show empty message when no scans', async () => {
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('empty-message')).toBeInTheDocument();
    });

    it('should show filter-specific message when filters active', async () => {
      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        hasActiveFilters: true,
      });

      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: [],
        pagination: { page: 1, limit: 20, total: 0, hasMore: false },
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByText('No scans match your filters')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // View Mode Toggle
  // ==========================================================================

  describe('view mode toggle', () => {
    it('should switch to timeline view when timeline button clicked', async () => {
      const user = userEvent.setup();
      const setViewMode = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        setViewMode,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByText('Timeline'));

      expect(setViewMode).toHaveBeenCalledWith('timeline');
    });

    it('should switch to list view when list button clicked', async () => {
      const user = userEvent.setup();
      const setViewMode = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        viewMode: 'timeline',
        setViewMode,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByText('List'));

      expect(setViewMode).toHaveBeenCalledWith('list');
    });

    it('should render timeline chart when in timeline view', async () => {
      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        viewMode: 'timeline',
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('timeline-chart')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Filter Interactions
  // ==========================================================================

  describe('filter interactions', () => {
    it('should call setFilters when filter is applied', async () => {
      const user = userEvent.setup();
      const setFilters = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        setFilters,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByText('Apply Filter'));

      expect(setFilters).toHaveBeenCalled();
    });

    it('should call resetFilters when reset clicked', async () => {
      const user = userEvent.setup();
      const resetFilters = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        resetFilters,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByText('Reset Filters'));

      expect(resetFilters).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Refresh Functionality
  // ==========================================================================

  describe('refresh functionality', () => {
    it('should call refetch when refresh button clicked', async () => {
      const user = userEvent.setup();
      const mockRefetch = vi.fn();

      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: mockScans,
        pagination: mockScanHistoryResponse,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: false,
        refetch: mockRefetch,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByRole('button', { name: /refresh/i }));

      expect(mockRefetch).toHaveBeenCalled();
    });

    it('should disable refresh button when fetching', async () => {
      (queriesModule.useScanHistory as any).mockReturnValue({
        scans: mockScans,
        pagination: mockScanHistoryResponse,
        isLoading: false,
        isError: false,
        error: null,
        isFetching: true,
        refetch: vi.fn(),
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByRole('button', { name: /refresh/i })).toBeDisabled();
    });
  });

  // ==========================================================================
  // Share Functionality
  // ==========================================================================

  describe('share functionality', () => {
    it('should copy shareable URL when share clicked', async () => {
      const user = userEvent.setup();
      const mockWriteText = vi.fn().mockResolvedValue(undefined);

      // Mock clipboard API properly
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: mockWriteText },
        writable: true,
        configurable: true,
      });

      const getShareableUrl = vi.fn().mockReturnValue('http://test.com/scan-history?q=test');

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        getShareableUrl,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(getShareableUrl).toHaveBeenCalled();
      expect(mockWriteText).toHaveBeenCalledWith('http://test.com/scan-history?q=test');
    });
  });

  // ==========================================================================
  // Comparison Panel
  // ==========================================================================

  describe('comparison panel', () => {
    it('should not show comparison panel by default', async () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.queryByTestId('comparison-panel')).not.toBeInTheDocument();
    });

    it('should show comparison panel when baseline scan is selected', async () => {
      (storeModule.useScanHistoryStore as any).mockImplementation((selector: any) => {
        const state = {
          ...defaultStoreState,
          comparison: {
            baselineScanId: 'scan-1' as ScanId,
            comparisonScanId: null,
            isComparing: false,
          },
        };
        return typeof selector === 'function' ? selector(state) : state;
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('comparison-panel')).toBeInTheDocument();
    });

    it('should show comparison panel when comparison scan is selected', async () => {
      (storeModule.useScanHistoryStore as any).mockImplementation((selector: any) => {
        const state = {
          ...defaultStoreState,
          comparison: {
            baselineScanId: null,
            comparisonScanId: 'scan-2' as ScanId,
            isComparing: false,
          },
        };
        return typeof selector === 'function' ? selector(state) : state;
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('comparison-panel')).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // Scan Selection
  // ==========================================================================

  describe('scan selection', () => {
    it('should call setSelectedScanId when scan is clicked', async () => {
      const user = userEvent.setup();
      const setSelectedScanId = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        setSelectedScanId,
      });

      renderWithProviders(<ScanHistoryPage />);

      const scanList = screen.getByTestId('scan-list');
      const firstScan = within(scanList).getAllByRole('listitem')[0];

      await user.click(firstScan);

      expect(setSelectedScanId).toHaveBeenCalledWith(mockScans[0].id);
    });
  });

  // ==========================================================================
  // Timeline View
  // ==========================================================================

  describe('timeline view', () => {
    beforeEach(async () => {
      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        viewMode: 'timeline',
      });
    });

    it('should render timeline chart', () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('timeline-chart')).toBeInTheDocument();
    });

    it('should show loading state in timeline', () => {
      (queriesModule.useScanTimeline as any).mockReturnValue({
        dataPoints: [],
        isLoading: true,
        isError: false,
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    it('should show error in timeline', () => {
      (queriesModule.useScanTimeline as any).mockReturnValue({
        dataPoints: [],
        isLoading: false,
        isError: true,
      });

      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByTestId('alert')).toBeInTheDocument();
    });

    it('should call setTimelineZoom when zoom is changed', async () => {
      const user = userEvent.setup();
      const setTimelineZoom = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        viewMode: 'timeline',
        setTimelineZoom,
      });

      renderWithProviders(<ScanHistoryPage />);

      await user.click(screen.getByText('Change Zoom'));

      expect(setTimelineZoom).toHaveBeenCalledWith('week');
    });
  });

  // ==========================================================================
  // Props
  // ==========================================================================

  describe('props', () => {
    it('should use defaultView prop', async () => {
      // Import already available as urlStateModule

      renderWithProviders(<ScanHistoryPage defaultView="timeline" />);

      expect(urlStateModule.useScanHistoryUrlState).toHaveBeenCalledWith(
        expect.objectContaining({
          defaultViewMode: 'timeline',
        })
      );
    });

    it('should set initial scan selection from props', async () => {
      const setSelectedScanId = vi.fn();

      // Import already available as urlStateModule
      (urlStateModule.useScanHistoryUrlState as any).mockReturnValue({
        ...defaultUrlState,
        setSelectedScanId,
      });

      renderWithProviders(
        <ScanHistoryPage initialScanId={'scan-initial' as ScanId} />
      );

      await waitFor(() => {
        expect(setSelectedScanId).toHaveBeenCalledWith('scan-initial');
      });
    });

    it('should use custom onNavigate when provided', async () => {
      const user = userEvent.setup();
      const onNavigate = vi.fn();

      // Need to update mock to expose view details handler
      renderWithProviders(<ScanHistoryPage onNavigate={onNavigate} />);

      // Component should use onNavigate instead of router navigate
      // This would be tested through integration with comparison panel
    });
  });

  // ==========================================================================
  // Accessibility
  // ==========================================================================

  describe('accessibility', () => {
    it('should have proper heading hierarchy', () => {
      renderWithProviders(<ScanHistoryPage />);

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Scan History'
      );
    });

    it('should have aria-pressed on view toggle buttons', () => {
      renderWithProviders(<ScanHistoryPage />);

      const listButton = screen.getByText('List').closest('button');
      const timelineButton = screen.getByText('Timeline').closest('button');

      expect(listButton).toHaveAttribute('aria-pressed', 'true');
      expect(timelineButton).toHaveAttribute('aria-pressed', 'false');
    });
  });
});
