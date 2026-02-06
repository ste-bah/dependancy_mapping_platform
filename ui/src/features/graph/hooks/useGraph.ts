/**
 * useGraph Hook
 * Composite hook for fetching and managing graph data with filtering
 * @module features/graph/hooks/useGraph
 *
 * This hook composes the lower-level query hooks to provide a complete
 * graph state management solution with:
 * - Graph data fetching with React Query
 * - URL-synchronized filters
 * - Node selection and detail fetching
 * - Blast radius calculation
 * - React Flow transformation
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type {
  GraphData,
  GraphNode,
  GraphEdge,
  GraphFilters,
  GraphNodeType,
  BlastRadius,
  CustomNodeData,
} from '../types';
import type { NodeDetailResponse } from '../types/api';
import {
  useGraphQuery,
  useNodeDetailQuery,
  useBlastRadiusQuery,
} from './queries';
import { useGraphUrlState, type UseGraphUrlStateOptions } from './useGraphUrlState';
import { toQueryFilters } from './queryKeys';

// ============================================================================
// Constants
// ============================================================================

const DEBOUNCE_DELAY = 300;

// ============================================================================
// Debounce Hook
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseGraphOptions {
  /** Scan ID to fetch graph for */
  scanId: string;
  /** Enable automatic persistence of filters to URL */
  persistFilters?: boolean;
  /** Custom initial filters */
  initialFilters?: Partial<GraphFilters>;
}

export interface UseGraphReturn {
  /** React Flow nodes */
  nodes: Node<CustomNodeData>[];
  /** React Flow edges */
  edges: Edge[];
  /** Original graph data */
  graphData: GraphData | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Is currently fetching (including background) */
  isFetching: boolean;
  /** Current filters */
  filters: GraphFilters;
  /** Set node type filters */
  setNodeTypes: (types: GraphNodeType[]) => void;
  /** Toggle a node type filter */
  toggleNodeType: (type: GraphNodeType) => void;
  /** Set search query */
  setSearch: (search: string) => void;
  /** Toggle blast radius mode */
  toggleBlastRadius: () => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Set selected node */
  setSelectedNodeId: (nodeId: string | null) => void;
  /** Selected node details */
  selectedNodeDetail: NodeDetailResponse | undefined;
  /** Is loading node details */
  isLoadingNodeDetail: boolean;
  /** Blast radius data for selected node */
  blastRadiusData: BlastRadius | undefined;
  /** Is loading blast radius */
  isLoadingBlastRadius: boolean;
  /** Fetch blast radius for a node */
  fetchBlastRadius: (nodeId: string) => void;
  /** Refetch graph data */
  refetch: () => void;
  /** Highlighted node IDs (affected by blast radius) */
  highlightedNodeIds: Set<string>;
}

// ============================================================================
// Transform Functions
// ============================================================================

/**
 * Transform API GraphNode to React Flow Node
 */
function transformToFlowNode(
  node: GraphNode,
  selectedId: string | null,
  highlightedIds: Set<string>,
  filters: GraphFilters
): Node<CustomNodeData> {
  const isSelected = node.id === selectedId;
  const isHighlighted = highlightedIds.has(node.id);
  const isDimmed = filters.showBlastRadius && !isHighlighted && selectedId !== null;

  return {
    id: node.id,
    type: 'customNode',
    position: { x: 0, y: 0 }, // Will be set by layout algorithm
    data: {
      ...node,
      selected: isSelected,
      highlighted: isHighlighted,
      dimmed: isDimmed,
    },
  };
}

/**
 * Transform API GraphEdge to React Flow Edge
 */
function transformToFlowEdge(
  edge: GraphEdge,
  highlightedIds: Set<string>,
  showBlastRadius: boolean
): Edge {
  const isHighlighted =
    highlightedIds.has(edge.sourceNodeId) && highlightedIds.has(edge.targetNodeId);

  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    animated: edge.type === 'DEPENDS_ON',
    style: {
      stroke: isHighlighted ? '#F59E0B' : '#94A3B8',
      strokeWidth: isHighlighted ? 2 : 1,
      opacity: showBlastRadius && !isHighlighted ? 0.3 : 1,
    },
    label: edge.type,
    labelStyle: {
      fontSize: 10,
      fill: '#64748B',
    },
    data: {
      type: edge.type,
      confidence: edge.confidence,
    },
  };
}

/**
 * Apply hierarchical layout to nodes
 */
function applyLayout(
  nodes: Node<CustomNodeData>[],
  edges: Edge[]
): Node<CustomNodeData>[] {
  // Build adjacency for incoming edges (dependents)
  const incomingEdges = new Map<string, string[]>();
  const outgoingEdges = new Map<string, string[]>();

  edges.forEach((edge) => {
    const incoming = incomingEdges.get(edge.target) ?? [];
    incoming.push(edge.source);
    incomingEdges.set(edge.target, incoming);

    const outgoing = outgoingEdges.get(edge.source) ?? [];
    outgoing.push(edge.target);
    outgoingEdges.set(edge.source, outgoing);
  });

  // Calculate levels using BFS from root nodes (nodes with no incoming edges)
  const levels = new Map<string, number>();
  const rootNodes = nodes.filter(
    (n) => !incomingEdges.has(n.id) || incomingEdges.get(n.id)?.length === 0
  );

  // BFS to assign levels
  const queue: Array<{ id: string; level: number }> = rootNodes.map((n) => ({
    id: n.id,
    level: 0,
  }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || visited.has(current.id)) continue;

    visited.add(current.id);
    const currentLevel = Math.max(levels.get(current.id) ?? 0, current.level);
    levels.set(current.id, currentLevel);

    const children = outgoingEdges.get(current.id) ?? [];
    children.forEach((childId) => {
      if (!visited.has(childId)) {
        queue.push({ id: childId, level: currentLevel + 1 });
      }
    });
  }

  // Handle disconnected nodes
  nodes.forEach((node) => {
    if (!levels.has(node.id)) {
      levels.set(node.id, 0);
    }
  });

  // Group nodes by level
  const nodesByLevel = new Map<number, Node<CustomNodeData>[]>();
  nodes.forEach((node) => {
    const level = levels.get(node.id) ?? 0;
    const levelNodes = nodesByLevel.get(level) ?? [];
    levelNodes.push(node);
    nodesByLevel.set(level, levelNodes);
  });

  // Position nodes
  const NODE_WIDTH = 200;
  const NODE_HEIGHT = 100;
  const HORIZONTAL_GAP = 60;
  const VERTICAL_GAP = 100;

  const positionedNodes: Node<CustomNodeData>[] = [];

  nodesByLevel.forEach((levelNodes, level) => {
    const totalWidth =
      levelNodes.length * NODE_WIDTH + (levelNodes.length - 1) * HORIZONTAL_GAP;
    const startX = -totalWidth / 2;

    levelNodes.forEach((node, index) => {
      positionedNodes.push({
        ...node,
        position: {
          x: startX + index * (NODE_WIDTH + HORIZONTAL_GAP),
          y: level * (NODE_HEIGHT + VERTICAL_GAP),
        },
      });
    });
  });

  return positionedNodes;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Composite hook for fetching and managing graph data with filtering, selection, and blast radius
 *
 * This hook composes the lower-level hooks:
 * - useGraphQuery for data fetching
 * - useNodeDetailQuery for node details
 * - useBlastRadiusQuery for blast radius calculation
 * - useGraphUrlState for URL synchronization
 *
 * @example
 * ```tsx
 * function GraphVisualization({ scanId }: { scanId: string }) {
 *   const {
 *     nodes,
 *     edges,
 *     isLoading,
 *     filters,
 *     setNodeTypes,
 *     selectedNodeId,
 *     setSelectedNodeId,
 *   } = useGraph({ scanId });
 *
 *   if (isLoading) return <Spinner />;
 *
 *   return (
 *     <ReactFlow
 *       nodes={nodes}
 *       edges={edges}
 *       onNodeClick={(_, node) => setSelectedNodeId(node.id)}
 *     />
 *   );
 * }
 * ```
 */
export function useGraph(options: UseGraphOptions): UseGraphReturn {
  const { scanId, persistFilters = true, initialFilters = {} } = options;

  // ============================================================================
  // URL State Management
  // ============================================================================

  const urlStateOptions: UseGraphUrlStateOptions = {
    enabled: persistFilters,
    debounceMs: DEBOUNCE_DELAY,
    defaultFilters: initialFilters,
  };

  const {
    filters: urlFilters,
    selectedNodeId: urlSelectedNodeId,
    updateFilters,
    setNodeTypes,
    toggleNodeType,
    toggleBlastRadius,
    setSelectedNodeId: setUrlSelectedNodeId,
    resetFilters: resetUrlFilters,
  } = useGraphUrlState(urlStateOptions);

  // Local search input state for debouncing
  const [searchInput, setSearchInput] = useState(urlFilters.search);
  const debouncedSearch = useDebounce(searchInput, DEBOUNCE_DELAY);

  // Sync debounced search to URL
  useEffect(() => {
    if (debouncedSearch !== urlFilters.search) {
      updateFilters({ search: debouncedSearch });
    }
  }, [debouncedSearch, urlFilters.search, updateFilters]);

  // Combine URL filters with current search input for display
  const filters: GraphFilters = useMemo(
    () => ({
      ...urlFilters,
      search: searchInput,
    }),
    [urlFilters, searchInput]
  );

  // Selection state (use URL state if persisting, otherwise local)
  const [localSelectedNodeId, setLocalSelectedNodeId] = useState<string | null>(null);
  const selectedNodeId = persistFilters ? urlSelectedNodeId : localSelectedNodeId;
  const setSelectedNodeId = persistFilters ? setUrlSelectedNodeId : setLocalSelectedNodeId;

  // Blast radius node tracking
  const [blastRadiusNodeId, setBlastRadiusNodeId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());

  // ============================================================================
  // Graph Query (using composed hook)
  // ============================================================================

  const queryFilters = useMemo(
    () => toQueryFilters({ ...urlFilters, search: debouncedSearch }),
    [urlFilters, debouncedSearch]
  );

  const {
    data: graphData,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useGraphQuery(scanId, {
    filters: queryFilters,
    enabled: Boolean(scanId),
  });

  // ============================================================================
  // Node Detail Query (using composed hook)
  // ============================================================================

  const {
    data: selectedNodeDetail,
    isLoading: isLoadingNodeDetail,
  } = useNodeDetailQuery(scanId, selectedNodeId);

  // ============================================================================
  // Blast Radius Query (using composed hook)
  // ============================================================================

  const {
    data: blastRadiusData,
    isLoading: isLoadingBlastRadius,
  } = useBlastRadiusQuery(
    scanId,
    blastRadiusNodeId,
    urlFilters.showBlastRadius
  );

  // Update highlighted nodes when blast radius data changes
  useEffect(() => {
    if (blastRadiusData && urlFilters.showBlastRadius) {
      const highlighted = new Set<string>([
        blastRadiusData.nodeId,
        ...blastRadiusData.affectedNodes,
      ]);
      setHighlightedNodeIds(highlighted);
    } else {
      setHighlightedNodeIds(new Set());
    }
  }, [blastRadiusData, urlFilters.showBlastRadius]);

  // ============================================================================
  // Transform Graph Data to React Flow Format
  // ============================================================================

  const { nodes, edges } = useMemo(() => {
    if (!graphData) {
      return { nodes: [], edges: [] };
    }

    // Filter nodes by type
    const filteredNodes = graphData.nodes.filter((node) =>
      urlFilters.nodeTypes.includes(node.type)
    );

    const nodeIds = new Set(filteredNodes.map((n) => n.id));

    // Filter edges to only include those between visible nodes
    const filteredEdges = graphData.edges.filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)
    );

    // Transform to React Flow format
    const flowNodes = filteredNodes.map((node) =>
      transformToFlowNode(node, selectedNodeId, highlightedNodeIds, urlFilters)
    );

    const flowEdges = filteredEdges.map((edge) =>
      transformToFlowEdge(edge, highlightedNodeIds, urlFilters.showBlastRadius)
    );

    // Apply layout
    const positionedNodes = applyLayout(flowNodes, flowEdges);

    return { nodes: positionedNodes, edges: flowEdges };
  }, [graphData, urlFilters, selectedNodeId, highlightedNodeIds]);

  // ============================================================================
  // Filter Actions
  // ============================================================================

  const setSearch = useCallback((search: string) => {
    setSearchInput(search);
  }, []);

  const handleToggleBlastRadius = useCallback(() => {
    toggleBlastRadius();
    if (urlFilters.showBlastRadius) {
      // Turning off - clear highlights
      setHighlightedNodeIds(new Set());
      setBlastRadiusNodeId(null);
    }
  }, [urlFilters.showBlastRadius, toggleBlastRadius]);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    resetUrlFilters();
    setHighlightedNodeIds(new Set());
    setBlastRadiusNodeId(null);
  }, [resetUrlFilters]);

  const fetchBlastRadiusForNode = useCallback((nodeId: string) => {
    setBlastRadiusNodeId(nodeId);
  }, []);

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    nodes,
    edges,
    graphData,
    isLoading,
    isError,
    error: error ?? null,
    isFetching,
    filters,
    setNodeTypes,
    toggleNodeType,
    setSearch,
    toggleBlastRadius: handleToggleBlastRadius,
    resetFilters,
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeDetail,
    isLoadingNodeDetail,
    blastRadiusData,
    isLoadingBlastRadius,
    fetchBlastRadius: fetchBlastRadiusForNode,
    refetch,
    highlightedNodeIds,
  };
}

export default useGraph;
