/**
 * External Object Index Interfaces
 * @module services/rollup/external-object-index/interfaces
 *
 * Interface definitions for the External Object Index service.
 * Provides reverse lookup support for external references (ARNs, Resource IDs, K8s refs).
 *
 * TASK-ROLLUP-003: External Object Index interfaces
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import { NodeType } from '../../../types/graph.js';

// ============================================================================
// External Object Types
// ============================================================================

/**
 * Types of external references that can be indexed
 */
export type ExternalReferenceType =
  | 'arn'           // AWS ARN references
  | 'resource_id'   // Cloud resource IDs (generic)
  | 'k8s_reference' // Kubernetes resource references
  | 'gcp_resource'  // GCP resource IDs
  | 'azure_resource'; // Azure resource IDs

/**
 * External object entry in the index
 */
export interface ExternalObjectEntry {
  /** Unique identifier for this entry */
  readonly id: string;
  /** The external reference value (e.g., ARN string) */
  readonly externalId: string;
  /** Type of external reference */
  readonly referenceType: ExternalReferenceType;
  /** Normalized form for matching */
  readonly normalizedId: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Repository ID where this reference was found */
  readonly repositoryId: RepositoryId;
  /** Scan ID where this reference was found */
  readonly scanId: ScanId;
  /** Node ID that contains this reference */
  readonly nodeId: string;
  /** Node name for display */
  readonly nodeName: string;
  /** Node type */
  readonly nodeType: string;
  /** File path where reference was found */
  readonly filePath: string;
  /** Extracted components (e.g., ARN parts) */
  readonly components: Record<string, string>;
  /** Additional metadata */
  readonly metadata: Record<string, unknown>;
  /** When this entry was indexed */
  readonly indexedAt: Date;
}

/**
 * Lookup result from the index
 */
export interface ExternalObjectLookupResult {
  /** The external ID that was looked up */
  readonly externalId: string;
  /** Matching entries */
  readonly entries: ExternalObjectEntry[];
  /** Total count (may differ from entries.length if paginated) */
  readonly totalCount: number;
  /** Whether results were from cache */
  readonly fromCache: boolean;
  /** Lookup duration in milliseconds */
  readonly lookupTimeMs: number;
}

/**
 * Reverse lookup result (node -> external references)
 */
export interface ReverseLookupResult {
  /** Node ID that was looked up */
  readonly nodeId: string;
  /** External references from this node */
  readonly references: ExternalObjectEntry[];
  /** Total count */
  readonly totalCount: number;
  /** Whether results were from cache */
  readonly fromCache: boolean;
  /** Lookup duration in milliseconds */
  readonly lookupTimeMs: number;
}

/**
 * Index statistics
 */
export interface ExternalObjectIndexStats {
  /** Total entries in the index */
  readonly totalEntries: number;
  /** Entries by reference type */
  readonly entriesByType: Record<ExternalReferenceType, number>;
  /** Entries by tenant */
  readonly entriesByTenant: Record<string, number>;
  /** Index build duration (last build) */
  readonly lastBuildTimeMs: number;
  /** Last build timestamp */
  readonly lastBuildAt: Date | null;
  /** Cache hit ratio */
  readonly cacheHitRatio: number;
  /** Average lookup time in milliseconds */
  readonly avgLookupTimeMs: number;
}

/**
 * Index build options
 */
export interface IndexBuildOptions {
  /** Force rebuild even if index exists */
  readonly forceRebuild?: boolean;
  /** Specific reference types to index */
  readonly referenceTypes?: ExternalReferenceType[];
  /** Maximum nodes to process (for batching) */
  readonly maxNodes?: number;
  /** Batch size for processing */
  readonly batchSize?: number;
  /** Whether to update existing entries or skip */
  readonly updateExisting?: boolean;
}

/**
 * Index build result
 */
export interface IndexBuildResult {
  /** Number of entries created */
  readonly entriesCreated: number;
  /** Number of entries updated */
  readonly entriesUpdated: number;
  /** Number of entries skipped */
  readonly entriesSkipped: number;
  /** Number of errors encountered */
  readonly errors: number;
  /** Build duration in milliseconds */
  readonly buildTimeMs: number;
  /** Scan IDs that were processed */
  readonly processedScans: ScanId[];
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Main External Object Index Service interface
 */
export interface IExternalObjectIndexService {
  /**
   * Build or update the index from scan data
   * @param tenantId - Tenant ID
   * @param repositoryIds - Repository IDs to index
   * @param options - Build options
   * @returns Build result
   */
  buildIndex(
    tenantId: TenantId,
    repositoryIds: RepositoryId[],
    options?: IndexBuildOptions
  ): Promise<IndexBuildResult>;

  /**
   * Lookup entries by external ID
   * @param tenantId - Tenant ID
   * @param externalId - External ID to lookup
   * @param options - Lookup options
   * @returns Lookup result
   */
  lookupByExternalId(
    tenantId: TenantId,
    externalId: string,
    options?: {
      referenceType?: ExternalReferenceType;
      repositoryIds?: RepositoryId[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ExternalObjectLookupResult>;

  /**
   * Reverse lookup: find external references from a node
   * @param tenantId - Tenant ID
   * @param nodeId - Node ID to lookup
   * @param scanId - Scan ID
   * @returns Reverse lookup result
   */
  reverseLookup(
    tenantId: TenantId,
    nodeId: string,
    scanId: ScanId
  ): Promise<ReverseLookupResult>;

  /**
   * Invalidate index entries
   * @param tenantId - Tenant ID
   * @param options - Invalidation options
   * @returns Number of entries invalidated
   */
  invalidate(
    tenantId: TenantId,
    options: {
      repositoryId?: RepositoryId;
      scanId?: ScanId;
      referenceType?: ExternalReferenceType;
    }
  ): Promise<number>;

  /**
   * Get index statistics
   * @param tenantId - Tenant ID
   * @returns Index statistics
   */
  getStats(tenantId: TenantId): Promise<ExternalObjectIndexStats>;
}

// ============================================================================
// Index Engine Interface
// ============================================================================

/**
 * Index engine for building the inverted index
 */
export interface IIndexEngine {
  /**
   * Process nodes and extract external references
   * @param nodes - Nodes to process
   * @param context - Processing context
   * @returns Extracted entries
   */
  processNodes(
    nodes: NodeType[],
    context: {
      tenantId: TenantId;
      repositoryId: RepositoryId;
      scanId: ScanId;
    }
  ): ExternalObjectEntry[];

  /**
   * Build inverted index from entries
   * @param entries - Entries to index
   * @returns Map of externalId -> entries
   */
  buildInvertedIndex(
    entries: ExternalObjectEntry[]
  ): Map<string, ExternalObjectEntry[]>;

  /**
   * Merge new entries into existing index
   * @param existing - Existing index
   * @param newEntries - New entries to merge
   * @returns Merged index
   */
  mergeIndex(
    existing: Map<string, ExternalObjectEntry[]>,
    newEntries: ExternalObjectEntry[]
  ): Map<string, ExternalObjectEntry[]>;
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Repository for external object index persistence
 */
export interface IExternalObjectRepository {
  /**
   * Save entries to the index
   * @param entries - Entries to save
   * @returns Number of entries saved
   */
  saveEntries(entries: ExternalObjectEntry[]): Promise<number>;

  /**
   * Find entries by external ID
   * @param tenantId - Tenant ID
   * @param externalId - External ID (supports pattern matching)
   * @param options - Query options
   * @returns Matching entries
   */
  findByExternalId(
    tenantId: TenantId,
    externalId: string,
    options?: {
      referenceType?: ExternalReferenceType;
      repositoryIds?: RepositoryId[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ExternalObjectEntry[]>;

  /**
   * Find entries by node ID
   * @param tenantId - Tenant ID
   * @param nodeId - Node ID
   * @param scanId - Scan ID
   * @returns Matching entries
   */
  findByNodeId(
    tenantId: TenantId,
    nodeId: string,
    scanId: ScanId
  ): Promise<ExternalObjectEntry[]>;

  /**
   * Delete entries matching criteria
   * @param tenantId - Tenant ID
   * @param criteria - Deletion criteria
   * @returns Number of entries deleted
   */
  deleteEntries(
    tenantId: TenantId,
    criteria: {
      repositoryId?: RepositoryId;
      scanId?: ScanId;
      referenceType?: ExternalReferenceType;
    }
  ): Promise<number>;

  /**
   * Count entries matching criteria
   * @param tenantId - Tenant ID
   * @param criteria - Count criteria
   * @returns Entry count
   */
  countEntries(
    tenantId: TenantId,
    criteria?: {
      referenceType?: ExternalReferenceType;
      repositoryId?: RepositoryId;
    }
  ): Promise<number>;

  /**
   * Get entry counts by type
   * @param tenantId - Tenant ID
   * @returns Counts by reference type
   */
  countByType(tenantId: TenantId): Promise<Record<ExternalReferenceType, number>>;
}

// ============================================================================
// Cache Interface
// ============================================================================

/**
 * Cache configuration for external object index
 */
export interface ExternalObjectCacheConfig {
  /** L1 (in-memory) cache max size */
  readonly l1MaxSize: number;
  /** L1 cache TTL in seconds */
  readonly l1TtlSeconds: number;
  /** L2 (Redis) cache TTL in seconds */
  readonly l2TtlSeconds: number;
  /** Cache key prefix */
  readonly keyPrefix: string;
  /** Enable L1 cache */
  readonly enableL1: boolean;
  /** Enable L2 cache */
  readonly enableL2: boolean;
}

/**
 * Default cache configuration
 */
export const DEFAULT_EXTERNAL_OBJECT_CACHE_CONFIG: ExternalObjectCacheConfig = {
  l1MaxSize: 10000,
  l1TtlSeconds: 300, // 5 minutes
  l2TtlSeconds: 3600, // 1 hour
  keyPrefix: 'ext-idx',
  enableL1: true,
  enableL2: true,
};

/**
 * 3-tier cache interface for external object lookups
 */
export interface IExternalObjectCache {
  /**
   * Get entries from cache
   * @param key - Cache key
   * @returns Cached entries or null
   */
  get(key: string): Promise<ExternalObjectEntry[] | null>;

  /**
   * Set entries in cache
   * @param key - Cache key
   * @param entries - Entries to cache
   * @param ttlSeconds - Optional TTL override
   */
  set(
    key: string,
    entries: ExternalObjectEntry[],
    ttlSeconds?: number
  ): Promise<void>;

  /**
   * Delete entry from cache
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Delete entries by pattern
   * @param pattern - Key pattern (supports wildcards)
   * @returns Number of entries deleted
   */
  deleteByPattern(pattern: string): Promise<number>;

  /**
   * Invalidate cache for a tenant
   * @param tenantId - Tenant ID
   */
  invalidateTenant(tenantId: TenantId): Promise<void>;

  /**
   * Get cache statistics
   * @returns Cache statistics
   */
  getStats(): {
    l1Hits: number;
    l1Misses: number;
    l2Hits: number;
    l2Misses: number;
    hitRatio: number;
  };
}

// ============================================================================
// Extractor Interface
// ============================================================================

/**
 * Interface for external reference extractors
 */
export interface IExternalReferenceExtractor {
  /** Reference type this extractor handles */
  readonly referenceType: ExternalReferenceType;

  /**
   * Check if this extractor can handle the node
   * @param node - Node to check
   * @returns True if extractor can handle this node
   */
  canHandle(node: NodeType): boolean;

  /**
   * Extract external references from a node
   * @param node - Node to extract from
   * @returns Extracted references
   */
  extract(node: NodeType): ExtractedReference[];

  /**
   * Normalize an external ID for matching
   * @param externalId - External ID to normalize
   * @returns Normalized ID
   */
  normalize(externalId: string): string;

  /**
   * Parse external ID into components
   * @param externalId - External ID to parse
   * @returns Parsed components
   */
  parseComponents(externalId: string): Record<string, string> | null;
}

/**
 * Extracted reference from a node
 */
export interface ExtractedReference {
  /** The external ID value */
  readonly externalId: string;
  /** Reference type */
  readonly referenceType: ExternalReferenceType;
  /** Normalized form */
  readonly normalizedId: string;
  /** Parsed components */
  readonly components: Record<string, string>;
  /** Source attribute in the node */
  readonly sourceAttribute: string;
  /** Additional metadata */
  readonly metadata: Record<string, unknown>;
}

// ============================================================================
// Extractor Factory Interface
// ============================================================================

/**
 * Factory for creating external reference extractors
 */
export interface IExtractorFactory {
  /**
   * Get extractor for a reference type
   * @param type - Reference type
   * @returns Extractor or null if not found
   */
  getExtractor(type: ExternalReferenceType): IExternalReferenceExtractor | null;

  /**
   * Get all available extractors
   * @returns Array of extractors
   */
  getAllExtractors(): IExternalReferenceExtractor[];

  /**
   * Get extractors that can handle a node
   * @param node - Node to check
   * @returns Matching extractors
   */
  getExtractorsForNode(node: NodeType): IExternalReferenceExtractor[];

  /**
   * Register a custom extractor
   * @param extractor - Extractor to register
   */
  registerExtractor(extractor: IExternalReferenceExtractor): void;
}

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * External object index service configuration
 */
export interface ExternalObjectIndexServiceConfig {
  /** Cache configuration */
  readonly cache: ExternalObjectCacheConfig;
  /** Default batch size for indexing */
  readonly defaultBatchSize: number;
  /** Maximum entries to return in a single lookup */
  readonly maxLookupResults: number;
  /** Enable parallel processing */
  readonly enableParallelProcessing: boolean;
  /** Number of parallel workers */
  readonly parallelWorkers: number;
  /** Reference types to index by default */
  readonly defaultReferenceTypes: ExternalReferenceType[];
}

/**
 * Default service configuration
 */
export const DEFAULT_EXTERNAL_OBJECT_INDEX_CONFIG: ExternalObjectIndexServiceConfig = {
  cache: DEFAULT_EXTERNAL_OBJECT_CACHE_CONFIG,
  defaultBatchSize: 1000,
  maxLookupResults: 1000,
  enableParallelProcessing: true,
  parallelWorkers: 4,
  defaultReferenceTypes: ['arn', 'resource_id', 'k8s_reference'],
};
