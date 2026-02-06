/**
 * Graph Diff Type Definitions
 * @module diff/types
 *
 * Type definitions for computing and representing differences between
 * dependency graph scans. Enables tracking what changed in the graph
 * over time across commits, branches, or arbitrary scan pairs.
 *
 * TASK-ROLLUP-005: Diff Computation types for graph comparison
 */

import { ScanId, RepositoryId, TenantId } from '../types/entities.js';
import { NodeType, GraphEdge, EdgeType } from '../types/graph.js';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded type for Diff IDs
 * Ensures type safety when passing diff identifiers
 * @example
 * const diffId = createDiffId('diff_01HXYZ...');
 */
export type DiffId = string & { readonly __brand: 'DiffId' };

/**
 * Branded type for Diff Cache Keys
 * Used for caching computed diff results
 * @example
 * const cacheKey = createDiffCacheKey('diff:repo_123:scan_a:scan_b');
 */
export type DiffCacheKey = string & { readonly __brand: 'DiffCacheKey' };

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

/**
 * Create a typed DiffId
 * @param id - The raw diff identifier string
 * @returns Branded DiffId type
 */
export function createDiffId(id: string): DiffId {
  return id as DiffId;
}

/**
 * Create a typed DiffCacheKey
 * @param key - The raw cache key string
 * @returns Branded DiffCacheKey type
 */
export function createDiffCacheKey(key: string): DiffCacheKey {
  return key as DiffCacheKey;
}

/**
 * Generate a diff ID from scan pair
 * @param baseScanId - Base scan identifier
 * @param compareScanId - Comparison scan identifier
 * @returns Generated DiffId
 */
export function generateDiffId(baseScanId: ScanId, compareScanId: ScanId): DiffId {
  return createDiffId(`diff_${baseScanId}_${compareScanId}`);
}

/**
 * Generate a cache key for a diff computation
 * @param repositoryId - Repository identifier
 * @param baseScanId - Base scan identifier
 * @param compareScanId - Comparison scan identifier
 * @returns Generated DiffCacheKey
 */
export function generateDiffCacheKey(
  repositoryId: RepositoryId,
  baseScanId: ScanId,
  compareScanId: ScanId
): DiffCacheKey {
  return createDiffCacheKey(`diff:${repositoryId}:${baseScanId}:${compareScanId}`);
}

// ============================================================================
// Change Type Enumeration
// ============================================================================

/**
 * Types of changes that can occur in a diff
 */
export const ChangeType = {
  /** Element was added in the compare scan */
  ADDED: 'added',
  /** Element was removed in the compare scan */
  REMOVED: 'removed',
  /** Element exists in both but has modifications */
  MODIFIED: 'modified',
  /** Element is unchanged */
  UNCHANGED: 'unchanged',
} as const;

export type ChangeType = typeof ChangeType[keyof typeof ChangeType];

/**
 * Impact assessment levels for diff changes
 */
export const ImpactLevel = {
  /** Minimal changes, low risk */
  LOW: 'low',
  /** Moderate changes, some risk */
  MEDIUM: 'medium',
  /** Significant changes, notable risk */
  HIGH: 'high',
  /** Major structural changes, high risk */
  CRITICAL: 'critical',
} as const;

export type ImpactLevel = typeof ImpactLevel[keyof typeof ImpactLevel];

// ============================================================================
// Node Modification Types
// ============================================================================

/**
 * Represents a modification to a graph node
 * Captures the before/after state and identifies changed fields
 */
export interface NodeModification {
  /** Original node ID (stable identity across scans) */
  readonly nodeId: string;
  /** Node state in the base scan */
  readonly before: Partial<NodeType>;
  /** Node state in the compare scan */
  readonly after: Partial<NodeType>;
  /** List of field names that changed */
  readonly changedFields: readonly string[];
  /** Detailed changes per field */
  readonly fieldChanges?: readonly FieldChange[];
}

/**
 * Detailed change information for a single field
 */
export interface FieldChange {
  /** Name of the changed field */
  readonly field: string;
  /** Value in the base scan */
  readonly oldValue: unknown;
  /** Value in the compare scan */
  readonly newValue: unknown;
  /** Type of change */
  readonly changeType: 'value_changed' | 'type_changed' | 'added' | 'removed';
}

// ============================================================================
// Edge Modification Types
// ============================================================================

/**
 * Represents a modification to a graph edge
 * Captures the before/after state and identifies changed fields
 */
export interface EdgeModification {
  /** Original edge ID (stable identity across scans) */
  readonly edgeId: string;
  /** Edge state in the base scan */
  readonly before: Partial<GraphEdge>;
  /** Edge state in the compare scan */
  readonly after: Partial<GraphEdge>;
  /** List of field names that changed */
  readonly changedFields: readonly string[];
  /** Detailed changes per field */
  readonly fieldChanges?: readonly FieldChange[];
}

// ============================================================================
// Diff Summary Types
// ============================================================================

/**
 * Summary statistics for a graph diff
 * Provides high-level metrics about the changes
 */
export interface DiffSummary {
  /** Number of nodes added */
  readonly nodesAdded: number;
  /** Number of nodes removed */
  readonly nodesRemoved: number;
  /** Number of nodes modified */
  readonly nodesModified: number;
  /** Number of edges added */
  readonly edgesAdded: number;
  /** Number of edges removed */
  readonly edgesRemoved: number;
  /** Number of edges modified */
  readonly edgesModified: number;
  /** Overall impact assessment */
  readonly impactAssessment: ImpactLevel;
  /** Breakdown by node type */
  readonly nodeChangesByType?: Record<string, TypeChangeSummary>;
  /** Breakdown by edge type */
  readonly edgeChangesByType?: Record<EdgeType, TypeChangeSummary>;
  /** Files affected by changes */
  readonly filesAffected?: readonly string[];
  /** Total change score (0-100) */
  readonly changeScore?: number;
}

/**
 * Change summary for a specific type
 */
export interface TypeChangeSummary {
  readonly added: number;
  readonly removed: number;
  readonly modified: number;
}

// ============================================================================
// Core GraphDiff Interface
// ============================================================================

/**
 * Complete diff result between two graph scans
 * Contains all added, removed, and modified nodes and edges
 */
export interface GraphDiff {
  /** Unique diff identifier */
  readonly id: DiffId;
  /** Base scan ID (the "before" state) */
  readonly baseScanId: ScanId;
  /** Compare scan ID (the "after" state) */
  readonly compareScanId: ScanId;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** Tenant ID for multi-tenancy */
  readonly tenantId: TenantId;

  /** Node changes */
  readonly nodes: {
    /** Nodes present in compare but not in base */
    readonly added: readonly NodeType[];
    /** Nodes present in base but not in compare */
    readonly removed: readonly NodeType[];
    /** Nodes present in both with changes */
    readonly modified: readonly NodeModification[];
  };

  /** Edge changes */
  readonly edges: {
    /** Edges present in compare but not in base */
    readonly added: readonly GraphEdge[];
    /** Edges present in base but not in compare */
    readonly removed: readonly GraphEdge[];
    /** Edges present in both with changes */
    readonly modified: readonly EdgeModification[];
  };

  /** Diff summary statistics */
  readonly summary: DiffSummary;
  /** When the diff was computed */
  readonly computedAt: Date;
  /** Computation time in milliseconds */
  readonly computationTimeMs?: number;
  /** Algorithm version used */
  readonly algorithmVersion?: string;
}

// ============================================================================
// Diff Options and Configuration
// ============================================================================

/**
 * Options for controlling diff computation
 */
export interface DiffOptions {
  /** Include unchanged nodes in result (default: false) */
  readonly includeUnchanged?: boolean;
  /** Fields to ignore when comparing nodes */
  readonly ignoreFields?: readonly string[];
  /** Minimum confidence threshold for edge comparisons */
  readonly minConfidence?: number;
  /** Whether to compute detailed field changes (default: true) */
  readonly computeFieldChanges?: boolean;
  /** Whether to include file-level breakdown (default: true) */
  readonly includeFileBreakdown?: boolean;
  /** Maximum depth for change propagation analysis */
  readonly maxPropagationDepth?: number;
  /** Node types to include (empty = all) */
  readonly nodeTypeFilter?: readonly string[];
  /** Edge types to include (empty = all) */
  readonly edgeTypeFilter?: readonly EdgeType[];
  /** Whether to use cached results if available (default: true) */
  readonly useCache?: boolean;
  /** Force recomputation even if cached (default: false) */
  readonly forceRecompute?: boolean;
  /** Timeout in milliseconds for diff computation */
  readonly timeoutMs?: number;
}

/**
 * Default diff options
 */
export const DEFAULT_DIFF_OPTIONS: Required<DiffOptions> = {
  includeUnchanged: false,
  ignoreFields: ['id', 'createdAt', 'updatedAt'],
  minConfidence: 0,
  computeFieldChanges: true,
  includeFileBreakdown: true,
  maxPropagationDepth: 5,
  nodeTypeFilter: [],
  edgeTypeFilter: [],
  useCache: true,
  forceRecompute: false,
  timeoutMs: 30000, // 30 seconds
};

// ============================================================================
// Cached Diff Result
// ============================================================================

/**
 * Cached diff result with metadata
 * Used for storing computed diffs in the cache layer
 */
export interface CachedDiffResult {
  /** The computed diff data */
  readonly data: GraphDiff;
  /** Cache metadata */
  readonly metadata: DiffCacheMetadata;
}

/**
 * Metadata for cached diff entries
 */
export interface DiffCacheMetadata {
  /** When the diff was cached */
  readonly cachedAt: Date;
  /** When the cache entry expires */
  readonly expiresAt: Date;
  /** TTL in seconds */
  readonly ttlSeconds: number;
  /** Size in bytes (approximate) */
  readonly sizeBytes?: number;
  /** Options used for computation */
  readonly options: DiffOptions;
  /** Cache version for invalidation */
  readonly formatVersion: number;
  /** Hit count for this entry */
  readonly hitCount?: number;
}

/**
 * Create cache metadata for a diff result
 * @param ttlSeconds - Time to live in seconds
 * @param options - Options used for computation
 * @param sizeBytes - Approximate size in bytes
 * @returns Cache metadata
 */
export function createDiffCacheMetadata(
  ttlSeconds: number,
  options: DiffOptions,
  sizeBytes?: number
): DiffCacheMetadata {
  const now = new Date();
  const metadata: DiffCacheMetadata = {
    cachedAt: now,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    ttlSeconds,
    options,
    formatVersion: 1,
    hitCount: 0,
  };

  if (sizeBytes !== undefined) {
    return { ...metadata, sizeBytes };
  }

  return metadata;
}

// ============================================================================
// Node Identity Types
// ============================================================================

/**
 * Stable node identity used for matching nodes across scans
 * Based on type + name + file path for consistent identification
 */
export interface NodeIdentity {
  /** Node type */
  readonly type: string;
  /** Node name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
}

/**
 * Create a stable identity key for a node
 * @param identity - Node identity components
 * @returns Stable identity string
 */
export function createNodeIdentityKey(identity: NodeIdentity): string {
  return `${identity.type}:${identity.name}:${identity.filePath}`;
}

/**
 * Extract identity from a node
 * @param node - The node to extract identity from
 * @returns Node identity
 */
export function extractNodeIdentity(node: NodeType): NodeIdentity {
  return {
    type: node.type,
    name: node.name,
    filePath: node.location.file,
  };
}

/**
 * Stable edge identity used for matching edges across scans
 * Based on source + target + type for consistent identification
 */
export interface EdgeIdentity {
  /** Source node identity key */
  readonly sourceKey: string;
  /** Target node identity key */
  readonly targetKey: string;
  /** Edge type */
  readonly edgeType: EdgeType;
}

/**
 * Create a stable identity key for an edge
 * @param identity - Edge identity components
 * @returns Stable identity string
 */
export function createEdgeIdentityKey(identity: EdgeIdentity): string {
  return `${identity.sourceKey}->${identity.targetKey}:${identity.edgeType}`;
}

// ============================================================================
// Diff Request/Response Types
// ============================================================================

/**
 * Request to compute a diff between two scans
 */
export interface ComputeDiffRequest {
  /** Base scan ID */
  readonly baseScanId: ScanId;
  /** Compare scan ID */
  readonly compareScanId: ScanId;
  /** Repository ID */
  readonly repositoryId: RepositoryId;
  /** Computation options */
  readonly options?: DiffOptions;
}

/**
 * Response from diff computation
 */
export interface ComputeDiffResponse {
  /** Whether computation was successful */
  readonly success: boolean;
  /** The computed diff (if successful) */
  readonly diff?: GraphDiff;
  /** Whether result was from cache */
  readonly fromCache: boolean;
  /** Error message (if failed) */
  readonly error?: string;
  /** Computation time in milliseconds */
  readonly computationTimeMs: number;
}

// ============================================================================
// Diff Statistics and Metrics
// ============================================================================

/**
 * Detailed statistics about diff computation
 */
export interface DiffComputationStats {
  /** Base scan node count */
  readonly baseNodeCount: number;
  /** Compare scan node count */
  readonly compareNodeCount: number;
  /** Base scan edge count */
  readonly baseEdgeCount: number;
  /** Compare scan edge count */
  readonly compareEdgeCount: number;
  /** Number of node comparisons made */
  readonly nodeComparisons: number;
  /** Number of edge comparisons made */
  readonly edgeComparisons: number;
  /** Memory usage in bytes */
  readonly memoryUsedBytes?: number;
  /** Time spent on each phase (ms) */
  readonly phaseTiming: {
    readonly loadBase: number;
    readonly loadCompare: number;
    readonly indexNodes: number;
    readonly compareNodes: number;
    readonly indexEdges: number;
    readonly compareEdges: number;
    readonly summarize: number;
  };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for DiffId
 * @param value - Value to check
 * @returns Whether the value is a valid DiffId format
 */
export function isDiffId(value: unknown): value is DiffId {
  return typeof value === 'string' && value.startsWith('diff_');
}

/**
 * Type guard for DiffCacheKey
 * @param value - Value to check
 * @returns Whether the value is a valid DiffCacheKey format
 */
export function isDiffCacheKey(value: unknown): value is DiffCacheKey {
  return typeof value === 'string' && value.startsWith('diff:');
}

/**
 * Type guard for GraphDiff
 * @param value - Value to check
 * @returns Whether the value is a valid GraphDiff
 */
export function isGraphDiff(value: unknown): value is GraphDiff {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'baseScanId' in value &&
    'compareScanId' in value &&
    'repositoryId' in value &&
    'nodes' in value &&
    'edges' in value &&
    'summary' in value &&
    'computedAt' in value
  );
}

/**
 * Type guard for NodeModification
 * @param value - Value to check
 * @returns Whether the value is a valid NodeModification
 */
export function isNodeModification(value: unknown): value is NodeModification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodeId' in value &&
    'before' in value &&
    'after' in value &&
    'changedFields' in value
  );
}

/**
 * Type guard for EdgeModification
 * @param value - Value to check
 * @returns Whether the value is a valid EdgeModification
 */
export function isEdgeModification(value: unknown): value is EdgeModification {
  return (
    typeof value === 'object' &&
    value !== null &&
    'edgeId' in value &&
    'before' in value &&
    'after' in value &&
    'changedFields' in value
  );
}

/**
 * Type guard for DiffSummary
 * @param value - Value to check
 * @returns Whether the value is a valid DiffSummary
 */
export function isDiffSummary(value: unknown): value is DiffSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodesAdded' in value &&
    'nodesRemoved' in value &&
    'nodesModified' in value &&
    'edgesAdded' in value &&
    'edgesRemoved' in value &&
    'edgesModified' in value &&
    'impactAssessment' in value
  );
}

/**
 * Type guard for CachedDiffResult
 * @param value - Value to check
 * @returns Whether the value is a valid CachedDiffResult
 */
export function isCachedDiffResult(value: unknown): value is CachedDiffResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'metadata' in value &&
    isGraphDiff((value as CachedDiffResult).data)
  );
}

/**
 * Type guard for ChangeType
 * @param value - Value to check
 * @returns Whether the value is a valid ChangeType
 */
export function isChangeType(value: unknown): value is ChangeType {
  return (
    typeof value === 'string' &&
    Object.values(ChangeType).includes(value as ChangeType)
  );
}

/**
 * Type guard for ImpactLevel
 * @param value - Value to check
 * @returns Whether the value is a valid ImpactLevel
 */
export function isImpactLevel(value: unknown): value is ImpactLevel {
  return (
    typeof value === 'string' &&
    Object.values(ImpactLevel).includes(value as ImpactLevel)
  );
}

/**
 * Check if cache entry metadata is valid (not expired)
 * @param metadata - Cache metadata to check
 * @returns Whether the entry is still valid
 */
export function isDiffCacheEntryValid(metadata: DiffCacheMetadata): boolean {
  return new Date() < new Date(metadata.expiresAt);
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty DiffSummary
 * @returns Empty diff summary with zero counts
 */
export function createEmptyDiffSummary(): DiffSummary {
  return {
    nodesAdded: 0,
    nodesRemoved: 0,
    nodesModified: 0,
    edgesAdded: 0,
    edgesRemoved: 0,
    edgesModified: 0,
    impactAssessment: ImpactLevel.LOW,
  };
}

/**
 * Create an empty GraphDiff
 * @param baseScanId - Base scan ID
 * @param compareScanId - Compare scan ID
 * @param repositoryId - Repository ID
 * @param tenantId - Tenant ID
 * @returns Empty graph diff
 */
export function createEmptyGraphDiff(
  baseScanId: ScanId,
  compareScanId: ScanId,
  repositoryId: RepositoryId,
  tenantId: TenantId
): GraphDiff {
  return {
    id: generateDiffId(baseScanId, compareScanId),
    baseScanId,
    compareScanId,
    repositoryId,
    tenantId,
    nodes: {
      added: [],
      removed: [],
      modified: [],
    },
    edges: {
      added: [],
      removed: [],
      modified: [],
    },
    summary: createEmptyDiffSummary(),
    computedAt: new Date(),
  };
}

/**
 * Create a NodeModification from before/after states
 * @param nodeId - Node identifier
 * @param before - Node state before
 * @param after - Node state after
 * @param changedFields - List of changed field names
 * @returns Node modification record
 */
export function createNodeModification(
  nodeId: string,
  before: Partial<NodeType>,
  after: Partial<NodeType>,
  changedFields: readonly string[]
): NodeModification {
  return {
    nodeId,
    before,
    after,
    changedFields,
  };
}

/**
 * Create an EdgeModification from before/after states
 * @param edgeId - Edge identifier
 * @param before - Edge state before
 * @param after - Edge state after
 * @param changedFields - List of changed field names
 * @returns Edge modification record
 */
export function createEdgeModification(
  edgeId: string,
  before: Partial<GraphEdge>,
  after: Partial<GraphEdge>,
  changedFields: readonly string[]
): EdgeModification {
  return {
    edgeId,
    before,
    after,
    changedFields,
  };
}

// ============================================================================
// Impact Assessment Utilities
// ============================================================================

/**
 * Calculate impact level based on diff summary
 * @param summary - Diff summary to assess
 * @param totalNodes - Total nodes in base graph
 * @param totalEdges - Total edges in base graph
 * @returns Calculated impact level
 */
export function calculateImpactLevel(
  summary: Omit<DiffSummary, 'impactAssessment'>,
  totalNodes: number,
  totalEdges: number
): ImpactLevel {
  const totalChanges =
    summary.nodesAdded +
    summary.nodesRemoved +
    summary.nodesModified +
    summary.edgesAdded +
    summary.edgesRemoved +
    summary.edgesModified;

  const totalElements = totalNodes + totalEdges;

  if (totalElements === 0) {
    return ImpactLevel.LOW;
  }

  const changeRatio = totalChanges / totalElements;

  // Removal has higher impact than addition
  const removalWeight =
    (summary.nodesRemoved + summary.edgesRemoved) / Math.max(1, totalChanges);

  // Critical: >50% changes or >30% removals
  if (changeRatio > 0.5 || removalWeight > 0.3) {
    return ImpactLevel.CRITICAL;
  }

  // High: >25% changes or >15% removals
  if (changeRatio > 0.25 || removalWeight > 0.15) {
    return ImpactLevel.HIGH;
  }

  // Medium: >10% changes or >5% removals
  if (changeRatio > 0.1 || removalWeight > 0.05) {
    return ImpactLevel.MEDIUM;
  }

  return ImpactLevel.LOW;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Diff computation error codes
 */
export const DiffErrorCodes = {
  /** Base scan not found */
  BASE_SCAN_NOT_FOUND: 'DIFF_BASE_SCAN_NOT_FOUND',
  /** Compare scan not found */
  COMPARE_SCAN_NOT_FOUND: 'DIFF_COMPARE_SCAN_NOT_FOUND',
  /** Scans are from different repositories */
  REPOSITORY_MISMATCH: 'DIFF_REPOSITORY_MISMATCH',
  /** Computation timeout exceeded */
  TIMEOUT: 'DIFF_TIMEOUT',
  /** Graph too large to diff */
  GRAPH_TOO_LARGE: 'DIFF_GRAPH_TOO_LARGE',
  /** Invalid options provided */
  INVALID_OPTIONS: 'DIFF_INVALID_OPTIONS',
  /** Cache read/write error */
  CACHE_ERROR: 'DIFF_CACHE_ERROR',
  /** Internal computation error */
  COMPUTATION_ERROR: 'DIFF_COMPUTATION_ERROR',
} as const;

export type DiffErrorCode = typeof DiffErrorCodes[keyof typeof DiffErrorCodes];
