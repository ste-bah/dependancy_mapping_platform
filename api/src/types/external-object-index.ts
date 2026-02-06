/**
 * External Object Index Type Definitions
 * @module types/external-object-index
 *
 * TypeBox schemas and type definitions for the External Object Index system.
 * Provides types for indexing external references across scans with reverse lookup support.
 *
 * TASK-ROLLUP-003: Build external object index from all scans with reverse lookup support.
 */

import { Type, Static, TSchema } from '@sinclair/typebox';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded type for External Object IDs
 * @example
 * const externalObjectId = 'extobj_01HXYZ...' as ExternalObjectId;
 */
export type ExternalObjectId = string & { readonly __brand: 'ExternalObjectId' };

/**
 * Branded type for Index Build IDs
 * @example
 * const buildId = 'build_01HXYZ...' as IndexBuildId;
 */
export type IndexBuildId = string & { readonly __brand: 'IndexBuildId' };

/**
 * Branded type for Reference Hash
 * Represents a unique hash of an external reference for inverted index lookup
 */
export type ReferenceHash = string & { readonly __brand: 'ReferenceHash' };

// ============================================================================
// External Reference Type Enums
// ============================================================================

/**
 * Available external reference types (10 types)
 * Each type represents a different category of external resource reference
 */
export const ExternalRefType = {
  /** AWS Resource Name (ARN) format */
  ARN: 'arn',
  /** Container/Docker image reference (e.g., registry/image:tag) */
  CONTAINER_IMAGE: 'container_image',
  /** Terraform Registry module reference */
  TF_REGISTRY_MODULE: 'tf_registry_module',
  /** Git repository URL */
  GIT_URL: 'git_url',
  /** Helm chart reference (repository/chart:version) */
  HELM_CHART: 'helm_chart',
  /** Generic URL reference */
  URL: 'url',
  /** Cloud provider resource ID (non-ARN format) */
  CLOUD_RESOURCE_ID: 'cloud_resource_id',
  /** Secret manager reference (vault, AWS Secrets Manager, etc.) */
  SECRET_REF: 'secret_ref',
  /** DNS hostname or FQDN */
  DNS_NAME: 'dns_name',
  /** S3 or cloud storage path (s3://bucket/key) */
  S3_PATH: 's3_path',
} as const;

export type ExternalRefType = typeof ExternalRefType[keyof typeof ExternalRefType];

/**
 * TypeBox schema for external reference type
 */
export const ExternalRefTypeSchema = Type.Union([
  Type.Literal('arn'),
  Type.Literal('container_image'),
  Type.Literal('tf_registry_module'),
  Type.Literal('git_url'),
  Type.Literal('helm_chart'),
  Type.Literal('url'),
  Type.Literal('cloud_resource_id'),
  Type.Literal('secret_ref'),
  Type.Literal('dns_name'),
  Type.Literal('s3_path'),
], {
  description: 'Type of external reference',
  examples: ['arn', 'container_image', 'git_url'],
});

// ============================================================================
// Cloud Provider Types
// ============================================================================

/**
 * Supported cloud providers
 */
export const CloudProvider = {
  AWS: 'aws',
  AZURE: 'azure',
  GCP: 'gcp',
  OTHER: 'other',
} as const;

export type CloudProvider = typeof CloudProvider[keyof typeof CloudProvider];

/**
 * TypeBox schema for cloud provider
 */
export const CloudProviderSchema = Type.Union([
  Type.Literal('aws'),
  Type.Literal('azure'),
  Type.Literal('gcp'),
  Type.Literal('other'),
], { description: 'Cloud provider for the external reference' });

// ============================================================================
// External Reference Schemas
// ============================================================================

/**
 * External reference extracted from a node
 * Represents a single external resource reference found during scanning
 */
export const ExternalReferenceSchema = Type.Object({
  /** Unique identifier for this reference */
  id: Type.String({
    format: 'uuid',
    description: 'Unique identifier for the external reference',
  }),
  /** Type of external reference */
  refType: ExternalRefTypeSchema,
  /** The actual identifier/value of the reference */
  identifier: Type.String({
    minLength: 1,
    maxLength: 2048,
    description: 'The external reference identifier (ARN, URL, image name, etc.)',
  }),
  /** Cloud provider if applicable */
  provider: Type.Optional(CloudProviderSchema),
  /** Additional attributes extracted from the reference */
  attributes: Type.Record(Type.String(), Type.String(), {
    description: 'Key-value pairs of extracted attributes',
    examples: [{ region: 'us-east-1', service: 's3', account: '123456789012' }],
  }),
  /** Confidence score for the extraction (0-1) */
  confidence: Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'Confidence score for the reference extraction (0.0-1.0)',
    examples: [0.95, 0.8],
  }),
}, {
  description: 'An external resource reference extracted from infrastructure code',
});

export type ExternalReference = Static<typeof ExternalReferenceSchema>;

/**
 * Schema for creating a new external reference (without generated fields)
 */
export const CreateExternalReferenceSchema = Type.Omit(ExternalReferenceSchema, ['id']);
export type CreateExternalReference = Static<typeof CreateExternalReferenceSchema>;

// ============================================================================
// Index Entry Schemas
// ============================================================================

/**
 * An entry in the external object index
 * Links a node to its external references
 */
export const IndexEntrySchema = Type.Object({
  /** Node ID in the graph */
  nodeId: Type.String({
    description: 'The graph node ID that contains external references',
    minLength: 1,
  }),
  /** Scan ID where the node was found */
  scanId: Type.String({
    format: 'uuid',
    description: 'The scan ID where this node was analyzed',
  }),
  /** Repository ID */
  repositoryId: Type.String({
    format: 'uuid',
    description: 'The repository ID containing the node',
  }),
  /** External references found in this node */
  references: Type.Array(ExternalReferenceSchema, {
    description: 'List of external references found in the node',
  }),
}, {
  description: 'Index entry linking a node to its external references',
});

export type IndexEntry = Static<typeof IndexEntrySchema>;

/**
 * Schema for batch index entries
 */
export const BatchIndexEntriesSchema = Type.Object({
  entries: Type.Array(IndexEntrySchema, {
    minItems: 1,
    maxItems: 1000,
    description: 'Batch of index entries to process',
  }),
});

export type BatchIndexEntries = Static<typeof BatchIndexEntriesSchema>;

// ============================================================================
// Inverted Index Schemas
// ============================================================================

/**
 * Inverted index entry for reverse lookups
 * Maps an external object to all nodes that reference it
 */
export const InvertedIndexEntrySchema = Type.Object({
  /** Hash of the external reference for fast lookup */
  referenceHash: Type.String({
    description: 'Hash of the external reference identifier and type',
    minLength: 32,
    maxLength: 128,
  }),
  /** External object ID */
  externalObjectId: Type.String({
    format: 'uuid',
    description: 'Unique identifier for the external object',
  }),
  /** Type of external reference */
  externalType: ExternalRefTypeSchema,
  /** The original external identifier */
  externalId: Type.String({
    description: 'The original external reference identifier',
  }),
  /** Node IDs that reference this external object */
  nodeIds: Type.Array(Type.String(), {
    description: 'List of node IDs that reference this external object',
  }),
  /** Scan IDs where references were found */
  scanIds: Type.Array(Type.String({ format: 'uuid' }), {
    description: 'List of scan IDs containing references to this object',
  }),
  /** Repository IDs where references were found */
  repositoryIds: Type.Array(Type.String({ format: 'uuid' }), {
    description: 'List of repository IDs containing references to this object',
  }),
  /** Reference count for quick statistics */
  referenceCount: Type.Number({
    minimum: 0,
    description: 'Total number of references to this external object',
  }),
  /** Last time this entry was updated */
  lastUpdated: Type.String({
    format: 'date-time',
    description: 'Timestamp of the last update to this index entry',
  }),
  /** First time this reference was discovered */
  firstSeen: Type.String({
    format: 'date-time',
    description: 'Timestamp when this external object was first indexed',
  }),
}, {
  description: 'Inverted index entry for reverse lookups',
});

export type InvertedIndexEntry = Static<typeof InvertedIndexEntrySchema>;

// ============================================================================
// Index Build Status Schemas
// ============================================================================

/**
 * Index build status values
 */
export const IndexBuildStatus = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export type IndexBuildStatus = typeof IndexBuildStatus[keyof typeof IndexBuildStatus];

/**
 * TypeBox schema for index build status
 */
export const IndexBuildStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('running'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
], { description: 'Current status of the index build operation' });

/**
 * Index build result
 * Contains details about an index build operation
 */
export const IndexBuildResultSchema = Type.Object({
  /** Build operation ID */
  buildId: Type.String({
    format: 'uuid',
    description: 'Unique identifier for the build operation',
  }),
  /** Tenant ID */
  tenantId: Type.String({
    format: 'uuid',
    description: 'Tenant ID for multi-tenancy support',
  }),
  /** Current build status */
  status: IndexBuildStatusSchema,
  /** Number of nodes processed */
  nodesProcessed: Type.Number({
    minimum: 0,
    description: 'Total number of nodes analyzed',
  }),
  /** Number of external references extracted */
  referencesExtracted: Type.Number({
    minimum: 0,
    description: 'Total number of external references found',
  }),
  /** Number of unique external objects indexed */
  uniqueObjectsIndexed: Type.Number({
    minimum: 0,
    description: 'Number of unique external objects added to index',
  }),
  /** Number of scans processed */
  scansProcessed: Type.Number({
    minimum: 0,
    description: 'Number of scans included in this build',
  }),
  /** Build duration in milliseconds */
  duration: Type.Number({
    minimum: 0,
    description: 'Build duration in milliseconds',
  }),
  /** Progress percentage (0-100) */
  progress: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Build progress percentage',
  })),
  /** Current phase of the build */
  currentPhase: Type.Optional(Type.Union([
    Type.Literal('scanning'),
    Type.Literal('extracting'),
    Type.Literal('indexing'),
    Type.Literal('optimizing'),
    Type.Literal('validating'),
  ], { description: 'Current phase of the build operation' })),
  /** Error messages if build failed */
  errors: Type.Array(Type.String(), {
    description: 'Error messages encountered during build',
  }),
  /** Warning messages */
  warnings: Type.Array(Type.String(), {
    description: 'Warning messages from the build process',
  }),
  /** Build started timestamp */
  startedAt: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When the build started',
  })),
  /** Build completed timestamp */
  completedAt: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When the build completed',
  })),
  /** Created timestamp */
  createdAt: Type.String({
    format: 'date-time',
    description: 'When the build was created',
  }),
}, {
  description: 'Result of an index build operation',
});

export type IndexBuildResult = Static<typeof IndexBuildResultSchema>;

// ============================================================================
// Lookup Result Schemas
// ============================================================================

/**
 * Result of looking up an external object by its identifier
 */
export const ExternalObjectLookupResultSchema = Type.Object({
  /** Whether the external object was found */
  found: Type.Boolean({
    description: 'Whether the external object was found in the index',
  }),
  /** External object ID (if found) */
  externalObjectId: Type.Optional(Type.String({
    format: 'uuid',
    description: 'Unique identifier for the external object',
  })),
  /** The queried external identifier */
  externalId: Type.String({
    description: 'The external reference identifier that was looked up',
  }),
  /** Type of external reference */
  externalType: ExternalRefTypeSchema,
  /** Node IDs that reference this external object */
  nodeIds: Type.Array(Type.String(), {
    description: 'List of node IDs that reference this external object',
  }),
  /** Scan IDs where references were found */
  scanIds: Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Scan IDs containing references to this object',
  }),
  /** Repository IDs where references were found */
  repositoryIds: Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Repository IDs containing references to this object',
  }),
  /** Total reference count */
  referenceCount: Type.Number({
    minimum: 0,
    description: 'Total number of references to this external object',
  }),
  /** Additional metadata about the external object */
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown(), {
    description: 'Additional metadata about the external object',
  })),
  /** First seen timestamp */
  firstSeen: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When this external object was first indexed',
  })),
  /** Last updated timestamp */
  lastUpdated: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When this index entry was last updated',
  })),
}, {
  description: 'Result of an external object lookup operation',
});

export type ExternalObjectLookupResult = Static<typeof ExternalObjectLookupResultSchema>;

/**
 * External object summary for reverse lookup results
 */
export const ExternalObjectSummarySchema = Type.Object({
  /** External object ID */
  externalObjectId: Type.String({
    format: 'uuid',
    description: 'Unique identifier for the external object',
  }),
  /** The external identifier */
  externalId: Type.String({
    description: 'The external reference identifier',
  }),
  /** Type of external reference */
  externalType: ExternalRefTypeSchema,
  /** Confidence score of the extraction */
  confidence: Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'Confidence score for the reference',
  }),
  /** Cloud provider if applicable */
  provider: Type.Optional(CloudProviderSchema),
  /** Extracted attributes */
  attributes: Type.Optional(Type.Record(Type.String(), Type.String())),
}, {
  description: 'Summary of an external object for listing',
});

export type ExternalObjectSummary = Static<typeof ExternalObjectSummarySchema>;

/**
 * Result of a reverse lookup (node -> external objects)
 */
export const ReverseLookupResultSchema = Type.Object({
  /** The node ID that was looked up */
  nodeId: Type.String({
    description: 'The node ID that was looked up',
  }),
  /** Scan ID of the node */
  scanId: Type.String({
    format: 'uuid',
    description: 'The scan ID containing the node',
  }),
  /** Repository ID of the node */
  repositoryId: Type.String({
    format: 'uuid',
    description: 'The repository ID containing the node',
  }),
  /** External objects referenced by this node */
  externalObjects: Type.Array(ExternalObjectSummarySchema, {
    description: 'External objects referenced by this node',
  }),
  /** Total count of external objects */
  totalCount: Type.Number({
    minimum: 0,
    description: 'Total number of external objects referenced',
  }),
  /** Breakdown by external reference type */
  countByType: Type.Record(Type.String(), Type.Number(), {
    description: 'Count of references by external type',
  }),
}, {
  description: 'Result of a reverse lookup for a node',
});

export type ReverseLookupResult = Static<typeof ReverseLookupResultSchema>;

/**
 * Batch reverse lookup result
 */
export const BatchReverseLookupResultSchema = Type.Object({
  /** Results for each node */
  results: Type.Array(ReverseLookupResultSchema),
  /** Total nodes queried */
  totalNodesQueried: Type.Number(),
  /** Nodes with external references */
  nodesWithReferences: Type.Number(),
  /** Processing time in milliseconds */
  processingTimeMs: Type.Number(),
}, {
  description: 'Result of a batch reverse lookup operation',
});

export type BatchReverseLookupResult = Static<typeof BatchReverseLookupResultSchema>;

// ============================================================================
// Index Statistics Schemas
// ============================================================================

/**
 * External object index statistics
 */
export const IndexStatsSchema = Type.Object({
  /** Total number of unique external objects in the index */
  totalExternalObjects: Type.Number({
    minimum: 0,
    description: 'Total unique external objects indexed',
  }),
  /** Total number of indexed nodes */
  totalIndexedNodes: Type.Number({
    minimum: 0,
    description: 'Total nodes that have external references',
  }),
  /** Total number of reference links */
  totalReferences: Type.Number({
    minimum: 0,
    description: 'Total node-to-external-object reference links',
  }),
  /** Index size in bytes */
  indexSizeBytes: Type.Number({
    minimum: 0,
    description: 'Total size of the index in bytes',
  }),
  /** Last build timestamp */
  lastBuildAt: Type.Union([
    Type.String({ format: 'date-time' }),
    Type.Null(),
  ], {
    description: 'Timestamp of the last successful index build',
  }),
  /** Number of scans indexed */
  scansIndexed: Type.Number({
    minimum: 0,
    description: 'Number of scans included in the index',
  }),
  /** Breakdown by external reference type */
  externalTypes: Type.Record(Type.String(), Type.Number(), {
    description: 'Count of external objects by type',
    examples: [{ arn: 150, container_image: 45, git_url: 30 }],
  }),
  /** Breakdown by cloud provider */
  byProvider: Type.Record(Type.String(), Type.Number(), {
    description: 'Count of external objects by cloud provider',
    examples: [{ aws: 120, azure: 50, gcp: 30 }],
  }),
  /** Average references per node */
  avgReferencesPerNode: Type.Number({
    minimum: 0,
    description: 'Average number of external references per indexed node',
  }),
  /** Index health status */
  healthStatus: Type.Union([
    Type.Literal('healthy'),
    Type.Literal('degraded'),
    Type.Literal('stale'),
    Type.Literal('rebuilding'),
  ], {
    description: 'Health status of the index',
  }),
  /** Last health check timestamp */
  lastHealthCheck: Type.Optional(Type.String({
    format: 'date-time',
    description: 'Timestamp of the last health check',
  })),
}, {
  description: 'Statistics about the external object index',
});

export type IndexStats = Static<typeof IndexStatsSchema>;

// ============================================================================
// Cache Statistics Schemas
// ============================================================================

/**
 * Cache statistics for the external object index
 */
export const CacheStatsSchema = Type.Object({
  /** L1 (in-memory) cache hits */
  l1Hits: Type.Number({
    minimum: 0,
    description: 'Number of L1 cache hits',
  }),
  /** L1 cache misses */
  l1Misses: Type.Number({
    minimum: 0,
    description: 'Number of L1 cache misses',
  }),
  /** L1 cache size in entries */
  l1Size: Type.Number({
    minimum: 0,
    description: 'Current number of entries in L1 cache',
  }),
  /** L1 cache max size */
  l1MaxSize: Type.Number({
    minimum: 0,
    description: 'Maximum capacity of L1 cache',
  }),
  /** L2 (Redis/distributed) cache hits */
  l2Hits: Type.Number({
    minimum: 0,
    description: 'Number of L2 cache hits',
  }),
  /** L2 cache misses */
  l2Misses: Type.Number({
    minimum: 0,
    description: 'Number of L2 cache misses',
  }),
  /** Overall hit rate (0-1) */
  hitRate: Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'Overall cache hit rate (0.0-1.0)',
  }),
  /** L1 hit rate */
  l1HitRate: Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'L1 cache hit rate',
  }),
  /** L2 hit rate */
  l2HitRate: Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'L2 cache hit rate',
  }),
  /** Average lookup latency in ms */
  avgLookupLatencyMs: Type.Number({
    minimum: 0,
    description: 'Average lookup latency in milliseconds',
  }),
  /** Cache memory usage in bytes */
  memorySizeBytes: Type.Number({
    minimum: 0,
    description: 'Total cache memory usage in bytes',
  }),
  /** Last cache clear timestamp */
  lastClearedAt: Type.Optional(Type.String({
    format: 'date-time',
    description: 'When the cache was last cleared',
  })),
  /** Eviction count */
  evictionCount: Type.Number({
    minimum: 0,
    description: 'Number of entries evicted from cache',
  }),
}, {
  description: 'Cache statistics for the external object index',
});

export type CacheStats = Static<typeof CacheStatsSchema>;

// ============================================================================
// Combined Statistics Schema
// ============================================================================

/**
 * Complete statistics including index and cache stats
 */
export const ExternalIndexFullStatsSchema = Type.Object({
  /** Index statistics */
  index: IndexStatsSchema,
  /** Cache statistics */
  cache: CacheStatsSchema,
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Statistics generated at */
  generatedAt: Type.String({ format: 'date-time' }),
}, {
  description: 'Complete external object index statistics',
});

export type ExternalIndexFullStats = Static<typeof ExternalIndexFullStatsSchema>;

// ============================================================================
// Query and Filter Schemas
// ============================================================================

/**
 * Filter options for external object queries
 */
export const ExternalObjectFilterSchema = Type.Object({
  /** Filter by external reference types */
  types: Type.Optional(Type.Array(ExternalRefTypeSchema, {
    description: 'Filter by external reference types',
  })),
  /** Filter by cloud providers */
  providers: Type.Optional(Type.Array(CloudProviderSchema, {
    description: 'Filter by cloud providers',
  })),
  /** Filter by repository IDs */
  repositoryIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Filter by repository IDs',
  })),
  /** Filter by scan IDs */
  scanIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }), {
    description: 'Filter by scan IDs',
  })),
  /** Search in identifier (partial match) */
  identifierPattern: Type.Optional(Type.String({
    minLength: 1,
    maxLength: 500,
    description: 'Pattern to match against external identifiers',
  })),
  /** Minimum confidence score */
  minConfidence: Type.Optional(Type.Number({
    minimum: 0,
    maximum: 1,
    description: 'Minimum confidence score filter',
  })),
  /** Only objects with multiple references */
  multipleReferencesOnly: Type.Optional(Type.Boolean({
    description: 'Only return objects referenced by multiple nodes',
  })),
  /** Filter by attribute key-value */
  attributes: Type.Optional(Type.Record(Type.String(), Type.String(), {
    description: 'Filter by attribute key-value pairs',
  })),
}, {
  description: 'Filter options for external object queries',
});

export type ExternalObjectFilter = Static<typeof ExternalObjectFilterSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ExternalObjectId
 */
export function isExternalObjectId(value: unknown): value is ExternalObjectId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for IndexBuildId
 */
export function isIndexBuildId(value: unknown): value is IndexBuildId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for ReferenceHash
 */
export function isReferenceHash(value: unknown): value is ReferenceHash {
  return typeof value === 'string' && value.length >= 32;
}

/**
 * Type guard for ExternalRefType
 */
export function isExternalRefType(value: unknown): value is ExternalRefType {
  return (
    value === 'arn' ||
    value === 'container_image' ||
    value === 'tf_registry_module' ||
    value === 'git_url' ||
    value === 'helm_chart' ||
    value === 'url' ||
    value === 'cloud_resource_id' ||
    value === 'secret_ref' ||
    value === 'dns_name' ||
    value === 's3_path'
  );
}

/**
 * Type guard for CloudProvider
 */
export function isCloudProvider(value: unknown): value is CloudProvider {
  return (
    value === 'aws' ||
    value === 'azure' ||
    value === 'gcp' ||
    value === 'other'
  );
}

/**
 * Type guard for IndexBuildStatus
 */
export function isIndexBuildStatus(value: unknown): value is IndexBuildStatus {
  return (
    value === 'pending' ||
    value === 'running' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'cancelled'
  );
}

/**
 * Type guard for ExternalReference
 */
export function isExternalReference(value: unknown): value is ExternalReference {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'refType' in value &&
    'identifier' in value &&
    'confidence' in value &&
    isExternalRefType((value as Record<string, unknown>).refType)
  );
}

/**
 * Type guard for IndexEntry
 */
export function isIndexEntry(value: unknown): value is IndexEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodeId' in value &&
    'scanId' in value &&
    'repositoryId' in value &&
    'references' in value &&
    Array.isArray((value as Record<string, unknown>).references)
  );
}

/**
 * Type guard for ExternalObjectLookupResult
 */
export function isExternalObjectLookupResult(value: unknown): value is ExternalObjectLookupResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'found' in value &&
    'externalId' in value &&
    'externalType' in value &&
    'nodeIds' in value
  );
}

/**
 * Type guard for ReverseLookupResult
 */
export function isReverseLookupResult(value: unknown): value is ReverseLookupResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'nodeId' in value &&
    'externalObjects' in value &&
    'totalCount' in value
  );
}

/**
 * Type guard for IndexBuildResult
 */
export function isIndexBuildResult(value: unknown): value is IndexBuildResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'buildId' in value &&
    'status' in value &&
    isIndexBuildStatus((value as Record<string, unknown>).status)
  );
}

/**
 * Type guard for IndexStats
 */
export function isIndexStats(value: unknown): value is IndexStats {
  return (
    typeof value === 'object' &&
    value !== null &&
    'totalExternalObjects' in value &&
    'totalIndexedNodes' in value &&
    'indexSizeBytes' in value
  );
}

/**
 * Type guard for CacheStats
 */
export function isCacheStats(value: unknown): value is CacheStats {
  return (
    typeof value === 'object' &&
    value !== null &&
    'l1Hits' in value &&
    'l1Misses' in value &&
    'l2Hits' in value &&
    'l2Misses' in value &&
    'hitRate' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an ExternalObjectId
 */
export function createExternalObjectId(id: string): ExternalObjectId {
  return id as ExternalObjectId;
}

/**
 * Create an IndexBuildId
 */
export function createIndexBuildId(id: string): IndexBuildId {
  return id as IndexBuildId;
}

/**
 * Create a ReferenceHash
 */
export function createReferenceHash(hash: string): ReferenceHash {
  return hash as ReferenceHash;
}

/**
 * Create default index stats
 */
export function createEmptyIndexStats(): IndexStats {
  return {
    totalExternalObjects: 0,
    totalIndexedNodes: 0,
    totalReferences: 0,
    indexSizeBytes: 0,
    lastBuildAt: null,
    scansIndexed: 0,
    externalTypes: {},
    byProvider: {},
    avgReferencesPerNode: 0,
    healthStatus: 'healthy',
  };
}

/**
 * Create default cache stats
 */
export function createEmptyCacheStats(): CacheStats {
  return {
    l1Hits: 0,
    l1Misses: 0,
    l1Size: 0,
    l1MaxSize: 10000,
    l2Hits: 0,
    l2Misses: 0,
    hitRate: 0,
    l1HitRate: 0,
    l2HitRate: 0,
    avgLookupLatencyMs: 0,
    memorySizeBytes: 0,
    evictionCount: 0,
  };
}

/**
 * Create an empty lookup result for not found case
 */
export function createNotFoundLookupResult(
  externalId: string,
  externalType: ExternalRefType
): ExternalObjectLookupResult {
  return {
    found: false,
    externalId,
    externalType,
    nodeIds: [],
    scanIds: [],
    repositoryIds: [],
    referenceCount: 0,
  };
}

/**
 * Create an empty reverse lookup result
 */
export function createEmptyReverseLookupResult(
  nodeId: string,
  scanId: string,
  repositoryId: string
): ReverseLookupResult {
  return {
    nodeId,
    scanId,
    repositoryId,
    externalObjects: [],
    totalCount: 0,
    countByType: {},
  };
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * External object index specific error codes
 */
export const ExternalIndexErrorCodes = {
  // Lookup errors
  EXTERNAL_OBJECT_NOT_FOUND: 'EXTERNAL_INDEX_OBJECT_NOT_FOUND',
  NODE_NOT_FOUND: 'EXTERNAL_INDEX_NODE_NOT_FOUND',
  INVALID_REFERENCE_TYPE: 'EXTERNAL_INDEX_INVALID_REFERENCE_TYPE',
  INVALID_IDENTIFIER: 'EXTERNAL_INDEX_INVALID_IDENTIFIER',

  // Build errors
  BUILD_ALREADY_RUNNING: 'EXTERNAL_INDEX_BUILD_ALREADY_RUNNING',
  BUILD_FAILED: 'EXTERNAL_INDEX_BUILD_FAILED',
  BUILD_TIMEOUT: 'EXTERNAL_INDEX_BUILD_TIMEOUT',
  BUILD_NOT_FOUND: 'EXTERNAL_INDEX_BUILD_NOT_FOUND',
  BUILD_CANCELLED: 'EXTERNAL_INDEX_BUILD_CANCELLED',

  // Index errors
  INDEX_CORRUPTED: 'EXTERNAL_INDEX_CORRUPTED',
  INDEX_STALE: 'EXTERNAL_INDEX_STALE',
  INDEX_LOCKED: 'EXTERNAL_INDEX_LOCKED',

  // Cache errors
  CACHE_UNAVAILABLE: 'EXTERNAL_INDEX_CACHE_UNAVAILABLE',
  CACHE_FULL: 'EXTERNAL_INDEX_CACHE_FULL',

  // Resource errors
  SCAN_NOT_FOUND: 'EXTERNAL_INDEX_SCAN_NOT_FOUND',
  REPOSITORY_NOT_FOUND: 'EXTERNAL_INDEX_REPOSITORY_NOT_FOUND',

  // Limit errors
  QUERY_TOO_BROAD: 'EXTERNAL_INDEX_QUERY_TOO_BROAD',
  BATCH_SIZE_EXCEEDED: 'EXTERNAL_INDEX_BATCH_SIZE_EXCEEDED',
  RATE_LIMITED: 'EXTERNAL_INDEX_RATE_LIMITED',
} as const;

export type ExternalIndexErrorCode = typeof ExternalIndexErrorCodes[keyof typeof ExternalIndexErrorCodes];

// ============================================================================
// Constants
// ============================================================================

/**
 * Default values and limits
 */
export const ExternalIndexDefaults = {
  /** Default page size for queries */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum page size */
  MAX_PAGE_SIZE: 100,
  /** Maximum batch size for bulk operations */
  MAX_BATCH_SIZE: 1000,
  /** Default L1 cache size */
  DEFAULT_L1_CACHE_SIZE: 10000,
  /** Default L2 cache TTL in seconds */
  DEFAULT_L2_CACHE_TTL: 3600,
  /** Minimum confidence threshold for extraction */
  MIN_CONFIDENCE_THRESHOLD: 0.5,
  /** Build timeout in seconds */
  BUILD_TIMEOUT_SECONDS: 3600,
} as const;
