/**
 * Scan Filter Panel Component
 * Filter sidebar for scan history with date range, repository, and status filters
 * @module features/scan-history/components/ScanFilterPanel
 */

import { memo, useState, useCallback, useMemo } from 'react';
import { Button, Badge, Input } from '@/shared';
import { cn } from '@/shared/utils';
import type { ScanFilterPanelProps } from '../types';
import type { ScanHistoryFilters, ScanStatus, RepositoryId, DateRange } from '../types';
import { ALL_SCAN_STATUSES, SCAN_STATUS_LABELS, SCAN_STATUS_COLORS, DATE_RANGE_PRESETS } from '../types';

// ============================================================================
// Icons
// ============================================================================

function FilterIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 01-.659 1.591l-5.432 5.432a2.25 2.25 0 00-.659 1.591v2.927a2.25 2.25 0 01-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 00-.659-1.591L3.659 7.409A2.25 2.25 0 013 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0112 3z" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

function CalendarIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
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

// ============================================================================
// Utility Functions
// ============================================================================

function countActiveFilters(filters: ScanHistoryFilters): number {
  let count = 0;
  if (filters.dateRange) count++;
  if (filters.repositories.length > 0) count++;
  if (filters.statuses.length > 0) count++;
  if (filters.searchQuery.trim()) count++;
  return count;
}

function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

function parseDateFromInput(value: string): Date {
  return new Date(value + 'T00:00:00');
}

// ============================================================================
// Filter Section Component
// ============================================================================

interface FilterSectionProps {
  title: string;
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function FilterSection({
  title,
  isExpanded,
  onToggle,
  children,
}: FilterSectionProps): JSX.Element {
  return (
    <div className="border-b last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        {title}
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>
      {isExpanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================================================
// Status Filter Component
// ============================================================================

interface StatusFilterProps {
  selectedStatuses: ScanStatus[];
  onChange: (statuses: ScanStatus[]) => void;
  disabled?: boolean;
}

function StatusFilter({
  selectedStatuses,
  onChange,
  disabled = false,
}: StatusFilterProps): JSX.Element {
  const handleToggle = (status: ScanStatus) => {
    if (disabled) return;
    const isSelected = selectedStatuses.includes(status);
    if (isSelected) {
      onChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="space-y-2">
      {ALL_SCAN_STATUSES.map((status) => {
        const isSelected = selectedStatuses.includes(status);
        return (
          <label
            key={status}
            className={cn(
              'flex items-center gap-3 py-1.5 cursor-pointer',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <div
              className={cn(
                'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                isSelected
                  ? 'border-primary-500 bg-primary-500'
                  : 'border-gray-300 hover:border-gray-400'
              )}
              style={{
                borderColor: isSelected ? SCAN_STATUS_COLORS[status] : undefined,
                backgroundColor: isSelected ? SCAN_STATUS_COLORS[status] : undefined,
              }}
            >
              {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
            </div>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => handleToggle(status)}
              disabled={disabled}
              className="sr-only"
            />
            <span className="text-sm text-gray-700">{SCAN_STATUS_LABELS[status]}</span>
          </label>
        );
      })}
    </div>
  );
}

// ============================================================================
// Repository Filter Component
// ============================================================================

interface RepositoryFilterProps {
  selectedRepositories: RepositoryId[];
  repositories: Array<{ id: RepositoryId; name: string }>;
  onChange: (repositories: RepositoryId[]) => void;
  disabled?: boolean;
}

function RepositoryFilter({
  selectedRepositories,
  repositories,
  onChange,
  disabled = false,
}: RepositoryFilterProps): JSX.Element {
  const [search, setSearch] = useState('');

  const filteredRepos = useMemo(() => {
    if (!search.trim()) return repositories;
    const query = search.toLowerCase();
    return repositories.filter((repo) =>
      repo.name.toLowerCase().includes(query)
    );
  }, [repositories, search]);

  const handleToggle = (repoId: RepositoryId) => {
    if (disabled) return;
    const isSelected = selectedRepositories.includes(repoId);
    if (isSelected) {
      onChange(selectedRepositories.filter((id) => id !== repoId));
    } else {
      onChange([...selectedRepositories, repoId]);
    }
  };

  const handleSelectAll = () => {
    onChange(repositories.map((r) => r.id));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search repositories..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          disabled={disabled}
          className={cn(
            'w-full pl-9 pr-3 py-2 text-sm border rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 text-xs">
        <button
          type="button"
          onClick={handleSelectAll}
          disabled={disabled}
          className="text-primary-600 hover:text-primary-700"
        >
          Select all
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={handleClearAll}
          disabled={disabled || selectedRepositories.length === 0}
          className="text-primary-600 hover:text-primary-700 disabled:text-gray-400"
        >
          Clear
        </button>
      </div>

      {/* Repository list */}
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filteredRepos.length === 0 ? (
          <p className="text-sm text-gray-500 py-2">No repositories found</p>
        ) : (
          filteredRepos.map((repo) => {
            const isSelected = selectedRepositories.includes(repo.id);
            return (
              <label
                key={repo.id}
                className={cn(
                  'flex items-center gap-3 py-1.5 cursor-pointer',
                  disabled && 'opacity-50 cursor-not-allowed'
                )}
              >
                <div
                  className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center transition-colors',
                    isSelected
                      ? 'border-primary-500 bg-primary-500'
                      : 'border-gray-300 hover:border-gray-400'
                  )}
                >
                  {isSelected && <CheckIcon className="w-3 h-3 text-white" />}
                </div>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggle(repo.id)}
                  disabled={disabled}
                  className="sr-only"
                />
                <span className="text-sm text-gray-700 truncate" title={repo.name}>
                  {repo.name}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Date Range Filter Component
// ============================================================================

interface DateRangeFilterProps {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  disabled?: boolean;
}

function DateRangeFilter({
  value,
  onChange,
  disabled = false,
}: DateRangeFilterProps): JSX.Element {
  const handlePresetClick = (days: number) => {
    if (disabled) return;
    if (days === 0) {
      // Today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);
      onChange({ start: today, end: endOfDay });
    } else {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);
      onChange({ start, end });
    }
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = parseDateFromInput(e.target.value);
    if (value) {
      onChange({ start: newStart, end: value.end });
    } else {
      onChange({ start: newStart, end: new Date() });
    }
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = parseDateFromInput(e.target.value);
    if (value) {
      onChange({ start: value.start, end: newEnd });
    } else {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      onChange({ start, end: newEnd });
    }
  };

  const handleClear = () => {
    onChange(null);
  };

  return (
    <div className="space-y-3">
      {/* Presets */}
      <div className="flex flex-wrap gap-1.5">
        {DATE_RANGE_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetClick(preset.days)}
            disabled={disabled}
            className={cn(
              'px-2 py-1 text-xs rounded-md border transition-colors',
              'hover:bg-primary-50 hover:border-primary-300',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Custom range */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="flex-1">
            <span className="text-xs text-gray-500 block mb-1">From</span>
            <input
              type="date"
              value={value ? formatDateForInput(value.start) : ''}
              onChange={handleStartChange}
              disabled={disabled}
              className={cn(
                'w-full px-2 py-1.5 text-sm border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-gray-500 block mb-1">To</span>
            <input
              type="date"
              value={value ? formatDateForInput(value.end) : ''}
              onChange={handleEndChange}
              disabled={disabled}
              className={cn(
                'w-full px-2 py-1.5 text-sm border rounded-md',
                'focus:outline-none focus:ring-2 focus:ring-primary-500',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
            />
          </label>
        </div>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            disabled={disabled}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear date range
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Filter panel for scan history
 *
 * @example
 * <ScanFilterPanel
 *   filters={filters}
 *   onFiltersChange={handleFiltersChange}
 *   onReset={handleReset}
 *   repositories={repositories}
 * />
 */
function ScanFilterPanelComponent({
  filters,
  onFiltersChange,
  onReset,
  repositories,
  className,
  collapsed = false,
  onCollapsedChange,
  showFilterCount = true,
  disabled = false,
}: ScanFilterPanelProps): JSX.Element {
  const [expandedSections, setExpandedSections] = useState({
    search: true,
    dateRange: true,
    status: true,
    repositories: false,
  });

  const activeFilterCount = countActiveFilters(filters);

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        searchQuery: e.target.value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleDateRangeChange = useCallback(
    (range: DateRange | null) => {
      onFiltersChange({
        ...filters,
        dateRange: range,
      });
    },
    [filters, onFiltersChange]
  );

  const handleStatusChange = useCallback(
    (statuses: ScanStatus[]) => {
      onFiltersChange({
        ...filters,
        statuses,
      });
    },
    [filters, onFiltersChange]
  );

  const handleRepositoryChange = useCallback(
    (repoIds: RepositoryId[]) => {
      onFiltersChange({
        ...filters,
        repositories: repoIds,
      });
    },
    [filters, onFiltersChange]
  );

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-5 w-5 text-gray-500" />
          <span className="font-medium text-gray-900">Filters</span>
          {showFilterCount && activeFilterCount > 0 && (
            <Badge variant="primary" size="sm">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={onReset}
            disabled={disabled}
            className="text-sm text-primary-600 hover:text-primary-700 disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search scans..."
            value={filters.searchQuery}
            onChange={handleSearchChange}
            disabled={disabled}
            className={cn(
              'w-full pl-9 pr-9 py-2 text-sm border rounded-md',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          />
          {filters.searchQuery && (
            <button
              type="button"
              onClick={() =>
                onFiltersChange({ ...filters, searchQuery: '' })
              }
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <XIcon className="h-4 w-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Sections */}
      <FilterSection
        title="Date Range"
        isExpanded={expandedSections.dateRange}
        onToggle={() => toggleSection('dateRange')}
      >
        <DateRangeFilter
          value={filters.dateRange}
          onChange={handleDateRangeChange}
          disabled={disabled}
        />
      </FilterSection>

      <FilterSection
        title="Status"
        isExpanded={expandedSections.status}
        onToggle={() => toggleSection('status')}
      >
        <StatusFilter
          selectedStatuses={filters.statuses}
          onChange={handleStatusChange}
          disabled={disabled}
        />
      </FilterSection>

      <FilterSection
        title={`Repositories${filters.repositories.length > 0 ? ` (${filters.repositories.length})` : ''}`}
        isExpanded={expandedSections.repositories}
        onToggle={() => toggleSection('repositories')}
      >
        <RepositoryFilter
          selectedRepositories={filters.repositories}
          repositories={repositories}
          onChange={handleRepositoryChange}
          disabled={disabled}
        />
      </FilterSection>

      {/* Active Filters Summary */}
      {activeFilterCount > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-t">
          <div className="flex flex-wrap gap-2">
            {filters.dateRange && (
              <ActiveFilterTag
                label={`${formatDateForInput(filters.dateRange.start)} - ${formatDateForInput(filters.dateRange.end)}`}
                onRemove={() => handleDateRangeChange(null)}
              />
            )}
            {filters.statuses.map((status) => (
              <ActiveFilterTag
                key={status}
                label={SCAN_STATUS_LABELS[status]}
                color={SCAN_STATUS_COLORS[status]}
                onRemove={() =>
                  handleStatusChange(filters.statuses.filter((s) => s !== status))
                }
              />
            ))}
            {filters.repositories.length > 0 && (
              <ActiveFilterTag
                label={`${filters.repositories.length} repositories`}
                onRemove={() => handleRepositoryChange([])}
              />
            )}
            {filters.searchQuery && (
              <ActiveFilterTag
                label={`"${filters.searchQuery}"`}
                onRemove={() => onFiltersChange({ ...filters, searchQuery: '' })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Active Filter Tag Component
// ============================================================================

interface ActiveFilterTagProps {
  label: string;
  color?: string;
  onRemove: () => void;
}

function ActiveFilterTag({ label, color, onRemove }: ActiveFilterTagProps): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700"
      style={color ? { backgroundColor: `${color}20`, color } : undefined}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 hover:opacity-70"
      >
        <XIcon className="h-3 w-3" />
      </button>
    </span>
  );
}

export const ScanFilterPanel = memo(ScanFilterPanelComponent);

export type { ScanFilterPanelProps };
