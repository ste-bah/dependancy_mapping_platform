/**
 * External Object Index Domain Layer
 * @module services/rollup/external-object-index/domain
 *
 * Domain-Driven Design implementation for the External Object Index bounded context.
 * Provides entities, value objects, factories, and validation logic.
 *
 * TASK-ROLLUP-003: External Object Index domain layer
 *
 * ## Architecture Overview
 *
 * This module implements a rich domain model following DDD principles:
 *
 * - **Value Objects**: Immutable objects defined by their attributes (ExternalReferenceVO)
 * - **Aggregate Roots**: Entry points for modifications with invariant enforcement (IndexEntryAggregate)
 * - **Factories**: Centralized creation logic with validation
 * - **Result Type**: Explicit error handling without exceptions
 *
 * ## Usage
 *
 * ```typescript
 * import {
 *   ExternalReferenceVO,
 *   IndexEntryAggregate,
 *   Result,
 *   createArnRef,
 * } from './domain';
 *
 * // Create a reference
 * const arnResult = createArnRef('arn:aws:s3:::my-bucket');
 * if (Result.isOk(arnResult)) {
 *   console.log(arnResult.value.referenceHash);
 * }
 *
 * // Create an index entry
 * const entryResult = IndexEntryAggregate.create({
 *   nodeId: 'node-123',
 *   scanId: 'scan-456' as ScanId,
 *   repositoryId: 'repo-789' as RepositoryId,
 *   tenantId: 'tenant-abc' as TenantId,
 * });
 * ```
 */

// ============================================================================
// Result Type & Errors
// ============================================================================

export {
  // Result type
  Result,
  type StringResult,
  type ValidationResult,
  type DomainResult,

  // Error classes
  ValidationError,
  DomainError,

  // Type guards
  isValidationError,
  isDomainError,
} from './result.js';

// ============================================================================
// Domain Types
// ============================================================================

export {
  // Branded types
  type ReferenceHash,
  type IndexEntryId,

  // Enums
  ExternalRefType,
  CloudProvider,
  ALL_EXTERNAL_REF_TYPES,
  ALL_CLOUD_PROVIDERS,

  // Type guards
  isExternalRefType,
  isCloudProvider,

  // Hash computation
  computeReferenceHash,
  computeCollectionHash,

  // Factory functions for branded types
  createIndexEntryId,
  createReferenceHash,

  // Validation patterns
  ARN_PATTERN,
  CONTAINER_IMAGE_PATTERN,
  GIT_URL_PATTERNS,
  S3_PATH_PATTERN,
  GCS_PATH_PATTERN,
  AZURE_BLOB_PATTERN,
  K8S_REFERENCE_PATTERN,

  // Confidence levels
  ConfidenceLevel,
  getConfidenceLevel,

  // DTOs
  type ExternalReferenceDTO,
  type IndexEntryDTO,

  // Parameter types
  type CreateExternalReferenceParams,
  type CreateIndexEntryParams,
  type NodeReferenceSource,
} from './types.js';

// ============================================================================
// Value Objects
// ============================================================================

export {
  // Main value object
  ExternalReferenceVO,

  // Factory functions
  createArnReference,
  createK8sReference,
  createContainerImageReference,
  createStoragePathReference,
} from './external-reference.js';

// ============================================================================
// Aggregate Roots
// ============================================================================

export {
  // Main aggregate
  IndexEntryAggregate,

  // Factory functions
  createIndexEntryWithReferences,
  createIndexEntriesBatch,
} from './index-entry.js';

// ============================================================================
// Factories
// ============================================================================

export {
  // Factory classes
  ExternalReferenceFactory,
  IndexEntryFactory,

  // Singleton accessors
  getDefaultReferenceFactory,
  getDefaultEntryFactory,
  resetFactories,

  // Convenience factory functions
  createArnRef,
  createK8sRef,
  createEntryFromNode,

  // DI interfaces
  type IdGenerator,
  defaultIdGenerator,
} from './factories.js';

// ============================================================================
// Validators
// ============================================================================

export {
  // ARN validation
  validateArn,
  isValidArn,
  normalizeArn,
  type ParsedArn,

  // Container image validation
  validateContainerImage,
  isValidContainerImage,
  type ParsedContainerImage,

  // Git URL validation
  validateGitUrl,
  isValidGitUrl,
  type ParsedGitUrl,

  // Storage path validation
  validateStoragePath,
  isValidStoragePath,
  type ParsedStoragePath,

  // K8s reference validation
  validateK8sReference,
  isValidK8sReference,
  type ParsedK8sReference,

  // Generic validation
  validateConfidence,
  validateNonEmptyString,
  validateExternalReference,

  // Batch validation
  validateBatch,
  type BatchValidationResult,
} from './validators.js';

// ============================================================================
// Re-exports for Convenience
// ============================================================================

import { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';

/**
 * Re-export entity ID types for convenience
 */
export type { TenantId, RepositoryId, ScanId };
