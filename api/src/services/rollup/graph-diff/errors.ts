/**
 * Graph Diff Error Classes
 * @module services/rollup/graph-diff/errors
 *
 * Comprehensive error handling system for the Graph Diff feature.
 * Provides structured errors, recovery strategies, and error reporting
 * for diff computation, caching, and event handling operations.
 *
 * Features:
 * - Hierarchical error classes with domain-specific context
 * - Retryability classification for transient vs permanent errors
 * - HTTP status code mapping for API responses
 * - Error severity levels for logging and alerting
 * - Error aggregation for batch operations
 * - Route error handler for Express middleware
 *
 * TASK-ROLLUP-005: Graph Diff error handling
 */

import { RollupError, RollupErrorContext, SerializedRollupError } from '../errors.js';
import { RollupErrorSeverity } from '../error-codes.js';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Graph Diff specific error codes with comprehensive coverage
 * Format: GRAPH_DIFF_<CATEGORY>_<SPECIFIC_ERROR>
 */
export const GraphDiffErrorCodes = {
  // ===========================================================================
  // Resource Errors (GRAPH_DIFF_RES_*)
  // ===========================================================================
  /** Diff computation result not found */
  DIFF_NOT_FOUND: 'GRAPH_DIFF_RES_DIFF_NOT_FOUND',
  /** Scan not found for diff computation */
  SCAN_NOT_FOUND: 'GRAPH_DIFF_RES_SCAN_NOT_FOUND',
  /** Graph not found for scan */
  GRAPH_NOT_FOUND: 'GRAPH_DIFF_RES_GRAPH_NOT_FOUND',

  // ===========================================================================
  // Validation Errors (GRAPH_DIFF_VAL_*)
  // ===========================================================================
  /** General validation error */
  VALIDATION_FAILED: 'GRAPH_DIFF_VAL_FAILED',
  /** Scans are from different tenants */
  TENANT_MISMATCH: 'GRAPH_DIFF_VAL_TENANT_MISMATCH',
  /** Scans are incompatible (e.g., different repositories) */
  SCANS_INCOMPATIBLE: 'GRAPH_DIFF_VAL_SCANS_INCOMPATIBLE',
  /** Invalid scan ID format */
  INVALID_SCAN_ID: 'GRAPH_DIFF_VAL_INVALID_SCAN_ID',
  /** Invalid diff options */
  INVALID_OPTIONS: 'GRAPH_DIFF_VAL_INVALID_OPTIONS',

  // ===========================================================================
  // Computation Errors (GRAPH_DIFF_COMP_*)
  // ===========================================================================
  /** General computation failure */
  COMPUTATION_FAILED: 'GRAPH_DIFF_COMP_FAILED',
  /** Computation timed out */
  COMPUTATION_TIMEOUT: 'GRAPH_DIFF_COMP_TIMEOUT',
  /** Node matching failed */
  NODE_MATCHING_FAILED: 'GRAPH_DIFF_COMP_NODE_MATCH_FAILED',
  /** Edge matching failed */
  EDGE_MATCHING_FAILED: 'GRAPH_DIFF_COMP_EDGE_MATCH_FAILED',
  /** Diff analysis failed */
  ANALYSIS_FAILED: 'GRAPH_DIFF_COMP_ANALYSIS_FAILED',

  // ===========================================================================
  // Limit Errors (GRAPH_DIFF_LIMIT_*)
  // ===========================================================================
  /** Maximum nodes exceeded for diff computation */
  MAX_NODES_EXCEEDED: 'GRAPH_DIFF_LIMIT_MAX_NODES',
  /** Maximum edges exceeded */
  MAX_EDGES_EXCEEDED: 'GRAPH_DIFF_LIMIT_MAX_EDGES',
  /** Rate limit exceeded */
  RATE_LIMITED: 'GRAPH_DIFF_LIMIT_RATE',

  // ===========================================================================
  // Permission Errors (GRAPH_DIFF_PERM_*)
  // ===========================================================================
  /** Permission denied for scan access */
  PERMISSION_DENIED: 'GRAPH_DIFF_PERM_DENIED',
  /** Scan access denied */
  SCAN_ACCESS_DENIED: 'GRAPH_DIFF_PERM_SCAN_ACCESS',

  // ===========================================================================
  // Cache Errors (GRAPH_DIFF_CACHE_*)
  // ===========================================================================
  /** Cache read failed */
  CACHE_READ_FAILED: 'GRAPH_DIFF_CACHE_READ_FAILED',
  /** Cache write failed */
  CACHE_WRITE_FAILED: 'GRAPH_DIFF_CACHE_WRITE_FAILED',
  /** Cache invalidation failed */
  CACHE_INVALIDATION_FAILED: 'GRAPH_DIFF_CACHE_INVALIDATION_FAILED',

  // ===========================================================================
  // Event Errors (GRAPH_DIFF_EVENT_*)
  // ===========================================================================
  /** Event emission failed */
  EVENT_EMISSION_FAILED: 'GRAPH_DIFF_EVENT_EMISSION_FAILED',
  /** Event handler failed */
  EVENT_HANDLER_FAILED: 'GRAPH_DIFF_EVENT_HANDLER_FAILED',

  // ===========================================================================
  // Infrastructure Errors (GRAPH_DIFF_INFRA_*)
  // ===========================================================================
  /** Database error */
  DATABASE_ERROR: 'GRAPH_DIFF_INFRA_DATABASE',
  /** Service unavailable */
  SERVICE_UNAVAILABLE: 'GRAPH_DIFF_INFRA_SERVICE_UNAVAILABLE',
} as const;

export type GraphDiffErrorCode = typeof GraphDiffErrorCodes[keyof typeof GraphDiffErrorCodes];

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * HTTP status code for each error code
 */
export const GraphDiffErrorHttpStatus: Record<GraphDiffErrorCode, number> = {
  // Resource errors
  [GraphDiffErrorCodes.DIFF_NOT_FOUND]: 404,
  [GraphDiffErrorCodes.SCAN_NOT_FOUND]: 404,
  [GraphDiffErrorCodes.GRAPH_NOT_FOUND]: 404,

  // Validation errors
  [GraphDiffErrorCodes.VALIDATION_FAILED]: 400,
  [GraphDiffErrorCodes.TENANT_MISMATCH]: 403,
  [GraphDiffErrorCodes.SCANS_INCOMPATIBLE]: 422,
  [GraphDiffErrorCodes.INVALID_SCAN_ID]: 400,
  [GraphDiffErrorCodes.INVALID_OPTIONS]: 400,

  // Computation errors
  [GraphDiffErrorCodes.COMPUTATION_FAILED]: 500,
  [GraphDiffErrorCodes.COMPUTATION_TIMEOUT]: 504,
  [GraphDiffErrorCodes.NODE_MATCHING_FAILED]: 500,
  [GraphDiffErrorCodes.EDGE_MATCHING_FAILED]: 500,
  [GraphDiffErrorCodes.ANALYSIS_FAILED]: 500,

  // Limit errors
  [GraphDiffErrorCodes.MAX_NODES_EXCEEDED]: 422,
  [GraphDiffErrorCodes.MAX_EDGES_EXCEEDED]: 422,
  [GraphDiffErrorCodes.RATE_LIMITED]: 429,

  // Permission errors
  [GraphDiffErrorCodes.PERMISSION_DENIED]: 403,
  [GraphDiffErrorCodes.SCAN_ACCESS_DENIED]: 403,

  // Cache errors
  [GraphDiffErrorCodes.CACHE_READ_FAILED]: 500,
  [GraphDiffErrorCodes.CACHE_WRITE_FAILED]: 500,
  [GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED]: 500,

  // Event errors
  [GraphDiffErrorCodes.EVENT_EMISSION_FAILED]: 500,
  [GraphDiffErrorCodes.EVENT_HANDLER_FAILED]: 500,

  // Infrastructure errors
  [GraphDiffErrorCodes.DATABASE_ERROR]: 500,
  [GraphDiffErrorCodes.SERVICE_UNAVAILABLE]: 503,
};

// ============================================================================
// Error Severity Mapping
// ============================================================================

/**
 * Severity level for each error code
 */
export const GraphDiffErrorSeverity: Record<GraphDiffErrorCode, RollupErrorSeverity> = {
  // Resource errors - typically warnings (user-recoverable)
  [GraphDiffErrorCodes.DIFF_NOT_FOUND]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.SCAN_NOT_FOUND]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.GRAPH_NOT_FOUND]: RollupErrorSeverity.WARNING,

  // Validation errors - warnings (user must fix)
  [GraphDiffErrorCodes.VALIDATION_FAILED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.TENANT_MISMATCH]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.SCANS_INCOMPATIBLE]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.INVALID_SCAN_ID]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.INVALID_OPTIONS]: RollupErrorSeverity.WARNING,

  // Computation errors - errors (system issues)
  [GraphDiffErrorCodes.COMPUTATION_FAILED]: RollupErrorSeverity.ERROR,
  [GraphDiffErrorCodes.COMPUTATION_TIMEOUT]: RollupErrorSeverity.ERROR,
  [GraphDiffErrorCodes.NODE_MATCHING_FAILED]: RollupErrorSeverity.ERROR,
  [GraphDiffErrorCodes.EDGE_MATCHING_FAILED]: RollupErrorSeverity.ERROR,
  [GraphDiffErrorCodes.ANALYSIS_FAILED]: RollupErrorSeverity.ERROR,

  // Limit errors - warnings (user can reduce scope)
  [GraphDiffErrorCodes.MAX_NODES_EXCEEDED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.MAX_EDGES_EXCEEDED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.RATE_LIMITED]: RollupErrorSeverity.WARNING,

  // Permission errors - warnings (user needs access)
  [GraphDiffErrorCodes.PERMISSION_DENIED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.SCAN_ACCESS_DENIED]: RollupErrorSeverity.WARNING,

  // Cache errors - warnings (non-critical, allows fallback)
  [GraphDiffErrorCodes.CACHE_READ_FAILED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.CACHE_WRITE_FAILED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED]: RollupErrorSeverity.WARNING,

  // Event errors - warnings (non-blocking)
  [GraphDiffErrorCodes.EVENT_EMISSION_FAILED]: RollupErrorSeverity.WARNING,
  [GraphDiffErrorCodes.EVENT_HANDLER_FAILED]: RollupErrorSeverity.WARNING,

  // Infrastructure errors - critical
  [GraphDiffErrorCodes.DATABASE_ERROR]: RollupErrorSeverity.CRITICAL,
  [GraphDiffErrorCodes.SERVICE_UNAVAILABLE]: RollupErrorSeverity.CRITICAL,
};

// ============================================================================
// Retryability Mapping
// ============================================================================

/**
 * Whether each error code is retryable (transient vs permanent)
 */
export const GraphDiffErrorRetryable: Record<GraphDiffErrorCode, boolean> = {
  // Resource errors - not retryable (resource doesn't exist)
  [GraphDiffErrorCodes.DIFF_NOT_FOUND]: false,
  [GraphDiffErrorCodes.SCAN_NOT_FOUND]: false,
  [GraphDiffErrorCodes.GRAPH_NOT_FOUND]: false,

  // Validation errors - not retryable (user must fix)
  [GraphDiffErrorCodes.VALIDATION_FAILED]: false,
  [GraphDiffErrorCodes.TENANT_MISMATCH]: false,
  [GraphDiffErrorCodes.SCANS_INCOMPATIBLE]: false,
  [GraphDiffErrorCodes.INVALID_SCAN_ID]: false,
  [GraphDiffErrorCodes.INVALID_OPTIONS]: false,

  // Computation errors - timeout is retryable
  [GraphDiffErrorCodes.COMPUTATION_FAILED]: true,
  [GraphDiffErrorCodes.COMPUTATION_TIMEOUT]: true,
  [GraphDiffErrorCodes.NODE_MATCHING_FAILED]: true,
  [GraphDiffErrorCodes.EDGE_MATCHING_FAILED]: true,
  [GraphDiffErrorCodes.ANALYSIS_FAILED]: true,

  // Limit errors - rate limit is retryable
  [GraphDiffErrorCodes.MAX_NODES_EXCEEDED]: false,
  [GraphDiffErrorCodes.MAX_EDGES_EXCEEDED]: false,
  [GraphDiffErrorCodes.RATE_LIMITED]: true,

  // Permission errors - not retryable
  [GraphDiffErrorCodes.PERMISSION_DENIED]: false,
  [GraphDiffErrorCodes.SCAN_ACCESS_DENIED]: false,

  // Cache errors - retryable (non-critical)
  [GraphDiffErrorCodes.CACHE_READ_FAILED]: true,
  [GraphDiffErrorCodes.CACHE_WRITE_FAILED]: true,
  [GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED]: true,

  // Event errors - retryable
  [GraphDiffErrorCodes.EVENT_EMISSION_FAILED]: true,
  [GraphDiffErrorCodes.EVENT_HANDLER_FAILED]: true,

  // Infrastructure errors - retryable (transient)
  [GraphDiffErrorCodes.DATABASE_ERROR]: true,
  [GraphDiffErrorCodes.SERVICE_UNAVAILABLE]: true,
};

// ============================================================================
// User-Friendly Error Messages
// ============================================================================

/**
 * User-friendly error messages for each error code
 */
export const GraphDiffErrorMessage: Record<GraphDiffErrorCode, string> = {
  // Resource errors
  [GraphDiffErrorCodes.DIFF_NOT_FOUND]: 'The requested diff result was not found.',
  [GraphDiffErrorCodes.SCAN_NOT_FOUND]: 'One or more scans were not found.',
  [GraphDiffErrorCodes.GRAPH_NOT_FOUND]: 'The dependency graph was not found for the scan.',

  // Validation errors
  [GraphDiffErrorCodes.VALIDATION_FAILED]: 'Validation failed for the diff request.',
  [GraphDiffErrorCodes.TENANT_MISMATCH]: 'The scans belong to different tenants.',
  [GraphDiffErrorCodes.SCANS_INCOMPATIBLE]: 'The scans are incompatible for comparison.',
  [GraphDiffErrorCodes.INVALID_SCAN_ID]: 'Invalid scan ID format.',
  [GraphDiffErrorCodes.INVALID_OPTIONS]: 'Invalid diff options provided.',

  // Computation errors
  [GraphDiffErrorCodes.COMPUTATION_FAILED]: 'Failed to compute the graph diff.',
  [GraphDiffErrorCodes.COMPUTATION_TIMEOUT]: 'The diff computation timed out.',
  [GraphDiffErrorCodes.NODE_MATCHING_FAILED]: 'Failed to match nodes between graphs.',
  [GraphDiffErrorCodes.EDGE_MATCHING_FAILED]: 'Failed to match edges between graphs.',
  [GraphDiffErrorCodes.ANALYSIS_FAILED]: 'Failed to analyze the diff results.',

  // Limit errors
  [GraphDiffErrorCodes.MAX_NODES_EXCEEDED]: 'The graphs exceed the maximum node limit for comparison.',
  [GraphDiffErrorCodes.MAX_EDGES_EXCEEDED]: 'The graphs exceed the maximum edge limit for comparison.',
  [GraphDiffErrorCodes.RATE_LIMITED]: 'Rate limit exceeded. Please try again later.',

  // Permission errors
  [GraphDiffErrorCodes.PERMISSION_DENIED]: 'Permission denied for this operation.',
  [GraphDiffErrorCodes.SCAN_ACCESS_DENIED]: 'Access denied to one or more scans.',

  // Cache errors
  [GraphDiffErrorCodes.CACHE_READ_FAILED]: 'Failed to read from cache.',
  [GraphDiffErrorCodes.CACHE_WRITE_FAILED]: 'Failed to write to cache.',
  [GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED]: 'Failed to invalidate cache.',

  // Event errors
  [GraphDiffErrorCodes.EVENT_EMISSION_FAILED]: 'Failed to emit diff event.',
  [GraphDiffErrorCodes.EVENT_HANDLER_FAILED]: 'A diff event handler failed.',

  // Infrastructure errors
  [GraphDiffErrorCodes.DATABASE_ERROR]: 'A database error occurred.',
  [GraphDiffErrorCodes.SERVICE_UNAVAILABLE]: 'The service is temporarily unavailable.',
};

// ============================================================================
// Suggested Actions
// ============================================================================

/**
 * Suggested user actions for each error code
 */
export const GraphDiffErrorAction: Record<GraphDiffErrorCode, string> = {
  // Resource errors
  [GraphDiffErrorCodes.DIFF_NOT_FOUND]: 'Verify the diff ID is correct or recompute the diff.',
  [GraphDiffErrorCodes.SCAN_NOT_FOUND]: 'Verify the scan IDs are correct and the scans exist.',
  [GraphDiffErrorCodes.GRAPH_NOT_FOUND]: 'Run a scan on the repository to generate the dependency graph.',

  // Validation errors
  [GraphDiffErrorCodes.VALIDATION_FAILED]: 'Review and correct the request parameters.',
  [GraphDiffErrorCodes.TENANT_MISMATCH]: 'Use scans from the same tenant for comparison.',
  [GraphDiffErrorCodes.SCANS_INCOMPATIBLE]: 'Ensure both scans are from the same repository or compatible repositories.',
  [GraphDiffErrorCodes.INVALID_SCAN_ID]: 'Provide a valid scan ID in UUID format.',
  [GraphDiffErrorCodes.INVALID_OPTIONS]: 'Review the diff options and correct any errors.',

  // Computation errors
  [GraphDiffErrorCodes.COMPUTATION_FAILED]: 'Try again. If the problem persists, contact support.',
  [GraphDiffErrorCodes.COMPUTATION_TIMEOUT]: 'Try comparing smaller graphs or increase the timeout.',
  [GraphDiffErrorCodes.NODE_MATCHING_FAILED]: 'Try with different matching options.',
  [GraphDiffErrorCodes.EDGE_MATCHING_FAILED]: 'Try with different edge matching options.',
  [GraphDiffErrorCodes.ANALYSIS_FAILED]: 'Retry the operation.',

  // Limit errors
  [GraphDiffErrorCodes.MAX_NODES_EXCEEDED]: 'Filter the graphs to reduce the number of nodes.',
  [GraphDiffErrorCodes.MAX_EDGES_EXCEEDED]: 'Filter the graphs to reduce the number of edges.',
  [GraphDiffErrorCodes.RATE_LIMITED]: 'Wait before making more requests.',

  // Permission errors
  [GraphDiffErrorCodes.PERMISSION_DENIED]: 'Request access from an administrator.',
  [GraphDiffErrorCodes.SCAN_ACCESS_DENIED]: 'Request access to the required scans.',

  // Cache errors
  [GraphDiffErrorCodes.CACHE_READ_FAILED]: 'The operation will fall back to computation.',
  [GraphDiffErrorCodes.CACHE_WRITE_FAILED]: 'The result was computed but not cached.',
  [GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED]: 'Cache may contain stale data.',

  // Event errors
  [GraphDiffErrorCodes.EVENT_EMISSION_FAILED]: 'The diff was computed but event notification failed.',
  [GraphDiffErrorCodes.EVENT_HANDLER_FAILED]: 'Check the event handler logs.',

  // Infrastructure errors
  [GraphDiffErrorCodes.DATABASE_ERROR]: 'Retry the operation. Contact support if persists.',
  [GraphDiffErrorCodes.SERVICE_UNAVAILABLE]: 'Wait and retry. The service may be under maintenance.',
};

// ============================================================================
// Error Context Interface
// ============================================================================

/**
 * Extended error context for Graph Diff errors
 */
export interface GraphDiffErrorContext extends RollupErrorContext {
  /** Base scan ID */
  baseScanId?: string;
  /** Target scan ID */
  targetScanId?: string;
  /** Diff ID if computed */
  diffId?: string;
  /** Node IDs involved */
  nodeIds?: string[];
  /** Edge IDs involved */
  edgeIds?: string[];
  /** Operation being performed */
  operation?: 'compute' | 'match' | 'analyze' | 'cache' | 'event';
  /** Computation progress */
  progress?: {
    phase: string;
    nodesProcessed: number;
    totalNodes: number;
    edgesProcessed: number;
    totalEdges: number;
  };
  /** Timeout information */
  timeout?: {
    configuredMs: number;
    elapsedMs: number;
  };
  /** Limit information */
  limits?: {
    current: number;
    maximum: number;
    limitType: 'nodes' | 'edges' | 'rate';
  };
  /** Retry information */
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    nextRetryAt?: Date;
    backoffMs?: number;
  };
}

// ============================================================================
// Base Graph Diff Error
// ============================================================================

/**
 * Base error class for Graph Diff operations.
 * Provides comprehensive error handling with retryability, severity,
 * and rich context for debugging and monitoring.
 */
export class GraphDiffError extends RollupError {
  /**
   * Graph diff specific error code
   */
  public readonly diffErrorCode: GraphDiffErrorCode;

  /**
   * Whether this error is retryable
   */
  public readonly retryable: boolean;

  /**
   * Suggested retry delay in milliseconds
   */
  public readonly retryAfterMs?: number;

  /**
   * Graph diff specific context
   */
  public readonly diffContext: GraphDiffErrorContext;

  constructor(
    message: string,
    code: GraphDiffErrorCode = GraphDiffErrorCodes.COMPUTATION_FAILED,
    context: GraphDiffErrorContext = {}
  ) {
    // Pass undefined to parent since graph diff codes aren't in ErrorCode union
    // The diffErrorCode property holds our specific error code
    super(
      message,
      undefined as unknown as undefined,
      context as unknown as Record<string, unknown>,
      context
    );
    this.name = 'GraphDiffError';
    this.diffErrorCode = code;
    this.retryable = GraphDiffErrorRetryable[code] ?? false;
    this.diffContext = context;

    // Calculate suggested retry delay for retryable errors
    if (this.retryable && context.retryInfo) {
      const baseDelay = 1000;
      const attempt = context.retryInfo.attempt || 1;
      this.retryAfterMs = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
    } else if (code === GraphDiffErrorCodes.RATE_LIMITED) {
      this.retryAfterMs = 60000; // 1 minute default for rate limits
    }
  }

  /**
   * Get the HTTP status code for this error
   */
  getHttpStatus(): number {
    return GraphDiffErrorHttpStatus[this.diffErrorCode] ?? 500;
  }

  /**
   * Get the severity level for this error
   */
  getSeverity(): RollupErrorSeverity {
    return GraphDiffErrorSeverity[this.diffErrorCode] ?? RollupErrorSeverity.ERROR;
  }

  /**
   * Get user-friendly message
   */
  getUserMessage(): string {
    return GraphDiffErrorMessage[this.diffErrorCode] ?? this.message;
  }

  /**
   * Get suggested action for this error
   */
  getSuggestedAction(): string {
    return GraphDiffErrorAction[this.diffErrorCode] ?? 'Please try again.';
  }

  /**
   * Create a new error with retry context
   */
  withRetry(attempt: number, maxAttempts: number, backoffMs?: number): GraphDiffError {
    const nextRetryAt = backoffMs ? new Date(Date.now() + backoffMs) : undefined;
    return new GraphDiffError(
      this.message,
      this.diffErrorCode,
      {
        ...this.diffContext,
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
        suggestedAction: this.getSuggestedAction(),
        diffContext: this.diffContext,
      },
    };
  }

  /**
   * Create a safe API response (no sensitive data)
   */
  toApiResponse(): Record<string, unknown> {
    return {
      error: {
        code: this.diffErrorCode,
        message: this.getUserMessage(),
        suggestedAction: this.getSuggestedAction(),
        retryable: this.retryable,
        ...(this.retryAfterMs && { retryAfterMs: this.retryAfterMs }),
      },
      statusCode: this.getHttpStatus(),
    };
  }

  // =========================================================================
  // Static Factory Methods
  // =========================================================================

  /**
   * Create a diff not found error
   */
  static diffNotFound(diffId: string): GraphDiffError {
    return new GraphDiffError(
      `Diff result not found: ${diffId}`,
      GraphDiffErrorCodes.DIFF_NOT_FOUND,
      { diffId }
    );
  }

  /**
   * Create a scan not found error
   */
  static scanNotFound(scanId: string, role: 'base' | 'target' = 'base'): GraphDiffError {
    const context: GraphDiffErrorContext = role === 'base'
      ? { baseScanId: scanId }
      : { targetScanId: scanId };
    return new GraphDiffError(
      `Scan not found: ${scanId} (${role})`,
      GraphDiffErrorCodes.SCAN_NOT_FOUND,
      context
    );
  }

  /**
   * Create a scans incompatible error
   */
  static scansIncompatible(
    baseScanId: string,
    targetScanId: string,
    reason: string
  ): GraphDiffError {
    return new GraphDiffError(
      `Scans are incompatible: ${reason}`,
      GraphDiffErrorCodes.SCANS_INCOMPATIBLE,
      { baseScanId, targetScanId, details: { reason } }
    );
  }

  /**
   * Create a computation failed error
   */
  static computationFailed(
    baseScanId: string,
    targetScanId: string,
    cause?: Error
  ): GraphDiffError {
    return new GraphDiffError(
      `Failed to compute diff: ${cause?.message ?? 'unknown error'}`,
      GraphDiffErrorCodes.COMPUTATION_FAILED,
      { baseScanId, targetScanId, cause, operation: 'compute' }
    );
  }

  /**
   * Create a computation timeout error
   */
  static computationTimeout(
    baseScanId: string,
    targetScanId: string,
    configuredMs: number,
    elapsedMs: number
  ): GraphDiffError {
    return new GraphDiffError(
      `Diff computation timed out after ${elapsedMs}ms (limit: ${configuredMs}ms)`,
      GraphDiffErrorCodes.COMPUTATION_TIMEOUT,
      {
        baseScanId,
        targetScanId,
        operation: 'compute',
        timeout: { configuredMs, elapsedMs },
      }
    );
  }

  /**
   * Create a max nodes exceeded error
   */
  static maxNodesExceeded(
    current: number,
    maximum: number,
    baseScanId?: string,
    targetScanId?: string
  ): GraphDiffError {
    return new GraphDiffError(
      `Maximum node limit exceeded: ${current} nodes (max: ${maximum})`,
      GraphDiffErrorCodes.MAX_NODES_EXCEEDED,
      {
        baseScanId,
        targetScanId,
        limits: { current, maximum, limitType: 'nodes' },
      }
    );
  }

  /**
   * Create a rate limited error
   */
  static rateLimited(retryAfterSeconds?: number): GraphDiffError {
    const error = new GraphDiffError(
      `Rate limit exceeded${retryAfterSeconds ? `. Retry after ${retryAfterSeconds} seconds` : ''}`,
      GraphDiffErrorCodes.RATE_LIMITED,
      {
        retryInfo: {
          attempt: 0,
          maxAttempts: 0,
          backoffMs: retryAfterSeconds ? retryAfterSeconds * 1000 : 60000,
        },
      }
    );
    return error;
  }

  /**
   * Create a tenant mismatch error
   */
  static tenantMismatch(
    baseScanId: string,
    targetScanId: string,
    baseTenantId: string,
    targetTenantId: string
  ): GraphDiffError {
    return new GraphDiffError(
      `Scans belong to different tenants`,
      GraphDiffErrorCodes.TENANT_MISMATCH,
      {
        baseScanId,
        targetScanId,
        details: { baseTenantId, targetTenantId },
      }
    );
  }

  /**
   * Create a permission denied error
   */
  static permissionDenied(
    operation: string,
    resource?: string
  ): GraphDiffError {
    return new GraphDiffError(
      `Permission denied for operation: ${operation}${resource ? ` on ${resource}` : ''}`,
      GraphDiffErrorCodes.PERMISSION_DENIED,
      { details: { operation, resource } }
    );
  }

  /**
   * Create a validation failed error
   */
  static validationFailed(
    message: string,
    details?: Record<string, unknown>
  ): GraphDiffError {
    return new GraphDiffError(
      `Validation failed: ${message}`,
      GraphDiffErrorCodes.VALIDATION_FAILED,
      { details }
    );
  }

  /**
   * Create a cache error
   */
  static cacheError(
    operation: 'read' | 'write' | 'invalidate',
    cause?: Error
  ): GraphDiffError {
    const codeMap = {
      read: GraphDiffErrorCodes.CACHE_READ_FAILED,
      write: GraphDiffErrorCodes.CACHE_WRITE_FAILED,
      invalidate: GraphDiffErrorCodes.CACHE_INVALIDATION_FAILED,
    };
    return new GraphDiffError(
      `Cache ${operation} failed: ${cause?.message ?? 'unknown error'}`,
      codeMap[operation],
      { cause, operation: 'cache' }
    );
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

/**
 * Error thrown when a diff result is not found
 */
export class DiffNotFoundError extends GraphDiffError {
  public readonly diffId: string;

  constructor(diffId: string, context: GraphDiffErrorContext = {}) {
    super(
      `Diff result not found: ${diffId}`,
      GraphDiffErrorCodes.DIFF_NOT_FOUND,
      { ...context, diffId }
    );
    this.name = 'DiffNotFoundError';
    this.diffId = diffId;
  }
}

/**
 * Error thrown when a scan is not found
 */
export class ScanNotFoundError extends GraphDiffError {
  public readonly scanId: string;
  public readonly scanRole: 'base' | 'target';

  constructor(
    scanId: string,
    role: 'base' | 'target' = 'base',
    context: GraphDiffErrorContext = {}
  ) {
    const contextKey = role === 'base' ? 'baseScanId' : 'targetScanId';
    super(
      `Scan not found: ${scanId} (${role})`,
      GraphDiffErrorCodes.SCAN_NOT_FOUND,
      { ...context, [contextKey]: scanId }
    );
    this.name = 'ScanNotFoundError';
    this.scanId = scanId;
    this.scanRole = role;
  }
}

/**
 * Error thrown when scans are incompatible
 */
export class ScansIncompatibleError extends GraphDiffError {
  public readonly baseScanId: string;
  public readonly targetScanId: string;
  public readonly reason: string;

  constructor(
    baseScanId: string,
    targetScanId: string,
    reason: string,
    context: GraphDiffErrorContext = {}
  ) {
    super(
      `Scans are incompatible: ${reason}`,
      GraphDiffErrorCodes.SCANS_INCOMPATIBLE,
      { ...context, baseScanId, targetScanId, details: { ...context.details, reason } }
    );
    this.name = 'ScansIncompatibleError';
    this.baseScanId = baseScanId;
    this.targetScanId = targetScanId;
    this.reason = reason;
  }
}

/**
 * Error thrown when computation times out
 */
export class ComputationTimeoutError extends GraphDiffError {
  public readonly configuredMs: number;
  public readonly elapsedMs: number;

  constructor(
    configuredMs: number,
    elapsedMs: number,
    context: GraphDiffErrorContext = {}
  ) {
    super(
      `Diff computation timed out after ${elapsedMs}ms (limit: ${configuredMs}ms)`,
      GraphDiffErrorCodes.COMPUTATION_TIMEOUT,
      {
        ...context,
        operation: 'compute',
        timeout: { configuredMs, elapsedMs },
      }
    );
    this.name = 'ComputationTimeoutError';
    this.configuredMs = configuredMs;
    this.elapsedMs = elapsedMs;
  }
}

/**
 * Error thrown when node limit is exceeded
 */
export class MaxNodesExceededError extends GraphDiffError {
  public readonly currentNodes: number;
  public readonly maximumNodes: number;

  constructor(
    current: number,
    maximum: number,
    context: GraphDiffErrorContext = {}
  ) {
    super(
      `Maximum node limit exceeded: ${current} nodes (max: ${maximum})`,
      GraphDiffErrorCodes.MAX_NODES_EXCEEDED,
      {
        ...context,
        limits: { current, maximum, limitType: 'nodes' },
      }
    );
    this.name = 'MaxNodesExceededError';
    this.currentNodes = current;
    this.maximumNodes = maximum;
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a GraphDiffError
 */
export function isGraphDiffError(error: unknown): error is GraphDiffError {
  return error instanceof GraphDiffError;
}

/**
 * Check if an error is a DiffNotFoundError
 */
export function isDiffNotFoundError(error: unknown): error is DiffNotFoundError {
  return error instanceof DiffNotFoundError;
}

/**
 * Check if an error is a ScanNotFoundError
 */
export function isScanNotFoundError(error: unknown): error is ScanNotFoundError {
  return error instanceof ScanNotFoundError;
}

/**
 * Check if an error is a ScansIncompatibleError
 */
export function isScansIncompatibleError(error: unknown): error is ScansIncompatibleError {
  return error instanceof ScansIncompatibleError;
}

/**
 * Check if an error is a ComputationTimeoutError
 */
export function isComputationTimeoutError(error: unknown): error is ComputationTimeoutError {
  return error instanceof ComputationTimeoutError;
}

/**
 * Check if an error is a MaxNodesExceededError
 */
export function isMaxNodesExceededError(error: unknown): error is MaxNodesExceededError {
  return error instanceof MaxNodesExceededError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableGraphDiffError(error: unknown): boolean {
  if (isGraphDiffError(error)) {
    return error.retryable;
  }

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

// ============================================================================
// Error Wrapping
// ============================================================================

/**
 * Wrap an unknown error as a GraphDiffError
 */
export function wrapAsGraphDiffError(
  error: unknown,
  defaultCode: GraphDiffErrorCode = GraphDiffErrorCodes.COMPUTATION_FAILED,
  context?: GraphDiffErrorContext
): GraphDiffError {
  // Already a graph diff error - enhance with context if needed
  if (error instanceof GraphDiffError) {
    if (context && Object.keys(context).length > 0) {
      return new GraphDiffError(
        error.message,
        error.diffErrorCode,
        { ...error.diffContext, ...context }
      );
    }
    return error;
  }

  // Wrap standard Error
  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return new GraphDiffError(message, defaultCode, {
    ...context,
    cause,
  });
}

// ============================================================================
// HTTP Status Mapping
// ============================================================================

/**
 * Map an error to its HTTP status code
 */
export function graphDiffErrorToHttpStatus(error: unknown): number {
  if (isGraphDiffError(error)) {
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
    if (message.includes('rate limit')) return 429;
  }

  return 500;
}

/**
 * Map error code to HTTP status
 */
export function graphDiffErrorCodeToHttpStatus(code: GraphDiffErrorCode): number {
  return GraphDiffErrorHttpStatus[code] ?? 500;
}

// ============================================================================
// Route Error Handler
// ============================================================================

/**
 * Express error response format
 */
export interface GraphDiffApiErrorResponse {
  error: {
    code: string;
    message: string;
    suggestedAction?: string;
    retryable: boolean;
    retryAfterMs?: number;
  };
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

/**
 * Handle errors in route handlers and map to appropriate HTTP responses.
 * This function converts any error to a standardized API error response.
 *
 * @param error - The error to handle
 * @param requestId - Optional request ID for tracing
 * @returns Formatted error response with status code
 *
 * @example
 * ```typescript
 * app.get('/api/diff/:id', async (req, res) => {
 *   try {
 *     const diff = await diffService.getDiff(req.params.id);
 *     res.json(diff);
 *   } catch (error) {
 *     const response = handleGraphDiffRouteError(error, req.id);
 *     res.status(response.statusCode).json(response);
 *   }
 * });
 * ```
 */
export function handleGraphDiffRouteError(
  error: unknown,
  requestId?: string
): GraphDiffApiErrorResponse {
  const timestamp = new Date().toISOString();

  // Handle GraphDiffError
  if (isGraphDiffError(error)) {
    return {
      error: {
        code: error.diffErrorCode,
        message: error.getUserMessage(),
        suggestedAction: error.getSuggestedAction(),
        retryable: error.retryable,
        retryAfterMs: error.retryAfterMs,
      },
      statusCode: error.getHttpStatus(),
      timestamp,
      requestId,
    };
  }

  // Handle RollupError (parent class)
  if (error instanceof RollupError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        retryable: error.isRetryable,
      },
      statusCode: error.statusCode,
      timestamp,
      requestId,
    };
  }

  // Handle standard Error
  if (error instanceof Error) {
    const statusCode = graphDiffErrorToHttpStatus(error);
    return {
      error: {
        code: 'GRAPH_DIFF_INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'production'
          ? 'An internal error occurred.'
          : error.message,
        retryable: statusCode >= 500,
      },
      statusCode,
      timestamp,
      requestId,
    };
  }

  // Handle unknown errors
  return {
    error: {
      code: 'GRAPH_DIFF_UNKNOWN_ERROR',
      message: 'An unexpected error occurred.',
      retryable: false,
    },
    statusCode: 500,
    timestamp,
    requestId,
  };
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a graph diff error from an error code
 */
export function createGraphDiffError(
  code: GraphDiffErrorCode,
  context?: GraphDiffErrorContext
): GraphDiffError {
  const message = GraphDiffErrorMessage[code];
  return new GraphDiffError(message, code, context);
}

/**
 * Error info type
 */
export interface GraphDiffErrorInfo {
  code: GraphDiffErrorCode;
  message: string;
  severity: RollupErrorSeverity;
  httpStatus: number;
  retryable: boolean;
  suggestedAction: string;
}

/**
 * Get complete error info for an error code
 */
export function getGraphDiffErrorInfo(code: GraphDiffErrorCode): GraphDiffErrorInfo {
  return {
    code,
    message: GraphDiffErrorMessage[code],
    severity: GraphDiffErrorSeverity[code],
    httpStatus: GraphDiffErrorHttpStatus[code],
    retryable: GraphDiffErrorRetryable[code],
    suggestedAction: GraphDiffErrorAction[code],
  };
}

/**
 * Get all retryable error codes
 */
export function getRetryableGraphDiffErrorCodes(): GraphDiffErrorCode[] {
  return Object.entries(GraphDiffErrorRetryable)
    .filter(([, retryable]) => retryable)
    .map(([code]) => code as GraphDiffErrorCode);
}

/**
 * Get error codes by severity
 */
export function getGraphDiffErrorCodesBySeverity(
  severity: RollupErrorSeverity
): GraphDiffErrorCode[] {
  return Object.entries(GraphDiffErrorSeverity)
    .filter(([, s]) => s === severity)
    .map(([code]) => code as GraphDiffErrorCode);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if error code indicates a validation error
 */
export function isValidationErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_VAL_');
}

/**
 * Check if error code indicates a resource error
 */
export function isResourceErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_RES_');
}

/**
 * Check if error code indicates a computation error
 */
export function isComputationErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_COMP_');
}

/**
 * Check if error code indicates a limit error
 */
export function isLimitErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_LIMIT_');
}

/**
 * Check if error code indicates a permission error
 */
export function isPermissionErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_PERM_');
}

/**
 * Check if error code indicates a cache error
 */
export function isCacheErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_CACHE_');
}

/**
 * Check if error code indicates an infrastructure error
 */
export function isInfrastructureErrorCode(code: string): boolean {
  return code.startsWith('GRAPH_DIFF_INFRA_');
}

/**
 * Check if error allows graceful degradation (non-fatal)
 */
export function allowsGracefulDegradation(error: unknown): boolean {
  if (!isGraphDiffError(error)) return false;

  // Cache errors allow degradation (fallback to computation)
  if (isCacheErrorCode(error.diffErrorCode)) return true;

  // Event errors are non-blocking
  if (error.diffErrorCode === GraphDiffErrorCodes.EVENT_EMISSION_FAILED) return true;
  if (error.diffErrorCode === GraphDiffErrorCodes.EVENT_HANDLER_FAILED) return true;

  return false;
}
