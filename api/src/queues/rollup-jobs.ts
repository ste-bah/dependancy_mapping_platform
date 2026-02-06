/**
 * Rollup Queue Job Definitions
 * @module queues/rollup-jobs
 *
 * TypeBox schemas and type definitions for rollup-related background jobs.
 * Defines job payloads, options, and queue configurations for BullMQ.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation queue jobs
 */

import { Type, Static } from '@sinclair/typebox';
import {
  RollupId,
  RollupExecutionId,
  MatchingStrategySchema,
  RollupExecutionStatsSchema,
} from '../types/rollup.js';
import { TenantId, ScanId } from '../types/entities.js';

// ============================================================================
// Queue Names
// ============================================================================

/**
 * Rollup queue names
 */
export const ROLLUP_QUEUES = {
  /** Main rollup execution queue */
  ROLLUP_EXECUTE: 'rollup:execute',
  /** Blast radius computation queue */
  BLAST_RADIUS_COMPUTE: 'rollup:blast-radius',
  /** Rollup cleanup/maintenance queue */
  ROLLUP_MAINTENANCE: 'rollup:maintenance',
  /** Scheduled rollup execution queue */
  ROLLUP_SCHEDULED: 'rollup:scheduled',
  /** Webhook callback queue */
  ROLLUP_CALLBACK: 'rollup:callback',
} as const;

export type RollupQueueName = typeof ROLLUP_QUEUES[keyof typeof ROLLUP_QUEUES];

// ============================================================================
// Job Types
// ============================================================================

/**
 * Rollup job types
 */
export const ROLLUP_JOB_TYPES = {
  /** Execute a rollup aggregation */
  EXECUTE_ROLLUP: 'execute-rollup',
  /** Compute blast radius */
  COMPUTE_BLAST_RADIUS: 'compute-blast-radius',
  /** Clean up old executions */
  CLEANUP_EXECUTIONS: 'cleanup-executions',
  /** Archive old rollups */
  ARCHIVE_ROLLUPS: 'archive-rollups',
  /** Execute scheduled rollup */
  SCHEDULED_EXECUTION: 'scheduled-execution',
  /** Send webhook callback */
  SEND_CALLBACK: 'send-callback',
  /** Retry failed execution */
  RETRY_EXECUTION: 'retry-execution',
} as const;

export type RollupJobType = typeof ROLLUP_JOB_TYPES[keyof typeof ROLLUP_JOB_TYPES];

// ============================================================================
// Execute Rollup Job
// ============================================================================

/**
 * Rollup execute job payload schema
 */
export const RollupExecuteJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('execute-rollup'),
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Rollup configuration ID */
  rollupId: Type.String({ format: 'uuid' }),
  /** Execution ID */
  executionId: Type.String({ format: 'uuid' }),
  /** Scan IDs to use for aggregation */
  scanIds: Type.Array(Type.String({ format: 'uuid' })),
  /** Execution options */
  options: Type.Object({
    /** Skip validation checks */
    skipValidation: Type.Boolean({ default: false }),
    /** Include detailed match information in result */
    includeMatchDetails: Type.Boolean({ default: false }),
    /** Timeout in seconds */
    timeoutSeconds: Type.Optional(Type.Number({ minimum: 1, maximum: 3600 })),
    /** Force re-execution */
    force: Type.Boolean({ default: false }),
  }),
  /** Callback URL for completion notification */
  callbackUrl: Type.Optional(Type.String({ format: 'uri' })),
  /** Retry information */
  retry: Type.Optional(Type.Object({
    /** Current attempt number */
    attempt: Type.Number({ minimum: 1 }),
    /** Maximum attempts */
    maxAttempts: Type.Number({ minimum: 1 }),
    /** Previous error if retrying */
    previousError: Type.Optional(Type.String()),
  })),
  /** Job metadata */
  metadata: Type.Optional(Type.Object({
    /** Initiating user ID */
    initiatedBy: Type.Optional(Type.String({ format: 'uuid' })),
    /** Source of the job (api, scheduler, etc.) */
    source: Type.Optional(Type.String()),
    /** Correlation ID for tracing */
    correlationId: Type.Optional(Type.String()),
  })),
});

export type RollupExecuteJobPayload = Static<typeof RollupExecuteJobPayloadSchema>;

// ============================================================================
// Blast Radius Compute Job
// ============================================================================

/**
 * Blast radius compute job payload schema
 */
export const BlastRadiusComputeJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('compute-blast-radius'),
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Rollup ID */
  rollupId: Type.String({ format: 'uuid' }),
  /** Execution ID to analyze */
  executionId: Type.String({ format: 'uuid' }),
  /** Query parameters */
  query: Type.Object({
    /** Node IDs to analyze */
    nodeIds: Type.Array(Type.String(), { minItems: 1 }),
    /** Maximum traversal depth */
    maxDepth: Type.Number({ minimum: 1, maximum: 20, default: 5 }),
    /** Edge types to follow */
    edgeTypes: Type.Optional(Type.Array(Type.String())),
    /** Include cross-repo impacts */
    includeCrossRepo: Type.Boolean({ default: true }),
    /** Include indirect impacts */
    includeIndirect: Type.Boolean({ default: true }),
  }),
  /** Callback URL for result notification */
  callbackUrl: Type.Optional(Type.String({ format: 'uri' })),
  /** Job metadata */
  metadata: Type.Optional(Type.Object({
    /** Requesting user ID */
    requestedBy: Type.Optional(Type.String({ format: 'uuid' })),
    /** Correlation ID for tracing */
    correlationId: Type.Optional(Type.String()),
  })),
});

export type BlastRadiusComputeJobPayload = Static<typeof BlastRadiusComputeJobPayloadSchema>;

// ============================================================================
// Maintenance Jobs
// ============================================================================

/**
 * Cleanup executions job payload schema
 */
export const CleanupExecutionsJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('cleanup-executions'),
  /** Tenant ID (optional, if omitted runs for all tenants) */
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  /** Maximum age in days for executions to keep */
  maxAgeDays: Type.Number({ minimum: 1, default: 30 }),
  /** Maximum executions per rollup to keep */
  maxExecutionsPerRollup: Type.Number({ minimum: 1, default: 10 }),
  /** Whether to archive before deleting */
  archiveBeforeDelete: Type.Boolean({ default: true }),
  /** Dry run mode (report what would be deleted) */
  dryRun: Type.Boolean({ default: false }),
});

export type CleanupExecutionsJobPayload = Static<typeof CleanupExecutionsJobPayloadSchema>;

/**
 * Archive rollups job payload schema
 */
export const ArchiveRollupsJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('archive-rollups'),
  /** Tenant ID (optional, if omitted runs for all tenants) */
  tenantId: Type.Optional(Type.String({ format: 'uuid' })),
  /** Days of inactivity before archiving */
  inactiveDays: Type.Number({ minimum: 1, default: 90 }),
  /** Dry run mode */
  dryRun: Type.Boolean({ default: false }),
});

export type ArchiveRollupsJobPayload = Static<typeof ArchiveRollupsJobPayloadSchema>;

// ============================================================================
// Scheduled Execution Job
// ============================================================================

/**
 * Scheduled execution job payload schema
 */
export const ScheduledExecutionJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('scheduled-execution'),
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Rollup ID to execute */
  rollupId: Type.String({ format: 'uuid' }),
  /** Schedule info */
  schedule: Type.Object({
    /** Cron expression that triggered this */
    cron: Type.String(),
    /** Timezone */
    timezone: Type.String({ default: 'UTC' }),
    /** Scheduled time */
    scheduledAt: Type.String({ format: 'date-time' }),
  }),
  /** Whether to use latest scans */
  useLatestScans: Type.Boolean({ default: true }),
});

export type ScheduledExecutionJobPayload = Static<typeof ScheduledExecutionJobPayloadSchema>;

// ============================================================================
// Callback Job
// ============================================================================

/**
 * Send callback job payload schema
 */
export const SendCallbackJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('send-callback'),
  /** Callback URL */
  callbackUrl: Type.String({ format: 'uri' }),
  /** HTTP method */
  method: Type.Union([
    Type.Literal('POST'),
    Type.Literal('PUT'),
  ], { default: 'POST' }),
  /** Payload to send */
  payload: Type.Object({
    /** Event type */
    event: Type.Union([
      Type.Literal('rollup.execution.started'),
      Type.Literal('rollup.execution.completed'),
      Type.Literal('rollup.execution.failed'),
      Type.Literal('rollup.blast-radius.completed'),
    ]),
    /** Tenant ID */
    tenantId: Type.String({ format: 'uuid' }),
    /** Rollup ID */
    rollupId: Type.String({ format: 'uuid' }),
    /** Execution ID */
    executionId: Type.String({ format: 'uuid' }),
    /** Timestamp */
    timestamp: Type.String({ format: 'date-time' }),
    /** Event-specific data */
    data: Type.Record(Type.String(), Type.Unknown()),
  }),
  /** Retry settings */
  retryConfig: Type.Optional(Type.Object({
    maxAttempts: Type.Number({ minimum: 1, default: 3 }),
    backoffMs: Type.Number({ minimum: 100, default: 1000 }),
    backoffMultiplier: Type.Number({ minimum: 1, default: 2 }),
  })),
  /** Headers to include */
  headers: Type.Optional(Type.Record(Type.String(), Type.String())),
  /** Timeout in milliseconds */
  timeoutMs: Type.Number({ minimum: 1000, default: 30000 }),
});

export type SendCallbackJobPayload = Static<typeof SendCallbackJobPayloadSchema>;

// ============================================================================
// Retry Execution Job
// ============================================================================

/**
 * Retry execution job payload schema
 */
export const RetryExecutionJobPayloadSchema = Type.Object({
  /** Job type discriminator */
  type: Type.Literal('retry-execution'),
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Original execution ID to retry */
  originalExecutionId: Type.String({ format: 'uuid' }),
  /** New execution ID */
  newExecutionId: Type.String({ format: 'uuid' }),
  /** Retry attempt number */
  attemptNumber: Type.Number({ minimum: 1 }),
  /** Maximum retry attempts */
  maxAttempts: Type.Number({ minimum: 1, default: 3 }),
  /** Previous error */
  previousError: Type.String(),
  /** Delay before retry in milliseconds */
  delayMs: Type.Number({ minimum: 0, default: 0 }),
});

export type RetryExecutionJobPayload = Static<typeof RetryExecutionJobPayloadSchema>;

// ============================================================================
// Union Type for All Job Payloads
// ============================================================================

/**
 * Union of all rollup job payloads
 */
export type RollupJobPayload =
  | RollupExecuteJobPayload
  | BlastRadiusComputeJobPayload
  | CleanupExecutionsJobPayload
  | ArchiveRollupsJobPayload
  | ScheduledExecutionJobPayload
  | SendCallbackJobPayload
  | RetryExecutionJobPayload;

// ============================================================================
// Job Options
// ============================================================================

/**
 * Default job options for rollup execution
 */
export const ROLLUP_EXECUTE_JOB_OPTIONS = {
  /** Job will be removed when completed */
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 100, // Keep last 100 completed jobs
  },
  /** Job will be removed when failed */
  removeOnFail: {
    age: 86400, // Keep failed jobs for 24 hours
    count: 1000, // Keep last 1000 failed jobs
  },
  /** Number of retry attempts */
  attempts: 3,
  /** Backoff configuration */
  backoff: {
    type: 'exponential' as const,
    delay: 5000, // 5 seconds initial delay
  },
  /** Job timeout in milliseconds */
  timeout: 300000, // 5 minutes default
} as const;

/**
 * Default job options for blast radius computation
 */
export const BLAST_RADIUS_JOB_OPTIONS = {
  removeOnComplete: {
    age: 1800, // Keep completed jobs for 30 minutes
    count: 50,
  },
  removeOnFail: {
    age: 3600,
    count: 100,
  },
  attempts: 2,
  backoff: {
    type: 'exponential' as const,
    delay: 2000,
  },
  timeout: 120000, // 2 minutes
} as const;

/**
 * Default job options for maintenance jobs
 */
export const MAINTENANCE_JOB_OPTIONS = {
  removeOnComplete: {
    age: 86400, // Keep for 24 hours
    count: 10,
  },
  removeOnFail: {
    age: 604800, // Keep for 7 days
    count: 50,
  },
  attempts: 1,
  timeout: 600000, // 10 minutes
} as const;

/**
 * Default job options for callback jobs
 */
export const CALLBACK_JOB_OPTIONS = {
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  removeOnFail: {
    age: 86400,
    count: 500,
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  timeout: 30000, // 30 seconds
} as const;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for RollupExecuteJobPayload
 */
export function isRollupExecuteJobPayload(payload: RollupJobPayload): payload is RollupExecuteJobPayload {
  return payload.type === 'execute-rollup';
}

/**
 * Type guard for BlastRadiusComputeJobPayload
 */
export function isBlastRadiusComputeJobPayload(payload: RollupJobPayload): payload is BlastRadiusComputeJobPayload {
  return payload.type === 'compute-blast-radius';
}

/**
 * Type guard for CleanupExecutionsJobPayload
 */
export function isCleanupExecutionsJobPayload(payload: RollupJobPayload): payload is CleanupExecutionsJobPayload {
  return payload.type === 'cleanup-executions';
}

/**
 * Type guard for ArchiveRollupsJobPayload
 */
export function isArchiveRollupsJobPayload(payload: RollupJobPayload): payload is ArchiveRollupsJobPayload {
  return payload.type === 'archive-rollups';
}

/**
 * Type guard for ScheduledExecutionJobPayload
 */
export function isScheduledExecutionJobPayload(payload: RollupJobPayload): payload is ScheduledExecutionJobPayload {
  return payload.type === 'scheduled-execution';
}

/**
 * Type guard for SendCallbackJobPayload
 */
export function isSendCallbackJobPayload(payload: RollupJobPayload): payload is SendCallbackJobPayload {
  return payload.type === 'send-callback';
}

/**
 * Type guard for RetryExecutionJobPayload
 */
export function isRetryExecutionJobPayload(payload: RollupJobPayload): payload is RetryExecutionJobPayload {
  return payload.type === 'retry-execution';
}

// ============================================================================
// Job Creation Helpers
// ============================================================================

/**
 * Create a rollup execute job payload
 */
export function createRollupExecuteJob(
  tenantId: string,
  rollupId: string,
  executionId: string,
  scanIds: string[],
  options?: Partial<RollupExecuteJobPayload['options']>,
  metadata?: RollupExecuteJobPayload['metadata']
): RollupExecuteJobPayload {
  return {
    type: 'execute-rollup',
    tenantId,
    rollupId,
    executionId,
    scanIds,
    options: {
      skipValidation: options?.skipValidation ?? false,
      includeMatchDetails: options?.includeMatchDetails ?? false,
      timeoutSeconds: options?.timeoutSeconds,
      force: options?.force ?? false,
    },
    metadata,
  };
}

/**
 * Create a blast radius compute job payload
 */
export function createBlastRadiusJob(
  tenantId: string,
  rollupId: string,
  executionId: string,
  nodeIds: string[],
  options?: Partial<BlastRadiusComputeJobPayload['query']>,
  metadata?: BlastRadiusComputeJobPayload['metadata']
): BlastRadiusComputeJobPayload {
  return {
    type: 'compute-blast-radius',
    tenantId,
    rollupId,
    executionId,
    query: {
      nodeIds,
      maxDepth: options?.maxDepth ?? 5,
      edgeTypes: options?.edgeTypes,
      includeCrossRepo: options?.includeCrossRepo ?? true,
      includeIndirect: options?.includeIndirect ?? true,
    },
    metadata,
  };
}

/**
 * Create a cleanup executions job payload
 */
export function createCleanupExecutionsJob(
  options?: Partial<Omit<CleanupExecutionsJobPayload, 'type'>>
): CleanupExecutionsJobPayload {
  return {
    type: 'cleanup-executions',
    tenantId: options?.tenantId,
    maxAgeDays: options?.maxAgeDays ?? 30,
    maxExecutionsPerRollup: options?.maxExecutionsPerRollup ?? 10,
    archiveBeforeDelete: options?.archiveBeforeDelete ?? true,
    dryRun: options?.dryRun ?? false,
  };
}

/**
 * Create a send callback job payload
 */
export function createSendCallbackJob(
  callbackUrl: string,
  event: SendCallbackJobPayload['payload']['event'],
  tenantId: string,
  rollupId: string,
  executionId: string,
  data: Record<string, unknown>
): SendCallbackJobPayload {
  return {
    type: 'send-callback',
    callbackUrl,
    method: 'POST',
    payload: {
      event,
      tenantId,
      rollupId,
      executionId,
      timestamp: new Date().toISOString(),
      data,
    },
    timeoutMs: 30000,
  };
}

/**
 * Generate a unique job ID
 */
export function generateJobId(prefix: string, ...parts: string[]): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const suffix = parts.join('-');
  return `${prefix}-${suffix}-${timestamp}-${random}`;
}

// ============================================================================
// Job Progress Types
// ============================================================================

/**
 * Progress data for rollup execution jobs
 */
export interface RollupExecutionProgress {
  /** Current phase */
  phase: 'initializing' | 'loading' | 'matching' | 'merging' | 'storing' | 'completed' | 'failed';
  /** Percentage complete (0-100) */
  percentage: number;
  /** Repositories processed */
  repositoriesProcessed: number;
  /** Total repositories */
  totalRepositories: number;
  /** Nodes processed */
  nodesProcessed: number;
  /** Total nodes */
  totalNodes: number;
  /** Matches found so far */
  matchesFound: number;
  /** Current activity description */
  currentActivity: string;
  /** Estimated time remaining in seconds */
  estimatedSecondsRemaining?: number;
}

/**
 * Progress data for blast radius jobs
 */
export interface BlastRadiusProgress {
  /** Current phase */
  phase: 'initializing' | 'traversing' | 'analyzing' | 'completed' | 'failed';
  /** Percentage complete (0-100) */
  percentage: number;
  /** Nodes analyzed */
  nodesAnalyzed: number;
  /** Edges traversed */
  edgesTraversed: number;
  /** Current depth */
  currentDepth: number;
  /** Maximum depth */
  maxDepth: number;
}
