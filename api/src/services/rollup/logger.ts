/**
 * Rollup Logger Module
 * @module services/rollup/logger
 *
 * Specialized logging for Cross-Repository Aggregation (Rollup) operations.
 * Provides structured logging with consistent fields, log level management,
 * correlation ID propagation, and sensitive data redaction.
 *
 * Features:
 * - Domain-specific logging methods for rollup lifecycle events
 * - Automatic correlation ID propagation
 * - Sensitive data redaction (credentials, tokens)
 * - Phase-based execution logging
 * - Performance timing utilities
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation logging implementation
 */

import {
  createLogger,
  StructuredLogger,
  LogContext,
  createModuleLogger,
  withLogging,
  getRequestContext,
} from '../../logging/logger.js';
import { TenantId, ScanId, RepositoryId } from '../../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  MatchingStrategy,
  RollupStatus,
} from '../../types/rollup.js';
import { isRollupError } from './errors.js';

// ============================================================================
// Rollup Log Context Interface
// ============================================================================

/**
 * Extended log context for rollup operations
 */
export interface RollupLogContext extends LogContext {
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Tenant ID */
  tenantId?: TenantId;
  /** Rollup configuration ID */
  rollupId?: RollupId;
  /** Execution ID */
  executionId?: RollupExecutionId;
  /** Current execution phase */
  phase?: RollupPhase;
  /** Node count for current operation */
  nodeCount?: number;
  /** Match count for current operation */
  matchCount?: number;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Strategy being used */
  strategy?: MatchingStrategy;
  /** Repository IDs involved */
  repositoryIds?: RepositoryId[];
  /** Scan IDs involved */
  scanIds?: ScanId[];
}

/**
 * Rollup execution phases for structured logging
 */
export type RollupPhase =
  | 'creation'
  | 'validation'
  | 'initialization'
  | 'fetch'
  | 'matching'
  | 'merge'
  | 'storage'
  | 'completion'
  | 'callback'
  | 'cleanup';

/**
 * Standard log fields for rollup operations
 */
export interface RollupLogFields {
  correlationId: string;
  tenantId: TenantId;
  rollupId?: RollupId;
  executionId?: RollupExecutionId;
  phase: RollupPhase;
  durationMs?: number;
  nodeCount?: number;
  matchCount?: number;
}

// ============================================================================
// Rollup Logger Interface
// ============================================================================

/**
 * Extended logger interface with rollup-specific methods
 */
export interface RollupLogger extends StructuredLogger {
  /** Create child logger with rollup context */
  withRollupContext(context: Partial<RollupLogContext>): RollupLogger;

  // Configuration lifecycle
  rollupCreated(rollupId: RollupId, name: string, repoCount: number): void;
  rollupUpdated(rollupId: RollupId, version: number, changes: string[]): void;
  rollupDeleted(rollupId: RollupId): void;
  rollupStatusChanged(rollupId: RollupId, oldStatus: RollupStatus, newStatus: RollupStatus): void;

  // Execution lifecycle
  executionStarted(executionId: RollupExecutionId, rollupId: RollupId, scanIds: ScanId[]): void;
  executionPhaseStarted(phase: RollupPhase, metadata?: Record<string, unknown>): void;
  executionPhaseCompleted(phase: RollupPhase, durationMs: number, metadata?: Record<string, unknown>): void;
  executionCompleted(executionId: RollupExecutionId, stats: ExecutionStats): void;
  executionFailed(executionId: RollupExecutionId, error: Error, phase: RollupPhase): void;
  executionProgress(phase: RollupPhase, progress: number, message: string): void;

  // Matching operations
  matcherStarted(strategy: MatchingStrategy, nodeCount: number): void;
  matcherCompleted(strategy: MatchingStrategy, matchCount: number, durationMs: number): void;
  matcherFailed(strategy: MatchingStrategy, error: Error): void;
  matchFound(strategy: MatchingStrategy, sourceNodeId: string, targetNodeId: string, confidence: number): void;

  // Merge operations
  mergeStarted(graphCount: number, totalNodes: number): void;
  mergeCompleted(mergedNodes: number, crossRepoEdges: number, durationMs: number): void;
  mergeFailed(error: Error, partialResults?: { nodesProcessed: number; edgesCreated: number }): void;
  mergeConflict(nodeIds: string[], conflictType: string, resolution: string): void;

  // Blast radius operations
  blastRadiusStarted(nodeIds: string[], maxDepth: number): void;
  blastRadiusCompleted(impactedNodes: number, durationMs: number): void;
  blastRadiusFailed(error: Error): void;

  // Performance and diagnostics
  performanceWarning(operation: string, durationMs: number, threshold: number): void;
  memoryUsage(operation: string, heapUsed: number, heapTotal: number): void;
}

/**
 * Execution statistics for logging
 */
export interface ExecutionStats {
  totalNodesProcessed: number;
  nodesMatched: number;
  nodesUnmatched: number;
  crossRepoEdgesCreated: number;
  executionTimeMs: number;
  matchesByStrategy: Record<string, number>;
}

// ============================================================================
// Sensitive Data Redaction
// ============================================================================

/**
 * Fields to redact from rollup logs
 */
const SENSITIVE_FIELDS = new Set([
  'password',
  'token',
  'authorization',
  'apiKey',
  'api_key',
  'secret',
  'secretKey',
  'secret_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'privateKey',
  'private_key',
  'credentials',
  'bearer',
  'webhook_secret',
  'callbackSecret',
]);

/**
 * Redact sensitive fields from metadata
 */
function redactSensitiveData(data: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.has(lowerKey) || [...SENSITIVE_FIELDS].some(f => lowerKey.includes(f))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      redacted[key] = redactSensitiveData(value as Record<string, unknown>);
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

// ============================================================================
// Rollup Logger Implementation
// ============================================================================

/**
 * Create rollup-specific domain methods for a logger
 */
function extendWithRollupMethods(logger: StructuredLogger, baseContext: Partial<RollupLogContext> = {}): RollupLogger {
  const extended = logger as RollupLogger;
  let currentContext: Partial<RollupLogContext> = { ...baseContext };

  // Helper to get context from request if available
  function getFullContext(): Partial<RollupLogContext> {
    const reqContext = getRequestContext();
    return {
      correlationId: reqContext?.requestId,
      tenantId: reqContext?.tenantId as TenantId,
      ...currentContext,
    };
  }

  // Helper to create log metadata with standard fields
  function createLogData(
    event: string,
    additionalData: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const ctx = getFullContext();
    return redactSensitiveData({
      event,
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      rollupId: ctx.rollupId,
      executionId: ctx.executionId,
      phase: ctx.phase,
      ...additionalData,
    });
  }

  // withRollupContext - create child logger with rollup context
  extended.withRollupContext = function (context: Partial<RollupLogContext>): RollupLogger {
    const childLogger = this.child({
      ...currentContext,
      ...context,
    });
    return extendWithRollupMethods(childLogger, { ...currentContext, ...context });
  };

  // ===== Configuration Lifecycle =====

  extended.rollupCreated = function (rollupId: RollupId, name: string, repoCount: number): void {
    this.info(
      createLogData('rollup_created', {
        rollupId,
        rollupName: name,
        repositoryCount: repoCount,
      }),
      `Rollup configuration created: ${name} with ${repoCount} repositories`
    );
  };

  extended.rollupUpdated = function (rollupId: RollupId, version: number, changes: string[]): void {
    this.info(
      createLogData('rollup_updated', {
        rollupId,
        version,
        changes,
        changeCount: changes.length,
      }),
      `Rollup updated to version ${version}: ${changes.join(', ')}`
    );
  };

  extended.rollupDeleted = function (rollupId: RollupId): void {
    this.info(
      createLogData('rollup_deleted', { rollupId }),
      `Rollup configuration deleted: ${rollupId}`
    );
  };

  extended.rollupStatusChanged = function (
    rollupId: RollupId,
    oldStatus: RollupStatus,
    newStatus: RollupStatus
  ): void {
    this.info(
      createLogData('rollup_status_changed', {
        rollupId,
        oldStatus,
        newStatus,
      }),
      `Rollup status changed: ${oldStatus} -> ${newStatus}`
    );
  };

  // ===== Execution Lifecycle =====

  extended.executionStarted = function (
    executionId: RollupExecutionId,
    rollupId: RollupId,
    scanIds: ScanId[]
  ): void {
    currentContext = { ...currentContext, executionId, rollupId, phase: 'initialization' };
    this.info(
      createLogData('rollup_execution_started', {
        executionId,
        rollupId,
        scanIds,
        scanCount: scanIds.length,
      }),
      `Rollup execution started: ${executionId} for rollup ${rollupId} with ${scanIds.length} scans`
    );
  };

  extended.executionPhaseStarted = function (
    phase: RollupPhase,
    metadata?: Record<string, unknown>
  ): void {
    currentContext = { ...currentContext, phase };
    this.debug(
      createLogData('rollup_phase_started', {
        phase,
        ...metadata,
      }),
      `Execution phase started: ${phase}`
    );
  };

  extended.executionPhaseCompleted = function (
    phase: RollupPhase,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(
      createLogData('rollup_phase_completed', {
        phase,
        durationMs,
        ...metadata,
      }),
      `Execution phase completed: ${phase} in ${durationMs}ms`
    );
  };

  extended.executionCompleted = function (
    executionId: RollupExecutionId,
    stats: ExecutionStats
  ): void {
    currentContext = { ...currentContext, phase: 'completion' };
    this.info(
      createLogData('rollup_execution_completed', {
        executionId,
        stats,
        nodesProcessed: stats.totalNodesProcessed,
        nodesMatched: stats.nodesMatched,
        crossRepoEdges: stats.crossRepoEdgesCreated,
        executionTimeMs: stats.executionTimeMs,
        throughput: stats.executionTimeMs > 0
          ? Math.round((stats.totalNodesProcessed / stats.executionTimeMs) * 1000)
          : 0,
      }),
      `Rollup execution completed: ${stats.nodesMatched} nodes matched, ${stats.crossRepoEdgesCreated} cross-repo edges in ${stats.executionTimeMs}ms`
    );
  };

  extended.executionFailed = function (
    executionId: RollupExecutionId,
    error: Error,
    phase: RollupPhase
  ): void {
    this.error(
      createLogData('rollup_execution_failed', {
        executionId,
        phase,
        errorName: error.name,
        errorCode: isRollupError(error) ? error.code : undefined,
        errorMessage: error.message,
      }),
      `Rollup execution failed in ${phase}: ${error.message}`
    );
  };

  extended.executionProgress = function (
    phase: RollupPhase,
    progress: number,
    message: string
  ): void {
    this.debug(
      createLogData('rollup_execution_progress', {
        phase,
        progress,
        progressPercent: Math.round(progress * 100),
      }),
      `[${Math.round(progress * 100)}%] ${message}`
    );
  };

  // ===== Matching Operations =====

  extended.matcherStarted = function (strategy: MatchingStrategy, nodeCount: number): void {
    this.debug(
      createLogData('rollup_matcher_started', {
        strategy,
        nodeCount,
      }),
      `Matcher ${strategy} started with ${nodeCount} nodes`
    );
  };

  extended.matcherCompleted = function (
    strategy: MatchingStrategy,
    matchCount: number,
    durationMs: number
  ): void {
    this.debug(
      createLogData('rollup_matcher_completed', {
        strategy,
        matchCount,
        durationMs,
        matchesPerSecond: durationMs > 0 ? Math.round((matchCount / durationMs) * 1000) : 0,
      }),
      `Matcher ${strategy} completed: ${matchCount} matches in ${durationMs}ms`
    );
  };

  extended.matcherFailed = function (strategy: MatchingStrategy, error: Error): void {
    this.warn(
      createLogData('rollup_matcher_failed', {
        strategy,
        errorName: error.name,
        errorMessage: error.message,
      }),
      `Matcher ${strategy} failed: ${error.message}`
    );
  };

  extended.matchFound = function (
    strategy: MatchingStrategy,
    sourceNodeId: string,
    targetNodeId: string,
    confidence: number
  ): void {
    this.trace?.(
      createLogData('rollup_match_found', {
        strategy,
        sourceNodeId,
        targetNodeId,
        confidence,
      }),
      `Match found: ${sourceNodeId} <-> ${targetNodeId} (confidence: ${confidence}%)`
    ) || this.debug(
      createLogData('rollup_match_found', {
        strategy,
        sourceNodeId,
        targetNodeId,
        confidence,
      }),
      `Match found: ${sourceNodeId} <-> ${targetNodeId} (confidence: ${confidence}%)`
    );
  };

  // ===== Merge Operations =====

  extended.mergeStarted = function (graphCount: number, totalNodes: number): void {
    this.debug(
      createLogData('rollup_merge_started', {
        graphCount,
        totalNodes,
      }),
      `Graph merge started: ${graphCount} graphs with ${totalNodes} total nodes`
    );
  };

  extended.mergeCompleted = function (
    mergedNodes: number,
    crossRepoEdges: number,
    durationMs: number
  ): void {
    this.info(
      createLogData('rollup_merge_completed', {
        mergedNodes,
        crossRepoEdges,
        durationMs,
        nodesPerSecond: durationMs > 0 ? Math.round((mergedNodes / durationMs) * 1000) : 0,
      }),
      `Graph merge completed: ${mergedNodes} merged nodes, ${crossRepoEdges} cross-repo edges in ${durationMs}ms`
    );
  };

  extended.mergeFailed = function (
    error: Error,
    partialResults?: { nodesProcessed: number; edgesCreated: number }
  ): void {
    this.error(
      createLogData('rollup_merge_failed', {
        errorName: error.name,
        errorMessage: error.message,
        partialResults,
      }),
      `Graph merge failed: ${error.message}`
    );
  };

  extended.mergeConflict = function (
    nodeIds: string[],
    conflictType: string,
    resolution: string
  ): void {
    this.warn(
      createLogData('rollup_merge_conflict', {
        nodeIds,
        conflictType,
        resolution,
      }),
      `Merge conflict (${conflictType}): resolved with ${resolution}`
    );
  };

  // ===== Blast Radius Operations =====

  extended.blastRadiusStarted = function (nodeIds: string[], maxDepth: number): void {
    this.debug(
      createLogData('rollup_blast_radius_started', {
        nodeIds,
        nodeCount: nodeIds.length,
        maxDepth,
      }),
      `Blast radius analysis started for ${nodeIds.length} nodes (max depth: ${maxDepth})`
    );
  };

  extended.blastRadiusCompleted = function (impactedNodes: number, durationMs: number): void {
    this.info(
      createLogData('rollup_blast_radius_completed', {
        impactedNodes,
        durationMs,
      }),
      `Blast radius analysis completed: ${impactedNodes} impacted nodes in ${durationMs}ms`
    );
  };

  extended.blastRadiusFailed = function (error: Error): void {
    this.error(
      createLogData('rollup_blast_radius_failed', {
        errorName: error.name,
        errorMessage: error.message,
      }),
      `Blast radius analysis failed: ${error.message}`
    );
  };

  // ===== Performance and Diagnostics =====

  extended.performanceWarning = function (
    operation: string,
    durationMs: number,
    threshold: number
  ): void {
    this.warn(
      createLogData('rollup_performance_warning', {
        operation,
        durationMs,
        threshold,
        exceedance: durationMs - threshold,
        exceedancePercent: Math.round(((durationMs - threshold) / threshold) * 100),
      }),
      `Performance warning: ${operation} took ${durationMs}ms (threshold: ${threshold}ms)`
    );
  };

  extended.memoryUsage = function (
    operation: string,
    heapUsed: number,
    heapTotal: number
  ): void {
    const usagePercent = Math.round((heapUsed / heapTotal) * 100);
    this.debug(
      createLogData('rollup_memory_usage', {
        operation,
        heapUsedMb: Math.round(heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(heapTotal / 1024 / 1024),
        usagePercent,
      }),
      `Memory usage (${operation}): ${Math.round(heapUsed / 1024 / 1024)}MB / ${Math.round(heapTotal / 1024 / 1024)}MB (${usagePercent}%)`
    );
  };

  // Override child to preserve rollup methods
  const originalChild = extended.child.bind(extended);
  extended.child = function (bindings: LogContext): RollupLogger {
    const childLogger = originalChild(bindings);
    return extendWithRollupMethods(childLogger, { ...currentContext, ...bindings });
  };

  return extended;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a rollup-specific logger
 * @param context - Initial rollup context
 * @returns RollupLogger instance
 */
export function createRollupLogger(context?: Partial<RollupLogContext>): RollupLogger {
  const baseLogger = createModuleLogger('rollup');
  return extendWithRollupMethods(baseLogger, context);
}

/**
 * Create a rollup logger for a specific execution
 * @param executionId - Execution ID
 * @param rollupId - Rollup ID
 * @param tenantId - Tenant ID
 * @returns RollupLogger instance
 */
export function createExecutionLogger(
  executionId: RollupExecutionId,
  rollupId: RollupId,
  tenantId: TenantId
): RollupLogger {
  return createRollupLogger({
    executionId,
    rollupId,
    tenantId,
    operation: 'rollup-execution',
  });
}

/**
 * Create a rollup logger for configuration operations
 * @param rollupId - Rollup ID
 * @param tenantId - Tenant ID
 * @returns RollupLogger instance
 */
export function createConfigLogger(
  rollupId: RollupId,
  tenantId: TenantId
): RollupLogger {
  return createRollupLogger({
    rollupId,
    tenantId,
    operation: 'rollup-config',
  });
}

// ============================================================================
// Singleton Instance
// ============================================================================

let rollupLoggerInstance: RollupLogger | null = null;

/**
 * Get the singleton rollup logger instance
 * @returns RollupLogger instance
 */
export function getRollupLogger(): RollupLogger {
  if (!rollupLoggerInstance) {
    rollupLoggerInstance = createRollupLogger();
  }
  return rollupLoggerInstance;
}

/**
 * Reset the singleton logger (for testing)
 */
export function resetRollupLogger(): void {
  rollupLoggerInstance = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wrap an async function with rollup-specific logging
 * @param logger - RollupLogger instance
 * @param phase - Execution phase
 * @param fn - Function to wrap
 * @returns Result of the function
 */
export async function withRollupLogging<T>(
  logger: RollupLogger,
  phase: RollupPhase,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  logger.executionPhaseStarted(phase);

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    logger.executionPhaseCompleted(phase, durationMs);
    return result;
  } catch (error) {
    const durationMs = Date.now() - startTime;
    logger.executionPhaseCompleted(phase, durationMs, { status: 'failed' });
    throw error;
  }
}

/**
 * Create a timed operation wrapper for rollup operations
 * @param logger - RollupLogger instance
 * @param operationName - Name of the operation
 * @param warningThresholdMs - Threshold for performance warning
 * @returns Timer control object
 */
export function createRollupTimer(
  logger: RollupLogger,
  operationName: string,
  warningThresholdMs: number = 5000
): {
  end: (metadata?: Record<string, unknown>) => number;
  checkpoint: (checkpointName: string) => void;
} {
  const startTime = Date.now();
  let lastCheckpoint = startTime;

  return {
    end(metadata?: Record<string, unknown>): number {
      const durationMs = Date.now() - startTime;

      if (durationMs > warningThresholdMs) {
        logger.performanceWarning(operationName, durationMs, warningThresholdMs);
      }

      return durationMs;
    },
    checkpoint(checkpointName: string): void {
      const now = Date.now();
      const sinceStart = now - startTime;
      const sinceLastCheckpoint = now - lastCheckpoint;
      lastCheckpoint = now;

      logger.debug(
        {
          event: 'rollup_checkpoint',
          operation: operationName,
          checkpoint: checkpointName,
          sinceStartMs: sinceStart,
          sinceLastCheckpointMs: sinceLastCheckpoint,
        },
        `Checkpoint ${checkpointName}: ${sinceStart}ms from start, ${sinceLastCheckpoint}ms since last`
      );
    },
  };
}
