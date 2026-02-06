/**
 * Node Matcher for Graph Diff Computation
 * @module services/rollup/graph-diff/node-matcher
 *
 * Implements the INodeMatcher interface for extracting node identities,
 * building identity indexes, and comparing node attributes for diff computation.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: Optimized for 100K nodes < 500ms benchmark target
 */

import { NodeType, NodeTypeName, isK8sNode, isTerraformNode, isHelmNode } from '../../../types/graph.js';
import { RepositoryId } from '../../../types/entities.js';
import {
  INodeMatcher,
  NodeIdentity,
  NodeIdentityKey,
  NodeIdentityConfig,
  AttributeChange,
  createNodeIdentityKey,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
  GraphDiffError,
  GraphDiffErrorCodes,
} from './interfaces.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Index structure for O(1) node lookup by identity key.
 * Used for efficient matching between base and target snapshots.
 */
export interface NodeIdentityIndex {
  /** Map from identity key to node for quick lookup */
  readonly byIdentityKey: ReadonlyMap<NodeIdentityKey, NodeType>;
  /** Map from node ID to identity for reverse lookup */
  readonly byNodeId: ReadonlyMap<string, NodeIdentity>;
  /** All identities for iteration */
  readonly identities: readonly NodeIdentity[];
  /** Statistics about the index */
  readonly stats: NodeIndexStats;
}

/**
 * Statistics about a node identity index
 */
export interface NodeIndexStats {
  /** Total number of nodes indexed */
  readonly totalNodes: number;
  /** Number of unique identity keys */
  readonly uniqueIdentities: number;
  /** Number of nodes with duplicate identities (potential conflicts) */
  readonly duplicateIdentities: number;
  /** Breakdown by node type */
  readonly byNodeType: Readonly<Record<string, number>>;
  /** Breakdown by namespace (for K8s resources) */
  readonly byNamespace: Readonly<Record<string, number>>;
  /** Time taken to build the index in milliseconds */
  readonly buildTimeMs: number;
}

/**
 * Result of comparing attributes between two nodes
 */
export interface AttributeChanges {
  /** List of individual attribute changes */
  readonly changes: readonly AttributeChange[];
  /** Whether nodes have any differences */
  readonly hasChanges: boolean;
  /** Summary of change counts */
  readonly summary: {
    readonly added: number;
    readonly removed: number;
    readonly modified: number;
  };
}

/**
 * Attributes to always ignore during comparison
 */
const DEFAULT_IGNORE_ATTRIBUTES = [
  'id',
  'metadata.uid',
  'metadata.resourceVersion',
  'metadata.generation',
  'metadata.creationTimestamp',
  'status',
  'location.lineStart',
  'location.lineEnd',
  'location.columnStart',
  'location.columnEnd',
] as const;

/**
 * Node type categories for identity extraction strategies
 */
type NodeCategory = 'terraform' | 'kubernetes' | 'helm' | 'unknown';

// ============================================================================
// Hash Functions
// ============================================================================

/**
 * FNV-1a hash implementation for deterministic identity hashing.
 * Provides fast, consistent hashing for identity keys.
 *
 * @param input - String to hash
 * @returns Hexadecimal hash string
 */
function fnv1aHash(input: string): string {
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;

  let hash = FNV_OFFSET_BASIS;

  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, FNV_PRIME);
  }

  // Convert to unsigned 32-bit and then to hex
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Create a deterministic hash of node identity-relevant attributes.
 *
 * @param node - Node to hash
 * @param includeNamespace - Whether to include namespace in hash
 * @param customAttributes - Additional attributes to include
 * @returns Hash string
 */
function hashNodeIdentity(
  node: NodeType,
  includeNamespace: boolean,
  customAttributes: readonly string[]
): string {
  const parts: string[] = [
    node.type,
    node.name,
    normalizeFilePath(node.location.file),
  ];

  // Include namespace for K8s resources
  if (includeNamespace && 'namespace' in node && typeof node.namespace === 'string') {
    parts.push(node.namespace);
  }

  // Include custom attributes - cast node to unknown first for safe access
  const nodeRecord = node as unknown as Record<string, unknown>;
  for (const attr of customAttributes) {
    const value = getNestedValue(nodeRecord, attr);
    if (value !== undefined) {
      parts.push(String(value));
    }
  }

  return fnv1aHash(parts.join('::'));
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalize file path for consistent comparison.
 * Handles different path separators and removes unnecessary parts.
 *
 * @param filePath - Raw file path
 * @returns Normalized file path
 */
function normalizeFilePath(filePath: string): string {
  // Normalize separators to forward slash
  let normalized = filePath.replace(/\\/g, '/');

  // Remove leading ./
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.substring(0, normalized.length - 1);
  }

  return normalized.toLowerCase();
}

/**
 * Get a nested value from an object using dot notation.
 *
 * @param obj - Object to extract from
 * @param path - Dot notation path (e.g., 'metadata.name')
 * @returns Value at path or undefined
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation.
 *
 * @param obj - Object to modify
 * @param path - Dot notation path
 * @param value - Value to set
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): void {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Determine the category of a node type for identity extraction strategy.
 *
 * @param node - Node to categorize
 * @returns Node category
 */
function getNodeCategory(node: NodeType): NodeCategory {
  if (isTerraformNode(node)) {
    return 'terraform';
  }
  if (isK8sNode(node)) {
    return 'kubernetes';
  }
  if (isHelmNode(node)) {
    return 'helm';
  }
  return 'unknown';
}

/**
 * Extract namespace from a node if applicable.
 *
 * @param node - Node to extract namespace from
 * @returns Namespace string or undefined
 */
function extractNamespace(node: NodeType): string | undefined {
  // Direct namespace property (K8s nodes)
  if ('namespace' in node && typeof node.namespace === 'string') {
    return node.namespace;
  }

  // Check metadata for namespace
  if (
    node.metadata &&
    typeof node.metadata['namespace'] === 'string'
  ) {
    return node.metadata['namespace'];
  }

  return undefined;
}

/**
 * Deep equality check for two values.
 *
 * @param a - First value
 * @param b - Second value
 * @returns True if values are deeply equal
 */
function deepEqual(a: unknown, b: unknown): boolean {
  // Handle primitive types and null/undefined
  if (a === b) {
    return true;
  }

  if (a === null || b === null || a === undefined || b === undefined) {
    return a === b;
  }

  // Handle different types
  if (typeof a !== typeof b) {
    return false;
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) {
      return false;
    }
    return a.every((item, index) => deepEqual(item, b[index]));
  }

  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const aObj = a as Record<string, unknown>;
    const bObj = b as Record<string, unknown>;

    const aKeys = Object.keys(aObj);
    const bKeys = Object.keys(bObj);

    if (aKeys.length !== bKeys.length) {
      return false;
    }

    return aKeys.every((key) => deepEqual(aObj[key], bObj[key]));
  }

  // Primitives that didn't pass === check
  return false;
}

/**
 * Get all paths in an object for comparison.
 *
 * @param obj - Object to get paths from
 * @param prefix - Current path prefix
 * @param paths - Set to accumulate paths
 */
function getAllPaths(
  obj: unknown,
  prefix: string = '',
  paths: Set<string> = new Set()
): Set<string> {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    if (prefix) {
      paths.add(prefix);
    }
    return paths;
  }

  if (Array.isArray(obj)) {
    // For arrays, just mark the array path, don't recurse into indices
    if (prefix) {
      paths.add(prefix);
    }
    return paths;
  }

  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    const path = prefix ? `${prefix}.${key}` : key;
    getAllPaths(record[key], path, paths);
  }

  return paths;
}

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

// ============================================================================
// NodeMatcher Implementation
// ============================================================================

/**
 * Default implementation of INodeMatcher.
 * Provides identity extraction, indexing, and attribute comparison
 * for graph diff computation.
 */
export class NodeMatcher implements INodeMatcher {
  private config: NodeIdentityConfig;
  private readonly supportedNodeTypes: readonly string[];

  /**
   * Create a new NodeMatcher instance.
   *
   * @param config - Optional identity configuration
   */
  constructor(config?: NodeIdentityConfig) {
    this.config = config ?? DEFAULT_DIFF_COMPUTATION_OPTIONS.identityConfig;
    this.supportedNodeTypes = this.buildSupportedNodeTypes();
  }

  // ============================================================================
  // INodeMatcher Implementation
  // ============================================================================

  /**
   * Extract identity from a single node.
   *
   * @param node - Node to extract identity from
   * @param repositoryId - Optional repository ID for context
   * @returns Node identity
   */
  extractIdentity(
    node: NodeType,
    repositoryId?: RepositoryId
  ): NodeIdentity {
    const namespace = this.config.useNamespace ? extractNamespace(node) : undefined;
    const normalizedPath = normalizeFilePath(node.location.file);

    // Create the identity key
    const key = this.createIdentityKey(node.type, node.name, normalizedPath, namespace);

    // Build identity attributes
    const attributes: Record<string, unknown> = {
      resourceType: this.extractResourceType(node),
    };

    // Add custom attributes - cast node to unknown first for safe access
    const nodeRecord = node as unknown as Record<string, unknown>;
    if (this.config.customAttributes) {
      for (const attr of this.config.customAttributes) {
        const value = getNestedValue(nodeRecord, attr);
        if (value !== undefined) {
          setNestedValue(attributes, attr, value);
        }
      }
    }

    // Hash identity-relevant attributes
    const identityHash = hashNodeIdentity(
      node,
      this.config.useNamespace ?? true,
      this.config.customAttributes ?? []
    );

    return {
      key,
      nodeId: node.id,
      nodeType: node.type,
      name: node.name,
      namespace,
      repositoryId,
      attributes: Object.freeze(attributes),
      identityHash,
    };
  }

  /**
   * Extract identities from multiple nodes in batch.
   * Optimized for processing large numbers of nodes.
   *
   * @param nodes - Nodes to process
   * @param repositoryId - Optional repository ID for context
   * @returns Map of node ID to identity
   */
  extractIdentities(
    nodes: readonly NodeType[],
    repositoryId?: RepositoryId
  ): ReadonlyMap<string, NodeIdentity> {
    const identities = new Map<string, NodeIdentity>();

    for (const node of nodes) {
      const identity = this.extractIdentity(node, repositoryId);
      identities.set(node.id, identity);
    }

    return identities;
  }

  /**
   * Compare two nodes for attribute changes beyond identity.
   *
   * @param node1 - First node (base)
   * @param node2 - Second node (target)
   * @returns Array of attribute changes
   */
  compareNodes(
    node1: NodeType,
    node2: NodeType
  ): readonly AttributeChange[] {
    return this.compareAttributes(node1, node2, DEFAULT_IGNORE_ATTRIBUTES).changes;
  }

  /**
   * Check if two identities match.
   *
   * @param identity1 - First identity
   * @param identity2 - Second identity
   * @returns True if identities match
   */
  identitiesMatch(
    identity1: NodeIdentity,
    identity2: NodeIdentity
  ): boolean {
    return identity1.key === identity2.key;
  }

  /**
   * Get supported node types for this matcher.
   *
   * @returns Array of supported node type names
   */
  getSupportedNodeTypes(): readonly string[] {
    return this.supportedNodeTypes;
  }

  /**
   * Configure the matcher with new settings.
   *
   * @param config - New identity configuration
   */
  configure(config: NodeIdentityConfig): void {
    this.config = { ...this.config, ...config };
  }

  // ============================================================================
  // Extended Methods (Beyond Interface)
  // ============================================================================

  /**
   * Build an index from a collection of nodes for O(1) lookup.
   *
   * @param nodes - Map of node ID to node
   * @param repositoryId - Optional repository ID for context
   * @returns Node identity index
   */
  buildIndex(
    nodes: Map<string, NodeType>,
    repositoryId?: RepositoryId
  ): NodeIdentityIndex {
    const startTime = performance.now();

    const byIdentityKey = new Map<NodeIdentityKey, NodeType>();
    const byNodeId = new Map<string, NodeIdentity>();
    const identities: NodeIdentity[] = [];
    const byNodeType: Record<string, number> = {};
    const byNamespace: Record<string, number> = {};
    let duplicateIdentities = 0;

    // Use Array.from for iteration compatibility
    const entries = Array.from(nodes.entries());
    for (const [nodeId, node] of entries) {
      const identity = this.extractIdentity(node, repositoryId);

      // Track duplicates
      if (byIdentityKey.has(identity.key)) {
        duplicateIdentities++;
      }

      byIdentityKey.set(identity.key, node);
      byNodeId.set(nodeId, identity);
      identities.push(identity);

      // Count by node type
      byNodeType[node.type] = (byNodeType[node.type] ?? 0) + 1;

      // Count by namespace
      if (identity.namespace) {
        byNamespace[identity.namespace] = (byNamespace[identity.namespace] ?? 0) + 1;
      }
    }

    const buildTimeMs = performance.now() - startTime;

    const stats: NodeIndexStats = {
      totalNodes: nodes.size,
      uniqueIdentities: byIdentityKey.size,
      duplicateIdentities,
      byNodeType: Object.freeze(byNodeType),
      byNamespace: Object.freeze(byNamespace),
      buildTimeMs,
    };

    return {
      byIdentityKey,
      byNodeId,
      identities,
      stats,
    };
  }

  /**
   * Check if two nodes are equivalent based on identity.
   *
   * @param node1 - First node
   * @param node2 - Second node
   * @returns True if nodes have the same identity
   */
  areEquivalent(node1: NodeType, node2: NodeType): boolean {
    const identity1 = this.extractIdentity(node1);
    const identity2 = this.extractIdentity(node2);
    return this.identitiesMatch(identity1, identity2);
  }

  /**
   * Compare attributes between two nodes with ignore list support.
   *
   * @param baseNode - Base node (older version)
   * @param compareNode - Compare node (newer version)
   * @param ignoreAttributes - Optional list of attributes to ignore
   * @returns Attribute changes or null if nodes are identical
   */
  compareAttributes(
    baseNode: NodeType,
    compareNode: NodeType,
    ignoreAttributes?: readonly string[]
  ): AttributeChanges {
    const ignore = ignoreAttributes ?? DEFAULT_IGNORE_ATTRIBUTES;
    const changes: AttributeChange[] = [];

    // Cast nodes to unknown first for safe access
    const baseRecord = baseNode as unknown as Record<string, unknown>;
    const compareRecord = compareNode as unknown as Record<string, unknown>;

    // Get all paths from both nodes
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
   * Find a node in a target index that matches a source identity.
   *
   * @param sourceIdentity - Identity to find
   * @param targetIndex - Index to search in
   * @returns Matching node or undefined
   */
  findMatchingNode(
    sourceIdentity: NodeIdentity,
    targetIndex: NodeIdentityIndex
  ): NodeType | undefined {
    return targetIndex.byIdentityKey.get(sourceIdentity.key);
  }

  /**
   * Validate that a node can be processed by this matcher.
   *
   * @param node - Node to validate
   * @returns Validation result with any error message
   */
  validateNode(node: NodeType): { valid: boolean; error?: string } {
    if (!node.id) {
      return { valid: false, error: 'Node is missing id property' };
    }

    if (!node.name) {
      return { valid: false, error: 'Node is missing name property' };
    }

    if (!node.type) {
      return { valid: false, error: 'Node is missing type property' };
    }

    if (!node.location?.file) {
      return { valid: false, error: 'Node is missing location.file property' };
    }

    return { valid: true };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Create an identity key from node attributes.
   *
   * @param nodeType - Node type
   * @param name - Node name
   * @param filePath - Normalized file path
   * @param namespace - Optional namespace
   * @returns Node identity key
   */
  private createIdentityKey(
    nodeType: string,
    name: string,
    filePath: string,
    namespace?: string
  ): NodeIdentityKey {
    // Use the factory function from interfaces.ts
    // But add filePath to make it unique within a repository
    const parts = [nodeType, name, filePath];
    if (namespace) {
      parts.push(namespace);
    }
    return parts.join('::') as NodeIdentityKey;
  }

  /**
   * Extract resource type from a node for identity attributes.
   *
   * @param node - Node to extract from
   * @returns Resource type string or undefined
   */
  private extractResourceType(node: NodeType): string | undefined {
    // Terraform resources have resourceType
    if ('resourceType' in node) {
      return (node as { resourceType: string }).resourceType;
    }

    // Terraform data sources have dataType
    if ('dataType' in node) {
      return (node as { dataType: string }).dataType;
    }

    // Helm charts have chartName
    if ('chartName' in node) {
      return (node as { chartName: string }).chartName;
    }

    return undefined;
  }

  /**
   * Build the list of supported node types.
   *
   * @returns Array of node type names
   */
  private buildSupportedNodeTypes(): string[] {
    return [
      // Terraform types
      'terraform_resource',
      'terraform_data',
      'terraform_module',
      'terraform_variable',
      'terraform_output',
      'terraform_local',
      'terraform_provider',
      // Kubernetes types
      'k8s_deployment',
      'k8s_service',
      'k8s_configmap',
      'k8s_secret',
      'k8s_ingress',
      'k8s_pod',
      'k8s_statefulset',
      'k8s_daemonset',
      'k8s_job',
      'k8s_cronjob',
      'k8s_namespace',
      'k8s_serviceaccount',
      'k8s_role',
      'k8s_rolebinding',
      'k8s_clusterrole',
      'k8s_clusterrolebinding',
      'k8s_persistentvolume',
      'k8s_persistentvolumeclaim',
      'k8s_storageclass',
      'k8s_networkpolicy',
      // Helm types
      'helm_chart',
      'helm_release',
      'helm_value',
    ];
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new NodeMatcher instance with default configuration.
 *
 * @returns New NodeMatcher instance
 */
export function createNodeMatcher(): NodeMatcher {
  return new NodeMatcher();
}

/**
 * Create a NodeMatcher with custom configuration.
 *
 * @param config - Identity configuration
 * @returns Configured NodeMatcher instance
 */
export function createConfiguredNodeMatcher(config: NodeIdentityConfig): NodeMatcher {
  return new NodeMatcher(config);
}

/**
 * Create a NodeMatcher optimized for Kubernetes resources.
 * Enables namespace-aware identity matching.
 *
 * @returns NodeMatcher configured for K8s
 */
export function createK8sNodeMatcher(): NodeMatcher {
  return new NodeMatcher({
    useNamespace: true,
    useRepositoryId: true,
    customAttributes: ['selector', 'replicas'],
  });
}

/**
 * Create a NodeMatcher optimized for Terraform resources.
 * Includes provider and resource type in identity.
 *
 * @returns NodeMatcher configured for Terraform
 */
export function createTerraformNodeMatcher(): NodeMatcher {
  return new NodeMatcher({
    useNamespace: false,
    useRepositoryId: true,
    customAttributes: ['provider', 'resourceType', 'source'],
  });
}

/**
 * Create a NodeIdentityKey from individual components.
 * Provides a standardized way to create identity keys externally.
 *
 * @param type - Node type name
 * @param name - Node name
 * @param filePath - File path (will be normalized)
 * @param namespace - Optional namespace for K8s resources
 * @returns Branded NodeIdentityKey
 */
export function createNodeIdentityKeyFromParts(
  type: NodeTypeName | string,
  name: string,
  filePath: string,
  namespace?: string
): NodeIdentityKey {
  const normalizedPath = normalizeFilePath(filePath);
  const parts = [type, name, normalizedPath];
  if (namespace) {
    parts.push(namespace);
  }
  return parts.join('::') as NodeIdentityKey;
}

// ============================================================================
// Utility Exports
// ============================================================================

export {
  normalizeFilePath,
  fnv1aHash,
  getNestedValue,
  deepEqual,
  getAllPaths,
  extractNamespace,
  getNodeCategory,
  DEFAULT_IGNORE_ATTRIBUTES,
};
