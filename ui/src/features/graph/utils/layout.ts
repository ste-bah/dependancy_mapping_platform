/**
 * Graph Layout Algorithm
 * Dagre-based layout calculation for graph visualization
 * @module features/graph/utils/layout
 */

import dagre from 'dagre';
import type { GraphNode, GraphEdge, FlowNode, FlowEdge, CustomNodeData, CustomEdgeData } from '../types';
import { DEFAULT_LAYOUT_OPTIONS, type LayoutOptions, type LayoutDirection } from './constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Layout result containing positioned nodes and edges
 */
export interface LayoutResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  width: number;
  height: number;
}

/**
 * Graph bounds for viewport calculation
 */
export interface GraphBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

// ============================================================================
// Layout Algorithm
// ============================================================================

/**
 * Calculate layout positions for graph nodes using dagre algorithm
 *
 * @param nodes - Array of graph nodes from API
 * @param edges - Array of graph edges from API
 * @param options - Layout configuration options
 * @returns Layout result with positioned FlowNode and FlowEdge arrays
 *
 * @example
 * ```ts
 * const { nodes, edges } = calculateLayout(graphNodes, graphEdges, {
 *   direction: 'LR',
 *   horizontalSpacing: 100,
 * });
 * ```
 */
export function calculateLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: Partial<LayoutOptions> = {}
): LayoutResult {
  // Handle empty graph
  if (nodes.length === 0) {
    return { nodes: [], edges: [], width: 0, height: 0 };
  }

  // Merge with defaults
  const opts: LayoutOptions = { ...DEFAULT_LAYOUT_OPTIONS, ...options };

  // Create dagre graph
  const g = new dagre.graphlib.Graph();

  // Configure graph
  g.setGraph({
    rankdir: opts.direction,
    nodesep: opts.horizontalSpacing,
    ranksep: opts.verticalSpacing,
    marginx: opts.marginX,
    marginy: opts.marginY,
    ranker: opts.ranker,
    acyclicer: opts.acyclicer,
    align: opts.align,
  });

  // Default edge label
  g.setDefaultEdgeLabel(() => ({}));

  // Create node ID set for validation
  const nodeIdSet = new Set(nodes.map(n => n.id));

  // Add nodes to graph
  for (const node of nodes) {
    g.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
      ...node,
    });
  }

  // Add edges to graph (only for nodes that exist)
  for (const edge of edges) {
    if (nodeIdSet.has(edge.sourceNodeId) && nodeIdSet.has(edge.targetNodeId)) {
      g.setEdge(edge.sourceNodeId, edge.targetNodeId, {
        ...edge,
      });
    }
  }

  // Run layout algorithm
  dagre.layout(g);

  // Extract positioned nodes
  const layoutedNodes: FlowNode[] = nodes.map(node => {
    const dagreNode = g.node(node.id);

    // Build node data conforming to CustomNodeData
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
      position: {
        // Dagre positions nodes at center, React Flow uses top-left
        x: dagreNode.x - opts.nodeWidth / 2,
        y: dagreNode.y - opts.nodeHeight / 2,
      },
      data: nodeData,
    } as FlowNode;
  });

  // Extract edges with proper typing
  const layoutedEdges: FlowEdge[] = edges
    .filter(edge => nodeIdSet.has(edge.sourceNodeId) && nodeIdSet.has(edge.targetNodeId))
    .map(edge => {
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
        animated: edge.type === 'DEPENDS_ON',
        data: edgeData,
      } as FlowEdge;
    });

  // Calculate graph dimensions
  const graphInfo = g.graph();
  const width = graphInfo?.width ?? 0;
  const height = graphInfo?.height ?? 0;

  return {
    nodes: layoutedNodes,
    edges: layoutedEdges,
    width,
    height,
  };
}

/**
 * Calculate the bounding box of positioned nodes
 *
 * @param nodes - Array of positioned FlowNode elements
 * @param padding - Optional padding around bounds
 * @returns Graph bounds object
 */
export function calculateGraphBounds(
  nodes: FlowNode[],
  padding: number = 0
): GraphBounds {
  if (nodes.length === 0) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 };
  }

  const nodeWidth = DEFAULT_LAYOUT_OPTIONS.nodeWidth;
  const nodeHeight = DEFAULT_LAYOUT_OPTIONS.nodeHeight;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const x = node.position.x;
    const y = node.position.y;

    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x + nodeWidth);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y + nodeHeight);
  }

  // Apply padding
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Get optimal layout direction based on graph shape
 *
 * @param nodes - Graph nodes
 * @param edges - Graph edges
 * @returns Recommended layout direction
 */
export function getOptimalDirection(
  nodes: GraphNode[],
  edges: GraphEdge[]
): LayoutDirection {
  if (nodes.length === 0) {
    return 'TB';
  }

  // Build adjacency information
  const outDegree = new Map<string, number>();
  const inDegree = new Map<string, number>();

  for (const node of nodes) {
    outDegree.set(node.id, 0);
    inDegree.set(node.id, 0);
  }

  for (const edge of edges) {
    outDegree.set(edge.sourceNodeId, (outDegree.get(edge.sourceNodeId) ?? 0) + 1);
    inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  // Count roots (no incoming) and leaves (no outgoing)
  let roots = 0;
  let leaves = 0;

  for (const node of nodes) {
    if (inDegree.get(node.id) === 0) roots++;
    if (outDegree.get(node.id) === 0) leaves++;
  }

  // If more roots than leaves, suggest LR (dependency flow)
  // If more leaves than roots, suggest TB (hierarchical)
  const ratio = roots / Math.max(leaves, 1);

  if (ratio > 1.5) {
    return 'LR';
  }

  return 'TB';
}

/**
 * Re-layout a subset of nodes while preserving others
 *
 * @param allNodes - All current FlowNodes
 * @param allEdges - All current FlowEdges
 * @param nodesToLayout - IDs of nodes to recalculate positions for
 * @param options - Layout options
 * @returns Updated FlowNode array with new positions for specified nodes
 */
export function relayoutSubgraph(
  allNodes: FlowNode[],
  allEdges: FlowEdge[],
  nodesToLayout: Set<string>,
  options: Partial<LayoutOptions> = {}
): FlowNode[] {
  if (nodesToLayout.size === 0) {
    return allNodes;
  }

  // Separate nodes to layout from fixed nodes
  const fixedNodes = allNodes.filter(n => !nodesToLayout.has(n.id));
  const subgraphNodes = allNodes.filter(n => nodesToLayout.has(n.id));

  // Get edges within subgraph
  const subgraphEdges = allEdges.filter(
    e => nodesToLayout.has(e.source) && nodesToLayout.has(e.target)
  );

  // Convert FlowNodes back to GraphNodes for layout
  const graphNodes: GraphNode[] = subgraphNodes.map(n => ({
    id: n.data.id,
    name: n.data.name,
    type: n.data.type,
    location: n.data.location,
    metadata: n.data.metadata,
  }));

  // Convert FlowEdges back to GraphEdges
  const graphEdges: GraphEdge[] = subgraphEdges.map(e => ({
    id: e.id,
    sourceNodeId: e.source,
    targetNodeId: e.target,
    type: e.data?.type ?? 'DEPENDS_ON',
    confidence: e.data?.confidence ?? 1,
  }));

  // Calculate layout for subgraph
  const { nodes: layoutedSubgraph } = calculateLayout(graphNodes, graphEdges, options);

  // Calculate offset to position subgraph near fixed nodes
  const fixedBounds = calculateGraphBounds(fixedNodes);
  const subgraphBounds = calculateGraphBounds(layoutedSubgraph);

  // Position subgraph to the right of fixed nodes
  const offsetX = fixedBounds.maxX + 100 - subgraphBounds.minX;
  const offsetY = fixedBounds.minY - subgraphBounds.minY;

  // Apply offset to subgraph nodes
  const offsetSubgraph = layoutedSubgraph.map(node => ({
    ...node,
    position: {
      x: node.position.x + offsetX,
      y: node.position.y + offsetY,
    },
  }));

  // Merge back together
  return [...fixedNodes, ...offsetSubgraph];
}

/**
 * Check if graph has cycles (useful for layout decisions)
 *
 * @param nodes - Graph nodes
 * @param edges - Graph edges
 * @returns True if graph contains cycles
 */
export function hasCycles(nodes: GraphNode[], edges: GraphEdge[]): boolean {
  const nodeIds = new Set(nodes.map(n => n.id));
  const adjacency = new Map<string, string[]>();

  // Build adjacency list
  for (const nodeId of nodeIds) {
    adjacency.set(nodeId, []);
  }

  for (const edge of edges) {
    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    }
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(nodeId: string): boolean {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visited.add(nodeId);
    inStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (dfs(neighbor)) return true;
    }

    inStack.delete(nodeId);
    return false;
  }

  for (const nodeId of nodeIds) {
    if (dfs(nodeId)) return true;
  }

  return false;
}
