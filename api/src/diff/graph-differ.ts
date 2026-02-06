/**
 * Graph Differ - Main Diff Computation Engine
 * @module diff/graph-differ
 *
 * Orchestrates node and edge matching to compute differences between two
 * dependency graph scans. Implements the core diff algorithm with support
 * for timeouts, performance limits, and impact assessment.
 *
 * TASK-ROLLUP-005: Diff Computation - Main GraphDiffer Engine
 *
 * @example
 * ```typescript
 * const differ = createGraphDiffer();
 *
 * // Estimate cost before running
 * const estimate = differ.estimateCost(baseGraph, compareGraph);
 * if (!estimate.withinLimits) {
 *   console.warn('Diff may exceed limits:', estimate.warnings);
 * }
 *
 * // Compute the diff
 * const diff = await differ.computeDiff(baseGraph, compareGraph, {
 *   timeoutMs: 30000,
 *   computeFieldChanges: true,
 * });
 *
 * console.log(`Impact: ${diff.summary.impactAssessment}`);
 * console.log(`Nodes: +${diff.summary.nodesAdded} -${diff.summary.nodesRemoved}`);
 * ```
 */

import type { NodeType, GraphEdge, EdgeType, DependencyGraph } from '../types/graph.js';
import type { ScanId, RepositoryId, TenantId } from '../types/entities.js';
import { createNodeMatcher, INodeMatcher } from './node-matcher.js';
import { createEdgeMatcher, IEdgeMatcher } from './edge-matcher.js';
import {
  GraphDiff,
  DiffOptions,
  DiffSummary,
  ImpactLevel,
  NodeModification,
  EdgeModification,
  TypeChangeSummary,
  generateDiffId,
  calculateImpactLevel,
  DEFAULT_DIFF_OPTIONS,
  DiffErrorCodes,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Algorithm version for tracking changes in diff computation logic.
 * Increment when algorithm changes affect diff results.
 */
export const ALGORITHM_VERSION = '1.0.0';

/**
 * Default maximum nodes for diff computation.
 * Beyond this limit, estimation will warn about performance.
 */
export const DEFAULT_MAX_NODES = 50000;

/**
 * Default maximum edges for diff computation.
 * Beyond this limit, estimation will warn about performance.
 */
export const DEFAULT_MAX_EDGES = 200000;

/**
 * Estimated time per node comparison in milliseconds.
 * Used for cost estimation.
 */
const MS_PER_NODE_COMPARISON = 0.05;

/**
 * Estimated time per edge comparison in milliseconds.
 * Used for cost estimation.
 */
const MS_PER_EDGE_COMPARISON = 0.02;

/**
 * Estimated memory per node in bytes.
 * Used for cost estimation.
 */
const BYTES_PER_NODE = 512;

/**
 * Estimated memory per edge in bytes.
 * Used for cost estimation.
 */
const BYTES_PER_EDGE = 256;

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Cost estimate for diff computation.
 * Helps clients decide whether to proceed with potentially expensive operations.
 */
export interface DiffCostEstimate {
  /** Estimated computation time in milliseconds */
  readonly estimatedTimeMs: number;
  /** Estimated peak memory usage in bytes */
  readonly estimatedMemoryBytes: number;
  /** Total nodes across both graphs */
  readonly totalNodes: number;
  /** Total edges across both graphs */
  readonly totalEdges: number;
  /** Whether the operation is within configured limits */
  readonly withinLimits: boolean;
  /** Warning messages about potential issues */
  readonly warnings: string[];
}

/**
 * Extended diff options with limits for the differ.
 */
export interface GraphDifferOptions extends DiffOptions {
  /** Maximum nodes to process (default: 50000) */
  readonly maxNodes?: number;
  /** Maximum edges to process (default: 200000) */
  readonly maxEdges?: number;
}

/**
 * Interface for the main graph differ engine.
 * Orchestrates node and edge matching for diff computation.
 */
export interface IGraphDiffer {
  /**
   * Compute the diff between two dependency graphs.
   *
   * @param baseGraph - The base (before) graph state
   * @param compareGraph - The compare (after) graph state
   * @param options - Configuration options for diff computation
   * @returns Promise resolving to the computed diff
   * @throws {DiffTimeoutError} If computation exceeds timeout
   * @throws {DiffLimitError} If graph exceeds size limits
   *
   * @example
   * ```typescript
   * const diff = await differ.computeDiff(baseGraph, compareGraph, {
   *   timeoutMs: 30000,
   *   includeFileBreakdown: true,
   * });
   * ```
   */
  computeDiff(
    baseGraph: DependencyGraph,
    compareGraph: DependencyGraph,
    options?: GraphDifferOptions
  ): Promise<GraphDiff>;

  /**
   * Estimate the computational cost of a diff operation.
   * Use this to warn users or prevent expensive operations.
   *
   * @param baseGraph - The base graph
   * @param compareGraph - The compare graph
   * @returns Cost estimate with warnings
   *
   * @example
   * ```typescript
   * const estimate = differ.estimateCost(baseGraph, compareGraph);
   * if (!estimate.withinLimits) {
   *   throw new Error(`Operation too expensive: ${estimate.warnings.join(', ')}`);
   * }
   * ```
   */
  estimateCost(
    baseGraph: DependencyGraph,
    compareGraph: DependencyGraph
  ): DiffCostEstimate;

  /**
   * Get the current configuration.
   *
   * @returns Current diff options
   */
  getConfig(): Required<GraphDifferOptions>;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for diff computation errors.
 */
export class DiffError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'DiffError';
  }
}

/**
 * Error thrown when diff computation exceeds the timeout.
 */
export class DiffTimeoutError extends DiffError {
  constructor(timeoutMs: number, elapsedMs: number) {
    super(
      `Diff computation timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms)`,
      DiffErrorCodes.TIMEOUT,
      { timeoutMs, elapsedMs }
    );
    this.name = 'DiffTimeoutError';
  }
}

/**
 * Error thrown when graph exceeds size limits.
 */
export class DiffLimitError extends DiffError {
  constructor(message: string, context: Record<string, unknown>) {
    super(message, DiffErrorCodes.GRAPH_TOO_LARGE, context);
    this.name = 'DiffLimitError';
  }
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * GraphDiffer implementation.
 * Orchestrates node and edge matching for complete diff computation.
 */
export class GraphDiffer implements IGraphDiffer {
  private readonly nodeMatcher: INodeMatcher;
  private readonly edgeMatcher: IEdgeMatcher;
  private readonly config: Required<GraphDifferOptions>;

  /**
   * Create a new GraphDiffer instance.
   *
   * @param options - Configuration options
   */
  constructor(options?: GraphDifferOptions) {
    // Merge with defaults
    this.config = {
      ...DEFAULT_DIFF_OPTIONS,
      maxNodes: DEFAULT_MAX_NODES,
      maxEdges: DEFAULT_MAX_EDGES,
      ...options,
    };

    // Create matchers with configured ignore fields
    this.nodeMatcher = createNodeMatcher({
      ignoreFields: this.config.ignoreFields,
    });

    this.edgeMatcher = createEdgeMatcher({
      ignoreFields: this.config.ignoreFields,
    });
  }

  /**
   * Compute the diff between two dependency graphs.
   */
  async computeDiff(
    baseGraph: DependencyGraph,
    compareGraph: DependencyGraph,
    options?: GraphDifferOptions
  ): Promise<GraphDiff> {
    const startTime = Date.now();
    const mergedOptions = { ...this.config, ...options };

    // Phase timing tracking - use mutable object during computation
    const phaseTiming: {
      loadBase: number;
      loadCompare: number;
      indexNodes: number;
      compareNodes: number;
      indexEdges: number;
      compareEdges: number;
      summarize: number;
    } = {
      loadBase: 0,
      loadCompare: 0,
      indexNodes: 0,
      compareNodes: 0,
      indexEdges: 0,
      compareEdges: 0,
      summarize: 0,
    };

    // Check timeout helper
    const checkTimeout = (): void => {
      const elapsed = Date.now() - startTime;
      if (mergedOptions.timeoutMs && elapsed > mergedOptions.timeoutMs) {
        throw new DiffTimeoutError(mergedOptions.timeoutMs, elapsed);
      }
    };

    // Validate size limits
    const estimate = this.estimateCost(baseGraph, compareGraph);
    if (!estimate.withinLimits && !mergedOptions.forceRecompute) {
      throw new DiffLimitError(
        `Graph exceeds size limits: ${estimate.warnings.join('; ')}`,
        {
          totalNodes: estimate.totalNodes,
          totalEdges: estimate.totalEdges,
          maxNodes: mergedOptions.maxNodes,
          maxEdges: mergedOptions.maxEdges,
        }
      );
    }

    // =========================================================================
    // Step 1: Convert node Maps to arrays for processing
    // =========================================================================
    let phaseStart = Date.now();
    const baseNodesArray = Array.from(baseGraph.nodes.values());
    phaseTiming.loadBase = Date.now() - phaseStart;

    checkTimeout();

    phaseStart = Date.now();
    const compareNodesArray = Array.from(compareGraph.nodes.values());
    phaseTiming.loadCompare = Date.now() - phaseStart;

    checkTimeout();

    // =========================================================================
    // Step 2: Index nodes by stable identity
    // =========================================================================
    phaseStart = Date.now();
    const baseNodeIndex = this.nodeMatcher.indexNodes(baseNodesArray);
    const compareNodeIndex = this.nodeMatcher.indexNodes(compareNodesArray);
    phaseTiming.indexNodes = Date.now() - phaseStart;

    checkTimeout();

    // =========================================================================
    // Step 3: Find node changes
    // =========================================================================
    phaseStart = Date.now();
    const nodesAdded = this.nodeMatcher.findAdded(baseNodeIndex, compareNodeIndex);
    const nodesRemoved = this.nodeMatcher.findRemoved(baseNodeIndex, compareNodeIndex);
    const nodesModified = this.nodeMatcher.findModified(baseNodeIndex, compareNodeIndex);
    phaseTiming.compareNodes = Date.now() - phaseStart;

    checkTimeout();

    // =========================================================================
    // Step 4: Index edges (using node index for stable identity)
    // =========================================================================
    phaseStart = Date.now();
    const baseEdgeIndex = this.edgeMatcher.indexEdges(baseGraph.edges, baseNodeIndex);
    const compareEdgeIndex = this.edgeMatcher.indexEdges(compareGraph.edges, compareNodeIndex);
    phaseTiming.indexEdges = Date.now() - phaseStart;

    checkTimeout();

    // =========================================================================
    // Step 5: Find edge changes
    // =========================================================================
    phaseStart = Date.now();
    const edgesAdded = this.edgeMatcher.findAdded(baseEdgeIndex, compareEdgeIndex);
    const edgesRemoved = this.edgeMatcher.findRemoved(baseEdgeIndex, compareEdgeIndex);
    const edgesModified = this.edgeMatcher.findModified(baseEdgeIndex, compareEdgeIndex);
    phaseTiming.compareEdges = Date.now() - phaseStart;

    checkTimeout();

    // =========================================================================
    // Step 6: Calculate summary and impact assessment
    // =========================================================================
    phaseStart = Date.now();
    const summary = this.calculateSummary(
      {
        added: nodesAdded,
        removed: nodesRemoved,
        modified: nodesModified,
      },
      {
        added: edgesAdded,
        removed: edgesRemoved,
        modified: edgesModified,
      },
      baseNodesArray.length,
      baseGraph.edges.length,
      mergedOptions
    );
    phaseTiming.summarize = Date.now() - phaseStart;

    const computationTimeMs = Date.now() - startTime;

    // =========================================================================
    // Step 7: Build and return result
    // =========================================================================
    // Extract scan/repository/tenant info from graph metadata or use defaults
    const baseScanId = (baseGraph.id as unknown as ScanId) || ('base' as unknown as ScanId);
    const compareScanId = (compareGraph.id as unknown as ScanId) || ('compare' as unknown as ScanId);
    const repositoryId = ('repo' as unknown as RepositoryId);
    const tenantId = ('tenant' as unknown as TenantId);

    const result: GraphDiff = {
      id: generateDiffId(baseScanId, compareScanId),
      baseScanId,
      compareScanId,
      repositoryId,
      tenantId,
      nodes: {
        added: nodesAdded,
        removed: nodesRemoved,
        modified: nodesModified,
      },
      edges: {
        added: edgesAdded,
        removed: edgesRemoved,
        modified: edgesModified,
      },
      summary,
      computedAt: new Date(),
      computationTimeMs,
      algorithmVersion: ALGORITHM_VERSION,
    };

    return result;
  }

  /**
   * Estimate the computational cost of a diff operation.
   */
  estimateCost(
    baseGraph: DependencyGraph,
    compareGraph: DependencyGraph
  ): DiffCostEstimate {
    const baseNodeCount = baseGraph.nodes.size;
    const compareNodeCount = compareGraph.nodes.size;
    const baseEdgeCount = baseGraph.edges.length;
    const compareEdgeCount = compareGraph.edges.length;

    const totalNodes = baseNodeCount + compareNodeCount;
    const totalEdges = baseEdgeCount + compareEdgeCount;

    // Estimate time: indexing + comparison
    // Node indexing is O(n), comparison is O(n) for each operation
    const nodeIndexTime = totalNodes * MS_PER_NODE_COMPARISON;
    const nodeCompareTime = Math.max(baseNodeCount, compareNodeCount) * MS_PER_NODE_COMPARISON * 3; // 3 ops
    const edgeIndexTime = totalEdges * MS_PER_EDGE_COMPARISON;
    const edgeCompareTime = Math.max(baseEdgeCount, compareEdgeCount) * MS_PER_EDGE_COMPARISON * 3;

    const estimatedTimeMs = nodeIndexTime + nodeCompareTime + edgeIndexTime + edgeCompareTime;

    // Estimate memory: indexes + result storage
    const estimatedMemoryBytes =
      totalNodes * BYTES_PER_NODE +
      totalEdges * BYTES_PER_EDGE;

    // Check limits
    const warnings: string[] = [];
    let withinLimits = true;

    if (totalNodes > this.config.maxNodes) {
      warnings.push(`Total nodes (${totalNodes}) exceeds limit (${this.config.maxNodes})`);
      withinLimits = false;
    }

    if (totalEdges > this.config.maxEdges) {
      warnings.push(`Total edges (${totalEdges}) exceeds limit (${this.config.maxEdges})`);
      withinLimits = false;
    }

    if (estimatedTimeMs > this.config.timeoutMs) {
      warnings.push(
        `Estimated time (${Math.round(estimatedTimeMs)}ms) may exceed timeout (${this.config.timeoutMs}ms)`
      );
    }

    // Performance warnings
    if (totalNodes > 10000) {
      warnings.push('Large graph: consider enabling progress tracking');
    }

    if (totalEdges > 50000) {
      warnings.push('Many edges: diff may take several seconds');
    }

    return {
      estimatedTimeMs: Math.round(estimatedTimeMs),
      estimatedMemoryBytes,
      totalNodes,
      totalEdges,
      withinLimits,
      warnings,
    };
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Required<GraphDifferOptions> {
    return { ...this.config };
  }

  // ===========================================================================
  // Private Methods
  // ===========================================================================

  /**
   * Calculate diff summary with impact assessment.
   */
  private calculateSummary(
    nodes: {
      added: NodeType[];
      removed: NodeType[];
      modified: NodeModification[];
    },
    edges: {
      added: GraphEdge[];
      removed: GraphEdge[];
      modified: EdgeModification[];
    },
    totalBaseNodes: number,
    totalBaseEdges: number,
    options: GraphDifferOptions
  ): DiffSummary {
    // Basic counts
    const nodesAdded = nodes.added.length;
    const nodesRemoved = nodes.removed.length;
    const nodesModified = nodes.modified.length;
    const edgesAdded = edges.added.length;
    const edgesRemoved = edges.removed.length;
    const edgesModified = edges.modified.length;

    // Calculate base summary
    const baseSummary: Omit<DiffSummary, 'impactAssessment'> = {
      nodesAdded,
      nodesRemoved,
      nodesModified,
      edgesAdded,
      edgesRemoved,
      edgesModified,
    };

    // Calculate impact level
    const impactAssessment = this.calculateImpactAssessment(
      baseSummary,
      totalBaseNodes,
      totalBaseEdges
    );

    // Build full summary
    const summary: DiffSummary = {
      ...baseSummary,
      impactAssessment,
    };

    // Add optional breakdowns
    const summaryWithBreakdowns = this.addBreakdowns(
      summary,
      nodes,
      edges,
      options
    );

    return summaryWithBreakdowns;
  }

  /**
   * Calculate impact assessment level based on change ratios.
   *
   * Impact levels:
   * - low: < 5% nodes changed
   * - medium: 5-15% nodes changed
   * - high: 15-30% nodes changed
   * - critical: > 30% nodes changed
   */
  private calculateImpactAssessment(
    summary: Omit<DiffSummary, 'impactAssessment'>,
    totalNodes: number,
    totalEdges: number
  ): ImpactLevel {
    // Use the utility function from types.ts for consistency
    return calculateImpactLevel(summary, totalNodes, totalEdges);
  }

  /**
   * Add optional breakdowns to the summary.
   */
  private addBreakdowns(
    summary: DiffSummary,
    nodes: {
      added: NodeType[];
      removed: NodeType[];
      modified: NodeModification[];
    },
    edges: {
      added: GraphEdge[];
      removed: GraphEdge[];
      modified: EdgeModification[];
    },
    options: GraphDifferOptions
  ): DiffSummary {
    let result = { ...summary };

    // Node changes by type
    const nodeChangesByType = this.groupNodeChangesByType(nodes);
    result = { ...result, nodeChangesByType };

    // Edge changes by type
    const edgeChangesByType = this.groupEdgeChangesByType(edges);
    result = { ...result, edgeChangesByType };

    // Files affected
    if (options.includeFileBreakdown) {
      const filesAffected = this.extractAffectedFiles(nodes, edges);
      result = { ...result, filesAffected };
    }

    // Calculate change score (0-100)
    const changeScore = this.calculateChangeScore(summary);
    result = { ...result, changeScore };

    return result;
  }

  /**
   * Group node changes by node type.
   */
  private groupNodeChangesByType(nodes: {
    added: NodeType[];
    removed: NodeType[];
    modified: NodeModification[];
  }): Record<string, TypeChangeSummary> {
    const result: Record<string, TypeChangeSummary> = {};

    // Count added nodes by type
    for (const node of nodes.added) {
      if (!result[node.type]) {
        result[node.type] = { added: 0, removed: 0, modified: 0 };
      }
      const current = result[node.type]!;
      result[node.type] = {
        added: current.added + 1,
        removed: current.removed,
        modified: current.modified,
      };
    }

    // Count removed nodes by type
    for (const node of nodes.removed) {
      if (!result[node.type]) {
        result[node.type] = { added: 0, removed: 0, modified: 0 };
      }
      const current = result[node.type]!;
      result[node.type] = {
        added: current.added,
        removed: current.removed + 1,
        modified: current.modified,
      };
    }

    // Count modified nodes by type
    // Need to extract type from the modification's after state
    for (const mod of nodes.modified) {
      const nodeType = (mod.after as NodeType)?.type ?? 'unknown';
      if (!result[nodeType]) {
        result[nodeType] = { added: 0, removed: 0, modified: 0 };
      }
      const current = result[nodeType]!;
      result[nodeType] = {
        added: current.added,
        removed: current.removed,
        modified: current.modified + 1,
      };
    }

    return result;
  }

  /**
   * Group edge changes by edge type.
   */
  private groupEdgeChangesByType(edges: {
    added: GraphEdge[];
    removed: GraphEdge[];
    modified: EdgeModification[];
  }): Record<EdgeType, TypeChangeSummary> {
    const result: Partial<Record<EdgeType, TypeChangeSummary>> = {};

    // Count added edges by type
    for (const edge of edges.added) {
      if (!result[edge.type]) {
        result[edge.type] = { added: 0, removed: 0, modified: 0 };
      }
      const current = result[edge.type]!;
      result[edge.type] = {
        added: current.added + 1,
        removed: current.removed,
        modified: current.modified,
      };
    }

    // Count removed edges by type
    for (const edge of edges.removed) {
      if (!result[edge.type]) {
        result[edge.type] = { added: 0, removed: 0, modified: 0 };
      }
      const current = result[edge.type]!;
      result[edge.type] = {
        added: current.added,
        removed: current.removed + 1,
        modified: current.modified,
      };
    }

    // Count modified edges by type
    for (const mod of edges.modified) {
      const edgeType = (mod.after as GraphEdge)?.type;
      if (edgeType) {
        if (!result[edgeType]) {
          result[edgeType] = { added: 0, removed: 0, modified: 0 };
        }
        const current = result[edgeType]!;
        result[edgeType] = {
          added: current.added,
          removed: current.removed,
          modified: current.modified + 1,
        };
      }
    }

    return result as Record<EdgeType, TypeChangeSummary>;
  }

  /**
   * Extract list of affected file paths.
   */
  private extractAffectedFiles(
    nodes: {
      added: NodeType[];
      removed: NodeType[];
      modified: NodeModification[];
    },
    edges: {
      added: GraphEdge[];
      removed: GraphEdge[];
      modified: EdgeModification[];
    }
  ): readonly string[] {
    const files = new Set<string>();

    // Files from added nodes
    for (const node of nodes.added) {
      files.add(node.location.file);
    }

    // Files from removed nodes
    for (const node of nodes.removed) {
      files.add(node.location.file);
    }

    // Files from modified nodes
    for (const mod of nodes.modified) {
      const beforeFile = (mod.before as NodeType)?.location?.file;
      const afterFile = (mod.after as NodeType)?.location?.file;
      if (beforeFile) files.add(beforeFile);
      if (afterFile) files.add(afterFile);
    }

    // Files from edge metadata
    for (const edge of [...edges.added, ...edges.removed]) {
      if (edge.metadata.location?.file) {
        files.add(edge.metadata.location.file);
      }
    }

    return Array.from(files).sort();
  }

  /**
   * Calculate a change score from 0-100.
   * Higher scores indicate more significant changes.
   */
  private calculateChangeScore(summary: DiffSummary): number {
    // Weight factors for different change types
    const weights = {
      nodeAdded: 1,
      nodeRemoved: 2,    // Removals are more impactful
      nodeModified: 0.5,
      edgeAdded: 0.5,
      edgeRemoved: 1,
      edgeModified: 0.25,
    };

    const rawScore =
      summary.nodesAdded * weights.nodeAdded +
      summary.nodesRemoved * weights.nodeRemoved +
      summary.nodesModified * weights.nodeModified +
      summary.edgesAdded * weights.edgeAdded +
      summary.edgesRemoved * weights.edgeRemoved +
      summary.edgesModified * weights.edgeModified;

    // Normalize to 0-100 using a logarithmic scale
    // This prevents very large changes from always being 100
    if (rawScore === 0) {
      return 0;
    }

    // Use log scale: score = 20 * log10(rawScore + 1), capped at 100
    const logScore = 20 * Math.log10(rawScore + 1);
    return Math.min(100, Math.round(logScore));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Options for creating a GraphDiffer instance.
 */
export interface GraphDifferFactoryOptions extends GraphDifferOptions {
  /**
   * Custom node matcher instance.
   * If not provided, a default matcher will be created.
   */
  nodeMatcher?: INodeMatcher;

  /**
   * Custom edge matcher instance.
   * If not provided, a default matcher will be created.
   */
  edgeMatcher?: IEdgeMatcher;
}

/**
 * Create a new GraphDiffer instance.
 *
 * @param options - Configuration options
 * @returns Configured GraphDiffer instance
 *
 * @example
 * ```typescript
 * // Default configuration
 * const differ = createGraphDiffer();
 *
 * // With custom options
 * const differ = createGraphDiffer({
 *   timeoutMs: 60000,
 *   maxNodes: 100000,
 *   ignoreFields: ['customField'],
 * });
 * ```
 */
export function createGraphDiffer(options?: GraphDifferFactoryOptions): IGraphDiffer {
  return new GraphDiffer(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a diff has any changes.
 *
 * @param diff - The diff to check
 * @returns True if the diff contains any changes
 *
 * @example
 * ```typescript
 * if (hasDiffChanges(diff)) {
 *   console.log('Changes detected');
 * }
 * ```
 */
export function hasDiffChanges(diff: GraphDiff): boolean {
  return (
    diff.nodes.added.length > 0 ||
    diff.nodes.removed.length > 0 ||
    diff.nodes.modified.length > 0 ||
    diff.edges.added.length > 0 ||
    diff.edges.removed.length > 0 ||
    diff.edges.modified.length > 0
  );
}

/**
 * Check if a diff is empty (no changes).
 *
 * @param diff - The diff to check
 * @returns True if the diff has no changes
 */
export function isDiffEmpty(diff: GraphDiff): boolean {
  return !hasDiffChanges(diff);
}

/**
 * Get the total number of changes in a diff.
 *
 * @param diff - The diff to count
 * @returns Total number of changes
 */
export function getTotalChanges(diff: GraphDiff): number {
  return (
    diff.nodes.added.length +
    diff.nodes.removed.length +
    diff.nodes.modified.length +
    diff.edges.added.length +
    diff.edges.removed.length +
    diff.edges.modified.length
  );
}

/**
 * Filter a diff to only include changes matching a predicate.
 *
 * @param diff - The diff to filter
 * @param nodeFilter - Predicate for filtering nodes
 * @param edgeFilter - Predicate for filtering edges
 * @returns Filtered diff
 *
 * @example
 * ```typescript
 * // Filter to only Terraform changes
 * const terraformDiff = filterDiff(
 *   diff,
 *   node => node.type.startsWith('terraform_'),
 *   edge => edge.type.startsWith('depends_')
 * );
 * ```
 */
export function filterDiff(
  diff: GraphDiff,
  nodeFilter?: (node: NodeType) => boolean,
  edgeFilter?: (edge: GraphEdge) => boolean
): GraphDiff {
  const filteredNodes = nodeFilter
    ? {
        added: diff.nodes.added.filter(nodeFilter),
        removed: diff.nodes.removed.filter(nodeFilter),
        modified: diff.nodes.modified.filter(mod =>
          nodeFilter((mod.after as NodeType) ?? (mod.before as NodeType))
        ),
      }
    : diff.nodes;

  const filteredEdges = edgeFilter
    ? {
        added: diff.edges.added.filter(edgeFilter),
        removed: diff.edges.removed.filter(edgeFilter),
        modified: diff.edges.modified.filter(mod =>
          edgeFilter((mod.after as GraphEdge) ?? (mod.before as GraphEdge))
        ),
      }
    : diff.edges;

  // Recalculate summary for filtered results
  const summary: DiffSummary = {
    nodesAdded: filteredNodes.added.length,
    nodesRemoved: filteredNodes.removed.length,
    nodesModified: filteredNodes.modified.length,
    edgesAdded: filteredEdges.added.length,
    edgesRemoved: filteredEdges.removed.length,
    edgesModified: filteredEdges.modified.length,
    impactAssessment: diff.summary.impactAssessment, // Keep original assessment
  };

  return {
    ...diff,
    nodes: filteredNodes,
    edges: filteredEdges,
    summary,
  };
}

/**
 * Merge multiple diffs into a single diff.
 * Useful for combining diffs from different time periods.
 *
 * @param diffs - Array of diffs to merge
 * @returns Merged diff
 *
 * @example
 * ```typescript
 * const combinedDiff = mergeDiffs([diff1, diff2, diff3]);
 * ```
 */
export function mergeDiffs(diffs: readonly GraphDiff[]): GraphDiff | null {
  if (diffs.length === 0) {
    return null;
  }

  // Use first diff as base - at this point we know length >= 1
  const first = diffs[0]!;

  if (diffs.length === 1) {
    return first;
  }

  // Get last diff for compareScanId
  const last = diffs[diffs.length - 1]!;

  // Merge all changes
  const mergedNodes = {
    added: diffs.flatMap(d => d.nodes.added),
    removed: diffs.flatMap(d => d.nodes.removed),
    modified: diffs.flatMap(d => d.nodes.modified),
  };

  const mergedEdges = {
    added: diffs.flatMap(d => d.edges.added),
    removed: diffs.flatMap(d => d.edges.removed),
    modified: diffs.flatMap(d => d.edges.modified),
  };

  // Calculate combined summary
  const summary: DiffSummary = {
    nodesAdded: mergedNodes.added.length,
    nodesRemoved: mergedNodes.removed.length,
    nodesModified: mergedNodes.modified.length,
    edgesAdded: mergedEdges.added.length,
    edgesRemoved: mergedEdges.removed.length,
    edgesModified: mergedEdges.modified.length,
    impactAssessment: calculateImpactLevel(
      {
        nodesAdded: mergedNodes.added.length,
        nodesRemoved: mergedNodes.removed.length,
        nodesModified: mergedNodes.modified.length,
        edgesAdded: mergedEdges.added.length,
        edgesRemoved: mergedEdges.removed.length,
        edgesModified: mergedEdges.modified.length,
      },
      // Estimate total based on first diff
      mergedNodes.added.length + mergedNodes.removed.length,
      mergedEdges.added.length + mergedEdges.removed.length
    ),
  };

  return {
    ...first,
    id: generateDiffId(first.baseScanId, last.compareScanId),
    compareScanId: last.compareScanId,
    nodes: mergedNodes,
    edges: mergedEdges,
    summary,
    computedAt: new Date(),
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { GraphDiff, DiffOptions, DiffSummary, ImpactLevel };
