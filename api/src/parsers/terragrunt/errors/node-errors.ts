/**
 * Terragrunt Node Creation Error Handling
 * @module parsers/terragrunt/errors/node-errors
 *
 * Error handling for Terragrunt node parsing and creation workflows:
 * - Node creation error codes
 * - Node persistence error classes
 * - Error recovery helpers for partial nodes
 * - Node validation utilities
 *
 * TASK-TG-026: Error handling for node persistence layer
 */

import * as path from 'path';
import { TerragruntConfigNode, NodeLocation } from '../../../types/graph';
import { TerragruntFile, TerragruntNodeMetadata } from '../types';
import {
  TerragruntParseError,
  TerragruntErrorContext,
  SerializedTerragruntError,
} from './errors';
import { TerragruntErrorSeverity } from './error-codes';

// ============================================================================
// Node Creation Error Codes
// ============================================================================

/**
 * Error codes specific to Terragrunt node creation and persistence.
 * Format: TG_NODE_<CATEGORY>_<SPECIFIC_ERROR>
 */
export const TerragruntNodeErrorCode = {
  // =========================================================================
  // Node Metadata Errors (TG_NODE_META_*)
  // =========================================================================
  /** Invalid node metadata */
  META_INVALID: 'TG_NODE_META_INVALID',
  /** Missing required node ID */
  META_MISSING_ID: 'TG_NODE_META_MISSING_ID',
  /** Missing required node path */
  META_MISSING_PATH: 'TG_NODE_META_MISSING_PATH',
  /** Missing required node name */
  META_MISSING_NAME: 'TG_NODE_META_MISSING_NAME',
  /** Invalid node type */
  META_INVALID_TYPE: 'TG_NODE_META_INVALID_TYPE',
  /** Invalid node location */
  META_INVALID_LOCATION: 'TG_NODE_META_INVALID_LOCATION',
  /** Metadata serialization error */
  META_SERIALIZATION_ERROR: 'TG_NODE_META_SERIALIZATION_ERROR',

  // =========================================================================
  // Terraform Source Errors (TG_NODE_SRC_*)
  // =========================================================================
  /** Missing terraform source */
  SRC_MISSING: 'TG_NODE_SRC_MISSING',
  /** Invalid terraform source format */
  SRC_INVALID_FORMAT: 'TG_NODE_SRC_INVALID_FORMAT',
  /** Unresolved terraform source */
  SRC_UNRESOLVED: 'TG_NODE_SRC_UNRESOLVED',
  /** Terraform source not accessible */
  SRC_NOT_ACCESSIBLE: 'TG_NODE_SRC_NOT_ACCESSIBLE',

  // =========================================================================
  // Remote State Errors (TG_NODE_RS_*)
  // =========================================================================
  /** Invalid remote state configuration */
  RS_INVALID: 'TG_NODE_RS_INVALID',
  /** Missing remote state backend */
  RS_MISSING_BACKEND: 'TG_NODE_RS_MISSING_BACKEND',
  /** Invalid remote state backend type */
  RS_INVALID_BACKEND: 'TG_NODE_RS_INVALID_BACKEND',
  /** Remote state config generation failed */
  RS_CONFIG_ERROR: 'TG_NODE_RS_CONFIG_ERROR',

  // =========================================================================
  // Repository/Persistence Errors (TG_NODE_DB_*)
  // =========================================================================
  /** Node insertion failed */
  DB_INSERT_FAILED: 'TG_NODE_DB_INSERT_FAILED',
  /** Node not found in database */
  DB_NOT_FOUND: 'TG_NODE_DB_NOT_FOUND',
  /** Batch node insertion failed */
  DB_BATCH_INSERT_FAILED: 'TG_NODE_DB_BATCH_INSERT_FAILED',
  /** Node update failed */
  DB_UPDATE_FAILED: 'TG_NODE_DB_UPDATE_FAILED',
  /** Node deletion failed */
  DB_DELETE_FAILED: 'TG_NODE_DB_DELETE_FAILED',
  /** Duplicate node error */
  DB_DUPLICATE_NODE: 'TG_NODE_DB_DUPLICATE_NODE',
  /** Database constraint violation */
  DB_CONSTRAINT_VIOLATION: 'TG_NODE_DB_CONSTRAINT_VIOLATION',
  /** Transaction error during node operations */
  DB_TRANSACTION_ERROR: 'TG_NODE_DB_TRANSACTION_ERROR',

  // =========================================================================
  // Node Conversion Errors (TG_NODE_CONV_*)
  // =========================================================================
  /** File to node conversion failed */
  CONV_FILE_TO_NODE_FAILED: 'TG_NODE_CONV_FILE_TO_NODE_FAILED',
  /** Node to input conversion failed */
  CONV_NODE_TO_INPUT_FAILED: 'TG_NODE_CONV_NODE_TO_INPUT_FAILED',
  /** Row to node conversion failed */
  CONV_ROW_TO_NODE_FAILED: 'TG_NODE_CONV_ROW_TO_NODE_FAILED',
  /** Metadata extraction failed */
  CONV_METADATA_EXTRACTION_FAILED: 'TG_NODE_CONV_METADATA_EXTRACTION_FAILED',

  // =========================================================================
  // Node Validation Errors (TG_NODE_VAL_*)
  // =========================================================================
  /** General node validation error */
  VAL_ERROR: 'TG_NODE_VAL_ERROR',
  /** Node failed pre-insertion validation */
  VAL_PRE_INSERT_FAILED: 'TG_NODE_VAL_PRE_INSERT_FAILED',
  /** Node relationships invalid */
  VAL_INVALID_RELATIONSHIPS: 'TG_NODE_VAL_INVALID_RELATIONSHIPS',
  /** Node data integrity check failed */
  VAL_INTEGRITY_FAILED: 'TG_NODE_VAL_INTEGRITY_FAILED',
} as const;

export type TerragruntNodeErrorCodeType = typeof TerragruntNodeErrorCode[keyof typeof TerragruntNodeErrorCode];

// ============================================================================
// Error Messages for Node Error Codes
// ============================================================================

/**
 * User-friendly error messages for node error codes
 */
export const TerragruntNodeErrorMessage: Record<TerragruntNodeErrorCodeType, string> = {
  // Metadata
  [TerragruntNodeErrorCode.META_INVALID]: 'Node metadata is invalid or malformed.',
  [TerragruntNodeErrorCode.META_MISSING_ID]: 'Node is missing required ID field.',
  [TerragruntNodeErrorCode.META_MISSING_PATH]: 'Node is missing required file path.',
  [TerragruntNodeErrorCode.META_MISSING_NAME]: 'Node is missing required name field.',
  [TerragruntNodeErrorCode.META_INVALID_TYPE]: 'Node has invalid or unsupported type.',
  [TerragruntNodeErrorCode.META_INVALID_LOCATION]: 'Node has invalid source location.',
  [TerragruntNodeErrorCode.META_SERIALIZATION_ERROR]: 'Failed to serialize node metadata to JSON.',

  // Terraform Source
  [TerragruntNodeErrorCode.SRC_MISSING]: 'Terraform source is missing from configuration.',
  [TerragruntNodeErrorCode.SRC_INVALID_FORMAT]: 'Terraform source has invalid format.',
  [TerragruntNodeErrorCode.SRC_UNRESOLVED]: 'Terraform source path could not be resolved.',
  [TerragruntNodeErrorCode.SRC_NOT_ACCESSIBLE]: 'Terraform source is not accessible.',

  // Remote State
  [TerragruntNodeErrorCode.RS_INVALID]: 'Remote state configuration is invalid.',
  [TerragruntNodeErrorCode.RS_MISSING_BACKEND]: 'Remote state is missing backend configuration.',
  [TerragruntNodeErrorCode.RS_INVALID_BACKEND]: 'Remote state backend type is not supported.',
  [TerragruntNodeErrorCode.RS_CONFIG_ERROR]: 'Failed to generate remote state configuration.',

  // Repository/Persistence
  [TerragruntNodeErrorCode.DB_INSERT_FAILED]: 'Failed to insert node into database.',
  [TerragruntNodeErrorCode.DB_NOT_FOUND]: 'Node not found in database.',
  [TerragruntNodeErrorCode.DB_BATCH_INSERT_FAILED]: 'Batch node insertion failed.',
  [TerragruntNodeErrorCode.DB_UPDATE_FAILED]: 'Failed to update node in database.',
  [TerragruntNodeErrorCode.DB_DELETE_FAILED]: 'Failed to delete node from database.',
  [TerragruntNodeErrorCode.DB_DUPLICATE_NODE]: 'A node with this ID already exists.',
  [TerragruntNodeErrorCode.DB_CONSTRAINT_VIOLATION]: 'Database constraint violation occurred.',
  [TerragruntNodeErrorCode.DB_TRANSACTION_ERROR]: 'Database transaction error during node operation.',

  // Conversion
  [TerragruntNodeErrorCode.CONV_FILE_TO_NODE_FAILED]: 'Failed to convert parsed file to graph node.',
  [TerragruntNodeErrorCode.CONV_NODE_TO_INPUT_FAILED]: 'Failed to convert node to database input.',
  [TerragruntNodeErrorCode.CONV_ROW_TO_NODE_FAILED]: 'Failed to convert database row to node.',
  [TerragruntNodeErrorCode.CONV_METADATA_EXTRACTION_FAILED]: 'Failed to extract metadata from parsed file.',

  // Validation
  [TerragruntNodeErrorCode.VAL_ERROR]: 'Node validation failed.',
  [TerragruntNodeErrorCode.VAL_PRE_INSERT_FAILED]: 'Node failed pre-insertion validation checks.',
  [TerragruntNodeErrorCode.VAL_INVALID_RELATIONSHIPS]: 'Node has invalid relationship references.',
  [TerragruntNodeErrorCode.VAL_INTEGRITY_FAILED]: 'Node data integrity check failed.',
};

// ============================================================================
// Severity and Recoverability Mappings
// ============================================================================

/**
 * Severity levels for node error codes
 */
export const TerragruntNodeErrorSeverityMap: Record<TerragruntNodeErrorCodeType, TerragruntErrorSeverity> = {
  // Metadata - mostly errors that can be recovered with partial nodes
  [TerragruntNodeErrorCode.META_INVALID]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.META_MISSING_ID]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.META_MISSING_PATH]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.META_MISSING_NAME]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.META_INVALID_TYPE]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.META_INVALID_LOCATION]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.META_SERIALIZATION_ERROR]: TerragruntErrorSeverity.ERROR,

  // Terraform Source - warnings, config can still be parsed
  [TerragruntNodeErrorCode.SRC_MISSING]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.SRC_INVALID_FORMAT]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.SRC_UNRESOLVED]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.SRC_NOT_ACCESSIBLE]: TerragruntErrorSeverity.WARNING,

  // Remote State - warnings, config can still be parsed
  [TerragruntNodeErrorCode.RS_INVALID]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.RS_MISSING_BACKEND]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.RS_INVALID_BACKEND]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.RS_CONFIG_ERROR]: TerragruntErrorSeverity.WARNING,

  // Repository - errors that affect persistence
  [TerragruntNodeErrorCode.DB_INSERT_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_NOT_FOUND]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_BATCH_INSERT_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_UPDATE_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_DELETE_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_DUPLICATE_NODE]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.DB_CONSTRAINT_VIOLATION]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.DB_TRANSACTION_ERROR]: TerragruntErrorSeverity.FATAL,

  // Conversion - errors that can be recovered
  [TerragruntNodeErrorCode.CONV_FILE_TO_NODE_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.CONV_NODE_TO_INPUT_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.CONV_ROW_TO_NODE_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.CONV_METADATA_EXTRACTION_FAILED]: TerragruntErrorSeverity.WARNING,

  // Validation - mostly recoverable
  [TerragruntNodeErrorCode.VAL_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.VAL_PRE_INSERT_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntNodeErrorCode.VAL_INVALID_RELATIONSHIPS]: TerragruntErrorSeverity.WARNING,
  [TerragruntNodeErrorCode.VAL_INTEGRITY_FAILED]: TerragruntErrorSeverity.ERROR,
};

/**
 * Recoverability for node error codes
 */
export const TerragruntNodeErrorRecoverable: Record<TerragruntNodeErrorCodeType, boolean> = {
  // Metadata - some recoverable via partial nodes
  [TerragruntNodeErrorCode.META_INVALID]: true,
  [TerragruntNodeErrorCode.META_MISSING_ID]: false, // ID is required
  [TerragruntNodeErrorCode.META_MISSING_PATH]: false, // Path is required
  [TerragruntNodeErrorCode.META_MISSING_NAME]: true, // Can derive from path
  [TerragruntNodeErrorCode.META_INVALID_TYPE]: false,
  [TerragruntNodeErrorCode.META_INVALID_LOCATION]: true,
  [TerragruntNodeErrorCode.META_SERIALIZATION_ERROR]: true,

  // Terraform Source - all recoverable
  [TerragruntNodeErrorCode.SRC_MISSING]: true,
  [TerragruntNodeErrorCode.SRC_INVALID_FORMAT]: true,
  [TerragruntNodeErrorCode.SRC_UNRESOLVED]: true,
  [TerragruntNodeErrorCode.SRC_NOT_ACCESSIBLE]: true,

  // Remote State - all recoverable
  [TerragruntNodeErrorCode.RS_INVALID]: true,
  [TerragruntNodeErrorCode.RS_MISSING_BACKEND]: true,
  [TerragruntNodeErrorCode.RS_INVALID_BACKEND]: true,
  [TerragruntNodeErrorCode.RS_CONFIG_ERROR]: true,

  // Repository - most are not recoverable
  [TerragruntNodeErrorCode.DB_INSERT_FAILED]: true, // Can retry
  [TerragruntNodeErrorCode.DB_NOT_FOUND]: true,
  [TerragruntNodeErrorCode.DB_BATCH_INSERT_FAILED]: true, // Can retry partial
  [TerragruntNodeErrorCode.DB_UPDATE_FAILED]: true,
  [TerragruntNodeErrorCode.DB_DELETE_FAILED]: true,
  [TerragruntNodeErrorCode.DB_DUPLICATE_NODE]: true, // Can skip
  [TerragruntNodeErrorCode.DB_CONSTRAINT_VIOLATION]: false,
  [TerragruntNodeErrorCode.DB_TRANSACTION_ERROR]: false,

  // Conversion - recoverable via partial results
  [TerragruntNodeErrorCode.CONV_FILE_TO_NODE_FAILED]: true,
  [TerragruntNodeErrorCode.CONV_NODE_TO_INPUT_FAILED]: true,
  [TerragruntNodeErrorCode.CONV_ROW_TO_NODE_FAILED]: true,
  [TerragruntNodeErrorCode.CONV_METADATA_EXTRACTION_FAILED]: true,

  // Validation - recoverable with partial data
  [TerragruntNodeErrorCode.VAL_ERROR]: true,
  [TerragruntNodeErrorCode.VAL_PRE_INSERT_FAILED]: true,
  [TerragruntNodeErrorCode.VAL_INVALID_RELATIONSHIPS]: true,
  [TerragruntNodeErrorCode.VAL_INTEGRITY_FAILED]: true,
};

/**
 * Suggested actions for node error codes
 */
export const TerragruntNodeErrorSuggestion: Record<TerragruntNodeErrorCodeType, string> = {
  // Metadata
  [TerragruntNodeErrorCode.META_INVALID]: 'Check node structure and required fields.',
  [TerragruntNodeErrorCode.META_MISSING_ID]: 'Ensure node has a unique ID assigned.',
  [TerragruntNodeErrorCode.META_MISSING_PATH]: 'Ensure node has a valid file path.',
  [TerragruntNodeErrorCode.META_MISSING_NAME]: 'Provide a name or it will be derived from the path.',
  [TerragruntNodeErrorCode.META_INVALID_TYPE]: 'Use a valid node type (tg_config).',
  [TerragruntNodeErrorCode.META_INVALID_LOCATION]: 'Check source location has valid line/column numbers.',
  [TerragruntNodeErrorCode.META_SERIALIZATION_ERROR]: 'Check metadata contains only JSON-serializable values.',

  // Terraform Source
  [TerragruntNodeErrorCode.SRC_MISSING]: 'Add a terraform {} block with source attribute.',
  [TerragruntNodeErrorCode.SRC_INVALID_FORMAT]: 'Use valid source format: local path, git URL, or registry.',
  [TerragruntNodeErrorCode.SRC_UNRESOLVED]: 'Check the source path or URL is correct.',
  [TerragruntNodeErrorCode.SRC_NOT_ACCESSIBLE]: 'Verify network access or file permissions.',

  // Remote State
  [TerragruntNodeErrorCode.RS_INVALID]: 'Check remote_state block configuration.',
  [TerragruntNodeErrorCode.RS_MISSING_BACKEND]: 'Add backend attribute to remote_state block.',
  [TerragruntNodeErrorCode.RS_INVALID_BACKEND]: 'Use supported backend: s3, gcs, azurerm, etc.',
  [TerragruntNodeErrorCode.RS_CONFIG_ERROR]: 'Check remote_state config attributes.',

  // Repository
  [TerragruntNodeErrorCode.DB_INSERT_FAILED]: 'Check database connection and retry.',
  [TerragruntNodeErrorCode.DB_NOT_FOUND]: 'Verify the node ID exists in the database.',
  [TerragruntNodeErrorCode.DB_BATCH_INSERT_FAILED]: 'Check individual nodes and retry failed ones.',
  [TerragruntNodeErrorCode.DB_UPDATE_FAILED]: 'Verify node exists and data is valid.',
  [TerragruntNodeErrorCode.DB_DELETE_FAILED]: 'Check for dependent relationships.',
  [TerragruntNodeErrorCode.DB_DUPLICATE_NODE]: 'Use a different ID or update existing node.',
  [TerragruntNodeErrorCode.DB_CONSTRAINT_VIOLATION]: 'Check foreign key relationships.',
  [TerragruntNodeErrorCode.DB_TRANSACTION_ERROR]: 'Retry the entire operation.',

  // Conversion
  [TerragruntNodeErrorCode.CONV_FILE_TO_NODE_FAILED]: 'Check parsed file structure.',
  [TerragruntNodeErrorCode.CONV_NODE_TO_INPUT_FAILED]: 'Check node has all required fields.',
  [TerragruntNodeErrorCode.CONV_ROW_TO_NODE_FAILED]: 'Check database row format.',
  [TerragruntNodeErrorCode.CONV_METADATA_EXTRACTION_FAILED]: 'Check parsed file has expected blocks.',

  // Validation
  [TerragruntNodeErrorCode.VAL_ERROR]: 'Review validation errors and fix.',
  [TerragruntNodeErrorCode.VAL_PRE_INSERT_FAILED]: 'Ensure all required fields are present.',
  [TerragruntNodeErrorCode.VAL_INVALID_RELATIONSHIPS]: 'Check referenced nodes exist.',
  [TerragruntNodeErrorCode.VAL_INTEGRITY_FAILED]: 'Verify node data consistency.',
};

// ============================================================================
// Node Error Classes
// ============================================================================

/**
 * Base class for node-specific errors.
 * Extends TerragruntParseError but uses node-specific error codes.
 */
export class NodeError extends Error {
  /** Error code for programmatic handling */
  public readonly code: TerragruntNodeErrorCodeType;
  /** Error severity level */
  public readonly severity: TerragruntErrorSeverity;
  /** Whether error is recoverable */
  public readonly recoverable: boolean;
  /** User-friendly suggestion */
  public readonly suggestion: string;
  /** Additional context */
  public readonly context: TerragruntErrorContext;
  /** Timestamp when error was created */
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: TerragruntNodeErrorCodeType,
    context: TerragruntErrorContext = {}
  ) {
    super(message);
    this.name = 'NodeError';
    this.code = code;
    this.severity = TerragruntNodeErrorSeverityMap[code];
    this.recoverable = TerragruntNodeErrorRecoverable[code];
    this.suggestion = TerragruntNodeErrorSuggestion[code];
    this.context = context;
    this.timestamp = new Date();

    Object.setPrototypeOf(this, new.target.prototype);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /** Get the underlying cause if error was chained */
  get cause(): Error | undefined {
    return this.context.cause;
  }

  /** Serialize to JSON */
  toJSON(): SerializedTerragruntError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      location: this.context.location ? {
        file: this.context.location.file,
        lineStart: this.context.location.lineStart,
        lineEnd: this.context.location.lineEnd,
        columnStart: this.context.location.columnStart,
        columnEnd: this.context.location.columnEnd,
      } : undefined,
      suggestion: this.suggestion,
      recoverable: this.recoverable,
      details: this.context.details,
      cause: this.context.cause?.message,
    };
  }

  /** String representation */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }
}

/**
 * Error class for node creation failures
 */
export class NodeCreationError extends NodeError {
  /** File path where the error occurred */
  public readonly filePath: string;
  /** Scan ID if available */
  public readonly scanId?: string;
  /** Partial node data if available */
  public readonly partialNode?: Partial<TerragruntConfigNode>;

  constructor(
    message: string,
    code: TerragruntNodeErrorCodeType = TerragruntNodeErrorCode.META_INVALID,
    filePath: string,
    context: TerragruntErrorContext & {
      scanId?: string;
      partialNode?: Partial<TerragruntConfigNode>;
    } = {}
  ) {
    super(message, code, { ...context, filePath });
    this.name = 'NodeCreationError';
    this.filePath = filePath;
    this.scanId = context.scanId;
    this.partialNode = context.partialNode;
  }

  /**
   * Create error for missing ID
   */
  static missingId(filePath: string, scanId?: string): NodeCreationError {
    return new NodeCreationError(
      'Node is missing required ID field',
      TerragruntNodeErrorCode.META_MISSING_ID,
      filePath,
      { scanId }
    );
  }

  /**
   * Create error for missing path
   */
  static missingPath(scanId?: string): NodeCreationError {
    return new NodeCreationError(
      'Node is missing required file path',
      TerragruntNodeErrorCode.META_MISSING_PATH,
      '<unknown>',
      { scanId }
    );
  }

  /**
   * Create error for file to node conversion failure
   */
  static conversionFailed(
    filePath: string,
    reason: string,
    cause?: Error
  ): NodeCreationError {
    return new NodeCreationError(
      `Failed to convert parsed file to node: ${reason}`,
      TerragruntNodeErrorCode.CONV_FILE_TO_NODE_FAILED,
      filePath,
      { cause, details: { reason } }
    );
  }
}

/**
 * Error class for node persistence failures
 */
export class NodePersistenceError extends NodeError {
  /** Node ID if available */
  public readonly nodeId?: string;
  /** Scan ID if available */
  public readonly scanId?: string;
  /** Number of failed nodes in batch operations */
  public readonly failedCount?: number;
  /** IDs of failed nodes in batch operations */
  public readonly failedNodeIds?: string[];

  constructor(
    message: string,
    code: TerragruntNodeErrorCodeType = TerragruntNodeErrorCode.DB_INSERT_FAILED,
    context: TerragruntErrorContext & {
      nodeId?: string;
      scanId?: string;
      failedCount?: number;
      failedNodeIds?: string[];
    } = {}
  ) {
    super(message, code, context);
    this.name = 'NodePersistenceError';
    this.nodeId = context.nodeId;
    this.scanId = context.scanId;
    this.failedCount = context.failedCount;
    this.failedNodeIds = context.failedNodeIds;
  }

  /**
   * Create error for insert failure
   */
  static insertFailed(
    nodeId: string,
    scanId: string,
    cause?: Error
  ): NodePersistenceError {
    return new NodePersistenceError(
      `Failed to insert node ${nodeId}`,
      TerragruntNodeErrorCode.DB_INSERT_FAILED,
      { nodeId, scanId, cause }
    );
  }

  /**
   * Create error for batch insert failure
   */
  static batchInsertFailed(
    scanId: string,
    totalCount: number,
    failedNodeIds: string[],
    cause?: Error
  ): NodePersistenceError {
    return new NodePersistenceError(
      `Batch insert failed: ${failedNodeIds.length} of ${totalCount} nodes failed`,
      TerragruntNodeErrorCode.DB_BATCH_INSERT_FAILED,
      {
        scanId,
        failedCount: failedNodeIds.length,
        failedNodeIds,
        cause,
        details: { totalCount },
      }
    );
  }

  /**
   * Create error for node not found
   */
  static notFound(nodeId: string, scanId?: string): NodePersistenceError {
    return new NodePersistenceError(
      `Node not found: ${nodeId}`,
      TerragruntNodeErrorCode.DB_NOT_FOUND,
      { nodeId, scanId }
    );
  }

  /**
   * Create error for duplicate node
   */
  static duplicate(nodeId: string, scanId: string): NodePersistenceError {
    return new NodePersistenceError(
      `Duplicate node: ${nodeId} already exists in scan ${scanId}`,
      TerragruntNodeErrorCode.DB_DUPLICATE_NODE,
      { nodeId, scanId }
    );
  }
}

/**
 * Error class for node validation failures
 */
export class NodeValidationError extends NodeError {
  /** Validation errors found */
  public readonly validationErrors: NodeFieldError[];
  /** Node ID if available */
  public readonly nodeId?: string;

  constructor(
    message: string,
    validationErrors: NodeFieldError[],
    context: TerragruntErrorContext & { nodeId?: string } = {}
  ) {
    super(message, TerragruntNodeErrorCode.VAL_ERROR, {
      ...context,
      details: { ...context.details, validationErrors },
    });
    this.name = 'NodeValidationError';
    this.validationErrors = validationErrors;
    this.nodeId = context.nodeId;
  }

  /**
   * Create validation error from field errors
   */
  static fromFieldErrors(
    errors: NodeFieldError[],
    nodeId?: string
  ): NodeValidationError {
    const errorCount = errors.filter(e => e.severity === 'error').length;
    const warningCount = errors.filter(e => e.severity === 'warning').length;
    const message = `Node validation failed: ${errorCount} error(s), ${warningCount} warning(s)`;
    return new NodeValidationError(message, errors, { nodeId });
  }
}

/**
 * Field-level validation error
 */
export interface NodeFieldError {
  /** Field name that failed validation */
  field: string;
  /** Error message */
  message: string;
  /** Error code */
  code: TerragruntNodeErrorCodeType;
  /** Severity level */
  severity: 'error' | 'warning';
  /** Expected value or type */
  expected?: string;
  /** Actual value or type */
  actual?: string;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a NodeError (base class for all node errors)
 */
export function isNodeError(error: unknown): error is NodeError {
  return error instanceof NodeError;
}

/**
 * Check if an error is a NodeCreationError
 */
export function isNodeCreationError(error: unknown): error is NodeCreationError {
  return error instanceof NodeCreationError;
}

/**
 * Check if an error is a NodePersistenceError
 */
export function isNodePersistenceError(error: unknown): error is NodePersistenceError {
  return error instanceof NodePersistenceError;
}

/**
 * Check if an error is a NodeValidationError
 */
export function isNodeValidationError(error: unknown): error is NodeValidationError {
  return error instanceof NodeValidationError;
}

/**
 * Check if error code is a node error code
 */
export function isNodeErrorCode(code: string): code is TerragruntNodeErrorCodeType {
  return code.startsWith('TG_NODE_');
}

/**
 * Check if a node error code is recoverable
 */
export function isNodeErrorRecoverable(code: TerragruntNodeErrorCodeType): boolean {
  return TerragruntNodeErrorRecoverable[code];
}

// ============================================================================
// Partial Node Types
// ============================================================================

/**
 * A partial node created when full parsing fails.
 * Contains basic information and the error that prevented full parsing.
 */
export interface PartialTerragruntNode {
  /** Node type (always 'tg_config') */
  type: 'tg_config';
  /** File path */
  path: string;
  /** Scan ID */
  scanId: string;
  /** Derived name (from directory name) */
  name: string;
  /** ID if available */
  id?: string;
  /** Partial location information */
  location?: Partial<NodeLocation>;
  /** Parse error that prevented full parsing */
  parseError: TerragruntParseError;
  /** Any partial metadata extracted */
  partialMetadata?: Partial<TerragruntNodeMetadata>;
  /** Whether this is a partial node */
  isPartial: true;
  /** Timestamp when partial node was created */
  createdAt: Date;
}

// ============================================================================
// Error Recovery Helpers
// ============================================================================

/**
 * Create a partial node when full parsing fails.
 * Extracts as much information as possible from the file path.
 *
 * @param filePath - Path to the terragrunt.hcl file
 * @param scanId - Current scan ID
 * @param error - The parse error that occurred
 * @returns Partial node with available information
 */
export function createPartialTerragruntNode(
  filePath: string,
  scanId: string,
  error: TerragruntParseError
): PartialTerragruntNode {
  // Derive name from directory containing the file
  const dirName = path.basename(path.dirname(filePath));
  const name = dirName || path.basename(filePath, '.hcl');

  return {
    type: 'tg_config',
    path: filePath,
    scanId,
    name,
    location: error.location ? {
      file: error.location.file || filePath,
      lineStart: error.location.lineStart,
      lineEnd: error.location.lineEnd,
    } : { file: filePath, lineStart: 1, lineEnd: 1 },
    parseError: error,
    isPartial: true,
    createdAt: new Date(),
  };
}

/**
 * Create a partial node from a TerragruntFile that had parse errors.
 * Extracts available metadata despite errors.
 *
 * @param file - Parsed file with errors
 * @param scanId - Current scan ID
 * @returns Partial node with extracted information
 */
export function createPartialNodeFromFile(
  file: TerragruntFile,
  scanId: string
): PartialTerragruntNode {
  const dirName = path.basename(path.dirname(file.path));
  const name = dirName || path.basename(file.path, '.hcl');

  // Extract whatever metadata we can from successful blocks
  const partialMetadata: Partial<TerragruntNodeMetadata> = {
    encoding: file.encoding,
    size: file.size,
    blockCount: file.blocks.length,
    errorCount: file.errors.length,
    dependencyNames: file.dependencies.map(d => d.name),
    includeLabels: file.includes.map(i => i.label).filter(Boolean),
  };

  // Try to extract terraform source if available
  const terraformBlock = file.blocks.find(b => b.type === 'terraform');
  if (terraformBlock && 'source' in terraformBlock && terraformBlock.source) {
    partialMetadata.terraformSource = String(terraformBlock.source);
  }

  // Check for remote state
  const remoteStateBlock = file.blocks.find(b => b.type === 'remote_state');
  if (remoteStateBlock) {
    partialMetadata.hasRemoteState = true;
    if ('backend' in remoteStateBlock) {
      partialMetadata.remoteStateBackend = (remoteStateBlock as any).backend;
    }
  }

  // Get the first error as the primary error
  const primaryError = file.errors[0] ?? new TerragruntParseError(
    'Unknown parsing error',
    'TG_SYN_ERROR' as any,
    { filePath: file.path }
  );

  return {
    type: 'tg_config',
    path: file.path,
    scanId,
    name,
    location: {
      file: file.path,
      lineStart: 1,
      lineEnd: 1,
    },
    parseError: primaryError as TerragruntParseError,
    partialMetadata,
    isPartial: true,
    createdAt: new Date(),
  };
}

/**
 * Validate a TerragruntConfigNode before insertion.
 * Returns an array of validation errors (empty if valid).
 *
 * @param node - Node to validate
 * @returns Array of validation errors
 */
export function validateTerragruntNode(node: Partial<TerragruntConfigNode>): NodeFieldError[] {
  const errors: NodeFieldError[] = [];

  // Check required fields
  if (!node.id) {
    errors.push({
      field: 'id',
      message: 'Node is missing required ID',
      code: TerragruntNodeErrorCode.META_MISSING_ID,
      severity: 'error',
    });
  }

  if (!node.location?.file) {
    errors.push({
      field: 'location.file',
      message: 'Node is missing required file path in location',
      code: TerragruntNodeErrorCode.META_MISSING_PATH,
      severity: 'error',
    });
  }

  if (!node.name) {
    errors.push({
      field: 'name',
      message: 'Node is missing name (will be derived from path if available)',
      code: TerragruntNodeErrorCode.META_MISSING_NAME,
      severity: 'warning',
    });
  }

  // Validate type
  if (node.type && node.type !== 'tg_config') {
    errors.push({
      field: 'type',
      message: 'Node type must be "tg_config"',
      code: TerragruntNodeErrorCode.META_INVALID_TYPE,
      severity: 'error',
      expected: 'tg_config',
      actual: node.type,
    });
  }

  // Validate location if present
  if (node.location) {
    if (typeof node.location.lineStart !== 'number' || node.location.lineStart < 1) {
      errors.push({
        field: 'location.lineStart',
        message: 'Invalid lineStart (must be positive number)',
        code: TerragruntNodeErrorCode.META_INVALID_LOCATION,
        severity: 'warning',
        expected: 'positive number',
        actual: String(node.location.lineStart),
      });
    }
    if (typeof node.location.lineEnd !== 'number' || node.location.lineEnd < node.location.lineStart) {
      errors.push({
        field: 'location.lineEnd',
        message: 'Invalid lineEnd (must be >= lineStart)',
        code: TerragruntNodeErrorCode.META_INVALID_LOCATION,
        severity: 'warning',
        expected: `>= ${node.location.lineStart}`,
        actual: String(node.location.lineEnd),
      });
    }
  }

  // Validate numeric fields
  if (node.includeCount !== undefined && (typeof node.includeCount !== 'number' || node.includeCount < 0)) {
    errors.push({
      field: 'includeCount',
      message: 'includeCount must be a non-negative number',
      code: TerragruntNodeErrorCode.VAL_ERROR,
      severity: 'warning',
    });
  }

  if (node.dependencyCount !== undefined && (typeof node.dependencyCount !== 'number' || node.dependencyCount < 0)) {
    errors.push({
      field: 'dependencyCount',
      message: 'dependencyCount must be a non-negative number',
      code: TerragruntNodeErrorCode.VAL_ERROR,
      severity: 'warning',
    });
  }

  if (node.inputCount !== undefined && (typeof node.inputCount !== 'number' || node.inputCount < 0)) {
    errors.push({
      field: 'inputCount',
      message: 'inputCount must be a non-negative number',
      code: TerragruntNodeErrorCode.VAL_ERROR,
      severity: 'warning',
    });
  }

  // Validate remote state consistency
  if (node.hasRemoteState && !node.remoteStateBackend) {
    errors.push({
      field: 'remoteStateBackend',
      message: 'hasRemoteState is true but remoteStateBackend is not set',
      code: TerragruntNodeErrorCode.RS_MISSING_BACKEND,
      severity: 'warning',
    });
  }

  return errors;
}

/**
 * Validate a node and throw if there are errors.
 *
 * @param node - Node to validate
 * @throws NodeValidationError if validation fails with errors
 */
export function validateAndThrow(node: Partial<TerragruntConfigNode>): void {
  const errors = validateTerragruntNode(node);
  const criticalErrors = errors.filter(e => e.severity === 'error');

  if (criticalErrors.length > 0) {
    throw NodeValidationError.fromFieldErrors(errors, node.id);
  }
}

/**
 * Check if a node is valid for insertion (has all required fields).
 *
 * @param node - Node to check
 * @returns true if node can be inserted
 */
export function isNodeValidForInsertion(node: Partial<TerragruntConfigNode>): boolean {
  const errors = validateTerragruntNode(node);
  const criticalErrors = errors.filter(e => e.severity === 'error');
  return criticalErrors.length === 0;
}

/**
 * Fix a node with missing or invalid fields where possible.
 * Returns a new node with fixes applied.
 *
 * @param node - Node to fix
 * @param filePath - File path to use for derivation
 * @returns Fixed node
 */
export function fixNodeDefaults(
  node: Partial<TerragruntConfigNode>,
  filePath?: string
): Partial<TerragruntConfigNode> {
  const fixed = { ...node };

  // Derive name from path if missing
  if (!fixed.name && (fixed.location?.file || filePath)) {
    const nodePath = fixed.location?.file || filePath!;
    fixed.name = path.basename(path.dirname(nodePath)) || path.basename(nodePath, '.hcl');
  }

  // Set default counts
  if (fixed.includeCount === undefined) fixed.includeCount = 0;
  if (fixed.dependencyCount === undefined) fixed.dependencyCount = 0;
  if (fixed.inputCount === undefined) fixed.inputCount = 0;

  // Set default arrays
  if (!fixed.generateBlocks) fixed.generateBlocks = Object.freeze([]);

  // Set default booleans
  if (fixed.hasRemoteState === undefined) fixed.hasRemoteState = false;

  // Fix location
  if (fixed.location) {
    if (!fixed.location.lineStart || fixed.location.lineStart < 1) {
      fixed.location = { ...fixed.location, lineStart: 1 };
    }
    if (!fixed.location.lineEnd || fixed.location.lineEnd < fixed.location.lineStart) {
      fixed.location = { ...fixed.location, lineEnd: fixed.location.lineStart };
    }
  }

  return fixed;
}

// ============================================================================
// Batch Operation Helpers
// ============================================================================

/**
 * Result of a batch node operation
 */
export interface BatchNodeResult<T> {
  /** Successfully processed items */
  succeeded: T[];
  /** Failed items with their errors */
  failed: Array<{
    item: T;
    error: NodeError;
  }>;
  /** Total items processed */
  total: number;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Process nodes in batch with error collection.
 * Continues processing on recoverable errors.
 *
 * @param nodes - Nodes to process
 * @param processor - Function to process each node
 * @returns Batch result with successes and failures
 */
export async function processBatchWithRecovery<T extends { id?: string }>(
  nodes: T[],
  processor: (node: T) => Promise<void>
): Promise<BatchNodeResult<T>> {
  const succeeded: T[] = [];
  const failed: Array<{ item: T; error: NodeError }> = [];

  for (const node of nodes) {
    try {
      await processor(node);
      succeeded.push(node);
    } catch (error) {
      const nodeError = error instanceof NodeError
        ? error
        : new NodeCreationError(
            `Processing failed: ${error instanceof Error ? error.message : String(error)}`,
            TerragruntNodeErrorCode.DB_INSERT_FAILED,
            node.id || '<unknown>',
            { cause: error instanceof Error ? error : undefined }
          );

      // Only continue if error is recoverable
      if (nodeError.recoverable) {
        failed.push({ item: node, error: nodeError });
      } else {
        // Re-throw non-recoverable errors
        throw nodeError;
      }
    }
  }

  return {
    succeeded,
    failed,
    total: nodes.length,
    successRate: nodes.length > 0 ? succeeded.length / nodes.length : 1,
  };
}

/**
 * Get info about a node error code
 */
export function getNodeErrorInfo(code: TerragruntNodeErrorCodeType): {
  code: TerragruntNodeErrorCodeType;
  message: string;
  severity: TerragruntErrorSeverity;
  suggestion: string;
  recoverable: boolean;
} {
  return {
    code,
    message: TerragruntNodeErrorMessage[code],
    severity: TerragruntNodeErrorSeverityMap[code],
    suggestion: TerragruntNodeErrorSuggestion[code],
    recoverable: TerragruntNodeErrorRecoverable[code],
  };
}
