/**
 * Filter Bar Component
 * Search and filter controls for repository list
 * @module features/repositories/components/FilterBar
 */

import { memo } from 'react';
import { Input, Select, type SelectOption } from '@/shared/components';
import { cn } from '@/shared/utils';
import type { RepositoryFilters } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface FilterBarProps {
  /** Current filter values */
  filters: RepositoryFilters;
  /** Callback when search changes */
  onSearchChange: (search: string) => void;
  /** Callback when provider filter changes */
  onProviderChange: (provider: RepositoryFilters['provider']) => void;
  /** Callback when status filter changes */
  onStatusChange: (status: RepositoryFilters['status']) => void;
  /** Callback to reset all filters */
  onReset?: (() => void) | undefined;
  /** Additional class names */
  className?: string | undefined;
}

// ============================================================================
// Filter Options
// ============================================================================

const PROVIDER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Providers' },
  { value: 'github', label: 'GitHub' },
  { value: 'gitlab', label: 'GitLab' },
  { value: 'bitbucket', label: 'Bitbucket' },
];

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'idle', label: 'Idle' },
  { value: 'pending', label: 'Pending' },
  { value: 'scanning', label: 'Scanning' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * Filter bar with search, provider, and status filters
 *
 * @example
 * <FilterBar
 *   filters={filters}
 *   onSearchChange={setSearch}
 *   onProviderChange={setProvider}
 *   onStatusChange={setStatus}
 * />
 */
export const FilterBar = memo(function FilterBar({
  filters,
  onSearchChange,
  onProviderChange,
  onStatusChange,
  onReset,
  className,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.search ||
    (filters.provider && filters.provider !== 'all') ||
    (filters.status && filters.status !== 'all');

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-end',
        className
      )}
    >
      {/* Search Input */}
      <div className="flex-1">
        <Input
          placeholder="Search repositories..."
          value={filters.search ?? ''}
          onChange={(e) => onSearchChange(e.target.value)}
          leftAddon={<SearchIcon className="h-4 w-4" />}
          size="md"
          fullWidth
          aria-label="Search repositories"
        />
      </div>

      {/* Provider Filter */}
      <div className="w-full sm:w-40">
        <Select
          options={PROVIDER_OPTIONS}
          value={filters.provider ?? 'all'}
          onChange={(e) =>
            onProviderChange(
              e.target.value as RepositoryFilters['provider']
            )
          }
          size="md"
          fullWidth
          aria-label="Filter by provider"
        />
      </div>

      {/* Status Filter */}
      <div className="w-full sm:w-40">
        <Select
          options={STATUS_OPTIONS}
          value={filters.status ?? 'all'}
          onChange={(e) =>
            onStatusChange(e.target.value as RepositoryFilters['status'])
          }
          size="md"
          fullWidth
          aria-label="Filter by status"
        />
      </div>

      {/* Reset Button */}
      {hasActiveFilters && onReset && (
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          aria-label="Clear all filters"
        >
          <XIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Clear</span>
        </button>
      )}
    </div>
  );
});

// ============================================================================
// Icons
// ============================================================================

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
      />
    </svg>
  );
}

// ============================================================================
// Compact Filter Variant
// ============================================================================

export interface CompactFilterBarProps {
  /** Current search value */
  search: string;
  /** Callback when search changes */
  onSearchChange: (search: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Simplified filter bar with just search
 */
export function CompactFilterBar({
  search,
  onSearchChange,
  className,
}: CompactFilterBarProps) {
  return (
    <div className={cn('relative', className)}>
      <Input
        placeholder="Search..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        leftAddon={<SearchIcon className="h-4 w-4" />}
        size="sm"
        fullWidth
        aria-label="Search"
      />
    </div>
  );
}

export default FilterBar;
