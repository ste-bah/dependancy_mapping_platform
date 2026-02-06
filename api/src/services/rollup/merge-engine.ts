/**
 * Merge Engine
 * @module services/rollup/merge-engine
 *
 * Engine for merging matched nodes from multiple repositories into unified representations.
 * Handles conflict resolution, source metadata preservation, and cross-repo edge creation.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation merge engine
 */

import { randomUUID } from 'crypto';
import {
  RollupConfig,
  MatchResult,
  MergedNode,
  MatchingStrategy,
} from '../../types/rollup.js';
import {
  NodeType,
  GraphEdge,
  NodeLocation,
} from '../../types/graph.js';
import {
  IMergeEngine,
  MergeInput,
  MergeOutput,
  ConfigurationValidationResult,
  ValidationError,
  ValidationWarning,
} from './interfaces.js';
import { RollupMergeError } from './errors.js';

/**
 * Conflict resolution strategy
 */
type ConflictResolution = 'first' | 'last' | 'merge' | 'error';

/**
 * Internal representation of a node group to be merged
 */
interface NodeGroup {
  /** Primary node (first in group) */
  readonly primaryNode: NodeType;
  /** All nodes in this group */
  readonly nodes: NodeType[];
  /** Repository IDs */
  readonly repositoryIds: string[];
  /** Scan IDs */
  readonly scanIds: string[];
  /** Matches that linked these nodes */
  readonly matches: MatchResult[];
  /** Highest confidence match */
  readonly maxConfidence: number;
  /** Strategy that produced the best match */
  readonly bestStrategy: MatchingStrategy;
}

/**
 * Merge conflict information
 */
interface MergeConflict {
  /** Attribute that conflicted */
  readonly attribute: string;
  /** Values from different sources */
  readonly values: Array<{
    value: unknown;
    repositoryId: string;
    scanId: string;
  }>;
  /** How it was resolved */
  readonly resolution: ConflictResolution;
  /** Resolved value */
  readonly resolvedValue: unknown;
}

/**
 * Engine for merging matched nodes from multiple repositories.
 * Implements various conflict resolution strategies and preserves source metadata.
 */
export class MergeEngine implements IMergeEngine {
  /**
   * Merge multiple graphs based on match results.
   *
   * @param input - Merge input containing graphs and matches
   * @returns Merge output with combined graph elements
   */
  merge(input: MergeInput): MergeOutput {
    // Validate input
    const validation = this.validateInput(input);
    if (!validation.isValid) {
      const errorMessages = validation.errors.map((e) => e.message).join('; ');
      throw new RollupMergeError(`Invalid merge input: ${errorMessages}`);
    }

    // Track statistics
    let nodesBeforeMerge = 0;
    let edgesBeforeMerge = 0;
    let conflictsEncountered = 0;
    let conflictsResolved = 0;

    // Collect all nodes and edges
    const allNodes: Map<string, { node: NodeType; repoId: string; scanId: string }> =
      new Map();
    const allEdges: GraphEdge[] = [];

    for (const graphData of input.graphs) {
      const { graph, repositoryId, scanId } = graphData;

      for (const [nodeId, node] of graph.nodes) {
        allNodes.set(`${repositoryId}:${nodeId}`, {
          node,
          repoId: repositoryId,
          scanId,
        });
        nodesBeforeMerge++;
      }

      for (const edge of graph.edges) {
        allEdges.push(edge);
        edgesBeforeMerge++;
      }
    }

    // Build node groups from matches
    const nodeGroups = this.buildNodeGroups(input.matches, allNodes);

    // Merge each group into a single node
    const mergedNodes: MergedNode[] = [];
    const mergedNodeIdMap: Map<string, string> = new Map(); // original -> merged

    for (const group of nodeGroups) {
      try {
        const { mergedNode, conflicts } = this.mergeNodeGroup(
          group,
          input.options.conflictResolution
        );
        mergedNodes.push(mergedNode);

        // Track conflicts
        conflictsEncountered += conflicts.length;
        conflictsResolved += conflicts.length;

        // Update ID mapping for edge remapping
        for (const originalNode of group.nodes) {
          mergedNodeIdMap.set(
            `${group.repositoryIds[group.nodes.indexOf(originalNode)]}:${originalNode.id}`,
            mergedNode.id
          );
        }
      } catch (error) {
        if (error instanceof RollupMergeError) {
          throw error;
        }
        throw new RollupMergeError(
          `Failed to merge node group: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { nodeIds: group.nodes.map((n) => n.id) }
        );
      }
    }

    // Find unmatched nodes
    const matchedNodeKeys = new Set(mergedNodeIdMap.keys());
    const unmatchedNodes: NodeType[] = [];

    for (const [key, { node }] of allNodes) {
      if (!matchedNodeKeys.has(key)) {
        unmatchedNodes.push(node);
        // Map unmatched nodes to themselves
        mergedNodeIdMap.set(key, node.id);
      }
    }

    // Remap edges and create cross-repo edges
    const { edges, crossRepoEdgeCount } = this.remapEdges(
      allEdges,
      mergedNodeIdMap,
      input.graphs,
      input.options.createCrossRepoEdges ?? true,
      input.options.preserveSourceInfo ?? true
    );

    return {
      mergedNodes,
      edges,
      unmatchedNodes,
      stats: {
        nodesBeforeMerge,
        nodesAfterMerge: mergedNodes.length + unmatchedNodes.length,
        edgesBeforeMerge,
        edgesAfterMerge: edges.length,
        crossRepoEdges: crossRepoEdgeCount,
        conflicts: conflictsEncountered,
        conflictsResolved,
      },
    };
  }

  /**
   * Validate merge input.
   *
   * @param input - Input to validate
   * @returns Validation result
   */
  validateInput(input: MergeInput): ConfigurationValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Must have at least 2 graphs
    if (!input.graphs || input.graphs.length < 2) {
      errors.push({
        code: 'INSUFFICIENT_GRAPHS',
        message: 'At least 2 graphs are required for merging',
        path: 'graphs',
      });
    }

    // Validate graphs
    if (input.graphs) {
      for (let i = 0; i < input.graphs.length; i++) {
        const graphData = input.graphs[i];

        if (!graphData.graph) {
          errors.push({
            code: 'MISSING_GRAPH',
            message: `Graph at index ${i} is missing`,
            path: `graphs[${i}].graph`,
          });
        }

        if (!graphData.repositoryId) {
          errors.push({
            code: 'MISSING_REPOSITORY_ID',
            message: `Repository ID at index ${i} is missing`,
            path: `graphs[${i}].repositoryId`,
          });
        }

        if (!graphData.scanId) {
          errors.push({
            code: 'MISSING_SCAN_ID',
            message: `Scan ID at index ${i} is missing`,
            path: `graphs[${i}].scanId`,
          });
        }
      }
    }

    // Validate matches
    if (!input.matches) {
      warnings.push({
        code: 'NO_MATCHES',
        message: 'No matches provided, merge will only combine unmatched nodes',
        path: 'matches',
      });
    }

    // Validate options
    if (input.options) {
      const validResolutions: ConflictResolution[] = ['first', 'last', 'merge', 'error'];
      if (
        input.options.conflictResolution &&
        !validResolutions.includes(input.options.conflictResolution)
      ) {
        errors.push({
          code: 'INVALID_CONFLICT_RESOLUTION',
          message: `Invalid conflict resolution: ${input.options.conflictResolution}`,
          path: 'options.conflictResolution',
          value: input.options.conflictResolution,
        });
      }

      if (input.options.maxNodes !== undefined && input.options.maxNodes < 1) {
        errors.push({
          code: 'INVALID_MAX_NODES',
          message: 'maxNodes must be at least 1',
          path: 'options.maxNodes',
          value: input.options.maxNodes,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ============================================================================
  // Private methods
  // ============================================================================

  /**
   * Build node groups from match results.
   * Groups nodes that should be merged together based on match chains.
   */
  private buildNodeGroups(
    matches: MatchResult[],
    allNodes: Map<string, { node: NodeType; repoId: string; scanId: string }>
  ): NodeGroup[] {
    // Use union-find to group matched nodes
    const parent: Map<string, string> = new Map();

    const find = (key: string): string => {
      if (!parent.has(key)) {
        parent.set(key, key);
        return key;
      }
      const p = parent.get(key)!;
      if (p === key) return key;
      const root = find(p);
      parent.set(key, root);
      return root;
    };

    const union = (key1: string, key2: string): void => {
      const root1 = find(key1);
      const root2 = find(key2);
      if (root1 !== root2) {
        parent.set(root2, root1);
      }
    };

    // Group by matches
    const matchesByNode: Map<string, MatchResult[]> = new Map();

    for (const match of matches) {
      const sourceKey = `${match.sourceRepoId}:${match.sourceNodeId}`;
      const targetKey = `${match.targetRepoId}:${match.targetNodeId}`;

      // Only union if both nodes exist
      if (allNodes.has(sourceKey) && allNodes.has(targetKey)) {
        union(sourceKey, targetKey);

        // Track matches for each node
        if (!matchesByNode.has(sourceKey)) {
          matchesByNode.set(sourceKey, []);
        }
        matchesByNode.get(sourceKey)!.push(match);

        if (!matchesByNode.has(targetKey)) {
          matchesByNode.set(targetKey, []);
        }
        matchesByNode.get(targetKey)!.push(match);
      }
    }

    // Build groups
    const groupsByRoot: Map<string, NodeGroup> = new Map();

    for (const [key, { node, repoId, scanId }] of allNodes) {
      const root = find(key);

      // Only include nodes that have matches
      if (!matchesByNode.has(key)) {
        continue;
      }

      if (!groupsByRoot.has(root)) {
        const nodeMatches = matchesByNode.get(key) ?? [];
        const maxMatch = nodeMatches.reduce(
          (max, m) => (m.confidence > max.confidence ? m : max),
          nodeMatches[0]
        );

        groupsByRoot.set(root, {
          primaryNode: node,
          nodes: [node],
          repositoryIds: [repoId],
          scanIds: [scanId],
          matches: nodeMatches,
          maxConfidence: maxMatch?.confidence ?? 0,
          bestStrategy: maxMatch?.strategy ?? 'name',
        });
      } else {
        const group = groupsByRoot.get(root)!;
        const nodeMatches = matchesByNode.get(key) ?? [];
        const maxMatch = nodeMatches.reduce(
          (max, m) => (m.confidence > max.confidence ? m : max),
          nodeMatches[0]
        );

        // Mutable update of group
        (group.nodes as NodeType[]).push(node);
        (group.repositoryIds as string[]).push(repoId);
        (group.scanIds as string[]).push(scanId);
        (group.matches as MatchResult[]).push(...nodeMatches);

        if (maxMatch && maxMatch.confidence > group.maxConfidence) {
          (group as { maxConfidence: number }).maxConfidence = maxMatch.confidence;
          (group as { bestStrategy: MatchingStrategy }).bestStrategy = maxMatch.strategy;
        }
      }
    }

    // Filter out single-node groups (no actual merge needed)
    return Array.from(groupsByRoot.values()).filter((g) => g.nodes.length > 1);
  }

  /**
   * Merge a group of nodes into a single MergedNode.
   */
  private mergeNodeGroup(
    group: NodeGroup,
    conflictResolution: ConflictResolution = 'merge'
  ): { mergedNode: MergedNode; conflicts: MergeConflict[] } {
    const conflicts: MergeConflict[] = [];
    const primaryNode = group.primaryNode;

    // Build merged locations
    const locations: MergedNode['locations'] = group.nodes.map((node, index) => ({
      repoId: group.repositoryIds[index],
      file: node.location.file,
      lineStart: node.location.lineStart,
      lineEnd: node.location.lineEnd,
    }));

    // Merge metadata
    const { mergedMetadata, metadataConflicts } = this.mergeMetadata(
      group.nodes.map((node, index) => ({
        metadata: node.metadata,
        repositoryId: group.repositoryIds[index],
        scanId: group.scanIds[index],
      })),
      conflictResolution
    );
    conflicts.push(...metadataConflicts);

    // Determine merged name (use most common or primary)
    const mergedName = this.resolveName(group.nodes, conflictResolution);

    // Deduplicate matches (same source-target pair)
    const uniqueMatches = new Map<string, MatchResult>();
    for (const match of group.matches) {
      const key = `${match.sourceNodeId}:${match.targetNodeId}`;
      if (!uniqueMatches.has(key) || match.confidence > uniqueMatches.get(key)!.confidence) {
        uniqueMatches.set(key, match);
      }
    }

    const mergedNode: MergedNode = {
      id: `merged_${randomUUID()}`,
      sourceNodeIds: group.nodes.map((n) => n.id),
      sourceRepoIds: group.repositoryIds,
      type: primaryNode.type,
      name: mergedName,
      locations,
      metadata: mergedMetadata,
      matchInfo: {
        strategy: group.bestStrategy,
        confidence: group.maxConfidence,
        matchCount: uniqueMatches.size,
      },
    };

    return { mergedNode, conflicts };
  }

  /**
   * Merge metadata from multiple nodes.
   */
  private mergeMetadata(
    sources: Array<{
      metadata: Record<string, unknown>;
      repositoryId: string;
      scanId: string;
    }>,
    conflictResolution: ConflictResolution
  ): { mergedMetadata: Record<string, unknown>; metadataConflicts: MergeConflict[] } {
    const mergedMetadata: Record<string, unknown> = {};
    const metadataConflicts: MergeConflict[] = [];

    // Collect all keys
    const allKeys = new Set<string>();
    for (const source of sources) {
      for (const key of Object.keys(source.metadata)) {
        allKeys.add(key);
      }
    }

    // Merge each key
    for (const key of allKeys) {
      const values = sources
        .filter((s) => key in s.metadata)
        .map((s) => ({
          value: s.metadata[key],
          repositoryId: s.repositoryId,
          scanId: s.scanId,
        }));

      if (values.length === 0) {
        continue;
      }

      // Check for conflicts
      const uniqueValues = new Set(values.map((v) => JSON.stringify(v.value)));
      if (uniqueValues.size === 1) {
        // No conflict
        mergedMetadata[key] = values[0].value;
      } else {
        // Conflict detected
        const resolved = this.resolveConflict(values, conflictResolution);
        mergedMetadata[key] = resolved.value;

        metadataConflicts.push({
          attribute: key,
          values,
          resolution: conflictResolution,
          resolvedValue: resolved.value,
        });
      }
    }

    return { mergedMetadata, metadataConflicts };
  }

  /**
   * Resolve a conflict between multiple values.
   */
  private resolveConflict(
    values: Array<{ value: unknown; repositoryId: string; scanId: string }>,
    resolution: ConflictResolution
  ): { value: unknown } {
    switch (resolution) {
      case 'first':
        return { value: values[0].value };

      case 'last':
        return { value: values[values.length - 1].value };

      case 'merge':
        // For arrays, merge unique values
        if (Array.isArray(values[0].value)) {
          const merged = new Set<string>();
          for (const v of values) {
            if (Array.isArray(v.value)) {
              for (const item of v.value) {
                merged.add(JSON.stringify(item));
              }
            }
          }
          return { value: Array.from(merged).map((s) => JSON.parse(s)) };
        }
        // For objects, deep merge
        if (typeof values[0].value === 'object' && values[0].value !== null) {
          const merged: Record<string, unknown> = {};
          for (const v of values) {
            if (typeof v.value === 'object' && v.value !== null) {
              Object.assign(merged, v.value);
            }
          }
          return { value: merged };
        }
        // For primitives, use first
        return { value: values[0].value };

      case 'error':
        throw new RollupMergeError(
          `Conflict resolution failed: conflicting values for attribute`,
          { values }
        );

      default:
        return { value: values[0].value };
    }
  }

  /**
   * Resolve the name for a merged node.
   */
  private resolveName(nodes: NodeType[], resolution: ConflictResolution): string {
    // Count name occurrences
    const nameCounts = new Map<string, number>();
    for (const node of nodes) {
      const count = nameCounts.get(node.name) ?? 0;
      nameCounts.set(node.name, count + 1);
    }

    // Use most common name
    let maxCount = 0;
    let mostCommonName = nodes[0].name;

    for (const [name, count] of nameCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonName = name;
      }
    }

    return mostCommonName;
  }

  /**
   * Remap edges to use merged node IDs.
   */
  private remapEdges(
    edges: GraphEdge[],
    nodeIdMap: Map<string, string>,
    graphs: MergeInput['graphs'],
    createCrossRepoEdges: boolean,
    preserveSourceInfo: boolean
  ): { edges: GraphEdge[]; crossRepoEdgeCount: number } {
    const remappedEdges: GraphEdge[] = [];
    let crossRepoEdgeCount = 0;

    // Build repo lookup for edges
    const nodeToRepo: Map<string, string> = new Map();
    for (const { graph, repositoryId } of graphs) {
      for (const [nodeId] of graph.nodes) {
        nodeToRepo.set(nodeId, repositoryId);
      }
    }

    // Track seen edges to avoid duplicates
    const seenEdges = new Set<string>();

    for (const edge of edges) {
      const sourceRepo = nodeToRepo.get(edge.source);
      const targetRepo = nodeToRepo.get(edge.target);

      if (!sourceRepo || !targetRepo) {
        continue;
      }

      const sourceKey = `${sourceRepo}:${edge.source}`;
      const targetKey = `${targetRepo}:${edge.target}`;

      const newSourceId = nodeIdMap.get(sourceKey) ?? edge.source;
      const newTargetId = nodeIdMap.get(targetKey) ?? edge.target;

      // Skip self-loops created by merging
      if (newSourceId === newTargetId) {
        continue;
      }

      // Create edge key for deduplication
      const edgeKey = `${newSourceId}:${newTargetId}:${edge.type}`;
      if (seenEdges.has(edgeKey)) {
        continue;
      }
      seenEdges.add(edgeKey);

      // Check if this is a cross-repo edge
      const isCrossRepo = sourceRepo !== targetRepo;
      if (isCrossRepo) {
        crossRepoEdgeCount++;
        if (!createCrossRepoEdges) {
          continue;
        }
      }

      // Create remapped edge
      const remappedEdge: GraphEdge = {
        ...edge,
        id: `edge_${randomUUID()}`,
        source: newSourceId,
        target: newTargetId,
        metadata: preserveSourceInfo
          ? {
              ...edge.metadata,
              originalSourceId: edge.source,
              originalTargetId: edge.target,
              sourceRepositoryId: sourceRepo,
              targetRepositoryId: targetRepo,
              isCrossRepoEdge: isCrossRepo,
            }
          : edge.metadata,
      };

      remappedEdges.push(remappedEdge);
    }

    return { edges: remappedEdges, crossRepoEdgeCount };
  }
}

/**
 * Create a new MergeEngine instance
 */
export function createMergeEngine(): MergeEngine {
  return new MergeEngine();
}
