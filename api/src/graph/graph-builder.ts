/**
 * Graph Builder Implementation
 * @module graph/graph-builder
 *
 * Constructs and manages dependency graphs from detected nodes and edges.
 * Implements the graph builder from Phase 3 architecture design.
 *
 * Performance optimizations:
 * - Tarjan's algorithm for O(V+E) cycle detection
 * - Adjacency list representation for sparse graphs
 * - Incremental graph updates
 *
 * TASK-DETECT-010: Graph builder for IaC dependency detection
 */

import {
  NodeType,
  GraphEdge,
  EdgeType,
  DependencyGraph,
  GraphMetadata,
  NodeLocation,
  EdgeMetadata,
} from '../types/graph';

// Performance optimization: Import optimized algorithms
import {
  tarjanSCC,
  findCyclesTarjan,
  topologicalSort,
  findReachableNodes,
  findNodesThatReach,
  type CycleInfo,
} from '../optimization/algorithms.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Graph builder options
 */
export interface GraphBuilderOptions {
  /** Unique identifier for the graph */
  readonly graphId?: string;
  /** Enable validation during build */
  readonly validateOnAdd: boolean;
  /** Allow duplicate edges */
  readonly allowDuplicateEdges: boolean;
  /** Auto-generate edge IDs */
  readonly autoGenerateEdgeIds: boolean;
  /** Track build metrics */
  readonly trackMetrics: boolean;
}

/**
 * Default graph builder options
 */
const DEFAULT_BUILDER_OPTIONS: GraphBuilderOptions = {
  validateOnAdd: true,
  allowDuplicateEdges: false,
  autoGenerateEdgeIds: true,
  trackMetrics: true,
};

/**
 * Merge options for combining graphs
 */
export interface MergeOptions {
  /** How to handle node conflicts */
  readonly nodeConflictStrategy: 'keep-first' | 'keep-last' | 'merge' | 'error';
  /** How to handle edge conflicts */
  readonly edgeConflictStrategy: 'keep-first' | 'keep-last' | 'keep-both' | 'error';
  /** Prefix to add to merged node IDs */
  readonly nodeIdPrefix?: string;
  /** Prefix to add to merged edge IDs */
  readonly edgeIdPrefix?: string;
}

/**
 * Default merge options
 */
const DEFAULT_MERGE_OPTIONS: MergeOptions = {
  nodeConflictStrategy: 'keep-last',
  edgeConflictStrategy: 'keep-both',
};

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether the graph is valid */
  readonly isValid: boolean;
  /** Validation errors */
  readonly errors: ValidationError[];
  /** Validation warnings */
  readonly warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  readonly code: string;
  readonly message: string;
  readonly nodeId?: string;
  readonly edgeId?: string;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Graph builder interface
 */
export interface IGraphBuilder {
  /**
   * Add a node to the graph
   */
  addNode(node: NodeType): void;

  /**
   * Add multiple nodes to the graph
   */
  addNodes(nodes: NodeType[]): void;

  /**
   * Add an edge to the graph
   */
  addEdge(edge: GraphEdge): void;

  /**
   * Add an edge by source/target IDs
   */
  addEdgeByIds(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    metadata?: Partial<EdgeMetadata>
  ): GraphEdge;

  /**
   * Add multiple edges to the graph
   */
  addEdges(edges: GraphEdge[]): void;

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean;

  /**
   * Check if an edge exists
   */
  hasEdge(sourceId: string, targetId: string, type?: EdgeType): boolean;

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): NodeType | undefined;

  /**
   * Get all nodes
   */
  getNodes(): NodeType[];

  /**
   * Get all edges
   */
  getEdges(): GraphEdge[];

  /**
   * Get edges from a node
   */
  getOutgoingEdges(nodeId: string): GraphEdge[];

  /**
   * Get edges to a node
   */
  getIncomingEdges(nodeId: string): GraphEdge[];

  /**
   * Remove a node and its edges
   */
  removeNode(nodeId: string): boolean;

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): boolean;

  /**
   * Build the final graph
   */
  build(): DependencyGraph;

  /**
   * Clear all nodes and edges
   */
  clear(): void;
}

/**
 * Graph merger interface
 */
export interface IGraphMerger {
  /**
   * Merge multiple graphs into one
   */
  merge(graphs: DependencyGraph[], options?: Partial<MergeOptions>): DependencyGraph;
}

/**
 * Graph validator interface
 */
export interface IGraphValidator {
  /**
   * Validate a graph
   */
  validate(graph: DependencyGraph): ValidationResult;

  /**
   * Check for cycles in the graph
   */
  hasCycles(graph: DependencyGraph): boolean;

  /**
   * Find orphan nodes (no edges)
   */
  findOrphanNodes(graph: DependencyGraph): string[];

  /**
   * Find unreachable nodes from a starting point
   */
  findUnreachableNodes(graph: DependencyGraph, startNodeId: string): string[];
}

// ============================================================================
// Graph Builder Implementation
// ============================================================================

/**
 * Builder for constructing dependency graphs
 */
export class GraphBuilder implements IGraphBuilder {
  private readonly nodes: Map<string, NodeType> = new Map();
  private readonly edges: GraphEdge[] = [];
  private readonly edgeIndex: Map<string, GraphEdge> = new Map();
  private readonly outgoingIndex: Map<string, GraphEdge[]> = new Map();
  private readonly incomingIndex: Map<string, GraphEdge[]> = new Map();

  private readonly options: GraphBuilderOptions;
  private readonly graphId: string;
  private readonly startTime: number;
  private edgeCounter: number = 0;

  constructor(options: Partial<GraphBuilderOptions> = {}) {
    this.options = { ...DEFAULT_BUILDER_OPTIONS, ...options };
    this.graphId = this.options.graphId ?? `graph-${Date.now()}`;
    this.startTime = performance.now();
  }

  /**
   * Add a node to the graph
   */
  addNode(node: NodeType): void {
    if (this.options.validateOnAdd) {
      this.validateNode(node);
    }
    this.nodes.set(node.id, node);
  }

  /**
   * Add multiple nodes to the graph
   */
  addNodes(nodes: NodeType[]): void {
    for (const node of nodes) {
      this.addNode(node);
    }
  }

  /**
   * Add an edge to the graph
   */
  addEdge(edge: GraphEdge): void {
    if (this.options.validateOnAdd) {
      this.validateEdge(edge);
    }

    // Check for duplicates
    if (!this.options.allowDuplicateEdges) {
      const existing = this.findEdge(edge.source, edge.target, edge.type);
      if (existing) {
        return; // Skip duplicate
      }
    }

    this.edges.push(edge);
    this.edgeIndex.set(edge.id, edge);
    this.addToOutgoingIndex(edge);
    this.addToIncomingIndex(edge);
  }

  /**
   * Add an edge by source/target IDs
   */
  addEdgeByIds(
    sourceId: string,
    targetId: string,
    type: EdgeType,
    metadata: Partial<EdgeMetadata> = {}
  ): GraphEdge {
    const edge: GraphEdge = {
      id: this.generateEdgeId(sourceId, targetId, type),
      source: sourceId,
      target: targetId,
      type,
      metadata: {
        implicit: false,
        confidence: 100,
        ...metadata,
      },
    };

    this.addEdge(edge);
    return edge;
  }

  /**
   * Add multiple edges to the graph
   */
  addEdges(edges: GraphEdge[]): void {
    for (const edge of edges) {
      this.addEdge(edge);
    }
  }

  /**
   * Check if a node exists
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Check if an edge exists
   */
  hasEdge(sourceId: string, targetId: string, type?: EdgeType): boolean {
    return this.findEdge(sourceId, targetId, type) !== undefined;
  }

  /**
   * Get a node by ID
   */
  getNode(nodeId: string): NodeType | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get all nodes
   */
  getNodes(): NodeType[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get all edges
   */
  getEdges(): GraphEdge[] {
    return [...this.edges];
  }

  /**
   * Get edges from a node
   */
  getOutgoingEdges(nodeId: string): GraphEdge[] {
    return this.outgoingIndex.get(nodeId) ?? [];
  }

  /**
   * Get edges to a node
   */
  getIncomingEdges(nodeId: string): GraphEdge[] {
    return this.incomingIndex.get(nodeId) ?? [];
  }

  /**
   * Remove a node and its edges
   */
  removeNode(nodeId: string): boolean {
    if (!this.nodes.has(nodeId)) {
      return false;
    }

    // Remove related edges
    const edgesToRemove = [
      ...this.getOutgoingEdges(nodeId),
      ...this.getIncomingEdges(nodeId),
    ];

    for (const edge of edgesToRemove) {
      this.removeEdge(edge.id);
    }

    this.nodes.delete(nodeId);
    return true;
  }

  /**
   * Remove an edge
   */
  removeEdge(edgeId: string): boolean {
    const edge = this.edgeIndex.get(edgeId);
    if (!edge) {
      return false;
    }

    // Remove from main array
    const index = this.edges.findIndex(e => e.id === edgeId);
    if (index !== -1) {
      this.edges.splice(index, 1);
    }

    // Remove from indices
    this.edgeIndex.delete(edgeId);
    this.removeFromOutgoingIndex(edge);
    this.removeFromIncomingIndex(edge);

    return true;
  }

  /**
   * Build the final graph
   */
  build(): DependencyGraph {
    const metadata = this.createMetadata();

    return {
      id: this.graphId,
      nodes: new Map(this.nodes),
      edges: [...this.edges],
      metadata,
    };
  }

  /**
   * Clear all nodes and edges
   */
  clear(): void {
    this.nodes.clear();
    this.edges.length = 0;
    this.edgeIndex.clear();
    this.outgoingIndex.clear();
    this.incomingIndex.clear();
    this.edgeCounter = 0;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private validateNode(node: NodeType): void {
    if (!node.id) {
      throw new Error('Node must have an id');
    }
    if (!node.type) {
      throw new Error('Node must have a type');
    }
  }

  private validateEdge(edge: GraphEdge): void {
    if (!edge.id) {
      throw new Error('Edge must have an id');
    }
    if (!edge.source) {
      throw new Error('Edge must have a source');
    }
    if (!edge.target) {
      throw new Error('Edge must have a target');
    }
    if (!edge.type) {
      throw new Error('Edge must have a type');
    }

    // Validate source and target exist (if validateOnAdd is enabled)
    if (this.options.validateOnAdd) {
      if (!this.nodes.has(edge.source)) {
        throw new Error(`Source node not found: ${edge.source}`);
      }
      if (!this.nodes.has(edge.target)) {
        throw new Error(`Target node not found: ${edge.target}`);
      }
    }
  }

  private findEdge(sourceId: string, targetId: string, type?: EdgeType): GraphEdge | undefined {
    const outgoing = this.outgoingIndex.get(sourceId) ?? [];
    return outgoing.find(e =>
      e.target === targetId && (type === undefined || e.type === type)
    );
  }

  private generateEdgeId(sourceId: string, targetId: string, type: EdgeType): string {
    if (this.options.autoGenerateEdgeIds) {
      return `${sourceId}->${targetId}:${type}:${++this.edgeCounter}`;
    }
    return `${sourceId}->${targetId}:${type}`;
  }

  private addToOutgoingIndex(edge: GraphEdge): void {
    const existing = this.outgoingIndex.get(edge.source) ?? [];
    existing.push(edge);
    this.outgoingIndex.set(edge.source, existing);
  }

  private addToIncomingIndex(edge: GraphEdge): void {
    const existing = this.incomingIndex.get(edge.target) ?? [];
    existing.push(edge);
    this.incomingIndex.set(edge.target, existing);
  }

  private removeFromOutgoingIndex(edge: GraphEdge): void {
    const existing = this.outgoingIndex.get(edge.source);
    if (existing) {
      const index = existing.findIndex(e => e.id === edge.id);
      if (index !== -1) {
        existing.splice(index, 1);
      }
    }
  }

  private removeFromIncomingIndex(edge: GraphEdge): void {
    const existing = this.incomingIndex.get(edge.target);
    if (existing) {
      const index = existing.findIndex(e => e.id === edge.id);
      if (index !== -1) {
        existing.splice(index, 1);
      }
    }
  }

  private createMetadata(): GraphMetadata {
    // Count nodes by type
    const nodeCounts: Record<string, number> = {};
    for (const node of this.nodes.values()) {
      nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
    }

    // Count edges by type
    const edgeCounts: Record<EdgeType, number> = {} as Record<EdgeType, number>;
    for (const edge of this.edges) {
      edgeCounts[edge.type] = (edgeCounts[edge.type] ?? 0) + 1;
    }

    // Collect unique source files
    const sourceFiles = new Set<string>();
    for (const node of this.nodes.values()) {
      if (node.location?.file) {
        sourceFiles.add(node.location.file);
      }
    }

    return {
      createdAt: new Date(),
      sourceFiles: Array.from(sourceFiles),
      nodeCounts,
      edgeCounts,
      buildTimeMs: performance.now() - this.startTime,
    };
  }
}

// ============================================================================
// Graph Merger Implementation
// ============================================================================

/**
 * Merges multiple dependency graphs
 */
export class GraphMerger implements IGraphMerger {
  /**
   * Merge multiple graphs into one
   */
  merge(graphs: DependencyGraph[], options: Partial<MergeOptions> = {}): DependencyGraph {
    const mergedOptions = { ...DEFAULT_MERGE_OPTIONS, ...options };
    const builder = new GraphBuilder({
      graphId: `merged-${Date.now()}`,
      validateOnAdd: false, // We'll validate at the end
    });

    for (let i = 0; i < graphs.length; i++) {
      const graph = graphs[i];
      const prefix = mergedOptions.nodeIdPrefix
        ? `${mergedOptions.nodeIdPrefix}${i}_`
        : '';

      // Merge nodes
      for (const [id, node] of graph.nodes) {
        const newId = prefix ? `${prefix}${id}` : id;

        if (builder.hasNode(newId)) {
          switch (mergedOptions.nodeConflictStrategy) {
            case 'keep-first':
              continue;
            case 'keep-last':
              builder.removeNode(newId);
              builder.addNode({ ...node, id: newId });
              break;
            case 'merge':
              // Merge metadata
              const existing = builder.getNode(newId)!;
              builder.removeNode(newId);
              builder.addNode({
                ...existing,
                ...node,
                id: newId,
                metadata: { ...existing.metadata, ...node.metadata },
              });
              break;
            case 'error':
              throw new Error(`Node conflict: ${newId}`);
          }
        } else {
          builder.addNode(prefix ? { ...node, id: newId } : node);
        }
      }

      // Merge edges
      for (const edge of graph.edges) {
        const newSourceId = prefix ? `${prefix}${edge.source}` : edge.source;
        const newTargetId = prefix ? `${prefix}${edge.target}` : edge.target;
        const newEdgeId = prefix
          ? `${mergedOptions.edgeIdPrefix ?? ''}${i}_${edge.id}`
          : edge.id;

        if (builder.hasEdge(newSourceId, newTargetId, edge.type)) {
          switch (mergedOptions.edgeConflictStrategy) {
            case 'keep-first':
              continue;
            case 'keep-last':
            case 'keep-both':
              builder.addEdge({
                ...edge,
                id: newEdgeId,
                source: newSourceId,
                target: newTargetId,
              });
              break;
            case 'error':
              throw new Error(`Edge conflict: ${newEdgeId}`);
          }
        } else {
          builder.addEdge({
            ...edge,
            id: newEdgeId,
            source: newSourceId,
            target: newTargetId,
          });
        }
      }
    }

    return builder.build();
  }
}

// ============================================================================
// Graph Validator Implementation
// ============================================================================

/**
 * Validates dependency graphs
 * Performance: Uses Tarjan's algorithm for O(V+E) cycle detection
 */
export class GraphValidator implements IGraphValidator {
  /**
   * Validate a graph
   */
  validate(graph: DependencyGraph): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check for dangling edges
    for (const edge of graph.edges) {
      if (!graph.nodes.has(edge.source)) {
        errors.push({
          code: 'DANGLING_SOURCE',
          message: `Edge ${edge.id} references non-existent source node: ${edge.source}`,
          edgeId: edge.id,
        });
      }
      if (!graph.nodes.has(edge.target)) {
        errors.push({
          code: 'DANGLING_TARGET',
          message: `Edge ${edge.id} references non-existent target node: ${edge.target}`,
          edgeId: edge.id,
        });
      }
    }

    // Check for self-loops
    for (const edge of graph.edges) {
      if (edge.source === edge.target) {
        warnings.push({
          code: 'SELF_LOOP',
          message: `Edge ${edge.id} is a self-loop`,
          edgeId: edge.id,
        });
      }
    }

    // Check for orphan nodes
    const orphans = this.findOrphanNodes(graph);
    for (const orphanId of orphans) {
      warnings.push({
        code: 'ORPHAN_NODE',
        message: `Node ${orphanId} has no connections`,
        nodeId: orphanId,
      });
    }

    // Check for cycles using Tarjan's algorithm (O(V+E) instead of O(V*(V+E)))
    if (this.hasCycles(graph)) {
      warnings.push({
        code: 'CYCLE_DETECTED',
        message: 'Graph contains one or more cycles',
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check for cycles in the graph using Tarjan's algorithm
   * Performance: O(V + E) time complexity
   */
  hasCycles(graph: DependencyGraph): boolean {
    // Use Tarjan's algorithm for efficient cycle detection
    const sccs = tarjanSCC(graph);
    return sccs.some(scc => scc.isCycle);
  }

  /**
   * Find all cycles in the graph using Tarjan's algorithm
   * Performance: O(V + E) time complexity
   */
  findCycles(graph: DependencyGraph): CycleInfo[] {
    return findCyclesTarjan(graph);
  }

  /**
   * Get topological ordering of the graph
   * Returns null if graph has cycles
   */
  getTopologicalOrder(graph: DependencyGraph): string[] | null {
    const result = topologicalSort(graph);
    return result.hasCycle ? null : result.sorted;
  }

  /**
   * Find orphan nodes (no edges)
   */
  findOrphanNodes(graph: DependencyGraph): string[] {
    const connectedNodes = new Set<string>();

    for (const edge of graph.edges) {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    }

    const orphans: string[] = [];
    for (const nodeId of graph.nodes.keys()) {
      if (!connectedNodes.has(nodeId)) {
        orphans.push(nodeId);
      }
    }

    return orphans;
  }

  /**
   * Find unreachable nodes from a starting point
   */
  findUnreachableNodes(graph: DependencyGraph, startNodeId: string): string[] {
    if (!graph.nodes.has(startNodeId)) {
      return Array.from(graph.nodes.keys());
    }

    const reachable = new Set<string>();
    const queue = [startNodeId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (reachable.has(current)) continue;

      reachable.add(current);

      const outgoing = graph.edges.filter(e => e.source === current);
      for (const edge of outgoing) {
        if (!reachable.has(edge.target)) {
          queue.push(edge.target);
        }
      }
    }

    const unreachable: string[] = [];
    for (const nodeId of graph.nodes.keys()) {
      if (!reachable.has(nodeId)) {
        unreachable.push(nodeId);
      }
    }

    return unreachable;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new graph builder
 */
export function createGraphBuilder(options?: Partial<GraphBuilderOptions>): IGraphBuilder {
  return new GraphBuilder(options);
}

/**
 * Create an empty dependency graph
 */
export function createEmptyGraph(id?: string): DependencyGraph {
  return {
    id: id ?? `graph-${Date.now()}`,
    nodes: new Map(),
    edges: [],
    metadata: {
      createdAt: new Date(),
      sourceFiles: [],
      nodeCounts: {},
      edgeCounts: {} as Record<EdgeType, number>,
      buildTimeMs: 0,
    },
  };
}

/**
 * Merge multiple graphs (convenience function)
 */
export function mergeGraphs(
  graphs: DependencyGraph[],
  options?: Partial<MergeOptions>
): DependencyGraph {
  const merger = new GraphMerger();
  return merger.merge(graphs, options);
}
