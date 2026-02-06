/**
 * Scan List Table Component
 * Table view for displaying scan history with sorting and selection
 * @module features/scan-history/components/ScanListTable
 */

import { memo, useCallback, useMemo } from 'react';
import { Button, Badge, StatusBadge, Skeleton } from '@/shared';
import { cn } from '@/shared/utils';
import type { ScanListTableProps } from '../types';
import type { Scan, ScanId, ScanStatus } from '../types';
import { SCAN_STATUS_COLORS, SCAN_STATUS_LABELS } from '../types';

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

function ExternalLinkIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
    </svg>
  );
}

function CompareIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
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

// ============================================================================
// Utility Functions
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function getStatusVariant(status: ScanStatus): 'success' | 'error' | 'info' | 'warning' {
  switch (status) {
    case 'completed':
      return 'success';
    case 'failed':
      return 'error';
    case 'in_progress':
      return 'info';
    case 'cancelled':
      return 'warning';
    default:
      return 'info';
  }
}

// ============================================================================
// Table Header Component
// ============================================================================

interface TableHeaderProps {
  enableSelection: boolean;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (field: string, direction: 'asc' | 'desc') => void;
}

function TableHeader({
  enableSelection,
  sortField,
  sortDirection,
  onSortChange,
}: TableHeaderProps): JSX.Element {
  const handleSort = (field: string) => {
    if (!onSortChange) return;
    const newDirection = sortField === field && sortDirection === 'desc' ? 'asc' : 'desc';
    onSortChange(field, newDirection);
  };

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
        {enableSelection && (
          <th scope="col" className="w-12 px-4 py-3">
            <span className="sr-only">Select for comparison</span>
          </th>
        )}
        <SortableHeader field="startedAt" className="min-w-[160px]">
          Date
        </SortableHeader>
        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Repository
        </th>
        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Status
        </th>
        <SortableHeader field="duration" className="w-24">
          Duration
        </SortableHeader>
        <SortableHeader field="issuesFound" className="w-24">
          Issues
        </SortableHeader>
        <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-32">
          Actions
        </th>
      </tr>
    </thead>
  );
}

// ============================================================================
// Table Row Component
// ============================================================================

interface TableRowProps {
  scan: Scan;
  isSelected: boolean;
  isCompareSelected: boolean;
  enableSelection: boolean;
  compact: boolean;
  onRowClick: () => void;
  onCompareClick: () => void;
}

function TableRow({
  scan,
  isSelected,
  isCompareSelected,
  enableSelection,
  compact,
  onRowClick,
  onCompareClick,
}: TableRowProps): JSX.Element {
  return (
    <tr
      className={cn(
        'border-b transition-colors cursor-pointer',
        isSelected
          ? 'bg-primary-50 hover:bg-primary-100'
          : 'hover:bg-gray-50',
        isCompareSelected && 'ring-2 ring-inset ring-amber-400'
      )}
      onClick={onRowClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onRowClick();
        }
      }}
    >
      {enableSelection && (
        <td className="px-4 py-3">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onCompareClick();
            }}
            className={cn(
              'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
              isCompareSelected
                ? 'border-amber-500 bg-amber-500 text-white'
                : 'border-gray-300 hover:border-amber-400'
            )}
            aria-label={isCompareSelected ? 'Remove from comparison' : 'Add to comparison'}
          >
            {isCompareSelected && <CheckIcon className="w-3 h-3" />}
          </button>
        </td>
      )}
      <td className={cn('px-4', compact ? 'py-2' : 'py-3')}>
        <span className="text-sm text-gray-900">{formatDate(scan.startedAt)}</span>
      </td>
      <td className={cn('px-4', compact ? 'py-2' : 'py-3')}>
        <span className="text-sm font-medium text-gray-900">{scan.repositoryName}</span>
      </td>
      <td className={cn('px-4', compact ? 'py-2' : 'py-3')}>
        <StatusBadge
          status={getStatusVariant(scan.status)}
          size="sm"
        >
          {SCAN_STATUS_LABELS[scan.status]}
        </StatusBadge>
      </td>
      <td className={cn('px-4', compact ? 'py-2' : 'py-3')}>
        <span className="text-sm text-gray-600">{formatDuration(scan.duration)}</span>
      </td>
      <td className={cn('px-4', compact ? 'py-2' : 'py-3')}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">{scan.metrics.issuesFound}</span>
          {scan.metrics.criticalIssues > 0 && (
            <Badge variant="error" size="sm">
              {scan.metrics.criticalIssues} critical
            </Badge>
          )}
        </div>
      </td>
      <td className={cn('px-4 text-right', compact ? 'py-2' : 'py-3')}>
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              // Navigate to scan details
              window.location.href = `/scans/${scan.id}`;
            }}
            aria-label="View scan details"
          >
            <ExternalLinkIcon className="h-4 w-4" />
          </Button>
          {enableSelection && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onCompareClick();
              }}
              className={isCompareSelected ? 'text-amber-600' : ''}
              aria-label={isCompareSelected ? 'Remove from comparison' : 'Add to comparison'}
            >
              <CompareIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// Skeleton Row Component
// ============================================================================

function SkeletonRow({ enableSelection }: { enableSelection: boolean }): JSX.Element {
  return (
    <tr className="border-b">
      {enableSelection && (
        <td className="px-4 py-3">
          <Skeleton className="h-5 w-5 rounded" />
        </td>
      )}
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-32" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-5 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
      <td className="px-4 py-3 text-right">
        <Skeleton className="h-8 w-16 ml-auto" />
      </td>
    </tr>
  );
}

// ============================================================================
// Pagination Component
// ============================================================================

interface PaginationProps {
  page: number;
  total: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
}

function Pagination({
  page,
  total,
  limit,
  hasMore,
  onPageChange,
}: PaginationProps): JSX.Element {
  const totalPages = Math.ceil(total / limit);
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-white">
      <div className="text-sm text-gray-600">
        Showing <span className="font-medium">{startItem}</span> to{' '}
        <span className="font-medium">{endItem}</span> of{' '}
        <span className="font-medium">{total}</span> scans
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          leftIcon={<ChevronLeftIcon className="h-4 w-4" />}
        >
          Previous
        </Button>

        <div className="flex items-center gap-1">
          {/* Page numbers */}
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
                    ? 'bg-primary-100 text-primary-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasMore}
          rightIcon={<ChevronRightIcon className="h-4 w-4" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  message: string;
}

function EmptyState({ message }: EmptyStateProps): JSX.Element {
  return (
    <tr>
      <td colSpan={7} className="px-4 py-12 text-center">
        <div className="flex flex-col items-center">
          <EmptyIcon className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500">{message}</p>
        </div>
      </td>
    </tr>
  );
}

function EmptyIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5m6 4.125l2.25 2.25m0 0l2.25 2.25M12 13.875l2.25-2.25M12 13.875l-2.25 2.25M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Table view for scan history
 *
 * @example
 * <ScanListTable
 *   scans={scans}
 *   selectedScanId={selectedId}
 *   onScanSelect={handleSelect}
 *   onCompareSelect={handleCompare}
 *   pagination={pagination}
 *   onPageChange={handlePageChange}
 * />
 */
function ScanListTableComponent({
  scans,
  selectedScanId,
  onScanSelect,
  onCompareSelect,
  isLoading = false,
  pagination,
  onPageChange,
  sortField,
  sortDirection,
  onSortChange,
  className,
  enableSelection = false,
  selectedIds = new Set(),
  onSelectionChange,
  emptyMessage = 'No scans available',
  compact = false,
}: ScanListTableProps): JSX.Element {
  const handleRowClick = useCallback(
    (scanId: ScanId) => {
      onScanSelect(scanId);
    },
    [onScanSelect]
  );

  const handleCompareClick = useCallback(
    (scanId: ScanId) => {
      onCompareSelect(scanId);
    },
    [onCompareSelect]
  );

  return (
    <div className={cn('rounded-lg border bg-white shadow-sm overflow-hidden', className)}>
      <div className="overflow-x-auto">
        <table className="w-full" role="grid">
          <TableHeader
            enableSelection={enableSelection}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={onSortChange}
          />
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <SkeletonRow key={i} enableSelection={enableSelection} />
              ))
            ) : scans.length === 0 ? (
              // Empty state
              <EmptyState message={emptyMessage} />
            ) : (
              // Data rows
              scans.map((scan) => (
                <TableRow
                  key={scan.id}
                  scan={scan}
                  isSelected={selectedScanId === scan.id}
                  isCompareSelected={selectedIds.has(scan.id)}
                  enableSelection={enableSelection}
                  compact={compact}
                  onRowClick={() => handleRowClick(scan.id)}
                  onCompareClick={() => handleCompareClick(scan.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <Pagination
          page={pagination.page}
          total={pagination.total}
          limit={pagination.limit}
          hasMore={pagination.hasMore}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}

export const ScanListTable = memo(ScanListTableComponent);

export type { ScanListTableProps };
