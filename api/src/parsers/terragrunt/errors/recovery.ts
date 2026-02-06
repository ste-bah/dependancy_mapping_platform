/**
 * Terragrunt Parser Error Recovery Strategies
 * @module parsers/terragrunt/errors/recovery
 *
 * Recovery mechanisms for Terragrunt HCL parsing:
 * - Skip malformed blocks/tokens
 * - Continue on include failures
 * - Partial parse result handling
 * - Error recovery mode control
 *
 * TASK-TG-001: Error recovery for Terragrunt HCL parsing
 */

import { SourceLocation } from '../../terraform/types';
import {
  TerragruntParseError,
  LexerError,
  BlockParseError,
  IncludeResolutionError,
  DependencyResolutionError,
  ErrorCollection,
} from './errors';
import {
  TerragruntErrorCode,
  TerragruntErrorCodeType,
  TerragruntErrorSeverity,
  TerragruntErrorRecoverable,
} from './error-codes';

// ============================================================================
// Recovery Options
// ============================================================================

/**
 * Configuration for error recovery behavior
 */
export interface RecoveryOptions {
  /** Enable error recovery mode (default: true) */
  enabled: boolean;
  /** Maximum errors before aborting (default: 100) */
  maxErrors: number;
  /** Skip malformed blocks and continue (default: true) */
  skipMalformedBlocks: boolean;
  /** Continue on include resolution failures (default: true) */
  continueOnIncludeFailure: boolean;
  /** Continue on dependency resolution failures (default: true) */
  continueOnDependencyFailure: boolean;
  /** Skip unknown block types (default: true) */
  skipUnknownBlocks: boolean;
  /** Collect warnings in addition to errors (default: true) */
  collectWarnings: boolean;
  /** Maximum recovery attempts per error (default: 3) */
  maxRecoveryAttempts: number;
  /** Recovery strategy for lexer errors */
  lexerRecovery: 'skip' | 'insert' | 'replace';
  /** Recovery strategy for block errors */
  blockRecovery: 'skip' | 'empty' | 'partial';
}

/**
 * Default recovery options
 */
export const DEFAULT_RECOVERY_OPTIONS: RecoveryOptions = {
  enabled: true,
  maxErrors: 100,
  skipMalformedBlocks: true,
  continueOnIncludeFailure: true,
  continueOnDependencyFailure: true,
  skipUnknownBlocks: true,
  collectWarnings: true,
  maxRecoveryAttempts: 3,
  lexerRecovery: 'skip',
  blockRecovery: 'skip',
};

// ============================================================================
// Recovery State
// ============================================================================

/**
 * Track recovery state during parsing
 */
export interface RecoveryState {
  /** Current recovery mode */
  inRecovery: boolean;
  /** Number of errors encountered */
  errorCount: number;
  /** Number of recovery attempts */
  recoveryAttempts: number;
  /** Skipped ranges (for source mapping) */
  skippedRanges: SourceRange[];
  /** Last error that triggered recovery */
  lastError: TerragruntParseError | null;
  /** Recovery points for backtracking */
  recoveryPoints: RecoveryPoint[];
}

/**
 * Range in source that was skipped
 */
export interface SourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
  reason: string;
}

/**
 * Point in parser state for recovery
 */
export interface RecoveryPoint {
  /** Position in token stream */
  position: number;
  /** Parser state at this point */
  state: string;
  /** Errors collected before this point */
  errorCount: number;
}

/**
 * Create initial recovery state
 */
export function createRecoveryState(): RecoveryState {
  return {
    inRecovery: false,
    errorCount: 0,
    recoveryAttempts: 0,
    skippedRanges: [],
    lastError: null,
    recoveryPoints: [],
  };
}

// ============================================================================
// Recovery Strategy Interface
// ============================================================================

/**
 * Result of a recovery attempt
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Number of tokens/characters skipped */
  skipped: number;
  /** Error that was recovered from */
  error: TerragruntParseError;
  /** Recovery method used */
  method: RecoveryMethod;
  /** New position after recovery */
  newPosition?: number;
  /** Partial data recovered */
  partialData?: unknown;
}

/**
 * Recovery methods
 */
export type RecoveryMethod =
  | 'skip_token'
  | 'skip_block'
  | 'skip_to_newline'
  | 'skip_to_brace'
  | 'insert_token'
  | 'sync_to_block'
  | 'backtrack'
  | 'none';

// ============================================================================
// Lexer Recovery
// ============================================================================

/**
 * Recovery strategies for lexer errors
 */
export class LexerRecoveryStrategy {
  constructor(private readonly options: RecoveryOptions) {}

  /**
   * Recover from an unterminated string
   */
  recoverUnterminatedString(
    input: string,
    position: number,
    startLine: number,
    startColumn: number
  ): RecoveryResult {
    // Find the next newline or end of file
    let endPos = position;
    while (endPos < input.length && input[endPos] !== '\n') {
      endPos++;
    }

    return {
      success: true,
      skipped: endPos - position,
      error: LexerError.unterminatedString(startLine, startColumn, '<input>'),
      method: 'skip_to_newline',
      newPosition: endPos,
    };
  }

  /**
   * Recover from an invalid character
   */
  recoverInvalidCharacter(
    input: string,
    position: number,
    line: number,
    column: number
  ): RecoveryResult {
    const char = input[position];

    // Skip the invalid character
    return {
      success: true,
      skipped: 1,
      error: LexerError.invalidCharacter(char, line, column, '<input>'),
      method: 'skip_token',
      newPosition: position + 1,
    };
  }

  /**
   * Recover from an unterminated heredoc
   */
  recoverUnterminatedHeredoc(
    input: string,
    position: number,
    delimiter: string,
    startLine: number,
    startColumn: number
  ): RecoveryResult {
    // Find the next block-level construct (brace at start of line)
    let endPos = position;
    while (endPos < input.length) {
      if (input[endPos] === '\n') {
        // Check if next line starts a new block
        let nextLineStart = endPos + 1;
        while (nextLineStart < input.length &&
               (input[nextLineStart] === ' ' || input[nextLineStart] === '\t')) {
          nextLineStart++;
        }
        if (input[nextLineStart] === '}' || /^[a-z_]+\s*[{"=]/.test(input.slice(nextLineStart, nextLineStart + 20))) {
          endPos = endPos + 1; // Include the newline
          break;
        }
      }
      endPos++;
    }

    return {
      success: true,
      skipped: endPos - position,
      error: LexerError.unterminatedHeredoc(delimiter, startLine, startColumn, '<input>'),
      method: 'skip_to_brace',
      newPosition: endPos,
    };
  }

  /**
   * Generic lexer recovery - skip to next safe point
   */
  recover(
    input: string,
    position: number,
    error: LexerError
  ): RecoveryResult {
    switch (this.options.lexerRecovery) {
      case 'skip':
        return this.skipToSafePoint(input, position, error);
      case 'insert':
        return this.insertMissingToken(input, position, error);
      case 'replace':
        return this.replaceInvalidToken(input, position, error);
      default:
        return this.skipToSafePoint(input, position, error);
    }
  }

  private skipToSafePoint(
    input: string,
    position: number,
    error: LexerError
  ): RecoveryResult {
    // Skip to the next whitespace or newline
    let endPos = position;
    while (endPos < input.length &&
           input[endPos] !== ' ' &&
           input[endPos] !== '\t' &&
           input[endPos] !== '\n') {
      endPos++;
    }

    return {
      success: true,
      skipped: endPos - position,
      error,
      method: 'skip_token',
      newPosition: endPos,
    };
  }

  private insertMissingToken(
    input: string,
    position: number,
    error: LexerError
  ): RecoveryResult {
    // For unterminated strings, assume end at newline
    if (error.code === TerragruntErrorCode.LEX_UNTERMINATED_STRING) {
      let endPos = position;
      while (endPos < input.length && input[endPos] !== '\n') {
        endPos++;
      }
      return {
        success: true,
        skipped: 0,
        error,
        method: 'insert_token',
        newPosition: endPos,
        partialData: { insertedToken: '"' },
      };
    }

    return this.skipToSafePoint(input, position, error);
  }

  private replaceInvalidToken(
    input: string,
    position: number,
    error: LexerError
  ): RecoveryResult {
    // Skip the invalid token and continue
    return {
      success: true,
      skipped: 1,
      error,
      method: 'skip_token',
      newPosition: position + 1,
    };
  }
}

// ============================================================================
// Block Recovery
// ============================================================================

/**
 * Recovery strategies for block parsing errors
 */
export class BlockRecoveryStrategy {
  constructor(private readonly options: RecoveryOptions) {}

  /**
   * Recover from a malformed block by skipping to the closing brace
   */
  skipToBlockEnd(
    tokens: readonly { type: string; value: string }[],
    startPosition: number,
    error: BlockParseError
  ): RecoveryResult {
    let depth = 1;
    let position = startPosition;

    while (position < tokens.length && depth > 0) {
      const token = tokens[position];
      if (token.type === 'LBRACE') {
        depth++;
      } else if (token.type === 'RBRACE') {
        depth--;
      }
      position++;
    }

    return {
      success: depth === 0,
      skipped: position - startPosition,
      error,
      method: 'skip_block',
      newPosition: position,
    };
  }

  /**
   * Recover from an unclosed block by finding the next block start
   */
  syncToNextBlock(
    tokens: readonly { type: string; value: string }[],
    startPosition: number,
    error: TerragruntParseError
  ): RecoveryResult {
    let position = startPosition;
    const blockStartTokens = new Set([
      'terraform', 'remote_state', 'include', 'locals',
      'dependency', 'dependencies', 'generate', 'inputs',
      'iam_role', 'retry_config', 'download_dir', 'prevent_destroy', 'skip',
    ]);

    while (position < tokens.length) {
      const token = tokens[position];
      if (token.type === 'IDENTIFIER' && blockStartTokens.has(token.value)) {
        // Found next block start
        break;
      }
      position++;
    }

    return {
      success: position < tokens.length,
      skipped: position - startPosition,
      error,
      method: 'sync_to_block',
      newPosition: position,
    };
  }

  /**
   * Recover by creating a partial block with available data
   */
  createPartialBlock(
    blockType: string,
    partialAttributes: Record<string, unknown>,
    error: BlockParseError
  ): RecoveryResult {
    return {
      success: true,
      skipped: 0,
      error,
      method: 'none',
      partialData: {
        type: blockType,
        partial: true,
        attributes: partialAttributes,
      },
    };
  }

  /**
   * Generic block recovery
   */
  recover(
    tokens: readonly { type: string; value: string }[],
    position: number,
    error: BlockParseError
  ): RecoveryResult {
    switch (this.options.blockRecovery) {
      case 'skip':
        return this.skipToBlockEnd(tokens, position, error);
      case 'empty':
        return this.syncToNextBlock(tokens, position, error);
      case 'partial':
        return this.createPartialBlock(error.blockType, {}, error);
      default:
        return this.skipToBlockEnd(tokens, position, error);
    }
  }
}

// ============================================================================
// Include/Dependency Recovery
// ============================================================================

/**
 * Recovery strategies for include resolution errors
 */
export class IncludeRecoveryStrategy {
  constructor(private readonly options: RecoveryOptions) {}

  /**
   * Mark include as unresolved and continue
   */
  markUnresolved(error: IncludeResolutionError): RecoveryResult {
    return {
      success: this.options.continueOnIncludeFailure,
      skipped: 0,
      error,
      method: 'none',
      partialData: {
        resolved: false,
        path: error.includePath,
        label: error.includeLabel,
      },
    };
  }

  /**
   * Use default/empty include values
   */
  useDefaults(error: IncludeResolutionError): RecoveryResult {
    return {
      success: true,
      skipped: 0,
      error,
      method: 'none',
      partialData: {
        resolved: false,
        path: error.includePath,
        label: error.includeLabel,
        defaults: {
          mergeStrategy: 'no_merge',
          exposeAsVariable: false,
        },
      },
    };
  }
}

/**
 * Recovery strategies for dependency resolution errors
 */
export class DependencyRecoveryStrategy {
  constructor(private readonly options: RecoveryOptions) {}

  /**
   * Mark dependency as unresolved and continue
   */
  markUnresolved(error: DependencyResolutionError): RecoveryResult {
    return {
      success: this.options.continueOnDependencyFailure,
      skipped: 0,
      error,
      method: 'none',
      partialData: {
        resolved: false,
        name: error.dependencyName,
        configPath: error.configPath,
      },
    };
  }

  /**
   * Use mock outputs if available
   */
  useMockOutputs(
    error: DependencyResolutionError,
    mockOutputs: Record<string, unknown>
  ): RecoveryResult {
    return {
      success: true,
      skipped: 0,
      error,
      method: 'none',
      partialData: {
        resolved: false,
        name: error.dependencyName,
        configPath: error.configPath,
        mockOutputs,
        usingMocks: true,
      },
    };
  }
}

// ============================================================================
// Error Recovery Manager
// ============================================================================

/**
 * Manages error recovery during parsing
 */
export class ErrorRecoveryManager {
  private readonly options: RecoveryOptions;
  private readonly errors: ErrorCollection;
  private state: RecoveryState;

  readonly lexerRecovery: LexerRecoveryStrategy;
  readonly blockRecovery: BlockRecoveryStrategy;
  readonly includeRecovery: IncludeRecoveryStrategy;
  readonly dependencyRecovery: DependencyRecoveryStrategy;

  constructor(options: Partial<RecoveryOptions> = {}) {
    this.options = { ...DEFAULT_RECOVERY_OPTIONS, ...options };
    this.errors = new ErrorCollection(this.options.maxErrors);
    this.state = createRecoveryState();

    this.lexerRecovery = new LexerRecoveryStrategy(this.options);
    this.blockRecovery = new BlockRecoveryStrategy(this.options);
    this.includeRecovery = new IncludeRecoveryStrategy(this.options);
    this.dependencyRecovery = new DependencyRecoveryStrategy(this.options);
  }

  /**
   * Check if recovery is enabled
   */
  get isEnabled(): boolean {
    return this.options.enabled;
  }

  /**
   * Check if max errors reached
   */
  get hasReachedMaxErrors(): boolean {
    return this.errors.isFull;
  }

  /**
   * Check if in recovery mode
   */
  get inRecovery(): boolean {
    return this.state.inRecovery;
  }

  /**
   * Add an error and determine if parsing should continue
   */
  handleError(error: TerragruntParseError): boolean {
    this.errors.add(error);
    this.state.errorCount++;
    this.state.lastError = error;

    // Check if we should abort
    if (!this.options.enabled) {
      return false;
    }

    if (this.errors.isFull) {
      return false;
    }

    if (!error.recoverable) {
      return false;
    }

    if (error.severity === TerragruntErrorSeverity.FATAL) {
      return false;
    }

    return true;
  }

  /**
   * Attempt recovery from an error
   */
  attemptRecovery(
    error: TerragruntParseError,
    context: {
      input?: string;
      tokens?: readonly { type: string; value: string }[];
      position: number;
    }
  ): RecoveryResult {
    this.state.inRecovery = true;
    this.state.recoveryAttempts++;

    // Check max recovery attempts
    if (this.state.recoveryAttempts > this.options.maxRecoveryAttempts) {
      return {
        success: false,
        skipped: 0,
        error,
        method: 'none',
      };
    }

    // Route to appropriate recovery strategy
    if (error instanceof LexerError && context.input) {
      return this.lexerRecovery.recover(context.input, context.position, error);
    }

    if (error instanceof BlockParseError && context.tokens) {
      return this.blockRecovery.recover(context.tokens, context.position, error);
    }

    if (error instanceof IncludeResolutionError) {
      return this.includeRecovery.markUnresolved(error);
    }

    if (error instanceof DependencyResolutionError) {
      return this.dependencyRecovery.markUnresolved(error);
    }

    // Default: skip current position
    return {
      success: true,
      skipped: 1,
      error,
      method: 'skip_token',
      newPosition: context.position + 1,
    };
  }

  /**
   * Mark a range as skipped (for source mapping)
   */
  markSkipped(range: SourceRange): void {
    this.state.skippedRanges.push(range);
  }

  /**
   * Save a recovery point for backtracking
   */
  saveRecoveryPoint(position: number, state: string): void {
    this.state.recoveryPoints.push({
      position,
      state,
      errorCount: this.state.errorCount,
    });
  }

  /**
   * Backtrack to last recovery point
   */
  backtrack(): RecoveryPoint | null {
    return this.state.recoveryPoints.pop() ?? null;
  }

  /**
   * Exit recovery mode
   */
  exitRecovery(): void {
    this.state.inRecovery = false;
    this.state.recoveryAttempts = 0;
  }

  /**
   * Reset recovery state
   */
  reset(): void {
    this.errors.clear();
    this.state = createRecoveryState();
  }

  /**
   * Get all collected errors
   */
  getErrors(): readonly TerragruntParseError[] {
    return this.errors.getAll();
  }

  /**
   * Get skipped ranges
   */
  getSkippedRanges(): readonly SourceRange[] {
    return this.state.skippedRanges;
  }

  /**
   * Get recovery statistics
   */
  getStats(): {
    errorCount: number;
    recoveryAttempts: number;
    skippedRanges: number;
    recoveryPointsUsed: number;
  } {
    return {
      errorCount: this.state.errorCount,
      recoveryAttempts: this.state.recoveryAttempts,
      skippedRanges: this.state.skippedRanges.length,
      recoveryPointsUsed:
        this.options.maxRecoveryAttempts - this.state.recoveryPoints.length,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an error recovery manager with options
 */
export function createRecoveryManager(
  options?: Partial<RecoveryOptions>
): ErrorRecoveryManager {
  return new ErrorRecoveryManager(options);
}

/**
 * Check if error allows continued parsing
 */
export function canContinueAfterError(
  error: TerragruntParseError,
  options: Partial<RecoveryOptions> = {}
): boolean {
  const opts = { ...DEFAULT_RECOVERY_OPTIONS, ...options };

  if (!opts.enabled) return false;
  if (!error.recoverable) return false;
  if (error.severity === TerragruntErrorSeverity.FATAL) return false;

  // Check specific error types
  if (error instanceof IncludeResolutionError) {
    return opts.continueOnIncludeFailure;
  }

  if (error instanceof DependencyResolutionError) {
    return opts.continueOnDependencyFailure;
  }

  if (error instanceof BlockParseError) {
    if (error.code === TerragruntErrorCode.BLK_UNKNOWN_TYPE) {
      return opts.skipUnknownBlocks;
    }
    return opts.skipMalformedBlocks;
  }

  return true;
}
