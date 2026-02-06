/**
 * Rollup Cache Error Classes
 * @module services/rollup/rollup-cache/errors
 *
 * Error handling for the Rollup Cache system.
 * Provides structured errors for cache operations with
 * retryability classification and recovery support.
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 */

import { RollupError, RollupErrorContext, SerializedRollupError } from '../errors.js';
import { RollupErrorSeverity } from '../error-codes.js';
import {
  RollupCacheErrorCode,
  RollupCacheErrorCodes,
  CacheKey,
} from './interfaces.js';

// ============================================================================
// Error Severity Mapping
// ============================================================================

/**
 * Severity level for each cache error code
 */
export const RollupCacheErrorSeverity: Record<RollupCacheErrorCode, RollupErrorSeverity> = {
  [RollupCacheErrorCodes.READ_FAILED]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.WRITE_FAILED]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.INVALIDATION_FAILED]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.SERIALIZATION_FAILED]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.DESERIALIZATION_FAILED]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.L1_ERROR]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.L2_ERROR]: RollupErrorSeverity.WARNING,
  [RollupCacheErrorCodes.NOT_INITIALIZED]: RollupErrorSeverity.ERROR,
  [RollupCacheErrorCodes.CONFIG_ERROR]: RollupErrorSeverity.ERROR,
};

// ============================================================================
// Retryability Mapping
// ============================================================================

/**
 * Whether each cache error code is retryable
 */
export const RollupCacheErrorRetryable: Record<RollupCacheErrorCode, boolean> = {
  [RollupCacheErrorCodes.READ_FAILED]: true,
  [RollupCacheErrorCodes.WRITE_FAILED]: true,
  [RollupCacheErrorCodes.INVALIDATION_FAILED]: true,
  [RollupCacheErrorCodes.SERIALIZATION_FAILED]: false,
  [RollupCacheErrorCodes.DESERIALIZATION_FAILED]: false,
  [RollupCacheErrorCodes.L1_ERROR]: true,
  [RollupCacheErrorCodes.L2_ERROR]: true,
  [RollupCacheErrorCodes.NOT_INITIALIZED]: false,
  [RollupCacheErrorCodes.CONFIG_ERROR]: false,
};

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * HTTP status code for each cache error code
 */
export const RollupCacheErrorHttpStatus: Record<RollupCacheErrorCode, number> = {
  [RollupCacheErrorCodes.READ_FAILED]: 500,
  [RollupCacheErrorCodes.WRITE_FAILED]: 500,
  [RollupCacheErrorCodes.INVALIDATION_FAILED]: 500,
  [RollupCacheErrorCodes.SERIALIZATION_FAILED]: 500,
  [RollupCacheErrorCodes.DESERIALIZATION_FAILED]: 500,
  [RollupCacheErrorCodes.L1_ERROR]: 500,
  [RollupCacheErrorCodes.L2_ERROR]: 503,
  [RollupCacheErrorCodes.NOT_INITIALIZED]: 500,
  [RollupCacheErrorCodes.CONFIG_ERROR]: 500,
};

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

/**
 * User-friendly error messages for each cache error code
 */
export const RollupCacheErrorMessage: Record<RollupCacheErrorCode, string> = {
  [RollupCacheErrorCodes.READ_FAILED]: 'Failed to read from cache.',
  [RollupCacheErrorCodes.WRITE_FAILED]: 'Failed to write to cache.',
  [RollupCacheErrorCodes.INVALIDATION_FAILED]: 'Failed to invalidate cache.',
  [RollupCacheErrorCodes.SERIALIZATION_FAILED]: 'Failed to serialize data for caching.',
  [RollupCacheErrorCodes.DESERIALIZATION_FAILED]: 'Failed to deserialize cached data.',
  [RollupCacheErrorCodes.L1_ERROR]: 'L1 (in-memory) cache error occurred.',
  [RollupCacheErrorCodes.L2_ERROR]: 'L2 (Redis) cache error occurred.',
  [RollupCacheErrorCodes.NOT_INITIALIZED]: 'Cache has not been initialized.',
  [RollupCacheErrorCodes.CONFIG_ERROR]: 'Cache configuration error.',
};

// ============================================================================
// Error Context Interface
// ============================================================================

/**
 * Extended error context for Rollup Cache errors
 */
export interface RollupCacheErrorContext extends RollupErrorContext {
  /** Cache key involved */
  cacheKey?: string;
  /** Cache tag involved */
  cacheTag?: string;
  /** Cache layer where error occurred */
  cacheLayer?: 'l1' | 'l2' | 'both';
  /** Cache operation being performed */
  operation?: 'get' | 'set' | 'delete' | 'invalidate';
  /** Entry type */
  entryType?: 'execution' | 'merged_graph' | 'blast_radius';
  /** Tenant ID */
  tenantId?: string;
  /** Retry information */
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    backoffMs?: number;
  };
}

// ============================================================================
// Base Rollup Cache Error
// ============================================================================

/**
 * Base error class for Rollup Cache operations.
 * Designed to be non-fatal - cache errors should allow fallback to computation.
 */
export class RollupCacheError extends RollupError {
  /**
   * Cache-specific error code
   */
  public readonly cacheErrorCode: RollupCacheErrorCode;

  /**
   * Whether this error is retryable
   */
  public readonly retryable: boolean;

  /**
   * Suggested retry delay in milliseconds
   */
  public readonly retryAfterMs?: number;

  /**
   * Cache-specific context
   */
  public readonly cacheContext: RollupCacheErrorContext;

  constructor(
    message: string,
    code: RollupCacheErrorCode = RollupCacheErrorCodes.READ_FAILED,
    context: RollupCacheErrorContext = {}
  ) {
    // Pass undefined to parent since cache codes aren't in ErrorCode union
    // The cacheErrorCode property holds our specific error code
    super(
      message,
      undefined as unknown as undefined,
      context as unknown as Record<string, unknown>,
      context
    );
    this.name = 'RollupCacheError';
    this.cacheErrorCode = code;
    this.retryable = RollupCacheErrorRetryable[code] ?? false;
    this.cacheContext = context;

    // Calculate suggested retry delay for retryable errors
    if (this.retryable && context.retryInfo) {
      const baseDelay = 100;
      const attempt = context.retryInfo.attempt || 1;
      this.retryAfterMs = Math.min(baseDelay * Math.pow(2, attempt - 1), 5000);
    }
  }

  /**
   * Get the HTTP status code for this error
   */
  getHttpStatus(): number {
    return RollupCacheErrorHttpStatus[this.cacheErrorCode] ?? 500;
  }

  /**
   * Get the severity level for this error
   */
  getSeverity(): RollupErrorSeverity {
    return RollupCacheErrorSeverity[this.cacheErrorCode] ?? RollupErrorSeverity.WARNING;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return RollupCacheErrorMessage[this.cacheErrorCode] ?? this.message;
  }

  /**
   * Check if this error allows graceful degradation (fallback to computation)
   */
  allowsFallback(): boolean {
    // All cache errors except config/init errors allow fallback
    return (
      this.cacheErrorCode !== RollupCacheErrorCodes.NOT_INITIALIZED &&
      this.cacheErrorCode !== RollupCacheErrorCodes.CONFIG_ERROR
    );
  }

  /**
   * Create a new error with retry context
   */
  withRetry(attempt: number, maxAttempts: number, backoffMs?: number): RollupCacheError {
    const retryInfo: { attempt: number; maxAttempts: number; backoffMs?: number } = {
      attempt,
      maxAttempts,
    };
    if (backoffMs !== undefined) {
      retryInfo.backoffMs = backoffMs;
    }
    return new RollupCacheError(
      this.message,
      this.cacheErrorCode,
      {
        ...this.cacheContext,
        retryInfo,
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
      code: this.cacheErrorCode, // Use cache-specific error code
      statusCode: this.getHttpStatus(),
      details: {
        ...base.details,
        retryable: this.retryable,
        retryAfterMs: this.retryAfterMs,
        userMessage: this.getUserMessage(),
        allowsFallback: this.allowsFallback(),
        cacheContext: this.cacheContext,
      },
    };
  }

  // =========================================================================
  // Static Factory Methods
  // =========================================================================

  /**
   * Build context object with optional cause
   */
  private static buildContext(
    base: Omit<RollupCacheErrorContext, 'cause'>,
    cause?: Error
  ): RollupCacheErrorContext {
    if (cause) {
      return { ...base, cause };
    }
    return base;
  }

  /**
   * Create a read failed error
   */
  static readFailed(
    key: CacheKey,
    layer: 'l1' | 'l2',
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `Failed to read from ${layer} cache: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.READ_FAILED,
      this.buildContext({ cacheKey: key, cacheLayer: layer, operation: 'get' }, cause)
    );
  }

  /**
   * Create a write failed error
   */
  static writeFailed(
    key: CacheKey,
    layer: 'l1' | 'l2',
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `Failed to write to ${layer} cache: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.WRITE_FAILED,
      this.buildContext({ cacheKey: key, cacheLayer: layer, operation: 'set' }, cause)
    );
  }

  /**
   * Create an invalidation failed error
   */
  static invalidationFailed(
    keyOrTag: string,
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `Failed to invalidate cache: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.INVALIDATION_FAILED,
      this.buildContext({ cacheKey: keyOrTag, cacheLayer: 'both', operation: 'invalidate' }, cause)
    );
  }

  /**
   * Create a serialization failed error
   */
  static serializationFailed(
    key: CacheKey,
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `Failed to serialize cache data: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.SERIALIZATION_FAILED,
      this.buildContext({ cacheKey: key, operation: 'set' }, cause)
    );
  }

  /**
   * Create a deserialization failed error
   */
  static deserializationFailed(
    key: CacheKey,
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `Failed to deserialize cached data: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.DESERIALIZATION_FAILED,
      this.buildContext({ cacheKey: key, operation: 'get' }, cause)
    );
  }

  /**
   * Create an L1 error
   */
  static l1Error(
    operation: 'get' | 'set' | 'delete',
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `L1 cache ${operation} error: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.L1_ERROR,
      this.buildContext({ cacheLayer: 'l1', operation }, cause)
    );
  }

  /**
   * Create an L2 error
   */
  static l2Error(
    operation: 'get' | 'set' | 'delete',
    cause?: Error
  ): RollupCacheError {
    return new RollupCacheError(
      `L2 cache ${operation} error: ${cause?.message ?? 'unknown error'}`,
      RollupCacheErrorCodes.L2_ERROR,
      this.buildContext({ cacheLayer: 'l2', operation }, cause)
    );
  }

  /**
   * Create a not initialized error
   */
  static notInitialized(): RollupCacheError {
    return new RollupCacheError(
      'Cache has not been initialized',
      RollupCacheErrorCodes.NOT_INITIALIZED
    );
  }

  /**
   * Create a config error
   */
  static configError(message: string): RollupCacheError {
    return new RollupCacheError(
      `Cache configuration error: ${message}`,
      RollupCacheErrorCodes.CONFIG_ERROR
    );
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a RollupCacheError
 */
export function isRollupCacheError(error: unknown): error is RollupCacheError {
  return error instanceof RollupCacheError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableCacheError(error: unknown): boolean {
  if (!isRollupCacheError(error)) {
    return false;
  }
  return error.retryable;
}

/**
 * Check if an error allows fallback to computation
 */
export function allowsCacheFallback(error: unknown): boolean {
  if (!isRollupCacheError(error)) {
    // Non-cache errors don't prevent fallback
    return true;
  }
  return error.allowsFallback();
}

// ============================================================================
// Error Wrapping
// ============================================================================

/**
 * Wrap an unknown error as a RollupCacheError
 */
export function wrapAsCacheError(
  error: unknown,
  defaultCode: RollupCacheErrorCode = RollupCacheErrorCodes.READ_FAILED,
  context?: RollupCacheErrorContext
): RollupCacheError {
  // Already a cache error - enhance with context if needed
  if (error instanceof RollupCacheError) {
    if (context && Object.keys(context).length > 0) {
      return new RollupCacheError(
        error.message,
        error.code as RollupCacheErrorCode,
        { ...error.cacheContext, ...context }
      );
    }
    return error;
  }

  // Wrap standard Error
  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown cache error occurred';

  return new RollupCacheError(message, defaultCode, {
    ...context,
    cause,
  });
}
