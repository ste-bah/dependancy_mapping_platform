/**
 * Base Parser Infrastructure
 * @module parsers/base/parser
 *
 * Provides the foundational interfaces and base classes for all IaC parsers.
 * Implements the Parser<T> interface from the Phase 3 architecture design.
 *
 * TASK-DETECT-001: Core parser infrastructure for HCL2 and other IaC formats
 */

import { SourceLocation } from '../terraform/types';

// ============================================================================
// Parse Result Types
// ============================================================================

/**
 * Represents the outcome of a parsing operation.
 * Uses a discriminated union for type-safe error handling.
 */
export type ParseResult<T> =
  | ParseSuccess<T>
  | ParseFailure;

/**
 * Successful parse result containing the parsed AST
 */
export interface ParseSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly warnings: ParseDiagnostic[];
  readonly metadata: ParseMetadata;
}

/**
 * Failed parse result containing error details
 */
export interface ParseFailure {
  readonly success: false;
  readonly errors: ParseError[];
  readonly partialData: unknown | null;
  readonly metadata: ParseMetadata;
}

/**
 * Parse error with location information and recovery hints
 */
export interface ParseError {
  /** Error code for programmatic handling */
  readonly code: ParseErrorCode;
  /** Human-readable error message */
  readonly message: string;
  /** Source location of the error */
  readonly location: SourceLocation | null;
  /** Error severity level */
  readonly severity: 'error' | 'fatal';
  /** Optional recovery suggestion */
  readonly recovery?: string;
  /** Optional underlying cause */
  readonly cause?: Error;
}

/**
 * Non-fatal diagnostic message (warning or info)
 */
export interface ParseDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly location: SourceLocation | null;
  readonly severity: 'warning' | 'info';
  readonly suggestion?: string;
}

/**
 * Metadata about the parsing operation
 */
export interface ParseMetadata {
  /** File path that was parsed */
  readonly filePath: string;
  /** Parser name that produced this result */
  readonly parserName: string;
  /** Parser version */
  readonly parserVersion: string;
  /** Time taken to parse in milliseconds */
  readonly parseTimeMs: number;
  /** Original file size in bytes */
  readonly fileSize: number;
  /** File encoding used */
  readonly encoding: string;
  /** Number of lines in the file */
  readonly lineCount: number;
}

/**
 * Standard error codes for parse errors
 */
export type ParseErrorCode =
  | 'SYNTAX_ERROR'
  | 'LEXER_ERROR'
  | 'UNEXPECTED_TOKEN'
  | 'UNCLOSED_BLOCK'
  | 'UNCLOSED_STRING'
  | 'INVALID_EXPRESSION'
  | 'INVALID_REFERENCE'
  | 'FILE_TOO_LARGE'
  | 'FILE_NOT_FOUND'
  | 'FILE_READ_ERROR'
  | 'ENCODING_ERROR'
  | 'UNSUPPORTED_SYNTAX'
  | 'INTERNAL_ERROR';

// ============================================================================
// Parser Interface
// ============================================================================

/**
 * Generic parser interface for IaC file formats.
 * Implementations must be stateless and thread-safe.
 *
 * @typeParam T - The AST type produced by this parser
 */
export interface IParser<T> {
  /** Unique parser identifier */
  readonly name: string;

  /** Semantic version of the parser */
  readonly version: string;

  /** File extensions this parser can handle */
  readonly supportedExtensions: readonly string[];

  /** MIME types this parser can handle */
  readonly supportedMimeTypes: readonly string[];

  /**
   * Parse file content into an AST.
   *
   * @param content - File content as string
   * @param filePath - Original file path for error reporting
   * @param options - Optional parser-specific options
   * @returns Parse result with AST or errors
   */
  parse(
    content: string,
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>>;

  /**
   * Parse file directly from filesystem.
   *
   * @param filePath - Path to the file to parse
   * @param options - Optional parser-specific options
   * @returns Parse result with AST or errors
   */
  parseFile(
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>>;

  /**
   * Check if this parser can handle the given file.
   *
   * @param filePath - File path to check
   * @param content - Optional file content for deeper inspection
   * @returns Whether this parser can handle the file
   */
  canParse(filePath: string, content?: string): boolean;

  /**
   * Validate content without full parsing (faster).
   *
   * @param content - Content to validate
   * @returns Validation errors if any
   */
  validate(content: string): Promise<ParseDiagnostic[]>;
}

/**
 * Parser configuration options
 */
export interface ParserOptions {
  /** Continue parsing after errors (default: true) */
  errorRecovery?: boolean;
  /** Maximum file size in bytes (default: 10MB) */
  maxFileSize?: number;
  /** File encoding (default: utf-8) */
  encoding?: BufferEncoding;
  /** Include raw source text in AST nodes (default: true) */
  includeRaw?: boolean;
  /** Parse nested blocks recursively (default: true) */
  parseNestedBlocks?: boolean;
  /** Enable strict mode with stricter validation (default: false) */
  strictMode?: boolean;
  /** Custom timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Enable caching of parse results (default: true) */
  enableCache?: boolean;
}

/**
 * Default parser options
 */
export const DEFAULT_PARSER_OPTIONS: Required<ParserOptions> = {
  errorRecovery: true,
  maxFileSize: 10 * 1024 * 1024, // 10MB
  encoding: 'utf-8',
  includeRaw: true,
  parseNestedBlocks: true,
  strictMode: false,
  timeout: 30000,
  enableCache: true,
};

// ============================================================================
// Base Parser Abstract Class
// ============================================================================

/**
 * Abstract base class providing common parser functionality.
 * Extend this class to implement specific format parsers.
 *
 * @typeParam T - The AST type produced by this parser
 */
export abstract class BaseParser<T> implements IParser<T> {
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly supportedExtensions: readonly string[];
  abstract readonly supportedMimeTypes: readonly string[];

  protected options: Required<ParserOptions>;

  constructor(options: ParserOptions = {}) {
    this.options = { ...DEFAULT_PARSER_OPTIONS, ...options };
  }

  /**
   * Parse file content into an AST.
   * Template method that handles common concerns and delegates to doParse.
   */
  async parse(
    content: string,
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const mergedOptions = { ...this.options, ...options };
    const startTime = performance.now();

    // Pre-validation
    const preValidation = this.preValidate(content, mergedOptions);
    if (preValidation) {
      return this.createFailure(
        [preValidation],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }

    try {
      // Apply timeout if specified
      const parsePromise = this.doParse(content, filePath, mergedOptions);

      if (mergedOptions.timeout > 0) {
        const result = await this.withTimeout(parsePromise, mergedOptions.timeout);
        return this.enrichResult(result, filePath, startTime, content);
      }

      const result = await parsePromise;
      return this.enrichResult(result, filePath, startTime, content);
    } catch (error) {
      return this.createFailure(
        [{
          code: 'INTERNAL_ERROR',
          message: error instanceof Error ? error.message : String(error),
          location: null,
          severity: 'fatal',
          cause: error instanceof Error ? error : undefined,
        }],
        null,
        this.createMetadata(filePath, startTime, content)
      );
    }
  }

  /**
   * Parse file directly from filesystem
   */
  async parseFile(
    filePath: string,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const mergedOptions = { ...this.options, ...options };
    const startTime = performance.now();

    try {
      const fs = await import('fs');
      const stats = await fs.promises.stat(filePath);

      if (stats.size > mergedOptions.maxFileSize) {
        return this.createFailure(
          [{
            code: 'FILE_TOO_LARGE',
            message: `File size ${stats.size} exceeds maximum ${mergedOptions.maxFileSize}`,
            location: null,
            severity: 'fatal',
          }],
          null,
          this.createMetadata(filePath, startTime, '', stats.size)
        );
      }

      const content = await fs.promises.readFile(filePath, mergedOptions.encoding);
      return this.parse(content, filePath, options);
    } catch (error) {
      const code = this.getFileErrorCode(error);
      return this.createFailure(
        [{
          code,
          message: error instanceof Error ? error.message : String(error),
          location: null,
          severity: 'fatal',
          cause: error instanceof Error ? error : undefined,
        }],
        null,
        this.createMetadata(filePath, startTime, '')
      );
    }
  }

  /**
   * Check if this parser can handle the given file
   */
  canParse(filePath: string, content?: string): boolean {
    const ext = this.getExtension(filePath);
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Validate content without full parsing
   */
  async validate(content: string): Promise<ParseDiagnostic[]> {
    const result = await this.parse(content, '<validation>');
    if (!result.success) {
      return result.errors.map(e => ({
        code: e.code,
        message: e.message,
        location: e.location,
        severity: 'warning' as const,
      }));
    }
    return result.warnings;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by subclasses
  // ============================================================================

  /**
   * Perform the actual parsing. Override in subclasses.
   *
   * @param content - File content
   * @param filePath - File path for error reporting
   * @param options - Parser options
   * @returns Parse result
   */
  protected abstract doParse(
    content: string,
    filePath: string,
    options: Required<ParserOptions>
  ): Promise<ParseResult<T>>;

  // ============================================================================
  // Protected Helper Methods
  // ============================================================================

  /**
   * Create a successful parse result
   */
  protected createSuccess(
    data: T,
    warnings: ParseDiagnostic[],
    metadata: ParseMetadata
  ): ParseSuccess<T> {
    return {
      success: true,
      data,
      warnings,
      metadata,
    };
  }

  /**
   * Create a failed parse result
   */
  protected createFailure(
    errors: ParseError[],
    partialData: unknown | null,
    metadata: ParseMetadata
  ): ParseFailure {
    return {
      success: false,
      errors,
      partialData,
      metadata,
    };
  }

  /**
   * Create parse metadata
   */
  protected createMetadata(
    filePath: string,
    startTime: number,
    content: string,
    fileSize?: number
  ): ParseMetadata {
    return {
      filePath,
      parserName: this.name,
      parserVersion: this.version,
      parseTimeMs: performance.now() - startTime,
      fileSize: fileSize ?? content.length,
      encoding: this.options.encoding,
      lineCount: content.split('\n').length,
    };
  }

  /**
   * Create a source location from line/column info
   */
  protected createLocation(
    filePath: string,
    lineStart: number,
    lineEnd: number,
    columnStart: number,
    columnEnd: number
  ): SourceLocation {
    return {
      file: filePath,
      lineStart,
      lineEnd,
      columnStart,
      columnEnd,
    };
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  private preValidate(
    content: string,
    options: Required<ParserOptions>
  ): ParseError | null {
    if (content.length > options.maxFileSize) {
      return {
        code: 'FILE_TOO_LARGE',
        message: `Content size ${content.length} exceeds maximum ${options.maxFileSize}`,
        location: null,
        severity: 'fatal',
      };
    }
    return null;
  }

  private enrichResult(
    result: ParseResult<T>,
    filePath: string,
    startTime: number,
    content: string
  ): ParseResult<T> {
    // Result already has metadata from doParse, just return it
    return result;
  }

  private async withTimeout<R>(
    promise: Promise<R>,
    timeoutMs: number
  ): Promise<R> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Parse timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  private getExtension(filePath: string): string {
    const parts = filePath.split('.');
    if (parts.length < 2) return '';

    // Handle compound extensions like .tf.json
    if (parts.length >= 3 && parts[parts.length - 2] === 'tf') {
      return `.${parts.slice(-2).join('.')}`;
    }

    return `.${parts[parts.length - 1]}`;
  }

  private getFileErrorCode(error: unknown): ParseErrorCode {
    if (error instanceof Error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code === 'ENOENT') return 'FILE_NOT_FOUND';
      if (nodeError.code === 'EACCES') return 'FILE_READ_ERROR';
      if (nodeError.code === 'EISDIR') return 'FILE_READ_ERROR';
    }
    return 'FILE_READ_ERROR';
  }
}

// ============================================================================
// Parser Capability Interface
// ============================================================================

/**
 * Describes the capabilities of a parser for registry matching
 */
export interface ParserCapability {
  /** Parser name */
  name: string;
  /** Parser version */
  version: string;
  /** Supported file extensions */
  extensions: string[];
  /** Supported MIME types */
  mimeTypes: string[];
  /** IaC format this parser handles */
  format: IaCFormat;
  /** Priority for format detection (higher = preferred) */
  priority: number;
  /** Whether this parser is experimental */
  experimental: boolean;
}

/**
 * Supported IaC format types
 */
export type IaCFormat =
  | 'terraform'
  | 'terraform-json'
  | 'terragrunt'
  | 'cloudformation'
  | 'cloudformation-yaml'
  | 'kubernetes'
  | 'helm'
  | 'ansible'
  | 'pulumi'
  | 'docker-compose'
  | 'dockerfile'
  | 'arm-template'
  | 'bicep';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for successful parse results
 */
export function isParseSuccess<T>(result: ParseResult<T>): result is ParseSuccess<T> {
  return result.success === true;
}

/**
 * Type guard for failed parse results
 */
export function isParseFailure<T>(result: ParseResult<T>): result is ParseFailure {
  return result.success === false;
}

// ============================================================================
// Exports
// ============================================================================

export type {
  ParseResult,
  ParseSuccess,
  ParseFailure,
  ParseError,
  ParseDiagnostic,
  ParseMetadata,
  ParseErrorCode,
  IParser,
  ParserOptions,
  ParserCapability,
  IaCFormat,
};
