/**
 * GraphLegend Component
 * Legend displaying node and edge type colors
 * @module features/graph/components/GraphLegend
 */

import { useState, useCallback } from 'react';
import { cn } from '@/shared/utils';
import {
  nodeColors,
  nodeTypeLabels,
  edgeStyles,
  ALL_NODE_TYPES,
  ALL_EDGE_TYPES,
  type GraphNodeType,
  type EdgeType,
} from '../types';
import type { GraphLegendProps } from '../types/components';

// ============================================================================
// Icons
// ============================================================================

function ChevronDownIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Edge type display labels
 * Updated with Terragrunt-specific labels from TASK-TG-008
 */
const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  // Standard edge labels
  DEPENDS_ON: 'Depends On',
  REFERENCES: 'References',
  CONTAINS: 'Contains',
  IMPORTS: 'Imports',
  // Terragrunt edge labels (TASK-TG-008)
  tg_includes: 'TG Includes',
  tg_depends_on: 'TG Depends On',
  tg_passes_input: 'TG Passes Input',
  tg_sources: 'TG Sources',
};

// ============================================================================
// Component
// ============================================================================

/**
 * Legend component showing node and edge type meanings
 */
export function GraphLegend({
  nodeTypes = [...ALL_NODE_TYPES],
  className,
  showEdgeTypes = true,
  compact = false,
  orientation = 'vertical',
  onItemClick,
  activeTypes,
}: GraphLegendProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(!compact);

  const handleNodeTypeClick = useCallback(
    (type: GraphNodeType) => {
      onItemClick?.(type);
    },
    [onItemClick]
  );

  const isHorizontal = orientation === 'horizontal';

  return (
    <div
      className={cn(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        compact ? 'p-2' : 'p-3',
        className
      )}
      role="region"
      aria-label="Graph legend"
    >
      {/* Header */}
      <button
        className={cn(
          'flex items-center justify-between w-full text-left',
          compact && 'text-sm'
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="font-medium text-gray-900">Legend</span>
        <ChevronDownIcon
          className={cn(
            'h-4 w-4 text-gray-500 transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div className={cn('mt-3 space-y-4', compact && 'mt-2 space-y-3')}>
          {/* Node Types */}
          <div>
            <h4 className={cn(
              'font-medium text-gray-700 mb-2',
              compact ? 'text-xs' : 'text-sm'
            )}>
              Node Types
            </h4>
            <div
              className={cn(
                'gap-2',
                isHorizontal ? 'flex flex-wrap' : 'flex flex-col'
              )}
            >
              {nodeTypes.map((type) => (
                <NodeTypeLegendItem
                  key={type}
                  type={type}
                  compact={compact}
                  isActive={activeTypes ? activeTypes.includes(type) : true}
                  onClick={onItemClick ? () => handleNodeTypeClick(type) : undefined}
                />
              ))}
            </div>
          </div>

          {/* Edge Types */}
          {showEdgeTypes && (
            <div>
              <h4 className={cn(
                'font-medium text-gray-700 mb-2',
                compact ? 'text-xs' : 'text-sm'
              )}>
                Edge Types
              </h4>
              <div
                className={cn(
                  'gap-2',
                  isHorizontal ? 'flex flex-wrap' : 'flex flex-col'
                )}
              >
                {ALL_EDGE_TYPES.map((type) => (
                  <EdgeTypeLegendItem
                    key={type}
                    type={type}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Node Type Legend Item
// ============================================================================

interface NodeTypeLegendItemProps {
  type: GraphNodeType;
  compact?: boolean;
  isActive?: boolean;
  onClick?: () => void;
}

function NodeTypeLegendItem({
  type,
  compact = false,
  isActive = true,
  onClick,
}: NodeTypeLegendItemProps): JSX.Element {
  const color = nodeColors[type];
  const label = nodeTypeLabels[type];

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-2 rounded transition-colors',
        compact ? 'text-xs' : 'text-sm',
        onClick && 'cursor-pointer hover:bg-gray-50 -mx-1 px-1 py-0.5',
        !isActive && 'opacity-40'
      )}
      onClick={onClick}
      disabled={!onClick}
      aria-pressed={isActive}
    >
      <span
        className={cn(
          'rounded-sm shrink-0',
          compact ? 'w-3 h-3' : 'w-4 h-4'
        )}
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className={cn('text-gray-600', !isActive && 'line-through')}>
        {label}
      </span>
    </button>
  );
}

// ============================================================================
// Edge Type Legend Item
// ============================================================================

interface EdgeTypeLegendItemProps {
  type: EdgeType;
  compact?: boolean;
}

function EdgeTypeLegendItem({
  type,
  compact = false,
}: EdgeTypeLegendItemProps): JSX.Element {
  const style = edgeStyles[type];
  const label = EDGE_TYPE_LABELS[type];

  return (
    <div
      className={cn(
        'flex items-center gap-2',
        compact ? 'text-xs' : 'text-sm'
      )}
    >
      <div className="flex items-center shrink-0" aria-hidden="true">
        <svg
          width={compact ? 20 : 24}
          height={compact ? 8 : 10}
          viewBox="0 0 24 10"
        >
          {/* Edge line */}
          <line
            x1="0"
            y1="5"
            x2="24"
            y2="5"
            stroke={style.stroke}
            strokeWidth={style.strokeWidth ?? 2}
            strokeDasharray={style.animated ? '4 2' : undefined}
          />
          {/* Arrow head */}
          <path
            d="M20 2 L24 5 L20 8"
            fill="none"
            stroke={style.stroke}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <span className="text-gray-600">{label}</span>
    </div>
  );
}

// ============================================================================
// Inline Legend Variant
// ============================================================================

export interface GraphLegendInlineProps {
  nodeTypes?: GraphNodeType[];
  className?: string;
  onTypeClick?: (type: GraphNodeType) => void;
  activeTypes?: GraphNodeType[];
}

/**
 * Inline legend for use in compact spaces
 */
export function GraphLegendInline({
  nodeTypes = [...ALL_NODE_TYPES],
  className,
  onTypeClick,
  activeTypes,
}: GraphLegendInlineProps): JSX.Element {
  return (
    <div
      className={cn('flex flex-wrap items-center gap-3', className)}
      role="region"
      aria-label="Node type legend"
    >
      {nodeTypes.map((type) => {
        const isActive = activeTypes ? activeTypes.includes(type) : true;
        return (
          <button
            key={type}
            type="button"
            className={cn(
              'flex items-center gap-1.5 text-xs',
              onTypeClick && 'cursor-pointer hover:opacity-80',
              !isActive && 'opacity-40'
            )}
            onClick={() => onTypeClick?.(type)}
            disabled={!onTypeClick}
          >
            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: nodeColors[type] }}
              aria-hidden="true"
            />
            <span className={cn('text-gray-600', !isActive && 'line-through')}>
              {nodeTypeLabels[type]}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default GraphLegend;
