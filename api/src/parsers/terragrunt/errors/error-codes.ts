/**
 * Terragrunt Parser Error Codes and Messages
 * @module parsers/terragrunt/errors/error-codes
 *
 * Comprehensive error code enumeration with user-friendly messages,
 * severity levels, and suggested actions for the Terragrunt Parser.
 *
 * TASK-TG-001: Error handling for Terragrunt HCL parsing
 */

// ============================================================================
// Error Severity Levels
// ============================================================================

/**
 * Error severity level for categorizing error impact
 */
export enum TerragruntErrorSeverity {
  /** Informational - no action required */
  INFO = 'info',
  /** Warning - parsing continued with potential issues */
  WARNING = 'warning',
  /** Error - parsing failed but may recover */
  ERROR = 'error',
  /** Fatal - parsing cannot continue */
  FATAL = 'fatal',
}

// ============================================================================
// Error Code Enumeration
// ============================================================================

/**
 * Comprehensive Terragrunt parser error codes
 * Format: TG_<CATEGORY>_<SPECIFIC_ERROR>
 */
export const TerragruntErrorCode = {
  // =========================================================================
  // Lexer Errors (TG_LEX_*)
  // =========================================================================
  /** Generic lexer error */
  LEX_ERROR: 'TG_LEX_ERROR',
  /** Unterminated string literal */
  LEX_UNTERMINATED_STRING: 'TG_LEX_UNTERMINATED_STRING',
  /** Unterminated heredoc */
  LEX_UNTERMINATED_HEREDOC: 'TG_LEX_UNTERMINATED_HEREDOC',
  /** Invalid character encountered */
  LEX_INVALID_CHARACTER: 'TG_LEX_INVALID_CHARACTER',
  /** Invalid number format */
  LEX_INVALID_NUMBER: 'TG_LEX_INVALID_NUMBER',
  /** Unterminated block comment */
  LEX_UNTERMINATED_COMMENT: 'TG_LEX_UNTERMINATED_COMMENT',
  /** Invalid escape sequence */
  LEX_INVALID_ESCAPE: 'TG_LEX_INVALID_ESCAPE',
  /** Invalid template interpolation */
  LEX_INVALID_INTERPOLATION: 'TG_LEX_INVALID_INTERPOLATION',

  // =========================================================================
  // Syntax Errors (TG_SYN_*)
  // =========================================================================
  /** Generic syntax error */
  SYN_ERROR: 'TG_SYN_ERROR',
  /** Unexpected token */
  SYN_UNEXPECTED_TOKEN: 'TG_SYN_UNEXPECTED_TOKEN',
  /** Missing expected token */
  SYN_MISSING_TOKEN: 'TG_SYN_MISSING_TOKEN',
  /** Unclosed block */
  SYN_UNCLOSED_BLOCK: 'TG_SYN_UNCLOSED_BLOCK',
  /** Unclosed bracket */
  SYN_UNCLOSED_BRACKET: 'TG_SYN_UNCLOSED_BRACKET',
  /** Unclosed parenthesis */
  SYN_UNCLOSED_PAREN: 'TG_SYN_UNCLOSED_PAREN',
  /** Invalid block structure */
  SYN_INVALID_BLOCK: 'TG_SYN_INVALID_BLOCK',
  /** Invalid attribute syntax */
  SYN_INVALID_ATTRIBUTE: 'TG_SYN_INVALID_ATTRIBUTE',
  /** Invalid expression syntax */
  SYN_INVALID_EXPRESSION: 'TG_SYN_INVALID_EXPRESSION',

  // =========================================================================
  // Block Errors (TG_BLK_*)
  // =========================================================================
  /** Unknown block type */
  BLK_UNKNOWN_TYPE: 'TG_BLK_UNKNOWN_TYPE',
  /** Invalid block type for context */
  BLK_INVALID_TYPE: 'TG_BLK_INVALID_TYPE',
  /** Missing required attribute */
  BLK_MISSING_ATTRIBUTE: 'TG_BLK_MISSING_ATTRIBUTE',
  /** Invalid attribute value */
  BLK_INVALID_ATTRIBUTE: 'TG_BLK_INVALID_ATTRIBUTE',
  /** Duplicate block */
  BLK_DUPLICATE: 'TG_BLK_DUPLICATE',
  /** Missing block label */
  BLK_MISSING_LABEL: 'TG_BLK_MISSING_LABEL',
  /** Invalid block label */
  BLK_INVALID_LABEL: 'TG_BLK_INVALID_LABEL',
  /** Conflicting blocks */
  BLK_CONFLICT: 'TG_BLK_CONFLICT',

  // =========================================================================
  // Include Errors (TG_INC_*)
  // =========================================================================
  /** Include file not found */
  INC_NOT_FOUND: 'TG_INC_NOT_FOUND',
  /** Circular include detected */
  INC_CIRCULAR: 'TG_INC_CIRCULAR',
  /** Include path cannot be resolved */
  INC_UNRESOLVED_PATH: 'TG_INC_UNRESOLVED_PATH',
  /** Include depth exceeded */
  INC_MAX_DEPTH: 'TG_INC_MAX_DEPTH',
  /** Invalid include path expression */
  INC_INVALID_PATH: 'TG_INC_INVALID_PATH',
  /** Include merge conflict */
  INC_MERGE_CONFLICT: 'TG_INC_MERGE_CONFLICT',
  /** Include file parse error */
  INC_PARSE_ERROR: 'TG_INC_PARSE_ERROR',

  // =========================================================================
  // Dependency Errors (TG_DEP_*)
  // =========================================================================
  /** Dependency not found */
  DEP_NOT_FOUND: 'TG_DEP_NOT_FOUND',
  /** Circular dependency detected */
  DEP_CIRCULAR: 'TG_DEP_CIRCULAR',
  /** Dependency path cannot be resolved */
  DEP_UNRESOLVED_PATH: 'TG_DEP_UNRESOLVED_PATH',
  /** Missing dependency configuration */
  DEP_MISSING_CONFIG: 'TG_DEP_MISSING_CONFIG',
  /** Invalid dependency output reference */
  DEP_INVALID_OUTPUT: 'TG_DEP_INVALID_OUTPUT',
  /** Dependency validation failed */
  DEP_VALIDATION_FAILED: 'TG_DEP_VALIDATION_FAILED',

  // =========================================================================
  // Function Errors (TG_FN_*)
  // =========================================================================
  /** Unknown function */
  FN_UNKNOWN: 'TG_FN_UNKNOWN',
  /** Invalid function arguments */
  FN_INVALID_ARGS: 'TG_FN_INVALID_ARGS',
  /** Too few function arguments */
  FN_TOO_FEW_ARGS: 'TG_FN_TOO_FEW_ARGS',
  /** Too many function arguments */
  FN_TOO_MANY_ARGS: 'TG_FN_TOO_MANY_ARGS',
  /** Invalid argument type */
  FN_INVALID_ARG_TYPE: 'TG_FN_INVALID_ARG_TYPE',
  /** Function evaluation error */
  FN_EVAL_ERROR: 'TG_FN_EVAL_ERROR',
  /** Runtime function error */
  FN_RUNTIME_ERROR: 'TG_FN_RUNTIME_ERROR',

  // =========================================================================
  // Reference Errors (TG_REF_*)
  // =========================================================================
  /** Undefined reference */
  REF_UNDEFINED: 'TG_REF_UNDEFINED',
  /** Invalid reference path */
  REF_INVALID_PATH: 'TG_REF_INVALID_PATH',
  /** Reference cycle detected */
  REF_CIRCULAR: 'TG_REF_CIRCULAR',
  /** Reference type mismatch */
  REF_TYPE_MISMATCH: 'TG_REF_TYPE_MISMATCH',
  /** Reference out of scope */
  REF_OUT_OF_SCOPE: 'TG_REF_OUT_OF_SCOPE',

  // =========================================================================
  // File System Errors (TG_FS_*)
  // =========================================================================
  /** File not found */
  FS_NOT_FOUND: 'TG_FS_NOT_FOUND',
  /** File read error */
  FS_READ_ERROR: 'TG_FS_READ_ERROR',
  /** File too large */
  FS_TOO_LARGE: 'TG_FS_TOO_LARGE',
  /** Invalid file encoding */
  FS_ENCODING_ERROR: 'TG_FS_ENCODING_ERROR',
  /** Permission denied */
  FS_PERMISSION_DENIED: 'TG_FS_PERMISSION_DENIED',

  // =========================================================================
  // Validation Errors (TG_VAL_*)
  // =========================================================================
  /** General validation error */
  VAL_ERROR: 'TG_VAL_ERROR',
  /** Required field missing */
  VAL_MISSING_REQUIRED: 'TG_VAL_MISSING_REQUIRED',
  /** Invalid field value */
  VAL_INVALID_VALUE: 'TG_VAL_INVALID_VALUE',
  /** Type constraint violation */
  VAL_TYPE_ERROR: 'TG_VAL_TYPE_ERROR',
  /** Constraint violation */
  VAL_CONSTRAINT_VIOLATION: 'TG_VAL_CONSTRAINT_VIOLATION',
  /** Configuration conflict */
  VAL_CONFIG_CONFLICT: 'TG_VAL_CONFIG_CONFLICT',

  // =========================================================================
  // Internal Errors (TG_INT_*)
  // =========================================================================
  /** Internal parser error */
  INT_ERROR: 'TG_INT_ERROR',
  /** Parser timeout */
  INT_TIMEOUT: 'TG_INT_TIMEOUT',
  /** Memory limit exceeded */
  INT_MEMORY_EXCEEDED: 'TG_INT_MEMORY_EXCEEDED',
  /** Assertion failure */
  INT_ASSERTION_FAILED: 'TG_INT_ASSERTION_FAILED',

  // =========================================================================
  // Edge Errors (TG_EDGE_*)
  // TASK-TG-008: Error codes for edge creation and validation
  // =========================================================================
  /** Generic edge error */
  EDGE_ERROR: 'TG_EDGE_ERROR',
  /** Invalid edge options (missing required fields) */
  EDGE_INVALID_OPTIONS: 'TG_EDGE_INVALID_OPTIONS',
  /** Self-referential edge (source === target) */
  EDGE_SELF_REFERENTIAL: 'TG_EDGE_SELF_REFERENTIAL',
  /** Invalid evidence array */
  EDGE_INVALID_EVIDENCE: 'TG_EDGE_INVALID_EVIDENCE',
  /** Confidence score out of range */
  EDGE_INVALID_CONFIDENCE: 'TG_EDGE_INVALID_CONFIDENCE',
  /** Edge creation failed */
  EDGE_CREATION_FAILED: 'TG_EDGE_CREATION_FAILED',
  /** Node ID mapping failed */
  EDGE_NODE_MAPPING_FAILED: 'TG_EDGE_NODE_MAPPING_FAILED',
  /** Batch edge creation had errors */
  EDGE_BATCH_ERRORS: 'TG_EDGE_BATCH_ERRORS',

  // =========================================================================
  // Source Resolution Errors (TG_SRC_*)
  // TASK-TG-008: Error codes for TF source linking
  // =========================================================================
  /** Generic source resolution error */
  SRC_ERROR: 'TG_SRC_ERROR',
  /** Unresolvable source expression */
  SRC_UNRESOLVABLE: 'TG_SRC_UNRESOLVABLE',
  /** Invalid source pattern */
  SRC_INVALID_PATTERN: 'TG_SRC_INVALID_PATTERN',
  /** Missing linker context */
  SRC_MISSING_CONTEXT: 'TG_SRC_MISSING_CONTEXT',
  /** Circular source reference */
  SRC_CIRCULAR_REFERENCE: 'TG_SRC_CIRCULAR_REFERENCE',
  /** Local path not found */
  SRC_LOCAL_NOT_FOUND: 'TG_SRC_LOCAL_NOT_FOUND',
  /** Invalid linker options */
  SRC_INVALID_OPTIONS: 'TG_SRC_INVALID_OPTIONS',
} as const;

export type TerragruntErrorCodeType = typeof TerragruntErrorCode[keyof typeof TerragruntErrorCode];

// ============================================================================
// Error Messages
// ============================================================================

/**
 * User-friendly error messages for each error code
 */
export const TerragruntErrorMessage: Record<TerragruntErrorCodeType, string> = {
  // Lexer
  [TerragruntErrorCode.LEX_ERROR]: 'An error occurred while tokenizing the file.',
  [TerragruntErrorCode.LEX_UNTERMINATED_STRING]: 'Unterminated string literal. Missing closing quote.',
  [TerragruntErrorCode.LEX_UNTERMINATED_HEREDOC]: 'Unterminated heredoc. Missing closing delimiter.',
  [TerragruntErrorCode.LEX_INVALID_CHARACTER]: 'Invalid character encountered in input.',
  [TerragruntErrorCode.LEX_INVALID_NUMBER]: 'Invalid number format.',
  [TerragruntErrorCode.LEX_UNTERMINATED_COMMENT]: 'Unterminated block comment. Missing closing */.',
  [TerragruntErrorCode.LEX_INVALID_ESCAPE]: 'Invalid escape sequence in string.',
  [TerragruntErrorCode.LEX_INVALID_INTERPOLATION]: 'Invalid template interpolation syntax.',

  // Syntax
  [TerragruntErrorCode.SYN_ERROR]: 'A syntax error occurred while parsing.',
  [TerragruntErrorCode.SYN_UNEXPECTED_TOKEN]: 'Unexpected token encountered.',
  [TerragruntErrorCode.SYN_MISSING_TOKEN]: 'Expected token is missing.',
  [TerragruntErrorCode.SYN_UNCLOSED_BLOCK]: 'Block is not properly closed. Missing closing brace.',
  [TerragruntErrorCode.SYN_UNCLOSED_BRACKET]: 'Array is not properly closed. Missing closing bracket.',
  [TerragruntErrorCode.SYN_UNCLOSED_PAREN]: 'Expression is not properly closed. Missing closing parenthesis.',
  [TerragruntErrorCode.SYN_INVALID_BLOCK]: 'Invalid block structure.',
  [TerragruntErrorCode.SYN_INVALID_ATTRIBUTE]: 'Invalid attribute syntax.',
  [TerragruntErrorCode.SYN_INVALID_EXPRESSION]: 'Invalid expression syntax.',

  // Block
  [TerragruntErrorCode.BLK_UNKNOWN_TYPE]: 'Unknown block type. Valid types include: terraform, include, dependency, locals, etc.',
  [TerragruntErrorCode.BLK_INVALID_TYPE]: 'Invalid block type for this context.',
  [TerragruntErrorCode.BLK_MISSING_ATTRIBUTE]: 'Required attribute is missing from block.',
  [TerragruntErrorCode.BLK_INVALID_ATTRIBUTE]: 'Invalid attribute value in block.',
  [TerragruntErrorCode.BLK_DUPLICATE]: 'Duplicate block detected. Only one instance is allowed.',
  [TerragruntErrorCode.BLK_MISSING_LABEL]: 'Block requires a label.',
  [TerragruntErrorCode.BLK_INVALID_LABEL]: 'Invalid block label.',
  [TerragruntErrorCode.BLK_CONFLICT]: 'Conflicting block configurations detected.',

  // Include
  [TerragruntErrorCode.INC_NOT_FOUND]: 'Include file not found at the specified path.',
  [TerragruntErrorCode.INC_CIRCULAR]: 'Circular include detected. This configuration includes itself.',
  [TerragruntErrorCode.INC_UNRESOLVED_PATH]: 'Include path could not be resolved.',
  [TerragruntErrorCode.INC_MAX_DEPTH]: 'Maximum include depth exceeded. Check for deep nesting.',
  [TerragruntErrorCode.INC_INVALID_PATH]: 'Invalid include path expression.',
  [TerragruntErrorCode.INC_MERGE_CONFLICT]: 'Merge conflict occurred when merging included configuration.',
  [TerragruntErrorCode.INC_PARSE_ERROR]: 'Error parsing included file.',

  // Dependency
  [TerragruntErrorCode.DEP_NOT_FOUND]: 'Dependency configuration not found at the specified path.',
  [TerragruntErrorCode.DEP_CIRCULAR]: 'Circular dependency detected between modules.',
  [TerragruntErrorCode.DEP_UNRESOLVED_PATH]: 'Dependency path could not be resolved.',
  [TerragruntErrorCode.DEP_MISSING_CONFIG]: 'Dependency module is missing terragrunt.hcl.',
  [TerragruntErrorCode.DEP_INVALID_OUTPUT]: 'Invalid dependency output reference.',
  [TerragruntErrorCode.DEP_VALIDATION_FAILED]: 'Dependency validation failed.',

  // Function
  [TerragruntErrorCode.FN_UNKNOWN]: 'Unknown function name.',
  [TerragruntErrorCode.FN_INVALID_ARGS]: 'Invalid function arguments.',
  [TerragruntErrorCode.FN_TOO_FEW_ARGS]: 'Too few arguments provided to function.',
  [TerragruntErrorCode.FN_TOO_MANY_ARGS]: 'Too many arguments provided to function.',
  [TerragruntErrorCode.FN_INVALID_ARG_TYPE]: 'Invalid argument type for function.',
  [TerragruntErrorCode.FN_EVAL_ERROR]: 'Error evaluating function.',
  [TerragruntErrorCode.FN_RUNTIME_ERROR]: 'Runtime error in function execution.',

  // Reference
  [TerragruntErrorCode.REF_UNDEFINED]: 'Reference to undefined variable or attribute.',
  [TerragruntErrorCode.REF_INVALID_PATH]: 'Invalid reference path.',
  [TerragruntErrorCode.REF_CIRCULAR]: 'Circular reference detected.',
  [TerragruntErrorCode.REF_TYPE_MISMATCH]: 'Reference type does not match expected type.',
  [TerragruntErrorCode.REF_OUT_OF_SCOPE]: 'Reference is out of scope.',

  // File System
  [TerragruntErrorCode.FS_NOT_FOUND]: 'File not found.',
  [TerragruntErrorCode.FS_READ_ERROR]: 'Error reading file.',
  [TerragruntErrorCode.FS_TOO_LARGE]: 'File exceeds maximum allowed size.',
  [TerragruntErrorCode.FS_ENCODING_ERROR]: 'Invalid file encoding.',
  [TerragruntErrorCode.FS_PERMISSION_DENIED]: 'Permission denied when accessing file.',

  // Validation
  [TerragruntErrorCode.VAL_ERROR]: 'Validation error in configuration.',
  [TerragruntErrorCode.VAL_MISSING_REQUIRED]: 'Required field is missing.',
  [TerragruntErrorCode.VAL_INVALID_VALUE]: 'Invalid value for field.',
  [TerragruntErrorCode.VAL_TYPE_ERROR]: 'Type constraint violation.',
  [TerragruntErrorCode.VAL_CONSTRAINT_VIOLATION]: 'Configuration constraint violation.',
  [TerragruntErrorCode.VAL_CONFIG_CONFLICT]: 'Conflicting configuration values.',

  // Internal
  [TerragruntErrorCode.INT_ERROR]: 'An internal parser error occurred.',
  [TerragruntErrorCode.INT_TIMEOUT]: 'Parser operation timed out.',
  [TerragruntErrorCode.INT_MEMORY_EXCEEDED]: 'Memory limit exceeded during parsing.',
  [TerragruntErrorCode.INT_ASSERTION_FAILED]: 'Internal assertion failed.',

  // Edge
  [TerragruntErrorCode.EDGE_ERROR]: 'An error occurred during edge creation.',
  [TerragruntErrorCode.EDGE_INVALID_OPTIONS]: 'Edge options are missing required fields.',
  [TerragruntErrorCode.EDGE_SELF_REFERENTIAL]: 'Edge source and target cannot be the same node.',
  [TerragruntErrorCode.EDGE_INVALID_EVIDENCE]: 'Edge evidence array is invalid or contains invalid items.',
  [TerragruntErrorCode.EDGE_INVALID_CONFIDENCE]: 'Edge confidence score must be between 0 and 100.',
  [TerragruntErrorCode.EDGE_CREATION_FAILED]: 'Failed to create edge from provided options.',
  [TerragruntErrorCode.EDGE_NODE_MAPPING_FAILED]: 'Failed to map node ID for edge creation.',
  [TerragruntErrorCode.EDGE_BATCH_ERRORS]: 'One or more errors occurred during batch edge creation.',

  // Source Resolution
  [TerragruntErrorCode.SRC_ERROR]: 'An error occurred during source resolution.',
  [TerragruntErrorCode.SRC_UNRESOLVABLE]: 'Source expression could not be resolved.',
  [TerragruntErrorCode.SRC_INVALID_PATTERN]: 'Source pattern is invalid or unsupported.',
  [TerragruntErrorCode.SRC_MISSING_CONTEXT]: 'Linker context is missing required parameters.',
  [TerragruntErrorCode.SRC_CIRCULAR_REFERENCE]: 'Circular source reference detected.',
  [TerragruntErrorCode.SRC_LOCAL_NOT_FOUND]: 'Local source path does not exist.',
  [TerragruntErrorCode.SRC_INVALID_OPTIONS]: 'Linker options are invalid.',
};

// ============================================================================
// Error Severity Mapping
// ============================================================================

/**
 * Severity level for each error code
 */
export const TerragruntErrorSeverityMap: Record<TerragruntErrorCodeType, TerragruntErrorSeverity> = {
  // Lexer
  [TerragruntErrorCode.LEX_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.LEX_UNTERMINATED_STRING]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.LEX_UNTERMINATED_HEREDOC]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.LEX_INVALID_CHARACTER]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.LEX_INVALID_NUMBER]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.LEX_UNTERMINATED_COMMENT]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.LEX_INVALID_ESCAPE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.LEX_INVALID_INTERPOLATION]: TerragruntErrorSeverity.ERROR,

  // Syntax
  [TerragruntErrorCode.SYN_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_UNEXPECTED_TOKEN]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_MISSING_TOKEN]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_UNCLOSED_BLOCK]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_UNCLOSED_BRACKET]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_UNCLOSED_PAREN]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_INVALID_BLOCK]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_INVALID_ATTRIBUTE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SYN_INVALID_EXPRESSION]: TerragruntErrorSeverity.ERROR,

  // Block
  [TerragruntErrorCode.BLK_UNKNOWN_TYPE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.BLK_INVALID_TYPE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.BLK_MISSING_ATTRIBUTE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.BLK_INVALID_ATTRIBUTE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.BLK_DUPLICATE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.BLK_MISSING_LABEL]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.BLK_INVALID_LABEL]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.BLK_CONFLICT]: TerragruntErrorSeverity.ERROR,

  // Include
  [TerragruntErrorCode.INC_NOT_FOUND]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.INC_CIRCULAR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.INC_UNRESOLVED_PATH]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.INC_MAX_DEPTH]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.INC_INVALID_PATH]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.INC_MERGE_CONFLICT]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.INC_PARSE_ERROR]: TerragruntErrorSeverity.ERROR,

  // Dependency
  [TerragruntErrorCode.DEP_NOT_FOUND]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.DEP_CIRCULAR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.DEP_UNRESOLVED_PATH]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.DEP_MISSING_CONFIG]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.DEP_INVALID_OUTPUT]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.DEP_VALIDATION_FAILED]: TerragruntErrorSeverity.ERROR,

  // Function
  [TerragruntErrorCode.FN_UNKNOWN]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.FN_INVALID_ARGS]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.FN_TOO_FEW_ARGS]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.FN_TOO_MANY_ARGS]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.FN_INVALID_ARG_TYPE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.FN_EVAL_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.FN_RUNTIME_ERROR]: TerragruntErrorSeverity.ERROR,

  // Reference
  [TerragruntErrorCode.REF_UNDEFINED]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.REF_INVALID_PATH]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.REF_CIRCULAR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.REF_TYPE_MISMATCH]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.REF_OUT_OF_SCOPE]: TerragruntErrorSeverity.ERROR,

  // File System
  [TerragruntErrorCode.FS_NOT_FOUND]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.FS_READ_ERROR]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.FS_TOO_LARGE]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.FS_ENCODING_ERROR]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.FS_PERMISSION_DENIED]: TerragruntErrorSeverity.FATAL,

  // Validation
  [TerragruntErrorCode.VAL_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.VAL_MISSING_REQUIRED]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.VAL_INVALID_VALUE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.VAL_TYPE_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.VAL_CONSTRAINT_VIOLATION]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.VAL_CONFIG_CONFLICT]: TerragruntErrorSeverity.ERROR,

  // Internal
  [TerragruntErrorCode.INT_ERROR]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.INT_TIMEOUT]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.INT_MEMORY_EXCEEDED]: TerragruntErrorSeverity.FATAL,
  [TerragruntErrorCode.INT_ASSERTION_FAILED]: TerragruntErrorSeverity.FATAL,

  // Edge - most are recoverable errors
  [TerragruntErrorCode.EDGE_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.EDGE_INVALID_OPTIONS]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.EDGE_SELF_REFERENTIAL]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.EDGE_INVALID_EVIDENCE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.EDGE_INVALID_CONFIDENCE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.EDGE_CREATION_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.EDGE_NODE_MAPPING_FAILED]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.EDGE_BATCH_ERRORS]: TerragruntErrorSeverity.WARNING,

  // Source Resolution
  [TerragruntErrorCode.SRC_ERROR]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SRC_UNRESOLVABLE]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.SRC_INVALID_PATTERN]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SRC_MISSING_CONTEXT]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SRC_CIRCULAR_REFERENCE]: TerragruntErrorSeverity.ERROR,
  [TerragruntErrorCode.SRC_LOCAL_NOT_FOUND]: TerragruntErrorSeverity.WARNING,
  [TerragruntErrorCode.SRC_INVALID_OPTIONS]: TerragruntErrorSeverity.ERROR,
};

// ============================================================================
// Suggested Actions
// ============================================================================

/**
 * Suggested user actions for each error code
 */
export const TerragruntErrorSuggestion: Record<TerragruntErrorCodeType, string> = {
  // Lexer
  [TerragruntErrorCode.LEX_ERROR]: 'Check the file for invalid characters or syntax.',
  [TerragruntErrorCode.LEX_UNTERMINATED_STRING]: 'Add a closing quote (") to the string.',
  [TerragruntErrorCode.LEX_UNTERMINATED_HEREDOC]: 'Add the closing delimiter on a new line.',
  [TerragruntErrorCode.LEX_INVALID_CHARACTER]: 'Remove or replace the invalid character.',
  [TerragruntErrorCode.LEX_INVALID_NUMBER]: 'Use a valid number format (e.g., 123, 1.5, 1e10).',
  [TerragruntErrorCode.LEX_UNTERMINATED_COMMENT]: 'Add */ to close the block comment.',
  [TerragruntErrorCode.LEX_INVALID_ESCAPE]: 'Use valid escape sequences: \\n, \\t, \\", \\\\.',
  [TerragruntErrorCode.LEX_INVALID_INTERPOLATION]: 'Use ${...} for interpolation.',

  // Syntax
  [TerragruntErrorCode.SYN_ERROR]: 'Review the syntax at the indicated location.',
  [TerragruntErrorCode.SYN_UNEXPECTED_TOKEN]: 'Check for typos or misplaced characters.',
  [TerragruntErrorCode.SYN_MISSING_TOKEN]: 'Add the missing token at the indicated location.',
  [TerragruntErrorCode.SYN_UNCLOSED_BLOCK]: 'Add a closing brace } to the block.',
  [TerragruntErrorCode.SYN_UNCLOSED_BRACKET]: 'Add a closing bracket ] to the array.',
  [TerragruntErrorCode.SYN_UNCLOSED_PAREN]: 'Add a closing parenthesis ) to the expression.',
  [TerragruntErrorCode.SYN_INVALID_BLOCK]: 'Use the format: block_type "label" { ... }.',
  [TerragruntErrorCode.SYN_INVALID_ATTRIBUTE]: 'Use the format: attribute_name = value.',
  [TerragruntErrorCode.SYN_INVALID_EXPRESSION]: 'Review the expression syntax.',

  // Block
  [TerragruntErrorCode.BLK_UNKNOWN_TYPE]: 'Use a valid Terragrunt block type: terraform, include, dependency, locals, remote_state, generate, inputs.',
  [TerragruntErrorCode.BLK_INVALID_TYPE]: 'Check if this block type is allowed in the current context.',
  [TerragruntErrorCode.BLK_MISSING_ATTRIBUTE]: 'Add the required attribute to the block.',
  [TerragruntErrorCode.BLK_INVALID_ATTRIBUTE]: 'Correct the attribute value.',
  [TerragruntErrorCode.BLK_DUPLICATE]: 'Remove the duplicate block or use different labels.',
  [TerragruntErrorCode.BLK_MISSING_LABEL]: 'Add a label to the block (e.g., dependency "name" {}).',
  [TerragruntErrorCode.BLK_INVALID_LABEL]: 'Use a valid identifier as the block label.',
  [TerragruntErrorCode.BLK_CONFLICT]: 'Resolve the conflicting block configurations.',

  // Include
  [TerragruntErrorCode.INC_NOT_FOUND]: 'Verify the include path is correct and the file exists.',
  [TerragruntErrorCode.INC_CIRCULAR]: 'Remove the circular include to break the cycle.',
  [TerragruntErrorCode.INC_UNRESOLVED_PATH]: 'Use an absolute path or find_in_parent_folders().',
  [TerragruntErrorCode.INC_MAX_DEPTH]: 'Reduce include nesting or increase maxIncludeDepth.',
  [TerragruntErrorCode.INC_INVALID_PATH]: 'Use a string literal or path function for the path.',
  [TerragruntErrorCode.INC_MERGE_CONFLICT]: 'Adjust merge_strategy or resolve conflicts manually.',
  [TerragruntErrorCode.INC_PARSE_ERROR]: 'Fix the syntax errors in the included file.',

  // Dependency
  [TerragruntErrorCode.DEP_NOT_FOUND]: 'Verify the config_path points to a valid module.',
  [TerragruntErrorCode.DEP_CIRCULAR]: 'Restructure dependencies to remove the cycle.',
  [TerragruntErrorCode.DEP_UNRESOLVED_PATH]: 'Use an absolute path or path functions.',
  [TerragruntErrorCode.DEP_MISSING_CONFIG]: 'Add terragrunt.hcl to the dependency directory.',
  [TerragruntErrorCode.DEP_INVALID_OUTPUT]: 'Check that the output exists in the dependency.',
  [TerragruntErrorCode.DEP_VALIDATION_FAILED]: 'Review dependency configuration.',

  // Function
  [TerragruntErrorCode.FN_UNKNOWN]: 'Use a valid Terragrunt function name.',
  [TerragruntErrorCode.FN_INVALID_ARGS]: 'Check the function documentation for correct arguments.',
  [TerragruntErrorCode.FN_TOO_FEW_ARGS]: 'Add the required arguments to the function call.',
  [TerragruntErrorCode.FN_TOO_MANY_ARGS]: 'Remove extra arguments from the function call.',
  [TerragruntErrorCode.FN_INVALID_ARG_TYPE]: 'Provide arguments of the correct type.',
  [TerragruntErrorCode.FN_EVAL_ERROR]: 'Check that function inputs are valid.',
  [TerragruntErrorCode.FN_RUNTIME_ERROR]: 'Check environment and runtime conditions.',

  // Reference
  [TerragruntErrorCode.REF_UNDEFINED]: 'Define the variable or check for typos.',
  [TerragruntErrorCode.REF_INVALID_PATH]: 'Use the format: local.name or dependency.name.outputs.key.',
  [TerragruntErrorCode.REF_CIRCULAR]: 'Remove circular reference chains.',
  [TerragruntErrorCode.REF_TYPE_MISMATCH]: 'Ensure the referenced value matches expected type.',
  [TerragruntErrorCode.REF_OUT_OF_SCOPE]: 'Move the reference to an accessible scope.',

  // File System
  [TerragruntErrorCode.FS_NOT_FOUND]: 'Verify the file path is correct.',
  [TerragruntErrorCode.FS_READ_ERROR]: 'Check file permissions and disk availability.',
  [TerragruntErrorCode.FS_TOO_LARGE]: 'Split the file or increase maxFileSize limit.',
  [TerragruntErrorCode.FS_ENCODING_ERROR]: 'Save the file as UTF-8.',
  [TerragruntErrorCode.FS_PERMISSION_DENIED]: 'Check file permissions.',

  // Validation
  [TerragruntErrorCode.VAL_ERROR]: 'Review the validation errors and fix them.',
  [TerragruntErrorCode.VAL_MISSING_REQUIRED]: 'Add the required field.',
  [TerragruntErrorCode.VAL_INVALID_VALUE]: 'Provide a valid value for the field.',
  [TerragruntErrorCode.VAL_TYPE_ERROR]: 'Use the correct type for this field.',
  [TerragruntErrorCode.VAL_CONSTRAINT_VIOLATION]: 'Ensure the value meets constraints.',
  [TerragruntErrorCode.VAL_CONFIG_CONFLICT]: 'Resolve the conflicting configurations.',

  // Internal
  [TerragruntErrorCode.INT_ERROR]: 'Report this issue if it persists.',
  [TerragruntErrorCode.INT_TIMEOUT]: 'Simplify the configuration or increase timeout.',
  [TerragruntErrorCode.INT_MEMORY_EXCEEDED]: 'Reduce file size or configuration complexity.',
  [TerragruntErrorCode.INT_ASSERTION_FAILED]: 'Report this issue with the configuration.',

  // Edge
  [TerragruntErrorCode.EDGE_ERROR]: 'Review the edge creation inputs and try again.',
  [TerragruntErrorCode.EDGE_INVALID_OPTIONS]: 'Ensure sourceNodeId, targetNodeId, and required fields are provided.',
  [TerragruntErrorCode.EDGE_SELF_REFERENTIAL]: 'Change source or target to different node IDs.',
  [TerragruntErrorCode.EDGE_INVALID_EVIDENCE]: 'Ensure evidence array contains valid items with file, line, and confidence.',
  [TerragruntErrorCode.EDGE_INVALID_CONFIDENCE]: 'Use a confidence score between 0 and 100.',
  [TerragruntErrorCode.EDGE_CREATION_FAILED]: 'Check edge options match expected types and formats.',
  [TerragruntErrorCode.EDGE_NODE_MAPPING_FAILED]: 'Verify source/target paths exist in the graph.',
  [TerragruntErrorCode.EDGE_BATCH_ERRORS]: 'Review individual error details for each failed edge.',

  // Source Resolution
  [TerragruntErrorCode.SRC_ERROR]: 'Review the terraform.source expression.',
  [TerragruntErrorCode.SRC_UNRESOLVABLE]: 'Check the source path or URL is correct and accessible.',
  [TerragruntErrorCode.SRC_INVALID_PATTERN]: 'Use a valid Terraform source format (local, git, registry, etc.).',
  [TerragruntErrorCode.SRC_MISSING_CONTEXT]: 'Provide scanId, tenantId, configPath, and repositoryRoot.',
  [TerragruntErrorCode.SRC_CIRCULAR_REFERENCE]: 'Remove circular source references between modules.',
  [TerragruntErrorCode.SRC_LOCAL_NOT_FOUND]: 'Verify the local module path exists relative to config.',
  [TerragruntErrorCode.SRC_INVALID_OPTIONS]: 'Check linker options for valid idGenerator and normalizePaths.',
};

// ============================================================================
// Recoverability Mapping
// ============================================================================

/**
 * Whether each error allows continued parsing (error recovery)
 */
export const TerragruntErrorRecoverable: Record<TerragruntErrorCodeType, boolean> = {
  // Lexer - most can be skipped
  [TerragruntErrorCode.LEX_ERROR]: true,
  [TerragruntErrorCode.LEX_UNTERMINATED_STRING]: true,
  [TerragruntErrorCode.LEX_UNTERMINATED_HEREDOC]: true,
  [TerragruntErrorCode.LEX_INVALID_CHARACTER]: true,
  [TerragruntErrorCode.LEX_INVALID_NUMBER]: true,
  [TerragruntErrorCode.LEX_UNTERMINATED_COMMENT]: true,
  [TerragruntErrorCode.LEX_INVALID_ESCAPE]: true,
  [TerragruntErrorCode.LEX_INVALID_INTERPOLATION]: true,

  // Syntax - can skip malformed constructs
  [TerragruntErrorCode.SYN_ERROR]: true,
  [TerragruntErrorCode.SYN_UNEXPECTED_TOKEN]: true,
  [TerragruntErrorCode.SYN_MISSING_TOKEN]: true,
  [TerragruntErrorCode.SYN_UNCLOSED_BLOCK]: true,
  [TerragruntErrorCode.SYN_UNCLOSED_BRACKET]: true,
  [TerragruntErrorCode.SYN_UNCLOSED_PAREN]: true,
  [TerragruntErrorCode.SYN_INVALID_BLOCK]: true,
  [TerragruntErrorCode.SYN_INVALID_ATTRIBUTE]: true,
  [TerragruntErrorCode.SYN_INVALID_EXPRESSION]: true,

  // Block - can skip invalid blocks
  [TerragruntErrorCode.BLK_UNKNOWN_TYPE]: true,
  [TerragruntErrorCode.BLK_INVALID_TYPE]: true,
  [TerragruntErrorCode.BLK_MISSING_ATTRIBUTE]: true,
  [TerragruntErrorCode.BLK_INVALID_ATTRIBUTE]: true,
  [TerragruntErrorCode.BLK_DUPLICATE]: true,
  [TerragruntErrorCode.BLK_MISSING_LABEL]: true,
  [TerragruntErrorCode.BLK_INVALID_LABEL]: true,
  [TerragruntErrorCode.BLK_CONFLICT]: true,

  // Include - can continue without resolved includes
  [TerragruntErrorCode.INC_NOT_FOUND]: true,
  [TerragruntErrorCode.INC_CIRCULAR]: true,
  [TerragruntErrorCode.INC_UNRESOLVED_PATH]: true,
  [TerragruntErrorCode.INC_MAX_DEPTH]: true,
  [TerragruntErrorCode.INC_INVALID_PATH]: true,
  [TerragruntErrorCode.INC_MERGE_CONFLICT]: true,
  [TerragruntErrorCode.INC_PARSE_ERROR]: true,

  // Dependency - can continue without resolved dependencies
  [TerragruntErrorCode.DEP_NOT_FOUND]: true,
  [TerragruntErrorCode.DEP_CIRCULAR]: true,
  [TerragruntErrorCode.DEP_UNRESOLVED_PATH]: true,
  [TerragruntErrorCode.DEP_MISSING_CONFIG]: true,
  [TerragruntErrorCode.DEP_INVALID_OUTPUT]: true,
  [TerragruntErrorCode.DEP_VALIDATION_FAILED]: true,

  // Function - can mark as unresolved
  [TerragruntErrorCode.FN_UNKNOWN]: true,
  [TerragruntErrorCode.FN_INVALID_ARGS]: true,
  [TerragruntErrorCode.FN_TOO_FEW_ARGS]: true,
  [TerragruntErrorCode.FN_TOO_MANY_ARGS]: true,
  [TerragruntErrorCode.FN_INVALID_ARG_TYPE]: true,
  [TerragruntErrorCode.FN_EVAL_ERROR]: true,
  [TerragruntErrorCode.FN_RUNTIME_ERROR]: true,

  // Reference - can mark as unresolved
  [TerragruntErrorCode.REF_UNDEFINED]: true,
  [TerragruntErrorCode.REF_INVALID_PATH]: true,
  [TerragruntErrorCode.REF_CIRCULAR]: true,
  [TerragruntErrorCode.REF_TYPE_MISMATCH]: true,
  [TerragruntErrorCode.REF_OUT_OF_SCOPE]: true,

  // File System - cannot recover from file errors
  [TerragruntErrorCode.FS_NOT_FOUND]: false,
  [TerragruntErrorCode.FS_READ_ERROR]: false,
  [TerragruntErrorCode.FS_TOO_LARGE]: false,
  [TerragruntErrorCode.FS_ENCODING_ERROR]: false,
  [TerragruntErrorCode.FS_PERMISSION_DENIED]: false,

  // Validation - can continue with warnings
  [TerragruntErrorCode.VAL_ERROR]: true,
  [TerragruntErrorCode.VAL_MISSING_REQUIRED]: true,
  [TerragruntErrorCode.VAL_INVALID_VALUE]: true,
  [TerragruntErrorCode.VAL_TYPE_ERROR]: true,
  [TerragruntErrorCode.VAL_CONSTRAINT_VIOLATION]: true,
  [TerragruntErrorCode.VAL_CONFIG_CONFLICT]: true,

  // Internal - cannot recover from internal errors
  [TerragruntErrorCode.INT_ERROR]: false,
  [TerragruntErrorCode.INT_TIMEOUT]: false,
  [TerragruntErrorCode.INT_MEMORY_EXCEEDED]: false,
  [TerragruntErrorCode.INT_ASSERTION_FAILED]: false,

  // Edge - most edge errors are recoverable (skip bad edge, continue)
  [TerragruntErrorCode.EDGE_ERROR]: true,
  [TerragruntErrorCode.EDGE_INVALID_OPTIONS]: true,
  [TerragruntErrorCode.EDGE_SELF_REFERENTIAL]: true,
  [TerragruntErrorCode.EDGE_INVALID_EVIDENCE]: true,
  [TerragruntErrorCode.EDGE_INVALID_CONFIDENCE]: true,
  [TerragruntErrorCode.EDGE_CREATION_FAILED]: true,
  [TerragruntErrorCode.EDGE_NODE_MAPPING_FAILED]: true,
  [TerragruntErrorCode.EDGE_BATCH_ERRORS]: true,

  // Source Resolution - most are recoverable
  [TerragruntErrorCode.SRC_ERROR]: true,
  [TerragruntErrorCode.SRC_UNRESOLVABLE]: true,
  [TerragruntErrorCode.SRC_INVALID_PATTERN]: true,
  [TerragruntErrorCode.SRC_MISSING_CONTEXT]: false, // Cannot continue without context
  [TerragruntErrorCode.SRC_CIRCULAR_REFERENCE]: true,
  [TerragruntErrorCode.SRC_LOCAL_NOT_FOUND]: true,
  [TerragruntErrorCode.SRC_INVALID_OPTIONS]: false, // Cannot continue with bad options
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get complete error info for an error code
 */
export interface TerragruntErrorInfo {
  code: TerragruntErrorCodeType;
  message: string;
  severity: TerragruntErrorSeverity;
  suggestion: string;
  recoverable: boolean;
}

/**
 * Get all error information for a given code
 */
export function getTerragruntErrorInfo(code: TerragruntErrorCodeType): TerragruntErrorInfo {
  return {
    code,
    message: TerragruntErrorMessage[code],
    severity: TerragruntErrorSeverityMap[code],
    suggestion: TerragruntErrorSuggestion[code],
    recoverable: TerragruntErrorRecoverable[code],
  };
}

/**
 * Check if an error code is a lexer error
 */
export function isLexerError(code: string): boolean {
  return code.startsWith('TG_LEX_');
}

/**
 * Check if an error code is a syntax error
 */
export function isSyntaxError(code: string): boolean {
  return code.startsWith('TG_SYN_');
}

/**
 * Check if an error code is a block error
 */
export function isBlockError(code: string): boolean {
  return code.startsWith('TG_BLK_');
}

/**
 * Check if an error code is an include error
 */
export function isIncludeError(code: string): boolean {
  return code.startsWith('TG_INC_');
}

/**
 * Check if an error code is a dependency error
 */
export function isDependencyError(code: string): boolean {
  return code.startsWith('TG_DEP_');
}

/**
 * Check if an error code is a function error
 */
export function isFunctionError(code: string): boolean {
  return code.startsWith('TG_FN_');
}

/**
 * Check if an error code is an edge error
 */
export function isEdgeError(code: string): boolean {
  return code.startsWith('TG_EDGE_');
}

/**
 * Check if an error code is a source resolution error
 */
export function isSourceError(code: string): boolean {
  return code.startsWith('TG_SRC_');
}

/**
 * Check if an error code is recoverable
 */
export function isRecoverableError(code: TerragruntErrorCodeType): boolean {
  return TerragruntErrorRecoverable[code];
}

/**
 * Get error codes by severity
 */
export function getErrorCodesBySeverity(severity: TerragruntErrorSeverity): TerragruntErrorCodeType[] {
  return Object.entries(TerragruntErrorSeverityMap)
    .filter(([, s]) => s === severity)
    .map(([code]) => code as TerragruntErrorCodeType);
}

/**
 * Get all recoverable error codes
 */
export function getRecoverableErrorCodes(): TerragruntErrorCodeType[] {
  return Object.entries(TerragruntErrorRecoverable)
    .filter(([, recoverable]) => recoverable)
    .map(([code]) => code as TerragruntErrorCodeType);
}
