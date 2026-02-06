/**
 * Blast Radius Engine
 * @module services/rollup/blast-radius-engine
 *
 * Engine for analyzing the impact (blast radius) of changes to nodes in a merged graph.
 * Uses graph traversal to identify all affected nodes across repositories.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation blast radius analysis
 */

import {
  RollupExecutionId,
  BlastRadiusQuery,
  BlastRadiusResponse,
  MergedNode,
} from '../../types/rollup.js';
import { GraphEdge, EdgeType } from '../../types/graph.js';
import { IBlastRadiusEngine } from './interfaces.js';
import { RollupBlastRadiusError } from './errors.js';

/**
 * Node information for blast radius analysis
 */
interface AnalysisNode {
  /** Node ID */
  readonly id: string;
  /** Node type */
  readonly type: string;
  /** Node name */
  readonly name: string;
  /** Repository ID */
  readonly repoId: string;
  /** Repository name */
  readonly repoName: string;
  /** Whether this is a merged node */
  readonly isMerged: boolean;
  /** Source repository IDs for merged nodes */
  readonly sourceRepoIds?: string[];
}

/**
 * Graph data for analysis
 */
interface AnalysisGraph {
  /** All nodes indexed by ID */
  readonly nodes: Map<string, AnalysisNode>;
  /** Adjacency list for forward traversal (source -> targets) */
  readonly forwardEdges: Map<string, Array<{ targetId: string; edgeType: EdgeType }>>;
  /** Adjacency list for reverse traversal (target -> sources) */
  readonly reverseEdges: Map<string, Array<{ sourceId: string; edgeType: EdgeType }>>;
  /** All edges */
  readonly edges: GraphEdge[];
}

/**
 * Cache entry for blast radius analysis results
 */
interface CacheEntry {
  /** Analysis result */
  readonly result: BlastRadiusResponse;
  /** When the entry was created */
  readonly createdAt: Date;
  /** Execution ID */
  readonly executionId: RollupExecutionId;
}

/**
 * Traversal path during analysis
 */
interface TraversalPath {
  /** Node IDs in the path */
  readonly nodeIds: string[];
  /** Edge types along the path */
  readonly edgeTypes: EdgeType[];
}

/**
 * Impact score weights by edge type
 */
const EDGE_TYPE_WEIGHTS: Record<EdgeType, number> = {
  depends_on: 10,
  references: 8,
  creates: 9,
  destroys: 10,
  module_call: 9,
  module_source: 7,
  module_provider: 6,
  input_variable: 5,
  output_value: 5,
  local_reference: 4,
  provider_config: 7,
  provider_alias: 6,
  data_source: 6,
  data_reference: 5,
  selector_match: 8,
  namespace_member: 4,
  volume_mount: 7,
  service_target: 8,
  ingress_backend: 8,
  rbac_binding: 6,
  configmap_ref: 5,
  secret_ref: 7,
};

/**
 * Decay factor applied per depth level (70% retention per hop).
 * Used for calculating weighted impact scores during BFS traversal.
 * ADR-002: Exponential decay ensures closer dependencies have higher impact.
 */
export const DECAY_FACTOR = 0.7;

/**
 * Engine for blast radius analysis on merged graphs.
 * Determines the impact of changes to specific nodes.
 */
export class BlastRadiusEngine implements IBlastRadiusEngine {
  /**
   * Analysis result cache
   */
  private readonly cache: Map<string, CacheEntry> = new Map();

  /**
   * Cache TTL in milliseconds
   */
  private readonly cacheTtlMs: number;

  /**
   * Graph data indexed by execution ID
   */
  private readonly graphData: Map<string, AnalysisGraph> = new Map();

  /**
   * Repository name lookup
   */
  private readonly repositoryNames: Map<string, string> = new Map();

  /**
   * Create a new BlastRadiusEngine
   * @param options - Engine options
   */
  constructor(options: { cacheTtlMs?: number } = {}) {
    this.cacheTtlMs = options.cacheTtlMs ?? 3600000; // 1 hour default
  }

  /**
   * Register graph data for an execution.
   * Must be called before analyze() can work.
   *
   * @param executionId - Execution ID
   * @param mergedNodes - Merged nodes from the execution
   * @param edges - All edges in the merged graph
   * @param repositoryNames - Map of repository ID to name
   */
  registerGraph(
    executionId: RollupExecutionId,
    mergedNodes: MergedNode[],
    edges: GraphEdge[],
    repositoryNames: Map<string, string>
  ): void {
    // Build analysis nodes
    const nodes = new Map<string, AnalysisNode>();

    for (const mergedNode of mergedNodes) {
      const repoId = mergedNode.sourceRepoIds[0];
      const repoName = repositoryNames.get(repoId) ?? repoId;

      nodes.set(mergedNode.id, {
        id: mergedNode.id,
        type: mergedNode.type,
        name: mergedNode.name,
        repoId,
        repoName,
        isMerged: mergedNode.sourceNodeIds.length > 1,
        sourceRepoIds: mergedNode.sourceRepoIds,
      });
    }

    // Build adjacency lists
    const forwardEdges = new Map<string, Array<{ targetId: string; edgeType: EdgeType }>>();
    const reverseEdges = new Map<string, Array<{ sourceId: string; edgeType: EdgeType }>>();

    for (const edge of edges) {
      // Forward edges (who depends on this node)
      if (!forwardEdges.has(edge.source)) {
        forwardEdges.set(edge.source, []);
      }
      forwardEdges.get(edge.source)!.push({
        targetId: edge.target,
        edgeType: edge.type,
      });

      // Reverse edges (what this node depends on)
      if (!reverseEdges.has(edge.target)) {
        reverseEdges.set(edge.target, []);
      }
      reverseEdges.get(edge.target)!.push({
        sourceId: edge.source,
        edgeType: edge.type,
      });
    }

    this.graphData.set(executionId, {
      nodes,
      forwardEdges,
      reverseEdges,
      edges,
    });

    // Store repository names
    for (const [id, name] of repositoryNames) {
      this.repositoryNames.set(id, name);
    }
  }

  /**
   * Analyze blast radius from a merged graph.
   *
   * @param executionId - Execution ID to analyze
   * @param query - Blast radius query parameters
   * @returns Blast radius analysis results
   */
  async analyze(
    executionId: RollupExecutionId,
    query: BlastRadiusQuery
  ): Promise<BlastRadiusResponse> {
    // Check cache first
    const cached = await this.getCached(executionId, query.nodeIds);
    if (cached) {
      return cached;
    }

    // Get graph data
    const graph = this.graphData.get(executionId);
    if (!graph) {
      throw new RollupBlastRadiusError(
        `Graph data not found for execution: ${executionId}`,
        { executionId }
      );
    }

    // Validate query nodes exist
    for (const nodeId of query.nodeIds) {
      if (!graph.nodes.has(nodeId)) {
        throw new RollupBlastRadiusError(
          `Node not found in graph: ${nodeId}`,
          { executionId, nodeId }
        );
      }
    }

    const maxDepth = query.maxDepth ?? 5;
    const edgeTypes = query.edgeTypes ? new Set(query.edgeTypes) : null;
    const includeCrossRepo = query.includeCrossRepo ?? true;
    const includeIndirect = query.includeIndirect ?? true;

    // Perform BFS traversal from each starting node
    const directImpact: BlastRadiusResponse['directImpact'] = [];
    const indirectImpact: BlastRadiusResponse['indirectImpact'] = [];
    const crossRepoImpactMap = new Map<string, Map<string, { count: number; edgeType: EdgeType }>>();

    const visited = new Set<string>(query.nodeIds);
    const paths = new Map<string, TraversalPath>();

    // ADR-001: Initialize impact score accumulator for inline scoring during BFS
    let totalImpactScore = 0;

    // Queue entries: [nodeId, depth, path]
    type QueueEntry = [string, number, TraversalPath];
    const queue: QueueEntry[] = query.nodeIds.map((id) => [
      id,
      0,
      { nodeIds: [id], edgeTypes: [] },
    ]);

    while (queue.length > 0) {
      const entry = queue.shift();
      if (!entry) break;

      const [currentId, depth, path] = entry;

      if (depth > maxDepth) {
        continue;
      }

      // Get outgoing edges (nodes that depend on current)
      const outgoing = graph.forwardEdges.get(currentId) ?? [];

      for (const { targetId, edgeType } of outgoing) {
        // Filter by edge type if specified
        if (edgeTypes && !edgeTypes.has(edgeType)) {
          continue;
        }

        // Skip if already visited
        if (visited.has(targetId)) {
          continue;
        }

        const targetNode = graph.nodes.get(targetId);
        if (!targetNode) {
          continue;
        }

        const currentNode = graph.nodes.get(currentId);

        // Track cross-repo impact
        if (currentNode && currentNode.repoId !== targetNode.repoId) {
          if (!includeCrossRepo) {
            continue;
          }

          const key = `${currentNode.repoId}:${targetNode.repoId}`;
          if (!crossRepoImpactMap.has(key)) {
            crossRepoImpactMap.set(key, new Map());
          }
          const edgeMap = crossRepoImpactMap.get(key)!;
          const existing = edgeMap.get(edgeType) ?? { count: 0, edgeType };
          edgeMap.set(edgeType, { count: existing.count + 1, edgeType });
        }

        // Mark as visited
        visited.add(targetId);

        // ADR-001: Accumulate impact score inline during BFS traversal
        // ADR-002: Apply exponential decay based on current depth
        totalImpactScore += this.calculateImpactScore(depth, edgeType);

        // Build new path
        const newPath: TraversalPath = {
          nodeIds: [...path.nodeIds, targetId],
          edgeTypes: [...path.edgeTypes, edgeType],
        };
        paths.set(targetId, newPath);

        // Categorize as direct (depth 1) or indirect
        const impactEntry = {
          nodeId: targetId,
          nodeType: targetNode.type,
          nodeName: targetNode.name,
          repoId: targetNode.repoId,
          repoName: targetNode.repoName,
          depth: depth + 1,
        };

        if (depth === 0) {
          directImpact.push(impactEntry);
        } else if (includeIndirect) {
          indirectImpact.push({
            ...impactEntry,
            path: newPath.nodeIds,
          });
        }

        // Continue BFS
        if (depth + 1 < maxDepth) {
          queue.push([targetId, depth + 1, newPath]);
        }
      }
    }

    // Build cross-repo impact summary
    const crossRepoImpact: BlastRadiusResponse['crossRepoImpact'] = [];
    for (const [key, edgeMap] of crossRepoImpactMap) {
      const [sourceRepoId, targetRepoId] = key.split(':');
      for (const [edgeType, { count }] of edgeMap) {
        crossRepoImpact.push({
          sourceRepoId,
          sourceRepoName: this.repositoryNames.get(sourceRepoId) ?? sourceRepoId,
          targetRepoId,
          targetRepoName: this.repositoryNames.get(targetRepoId) ?? targetRepoId,
          impactedNodes: count,
          edgeType,
        });
      }
    }

    // Calculate summary statistics
    const impactByType: Record<string, number> = {};
    const impactByRepo: Record<string, number> = {};
    const impactByDepth: Record<string, number> = {};

    const allImpacted = [...directImpact, ...indirectImpact];
    for (const impact of allImpacted) {
      // By type
      impactByType[impact.nodeType] = (impactByType[impact.nodeType] ?? 0) + 1;
      // By repo
      impactByRepo[impact.repoId] = (impactByRepo[impact.repoId] ?? 0) + 1;
      // By depth
      const depthKey = String(impact.depth);
      impactByDepth[depthKey] = (impactByDepth[depthKey] ?? 0) + 1;
    }

    // Calculate risk level
    const riskLevel = this.calculateRiskLevel(
      directImpact.length,
      indirectImpact.length,
      crossRepoImpact.length
    );

    // ADR-003: Additive field extension for backward compatibility
    // ADR-004: Summary-level impactScore only (not per-node)
    const result: BlastRadiusResponse = {
      query,
      rollupId: '', // Will be filled by service
      executionId,
      directImpact,
      indirectImpact,
      crossRepoImpact,
      summary: {
        totalImpacted: allImpacted.length,
        directCount: directImpact.length,
        indirectCount: indirectImpact.length,
        crossRepoCount: crossRepoImpact.reduce((sum, c) => sum + c.impactedNodes, 0),
        impactByType,
        impactByRepo,
        impactByDepth,
        riskLevel,
        // ADR-004: Weighted impact score with depth decay (rounded to 2 decimal places)
        impactScore: Math.round(totalImpactScore * 100) / 100,
      },
    };

    // Cache the result
    this.cacheResult(executionId, query.nodeIds, result);

    return result;
  }

  /**
   * Get cached analysis if available.
   *
   * @param executionId - Execution ID
   * @param nodeIds - Node IDs in query
   * @returns Cached result or null
   */
  async getCached(
    executionId: RollupExecutionId,
    nodeIds: string[]
  ): Promise<BlastRadiusResponse | null> {
    const cacheKey = this.getCacheKey(executionId, nodeIds);
    const entry = this.cache.get(cacheKey);

    if (!entry) {
      return null;
    }

    // Check TTL
    const age = Date.now() - entry.createdAt.getTime();
    if (age > this.cacheTtlMs) {
      this.cache.delete(cacheKey);
      return null;
    }

    return entry.result;
  }

  /**
   * Clear the analysis cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear graph data for an execution.
   */
  clearGraphData(executionId: RollupExecutionId): void {
    this.graphData.delete(executionId);
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Generate cache key for a query.
   */
  private getCacheKey(executionId: RollupExecutionId, nodeIds: string[]): string {
    const sortedIds = [...nodeIds].sort().join(',');
    return `${executionId}:${sortedIds}`;
  }

  /**
   * Cache an analysis result.
   */
  private cacheResult(
    executionId: RollupExecutionId,
    nodeIds: string[],
    result: BlastRadiusResponse
  ): void {
    const cacheKey = this.getCacheKey(executionId, nodeIds);
    this.cache.set(cacheKey, {
      result,
      createdAt: new Date(),
      executionId,
    });
  }

  /**
   * Calculate risk level based on impact metrics.
   */
  private calculateRiskLevel(
    directCount: number,
    indirectCount: number,
    crossRepoCount: number
  ): 'low' | 'medium' | 'high' | 'critical' {
    const totalImpact = directCount + indirectCount;

    // Cross-repo impacts are weighted more heavily
    const weightedScore = directCount * 2 + indirectCount + crossRepoCount * 5;

    if (weightedScore === 0) {
      return 'low';
    }

    if (weightedScore < 10) {
      return 'low';
    }

    if (weightedScore < 30) {
      return 'medium';
    }

    if (weightedScore < 100 && crossRepoCount < 5) {
      return 'high';
    }

    return 'critical';
  }

  /**
   * Calculate severity score for an edge type.
   */
  private getEdgeWeight(edgeType: EdgeType): number {
    return EDGE_TYPE_WEIGHTS[edgeType] ?? 5;
  }

  /**
   * Calculate weighted impact score with depth decay.
   * Uses exponential decay to weight impacts by distance from source.
   *
   * ADR-001: Inline scoring during BFS traversal (not post-processing)
   * ADR-002: DECAY_FACTOR = 0.7 for 70% retention per hop
   *
   * @param depth - Current traversal depth (0 = source node)
   * @param edgeType - Type of edge being traversed
   * @returns Weighted score with decay applied
   *
   * @example
   * // At depth 0, depends_on edge (weight 10): 10 * 0.7^0 = 10
   * // At depth 1, depends_on edge (weight 10): 10 * 0.7^1 = 7
   * // At depth 2, depends_on edge (weight 10): 10 * 0.7^2 = 4.9
   */
  private calculateImpactScore(depth: number, edgeType: EdgeType): number {
    const weight = this.getEdgeWeight(edgeType);
    return weight * Math.pow(DECAY_FACTOR, depth);
  }
}

/**
 * Create a new BlastRadiusEngine instance
 */
export function createBlastRadiusEngine(
  options: { cacheTtlMs?: number } = {}
): BlastRadiusEngine {
  return new BlastRadiusEngine(options);
}
