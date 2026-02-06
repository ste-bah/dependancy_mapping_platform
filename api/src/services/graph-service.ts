/**
 * Graph Service
 * @module services/graph-service
 *
 * Provides graph operations including building, querying, traversal,
 * cycle detection, and subgraph extraction.
 *
 * TASK-DETECT-010: Graph service for IaC dependency detection
 */

import pino from 'pino';
import {
  DependencyGraph,
  NodeType,
  GraphEdge,
  EdgeType,
  GraphMetadata,
  NodeLocation,
} from '../types/graph.js';
import {
  GraphBuilder,
  GraphMerger,
  GraphValidator,
  IGraphBuilder,
  IGraphValidator,
  ValidationResult,
  createGraphBuilder,
  createEmptyGraph,
} from '../graph/graph-builder.js';

const logger = pino({ name: 'graph-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * Graph service configuration
 */
export interface GraphServiceConfig {
  /** Enable validation during build */
  readonly validateOnBuild: boolean;
  /** Maximum graph size (nodes) */
  readonly maxNodes: number;
  /** Maximum edges per node */
  readonly maxEdgesPerNode: number;
  /** Enable caching of traversal results */
  readonly enableTraversalCache: boolean;
  /** Cache TTL in milliseconds */
  readonly cacheTtlMs: number;
}

/**
 * Default graph service configuration
 */
export const DEFAULT_GRAPH_SERVICE_CONFIG: GraphServiceConfig = {
  validateOnBuild: true,
  maxNodes: 10000,
  maxEdgesPerNode: 100,
  enableTraversalCache: true,
  cacheTtlMs: 60000,
};

/**
 * Build graph input
 */
export interface BuildGraphInput {
  /** Nodes to add */
  readonly nodes: NodeType[];
  /** Edges to add */
  readonly edges: GraphEdge[];
  /** Graph metadata */
  readonly metadata?: Partial<{
    scanId: string;
    repositoryId: string;
    ref: string;
    commitSha: string;
  }>;
}

/**
 * Traversal options
 */
export interface TraversalOptions {
  /** Maximum traversal depth */
  readonly maxDepth: number;
  /** Edge types to follow */
  readonly edgeTypes?: EdgeType[];
  /** Include the starting node in results */
  readonly includeStart: boolean;
  /** Traversal direction */
  readonly direction: 'upstream' | 'downstream' | 'both';
}

/**
 * Default traversal options
 */
export const DEFAULT_TRAVERSAL_OPTIONS: TraversalOptions = {
  maxDepth: 10,
  includeStart: true,
  direction: 'downstream',
};

/**
 * Traversal result
 */
export interface TraversalResult {
  /** Visited nodes */
  readonly nodes: NodeType[];
  /** Traversed edges */
  readonly edges: GraphEdge[];
  /** Path information */
  readonly paths: TraversalPath[];
  /** Statistics */
  readonly stats: TraversalStats;
}

/**
 * Traversal path
 */
export interface TraversalPath {
  /** Start node ID */
  readonly startNodeId: string;
  /** End node ID */
  readonly endNodeId: string;
  /** Node IDs in path */
  readonly nodeIds: string[];
  /** Edge IDs in path */
  readonly edgeIds: string[];
  /** Path length */
  readonly length: number;
}

/**
 * Traversal statistics
 */
export interface TraversalStats {
  /** Total nodes visited */
  readonly nodesVisited: number;
  /** Total edges traversed */
  readonly edgesTraversed: number;
  /** Maximum depth reached */
  readonly maxDepthReached: number;
  /** Traversal time in milliseconds */
  readonly traversalTimeMs: number;
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  /** Whether cycles exist */
  readonly hasCycles: boolean;
  /** Detected cycles */
  readonly cycles: DetectedCycle[];
  /** Statistics */
  readonly stats: CycleDetectionStats;
}

/**
 * Detected cycle
 */
export interface DetectedCycle {
  /** Node IDs in the cycle */
  readonly nodeIds: string[];
  /** Edge IDs in the cycle */
  readonly edgeIds: string[];
  /** Cycle length */
  readonly length: number;
}

/**
 * Cycle detection statistics
 */
export interface CycleDetectionStats {
  /** Number of cycles found */
  readonly cyclesFound: number;
  /** Nodes involved in cycles */
  readonly nodesInCycles: number;
  /** Detection time in milliseconds */
  readonly detectionTimeMs: number;
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  /** Directly impacted nodes */
  readonly directImpact: NodeType[];
  /** Transitively impacted nodes */
  readonly transitiveImpact: NodeType[];
  /** Impact paths */
  readonly impactPaths: TraversalPath[];
  /** Impact summary */
  readonly summary: ImpactSummary;
}

/**
 * Impact summary
 */
export interface ImpactSummary {
  /** Total impacted nodes */
  readonly totalImpacted: number;
  /** Impact by node type */
  readonly impactByType: Record<string, number>;
  /** Impact by depth */
  readonly impactByDepth: Record<number, number>;
  /** Risk assessment */
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Subgraph extraction options
 */
export interface SubgraphOptions {
  /** Node IDs to include */
  readonly nodeIds?: string[];
  /** Node types to include */
  readonly nodeTypes?: string[];
  /** Edge types to include */
  readonly edgeTypes?: EdgeType[];
  /** Include connected nodes */
  readonly includeConnected: boolean;
  /** Maximum distance for connected nodes */
  readonly maxDistance: number;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Graph service interface
 */
export interface IGraphService {
  /**
   * Build a dependency graph from nodes and edges
   */
  buildGraph(input: BuildGraphInput): Promise<DependencyGraph>;

  /**
   * Validate a graph
   */
  validateGraph(graph: DependencyGraph): Promise<ValidationResult>;

  /**
   * Get downstream dependencies (nodes that depend on the given node)
   */
  getDownstream(
    graph: DependencyGraph,
    nodeId: string,
    options?: Partial<TraversalOptions>
  ): TraversalResult;

  /**
   * Get upstream dependencies (nodes that the given node depends on)
   */
  getUpstream(
    graph: DependencyGraph,
    nodeId: string,
    options?: Partial<TraversalOptions>
  ): TraversalResult;

  /**
   * Detect cycles in the graph
   */
  detectCycles(graph: DependencyGraph): CycleDetectionResult;

  /**
   * Analyze impact of changing a node
   */
  analyzeImpact(
    graph: DependencyGraph,
    nodeIds: string[]
  ): ImpactAnalysisResult;

  /**
   * Extract a subgraph
   */
  extractSubgraph(
    graph: DependencyGraph,
    options: SubgraphOptions
  ): DependencyGraph;

  /**
   * Merge multiple graphs
   */
  mergeGraphs(graphs: DependencyGraph[]): DependencyGraph;

  /**
   * Get the shortest path between two nodes
   */
  getShortestPath(
    graph: DependencyGraph,
    sourceId: string,
    targetId: string
  ): TraversalPath | null;

  /**
   * Get graph statistics
   */
  getGraphStats(graph: DependencyGraph): GraphStats;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  /** Total node count */
  readonly nodeCount: number;
  /** Total edge count */
  readonly edgeCount: number;
  /** Nodes by type */
  readonly nodesByType: Record<string, number>;
  /** Edges by type */
  readonly edgesByType: Record<string, number>;
  /** Average edges per node */
  readonly avgEdgesPerNode: number;
  /** Maximum in-degree */
  readonly maxInDegree: number;
  /** Maximum out-degree */
  readonly maxOutDegree: number;
  /** Number of orphan nodes */
  readonly orphanNodes: number;
  /** Graph density */
  readonly density: number;
}

// ============================================================================
// Graph Service Implementation
// ============================================================================

/**
 * Graph service for dependency graph operations
 */
export class GraphService implements IGraphService {
  private readonly config: GraphServiceConfig;
  private readonly validator: IGraphValidator;
  private readonly merger: GraphMerger;

  constructor(config: Partial<GraphServiceConfig> = {}) {
    this.config = { ...DEFAULT_GRAPH_SERVICE_CONFIG, ...config };
    this.validator = new GraphValidator();
    this.merger = new GraphMerger();
  }

  /**
   * Build a dependency graph from nodes and edges
   */
  async buildGraph(input: BuildGraphInput): Promise<DependencyGraph> {
    const startTime = Date.now();
    const { nodes, edges, metadata } = input;

    logger.info(
      { nodeCount: nodes.length, edgeCount: edges.length },
      'Building dependency graph'
    );

    // Validate size limits
    if (nodes.length > this.config.maxNodes) {
      throw new Error(`Graph exceeds maximum node count: ${nodes.length} > ${this.config.maxNodes}`);
    }

    const builder = createGraphBuilder({
      graphId: metadata?.scanId ?? `graph-${Date.now()}`,
      validateOnAdd: false, // We'll validate at the end
    });

    // Add nodes
    builder.addNodes(nodes);

    // Filter and add edges
    const validEdges = edges.filter(edge => {
      const hasSource = builder.hasNode(edge.source);
      const hasTarget = builder.hasNode(edge.target);

      if (!hasSource || !hasTarget) {
        logger.warn(
          { edgeId: edge.id, source: edge.source, target: edge.target },
          'Skipping edge with missing node'
        );
        return false;
      }

      return true;
    });

    builder.addEdges(validEdges);

    const graph = builder.build();

    // Validate if enabled
    if (this.config.validateOnBuild) {
      const validation = this.validator.validate(graph);

      if (!validation.isValid) {
        logger.warn(
          { errors: validation.errors.length },
          'Graph validation failed'
        );
      }

      for (const warning of validation.warnings) {
        logger.debug({ warning: warning.message }, 'Graph validation warning');
      }
    }

    logger.info(
      {
        nodeCount: graph.nodes.size,
        edgeCount: graph.edges.length,
        buildTimeMs: Date.now() - startTime,
      },
      'Graph built successfully'
    );

    return graph;
  }

  /**
   * Validate a graph
   */
  async validateGraph(graph: DependencyGraph): Promise<ValidationResult> {
    return this.validator.validate(graph);
  }

  /**
   * Get downstream dependencies
   */
  getDownstream(
    graph: DependencyGraph,
    nodeId: string,
    options: Partial<TraversalOptions> = {}
  ): TraversalResult {
    const opts = { ...DEFAULT_TRAVERSAL_OPTIONS, ...options, direction: 'downstream' as const };
    return this.traverse(graph, nodeId, opts);
  }

  /**
   * Get upstream dependencies
   */
  getUpstream(
    graph: DependencyGraph,
    nodeId: string,
    options: Partial<TraversalOptions> = {}
  ): TraversalResult {
    const opts = { ...DEFAULT_TRAVERSAL_OPTIONS, ...options, direction: 'upstream' as const };
    return this.traverse(graph, nodeId, opts);
  }

  /**
   * Detect cycles in the graph
   */
  detectCycles(graph: DependencyGraph): CycleDetectionResult {
    const startTime = Date.now();
    const cycles: DetectedCycle[] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const nodesInCycles = new Set<string>();

    // Helper to find cycles from a starting node
    const findCyclesFrom = (nodeId: string, path: string[], edgePath: string[]): void => {
      if (recursionStack.has(nodeId)) {
        // Found a cycle
        const cycleStart = path.indexOf(nodeId);
        const cycleNodeIds = path.slice(cycleStart);
        const cycleEdgeIds = edgePath.slice(cycleStart);

        cycles.push({
          nodeIds: [...cycleNodeIds, nodeId],
          edgeIds: cycleEdgeIds,
          length: cycleNodeIds.length,
        });

        for (const id of cycleNodeIds) {
          nodesInCycles.add(id);
        }
        return;
      }

      if (visited.has(nodeId)) {
        return;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoing = graph.edges.filter(e => e.source === nodeId);
      for (const edge of outgoing) {
        findCyclesFrom(
          edge.target,
          [...path, nodeId],
          [...edgePath, edge.id]
        );
      }

      recursionStack.delete(nodeId);
    };

    // Check from each node
    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        findCyclesFrom(nodeId, [], []);
      }
    }

    return {
      hasCycles: cycles.length > 0,
      cycles,
      stats: {
        cyclesFound: cycles.length,
        nodesInCycles: nodesInCycles.size,
        detectionTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Analyze impact of changing nodes
   */
  analyzeImpact(
    graph: DependencyGraph,
    nodeIds: string[]
  ): ImpactAnalysisResult {
    const directImpact: NodeType[] = [];
    const transitiveImpact: NodeType[] = [];
    const impactPaths: TraversalPath[] = [];
    const visitedDirect = new Set<string>();
    const visitedTransitive = new Set<string>();
    const impactByType: Record<string, number> = {};
    const impactByDepth: Record<number, number> = {};

    // Find direct and transitive impact for each changed node
    for (const nodeId of nodeIds) {
      const downstream = this.getDownstream(graph, nodeId, {
        maxDepth: 10,
        includeStart: false,
      });

      for (const node of downstream.nodes) {
        const isDirect = downstream.edges.some(
          e => e.source === nodeId && e.target === node.id
        );

        if (isDirect && !visitedDirect.has(node.id)) {
          visitedDirect.add(node.id);
          directImpact.push(node);
        } else if (!isDirect && !visitedTransitive.has(node.id) && !visitedDirect.has(node.id)) {
          visitedTransitive.add(node.id);
          transitiveImpact.push(node);
        }

        // Track by type
        impactByType[node.type] = (impactByType[node.type] ?? 0) + 1;
      }

      // Track paths
      impactPaths.push(...downstream.paths);
    }

    // Calculate impact by depth
    for (const path of impactPaths) {
      const depth = path.length;
      impactByDepth[depth] = (impactByDepth[depth] ?? 0) + 1;
    }

    const totalImpacted = directImpact.length + transitiveImpact.length;

    // Assess risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
    if (totalImpacted >= 50) riskLevel = 'critical';
    else if (totalImpacted >= 20) riskLevel = 'high';
    else if (totalImpacted >= 5) riskLevel = 'medium';

    return {
      directImpact,
      transitiveImpact,
      impactPaths,
      summary: {
        totalImpacted,
        impactByType,
        impactByDepth,
        riskLevel,
      },
    };
  }

  /**
   * Extract a subgraph
   */
  extractSubgraph(
    graph: DependencyGraph,
    options: SubgraphOptions
  ): DependencyGraph {
    const {
      nodeIds,
      nodeTypes,
      edgeTypes,
      includeConnected = false,
      maxDistance = 1,
    } = options;

    const selectedNodeIds = new Set<string>();

    // Add specified node IDs
    if (nodeIds) {
      for (const id of nodeIds) {
        if (graph.nodes.has(id)) {
          selectedNodeIds.add(id);
        }
      }
    }

    // Add nodes by type
    if (nodeTypes) {
      for (const [id, node] of graph.nodes) {
        if (nodeTypes.includes(node.type)) {
          selectedNodeIds.add(id);
        }
      }
    }

    // Add connected nodes if requested
    if (includeConnected) {
      const toAdd = new Set<string>();

      for (const nodeId of selectedNodeIds) {
        const connected = this.getConnectedNodes(
          graph,
          nodeId,
          maxDistance,
          edgeTypes
        );

        for (const connectedId of connected) {
          toAdd.add(connectedId);
        }
      }

      for (const id of toAdd) {
        selectedNodeIds.add(id);
      }
    }

    // Build subgraph
    const builder = createGraphBuilder();

    // Add selected nodes
    for (const nodeId of selectedNodeIds) {
      const node = graph.nodes.get(nodeId);
      if (node) {
        builder.addNode(node);
      }
    }

    // Add edges between selected nodes
    for (const edge of graph.edges) {
      if (selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)) {
        if (!edgeTypes || edgeTypes.includes(edge.type)) {
          builder.addEdge(edge);
        }
      }
    }

    return builder.build();
  }

  /**
   * Merge multiple graphs
   */
  mergeGraphs(graphs: DependencyGraph[]): DependencyGraph {
    return this.merger.merge(graphs);
  }

  /**
   * Get shortest path between two nodes
   */
  getShortestPath(
    graph: DependencyGraph,
    sourceId: string,
    targetId: string
  ): TraversalPath | null {
    if (!graph.nodes.has(sourceId) || !graph.nodes.has(targetId)) {
      return null;
    }

    if (sourceId === targetId) {
      return {
        startNodeId: sourceId,
        endNodeId: targetId,
        nodeIds: [sourceId],
        edgeIds: [],
        length: 0,
      };
    }

    // BFS for shortest path
    const visited = new Set<string>();
    const queue: Array<{ nodeId: string; path: string[]; edges: string[] }> = [
      { nodeId: sourceId, path: [sourceId], edges: [] },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.nodeId === targetId) {
        return {
          startNodeId: sourceId,
          endNodeId: targetId,
          nodeIds: current.path,
          edgeIds: current.edges,
          length: current.path.length - 1,
        };
      }

      if (visited.has(current.nodeId)) continue;
      visited.add(current.nodeId);

      const outgoing = graph.edges.filter(e => e.source === current.nodeId);
      for (const edge of outgoing) {
        if (!visited.has(edge.target)) {
          queue.push({
            nodeId: edge.target,
            path: [...current.path, edge.target],
            edges: [...current.edges, edge.id],
          });
        }
      }
    }

    return null;
  }

  /**
   * Get graph statistics
   */
  getGraphStats(graph: DependencyGraph): GraphStats {
    const nodesByType: Record<string, number> = {};
    const edgesByType: Record<string, number> = {};
    const inDegree: Record<string, number> = {};
    const outDegree: Record<string, number> = {};

    // Count nodes by type
    for (const [id, node] of graph.nodes) {
      nodesByType[node.type] = (nodesByType[node.type] ?? 0) + 1;
      inDegree[id] = 0;
      outDegree[id] = 0;
    }

    // Count edges by type and calculate degrees
    for (const edge of graph.edges) {
      edgesByType[edge.type] = (edgesByType[edge.type] ?? 0) + 1;
      outDegree[edge.source] = (outDegree[edge.source] ?? 0) + 1;
      inDegree[edge.target] = (inDegree[edge.target] ?? 0) + 1;
    }

    const maxInDegree = Math.max(0, ...Object.values(inDegree));
    const maxOutDegree = Math.max(0, ...Object.values(outDegree));

    // Count orphan nodes
    const orphanNodes = Array.from(graph.nodes.keys()).filter(
      id => (inDegree[id] ?? 0) === 0 && (outDegree[id] ?? 0) === 0
    ).length;

    // Calculate density
    const n = graph.nodes.size;
    const maxEdges = n * (n - 1);
    const density = maxEdges > 0 ? graph.edges.length / maxEdges : 0;

    return {
      nodeCount: graph.nodes.size,
      edgeCount: graph.edges.length,
      nodesByType,
      edgesByType,
      avgEdgesPerNode: n > 0 ? graph.edges.length / n : 0,
      maxInDegree,
      maxOutDegree,
      orphanNodes,
      density,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Generic traversal implementation
   */
  private traverse(
    graph: DependencyGraph,
    startNodeId: string,
    options: TraversalOptions
  ): TraversalResult {
    const startTime = Date.now();
    const visitedNodes: NodeType[] = [];
    const visitedEdges: GraphEdge[] = [];
    const paths: TraversalPath[] = [];
    const visited = new Set<string>();
    let maxDepthReached = 0;

    const startNode = graph.nodes.get(startNodeId);
    if (!startNode) {
      return {
        nodes: [],
        edges: [],
        paths: [],
        stats: {
          nodesVisited: 0,
          edgesTraversed: 0,
          maxDepthReached: 0,
          traversalTimeMs: Date.now() - startTime,
        },
      };
    }

    // BFS traversal
    const queue: Array<{
      nodeId: string;
      depth: number;
      path: string[];
      edgePath: string[];
    }> = [
      {
        nodeId: startNodeId,
        depth: 0,
        path: [startNodeId],
        edgePath: [],
      },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth > options.maxDepth) continue;
      if (visited.has(current.nodeId)) continue;

      visited.add(current.nodeId);
      maxDepthReached = Math.max(maxDepthReached, current.depth);

      const node = graph.nodes.get(current.nodeId);
      if (node) {
        if (options.includeStart || current.depth > 0) {
          visitedNodes.push(node);
        }

        if (current.depth > 0) {
          paths.push({
            startNodeId,
            endNodeId: current.nodeId,
            nodeIds: current.path,
            edgeIds: current.edgePath,
            length: current.depth,
          });
        }
      }

      // Get edges based on direction
      let edges: GraphEdge[];
      if (options.direction === 'downstream') {
        edges = graph.edges.filter(e => e.source === current.nodeId);
      } else if (options.direction === 'upstream') {
        edges = graph.edges.filter(e => e.target === current.nodeId);
      } else {
        edges = graph.edges.filter(
          e => e.source === current.nodeId || e.target === current.nodeId
        );
      }

      // Filter by edge types if specified
      if (options.edgeTypes) {
        edges = edges.filter(e => options.edgeTypes!.includes(e.type));
      }

      for (const edge of edges) {
        visitedEdges.push(edge);

        const nextNodeId =
          options.direction === 'upstream' ? edge.source : edge.target;

        if (!visited.has(nextNodeId)) {
          queue.push({
            nodeId: nextNodeId,
            depth: current.depth + 1,
            path: [...current.path, nextNodeId],
            edgePath: [...current.edgePath, edge.id],
          });
        }
      }
    }

    return {
      nodes: visitedNodes,
      edges: visitedEdges,
      paths,
      stats: {
        nodesVisited: visitedNodes.length,
        edgesTraversed: visitedEdges.length,
        maxDepthReached,
        traversalTimeMs: Date.now() - startTime,
      },
    };
  }

  /**
   * Get connected nodes within a distance
   */
  private getConnectedNodes(
    graph: DependencyGraph,
    nodeId: string,
    maxDistance: number,
    edgeTypes?: EdgeType[]
  ): Set<string> {
    const connected = new Set<string>();
    const visited = new Set<string>();
    const queue: Array<{ id: string; distance: number }> = [
      { id: nodeId, distance: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id)) continue;
      if (current.distance > maxDistance) continue;

      visited.add(current.id);
      connected.add(current.id);

      const edges = graph.edges.filter(
        e => e.source === current.id || e.target === current.id
      );

      for (const edge of edges) {
        if (edgeTypes && !edgeTypes.includes(edge.type)) continue;

        const nextId = edge.source === current.id ? edge.target : edge.source;
        if (!visited.has(nextId)) {
          queue.push({ id: nextId, distance: current.distance + 1 });
        }
      }
    }

    return connected;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new graph service
 */
export function createGraphService(
  config?: Partial<GraphServiceConfig>
): IGraphService {
  return new GraphService(config);
}
