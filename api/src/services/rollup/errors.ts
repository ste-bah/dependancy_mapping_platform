/**
 * Rollup Error Classes
 * @module services/rollup/errors
 *
 * Domain-specific error classes for the Cross-Repository Aggregation (Rollup) system.
 * Provides a hierarchical error structure for different rollup failure scenarios.
 *
 * Enhanced with:
 * - Error context (cause, metadata)
 * - toJSON for serialization
 * - isRetryable flag
 * - Error chaining support
 * - Correlation ID support
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation error handling
 */

import { BaseError, ErrorContext } from '../../errors/base.js';
import { ErrorCode } from '../../errors/codes.js';
import {
  RollupErrorCode as ErrorCodeEnum,
  RollupErrorMessage,
  RollupErrorSeverity,
  RollupErrorSeverityMap,
  RollupErrorHttpStatus,
  RollupErrorRetryable,
  RollupErrorAction,
  RollupErrorCodeType,
} from './error-codes.js';

// ============================================================================
// Rollup Error Codes (extending existing error code patterns)
// ============================================================================

/**
 * Rollup-specific error codes
 * These extend the application's error code system for rollup operations.
 */
export const RollupErrorCodes = {
  // General rollup errors
  ROLLUP_ERROR: 'ROLLUP_ERROR',
  ROLLUP_NOT_FOUND: 'ROLLUP_NOT_FOUND',
  ROLLUP_ALREADY_EXISTS: 'ROLLUP_ALREADY_EXISTS',
  ROLLUP_INVALID_STATE: 'ROLLUP_INVALID_STATE',

  // Configuration errors
  ROLLUP_CONFIGURATION_ERROR: 'ROLLUP_CONFIGURATION_ERROR',
  ROLLUP_INVALID_MATCHER: 'ROLLUP_INVALID_MATCHER',
  ROLLUP_INVALID_MERGE_OPTIONS: 'ROLLUP_INVALID_MERGE_OPTIONS',

  // Execution errors
  ROLLUP_EXECUTION_ERROR: 'ROLLUP_EXECUTION_ERROR',
  ROLLUP_EXECUTION_NOT_FOUND: 'ROLLUP_EXECUTION_NOT_FOUND',
  ROLLUP_EXECUTION_TIMEOUT: 'ROLLUP_EXECUTION_TIMEOUT',
  ROLLUP_EXECUTION_IN_PROGRESS: 'ROLLUP_EXECUTION_IN_PROGRESS',

  // Merge errors
  ROLLUP_MERGE_ERROR: 'ROLLUP_MERGE_ERROR',
  ROLLUP_MERGE_CONFLICT: 'ROLLUP_MERGE_CONFLICT',
  ROLLUP_MERGE_VALIDATION_ERROR: 'ROLLUP_MERGE_VALIDATION_ERROR',

  // Blast radius errors
  ROLLUP_BLAST_RADIUS_ERROR: 'ROLLUP_BLAST_RADIUS_ERROR',
  ROLLUP_BLAST_RADIUS_EXCEEDED: 'ROLLUP_BLAST_RADIUS_EXCEEDED',
  ROLLUP_GRAPH_NOT_FOUND: 'ROLLUP_GRAPH_NOT_FOUND',

  // Resource errors
  ROLLUP_REPOSITORY_NOT_FOUND: 'ROLLUP_REPOSITORY_NOT_FOUND',
  ROLLUP_SCAN_NOT_FOUND: 'ROLLUP_SCAN_NOT_FOUND',
  ROLLUP_MAX_NODES_EXCEEDED: 'ROLLUP_MAX_NODES_EXCEEDED',
  ROLLUP_MAX_REPOSITORIES_EXCEEDED: 'ROLLUP_MAX_REPOSITORIES_EXCEEDED',

  // Permission errors
  ROLLUP_PERMISSION_DENIED: 'ROLLUP_PERMISSION_DENIED',
  ROLLUP_RATE_LIMITED: 'ROLLUP_RATE_LIMITED',
} as const;

export type RollupErrorCode = typeof RollupErrorCodes[keyof typeof RollupErrorCodes];

// Re-export error codes from error-codes module
export { ErrorCodeEnum as RollupErrorCodeEnum };
export type { RollupErrorCodeType };

// ============================================================================
// Enhanced Rollup Error Context
// ============================================================================

/**
 * Extended error context for rollup errors
 */
export interface RollupErrorContext extends ErrorContext {
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Rollup ID if applicable */
  rollupId?: string;
  /** Execution ID if applicable */
  executionId?: string;
  /** Tenant ID if applicable */
  tenantId?: string;
  /** Execution phase where error occurred */
  phase?: 'fetch' | 'match' | 'merge' | 'store' | 'callback';
  /** Partial results if available */
  partialResults?: {
    nodesProcessed?: number;
    matchesFound?: number;
    mergedNodes?: number;
  };
  /** Retry information */
  retryInfo?: {
    attempt: number;
    maxAttempts: number;
    lastAttemptAt?: Date;
    nextRetryAt?: Date;
  };
}

/**
 * Serialized rollup error format
 */
export interface SerializedRollupError {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  correlationId?: string;
  rollupId?: string;
  executionId?: string;
  phase?: string;
  isRetryable: boolean;
  severity: string;
  suggestedAction?: string;
  details?: Record<string, unknown>;
  cause?: string;
  stack?: string;
}

// ============================================================================
// Base Rollup Error
// ============================================================================

/**
 * Base error class for all rollup-related errors.
 * Provides consistent error handling for the rollup subsystem.
 *
 * Enhanced with:
 * - Correlation ID support for request tracing
 * - isRetryable flag for recovery strategies
 * - Severity level for alerting
 * - Error chaining support
 * - Comprehensive JSON serialization
 */
export class RollupError extends BaseError {
  /**
   * Rollup-specific context data
   */
  public readonly rollupContext: Record<string, unknown>;

  /**
   * Whether this error can be retried
   */
  public readonly isRetryable: boolean;

  /**
   * Error severity level
   */
  public readonly severity: RollupErrorSeverity;

  /**
   * Correlation ID for request tracing
   */
  public readonly correlationId?: string;

  /**
   * Suggested action for resolving the error
   */
  public readonly suggestedAction?: string;

  /**
   * Create a new RollupError
   * @param message - Human-readable error message
   * @param code - Error code
   * @param rollupContext - Additional rollup-specific context
   * @param context - Standard error context
   */
  constructor(
    message: string,
    code: ErrorCode = RollupErrorCodes.ROLLUP_ERROR,
    rollupContext: Record<string, unknown> = {},
    context: RollupErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'RollupError';
    this.rollupContext = rollupContext;
    this.correlationId = context.correlationId;

    // Determine retryability from error-codes module or context
    const errorCodeType = code as unknown as RollupErrorCodeType;
    this.isRetryable = RollupErrorRetryable[errorCodeType] ?? false;

    // Determine severity from error-codes module
    this.severity = RollupErrorSeverityMap[errorCodeType] ?? RollupErrorSeverity.ERROR;

    // Get suggested action from error-codes module
    this.suggestedAction = RollupErrorAction[errorCodeType];
  }

  /**
   * Serialize to JSON for API responses
   */
  toJSON(): SerializedRollupError {
    const baseJson = super.toJSON();
    return {
      ...baseJson,
      correlationId: this.correlationId,
      rollupId: this.rollupContext['rollupId'] as string | undefined,
      executionId: this.rollupContext['executionId'] as string | undefined,
      phase: this.rollupContext['phase'] as string | undefined,
      isRetryable: this.isRetryable,
      severity: this.severity,
      suggestedAction: this.suggestedAction,
      details: this.rollupContext,
      cause: this.cause instanceof Error ? this.cause.message : undefined,
    };
  }

  /**
   * Create a safe response object (no sensitive data)
   */
  toSafeResponse(includeStack = false): SerializedRollupError {
    const json = this.toJSON();

    // Remove potentially sensitive details
    const safeDetails = { ...json.details };
    delete safeDetails['internalError'];
    delete safeDetails['stackTrace'];
    delete safeDetails['query'];

    return {
      ...json,
      details: Object.keys(safeDetails).length > 0 ? safeDetails : undefined,
      stack: includeStack ? this.stack : undefined,
    };
  }

  /**
   * Create a new error with correlation ID
   */
  withCorrelationId(correlationId: string): RollupError {
    return new RollupError(
      this.message,
      this.code,
      this.rollupContext,
      { ...this.context, correlationId }
    );
  }

  /**
   * Create a new error with additional context
   */
  withRollupContext(additionalContext: Record<string, unknown>): RollupError {
    return new RollupError(
      this.message,
      this.code,
      { ...this.rollupContext, ...additionalContext },
      this.context as RollupErrorContext
    );
  }

  /**
   * Create a new error with a cause
   */
  withCause(cause: Error): RollupError {
    return new RollupError(
      this.message,
      this.code,
      this.rollupContext,
      { ...this.context, cause }
    );
  }

  /**
   * Get the error chain as an array
   */
  getErrorChain(): Error[] {
    const chain: Error[] = [this];
    let current: Error = this;
    while (current.cause instanceof Error) {
      chain.push(current.cause);
      current = current.cause;
    }
    return chain;
  }

  /**
   * Get the root cause of the error
   */
  getRootCause(): Error {
    let current: Error = this;
    while (current.cause instanceof Error) {
      current = current.cause;
    }
    return current;
  }

  /**
   * String representation for logging
   */
  toString(): string {
    const parts = [`${this.name} [${this.code}]: ${this.message}`];
    if (this.correlationId) {
      parts.push(`(correlationId: ${this.correlationId})`);
    }
    if (this.rollupContext['rollupId']) {
      parts.push(`(rollupId: ${this.rollupContext['rollupId']})`);
    }
    return parts.join(' ');
  }
}

// ============================================================================
// Configuration Errors
// ============================================================================

/**
 * Error thrown when rollup configuration is invalid.
 */
export class RollupConfigurationError extends RollupError {
  /**
   * Validation errors that caused the failure
   */
  public readonly validationErrors: Array<{
    field: string;
    message: string;
    code: string;
  }>;

  constructor(
    message: string,
    validationErrors: Array<{ field: string; message: string; code: string }> = [],
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      RollupErrorCodes.ROLLUP_CONFIGURATION_ERROR,
      rollupContext,
      context
    );
    this.name = 'RollupConfigurationError';
    this.validationErrors = validationErrors;
  }

  /**
   * Create from validation result
   */
  static fromValidationErrors(
    errors: Array<{ field: string; message: string; code: string }>,
    rollupId?: string
  ): RollupConfigurationError {
    const message =
      errors.length === 1
        ? `Configuration error: ${errors[0].message}`
        : `Configuration has ${errors.length} errors`;

    return new RollupConfigurationError(
      message,
      errors,
      rollupId ? { rollupId } : {}
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

// ============================================================================
// Not Found Errors
// ============================================================================

/**
 * Error thrown when a rollup configuration is not found.
 */
export class RollupNotFoundError extends RollupError {
  /**
   * The rollup ID that was not found
   */
  public readonly rollupId: string;

  constructor(
    rollupId: string,
    context: ErrorContext = {}
  ) {
    super(
      `Rollup not found: ${rollupId}`,
      RollupErrorCodes.ROLLUP_NOT_FOUND,
      { rollupId },
      context
    );
    this.name = 'RollupNotFoundError';
    this.rollupId = rollupId;
  }
}

/**
 * Error thrown when an execution is not found.
 */
export class RollupExecutionNotFoundError extends RollupError {
  /**
   * The execution ID that was not found
   */
  public readonly executionId: string;

  constructor(
    executionId: string,
    rollupId?: string,
    context: ErrorContext = {}
  ) {
    super(
      `Rollup execution not found: ${executionId}`,
      RollupErrorCodes.ROLLUP_EXECUTION_NOT_FOUND,
      { executionId, rollupId },
      context
    );
    this.name = 'RollupExecutionNotFoundError';
    this.executionId = executionId;
  }
}

// ============================================================================
// Execution Errors
// ============================================================================

/**
 * Error thrown during rollup execution.
 */
export class RollupExecutionError extends RollupError {
  /**
   * The execution ID if available
   */
  public readonly executionId?: string;

  /**
   * The phase where execution failed
   */
  public readonly phase: string;

  /**
   * Partial results if any
   */
  public readonly partialResults?: {
    nodesProcessed: number;
    matchesFound: number;
  };

  constructor(
    message: string,
    phase: string,
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      RollupErrorCodes.ROLLUP_EXECUTION_ERROR,
      rollupContext,
      context
    );
    this.name = 'RollupExecutionError';
    this.executionId = rollupContext['executionId'] as string | undefined;
    this.phase = phase;
    this.partialResults = rollupContext['partialResults'] as
      | { nodesProcessed: number; matchesFound: number }
      | undefined;
  }

  /**
   * Create a timeout error
   */
  static timeout(
    executionId: string,
    timeoutMs: number,
    phase: string
  ): RollupExecutionError {
    return new RollupExecutionError(
      `Rollup execution timed out after ${timeoutMs}ms during ${phase}`,
      phase,
      { executionId, timeoutMs }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      phase: this.phase,
      partialResults: this.partialResults,
    };
  }
}

// ============================================================================
// Merge Errors
// ============================================================================

/**
 * Error thrown during node merge operations.
 */
export class RollupMergeError extends RollupError {
  /**
   * Nodes involved in the merge conflict
   */
  public readonly nodeIds?: string[];

  /**
   * Conflict details if applicable
   */
  public readonly conflicts?: Array<{
    attribute: string;
    values: unknown[];
  }>;

  constructor(
    message: string,
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      RollupErrorCodes.ROLLUP_MERGE_ERROR,
      rollupContext,
      context
    );
    this.name = 'RollupMergeError';
    this.nodeIds = rollupContext['nodeIds'] as string[] | undefined;
    this.conflicts = rollupContext['conflicts'] as
      | Array<{ attribute: string; values: unknown[] }>
      | undefined;
  }

  /**
   * Create a conflict error
   */
  static conflict(
    nodeIds: string[],
    conflicts: Array<{ attribute: string; values: unknown[] }>
  ): RollupMergeError {
    const conflictAttrs = conflicts.map((c) => c.attribute).join(', ');
    return new RollupMergeError(
      `Merge conflict on attributes: ${conflictAttrs}`,
      { nodeIds, conflicts }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      nodeIds: this.nodeIds,
      conflicts: this.conflicts,
    };
  }
}

// ============================================================================
// Blast Radius Errors
// ============================================================================

/**
 * Error thrown during blast radius analysis.
 */
export class RollupBlastRadiusError extends RollupError {
  /**
   * The execution ID being analyzed
   */
  public readonly executionId?: string;

  /**
   * Node that triggered the error
   */
  public readonly nodeId?: string;

  constructor(
    message: string,
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    super(
      message,
      RollupErrorCodes.ROLLUP_BLAST_RADIUS_ERROR,
      rollupContext,
      context
    );
    this.name = 'RollupBlastRadiusError';
    this.executionId = rollupContext['executionId'] as string | undefined;
    this.nodeId = rollupContext['nodeId'] as string | undefined;
  }
}

/**
 * Error thrown when blast radius exceeds configured limits.
 */
export class RollupBlastRadiusExceededError extends RollupError {
  /**
   * Number of impacted nodes
   */
  public readonly impactedCount: number;

  /**
   * Maximum allowed impact
   */
  public readonly maxAllowed: number;

  constructor(
    impactedCount: number,
    maxAllowed: number,
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    super(
      `Blast radius exceeded: ${impactedCount} nodes impacted (max: ${maxAllowed})`,
      RollupErrorCodes.ROLLUP_BLAST_RADIUS_EXCEEDED,
      { ...rollupContext, impactedCount, maxAllowed },
      context
    );
    this.name = 'RollupBlastRadiusExceededError';
    this.impactedCount = impactedCount;
    this.maxAllowed = maxAllowed;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      impactedCount: this.impactedCount,
      maxAllowed: this.maxAllowed,
    };
  }
}

// ============================================================================
// Resource Limit Errors
// ============================================================================

/**
 * Error thrown when rollup exceeds resource limits.
 */
export class RollupLimitExceededError extends RollupError {
  /**
   * Type of limit exceeded
   */
  public readonly limitType: 'nodes' | 'repositories' | 'matchers';

  /**
   * Current count
   */
  public readonly current: number;

  /**
   * Maximum allowed
   */
  public readonly maximum: number;

  constructor(
    limitType: 'nodes' | 'repositories' | 'matchers',
    current: number,
    maximum: number,
    rollupContext: Record<string, unknown> = {},
    context: ErrorContext = {}
  ) {
    const code =
      limitType === 'nodes'
        ? RollupErrorCodes.ROLLUP_MAX_NODES_EXCEEDED
        : RollupErrorCodes.ROLLUP_MAX_REPOSITORIES_EXCEEDED;

    super(
      `Rollup limit exceeded: ${current} ${limitType} (max: ${maximum})`,
      code,
      { ...rollupContext, limitType, current, maximum },
      context
    );
    this.name = 'RollupLimitExceededError';
    this.limitType = limitType;
    this.current = current;
    this.maximum = maximum;
  }

  toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      limitType: this.limitType,
      current: this.current,
      maximum: this.maximum,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a RollupError
 */
export function isRollupError(error: unknown): error is RollupError {
  return error instanceof RollupError;
}

/**
 * Check if an error is a RollupNotFoundError
 */
export function isRollupNotFoundError(error: unknown): error is RollupNotFoundError {
  return error instanceof RollupNotFoundError;
}

/**
 * Check if an error is a RollupConfigurationError
 */
export function isRollupConfigurationError(
  error: unknown
): error is RollupConfigurationError {
  return error instanceof RollupConfigurationError;
}

/**
 * Check if an error is a RollupMergeError
 */
export function isRollupMergeError(error: unknown): error is RollupMergeError {
  return error instanceof RollupMergeError;
}

/**
 * Check if an error is a RollupExecutionError
 */
export function isRollupExecutionError(error: unknown): error is RollupExecutionError {
  return error instanceof RollupExecutionError;
}

/**
 * Check if an error is a RollupBlastRadiusError
 */
export function isRollupBlastRadiusError(
  error: unknown
): error is RollupBlastRadiusError {
  return error instanceof RollupBlastRadiusError;
}

/**
 * Check if an error is retryable
 */
export function isRetryableRollupError(error: unknown): boolean {
  if (!isRollupError(error)) {
    return false;
  }

  // Use the isRetryable flag from the error instance
  if (error instanceof RollupError) {
    return error.isRetryable;
  }

  // Legacy check for error codes
  // Timeout errors can be retried
  if (error.code === RollupErrorCodes.ROLLUP_EXECUTION_TIMEOUT) {
    return true;
  }

  // Rate limited errors can be retried
  if (error.code === RollupErrorCodes.ROLLUP_RATE_LIMITED) {
    return true;
  }

  return false;
}

// ============================================================================
// Error Aggregation (for batch operations)
// ============================================================================

/**
 * Aggregated error for batch operations
 */
export class RollupAggregateError extends RollupError {
  /**
   * Individual errors that were aggregated
   */
  public readonly errors: Error[];

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
    errors: Error[],
    successCount: number,
    totalCount: number,
    rollupContext: Record<string, unknown> = {}
  ) {
    super(
      message,
      RollupErrorCodes.ROLLUP_ERROR,
      {
        ...rollupContext,
        errorCount: errors.length,
        successCount,
        totalCount,
      }
    );
    this.name = 'RollupAggregateError';
    this.errors = errors;
    this.successCount = successCount;
    this.totalCount = totalCount;
  }

  /**
   * Create from an array of results (errors and successes)
   */
  static fromResults<T>(
    results: Array<{ success: boolean; value?: T; error?: Error }>,
    rollupId?: string
  ): RollupAggregateError | null {
    const errors = results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error!);

    if (errors.length === 0) {
      return null;
    }

    const successCount = results.filter((r) => r.success).length;
    const message =
      errors.length === 1
        ? `Operation failed: ${errors[0].message}`
        : `${errors.length} operations failed out of ${results.length}`;

    return new RollupAggregateError(
      message,
      errors,
      successCount,
      results.length,
      rollupId ? { rollupId } : {}
    );
  }

  toJSON(): SerializedRollupError {
    return {
      ...super.toJSON(),
      details: {
        ...this.rollupContext,
        errorMessages: this.errors.map((e) => e.message),
        successCount: this.successCount,
        totalCount: this.totalCount,
        failureRate: ((this.errors.length / this.totalCount) * 100).toFixed(1) + '%',
      },
    };
  }
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a rollup error with correlation ID
 */
export function createRollupError(
  code: RollupErrorCode,
  message: string,
  context?: {
    correlationId?: string;
    rollupId?: string;
    executionId?: string;
    tenantId?: string;
    cause?: Error;
    details?: Record<string, unknown>;
  }
): RollupError {
  return new RollupError(
    message,
    code,
    {
      rollupId: context?.rollupId,
      executionId: context?.executionId,
      tenantId: context?.tenantId,
      ...context?.details,
    },
    {
      correlationId: context?.correlationId,
      cause: context?.cause,
    }
  );
}

/**
 * Wrap an unknown error as a RollupError
 */
export function wrapAsRollupError(
  error: unknown,
  defaultCode: RollupErrorCode = RollupErrorCodes.ROLLUP_ERROR,
  context?: {
    correlationId?: string;
    rollupId?: string;
    executionId?: string;
    phase?: string;
  }
): RollupError {
  if (error instanceof RollupError) {
    // Enhance with additional context if provided
    if (context?.correlationId && !error.correlationId) {
      return error.withCorrelationId(context.correlationId);
    }
    return error;
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return new RollupError(
    message,
    defaultCode,
    {
      rollupId: context?.rollupId,
      executionId: context?.executionId,
      phase: context?.phase,
      originalError: cause.name,
    },
    {
      correlationId: context?.correlationId,
      cause,
    }
  );
}
