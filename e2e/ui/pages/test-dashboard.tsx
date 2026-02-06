/**
 * Test Dashboard Page
 * Main dashboard for E2E test run management
 * @module e2e/ui/pages/test-dashboard
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import { useState, useCallback, useMemo } from 'react';
import type { TestRunId, TestCaseId } from '../../types/test-types';
import type {
  TestDashboardPageProps,
  TestRunFilters,
  TestCaseFilters,
  TestRunDisplayStatus,
  TestCaseDisplay,
} from '../types';
import { useTestRuns, useTestRunDetails, useCreateTestRun, useCancelTestRun } from '../hooks/use-test-runs';
import { TestRunCard } from '../components/test-run-card';
import { TestResultsTable } from '../components/test-results-table';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Class name utility
 */
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

// ============================================================================
// Icons
// ============================================================================

function PlayIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function FilterIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ArrowLeftIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
    </svg>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Page header with title and actions
 */
interface PageHeaderProps {
  title: string;
  description?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

function PageHeader({ title, description, onBack, actions }: PageHeaderProps): JSX.Element {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && (
            <p className="text-sm text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

/**
 * Filter bar component
 */
interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilters: TestRunDisplayStatus[];
  onStatusFilterChange: (statuses: TestRunDisplayStatus[]) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

function FilterBar({
  search,
  onSearchChange,
  statusFilters,
  onStatusFilterChange,
  onRefresh,
  isRefreshing,
}: FilterBarProps): JSX.Element {
  const statusOptions: TestRunDisplayStatus[] = ['pending', 'running', 'passed', 'failed', 'cancelled'];

  const toggleStatus = useCallback((status: TestRunDisplayStatus) => {
    if (statusFilters.includes(status)) {
      onStatusFilterChange(statusFilters.filter((s) => s !== status));
    } else {
      onStatusFilterChange([...statusFilters, status]);
    }
  }, [statusFilters, onStatusFilterChange]);

  return (
    <div className="flex items-center justify-between gap-4 mb-4">
      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search test runs..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className={cn(
            'w-full pl-9 pr-4 py-2 text-sm rounded-md',
            'border border-gray-300 bg-white',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
            'placeholder:text-gray-400'
          )}
          aria-label="Search test runs"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            <XIcon className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Status filters */}
      <div className="flex items-center gap-2">
        <FilterIcon className="h-4 w-4 text-gray-400" />
        <div className="flex items-center gap-1">
          {statusOptions.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => toggleStatus(status)}
              className={cn(
                'px-2 py-1 text-xs font-medium rounded-md transition-colors',
                statusFilters.includes(status)
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Refresh button */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md',
          'border border-gray-300 bg-white text-gray-700',
          'hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
          isRefreshing && 'opacity-50 cursor-not-allowed'
        )}
      >
        <RefreshIcon className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        Refresh
      </button>
    </div>
  );
}

/**
 * Stats summary cards
 */
interface StatsSummaryProps {
  totalRuns: number;
  passedRuns: number;
  failedRuns: number;
  runningRuns: number;
}

function StatsSummary({ totalRuns, passedRuns, failedRuns, runningRuns }: StatsSummaryProps): JSX.Element {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm text-gray-500">Total Runs</div>
        <div className="text-2xl font-bold text-gray-900">{totalRuns}</div>
      </div>
      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm text-gray-500">Passed</div>
        <div className="text-2xl font-bold text-green-600">{passedRuns}</div>
      </div>
      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm text-gray-500">Failed</div>
        <div className="text-2xl font-bold text-red-600">{failedRuns}</div>
      </div>
      <div className="bg-white rounded-lg border p-4">
        <div className="text-sm text-gray-500">Running</div>
        <div className="text-2xl font-bold text-blue-600">{runningRuns}</div>
      </div>
    </div>
  );
}

/**
 * Create test run modal
 */
interface CreateRunModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, suites: string[]) => Promise<void>;
  isCreating: boolean;
}

function CreateRunModal({ isOpen, onClose, onCreate, isCreating }: CreateRunModalProps): JSX.Element | null {
  const [name, setName] = useState('');
  const [suites, setSuites] = useState<string[]>(['auth', 'scan', 'rollup']);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    await onCreate(name || 'Test Run', suites);
    onClose();
    setName('');
  }, [name, suites, onCreate, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Create New Test Run
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="run-name" className="block text-sm font-medium text-gray-700 mb-1">
                Name (optional)
              </label>
              <input
                id="run-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Test Run"
                className={cn(
                  'w-full px-3 py-2 text-sm rounded-md',
                  'border border-gray-300 bg-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500'
                )}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Test Suites
              </label>
              <div className="space-y-2">
                {['auth', 'scan', 'rollup', 'graph'].map((suite) => (
                  <label key={suite} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={suites.includes(suite)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSuites([...suites, suite]);
                        } else {
                          setSuites(suites.filter((s) => s !== suite));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 capitalize">{suite}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'px-4 py-2 text-sm font-medium rounded-md',
                'text-gray-700 bg-gray-100 hover:bg-gray-200'
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isCreating || suites.length === 0}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
                'text-white bg-blue-600 hover:bg-blue-700',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
                (isCreating || suites.length === 0) && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isCreating ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <PlayIcon className="h-4 w-4" />
                  Start Run
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Run details panel
 */
interface RunDetailsPanelProps {
  runId: TestRunId;
  onClose: () => void;
}

function RunDetailsPanel({ runId, onClose }: RunDetailsPanelProps): JSX.Element {
  const { run, isLoading, error } = useTestRunDetails({ id: runId });
  const [selectedResultId, setSelectedResultId] = useState<TestCaseId | undefined>();
  const [resultFilters, setResultFilters] = useState<TestCaseFilters>({});

  // Transform suite results to test case display format
  const testResults = useMemo<TestCaseDisplay[]>(() => {
    // For now, return empty - would transform from run.suites in real implementation
    return [];
  }, [run]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-red-600 mb-4">Failed to load test run details</p>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={run.name}
        description={`Started ${run.startedAt.toLocaleString()}`}
        onBack={onClose}
      />

      {/* Run summary */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Status</div>
          <div className="text-lg font-semibold capitalize">{run.status}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Tests</div>
          <div className="text-lg font-semibold">{run.stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Passed</div>
          <div className="text-lg font-semibold text-green-600">{run.stats.passed}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Failed</div>
          <div className="text-lg font-semibold text-red-600">{run.stats.failed}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Pass Rate</div>
          <div className="text-lg font-semibold">{run.stats.passRate.toFixed(1)}%</div>
        </div>
      </div>

      {/* Test results table */}
      <TestResultsTable
        results={testResults}
        filters={resultFilters}
        selectedId={selectedResultId}
        onSelectResult={setSelectedResultId}
        onFilterChange={setResultFilters}
        emptyMessage="No test results available"
      />
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Test Dashboard Page Component
 *
 * Main dashboard for E2E test management featuring:
 * - List of test runs with filtering and search
 * - Stats summary cards
 * - Create new test run functionality
 * - Detailed view of individual test runs
 * - Test results table with pass/fail indicators
 *
 * @example
 * <TestDashboardPage />
 */
export function TestDashboardPage({ className }: TestDashboardPageProps): JSX.Element {
  // State
  const [search, setSearch] = useState('');
  const [statusFilters, setStatusFilters] = useState<TestRunDisplayStatus[]>([]);
  const [page, setPage] = useState(1);
  const [selectedRunId, setSelectedRunId] = useState<TestRunId | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Build filters
  const filters = useMemo<TestRunFilters>(() => ({
    status: statusFilters.length > 0 ? statusFilters : undefined,
    search: search || undefined,
    sortBy: 'startedAt',
    sortOrder: 'desc',
  }), [search, statusFilters]);

  // Hooks
  const { runs, pagination, isLoading, refetch } = useTestRuns({
    filters,
    page,
    pageSize: 20,
  });

  const { createRun, isLoading: isCreating } = useCreateTestRun();
  const { cancelRun } = useCancelTestRun();

  // Calculate stats
  const stats = useMemo(() => ({
    total: pagination.total,
    passed: runs.filter((r) => r.status === 'passed').length,
    failed: runs.filter((r) => r.status === 'failed').length,
    running: runs.filter((r) => r.status === 'running' || r.status === 'pending').length,
  }), [runs, pagination.total]);

  // Handlers
  const handleCreateRun = useCallback(async (name: string, suites: string[]) => {
    await createRun({ name, suites });
  }, [createRun]);

  const handleCancelRun = useCallback(async (id: TestRunId) => {
    await cancelRun(id);
    await refetch();
  }, [cancelRun, refetch]);

  const handleViewDetails = useCallback((id: TestRunId) => {
    setSelectedRunId(id);
  }, []);

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Show detail view if a run is selected
  if (selectedRunId) {
    return (
      <div className={cn('p-6 bg-gray-50 min-h-screen', className)}>
        <RunDetailsPanel
          runId={selectedRunId}
          onClose={() => setSelectedRunId(null)}
        />
      </div>
    );
  }

  return (
    <div className={cn('p-6 bg-gray-50 min-h-screen', className)}>
      <PageHeader
        title="E2E Test Dashboard"
        description="Monitor and manage end-to-end test runs"
        actions={
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
              'text-white bg-blue-600 hover:bg-blue-700',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            )}
          >
            <PlayIcon className="h-4 w-4" />
            New Test Run
          </button>
        }
      />

      <StatsSummary
        totalRuns={stats.total}
        passedRuns={stats.passed}
        failedRuns={stats.failed}
        runningRuns={stats.running}
      />

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        statusFilters={statusFilters}
        onStatusFilterChange={setStatusFilters}
        onRefresh={handleRefresh}
        isRefreshing={isLoading}
      />

      {/* Test runs list */}
      <div className="space-y-3">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 bg-white rounded-lg border animate-pulse"
            />
          ))
        ) : runs.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border">
            <div className="h-12 w-12 text-gray-300 mb-4">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-gray-500 mb-4">No test runs found</p>
            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md',
                'text-blue-700 bg-blue-100 hover:bg-blue-200'
              )}
            >
              <PlayIcon className="h-4 w-4" />
              Start your first test run
            </button>
          </div>
        ) : (
          // Test run cards
          runs.map((run) => (
            <TestRunCard
              key={run.id}
              run={run}
              onSelect={() => handleViewDetails(run.id)}
              onViewDetails={handleViewDetails}
              onCancel={(run.status === 'running' || run.status === 'pending') ? handleCancelRun : undefined}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(page - 1)}
            disabled={!pagination.hasPrevious}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md border',
              pagination.hasPrevious
                ? 'text-gray-700 hover:bg-gray-100'
                : 'text-gray-400 cursor-not-allowed'
            )}
          >
            Previous
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            Page {page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(page + 1)}
            disabled={!pagination.hasNext}
            className={cn(
              'px-3 py-1 text-sm font-medium rounded-md border',
              pagination.hasNext
                ? 'text-gray-700 hover:bg-gray-100'
                : 'text-gray-400 cursor-not-allowed'
            )}
          >
            Next
          </button>
        </div>
      )}

      {/* Create run modal */}
      <CreateRunModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateRun}
        isCreating={isCreating}
      />
    </div>
  );
}

export default TestDashboardPage;
