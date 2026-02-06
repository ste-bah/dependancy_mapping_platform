/**
 * Repository List Component
 * Grid layout for displaying repository cards with empty/loading states
 * @module features/repositories/components/RepositoryList
 */

import { memo } from 'react';
import { Skeleton, Button } from '@/shared/components';
import { cn } from '@/shared/utils';
import type { Repository } from '../types';
import { RepositoryCard } from './RepositoryCard';

// ============================================================================
// Types
// ============================================================================

export interface RepositoryListProps {
  /** Repository data */
  repositories: Repository[];
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error?: Error | null;
  /** Callback when scan is triggered */
  onTriggerScan?: (id: string) => void;
  /** Callback when scan is cancelled */
  onCancelScan?: (id: string) => void;
  /** Callback when delete is requested */
  onDelete?: (id: string, name: string) => void;
  /** Callback when add is requested */
  onAdd?: () => void;
  /** ID of repo currently being scanned */
  scanningRepoId?: string | null;
  /** ID of repo currently being deleted */
  deletingRepoId?: string | null;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function RepositoryCardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-1 h-5 w-16" />
        </div>
        <div>
          <Skeleton className="h-4 w-12" />
          <Skeleton className="mt-1 h-5 w-16" />
        </div>
        <div>
          <Skeleton className="h-4 w-16" />
          <Skeleton className="mt-1 h-5 w-20" />
        </div>
      </div>
      <div className="mt-6 flex justify-between border-t pt-4">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="flex gap-1">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Empty State
// ============================================================================

interface EmptyStateProps {
  hasFilters: boolean;
  onAdd?: (() => void) | undefined;
  onClearFilters?: (() => void) | undefined;
}

function EmptyState({ hasFilters, onAdd, onClearFilters }: EmptyStateProps) {
  if (hasFilters) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12">
        <SearchOffIcon className="h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          No repositories found
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          Try adjusting your search or filter criteria.
        </p>
        {onClearFilters && (
          <Button
            variant="outline"
            onClick={onClearFilters}
            className="mt-4"
          >
            Clear Filters
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12">
      <FolderPlusIcon className="h-12 w-12 text-gray-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        No repositories yet
      </h3>
      <p className="mt-1 text-sm text-gray-500">
        Get started by connecting your first repository.
      </p>
      {onAdd && (
        <Button onClick={onAdd} className="mt-4">
          Connect Repository
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Error State
// ============================================================================

interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-12">
      <ErrorIcon className="h-12 w-12 text-red-400" />
      <h3 className="mt-4 text-lg font-medium text-gray-900">
        Failed to load repositories
      </h3>
      <p className="mt-1 text-sm text-red-600">
        {error.message}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Grid list of repository cards with loading, empty, and error states
 *
 * @example
 * <RepositoryList
 *   repositories={data?.data ?? []}
 *   isLoading={isLoading}
 *   error={error}
 *   onTriggerScan={handleScan}
 *   onDelete={handleDelete}
 *   onAdd={() => setModalOpen(true)}
 * />
 */
export const RepositoryList = memo(function RepositoryList({
  repositories,
  isLoading,
  error,
  onTriggerScan,
  onCancelScan,
  onDelete,
  onAdd,
  scanningRepoId,
  deletingRepoId,
  className,
}: RepositoryListProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
        {Array.from({ length: 6 }).map((_, i) => (
          <RepositoryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Error state
  if (error) {
    return <ErrorState error={error} />;
  }

  // Empty state
  if (repositories.length === 0) {
    return <EmptyState hasFilters={false} onAdd={onAdd} />;
  }

  // Repository grid
  return (
    <div className={cn('grid gap-6 md:grid-cols-2 lg:grid-cols-3', className)}>
      {repositories.map((repository) => (
        <RepositoryCard
          key={repository.id}
          repository={repository}
          onTriggerScan={onTriggerScan}
          onCancelScan={onCancelScan}
          onDelete={onDelete}
          isScanPending={scanningRepoId === repository.id}
          isDeletePending={deletingRepoId === repository.id}
        />
      ))}
    </div>
  );
});

// ============================================================================
// Icons
// ============================================================================

function FolderPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 10.5v6m3-3H9m4.06-7.19l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z"
      />
    </svg>
  );
}

function SearchOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

export default RepositoryList;
