/**
 * External Object Index Logger
 * @module services/rollup/external-object-index/logger
 *
 * Specialized logging infrastructure for External Object Index operations.
 * Provides structured logging with consistent fields, performance monitoring,
 * and correlation ID propagation for observability.
 *
 * Features:
 * - Domain-specific logging methods for index lifecycle events
 * - Performance tracking for NFR-PERF-008 compliance (100K nodes < 500ms)
 * - Automatic correlation ID propagation from request context
 * - Sensitive data redaction
 * - Cache layer identification in logs
 * - Operation timing utilities
 *
 * TASK-ROLLUP-003: External Object Index logging infrastructure
 * NFR-PERF-008: Performance monitoring for 100K nodes < 500ms benchmark target
 */

import {
  createModuleLogger,
  StructuredLogger,
  LogContext,
} from '../../../logging/logger.js';
import { getRequestContext } from '../../../logging/request-context.js';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import type { ExternalReferenceType } from './interfaces.js';
import { isExternalObjectIndexError } from './errors.js';

// ============================================================================
// Log Event Constants
// ============================================================================

/**
 * Standard log events for External Object Index operations
 * Using consistent naming convention for easy searching/filtering
 */
export const LogEvents = {
  // ===========================================================================
  // Index Build Operations
  // ===========================================================================
  /** Index build operation started */
  INDEX_BUILD_STARTED: 'index_build_started',
  /** Index build progress update */
  INDEX_BUILD_PROGRESS: 'index_build_progress',
  /** Index build operation completed successfully */
  INDEX_BUILD_COMPLETED: 'index_build_completed',
  /** Index build operation failed */
  INDEX_BUILD_FAILED: 'index_build_failed',
  /** Index build operation cancelled */
  INDEX_BUILD_CANCELLED: 'index_build_cancelled',

  // ===========================================================================
  // Lookup Operations
  // ===========================================================================
  /** Lookup operation started */
  LOOKUP_STARTED: 'lookup_started',
  /** Lookup operation completed */
  LOOKUP_COMPLETED: 'lookup_completed',
  /** Lookup resulted in cache hit */
  LOOKUP_CACHE_HIT: 'lookup_cache_hit',
  /** Lookup resulted in cache miss */
  LOOKUP_CACHE_MISS: 'lookup_cache_miss',
  /** Lookup operation failed */
  LOOKUP_FAILED: 'lookup_failed',
  /** Lookup operation timed out */
  LOOKUP_TIMEOUT: 'lookup_timeout',

  // ===========================================================================
  // Reverse Lookup Operations
  // ===========================================================================
  /** Reverse lookup started */
  REVERSE_LOOKUP_STARTED: 'reverse_lookup_started',
  /** Reverse lookup completed */
  REVERSE_LOOKUP_COMPLETED: 'reverse_lookup_completed',
  /** Reverse lookup failed */
  REVERSE_LOOKUP_FAILED: 'reverse_lookup_failed',

  // ===========================================================================
  // Extraction Operations
  // ===========================================================================
  /** Node extraction started */
  EXTRACTION_STARTED: 'extraction_started',
  /** Node extraction completed */
  EXTRACTION_COMPLETED: 'extraction_completed',
  /** Node extraction failed */
  EXTRACTION_FAILED: 'extraction_failed',
  /** No references found in node */
  EXTRACTION_NO_REFS: 'extraction_no_refs',

  // ===========================================================================
  // Cache Operations
  // ===========================================================================
  /** Cache entry set */
  CACHE_SET: 'cache_set',
  /** Cache entry deleted */
  CACHE_DELETE: 'cache_delete',
  /** Cache invalidation triggered */
  CACHE_INVALIDATED: 'cache_invalidated',
  /** Cache operation error */
  CACHE_ERROR: 'cache_error',
  /** Cache warmup operation */
  CACHE_WARMUP: 'cache_warmup',

  // ===========================================================================
  // Repository Operations
  // ===========================================================================
  /** Repository save operation */
  REPOSITORY_SAVE: 'repository_save',
  /** Repository query operation */
  REPOSITORY_QUERY: 'repository_query',
  /** Repository delete operation */
  REPOSITORY_DELETE: 'repository_delete',
  /** Repository error */
  REPOSITORY_ERROR: 'repository_error',

  // ===========================================================================
  // Performance Monitoring
  // ===========================================================================
  /** Performance metric recorded */
  PERFORMANCE_METRIC: 'performance_metric',
  /** Performance threshold exceeded (warning) */
  PERFORMANCE_WARNING: 'performance_warning',
  /** Performance threshold significantly exceeded (alert) */
  PERFORMANCE_ALERT: 'performance_alert',

  // ===========================================================================
  // Service Lifecycle
  // ===========================================================================
  /** Service initialized */
  SERVICE_INITIALIZED: 'service_initialized',
  /** Service configuration loaded */
  SERVICE_CONFIG_LOADED: 'service_config_loaded',
  /** Service shutdown */
  SERVICE_SHUTDOWN: 'service_shutdown',
} as const;

export type LogEvent = typeof LogEvents[keyof typeof LogEvents];

// ============================================================================
// Performance Thresholds
// ============================================================================

/**
 * Performance thresholds for NFR-PERF-008 monitoring
 */
export const PerformanceThresholds = {
  /** Single lookup timeout threshold (ms) */
  LOOKUP_WARN_MS: 100,
  /** Lookup alert threshold - significantly over target */
  LOOKUP_ALERT_MS: 500,

  /** Reverse lookup warning threshold (ms) */
  REVERSE_LOOKUP_WARN_MS: 500,
  /** Reverse lookup alert threshold */
  REVERSE_LOOKUP_ALERT_MS: 2000,

  /** Index build per-node warning threshold (ms/node) */
  BUILD_PER_NODE_WARN_MS: 0.005, // 5ms per 1000 nodes = 500ms for 100K
  /** Index build total warning threshold for 100K nodes (ms) */
  BUILD_100K_WARN_MS: 500,

  /** Cache operation warning threshold (ms) */
  CACHE_WARN_MS: 50,

  /** Repository query warning threshold (ms) */
  REPOSITORY_WARN_MS: 200,
} as const;

// ============================================================================
// External Index Log Context
// ============================================================================

/**
 * Extended log context for External Object Index operations
 */
export interface ExternalIndexLogContext extends LogContext {
  /** Correlation ID for request tracing */
  correlationId?: string;
  /** Tenant ID */
  tenantId?: TenantId;
  /** Repository ID being processed */
  repositoryId?: RepositoryId;
  /** Scan ID being processed */
  scanId?: ScanId;
  /** Current operation type */
  operation?: ExternalIndexOperation;
  /** External ID being looked up */
  externalId?: string;
  /** Reference type being processed */
  referenceType?: ExternalReferenceType;
  /** Node ID being processed */
  nodeId?: string;
  /** Cache layer (l1, l2) */
  cacheLayer?: 'l1' | 'l2' | 'both';
  /** Build ID for index operations */
  buildId?: string;
}

/**
 * Operation types for external index logging
 */
export type ExternalIndexOperation =
  | 'build'
  | 'lookup'
  | 'reverse-lookup'
  | 'invalidate'
  | 'extract'
  | 'cache-read'
  | 'cache-write'
  | 'repository-query'
  | 'repository-save';

// ============================================================================
// External Index Logger Interface
// ============================================================================

/**
 * Extended logger interface with External Object Index specific methods
 */
export interface ExternalIndexLogger extends StructuredLogger {
  /** Create child logger with index context */
  withIndexContext(context: Partial<ExternalIndexLogContext>): ExternalIndexLogger;

  // ===== Index Build Operations =====
  buildStarted(
    tenantId: TenantId,
    repositoryIds: RepositoryId[],
    nodeCount?: number,
    options?: { batchSize?: number; buildId?: string }
  ): void;
  buildProgress(
    progress: number,
    processed: number,
    total: number,
    durationMs: number
  ): void;
  buildCompleted(
    entriesCreated: number,
    entriesUpdated: number,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void;
  buildFailed(error: Error, partialProgress?: { processed: number; total: number }): void;

  // ===== Lookup Operations =====
  lookupStarted(
    externalId: string,
    referenceType?: ExternalReferenceType
  ): void;
  lookupCompleted(
    externalId: string,
    entryCount: number,
    durationMs: number,
    cacheHit: boolean,
    cacheLayer?: 'l1' | 'l2'
  ): void;
  lookupFailed(externalId: string, error: Error): void;

  // ===== Reverse Lookup Operations =====
  reverseLookupStarted(nodeId: string, scanId: ScanId): void;
  reverseLookupCompleted(
    nodeId: string,
    referenceCount: number,
    durationMs: number,
    cacheHit: boolean
  ): void;
  reverseLookupFailed(nodeId: string, error: Error): void;

  // ===== Extraction Operations =====
  extractionStarted(nodeId: string, nodeType: string): void;
  extractionCompleted(
    nodeId: string,
    referenceCount: number,
    durationMs: number
  ): void;
  extractionFailed(
    nodeId: string,
    referenceType: ExternalReferenceType,
    error: Error
  ): void;

  // ===== Cache Operations =====
  cacheHit(key: string, layer: 'l1' | 'l2', durationMs: number): void;
  cacheMiss(key: string, durationMs: number): void;
  cacheSet(key: string, entryCount: number, ttlMs?: number): void;
  cacheInvalidated(pattern: string, deletedCount: number): void;
  cacheError(operation: string, error: Error, layer?: 'l1' | 'l2'): void;

  // ===== Performance Monitoring =====
  performanceMetric(
    operation: string,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void;
  performanceWarning(
    operation: string,
    durationMs: number,
    thresholdMs: number,
    metadata?: Record<string, unknown>
  ): void;
}

// ============================================================================
// Sensitive Data Redaction
// ============================================================================

/**
 * Fields to redact from external index logs
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
// External Index Logger Implementation
// ============================================================================

/**
 * Extend a StructuredLogger with External Index specific methods
 */
function extendWithIndexMethods(
  logger: StructuredLogger,
  baseContext: Partial<ExternalIndexLogContext> = {}
): ExternalIndexLogger {
  const extended = logger as ExternalIndexLogger;
  let currentContext: Partial<ExternalIndexLogContext> = { ...baseContext };

  // Helper to get context from request if available
  function getFullContext(): Partial<ExternalIndexLogContext> {
    const reqContext = getRequestContext();
    return {
      correlationId: reqContext?.requestId,
      tenantId: reqContext?.tenantId as TenantId,
      ...currentContext,
    };
  }

  // Helper to create log metadata with standard fields
  function createLogData(
    event: LogEvent,
    additionalData: Record<string, unknown> = {}
  ): Record<string, unknown> {
    const ctx = getFullContext();
    return redactSensitiveData({
      event,
      correlationId: ctx.correlationId,
      tenantId: ctx.tenantId,
      repositoryId: ctx.repositoryId,
      scanId: ctx.scanId,
      operation: ctx.operation,
      ...additionalData,
    });
  }

  // withIndexContext - create child logger with index context
  extended.withIndexContext = function (
    context: Partial<ExternalIndexLogContext>
  ): ExternalIndexLogger {
    const childLogger = this.child({
      ...currentContext,
      ...context,
    });
    return extendWithIndexMethods(childLogger, { ...currentContext, ...context });
  };

  // ===== Index Build Operations =====

  extended.buildStarted = function (
    tenantId: TenantId,
    repositoryIds: RepositoryId[],
    nodeCount?: number,
    options?: { batchSize?: number; buildId?: string }
  ): void {
    currentContext = {
      ...currentContext,
      tenantId,
      operation: 'build',
      buildId: options?.buildId,
    };
    this.info(
      createLogData(LogEvents.INDEX_BUILD_STARTED, {
        tenantId,
        repositoryIds,
        repositoryCount: repositoryIds.length,
        nodeCount,
        batchSize: options?.batchSize,
        buildId: options?.buildId,
      }),
      `Index build started for ${repositoryIds.length} repositories${nodeCount ? ` (${nodeCount} nodes)` : ''}`
    );
  };

  extended.buildProgress = function (
    progress: number,
    processed: number,
    total: number,
    durationMs: number
  ): void {
    const throughput = durationMs > 0 ? Math.round((processed / durationMs) * 1000) : 0;
    this.debug(
      createLogData(LogEvents.INDEX_BUILD_PROGRESS, {
        progress,
        progressPercent: Math.round(progress * 100),
        processed,
        total,
        durationMs,
        throughputNodesPerSec: throughput,
      }),
      `Build progress: ${Math.round(progress * 100)}% (${processed}/${total} nodes, ${throughput} nodes/sec)`
    );
  };

  extended.buildCompleted = function (
    entriesCreated: number,
    entriesUpdated: number,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void {
    const totalEntries = entriesCreated + entriesUpdated;
    const throughput = durationMs > 0 ? Math.round((totalEntries / durationMs) * 1000) : 0;

    // Check performance thresholds
    const perEntryMs = totalEntries > 0 ? durationMs / totalEntries : 0;
    if (perEntryMs > PerformanceThresholds.BUILD_PER_NODE_WARN_MS) {
      this.warn(
        createLogData(LogEvents.PERFORMANCE_WARNING, {
          operation: 'index_build',
          durationMs,
          entriesCreated,
          entriesUpdated,
          perEntryMs: perEntryMs.toFixed(4),
          thresholdMs: PerformanceThresholds.BUILD_PER_NODE_WARN_MS,
        }),
        `Index build exceeded per-node threshold: ${perEntryMs.toFixed(4)}ms/node (threshold: ${PerformanceThresholds.BUILD_PER_NODE_WARN_MS}ms)`
      );
    }

    this.info(
      createLogData(LogEvents.INDEX_BUILD_COMPLETED, {
        entriesCreated,
        entriesUpdated,
        totalEntries,
        durationMs,
        throughputEntriesPerSec: throughput,
        ...metadata,
      }),
      `Index build completed: ${entriesCreated} created, ${entriesUpdated} updated in ${durationMs}ms (${throughput} entries/sec)`
    );
  };

  extended.buildFailed = function (
    error: Error,
    partialProgress?: { processed: number; total: number }
  ): void {
    this.error(
      createLogData(LogEvents.INDEX_BUILD_FAILED, {
        errorName: error.name,
        errorCode: isExternalObjectIndexError(error) ? error.code : undefined,
        errorMessage: error.message,
        partialProgress,
        retryable: isExternalObjectIndexError(error) ? error.retryable : false,
      }),
      `Index build failed: ${error.message}${partialProgress ? ` (processed ${partialProgress.processed}/${partialProgress.total})` : ''}`
    );
  };

  // ===== Lookup Operations =====

  extended.lookupStarted = function (
    externalId: string,
    referenceType?: ExternalReferenceType
  ): void {
    currentContext = { ...currentContext, operation: 'lookup', externalId, referenceType };
    this.debug(
      createLogData(LogEvents.LOOKUP_STARTED, {
        externalId,
        referenceType,
      }),
      `Lookup started: ${externalId}${referenceType ? ` (${referenceType})` : ''}`
    );
  };

  extended.lookupCompleted = function (
    externalId: string,
    entryCount: number,
    durationMs: number,
    cacheHit: boolean,
    cacheLayer?: 'l1' | 'l2'
  ): void {
    // Log cache event first
    if (cacheHit) {
      this.debug(
        createLogData(LogEvents.LOOKUP_CACHE_HIT, {
          externalId,
          cacheLayer,
          durationMs,
        }),
        `Cache hit for ${externalId} (${cacheLayer}, ${durationMs}ms)`
      );
    } else {
      this.debug(
        createLogData(LogEvents.LOOKUP_CACHE_MISS, {
          externalId,
          durationMs,
        }),
        `Cache miss for ${externalId} (${durationMs}ms)`
      );
    }

    // Check performance thresholds
    if (durationMs > PerformanceThresholds.LOOKUP_ALERT_MS) {
      this.warn(
        createLogData(LogEvents.PERFORMANCE_ALERT, {
          operation: 'lookup',
          externalId,
          durationMs,
          thresholdMs: PerformanceThresholds.LOOKUP_ALERT_MS,
          cacheHit,
        }),
        `Lookup significantly exceeded threshold: ${durationMs}ms (threshold: ${PerformanceThresholds.LOOKUP_ALERT_MS}ms)`
      );
    } else if (durationMs > PerformanceThresholds.LOOKUP_WARN_MS) {
      this.warn(
        createLogData(LogEvents.PERFORMANCE_WARNING, {
          operation: 'lookup',
          externalId,
          durationMs,
          thresholdMs: PerformanceThresholds.LOOKUP_WARN_MS,
          cacheHit,
        }),
        `Lookup exceeded NFR-PERF-008 threshold: ${durationMs}ms (target: ${PerformanceThresholds.LOOKUP_WARN_MS}ms)`
      );
    }

    // Log completion
    this.info(
      createLogData(LogEvents.LOOKUP_COMPLETED, {
        externalId,
        entryCount,
        durationMs,
        cacheHit,
        cacheLayer,
      }),
      `Lookup completed: ${entryCount} entries in ${durationMs}ms (cache: ${cacheHit ? cacheLayer : 'miss'})`
    );
  };

  extended.lookupFailed = function (externalId: string, error: Error): void {
    this.error(
      createLogData(LogEvents.LOOKUP_FAILED, {
        externalId,
        errorName: error.name,
        errorCode: isExternalObjectIndexError(error) ? error.code : undefined,
        errorMessage: error.message,
      }),
      `Lookup failed for ${externalId}: ${error.message}`
    );
  };

  // ===== Reverse Lookup Operations =====

  extended.reverseLookupStarted = function (nodeId: string, scanId: ScanId): void {
    currentContext = { ...currentContext, operation: 'reverse-lookup', nodeId, scanId };
    this.debug(
      createLogData(LogEvents.REVERSE_LOOKUP_STARTED, {
        nodeId,
        scanId,
      }),
      `Reverse lookup started: node ${nodeId} in scan ${scanId}`
    );
  };

  extended.reverseLookupCompleted = function (
    nodeId: string,
    referenceCount: number,
    durationMs: number,
    cacheHit: boolean
  ): void {
    // Check performance thresholds
    if (durationMs > PerformanceThresholds.REVERSE_LOOKUP_WARN_MS) {
      this.warn(
        createLogData(LogEvents.PERFORMANCE_WARNING, {
          operation: 'reverse_lookup',
          nodeId,
          durationMs,
          thresholdMs: PerformanceThresholds.REVERSE_LOOKUP_WARN_MS,
          cacheHit,
        }),
        `Reverse lookup exceeded threshold: ${durationMs}ms (threshold: ${PerformanceThresholds.REVERSE_LOOKUP_WARN_MS}ms)`
      );
    }

    this.info(
      createLogData(LogEvents.REVERSE_LOOKUP_COMPLETED, {
        nodeId,
        referenceCount,
        durationMs,
        cacheHit,
      }),
      `Reverse lookup completed: ${referenceCount} references in ${durationMs}ms (cache: ${cacheHit ? 'hit' : 'miss'})`
    );
  };

  extended.reverseLookupFailed = function (nodeId: string, error: Error): void {
    this.error(
      createLogData(LogEvents.REVERSE_LOOKUP_FAILED, {
        nodeId,
        errorName: error.name,
        errorCode: isExternalObjectIndexError(error) ? error.code : undefined,
        errorMessage: error.message,
      }),
      `Reverse lookup failed for node ${nodeId}: ${error.message}`
    );
  };

  // ===== Extraction Operations =====

  extended.extractionStarted = function (nodeId: string, nodeType: string): void {
    currentContext = { ...currentContext, operation: 'extract', nodeId };
    this.debug(
      createLogData(LogEvents.EXTRACTION_STARTED, {
        nodeId,
        nodeType,
      }),
      `Extraction started: node ${nodeId} (${nodeType})`
    );
  };

  extended.extractionCompleted = function (
    nodeId: string,
    referenceCount: number,
    durationMs: number
  ): void {
    if (referenceCount === 0) {
      this.debug(
        createLogData(LogEvents.EXTRACTION_NO_REFS, {
          nodeId,
          durationMs,
        }),
        `No external references found in node ${nodeId}`
      );
    } else {
      this.debug(
        createLogData(LogEvents.EXTRACTION_COMPLETED, {
          nodeId,
          referenceCount,
          durationMs,
        }),
        `Extraction completed: ${referenceCount} references from node ${nodeId} in ${durationMs}ms`
      );
    }
  };

  extended.extractionFailed = function (
    nodeId: string,
    referenceType: ExternalReferenceType,
    error: Error
  ): void {
    this.warn(
      createLogData(LogEvents.EXTRACTION_FAILED, {
        nodeId,
        referenceType,
        errorName: error.name,
        errorMessage: error.message,
      }),
      `Extraction failed for node ${nodeId} (${referenceType}): ${error.message}`
    );
  };

  // ===== Cache Operations =====

  extended.cacheHit = function (key: string, layer: 'l1' | 'l2', durationMs: number): void {
    this.debug(
      createLogData(LogEvents.LOOKUP_CACHE_HIT, {
        cacheKey: key,
        cacheLayer: layer,
        durationMs,
      }),
      `Cache hit (${layer}): ${key} in ${durationMs}ms`
    );
  };

  extended.cacheMiss = function (key: string, durationMs: number): void {
    this.debug(
      createLogData(LogEvents.LOOKUP_CACHE_MISS, {
        cacheKey: key,
        durationMs,
      }),
      `Cache miss: ${key} in ${durationMs}ms`
    );
  };

  extended.cacheSet = function (key: string, entryCount: number, ttlMs?: number): void {
    this.debug(
      createLogData(LogEvents.CACHE_SET, {
        cacheKey: key,
        entryCount,
        ttlMs,
      }),
      `Cache set: ${key} (${entryCount} entries${ttlMs ? `, TTL ${ttlMs}ms` : ''})`
    );
  };

  extended.cacheInvalidated = function (pattern: string, deletedCount: number): void {
    this.info(
      createLogData(LogEvents.CACHE_INVALIDATED, {
        pattern,
        deletedCount,
      }),
      `Cache invalidated: ${deletedCount} entries matching "${pattern}"`
    );
  };

  extended.cacheError = function (operation: string, error: Error, layer?: 'l1' | 'l2'): void {
    this.warn(
      createLogData(LogEvents.CACHE_ERROR, {
        operation,
        cacheLayer: layer,
        errorName: error.name,
        errorMessage: error.message,
      }),
      `Cache error (${layer ?? 'unknown'}): ${operation} failed - ${error.message}`
    );
  };

  // ===== Performance Monitoring =====

  extended.performanceMetric = function (
    operation: string,
    durationMs: number,
    metadata?: Record<string, unknown>
  ): void {
    this.debug(
      createLogData(LogEvents.PERFORMANCE_METRIC, {
        operation,
        durationMs,
        ...metadata,
      }),
      `${operation}: ${durationMs}ms`
    );
  };

  extended.performanceWarning = function (
    operation: string,
    durationMs: number,
    thresholdMs: number,
    metadata?: Record<string, unknown>
  ): void {
    const exceedance = durationMs - thresholdMs;
    const exceedancePercent = Math.round((exceedance / thresholdMs) * 100);

    this.warn(
      createLogData(LogEvents.PERFORMANCE_WARNING, {
        operation,
        durationMs,
        thresholdMs,
        exceedanceMs: exceedance,
        exceedancePercent,
        ...metadata,
      }),
      `Performance warning: ${operation} took ${durationMs}ms (threshold: ${thresholdMs}ms, +${exceedancePercent}%)`
    );
  };

  // Override child to preserve index methods
  const originalChild = extended.child.bind(extended);
  extended.child = function (bindings: LogContext): ExternalIndexLogger {
    const childLogger = originalChild(bindings);
    return extendWithIndexMethods(childLogger, { ...currentContext, ...bindings });
  };

  return extended;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an External Index specific logger
 *
 * @param context - Initial index context
 * @returns ExternalIndexLogger instance
 *
 * @example
 * ```typescript
 * const logger = createIndexLogger({
 *   tenantId: 'tenant-123',
 *   operation: 'build',
 * });
 *
 * logger.buildStarted(tenantId, repositoryIds, nodeCount);
 * ```
 */
export function createIndexLogger(
  context?: Partial<ExternalIndexLogContext>
): ExternalIndexLogger {
  const baseLogger = createModuleLogger('external-object-index');
  return extendWithIndexMethods(baseLogger, context);
}

/**
 * Create a logger for a specific index operation
 *
 * @param operation - Operation type
 * @param tenantId - Tenant ID
 * @param additionalContext - Additional context
 * @returns ExternalIndexLogger instance
 */
export function createOperationLogger(
  operation: ExternalIndexOperation,
  tenantId: TenantId,
  additionalContext?: Partial<ExternalIndexLogContext>
): ExternalIndexLogger {
  return createIndexLogger({
    operation,
    tenantId,
    ...additionalContext,
  });
}

/**
 * Create a logger for index build operations
 *
 * @param tenantId - Tenant ID
 * @param buildId - Optional build ID for tracking
 * @returns ExternalIndexLogger instance
 */
export function createBuildLogger(
  tenantId: TenantId,
  buildId?: string
): ExternalIndexLogger {
  return createIndexLogger({
    operation: 'build',
    tenantId,
    buildId,
  });
}

/**
 * Create a logger for lookup operations
 *
 * @param tenantId - Tenant ID
 * @param externalId - External ID being looked up
 * @returns ExternalIndexLogger instance
 */
export function createLookupLogger(
  tenantId: TenantId,
  externalId: string
): ExternalIndexLogger {
  return createIndexLogger({
    operation: 'lookup',
    tenantId,
    externalId,
  });
}

// ============================================================================
// Singleton Instance
// ============================================================================

let indexLoggerInstance: ExternalIndexLogger | null = null;

/**
 * Get the singleton External Index logger instance
 *
 * @returns ExternalIndexLogger instance
 */
export function getIndexLogger(): ExternalIndexLogger {
  if (!indexLoggerInstance) {
    indexLoggerInstance = createIndexLogger();
  }
  return indexLoggerInstance;
}

/**
 * Reset the singleton logger (for testing)
 */
export function resetIndexLogger(): void {
  indexLoggerInstance = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Log performance metric with automatic threshold checking
 *
 * @param logger - Logger instance
 * @param operation - Operation name
 * @param durationMs - Duration in milliseconds
 * @param metadata - Additional metadata
 */
export function logPerformance(
  logger: ExternalIndexLogger,
  operation: string,
  durationMs: number,
  metadata?: Record<string, unknown>
): void {
  // Determine threshold based on operation
  let threshold: number;
  switch (operation) {
    case 'lookup':
      threshold = PerformanceThresholds.LOOKUP_WARN_MS;
      break;
    case 'reverse_lookup':
      threshold = PerformanceThresholds.REVERSE_LOOKUP_WARN_MS;
      break;
    case 'cache':
      threshold = PerformanceThresholds.CACHE_WARN_MS;
      break;
    case 'repository':
      threshold = PerformanceThresholds.REPOSITORY_WARN_MS;
      break;
    default:
      threshold = 500; // Default threshold
  }

  if (durationMs > threshold) {
    logger.performanceWarning(operation, durationMs, threshold, metadata);
  } else {
    logger.performanceMetric(operation, durationMs, metadata);
  }
}

/**
 * Create a timed operation wrapper for index operations
 *
 * @param logger - Logger instance
 * @param operationName - Name of the operation
 * @param warningThresholdMs - Threshold for performance warning
 * @returns Timer control object
 *
 * @example
 * ```typescript
 * const timer = createIndexTimer(logger, 'build', 500);
 * try {
 *   // ... do work ...
 *   timer.checkpoint('extraction_complete');
 *   // ... more work ...
 *   const durationMs = timer.end({ entriesCreated: 1000 });
 * } catch (error) {
 *   timer.fail(error);
 *   throw error;
 * }
 * ```
 */
export function createIndexTimer(
  logger: ExternalIndexLogger,
  operationName: string,
  warningThresholdMs?: number
): {
  end: (metadata?: Record<string, unknown>) => number;
  fail: (error: Error) => void;
  checkpoint: (checkpointName: string) => void;
  elapsed: () => number;
} {
  const startTime = Date.now();
  let lastCheckpoint = startTime;

  return {
    end(metadata?: Record<string, unknown>): number {
      const durationMs = Date.now() - startTime;
      const threshold = warningThresholdMs ?? getDefaultThreshold(operationName);

      if (durationMs > threshold) {
        logger.performanceWarning(operationName, durationMs, threshold, metadata);
      } else {
        logger.performanceMetric(operationName, durationMs, metadata);
      }

      return durationMs;
    },
    fail(error: Error): void {
      const durationMs = Date.now() - startTime;
      logger.performanceMetric(`${operationName}_failed`, durationMs, {
        errorName: error.name,
        errorMessage: error.message,
      });
    },
    checkpoint(checkpointName: string): void {
      const now = Date.now();
      const sinceStart = now - startTime;
      const sinceLastCheckpoint = now - lastCheckpoint;
      lastCheckpoint = now;

      logger.debug(
        {
          event: 'index_checkpoint',
          operation: operationName,
          checkpoint: checkpointName,
          sinceStartMs: sinceStart,
          sinceLastCheckpointMs: sinceLastCheckpoint,
        },
        `Checkpoint ${checkpointName}: ${sinceStart}ms from start, ${sinceLastCheckpoint}ms since last`
      );
    },
    elapsed(): number {
      return Date.now() - startTime;
    },
  };
}

/**
 * Get default threshold for operation type
 */
function getDefaultThreshold(operation: string): number {
  switch (operation) {
    case 'lookup':
      return PerformanceThresholds.LOOKUP_WARN_MS;
    case 'reverse_lookup':
    case 'reverse-lookup':
      return PerformanceThresholds.REVERSE_LOOKUP_WARN_MS;
    case 'cache':
    case 'cache_read':
    case 'cache_write':
      return PerformanceThresholds.CACHE_WARN_MS;
    case 'repository':
    case 'repository_query':
    case 'repository_save':
      return PerformanceThresholds.REPOSITORY_WARN_MS;
    default:
      return PerformanceThresholds.BUILD_100K_WARN_MS;
  }
}

/**
 * Wrap an async function with external index logging
 *
 * @param logger - Logger instance
 * @param operation - Operation name
 * @param fn - Function to wrap
 * @param warningThresholdMs - Optional threshold override
 * @returns Result of the function
 */
export async function withIndexLogging<T>(
  logger: ExternalIndexLogger,
  operation: string,
  fn: () => Promise<T>,
  warningThresholdMs?: number
): Promise<T> {
  const timer = createIndexTimer(logger, operation, warningThresholdMs);

  try {
    const result = await fn();
    timer.end({ status: 'success' });
    return result;
  } catch (error) {
    timer.fail(error as Error);
    throw error;
  }
}
