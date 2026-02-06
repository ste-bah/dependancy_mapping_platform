/**
 * Graph Diff Engine for Graph Diff Computation
 * @module services/rollup/graph-diff/graph-diff-engine
 *
 * Core diff computation algorithm implementing two-phase approach:
 * Phase 1: Node diff - identify added/removed/modified nodes
 * Phase 2: Edge diff - identify added/removed edges
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: <5 seconds for 10K nodes, ~27MB memory budget
 */

import { TenantId } from '../../../types/entities.js';
import { NodeType, GraphEdge, EdgeType } from '../../../types/graph.js';
import { MergedNode } from '../../../types/rollup.js';
import {
  IGraphDiffEngine,
  GraphDiffResult,
  GraphDiffId,
  GraphSnapshot,
  GraphSnapshotId,
  GraphSnapshotRef,
  DiffComputationOptions,
  DiffCostEstimate,
  DiffValidationResult,
  DiffValidationError,
  DiffSummary,
  DiffTiming,
  NodeDiffSet,
  NodeDiff,
  EdgeDiffSet,
  EdgeDiff,
  NodeIdentityKey,
  EdgeIdentityKey,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
  GraphDiffError,
  GraphDiffErrorCodes,
  generateGraphDiffId,
  createEmptyNodeDiffSet,
  createEmptyEdgeDiffSet,
  createEmptyDiffSummary,
  createDefaultDiffTiming,
} from './interfaces.js';
import {
  NodeMatcher,
  NodeIdentityIndex,
  createNodeMatcher,
} from './node-matcher.js';
import {
  EdgeMatcher,
  EdgeIdentityIndex,
  createEdgeMatcher,
} from './edge-matcher.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Memory estimation constants for cost calculation.
 * Based on empirical measurements of Node.js object overhead.
 */
const MEMORY_CONSTANTS = {
  /** Approximate bytes per node in memory */
  BYTES_PER_NODE: 2048,
  /** Approximate bytes per edge in memory */
  BYTES_PER_EDGE: 512,
  /** Approximate bytes per identity index entry */
  BYTES_PER_INDEX_ENTRY: 256,
  /** Base memory overhead in bytes */
  BASE_OVERHEAD: 5 * 1024 * 1024, // 5MB
  /** Maximum memory budget in bytes (~27MB) */
  MAX_MEMORY_BUDGET: 27 * 1024 * 1024,
} as const;

/**
 * Timing estimation constants.
 */
const TIMING_CONSTANTS = {
  /** Nodes processed per millisecond (estimate) */
  NODES_PER_MS: 20,
  /** Edges processed per millisecond (estimate) */
  EDGES_PER_MS: 50,
  /** Overhead per operation in milliseconds */
  OPERATION_OVERHEAD_MS: 50,
} as const;

// ============================================================================
// Timing Tracker
// ============================================================================

/**
 * Helper class for tracking phase timing.
 */
class TimingTracker {
  private readonly startTime: number;
  private nodeIdentityExtractionMs = 0;
  private nodeComparisonMs = 0;
  private edgeIdentityExtractionMs = 0;
  private edgeComparisonMs = 0;
  private summaryComputationMs = 0;

  constructor() {
    this.startTime = performance.now();
  }

  recordNodeIdentityExtraction(durationMs: number): void {
    this.nodeIdentityExtractionMs = durationMs;
  }

  recordNodeComparison(durationMs: number): void {
    this.nodeComparisonMs = durationMs;
  }

  recordEdgeIdentityExtraction(durationMs: number): void {
    this.edgeIdentityExtractionMs = durationMs;
  }

  recordEdgeComparison(durationMs: number): void {
    this.edgeComparisonMs = durationMs;
  }

  recordSummaryComputation(durationMs: number): void {
    this.summaryComputationMs = durationMs;
  }

  finalize(totalNodes: number, totalEdges: number): DiffTiming {
    const totalMs = performance.now() - this.startTime;

    // Calculate throughput (avoid division by zero)
    const nodesPerSecond = totalMs > 0
      ? Math.round((totalNodes / totalMs) * 1000)
      : 0;
    const edgesPerSecond = totalMs > 0
      ? Math.round((totalEdges / totalMs) * 1000)
      : 0;

    return {
      totalMs: Math.round(totalMs),
      nodeIdentityExtractionMs: Math.round(this.nodeIdentityExtractionMs),
      nodeComparisonMs: Math.round(this.nodeComparisonMs),
      edgeIdentityExtractionMs: Math.round(this.edgeIdentityExtractionMs),
      edgeComparisonMs: Math.round(this.edgeComparisonMs),
      summaryComputationMs: Math.round(this.summaryComputationMs),
      nodesPerSecond,
      edgesPerSecond,
    };
  }
}

// ============================================================================
// GraphDiffEngine Implementation
// ============================================================================

/**
 * Core graph diff computation engine.
 * Implements two-phase algorithm for efficient diff computation.
 */
export class GraphDiffEngine implements IGraphDiffEngine {
  private readonly nodeMatcher: NodeMatcher;
  private readonly edgeMatcher: EdgeMatcher;
  private initialized = false;

  /**
   * Create a new GraphDiffEngine instance.
   *
   * @param nodeMatcher - Optional custom node matcher
   * @param edgeMatcher - Optional custom edge matcher
   */
  constructor(
    nodeMatcher?: NodeMatcher,
    edgeMatcher?: EdgeMatcher
  ) {
    this.nodeMatcher = nodeMatcher ?? createNodeMatcher();
    this.edgeMatcher = edgeMatcher ?? createEdgeMatcher();
  }

  // ============================================================================
  // IGraphDiffEngine Implementation
  // ============================================================================

  /**
   * Initialize the engine.
   * Currently a no-op but allows for future async initialization.
   */
  async initialize(): Promise<void> {
    this.initialized = true;
  }

  /**
   * Shutdown the engine gracefully.
   * Currently a no-op but allows for future cleanup.
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  /**
   * Compute differences between two graph snapshots.
   *
   * @param baseSnapshot - The base (older) snapshot
   * @param targetSnapshot - The target (newer) snapshot
   * @param options - Computation options
   * @returns Complete diff result
   */
  async computeDiff(
    baseSnapshot: GraphSnapshot,
    targetSnapshot: GraphSnapshot,
    options?: DiffComputationOptions
  ): Promise<GraphDiffResult> {
    // Validate snapshots first
    const validation = this.validateSnapshots(baseSnapshot, targetSnapshot);
    if (!validation.isValid) {
      const firstError = validation.errors[0];
      throw new GraphDiffError(
        firstError?.message ?? 'Snapshot validation failed',
        GraphDiffErrorCodes.INVALID_SNAPSHOT,
        { errors: validation.errors }
      );
    }

    // Merge options with defaults
    const mergedOptions = this.mergeOptions(options);

    // Check limits
    this.checkLimits(baseSnapshot, targetSnapshot, mergedOptions);

    // Create timing tracker
    const timing = new TimingTracker();

    // Set up timeout if specified
    const timeoutMs = mergedOptions.timeoutMs;
    const startTime = Date.now();

    const checkTimeout = (): void => {
      if (timeoutMs && (Date.now() - startTime) > timeoutMs) {
        throw GraphDiffError.timeout(timeoutMs, Date.now() - startTime);
      }
    };

    // Phase 1: Compute node diffs
    const nodeDiffs = await this.computeNodeDiffs(
      baseSnapshot.graph.nodes,
      targetSnapshot.graph.nodes,
      mergedOptions,
      timing,
      checkTimeout
    );

    // Phase 2: Compute edge diffs
    const edgeDiffs = await this.computeEdgeDiffs(
      baseSnapshot.graph.edges,
      targetSnapshot.graph.edges,
      nodeDiffs.baseIndex,
      nodeDiffs.targetIndex,
      mergedOptions,
      timing,
      checkTimeout
    );

    // Compute summary statistics
    const summaryStart = performance.now();
    const summary = this.computeSummary(
      nodeDiffs.diffSet,
      edgeDiffs.diffSet,
      mergedOptions
    );
    timing.recordSummaryComputation(performance.now() - summaryStart);

    // Finalize timing
    const totalNodes = baseSnapshot.graph.nodes.size + targetSnapshot.graph.nodes.size;
    const totalEdges = baseSnapshot.graph.edges.length + targetSnapshot.graph.edges.length;
    const finalTiming = timing.finalize(totalNodes, totalEdges);

    // Generate diff ID
    const diffId = generateGraphDiffId(baseSnapshot.id, targetSnapshot.id);

    // Build result
    const result: GraphDiffResult = {
      id: diffId,
      tenantId: baseSnapshot.tenantId,
      baseSnapshotId: baseSnapshot.id,
      targetSnapshotId: targetSnapshot.id,
      nodeDiffs: nodeDiffs.diffSet,
      edgeDiffs: edgeDiffs.diffSet,
      summary,
      timing: finalTiming,
      computedAt: new Date(),
      options: mergedOptions,
    };

    return result;
  }

  /**
   * Compute differences using snapshot references.
   * This is a placeholder that would typically load snapshots from storage.
   *
   * @param tenantId - Tenant identifier
   * @param baseSnapshotId - Base snapshot identifier
   * @param targetSnapshotId - Target snapshot identifier
   * @param options - Computation options
   * @returns Complete diff result
   */
  async computeDiffByIds(
    tenantId: TenantId,
    baseSnapshotId: GraphSnapshotId,
    targetSnapshotId: GraphSnapshotId,
    options?: DiffComputationOptions
  ): Promise<GraphDiffResult> {
    // This method would typically load snapshots from a snapshot store
    // For now, throw an error indicating snapshots need to be loaded externally
    throw GraphDiffError.snapshotNotFound(
      `${baseSnapshotId} or ${targetSnapshotId}`,
      tenantId
    );
  }

  /**
   * Get a cached diff result if available.
   * Placeholder for cache integration.
   *
   * @param tenantId - Tenant identifier
   * @param diffId - Diff identifier
   * @returns Cached diff or null
   */
  async getCachedDiff(
    tenantId: TenantId,
    diffId: GraphDiffId
  ): Promise<GraphDiffResult | null> {
    // Cache integration would go here
    // For now, always return null (cache miss)
    return null;
  }

  /**
   * Apply diff to update merged nodes incrementally.
   *
   * @param diff - Previously computed diff
   * @param mergedNodes - Current merged nodes to update
   * @returns Updated merged nodes
   */
  async applyDiffToMergedGraph(
    diff: GraphDiffResult,
    mergedNodes: readonly MergedNode[]
  ): Promise<readonly MergedNode[]> {
    // Create a mutable copy
    const updated = [...mergedNodes];

    // Build lookup map for efficient updates
    const nodeMap = new Map<string, number>();
    for (let i = 0; i < updated.length; i++) {
      const node = updated[i];
      if (node) {
        nodeMap.set(node.id, i);
      }
    }

    // Process removed nodes
    const idsToRemove = new Set<string>();
    for (const removedDiff of diff.nodeDiffs.removed) {
      idsToRemove.add(removedDiff.identity.nodeId);
    }

    // Filter out removed nodes
    const afterRemoval = updated.filter((node) => !idsToRemove.has(node.id));

    // Process added nodes - would need additional merge logic
    // For now, just return the filtered list
    // Full implementation would create new MergedNodes from added nodes

    return afterRemoval;
  }

  /**
   * Estimate computation cost without performing the diff.
   *
   * @param baseSnapshot - Base snapshot reference
   * @param targetSnapshot - Target snapshot reference
   * @returns Estimated cost and timing
   */
  estimateCost(
    baseSnapshot: GraphSnapshotRef,
    targetSnapshot: GraphSnapshotRef
  ): DiffCostEstimate {
    const totalNodes = baseSnapshot.nodeCount + targetSnapshot.nodeCount;
    const totalEdges = baseSnapshot.edgeCount + targetSnapshot.edgeCount;

    // Estimate time
    const estimatedTimeMs = Math.ceil(
      (totalNodes / TIMING_CONSTANTS.NODES_PER_MS) +
      (totalEdges / TIMING_CONSTANTS.EDGES_PER_MS) +
      TIMING_CONSTANTS.OPERATION_OVERHEAD_MS
    );

    // Estimate memory
    const estimatedMemoryBytes =
      MEMORY_CONSTANTS.BASE_OVERHEAD +
      (totalNodes * MEMORY_CONSTANTS.BYTES_PER_NODE) +
      (totalEdges * MEMORY_CONSTANTS.BYTES_PER_EDGE) +
      (totalNodes * MEMORY_CONSTANTS.BYTES_PER_INDEX_ENTRY);

    // Check if within limits
    const withinLimits = estimatedMemoryBytes <= MEMORY_CONSTANTS.MAX_MEMORY_BUDGET;

    // Generate warnings
    const warnings: string[] = [];

    if (estimatedMemoryBytes > MEMORY_CONSTANTS.MAX_MEMORY_BUDGET * 0.8) {
      warnings.push(
        `Estimated memory usage (${Math.round(estimatedMemoryBytes / 1024 / 1024)}MB) ` +
        `is approaching limit (${Math.round(MEMORY_CONSTANTS.MAX_MEMORY_BUDGET / 1024 / 1024)}MB)`
      );
    }

    if (estimatedTimeMs > 5000) {
      warnings.push(
        `Estimated computation time (${estimatedTimeMs}ms) exceeds 5 second target`
      );
    }

    if (totalNodes > DEFAULT_DIFF_COMPUTATION_OPTIONS.maxNodes) {
      warnings.push(
        `Total nodes (${totalNodes}) exceeds default limit (${DEFAULT_DIFF_COMPUTATION_OPTIONS.maxNodes})`
      );
    }

    return {
      estimatedTimeMs,
      estimatedMemoryBytes,
      totalNodes,
      totalEdges,
      withinLimits,
      warnings,
    };
  }

  /**
   * Validate that diff computation can proceed.
   *
   * @param baseSnapshot - Base snapshot
   * @param targetSnapshot - Target snapshot
   * @returns Validation result
   */
  validateSnapshots(
    baseSnapshot: GraphSnapshot,
    targetSnapshot: GraphSnapshot
  ): DiffValidationResult {
    const errors: DiffValidationError[] = [];
    const warnings: string[] = [];

    // Check tenant match
    if (baseSnapshot.tenantId !== targetSnapshot.tenantId) {
      errors.push({
        code: GraphDiffErrorCodes.TENANT_MISMATCH,
        message: `Tenant mismatch: base=${baseSnapshot.tenantId}, target=${targetSnapshot.tenantId}`,
        snapshot: 'both',
      });
    }

    // Check base snapshot has valid graph
    if (!baseSnapshot.graph) {
      errors.push({
        code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
        message: 'Base snapshot is missing graph property',
        snapshot: 'base',
      });
    } else {
      if (!baseSnapshot.graph.nodes) {
        errors.push({
          code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
          message: 'Base snapshot graph is missing nodes',
          snapshot: 'base',
        });
      }
      if (!baseSnapshot.graph.edges) {
        errors.push({
          code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
          message: 'Base snapshot graph is missing edges',
          snapshot: 'base',
        });
      }
    }

    // Check target snapshot has valid graph
    if (!targetSnapshot.graph) {
      errors.push({
        code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
        message: 'Target snapshot is missing graph property',
        snapshot: 'target',
      });
    } else {
      if (!targetSnapshot.graph.nodes) {
        errors.push({
          code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
          message: 'Target snapshot graph is missing nodes',
          snapshot: 'target',
        });
      }
      if (!targetSnapshot.graph.edges) {
        errors.push({
          code: GraphDiffErrorCodes.INVALID_SNAPSHOT,
          message: 'Target snapshot graph is missing edges',
          snapshot: 'target',
        });
      }
    }

    // Add warnings for version ordering
    if (baseSnapshot.version >= targetSnapshot.version) {
      warnings.push(
        `Base snapshot version (${baseSnapshot.version}) >= target version (${targetSnapshot.version}). ` +
        'This may indicate the snapshots are in wrong order.'
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Private Methods - Phase 1: Node Diff
  // ============================================================================

  /**
   * Compute node differences between base and target graphs.
   *
   * @param baseNodes - Nodes from base snapshot
   * @param targetNodes - Nodes from target snapshot
   * @param options - Computation options
   * @param timing - Timing tracker
   * @param checkTimeout - Timeout check function
   * @returns Node diff set and identity indexes
   */
  private async computeNodeDiffs(
    baseNodes: Map<string, NodeType>,
    targetNodes: Map<string, NodeType>,
    options: Required<DiffComputationOptions>,
    timing: TimingTracker,
    checkTimeout: () => void
  ): Promise<{
    diffSet: NodeDiffSet;
    baseIndex: NodeIdentityIndex;
    targetIndex: NodeIdentityIndex;
  }> {
    // Apply node type filters
    const filteredBaseNodes = this.filterNodes(baseNodes, options);
    const filteredTargetNodes = this.filterNodes(targetNodes, options);

    // Build indexes - Phase 1a
    const indexStart = performance.now();

    const baseIndex = this.nodeMatcher.buildIndex(filteredBaseNodes);
    checkTimeout();

    const targetIndex = this.nodeMatcher.buildIndex(filteredTargetNodes);
    checkTimeout();

    timing.recordNodeIdentityExtraction(performance.now() - indexStart);

    // Compare nodes - Phase 1b
    const comparisonStart = performance.now();

    const added: NodeDiff[] = [];
    const removed: NodeDiff[] = [];
    const modified: NodeDiff[] = [];
    const unchanged: NodeDiff[] = [];
    const byIdentityKey = new Map<NodeIdentityKey, NodeDiff>();

    // Find added and modified nodes (in target, check if in base)
    for (const targetIdentity of targetIndex.identities) {
      checkTimeout();

      const baseNode = baseIndex.byIdentityKey.get(targetIdentity.key);
      const targetNode = targetIndex.byIdentityKey.get(targetIdentity.key);

      if (!targetNode) {
        continue; // Should not happen, but be defensive
      }

      if (!baseNode) {
        // Node is in target but not in base -> added
        const diff: NodeDiff = {
          changeType: 'added',
          identity: targetIdentity,
          baseNode: null,
          targetNode,
        };
        added.push(diff);
        byIdentityKey.set(targetIdentity.key, diff);
      } else {
        // Node exists in both - check for modifications
        const attributeChanges = options.includeAttributeChanges
          ? this.nodeMatcher.compareNodes(baseNode, targetNode)
          : [];

        if (attributeChanges.length > 0) {
          // Node was modified
          const diff: NodeDiff = {
            changeType: 'modified',
            identity: targetIdentity,
            baseNode,
            targetNode,
            attributeChanges: [...attributeChanges],
          };
          modified.push(diff);
          byIdentityKey.set(targetIdentity.key, diff);
        } else if (options.includeUnchanged) {
          // Node is unchanged
          const diff: NodeDiff = {
            changeType: 'unchanged',
            identity: targetIdentity,
            baseNode,
            targetNode,
          };
          unchanged.push(diff);
          byIdentityKey.set(targetIdentity.key, diff);
        }
      }
    }

    // Find removed nodes (in base but not in target)
    for (const baseIdentity of baseIndex.identities) {
      checkTimeout();

      const targetNode = targetIndex.byIdentityKey.get(baseIdentity.key);

      if (!targetNode) {
        // Node is in base but not in target -> removed
        const baseNode = baseIndex.byIdentityKey.get(baseIdentity.key);
        if (baseNode) {
          const diff: NodeDiff = {
            changeType: 'removed',
            identity: baseIdentity,
            baseNode,
            targetNode: null,
          };
          removed.push(diff);
          byIdentityKey.set(baseIdentity.key, diff);
        }
      }
    }

    timing.recordNodeComparison(performance.now() - comparisonStart);

    const diffSet: NodeDiffSet = {
      added,
      removed,
      modified,
      unchanged,
      baseNodeCount: filteredBaseNodes.size,
      targetNodeCount: filteredTargetNodes.size,
      byIdentityKey,
    };

    return { diffSet, baseIndex, targetIndex };
  }

  // ============================================================================
  // Private Methods - Phase 2: Edge Diff
  // ============================================================================

  /**
   * Compute edge differences between base and target graphs.
   * Edges are considered either present or absent (no "modified" state).
   *
   * @param baseEdges - Edges from base snapshot
   * @param targetEdges - Edges from target snapshot
   * @param baseNodeIndex - Node identity index for base
   * @param targetNodeIndex - Node identity index for target
   * @param options - Computation options
   * @param timing - Timing tracker
   * @param checkTimeout - Timeout check function
   * @returns Edge diff set
   */
  private async computeEdgeDiffs(
    baseEdges: readonly GraphEdge[],
    targetEdges: readonly GraphEdge[],
    baseNodeIndex: NodeIdentityIndex,
    targetNodeIndex: NodeIdentityIndex,
    options: Required<DiffComputationOptions>,
    timing: TimingTracker,
    checkTimeout: () => void
  ): Promise<{ diffSet: EdgeDiffSet }> {
    // Apply edge type filters
    const filteredBaseEdges = this.filterEdges(baseEdges, options);
    const filteredTargetEdges = this.filterEdges(targetEdges, options);

    // Build indexes - Phase 2a
    const indexStart = performance.now();

    const baseEdgeIndex = this.edgeMatcher.buildIndex(filteredBaseEdges, baseNodeIndex);
    checkTimeout();

    const targetEdgeIndex = this.edgeMatcher.buildIndex(filteredTargetEdges, targetNodeIndex);
    checkTimeout();

    timing.recordEdgeIdentityExtraction(performance.now() - indexStart);

    // Compare edges - Phase 2b
    const comparisonStart = performance.now();

    const added: EdgeDiff[] = [];
    const removed: EdgeDiff[] = [];
    const modified: EdgeDiff[] = []; // Kept for interface compatibility
    const unchanged: EdgeDiff[] = [];
    const byIdentityKey = new Map<EdgeIdentityKey, EdgeDiff>();

    // Find added edges (in target but not in base)
    for (const targetIdentity of targetEdgeIndex.identities) {
      checkTimeout();

      const baseEdge = baseEdgeIndex.byIdentityKey.get(targetIdentity.key);
      const targetEdge = targetEdgeIndex.byIdentityKey.get(targetIdentity.key);

      if (!targetEdge) {
        continue; // Should not happen
      }

      if (!baseEdge) {
        // Edge is in target but not in base -> added
        const diff: EdgeDiff = {
          changeType: 'added',
          identity: targetIdentity,
          baseEdge: null,
          targetEdge,
        };
        added.push(diff);
        byIdentityKey.set(targetIdentity.key, diff);
      } else if (options.includeUnchanged) {
        // Edge exists in both -> unchanged (edges don't have "modified" state)
        const diff: EdgeDiff = {
          changeType: 'unchanged',
          identity: targetIdentity,
          baseEdge,
          targetEdge,
        };
        unchanged.push(diff);
        byIdentityKey.set(targetIdentity.key, diff);
      }
    }

    // Find removed edges (in base but not in target)
    for (const baseIdentity of baseEdgeIndex.identities) {
      checkTimeout();

      const targetEdge = targetEdgeIndex.byIdentityKey.get(baseIdentity.key);

      if (!targetEdge) {
        // Edge is in base but not in target -> removed
        const baseEdge = baseEdgeIndex.byIdentityKey.get(baseIdentity.key);
        if (baseEdge) {
          const diff: EdgeDiff = {
            changeType: 'removed',
            identity: baseIdentity,
            baseEdge,
            targetEdge: null,
          };
          removed.push(diff);
          byIdentityKey.set(baseIdentity.key, diff);
        }
      }
    }

    timing.recordEdgeComparison(performance.now() - comparisonStart);

    const diffSet: EdgeDiffSet = {
      added,
      removed,
      modified,
      unchanged,
      baseEdgeCount: filteredBaseEdges.length,
      targetEdgeCount: filteredTargetEdges.length,
      byIdentityKey,
    };

    return { diffSet };
  }

  // ============================================================================
  // Private Methods - Summary Computation
  // ============================================================================

  /**
   * Compute summary statistics from node and edge diffs.
   *
   * @param nodeDiffs - Node diff set
   * @param edgeDiffs - Edge diff set
   * @param options - Computation options
   * @returns Diff summary
   */
  private computeSummary(
    nodeDiffs: NodeDiffSet,
    edgeDiffs: EdgeDiffSet,
    options: Required<DiffComputationOptions>
  ): DiffSummary {
    // Node counts
    const nodesAdded = nodeDiffs.added.length;
    const nodesRemoved = nodeDiffs.removed.length;
    const nodesModified = nodeDiffs.modified.length;
    const nodesUnchanged = nodeDiffs.unchanged.length;

    // Edge counts
    const edgesAdded = edgeDiffs.added.length;
    const edgesRemoved = edgeDiffs.removed.length;
    const edgesModified = edgeDiffs.modified.length;
    const edgesUnchanged = edgeDiffs.unchanged.length;

    // Calculate change ratios
    const totalBaseNodes = nodeDiffs.baseNodeCount;
    const totalTargetNodes = nodeDiffs.targetNodeCount;
    const totalBaseEdges = edgeDiffs.baseEdgeCount;
    const totalTargetEdges = edgeDiffs.targetEdgeCount;

    // Node change ratio: changed nodes / max(base, target) nodes
    const maxNodes = Math.max(totalBaseNodes, totalTargetNodes);
    const nodeChangeRatio = maxNodes > 0
      ? (nodesAdded + nodesRemoved + nodesModified) / maxNodes
      : 0;

    // Edge change ratio: changed edges / max(base, target) edges
    const maxEdges = Math.max(totalBaseEdges, totalTargetEdges);
    const edgeChangeRatio = maxEdges > 0
      ? (edgesAdded + edgesRemoved + edgesModified) / maxEdges
      : 0;

    // Overall change ratio (weighted average)
    const totalElements = maxNodes + maxEdges;
    const overallChangeRatio = totalElements > 0
      ? ((nodesAdded + nodesRemoved + nodesModified) +
         (edgesAdded + edgesRemoved + edgesModified)) / totalElements
      : 0;

    // Determine if change is significant
    const isSignificantChange = overallChangeRatio >= options.significantChangeThreshold;

    // Compute changes by node type
    const changesByNodeType: Record<string, { added: number; removed: number; modified: number }> = {};

    for (const diff of nodeDiffs.added) {
      const nodeType = diff.identity.nodeType;
      if (!changesByNodeType[nodeType]) {
        changesByNodeType[nodeType] = { added: 0, removed: 0, modified: 0 };
      }
      const entry = changesByNodeType[nodeType];
      if (entry) {
        entry.added++;
      }
    }

    for (const diff of nodeDiffs.removed) {
      const nodeType = diff.identity.nodeType;
      if (!changesByNodeType[nodeType]) {
        changesByNodeType[nodeType] = { added: 0, removed: 0, modified: 0 };
      }
      const entry = changesByNodeType[nodeType];
      if (entry) {
        entry.removed++;
      }
    }

    for (const diff of nodeDiffs.modified) {
      const nodeType = diff.identity.nodeType;
      if (!changesByNodeType[nodeType]) {
        changesByNodeType[nodeType] = { added: 0, removed: 0, modified: 0 };
      }
      const entry = changesByNodeType[nodeType];
      if (entry) {
        entry.modified++;
      }
    }

    // Compute changes by edge type
    const changesByEdgeType: Partial<Record<EdgeType, { added: number; removed: number; modified: number }>> = {};

    for (const diff of edgeDiffs.added) {
      const edgeType = diff.identity.edgeType;
      if (!changesByEdgeType[edgeType]) {
        changesByEdgeType[edgeType] = { added: 0, removed: 0, modified: 0 };
      }
      const entry = changesByEdgeType[edgeType];
      if (entry) {
        entry.added++;
      }
    }

    for (const diff of edgeDiffs.removed) {
      const edgeType = diff.identity.edgeType;
      if (!changesByEdgeType[edgeType]) {
        changesByEdgeType[edgeType] = { added: 0, removed: 0, modified: 0 };
      }
      const entry = changesByEdgeType[edgeType];
      if (entry) {
        entry.removed++;
      }
    }

    return {
      baseNodeCount: totalBaseNodes,
      targetNodeCount: totalTargetNodes,
      nodesAdded,
      nodesRemoved,
      nodesModified,
      nodesUnchanged,
      baseEdgeCount: totalBaseEdges,
      targetEdgeCount: totalTargetEdges,
      edgesAdded,
      edgesRemoved,
      edgesModified,
      edgesUnchanged,
      nodeChangeRatio,
      edgeChangeRatio,
      overallChangeRatio,
      isSignificantChange,
      changesByNodeType: Object.freeze(changesByNodeType),
      changesByEdgeType: Object.freeze(changesByEdgeType),
    };
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  /**
   * Merge user options with defaults.
   *
   * @param options - User-provided options
   * @returns Merged options
   */
  private mergeOptions(
    options?: DiffComputationOptions
  ): Required<DiffComputationOptions> {
    if (!options) {
      return { ...DEFAULT_DIFF_COMPUTATION_OPTIONS };
    }

    return {
      includeUnchanged: options.includeUnchanged ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.includeUnchanged,
      includeAttributeChanges: options.includeAttributeChanges ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.includeAttributeChanges,
      significantChangeThreshold: options.significantChangeThreshold ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.significantChangeThreshold,
      includeNodeTypes: options.includeNodeTypes ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.includeNodeTypes,
      excludeNodeTypes: options.excludeNodeTypes ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.excludeNodeTypes,
      includeEdgeTypes: options.includeEdgeTypes ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.includeEdgeTypes,
      excludeEdgeTypes: options.excludeEdgeTypes ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.excludeEdgeTypes,
      maxNodes: options.maxNodes ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.maxNodes,
      maxEdges: options.maxEdges ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.maxEdges,
      enableParallelProcessing: options.enableParallelProcessing ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.enableParallelProcessing,
      batchSize: options.batchSize ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.batchSize,
      timeoutMs: options.timeoutMs ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.timeoutMs,
      enableCaching: options.enableCaching ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.enableCaching,
      cacheTtlSeconds: options.cacheTtlSeconds ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.cacheTtlSeconds,
      identityConfig: options.identityConfig ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.identityConfig,
    };
  }

  /**
   * Check that snapshots are within configured limits.
   *
   * @param baseSnapshot - Base snapshot
   * @param targetSnapshot - Target snapshot
   * @param options - Computation options
   * @throws GraphDiffError if limits are exceeded
   */
  private checkLimits(
    baseSnapshot: GraphSnapshot,
    targetSnapshot: GraphSnapshot,
    options: Required<DiffComputationOptions>
  ): void {
    const totalNodes = baseSnapshot.graph.nodes.size + targetSnapshot.graph.nodes.size;
    const totalEdges = baseSnapshot.graph.edges.length + targetSnapshot.graph.edges.length;

    if (totalNodes > options.maxNodes * 2) {
      throw GraphDiffError.maxNodesExceeded(totalNodes, options.maxNodes * 2);
    }

    if (totalEdges > options.maxEdges * 2) {
      throw new GraphDiffError(
        `Maximum edge count exceeded: ${totalEdges} > ${options.maxEdges * 2}`,
        GraphDiffErrorCodes.MAX_EDGES_EXCEEDED,
        { edgeCount: totalEdges, maxEdges: options.maxEdges * 2 }
      );
    }
  }

  /**
   * Filter nodes based on include/exclude options.
   *
   * @param nodes - Nodes to filter
   * @param options - Computation options
   * @returns Filtered nodes map
   */
  private filterNodes(
    nodes: Map<string, NodeType>,
    options: Required<DiffComputationOptions>
  ): Map<string, NodeType> {
    const includeTypes = options.includeNodeTypes;
    const excludeTypes = options.excludeNodeTypes;

    // If no filters, return original map
    if ((!includeTypes || includeTypes.length === 0) &&
        (!excludeTypes || excludeTypes.length === 0)) {
      return nodes;
    }

    const filtered = new Map<string, NodeType>();

    // Use Array.from for compatibility
    const entries = Array.from(nodes.entries());
    for (const [id, node] of entries) {
      // Check include filter
      if (includeTypes && includeTypes.length > 0) {
        if (!includeTypes.includes(node.type)) {
          continue;
        }
      }

      // Check exclude filter
      if (excludeTypes && excludeTypes.length > 0) {
        if (excludeTypes.includes(node.type)) {
          continue;
        }
      }

      filtered.set(id, node);
    }

    return filtered;
  }

  /**
   * Filter edges based on include/exclude options.
   *
   * @param edges - Edges to filter
   * @param options - Computation options
   * @returns Filtered edges array
   */
  private filterEdges(
    edges: readonly GraphEdge[],
    options: Required<DiffComputationOptions>
  ): readonly GraphEdge[] {
    const includeTypes = options.includeEdgeTypes;
    const excludeTypes = options.excludeEdgeTypes;

    // If no filters, return original array
    if ((!includeTypes || includeTypes.length === 0) &&
        (!excludeTypes || excludeTypes.length === 0)) {
      return edges;
    }

    return edges.filter((edge) => {
      // Check include filter
      if (includeTypes && includeTypes.length > 0) {
        if (!includeTypes.includes(edge.type)) {
          return false;
        }
      }

      // Check exclude filter
      if (excludeTypes && excludeTypes.length > 0) {
        if (excludeTypes.includes(edge.type)) {
          return false;
        }
      }

      return true;
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new GraphDiffEngine with default configuration.
 *
 * @returns New GraphDiffEngine instance
 */
export function createGraphDiffEngine(): GraphDiffEngine {
  return new GraphDiffEngine();
}

/**
 * Create a GraphDiffEngine with custom matchers.
 *
 * @param nodeMatcher - Custom node matcher
 * @param edgeMatcher - Custom edge matcher
 * @returns Configured GraphDiffEngine instance
 */
export function createConfiguredGraphDiffEngine(
  nodeMatcher: NodeMatcher,
  edgeMatcher: EdgeMatcher
): GraphDiffEngine {
  return new GraphDiffEngine(nodeMatcher, edgeMatcher);
}

/**
 * Create a GraphDiffEngine optimized for Kubernetes graphs.
 *
 * @returns GraphDiffEngine with K8s-optimized matchers
 */
export function createK8sGraphDiffEngine(): GraphDiffEngine {
  const nodeMatcher = createNodeMatcher();
  nodeMatcher.configure({
    useNamespace: true,
    useRepositoryId: true,
    customAttributes: ['selector', 'replicas', 'namespace'],
  });

  return new GraphDiffEngine(nodeMatcher, createEdgeMatcher());
}

/**
 * Create a GraphDiffEngine optimized for Terraform graphs.
 *
 * @returns GraphDiffEngine with Terraform-optimized matchers
 */
export function createTerraformGraphDiffEngine(): GraphDiffEngine {
  const nodeMatcher = createNodeMatcher();
  nodeMatcher.configure({
    useNamespace: false,
    useRepositoryId: true,
    customAttributes: ['provider', 'resourceType', 'source'],
  });

  return new GraphDiffEngine(nodeMatcher, createEdgeMatcher());
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  MEMORY_CONSTANTS,
  TIMING_CONSTANTS,
};
