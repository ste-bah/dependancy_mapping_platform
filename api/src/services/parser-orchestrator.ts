/**
 * Parser Orchestrator Service
 * @module services/parser-orchestrator
 *
 * Coordinates multiple IaC parsers for batch file processing.
 * Handles parser selection, parallel execution, and result aggregation.
 *
 * TASK-DETECT-001: Parser orchestration for IaC dependency detection
 */

import pino from 'pino';
import {
  IParser,
  ParseResult,
  ParserOptions,
  isParseSuccess,
  isParseFailure,
} from '../parsers/index.js';
import { ParserRegistry, parserRegistry } from '../parsers/registry/parser-registry.js';
import { ScanConfig } from '../types/entities.js';

const logger = pino({ name: 'parser-orchestrator' });

// ============================================================================
// Types
// ============================================================================

/**
 * Parser orchestrator configuration
 */
export interface ParserOrchestratorConfig {
  /** Maximum concurrent parse operations */
  readonly maxConcurrency: number;
  /** Timeout per file in milliseconds */
  readonly perFileTimeoutMs: number;
  /** Continue on individual file failures */
  readonly continueOnError: boolean;
  /** Enable parse result caching */
  readonly enableCache: boolean;
  /** Retry failed parses */
  readonly retryOnFailure: boolean;
  /** Maximum retry attempts */
  readonly maxRetries: number;
}

/**
 * Default parser orchestrator configuration
 */
export const DEFAULT_PARSER_ORCHESTRATOR_CONFIG: ParserOrchestratorConfig = {
  maxConcurrency: 8,
  perFileTimeoutMs: 30000,
  continueOnError: true,
  enableCache: true,
  retryOnFailure: true,
  maxRetries: 2,
};

/**
 * File input for parsing
 */
export interface FileInput {
  /** File path */
  readonly path: string;
  /** File type hint */
  readonly type: 'terraform' | 'kubernetes' | 'helm' | 'cloudformation' | 'unknown';
  /** Optional file content (if already loaded) */
  readonly content?: string;
}

/**
 * Parser orchestrator input
 */
export interface ParserOrchestratorInput {
  /** Files to parse */
  readonly files: FileInput[];
  /** Scan configuration */
  readonly config: ScanConfig;
  /** Callback for file processed */
  readonly onFileProcessed?: (processed: number, total: number) => void | Promise<void>;
  /** Parser options override */
  readonly parserOptions?: ParserOptions;
}

/**
 * Parsed file result
 */
export interface ParsedFile<T = unknown> {
  /** Original file path */
  readonly path: string;
  /** File type */
  readonly type: string;
  /** Parsed AST */
  readonly ast: T;
  /** Parse metadata */
  readonly metadata: ParseFileMetadata;
}

/**
 * Parse file metadata
 */
export interface ParseFileMetadata {
  /** Parser used */
  readonly parserName: string;
  /** Parser version */
  readonly parserVersion: string;
  /** Parse time in milliseconds */
  readonly parseTimeMs: number;
  /** File size in bytes */
  readonly fileSize: number;
  /** Line count */
  readonly lineCount: number;
  /** Whether result was cached */
  readonly cached: boolean;
}

/**
 * Parse error detail
 */
export interface ParseErrorDetail {
  /** File path */
  readonly file: string;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
  /** Line number (if available) */
  readonly line?: number;
  /** Whether recoverable */
  readonly recoverable: boolean;
}

/**
 * Parse warning detail
 */
export interface ParseWarningDetail {
  /** File path */
  readonly file: string;
  /** Warning message */
  readonly message: string;
  /** Warning code */
  readonly code: string;
  /** Line number (if available) */
  readonly line?: number;
}

/**
 * Parser orchestrator result
 */
export interface ParserOrchestratorResult {
  /** Whether overall parsing succeeded (at least some files parsed) */
  readonly success: boolean;
  /** Successfully parsed files */
  readonly results: ParsedFile[];
  /** Errors encountered */
  readonly errors: ParseErrorDetail[];
  /** Warnings */
  readonly warnings: ParseWarningDetail[];
  /** Statistics */
  readonly stats: ParserOrchestratorStats;
}

/**
 * Parser orchestrator statistics
 */
export interface ParserOrchestratorStats {
  /** Total files attempted */
  readonly totalFiles: number;
  /** Successfully parsed files */
  readonly successfulFiles: number;
  /** Failed files */
  readonly failedFiles: number;
  /** Skipped files */
  readonly skippedFiles: number;
  /** Total parse time in milliseconds */
  readonly totalParseTimeMs: number;
  /** Average parse time per file */
  readonly avgParseTimeMs: number;
  /** Files by parser */
  readonly filesByParser: Record<string, number>;
  /** Cache hit rate */
  readonly cacheHitRate: number;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Parser orchestrator interface
 */
export interface IParserOrchestrator {
  /**
   * Parse multiple files
   */
  parseFiles(input: ParserOrchestratorInput): Promise<ParserOrchestratorResult>;

  /**
   * Parse a single file
   */
  parseFile<T = unknown>(
    file: FileInput,
    options?: ParserOptions
  ): Promise<ParseResult<T>>;

  /**
   * Get available parsers
   */
  getAvailableParsers(): string[];

  /**
   * Check if a file can be parsed
   */
  canParse(filePath: string): boolean;
}

// ============================================================================
// Parser Orchestrator Implementation
// ============================================================================

/**
 * Parser orchestrator for batch file processing
 */
export class ParserOrchestrator implements IParserOrchestrator {
  private readonly config: ParserOrchestratorConfig;
  private readonly registry: ParserRegistry;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  constructor(
    registry?: ParserRegistry,
    config: Partial<ParserOrchestratorConfig> = {}
  ) {
    this.config = { ...DEFAULT_PARSER_ORCHESTRATOR_CONFIG, ...config };
    this.registry = registry ?? parserRegistry;
  }

  /**
   * Parse multiple files in parallel with concurrency control
   */
  async parseFiles(input: ParserOrchestratorInput): Promise<ParserOrchestratorResult> {
    const startTime = Date.now();
    const { files, config, onFileProcessed, parserOptions } = input;

    logger.info({ fileCount: files.length }, 'Starting batch file parsing');

    // Filter files by type
    const filesToParse = this.filterFiles(files, config);

    logger.debug(
      { original: files.length, filtered: filesToParse.length },
      'Files filtered'
    );

    const results: ParsedFile[] = [];
    const errors: ParseErrorDetail[] = [];
    const warnings: ParseWarningDetail[] = [];
    const filesByParser: Record<string, number> = {};

    let processedCount = 0;
    let skippedCount = 0;

    // Process files with concurrency control
    const chunks = this.chunkArray(filesToParse, this.config.maxConcurrency);

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (file) => {
        try {
          const result = await this.parseFileWithRetry(file, parserOptions);

          processedCount++;

          if (onFileProcessed) {
            try {
              await onFileProcessed(processedCount, filesToParse.length);
            } catch (err) {
              logger.warn({ err }, 'Progress callback failed');
            }
          }

          return { file, result };
        } catch (err) {
          processedCount++;
          return { file, error: err };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);

      for (const { file, result, error } of chunkResults) {
        if (error) {
          errors.push({
            file: file.path,
            message: error instanceof Error ? error.message : String(error),
            code: 'PARSE_ERROR',
            recoverable: true,
          });
          continue;
        }

        if (!result) {
          skippedCount++;
          continue;
        }

        if (isParseSuccess(result)) {
          const parserName = result.metadata.parserName;
          filesByParser[parserName] = (filesByParser[parserName] ?? 0) + 1;

          results.push({
            path: file.path,
            type: file.type,
            ast: result.data,
            metadata: {
              parserName: result.metadata.parserName,
              parserVersion: result.metadata.parserVersion,
              parseTimeMs: result.metadata.parseTimeMs,
              fileSize: result.metadata.fileSize,
              lineCount: result.metadata.lineCount,
              cached: false, // TODO: Track from registry
            },
          });

          // Collect warnings
          for (const warning of result.warnings) {
            warnings.push({
              file: file.path,
              message: warning.message,
              code: warning.code,
              line: warning.location?.lineStart,
            });
          }
        } else if (isParseFailure(result)) {
          for (const parseError of result.errors) {
            errors.push({
              file: file.path,
              message: parseError.message,
              code: parseError.code,
              line: parseError.location?.lineStart,
              recoverable: parseError.severity !== 'fatal',
            });
          }
        }
      }
    }

    const totalParseTimeMs = Date.now() - startTime;

    const stats: ParserOrchestratorStats = {
      totalFiles: files.length,
      successfulFiles: results.length,
      failedFiles: errors.length,
      skippedFiles: skippedCount,
      totalParseTimeMs,
      avgParseTimeMs: results.length > 0 ? totalParseTimeMs / results.length : 0,
      filesByParser,
      cacheHitRate: this.calculateCacheHitRate(),
    };

    logger.info(
      {
        successful: results.length,
        failed: errors.length,
        skipped: skippedCount,
        durationMs: totalParseTimeMs,
      },
      'Batch parsing completed'
    );

    return {
      success: results.length > 0,
      results,
      errors,
      warnings,
      stats,
    };
  }

  /**
   * Parse a single file
   */
  async parseFile<T = unknown>(
    file: FileInput,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const parser = this.registry.getParser<T>(file.path);

    if (!parser) {
      return {
        success: false,
        errors: [{
          code: 'UNSUPPORTED_SYNTAX',
          message: `No parser found for file: ${file.path}`,
          location: null,
          severity: 'fatal',
        }],
        partialData: null,
        metadata: {
          filePath: file.path,
          parserName: 'unknown',
          parserVersion: '0.0.0',
          parseTimeMs: 0,
          fileSize: 0,
          encoding: 'utf-8',
          lineCount: 0,
        },
      };
    }

    if (file.content !== undefined) {
      return parser.parse(file.content, file.path, options);
    }

    return parser.parseFile(file.path, options);
  }

  /**
   * Get available parsers
   */
  getAvailableParsers(): string[] {
    return this.registry.getCapabilities().map(c => c.name);
  }

  /**
   * Check if a file can be parsed
   */
  canParse(filePath: string): boolean {
    return this.registry.getParser(filePath) !== undefined;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Filter files based on configuration
   */
  private filterFiles(files: FileInput[], config: ScanConfig): FileInput[] {
    return files.filter(file => {
      // Check if file type is in detectTypes
      if (file.type !== 'unknown') {
        const typeMap: Record<string, string> = {
          terraform: 'terraform',
          kubernetes: 'kubernetes',
          helm: 'helm',
          cloudformation: 'cloudformation',
        };

        const configType = typeMap[file.type];
        if (configType && !config.detectTypes.includes(configType as 'terraform' | 'kubernetes' | 'helm' | 'cloudformation')) {
          return false;
        }
      }

      // Check include patterns
      if (config.includePatterns.length > 0) {
        const included = config.includePatterns.some(pattern =>
          this.matchGlobPattern(file.path, pattern)
        );
        if (!included) return false;
      }

      // Check exclude patterns
      if (config.excludePatterns.length > 0) {
        const excluded = config.excludePatterns.some(pattern =>
          this.matchGlobPattern(file.path, pattern)
        );
        if (excluded) return false;
      }

      // Check if we have a parser
      return this.canParse(file.path);
    });
  }

  /**
   * Parse file with retry logic
   */
  private async parseFileWithRetry<T = unknown>(
    file: FileInput,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    let lastError: Error | null = null;
    let attempts = 0;

    while (attempts <= this.config.maxRetries) {
      try {
        const result = await this.parseFileWithTimeout(file, options);

        if (isParseSuccess(result)) {
          this.cacheMisses++;
          return result;
        }

        // Check if errors are recoverable
        const fatalErrors = result.errors.filter(e => e.severity === 'fatal');
        if (fatalErrors.length > 0 || !this.config.retryOnFailure) {
          return result;
        }

        attempts++;
        lastError = new Error(result.errors[0]?.message ?? 'Parse failed');
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        attempts++;

        if (!this.config.retryOnFailure) {
          break;
        }

        // Exponential backoff
        await this.delay(Math.pow(2, attempts) * 100);
      }
    }

    return {
      success: false,
      errors: [{
        code: 'PARSE_ERROR',
        message: lastError?.message ?? 'Parse failed after retries',
        location: null,
        severity: 'fatal',
      }],
      partialData: null,
      metadata: {
        filePath: file.path,
        parserName: 'unknown',
        parserVersion: '0.0.0',
        parseTimeMs: 0,
        fileSize: 0,
        encoding: 'utf-8',
        lineCount: 0,
      },
    };
  }

  /**
   * Parse file with timeout
   */
  private async parseFileWithTimeout<T = unknown>(
    file: FileInput,
    options?: ParserOptions
  ): Promise<ParseResult<T>> {
    const mergedOptions: ParserOptions = {
      ...options,
      timeout: this.config.perFileTimeoutMs,
    };

    return this.parseFile(file, mergedOptions);
  }

  /**
   * Simple glob pattern matching
   */
  private matchGlobPattern(path: string, pattern: string): boolean {
    // Convert glob to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\?/g, '.')
      .replace(/\./g, '\\.');

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate cache hit rate
   */
  private calculateCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    return total > 0 ? this.cacheHits / total : 0;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new parser orchestrator
 */
export function createParserOrchestrator(
  registry?: ParserRegistry,
  config?: Partial<ParserOrchestratorConfig>
): IParserOrchestrator {
  return new ParserOrchestrator(registry, config);
}
