/**
 * Layout Service
 * Manages graph layout calculations and optimization
 * @module features/graph/services/layoutService
 */

import type {
  GraphNode,
  GraphEdge,
  FlowNode,
  FlowEdge,
} from '../types';
import {
  calculateLayout,
  calculateGraphBounds,
  getOptimalDirection,
  relayoutSubgraph,
  hasCycles,
  type LayoutOptions,
  type LayoutResult,
  type GraphBounds,
  type LayoutDirection,
} from '../utils';
import {
  DEFAULT_LAYOUT_OPTIONS,
  LAYOUT_PRESETS,
} from '../utils/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Layout preset names
 */
export type LayoutPreset = keyof typeof LAYOUT_PRESETS;

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  /** Whether cycles exist in the graph */
  hasCycles: boolean;
  /** Detected cycles (arrays of node IDs forming cycles) */
  cycles: string[][];
  /** Total number of cycles detected */
  cycleCount: number;
}

/**
 * Layout optimization result
 */
export interface OptimizationResult extends LayoutResult {
  /** Applied optimizations */
  optimizations: string[];
  /** Detected issues */
  issues: string[];
  /** Recommended direction */
  recommendedDirection: LayoutDirection;
}

/**
 * Subgraph layout result
 */
export interface SubgraphLayoutResult {
  /** Updated nodes with new positions */
  nodes: FlowNode[];
  /** Offset applied to subgraph */
  offset: { x: number; y: number };
}

/**
 * Layout service configuration
 */
export interface LayoutServiceConfig {
  /** Default layout options */
  defaultOptions?: Partial<LayoutOptions>;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for managing graph layout calculations
 *
 * @example
 * ```ts
 * const service = new LayoutService();
 *
 * // Calculate layout
 * const result = service.calculateLayout(nodes, edges, { direction: 'LR' });
 *
 * // Optimize layout
 * const optimized = service.optimizeLayout(nodes, edges);
 *
 * // Detect cycles
 * const cycles = service.detectCycles(nodes, edges);
 * ```
 */
export class LayoutService {
  private defaultOptions: LayoutOptions;

  constructor(config: LayoutServiceConfig = {}) {
    this.defaultOptions = {
      ...DEFAULT_LAYOUT_OPTIONS,
      ...config.defaultOptions,
    };
  }

  // ==========================================================================
  // Layout Calculation
  // ==========================================================================

  /**
   * Calculate layout positions for graph nodes
   *
   * @param nodes - Graph nodes (raw or Flow format)
   * @param edges - Graph edges (raw or Flow format)
   * @param options - Layout configuration
   * @returns Layout result with positioned nodes
   */
  calculateLayout(
    nodes: GraphNode[] | FlowNode[],
    edges: GraphEdge[] | FlowEdge[],
    options?: Partial<LayoutOptions>
  ): LayoutResult {
    // Normalize to GraphNode/GraphEdge format
    const graphNodes = this.normalizeNodes(nodes);
    const graphEdges = this.normalizeEdges(edges);

    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };

    return calculateLayout(graphNodes, graphEdges, mergedOptions);
  }

  /**
   * Apply a layout preset
   *
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   * @param preset - Preset name
   * @returns Layout result
   */
  applyPreset(
    nodes: GraphNode[] | FlowNode[],
    edges: GraphEdge[] | FlowEdge[],
    preset: LayoutPreset
  ): LayoutResult {
    const presetOptions = LAYOUT_PRESETS[preset];
    return this.calculateLayout(nodes, edges, presetOptions);
  }

  /**
   * Calculate graph bounds from positioned nodes
   *
   * @param nodes - Positioned FlowNodes
   * @param padding - Optional padding around bounds
   * @returns Graph bounds
   */
  calculateBounds(nodes: FlowNode[], padding?: number): GraphBounds {
    return calculateGraphBounds(nodes, padding);
  }

  // ==========================================================================
  // Layout Optimization
  // ==========================================================================

  /**
   * Optimize layout with automatic direction and configuration
   *
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   * @returns Optimized layout result with metadata
   */
  optimizeLayout(
    nodes: GraphNode[] | FlowNode[],
    edges: GraphEdge[] | FlowEdge[]
  ): OptimizationResult {
    const graphNodes = this.normalizeNodes(nodes);
    const graphEdges = this.normalizeEdges(edges);

    const optimizations: string[] = [];
    const issues: string[] = [];

    // Detect optimal direction
    const recommendedDirection = getOptimalDirection(graphNodes, graphEdges);
    optimizations.push(`direction:${recommendedDirection}`);

    // Check for cycles
    if (hasCycles(graphNodes, graphEdges)) {
      issues.push('Graph contains cycles');
      optimizations.push('acyclicer:greedy');
    }

    // Determine optimal spacing based on node count
    const nodeCount = graphNodes.length;
    let horizontalSpacing = this.defaultOptions.horizontalSpacing;
    let verticalSpacing = this.defaultOptions.verticalSpacing;

    if (nodeCount > 50) {
      // Compact spacing for large graphs
      horizontalSpacing = Math.max(30, horizontalSpacing * 0.6);
      verticalSpacing = Math.max(50, verticalSpacing * 0.6);
      optimizations.push('spacing:compact');
    } else if (nodeCount > 20) {
      // Standard spacing
      optimizations.push('spacing:standard');
    } else {
      // Expanded spacing for small graphs
      horizontalSpacing *= 1.2;
      verticalSpacing *= 1.2;
      optimizations.push('spacing:expanded');
    }

    // Calculate optimized layout
    const layout = calculateLayout(graphNodes, graphEdges, {
      ...this.defaultOptions,
      direction: recommendedDirection,
      horizontalSpacing,
      verticalSpacing,
      acyclicer: hasCycles(graphNodes, graphEdges) ? 'greedy' : undefined,
    });

    return {
      ...layout,
      optimizations,
      issues,
      recommendedDirection,
    };
  }

  /**
   * Get optimal layout direction for graph shape
   *
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   * @returns Recommended layout direction
   */
  getOptimalDirection(
    nodes: GraphNode[] | FlowNode[],
    edges: GraphEdge[] | FlowEdge[]
  ): LayoutDirection {
    const graphNodes = this.normalizeNodes(nodes);
    const graphEdges = this.normalizeEdges(edges);
    return getOptimalDirection(graphNodes, graphEdges);
  }

  // ==========================================================================
  // Cycle Detection
  // ==========================================================================

  /**
   * Detect cycles in the graph
   *
   * @param nodes - Graph nodes
   * @param edges - Graph edges
   * @returns Cycle detection result
   */
  detectCycles(
    nodes: GraphNode[] | FlowNode[],
    edges: GraphEdge[] | FlowEdge[]
  ): CycleDetectionResult {
    const graphNodes = this.normalizeNodes(nodes);
    const graphEdges = this.normalizeEdges(edges);

    const cyclesExist = hasCycles(graphNodes, graphEdges);

    if (!cyclesExist) {
      return {
        hasCycles: false,
        cycles: [],
        cycleCount: 0,
      };
    }

    // Find actual cycles using Tarjan's algorithm
    const cycles = this.findAllCycles(graphNodes, graphEdges);

    return {
      hasCycles: true,
      cycles,
      cycleCount: cycles.length,
    };
  }

  /**
   * Find all strongly connected components (cycles) in the graph
   */
  private findAllCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
    const nodeIds = new Set(nodes.map((n) => n.id));
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

    // Tarjan's SCC algorithm
    const cycles: string[][] = [];
    const index = new Map<string, number>();
    const lowlink = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let currentIndex = 0;

    const strongConnect = (nodeId: string): void => {
      index.set(nodeId, currentIndex);
      lowlink.set(nodeId, currentIndex);
      currentIndex++;
      stack.push(nodeId);
      onStack.add(nodeId);

      for (const neighbor of adjacency.get(nodeId) ?? []) {
        if (!index.has(neighbor)) {
          strongConnect(neighbor);
          lowlink.set(
            nodeId,
            Math.min(lowlink.get(nodeId)!, lowlink.get(neighbor)!)
          );
        } else if (onStack.has(neighbor)) {
          lowlink.set(
            nodeId,
            Math.min(lowlink.get(nodeId)!, index.get(neighbor)!)
          );
        }
      }

      if (lowlink.get(nodeId) === index.get(nodeId)) {
        const scc: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          scc.push(w);
        } while (w !== nodeId);

        // Only report SCCs with more than one node (actual cycles)
        if (scc.length > 1) {
          cycles.push(scc.reverse());
        }
      }
    };

    for (const nodeId of nodeIds) {
      if (!index.has(nodeId)) {
        strongConnect(nodeId);
      }
    }

    return cycles;
  }

  // ==========================================================================
  // Subgraph Operations
  // ==========================================================================

  /**
   * Re-layout a subset of nodes while preserving others
   *
   * @param allNodes - All current FlowNodes
   * @param allEdges - All current FlowEdges
   * @param nodesToLayout - Set of node IDs to recalculate
   * @param options - Layout options for subgraph
   * @returns Updated node array
   */
  relayoutSubgraph(
    allNodes: FlowNode[],
    allEdges: FlowEdge[],
    nodesToLayout: Set<string>,
    options?: Partial<LayoutOptions>
  ): FlowNode[] {
    const mergedOptions = {
      ...this.defaultOptions,
      ...options,
    };
    return relayoutSubgraph(allNodes, allEdges, nodesToLayout, mergedOptions);
  }

  /**
   * Layout nodes connected to a specific node
   *
   * @param allNodes - All nodes
   * @param allEdges - All edges
   * @param centerId - Center node ID
   * @param depth - Maximum depth to include
   * @returns Updated nodes with layout applied to connected subgraph
   */
  layoutConnectedNodes(
    allNodes: FlowNode[],
    allEdges: FlowEdge[],
    centerId: string,
    depth: number = 2
  ): FlowNode[] {
    // Find connected nodes
    const connected = new Set<string>([centerId]);
    let frontier = new Set<string>([centerId]);

    for (let d = 0; d < depth; d++) {
      const nextFrontier = new Set<string>();

      for (const edge of allEdges) {
        if (frontier.has(edge.source) && !connected.has(edge.target)) {
          connected.add(edge.target);
          nextFrontier.add(edge.target);
        }
        if (frontier.has(edge.target) && !connected.has(edge.source)) {
          connected.add(edge.source);
          nextFrontier.add(edge.source);
        }
      }

      frontier = nextFrontier;
    }

    return this.relayoutSubgraph(allNodes, allEdges, connected);
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get available layout presets
   */
  getAvailablePresets(): LayoutPreset[] {
    return Object.keys(LAYOUT_PRESETS) as LayoutPreset[];
  }

  /**
   * Get preset configuration
   *
   * @param preset - Preset name
   * @returns Preset options
   */
  getPresetOptions(preset: LayoutPreset): LayoutOptions {
    return { ...LAYOUT_PRESETS[preset] };
  }

  /**
   * Get default layout options
   */
  getDefaultOptions(): LayoutOptions {
    return { ...this.defaultOptions };
  }

  /**
   * Update default options
   *
   * @param options - New default options
   */
  setDefaultOptions(options: Partial<LayoutOptions>): void {
    this.defaultOptions = {
      ...this.defaultOptions,
      ...options,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Normalize nodes to GraphNode format
   */
  private normalizeNodes(nodes: GraphNode[] | FlowNode[]): GraphNode[] {
    if (nodes.length === 0) {
      return [];
    }

    // Check if already GraphNode format
    const first = nodes[0];
    if ('name' in first && 'type' in first && !('position' in first)) {
      return nodes as GraphNode[];
    }

    // Convert from FlowNode
    return (nodes as FlowNode[]).map((node) => ({
      id: node.data.id ?? node.id,
      name: node.data.name,
      type: node.data.type,
      location: node.data.location,
      metadata: node.data.metadata,
    }));
  }

  /**
   * Normalize edges to GraphEdge format
   */
  private normalizeEdges(edges: GraphEdge[] | FlowEdge[]): GraphEdge[] {
    if (edges.length === 0) {
      return [];
    }

    // Check if already GraphEdge format
    const first = edges[0];
    if ('sourceNodeId' in first) {
      return edges as GraphEdge[];
    }

    // Convert from FlowEdge
    return (edges as FlowEdge[]).map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source,
      targetNodeId: edge.target,
      type: edge.data?.type ?? 'DEPENDS_ON',
      confidence: edge.data?.confidence ?? 1,
    }));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new LayoutService instance
 *
 * @param config - Service configuration
 * @returns LayoutService instance
 */
export function createLayoutService(
  config: LayoutServiceConfig = {}
): LayoutService {
  return new LayoutService(config);
}

export default LayoutService;
