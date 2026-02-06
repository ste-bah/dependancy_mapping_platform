/**
 * Terragrunt Parser Error Classes
 * @module parsers/terragrunt/errors/errors
 *
 * Comprehensive error class hierarchy for Terragrunt HCL parsing.
 * Provides structured errors with source locations, suggestions,
 * and error chaining support.
 *
 * TASK-TG-001: Error handling for Terragrunt HCL parsing
 */

import { SourceLocation } from '../../terraform/types';
import {
  TerragruntErrorCode,
  TerragruntErrorCodeType,
  TerragruntErrorSeverity,
  TerragruntErrorMessage,
  TerragruntErrorSeverityMap,
  TerragruntErrorSuggestion,
  TerragruntErrorRecoverable,
} from './error-codes';

// ============================================================================
// Error Context Interface
// ============================================================================

/**
 * Additional context for errors
 */
export interface TerragruntErrorContext {
  /** Original cause of the error */
  cause?: Error;
  /** Source location in file */
  location?: SourceLocation;
  /** Additional details */
  details?: Record<string, unknown>;
  /** File path where error occurred */
  filePath?: string;
  /** Block type if error is block-related */
  blockType?: string;
  /** Function name if error is function-related */
  functionName?: string;
  /** Include/dependency path if resolution error */
  resolutionPath?: string;
}

/**
 * Serialized error format for JSON responses
 */
export interface SerializedTerragruntError {
  name: string;
  message: string;
  code: string;
  severity: string;
  location?: {
    file: string;
    lineStart: number;
    lineEnd: number;
    columnStart: number;
    columnEnd: number;
  };
  suggestion?: string;
  recoverable: boolean;
  details?: Record<string, unknown>;
  cause?: string;
  stack?: string;
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all Terragrunt parser errors.
 *
 * Features:
 * - Error codes for programmatic handling
 * - Source location tracking
 * - User-friendly suggestions
 * - Error chaining support
 * - JSON serialization
 *
 * @example
 * ```typescript
 * const error = new TerragruntParseError(
 *   'Unterminated string',
 *   TerragruntErrorCode.LEX_UNTERMINATED_STRING,
 *   { location: { file: 'terragrunt.hcl', lineStart: 10, ... } }
 * );
 * console.log(error.toUserMessage());
 * ```
 */
export class TerragruntParseError extends Error {
  /** Error code for programmatic handling */
  public readonly code: TerragruntErrorCodeType;

  /** Error severity level */
  public readonly severity: TerragruntErrorSeverity;

  /** Source location in file */
  public readonly location: SourceLocation | null;

  /** Whether parsing can continue after this error */
  public readonly recoverable: boolean;

  /** User-friendly suggestion for fixing the error */
  public readonly suggestion: string;

  /** Additional context data */
  public readonly context: TerragruntErrorContext;

  /** Timestamp when error was created */
  public readonly timestamp: Date;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.SYN_ERROR,
    context: TerragruntErrorContext = {}
  ) {
    super(message);
    this.name = 'TerragruntParseError';
    this.code = code;
    this.severity = TerragruntErrorSeverityMap[code];
    this.location = context.location ?? null;
    this.recoverable = TerragruntErrorRecoverable[code];
    this.suggestion = TerragruntErrorSuggestion[code];
    this.context = context;
    this.timestamp = new Date();

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Get the underlying cause if error was chained
   */
  get cause(): Error | undefined {
    return this.context.cause;
  }

  /**
   * Create a user-friendly error message with location
   */
  toUserMessage(): string {
    const parts: string[] = [];

    // Error code and message
    parts.push(`[${this.code}] ${this.message}`);

    // Location info
    if (this.location) {
      const loc = `${this.location.file}:${this.location.lineStart}:${this.location.columnStart}`;
      parts.push(`  at ${loc}`);
    }

    // Suggestion
    if (this.suggestion) {
      parts.push(`  Suggestion: ${this.suggestion}`);
    }

    return parts.join('\n');
  }

  /**
   * Create a formatted source snippet showing error location
   */
  toSourceSnippet(source: string, contextLines: number = 2): string {
    if (!this.location) {
      return '';
    }

    const lines = source.split('\n');
    const errorLine = this.location.lineStart;
    const startLine = Math.max(1, errorLine - contextLines);
    const endLine = Math.min(lines.length, errorLine + contextLines);

    const snippetLines: string[] = [];
    const lineNumWidth = String(endLine).length;

    for (let i = startLine; i <= endLine; i++) {
      const lineContent = lines[i - 1] ?? '';
      const lineNum = String(i).padStart(lineNumWidth, ' ');
      const marker = i === errorLine ? '>' : ' ';

      snippetLines.push(`${marker} ${lineNum} | ${lineContent}`);

      // Add error indicator
      if (i === errorLine && this.location.columnStart > 0) {
        const padding = ' '.repeat(lineNumWidth + 4 + this.location.columnStart - 1);
        const underline = '^'.repeat(
          Math.max(1, (this.location.columnEnd ?? this.location.columnStart) - this.location.columnStart + 1)
        );
        snippetLines.push(`  ${' '.repeat(lineNumWidth)} | ${padding}${underline}`);
      }
    }

    return snippetLines.join('\n');
  }

  /**
   * Serialize to JSON for API responses
   */
  toJSON(): SerializedTerragruntError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      location: this.location ? {
        file: this.location.file,
        lineStart: this.location.lineStart,
        lineEnd: this.location.lineEnd,
        columnStart: this.location.columnStart,
        columnEnd: this.location.columnEnd,
      } : undefined,
      suggestion: this.suggestion,
      recoverable: this.recoverable,
      details: this.context.details,
      cause: this.context.cause?.message,
    };
  }

  /**
   * Create a safe response object (no sensitive data or stack)
   */
  toSafeResponse(): SerializedTerragruntError {
    const json = this.toJSON();
    // Remove potentially sensitive details
    const safeDetails = json.details ? { ...json.details } : undefined;
    if (safeDetails) {
      delete safeDetails['internalError'];
      delete safeDetails['stackTrace'];
    }
    return {
      ...json,
      details: safeDetails,
    };
  }

  /**
   * Get the error chain as an array
   */
  getErrorChain(): Error[] {
    const chain: Error[] = [this];
    let current: Error | undefined = this.context.cause;
    while (current) {
      chain.push(current);
      current = current instanceof TerragruntParseError ? current.context.cause : undefined;
    }
    return chain;
  }

  /**
   * Get the root cause of the error
   */
  getRootCause(): Error {
    const chain = this.getErrorChain();
    return chain[chain.length - 1];
  }

  /**
   * String representation for logging
   */
  toString(): string {
    let result = `${this.name} [${this.code}]: ${this.message}`;
    if (this.location) {
      result += ` (${this.location.file}:${this.location.lineStart}:${this.location.columnStart})`;
    }
    return result;
  }

  /**
   * Create error with updated context
   */
  withContext(additionalContext: Partial<TerragruntErrorContext>): TerragruntParseError {
    return new TerragruntParseError(
      this.message,
      this.code,
      { ...this.context, ...additionalContext }
    );
  }

  /**
   * Create error with location
   */
  withLocation(location: SourceLocation): TerragruntParseError {
    return this.withContext({ location });
  }
}

// ============================================================================
// Specialized Error Classes
// ============================================================================

/**
 * Error during lexical analysis (tokenization)
 */
export class LexerError extends TerragruntParseError {
  /** Position in source where error occurred */
  public readonly position: number;

  /** Character that caused the error */
  public readonly character?: string;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.LEX_ERROR,
    position: number = 0,
    context: TerragruntErrorContext & { character?: string } = {}
  ) {
    super(message, code, context);
    this.name = 'LexerError';
    this.position = position;
    this.character = context.character;
  }

  /**
   * Create unterminated string error
   */
  static unterminatedString(
    startLine: number,
    startColumn: number,
    filePath: string
  ): LexerError {
    return new LexerError(
      'Unterminated string literal',
      TerragruntErrorCode.LEX_UNTERMINATED_STRING,
      0,
      {
        location: {
          file: filePath,
          lineStart: startLine,
          lineEnd: startLine,
          columnStart: startColumn,
          columnEnd: startColumn,
        },
      }
    );
  }

  /**
   * Create unterminated heredoc error
   */
  static unterminatedHeredoc(
    delimiter: string,
    startLine: number,
    startColumn: number,
    filePath: string
  ): LexerError {
    return new LexerError(
      `Unterminated heredoc: expected closing '${delimiter}'`,
      TerragruntErrorCode.LEX_UNTERMINATED_HEREDOC,
      0,
      {
        location: {
          file: filePath,
          lineStart: startLine,
          lineEnd: startLine,
          columnStart: startColumn,
          columnEnd: startColumn,
        },
        details: { delimiter },
      }
    );
  }

  /**
   * Create invalid character error
   */
  static invalidCharacter(
    char: string,
    line: number,
    column: number,
    filePath: string
  ): LexerError {
    return new LexerError(
      `Invalid character: '${char}'`,
      TerragruntErrorCode.LEX_INVALID_CHARACTER,
      0,
      {
        location: {
          file: filePath,
          lineStart: line,
          lineEnd: line,
          columnStart: column,
          columnEnd: column,
        },
        character: char,
      }
    );
  }
}

/**
 * Error during block parsing
 */
export class BlockParseError extends TerragruntParseError {
  /** Block type that caused the error */
  public readonly blockType: string;

  /** Block label if applicable */
  public readonly blockLabel?: string;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.BLK_INVALID_TYPE,
    blockType: string,
    context: TerragruntErrorContext & { blockLabel?: string } = {}
  ) {
    super(message, code, { ...context, blockType });
    this.name = 'BlockParseError';
    this.blockType = blockType;
    this.blockLabel = context.blockLabel;
  }

  /**
   * Create unknown block type error
   */
  static unknownType(
    blockType: string,
    location: SourceLocation
  ): BlockParseError {
    return new BlockParseError(
      `Unknown block type: '${blockType}'`,
      TerragruntErrorCode.BLK_UNKNOWN_TYPE,
      blockType,
      { location }
    );
  }

  /**
   * Create missing required attribute error
   */
  static missingAttribute(
    blockType: string,
    attributeName: string,
    location: SourceLocation
  ): BlockParseError {
    return new BlockParseError(
      `Block '${blockType}' is missing required attribute '${attributeName}'`,
      TerragruntErrorCode.BLK_MISSING_ATTRIBUTE,
      blockType,
      {
        location,
        details: { missingAttribute: attributeName },
      }
    );
  }

  /**
   * Create missing label error
   */
  static missingLabel(
    blockType: string,
    location: SourceLocation
  ): BlockParseError {
    return new BlockParseError(
      `Block '${blockType}' requires a label`,
      TerragruntErrorCode.BLK_MISSING_LABEL,
      blockType,
      { location }
    );
  }

  /**
   * Create duplicate block error
   */
  static duplicate(
    blockType: string,
    label: string | undefined,
    location: SourceLocation,
    firstLocation: SourceLocation
  ): BlockParseError {
    const blockDesc = label ? `${blockType} "${label}"` : blockType;
    return new BlockParseError(
      `Duplicate block: '${blockDesc}' already defined at line ${firstLocation.lineStart}`,
      TerragruntErrorCode.BLK_DUPLICATE,
      blockType,
      {
        location,
        blockLabel: label,
        details: { firstLocation },
      }
    );
  }
}

/**
 * Error during include resolution
 */
export class IncludeResolutionError extends TerragruntParseError {
  /** Path that failed to resolve */
  public readonly includePath: string;

  /** Include label if named include */
  public readonly includeLabel?: string;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.INC_NOT_FOUND,
    includePath: string,
    context: TerragruntErrorContext & { includeLabel?: string } = {}
  ) {
    super(message, code, { ...context, resolutionPath: includePath });
    this.name = 'IncludeResolutionError';
    this.includePath = includePath;
    this.includeLabel = context.includeLabel;
  }

  /**
   * Create include not found error
   */
  static notFound(
    path: string,
    location: SourceLocation,
    label?: string
  ): IncludeResolutionError {
    const labelPart = label ? ` "${label}"` : '';
    return new IncludeResolutionError(
      `Include${labelPart} file not found: ${path}`,
      TerragruntErrorCode.INC_NOT_FOUND,
      path,
      { location, includeLabel: label }
    );
  }

  /**
   * Create circular include error
   */
  static circular(
    path: string,
    chain: string[],
    location: SourceLocation
  ): IncludeResolutionError {
    const chainStr = chain.join(' -> ') + ' -> ' + path;
    return new IncludeResolutionError(
      `Circular include detected: ${chainStr}`,
      TerragruntErrorCode.INC_CIRCULAR,
      path,
      {
        location,
        details: { includeChain: chain },
      }
    );
  }

  /**
   * Create max depth exceeded error
   */
  static maxDepthExceeded(
    path: string,
    depth: number,
    maxDepth: number,
    location: SourceLocation
  ): IncludeResolutionError {
    return new IncludeResolutionError(
      `Include depth ${depth} exceeds maximum ${maxDepth}: ${path}`,
      TerragruntErrorCode.INC_MAX_DEPTH,
      path,
      {
        location,
        details: { depth, maxDepth },
      }
    );
  }
}

/**
 * Error during dependency resolution
 */
export class DependencyResolutionError extends TerragruntParseError {
  /** Dependency name */
  public readonly dependencyName: string;

  /** Dependency config path */
  public readonly configPath: string;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.DEP_NOT_FOUND,
    dependencyName: string,
    configPath: string,
    context: TerragruntErrorContext = {}
  ) {
    super(message, code, { ...context, resolutionPath: configPath });
    this.name = 'DependencyResolutionError';
    this.dependencyName = dependencyName;
    this.configPath = configPath;
  }

  /**
   * Create dependency not found error
   */
  static notFound(
    name: string,
    path: string,
    location: SourceLocation
  ): DependencyResolutionError {
    return new DependencyResolutionError(
      `Dependency '${name}' not found at: ${path}`,
      TerragruntErrorCode.DEP_NOT_FOUND,
      name,
      path,
      { location }
    );
  }

  /**
   * Create circular dependency error
   */
  static circular(
    name: string,
    path: string,
    chain: string[],
    location: SourceLocation
  ): DependencyResolutionError {
    const chainStr = chain.join(' -> ') + ' -> ' + name;
    return new DependencyResolutionError(
      `Circular dependency detected: ${chainStr}`,
      TerragruntErrorCode.DEP_CIRCULAR,
      name,
      path,
      {
        location,
        details: { dependencyChain: chain },
      }
    );
  }
}

/**
 * Error during function parsing or validation
 */
export class FunctionParseError extends TerragruntParseError {
  /** Function name */
  public readonly functionName: string;

  /** Number of arguments provided */
  public readonly argCount: number;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.FN_UNKNOWN,
    functionName: string,
    argCount: number = 0,
    context: TerragruntErrorContext = {}
  ) {
    super(message, code, { ...context, functionName });
    this.name = 'FunctionParseError';
    this.functionName = functionName;
    this.argCount = argCount;
  }

  /**
   * Create unknown function error with suggestions
   */
  static unknown(
    name: string,
    similarFunctions: string[],
    location: SourceLocation | null
  ): FunctionParseError {
    let message = `Unknown function: '${name}'`;
    if (similarFunctions.length > 0) {
      message += `. Did you mean: ${similarFunctions.join(', ')}?`;
    }
    return new FunctionParseError(
      message,
      TerragruntErrorCode.FN_UNKNOWN,
      name,
      0,
      {
        location: location ?? undefined,
        details: { suggestions: similarFunctions },
      }
    );
  }

  /**
   * Create too few arguments error
   */
  static tooFewArgs(
    name: string,
    minArgs: number,
    actualArgs: number,
    location: SourceLocation | null
  ): FunctionParseError {
    return new FunctionParseError(
      `Function '${name}' requires at least ${minArgs} argument(s), but got ${actualArgs}`,
      TerragruntErrorCode.FN_TOO_FEW_ARGS,
      name,
      actualArgs,
      {
        location: location ?? undefined,
        details: { minArgs, actualArgs },
      }
    );
  }

  /**
   * Create too many arguments error
   */
  static tooManyArgs(
    name: string,
    maxArgs: number,
    actualArgs: number,
    location: SourceLocation | null
  ): FunctionParseError {
    return new FunctionParseError(
      `Function '${name}' accepts at most ${maxArgs} argument(s), but got ${actualArgs}`,
      TerragruntErrorCode.FN_TOO_MANY_ARGS,
      name,
      actualArgs,
      {
        location: location ?? undefined,
        details: { maxArgs, actualArgs },
      }
    );
  }
}

/**
 * Error during validation
 */
export class ValidationError extends TerragruntParseError {
  /** Field that failed validation */
  public readonly field?: string;

  /** Expected value/type */
  public readonly expected?: string;

  /** Actual value/type */
  public readonly actual?: string;

  constructor(
    message: string,
    code: TerragruntErrorCodeType = TerragruntErrorCode.VAL_ERROR,
    context: TerragruntErrorContext & {
      field?: string;
      expected?: string;
      actual?: string;
    } = {}
  ) {
    super(message, code, context);
    this.name = 'ValidationError';
    this.field = context.field;
    this.expected = context.expected;
    this.actual = context.actual;
  }

  /**
   * Create missing required field error
   */
  static missingRequired(
    field: string,
    location: SourceLocation
  ): ValidationError {
    return new ValidationError(
      `Required field '${field}' is missing`,
      TerragruntErrorCode.VAL_MISSING_REQUIRED,
      { field, location }
    );
  }

  /**
   * Create invalid value error
   */
  static invalidValue(
    field: string,
    expected: string,
    actual: string,
    location: SourceLocation
  ): ValidationError {
    return new ValidationError(
      `Invalid value for '${field}': expected ${expected}, got ${actual}`,
      TerragruntErrorCode.VAL_INVALID_VALUE,
      { field, expected, actual, location }
    );
  }

  /**
   * Create type error
   */
  static typeError(
    field: string,
    expectedType: string,
    actualType: string,
    location: SourceLocation
  ): ValidationError {
    return new ValidationError(
      `Type error for '${field}': expected ${expectedType}, got ${actualType}`,
      TerragruntErrorCode.VAL_TYPE_ERROR,
      {
        field,
        expected: expectedType,
        actual: actualType,
        location,
      }
    );
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a TerragruntParseError
 */
export function isTerragruntParseError(error: unknown): error is TerragruntParseError {
  return error instanceof TerragruntParseError;
}

/**
 * Check if an error is a LexerError
 */
export function isLexerError(error: unknown): error is LexerError {
  return error instanceof LexerError;
}

/**
 * Check if an error is a BlockParseError
 */
export function isBlockParseError(error: unknown): error is BlockParseError {
  return error instanceof BlockParseError;
}

/**
 * Check if an error is an IncludeResolutionError
 */
export function isIncludeResolutionError(error: unknown): error is IncludeResolutionError {
  return error instanceof IncludeResolutionError;
}

/**
 * Check if an error is a DependencyResolutionError
 */
export function isDependencyResolutionError(error: unknown): error is DependencyResolutionError {
  return error instanceof DependencyResolutionError;
}

/**
 * Check if an error is a FunctionParseError
 */
export function isFunctionParseError(error: unknown): error is FunctionParseError {
  return error instanceof FunctionParseError;
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

// ============================================================================
// Error Factory Functions
// ============================================================================

/**
 * Create a TerragruntParseError from an unknown error
 */
export function wrapError(
  error: unknown,
  defaultCode: TerragruntErrorCodeType = TerragruntErrorCode.INT_ERROR,
  context: TerragruntErrorContext = {}
): TerragruntParseError {
  if (error instanceof TerragruntParseError) {
    return error.withContext(context);
  }

  const cause = error instanceof Error ? error : new Error(String(error));
  const message = cause.message || 'An unknown error occurred';

  return new TerragruntParseError(message, defaultCode, {
    ...context,
    cause,
  });
}

/**
 * Create an error with code from error code
 */
export function createError(
  code: TerragruntErrorCodeType,
  context: TerragruntErrorContext = {}
): TerragruntParseError {
  return new TerragruntParseError(
    TerragruntErrorMessage[code],
    code,
    context
  );
}

// ============================================================================
// Error Collection
// ============================================================================

/**
 * Collection of errors during parsing
 */
export class ErrorCollection {
  private readonly errors: TerragruntParseError[] = [];
  private readonly maxErrors: number;

  constructor(maxErrors: number = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Add an error to the collection
   */
  add(error: TerragruntParseError): void {
    if (this.errors.length < this.maxErrors) {
      this.errors.push(error);
    }
  }

  /**
   * Check if collection has errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if collection has fatal errors
   */
  hasFatalErrors(): boolean {
    return this.errors.some(e => e.severity === TerragruntErrorSeverity.FATAL);
  }

  /**
   * Check if collection has non-recoverable errors
   */
  hasNonRecoverableErrors(): boolean {
    return this.errors.some(e => !e.recoverable);
  }

  /**
   * Get all errors
   */
  getAll(): readonly TerragruntParseError[] {
    return this.errors;
  }

  /**
   * Get errors by severity
   */
  getBySeverity(severity: TerragruntErrorSeverity): TerragruntParseError[] {
    return this.errors.filter(e => e.severity === severity);
  }

  /**
   * Get error count
   */
  get count(): number {
    return this.errors.length;
  }

  /**
   * Check if max errors reached
   */
  get isFull(): boolean {
    return this.errors.length >= this.maxErrors;
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors.length = 0;
  }

  /**
   * Serialize all errors to JSON
   */
  toJSON(): SerializedTerragruntError[] {
    return this.errors.map(e => e.toJSON());
  }
}
