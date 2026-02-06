/**
 * Domain Types for External Object Index
 * @module services/rollup/external-object-index/domain/types
 *
 * Core type definitions including branded types for type-safe IDs,
 * reference types, and cloud provider enumerations.
 *
 * TASK-ROLLUP-003: Domain layer type definitions
 */

import { createHash } from 'crypto';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Brand symbol for type safety
 */
declare const brand: unique symbol;

/**
 * Branded type utility
 */
type Brand<T, B> = T & { readonly [brand]: B };

/**
 * Reference hash type (SHA-256 hex string)
 * Used for unique identification and fast lookup of external references.
 */
export type ReferenceHash = Brand<string, 'ReferenceHash'>;

/**
 * Index entry ID type
 */
export type IndexEntryId = Brand<string, 'IndexEntryId'>;

// ============================================================================
// External Reference Types
// ============================================================================

/**
 * Types of external references that can be indexed.
 * Each type has specific validation rules and parsing logic.
 */
export const ExternalRefType = {
  /** AWS ARN references */
  ARN: 'arn',
  /** Generic cloud resource IDs */
  RESOURCE_ID: 'resource_id',
  /** Kubernetes resource references */
  K8S_REFERENCE: 'k8s_reference',
  /** GCP resource IDs */
  GCP_RESOURCE: 'gcp_resource',
  /** Azure resource IDs */
  AZURE_RESOURCE: 'azure_resource',
  /** Container image references */
  CONTAINER_IMAGE: 'container_image',
  /** Git repository URLs */
  GIT_URL: 'git_url',
  /** S3/GCS object paths */
  STORAGE_PATH: 'storage_path',
} as const;

export type ExternalRefType = typeof ExternalRefType[keyof typeof ExternalRefType];

/**
 * All valid external reference types as an array
 */
export const ALL_EXTERNAL_REF_TYPES: readonly ExternalRefType[] = Object.values(ExternalRefType);

/**
 * Check if a string is a valid ExternalRefType
 */
export function isExternalRefType(value: string): value is ExternalRefType {
  return ALL_EXTERNAL_REF_TYPES.includes(value as ExternalRefType);
}

// ============================================================================
// Cloud Provider Types
// ============================================================================

/**
 * Supported cloud providers for external references
 */
export const CloudProvider = {
  AWS: 'aws',
  GCP: 'gcp',
  AZURE: 'azure',
  KUBERNETES: 'kubernetes',
  UNKNOWN: 'unknown',
} as const;

export type CloudProvider = typeof CloudProvider[keyof typeof CloudProvider];

/**
 * All valid cloud providers as an array
 */
export const ALL_CLOUD_PROVIDERS: readonly CloudProvider[] = Object.values(CloudProvider);

/**
 * Check if a string is a valid CloudProvider
 */
export function isCloudProvider(value: string): value is CloudProvider {
  return ALL_CLOUD_PROVIDERS.includes(value as CloudProvider);
}

// ============================================================================
// Reference Hash Computation
// ============================================================================

/**
 * Compute a SHA-256 hash for reference lookup.
 * Creates a deterministic hash from reference type and identifier.
 *
 * @param refType - The type of external reference
 * @param identifier - The reference identifier (e.g., ARN string)
 * @returns A branded ReferenceHash
 *
 * @example
 * ```typescript
 * const hash = computeReferenceHash('arn', 'arn:aws:s3:::my-bucket');
 * // Returns a 64-character hex string as ReferenceHash
 * ```
 */
export function computeReferenceHash(
  refType: ExternalRefType,
  identifier: string
): ReferenceHash {
  const input = `${refType}:${identifier.toLowerCase()}`;
  const hash = createHash('sha256').update(input).digest('hex');
  return hash as ReferenceHash;
}

/**
 * Compute a hash for a node's reference collection.
 * Used for detecting changes in a node's references.
 *
 * @param hashes - Array of reference hashes
 * @returns A combined hash for the collection
 */
export function computeCollectionHash(hashes: ReferenceHash[]): ReferenceHash {
  const sorted = [...hashes].sort();
  const input = sorted.join(':');
  const hash = createHash('sha256').update(input).digest('hex');
  return hash as ReferenceHash;
}

// ============================================================================
// Factory Functions for Branded Types
// ============================================================================

/**
 * Create an IndexEntryId from a string
 * @param id - The raw ID string
 * @returns Branded IndexEntryId
 */
export function createIndexEntryId(id: string): IndexEntryId {
  return id as IndexEntryId;
}

/**
 * Create a ReferenceHash from a string (for reconstitution)
 * @param hash - The raw hash string
 * @returns Branded ReferenceHash
 */
export function createReferenceHash(hash: string): ReferenceHash {
  return hash as ReferenceHash;
}

// ============================================================================
// Validation Patterns
// ============================================================================

/**
 * ARN format regex pattern
 * Format: arn:partition:service:region:account-id:resource
 */
export const ARN_PATTERN = /^arn:([a-z-]+):([a-z0-9-]+):([a-z0-9-]*):([0-9]*):(.+)$/;

/**
 * Container image reference pattern
 * Format: [registry/]repository[:tag][@digest]
 */
export const CONTAINER_IMAGE_PATTERN = /^([\w.-]+(?::\d+)?\/)?[\w.-]+(?:\/[\w.-]+)*(?:[:@][\w.-]+)?$/;

/**
 * Git URL patterns (HTTPS and SSH)
 */
export const GIT_URL_PATTERNS = {
  HTTPS: /^https?:\/\/[\w.-]+\/[\w.-]+\/[\w.-]+(?:\.git)?$/,
  SSH: /^git@[\w.-]+:[\w.-]+\/[\w.-]+(?:\.git)?$/,
};

/**
 * S3 path pattern
 * Format: s3://bucket-name/key/path
 */
export const S3_PATH_PATTERN = /^s3:\/\/[\w.-]+(?:\/.*)?$/;

/**
 * GCS path pattern
 * Format: gs://bucket-name/key/path
 */
export const GCS_PATH_PATTERN = /^gs:\/\/[\w.-]+(?:\/.*)?$/;

/**
 * Azure Blob path pattern
 * Format: https://account.blob.core.windows.net/container/path
 */
export const AZURE_BLOB_PATTERN = /^https:\/\/[\w.-]+\.blob\.core\.windows\.net\/[\w.-]+(?:\/.*)?$/;

/**
 * Kubernetes resource reference pattern
 * Format: namespace/kind/name or kind/name
 */
export const K8S_REFERENCE_PATTERN = /^(?:[\w.-]+\/)?[\w.-]+\/[\w.-]+$/;

// ============================================================================
// Confidence Score
// ============================================================================

/**
 * Confidence score boundaries
 */
export const ConfidenceLevel = {
  /** Very high confidence (95-100%) */
  CERTAIN: { min: 0.95, max: 1.0, label: 'certain' },
  /** High confidence (80-94%) */
  HIGH: { min: 0.80, max: 0.95, label: 'high' },
  /** Medium confidence (60-79%) */
  MEDIUM: { min: 0.60, max: 0.80, label: 'medium' },
  /** Low confidence (40-59%) */
  LOW: { min: 0.40, max: 0.60, label: 'low' },
  /** Uncertain (0-39%) */
  UNCERTAIN: { min: 0.0, max: 0.40, label: 'uncertain' },
} as const;

/**
 * Get the confidence level label for a score
 * @param score - Confidence score (0.0 to 1.0)
 * @returns The confidence level label
 */
export function getConfidenceLevel(score: number): string {
  if (score >= ConfidenceLevel.CERTAIN.min) return ConfidenceLevel.CERTAIN.label;
  if (score >= ConfidenceLevel.HIGH.min) return ConfidenceLevel.HIGH.label;
  if (score >= ConfidenceLevel.MEDIUM.min) return ConfidenceLevel.MEDIUM.label;
  if (score >= ConfidenceLevel.LOW.min) return ConfidenceLevel.LOW.label;
  return ConfidenceLevel.UNCERTAIN.label;
}

// ============================================================================
// External Reference Data Transfer Objects
// ============================================================================

/**
 * External reference plain object (for serialization)
 */
export interface ExternalReferenceDTO {
  readonly refType: ExternalRefType;
  readonly identifier: string;
  readonly provider: CloudProvider | null;
  readonly attributes: Record<string, string>;
  readonly confidence: number;
  readonly referenceHash: string;
}

/**
 * Index entry plain object (for serialization)
 */
export interface IndexEntryDTO {
  readonly id: string;
  readonly nodeId: string;
  readonly scanId: string;
  readonly repositoryId: string;
  readonly tenantId: string;
  readonly references: ExternalReferenceDTO[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Parameters for creating an external reference
 */
export interface CreateExternalReferenceParams {
  readonly refType: ExternalRefType;
  readonly identifier: string;
  readonly provider?: CloudProvider | null;
  readonly attributes?: ReadonlyMap<string, string> | Record<string, string>;
  readonly confidence?: number;
}

/**
 * Parameters for creating an index entry
 */
export interface CreateIndexEntryParams {
  readonly id?: string;
  readonly nodeId: string;
  readonly scanId: string;
  readonly repositoryId: string;
  readonly tenantId: string;
}

/**
 * Node data for reference extraction
 */
export interface NodeReferenceSource {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly metadata: Record<string, unknown>;
  readonly location: {
    readonly file: string;
    readonly lineStart: number;
    readonly lineEnd: number;
  };
}
