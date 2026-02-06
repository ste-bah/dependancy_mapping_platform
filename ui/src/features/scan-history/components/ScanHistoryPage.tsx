/**
 * Scan History Page Component
 * Main container for the scan history timeline feature
 * @module features/scan-history/components/ScanHistoryPage
 */

import { useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, CardContent, Badge, Spinner, Alert } from '@/shared';
import { cn } from '@/shared/utils';
import { useScanHistoryUrlState } from '../hooks/useScanHistoryUrlState';
import { useScanHistory, useScanTimeline, useScanDiff } from '../hooks/queries';
import { useScanHistoryStore, selectHasActiveFilters } from '../store';
import { ScanFilterPanel } from './ScanFilterPanel';
import { ScanListTable } from './ScanListTable';
import { ScanTimelineChart } from './ScanTimelineChart';
import { ScanComparisonPanel } from './ScanComparisonPanel';
import type { ScanHistoryPageProps } from '../types';
import type { ScanId, RepositoryId, DateRange, Scan } from '../types';

// ============================================================================
// Icons
// ============================================================================

function ListIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
      />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z"
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Scan History Page
 * Main container that orchestrates the scan history timeline feature
 */
export function ScanHistoryPage({
  defaultView = 'list',
  initialScanId,
  initialRepositoryId,
  onNavigate,
}: ScanHistoryPageProps): JSX.Element {
  const navigate = useNavigate();

  // URL state management
  const {
    filters,
    selectedScanId,
    compareScanId,
    viewMode,
    timelineZoom,
    pagination,
    setFilters,
    resetFilters,
    setSelectedScanId,
    setCompareScanId,
    setViewMode,
    setTimelineZoom,
    setPage,
    getShareableUrl,
    hasActiveFilters,
  } = useScanHistoryUrlState({
    defaultViewMode: defaultView,
    onFiltersChange: () => {
      // Filters changed, data will be refetched automatically
    },
  });

  // Store state
  const setBaselineScan = useScanHistoryStore((state) => state.setBaselineScan);
  const setComparisonScan = useScanHistoryStore((state) => state.setComparisonScan);
  const baselineScanId = useScanHistoryStore((state) => state.comparison.baselineScanId);
  const comparisonScanId = useScanHistoryStore((state) => state.comparison.comparisonScanId);

  // Fetch scan history data
  const {
    scans,
    pagination: paginationData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useScanHistory({
    params: {
      page: pagination.page,
      limit: pagination.limit,
      dateStart: filters.dateRange?.start.toISOString(),
      dateEnd: filters.dateRange?.end.toISOString(),
      repositories: filters.repositories.length > 0 ? filters.repositories : undefined,
      statuses: filters.statuses.length > 0 ? filters.statuses : undefined,
      search: filters.searchQuery || undefined,
    },
    enabled: true,
  });

  // Timeline data (for timeline view)
  const timelineRange = useMemo<DateRange>(() => {
    if (filters.dateRange) {
      return filters.dateRange;
    }
    // Default to last 30 days
    return {
      start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: new Date(),
    };
  }, [filters.dateRange]);

  const {
    dataPoints: timelineData,
    isLoading: isTimelineLoading,
    isError: isTimelineError,
  } = useScanTimeline({
    dateRange: timelineRange,
    repositoryIds: filters.repositories.length > 0 ? filters.repositories : undefined,
    enabled: viewMode === 'timeline',
  });

  // Find scan objects for comparison
  const baselineScan = useMemo(() => {
    return scans.find((s) => s.id === baselineScanId) ?? null;
  }, [scans, baselineScanId]);

  const comparisonScan = useMemo(() => {
    return scans.find((s) => s.id === comparisonScanId) ?? null;
  }, [scans, comparisonScanId]);

  // Diff query
  const {
    diff,
    isLoading: isDiffLoading,
  } = useScanDiff({
    baselineScanId: baselineScanId ?? null,
    comparisonScanId: comparisonScanId ?? null,
    enabled: !!baselineScanId && !!comparisonScanId,
  });

  // Handle initial scan selection
  useEffect(() => {
    if (initialScanId && !selectedScanId) {
      setSelectedScanId(initialScanId);
    }
  }, [initialScanId, selectedScanId, setSelectedScanId]);

  // Handler functions
  const handleScanSelect = useCallback(
    (scanId: ScanId) => {
      setSelectedScanId(scanId);
    },
    [setSelectedScanId]
  );

  const handleCompareSelect = useCallback(
    (scanId: ScanId) => {
      if (!baselineScanId) {
        setBaselineScan(scanId);
      } else if (baselineScanId === scanId) {
        // Deselect if clicking the same scan
        setBaselineScan(null);
      } else if (!comparisonScanId) {
        setComparisonScan(scanId);
      } else if (comparisonScanId === scanId) {
        // Deselect comparison
        setComparisonScan(null);
      } else {
        // Replace comparison scan
        setComparisonScan(scanId);
      }
    },
    [baselineScanId, comparisonScanId, setBaselineScan, setComparisonScan]
  );

  const handleSwapComparison = useCallback(() => {
    const tempBaseline = baselineScanId;
    setBaselineScan(comparisonScanId);
    setComparisonScan(tempBaseline);
  }, [baselineScanId, comparisonScanId, setBaselineScan, setComparisonScan]);

  const handleClearComparison = useCallback(() => {
    setBaselineScan(null);
    setComparisonScan(null);
  }, [setBaselineScan, setComparisonScan]);

  const handleTimelineDateRangeChange = useCallback(
    (range: DateRange) => {
      setFilters({
        ...filters,
        dateRange: range,
      });
    },
    [filters, setFilters]
  );

  const handleShareLink = useCallback(() => {
    const url = getShareableUrl();
    navigator.clipboard.writeText(url);
    // TODO: Show toast notification
  }, [getShareableUrl]);

  const handleViewScanDetails = useCallback(
    (scanId: ScanId) => {
      const path = `/scans/${scanId}`;
      if (onNavigate) {
        onNavigate(path);
      } else {
        navigate(path);
      }
    },
    [navigate, onNavigate]
  );

  // Extract unique repositories from scans for filter panel
  const repositories = useMemo(() => {
    const repoMap = new Map<RepositoryId, { id: RepositoryId; name: string }>();
    scans.forEach((scan) => {
      if (!repoMap.has(scan.repositoryId)) {
        repoMap.set(scan.repositoryId, {
          id: scan.repositoryId,
          name: scan.repositoryName,
        });
      }
    });
    return Array.from(repoMap.values());
  }, [scans]);

  // Render loading state
  if (isLoading && scans.length === 0) {
    return (
      <div className="flex h-[600px] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  // Render error state
  if (isError) {
    return (
      <div className="space-y-6">
        <PageHeader
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          onRefresh={refetch}
          isRefreshing={isFetching}
          onShareLink={handleShareLink}
        />
        <Alert variant="error">
          <p>Failed to load scan history</p>
          {error && <p className="text-sm">{error.message}</p>}
          <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-2">
            Retry
          </Button>
        </Alert>
      </div>
    );
  }

  const showComparison = baselineScanId !== null || comparisonScanId !== null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={refetch}
        isRefreshing={isFetching}
        onShareLink={handleShareLink}
        totalScans={paginationData.total}
      />

      <div className="flex gap-6">
        {/* Filter Panel */}
        <aside className="w-72 flex-shrink-0">
          <ScanFilterPanel
            filters={filters}
            onFiltersChange={setFilters}
            onReset={resetFilters}
            repositories={repositories}
            showFilterCount
          />
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {viewMode === 'timeline' ? (
            <Card>
              <CardContent className="p-4">
                {isTimelineLoading ? (
                  <div className="flex h-80 items-center justify-center">
                    <Spinner size="md" />
                  </div>
                ) : isTimelineError ? (
                  <Alert variant="error">
                    Failed to load timeline data
                  </Alert>
                ) : (
                  <ScanTimelineChart
                    data={timelineData}
                    zoom={timelineZoom}
                    onZoomChange={setTimelineZoom}
                    onDateRangeChange={handleTimelineDateRangeChange}
                    selectedScanId={selectedScanId}
                    onScanSelect={handleScanSelect}
                    height={320}
                    showLegend
                    enableZoomControls
                  />
                )}
              </CardContent>
            </Card>
          ) : (
            <ScanListTable
              scans={scans}
              selectedScanId={selectedScanId}
              onScanSelect={handleScanSelect}
              onCompareSelect={handleCompareSelect}
              isLoading={isLoading}
              pagination={paginationData}
              onPageChange={setPage}
              enableSelection
              selectedIds={
                new Set(
                  [baselineScanId, comparisonScanId].filter(Boolean) as ScanId[]
                )
              }
              emptyMessage={
                hasActiveFilters
                  ? 'No scans match your filters'
                  : 'No scan history available'
              }
            />
          )}
        </main>

        {/* Comparison Panel (shown when comparing) */}
        {showComparison && (
          <aside className="w-80 flex-shrink-0">
            <ScanComparisonPanel
              baseline={baselineScan}
              comparison={comparisonScan}
              diff={diff}
              isLoading={isDiffLoading}
              onSwap={handleSwapComparison}
              onClear={handleClearComparison}
              onBaselineClick={
                baselineScan
                  ? () => handleViewScanDetails(baselineScan.id)
                  : undefined
              }
              onComparisonClick={
                comparisonScan
                  ? () => handleViewScanDetails(comparisonScan.id)
                  : undefined
              }
              showDetailedMetrics
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Page Header Component
// ============================================================================

interface PageHeaderProps {
  viewMode: 'list' | 'timeline';
  onViewModeChange: (mode: 'list' | 'timeline') => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onShareLink: () => void;
  totalScans?: number;
}

function PageHeader({
  viewMode,
  onViewModeChange,
  onRefresh,
  isRefreshing,
  onShareLink,
  totalScans = 0,
}: PageHeaderProps): JSX.Element {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Scan History</h1>
          {totalScans > 0 && (
            <Badge variant="secondary" size="sm">
              {totalScans} scans
            </Badge>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">
          View and compare scan results over time
        </p>
      </div>

      <div className="flex items-center gap-2">
        {/* View Toggle */}
        <div className="flex rounded-lg border bg-white p-1">
          <button
            type="button"
            onClick={() => onViewModeChange('list')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:text-gray-900'
            )}
            aria-pressed={viewMode === 'list'}
          >
            <ListIcon className="h-4 w-4" />
            List
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('timeline')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              viewMode === 'timeline'
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:text-gray-900'
            )}
            aria-pressed={viewMode === 'timeline'}
          >
            <ChartIcon className="h-4 w-4" />
            Timeline
          </button>
        </div>

        {/* Actions */}
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          leftIcon={
            <RefreshIcon
              className={cn('h-4 w-4', isRefreshing && 'animate-spin')}
            />
          }
        >
          Refresh
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onShareLink}
          leftIcon={<ShareIcon className="h-4 w-4" />}
        >
          Share
        </Button>
      </div>
    </div>
  );
}

export default ScanHistoryPage;
