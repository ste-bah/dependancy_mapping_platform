/**
 * Graph Diff Computation Interfaces
 * @module services/rollup/graph-diff/interfaces
 *
 * Type definitions and interfaces for the Graph Diff Computation system.
 * Computes structural differences between graph snapshots to enable
 * incremental rollup execution and efficient change detection.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import { NodeType, GraphEdge, EdgeType, DependencyGraph } from '../../../types/graph.js';
import { RollupId, RollupExecutionId, MergedNode } from '../../../types/rollup.js';
import { CacheTag } from '../rollup-cache/interfaces.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Graph Diff identifiers to ensure type safety.
 * Represents a unique identifier for a computed graph diff.
 */
export type GraphDiffId = string & { readonly __brand: 'GraphDiffId' };

/**
 * Branded type for Node Identity keys.
 * Used to uniquely identify a node across graph versions for comparison.
 */
export type NodeIdentityKey = string & { readonly __brand: 'NodeIdentityKey' };

/**
 * Branded type for Edge Identity keys.
 * Used to uniquely identify an edge across graph versions for comparison.
 */
export type EdgeIdentityKey = string & { readonly __brand: 'EdgeIdentityKey' };

/**
 * Branded type for Graph Snapshot identifiers.
 * Represents a specific version/snapshot of a graph at a point in time.
 */
export type GraphSnapshotId = string & { readonly __brand: 'GraphSnapshotId' };

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

/**
 * Create a typed GraphDiffId
 * @param id - The raw string identifier
 * @returns Branded GraphDiffId
 */
export function createGraphDiffId(id: string): GraphDiffId {
  return id as GraphDiffId;
}

/**
 * Create a typed NodeIdentityKey from node attributes
 * @param nodeType - The node type (e.g., 'terraform_resource')
 * @param name - The node name
 * @param namespace - Optional namespace for K8s resources
 * @returns Branded NodeIdentityKey
 */
export function createNodeIdentityKey(
  nodeType: string,
  name: string,
  namespace?: string
): NodeIdentityKey {
  const parts = [nodeType, name];
  if (namespace) {
    parts.push(namespace);
  }
  return parts.join('::') as NodeIdentityKey;
}

/**
 * Create a typed EdgeIdentityKey from edge attributes
 * @param sourceKey - Source node identity key
 * @param targetKey - Target node identity key
 * @param edgeType - The edge type
 * @returns Branded EdgeIdentityKey
 */
export function createEdgeIdentityKey(
  sourceKey: NodeIdentityKey,
  targetKey: NodeIdentityKey,
  edgeType: EdgeType
): EdgeIdentityKey {
  return `${sourceKey}->${targetKey}:${edgeType}` as EdgeIdentityKey;
}

/**
 * Create a typed GraphSnapshotId
 * @param id - The raw string identifier
 * @returns Branded GraphSnapshotId
 */
export function createGraphSnapshotId(id: string): GraphSnapshotId {
  return id as GraphSnapshotId;
}

/**
 * Generate a unique GraphDiffId from component identifiers
 * @param baseSnapshotId - The base snapshot identifier
 * @param targetSnapshotId - The target snapshot identifier
 * @param timestamp - Optional timestamp for uniqueness
 * @returns Branded GraphDiffId
 */
export function generateGraphDiffId(
  baseSnapshotId: GraphSnapshotId,
  targetSnapshotId: GraphSnapshotId,
  timestamp?: Date
): GraphDiffId {
  const ts = timestamp ? timestamp.getTime() : Date.now();
  return `diff:${baseSnapshotId}:${targetSnapshotId}:${ts}` as GraphDiffId;
}

// ============================================================================
// Identity Types
// ============================================================================

/**
 * Represents the unique identity of a node for diff comparison.
 * Extracted from node attributes using strategy-specific logic.
 */
export interface NodeIdentity {
  /** Unique identity key for comparison */
  readonly key: NodeIdentityKey;
  /** Original node ID in the graph */
  readonly nodeId: string;
  /** Node type for context */
  readonly nodeType: string;
  /** Node name */
  readonly name: string;
  /** Namespace (for K8s resources) */
  readonly namespace?: string;
  /** Repository this node belongs to */
  readonly repositoryId?: RepositoryId;
  /** Additional identity attributes for comparison */
  readonly attributes: Readonly<Record<string, unknown>>;
  /** Hash of identity-relevant attributes for quick comparison */
  readonly identityHash: string;
}

/**
 * Represents the unique identity of an edge for diff comparison.
 * Computed from source node, target node, and edge type.
 */
export interface EdgeIdentity {
  /** Unique identity key for comparison */
  readonly key: EdgeIdentityKey;
  /** Original edge ID in the graph */
  readonly edgeId: string;
  /** Source node identity */
  readonly sourceIdentity: NodeIdentity;
  /** Target node identity */
  readonly targetIdentity: NodeIdentity;
  /** Edge type */
  readonly edgeType: EdgeType;
  /** Additional edge attributes for comparison */
  readonly attributes: Readonly<Record<string, unknown>>;
  /** Hash of identity-relevant attributes for quick comparison */
  readonly identityHash: string;
}

// ============================================================================
// Diff Set Types
// ============================================================================

/**
 * Change type for diff operations
 */
export type DiffChangeType = 'added' | 'removed' | 'modified' | 'unchanged';

/**
 * Represents a single node difference
 */
export interface NodeDiff {
  /** Type of change */
  readonly changeType: DiffChangeType;
  /** Node identity */
  readonly identity: NodeIdentity;
  /** The node in the base snapshot (null if added) */
  readonly baseNode: NodeType | null;
  /** The node in the target snapshot (null if removed) */
  readonly targetNode: NodeType | null;
  /** Specific attribute changes for modified nodes */
  readonly attributeChanges?: AttributeChange[];
}

/**
 * Represents a change to a specific node attribute
 */
export interface AttributeChange {
  /** Path to the changed attribute (dot notation) */
  readonly path: string;
  /** Previous value (undefined if newly added attribute) */
  readonly previousValue?: unknown;
  /** New value (undefined if removed attribute) */
  readonly newValue?: unknown;
  /** Type of change */
  readonly changeType: 'added' | 'removed' | 'modified';
}

/**
 * Collection of node differences
 */
export interface NodeDiffSet {
  /** Nodes added in target snapshot */
  readonly added: readonly NodeDiff[];
  /** Nodes removed from base snapshot */
  readonly removed: readonly NodeDiff[];
  /** Nodes modified between snapshots */
  readonly modified: readonly NodeDiff[];
  /** Nodes unchanged between snapshots */
  readonly unchanged: readonly NodeDiff[];
  /** Total node count in base snapshot */
  readonly baseNodeCount: number;
  /** Total node count in target snapshot */
  readonly targetNodeCount: number;
  /** Quick access map by identity key */
  readonly byIdentityKey: ReadonlyMap<NodeIdentityKey, NodeDiff>;
}

/**
 * Represents a single edge difference
 */
export interface EdgeDiff {
  /** Type of change */
  readonly changeType: DiffChangeType;
  /** Edge identity */
  readonly identity: EdgeIdentity;
  /** The edge in the base snapshot (null if added) */
  readonly baseEdge: GraphEdge | null;
  /** The edge in the target snapshot (null if removed) */
  readonly targetEdge: GraphEdge | null;
  /** Specific attribute changes for modified edges */
  readonly attributeChanges?: AttributeChange[];
}

/**
 * Collection of edge differences
 */
export interface EdgeDiffSet {
  /** Edges added in target snapshot */
  readonly added: readonly EdgeDiff[];
  /** Edges removed from base snapshot */
  readonly removed: readonly EdgeDiff[];
  /** Edges modified between snapshots */
  readonly modified: readonly EdgeDiff[];
  /** Edges unchanged between snapshots */
  readonly unchanged: readonly EdgeDiff[];
  /** Total edge count in base snapshot */
  readonly baseEdgeCount: number;
  /** Total edge count in target snapshot */
  readonly targetEdgeCount: number;
  /** Quick access map by identity key */
  readonly byIdentityKey: ReadonlyMap<EdgeIdentityKey, EdgeDiff>;
}

// ============================================================================
// Graph Diff Result Types
// ============================================================================

/**
 * Summary statistics for a graph diff computation
 */
export interface DiffSummary {
  /** Total nodes in base snapshot */
  readonly baseNodeCount: number;
  /** Total nodes in target snapshot */
  readonly targetNodeCount: number;
  /** Number of nodes added */
  readonly nodesAdded: number;
  /** Number of nodes removed */
  readonly nodesRemoved: number;
  /** Number of nodes modified */
  readonly nodesModified: number;
  /** Number of nodes unchanged */
  readonly nodesUnchanged: number;
  /** Total edges in base snapshot */
  readonly baseEdgeCount: number;
  /** Total edges in target snapshot */
  readonly targetEdgeCount: number;
  /** Number of edges added */
  readonly edgesAdded: number;
  /** Number of edges removed */
  readonly edgesRemoved: number;
  /** Number of edges modified */
  readonly edgesModified: number;
  /** Number of edges unchanged */
  readonly edgesUnchanged: number;
  /** Node change ratio (0-1) */
  readonly nodeChangeRatio: number;
  /** Edge change ratio (0-1) */
  readonly edgeChangeRatio: number;
  /** Overall change ratio (0-1) */
  readonly overallChangeRatio: number;
  /** Whether this is a significant change (above threshold) */
  readonly isSignificantChange: boolean;
  /** Change breakdown by node type */
  readonly changesByNodeType: Readonly<Record<string, {
    added: number;
    removed: number;
    modified: number;
  }>>;
  /** Change breakdown by edge type */
  readonly changesByEdgeType: Readonly<Partial<Record<EdgeType, {
    added: number;
    removed: number;
    modified: number;
  }>>>;
}

/**
 * Complete result of a graph diff computation
 */
export interface GraphDiffResult {
  /** Unique identifier for this diff */
  readonly id: GraphDiffId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Base snapshot identifier */
  readonly baseSnapshotId: GraphSnapshotId;
  /** Target snapshot identifier */
  readonly targetSnapshotId: GraphSnapshotId;
  /** Rollup ID if this diff is part of a rollup execution */
  readonly rollupId?: RollupId;
  /** Execution ID if this diff is part of a rollup execution */
  readonly executionId?: RollupExecutionId;
  /** Node differences */
  readonly nodeDiffs: NodeDiffSet;
  /** Edge differences */
  readonly edgeDiffs: EdgeDiffSet;
  /** Summary statistics */
  readonly summary: DiffSummary;
  /** Computation timing information */
  readonly timing: DiffTiming;
  /** When the diff was computed */
  readonly computedAt: Date;
  /** Options used for computation */
  readonly options: DiffComputationOptions;
}

/**
 * Timing information for diff computation
 */
export interface DiffTiming {
  /** Total computation time in milliseconds */
  readonly totalMs: number;
  /** Time spent extracting node identities */
  readonly nodeIdentityExtractionMs: number;
  /** Time spent comparing nodes */
  readonly nodeComparisonMs: number;
  /** Time spent extracting edge identities */
  readonly edgeIdentityExtractionMs: number;
  /** Time spent comparing edges */
  readonly edgeComparisonMs: number;
  /** Time spent computing summary statistics */
  readonly summaryComputationMs: number;
  /** Nodes processed per second */
  readonly nodesPerSecond: number;
  /** Edges processed per second */
  readonly edgesPerSecond: number;
}

// ============================================================================
// Computation Options
// ============================================================================

/**
 * Options for controlling diff computation behavior
 */
export interface DiffComputationOptions {
  /** Include unchanged nodes/edges in result (default: false) */
  readonly includeUnchanged?: boolean;
  /** Include detailed attribute changes (default: true) */
  readonly includeAttributeChanges?: boolean;
  /** Threshold for significant change detection (0-1, default: 0.1) */
  readonly significantChangeThreshold?: number;
  /** Node types to include in diff (default: all) */
  readonly includeNodeTypes?: readonly string[];
  /** Node types to exclude from diff */
  readonly excludeNodeTypes?: readonly string[];
  /** Edge types to include in diff (default: all) */
  readonly includeEdgeTypes?: readonly EdgeType[];
  /** Edge types to exclude from diff */
  readonly excludeEdgeTypes?: readonly EdgeType[];
  /** Maximum nodes to process (for performance limits) */
  readonly maxNodes?: number;
  /** Maximum edges to process (for performance limits) */
  readonly maxEdges?: number;
  /** Enable parallel processing (default: true) */
  readonly enableParallelProcessing?: boolean;
  /** Batch size for parallel processing */
  readonly batchSize?: number;
  /** Timeout in milliseconds */
  readonly timeoutMs?: number;
  /** Enable caching of intermediate results */
  readonly enableCaching?: boolean;
  /** Cache TTL in seconds */
  readonly cacheTtlSeconds?: number;
  /** Custom identity extraction configuration */
  readonly identityConfig?: NodeIdentityConfig;
}

/**
 * Default computation options
 */
export const DEFAULT_DIFF_COMPUTATION_OPTIONS: Required<DiffComputationOptions> = {
  includeUnchanged: false,
  includeAttributeChanges: true,
  significantChangeThreshold: 0.1,
  includeNodeTypes: [],
  excludeNodeTypes: [],
  includeEdgeTypes: [],
  excludeEdgeTypes: [],
  maxNodes: 100000,
  maxEdges: 500000,
  enableParallelProcessing: true,
  batchSize: 1000,
  timeoutMs: 30000,
  enableCaching: true,
  cacheTtlSeconds: 300,
  identityConfig: {
    useNamespace: true,
    useRepositoryId: true,
    customAttributes: [],
  },
};

/**
 * Configuration for node identity extraction
 */
export interface NodeIdentityConfig {
  /** Include namespace in identity key (for K8s resources) */
  readonly useNamespace?: boolean;
  /** Include repository ID in identity key */
  readonly useRepositoryId?: boolean;
  /** Custom attributes to include in identity */
  readonly customAttributes?: readonly string[];
  /** Custom identity extractors by node type */
  readonly customExtractors?: Readonly<Record<string, (node: NodeType) => string>>;
}

// ============================================================================
// Graph Snapshot Types
// ============================================================================

/**
 * Represents a graph snapshot for diff comparison
 */
export interface GraphSnapshot {
  /** Unique snapshot identifier */
  readonly id: GraphSnapshotId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Repository ID (if single-repo snapshot) */
  readonly repositoryId?: RepositoryId;
  /** Scan ID this snapshot was derived from */
  readonly scanId?: ScanId;
  /** The dependency graph */
  readonly graph: DependencyGraph;
  /** When the snapshot was taken */
  readonly createdAt: Date;
  /** Version/revision number for ordering */
  readonly version: number;
  /** Optional metadata */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * Lightweight reference to a graph snapshot
 */
export interface GraphSnapshotRef {
  /** Snapshot identifier */
  readonly id: GraphSnapshotId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Node count */
  readonly nodeCount: number;
  /** Edge count */
  readonly edgeCount: number;
  /** When the snapshot was taken */
  readonly createdAt: Date;
  /** Version number */
  readonly version: number;
}

// ============================================================================
// Core Interfaces
// ============================================================================

/**
 * Main interface for the Graph Diff computation engine.
 * Computes structural differences between graph snapshots.
 */
export interface IGraphDiffEngine {
  /**
   * Compute differences between two graph snapshots
   * @param baseSnapshot - The base (older) snapshot
   * @param targetSnapshot - The target (newer) snapshot
   * @param options - Computation options
   * @returns Complete diff result
   */
  computeDiff(
    baseSnapshot: GraphSnapshot,
    targetSnapshot: GraphSnapshot,
    options?: DiffComputationOptions
  ): Promise<GraphDiffResult>;

  /**
   * Compute differences using snapshot references (loads from storage)
   * @param tenantId - Tenant identifier
   * @param baseSnapshotId - Base snapshot identifier
   * @param targetSnapshotId - Target snapshot identifier
   * @param options - Computation options
   * @returns Complete diff result
   */
  computeDiffByIds(
    tenantId: TenantId,
    baseSnapshotId: GraphSnapshotId,
    targetSnapshotId: GraphSnapshotId,
    options?: DiffComputationOptions
  ): Promise<GraphDiffResult>;

  /**
   * Get a cached diff result if available
   * @param tenantId - Tenant identifier
   * @param diffId - Diff identifier
   * @returns Cached diff or null
   */
  getCachedDiff(
    tenantId: TenantId,
    diffId: GraphDiffId
  ): Promise<GraphDiffResult | null>;

  /**
   * Compute incremental update based on diff
   * @param diff - Previously computed diff
   * @param mergedNodes - Current merged nodes to update
   * @returns Updated merged nodes
   */
  applyDiffToMergedGraph(
    diff: GraphDiffResult,
    mergedNodes: readonly MergedNode[]
  ): Promise<readonly MergedNode[]>;

  /**
   * Estimate computation cost without performing the diff
   * @param baseSnapshot - Base snapshot reference
   * @param targetSnapshot - Target snapshot reference
   * @returns Estimated cost and timing
   */
  estimateCost(
    baseSnapshot: GraphSnapshotRef,
    targetSnapshot: GraphSnapshotRef
  ): DiffCostEstimate;

  /**
   * Validate that diff computation can proceed
   * @param baseSnapshot - Base snapshot
   * @param targetSnapshot - Target snapshot
   * @returns Validation result
   */
  validateSnapshots(
    baseSnapshot: GraphSnapshot,
    targetSnapshot: GraphSnapshot
  ): DiffValidationResult;

  /**
   * Initialize the engine (connect to dependencies)
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the engine gracefully
   */
  shutdown(): Promise<void>;
}

/**
 * Estimated cost for a diff computation
 */
export interface DiffCostEstimate {
  /** Estimated computation time in milliseconds */
  readonly estimatedTimeMs: number;
  /** Estimated memory usage in bytes */
  readonly estimatedMemoryBytes: number;
  /** Total nodes to process */
  readonly totalNodes: number;
  /** Total edges to process */
  readonly totalEdges: number;
  /** Whether the computation is within limits */
  readonly withinLimits: boolean;
  /** Warning messages if approaching limits */
  readonly warnings: readonly string[];
}

/**
 * Result of snapshot validation
 */
export interface DiffValidationResult {
  /** Whether validation passed */
  readonly isValid: boolean;
  /** Validation errors */
  readonly errors: readonly DiffValidationError[];
  /** Validation warnings */
  readonly warnings: readonly string[];
}

/**
 * Validation error detail
 */
export interface DiffValidationError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Related snapshot (base or target) */
  readonly snapshot: 'base' | 'target' | 'both';
}

// ============================================================================
// Matcher Interfaces
// ============================================================================

/**
 * Interface for extracting and comparing node identities.
 * Implements Strategy pattern for different identity extraction approaches.
 */
export interface INodeMatcher {
  /**
   * Extract identity from a node
   * @param node - The node to extract identity from
   * @param repositoryId - Optional repository ID for context
   * @returns Node identity
   */
  extractIdentity(
    node: NodeType,
    repositoryId?: RepositoryId
  ): NodeIdentity;

  /**
   * Extract identities from multiple nodes in batch
   * @param nodes - Nodes to process
   * @param repositoryId - Optional repository ID for context
   * @returns Map of node ID to identity
   */
  extractIdentities(
    nodes: readonly NodeType[],
    repositoryId?: RepositoryId
  ): ReadonlyMap<string, NodeIdentity>;

  /**
   * Compare two nodes for equality (beyond identity)
   * @param node1 - First node
   * @param node2 - Second node
   * @returns Attribute changes if nodes differ, empty array if equal
   */
  compareNodes(
    node1: NodeType,
    node2: NodeType
  ): readonly AttributeChange[];

  /**
   * Check if two identities match
   * @param identity1 - First identity
   * @param identity2 - Second identity
   * @returns True if identities match
   */
  identitiesMatch(
    identity1: NodeIdentity,
    identity2: NodeIdentity
  ): boolean;

  /**
   * Get supported node types for this matcher
   * @returns Array of supported node type names
   */
  getSupportedNodeTypes(): readonly string[];

  /**
   * Configure the matcher
   * @param config - Identity configuration
   */
  configure(config: NodeIdentityConfig): void;
}

/**
 * Interface for extracting and comparing edge identities.
 */
export interface IEdgeMatcher {
  /**
   * Extract identity from an edge
   * @param edge - The edge to extract identity from
   * @param nodeIdentities - Map of node identities for reference
   * @returns Edge identity
   */
  extractIdentity(
    edge: GraphEdge,
    nodeIdentities: ReadonlyMap<string, NodeIdentity>
  ): EdgeIdentity;

  /**
   * Extract identities from multiple edges in batch
   * @param edges - Edges to process
   * @param nodeIdentities - Map of node identities for reference
   * @returns Map of edge ID to identity
   */
  extractIdentities(
    edges: readonly GraphEdge[],
    nodeIdentities: ReadonlyMap<string, NodeIdentity>
  ): ReadonlyMap<string, EdgeIdentity>;

  /**
   * Compare two edges for equality (beyond identity)
   * @param edge1 - First edge
   * @param edge2 - Second edge
   * @returns Attribute changes if edges differ, empty array if equal
   */
  compareEdges(
    edge1: GraphEdge,
    edge2: GraphEdge
  ): readonly AttributeChange[];

  /**
   * Check if two identities match
   * @param identity1 - First identity
   * @param identity2 - Second identity
   * @returns True if identities match
   */
  identitiesMatch(
    identity1: EdgeIdentity,
    identity2: EdgeIdentity
  ): boolean;

  /**
   * Get supported edge types for this matcher
   * @returns Array of supported edge types
   */
  getSupportedEdgeTypes(): readonly EdgeType[];
}

// ============================================================================
// Diff Cache Interface
// ============================================================================

/**
 * Interface for caching diff computation results.
 * Extends the general rollup cache with diff-specific operations.
 */
export interface IDiffCache {
  /**
   * Get a cached diff result
   * @param tenantId - Tenant identifier
   * @param diffId - Diff identifier
   * @returns Cached diff or null
   */
  getDiff(
    tenantId: TenantId,
    diffId: GraphDiffId
  ): Promise<CachedDiffResult | null>;

  /**
   * Cache a diff result
   * @param tenantId - Tenant identifier
   * @param diff - Diff result to cache
   * @param tags - Optional cache tags for invalidation
   */
  setDiff(
    tenantId: TenantId,
    diff: GraphDiffResult,
    tags?: readonly CacheTag[]
  ): Promise<void>;

  /**
   * Get diff by snapshot pair
   * @param tenantId - Tenant identifier
   * @param baseSnapshotId - Base snapshot identifier
   * @param targetSnapshotId - Target snapshot identifier
   * @returns Cached diff or null
   */
  getDiffBySnapshots(
    tenantId: TenantId,
    baseSnapshotId: GraphSnapshotId,
    targetSnapshotId: GraphSnapshotId
  ): Promise<CachedDiffResult | null>;

  /**
   * Invalidate cached diffs for a snapshot
   * @param tenantId - Tenant identifier
   * @param snapshotId - Snapshot identifier
   * @returns Number of entries invalidated
   */
  invalidateBySnapshot(
    tenantId: TenantId,
    snapshotId: GraphSnapshotId
  ): Promise<number>;

  /**
   * Invalidate all cached diffs for a tenant
   * @param tenantId - Tenant identifier
   * @returns Number of entries invalidated
   */
  invalidateTenant(tenantId: TenantId): Promise<number>;

  /**
   * Get cache statistics
   */
  getStats(): DiffCacheStats;
}

/**
 * Cached diff result with metadata
 */
export interface CachedDiffResult {
  /** The diff result */
  readonly diff: GraphDiffResult;
  /** Cache metadata */
  readonly metadata: DiffCacheMetadata;
}

/**
 * Metadata for cached diff entries
 */
export interface DiffCacheMetadata {
  /** When the entry was cached */
  readonly cachedAt: Date;
  /** When the entry expires */
  readonly expiresAt: Date;
  /** TTL in seconds */
  readonly ttlSeconds: number;
  /** Size in bytes (approximate) */
  readonly sizeBytes?: number;
  /** Tags for invalidation */
  readonly tags: readonly CacheTag[];
  /** Access count */
  readonly accessCount: number;
  /** Last accessed time */
  readonly lastAccessedAt: Date;
}

/**
 * Statistics for the diff cache
 */
export interface DiffCacheStats {
  /** Cache hits */
  readonly hits: number;
  /** Cache misses */
  readonly misses: number;
  /** Hit ratio (0-1) */
  readonly hitRatio: number;
  /** Current entry count */
  readonly entryCount: number;
  /** Total cached diffs size in bytes */
  readonly totalSizeBytes: number;
  /** Average diff size in bytes */
  readonly avgDiffSizeBytes: number;
  /** Sets count */
  readonly setsCount: number;
  /** Invalidations count */
  readonly invalidationsCount: number;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Error codes for graph diff operations
 */
export const GraphDiffErrorCodes = {
  /** General computation error */
  COMPUTATION_FAILED: 'GRAPH_DIFF_COMPUTATION_FAILED',
  /** Snapshot not found */
  SNAPSHOT_NOT_FOUND: 'GRAPH_DIFF_SNAPSHOT_NOT_FOUND',
  /** Invalid snapshot format */
  INVALID_SNAPSHOT: 'GRAPH_DIFF_INVALID_SNAPSHOT',
  /** Snapshots are incompatible for comparison */
  INCOMPATIBLE_SNAPSHOTS: 'GRAPH_DIFF_INCOMPATIBLE_SNAPSHOTS',
  /** Computation timeout exceeded */
  TIMEOUT: 'GRAPH_DIFF_TIMEOUT',
  /** Maximum nodes exceeded */
  MAX_NODES_EXCEEDED: 'GRAPH_DIFF_MAX_NODES_EXCEEDED',
  /** Maximum edges exceeded */
  MAX_EDGES_EXCEEDED: 'GRAPH_DIFF_MAX_EDGES_EXCEEDED',
  /** Cache operation failed */
  CACHE_ERROR: 'GRAPH_DIFF_CACHE_ERROR',
  /** Identity extraction failed */
  IDENTITY_EXTRACTION_FAILED: 'GRAPH_DIFF_IDENTITY_EXTRACTION_FAILED',
  /** Node comparison failed */
  NODE_COMPARISON_FAILED: 'GRAPH_DIFF_NODE_COMPARISON_FAILED',
  /** Edge comparison failed */
  EDGE_COMPARISON_FAILED: 'GRAPH_DIFF_EDGE_COMPARISON_FAILED',
  /** Engine not initialized */
  NOT_INITIALIZED: 'GRAPH_DIFF_NOT_INITIALIZED',
  /** Invalid configuration */
  INVALID_CONFIG: 'GRAPH_DIFF_INVALID_CONFIG',
  /** Tenant mismatch between snapshots */
  TENANT_MISMATCH: 'GRAPH_DIFF_TENANT_MISMATCH',
} as const;

/**
 * Type for graph diff error codes
 */
export type GraphDiffErrorCode =
  typeof GraphDiffErrorCodes[keyof typeof GraphDiffErrorCodes];

/**
 * Error class for graph diff operations
 */
export class GraphDiffError extends Error {
  /** Error code */
  public readonly code: GraphDiffErrorCode;
  /** Error context */
  public readonly context?: Readonly<Record<string, unknown>>;
  /** Original cause */
  public readonly cause?: Error;

  /**
   * Create a new GraphDiffError
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   * @param context - Additional error context
   * @param cause - Original error if wrapping
   */
  constructor(
    message: string,
    code: GraphDiffErrorCode,
    context?: Record<string, unknown>,
    cause?: Error
  ) {
    super(message);
    this.name = 'GraphDiffError';
    this.code = code;
    this.context = context ? Object.freeze(context) : undefined;
    this.cause = cause;

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphDiffError);
    }
  }

  /**
   * Create a computation failed error
   */
  static computationFailed(reason: string, cause?: Error): GraphDiffError {
    return new GraphDiffError(
      `Graph diff computation failed: ${reason}`,
      GraphDiffErrorCodes.COMPUTATION_FAILED,
      { reason },
      cause
    );
  }

  /**
   * Create a snapshot not found error
   */
  static snapshotNotFound(snapshotId: string, tenantId?: string): GraphDiffError {
    return new GraphDiffError(
      `Graph snapshot not found: ${snapshotId}`,
      GraphDiffErrorCodes.SNAPSHOT_NOT_FOUND,
      { snapshotId, tenantId }
    );
  }

  /**
   * Create an incompatible snapshots error
   */
  static incompatibleSnapshots(
    baseSnapshotId: string,
    targetSnapshotId: string,
    reason: string
  ): GraphDiffError {
    return new GraphDiffError(
      `Snapshots are incompatible: ${reason}`,
      GraphDiffErrorCodes.INCOMPATIBLE_SNAPSHOTS,
      { baseSnapshotId, targetSnapshotId, reason }
    );
  }

  /**
   * Create a timeout error
   */
  static timeout(timeoutMs: number, elapsedMs: number): GraphDiffError {
    return new GraphDiffError(
      `Graph diff computation timed out after ${elapsedMs}ms (limit: ${timeoutMs}ms)`,
      GraphDiffErrorCodes.TIMEOUT,
      { timeoutMs, elapsedMs }
    );
  }

  /**
   * Create a max nodes exceeded error
   */
  static maxNodesExceeded(nodeCount: number, maxNodes: number): GraphDiffError {
    return new GraphDiffError(
      `Maximum node count exceeded: ${nodeCount} > ${maxNodes}`,
      GraphDiffErrorCodes.MAX_NODES_EXCEEDED,
      { nodeCount, maxNodes }
    );
  }

  /**
   * Create a tenant mismatch error
   */
  static tenantMismatch(baseTenantId: string, targetTenantId: string): GraphDiffError {
    return new GraphDiffError(
      `Tenant mismatch: base snapshot tenant (${baseTenantId}) != target snapshot tenant (${targetTenantId})`,
      GraphDiffErrorCodes.TENANT_MISMATCH,
      { baseTenantId, targetTenantId }
    );
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a NodeIdentity
 */
export function isNodeIdentity(value: unknown): value is NodeIdentity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    'nodeId' in value &&
    'nodeType' in value &&
    'name' in value &&
    'identityHash' in value
  );
}

/**
 * Check if value is an EdgeIdentity
 */
export function isEdgeIdentity(value: unknown): value is EdgeIdentity {
  return (
    typeof value === 'object' &&
    value !== null &&
    'key' in value &&
    'edgeId' in value &&
    'sourceIdentity' in value &&
    'targetIdentity' in value &&
    'edgeType' in value &&
    'identityHash' in value
  );
}

/**
 * Check if value is a NodeDiff
 */
export function isNodeDiff(value: unknown): value is NodeDiff {
  return (
    typeof value === 'object' &&
    value !== null &&
    'changeType' in value &&
    'identity' in value &&
    isValidChangeType((value as NodeDiff).changeType)
  );
}

/**
 * Check if value is an EdgeDiff
 */
export function isEdgeDiff(value: unknown): value is EdgeDiff {
  return (
    typeof value === 'object' &&
    value !== null &&
    'changeType' in value &&
    'identity' in value &&
    isValidChangeType((value as EdgeDiff).changeType)
  );
}

/**
 * Check if value is a valid DiffChangeType
 */
export function isValidChangeType(value: unknown): value is DiffChangeType {
  return (
    value === 'added' ||
    value === 'removed' ||
    value === 'modified' ||
    value === 'unchanged'
  );
}

/**
 * Check if value is a GraphDiffResult
 */
export function isGraphDiffResult(value: unknown): value is GraphDiffResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'baseSnapshotId' in value &&
    'targetSnapshotId' in value &&
    'nodeDiffs' in value &&
    'edgeDiffs' in value &&
    'summary' in value
  );
}

/**
 * Check if value is a GraphSnapshot
 */
export function isGraphSnapshot(value: unknown): value is GraphSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'graph' in value &&
    'createdAt' in value &&
    'version' in value
  );
}

/**
 * Check if a GraphDiffError is of a specific code
 */
export function isGraphDiffErrorCode(
  error: unknown,
  code: GraphDiffErrorCode
): error is GraphDiffError {
  return error instanceof GraphDiffError && error.code === code;
}

// ============================================================================
// Factory Functions for Empty/Default Objects
// ============================================================================

/**
 * Create an empty NodeDiffSet
 */
export function createEmptyNodeDiffSet(): NodeDiffSet {
  return {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    baseNodeCount: 0,
    targetNodeCount: 0,
    byIdentityKey: new Map(),
  };
}

/**
 * Create an empty EdgeDiffSet
 */
export function createEmptyEdgeDiffSet(): EdgeDiffSet {
  return {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    baseEdgeCount: 0,
    targetEdgeCount: 0,
    byIdentityKey: new Map(),
  };
}

/**
 * Create an empty DiffSummary
 */
export function createEmptyDiffSummary(): DiffSummary {
  return {
    baseNodeCount: 0,
    targetNodeCount: 0,
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 0,
    nodesUnchanged: 0,
    baseEdgeCount: 0,
    targetEdgeCount: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    edgesModified: 0,
    edgesUnchanged: 0,
    nodeChangeRatio: 0,
    edgeChangeRatio: 0,
    overallChangeRatio: 0,
    isSignificantChange: false,
    changesByNodeType: {},
    changesByEdgeType: {},
  };
}

/**
 * Create empty DiffCacheStats
 */
export function createEmptyDiffCacheStats(): DiffCacheStats {
  return {
    hits: 0,
    misses: 0,
    hitRatio: 0,
    entryCount: 0,
    totalSizeBytes: 0,
    avgDiffSizeBytes: 0,
    setsCount: 0,
    invalidationsCount: 0,
  };
}

/**
 * Create default DiffTiming
 */
export function createDefaultDiffTiming(): DiffTiming {
  return {
    totalMs: 0,
    nodeIdentityExtractionMs: 0,
    nodeComparisonMs: 0,
    edgeIdentityExtractionMs: 0,
    edgeComparisonMs: 0,
    summaryComputationMs: 0,
    nodesPerSecond: 0,
    edgesPerSecond: 0,
  };
}
