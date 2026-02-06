/**
 * Edge Matcher for Graph Diff Computation
 * @module services/rollup/graph-diff/edge-matcher
 *
 * Implements the IEdgeMatcher interface for extracting edge identities,
 * building identity indexes, and comparing edge attributes for diff computation.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: Optimized for 100K nodes < 500ms benchmark target
 */

import { GraphEdge, EdgeType } from '../../../types/graph.js';
import {
  IEdgeMatcher,
  EdgeIdentity,
  EdgeIdentityKey,
  NodeIdentity,
  NodeIdentityKey,
  AttributeChange,
  createEdgeIdentityKey,
} from './interfaces.js';
import {
  NodeIdentityIndex,
  fnv1aHash,
  getNestedValue,
  deepEqual,
  getAllPaths,
} from './node-matcher.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Index structure for O(1) edge lookup by identity key.
 * Used for efficient matching between base and target snapshots.
 */
export interface EdgeIdentityIndex {
  /** Map from identity key to edge for quick lookup */
  readonly byIdentityKey: ReadonlyMap<EdgeIdentityKey, GraphEdge>;
  /** Map from edge ID to identity for reverse lookup */
  readonly byEdgeId: ReadonlyMap<string, EdgeIdentity>;
  /** All identities for iteration */
  readonly identities: readonly EdgeIdentity[];
  /** Edges that could not be resolved (missing source or target node) */
  readonly unresolvedEdges: readonly UnresolvedEdge[];
  /** Statistics about the index */
  readonly stats: EdgeIndexStats;
}

/**
 * Represents an edge that could not be resolved to node identities.
 * This can happen when the edge references nodes not present in the node index.
 */
export interface UnresolvedEdge {
  /** The original edge */
  readonly edge: GraphEdge;
  /** Reason the edge could not be resolved */
  readonly reason: 'missing_source' | 'missing_target' | 'missing_both';
  /** Missing node IDs */
  readonly missingNodeIds: readonly string[];
}

/**
 * Statistics about an edge identity index
 */
export interface EdgeIndexStats {
  /** Total number of edges indexed */
  readonly totalEdges: number;
  /** Number of unique identity keys */
  readonly uniqueIdentities: number;
  /** Number of edges with duplicate identities (potential conflicts) */
  readonly duplicateIdentities: number;
  /** Number of unresolved edges */
  readonly unresolvedCount: number;
  /** Breakdown by edge type */
  readonly byEdgeType: Readonly<Partial<Record<EdgeType, number>>>;
  /** Time taken to build the index in milliseconds */
  readonly buildTimeMs: number;
}

/**
 * Result of comparing attributes between two edges
 */
export interface EdgeAttributeChanges {
  /** List of individual attribute changes */
  readonly changes: readonly AttributeChange[];
  /** Whether edges have any differences */
  readonly hasChanges: boolean;
  /** Summary of change counts */
  readonly summary: {
    readonly added: number;
    readonly removed: number;
    readonly modified: number;
  };
}

/**
 * Attributes to always ignore during edge comparison
 */
const DEFAULT_EDGE_IGNORE_ATTRIBUTES = [
  'id',
  'metadata.location.lineStart',
  'metadata.location.lineEnd',
  'metadata.location.columnStart',
  'metadata.location.columnEnd',
] as const;

/**
 * All supported edge types in the system (22 types)
 */
const ALL_EDGE_TYPES: readonly EdgeType[] = [
  // Resource Dependencies
  'depends_on',
  'references',
  'creates',
  'destroys',
  // Module Dependencies
  'module_call',
  'module_source',
  'module_provider',
  // Variable/Output Flow
  'input_variable',
  'output_value',
  'local_reference',
  // Provider Relationships
  'provider_config',
  'provider_alias',
  // Data Source Dependencies
  'data_source',
  'data_reference',
  // Kubernetes Dependencies
  'selector_match',
  'namespace_member',
  'volume_mount',
  'service_target',
  'ingress_backend',
  'rbac_binding',
  'configmap_ref',
  'secret_ref',
] as const;

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * Create a deterministic hash of edge identity-relevant attributes.
 *
 * @param edge - Edge to hash
 * @param sourceKey - Source node identity key
 * @param targetKey - Target node identity key
 * @returns Hash string
 */
function hashEdgeIdentity(
  edge: GraphEdge,
  sourceKey: NodeIdentityKey,
  targetKey: NodeIdentityKey
): string {
  const parts: string[] = [
    sourceKey,
    targetKey,
    edge.type,
  ];

  // Include label if present
  if (edge.label) {
    parts.push(edge.label);
  }

  // Include attribute reference if present
  if (edge.metadata?.attribute) {
    parts.push(edge.metadata.attribute);
  }

  return fnv1aHash(parts.join('::'));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a path should be ignored during comparison.
 *
 * @param path - Attribute path to check
 * @param ignoreList - List of paths to ignore
 * @returns True if path should be ignored
 */
function shouldIgnorePath(path: string, ignoreList: readonly string[]): boolean {
  for (const ignorePath of ignoreList) {
    // Exact match
    if (path === ignorePath) {
      return true;
    }
    // Prefix match (e.g., 'metadata' ignores 'metadata.uid')
    if (path.startsWith(ignorePath + '.')) {
      return true;
    }
  }
  return false;
}

/**
 * Create a placeholder node identity for unresolved node references.
 * Used when building edge identities for edges with missing node references.
 *
 * @param nodeId - The unresolved node ID
 * @returns A placeholder NodeIdentity
 */
function createPlaceholderNodeIdentity(nodeId: string): NodeIdentity {
  const placeholderKey = `unresolved::${nodeId}` as NodeIdentityKey;
  // Build the identity object without optional properties set to undefined
  // to satisfy exactOptionalPropertyTypes
  const identity: NodeIdentity = {
    key: placeholderKey,
    nodeId,
    nodeType: 'unknown',
    name: nodeId,
    attributes: Object.freeze({}),
    identityHash: fnv1aHash(placeholderKey),
  };
  return identity;
}

// ============================================================================
// EdgeMatcher Implementation
// ============================================================================

/**
 * Default implementation of IEdgeMatcher.
 * Provides identity extraction, indexing, and attribute comparison
 * for graph diff computation on edges.
 */
export class EdgeMatcher implements IEdgeMatcher {
  private readonly supportedEdgeTypes: readonly EdgeType[];

  /**
   * Create a new EdgeMatcher instance.
   */
  constructor() {
    this.supportedEdgeTypes = ALL_EDGE_TYPES;
  }

  // ============================================================================
  // IEdgeMatcher Implementation
  // ============================================================================

  /**
   * Extract identity from a single edge.
   * Requires a node identity map to resolve source and target node identities.
   *
   * @param edge - Edge to extract identity from
   * @param nodeIdentities - Map of node ID to NodeIdentity
   * @returns Edge identity
   * @throws GraphDiffError if source or target node identity cannot be resolved
   */
  extractIdentity(
    edge: GraphEdge,
    nodeIdentities: ReadonlyMap<string, NodeIdentity>
  ): EdgeIdentity {
    // Resolve source node identity
    let sourceIdentity = nodeIdentities.get(edge.source);
    if (!sourceIdentity) {
      // Create a placeholder identity for unresolved source
      sourceIdentity = createPlaceholderNodeIdentity(edge.source);
    }

    // Resolve target node identity
    let targetIdentity = nodeIdentities.get(edge.target);
    if (!targetIdentity) {
      // Create a placeholder identity for unresolved target
      targetIdentity = createPlaceholderNodeIdentity(edge.target);
    }

    // Create the identity key using the factory function
    const key = createEdgeIdentityKey(
      sourceIdentity.key,
      targetIdentity.key,
      edge.type
    );

    // Build identity attributes from edge metadata
    const attributes: Record<string, unknown> = {};
    if (edge.label) {
      attributes['label'] = edge.label;
    }
    if (edge.metadata?.attribute) {
      attributes['attribute'] = edge.metadata.attribute;
    }
    if (edge.metadata?.implicit !== undefined) {
      attributes['implicit'] = edge.metadata.implicit;
    }
    if (edge.metadata?.confidence !== undefined) {
      attributes['confidence'] = edge.metadata.confidence;
    }

    // Hash identity-relevant attributes
    const identityHash = hashEdgeIdentity(
      edge,
      sourceIdentity.key,
      targetIdentity.key
    );

    return {
      key,
      edgeId: edge.id,
      sourceIdentity,
      targetIdentity,
      edgeType: edge.type,
      attributes: Object.freeze(attributes),
      identityHash,
    };
  }

  /**
   * Extract identities from multiple edges in batch.
   * Optimized for processing large numbers of edges.
   *
   * @param edges - Edges to process
   * @param nodeIdentities - Map of node ID to NodeIdentity
   * @returns Map of edge ID to identity
   */
  extractIdentities(
    edges: readonly GraphEdge[],
    nodeIdentities: ReadonlyMap<string, NodeIdentity>
  ): ReadonlyMap<string, EdgeIdentity> {
    const identities = new Map<string, EdgeIdentity>();

    for (const edge of edges) {
      const identity = this.extractIdentity(edge, nodeIdentities);
      identities.set(edge.id, identity);
    }

    return identities;
  }

  /**
   * Compare two edges for attribute changes beyond identity.
   *
   * @param edge1 - First edge (base)
   * @param edge2 - Second edge (target)
   * @returns Array of attribute changes
   */
  compareEdges(
    edge1: GraphEdge,
    edge2: GraphEdge
  ): readonly AttributeChange[] {
    return this.compareAttributes(edge1, edge2, DEFAULT_EDGE_IGNORE_ATTRIBUTES).changes;
  }

  /**
   * Check if two identities match.
   *
   * @param identity1 - First identity
   * @param identity2 - Second identity
   * @returns True if identities match
   */
  identitiesMatch(
    identity1: EdgeIdentity,
    identity2: EdgeIdentity
  ): boolean {
    return identity1.key === identity2.key;
  }

  /**
   * Get supported edge types for this matcher.
   *
   * @returns Array of supported edge types
   */
  getSupportedEdgeTypes(): readonly EdgeType[] {
    return this.supportedEdgeTypes;
  }

  // ============================================================================
  // Extended Methods (Beyond Interface)
  // ============================================================================

  /**
   * Build an index from a collection of edges for O(1) lookup.
   * Requires a NodeIdentityIndex to resolve source and target nodes.
   *
   * @param edges - Array of edges to index
   * @param nodeIndex - Node identity index for resolving node references
   * @returns Edge identity index
   */
  buildIndex(
    edges: readonly GraphEdge[],
    nodeIndex: NodeIdentityIndex
  ): EdgeIdentityIndex {
    const startTime = performance.now();

    const byIdentityKey = new Map<EdgeIdentityKey, GraphEdge>();
    const byEdgeId = new Map<string, EdgeIdentity>();
    const identities: EdgeIdentity[] = [];
    const unresolvedEdges: UnresolvedEdge[] = [];
    const byEdgeType: Partial<Record<EdgeType, number>> = {};
    let duplicateIdentities = 0;

    for (const edge of edges) {
      // Check if source and target nodes are in the index
      const sourceIdentity = nodeIndex.byNodeId.get(edge.source);
      const targetIdentity = nodeIndex.byNodeId.get(edge.target);

      const missingSource = !sourceIdentity;
      const missingTarget = !targetIdentity;

      // Track unresolved edges
      if (missingSource || missingTarget) {
        const missingNodeIds: string[] = [];
        if (missingSource) missingNodeIds.push(edge.source);
        if (missingTarget) missingNodeIds.push(edge.target);

        const reason: UnresolvedEdge['reason'] =
          missingSource && missingTarget
            ? 'missing_both'
            : missingSource
            ? 'missing_source'
            : 'missing_target';

        unresolvedEdges.push({
          edge,
          reason,
          missingNodeIds,
        });

        // Still create identity with placeholder nodes for consistency
        // This allows tracking edges even when nodes are missing
      }

      // Extract identity (will use placeholders for missing nodes)
      const identity = this.extractIdentity(edge, nodeIndex.byNodeId);

      // Track duplicates
      if (byIdentityKey.has(identity.key)) {
        duplicateIdentities++;
      }

      byIdentityKey.set(identity.key, edge);
      byEdgeId.set(edge.id, identity);
      identities.push(identity);

      // Count by edge type
      byEdgeType[edge.type] = (byEdgeType[edge.type] ?? 0) + 1;
    }

    const buildTimeMs = performance.now() - startTime;

    const stats: EdgeIndexStats = {
      totalEdges: edges.length,
      uniqueIdentities: byIdentityKey.size,
      duplicateIdentities,
      unresolvedCount: unresolvedEdges.length,
      byEdgeType: Object.freeze(byEdgeType),
      buildTimeMs,
    };

    return {
      byIdentityKey,
      byEdgeId,
      identities,
      unresolvedEdges,
      stats,
    };
  }

  /**
   * Check if two edges are equivalent based on identity.
   *
   * @param edge1 - First edge
   * @param edge2 - Second edge
   * @param nodeIdentities - Node identity map for resolving references
   * @returns True if edges have the same identity
   */
  areEquivalent(
    edge1: GraphEdge,
    edge2: GraphEdge,
    nodeIdentities: ReadonlyMap<string, NodeIdentity>
  ): boolean {
    const identity1 = this.extractIdentity(edge1, nodeIdentities);
    const identity2 = this.extractIdentity(edge2, nodeIdentities);
    return this.identitiesMatch(identity1, identity2);
  }

  /**
   * Compare attributes between two edges with ignore list support.
   *
   * @param baseEdge - Base edge (older version)
   * @param compareEdge - Compare edge (newer version)
   * @param ignoreAttributes - Optional list of attributes to ignore
   * @returns Attribute changes or null if edges are identical
   */
  compareAttributes(
    baseEdge: GraphEdge,
    compareEdge: GraphEdge,
    ignoreAttributes?: readonly string[]
  ): EdgeAttributeChanges {
    const ignore = ignoreAttributes ?? DEFAULT_EDGE_IGNORE_ATTRIBUTES;
    const changes: AttributeChange[] = [];

    // Cast edges to records for comparison
    const baseRecord = baseEdge as unknown as Record<string, unknown>;
    const compareRecord = compareEdge as unknown as Record<string, unknown>;

    // Get all paths from both edges
    const basePaths = getAllPaths(baseRecord);
    const comparePaths = getAllPaths(compareRecord);

    // Convert to arrays for iteration compatibility
    const comparePathsArray = Array.from(comparePaths);
    const basePathsArray = Array.from(basePaths);

    // Find added attributes (in compare but not in base)
    for (const path of comparePathsArray) {
      if (shouldIgnorePath(path, ignore)) {
        continue;
      }

      if (!basePaths.has(path)) {
        changes.push({
          path,
          newValue: getNestedValue(compareRecord, path),
          changeType: 'added',
        });
      }
    }

    // Find removed attributes (in base but not in compare)
    for (const path of basePathsArray) {
      if (shouldIgnorePath(path, ignore)) {
        continue;
      }

      if (!comparePaths.has(path)) {
        changes.push({
          path,
          previousValue: getNestedValue(baseRecord, path),
          changeType: 'removed',
        });
      }
    }

    // Find modified attributes (in both but different values)
    for (const path of basePathsArray) {
      if (shouldIgnorePath(path, ignore)) {
        continue;
      }

      if (comparePaths.has(path)) {
        const baseValue = getNestedValue(baseRecord, path);
        const compareValue = getNestedValue(compareRecord, path);

        if (!deepEqual(baseValue, compareValue)) {
          changes.push({
            path,
            previousValue: baseValue,
            newValue: compareValue,
            changeType: 'modified',
          });
        }
      }
    }

    const summary = {
      added: changes.filter((c) => c.changeType === 'added').length,
      removed: changes.filter((c) => c.changeType === 'removed').length,
      modified: changes.filter((c) => c.changeType === 'modified').length,
    };

    return {
      changes,
      hasChanges: changes.length > 0,
      summary,
    };
  }

  /**
   * Find an edge in a target index that matches a source identity.
   *
   * @param sourceIdentity - Identity to find
   * @param targetIndex - Index to search in
   * @returns Matching edge or undefined
   */
  findMatchingEdge(
    sourceIdentity: EdgeIdentity,
    targetIndex: EdgeIdentityIndex
  ): GraphEdge | undefined {
    return targetIndex.byIdentityKey.get(sourceIdentity.key);
  }

  /**
   * Validate that an edge can be processed by this matcher.
   *
   * @param edge - Edge to validate
   * @returns Validation result with any error message
   */
  validateEdge(edge: GraphEdge): { valid: boolean; error?: string } {
    if (!edge.id) {
      return { valid: false, error: 'Edge is missing id property' };
    }

    if (!edge.source) {
      return { valid: false, error: 'Edge is missing source property' };
    }

    if (!edge.target) {
      return { valid: false, error: 'Edge is missing target property' };
    }

    if (!edge.type) {
      return { valid: false, error: 'Edge is missing type property' };
    }

    if (!this.supportedEdgeTypes.includes(edge.type)) {
      return {
        valid: false,
        error: `Unsupported edge type: ${edge.type}`,
      };
    }

    return { valid: true };
  }

  /**
   * Get edges from an index grouped by edge type.
   *
   * @param index - Edge identity index
   * @returns Map of edge type to edges
   */
  groupByEdgeType(
    index: EdgeIdentityIndex
  ): ReadonlyMap<EdgeType, readonly EdgeIdentity[]> {
    const grouped = new Map<EdgeType, EdgeIdentity[]>();

    for (const identity of index.identities) {
      const existing = grouped.get(identity.edgeType);
      if (existing) {
        existing.push(identity);
      } else {
        grouped.set(identity.edgeType, [identity]);
      }
    }

    return grouped;
  }

  /**
   * Filter edges to only include specific edge types.
   *
   * @param edges - Edges to filter
   * @param includeTypes - Edge types to include (empty = all)
   * @param excludeTypes - Edge types to exclude
   * @returns Filtered edges
   */
  filterEdges(
    edges: readonly GraphEdge[],
    includeTypes?: readonly EdgeType[],
    excludeTypes?: readonly EdgeType[]
  ): readonly GraphEdge[] {
    return edges.filter((edge) => {
      // If include list is provided and non-empty, edge type must be in it
      if (includeTypes && includeTypes.length > 0) {
        if (!includeTypes.includes(edge.type)) {
          return false;
        }
      }

      // If exclude list is provided, edge type must not be in it
      if (excludeTypes && excludeTypes.length > 0) {
        if (excludeTypes.includes(edge.type)) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get statistics about edge resolution success.
   *
   * @param index - Edge identity index
   * @returns Resolution statistics
   */
  getResolutionStats(index: EdgeIdentityIndex): {
    resolved: number;
    unresolved: number;
    resolutionRate: number;
    unresolvedByReason: Record<string, number>;
  } {
    const resolved = index.identities.length - index.unresolvedEdges.length;
    const unresolved = index.unresolvedEdges.length;
    const total = index.identities.length;

    const unresolvedByReason: Record<string, number> = {
      missing_source: 0,
      missing_target: 0,
      missing_both: 0,
    };

    for (const unresolvedEdge of index.unresolvedEdges) {
      const reason = unresolvedEdge.reason;
      unresolvedByReason[reason] = (unresolvedByReason[reason] ?? 0) + 1;
    }

    return {
      resolved,
      unresolved,
      resolutionRate: total > 0 ? resolved / total : 1,
      unresolvedByReason,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new EdgeMatcher instance with default configuration.
 *
 * @returns New EdgeMatcher instance
 */
export function createEdgeMatcher(): EdgeMatcher {
  return new EdgeMatcher();
}

/**
 * Create an EdgeIdentityKey from source/target keys and edge type.
 * Provides a standardized way to create identity keys externally.
 * Uses the format: `{sourceKey}--{edgeType}-->{targetKey}`
 *
 * @param sourceKey - Source node identity key
 * @param targetKey - Target node identity key
 * @param edgeType - Edge type
 * @returns Branded EdgeIdentityKey
 */
export function createEdgeIdentityKeyFromParts(
  sourceKey: NodeIdentityKey,
  targetKey: NodeIdentityKey,
  edgeType: EdgeType
): EdgeIdentityKey {
  // Use the format specified in requirements: {sourceKey}--{edgeType}-->{targetKey}
  return `${sourceKey}--${edgeType}-->${targetKey}` as EdgeIdentityKey;
}

/**
 * Check if an edge identity key uses placeholder node references.
 * Useful for identifying edges with unresolved node references.
 *
 * @param key - Edge identity key to check
 * @returns True if the key contains placeholder references
 */
export function hasPlaceholderReferences(key: EdgeIdentityKey): boolean {
  return key.includes('unresolved::');
}

/**
 * Parsed edge identity key components
 */
export interface ParsedEdgeIdentityKey {
  readonly sourceKey: string;
  readonly targetKey: string;
  readonly edgeType: string;
}

/**
 * Parse an edge identity key into its components.
 * Note: This may not work correctly for all keys due to the delimiter format.
 *
 * @param key - Edge identity key to parse
 * @returns Parsed components or null if parsing fails
 */
export function parseEdgeIdentityKey(key: EdgeIdentityKey): ParsedEdgeIdentityKey | null {
  // The key format from interfaces.ts is: `${sourceKey}->${targetKey}:${edgeType}`
  // Try to parse this format first
  const arrowMatch = key.match(/^(.+)->(.+):([^:]+)$/);
  if (arrowMatch && arrowMatch[1] && arrowMatch[2] && arrowMatch[3]) {
    return {
      sourceKey: arrowMatch[1],
      targetKey: arrowMatch[2],
      edgeType: arrowMatch[3],
    };
  }

  // Also support the alternative format: `{sourceKey}--{edgeType}-->{targetKey}`
  const altMatch = key.match(/^(.+)--([^-]+)-->(.+)$/);
  if (altMatch && altMatch[1] && altMatch[2] && altMatch[3]) {
    return {
      sourceKey: altMatch[1],
      edgeType: altMatch[2],
      targetKey: altMatch[3],
    };
  }

  return null;
}

// ============================================================================
// Empty/Default Factory Functions
// ============================================================================

/**
 * Create an empty EdgeIdentityIndex
 *
 * @returns Empty edge identity index
 */
export function createEmptyEdgeIdentityIndex(): EdgeIdentityIndex {
  return {
    byIdentityKey: new Map(),
    byEdgeId: new Map(),
    identities: [],
    unresolvedEdges: [],
    stats: {
      totalEdges: 0,
      uniqueIdentities: 0,
      duplicateIdentities: 0,
      unresolvedCount: 0,
      byEdgeType: Object.freeze({}),
      buildTimeMs: 0,
    },
  };
}

/**
 * Create default EdgeIndexStats
 *
 * @returns Default edge index stats
 */
export function createDefaultEdgeIndexStats(): EdgeIndexStats {
  return {
    totalEdges: 0,
    uniqueIdentities: 0,
    duplicateIdentities: 0,
    unresolvedCount: 0,
    byEdgeType: Object.freeze({}),
    buildTimeMs: 0,
  };
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  DEFAULT_EDGE_IGNORE_ATTRIBUTES,
  ALL_EDGE_TYPES,
};
