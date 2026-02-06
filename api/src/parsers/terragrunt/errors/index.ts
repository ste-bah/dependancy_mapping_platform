/**
 * Terragrunt Parser Error Handling Module
 * @module parsers/terragrunt/errors
 *
 * Comprehensive error handling for Terragrunt HCL parsing:
 * - Error class hierarchy with specialized error types
 * - Error codes with messages, severity, and suggestions
 * - Recovery strategies for continued parsing
 * - User-friendly error reporting in multiple formats
 *
 * TASK-TG-001: Error handling for Terragrunt HCL parsing
 *
 * @example
 * ```typescript
 * import {
 *   TerragruntParseError,
 *   LexerError,
 *   BlockParseError,
 *   TerragruntErrorCode,
 *   ErrorRecoveryManager,
 *   formatErrors,
 * } from './errors';
 *
 * // Create specific errors
 * const error = BlockParseError.unknownType('invalid_block', location);
 *
 * // Use error recovery
 * const recoveryManager = new ErrorRecoveryManager({ enabled: true });
 * if (recoveryManager.handleError(error)) {
 *   // Continue parsing
 * }
 *
 * // Format errors for display
 * console.log(formatErrors(errors, sourceContent));
 * ```
 */

// ============================================================================
// Error Codes and Types
// ============================================================================

export {
  // Severity enum
  TerragruntErrorSeverity,

  // Error codes
  TerragruntErrorCode,
  type TerragruntErrorCodeType,

  // Error information maps
  TerragruntErrorMessage,
  TerragruntErrorSeverityMap,
  TerragruntErrorSuggestion,
  TerragruntErrorRecoverable,

  // Info type and getter
  type TerragruntErrorInfo,
  getTerragruntErrorInfo,

  // Category checkers
  isLexerError as isLexerErrorCode,
  isSyntaxError as isSyntaxErrorCode,
  isBlockError as isBlockErrorCode,
  isIncludeError as isIncludeErrorCode,
  isDependencyError as isDependencyErrorCode,
  isFunctionError as isFunctionErrorCode,
  isRecoverableError,
  getErrorCodesBySeverity,
  getRecoverableErrorCodes,
} from './error-codes';

// ============================================================================
// Error Classes
// ============================================================================

export {
  // Context and serialization types
  type TerragruntErrorContext,
  type SerializedTerragruntError,

  // Base error class
  TerragruntParseError,

  // Specialized error classes
  LexerError,
  BlockParseError,
  IncludeResolutionError,
  DependencyResolutionError,
  FunctionParseError,
  ValidationError,

  // Type guards
  isTerragruntParseError,
  isLexerError,
  isBlockParseError,
  isIncludeResolutionError,
  isDependencyResolutionError,
  isFunctionParseError,
  isValidationError,

  // Factory functions
  wrapError,
  createError,

  // Error collection
  ErrorCollection,
} from './errors';

// ============================================================================
// Recovery Strategies
// ============================================================================

export {
  // Options and defaults
  type RecoveryOptions,
  DEFAULT_RECOVERY_OPTIONS,

  // State management
  type RecoveryState,
  type SourceRange,
  type RecoveryPoint,
  createRecoveryState,

  // Recovery results
  type RecoveryResult,
  type RecoveryMethod,

  // Strategy classes
  LexerRecoveryStrategy,
  BlockRecoveryStrategy,
  IncludeRecoveryStrategy,
  DependencyRecoveryStrategy,

  // Recovery manager
  ErrorRecoveryManager,
  createRecoveryManager,
  canContinueAfterError,
} from './recovery';

// ============================================================================
// Error Reporting
// ============================================================================

export {
  // Options
  type ReporterOptions,
  DEFAULT_REPORTER_OPTIONS,

  // Report types
  type ErrorSummary,
  type ErrorReport,
  type FormattedError,

  // Reporter class
  ErrorReporter,
  createReporter,

  // Quick formatting functions
  formatErrors,
  formatError,
  printErrors,
} from './reporter';

// ============================================================================
// Node Creation Errors
// ============================================================================

export {
  // Node error codes
  TerragruntNodeErrorCode,
  type TerragruntNodeErrorCodeType,

  // Node error messages and mappings
  TerragruntNodeErrorMessage,
  TerragruntNodeErrorSeverityMap,
  TerragruntNodeErrorSuggestion,
  TerragruntNodeErrorRecoverable,

  // Node error classes
  NodeError,
  NodeCreationError,
  NodePersistenceError,
  NodeValidationError,

  // Node error types
  type NodeFieldError,
  type PartialTerragruntNode,
  type BatchNodeResult,

  // Type guards
  isNodeError,
  isNodeCreationError,
  isNodePersistenceError,
  isNodeValidationError,
  isNodeErrorCode,
  isNodeErrorRecoverable,

  // Recovery helpers
  createPartialTerragruntNode,
  createPartialNodeFromFile,
  validateTerragruntNode,
  validateAndThrow,
  isNodeValidForInsertion,
  fixNodeDefaults,
  processBatchWithRecovery,
  getNodeErrorInfo,
} from './node-errors';

// ============================================================================
// Edge Creation Errors (TASK-TG-008)
// ============================================================================

export {
  // Edge error context types
  type EdgeErrorContext,
  type SerializedEdgeError,
  type SourceErrorContext,
  type BatchEdgeErrorContext,
  type EdgeErrorSummary,

  // Edge error classes
  TerragruntEdgeError,
  SourceResolutionError,
  BatchEdgeError,

  // Type guards
  isTerragruntEdgeError,
  isSourceResolutionError,
  isBatchEdgeError,
  isEdgeErrorCode,

  // Error factories
  wrapEdgeError,
  wrapSourceError,

  // Validation helpers
  validateEdgeOptions as validateEdgeOptionsForErrors,
  validateLinkerContext as validateLinkerContextForErrors,

  // Recovery support
  type EdgeRecoveryResult,
  attemptEdgeRecovery,
  canContinueAfterEdgeError,
} from './edge-errors';

// Re-export edge error code helpers from error-codes
export {
  isEdgeError as isEdgeErrorCodePattern,
  isSourceError as isSourceErrorCodePattern,
} from './error-codes';
