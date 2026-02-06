/**
 * Terragrunt Edge Error Classes
 * @module parsers/terragrunt/errors/edge-errors
 *
 * Comprehensive error class hierarchy for Terragrunt edge creation.
 * Provides structured errors for edge factory, TF linker, and edge service.
 *
 * TASK-TG-008: Error handling for edge factory and TF linker
 */

import {
  TerragruntErrorCode,
  TerragruntErrorCodeType,
  TerragruntErrorSeverity,
  TerragruntErrorMessage,
  TerragruntErrorSeverityMap,
  TerragruntErrorSuggestion,
  TerragruntErrorRecoverable,
} from './error-codes';
import {
  TerragruntParseError,
  TerragruntErrorContext,
  SerializedTerragruntError,
} from './errors';

// ============================================================================
// Edge Error Context
// ============================================================================

/**
 * Additional context for edge errors
 */
export interface EdgeErrorContext extends TerragruntErrorContext {
  /** Source node ID */
  sourceNodeId?: string;
  /** Target node ID */
  targetNodeId?: string;
  /** Edge type being created */
  edgeType?: string;
  /** Field that failed validation */
  field?: string;
  /** Expected value or type */
  expected?: string;
  /** Actual value or type */
  actual?: string;
  /** Source expression being resolved */
  sourceExpression?: string;
  /** Source type (local, git, registry, etc.) */
  sourceType?: string;
}

/**
 * Serialized edge error format
 */
export interface SerializedEdgeError extends SerializedTerragruntError {
  sourceNodeId?: string;
  targetNodeId?: string;
  edgeType?: string;
  field?: string;
}

// ============================================================================
// Base Edge Error Class
// ============================================================================

/**
 * Base error class for all Terragrunt edge errors.
 *
 * Features:
 * - Edge-specific context (source/target IDs, edge type)
 * - Specialized factory methods for common error cases
 * - Graceful degradation support
 *
 * @example
 * ```typescript
 * const error = new TerragruntEdgeError(
 *   'Invalid edge options',
 *   TerragruntErrorCode.EDGE_INVALID_OPTIONS,
 *   { sourceNodeId: 'node-1', targetNodeId: 'node-2' }
 * );
 * ```
 */
export class TerragruntEdgeError extends TerragruntParseError {
  /** Source node ID if available */
  public readonly sourceNodeId: string | undefined;
  /** Target node ID if available */
  public readonly targetNodeId: string | undefined;
  /** Edge type if available */
  public readonly edgeType: string | undefined;
  /** Field that failed validation */
  public readonly field: string | undefined;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.EDGE_ERROR,
    context: EdgeErrorContext = {}
  ) {
    super(message, code, context);
    this.name = 'TerragruntEdgeError';
    this.sourceNodeId = context.sourceNodeId;
    this.targetNodeId = context.targetNodeId;
    this.edgeType = context.edgeType;
    this.field = context.field;
  }

  /**
   * Serialize to JSON with edge-specific fields
   */
  override toJSON(): SerializedEdgeError {
    return {
      ...super.toJSON(),
      sourceNodeId: this.sourceNodeId,
      targetNodeId: this.targetNodeId,
      edgeType: this.edgeType,
      field: this.field,
    };
  }

  /**
   * Create a new error with updated context
   */
  override withContext(additionalContext: Partial<EdgeErrorContext>): TerragruntEdgeError {
    return new TerragruntEdgeError(
      this.message,
      this.code,
      { ...this.context, ...additionalContext } as EdgeErrorContext
    );
  }

  // ============================================================================
  // Static Factory Methods - Edge Options Validation
  // ============================================================================

  /**
   * Create error for missing required field
   */
  static missingField(
    field: string,
    edgeType: string,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `Edge options must include a valid ${field} for ${edgeType}`,
      TerragruntErrorCode.EDGE_INVALID_OPTIONS,
      {
        ...context,
        field,
        edgeType,
        details: { missingField: field },
      }
    );
  }

  /**
   * Create error for invalid field value
   */
  static invalidFieldValue(
    field: string,
    expected: string,
    actual: string,
    edgeType: string,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `Invalid value for ${field} in ${edgeType}: expected ${expected}, got ${actual}`,
      TerragruntErrorCode.EDGE_INVALID_OPTIONS,
      {
        ...context,
        field,
        edgeType,
        expected,
        actual,
        details: { field, expected, actual },
      }
    );
  }

  /**
   * Create error for self-referential edge
   */
  static selfReferential(
    nodeId: string,
    edgeType: string,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `sourceNodeId and targetNodeId must be different for ${edgeType}`,
      TerragruntErrorCode.EDGE_SELF_REFERENTIAL,
      {
        ...context,
        sourceNodeId: nodeId,
        targetNodeId: nodeId,
        edgeType,
        details: { nodeId, edgeType },
      }
    );
  }

  /**
   * Create error for invalid evidence
   */
  static invalidEvidence(
    message: string,
    edgeType: string,
    index?: number,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      index !== undefined
        ? `Evidence[${index}] for ${edgeType}: ${message}`
        : `Evidence for ${edgeType}: ${message}`,
      TerragruntErrorCode.EDGE_INVALID_EVIDENCE,
      {
        ...context,
        edgeType,
        field: 'evidence',
        details: { message, index },
      }
    );
  }

  /**
   * Create error for invalid confidence score
   */
  static invalidConfidence(
    value: number,
    edgeType: string,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `Confidence score ${value} is out of range [0-100] for ${edgeType}`,
      TerragruntErrorCode.EDGE_INVALID_CONFIDENCE,
      {
        ...context,
        edgeType,
        field: 'confidence',
        expected: '0-100',
        actual: String(value),
        details: { value },
      }
    );
  }

  /**
   * Create error for edge creation failure
   */
  static creationFailed(
    edgeType: string,
    reason: string,
    cause?: Error,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `Failed to create ${edgeType} edge: ${reason}`,
      TerragruntErrorCode.EDGE_CREATION_FAILED,
      {
        ...context,
        edgeType,
        cause,
        details: { reason },
      }
    );
  }

  /**
   * Create error for node ID mapping failure
   */
  static nodeMappingFailed(
    path: string,
    edgeType: string,
    context?: Partial<EdgeErrorContext>
  ): TerragruntEdgeError {
    return new TerragruntEdgeError(
      `Failed to map node ID for path '${path}' in ${edgeType} edge`,
      TerragruntErrorCode.EDGE_NODE_MAPPING_FAILED,
      {
        ...context,
        edgeType,
        resolutionPath: path,
        details: { path },
      }
    );
  }
}

// ============================================================================
// Source Resolution Errors
// ============================================================================

/**
 * Error context for source resolution errors
 */
export interface SourceErrorContext extends EdgeErrorContext {
  /** Raw source expression */
  sourceExpression?: string;
  /** Detected source type */
  sourceType?: string;
  /** Config path being resolved from */
  configPath?: string;
  /** Repository root path */
  repositoryRoot?: string;
  /** Resolved local path (if applicable) */
  resolvedPath?: string;
}

/**
 * Error class for TF source resolution errors.
 *
 * Captures source-specific context for debugging resolution failures.
 *
 * @example
 * ```typescript
 * const error = SourceResolutionError.unresolvable(
 *   '../modules/missing',
 *   'local',
 *   { configPath: '/repo/env/dev/terragrunt.hcl' }
 * );
 * ```
 */
export class SourceResolutionError extends TerragruntParseError {
  /** Raw source expression */
  public readonly sourceExpression: string | undefined;
  /** Detected source type */
  public readonly sourceType: string | undefined;
  /** Config path being resolved from */
  public readonly configPath: string | undefined;
  /** Resolved path if available */
  public readonly resolvedPath: string | undefined;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.SRC_ERROR,
    context: SourceErrorContext = {}
  ) {
    super(message, code, context);
    this.name = 'SourceResolutionError';
    this.sourceExpression = context.sourceExpression;
    this.sourceType = context.sourceType;
    this.configPath = context.configPath;
    this.resolvedPath = context.resolvedPath;
  }

  /**
   * Serialize to JSON with source-specific fields
   */
  override toJSON(): SerializedTerragruntError & {
    sourceExpression?: string;
    sourceType?: string;
    configPath?: string;
  } {
    return {
      ...super.toJSON(),
      sourceExpression: this.sourceExpression,
      sourceType: this.sourceType,
      configPath: this.configPath,
    };
  }

  /**
   * Create a new error with updated context
   */
  override withContext(additionalContext: Partial<SourceErrorContext>): SourceResolutionError {
    return new SourceResolutionError(
      this.message,
      this.code,
      { ...this.context, ...additionalContext } as SourceErrorContext
    );
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  /**
   * Create error for unresolvable source expression
   */
  static unresolvable(
    sourceExpression: string,
    sourceType: string,
    reason?: string,
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    const message = reason
      ? `Cannot resolve ${sourceType} source '${sourceExpression}': ${reason}`
      : `Cannot resolve ${sourceType} source '${sourceExpression}'`;

    return new SourceResolutionError(
      message,
      TerragruntErrorCode.SRC_UNRESOLVABLE,
      {
        ...context,
        sourceExpression,
        sourceType,
        details: { reason },
      }
    );
  }

  /**
   * Create error for invalid source pattern
   */
  static invalidPattern(
    sourceExpression: string,
    reason: string,
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    return new SourceResolutionError(
      `Invalid source pattern '${sourceExpression}': ${reason}`,
      TerragruntErrorCode.SRC_INVALID_PATTERN,
      {
        ...context,
        sourceExpression,
        sourceType: 'unknown',
        details: { reason },
      }
    );
  }

  /**
   * Create error for missing linker context
   */
  static missingContext(
    missingField: string,
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    return new SourceResolutionError(
      `Linker context must include a valid ${missingField}`,
      TerragruntErrorCode.SRC_MISSING_CONTEXT,
      {
        ...context,
        field: missingField,
        details: { missingField },
      }
    );
  }

  /**
   * Create error for circular source reference
   */
  static circular(
    sourceExpression: string,
    chain: string[],
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    const chainStr = chain.join(' -> ') + ' -> ' + sourceExpression;
    return new SourceResolutionError(
      `Circular source reference detected: ${chainStr}`,
      TerragruntErrorCode.SRC_CIRCULAR_REFERENCE,
      {
        ...context,
        sourceExpression,
        details: { referenceChain: chain },
      }
    );
  }

  /**
   * Create error for local path not found
   */
  static localNotFound(
    sourceExpression: string,
    resolvedPath: string,
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    return new SourceResolutionError(
      `Local source path not found: '${resolvedPath}' (from '${sourceExpression}')`,
      TerragruntErrorCode.SRC_LOCAL_NOT_FOUND,
      {
        ...context,
        sourceExpression,
        sourceType: 'local',
        resolvedPath,
        details: { resolvedPath },
      }
    );
  }

  /**
   * Create error for invalid linker options
   */
  static invalidOptions(
    field: string,
    reason: string,
    context?: Partial<SourceErrorContext>
  ): SourceResolutionError {
    return new SourceResolutionError(
      `Invalid linker options: ${field} - ${reason}`,
      TerragruntErrorCode.SRC_INVALID_OPTIONS,
      {
        ...context,
        field,
        details: { field, reason },
      }
    );
  }
}

// ============================================================================
// Edge Service Errors
// ============================================================================

/**
 * Context for batch edge creation errors
 */
export interface BatchEdgeErrorContext extends EdgeErrorContext {
  /** Number of successful edges */
  successCount?: number;
  /** Number of failed edges */
  errorCount?: number;
  /** Individual error details */
  errors?: readonly EdgeErrorSummary[];
}

/**
 * Summary of an individual edge error
 */
export interface EdgeErrorSummary {
  /** Edge type that failed */
  edgeType: string;
  /** Source node ID */
  sourceNodeId: string;
  /** Target node ID (if known) */
  targetNodeId?: string;
  /** Error code */
  code: string;
  /** Error message */
  message: string;
}

/**
 * Error class for batch edge creation operations.
 *
 * Aggregates multiple edge creation errors while allowing pipeline to continue.
 *
 * @example
 * ```typescript
 * const error = BatchEdgeError.fromResults(
 *   10,  // total attempted
 *   8,   // successful
 *   [error1, error2]  // individual errors
 * );
 * ```
 */
export class BatchEdgeError extends TerragruntParseError {
  /** Number of successful edges */
  public readonly successCount: number;
  /** Number of failed edges */
  public readonly errorCount: number;
  /** Individual error summaries */
  public readonly errors: readonly EdgeErrorSummary[];

  constructor(
    message: string,
    context: BatchEdgeErrorContext = {}
  ) {
    super(message, TerragruntErrorCode.EDGE_BATCH_ERRORS, context);
    this.name = 'BatchEdgeError';
    this.successCount = context.successCount ?? 0;
    this.errorCount = context.errorCount ?? 0;
    this.errors = context.errors ?? [];
  }

  /**
   * Serialize to JSON with batch-specific fields
   */
  override toJSON(): SerializedTerragruntError & {
    successCount: number;
    errorCount: number;
    errors: readonly EdgeErrorSummary[];
  } {
    return {
      ...super.toJSON(),
      successCount: this.successCount,
      errorCount: this.errorCount,
      errors: this.errors,
    };
  }

  /**
   * Create from individual edge errors
   */
  static fromErrors(
    totalAttempted: number,
    successCount: number,
    errors: TerragruntEdgeError[]
  ): BatchEdgeError {
    const errorSummaries: EdgeErrorSummary[] = errors.map(e => ({
      edgeType: e.edgeType ?? 'unknown',
      sourceNodeId: e.sourceNodeId ?? 'unknown',
      targetNodeId: e.targetNodeId,
      code: e.code,
      message: e.message,
    }));

    return new BatchEdgeError(
      `Batch edge creation completed with ${errors.length} errors out of ${totalAttempted} edges`,
      {
        successCount,
        errorCount: errors.length,
        errors: errorSummaries,
        details: {
          totalAttempted,
          successCount,
          errorCount: errors.length,
        },
      }
    );
  }

  /**
   * Check if batch had any failures
   */
  hasErrors(): boolean {
    return this.errorCount > 0;
  }

  /**
   * Get success rate as percentage
   */
  getSuccessRate(): number {
    const total = this.successCount + this.errorCount;
    if (total === 0) return 100;
    return Math.round((this.successCount / total) * 100);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a TerragruntEdgeError
 */
export function isTerragruntEdgeError(error: unknown): error is TerragruntEdgeError {
  return error instanceof TerragruntEdgeError;
}

/**
 * Check if an error is a SourceResolutionError
 */
export function isSourceResolutionError(error: unknown): error is SourceResolutionError {
  return error instanceof SourceResolutionError;
}

/**
 * Check if an error is a BatchEdgeError
 */
export function isBatchEdgeError(error: unknown): error is BatchEdgeError {
  return error instanceof BatchEdgeError;
}

/**
 * Check if error code is an edge-related error
 */
export function isEdgeErrorCode(code: string): boolean {
  return code.startsWith('TG_EDGE_') || code.startsWith('TG_SRC_');
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Wrap an unknown error into a TerragruntEdgeError
 */
export function wrapEdgeError(
  error: unknown,
  edgeType: string,
  context?: Partial<EdgeErrorContext>
): TerragruntEdgeError {
  if (error instanceof TerragruntEdgeError) {
    return context ? error.withContext(context) : error;
  }

  if (error instanceof SourceResolutionError) {
    return TerragruntEdgeError.creationFailed(
      edgeType,
      error.message,
      error,
      context
    );
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return TerragruntEdgeError.creationFailed(edgeType, message, cause, context);
}

/**
 * Wrap an unknown error into a SourceResolutionError
 */
export function wrapSourceError(
  error: unknown,
  sourceExpression: string,
  context?: Partial<SourceErrorContext>
): SourceResolutionError {
  if (error instanceof SourceResolutionError) {
    return context ? error.withContext(context) : error;
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return SourceResolutionError.unresolvable(
    sourceExpression,
    context?.sourceType ?? 'unknown',
    message,
    { ...context, cause }
  );
}

// ============================================================================
// Validation Helpers
// ============================================================================

/**
 * Validate edge options and return errors (does not throw)
 */
export function validateEdgeOptions(
  options: {
    sourceNodeId?: string;
    targetNodeId?: string;
    evidence?: unknown;
  },
  edgeType: string
): TerragruntEdgeError[] {
  const errors: TerragruntEdgeError[] = [];

  // Validate source node ID
  if (!options.sourceNodeId || typeof options.sourceNodeId !== 'string') {
    errors.push(TerragruntEdgeError.missingField('sourceNodeId', edgeType));
  }

  // Validate target node ID
  if (!options.targetNodeId || typeof options.targetNodeId !== 'string') {
    errors.push(TerragruntEdgeError.missingField('targetNodeId', edgeType));
  }

  // Check for self-referential edge
  if (
    options.sourceNodeId &&
    options.targetNodeId &&
    options.sourceNodeId === options.targetNodeId
  ) {
    errors.push(TerragruntEdgeError.selfReferential(options.sourceNodeId, edgeType));
  }

  // Validate evidence array
  if (options.evidence !== undefined) {
    if (!Array.isArray(options.evidence)) {
      errors.push(TerragruntEdgeError.invalidEvidence('must be an array', edgeType));
    } else {
      options.evidence.forEach((e: unknown, index: number) => {
        if (!e || typeof e !== 'object') {
          errors.push(TerragruntEdgeError.invalidEvidence('invalid evidence item', edgeType, index));
          return;
        }

        const evidence = e as Record<string, unknown>;

        if (typeof evidence.confidence === 'number') {
          if (evidence.confidence < 0 || evidence.confidence > 100) {
            errors.push(
              TerragruntEdgeError.invalidConfidence(
                evidence.confidence as number,
                edgeType,
                { field: `evidence[${index}].confidence` }
              )
            );
          }
        }
      });
    }
  }

  return errors;
}

/**
 * Validate linker context and return errors (does not throw)
 */
export function validateLinkerContext(
  context: {
    scanId?: string;
    tenantId?: string;
    configPath?: string;
    repositoryRoot?: string;
    existingTfModules?: unknown;
  }
): SourceResolutionError[] {
  const errors: SourceResolutionError[] = [];

  if (!context.scanId || typeof context.scanId !== 'string') {
    errors.push(SourceResolutionError.missingContext('scanId'));
  }

  if (!context.tenantId || typeof context.tenantId !== 'string') {
    errors.push(SourceResolutionError.missingContext('tenantId'));
  }

  if (!context.configPath || typeof context.configPath !== 'string') {
    errors.push(SourceResolutionError.missingContext('configPath'));
  }

  if (!context.repositoryRoot || typeof context.repositoryRoot !== 'string') {
    errors.push(SourceResolutionError.missingContext('repositoryRoot'));
  }

  if (context.existingTfModules !== undefined && !(context.existingTfModules instanceof Map)) {
    errors.push(SourceResolutionError.invalidOptions(
      'existingTfModules',
      'must be a Map'
    ));
  }

  return errors;
}

// ============================================================================
// Recovery Support
// ============================================================================

/**
 * Edge error recovery result
 */
export interface EdgeRecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered/partial data if available */
  partialData?: unknown;
  /** Recovery action taken */
  action: 'skip' | 'default' | 'partial' | 'none';
  /** Error that was recovered from */
  error: TerragruntEdgeError | SourceResolutionError;
}

/**
 * Attempt to recover from an edge error
 */
export function attemptEdgeRecovery(
  error: TerragruntEdgeError | SourceResolutionError
): EdgeRecoveryResult {
  // All edge errors are recoverable by skipping the edge
  if (error.recoverable) {
    return {
      success: true,
      action: 'skip',
      error,
      partialData: {
        skipped: true,
        errorCode: error.code,
        reason: error.message,
      },
    };
  }

  return {
    success: false,
    action: 'none',
    error,
  };
}

/**
 * Check if edge creation can continue after this error
 */
export function canContinueAfterEdgeError(
  error: TerragruntEdgeError | SourceResolutionError
): boolean {
  // Fatal errors stop processing
  if (error.severity === TerragruntErrorSeverity.FATAL) {
    return false;
  }

  // Non-recoverable errors stop processing
  if (!error.recoverable) {
    return false;
  }

  // Missing context is a configuration error - stop
  if (error.code === TerragruntErrorCode.SRC_MISSING_CONTEXT) {
    return false;
  }

  // Invalid options is a programming error - stop
  if (error.code === TerragruntErrorCode.SRC_INVALID_OPTIONS) {
    return false;
  }

  // All other errors allow continuation (skip bad edge)
  return true;
}
