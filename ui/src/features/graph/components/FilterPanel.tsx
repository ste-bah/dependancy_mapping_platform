/**
 * FilterPanel Component
 * Node type filters and controls for the graph visualization
 * @module features/graph/components/FilterPanel
 */

import { memo, useState } from 'react';
import { cn } from '@/shared/utils';
import { Button, Badge } from '@/shared/components';
import type { GraphFilters, GraphNodeType } from '../types';
import { nodeColors, nodeTypeLabels, nodeTypeIcons } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface FilterPanelProps {
  /** Current filter values */
  filters: GraphFilters;
  /** Callback when filters change */
  onFilterChange: (filters: GraphFilters) => void;
  /** Callback to reset all filters */
  onReset?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Constants
// ============================================================================

const ALL_NODE_TYPES: GraphNodeType[] = [
  'terraform_resource',
  'terraform_module',
  'terraform_data_source',
  'helm_chart',
  'k8s_resource',
  'external_reference',
];

// ============================================================================
// Component
// ============================================================================

/**
 * Filter panel for controlling graph node type visibility
 *
 * @example
 * <FilterPanel
 *   filters={filters}
 *   onFilterChange={handleFilterChange}
 *   onReset={handleReset}
 * />
 */
function FilterPanelComponent({
  filters,
  onFilterChange,
  onReset,
  className,
}: FilterPanelProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleNodeType = (type: GraphNodeType) => {
    const currentTypes = filters.nodeTypes;
    const hasType = currentTypes.includes(type);

    // Don't allow deselecting the last type
    if (hasType && currentTypes.length === 1) {
      return;
    }

    const newTypes = hasType
      ? currentTypes.filter((t) => t !== type)
      : [...currentTypes, type];

    onFilterChange({
      ...filters,
      nodeTypes: newTypes,
    });
  };

  const toggleBlastRadius = () => {
    onFilterChange({
      ...filters,
      showBlastRadius: !filters.showBlastRadius,
    });
  };

  const selectAll = () => {
    onFilterChange({
      ...filters,
      nodeTypes: ALL_NODE_TYPES,
    });
  };

  const activeCount = filters.nodeTypes.length;
  const hasActiveFilters =
    activeCount < ALL_NODE_TYPES.length || filters.showBlastRadius;

  return (
    <div
      className={cn(
        'rounded-lg border bg-white shadow-sm',
        isExpanded ? 'w-64' : 'w-auto',
        className
      )}
    >
      {/* Header / Toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          'flex w-full items-center justify-between gap-2 px-3 py-2 text-left',
          'hover:bg-gray-50 transition-colors',
          isExpanded && 'border-b'
        )}
      >
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters</span>
          {hasActiveFilters && (
            <Badge variant="primary" size="sm">
              {activeCount}/{ALL_NODE_TYPES.length}
            </Badge>
          )}
        </div>
        <ChevronIcon
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="p-3 space-y-4">
          {/* Node Type Filters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                Node Types
              </span>
              {activeCount < ALL_NODE_TYPES.length && (
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  Select all
                </button>
              )}
            </div>

            <div className="space-y-1">
              {ALL_NODE_TYPES.map((type) => {
                const isActive = filters.nodeTypes.includes(type);
                const color = nodeColors[type];
                const label = nodeTypeLabels[type];
                const icon = nodeTypeIcons[type];

                return (
                  <label
                    key={type}
                    className={cn(
                      'flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer',
                      'hover:bg-gray-50 transition-colors',
                      isActive && 'bg-gray-50'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleNodeType(type)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center',
                        'transition-colors'
                      )}
                      style={{
                        borderColor: isActive ? color : '#D1D5DB',
                        backgroundColor: isActive ? color : 'white',
                      }}
                    >
                      {isActive && (
                        <CheckIcon className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <span className="text-base">{icon}</span>
                    <span
                      className={cn(
                        'text-sm',
                        isActive ? 'text-gray-900' : 'text-gray-500'
                      )}
                    >
                      {label}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Blast Radius Toggle */}
          <div className="border-t pt-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                className={cn(
                  'relative w-10 h-5 rounded-full transition-colors',
                  filters.showBlastRadius ? 'bg-amber-500' : 'bg-gray-200'
                )}
              >
                <div
                  className={cn(
                    'absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform',
                    filters.showBlastRadius && 'translate-x-5'
                  )}
                />
                <input
                  type="checkbox"
                  checked={filters.showBlastRadius}
                  onChange={toggleBlastRadius}
                  className="sr-only"
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-700">
                  Blast Radius
                </span>
                <span className="text-xs text-gray-500">
                  Highlight impact area
                </span>
              </div>
            </label>
          </div>

          {/* Reset Button */}
          {hasActiveFilters && onReset && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="w-full"
            >
              <XIcon className="h-4 w-4 mr-1" />
              Reset Filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M2.628 1.601C5.028 1.206 7.49 1 10 1s4.973.206 7.372.601a.75.75 0 01.628.74v2.288a2.25 2.25 0 01-.659 1.59l-4.682 4.683a2.25 2.25 0 00-.659 1.59v3.037c0 .684-.31 1.33-.844 1.757l-1.937 1.55A.75.75 0 018 18.25v-5.757a2.25 2.25 0 00-.659-1.591L2.659 6.22A2.25 2.25 0 012 4.629V2.34a.75.75 0 01.628-.74z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
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

export const FilterPanel = memo(FilterPanelComponent);

export type { FilterPanelProps };
