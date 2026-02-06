/**
 * Rollup Cache Interfaces
 * @module services/rollup/rollup-cache/interfaces
 *
 * Type definitions and interfaces for the Rollup Cache system.
 * Implements tiered caching (L1 in-memory + L2 Redis) for expensive
 * rollup computations including execution results, merged graphs,
 * and blast radius calculations.
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { TenantId } from '../../../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  RollupExecutionResult,
  MergedNode,
  BlastRadiusResponse,
} from '../../../types/rollup.js';

// ============================================================================
// Cache Key Types
// ============================================================================

/**
 * Branded type for cache keys to ensure type safety
 */
export type CacheKey = string & { readonly __brand: 'CacheKey' };

/**
 * Branded type for cache tags used in tag-based invalidation
 */
export type CacheTag = string & { readonly __brand: 'CacheTag' };

/**
 * Cache version for key namespacing (allows invalidation by version bump)
 */
export type CacheVersion = 'v1' | 'v2';

/**
 * Cache entry types supported by the rollup cache
 */
export type CacheEntryType =
  | 'execution'
  | 'merged_graph'
  | 'blast_radius'
  | 'tag_set';

/**
 * Parsed cache key components
 */
export interface ParsedCacheKey {
  /** Cache key prefix (always 'rollup') */
  readonly prefix: string;
  /** Cache version */
  readonly version: CacheVersion;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Entry type */
  readonly entryType: CacheEntryType;
  /** Entry identifier (varies by type) */
  readonly identifier: string;
  /** Additional parameters (e.g., depth for blast radius) */
  readonly params?: Record<string, string>;
}

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

/**
 * Create a typed CacheKey
 */
export function createCacheKey(key: string): CacheKey {
  return key as CacheKey;
}

/**
 * Create a typed CacheTag
 */
export function createCacheTag(tag: string): CacheTag {
  return tag as CacheTag;
}

// ============================================================================
// Cached Entry Types
// ============================================================================

/**
 * Metadata stored with each cache entry
 */
export interface CacheEntryMetadata {
  /** When the entry was cached */
  readonly cachedAt: Date;
  /** When the entry expires */
  readonly expiresAt: Date;
  /** Time-to-live in seconds */
  readonly ttlSeconds: number;
  /** Source of the cached data (for debugging) */
  readonly source: CacheEntrySource;
  /** Size in bytes (approximate) */
  readonly sizeBytes?: number;
  /** Tags for invalidation */
  readonly tags: readonly CacheTag[];
  /** Version of the cache entry format */
  readonly formatVersion: number;
}

/**
 * Source of cached data
 */
export type CacheEntrySource = 'computation' | 'database' | 'migration';

/**
 * Create cache entry metadata
 */
export function createCacheEntryMetadata(
  ttlSeconds: number,
  source: CacheEntrySource,
  tags: readonly CacheTag[] = [],
  sizeBytes?: number
): CacheEntryMetadata {
  const now = new Date();
  const metadata: CacheEntryMetadata = {
    cachedAt: now,
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
    ttlSeconds,
    source,
    tags,
    formatVersion: 1,
  };

  // Only add sizeBytes if defined
  if (sizeBytes !== undefined) {
    return { ...metadata, sizeBytes };
  }

  return metadata;
}

/**
 * Cached execution result with metadata
 */
export interface CachedExecutionResult {
  /** The execution result data */
  readonly data: RollupExecutionResult;
  /** Rollup ID for reference */
  readonly rollupId: RollupId;
  /** Cache metadata */
  readonly metadata: CacheEntryMetadata;
}

/**
 * Cached merged graph representation
 */
export interface CachedMergedGraph {
  /** Merged nodes from the rollup execution */
  readonly mergedNodes: readonly MergedNode[];
  /** Node count for quick access */
  readonly nodeCount: number;
  /** Edge count for quick access */
  readonly edgeCount: number;
  /** Rollup execution ID that produced this graph */
  readonly executionId: RollupExecutionId;
  /** Cache metadata */
  readonly metadata: CacheEntryMetadata;
}

/**
 * Cached blast radius calculation result
 */
export interface CachedBlastRadius {
  /** The blast radius response data */
  readonly data: BlastRadiusResponse;
  /** Starting node ID */
  readonly nodeId: string;
  /** Traversal depth used */
  readonly depth: number;
  /** Cache metadata */
  readonly metadata: CacheEntryMetadata;
}

// ============================================================================
// Cache Statistics
// ============================================================================

/**
 * Detailed cache statistics
 */
export interface CacheStats {
  /** L1 (in-memory) cache hits */
  readonly l1Hits: number;
  /** L1 cache misses */
  readonly l1Misses: number;
  /** L2 (Redis) cache hits */
  readonly l2Hits: number;
  /** L2 cache misses */
  readonly l2Misses: number;
  /** Total cache hits (L1 + L2) */
  readonly totalHits: number;
  /** Total cache misses */
  readonly totalMisses: number;
  /** Overall hit ratio (0-1) */
  readonly hitRatio: number;
  /** L1 hit ratio */
  readonly l1HitRatio: number;
  /** L2 hit ratio (among L1 misses) */
  readonly l2HitRatio: number;
  /** Current L1 cache size (entries) */
  readonly l1Size: number;
  /** Total entries set */
  readonly setsCount: number;
  /** Total invalidations performed */
  readonly invalidationsCount: number;
  /** Cache errors encountered */
  readonly errorsCount: number;
  /** Average get latency in milliseconds */
  readonly avgGetLatencyMs: number;
  /** Average set latency in milliseconds */
  readonly avgSetLatencyMs: number;
}

/**
 * Create empty cache statistics
 */
export function createEmptyCacheStats(): CacheStats {
  return {
    l1Hits: 0,
    l1Misses: 0,
    l2Hits: 0,
    l2Misses: 0,
    totalHits: 0,
    totalMisses: 0,
    hitRatio: 0,
    l1HitRatio: 0,
    l2HitRatio: 0,
    l1Size: 0,
    setsCount: 0,
    invalidationsCount: 0,
    errorsCount: 0,
    avgGetLatencyMs: 0,
    avgSetLatencyMs: 0,
  };
}

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Rollup cache configuration
 */
export interface IRollupCacheConfig {
  /** L1 (in-memory) cache configuration */
  readonly l1: {
    /** Maximum entries for execution results */
    readonly executionMaxSize: number;
    /** Maximum entries for merged graphs */
    readonly graphMaxSize: number;
    /** Maximum entries for blast radius results */
    readonly blastRadiusMaxSize: number;
    /** TTL in seconds for L1 entries */
    readonly ttlSeconds: number;
    /** Whether L1 cache is enabled */
    readonly enabled: boolean;
  };
  /** L2 (Redis) cache configuration */
  readonly l2: {
    /** TTL in seconds for execution results */
    readonly executionTtlSeconds: number;
    /** TTL in seconds for merged graphs */
    readonly graphTtlSeconds: number;
    /** TTL in seconds for blast radius results */
    readonly blastRadiusTtlSeconds: number;
    /** Key prefix for Redis */
    readonly keyPrefix: string;
    /** Whether L2 cache is enabled */
    readonly enabled: boolean;
  };
  /** Cache version (for key namespacing) */
  readonly version: CacheVersion;
  /** Whether to log cache operations */
  readonly enableLogging: boolean;
  /** Whether to collect detailed metrics */
  readonly enableMetrics: boolean;
}

/**
 * Default rollup cache configuration
 */
export const DEFAULT_ROLLUP_CACHE_CONFIG: IRollupCacheConfig = {
  l1: {
    executionMaxSize: 1000,
    graphMaxSize: 500,
    blastRadiusMaxSize: 2000,
    ttlSeconds: 300, // 5 minutes
    enabled: true,
  },
  l2: {
    executionTtlSeconds: 3600, // 1 hour
    graphTtlSeconds: 1800, // 30 minutes
    blastRadiusTtlSeconds: 900, // 15 minutes
    keyPrefix: 'rollup-cache',
    enabled: true,
  },
  version: 'v1',
  enableLogging: true,
  enableMetrics: true,
};

// ============================================================================
// Cache Key Builder Interface
// ============================================================================

/**
 * Interface for building cache keys
 */
export interface ICacheKeyBuilder {
  /**
   * Build key for execution result
   */
  buildExecutionKey(tenantId: TenantId, executionId: RollupExecutionId): CacheKey;

  /**
   * Build key for merged graph
   */
  buildMergedGraphKey(tenantId: TenantId, rollupId: RollupId): CacheKey;

  /**
   * Build key for blast radius result
   */
  buildBlastRadiusKey(tenantId: TenantId, nodeId: string, depth: number): CacheKey;

  /**
   * Build key for tag set (stores keys associated with a tag)
   */
  buildTagSetKey(tagType: string, tagValue: string): CacheKey;

  /**
   * Create a tenant tag for invalidation
   */
  createTenantTag(tenantId: TenantId): CacheTag;

  /**
   * Create a rollup tag for invalidation
   */
  createRollupTag(tenantId: TenantId, rollupId: RollupId): CacheTag;

  /**
   * Create an execution tag for invalidation
   */
  createExecutionTag(tenantId: TenantId, executionId: RollupExecutionId): CacheTag;

  /**
   * Create a node tag for blast radius invalidation
   */
  createNodeTag(tenantId: TenantId, nodeId: string): CacheTag;

  /**
   * Parse a cache key into its components
   */
  parseKey(key: CacheKey): ParsedCacheKey | null;

  /**
   * Get the current cache version
   */
  getVersion(): CacheVersion;

  /**
   * Build pattern for matching keys (supports wildcards)
   */
  buildPattern(tenantId: TenantId, entryType?: CacheEntryType): string;

  /**
   * Generate cache tags for an execution result
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @param rollupId - Rollup identifier
   * @returns Array of cache tags for the execution
   */
  generateExecutionTags(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    rollupId: RollupId
  ): CacheTag[];

  /**
   * Generate cache tags for a merged graph
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Array of cache tags for the graph
   */
  generateMergedGraphTags(tenantId: TenantId, rollupId: RollupId): CacheTag[];

  /**
   * Generate cache tags for a blast radius result
   * @param tenantId - Tenant identifier
   * @param nodeId - Node identifier
   * @param rollupId - Optional rollup identifier
   * @returns Array of cache tags for the blast radius
   */
  generateBlastRadiusTags(
    tenantId: TenantId,
    nodeId: string,
    rollupId?: RollupId
  ): CacheTag[];
}

// ============================================================================
// Rollup Cache Interface
// ============================================================================

/**
 * Main Rollup Cache interface
 * Provides tiered caching for expensive rollup computations
 */
export interface IRollupCache {
  // =========================================================================
  // Execution Result Cache
  // =========================================================================

  /**
   * Get cached execution result
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @returns Cached result or null if not found
   */
  getExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<CachedExecutionResult | null>;

  /**
   * Cache execution result
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @param rollupId - Rollup identifier
   * @param result - Execution result to cache
   * @param tags - Optional additional tags for invalidation
   */
  setExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    rollupId: RollupId,
    result: RollupExecutionResult,
    tags?: readonly CacheTag[]
  ): Promise<void>;

  /**
   * Invalidate cached execution result
   * @param tenantId - Tenant identifier
   * @param executionId - Execution identifier
   * @returns Number of entries invalidated
   */
  invalidateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number>;

  // =========================================================================
  // Merged Graph Cache
  // =========================================================================

  /**
   * Get cached merged graph
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Cached graph or null if not found
   */
  getMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<CachedMergedGraph | null>;

  /**
   * Cache merged graph
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @param graph - Merged graph to cache
   * @param tags - Optional additional tags for invalidation
   */
  setMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId,
    graph: CachedMergedGraph,
    tags?: readonly CacheTag[]
  ): Promise<void>;

  /**
   * Invalidate cached merged graph
   * @param tenantId - Tenant identifier
   * @param rollupId - Rollup identifier
   * @returns Number of entries invalidated
   */
  invalidateMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<number>;

  // =========================================================================
  // Blast Radius Cache
  // =========================================================================

  /**
   * Get cached blast radius result
   * @param tenantId - Tenant identifier
   * @param nodeId - Starting node identifier
   * @param depth - Traversal depth
   * @returns Cached result or null if not found
   */
  getBlastRadius(
    tenantId: TenantId,
    nodeId: string,
    depth: number
  ): Promise<CachedBlastRadius | null>;

  /**
   * Cache blast radius result
   * @param tenantId - Tenant identifier
   * @param nodeId - Starting node identifier
   * @param depth - Traversal depth
   * @param result - Blast radius result to cache
   * @param tags - Optional additional tags for invalidation
   */
  setBlastRadius(
    tenantId: TenantId,
    nodeId: string,
    depth: number,
    result: CachedBlastRadius,
    tags?: readonly CacheTag[]
  ): Promise<void>;

  /**
   * Invalidate cached blast radius results for a node
   * @param tenantId - Tenant identifier
   * @param nodeId - Node identifier
   * @returns Number of entries invalidated
   */
  invalidateBlastRadius(
    tenantId: TenantId,
    nodeId: string
  ): Promise<number>;

  // =========================================================================
  // Tag-Based Invalidation
  // =========================================================================

  /**
   * Invalidate all cache entries with a specific tag
   * @param tag - Tag to invalidate
   * @returns Number of entries invalidated
   */
  invalidateByTag(tag: CacheTag): Promise<number>;

  /**
   * Invalidate all cache entries with any of the specified tags
   * @param tags - Tags to invalidate
   * @returns Number of entries invalidated
   */
  invalidateByTags(tags: readonly CacheTag[]): Promise<number>;

  /**
   * Invalidate all cache entries for a tenant
   * @param tenantId - Tenant identifier
   * @returns Number of entries invalidated
   */
  invalidateTenant(tenantId: TenantId): Promise<number>;

  // =========================================================================
  // Statistics and Management
  // =========================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats;

  /**
   * Reset cache statistics
   */
  resetStats(): void;

  /**
   * Initialize the cache (connect to Redis, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the cache (close connections, etc.)
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Cache Error Types
// ============================================================================

/**
 * Rollup cache error codes
 */
export const RollupCacheErrorCodes = {
  /** Cache read failed */
  READ_FAILED: 'ROLLUP_CACHE_READ_FAILED',
  /** Cache write failed */
  WRITE_FAILED: 'ROLLUP_CACHE_WRITE_FAILED',
  /** Cache invalidation failed */
  INVALIDATION_FAILED: 'ROLLUP_CACHE_INVALIDATION_FAILED',
  /** Cache serialization failed */
  SERIALIZATION_FAILED: 'ROLLUP_CACHE_SERIALIZATION_FAILED',
  /** Cache deserialization failed */
  DESERIALIZATION_FAILED: 'ROLLUP_CACHE_DESERIALIZATION_FAILED',
  /** L1 cache error */
  L1_ERROR: 'ROLLUP_CACHE_L1_ERROR',
  /** L2 (Redis) cache error */
  L2_ERROR: 'ROLLUP_CACHE_L2_ERROR',
  /** Cache not initialized */
  NOT_INITIALIZED: 'ROLLUP_CACHE_NOT_INITIALIZED',
  /** Cache configuration error */
  CONFIG_ERROR: 'ROLLUP_CACHE_CONFIG_ERROR',
} as const;

export type RollupCacheErrorCode =
  typeof RollupCacheErrorCodes[keyof typeof RollupCacheErrorCodes];

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if value is a CachedExecutionResult
 */
export function isCachedExecutionResult(
  value: unknown
): value is CachedExecutionResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'rollupId' in value &&
    'metadata' in value
  );
}

/**
 * Check if value is a CachedMergedGraph
 */
export function isCachedMergedGraph(
  value: unknown
): value is CachedMergedGraph {
  return (
    typeof value === 'object' &&
    value !== null &&
    'mergedNodes' in value &&
    'nodeCount' in value &&
    'executionId' in value &&
    'metadata' in value
  );
}

/**
 * Check if value is a CachedBlastRadius
 */
export function isCachedBlastRadius(
  value: unknown
): value is CachedBlastRadius {
  return (
    typeof value === 'object' &&
    value !== null &&
    'data' in value &&
    'nodeId' in value &&
    'depth' in value &&
    'metadata' in value
  );
}

/**
 * Check if cache entry metadata is valid (not expired)
 */
export function isCacheEntryValid(metadata: CacheEntryMetadata): boolean {
  return new Date() < new Date(metadata.expiresAt);
}
