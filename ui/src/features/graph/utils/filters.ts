/**
 * Graph Filter Logic
 * Pure functions for filtering and highlighting graph nodes/edges
 * @module features/graph/utils/filters
 */

import type {
  FlowNode,
  FlowEdge,
  GraphFilters,
  ExtendedGraphFilters,
  GraphNodeType,
  EdgeType,
  BlastRadiusResponse,
  CustomNodeData,
  CustomEdgeData,
} from '../types';

// ============================================================================
// Node Filtering
// ============================================================================

/**
 * Filter nodes based on graph filter settings
 *
 * @param nodes - Array of FlowNodes to filter
 * @param filters - Filter settings to apply
 * @returns Filtered array of FlowNodes
 *
 * @example
 * ```ts
 * const visible = filterNodes(allNodes, {
 *   nodeTypes: ['terraform_resource', 'helm_chart'],
 *   search: 'database',
 *   showBlastRadius: false,
 * });
 * ```
 */
export function filterNodes(
  nodes: FlowNode[],
  filters: ExtendedGraphFilters
): FlowNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  return nodes.filter(node => {
    // Node type filter
    if (filters.nodeTypes.length > 0 && !filters.nodeTypes.includes(node.data.type)) {
      return false;
    }

    // Search filter (case-insensitive)
    if (filters.search && filters.search.trim() !== '') {
      const searchLower = filters.search.toLowerCase();
      const nameMatch = node.data.name.toLowerCase().includes(searchLower);
      const idMatch = node.data.id.toLowerCase().includes(searchLower);
      const pathMatch = node.data.location?.filePath?.toLowerCase().includes(searchLower) ?? false;

      if (!nameMatch && !idMatch && !pathMatch) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Filter nodes by type only
 *
 * @param nodes - Array of FlowNodes
 * @param types - Node types to include
 * @returns Filtered nodes
 */
export function filterNodesByType(
  nodes: FlowNode[],
  types: GraphNodeType[]
): FlowNode[] {
  if (!types || types.length === 0) {
    return nodes;
  }

  const typeSet = new Set(types);
  return nodes.filter(node => typeSet.has(node.data.type));
}

/**
 * Filter nodes by search query
 *
 * @param nodes - Array of FlowNodes
 * @param query - Search query string
 * @returns Filtered nodes
 */
export function filterNodesBySearch(
  nodes: FlowNode[],
  query: string
): FlowNode[] {
  if (!query || query.trim() === '') {
    return nodes;
  }

  const searchLower = query.toLowerCase().trim();

  return nodes.filter(node => {
    const searchableText = [
      node.data.name,
      node.data.id,
      node.data.location?.filePath ?? '',
    ].join(' ').toLowerCase();

    return searchableText.includes(searchLower);
  });
}

// ============================================================================
// Edge Filtering
// ============================================================================

/**
 * Filter edges to only include those connecting visible nodes
 *
 * @param edges - Array of FlowEdges
 * @param visibleNodeIds - Set of visible node IDs
 * @returns Filtered edges
 *
 * @example
 * ```ts
 * const visibleIds = new Set(visibleNodes.map(n => n.id));
 * const visibleEdges = filterEdges(allEdges, visibleIds);
 * ```
 */
export function filterEdges(
  edges: FlowEdge[],
  visibleNodeIds: Set<string>
): FlowEdge[] {
  if (!edges || edges.length === 0) {
    return [];
  }

  if (visibleNodeIds.size === 0) {
    return [];
  }

  return edges.filter(edge =>
    visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
  );
}

/**
 * Filter edges by edge type
 *
 * @param edges - Array of FlowEdges
 * @param types - Edge types to include
 * @returns Filtered edges
 */
export function filterEdgesByType(
  edges: FlowEdge[],
  types: EdgeType[]
): FlowEdge[] {
  if (!types || types.length === 0) {
    return edges;
  }

  const typeSet = new Set(types);
  return edges.filter(edge => edge.data && typeSet.has(edge.data.type));
}

/**
 * Filter edges by minimum confidence threshold
 *
 * @param edges - Array of FlowEdges
 * @param minConfidence - Minimum confidence value (0-1)
 * @returns Filtered edges
 */
export function filterEdgesByConfidence(
  edges: FlowEdge[],
  minConfidence: number
): FlowEdge[] {
  if (minConfidence <= 0) {
    return edges;
  }

  return edges.filter(edge =>
    edge.data && edge.data.confidence >= minConfidence
  );
}

/**
 * Apply all extended filters to edges
 *
 * @param edges - Array of FlowEdges
 * @param visibleNodeIds - Set of visible node IDs
 * @param filters - Extended filter settings
 * @returns Filtered edges
 */
export function filterEdgesExtended(
  edges: FlowEdge[],
  visibleNodeIds: Set<string>,
  filters: ExtendedGraphFilters
): FlowEdge[] {
  let result = filterEdges(edges, visibleNodeIds);
  result = filterEdgesByType(result, filters.edgeTypes);
  result = filterEdgesByConfidence(result, filters.minConfidence);
  return result;
}

// ============================================================================
// Connected Node Filtering
// ============================================================================

/**
 * Get IDs of all nodes connected to a specific node (within depth limit)
 *
 * @param startNodeId - Starting node ID
 * @param edges - All edges
 * @param maxDepth - Maximum traversal depth
 * @param direction - Traversal direction: 'both', 'incoming', 'outgoing'
 * @returns Set of connected node IDs
 */
export function getConnectedNodeIds(
  startNodeId: string,
  edges: FlowEdge[],
  maxDepth: number = Infinity,
  direction: 'both' | 'incoming' | 'outgoing' = 'both'
): Set<string> {
  const connected = new Set<string>([startNodeId]);
  let frontier = new Set<string>([startNodeId]);
  let depth = 0;

  while (frontier.size > 0 && depth < maxDepth) {
    const nextFrontier = new Set<string>();

    for (const edge of edges) {
      if (direction !== 'incoming' && frontier.has(edge.source)) {
        if (!connected.has(edge.target)) {
          connected.add(edge.target);
          nextFrontier.add(edge.target);
        }
      }

      if (direction !== 'outgoing' && frontier.has(edge.target)) {
        if (!connected.has(edge.source)) {
          connected.add(edge.source);
          nextFrontier.add(edge.source);
        }
      }
    }

    frontier = nextFrontier;
    depth++;
  }

  return connected;
}

/**
 * Filter to only show nodes connected to a specific node
 *
 * @param nodes - All nodes
 * @param edges - All edges
 * @param centerId - Center node ID
 * @param maxDepth - Maximum traversal depth
 * @returns Filtered nodes
 */
export function filterConnectedNodes(
  nodes: FlowNode[],
  edges: FlowEdge[],
  centerId: string,
  maxDepth: number = Infinity
): FlowNode[] {
  const connectedIds = getConnectedNodeIds(centerId, edges, maxDepth);
  return nodes.filter(node => connectedIds.has(node.id));
}

// ============================================================================
// Highlighting
// ============================================================================

/**
 * Apply highlighting and dimming to nodes based on selection and blast radius
 *
 * @param nodes - Array of FlowNodes
 * @param selectedId - Currently selected node ID (or null)
 * @param blastRadius - Blast radius response (or null)
 * @returns Nodes with updated highlight/dim states
 *
 * @example
 * ```ts
 * const highlighted = applyHighlighting(nodes, 'node-1', blastRadiusData);
 * ```
 */
export function applyHighlighting(
  nodes: FlowNode[],
  selectedId: string | null,
  blastRadius: BlastRadiusResponse | null
): FlowNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  // Build set of affected node IDs from blast radius
  const affectedIds = new Set<string>();
  if (blastRadius && blastRadius.affectedNodes) {
    for (const affected of blastRadius.affectedNodes) {
      affectedIds.add(affected.id);
    }
  }

  // Include the selected node itself in affected set
  if (selectedId && blastRadius) {
    affectedIds.add(selectedId);
  }

  const hasActiveSelection = selectedId !== null;
  const hasBlastRadius = blastRadius !== null && affectedIds.size > 0;

  return nodes.map(node => {
    const isSelected = node.id === selectedId;
    const isAffected = affectedIds.has(node.id);

    // Determine highlight state
    let highlighted = false;
    let dimmed = false;

    if (hasBlastRadius) {
      // In blast radius mode: highlight affected, dim others
      highlighted = isAffected;
      dimmed = !isAffected && hasActiveSelection;
    } else if (hasActiveSelection) {
      // Just selection: highlight selected, no dimming
      highlighted = isSelected;
    }

    const updatedData: CustomNodeData = {
      ...node.data,
      selected: isSelected,
      highlighted,
      dimmed,
    };

    return {
      ...node,
      data: updatedData,
    };
  });
}

/**
 * Apply highlighting to edges based on connected nodes
 *
 * @param edges - Array of FlowEdges
 * @param highlightedNodeIds - Set of highlighted node IDs
 * @returns Edges with updated highlight states
 */
export function applyEdgeHighlighting(
  edges: FlowEdge[],
  highlightedNodeIds: Set<string>
): FlowEdge[] {
  if (!edges || edges.length === 0) {
    return [];
  }

  return edges.map(edge => {
    const isHighlighted =
      highlightedNodeIds.has(edge.source) &&
      highlightedNodeIds.has(edge.target);

    const updatedData: CustomEdgeData = {
      ...edge.data,
      type: edge.data?.type ?? 'DEPENDS_ON',
      confidence: edge.data?.confidence ?? 1,
      highlighted: isHighlighted,
    };

    return {
      ...edge,
      data: updatedData,
      style: {
        ...edge.style,
        opacity: highlightedNodeIds.size > 0 && !isHighlighted ? 0.3 : 1,
      },
    };
  });
}

/**
 * Clear all highlighting and dimming from nodes
 *
 * @param nodes - Array of FlowNodes
 * @returns Nodes with cleared states
 */
export function clearHighlighting(nodes: FlowNode[]): FlowNode[] {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      selected: false,
      highlighted: false,
      dimmed: false,
    },
  }));
}

/**
 * Clear highlighting from edges
 *
 * @param edges - Array of FlowEdges
 * @returns Edges with cleared highlight states
 */
export function clearEdgeHighlighting(edges: FlowEdge[]): FlowEdge[] {
  return edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      type: edge.data?.type ?? 'DEPENDS_ON',
      confidence: edge.data?.confidence ?? 1,
      highlighted: false,
    },
    style: {
      ...edge.style,
      opacity: 1,
    },
  }));
}

// ============================================================================
// Combined Filter and Highlight
// ============================================================================

/**
 * Apply full filter and highlight pipeline to graph data
 *
 * @param nodes - All nodes
 * @param edges - All edges
 * @param filters - Filter settings
 * @param selectedId - Selected node ID
 * @param blastRadius - Blast radius data
 * @returns Filtered and highlighted nodes and edges
 */
export function applyFiltersAndHighlighting(
  nodes: FlowNode[],
  edges: FlowEdge[],
  filters: ExtendedGraphFilters,
  selectedId: string | null,
  blastRadius: BlastRadiusResponse | null
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  // Step 1: Filter nodes
  let filteredNodes = filterNodes(nodes, filters);

  // Step 2: If showConnectedOnly and we have a selection, further filter
  if (filters.showConnectedOnly && selectedId) {
    const connectedIds = getConnectedNodeIds(selectedId, edges, filters.maxDepth);
    filteredNodes = filteredNodes.filter(n => connectedIds.has(n.id));
  }

  // Step 3: Filter edges to visible nodes
  const visibleNodeIds = new Set(filteredNodes.map(n => n.id));
  const filteredEdges = filterEdgesExtended(edges, visibleNodeIds, filters);

  // Step 4: Apply highlighting to nodes
  const highlightedNodes = applyHighlighting(filteredNodes, selectedId, blastRadius);

  // Step 5: Apply highlighting to edges
  const affectedIds = new Set<string>();
  if (blastRadius) {
    for (const affected of blastRadius.affectedNodes ?? []) {
      affectedIds.add(affected.id);
    }
    if (selectedId) {
      affectedIds.add(selectedId);
    }
  }
  const highlightedEdges = applyEdgeHighlighting(filteredEdges, affectedIds);

  return {
    nodes: highlightedNodes,
    edges: highlightedEdges,
  };
}
