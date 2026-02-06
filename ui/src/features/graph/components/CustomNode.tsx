/**
 * Custom Graph Node Component
 * Styled node for React Flow dependency graph
 * @module features/graph/components/CustomNode
 */

import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { cn } from '@/shared/utils';
import {
  type CustomNodeData,
  type GraphNodeType,
  nodeColors,
  nodeTypeIcons,
  nodeTypeLabels,
} from '../types';

// ============================================================================
// Types
// ============================================================================

/**
 * Custom node type for React Flow
 * Re-exported from types for convenience
 */
export type CustomNodeType = Node<CustomNodeData, 'customNode'>;

// Re-export CustomNodeData for backwards compatibility
export type { CustomNodeData } from '../types';

// ============================================================================
// Component
// ============================================================================

/**
 * Custom node component for dependency graph visualization
 *
 * @example
 * const nodeTypes = { customNode: CustomNode };
 * <ReactFlow nodes={nodes} nodeTypes={nodeTypes} />
 */
function CustomNodeComponent({ data, selected }: NodeProps<CustomNodeType>): JSX.Element {
  const nodeType = data.type;
  const color = nodeColors[nodeType] ?? '#9CA3AF';
  const icon = nodeTypeIcons[nodeType] ?? '📄';
  const label = nodeTypeLabels[nodeType] ?? 'Unknown';

  return (
    <>
      {/* Input handle (dependencies) */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />

      {/* Node body */}
      <div
        className={cn(
          'px-4 py-3 rounded-lg shadow-md border-2 min-w-[160px] max-w-[240px]',
          'transition-all duration-200',
          selected && 'ring-2 ring-primary-500 ring-offset-2',
          data.highlighted && 'ring-2 ring-amber-400',
          data.dimmed && 'opacity-40'
        )}
        style={{
          backgroundColor: 'white',
          borderColor: color,
        }}
      >
        {/* Header with type badge */}
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base">{icon}</span>
          <span
            className="text-xs font-medium px-1.5 py-0.5 rounded"
            style={{ backgroundColor: color + '20', color }}
          >
            {label}
          </span>
        </div>

        {/* Node name */}
        <div className="text-sm font-semibold text-gray-900 truncate" title={data.name}>
          {data.name}
        </div>

        {/* File location if available */}
        {data.location && (
          <div className="text-xs text-gray-500 truncate mt-1" title={data.location.filePath}>
            {data.location.filePath.split('/').pop()}:{data.location.startLine}
          </div>
        )}
      </div>

      {/* Output handle (dependents) */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-gray-400 !border-2 !border-white"
      />
    </>
  );
}

export const CustomNode = memo(CustomNodeComponent);
