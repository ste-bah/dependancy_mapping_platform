/**
 * Edge Matcher for Graph Diff Computation
 * @module diff/edge-matcher
 *
 * Implements efficient O(n) edge matching and comparison across graph scans.
 * Uses stable identity keys (sourceNodeKey->targetNodeKey:edgeType) to match
 * edges across different scan instances, enabling accurate diff computation.
 *
 * Edge identity is based on the stable identities of source and target nodes,
 * allowing edges to be correctly matched even when node IDs change between scans.
 *
 * TASK-ROLLUP-005: Diff Computation - Edge Matching Component
 *
 * @example
 * ```typescript
 * const nodeMatcher = createNodeMatcher();
 * const edgeMatcher = createEdgeMatcher();
 *
 * const nodeIndex = nodeMatcher.indexNodes(baseNodes);
 * const baseEdgeIndex = edgeMatcher.indexEdges(baseEdges, nodeIndex);
 * const compareEdgeIndex = edgeMatcher.indexEdges(compareEdges, compareNodeIndex);
 *
 * const added = edgeMatcher.findAdded(baseEdgeIndex, compareEdgeIndex);
 * const removed = edgeMatcher.findRemoved(baseEdgeIndex, compareEdgeIndex);
 * const modified = edgeMatcher.findModified(baseEdgeIndex, compareEdgeIndex);
 * ```
 */

import type { GraphEdge, EdgeType, EdgeMetadata, NodeType } from '../types/graph.js';
import {
  EdgeIdentity,
  EdgeModification,
  FieldChange,
  createEdgeIdentityKey,
  createEdgeModification,
  DEFAULT_DIFF_OPTIONS,
} from './types.js';
import { nodeKey } from './node-matcher.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * All 22 supported edge types in the dependency graph.
 * Used for validation and iteration purposes.
 */
export const ALL_EDGE_TYPES: readonly EdgeType[] = [
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

/**
 * Fields to ignore during edge comparison.
 * These fields are transient and change between scans without representing
 * actual changes to the edge's definition.
 */
export const TRANSIENT_EDGE_FIELDS: readonly string[] = [
  'id',           // UUID changes between scans
  'source',       // Node ID changes between scans (use identity instead)
  'target',       // Node ID changes between scans (use identity instead)
] as const;

/**
 * Identity fields that define an edge's stable identity.
 * Changes to these fields indicate a different edge entirely.
 */
export const IDENTITY_EDGE_FIELDS: readonly string[] = [
  'sourceNodeKey',  // Derived from source node's stable identity
  'targetNodeKey',  // Derived from target node's stable identity
  'type',           // Edge type
] as const;

/**
 * Fields to compare for detecting edge modifications.
 * Ordered by importance for change detection.
 */
export const COMPARABLE_EDGE_FIELDS: readonly string[] = [
  'label',
  'metadata.attribute',
  'metadata.implicit',
  'metadata.confidence',
  'metadata.location',
  'metadata.evidence',
] as const;

// ============================================================================
// Interface Definition
// ============================================================================

/**
 * Interface for edge matching operations in graph diff computation.
 * Provides methods for indexing edges, extracting identities, and
 * finding added/removed/modified edges between scans.
 */
export interface IEdgeMatcher {
  /**
   * Build an index of edges by their stable identity key.
   * Enables O(1) lookup for edge matching operations.
   *
   * @param edges - Array of edges to index
   * @param nodeIndex - Map of nodes indexed by their stable identity key
   * @returns Map from identity key to edge
   *
   * @example
   * ```typescript
   * const nodeIndex = nodeMatcher.indexNodes(nodes);
   * const edgeIndex = edgeMatcher.indexEdges(edges, nodeIndex);
   * const edge = edgeIndex.get('terraform_resource:source:main.tf->terraform_resource:target:main.tf:references');
   * ```
   */
  indexEdges(
    edges: readonly GraphEdge[],
    nodeIndex: Map<string, NodeType>
  ): Map<string, GraphEdge>;

  /**
   * Extract the stable identity from an edge.
   * Identity consists of source node key, target node key, and edge type.
   *
   * @param edge - Edge to extract identity from
   * @param nodeIndex - Map of nodes indexed by their stable identity key
   * @returns EdgeIdentity object or null if source/target nodes not found
   *
   * @example
   * ```typescript
   * const identity = edgeMatcher.extractIdentity(edge, nodeIndex);
   * // { sourceKey: 'terraform_resource:source:main.tf',
   * //   targetKey: 'terraform_resource:target:main.tf',
   * //   edgeType: 'references' }
   * ```
   */
  extractIdentity(
    edge: GraphEdge,
    nodeIndex: Map<string, NodeType>
  ): EdgeIdentity | null;

  /**
   * Generate a stable identity key from an EdgeIdentity.
   * Format: sourceNodeKey->targetNodeKey:edgeType
   *
   * @param identity - Edge identity object
   * @returns Identity key string
   *
   * @example
   * ```typescript
   * const key = edgeMatcher.identityKey(identity);
   * // 'terraform_resource:source:main.tf->terraform_resource:target:main.tf:references'
   * ```
   */
  identityKey(identity: EdgeIdentity): string;

  /**
   * Find edges that exist in the compare scan but not in the base scan.
   * These are newly added edges.
   *
   * @param baseIndex - Index of base scan edges
   * @param compareIndex - Index of compare scan edges
   * @returns Array of added edges
   *
   * @example
   * ```typescript
   * const added = edgeMatcher.findAdded(baseIndex, compareIndex);
   * console.log(`${added.length} edges were added`);
   * ```
   */
  findAdded(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): GraphEdge[];

  /**
   * Find edges that exist in the base scan but not in the compare scan.
   * These are removed edges.
   *
   * @param baseIndex - Index of base scan edges
   * @param compareIndex - Index of compare scan edges
   * @returns Array of removed edges
   *
   * @example
   * ```typescript
   * const removed = edgeMatcher.findRemoved(baseIndex, compareIndex);
   * console.log(`${removed.length} edges were removed`);
   * ```
   */
  findRemoved(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): GraphEdge[];

  /**
   * Find edges that exist in both scans but have field-level changes.
   * Returns detailed modification records with before/after states.
   *
   * @param baseIndex - Index of base scan edges
   * @param compareIndex - Index of compare scan edges
   * @returns Array of edge modifications
   *
   * @example
   * ```typescript
   * const modified = edgeMatcher.findModified(baseIndex, compareIndex);
   * modified.forEach(mod => {
   *   console.log(`Edge ${mod.edgeId} changed fields: ${mod.changedFields.join(', ')}`);
   * });
   * ```
   */
  findModified(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): EdgeModification[];

  /**
   * Compare two edges and identify which fields have changed.
   * Ignores transient fields (id, source, target node IDs).
   *
   * @param before - Edge state in base scan
   * @param after - Edge state in compare scan
   * @returns Array of changed field names
   *
   * @example
   * ```typescript
   * const changedFields = edgeMatcher.compareEdges(baseEdge, compareEdge);
   * if (changedFields.includes('metadata.confidence')) {
   *   console.log('Edge confidence changed');
   * }
   * ```
   */
  compareEdges(before: GraphEdge, after: GraphEdge): string[];

  /**
   * Get detailed field-level changes between two edges.
   * Returns old and new values for each changed field.
   *
   * @param before - Edge state in base scan
   * @param after - Edge state in compare scan
   * @returns Array of field changes with details
   */
  getFieldChanges(before: GraphEdge, after: GraphEdge): FieldChange[];
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * EdgeMatcher implementation for graph diff computation.
 * Provides efficient O(n) edge matching using stable identity keys
 * derived from node identities.
 */
export class EdgeMatcher implements IEdgeMatcher {
  /** Fields to ignore during comparison */
  private readonly ignoreFields: Set<string>;
  private readonly nodeIdToKeyCache: Map<string, string>;

  /**
   * Create a new EdgeMatcher instance.
   *
   * @param options - Configuration options
   * @param options.ignoreFields - Additional fields to ignore during comparison
   */
  constructor(options?: { ignoreFields?: readonly string[] }) {
    const additionalIgnore = options?.ignoreFields ?? DEFAULT_DIFF_OPTIONS.ignoreFields;
    this.ignoreFields = new Set([
      ...TRANSIENT_EDGE_FIELDS,
      ...additionalIgnore,
    ]);
    this.nodeIdToKeyCache = new Map();
  }

  /**
   * Build an index of edges by their stable identity key.
   * Time complexity: O(n) where n is the number of edges.
   *
   * Builds an internal cache mapping node IDs to node keys for efficient
   * edge identity extraction.
   */
  indexEdges(
    edges: readonly GraphEdge[],
    nodeIndex: Map<string, NodeType>
  ): Map<string, GraphEdge> {
    const index = new Map<string, GraphEdge>();

    // Build node ID to key cache from node index
    this.buildNodeIdCache(nodeIndex);

    for (const edge of edges) {
      const identity = this.extractIdentity(edge, nodeIndex);

      if (identity) {
        const key = this.identityKey(identity);
        index.set(key, edge);
      }
      // Skip edges where source or target node cannot be resolved
      // This handles orphaned edges gracefully
    }

    return index;
  }

  /**
   * Extract stable identity from an edge.
   * Returns null if source or target node cannot be resolved.
   */
  extractIdentity(
    edge: GraphEdge,
    nodeIndex: Map<string, NodeType>
  ): EdgeIdentity | null {
    // Get stable keys for source and target nodes
    const sourceKey = this.resolveNodeKey(edge.source, nodeIndex);
    const targetKey = this.resolveNodeKey(edge.target, nodeIndex);

    if (!sourceKey || !targetKey) {
      return null;
    }

    return {
      sourceKey,
      targetKey,
      edgeType: edge.type,
    };
  }

  /**
   * Generate identity key from identity object.
   */
  identityKey(identity: EdgeIdentity): string {
    return createEdgeIdentityKey(identity);
  }

  /**
   * Find added edges (in compare but not in base).
   * Time complexity: O(n) where n is the size of compareIndex.
   */
  findAdded(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): GraphEdge[] {
    const added: GraphEdge[] = [];

    for (const [key, edge] of compareIndex) {
      if (!baseIndex.has(key)) {
        added.push(edge);
      }
    }

    return added;
  }

  /**
   * Find removed edges (in base but not in compare).
   * Time complexity: O(n) where n is the size of baseIndex.
   */
  findRemoved(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): GraphEdge[] {
    const removed: GraphEdge[] = [];

    for (const [key, edge] of baseIndex) {
      if (!compareIndex.has(key)) {
        removed.push(edge);
      }
    }

    return removed;
  }

  /**
   * Find modified edges with field-level changes.
   * Time complexity: O(n * m) where n is shared edges, m is fields per edge.
   */
  findModified(
    baseIndex: Map<string, GraphEdge>,
    compareIndex: Map<string, GraphEdge>
  ): EdgeModification[] {
    const modifications: EdgeModification[] = [];

    for (const [key, baseEdge] of baseIndex) {
      const compareEdge = compareIndex.get(key);

      if (compareEdge) {
        const changedFields = this.compareEdges(baseEdge, compareEdge);

        if (changedFields.length > 0) {
          const fieldChanges = this.getFieldChanges(baseEdge, compareEdge);

          const modification: EdgeModification = {
            ...createEdgeModification(key, baseEdge, compareEdge, changedFields),
            fieldChanges,
          };

          modifications.push(modification);
        }
      }
    }

    return modifications;
  }

  /**
   * Compare two edges and return list of changed field names.
   * Performs deep comparison while ignoring transient fields.
   */
  compareEdges(before: GraphEdge, after: GraphEdge): string[] {
    const changedFields: string[] = [];

    // Compare label (if not ignored)
    if (!this.ignoreFields.has('label') && before.label !== after.label) {
      changedFields.push('label');
    }

    // Compare type (should not change for same identity, but check anyway)
    if (!this.ignoreFields.has('type') && before.type !== after.type) {
      changedFields.push('type');
    }

    // Compare metadata (if not ignored)
    if (!this.ignoreFields.has('metadata')) {
      const metadataChanges = this.compareMetadata(before.metadata, after.metadata);
      changedFields.push(...metadataChanges);
    }

    return changedFields;
  }

  /**
   * Get detailed field changes with old and new values.
   */
  getFieldChanges(before: GraphEdge, after: GraphEdge): FieldChange[] {
    const changes: FieldChange[] = [];
    const changedFields = this.compareEdges(before, after);

    for (const field of changedFields) {
      const oldValue = this.getNestedValue(before, field);
      const newValue = this.getNestedValue(after, field);

      const changeType = this.determineChangeType(oldValue, newValue);

      changes.push({
        field,
        oldValue,
        newValue,
        changeType,
      });
    }

    return changes;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Build a cache mapping node IDs to their stable keys.
   * This enables efficient edge identity extraction.
   */
  private buildNodeIdCache(nodeIndex: Map<string, NodeType>): void {
    this.nodeIdToKeyCache.clear();

    for (const [key, node] of nodeIndex) {
      this.nodeIdToKeyCache.set(node.id, key);
    }
  }

  /**
   * Resolve a node ID to its stable identity key.
   * Uses the cache built from the node index.
   *
   * @param nodeId - The node ID from the edge
   * @param nodeIndex - Node index for fallback lookup
   * @returns Stable node key or null if not found
   */
  private resolveNodeKey(
    nodeId: string,
    nodeIndex: Map<string, NodeType>
  ): string | null {
    // First check cache
    const cachedKey = this.nodeIdToKeyCache.get(nodeId);
    if (cachedKey) {
      return cachedKey;
    }

    // Fallback: search through node index
    // This handles the case where edges reference nodes by their stable key
    if (nodeIndex.has(nodeId)) {
      return nodeId;
    }

    // Node not found - edge references a node outside the current graph
    return null;
  }

  /**
   * Compare metadata objects and return changed metadata fields.
   */
  private compareMetadata(
    before: EdgeMetadata,
    after: EdgeMetadata
  ): string[] {
    const changes: string[] = [];

    // Compare attribute
    if (before.attribute !== after.attribute) {
      changes.push('metadata.attribute');
    }

    // Compare implicit flag
    if (before.implicit !== after.implicit) {
      changes.push('metadata.implicit');
    }

    // Compare confidence
    if (before.confidence !== after.confidence) {
      changes.push('metadata.confidence');
    }

    // Compare location
    if (!this.locationsEqual(before.location, after.location)) {
      changes.push('metadata.location');
    }

    // Compare evidence arrays
    if (!this.evidenceArraysEqual(before.evidence, after.evidence)) {
      changes.push('metadata.evidence');
    }

    return changes;
  }

  /**
   * Compare two location objects for equality.
   */
  private locationsEqual(
    a: EdgeMetadata['location'],
    b: EdgeMetadata['location']
  ): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;

    return (
      a.file === b.file &&
      a.lineStart === b.lineStart &&
      a.lineEnd === b.lineEnd &&
      a.columnStart === b.columnStart &&
      a.columnEnd === b.columnEnd
    );
  }

  /**
   * Compare two evidence arrays for equality.
   */
  private evidenceArraysEqual(
    a: EdgeMetadata['evidence'],
    b: EdgeMetadata['evidence']
  ): boolean {
    if (!a && !b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;

    // Sort by type and description for stable comparison
    const sortedA = [...a].sort((x, y) =>
      `${x.type}:${x.description}`.localeCompare(`${y.type}:${y.description}`)
    );
    const sortedB = [...b].sort((x, y) =>
      `${x.type}:${x.description}`.localeCompare(`${y.type}:${y.description}`)
    );

    for (let i = 0; i < sortedA.length; i++) {
      const evidenceA = sortedA[i]!;
      const evidenceB = sortedB[i]!;

      if (
        evidenceA.type !== evidenceB.type ||
        evidenceA.description !== evidenceB.description ||
        !this.locationsEqual(evidenceA.location, evidenceB.location)
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get a nested value from an object using dot notation.
   */
  private getNestedValue(obj: GraphEdge, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  /**
   * Determine the type of change between two values.
   */
  private determineChangeType(
    oldValue: unknown,
    newValue: unknown
  ): FieldChange['changeType'] {
    if (oldValue === undefined && newValue !== undefined) {
      return 'added';
    }
    if (oldValue !== undefined && newValue === undefined) {
      return 'removed';
    }
    if (typeof oldValue !== typeof newValue) {
      return 'type_changed';
    }
    return 'value_changed';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Options for creating an EdgeMatcher instance.
 */
export interface EdgeMatcherOptions {
  /**
   * Additional fields to ignore during edge comparison.
   * These are added to the default transient fields (id, source, target).
   */
  ignoreFields?: readonly string[];
}

/**
 * Create a new EdgeMatcher instance.
 *
 * @param options - Configuration options
 * @returns Configured EdgeMatcher instance
 *
 * @example
 * ```typescript
 * // Default configuration
 * const matcher = createEdgeMatcher();
 *
 * // With custom ignore fields
 * const matcher = createEdgeMatcher({
 *   ignoreFields: ['customField', 'temporaryData'],
 * });
 * ```
 */
export function createEdgeMatcher(options?: EdgeMatcherOptions): IEdgeMatcher {
  return new EdgeMatcher(options);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Compute the stable identity key for an edge given the source and target nodes.
 * Convenience function that creates identity and generates key in one step.
 *
 * @param edge - Edge to compute key for
 * @param sourceNode - Source node of the edge
 * @param targetNode - Target node of the edge
 * @returns Stable identity key string
 *
 * @example
 * ```typescript
 * const key = edgeKey(edge, sourceNode, targetNode);
 * // 'terraform_resource:source:main.tf->terraform_resource:target:main.tf:references'
 * ```
 */
export function edgeKey(
  edge: GraphEdge,
  sourceNode: NodeType,
  targetNode: NodeType
): string {
  const sourceNodeKey = nodeKey(sourceNode);
  const targetNodeKey = nodeKey(targetNode);
  return `${sourceNodeKey}->${targetNodeKey}:${edge.type}`;
}

/**
 * Parse an edge identity key back into its components.
 *
 * @param key - Identity key to parse
 * @returns EdgeIdentity object or null if invalid format
 *
 * @example
 * ```typescript
 * const identity = parseEdgeKey('terraform_resource:source:main.tf->terraform_resource:target:main.tf:references');
 * // { sourceKey: 'terraform_resource:source:main.tf',
 * //   targetKey: 'terraform_resource:target:main.tf',
 * //   edgeType: 'references' }
 * ```
 */
export function parseEdgeKey(key: string): EdgeIdentity | null {
  // Format: sourceKey->targetKey:edgeType
  const arrowIndex = key.indexOf('->');
  if (arrowIndex === -1) {
    return null;
  }

  const sourceKey = key.substring(0, arrowIndex);
  const remainder = key.substring(arrowIndex + 2);

  // Find the last colon which separates targetKey from edgeType
  const lastColonIndex = remainder.lastIndexOf(':');
  if (lastColonIndex === -1) {
    return null;
  }

  const targetKey = remainder.substring(0, lastColonIndex);
  const edgeType = remainder.substring(lastColonIndex + 1) as EdgeType;

  if (!sourceKey || !targetKey || !edgeType) {
    return null;
  }

  // Validate edge type
  if (!ALL_EDGE_TYPES.includes(edgeType)) {
    return null;
  }

  return { sourceKey, targetKey, edgeType };
}

/**
 * Check if two edges have the same identity.
 *
 * @param a - First edge
 * @param b - Second edge
 * @param nodeIndex - Node index for resolving node IDs to keys
 * @returns True if edges have the same identity
 *
 * @example
 * ```typescript
 * if (sameEdgeIdentity(baseEdge, compareEdge, nodeIndex)) {
 *   console.log('Edges represent the same relationship');
 * }
 * ```
 */
export function sameEdgeIdentity(
  a: GraphEdge,
  b: GraphEdge,
  nodeIndexA: Map<string, NodeType>,
  nodeIndexB: Map<string, NodeType>
): boolean {
  const matcherA = new EdgeMatcher();
  const matcherB = new EdgeMatcher();

  const identityA = matcherA.extractIdentity(a, nodeIndexA);
  const identityB = matcherB.extractIdentity(b, nodeIndexB);

  if (!identityA || !identityB) {
    return false;
  }

  return (
    identityA.sourceKey === identityB.sourceKey &&
    identityA.targetKey === identityB.targetKey &&
    identityA.edgeType === identityB.edgeType
  );
}

/**
 * Group edges by their type.
 *
 * @param edges - Edges to group
 * @returns Map from edge type to array of edges
 *
 * @example
 * ```typescript
 * const grouped = groupEdgesByType(edges);
 * const references = grouped.get('references') ?? [];
 * ```
 */
export function groupEdgesByType(
  edges: readonly GraphEdge[]
): Map<EdgeType, GraphEdge[]> {
  const groups = new Map<EdgeType, GraphEdge[]>();

  for (const edge of edges) {
    const existing = groups.get(edge.type);
    if (existing) {
      existing.push(edge);
    } else {
      groups.set(edge.type, [edge]);
    }
  }

  return groups;
}

/**
 * Group edges by their source node ID.
 *
 * @param edges - Edges to group
 * @returns Map from source node ID to array of edges
 *
 * @example
 * ```typescript
 * const grouped = groupEdgesBySource(edges);
 * const outgoingEdges = grouped.get(nodeId) ?? [];
 * ```
 */
export function groupEdgesBySource(
  edges: readonly GraphEdge[]
): Map<string, GraphEdge[]> {
  const groups = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const existing = groups.get(edge.source);
    if (existing) {
      existing.push(edge);
    } else {
      groups.set(edge.source, [edge]);
    }
  }

  return groups;
}

/**
 * Group edges by their target node ID.
 *
 * @param edges - Edges to group
 * @returns Map from target node ID to array of edges
 *
 * @example
 * ```typescript
 * const grouped = groupEdgesByTarget(edges);
 * const incomingEdges = grouped.get(nodeId) ?? [];
 * ```
 */
export function groupEdgesByTarget(
  edges: readonly GraphEdge[]
): Map<string, GraphEdge[]> {
  const groups = new Map<string, GraphEdge[]>();

  for (const edge of edges) {
    const existing = groups.get(edge.target);
    if (existing) {
      existing.push(edge);
    } else {
      groups.set(edge.target, [edge]);
    }
  }

  return groups;
}

/**
 * Filter edges by type.
 *
 * @param edges - Edges to filter
 * @param types - Edge types to include
 * @returns Filtered array of edges
 *
 * @example
 * ```typescript
 * const dependencyEdges = filterEdgesByType(edges, ['depends_on', 'references']);
 * ```
 */
export function filterEdgesByType(
  edges: readonly GraphEdge[],
  types: readonly EdgeType[]
): GraphEdge[] {
  const typeSet = new Set(types);
  return edges.filter(edge => typeSet.has(edge.type));
}

/**
 * Filter edges by confidence threshold.
 *
 * @param edges - Edges to filter
 * @param minConfidence - Minimum confidence threshold (0-100)
 * @returns Filtered array of edges
 *
 * @example
 * ```typescript
 * const highConfidenceEdges = filterEdgesByConfidence(edges, 80);
 * ```
 */
export function filterEdgesByConfidence(
  edges: readonly GraphEdge[],
  minConfidence: number
): GraphEdge[] {
  return edges.filter(edge => edge.metadata.confidence >= minConfidence);
}

/**
 * Check if an edge type is a Kubernetes-specific relationship.
 *
 * @param type - Edge type to check
 * @returns True if the edge type is Kubernetes-specific
 */
export function isK8sEdgeType(type: EdgeType): boolean {
  const k8sEdgeTypes: EdgeType[] = [
    'selector_match',
    'namespace_member',
    'volume_mount',
    'service_target',
    'ingress_backend',
    'rbac_binding',
    'configmap_ref',
    'secret_ref',
  ];
  return k8sEdgeTypes.includes(type);
}

/**
 * Check if an edge type is a Terraform-specific relationship.
 *
 * @param type - Edge type to check
 * @returns True if the edge type is Terraform-specific
 */
export function isTerraformEdgeType(type: EdgeType): boolean {
  const terraformEdgeTypes: EdgeType[] = [
    'depends_on',
    'references',
    'creates',
    'destroys',
    'module_call',
    'module_source',
    'module_provider',
    'input_variable',
    'output_value',
    'local_reference',
    'provider_config',
    'provider_alias',
    'data_source',
    'data_reference',
  ];
  return terraformEdgeTypes.includes(type);
}

// ============================================================================
// Exports
// ============================================================================

export type { EdgeIdentity, EdgeModification, FieldChange };
