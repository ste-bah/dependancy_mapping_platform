/**
 * Pagination Component
 * Page navigation controls for repository list
 * @module features/repositories/components/Pagination
 */

import { memo, useMemo } from 'react';
import { Button } from '@/shared/components';
import { cn } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface PaginationProps {
  /** Current page number (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Total number of items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Callback when page changes */
  onPageChange: (page: number) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Pagination controls with page numbers and navigation
 *
 * @example
 * <Pagination
 *   currentPage={1}
 *   totalPages={10}
 *   totalItems={200}
 *   pageSize={20}
 *   onPageChange={setPage}
 * />
 */
export const Pagination = memo(function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className,
}: PaginationProps) {
  // Don't render if only one page or no pages
  if (totalPages <= 1) return null;

  // Calculate visible page numbers
  const pageNumbers = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    const maxVisible = 7;

    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (currentPage > 3) {
        pages.push('ellipsis');
      }

      // Show pages around current
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (currentPage < totalPages - 2) {
        pages.push('ellipsis');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  }, [currentPage, totalPages]);

  // Calculate item range
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <nav
      className={cn(
        'flex flex-col items-center justify-between gap-4 sm:flex-row',
        className
      )}
      aria-label="Pagination"
    >
      {/* Item count */}
      <p className="text-sm text-gray-500">
        Showing{' '}
        <span className="font-medium text-gray-900">{startItem}</span>
        {' - '}
        <span className="font-medium text-gray-900">{endItem}</span>
        {' of '}
        <span className="font-medium text-gray-900">{totalItems}</span>
        {' repositories'}
      </p>

      {/* Page controls */}
      <div className="flex items-center gap-1">
        {/* Previous button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Previous page"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((page, index) => {
            if (page === 'ellipsis') {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-gray-400"
                >
                  ...
                </span>
              );
            }

            const isActive = page === currentPage;

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                )}
                aria-current={isActive ? 'page' : undefined}
                aria-label={`Page ${page}`}
              >
                {page}
              </button>
            );
          })}
        </div>

        {/* Mobile page indicator */}
        <span className="px-3 text-sm text-gray-500 sm:hidden">
          Page {currentPage} of {totalPages}
        </span>

        {/* Next button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Next page"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
});

// ============================================================================
// Icons
// ============================================================================

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default Pagination;
