/**
 * Selection Service
 * Manages node/edge selection, highlighting, and path finding
 * @module features/graph/services/selectionService
 */

import type {
  FlowNode,
  FlowEdge,
  CustomNodeData,
  GraphSelectionState,
} from '../types';
import {
  updateNodesState,
  updateEdgesState,
  getConnectedNodeIds,
  getConnectedEdges,
  applyHighlighting,
  applyEdgeHighlighting,
  clearHighlighting,
  clearEdgeHighlighting,
} from '../utils';

// ============================================================================
// Types
// ============================================================================

/**
 * Selection mode
 */
export type SelectionMode = 'single' | 'multiple' | 'additive';

/**
 * Path finding result
 */
export interface PathResult {
  /** Path exists between nodes */
  exists: boolean;
  /** Node IDs in the path (ordered) */
  path: string[];
  /** Edge IDs in the path */
  edgeIds: string[];
  /** Path length (number of edges) */
  length: number;
}

/**
 * Connected nodes result
 */
export interface ConnectedNodesResult {
  /** All connected node IDs */
  nodeIds: Set<string>;
  /** Direct neighbors (1 hop) */
  directNeighbors: Set<string>;
  /** Upstream nodes (dependencies) */
  upstream: Set<string>;
  /** Downstream nodes (dependents) */
  downstream: Set<string>;
}

/**
 * Selection update result
 */
export interface SelectionUpdate {
  /** Updated nodes */
  nodes: FlowNode[];
  /** Updated edges */
  edges: FlowEdge[];
  /** Current selection state */
  state: GraphSelectionState;
}

/**
 * Selection service configuration
 */
export interface SelectionServiceConfig {
  /** Default selection mode */
  defaultMode?: SelectionMode;
  /** Maximum multi-select count */
  maxSelection?: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for managing graph selection and highlighting
 *
 * @example
 * ```ts
 * const service = new SelectionService();
 *
 * // Select a node
 * const selected = service.selectNode('node-1', nodes, edges);
 *
 * // Get connected nodes
 * const connected = service.getConnectedNodes('node-1', edges);
 *
 * // Find path between nodes
 * const path = service.findPath('node-1', 'node-5', edges);
 * ```
 */
export class SelectionService {
  private selectedNodeId: string | null = null;
  private selectedNodeIds: Set<string> = new Set();
  private highlightedNodeIds: Set<string> = new Set();
  private highlightedEdgeIds: Set<string> = new Set();
  private mode: SelectionMode;
  private maxSelection: number;

  constructor(config: SelectionServiceConfig = {}) {
    this.mode = config.defaultMode ?? 'single';
    this.maxSelection = config.maxSelection ?? 100;
  }

  // ==========================================================================
  // Selection Operations
  // ==========================================================================

  /**
   * Select a single node
   *
   * @param nodeId - Node ID to select (null to clear)
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Updated nodes and edges with selection applied
   */
  selectNode(
    nodeId: string | null,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): SelectionUpdate {
    this.selectedNodeId = nodeId;

    if (nodeId === null) {
      this.selectedNodeIds.clear();
      this.highlightedNodeIds.clear();
      this.highlightedEdgeIds.clear();
    } else {
      this.selectedNodeIds = new Set([nodeId]);

      // Highlight connected nodes
      const connected = getConnectedNodeIds(nodeId, edges, 1);
      this.highlightedNodeIds = connected;

      // Highlight connected edges
      const { incoming, outgoing } = getConnectedEdges(nodeId, edges);
      this.highlightedEdgeIds = new Set([
        ...incoming.map((e) => e.id),
        ...outgoing.map((e) => e.id),
      ]);
    }

    return this.applySelection(nodes, edges);
  }

  /**
   * Select multiple nodes
   *
   * @param nodeIds - Array of node IDs to select
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Updated nodes and edges
   */
  selectMultiple(
    nodeIds: string[],
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): SelectionUpdate {
    // Limit selection count
    const limitedIds = nodeIds.slice(0, this.maxSelection);

    this.selectedNodeIds = new Set(limitedIds);
    this.selectedNodeId = limitedIds[0] ?? null;

    // Highlight all selected nodes
    this.highlightedNodeIds = new Set(limitedIds);

    // Highlight edges between selected nodes
    this.highlightedEdgeIds = new Set();
    for (const edge of edges) {
      if (
        this.selectedNodeIds.has(edge.source) &&
        this.selectedNodeIds.has(edge.target)
      ) {
        this.highlightedEdgeIds.add(edge.id);
      }
    }

    return this.applySelection(nodes, edges);
  }

  /**
   * Toggle node selection (for additive selection)
   *
   * @param nodeId - Node ID to toggle
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Updated nodes and edges
   */
  toggleSelection(
    nodeId: string,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): SelectionUpdate {
    if (this.selectedNodeIds.has(nodeId)) {
      this.selectedNodeIds.delete(nodeId);
    } else if (this.selectedNodeIds.size < this.maxSelection) {
      this.selectedNodeIds.add(nodeId);
    }

    // Update primary selection
    this.selectedNodeId =
      this.selectedNodeIds.size > 0
        ? Array.from(this.selectedNodeIds)[0] ?? null
        : null;

    // Update highlights
    this.highlightedNodeIds = new Set(this.selectedNodeIds);

    // Update edge highlights
    this.highlightedEdgeIds = new Set();
    for (const edge of edges) {
      if (
        this.selectedNodeIds.has(edge.source) &&
        this.selectedNodeIds.has(edge.target)
      ) {
        this.highlightedEdgeIds.add(edge.id);
      }
    }

    return this.applySelection(nodes, edges);
  }

  /**
   * Clear all selections
   *
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Updated nodes and edges with cleared selection
   */
  clearSelection(nodes: FlowNode[], edges: FlowEdge[]): SelectionUpdate {
    this.selectedNodeId = null;
    this.selectedNodeIds.clear();
    this.highlightedNodeIds.clear();
    this.highlightedEdgeIds.clear();

    const clearedNodes = clearHighlighting(nodes);
    const clearedEdges = clearEdgeHighlighting(edges);

    return {
      nodes: clearedNodes,
      edges: clearedEdges,
      state: this.getState(),
    };
  }

  // ==========================================================================
  // Connected Node Operations
  // ==========================================================================

  /**
   * Get all nodes connected to a node
   *
   * @param nodeId - Node ID to find connections for
   * @param edges - All edges
   * @param maxDepth - Maximum traversal depth
   * @returns Connected nodes result
   */
  getConnectedNodes(
    nodeId: string,
    edges: FlowEdge[],
    maxDepth: number = Infinity
  ): ConnectedNodesResult {
    // Get all connected (bidirectional)
    const nodeIds = getConnectedNodeIds(nodeId, edges, maxDepth, 'both');

    // Get direct neighbors (1 hop)
    const directNeighbors = getConnectedNodeIds(nodeId, edges, 1, 'both');
    directNeighbors.delete(nodeId);

    // Get upstream (dependencies)
    const upstream = getConnectedNodeIds(nodeId, edges, maxDepth, 'outgoing');
    upstream.delete(nodeId);

    // Get downstream (dependents)
    const downstream = getConnectedNodeIds(nodeId, edges, maxDepth, 'incoming');
    downstream.delete(nodeId);

    return {
      nodeIds,
      directNeighbors,
      upstream,
      downstream,
    };
  }

  /**
   * Get edges connected to a node
   *
   * @param nodeId - Node ID
   * @param edges - All edges
   * @returns Incoming and outgoing edges
   */
  getConnectedEdges(
    nodeId: string,
    edges: FlowEdge[]
  ): { incoming: FlowEdge[]; outgoing: FlowEdge[] } {
    return getConnectedEdges(nodeId, edges);
  }

  // ==========================================================================
  // Path Finding
  // ==========================================================================

  /**
   * Find shortest path between two nodes
   *
   * @param fromId - Starting node ID
   * @param toId - Target node ID
   * @param edges - All edges
   * @returns Path result
   */
  findPath(fromId: string, toId: string, edges: FlowEdge[]): PathResult {
    if (fromId === toId) {
      return {
        exists: true,
        path: [fromId],
        edgeIds: [],
        length: 0,
      };
    }

    // BFS for shortest path
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edgeIds: string[] }> =
      [{ nodeId: fromId, path: [fromId], edgeIds: [] }];

    // Build adjacency for outgoing edges
    const adjacency = new Map<string, Array<{ target: string; edgeId: string }>>();
    for (const edge of edges) {
      const existing = adjacency.get(edge.source) ?? [];
      existing.push({ target: edge.target, edgeId: edge.id });
      adjacency.set(edge.source, existing);
    }

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === toId) {
        return {
          exists: true,
          path: current.path,
          edgeIds: current.edgeIds,
          length: current.edgeIds.length,
        };
      }

      if (visited.has(current.nodeId)) {
        continue;
      }
      visited.add(current.nodeId);

      for (const { target, edgeId } of adjacency.get(current.nodeId) ?? []) {
        if (!visited.has(target)) {
          queue.push({
            nodeId: target,
            path: [...current.path, target],
            edgeIds: [...current.edgeIds, edgeId],
          });
        }
      }
    }

    return {
      exists: false,
      path: [],
      edgeIds: [],
      length: -1,
    };
  }

  /**
   * Highlight path between two nodes
   *
   * @param fromId - Starting node ID
   * @param toId - Target node ID
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Updated nodes and edges with path highlighted
   */
  highlightPath(
    fromId: string,
    toId: string,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): SelectionUpdate {
    const pathResult = this.findPath(fromId, toId, edges);

    if (!pathResult.exists) {
      return this.clearSelection(nodes, edges);
    }

    // Set highlights
    this.selectedNodeIds = new Set([fromId, toId]);
    this.selectedNodeId = fromId;
    this.highlightedNodeIds = new Set(pathResult.path);
    this.highlightedEdgeIds = new Set(pathResult.edgeIds);

    return this.applySelection(nodes, edges);
  }

  /**
   * Find all paths between two nodes (up to a limit)
   *
   * @param fromId - Starting node ID
   * @param toId - Target node ID
   * @param edges - All edges
   * @param maxPaths - Maximum number of paths to find
   * @returns Array of path results
   */
  findAllPaths(
    fromId: string,
    toId: string,
    edges: FlowEdge[],
    maxPaths: number = 10
  ): PathResult[] {
    const paths: PathResult[] = [];

    // Build adjacency
    const adjacency = new Map<string, Array<{ target: string; edgeId: string }>>();
    for (const edge of edges) {
      const existing = adjacency.get(edge.source) ?? [];
      existing.push({ target: edge.target, edgeId: edge.id });
      adjacency.set(edge.source, existing);
    }

    // DFS to find all paths
    const dfs = (
      current: string,
      path: string[],
      edgeIds: string[],
      visited: Set<string>
    ): void => {
      if (paths.length >= maxPaths) {
        return;
      }

      if (current === toId) {
        paths.push({
          exists: true,
          path: [...path],
          edgeIds: [...edgeIds],
          length: edgeIds.length,
        });
        return;
      }

      for (const { target, edgeId } of adjacency.get(current) ?? []) {
        if (!visited.has(target)) {
          visited.add(target);
          path.push(target);
          edgeIds.push(edgeId);

          dfs(target, path, edgeIds, visited);

          path.pop();
          edgeIds.pop();
          visited.delete(target);
        }
      }
    };

    const visited = new Set<string>([fromId]);
    dfs(fromId, [fromId], [], visited);

    return paths;
  }

  // ==========================================================================
  // State Management
  // ==========================================================================

  /**
   * Get current selection state
   */
  getState(): GraphSelectionState {
    return {
      selectedNodeId: this.selectedNodeId,
      highlightedNodeIds: new Set(this.highlightedNodeIds),
      highlightedEdgeIds: new Set(this.highlightedEdgeIds),
    };
  }

  /**
   * Get selected node ID
   */
  getSelectedNodeId(): string | null {
    return this.selectedNodeId;
  }

  /**
   * Get all selected node IDs
   */
  getSelectedNodeIds(): Set<string> {
    return new Set(this.selectedNodeIds);
  }

  /**
   * Get highlighted node IDs
   */
  getHighlightedNodeIds(): Set<string> {
    return new Set(this.highlightedNodeIds);
  }

  /**
   * Get highlighted edge IDs
   */
  getHighlightedEdgeIds(): Set<string> {
    return new Set(this.highlightedEdgeIds);
  }

  /**
   * Check if a node is selected
   */
  isSelected(nodeId: string): boolean {
    return this.selectedNodeIds.has(nodeId);
  }

  /**
   * Check if a node is highlighted
   */
  isHighlighted(nodeId: string): boolean {
    return this.highlightedNodeIds.has(nodeId);
  }

  /**
   * Set selection mode
   */
  setMode(mode: SelectionMode): void {
    this.mode = mode;
  }

  /**
   * Get current selection mode
   */
  getMode(): SelectionMode {
    return this.mode;
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Apply current selection state to nodes and edges
   */
  private applySelection(
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): SelectionUpdate {
    // Update nodes
    const updatedNodes = updateNodesState(
      nodes,
      this.selectedNodeId,
      this.highlightedNodeIds
    );

    // Update edges
    const updatedEdges = updateEdgesState(edges, this.highlightedEdgeIds);

    return {
      nodes: updatedNodes,
      edges: updatedEdges,
      state: this.getState(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new SelectionService instance
 *
 * @param config - Service configuration
 * @returns SelectionService instance
 */
export function createSelectionService(
  config: SelectionServiceConfig = {}
): SelectionService {
  return new SelectionService(config);
}

export default SelectionService;
