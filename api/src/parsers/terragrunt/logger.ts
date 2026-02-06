/**
 * Terragrunt Parser Logger
 * @module parsers/terragrunt/logger
 *
 * TASK-TG-028: Logging infrastructure for Terragrunt node parsing and creation operations.
 *
 * Provides structured logging for:
 * - Parse start/complete/error operations
 * - Node creation events
 * - Batch progress tracking
 * - Include/dependency resolution
 * - Performance metrics
 *
 * Integrates with the core logging infrastructure for consistent log formatting
 * and output across the application.
 *
 * @example
 * ```typescript
 * import {
 *   createTerragruntLogger,
 *   logParseStart,
 *   logParseComplete,
 *   logNodeCreated,
 * } from './logger';
 *
 * // Create namespaced logger
 * const logger = createTerragruntLogger();
 *
 * // Log parse operations
 * logParseStart(logger, filePath, config);
 * // ... parsing ...
 * logParseComplete(logger, filePath, nodeCount, duration);
 * ```
 */

import { createModuleLogger, StructuredLogger } from '../../logging/logger';
import { TerragruntParserConfig } from './config';
import { TerragruntParseError } from './errors';
import { TerragruntConfigNode } from '../../types/graph';

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Create a namespaced logger for Terragrunt parsing operations.
 *
 * @param subModule - Optional sub-module name for further namespacing
 * @returns StructuredLogger instance for Terragrunt operations
 *
 * @example
 * ```typescript
 * const logger = createTerragruntLogger();
 * const nodeLogger = createTerragruntLogger('node-factory');
 * const batchLogger = createTerragruntLogger('batch');
 * ```
 */
export function createTerragruntLogger(subModule?: string): StructuredLogger {
  const moduleName = subModule
    ? `terragrunt:parser:${subModule}`
    : 'terragrunt:parser';
  return createModuleLogger(moduleName);
}

// ============================================================================
// Parse Operation Logging
// ============================================================================

/**
 * Log the start of a Terragrunt file parse operation.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file being parsed
 * @param config - Parser configuration in use
 */
export function logParseStart(
  logger: StructuredLogger,
  filePath: string,
  config: TerragruntParserConfig
): void {
  logger.debug(
    {
      event: 'terragrunt_parse_start',
      filePath,
      maxIncludeDepth: config.maxIncludeDepth,
      errorRecovery: config.errorRecovery,
      resolveFileSystem: config.resolveFileSystem,
      parseGenerateBlocks: config.parseGenerateBlocks,
    },
    `Starting Terragrunt parse: ${filePath}`
  );
}

/**
 * Log the successful completion of a Terragrunt file parse operation.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file that was parsed
 * @param nodeCount - Number of blocks/nodes found
 * @param duration - Parse duration in milliseconds
 */
export function logParseComplete(
  logger: StructuredLogger,
  filePath: string,
  nodeCount: number,
  duration: number
): void {
  logger.info(
    {
      event: 'terragrunt_parse_complete',
      filePath,
      nodeCount,
      durationMs: duration,
      nodesPerSecond: duration > 0 ? Math.round((nodeCount / duration) * 1000) : 0,
    },
    `Terragrunt parse complete: ${nodeCount} blocks in ${duration.toFixed(2)}ms`
  );
}

/**
 * Log a Terragrunt parse error.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file that failed to parse
 * @param error - The parse error that occurred
 */
export function logParseError(
  logger: StructuredLogger,
  filePath: string,
  error: TerragruntParseError | Error
): void {
  const isTerragruntError = 'code' in error && 'severity' in error;

  logger.error(
    {
      event: 'terragrunt_parse_error',
      filePath,
      errorCode: isTerragruntError ? (error as TerragruntParseError).code : 'UNKNOWN',
      errorMessage: error.message,
      severity: isTerragruntError ? (error as TerragruntParseError).severity : 'error',
      recoverable: isTerragruntError ? (error as TerragruntParseError).recoverable : false,
      location: isTerragruntError ? (error as TerragruntParseError).location : null,
    },
    `Terragrunt parse error in ${filePath}: ${error.message}`
  );
}

/**
 * Log a warning during Terragrunt parsing.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file being parsed
 * @param message - Warning message
 * @param details - Optional additional details
 */
export function logParseWarning(
  logger: StructuredLogger,
  filePath: string,
  message: string,
  details?: Record<string, unknown>
): void {
  logger.warn(
    {
      event: 'terragrunt_parse_warning',
      filePath,
      ...details,
    },
    `Terragrunt parse warning in ${filePath}: ${message}`
  );
}

/**
 * Log when a file is skipped during parsing.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file that was skipped
 * @param reason - Reason for skipping
 */
export function logParseSkipped(
  logger: StructuredLogger,
  filePath: string,
  reason: string
): void {
  logger.debug(
    {
      event: 'terragrunt_parse_skipped',
      filePath,
      reason,
    },
    `Terragrunt parse skipped ${filePath}: ${reason}`
  );
}

// ============================================================================
// Node Creation Logging
// ============================================================================

/**
 * Log the creation of a TerragruntConfigNode.
 *
 * @param logger - The logger instance to use
 * @param nodeId - Unique identifier of the created node
 * @param nodeName - Human-readable name of the node
 * @param nodeType - Type of the node (typically 'tg_config')
 */
export function logNodeCreated(
  logger: StructuredLogger,
  nodeId: string,
  nodeName: string,
  nodeType: string
): void {
  logger.debug(
    {
      event: 'terragrunt_node_created',
      nodeId,
      nodeName,
      nodeType,
    },
    `Created Terragrunt node: ${nodeName} (${nodeType})`
  );
}

/**
 * Log the creation of a TerragruntConfigNode with full details.
 *
 * @param logger - The logger instance to use
 * @param node - The created node
 */
export function logNodeCreatedFull(
  logger: StructuredLogger,
  node: TerragruntConfigNode
): void {
  logger.debug(
    {
      event: 'terragrunt_node_created',
      nodeId: node.id,
      nodeName: node.name,
      nodeType: node.type,
      filePath: node.location.file,
      lineStart: node.location.lineStart,
      lineEnd: node.location.lineEnd,
      dependencyCount: node.dependencyCount,
      includeCount: node.includeCount,
      hasRemoteState: node.hasRemoteState,
      terraformSource: node.terraformSource,
    },
    `Created Terragrunt node: ${node.name} (${node.type})`
  );
}

/**
 * Log a node creation error.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file the node was being created from
 * @param error - The error that occurred
 */
export function logNodeCreationError(
  logger: StructuredLogger,
  filePath: string,
  error: Error
): void {
  logger.error(
    {
      event: 'terragrunt_node_creation_error',
      filePath,
      errorMessage: error.message,
      errorName: error.name,
    },
    `Failed to create Terragrunt node from ${filePath}: ${error.message}`
  );
}

// ============================================================================
// Batch Operation Logging
// ============================================================================

/**
 * Log the start of a batch parse operation.
 *
 * @param logger - The logger instance to use
 * @param totalFiles - Total number of files to process
 * @param directory - Directory being processed
 */
export function logBatchStart(
  logger: StructuredLogger,
  totalFiles: number,
  directory?: string
): void {
  logger.info(
    {
      event: 'terragrunt_batch_start',
      totalFiles,
      directory,
    },
    `Starting Terragrunt batch parse: ${totalFiles} files${directory ? ` in ${directory}` : ''}`
  );
}

/**
 * Log batch progress during parsing.
 *
 * @param logger - The logger instance to use
 * @param completed - Number of files completed
 * @param total - Total number of files
 * @param currentFile - Currently processing file (optional)
 */
export function logBatchProgress(
  logger: StructuredLogger,
  completed: number,
  total: number,
  currentFile?: string
): void {
  const percent = Math.round((completed / total) * 100);

  logger.debug(
    {
      event: 'terragrunt_batch_progress',
      completed,
      total,
      percent,
      currentFile,
    },
    `Terragrunt batch progress: ${completed}/${total} (${percent}%)${currentFile ? ` - ${currentFile}` : ''}`
  );
}

/**
 * Log the completion of a batch parse operation.
 *
 * @param logger - The logger instance to use
 * @param totalFiles - Total number of files processed
 * @param successCount - Number of successful parses
 * @param failureCount - Number of failed parses
 * @param duration - Total duration in milliseconds
 */
export function logBatchComplete(
  logger: StructuredLogger,
  totalFiles: number,
  successCount: number,
  failureCount: number,
  duration: number
): void {
  const level = failureCount > 0 ? 'warn' : 'info';

  logger[level](
    {
      event: 'terragrunt_batch_complete',
      totalFiles,
      successCount,
      failureCount,
      durationMs: duration,
      successRate: totalFiles > 0 ? ((successCount / totalFiles) * 100).toFixed(1) : '0',
      filesPerSecond: duration > 0 ? ((totalFiles / duration) * 1000).toFixed(2) : '0',
    },
    `Terragrunt batch complete: ${successCount}/${totalFiles} succeeded (${failureCount} failed) in ${duration.toFixed(2)}ms`
  );
}

// ============================================================================
// Include/Dependency Resolution Logging
// ============================================================================

/**
 * Log include resolution attempt.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the include
 * @param includeLabel - Label of the include block
 * @param targetPath - Path being resolved
 */
export function logIncludeResolution(
  logger: StructuredLogger,
  sourceFile: string,
  includeLabel: string,
  targetPath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_include_resolution',
      sourceFile,
      includeLabel,
      targetPath,
    },
    `Resolving include "${includeLabel}" in ${sourceFile} -> ${targetPath}`
  );
}

/**
 * Log successful include resolution.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the include
 * @param includeLabel - Label of the include block
 * @param resolvedPath - Successfully resolved path
 */
export function logIncludeResolved(
  logger: StructuredLogger,
  sourceFile: string,
  includeLabel: string,
  resolvedPath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_include_resolved',
      sourceFile,
      includeLabel,
      resolvedPath,
    },
    `Resolved include "${includeLabel}" in ${sourceFile} to ${resolvedPath}`
  );
}

/**
 * Log include resolution failure.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the include
 * @param includeLabel - Label of the include block
 * @param targetPath - Path that failed to resolve
 * @param reason - Reason for failure
 */
export function logIncludeResolutionFailed(
  logger: StructuredLogger,
  sourceFile: string,
  includeLabel: string,
  targetPath: string,
  reason: string
): void {
  logger.warn(
    {
      event: 'terragrunt_include_resolution_failed',
      sourceFile,
      includeLabel,
      targetPath,
      reason,
    },
    `Failed to resolve include "${includeLabel}" in ${sourceFile}: ${reason}`
  );
}

/**
 * Log dependency resolution attempt.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the dependency
 * @param dependencyName - Name of the dependency block
 * @param configPath - Config path being resolved
 */
export function logDependencyResolution(
  logger: StructuredLogger,
  sourceFile: string,
  dependencyName: string,
  configPath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_dependency_resolution',
      sourceFile,
      dependencyName,
      configPath,
    },
    `Resolving dependency "${dependencyName}" in ${sourceFile} -> ${configPath}`
  );
}

/**
 * Log successful dependency resolution.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the dependency
 * @param dependencyName - Name of the dependency block
 * @param resolvedPath - Successfully resolved path
 */
export function logDependencyResolved(
  logger: StructuredLogger,
  sourceFile: string,
  dependencyName: string,
  resolvedPath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_dependency_resolved',
      sourceFile,
      dependencyName,
      resolvedPath,
    },
    `Resolved dependency "${dependencyName}" in ${sourceFile} to ${resolvedPath}`
  );
}

/**
 * Log dependency resolution failure.
 *
 * @param logger - The logger instance to use
 * @param sourceFile - File containing the dependency
 * @param dependencyName - Name of the dependency block
 * @param configPath - Config path that failed to resolve
 * @param reason - Reason for failure
 */
export function logDependencyResolutionFailed(
  logger: StructuredLogger,
  sourceFile: string,
  dependencyName: string,
  configPath: string,
  reason: string
): void {
  logger.warn(
    {
      event: 'terragrunt_dependency_resolution_failed',
      sourceFile,
      dependencyName,
      configPath,
      reason,
    },
    `Failed to resolve dependency "${dependencyName}" in ${sourceFile}: ${reason}`
  );
}

// ============================================================================
// Performance Logging
// ============================================================================

/**
 * Log a performance metric for Terragrunt operations.
 *
 * @param logger - The logger instance to use
 * @param operation - Name of the operation being measured
 * @param duration - Duration in milliseconds
 * @param metadata - Additional metadata about the operation
 */
export function logPerformanceMetric(
  logger: StructuredLogger,
  operation: string,
  duration: number,
  metadata?: Record<string, unknown>
): void {
  logger.debug(
    {
      event: 'terragrunt_performance',
      operation,
      durationMs: duration,
      ...metadata,
    },
    `Terragrunt ${operation}: ${duration.toFixed(2)}ms`
  );
}

/**
 * Create a timing helper for measuring operation duration.
 *
 * @param logger - The logger instance to use
 * @param operation - Name of the operation being measured
 * @returns Object with end() method to log the timing
 *
 * @example
 * ```typescript
 * const timing = startTiming(logger, 'parse_file');
 * // ... do work ...
 * timing.end({ nodeCount: 5 });
 * ```
 */
export function startTiming(
  logger: StructuredLogger,
  operation: string
): { end: (metadata?: Record<string, unknown>) => number } {
  const startTime = performance.now();

  return {
    end(metadata?: Record<string, unknown>): number {
      const duration = performance.now() - startTime;
      logPerformanceMetric(logger, operation, duration, metadata);
      return duration;
    },
  };
}

// ============================================================================
// Debug/Diagnostic Logging
// ============================================================================

/**
 * Log lexer token stream (for debugging).
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file being lexed
 * @param tokenCount - Number of tokens generated
 * @param errorCount - Number of lexer errors
 */
export function logLexerComplete(
  logger: StructuredLogger,
  filePath: string,
  tokenCount: number,
  errorCount: number
): void {
  logger.debug(
    {
      event: 'terragrunt_lexer_complete',
      filePath,
      tokenCount,
      errorCount,
    },
    `Terragrunt lexer complete: ${tokenCount} tokens, ${errorCount} errors`
  );
}

/**
 * Log block parsing result.
 *
 * @param logger - The logger instance to use
 * @param blockType - Type of block parsed
 * @param blockLabel - Label of the block (if any)
 * @param filePath - Path to the file containing the block
 */
export function logBlockParsed(
  logger: StructuredLogger,
  blockType: string,
  blockLabel: string | undefined,
  filePath: string
): void {
  const labelPart = blockLabel ? ` "${blockLabel}"` : '';
  logger.debug(
    {
      event: 'terragrunt_block_parsed',
      blockType,
      blockLabel,
      filePath,
    },
    `Parsed Terragrunt block: ${blockType}${labelPart} in ${filePath}`
  );
}

/**
 * Log function call detection.
 *
 * @param logger - The logger instance to use
 * @param functionName - Name of the function detected
 * @param argCount - Number of arguments
 * @param filePath - Path to the file containing the function call
 */
export function logFunctionDetected(
  logger: StructuredLogger,
  functionName: string,
  argCount: number,
  filePath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_function_detected',
      functionName,
      argCount,
      filePath,
    },
    `Detected Terragrunt function: ${functionName}(${argCount} args) in ${filePath}`
  );
}

// ============================================================================
// Cache Logging
// ============================================================================

/**
 * Log cache hit.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the cached file
 */
export function logCacheHit(
  logger: StructuredLogger,
  filePath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_cache_hit',
      filePath,
    },
    `Terragrunt cache hit: ${filePath}`
  );
}

/**
 * Log cache miss.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the file not in cache
 */
export function logCacheMiss(
  logger: StructuredLogger,
  filePath: string
): void {
  logger.debug(
    {
      event: 'terragrunt_cache_miss',
      filePath,
    },
    `Terragrunt cache miss: ${filePath}`
  );
}

/**
 * Log cache eviction.
 *
 * @param logger - The logger instance to use
 * @param filePath - Path to the evicted file
 * @param reason - Reason for eviction
 */
export function logCacheEviction(
  logger: StructuredLogger,
  filePath: string,
  reason: 'expired' | 'capacity' | 'manual'
): void {
  logger.debug(
    {
      event: 'terragrunt_cache_eviction',
      filePath,
      reason,
    },
    `Terragrunt cache eviction: ${filePath} (${reason})`
  );
}

// ============================================================================
// Convenience Logger Class
// ============================================================================

/**
 * Convenience class that wraps logging functions for a specific context.
 *
 * @example
 * ```typescript
 * const parserLogger = new TerragruntParserLogger('/path/to/file.hcl');
 * parserLogger.parseStart(config);
 * // ... parsing ...
 * parserLogger.parseComplete(nodeCount, duration);
 * ```
 */
export class TerragruntParserLogger {
  private readonly logger: StructuredLogger;
  private readonly filePath: string;

  constructor(filePath: string, subModule?: string) {
    this.logger = createTerragruntLogger(subModule);
    this.filePath = filePath;
  }

  parseStart(config: TerragruntParserConfig): void {
    logParseStart(this.logger, this.filePath, config);
  }

  parseComplete(nodeCount: number, duration: number): void {
    logParseComplete(this.logger, this.filePath, nodeCount, duration);
  }

  parseError(error: TerragruntParseError | Error): void {
    logParseError(this.logger, this.filePath, error);
  }

  parseWarning(message: string, details?: Record<string, unknown>): void {
    logParseWarning(this.logger, this.filePath, message, details);
  }

  nodeCreated(node: TerragruntConfigNode): void {
    logNodeCreatedFull(this.logger, node);
  }

  nodeCreationError(error: Error): void {
    logNodeCreationError(this.logger, this.filePath, error);
  }

  includeResolution(includeLabel: string, targetPath: string): void {
    logIncludeResolution(this.logger, this.filePath, includeLabel, targetPath);
  }

  includeResolved(includeLabel: string, resolvedPath: string): void {
    logIncludeResolved(this.logger, this.filePath, includeLabel, resolvedPath);
  }

  includeResolutionFailed(includeLabel: string, targetPath: string, reason: string): void {
    logIncludeResolutionFailed(this.logger, this.filePath, includeLabel, targetPath, reason);
  }

  dependencyResolution(dependencyName: string, configPath: string): void {
    logDependencyResolution(this.logger, this.filePath, dependencyName, configPath);
  }

  dependencyResolved(dependencyName: string, resolvedPath: string): void {
    logDependencyResolved(this.logger, this.filePath, dependencyName, resolvedPath);
  }

  dependencyResolutionFailed(dependencyName: string, configPath: string, reason: string): void {
    logDependencyResolutionFailed(this.logger, this.filePath, dependencyName, configPath, reason);
  }

  blockParsed(blockType: string, blockLabel?: string): void {
    logBlockParsed(this.logger, blockType, blockLabel, this.filePath);
  }

  functionDetected(functionName: string, argCount: number): void {
    logFunctionDetected(this.logger, functionName, argCount, this.filePath);
  }

  startTiming(operation: string): ReturnType<typeof startTiming> {
    return startTiming(this.logger, operation);
  }

  /**
   * Get the underlying logger for custom logging.
   */
  getLogger(): StructuredLogger {
    return this.logger;
  }
}

/**
 * Convenience class for batch operation logging.
 */
export class TerragruntBatchLogger {
  private readonly logger: StructuredLogger;
  private readonly directory?: string;
  private totalFiles: number = 0;
  private completed: number = 0;
  private successCount: number = 0;
  private failureCount: number = 0;
  private startTime: number = 0;

  constructor(directory?: string) {
    this.logger = createTerragruntLogger('batch');
    this.directory = directory;
  }

  start(totalFiles: number): void {
    this.totalFiles = totalFiles;
    this.completed = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.startTime = performance.now();
    logBatchStart(this.logger, totalFiles, this.directory);
  }

  progress(currentFile?: string): void {
    logBatchProgress(this.logger, this.completed, this.totalFiles, currentFile);
  }

  fileComplete(success: boolean, currentFile?: string): void {
    this.completed++;
    if (success) {
      this.successCount++;
    } else {
      this.failureCount++;
    }
    this.progress(currentFile);
  }

  complete(): void {
    const duration = performance.now() - this.startTime;
    logBatchComplete(
      this.logger,
      this.totalFiles,
      this.successCount,
      this.failureCount,
      duration
    );
  }

  /**
   * Get the underlying logger for custom logging.
   */
  getLogger(): StructuredLogger {
    return this.logger;
  }
}
