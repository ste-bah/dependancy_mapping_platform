/**
 * DetailPanel Component
 * Side panel showing selected node details, dependencies, and blast radius
 * @module features/graph/components/DetailPanel
 */

import { memo } from 'react';
import { cn } from '@/shared/utils';
import { Button, Badge, Skeleton, SkeletonText } from '@/shared/components';
import type { GraphNode, GraphNodeType, BlastRadius } from '../types';
import { nodeColors, nodeTypeLabels, nodeTypeIcons } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface DetailPanelProps {
  /** Currently selected node */
  node: GraphNode | undefined;
  /** Node's dependencies */
  dependencies?: GraphNode[];
  /** Node's dependents */
  dependents?: GraphNode[];
  /** Loading state for node details */
  isLoading?: boolean;
  /** Callback to close the panel */
  onClose: () => void;
  /** Callback to show blast radius */
  onBlastRadius: () => void;
  /** Loading state for blast radius */
  isLoadingBlastRadius?: boolean;
  /** Blast radius data */
  blastRadiusData?: BlastRadius;
  /** Callback when clicking a dependency/dependent node */
  onNodeClick?: (nodeId: string) => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Detail panel showing information about the selected node
 *
 * @example
 * <DetailPanel
 *   node={selectedNode}
 *   dependencies={dependencies}
 *   dependents={dependents}
 *   onClose={() => setSelectedNode(null)}
 *   onBlastRadius={() => fetchBlastRadius(selectedNode.id)}
 * />
 */
function DetailPanelComponent({
  node,
  dependencies,
  dependents,
  isLoading,
  onClose,
  onBlastRadius,
  isLoadingBlastRadius,
  blastRadiusData,
  onNodeClick,
  className,
}: DetailPanelProps): JSX.Element | null {
  if (!node) return null;

  const color = nodeColors[node.type];
  const icon = nodeTypeIcons[node.type];
  const label = nodeTypeLabels[node.type];

  return (
    <div
      className={cn(
        'absolute right-0 top-0 h-full w-80 bg-white border-l shadow-lg',
        'flex flex-col overflow-hidden',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 p-4 border-b">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-xl"
            style={{ backgroundColor: color + '20' }}
          >
            {icon}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate" title={node.name}>
              {node.name}
            </h3>
            <Badge
              className="mt-1"
              style={{ backgroundColor: color + '20', color }}
            >
              {label}
            </Badge>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded hover:bg-gray-100"
          aria-label="Close panel"
        >
          <XIcon className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <SkeletonText lines={2} />
            <Skeleton height={100} variant="rounded" />
            <SkeletonText lines={3} />
          </div>
        ) : (
          <>
            {/* Location */}
            {node.location && (
              <Section title="Location">
                <div className="text-sm font-mono text-gray-700 break-all">
                  {node.location.filePath}
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Lines {node.location.startLine} - {node.location.endLine}
                </div>
              </Section>
            )}

            {/* Blast Radius */}
            <Section title="Impact Analysis">
              <Button
                variant="outline"
                size="sm"
                onClick={onBlastRadius}
                disabled={isLoadingBlastRadius}
                className="w-full mb-3"
              >
                {isLoadingBlastRadius ? (
                  <>
                    <LoadingSpinner className="h-4 w-4 mr-2" />
                    Calculating...
                  </>
                ) : (
                  <>
                    <BlastIcon className="h-4 w-4 mr-2" />
                    Show Blast Radius
                  </>
                )}
              </Button>

              {blastRadiusData && blastRadiusData.nodeId === node.id && (
                <div className="space-y-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Direct Impact</span>
                    <span className="font-semibold text-amber-700">
                      {blastRadiusData.directDependents} nodes
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Transitive Impact</span>
                    <span className="font-semibold text-amber-700">
                      {blastRadiusData.transitiveDependents} nodes
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Impact Score</span>
                    <ImpactBadge score={blastRadiusData.impactScore} />
                  </div>
                </div>
              )}
            </Section>

            {/* Dependencies */}
            <Section
              title="Dependencies"
              count={dependencies?.length ?? 0}
              emptyMessage="No dependencies"
            >
              {dependencies && dependencies.length > 0 && (
                <NodeList nodes={dependencies} onNodeClick={onNodeClick} />
              )}
            </Section>

            {/* Dependents */}
            <Section
              title="Dependents"
              count={dependents?.length ?? 0}
              emptyMessage="No dependents"
            >
              {dependents && dependents.length > 0 && (
                <NodeList nodes={dependents} onNodeClick={onNodeClick} />
              )}
            </Section>

            {/* Metadata */}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <Section title="Metadata">
                <dl className="space-y-2">
                  {Object.entries(node.metadata).map(([key, value]) => (
                    <div key={key} className="text-sm">
                      <dt className="text-gray-500 text-xs uppercase tracking-wide">
                        {key}
                      </dt>
                      <dd className="text-gray-900 break-all">
                        {typeof value === 'object'
                          ? JSON.stringify(value, null, 2)
                          : String(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </Section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

interface SectionProps {
  title: string;
  count?: number;
  emptyMessage?: string;
  children?: React.ReactNode;
}

function Section({ title, count, emptyMessage, children }: SectionProps) {
  const hasContent = children !== undefined && children !== null;
  const isEmpty = count === 0;

  return (
    <div className="p-4 border-b last:border-b-0">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {title}
        </h4>
        {count !== undefined && (
          <Badge variant="secondary" size="sm">
            {count}
          </Badge>
        )}
      </div>
      {isEmpty && emptyMessage ? (
        <p className="text-sm text-gray-400 italic">{emptyMessage}</p>
      ) : (
        hasContent && children
      )}
    </div>
  );
}

interface NodeListProps {
  nodes: GraphNode[];
  onNodeClick?: (nodeId: string) => void;
}

function NodeList({ nodes, onNodeClick }: NodeListProps) {
  return (
    <ul className="space-y-1">
      {nodes.slice(0, 10).map((node) => {
        const color = nodeColors[node.type];
        const icon = nodeTypeIcons[node.type];

        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onNodeClick?.(node.id)}
              disabled={!onNodeClick}
              className={cn(
                'w-full flex items-center gap-2 px-2 py-1.5 rounded text-left',
                'hover:bg-gray-50 transition-colors',
                !onNodeClick && 'cursor-default'
              )}
            >
              <span className="flex-shrink-0">{icon}</span>
              <span className="flex-1 text-sm text-gray-700 truncate">
                {node.name}
              </span>
              <ChevronRightIcon className="flex-shrink-0 h-4 w-4 text-gray-300" />
            </button>
          </li>
        );
      })}
      {nodes.length > 10 && (
        <li className="px-2 py-1 text-xs text-gray-400">
          +{nodes.length - 10} more
        </li>
      )}
    </ul>
  );
}

interface ImpactBadgeProps {
  score: number;
}

function ImpactBadge({ score }: ImpactBadgeProps) {
  let color: string;
  let label: string;

  if (score >= 0.8) {
    color = 'bg-red-100 text-red-700';
    label = 'Critical';
  } else if (score >= 0.6) {
    color = 'bg-orange-100 text-orange-700';
    label = 'High';
  } else if (score >= 0.4) {
    color = 'bg-amber-100 text-amber-700';
    label = 'Medium';
  } else if (score >= 0.2) {
    color = 'bg-yellow-100 text-yellow-700';
    label = 'Low';
  } else {
    color = 'bg-green-100 text-green-700';
    label = 'Minimal';
  }

  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded', color)}>
      {label} ({Math.round(score * 100)}%)
    </span>
  );
}

// ============================================================================
// Icons
// ============================================================================

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

function BlastIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 013 8zm11 0a.75.75 0 01.75-.75h1.5a.75.75 0 010 1.5h-1.5A.75.75 0 0114 8zm-8.95 6.89a.75.75 0 010-1.061l1.06-1.06a.75.75 0 011.06 1.06l-1.06 1.061a.75.75 0 01-1.06 0zm8.839-1.061a.75.75 0 011.06 0l1.061 1.06a.75.75 0 11-1.06 1.061l-1.06-1.06a.75.75 0 010-1.06zM10 14a.75.75 0 01.75.75v1.5a.75.75 0 11-1.5 0v-1.5A.75.75 0 0110 14zM10 5a3 3 0 100 6 3 3 0 000-6zm-5 3a5 5 0 1110 0 5 5 0 01-10 0z"
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

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export const DetailPanel = memo(DetailPanelComponent);

export type { DetailPanelProps };
