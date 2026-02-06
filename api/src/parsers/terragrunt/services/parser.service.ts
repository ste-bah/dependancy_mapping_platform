/**
 * Terragrunt Parser Service
 * @module parsers/terragrunt/services/parser.service
 *
 * TASK-TG-001: Service layer for Terragrunt HCL parsing
 *
 * Provides:
 * - Convenience factory functions for common parsing scenarios
 * - Batch parsing support for multiple files
 * - Error aggregation and reporting
 * - Caching and performance optimization
 */

import * as path from 'path';
import * as fs from 'fs';
import {
  TerragruntParser,
  createTerragruntParser,
  parseTerragrunt,
  parseTerragruntFile,
} from '../tg-parser';
import {
  TerragruntFile,
  TerragruntParserOptions,
  TerragruntParseError,
  DEFAULT_TERRAGRUNT_PARSER_OPTIONS,
} from '../types';
import {
  ParseResult,
  ParseDiagnostic,
  ParserOptions,
  isParseSuccess,
  isParseFailure,
} from '../../base/parser';

// ============================================================================
// Service Types
// ============================================================================

/**
 * Options for batch parsing operations
 */
export interface BatchParseOptions extends Partial<TerragruntParserOptions & ParserOptions> {
  /** Maximum concurrent file parses (default: 5) */
  readonly concurrency?: number;
  /** Continue parsing other files on error (default: true) */
  readonly continueOnError?: boolean;
  /** Include only files matching these patterns */
  readonly includePatterns?: readonly string[];
  /** Exclude files matching these patterns */
  readonly excludePatterns?: readonly string[];
  /** Progress callback */
  readonly onProgress?: (completed: number, total: number, current: string) => void;
}

/**
 * Result of parsing a single file in batch
 */
export interface BatchParseFileResult {
  /** File path */
  readonly filePath: string;
  /** Parse result */
  readonly result: ParseResult<TerragruntFile> | null;
  /** Whether parsing succeeded */
  readonly success: boolean;
  /** Error if parsing failed */
  readonly error: Error | null;
  /** Time taken in ms */
  readonly duration: number;
}

/**
 * Result of a batch parse operation
 */
export interface BatchParseResult {
  /** Total files processed */
  readonly totalFiles: number;
  /** Successfully parsed files */
  readonly successCount: number;
  /** Failed files */
  readonly failureCount: number;
  /** Skipped files */
  readonly skippedCount: number;
  /** Individual file results */
  readonly files: readonly BatchParseFileResult[];
  /** Aggregated errors across all files */
  readonly aggregatedErrors: readonly AggregatedError[];
  /** Total duration in ms */
  readonly totalDuration: number;
}

/**
 * Error aggregated from multiple files
 */
export interface AggregatedError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Files affected by this error */
  readonly affectedFiles: readonly string[];
  /** Occurrence count */
  readonly count: number;
  /** Severity */
  readonly severity: 'error' | 'warning';
}

/**
 * Quick parse result for validation-only scenarios
 */
export interface QuickParseResult {
  /** Whether the content is valid */
  readonly valid: boolean;
  /** Diagnostics (errors and warnings) */
  readonly diagnostics: readonly ParseDiagnostic[];
  /** Block types found */
  readonly blockTypes: readonly string[];
  /** Function calls found */
  readonly functionCalls: readonly string[];
  /** Parse duration in ms */
  readonly duration: number;
}

// ============================================================================
// Parser Service Class
// ============================================================================

/**
 * Service class providing high-level parsing operations.
 * Implements singleton pattern with configurable defaults.
 *
 * @example
 * ```typescript
 * const service = TerragruntParserService.getInstance();
 *
 * // Parse single file
 * const result = await service.parseFile('/path/to/terragrunt.hcl');
 *
 * // Parse directory
 * const batchResult = await service.parseDirectory('/path/to/project');
 *
 * // Quick validation
 * const quickResult = await service.quickParse(content);
 * ```
 */
export class TerragruntParserService {
  private static instance: TerragruntParserService | null = null;

  private readonly parser: TerragruntParser;
  private readonly cache: Map<string, { result: ParseResult<TerragruntFile>; timestamp: number }>;
  private readonly cacheMaxAge: number;
  private readonly cacheMaxSize: number;
  private readonly defaultOptions: TerragruntParserOptions & ParserOptions;

  private constructor(options: Partial<TerragruntParserOptions & ParserOptions> = {}) {
    this.defaultOptions = {
      ...DEFAULT_TERRAGRUNT_PARSER_OPTIONS,
      errorRecovery: true,
      maxFileSize: 10 * 1024 * 1024,
      encoding: 'utf-8',
      includeRaw: true,
      parseNestedBlocks: true,
      strictMode: false,
      timeout: 30000,
      enableCache: true,
      ...options,
    };
    this.parser = createTerragruntParser(this.defaultOptions);
    this.cache = new Map();
    this.cacheMaxAge = 60000; // 1 minute
    this.cacheMaxSize = 100;
  }

  /**
   * Get singleton instance
   */
  static getInstance(options?: Partial<TerragruntParserOptions & ParserOptions>): TerragruntParserService {
    if (!TerragruntParserService.instance) {
      TerragruntParserService.instance = new TerragruntParserService(options);
    }
    return TerragruntParserService.instance;
  }

  /**
   * Reset singleton instance (for testing)
   */
  static resetInstance(): void {
    TerragruntParserService.instance = null;
  }

  // ============================================================================
  // Single File Operations
  // ============================================================================

  /**
   * Parse a Terragrunt file from disk
   */
  async parseFile(
    filePath: string,
    options?: Partial<TerragruntParserOptions & ParserOptions>
  ): Promise<ParseResult<TerragruntFile>> {
    const absolutePath = path.resolve(filePath);
    const mergedOptions = { ...this.defaultOptions, ...options };

    // Check cache
    if (mergedOptions.enableCache) {
      const cached = this.getCachedResult(absolutePath);
      if (cached) return cached;
    }

    const result = await this.parser.parseFile(absolutePath, mergedOptions);

    // Cache result
    if (mergedOptions.enableCache && isParseSuccess(result)) {
      this.setCachedResult(absolutePath, result);
    }

    return result;
  }

  /**
   * Parse Terragrunt content from string
   */
  async parseContent(
    content: string,
    filePath: string = 'terragrunt.hcl',
    options?: Partial<TerragruntParserOptions & ParserOptions>
  ): Promise<ParseResult<TerragruntFile>> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    return this.parser.parse(content, filePath, mergedOptions);
  }

  /**
   * Quick parse for validation without full AST construction
   */
  async quickParse(content: string): Promise<QuickParseResult> {
    const startTime = performance.now();

    // Parse with minimal options
    const result = await this.parser.parse(content, '<quick-parse>', {
      ...this.defaultOptions,
      includeRaw: false,
      resolveIncludes: false,
      resolveDependencies: false,
    });

    const diagnostics: ParseDiagnostic[] = [];
    const blockTypes: string[] = [];
    const functionCalls: string[] = [];

    if (isParseSuccess(result)) {
      diagnostics.push(...result.warnings);

      // Extract block types
      for (const block of result.data.blocks) {
        if (!blockTypes.includes(block.type)) {
          blockTypes.push(block.type);
        }
      }

      // Extract function calls from errors (indicates which functions were parsed)
      for (const error of result.data.errors) {
        if (error.code === 'UNKNOWN_FUNCTION' && error.message.includes("'")) {
          const match = error.message.match(/'([^']+)'/);
          if (match && !functionCalls.includes(match[1])) {
            functionCalls.push(match[1]);
          }
        }
      }
    } else {
      diagnostics.push(...result.errors.map(e => ({
        code: e.code,
        message: e.message,
        location: e.location,
        severity: 'warning' as const,
      })));
    }

    return {
      valid: isParseSuccess(result) && result.data.errors.length === 0,
      diagnostics,
      blockTypes,
      functionCalls,
      duration: performance.now() - startTime,
    };
  }

  // ============================================================================
  // Batch Operations
  // ============================================================================

  /**
   * Parse all Terragrunt files in a directory
   */
  async parseDirectory(
    dirPath: string,
    options: BatchParseOptions = {}
  ): Promise<BatchParseResult> {
    const startTime = performance.now();
    const absolutePath = path.resolve(dirPath);

    // Find all terragrunt.hcl files
    const files = await this.findTerragruntFiles(absolutePath, options);

    return this.batchParse(files, options, startTime);
  }

  /**
   * Parse multiple files in parallel with concurrency control
   */
  async batchParse(
    filePaths: readonly string[],
    options: BatchParseOptions = {},
    startTime?: number
  ): Promise<BatchParseResult> {
    const start = startTime ?? performance.now();
    const {
      concurrency = 5,
      continueOnError = true,
      onProgress,
    } = options;

    const results: BatchParseFileResult[] = [];
    const errorMap = new Map<string, { files: string[]; count: number; severity: 'error' | 'warning' }>();

    // Process files with concurrency control
    const chunks = this.chunkArray([...filePaths], concurrency);
    let completed = 0;

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(async (filePath) => {
          const fileStart = performance.now();
          let result: ParseResult<TerragruntFile> | null = null;
          let error: Error | null = null;
          let success = false;

          try {
            result = await this.parseFile(filePath, options);
            success = isParseSuccess(result);

            // Aggregate errors
            if (isParseSuccess(result)) {
              for (const err of result.data.errors) {
                this.aggregateError(errorMap, err.code, err.message, filePath, err.severity);
              }
              for (const warn of result.warnings) {
                this.aggregateError(errorMap, warn.code, warn.message, filePath, 'warning');
              }
            } else {
              for (const err of result.errors) {
                this.aggregateError(errorMap, err.code, err.message, filePath, 'error');
              }
            }
          } catch (e) {
            error = e instanceof Error ? e : new Error(String(e));
            this.aggregateError(errorMap, 'PARSE_EXCEPTION', error.message, filePath, 'error');

            if (!continueOnError) {
              throw error;
            }
          }

          completed++;
          onProgress?.(completed, filePaths.length, filePath);

          return {
            filePath,
            result,
            success,
            error,
            duration: performance.now() - fileStart,
          };
        })
      );

      results.push(...chunkResults);
    }

    // Build aggregated errors
    const aggregatedErrors: AggregatedError[] = [];
    for (const [key, value] of errorMap) {
      const [code, message] = key.split('::');
      aggregatedErrors.push({
        code,
        message,
        affectedFiles: value.files,
        count: value.count,
        severity: value.severity,
      });
    }

    // Sort by count descending
    aggregatedErrors.sort((a, b) => b.count - a.count);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success && r.result !== null).length;
    const skippedCount = results.filter(r => r.result === null && r.error !== null).length;

    return {
      totalFiles: results.length,
      successCount,
      failureCount,
      skippedCount,
      files: results,
      aggregatedErrors,
      totalDuration: performance.now() - start,
    };
  }

  // ============================================================================
  // Cache Management
  // ============================================================================

  /**
   * Clear the parse result cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.cacheMaxSize,
      hitRate: 0, // Would need to track hits/misses for accurate rate
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get cached parse result if valid
   */
  private getCachedResult(filePath: string): ParseResult<TerragruntFile> | null {
    const cached = this.cache.get(filePath);
    if (!cached) return null;

    // Check age
    if (Date.now() - cached.timestamp > this.cacheMaxAge) {
      this.cache.delete(filePath);
      return null;
    }

    return cached.result;
  }

  /**
   * Set cached parse result
   */
  private setCachedResult(filePath: string, result: ParseResult<TerragruntFile>): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.cacheMaxSize) {
      const oldest = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
      if (oldest) {
        this.cache.delete(oldest[0]);
      }
    }

    this.cache.set(filePath, { result, timestamp: Date.now() });
  }

  /**
   * Find all terragrunt.hcl files in a directory
   */
  private async findTerragruntFiles(
    dirPath: string,
    options: BatchParseOptions
  ): Promise<string[]> {
    const {
      includePatterns = [],
      excludePatterns = ['.terragrunt-cache', 'node_modules', '.git'],
    } = options;

    const files: string[] = [];

    const walkDir = async (dir: string): Promise<void> => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        // Check exclude patterns
        if (excludePatterns.some(p => entry.name.includes(p) || fullPath.includes(p))) {
          continue;
        }

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.name === 'terragrunt.hcl') {
          // Check include patterns if specified
          if (includePatterns.length === 0 ||
              includePatterns.some(p => fullPath.includes(p))) {
            files.push(fullPath);
          }
        }
      }
    };

    await walkDir(dirPath);
    return files;
  }

  /**
   * Aggregate error by key
   */
  private aggregateError(
    map: Map<string, { files: string[]; count: number; severity: 'error' | 'warning' }>,
    code: string,
    message: string,
    filePath: string,
    severity: 'error' | 'warning'
  ): void {
    const key = `${code}::${message}`;
    const existing = map.get(key);

    if (existing) {
      if (!existing.files.includes(filePath)) {
        existing.files.push(filePath);
      }
      existing.count++;
      // Escalate severity if any occurrence is an error
      if (severity === 'error') {
        existing.severity = 'error';
      }
    } else {
      map.set(key, { files: [filePath], count: 1, severity });
    }
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Get the parser service singleton
 */
export function getParserService(
  options?: Partial<TerragruntParserOptions & ParserOptions>
): TerragruntParserService {
  return TerragruntParserService.getInstance(options);
}

/**
 * Parse a single Terragrunt file
 */
export async function parseFile(
  filePath: string,
  options?: Partial<TerragruntParserOptions & ParserOptions>
): Promise<ParseResult<TerragruntFile>> {
  return getParserService().parseFile(filePath, options);
}

/**
 * Parse Terragrunt content
 */
export async function parseContent(
  content: string,
  filePath?: string,
  options?: Partial<TerragruntParserOptions & ParserOptions>
): Promise<ParseResult<TerragruntFile>> {
  return getParserService().parseContent(content, filePath, options);
}

/**
 * Parse all Terragrunt files in a directory
 */
export async function parseDirectory(
  dirPath: string,
  options?: BatchParseOptions
): Promise<BatchParseResult> {
  return getParserService().parseDirectory(dirPath, options);
}

/**
 * Quick parse for validation
 */
export async function quickParse(content: string): Promise<QuickParseResult> {
  return getParserService().quickParse(content);
}

/**
 * Batch parse multiple files
 */
export async function batchParse(
  filePaths: readonly string[],
  options?: BatchParseOptions
): Promise<BatchParseResult> {
  return getParserService().batchParse(filePaths, options);
}
