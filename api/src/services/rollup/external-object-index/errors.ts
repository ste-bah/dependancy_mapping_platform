/**
 * External Object Index Error Classes
 * @module services/rollup/external-object-index/errors
 *
 * Comprehensive error handling system for the External Object Index.
 * Provides structured errors, recovery strategies, and error reporting
 * for indexing, lookup, cache, and extraction operations.
 *
 * Features:
 * - Hierarchical error classes with domain-specific context
 * - Retryability classification for transient vs permanent errors
 * - HTTP status code mapping for API responses
 * - Error severity levels for logging and alerting
 * - Circuit breaker support for external dependencies
 * - Error aggregation for batch operations
 *
 * TASK-ROLLUP-003: External Object Index error handling
 */

import { RollupError, RollupErrorCodes, RollupErrorContext, SerializedRollupError } from '../errors.js';
import { RollupErrorSeverity } from '../error-codes.js';
import type { ExternalReferenceType } from './interfaces.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * External Object Index specific error codes with comprehensive coverage
 */
export const ExternalObjectIndexErrorCodes = {
  // ===========================================================================
  // Indexing Errors (EXT_OBJ_IDX_*)
  // ===========================================================================
  /** Index build failed completely */
  INDEX_BUILD_FAILED: 'EXT_OBJ_IDX_BUILD_FAILED',
  /** Index build partially failed */
  INDEX_BUILD_PARTIAL: 'EXT_OBJ_IDX_BUILD_PARTIAL',
  /** Index build cancelled */
  INDEX_BUILD_CANCELLED: 'EXT_OBJ_IDX_BUILD_CANCELLED',
  /** Index entry is invalid */
  INDEX_ENTRY_INVALID: 'EXT_OBJ_IDX_ENTRY_INVALID',
  /** Index operation timed out */
  INDEX_TIMEOUT: 'EXT_OBJ_IDX_TIMEOUT',
  /** Index capacity exceeded */
  INDEX_CAPACITY_EXCEEDED: 'EXT_OBJ_IDX_CAPACITY_EXCEEDED',
  /** Index is corrupted */
  INDEX_CORRUPTED: 'EXT_OBJ_IDX_CORRUPTED',
  /** Index is locked by another operation */
  INDEX_LOCKED: 'EXT_OBJ_IDX_LOCKED',
  /** Index rebuild required */
  INDEX_REBUILD_REQUIRED: 'EXT_OBJ_IDX_REBUILD_REQUIRED',

  // ===========================================================================
  // Lookup Errors (EXT_OBJ_LKP_*)
  // ===========================================================================
  /** Lookup operation failed */
  LOOKUP_FAILED: 'EXT_OBJ_LKP_FAILED',
  /** Lookup operation timed out */
  LOOKUP_TIMEOUT: 'EXT_OBJ_LKP_TIMEOUT',
  /** Invalid external ID format */
  INVALID_EXTERNAL_ID: 'EXT_OBJ_LKP_INVALID_EXTERNAL_ID',
  /** External object not found */
  EXTERNAL_OBJECT_NOT_FOUND: 'EXT_OBJ_LKP_NOT_FOUND',
  /** Ambiguous lookup (multiple matches) */
  LOOKUP_AMBIGUOUS: 'EXT_OBJ_LKP_AMBIGUOUS',
  /** Query too broad */
  LOOKUP_QUERY_TOO_BROAD: 'EXT_OBJ_LKP_QUERY_TOO_BROAD',

  // ===========================================================================
  // Extraction Errors (EXT_OBJ_EXT_*)
  // ===========================================================================
  /** Reference extraction failed */
  EXTRACTION_FAILED: 'EXT_OBJ_EXT_FAILED',
  /** Extractor not found for type */
  EXTRACTOR_NOT_FOUND: 'EXT_OBJ_EXT_EXTRACTOR_NOT_FOUND',
  /** Unsupported reference type */
  UNSUPPORTED_REFERENCE_TYPE: 'EXT_OBJ_EXT_UNSUPPORTED_TYPE',
  /** Invalid reference format */
  INVALID_REFERENCE_FORMAT: 'EXT_OBJ_EXT_INVALID_FORMAT',
  /** Extraction parse error */
  EXTRACTION_PARSE_ERROR: 'EXT_OBJ_EXT_PARSE_ERROR',
  /** Node has no extractable references */
  NO_EXTRACTABLE_REFERENCES: 'EXT_OBJ_EXT_NO_REFERENCES',

  // ===========================================================================
  // Cache Errors (EXT_OBJ_CACHE_*)
  // ===========================================================================
  /** Cache write failed */
  CACHE_WRITE_FAILED: 'EXT_OBJ_CACHE_WRITE_FAILED',
  /** Cache read failed */
  CACHE_READ_FAILED: 'EXT_OBJ_CACHE_READ_FAILED',
  /** Cache invalidation failed */
  CACHE_INVALIDATION_FAILED: 'EXT_OBJ_CACHE_INVALIDATION_FAILED',
  /** Cache is unavailable */
  CACHE_UNAVAILABLE: 'EXT_OBJ_CACHE_UNAVAILABLE',
  /** Cache serialization error */
  CACHE_SERIALIZATION_ERROR: 'EXT_OBJ_CACHE_SERIALIZATION_ERROR',
  /** Cache is full */
  CACHE_FULL: 'EXT_OBJ_CACHE_FULL',
  /** L1 cache error */
  CACHE_L1_ERROR: 'EXT_OBJ_CACHE_L1_ERROR',
  /** L2 cache error */
  CACHE_L2_ERROR: 'EXT_OBJ_CACHE_L2_ERROR',

  // ===========================================================================
  // Repository Errors (EXT_OBJ_REPO_*)
  // ===========================================================================
  /** Repository operation failed */
  REPOSITORY_ERROR: 'EXT_OBJ_REPO_ERROR',
  /** Entry not found */
  ENTRY_NOT_FOUND: 'EXT_OBJ_REPO_ENTRY_NOT_FOUND',
  /** Database connection error */
  DATABASE_CONNECTION_ERROR: 'EXT_OBJ_REPO_DB_CONNECTION',
  /** Database query error */
  DATABASE_QUERY_ERROR: 'EXT_OBJ_REPO_DB_QUERY',
  /** Constraint violation */
  CONSTRAINT_VIOLATION: 'EXT_OBJ_REPO_CONSTRAINT_VIOLATION',
  /** Transaction failed */
  TRANSACTION_FAILED: 'EXT_OBJ_REPO_TRANSACTION_FAILED',

  // ===========================================================================
  // Validation Errors (EXT_OBJ_VAL_*)
  // ===========================================================================
  /** Validation error */
  VALIDATION_ERROR: 'EXT_OBJ_VAL_ERROR',
  /** Required field missing */
  VALIDATION_REQUIRED_FIELD: 'EXT_OBJ_VAL_REQUIRED_FIELD',
  /** Invalid field value */
  VALIDATION_INVALID_VALUE: 'EXT_OBJ_VAL_INVALID_VALUE',
  /** Batch size exceeded */
  VALIDATION_BATCH_SIZE_EXCEEDED: 'EXT_OBJ_VAL_BATCH_SIZE_EXCEEDED',

  // ===========================================================================
  // Permission Errors (EXT_OBJ_PERM_*)
  // ===========================================================================
  /** Unauthorized access */
  UNAUTHORIZED: 'EXT_OBJ_PERM_UNAUTHORIZED',
  /** Access forbidden */
  FORBIDDEN: 'EXT_OBJ_PERM_FORBIDDEN',
  /** Rate limited */
  RATE_LIMITED: 'EXT_OBJ_PERM_RATE_LIMITED',

  // ===========================================================================
  // Infrastructure Errors (EXT_OBJ_INFRA_*)
  // ===========================================================================
  /** Service unavailable */
  SERVICE_UNAVAILABLE: 'EXT_OBJ_INFRA_SERVICE_UNAVAILABLE',
  /** Circuit breaker open */
  CIRCUIT_OPEN: 'EXT_OBJ_INFRA_CIRCUIT_OPEN',
  /** Resource exhausted */
  RESOURCE_EXHAUSTED: 'EXT_OBJ_INFRA_RESOURCE_EXHAUSTED',
} as const;

export type ExternalObjectIndexErrorCode =
  typeof ExternalObjectIndexErrorCodes[keyof typeof ExternalObjectIndexErrorCodes];

// ============================================================================
// Error Severity Mapping
// ============================================================================

/**
 * Severity level for each error code
 */
export const ExternalObjectIndexErrorSeverity: Record<ExternalObjectIndexErrorCode, RollupErrorSeverity> = {
  // Indexing - mostly errors
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_CANCELLED]: RollupErrorSeverity.INFO,
  [ExternalObjectIndexErrorCodes.INDEX_ENTRY_INVALID]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.INDEX_TIMEOUT]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.INDEX_CAPACITY_EXCEEDED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.INDEX_CORRUPTED]: RollupErrorSeverity.CRITICAL,
  [ExternalObjectIndexErrorCodes.INDEX_LOCKED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.INDEX_REBUILD_REQUIRED]: RollupErrorSeverity.WARNING,

  // Lookup - mostly warnings
  [ExternalObjectIndexErrorCodes.LOOKUP_FAILED]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.LOOKUP_TIMEOUT]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.INVALID_EXTERNAL_ID]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND]: RollupErrorSeverity.INFO,
  [ExternalObjectIndexErrorCodes.LOOKUP_AMBIGUOUS]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.LOOKUP_QUERY_TOO_BROAD]: RollupErrorSeverity.WARNING,

  // Extraction - mostly warnings
  [ExternalObjectIndexErrorCodes.EXTRACTION_FAILED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.EXTRACTOR_NOT_FOUND]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.UNSUPPORTED_REFERENCE_TYPE]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.INVALID_REFERENCE_FORMAT]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.EXTRACTION_PARSE_ERROR]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES]: RollupErrorSeverity.INFO,

  // Cache - mostly warnings (degraded performance)
  [ExternalObjectIndexErrorCodes.CACHE_WRITE_FAILED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_READ_FAILED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_INVALIDATION_FAILED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_UNAVAILABLE]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_FULL]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_L1_ERROR]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.CACHE_L2_ERROR]: RollupErrorSeverity.WARNING,

  // Repository - critical for data integrity
  [ExternalObjectIndexErrorCodes.REPOSITORY_ERROR]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.ENTRY_NOT_FOUND]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.DATABASE_CONNECTION_ERROR]: RollupErrorSeverity.CRITICAL,
  [ExternalObjectIndexErrorCodes.DATABASE_QUERY_ERROR]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.CONSTRAINT_VIOLATION]: RollupErrorSeverity.ERROR,
  [ExternalObjectIndexErrorCodes.TRANSACTION_FAILED]: RollupErrorSeverity.ERROR,

  // Validation - user errors
  [ExternalObjectIndexErrorCodes.VALIDATION_ERROR]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.VALIDATION_REQUIRED_FIELD]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.VALIDATION_INVALID_VALUE]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.VALIDATION_BATCH_SIZE_EXCEEDED]: RollupErrorSeverity.WARNING,

  // Permission - security events
  [ExternalObjectIndexErrorCodes.UNAUTHORIZED]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.FORBIDDEN]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.RATE_LIMITED]: RollupErrorSeverity.WARNING,

  // Infrastructure - system issues
  [ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE]: RollupErrorSeverity.CRITICAL,
  [ExternalObjectIndexErrorCodes.CIRCUIT_OPEN]: RollupErrorSeverity.WARNING,
  [ExternalObjectIndexErrorCodes.RESOURCE_EXHAUSTED]: RollupErrorSeverity.ERROR,
};

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * HTTP status code for each error code
 */
export const ExternalObjectIndexHttpStatus: Record<ExternalObjectIndexErrorCode, number> = {
  // Indexing
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED]: 500,
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL]: 207, // Multi-Status
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_CANCELLED]: 499, // Client Closed Request
  [ExternalObjectIndexErrorCodes.INDEX_ENTRY_INVALID]: 422,
  [ExternalObjectIndexErrorCodes.INDEX_TIMEOUT]: 504,
  [ExternalObjectIndexErrorCodes.INDEX_CAPACITY_EXCEEDED]: 507, // Insufficient Storage
  [ExternalObjectIndexErrorCodes.INDEX_CORRUPTED]: 500,
  [ExternalObjectIndexErrorCodes.INDEX_LOCKED]: 423, // Locked
  [ExternalObjectIndexErrorCodes.INDEX_REBUILD_REQUIRED]: 409,

  // Lookup
  [ExternalObjectIndexErrorCodes.LOOKUP_FAILED]: 500,
  [ExternalObjectIndexErrorCodes.LOOKUP_TIMEOUT]: 504,
  [ExternalObjectIndexErrorCodes.INVALID_EXTERNAL_ID]: 400,
  [ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND]: 404,
  [ExternalObjectIndexErrorCodes.LOOKUP_AMBIGUOUS]: 300, // Multiple Choices
  [ExternalObjectIndexErrorCodes.LOOKUP_QUERY_TOO_BROAD]: 400,

  // Extraction
  [ExternalObjectIndexErrorCodes.EXTRACTION_FAILED]: 422,
  [ExternalObjectIndexErrorCodes.EXTRACTOR_NOT_FOUND]: 501,
  [ExternalObjectIndexErrorCodes.UNSUPPORTED_REFERENCE_TYPE]: 422,
  [ExternalObjectIndexErrorCodes.INVALID_REFERENCE_FORMAT]: 400,
  [ExternalObjectIndexErrorCodes.EXTRACTION_PARSE_ERROR]: 422,
  [ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES]: 422,

  // Cache
  [ExternalObjectIndexErrorCodes.CACHE_WRITE_FAILED]: 500,
  [ExternalObjectIndexErrorCodes.CACHE_READ_FAILED]: 500,
  [ExternalObjectIndexErrorCodes.CACHE_INVALIDATION_FAILED]: 500,
  [ExternalObjectIndexErrorCodes.CACHE_UNAVAILABLE]: 503,
  [ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR]: 500,
  [ExternalObjectIndexErrorCodes.CACHE_FULL]: 507,
  [ExternalObjectIndexErrorCodes.CACHE_L1_ERROR]: 500,
  [ExternalObjectIndexErrorCodes.CACHE_L2_ERROR]: 500,

  // Repository
  [ExternalObjectIndexErrorCodes.REPOSITORY_ERROR]: 500,
  [ExternalObjectIndexErrorCodes.ENTRY_NOT_FOUND]: 404,
  [ExternalObjectIndexErrorCodes.DATABASE_CONNECTION_ERROR]: 503,
  [ExternalObjectIndexErrorCodes.DATABASE_QUERY_ERROR]: 500,
  [ExternalObjectIndexErrorCodes.CONSTRAINT_VIOLATION]: 409,
  [ExternalObjectIndexErrorCodes.TRANSACTION_FAILED]: 500,

  // Validation
  [ExternalObjectIndexErrorCodes.VALIDATION_ERROR]: 400,
  [ExternalObjectIndexErrorCodes.VALIDATION_REQUIRED_FIELD]: 400,
  [ExternalObjectIndexErrorCodes.VALIDATION_INVALID_VALUE]: 400,
  [ExternalObjectIndexErrorCodes.VALIDATION_BATCH_SIZE_EXCEEDED]: 400,

  // Permission
  [ExternalObjectIndexErrorCodes.UNAUTHORIZED]: 401,
  [ExternalObjectIndexErrorCodes.FORBIDDEN]: 403,
  [ExternalObjectIndexErrorCodes.RATE_LIMITED]: 429,

  // Infrastructure
  [ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE]: 503,
  [ExternalObjectIndexErrorCodes.CIRCUIT_OPEN]: 503,
  [ExternalObjectIndexErrorCodes.RESOURCE_EXHAUSTED]: 503,
};

// ============================================================================
// Retryability Mapping
// ============================================================================

/**
 * Whether each error code is retryable (transient vs permanent)
 */
export const ExternalObjectIndexRetryable: Record<ExternalObjectIndexErrorCode, boolean> = {
  // Indexing - timeout/lock are retryable
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED]: true,
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL]: true,
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_CANCELLED]: false,
  [ExternalObjectIndexErrorCodes.INDEX_ENTRY_INVALID]: false,
  [ExternalObjectIndexErrorCodes.INDEX_TIMEOUT]: true,
  [ExternalObjectIndexErrorCodes.INDEX_CAPACITY_EXCEEDED]: false,
  [ExternalObjectIndexErrorCodes.INDEX_CORRUPTED]: false,
  [ExternalObjectIndexErrorCodes.INDEX_LOCKED]: true,
  [ExternalObjectIndexErrorCodes.INDEX_REBUILD_REQUIRED]: false,

  // Lookup - timeout is retryable
  [ExternalObjectIndexErrorCodes.LOOKUP_FAILED]: true,
  [ExternalObjectIndexErrorCodes.LOOKUP_TIMEOUT]: true,
  [ExternalObjectIndexErrorCodes.INVALID_EXTERNAL_ID]: false,
  [ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND]: false,
  [ExternalObjectIndexErrorCodes.LOOKUP_AMBIGUOUS]: false,
  [ExternalObjectIndexErrorCodes.LOOKUP_QUERY_TOO_BROAD]: false,

  // Extraction - generally not retryable
  [ExternalObjectIndexErrorCodes.EXTRACTION_FAILED]: false,
  [ExternalObjectIndexErrorCodes.EXTRACTOR_NOT_FOUND]: false,
  [ExternalObjectIndexErrorCodes.UNSUPPORTED_REFERENCE_TYPE]: false,
  [ExternalObjectIndexErrorCodes.INVALID_REFERENCE_FORMAT]: false,
  [ExternalObjectIndexErrorCodes.EXTRACTION_PARSE_ERROR]: false,
  [ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES]: false,

  // Cache - generally retryable (non-critical)
  [ExternalObjectIndexErrorCodes.CACHE_WRITE_FAILED]: true,
  [ExternalObjectIndexErrorCodes.CACHE_READ_FAILED]: true,
  [ExternalObjectIndexErrorCodes.CACHE_INVALIDATION_FAILED]: true,
  [ExternalObjectIndexErrorCodes.CACHE_UNAVAILABLE]: true,
  [ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR]: false,
  [ExternalObjectIndexErrorCodes.CACHE_FULL]: true,
  [ExternalObjectIndexErrorCodes.CACHE_L1_ERROR]: true,
  [ExternalObjectIndexErrorCodes.CACHE_L2_ERROR]: true,

  // Repository - connection issues are retryable
  [ExternalObjectIndexErrorCodes.REPOSITORY_ERROR]: true,
  [ExternalObjectIndexErrorCodes.ENTRY_NOT_FOUND]: false,
  [ExternalObjectIndexErrorCodes.DATABASE_CONNECTION_ERROR]: true,
  [ExternalObjectIndexErrorCodes.DATABASE_QUERY_ERROR]: true,
  [ExternalObjectIndexErrorCodes.CONSTRAINT_VIOLATION]: false,
  [ExternalObjectIndexErrorCodes.TRANSACTION_FAILED]: true,

  // Validation - never retryable (user must fix)
  [ExternalObjectIndexErrorCodes.VALIDATION_ERROR]: false,
  [ExternalObjectIndexErrorCodes.VALIDATION_REQUIRED_FIELD]: false,
  [ExternalObjectIndexErrorCodes.VALIDATION_INVALID_VALUE]: false,
  [ExternalObjectIndexErrorCodes.VALIDATION_BATCH_SIZE_EXCEEDED]: false,

  // Permission - rate limit is retryable
  [ExternalObjectIndexErrorCodes.UNAUTHORIZED]: false,
  [ExternalObjectIndexErrorCodes.FORBIDDEN]: false,
  [ExternalObjectIndexErrorCodes.RATE_LIMITED]: true,

  // Infrastructure - transient issues are retryable
  [ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE]: true,
  [ExternalObjectIndexErrorCodes.CIRCUIT_OPEN]: true,
  [ExternalObjectIndexErrorCodes.RESOURCE_EXHAUSTED]: true,
};

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

/**
 * User-friendly error messages for each error code
 */
export const ExternalObjectIndexErrorMessage: Record<ExternalObjectIndexErrorCode, string> = {
  // Indexing
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED]: 'Failed to build the external object index.',
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL]: 'Index build completed with some errors.',
  [ExternalObjectIndexErrorCodes.INDEX_BUILD_CANCELLED]: 'Index build was cancelled.',
  [ExternalObjectIndexErrorCodes.INDEX_ENTRY_INVALID]: 'Invalid index entry encountered.',
  [ExternalObjectIndexErrorCodes.INDEX_TIMEOUT]: 'Index operation timed out.',
  [ExternalObjectIndexErrorCodes.INDEX_CAPACITY_EXCEEDED]: 'Index capacity limit exceeded.',
  [ExternalObjectIndexErrorCodes.INDEX_CORRUPTED]: 'Index is corrupted and needs to be rebuilt.',
  [ExternalObjectIndexErrorCodes.INDEX_LOCKED]: 'Index is currently locked by another operation.',
  [ExternalObjectIndexErrorCodes.INDEX_REBUILD_REQUIRED]: 'A full index rebuild is required.',

  // Lookup
  [ExternalObjectIndexErrorCodes.LOOKUP_FAILED]: 'External object lookup failed.',
  [ExternalObjectIndexErrorCodes.LOOKUP_TIMEOUT]: 'Lookup operation timed out.',
  [ExternalObjectIndexErrorCodes.INVALID_EXTERNAL_ID]: 'Invalid external object identifier format.',
  [ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND]: 'External object not found.',
  [ExternalObjectIndexErrorCodes.LOOKUP_AMBIGUOUS]: 'Multiple objects match the query.',
  [ExternalObjectIndexErrorCodes.LOOKUP_QUERY_TOO_BROAD]: 'Query is too broad. Please refine your search.',

  // Extraction
  [ExternalObjectIndexErrorCodes.EXTRACTION_FAILED]: 'Failed to extract external references.',
  [ExternalObjectIndexErrorCodes.EXTRACTOR_NOT_FOUND]: 'No extractor available for this reference type.',
  [ExternalObjectIndexErrorCodes.UNSUPPORTED_REFERENCE_TYPE]: 'This reference type is not supported.',
  [ExternalObjectIndexErrorCodes.INVALID_REFERENCE_FORMAT]: 'Invalid reference format.',
  [ExternalObjectIndexErrorCodes.EXTRACTION_PARSE_ERROR]: 'Failed to parse the reference.',
  [ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES]: 'No external references found in the node.',

  // Cache
  [ExternalObjectIndexErrorCodes.CACHE_WRITE_FAILED]: 'Failed to write to cache.',
  [ExternalObjectIndexErrorCodes.CACHE_READ_FAILED]: 'Failed to read from cache.',
  [ExternalObjectIndexErrorCodes.CACHE_INVALIDATION_FAILED]: 'Failed to invalidate cache.',
  [ExternalObjectIndexErrorCodes.CACHE_UNAVAILABLE]: 'Cache service is temporarily unavailable.',
  [ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR]: 'Failed to serialize cache data.',
  [ExternalObjectIndexErrorCodes.CACHE_FULL]: 'Cache is full.',
  [ExternalObjectIndexErrorCodes.CACHE_L1_ERROR]: 'L1 cache error occurred.',
  [ExternalObjectIndexErrorCodes.CACHE_L2_ERROR]: 'L2 cache error occurred.',

  // Repository
  [ExternalObjectIndexErrorCodes.REPOSITORY_ERROR]: 'Repository operation failed.',
  [ExternalObjectIndexErrorCodes.ENTRY_NOT_FOUND]: 'Entry not found in the index.',
  [ExternalObjectIndexErrorCodes.DATABASE_CONNECTION_ERROR]: 'Database connection error.',
  [ExternalObjectIndexErrorCodes.DATABASE_QUERY_ERROR]: 'Database query failed.',
  [ExternalObjectIndexErrorCodes.CONSTRAINT_VIOLATION]: 'Data constraint violation.',
  [ExternalObjectIndexErrorCodes.TRANSACTION_FAILED]: 'Database transaction failed.',

  // Validation
  [ExternalObjectIndexErrorCodes.VALIDATION_ERROR]: 'Validation failed.',
  [ExternalObjectIndexErrorCodes.VALIDATION_REQUIRED_FIELD]: 'A required field is missing.',
  [ExternalObjectIndexErrorCodes.VALIDATION_INVALID_VALUE]: 'Invalid field value.',
  [ExternalObjectIndexErrorCodes.VALIDATION_BATCH_SIZE_EXCEEDED]: 'Batch size limit exceeded.',

  // Permission
  [ExternalObjectIndexErrorCodes.UNAUTHORIZED]: 'Authentication required.',
  [ExternalObjectIndexErrorCodes.FORBIDDEN]: 'Access denied.',
  [ExternalObjectIndexErrorCodes.RATE_LIMITED]: 'Rate limit exceeded. Please try again later.',

  // Infrastructure
  [ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable.',
  [ExternalObjectIndexErrorCodes.CIRCUIT_OPEN]: 'Service circuit breaker is open.',
  [ExternalObjectIndexErrorCodes.RESOURCE_EXHAUSTED]: 'System resources exhausted.',
};

// ============================================================================
// Error Context Interface
// ============================================================================

/**
 * Extended error context for External Object Index errors
 */
export interface ExternalObjectIndexErrorContext extends RollupErrorContext {
  /** External ID being processed */
  externalId?: string;
  /** Reference type */
  referenceType?: ExternalReferenceType;
  /** Node ID involved */
  nodeId?: string;
  /** Scan ID involved */
  scanId?: string;
  /** Build ID for index operations */
  buildId?: string;
  /** Cache key involved */
  cacheKey?: string;
  /** Cache layer (l1, l2) */
  cacheLayer?: 'l1' | 'l2' | 'both';
  /** Operation being performed */
  operation?: string;
  /** Batch processing progress */
  batchProgress?: {
    processed: number;
    total: number;
    failed: number;
  };
  /** Retry information */
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    nextRetryAt?: Date;
    backoffMs?: number;
  };
  /** Performance metrics */
  metrics?: {
    durationMs?: number;
    itemsProcessed?: number;
    cacheHits?: number;
    cacheMisses?: number;
  };
}

// ============================================================================
// Base External Object Index Error
// ============================================================================

/**
 * Base error class for External Object Index operations.
 * Provides comprehensive error handling with retryability, severity,
 * and rich context for debugging and monitoring.
 */
export class ExternalObjectIndexError extends RollupError {
  /**
   * Whether this error is retryable
   */
  public readonly retryable: boolean;

  /**
   * Suggested retry delay in milliseconds
   */
  public readonly retryAfterMs?: number;

  /**
   * Error-specific context
   */
  public readonly indexContext: ExternalObjectIndexErrorContext;

  constructor(
    message: string,
    code: ExternalObjectIndexErrorCode = ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(message, code, context);
    this.name = 'ExternalObjectIndexError';
    this.retryable = ExternalObjectIndexRetryable[code] ?? false;
    this.indexContext = context;

    // Calculate suggested retry delay for retryable errors
    if (this.retryable && context.retryInfo) {
      const baseDelay = 1000;
      const attempt = context.retryInfo.attempt || 1;
      this.retryAfterMs = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
    }
  }

  /**
   * Get the HTTP status code for this error
   */
  getHttpStatus(): number {
    return ExternalObjectIndexHttpStatus[this.code as ExternalObjectIndexErrorCode] ?? 500;
  }

  /**
   * Get the severity level for this error
   */
  getSeverity(): RollupErrorSeverity {
    return ExternalObjectIndexErrorSeverity[this.code as ExternalObjectIndexErrorCode] ?? RollupErrorSeverity.ERROR;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return ExternalObjectIndexErrorMessage[this.code as ExternalObjectIndexErrorCode] ?? this.message;
  }

  /**
   * Create a timeout error
   */
  static timeout(operation: string, timeoutMs: number): ExternalObjectIndexError {
    return new ExternalObjectIndexError(
      `External object index operation timed out: ${operation} after ${timeoutMs}ms`,
      ExternalObjectIndexErrorCodes.INDEX_TIMEOUT,
      { operation, metrics: { durationMs: timeoutMs } }
    );
  }

  /**
   * Create a capacity exceeded error
   */
  static capacityExceeded(
    current: number,
    maximum: number
  ): ExternalObjectIndexError {
    return new ExternalObjectIndexError(
      `External object index capacity exceeded: ${current} entries (max: ${maximum})`,
      ExternalObjectIndexErrorCodes.INDEX_CAPACITY_EXCEEDED,
      { details: { current, maximum } }
    );
  }

  /**
   * Create an error with retry context
   */
  withRetry(attempt: number, maxAttempts: number, backoffMs?: number): ExternalObjectIndexError {
    const nextRetryAt = backoffMs ? new Date(Date.now() + backoffMs) : undefined;
    return new ExternalObjectIndexError(
      this.message,
      this.code as ExternalObjectIndexErrorCode,
      {
        ...this.indexContext,
        retryInfo: { attempt, maxAttempts, nextRetryAt, backoffMs },
      }
    );
  }

  /**
   * Serialize for logging/API response
   */
  override toJSON(): SerializedRollupError {
    const base = super.toJSON();
    return {
      ...base,
      statusCode: this.getHttpStatus(),
      details: {
        ...base.details,
        retryable: this.retryable,
        retryAfterMs: this.retryAfterMs,
        userMessage: this.getUserMessage(),
        indexContext: this.indexContext,
      },
    };
  }

  /**
   * Create a safe API response (no sensitive data)
   */
  toApiResponse(): Record<string, unknown> {
    return {
      error: {
        code: this.code,
        message: this.getUserMessage(),
        retryable: this.retryable,
        ...(this.retryAfterMs && { retryAfterMs: this.retryAfterMs }),
      },
      statusCode: this.getHttpStatus(),
    };
  }
}

// ============================================================================
// Index Build Errors
// ============================================================================

/**
 * Error thrown during index building.
 * Supports partial failures with detailed tracking of failed nodes.
 */
export class IndexBuildError extends ExternalObjectIndexError {
  /**
   * Nodes that failed to process
   */
  public readonly failedNodes: string[];

  /**
   * Number of successful entries
   */
  public readonly successCount: number;

  /**
   * Total nodes attempted
   */
  public readonly totalCount: number;

  /**
   * Build ID if available
   */
  public readonly buildId?: string;

  /**
   * Build phase where failure occurred
   */
  public readonly phase?: 'extraction' | 'indexing' | 'persistence' | 'validation';

  constructor(
    message: string,
    failedNodes: string[] = [],
    successCount: number = 0,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    const code = failedNodes.length > 0 && successCount > 0
      ? ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL
      : ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED;

    super(message, code, {
      ...context,
      batchProgress: {
        processed: successCount,
        total: successCount + failedNodes.length,
        failed: failedNodes.length,
      },
    });
    this.name = 'IndexBuildError';
    this.failedNodes = failedNodes;
    this.successCount = successCount;
    this.totalCount = successCount + failedNodes.length;
    this.buildId = context.buildId;
    this.phase = context.operation as IndexBuildError['phase'];
  }

  /**
   * Create from partial results
   */
  static fromPartialResult(
    processedCount: number,
    failedCount: number,
    failedNodes: string[],
    buildId?: string
  ): IndexBuildError {
    return new IndexBuildError(
      `Index build partially failed: ${failedCount} of ${processedCount + failedCount} nodes failed`,
      failedNodes,
      processedCount,
      { buildId, details: { failedCount, totalCount: processedCount + failedCount } }
    );
  }

  /**
   * Create a timeout error for build operation
   */
  static buildTimeout(
    buildId: string,
    timeoutMs: number,
    progress?: { processed: number; total: number }
  ): IndexBuildError {
    return new IndexBuildError(
      `Index build timed out after ${timeoutMs}ms`,
      [],
      progress?.processed ?? 0,
      {
        buildId,
        metrics: { durationMs: timeoutMs },
        batchProgress: progress ? { ...progress, failed: 0 } : undefined,
      }
    );
  }

  /**
   * Create a cancelled error
   */
  static cancelled(
    buildId: string,
    reason?: string,
    progress?: { processed: number; total: number }
  ): IndexBuildError {
    const error = new IndexBuildError(
      `Index build cancelled${reason ? `: ${reason}` : ''}`,
      [],
      progress?.processed ?? 0,
      { buildId, details: { reason } }
    );
    // Override code for cancelled
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.INDEX_BUILD_CANCELLED;
    return error;
  }

  /**
   * Get failure rate as percentage
   */
  getFailureRate(): number {
    if (this.totalCount === 0) return 0;
    return (this.failedNodes.length / this.totalCount) * 100;
  }

  /**
   * Check if build was a complete failure
   */
  isCompleteFaillure(): boolean {
    return this.successCount === 0 && this.failedNodes.length > 0;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      failedNodes: this.failedNodes.slice(0, 100), // Limit for serialization
      successCount: this.successCount,
      totalCount: this.totalCount,
      failureRate: `${this.getFailureRate().toFixed(1)}%`,
      buildId: this.buildId,
      phase: this.phase,
    };
  }
}

// ============================================================================
// Lookup Errors
// ============================================================================

/**
 * Error thrown during lookup operations.
 * Supports various lookup failure modes including timeout, not found, and ambiguous results.
 */
export class LookupError extends ExternalObjectIndexError {
  /**
   * The external ID that caused the error
   */
  public readonly externalId: string;

  /**
   * Reference type if specified
   */
  public readonly referenceType?: ExternalReferenceType;

  /**
   * Number of matches (for ambiguous lookups)
   */
  public readonly matchCount?: number;

  constructor(
    message: string,
    externalId: string,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(
      message,
      ExternalObjectIndexErrorCodes.LOOKUP_FAILED,
      { ...context, externalId }
    );
    this.name = 'LookupError';
    this.externalId = externalId;
    this.referenceType = context.referenceType;
  }

  /**
   * Create an invalid external ID error
   */
  static invalidExternalId(
    externalId: string,
    reason: string
  ): LookupError {
    const error = new LookupError(
      `Invalid external ID: ${reason}`,
      externalId,
      { details: { reason } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.INVALID_EXTERNAL_ID;
    return error;
  }

  /**
   * Create a not found error
   */
  static notFound(
    externalId: string,
    referenceType?: ExternalReferenceType
  ): LookupError {
    const error = new LookupError(
      `External object not found: ${externalId}`,
      externalId,
      { referenceType }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND;
    return error;
  }

  /**
   * Create a lookup timeout error
   */
  static timeout(externalId: string, timeoutMs: number): LookupError {
    const error = new LookupError(
      `Lookup timed out after ${timeoutMs}ms`,
      externalId,
      { metrics: { durationMs: timeoutMs } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.LOOKUP_TIMEOUT;
    return error;
  }

  /**
   * Create an ambiguous lookup error
   */
  static ambiguous(
    externalId: string,
    matchCount: number,
    referenceType?: ExternalReferenceType
  ): LookupError {
    const error = new LookupError(
      `Ambiguous lookup: ${matchCount} matches found for ${externalId}`,
      externalId,
      { referenceType, details: { matchCount } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.LOOKUP_AMBIGUOUS;
    (error as Record<string, unknown>)['matchCount'] = matchCount;
    return error;
  }

  /**
   * Create a query too broad error
   */
  static queryTooBroad(
    externalId: string,
    estimatedMatches: number
  ): LookupError {
    const error = new LookupError(
      `Query too broad: estimated ${estimatedMatches} matches. Please refine your search.`,
      externalId,
      { details: { estimatedMatches } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.LOOKUP_QUERY_TOO_BROAD;
    return error;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      externalId: this.externalId,
      referenceType: this.referenceType,
      matchCount: this.matchCount,
    };
  }
}

// ============================================================================
// Extraction Errors
// ============================================================================

/**
 * Error thrown during reference extraction.
 * Captures detailed context about what extraction failed and why.
 */
export class ExtractionError extends ExternalObjectIndexError {
  /**
   * Node ID that failed extraction
   */
  public readonly nodeId: string;

  /**
   * Reference type being extracted
   */
  public readonly referenceType?: ExternalReferenceType;

  /**
   * Source attribute in the node that caused the error
   */
  public readonly sourceAttribute?: string;

  /**
   * The value that failed to parse
   */
  public readonly failedValue?: string;

  constructor(
    message: string,
    nodeId: string,
    referenceType?: ExternalReferenceType,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(
      message,
      ExternalObjectIndexErrorCodes.EXTRACTION_FAILED,
      { ...context, nodeId, referenceType }
    );
    this.name = 'ExtractionError';
    this.nodeId = nodeId;
    this.referenceType = referenceType;
    this.sourceAttribute = context.details?.sourceAttribute as string | undefined;
    this.failedValue = context.details?.failedValue as string | undefined;
  }

  /**
   * Create an extractor not found error
   */
  static extractorNotFound(
    referenceType: ExternalReferenceType
  ): ExtractionError {
    const error = new ExtractionError(
      `No extractor found for reference type: ${referenceType}`,
      '',
      referenceType
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.EXTRACTOR_NOT_FOUND;
    return error;
  }

  /**
   * Create an unsupported reference type error
   */
  static unsupportedReferenceType(
    referenceType: string,
    nodeId: string
  ): ExtractionError {
    const error = new ExtractionError(
      `Unsupported reference type: ${referenceType}`,
      nodeId,
      undefined,
      { details: { attemptedType: referenceType } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.UNSUPPORTED_REFERENCE_TYPE;
    return error;
  }

  /**
   * Create an invalid format error
   */
  static invalidFormat(
    nodeId: string,
    referenceType: ExternalReferenceType,
    value: string,
    reason: string
  ): ExtractionError {
    const error = new ExtractionError(
      `Invalid ${referenceType} format: ${reason}`,
      nodeId,
      referenceType,
      { details: { failedValue: value, reason } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.INVALID_REFERENCE_FORMAT;
    (error as Record<string, unknown>)['failedValue'] = value;
    return error;
  }

  /**
   * Create a parse error
   */
  static parseError(
    nodeId: string,
    referenceType: ExternalReferenceType,
    value: string,
    parseError: Error
  ): ExtractionError {
    const error = new ExtractionError(
      `Failed to parse ${referenceType}: ${parseError.message}`,
      nodeId,
      referenceType,
      { cause: parseError, details: { failedValue: value } }
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.EXTRACTION_PARSE_ERROR;
    (error as Record<string, unknown>)['failedValue'] = value;
    return error;
  }

  /**
   * Create a no references error
   */
  static noReferences(nodeId: string): ExtractionError {
    const error = new ExtractionError(
      `No extractable external references found in node`,
      nodeId
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES;
    return error;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      nodeId: this.nodeId,
      referenceType: this.referenceType,
      sourceAttribute: this.sourceAttribute,
      // Don't expose full failed value in production (may contain sensitive data)
      failedValue: this.failedValue ? `${this.failedValue.substring(0, 50)}...` : undefined,
    };
  }
}

// ============================================================================
// Cache Errors
// ============================================================================

/**
 * Error thrown during cache operations.
 * Designed to be non-fatal - cache errors should allow fallback to database.
 */
export class CacheError extends ExternalObjectIndexError {
  /**
   * Cache key that caused the error
   */
  public readonly cacheKey: string;

  /**
   * Cache layer where error occurred
   */
  public readonly cacheLayer: 'l1' | 'l2' | 'both' | 'unknown';

  /**
   * The cache operation that failed
   */
  public readonly operation: 'get' | 'set' | 'delete' | 'invalidate' | 'unknown';

  constructor(
    message: string,
    cacheKey: string,
    cacheLayer: 'l1' | 'l2' | 'both' | 'unknown' = 'unknown',
    code: ExternalObjectIndexErrorCode = ExternalObjectIndexErrorCodes.CACHE_READ_FAILED,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(message, code, { ...context, cacheKey, cacheLayer });
    this.name = 'CacheError';
    this.cacheKey = cacheKey;
    this.cacheLayer = cacheLayer;
    this.operation = (context.operation as CacheError['operation']) ?? 'unknown';
  }

  /**
   * Create a cache write error
   */
  static writeFailed(
    cacheKey: string,
    cacheLayer: 'l1' | 'l2',
    cause?: Error
  ): CacheError {
    return new CacheError(
      `Failed to write to ${cacheLayer} cache: ${cause?.message ?? 'unknown error'}`,
      cacheKey,
      cacheLayer,
      ExternalObjectIndexErrorCodes.CACHE_WRITE_FAILED,
      { cause, operation: 'set' }
    );
  }

  /**
   * Create a cache read error
   */
  static readFailed(
    cacheKey: string,
    cacheLayer: 'l1' | 'l2',
    cause?: Error
  ): CacheError {
    return new CacheError(
      `Failed to read from ${cacheLayer} cache: ${cause?.message ?? 'unknown error'}`,
      cacheKey,
      cacheLayer,
      ExternalObjectIndexErrorCodes.CACHE_READ_FAILED,
      { cause, operation: 'get' }
    );
  }

  /**
   * Create a cache invalidation error
   */
  static invalidationFailed(
    pattern: string,
    cause?: Error
  ): CacheError {
    return new CacheError(
      `Failed to invalidate cache: ${cause?.message ?? 'unknown error'}`,
      pattern,
      'both',
      ExternalObjectIndexErrorCodes.CACHE_INVALIDATION_FAILED,
      { cause, operation: 'invalidate' }
    );
  }

  /**
   * Create a cache unavailable error
   */
  static unavailable(cacheLayer: 'l1' | 'l2' | 'both', cause?: Error): CacheError {
    return new CacheError(
      `${cacheLayer.toUpperCase()} cache is unavailable`,
      '',
      cacheLayer,
      ExternalObjectIndexErrorCodes.CACHE_UNAVAILABLE,
      { cause }
    );
  }

  /**
   * Create a serialization error
   */
  static serializationError(
    cacheKey: string,
    operation: 'serialize' | 'deserialize',
    cause?: Error
  ): CacheError {
    return new CacheError(
      `Cache ${operation} failed for key: ${cause?.message ?? 'unknown error'}`,
      cacheKey,
      'unknown',
      ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR,
      { cause, operation: operation === 'serialize' ? 'set' : 'get' }
    );
  }

  /**
   * Create a cache full error
   */
  static full(cacheLayer: 'l1' | 'l2', currentSize: number, maxSize: number): CacheError {
    return new CacheError(
      `${cacheLayer.toUpperCase()} cache is full: ${currentSize}/${maxSize}`,
      '',
      cacheLayer,
      ExternalObjectIndexErrorCodes.CACHE_FULL,
      { details: { currentSize, maxSize }, operation: 'set' }
    );
  }

  /**
   * Check if this is a non-critical error that allows fallback
   */
  allowsFallback(): boolean {
    // All cache errors except serialization should allow fallback
    return this.code !== ExternalObjectIndexErrorCodes.CACHE_SERIALIZATION_ERROR;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      cacheKey: this.cacheKey,
      cacheLayer: this.cacheLayer,
      operation: this.operation,
      allowsFallback: this.allowsFallback(),
    };
  }
}

// ============================================================================
// Repository Errors
// ============================================================================

/**
 * Error thrown during repository/database operations.
 */
export class RepositoryError extends ExternalObjectIndexError {
  /**
   * The repository operation that failed
   */
  public readonly operation: string;

  /**
   * Query or SQL that caused the error (sanitized)
   */
  public readonly query?: string;

  constructor(
    message: string,
    operation: string,
    code: ExternalObjectIndexErrorCode = ExternalObjectIndexErrorCodes.REPOSITORY_ERROR,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(message, code, { ...context, operation });
    this.name = 'RepositoryError';
    this.operation = operation;
    this.query = context.details?.query as string | undefined;
  }

  /**
   * Create a connection error
   */
  static connectionError(cause: Error): RepositoryError {
    return new RepositoryError(
      `Database connection failed: ${cause.message}`,
      'connect',
      ExternalObjectIndexErrorCodes.DATABASE_CONNECTION_ERROR,
      { cause }
    );
  }

  /**
   * Create a query error
   */
  static queryError(operation: string, cause: Error): RepositoryError {
    return new RepositoryError(
      `Database query failed: ${cause.message}`,
      operation,
      ExternalObjectIndexErrorCodes.DATABASE_QUERY_ERROR,
      { cause }
    );
  }

  /**
   * Create a constraint violation error
   */
  static constraintViolation(
    operation: string,
    constraint: string,
    cause?: Error
  ): RepositoryError {
    return new RepositoryError(
      `Constraint violation: ${constraint}`,
      operation,
      ExternalObjectIndexErrorCodes.CONSTRAINT_VIOLATION,
      { cause, details: { constraint } }
    );
  }

  /**
   * Create a transaction failed error
   */
  static transactionFailed(operation: string, cause?: Error): RepositoryError {
    return new RepositoryError(
      `Transaction failed during ${operation}: ${cause?.message ?? 'unknown error'}`,
      operation,
      ExternalObjectIndexErrorCodes.TRANSACTION_FAILED,
      { cause }
    );
  }

  /**
   * Create an entry not found error
   */
  static entryNotFound(id: string, type: string = 'entry'): RepositoryError {
    return new RepositoryError(
      `${type} not found: ${id}`,
      'findById',
      ExternalObjectIndexErrorCodes.ENTRY_NOT_FOUND,
      { details: { id, type } }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      operation: this.operation,
      // Don't expose query details in production
      query: process.env.NODE_ENV !== 'production' ? this.query : undefined,
    };
  }
}

// ============================================================================
// Validation Errors
// ============================================================================

/**
 * Validation error with field-level details.
 */
export class IndexValidationError extends ExternalObjectIndexError {
  /**
   * Field validation errors
   */
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    code?: string;
    value?: unknown;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; code?: string; value?: unknown }>,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(message, ExternalObjectIndexErrorCodes.VALIDATION_ERROR, {
      ...context,
      details: { validationErrors },
    });
    this.name = 'IndexValidationError';
    this.validationErrors = validationErrors;
  }

  /**
   * Create from field errors
   */
  static fromFieldErrors(
    errors: Array<{ field: string; message: string; code?: string }>
  ): IndexValidationError {
    const message = errors.length === 1
      ? `Validation error: ${errors[0].message}`
      : `Validation failed with ${errors.length} errors`;
    return new IndexValidationError(message, errors);
  }

  /**
   * Create a required field error
   */
  static requiredField(field: string): IndexValidationError {
    return new IndexValidationError(
      `Required field missing: ${field}`,
      [{ field, message: 'This field is required', code: 'required' }]
    );
  }

  /**
   * Create an invalid value error
   */
  static invalidValue(
    field: string,
    value: unknown,
    reason: string
  ): IndexValidationError {
    return new IndexValidationError(
      `Invalid value for ${field}: ${reason}`,
      [{ field, message: reason, code: 'invalid', value }]
    );
  }

  /**
   * Create a batch size exceeded error
   */
  static batchSizeExceeded(
    current: number,
    maximum: number
  ): IndexValidationError {
    const error = new IndexValidationError(
      `Batch size exceeded: ${current} (maximum: ${maximum})`,
      [{ field: 'batch', message: `Maximum batch size is ${maximum}`, code: 'batch_size' }]
    );
    (error as Record<string, unknown>)['code'] = ExternalObjectIndexErrorCodes.VALIDATION_BATCH_SIZE_EXCEEDED;
    return error;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors.map(e => ({
        field: e.field,
        message: e.message,
        code: e.code,
        // Don't expose values in production
        value: process.env.NODE_ENV !== 'production' ? e.value : undefined,
      })),
    };
  }
}

// ============================================================================
// Infrastructure Errors
// ============================================================================

/**
 * Error for infrastructure/system-level failures.
 */
export class InfrastructureError extends ExternalObjectIndexError {
  /**
   * The service that failed
   */
  public readonly serviceName: string;

  /**
   * Whether the service is expected to recover
   */
  public readonly willRecover: boolean;

  /**
   * Suggested retry delay in milliseconds
   */
  public override readonly retryAfterMs?: number;

  constructor(
    message: string,
    serviceName: string,
    code: ExternalObjectIndexErrorCode = ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    super(message, code, context);
    this.name = 'InfrastructureError';
    this.serviceName = serviceName;
    this.willRecover = this.retryable;

    // Default retry delay based on error type
    if (this.retryable) {
      this.retryAfterMs = context.retryInfo?.backoffMs ?? this.getDefaultRetryDelay(code);
    }
  }

  private getDefaultRetryDelay(code: ExternalObjectIndexErrorCode): number {
    switch (code) {
      case ExternalObjectIndexErrorCodes.RATE_LIMITED:
        return 60000; // 1 minute for rate limits
      case ExternalObjectIndexErrorCodes.CIRCUIT_OPEN:
        return 30000; // 30 seconds for circuit breaker
      case ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE:
        return 5000; // 5 seconds for service unavailable
      default:
        return 1000;
    }
  }

  /**
   * Create a service unavailable error
   */
  static serviceUnavailable(
    serviceName: string,
    cause?: Error
  ): InfrastructureError {
    return new InfrastructureError(
      `Service '${serviceName}' is temporarily unavailable`,
      serviceName,
      ExternalObjectIndexErrorCodes.SERVICE_UNAVAILABLE,
      { cause }
    );
  }

  /**
   * Create a circuit open error
   */
  static circuitOpen(
    serviceName: string,
    retryAfterMs: number
  ): InfrastructureError {
    return new InfrastructureError(
      `Circuit breaker for '${serviceName}' is open. Retry after ${retryAfterMs}ms`,
      serviceName,
      ExternalObjectIndexErrorCodes.CIRCUIT_OPEN,
      { retryInfo: { attempt: 0, maxAttempts: 0, backoffMs: retryAfterMs } }
    );
  }

  /**
   * Create a rate limited error
   */
  static rateLimited(
    serviceName: string,
    retryAfterSeconds: number
  ): InfrastructureError {
    return new InfrastructureError(
      `Rate limit exceeded for '${serviceName}'. Retry after ${retryAfterSeconds} seconds`,
      serviceName,
      ExternalObjectIndexErrorCodes.RATE_LIMITED,
      { retryInfo: { attempt: 0, maxAttempts: 0, backoffMs: retryAfterSeconds * 1000 } }
    );
  }

  /**
   * Create a resource exhausted error
   */
  static resourceExhausted(
    resourceType: string,
    current: number,
    maximum: number
  ): InfrastructureError {
    return new InfrastructureError(
      `Resource exhausted: ${resourceType} (${current}/${maximum})`,
      resourceType,
      ExternalObjectIndexErrorCodes.RESOURCE_EXHAUSTED,
      { details: { resourceType, current, maximum } }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      serviceName: this.serviceName,
      willRecover: this.willRecover,
      retryAfterMs: this.retryAfterMs,
    };
  }
}

// ============================================================================
// Error Aggregation
// ============================================================================

/**
 * Aggregated error for batch operations with multiple failures.
 */
export class AggregateIndexError extends ExternalObjectIndexError {
  /**
   * Individual errors that were aggregated
   */
  public readonly errors: ExternalObjectIndexError[];

  /**
   * Number of successful operations
   */
  public readonly successCount: number;

  /**
   * Total number of operations
   */
  public readonly totalCount: number;

  constructor(
    message: string,
    errors: ExternalObjectIndexError[],
    successCount: number,
    totalCount: number,
    context: ExternalObjectIndexErrorContext = {}
  ) {
    const code = successCount > 0
      ? ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL
      : ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED;

    super(message, code, {
      ...context,
      batchProgress: { processed: successCount, total: totalCount, failed: errors.length },
    });
    this.name = 'AggregateIndexError';
    this.errors = errors;
    this.successCount = successCount;
    this.totalCount = totalCount;
  }

  /**
   * Create from an array of results
   */
  static fromResults<T>(
    results: Array<{ success: boolean; value?: T; error?: Error }>,
    context?: ExternalObjectIndexErrorContext
  ): AggregateIndexError | null {
    const errors = results
      .filter((r): r is { success: false; error: Error } => !r.success && !!r.error)
      .map((r) => {
        if (r.error instanceof ExternalObjectIndexError) {
          return r.error;
        }
        return new ExternalObjectIndexError(
          r.error.message,
          ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED,
          { cause: r.error }
        );
      });

    if (errors.length === 0) {
      return null;
    }

    const successCount = results.filter((r) => r.success).length;
    const message = errors.length === 1
      ? `Operation failed: ${errors[0].message}`
      : `${errors.length} operations failed out of ${results.length}`;

    return new AggregateIndexError(message, errors, successCount, results.length, context);
  }

  /**
   * Get failure rate as percentage
   */
  getFailureRate(): number {
    if (this.totalCount === 0) return 0;
    return (this.errors.length / this.totalCount) * 100;
  }

  /**
   * Get errors grouped by error code
   */
  getErrorsByCode(): Map<ExternalObjectIndexErrorCode, ExternalObjectIndexError[]> {
    const grouped = new Map<ExternalObjectIndexErrorCode, ExternalObjectIndexError[]>();
    for (const error of this.errors) {
      const code = error.code as ExternalObjectIndexErrorCode;
      const existing = grouped.get(code) || [];
      existing.push(error);
      grouped.set(code, existing);
    }
    return grouped;
  }

  /**
   * Check if any errors are retryable
   */
  hasRetryableErrors(): boolean {
    return this.errors.some((e) => e.retryable);
  }

  /**
   * Get only retryable errors
   */
  getRetryableErrors(): ExternalObjectIndexError[] {
    return this.errors.filter((e) => e.retryable);
  }

  toJSON(): Record<string, unknown> {
    const errorsByCode: Record<string, number> = {};
    for (const [code, errors] of this.getErrorsByCode()) {
      errorsByCode[code] = errors.length;
    }

    return {
      ...super.toJSON(),
      successCount: this.successCount,
      totalCount: this.totalCount,
      failureRate: `${this.getFailureRate().toFixed(1)}%`,
      errorsByCode,
      hasRetryableErrors: this.hasRetryableErrors(),
      errors: this.errors.slice(0, 10).map((e) => ({
        code: e.code,
        message: e.message,
        retryable: e.retryable,
      })),
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is an ExternalObjectIndexError
 */
export function isExternalObjectIndexError(
  error: unknown
): error is ExternalObjectIndexError {
  return error instanceof ExternalObjectIndexError;
}

/**
 * Check if an error is an IndexBuildError
 */
export function isIndexBuildError(error: unknown): error is IndexBuildError {
  return error instanceof IndexBuildError;
}

/**
 * Check if an error is a LookupError
 */
export function isLookupError(error: unknown): error is LookupError {
  return error instanceof LookupError;
}

/**
 * Check if an error is an ExtractionError
 */
export function isExtractionError(error: unknown): error is ExtractionError {
  return error instanceof ExtractionError;
}

/**
 * Check if an error is a CacheError
 */
export function isCacheError(error: unknown): error is CacheError {
  return error instanceof CacheError;
}

/**
 * Check if an error is a RepositoryError
 */
export function isRepositoryError(error: unknown): error is RepositoryError {
  return error instanceof RepositoryError;
}

/**
 * Check if an error is a ValidationError
 */
export function isIndexValidationError(error: unknown): error is IndexValidationError {
  return error instanceof IndexValidationError;
}

/**
 * Check if an error is an InfrastructureError
 */
export function isInfrastructureError(error: unknown): error is InfrastructureError {
  return error instanceof InfrastructureError;
}

/**
 * Check if an error is an AggregateIndexError
 */
export function isAggregateIndexError(error: unknown): error is AggregateIndexError {
  return error instanceof AggregateIndexError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableIndexError(error: unknown): boolean {
  if (!isExternalObjectIndexError(error)) {
    // Check for transient network errors
    if (error instanceof Error) {
      const transientPatterns = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'socket hang up',
        'connection reset',
      ];
      return transientPatterns.some((p) =>
        error.message.toLowerCase().includes(p.toLowerCase())
      );
    }
    return false;
  }

  return error.retryable;
}

// ============================================================================
// HTTP Status Mapping
// ============================================================================

/**
 * Map an error to its HTTP status code
 */
export function errorToHttpStatus(error: unknown): number {
  if (isExternalObjectIndexError(error)) {
    return error.getHttpStatus();
  }

  // Handle standard errors
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes('not found')) return 404;
    if (message.includes('unauthorized') || message.includes('auth')) return 401;
    if (message.includes('forbidden') || message.includes('permission')) return 403;
    if (message.includes('validation') || message.includes('invalid')) return 400;
    if (message.includes('timeout')) return 504;
    if (message.includes('conflict')) return 409;
  }

  return 500;
}

/**
 * Map error code to HTTP status
 */
export function errorCodeToHttpStatus(code: ExternalObjectIndexErrorCode): number {
  return ExternalObjectIndexHttpStatus[code] ?? 500;
}

// ============================================================================
// Error Wrapping
// ============================================================================

/**
 * Wrap an unknown error as an ExternalObjectIndexError
 */
export function wrapAsIndexError(
  error: unknown,
  defaultCode: ExternalObjectIndexErrorCode = ExternalObjectIndexErrorCodes.INDEX_BUILD_FAILED,
  context?: ExternalObjectIndexErrorContext
): ExternalObjectIndexError {
  // Already an index error - enhance with context if needed
  if (error instanceof ExternalObjectIndexError) {
    if (context && Object.keys(context).length > 0) {
      return new ExternalObjectIndexError(
        error.message,
        error.code as ExternalObjectIndexErrorCode,
        { ...error.indexContext, ...context }
      );
    }
    return error;
  }

  // Wrap standard Error
  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return new ExternalObjectIndexError(message, defaultCode, {
    ...context,
    cause,
  });
}

// ============================================================================
// Error Recovery Utilities
// ============================================================================

/**
 * Options for retry logic
 */
export interface IndexRetryOptions {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number;
  /** Jitter factor (0-1) */
  jitterFactor?: number;
  /** Custom retry predicate */
  retryIf?: (error: Error, attempt: number) => boolean;
  /** Callback on each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

/**
 * Default retry options for index operations
 */
export const DEFAULT_INDEX_RETRY_OPTIONS: IndexRetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
};

/**
 * Execute an operation with retry logic
 */
export async function withIndexRetry<T>(
  operation: () => Promise<T>,
  options: Partial<IndexRetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_INDEX_RETRY_OPTIONS, ...options };
  const {
    maxAttempts,
    baseDelayMs,
    backoffMultiplier = 2,
    maxDelayMs = 30000,
    jitterFactor = 0.1,
    retryIf = isRetryableIndexError,
    onRetry,
  } = opts;

  let lastError: Error;
  let currentDelay = baseDelayMs;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if this is the last attempt or error is not retryable
      if (attempt === maxAttempts || !retryIf(lastError, attempt)) {
        // Wrap with retry info if it's an index error
        if (lastError instanceof ExternalObjectIndexError) {
          throw lastError.withRetry(attempt, maxAttempts);
        }
        throw lastError;
      }

      // Calculate delay with jitter
      const jitter = jitterFactor * currentDelay * (Math.random() * 2 - 1);
      const actualDelay = Math.min(currentDelay + jitter, maxDelayMs);

      onRetry?.(lastError, attempt, actualDelay);

      await sleep(actualDelay);
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Execute an operation with fallback on error
 */
export async function withIndexFallback<T>(
  operation: () => Promise<T>,
  fallback: T | ((error: Error) => T | Promise<T>),
  options?: {
    shouldFallback?: (error: Error) => boolean;
    onFallback?: (error: Error, fallbackValue: T) => void;
  }
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const err = error as Error;

    // Check if we should use fallback
    if (options?.shouldFallback && !options.shouldFallback(err)) {
      throw error;
    }

    // Get fallback value
    const fallbackValue = typeof fallback === 'function'
      ? await (fallback as (error: Error) => T | Promise<T>)(err)
      : fallback;

    options?.onFallback?.(err, fallbackValue);
    return fallbackValue;
  }
}

/**
 * Execute an operation with timeout
 */
export async function withIndexTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorFactory?: (timeoutMs: number) => ExternalObjectIndexError
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        const error = errorFactory
          ? errorFactory(timeoutMs)
          : ExternalObjectIndexError.timeout('operation', timeoutMs);
        reject(error);
      }, timeoutMs);
    }),
  ]);
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create an index error from an error code
 */
export function createIndexError(
  code: ExternalObjectIndexErrorCode,
  context?: ExternalObjectIndexErrorContext
): ExternalObjectIndexError {
  const message = ExternalObjectIndexErrorMessage[code];
  return new ExternalObjectIndexError(message, code, context);
}

/**
 * Create error info object for a code
 */
export interface IndexErrorInfo {
  code: ExternalObjectIndexErrorCode;
  message: string;
  severity: RollupErrorSeverity;
  httpStatus: number;
  retryable: boolean;
}

/**
 * Get complete error info for an error code
 */
export function getIndexErrorInfo(code: ExternalObjectIndexErrorCode): IndexErrorInfo {
  return {
    code,
    message: ExternalObjectIndexErrorMessage[code],
    severity: ExternalObjectIndexErrorSeverity[code],
    httpStatus: ExternalObjectIndexHttpStatus[code],
    retryable: ExternalObjectIndexRetryable[code],
  };
}

/**
 * Get all retryable error codes
 */
export function getRetryableErrorCodes(): ExternalObjectIndexErrorCode[] {
  return Object.entries(ExternalObjectIndexRetryable)
    .filter(([, retryable]) => retryable)
    .map(([code]) => code as ExternalObjectIndexErrorCode);
}

/**
 * Get error codes by severity
 */
export function getErrorCodesBySeverity(
  severity: RollupErrorSeverity
): ExternalObjectIndexErrorCode[] {
  return Object.entries(ExternalObjectIndexErrorSeverity)
    .filter(([, s]) => s === severity)
    .map(([code]) => code as ExternalObjectIndexErrorCode);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if error code indicates a validation error
 */
export function isValidationErrorCode(code: string): boolean {
  return code.startsWith('EXT_OBJ_VAL_');
}

/**
 * Check if error code indicates a cache error
 */
export function isCacheErrorCode(code: string): boolean {
  return code.startsWith('EXT_OBJ_CACHE_');
}

/**
 * Check if error code indicates an infrastructure error
 */
export function isInfrastructureErrorCode(code: string): boolean {
  return code.startsWith('EXT_OBJ_INFRA_') || code.startsWith('EXT_OBJ_REPO_DB_');
}

/**
 * Check if error code indicates a permission error
 */
export function isPermissionErrorCode(code: string): boolean {
  return code.startsWith('EXT_OBJ_PERM_');
}

/**
 * Check if error allows graceful degradation (non-fatal)
 */
export function allowsGracefulDegradation(error: unknown): boolean {
  if (!isExternalObjectIndexError(error)) return false;

  // Cache errors allow degradation (fallback to database)
  if (isCacheError(error)) return error.allowsFallback();

  // Partial build failures can be degraded
  if (error.code === ExternalObjectIndexErrorCodes.INDEX_BUILD_PARTIAL) return true;

  // Not found errors in non-critical paths
  if (error.code === ExternalObjectIndexErrorCodes.EXTERNAL_OBJECT_NOT_FOUND) return true;
  if (error.code === ExternalObjectIndexErrorCodes.NO_EXTRACTABLE_REFERENCES) return true;

  return false;
}
