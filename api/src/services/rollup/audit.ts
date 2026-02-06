/**
 * Rollup Audit Logger
 * @module services/rollup/audit
 *
 * Audit trail logging for Cross-Repository Aggregation (Rollup) operations.
 * Provides compliance-ready audit events for CRUD operations, execution events,
 * and configuration changes.
 *
 * Features:
 * - Who, what, when, where tracking for all operations
 * - Compliance-ready audit event format
 * - Integration with existing audit infrastructure
 * - Change detection and logging
 * - Sensitive data redaction
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation audit implementation
 */

import { randomUUID } from 'crypto';
import {
  AuditLogger,
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
  AuditEvent,
  AuditChange,
  CreateAuditEventOptions,
  getAuditLogger,
  createAuditChange,
  compareForAudit,
} from '../../logging/audit.js';
import { getRequestContext } from '../../logging/request-context.js';
import { TenantId, RepositoryId, ScanId } from '../../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  RollupConfig,
  RollupCreateRequest,
  RollupUpdateRequest,
  MatcherConfig,
  RollupStatus,
} from '../../types/rollup.js';

// ============================================================================
// Rollup-Specific Audit Event Types
// ============================================================================

/**
 * Extended audit event types for rollup operations
 */
export const RollupAuditEventType = {
  // Configuration lifecycle
  ROLLUP_CREATED: 'rollup.created',
  ROLLUP_UPDATED: 'rollup.updated',
  ROLLUP_DELETED: 'rollup.deleted',
  ROLLUP_STATUS_CHANGED: 'rollup.status_changed',

  // Execution lifecycle
  ROLLUP_EXECUTION_INITIATED: 'rollup.execution.initiated',
  ROLLUP_EXECUTION_STARTED: 'rollup.execution.started',
  ROLLUP_EXECUTION_COMPLETED: 'rollup.execution.completed',
  ROLLUP_EXECUTION_FAILED: 'rollup.execution.failed',
  ROLLUP_EXECUTION_CANCELLED: 'rollup.execution.cancelled',

  // Access events
  ROLLUP_ACCESSED: 'rollup.accessed',
  ROLLUP_LISTED: 'rollup.listed',
  ROLLUP_EXECUTION_ACCESSED: 'rollup.execution.accessed',

  // Blast radius events
  ROLLUP_BLAST_RADIUS_ANALYZED: 'rollup.blast_radius.analyzed',

  // Validation events
  ROLLUP_VALIDATION_FAILED: 'rollup.validation.failed',

  // Permission events
  ROLLUP_PERMISSION_DENIED: 'rollup.permission.denied',
  ROLLUP_RATE_LIMITED: 'rollup.rate_limited',
} as const;

export type RollupAuditEventType = typeof RollupAuditEventType[keyof typeof RollupAuditEventType];

// ============================================================================
// Rollup Audit Event Interfaces
// ============================================================================

/**
 * Rollup audit event target
 */
export interface RollupAuditTarget {
  /** Resource type */
  type: 'rollup' | 'rollup_execution' | 'blast_radius';
  /** Rollup ID */
  rollupId?: RollupId;
  /** Execution ID */
  executionId?: RollupExecutionId;
  /** Rollup name (if available) */
  name?: string;
  /** Additional identifiers */
  identifiers?: Record<string, string>;
}

/**
 * Rollup audit event metadata
 */
export interface RollupAuditMetadata {
  /** Tenant ID */
  tenantId?: TenantId;
  /** Repository IDs involved */
  repositoryIds?: RepositoryId[];
  /** Scan IDs involved */
  scanIds?: ScanId[];
  /** Matcher configuration count */
  matcherCount?: number;
  /** Execution statistics */
  stats?: {
    nodesProcessed?: number;
    nodesMatched?: number;
    crossRepoEdges?: number;
    executionTimeMs?: number;
  };
  /** Error details (if applicable) */
  error?: {
    code?: string;
    message?: string;
    phase?: string;
  };
  /** Version information */
  version?: number;
  /** Additional context */
  [key: string]: unknown;
}

/**
 * Options for creating a rollup audit event
 */
export interface CreateRollupAuditEventOptions {
  eventType: RollupAuditEventType;
  severity?: AuditSeverity;
  outcome?: AuditOutcome;
  target: RollupAuditTarget;
  description: string;
  metadata?: RollupAuditMetadata;
  changes?: AuditChange[];
}

// ============================================================================
// Rollup Audit Logger Class
// ============================================================================

/**
 * Specialized audit logger for rollup operations
 */
export class RollupAuditLogger {
  private readonly baseLogger: AuditLogger;

  constructor(baseLogger?: AuditLogger) {
    this.baseLogger = baseLogger ?? getAuditLogger();
  }

  // ==========================================================================
  // Configuration Lifecycle Events
  // ==========================================================================

  /**
   * Audit rollup creation
   */
  async rollupCreated(
    rollupId: RollupId,
    name: string,
    config: RollupCreateRequest,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_CREATED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup',
        rollupId,
        name,
      },
      description: `Rollup configuration created: "${name}"`,
      metadata: {
        tenantId,
        repositoryIds: config.repositoryIds as RepositoryId[],
        matcherCount: config.matchers.length,
        matcherStrategies: this.extractMatcherStrategies(config.matchers),
      },
    });
  }

  /**
   * Audit rollup update
   */
  async rollupUpdated(
    rollupId: RollupId,
    name: string,
    changes: AuditChange[],
    newVersion: number,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_UPDATED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup',
        rollupId,
        name,
      },
      description: `Rollup configuration updated: ${changes.length} field(s) changed`,
      metadata: {
        tenantId,
        version: newVersion,
        changedFields: changes.map((c) => c.field),
      },
      changes,
    });
  }

  /**
   * Audit rollup deletion
   */
  async rollupDeleted(
    rollupId: RollupId,
    name: string | undefined,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_DELETED,
      severity: AuditSeverity.MEDIUM,
      target: {
        type: 'rollup',
        rollupId,
        name,
      },
      description: `Rollup configuration deleted${name ? `: "${name}"` : ''}`,
      metadata: {
        tenantId,
      },
    });
  }

  /**
   * Audit rollup status change
   */
  async rollupStatusChanged(
    rollupId: RollupId,
    name: string | undefined,
    oldStatus: RollupStatus,
    newStatus: RollupStatus,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_STATUS_CHANGED,
      severity: this.getStatusChangeSeverity(oldStatus, newStatus),
      target: {
        type: 'rollup',
        rollupId,
        name,
      },
      description: `Rollup status changed: ${oldStatus} -> ${newStatus}`,
      metadata: {
        tenantId,
        previousStatus: oldStatus,
        newStatus,
      },
      changes: [
        {
          field: 'status',
          oldValue: oldStatus,
          newValue: newStatus,
        },
      ],
    });
  }

  // ==========================================================================
  // Execution Lifecycle Events
  // ==========================================================================

  /**
   * Audit execution initiation
   */
  async executionInitiated(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    rollupName: string | undefined,
    scanIds: ScanId[],
    tenantId: TenantId,
    isAsync: boolean
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_INITIATED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
        name: rollupName,
      },
      description: `Rollup execution initiated: ${executionId}`,
      metadata: {
        tenantId,
        scanIds,
        scanCount: scanIds.length,
        executionMode: isAsync ? 'async' : 'sync',
      },
    });
  }

  /**
   * Audit execution start
   */
  async executionStarted(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_STARTED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
      },
      description: `Rollup execution started: ${executionId}`,
      metadata: {
        tenantId,
      },
    });
  }

  /**
   * Audit execution completion
   */
  async executionCompleted(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId,
    stats: {
      nodesProcessed: number;
      nodesMatched: number;
      nodesUnmatched: number;
      crossRepoEdges: number;
      executionTimeMs: number;
    }
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_COMPLETED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
      },
      description: `Rollup execution completed: ${stats.nodesMatched} nodes matched, ${stats.crossRepoEdges} cross-repo edges`,
      metadata: {
        tenantId,
        stats: {
          nodesProcessed: stats.nodesProcessed,
          nodesMatched: stats.nodesMatched,
          nodesUnmatched: stats.nodesUnmatched,
          crossRepoEdges: stats.crossRepoEdges,
          executionTimeMs: stats.executionTimeMs,
        },
        matchRate:
          stats.nodesProcessed > 0
            ? Math.round((stats.nodesMatched / stats.nodesProcessed) * 100)
            : 0,
      },
    });
  }

  /**
   * Audit execution failure
   */
  async executionFailed(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId,
    error: {
      code?: string;
      message: string;
      phase?: string;
    }
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_FAILED,
      severity: AuditSeverity.HIGH,
      outcome: AuditOutcome.FAILURE,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
      },
      description: `Rollup execution failed${error.phase ? ` during ${error.phase}` : ''}: ${error.message}`,
      metadata: {
        tenantId,
        error,
      },
    });
  }

  /**
   * Audit execution cancellation
   */
  async executionCancelled(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId,
    reason: string
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_CANCELLED,
      severity: AuditSeverity.LOW,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
      },
      description: `Rollup execution cancelled: ${reason}`,
      metadata: {
        tenantId,
        cancellationReason: reason,
      },
    });
  }

  // ==========================================================================
  // Access Events
  // ==========================================================================

  /**
   * Audit rollup access
   */
  async rollupAccessed(
    rollupId: RollupId,
    name: string | undefined,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_ACCESSED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup',
        rollupId,
        name,
      },
      description: `Rollup configuration accessed${name ? `: "${name}"` : ''}`,
      metadata: {
        tenantId,
      },
    });
  }

  /**
   * Audit rollup list access
   */
  async rollupListed(
    tenantId: TenantId,
    query: {
      page?: number;
      pageSize?: number;
      status?: string;
      search?: string;
    },
    resultCount: number
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_LISTED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup',
      },
      description: `Rollup configurations listed: ${resultCount} results`,
      metadata: {
        tenantId,
        query: this.sanitizeQuery(query),
        resultCount,
      },
    });
  }

  /**
   * Audit execution result access
   */
  async executionAccessed(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_EXECUTION_ACCESSED,
      severity: AuditSeverity.INFO,
      target: {
        type: 'rollup_execution',
        rollupId,
        executionId,
      },
      description: `Rollup execution result accessed: ${executionId}`,
      metadata: {
        tenantId,
      },
    });
  }

  // ==========================================================================
  // Blast Radius Events
  // ==========================================================================

  /**
   * Audit blast radius analysis
   */
  async blastRadiusAnalyzed(
    executionId: RollupExecutionId,
    rollupId: RollupId,
    tenantId: TenantId,
    query: {
      nodeIds: string[];
      maxDepth: number;
    },
    result: {
      totalImpacted: number;
      directCount: number;
      indirectCount: number;
      crossRepoCount: number;
      riskLevel: string;
    }
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_BLAST_RADIUS_ANALYZED,
      severity: this.getBlastRadiusSeverity(result.riskLevel),
      target: {
        type: 'blast_radius',
        rollupId,
        executionId,
      },
      description: `Blast radius analyzed: ${result.totalImpacted} impacted nodes (${result.riskLevel} risk)`,
      metadata: {
        tenantId,
        queryNodeCount: query.nodeIds.length,
        maxDepth: query.maxDepth,
        impactSummary: result,
      },
    });
  }

  // ==========================================================================
  // Validation Events
  // ==========================================================================

  /**
   * Audit validation failure
   */
  async validationFailed(
    rollupId: RollupId | undefined,
    tenantId: TenantId,
    errors: Array<{ field: string; message: string; code: string }>
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_VALIDATION_FAILED,
      severity: AuditSeverity.LOW,
      outcome: AuditOutcome.FAILURE,
      target: {
        type: 'rollup',
        rollupId,
      },
      description: `Rollup validation failed: ${errors.length} error(s)`,
      metadata: {
        tenantId,
        validationErrors: errors,
        errorCount: errors.length,
      },
    });
  }

  // ==========================================================================
  // Permission Events
  // ==========================================================================

  /**
   * Audit permission denied
   */
  async permissionDenied(
    rollupId: RollupId | undefined,
    action: string,
    tenantId: TenantId,
    reason?: string
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_PERMISSION_DENIED,
      severity: AuditSeverity.MEDIUM,
      outcome: AuditOutcome.FAILURE,
      target: {
        type: 'rollup',
        rollupId,
      },
      description: `Permission denied for ${action}${reason ? `: ${reason}` : ''}`,
      metadata: {
        tenantId,
        action,
        reason,
      },
    });
  }

  /**
   * Audit rate limiting
   */
  async rateLimited(
    tenantId: TenantId,
    operation: string,
    retryAfter?: number
  ): Promise<AuditEvent> {
    return this.record({
      eventType: RollupAuditEventType.ROLLUP_RATE_LIMITED,
      severity: AuditSeverity.LOW,
      outcome: AuditOutcome.FAILURE,
      target: {
        type: 'rollup',
      },
      description: `Rate limit exceeded for ${operation}`,
      metadata: {
        tenantId,
        operation,
        retryAfter,
      },
    });
  }

  // ==========================================================================
  // Core Recording Method
  // ==========================================================================

  /**
   * Record a rollup audit event
   */
  async record(options: CreateRollupAuditEventOptions): Promise<AuditEvent> {
    const requestContext = getRequestContext();

    // Map rollup event type to base audit event type
    const baseEventType = this.mapToBaseEventType(options.eventType);

    return this.baseLogger.record({
      eventType: baseEventType,
      severity: options.severity,
      outcome: options.outcome,
      target: {
        type: options.target.type,
        id: options.target.rollupId || options.target.executionId,
        name: options.target.name,
        identifiers: {
          ...options.target.identifiers,
          ...(options.target.rollupId && { rollupId: options.target.rollupId }),
          ...(options.target.executionId && { executionId: options.target.executionId }),
        },
      },
      description: options.description,
      metadata: {
        ...options.metadata,
        rollupEventType: options.eventType,
      },
      changes: options.changes,
    });
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Map rollup event type to base audit event type
   */
  private mapToBaseEventType(rollupEventType: RollupAuditEventType): AuditEventType {
    const eventTypeMap: Record<RollupAuditEventType, AuditEventType> = {
      [RollupAuditEventType.ROLLUP_CREATED]: AuditEventType.RESOURCE_CREATED,
      [RollupAuditEventType.ROLLUP_UPDATED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_DELETED]: AuditEventType.RESOURCE_DELETED,
      [RollupAuditEventType.ROLLUP_STATUS_CHANGED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_EXECUTION_INITIATED]: AuditEventType.RESOURCE_CREATED,
      [RollupAuditEventType.ROLLUP_EXECUTION_STARTED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_EXECUTION_COMPLETED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_EXECUTION_FAILED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_EXECUTION_CANCELLED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_ACCESSED]: AuditEventType.RESOURCE_READ,
      [RollupAuditEventType.ROLLUP_LISTED]: AuditEventType.RESOURCE_READ,
      [RollupAuditEventType.ROLLUP_EXECUTION_ACCESSED]: AuditEventType.RESOURCE_READ,
      [RollupAuditEventType.ROLLUP_BLAST_RADIUS_ANALYZED]: AuditEventType.RESOURCE_READ,
      [RollupAuditEventType.ROLLUP_VALIDATION_FAILED]: AuditEventType.RESOURCE_UPDATED,
      [RollupAuditEventType.ROLLUP_PERMISSION_DENIED]: AuditEventType.AUTHZ_ACCESS_DENIED,
      [RollupAuditEventType.ROLLUP_RATE_LIMITED]: AuditEventType.API_RATE_LIMITED,
    };

    return eventTypeMap[rollupEventType] || AuditEventType.RESOURCE_UPDATED;
  }

  /**
   * Get severity for status change
   */
  private getStatusChangeSeverity(
    oldStatus: RollupStatus,
    newStatus: RollupStatus
  ): AuditSeverity {
    // Archival is medium severity
    if (newStatus === 'archived') {
      return AuditSeverity.MEDIUM;
    }
    // Failure is high severity
    if (newStatus === 'failed') {
      return AuditSeverity.HIGH;
    }
    return AuditSeverity.INFO;
  }

  /**
   * Get severity for blast radius risk level
   */
  private getBlastRadiusSeverity(riskLevel: string): AuditSeverity {
    const severityMap: Record<string, AuditSeverity> = {
      low: AuditSeverity.INFO,
      medium: AuditSeverity.LOW,
      high: AuditSeverity.MEDIUM,
      critical: AuditSeverity.HIGH,
    };

    return severityMap[riskLevel] || AuditSeverity.INFO;
  }

  /**
   * Extract matcher strategies from config
   */
  private extractMatcherStrategies(matchers: MatcherConfig[]): string[] {
    const strategies = new Set<string>();
    for (const matcher of matchers) {
      strategies.add(matcher.type);
    }
    return Array.from(strategies);
  }

  /**
   * Sanitize query parameters for logging
   */
  private sanitizeQuery(query: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(query)) {
      // Don't log potentially large search strings
      if (key === 'search' && typeof value === 'string' && value.length > 100) {
        sanitized[key] = `[${value.length} chars]`;
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

let rollupAuditLoggerInstance: RollupAuditLogger | null = null;

/**
 * Get the singleton rollup audit logger
 */
export function getRollupAuditLogger(): RollupAuditLogger {
  if (!rollupAuditLoggerInstance) {
    rollupAuditLoggerInstance = new RollupAuditLogger();
  }
  return rollupAuditLoggerInstance;
}

/**
 * Create a new rollup audit logger instance
 */
export function createRollupAuditLogger(baseLogger?: AuditLogger): RollupAuditLogger {
  return new RollupAuditLogger(baseLogger);
}

/**
 * Reset the singleton instance (for testing)
 */
export function resetRollupAuditLogger(): void {
  rollupAuditLoggerInstance = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create audit changes from rollup update
 */
export function createRollupUpdateChanges(
  oldConfig: RollupConfig,
  newConfig: Partial<RollupUpdateRequest>
): AuditChange[] {
  const changes: AuditChange[] = [];

  // Check simple string/number fields
  const simpleFields: (keyof RollupConfig)[] = ['name', 'description'];
  for (const field of simpleFields) {
    if (newConfig[field] !== undefined && oldConfig[field] !== newConfig[field]) {
      changes.push({
        field,
        oldValue: oldConfig[field],
        newValue: newConfig[field],
      });
    }
  }

  // Check repository IDs
  if (newConfig.repositoryIds !== undefined) {
    const oldRepos = oldConfig.repositoryIds.sort().join(',');
    const newRepos = newConfig.repositoryIds.sort().join(',');
    if (oldRepos !== newRepos) {
      changes.push({
        field: 'repositoryIds',
        oldValue: `[${oldConfig.repositoryIds.length} repos]`,
        newValue: `[${newConfig.repositoryIds.length} repos]`,
      });
    }
  }

  // Check matchers (simplified comparison)
  if (newConfig.matchers !== undefined) {
    if (oldConfig.matchers.length !== newConfig.matchers.length) {
      changes.push({
        field: 'matchers',
        oldValue: `${oldConfig.matchers.length} matchers`,
        newValue: `${newConfig.matchers.length} matchers`,
      });
    }
  }

  // Check merge options
  if (newConfig.mergeOptions !== undefined) {
    const mergeChanges = compareForAudit(
      oldConfig.mergeOptions,
      newConfig.mergeOptions,
      ['conflictResolution', 'preserveSourceInfo', 'createCrossRepoEdges', 'maxNodes']
    );
    for (const change of mergeChanges) {
      changes.push({
        field: `mergeOptions.${change.field}`,
        oldValue: change.oldValue,
        newValue: change.newValue,
      });
    }
  }

  // Check schedule
  if (newConfig.schedule !== undefined) {
    const oldSchedule = oldConfig.schedule;
    const newSchedule = newConfig.schedule;

    if (oldSchedule?.enabled !== newSchedule?.enabled) {
      changes.push({
        field: 'schedule.enabled',
        oldValue: oldSchedule?.enabled ?? false,
        newValue: newSchedule?.enabled ?? false,
      });
    }
    if (oldSchedule?.cron !== newSchedule?.cron) {
      changes.push({
        field: 'schedule.cron',
        oldValue: oldSchedule?.cron,
        newValue: newSchedule?.cron,
      });
    }
  }

  return changes;
}
