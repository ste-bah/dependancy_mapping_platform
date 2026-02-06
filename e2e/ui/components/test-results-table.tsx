/**
 * Test Results Table Component
 * Table view for displaying test case results with filtering and sorting
 * @module e2e/ui/components/test-results-table
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #25 of 47 | Phase 4: Implementation
 */

import { memo, useCallback, useMemo } from 'react';
import type { TestCaseId } from '../../types/test-types';
import type {
  TestResultsTableProps,
  TestCaseDisplay,
  TestCaseFilters,
} from '../types';
import { TEST_CASE_STATUS_LABELS, TEST_CASE_STATUS_COLORS } from '../types';

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Class name utility
 */
function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

/**
 * Format duration in milliseconds
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

// ============================================================================
// Icons
// ============================================================================

function SortIcon({ className, direction }: { className?: string; direction?: 'asc' | 'desc' }): JSX.Element {
  if (!direction) {
    return (
      <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
      </svg>
    );
  }

  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {direction === 'asc' ? (
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
      ) : (
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
      )}
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
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

function MinusIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}

function EmptyIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

/**
 * Status icon for test result
 */
function StatusIcon({ status, className }: { status: string; className?: string }): JSX.Element {
  const iconClass = cn('h-4 w-4', className);

  switch (status) {
    case 'passed':
      return <CheckIcon className={cn(iconClass, 'text-green-500')} />;
    case 'failed':
      return <XIcon className={cn(iconClass, 'text-red-500')} />;
    case 'skipped':
      return <MinusIcon className={cn(iconClass, 'text-gray-400')} />;
    case 'pending':
      return <ClockIcon className={cn(iconClass, 'text-amber-500')} />;
    case 'timeout':
      return <ClockIcon className={cn(iconClass, 'text-red-500')} />;
    default:
      return <MinusIcon className={cn(iconClass, 'text-gray-400')} />;
  }
}

/**
 * Status badge for test result
 */
function StatusBadge({ status }: { status: string }): JSX.Element {
  const colorClasses: Record<string, string> = {
    success: 'bg-green-100 text-green-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-amber-100 text-amber-800',
    default: 'bg-gray-100 text-gray-800',
  };

  const color = TEST_CASE_STATUS_COLORS[status as keyof typeof TEST_CASE_STATUS_COLORS] || 'default';
  const label = TEST_CASE_STATUS_LABELS[status as keyof typeof TEST_CASE_STATUS_LABELS] || status;

  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
      colorClasses[color]
    )}>
      <StatusIcon status={status} className="h-3 w-3" />
      {label}
    </span>
  );
}

/**
 * Table header component
 */
interface TableHeaderProps {
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
}

function TableHeader({
  sortField,
  sortDirection,
  onSortChange,
}: TableHeaderProps): JSX.Element {
  const handleSort = useCallback((field: string) => {
    if (!onSortChange) return;
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    onSortChange(field, newDirection);
  }, [sortField, sortDirection, onSortChange]);

  const SortableHeader = ({
    field,
    children,
    className,
  }: {
    field: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700',
        className
      )}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        <SortIcon
          className="h-4 w-4"
          direction={sortField === field ? sortDirection : undefined}
        />
      </div>
    </th>
  );

  return (
    <thead className="bg-gray-50">
      <tr>
        <th scope="col" className="w-12 px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          <span className="sr-only">Status</span>
        </th>
        <SortableHeader field="name" className="min-w-[200px]">
          Test Name
        </SortableHeader>
        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Suite
        </th>
        <SortableHeader field="status" className="w-28">
          Status
        </SortableHeader>
        <SortableHeader field="duration" className="w-24">
          Duration
        </SortableHeader>
        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">
          Retries
        </th>
      </tr>
    </thead>
  );
}

/**
 * Table row component
 */
interface TableRowProps {
  result: TestCaseDisplay;
  isSelected: boolean;
  onSelect: () => void;
}

function TableRow({ result, isSelected, onSelect }: TableRowProps): JSX.Element {
  return (
    <tr
      className={cn(
        'border-b transition-colors cursor-pointer',
        isSelected
          ? 'bg-blue-50 hover:bg-blue-100'
          : 'hover:bg-gray-50',
        result.status === 'failed' && 'bg-red-50/30'
      )}
      onClick={onSelect}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <td className="px-4 py-3">
        <StatusIcon status={result.status} />
      </td>
      <td className="px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{result.name}</p>
          {result.error && (
            <p className="text-xs text-red-600 truncate mt-0.5" title={result.error.message}>
              {result.error.message}
            </p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600">{result.suiteName}</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={result.status} />
      </td>
      <td className="px-4 py-3">
        <span className="text-sm text-gray-600 font-mono">
          {formatDuration(result.duration)}
        </span>
      </td>
      <td className="px-4 py-3">
        {result.retryAttempts && result.retryAttempts > 0 ? (
          <span className="text-sm text-amber-600">{result.retryAttempts}x</span>
        ) : (
          <span className="text-sm text-gray-400">-</span>
        )}
      </td>
    </tr>
  );
}

/**
 * Skeleton row for loading state
 */
function SkeletonRow(): JSX.Element {
  return (
    <tr className="border-b animate-pulse">
      <td className="px-4 py-3">
        <div className="h-4 w-4 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-48 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-32 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-5 w-20 bg-gray-200 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-16 bg-gray-200 rounded" />
      </td>
      <td className="px-4 py-3">
        <div className="h-4 w-8 bg-gray-200 rounded" />
      </td>
    </tr>
  );
}

/**
 * Pagination component
 */
interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  onPageChange: (page: number) => void;
}

function Pagination({
  page,
  pageSize,
  total,
  totalPages,
  hasNext,
  hasPrevious,
  onPageChange,
}: PaginationProps): JSX.Element {
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{total}</span> results
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrevious}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md',
            'border border-gray-300 bg-white',
            hasPrevious
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          )}
        >
          <ChevronLeftIcon className="h-4 w-4" />
          Previous
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onPageChange(pageNum)}
                className={cn(
                  'w-8 h-8 text-sm rounded-md transition-colors',
                  page === pageNum
                    ? 'bg-blue-100 text-blue-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext}
          className={cn(
            'inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-md',
            'border border-gray-300 bg-white',
            hasNext
              ? 'text-gray-700 hover:bg-gray-50'
              : 'text-gray-400 cursor-not-allowed'
          )}
        >
          Next
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Empty state component
 */
function EmptyState({ message }: { message: string }): JSX.Element {
  return (
    <tr>
      <td colSpan={6} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center">
          <EmptyIcon className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500">{message}</p>
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Test Results Table Component
 *
 * Displays test case results in a sortable, filterable table with:
 * - Status indicator and badge
 * - Test name and error message
 * - Suite name
 * - Duration
 * - Retry count
 * - Pagination
 *
 * @example
 * <TestResultsTable
 *   results={testResults}
 *   isLoading={isLoading}
 *   filters={filters}
 *   pagination={pagination}
 *   onSelectResult={handleSelect}
 *   onFilterChange={handleFilterChange}
 *   onPageChange={handlePageChange}
 *   onSortChange={handleSortChange}
 * />
 */
function TestResultsTableComponent({
  results,
  isLoading = false,
  filters,
  pagination,
  selectedId,
  onSelectResult,
  onFilterChange,
  onPageChange,
  onSortChange,
  className,
  emptyMessage = 'No test results found',
}: TestResultsTableProps): JSX.Element {
  const handleRowClick = useCallback(
    (id: TestCaseId) => {
      onSelectResult?.(id);
    },
    [onSelectResult]
  );

  // Summary stats
  const stats = useMemo(() => {
    return {
      total: results.length,
      passed: results.filter((r) => r.status === 'passed').length,
      failed: results.filter((r) => r.status === 'failed').length,
      skipped: results.filter((r) => r.status === 'skipped').length,
    };
  }, [results]);

  return (
    <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', className)}>
      {/* Summary bar */}
      <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">
            <span className="font-medium">{pagination?.total ?? results.length}</span> total
          </span>
          <span className="text-green-600">
            <span className="font-medium">{stats.passed}</span> passed
          </span>
          <span className="text-red-600">
            <span className="font-medium">{stats.failed}</span> failed
          </span>
          {stats.skipped > 0 && (
            <span className="text-gray-500">
              <span className="font-medium">{stats.skipped}</span> skipped
            </span>
          )}
        </div>

        {/* Filter controls could go here */}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full" role="grid">
          <TableHeader
            sortField={filters?.sortBy}
            sortDirection={filters?.sortOrder}
            onSortChange={onSortChange}
          />
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))
            ) : results.length === 0 ? (
              // Empty state
              <EmptyState message={emptyMessage} />
            ) : (
              // Data rows
              results.map((result) => (
                <TableRow
                  key={result.id}
                  result={result}
                  isSelected={selectedId === result.id}
                  onSelect={() => handleRowClick(result.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && onPageChange && (
        <Pagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          totalPages={pagination.totalPages}
          hasNext={pagination.hasNext}
          hasPrevious={pagination.hasPrevious}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export const TestResultsTable = memo(TestResultsTableComponent);

export type { TestResultsTableProps };
