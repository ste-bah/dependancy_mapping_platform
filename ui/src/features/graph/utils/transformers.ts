/**
 * Graph Data Transformers
 * Transform API response data to React Flow compatible formats
 * @module features/graph/utils/transformers
 */

import type {
  GraphNode,
  GraphEdge,
  GraphData,
  FlowNode,
  FlowEdge,
  CustomNodeData,
  CustomEdgeData,
  EdgeType,
} from '../types';
import type { GraphDataResponse } from '../types/api';
import { edgeStyles } from '../types';

// ============================================================================
// Node Transformers
// ============================================================================

/**
 * Transform a single GraphNode to FlowNode format
 *
 * @param node - Graph node from API
 * @param position - Optional position (defaults to 0,0)
 * @returns React Flow compatible node
 */
export function transformToFlowNode(
  node: GraphNode,
  position: { x: number; y: number } = { x: 0, y: 0 }
): FlowNode {
  const nodeData: CustomNodeData = {
    id: node.id,
    name: node.name,
    type: node.type,
    location: node.location,
    metadata: node.metadata,
    selected: false,
    highlighted: false,
    dimmed: false,
  };

  return {
    id: node.id,
    type: 'customNode',
    position,
    data: nodeData,
  };
}

/**
 * Transform an array of GraphNodes to FlowNode format
 * Nodes are positioned at origin; use layout algorithm for positioning
 *
 * @param nodes - Array of graph nodes from API
 * @returns Array of React Flow compatible nodes
 *
 * @example
 * ```ts
 * const flowNodes = transformToFlowNodes(apiResponse.nodes);
 * ```
 */
export function transformToFlowNodes(nodes: GraphNode[]): FlowNode[] {
  if (!nodes || nodes.length === 0) {
    return [];
  }

  return nodes.map(node => transformToFlowNode(node));
}

// ============================================================================
// Edge Transformers
// ============================================================================

/**
 * Get edge style configuration based on edge type
 *
 * @param edgeType - Type of edge relationship
 * @returns Edge style properties
 */
function getEdgeStyle(edgeType: EdgeType): {
  stroke: string;
  strokeWidth: number;
  animated: boolean;
} {
  const style = edgeStyles[edgeType] ?? edgeStyles.DEPENDS_ON;
  return {
    stroke: style.stroke ?? '#6366F1',
    strokeWidth: style.strokeWidth ?? 1,
    animated: style.animated ?? false,
  };
}

/**
 * Transform a single GraphEdge to FlowEdge format
 *
 * @param edge - Graph edge from API
 * @returns React Flow compatible edge
 */
export function transformToFlowEdge(edge: GraphEdge): FlowEdge {
  const style = getEdgeStyle(edge.type);

  const edgeData: CustomEdgeData = {
    type: edge.type,
    confidence: edge.confidence,
    highlighted: false,
  };

  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: 'smoothstep',
    animated: style.animated,
    style: {
      stroke: style.stroke,
      strokeWidth: style.strokeWidth,
    },
    data: edgeData,
  };
}

/**
 * Transform an array of GraphEdges to FlowEdge format
 *
 * @param edges - Array of graph edges from API
 * @returns Array of React Flow compatible edges
 *
 * @example
 * ```ts
 * const flowEdges = transformToFlowEdges(apiResponse.edges);
 * ```
 */
export function transformToFlowEdges(edges: GraphEdge[]): FlowEdge[] {
  if (!edges || edges.length === 0) {
    return [];
  }

  return edges.map(edge => transformToFlowEdge(edge));
}

/**
 * Transform edges with validation against existing node IDs
 * Filters out edges with missing source or target nodes
 *
 * @param edges - Array of graph edges from API
 * @param nodeIds - Set of valid node IDs
 * @returns Array of valid React Flow compatible edges
 */
export function transformToFlowEdgesValidated(
  edges: GraphEdge[],
  nodeIds: Set<string>
): FlowEdge[] {
  if (!edges || edges.length === 0) {
    return [];
  }

  return edges
    .filter(edge => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId))
    .map(edge => transformToFlowEdge(edge));
}

// ============================================================================
// Combined Transformers
// ============================================================================

/**
 * Transform complete graph data response to React Flow format
 *
 * @param data - Graph data response from API
 * @returns Object containing nodes and edges in React Flow format
 *
 * @example
 * ```ts
 * const { nodes, edges } = transformGraphData(apiResponse);
 * // Then apply layout: const layouted = calculateLayout(nodes, edges);
 * ```
 */
export function transformGraphData(
  data: GraphDataResponse | GraphData
): { nodes: FlowNode[]; edges: FlowEdge[] } {
  if (!data) {
    return { nodes: [], edges: [] };
  }

  const nodes = transformToFlowNodes(data.nodes ?? []);
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = transformToFlowEdgesValidated(data.edges ?? [], nodeIds);

  return { nodes, edges };
}

// ============================================================================
// Update Transformers
// ============================================================================

/**
 * Update node data properties while preserving position
 *
 * @param node - Existing FlowNode
 * @param updates - Partial CustomNodeData updates
 * @returns New FlowNode with updated data
 */
export function updateNodeData(
  node: FlowNode,
  updates: Partial<CustomNodeData>
): FlowNode {
  return {
    ...node,
    data: {
      ...node.data,
      ...updates,
    },
  };
}

/**
 * Update edge data properties
 *
 * @param edge - Existing FlowEdge
 * @param updates - Partial CustomEdgeData updates
 * @returns New FlowEdge with updated data
 */
export function updateEdgeData(
  edge: FlowEdge,
  updates: Partial<CustomEdgeData>
): FlowEdge {
  return {
    ...edge,
    data: {
      ...edge.data,
      ...updates,
    } as CustomEdgeData,
  };
}

/**
 * Batch update nodes with selection/highlight state
 *
 * @param nodes - Array of FlowNodes
 * @param selectedId - Currently selected node ID (or null)
 * @param highlightedIds - Set of highlighted node IDs
 * @returns Updated FlowNode array
 */
export function updateNodesState(
  nodes: FlowNode[],
  selectedId: string | null,
  highlightedIds: Set<string>
): FlowNode[] {
  return nodes.map(node => ({
    ...node,
    data: {
      ...node.data,
      selected: node.id === selectedId,
      highlighted: highlightedIds.has(node.id),
      dimmed: selectedId !== null && node.id !== selectedId && !highlightedIds.has(node.id),
    },
  }));
}

/**
 * Batch update edges with highlight state
 *
 * @param edges - Array of FlowEdges
 * @param highlightedEdgeIds - Set of highlighted edge IDs
 * @returns Updated FlowEdge array
 */
export function updateEdgesState(
  edges: FlowEdge[],
  highlightedEdgeIds: Set<string>
): FlowEdge[] {
  return edges.map(edge => ({
    ...edge,
    data: {
      ...edge.data,
      highlighted: highlightedEdgeIds.has(edge.id),
    } as CustomEdgeData,
  }));
}

// ============================================================================
// Reverse Transformers (FlowNode -> GraphNode)
// ============================================================================

/**
 * Extract GraphNode from FlowNode
 * Useful for API updates or exporting
 *
 * @param flowNode - React Flow node
 * @returns GraphNode suitable for API
 */
export function flowNodeToGraphNode(flowNode: FlowNode): GraphNode {
  return {
    id: flowNode.data.id,
    name: flowNode.data.name,
    type: flowNode.data.type,
    location: flowNode.data.location,
    metadata: flowNode.data.metadata,
  };
}

/**
 * Extract GraphNodes from FlowNodes array
 *
 * @param flowNodes - Array of React Flow nodes
 * @returns Array of GraphNodes
 */
export function flowNodesToGraphNodes(flowNodes: FlowNode[]): GraphNode[] {
  return flowNodes.map(flowNodeToGraphNode);
}

/**
 * Extract GraphEdge from FlowEdge
 *
 * @param flowEdge - React Flow edge
 * @returns GraphEdge suitable for API
 */
export function flowEdgeToGraphEdge(flowEdge: FlowEdge): GraphEdge {
  return {
    id: flowEdge.id,
    sourceNodeId: flowEdge.source,
    targetNodeId: flowEdge.target,
    type: flowEdge.data?.type ?? 'DEPENDS_ON',
    confidence: flowEdge.data?.confidence ?? 1,
  };
}

/**
 * Extract GraphEdges from FlowEdges array
 *
 * @param flowEdges - Array of React Flow edges
 * @returns Array of GraphEdges
 */
export function flowEdgesToGraphEdges(flowEdges: FlowEdge[]): GraphEdge[] {
  return flowEdges.map(flowEdgeToGraphEdge);
}

// ============================================================================
// Utility Transformers
// ============================================================================

/**
 * Create a node ID to FlowNode lookup map
 *
 * @param nodes - Array of FlowNodes
 * @returns Map from node ID to FlowNode
 */
export function createNodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
  return new Map(nodes.map(node => [node.id, node]));
}

/**
 * Create an edge lookup by source and target
 *
 * @param edges - Array of FlowEdges
 * @returns Map from "source->target" to FlowEdge
 */
export function createEdgeMap(edges: FlowEdge[]): Map<string, FlowEdge> {
  return new Map(edges.map(edge => [`${edge.source}->${edge.target}`, edge]));
}

/**
 * Get edges connected to a specific node
 *
 * @param nodeId - Node ID to find connections for
 * @param edges - Array of FlowEdges
 * @returns Object with incoming and outgoing edges
 */
export function getConnectedEdges(
  nodeId: string,
  edges: FlowEdge[]
): { incoming: FlowEdge[]; outgoing: FlowEdge[] } {
  const incoming: FlowEdge[] = [];
  const outgoing: FlowEdge[] = [];

  for (const edge of edges) {
    if (edge.target === nodeId) {
      incoming.push(edge);
    }
    if (edge.source === nodeId) {
      outgoing.push(edge);
    }
  }

  return { incoming, outgoing };
}
