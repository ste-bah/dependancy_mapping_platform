/**
 * GraphCanvas Component
 * Main container for the dependency graph visualization
 * @module features/graph/components/GraphCanvas
 */

import { memo, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  type ReactFlowInstance,
  BackgroundVariant,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { cn } from '@/shared/utils';
import { Alert, Spinner } from '@/shared/components';
import { useGraph } from '../hooks';
import type { GraphNodeType, CustomNodeData } from '../types';
import { nodeColors } from '../types';
import { CustomNode } from './CustomNode';
import { FilterPanel } from './FilterPanel';
import { SearchBar } from './SearchBar';
import { DetailPanel } from './DetailPanel';

// ============================================================================
// Types
// ============================================================================

export interface GraphCanvasProps {
  /** Scan ID to display graph for */
  scanId: string;
  /** Callback when a node is selected */
  onNodeSelect?: (nodeId: string | null) => void;
  /** Additional class names */
  className?: string;
  /** Show the filter panel */
  showFilters?: boolean;
  /** Show the search bar */
  showSearch?: boolean;
  /** Show the detail panel */
  showDetails?: boolean;
  /** Show the minimap */
  showMinimap?: boolean;
}

// ============================================================================
// Node Types
// ============================================================================

const nodeTypes = {
  customNode: CustomNode,
};

// ============================================================================
// MiniMap Node Color
// ============================================================================

function minimapNodeColor(node: { data?: CustomNodeData }): string {
  if (!node.data?.type) return '#E5E7EB';
  return nodeColors[node.data.type as GraphNodeType] ?? '#E5E7EB';
}

// ============================================================================
// Component
// ============================================================================

/**
 * Main graph visualization component using React Flow
 *
 * @example
 * <GraphCanvas
 *   scanId="scan-123"
 *   onNodeSelect={(nodeId) => console.log('Selected:', nodeId)}
 * />
 */
function GraphCanvasComponent({
  scanId,
  onNodeSelect,
  className,
  showFilters = true,
  showSearch = true,
  showDetails = true,
  showMinimap = true,
}: GraphCanvasProps): JSX.Element {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  // Use the graph hook
  const {
    nodes: initialNodes,
    edges: initialEdges,
    graphData,
    isLoading,
    isError,
    error,
    isFetching,
    filters,
    setNodeTypes,
    toggleNodeType,
    setSearch,
    toggleBlastRadius,
    resetFilters,
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeDetail,
    isLoadingNodeDetail,
    blastRadiusData,
    isLoadingBlastRadius,
    fetchBlastRadius,
    highlightedNodeIds,
  } = useGraph({ scanId });

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes and edges when data changes
  // Using a ref to track if we need to update
  const prevNodesRef = useRef(initialNodes);
  const prevEdgesRef = useRef(initialEdges);

  if (prevNodesRef.current !== initialNodes) {
    setNodes(initialNodes);
    prevNodesRef.current = initialNodes;
  }

  if (prevEdgesRef.current !== initialEdges) {
    setEdges(initialEdges);
    prevEdgesRef.current = initialEdges;
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  const handleNodeClick: NodeMouseHandler = useCallback(
    (event, node) => {
      setSelectedNodeId(node.id);
      onNodeSelect?.(node.id);
    },
    [setSelectedNodeId, onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
    onNodeSelect?.(null);
  }, [setSelectedNodeId, onNodeSelect]);

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
    // Fit view after initial render
    setTimeout(() => {
      instance.fitView({ padding: 0.2 });
    }, 100);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedNodeId(null);
    onNodeSelect?.(null);
  }, [setSelectedNodeId, onNodeSelect]);

  const handleBlastRadius = useCallback(() => {
    if (selectedNodeId) {
      fetchBlastRadius(selectedNodeId);
      // Turn on blast radius mode if not already on
      if (!filters.showBlastRadius) {
        toggleBlastRadius();
      }
    }
  }, [selectedNodeId, fetchBlastRadius, filters.showBlastRadius, toggleBlastRadius]);

  const handleSearchSelect = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      onNodeSelect?.(nodeId);

      // Center view on selected node
      if (reactFlowInstance.current) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node) {
          reactFlowInstance.current.setCenter(
            node.position.x + 100,
            node.position.y + 50,
            { zoom: 1.2, duration: 500 }
          );
        }
      }
    },
    [setSelectedNodeId, onNodeSelect, nodes]
  );

  // ============================================================================
  // Loading State
  // ============================================================================

  if (isLoading) {
    return (
      <div
        className={cn(
          'flex h-full w-full items-center justify-center bg-gray-50',
          className
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-sm text-gray-500">Loading graph data...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Error State
  // ============================================================================

  if (isError) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center p-8', className)}>
        <Alert variant="error" className="max-w-md">
          <h3 className="font-semibold">Failed to load graph</h3>
          <p className="mt-1 text-sm">
            {error?.message ?? 'An unexpected error occurred while loading the graph.'}
          </p>
        </Alert>
      </div>
    );
  }

  // ============================================================================
  // Empty State
  // ============================================================================

  if (!graphData || graphData.nodes.length === 0) {
    return (
      <div className={cn('flex h-full w-full items-center justify-center p-8', className)}>
        <div className="text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h3 className="text-lg font-semibold text-gray-900">No dependencies found</h3>
          <p className="mt-2 text-sm text-gray-500">
            This scan didn&apos;t detect any dependency relationships.
          </p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div
      ref={reactFlowWrapper}
      className={cn('relative h-full w-full', className)}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onInit={handleInit}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
        proOptions={{ hideAttribution: true }}
      >
        {/* Background */}
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />

        {/* Controls */}
        <Controls position="bottom-right" />

        {/* Minimap */}
        {showMinimap && (
          <MiniMap
            nodeColor={minimapNodeColor}
            maskColor="rgba(255, 255, 255, 0.8)"
            position="bottom-left"
            className="!bg-white !border !border-gray-200 !rounded-lg !shadow-sm"
          />
        )}

        {/* Top Panel: Filters and Search */}
        <Panel position="top-left" className="flex gap-4">
          {showFilters && (
            <FilterPanel
              filters={filters}
              onFilterChange={(newFilters) => {
                setNodeTypes(newFilters.nodeTypes);
                if (newFilters.showBlastRadius !== filters.showBlastRadius) {
                  toggleBlastRadius();
                }
              }}
              onReset={resetFilters}
            />
          )}
        </Panel>

        {showSearch && (
          <Panel position="top-center">
            <SearchBar
              nodes={graphData.nodes}
              onSelect={handleSearchSelect}
              query={filters.search}
              onQueryChange={setSearch}
            />
          </Panel>
        )}

        {/* Loading indicator for background fetching */}
        {isFetching && !isLoading && (
          <Panel position="top-right">
            <div className="flex items-center gap-2 rounded-md bg-white px-3 py-2 shadow-sm border">
              <Spinner size="sm" />
              <span className="text-xs text-gray-500">Updating...</span>
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Detail Panel */}
      {showDetails && selectedNodeId && (
        <DetailPanel
          node={selectedNodeDetail ?? graphData.nodes.find((n) => n.id === selectedNodeId)}
          dependencies={selectedNodeDetail?.dependencies}
          dependents={selectedNodeDetail?.dependents}
          isLoading={isLoadingNodeDetail}
          onClose={handleCloseDetail}
          onBlastRadius={handleBlastRadius}
          isLoadingBlastRadius={isLoadingBlastRadius}
          blastRadiusData={blastRadiusData}
        />
      )}
    </div>
  );
}

export const GraphCanvas = memo(GraphCanvasComponent);

export type { GraphCanvasProps };
