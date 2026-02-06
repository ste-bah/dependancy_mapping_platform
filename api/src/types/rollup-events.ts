/**
 * Rollup Event Type Definitions
 * @module types/rollup-events
 *
 * Event type definitions for the Cross-Repository Aggregation (Rollup) system.
 * Supports event-driven architecture for rollup lifecycle notifications.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation event types
 */

import {
  RollupId,
  RollupExecutionId,
  RollupStatus,
  RollupConfig,
  RollupExecutionResult,
  RollupExecutionStats,
  BlastRadiusResponse,
  MatchingStrategy,
} from './rollup.js';
import { TenantId, UserId } from './entities.js';

// ============================================================================
// Event Type Discriminators
// ============================================================================

/**
 * All rollup event types
 */
export const RollupEventType = {
  // Configuration lifecycle events
  ROLLUP_CREATED: 'rollup.created',
  ROLLUP_UPDATED: 'rollup.updated',
  ROLLUP_DELETED: 'rollup.deleted',
  ROLLUP_ARCHIVED: 'rollup.archived',
  ROLLUP_ACTIVATED: 'rollup.activated',

  // Execution lifecycle events
  EXECUTION_STARTED: 'rollup.execution.started',
  EXECUTION_PROGRESS: 'rollup.execution.progress',
  EXECUTION_COMPLETED: 'rollup.execution.completed',
  EXECUTION_FAILED: 'rollup.execution.failed',
  EXECUTION_CANCELLED: 'rollup.execution.cancelled',
  EXECUTION_RETRYING: 'rollup.execution.retrying',

  // Matching events
  MATCHING_STARTED: 'rollup.matching.started',
  MATCHING_COMPLETED: 'rollup.matching.completed',
  MATCH_FOUND: 'rollup.match.found',

  // Merge events
  MERGE_STARTED: 'rollup.merge.started',
  MERGE_COMPLETED: 'rollup.merge.completed',
  MERGE_CONFLICT: 'rollup.merge.conflict',

  // Blast radius events
  BLAST_RADIUS_REQUESTED: 'rollup.blast_radius.requested',
  BLAST_RADIUS_CALCULATED: 'rollup.blast_radius.calculated',

  // Schedule events
  SCHEDULE_TRIGGERED: 'rollup.schedule.triggered',
  SCHEDULE_UPDATED: 'rollup.schedule.updated',
} as const;

export type RollupEventType = (typeof RollupEventType)[keyof typeof RollupEventType];

// ============================================================================
// Base Event Interface
// ============================================================================

/**
 * Base interface for all rollup events
 */
export interface RollupEventBase<T extends RollupEventType, P> {
  /** Event type discriminator */
  readonly type: T;
  /** Unique event ID */
  readonly eventId: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Event timestamp */
  readonly timestamp: Date;
  /** Event version for schema evolution */
  readonly version: number;
  /** Event payload */
  readonly payload: P;
  /** Event metadata */
  readonly metadata: RollupEventMetadata;
}

/**
 * Event metadata common to all events
 */
export interface RollupEventMetadata {
  /** Correlation ID for request tracing */
  readonly correlationId?: string;
  /** Causation ID (event that caused this event) */
  readonly causationId?: string;
  /** User ID that triggered the event (if applicable) */
  readonly triggeredBy?: UserId;
  /** Source of the event (api, scheduler, system) */
  readonly source: 'api' | 'scheduler' | 'system' | 'webhook';
  /** Additional context */
  readonly context?: Record<string, unknown>;
}

// ============================================================================
// Configuration Lifecycle Events
// ============================================================================

/**
 * Payload for rollup created event
 */
export interface RollupCreatedPayload {
  readonly rollupId: RollupId;
  readonly name: string;
  readonly repositoryCount: number;
  readonly matcherCount: number;
  readonly createdBy: UserId;
}

/**
 * Event emitted when a rollup configuration is created
 */
export type RollupCreatedEvent = RollupEventBase<
  typeof RollupEventType.ROLLUP_CREATED,
  RollupCreatedPayload
>;

/**
 * Payload for rollup updated event
 */
export interface RollupUpdatedPayload {
  readonly rollupId: RollupId;
  readonly name: string;
  readonly previousVersion: number;
  readonly newVersion: number;
  readonly changedFields: string[];
  readonly updatedBy: UserId;
}

/**
 * Event emitted when a rollup configuration is updated
 */
export type RollupUpdatedEvent = RollupEventBase<
  typeof RollupEventType.ROLLUP_UPDATED,
  RollupUpdatedPayload
>;

/**
 * Payload for rollup deleted event
 */
export interface RollupDeletedPayload {
  readonly rollupId: RollupId;
  readonly name: string;
  readonly deletedBy: UserId;
  readonly executionCount: number;
}

/**
 * Event emitted when a rollup configuration is deleted
 */
export type RollupDeletedEvent = RollupEventBase<
  typeof RollupEventType.ROLLUP_DELETED,
  RollupDeletedPayload
>;

/**
 * Payload for rollup archived event
 */
export interface RollupArchivedPayload {
  readonly rollupId: RollupId;
  readonly name: string;
  readonly previousStatus: RollupStatus;
  readonly archivedBy: UserId;
  readonly reason?: string;
}

/**
 * Event emitted when a rollup is archived
 */
export type RollupArchivedEvent = RollupEventBase<
  typeof RollupEventType.ROLLUP_ARCHIVED,
  RollupArchivedPayload
>;

/**
 * Payload for rollup activated event
 */
export interface RollupActivatedPayload {
  readonly rollupId: RollupId;
  readonly name: string;
  readonly previousStatus: RollupStatus;
  readonly activatedBy: UserId;
}

/**
 * Event emitted when a rollup is activated
 */
export type RollupActivatedEvent = RollupEventBase<
  typeof RollupEventType.ROLLUP_ACTIVATED,
  RollupActivatedPayload
>;

// ============================================================================
// Execution Lifecycle Events
// ============================================================================

/**
 * Payload for execution started event
 */
export interface RollupExecutionStartedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly scanIds: string[];
  readonly async: boolean;
  readonly options: {
    readonly skipValidation: boolean;
    readonly includeMatchDetails: boolean;
    readonly timeoutSeconds?: number;
    readonly force: boolean;
  };
}

/**
 * Event emitted when a rollup execution starts
 */
export type RollupExecutionStartedEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_STARTED,
  RollupExecutionStartedPayload
>;

/**
 * Payload for execution progress event
 */
export interface RollupExecutionProgressPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly phase: 'loading' | 'matching' | 'merging' | 'storing';
  readonly percentage: number;
  readonly nodesProcessed: number;
  readonly totalNodes: number;
  readonly matchesFound: number;
  readonly currentActivity: string;
  readonly estimatedSecondsRemaining?: number;
}

/**
 * Event emitted to report execution progress
 */
export type RollupExecutionProgressEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_PROGRESS,
  RollupExecutionProgressPayload
>;

/**
 * Payload for execution completed event
 */
export interface RollupExecutionCompletedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly stats: RollupExecutionStats;
  readonly mergedGraphId: string;
  readonly durationMs: number;
}

/**
 * Event emitted when a rollup execution completes successfully
 */
export type RollupExecutionCompletedEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_COMPLETED,
  RollupExecutionCompletedPayload
>;

/**
 * Payload for execution failed event
 */
export interface RollupExecutionFailedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly errorCode: string;
  readonly errorMessage: string;
  readonly errorDetails?: Record<string, unknown>;
  readonly failedAt: 'loading' | 'matching' | 'merging' | 'storing';
  readonly durationMs: number;
  readonly willRetry: boolean;
  readonly retryAttempt?: number;
}

/**
 * Event emitted when a rollup execution fails
 */
export type RollupExecutionFailedEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_FAILED,
  RollupExecutionFailedPayload
>;

/**
 * Payload for execution cancelled event
 */
export interface RollupExecutionCancelledPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly cancelledBy: UserId;
  readonly reason?: string;
  readonly progress: number;
}

/**
 * Event emitted when a rollup execution is cancelled
 */
export type RollupExecutionCancelledEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_CANCELLED,
  RollupExecutionCancelledPayload
>;

/**
 * Payload for execution retrying event
 */
export interface RollupExecutionRetryingPayload {
  readonly rollupId: RollupId;
  readonly originalExecutionId: RollupExecutionId;
  readonly newExecutionId: RollupExecutionId;
  readonly attemptNumber: number;
  readonly maxAttempts: number;
  readonly previousError: string;
  readonly delayMs: number;
}

/**
 * Event emitted when a rollup execution is being retried
 */
export type RollupExecutionRetryingEvent = RollupEventBase<
  typeof RollupEventType.EXECUTION_RETRYING,
  RollupExecutionRetryingPayload
>;

// ============================================================================
// Matching Events
// ============================================================================

/**
 * Payload for matching started event
 */
export interface RollupMatchingStartedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly repositoryCount: number;
  readonly totalNodes: number;
  readonly strategies: MatchingStrategy[];
}

/**
 * Event emitted when matching phase starts
 */
export type RollupMatchingStartedEvent = RollupEventBase<
  typeof RollupEventType.MATCHING_STARTED,
  RollupMatchingStartedPayload
>;

/**
 * Payload for matching completed event
 */
export interface RollupMatchingCompletedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly totalMatches: number;
  readonly matchesByStrategy: Record<MatchingStrategy, number>;
  readonly durationMs: number;
}

/**
 * Event emitted when matching phase completes
 */
export type RollupMatchingCompletedEvent = RollupEventBase<
  typeof RollupEventType.MATCHING_COMPLETED,
  RollupMatchingCompletedPayload
>;

/**
 * Payload for individual match found event
 */
export interface RollupMatchFoundPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly strategy: MatchingStrategy;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly confidence: number;
  readonly matchedAttribute: string;
}

/**
 * Event emitted when a match is found (high-volume, use with caution)
 */
export type RollupMatchFoundEvent = RollupEventBase<
  typeof RollupEventType.MATCH_FOUND,
  RollupMatchFoundPayload
>;

// ============================================================================
// Merge Events
// ============================================================================

/**
 * Payload for merge started event
 */
export interface RollupMergeStartedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly totalMatches: number;
  readonly conflictResolution: 'first' | 'last' | 'merge' | 'error';
}

/**
 * Event emitted when merge phase starts
 */
export type RollupMergeStartedEvent = RollupEventBase<
  typeof RollupEventType.MERGE_STARTED,
  RollupMergeStartedPayload
>;

/**
 * Payload for merge completed event
 */
export interface RollupMergeCompletedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly mergedNodes: number;
  readonly unmatchedNodes: number;
  readonly crossRepoEdges: number;
  readonly conflictsResolved: number;
  readonly durationMs: number;
}

/**
 * Event emitted when merge phase completes
 */
export type RollupMergeCompletedEvent = RollupEventBase<
  typeof RollupEventType.MERGE_COMPLETED,
  RollupMergeCompletedPayload
>;

/**
 * Payload for merge conflict event
 */
export interface RollupMergeConflictPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly nodeIds: string[];
  readonly conflictType: 'metadata' | 'type' | 'name';
  readonly field: string;
  readonly values: unknown[];
  readonly resolution: 'first' | 'last' | 'merge';
  readonly resolvedValue: unknown;
}

/**
 * Event emitted when a merge conflict is encountered
 */
export type RollupMergeConflictEvent = RollupEventBase<
  typeof RollupEventType.MERGE_CONFLICT,
  RollupMergeConflictPayload
>;

// ============================================================================
// Blast Radius Events
// ============================================================================

/**
 * Payload for blast radius requested event
 */
export interface RollupBlastRadiusRequestedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly nodeIds: string[];
  readonly maxDepth: number;
  readonly includeCrossRepo: boolean;
  readonly requestedBy: UserId;
}

/**
 * Event emitted when blast radius calculation is requested
 */
export type RollupBlastRadiusRequestedEvent = RollupEventBase<
  typeof RollupEventType.BLAST_RADIUS_REQUESTED,
  RollupBlastRadiusRequestedPayload
>;

/**
 * Payload for blast radius calculated event
 */
export interface RollupBlastRadiusCalculatedPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly nodeIds: string[];
  readonly totalImpacted: number;
  readonly directCount: number;
  readonly indirectCount: number;
  readonly crossRepoCount: number;
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  readonly durationMs: number;
}

/**
 * Event emitted when blast radius calculation completes
 */
export type RollupBlastRadiusCalculatedEvent = RollupEventBase<
  typeof RollupEventType.BLAST_RADIUS_CALCULATED,
  RollupBlastRadiusCalculatedPayload
>;

// ============================================================================
// Schedule Events
// ============================================================================

/**
 * Payload for schedule triggered event
 */
export interface RollupScheduleTriggeredPayload {
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly triggerType: 'cron' | 'scan_complete';
  readonly scheduledTime: Date;
  readonly cron?: string;
  readonly scanId?: string;
}

/**
 * Event emitted when a scheduled execution is triggered
 */
export type RollupScheduleTriggeredEvent = RollupEventBase<
  typeof RollupEventType.SCHEDULE_TRIGGERED,
  RollupScheduleTriggeredPayload
>;

/**
 * Payload for schedule updated event
 */
export interface RollupScheduleUpdatedPayload {
  readonly rollupId: RollupId;
  readonly previousSchedule: RollupConfig['schedule'] | null;
  readonly newSchedule: RollupConfig['schedule'] | null;
  readonly updatedBy: UserId;
}

/**
 * Event emitted when rollup schedule is updated
 */
export type RollupScheduleUpdatedEvent = RollupEventBase<
  typeof RollupEventType.SCHEDULE_UPDATED,
  RollupScheduleUpdatedPayload
>;

// ============================================================================
// Union Type of All Events
// ============================================================================

/**
 * Union type of all rollup events
 */
export type RollupEvent =
  // Configuration lifecycle
  | RollupCreatedEvent
  | RollupUpdatedEvent
  | RollupDeletedEvent
  | RollupArchivedEvent
  | RollupActivatedEvent
  // Execution lifecycle
  | RollupExecutionStartedEvent
  | RollupExecutionProgressEvent
  | RollupExecutionCompletedEvent
  | RollupExecutionFailedEvent
  | RollupExecutionCancelledEvent
  | RollupExecutionRetryingEvent
  // Matching
  | RollupMatchingStartedEvent
  | RollupMatchingCompletedEvent
  | RollupMatchFoundEvent
  // Merge
  | RollupMergeStartedEvent
  | RollupMergeCompletedEvent
  | RollupMergeConflictEvent
  // Blast radius
  | RollupBlastRadiusRequestedEvent
  | RollupBlastRadiusCalculatedEvent
  // Schedule
  | RollupScheduleTriggeredEvent
  | RollupScheduleUpdatedEvent;

// ============================================================================
// Event Factory Functions
// ============================================================================

/**
 * Generate a unique event ID
 */
function generateEventId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `evt_${timestamp}_${random}`;
}

/**
 * Create base event properties
 */
function createBaseEvent<T extends RollupEventType>(
  type: T,
  tenantId: TenantId,
  metadata: Partial<RollupEventMetadata> = {}
): Omit<RollupEventBase<T, unknown>, 'payload'> {
  return {
    type,
    eventId: generateEventId(),
    tenantId,
    timestamp: new Date(),
    version: 1,
    metadata: {
      source: metadata.source ?? 'system',
      correlationId: metadata.correlationId,
      causationId: metadata.causationId,
      triggeredBy: metadata.triggeredBy,
      context: metadata.context,
    },
  };
}

/**
 * Create a RollupCreatedEvent
 */
export function createRollupCreatedEvent(
  tenantId: TenantId,
  payload: RollupCreatedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupCreatedEvent {
  return {
    ...createBaseEvent(RollupEventType.ROLLUP_CREATED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupUpdatedEvent
 */
export function createRollupUpdatedEvent(
  tenantId: TenantId,
  payload: RollupUpdatedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupUpdatedEvent {
  return {
    ...createBaseEvent(RollupEventType.ROLLUP_UPDATED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupDeletedEvent
 */
export function createRollupDeletedEvent(
  tenantId: TenantId,
  payload: RollupDeletedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupDeletedEvent {
  return {
    ...createBaseEvent(RollupEventType.ROLLUP_DELETED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupExecutionStartedEvent
 */
export function createExecutionStartedEvent(
  tenantId: TenantId,
  payload: RollupExecutionStartedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupExecutionStartedEvent {
  return {
    ...createBaseEvent(RollupEventType.EXECUTION_STARTED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupExecutionCompletedEvent
 */
export function createExecutionCompletedEvent(
  tenantId: TenantId,
  payload: RollupExecutionCompletedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupExecutionCompletedEvent {
  return {
    ...createBaseEvent(RollupEventType.EXECUTION_COMPLETED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupExecutionFailedEvent
 */
export function createExecutionFailedEvent(
  tenantId: TenantId,
  payload: RollupExecutionFailedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupExecutionFailedEvent {
  return {
    ...createBaseEvent(RollupEventType.EXECUTION_FAILED, tenantId, metadata),
    payload,
  };
}

/**
 * Create a RollupBlastRadiusCalculatedEvent
 */
export function createBlastRadiusCalculatedEvent(
  tenantId: TenantId,
  payload: RollupBlastRadiusCalculatedPayload,
  metadata?: Partial<RollupEventMetadata>
): RollupBlastRadiusCalculatedEvent {
  return {
    ...createBaseEvent(RollupEventType.BLAST_RADIUS_CALCULATED, tenantId, metadata),
    payload,
  };
}

// ============================================================================
// Event Type Guards
// ============================================================================

/**
 * Check if an event is a configuration lifecycle event
 */
export function isConfigLifecycleEvent(event: RollupEvent): event is
  | RollupCreatedEvent
  | RollupUpdatedEvent
  | RollupDeletedEvent
  | RollupArchivedEvent
  | RollupActivatedEvent {
  return [
    RollupEventType.ROLLUP_CREATED,
    RollupEventType.ROLLUP_UPDATED,
    RollupEventType.ROLLUP_DELETED,
    RollupEventType.ROLLUP_ARCHIVED,
    RollupEventType.ROLLUP_ACTIVATED,
  ].includes(event.type);
}

/**
 * Check if an event is an execution lifecycle event
 */
export function isExecutionLifecycleEvent(event: RollupEvent): event is
  | RollupExecutionStartedEvent
  | RollupExecutionProgressEvent
  | RollupExecutionCompletedEvent
  | RollupExecutionFailedEvent
  | RollupExecutionCancelledEvent
  | RollupExecutionRetryingEvent {
  return [
    RollupEventType.EXECUTION_STARTED,
    RollupEventType.EXECUTION_PROGRESS,
    RollupEventType.EXECUTION_COMPLETED,
    RollupEventType.EXECUTION_FAILED,
    RollupEventType.EXECUTION_CANCELLED,
    RollupEventType.EXECUTION_RETRYING,
  ].includes(event.type);
}

/**
 * Check if an event is a matching event
 */
export function isMatchingEvent(event: RollupEvent): event is
  | RollupMatchingStartedEvent
  | RollupMatchingCompletedEvent
  | RollupMatchFoundEvent {
  return [
    RollupEventType.MATCHING_STARTED,
    RollupEventType.MATCHING_COMPLETED,
    RollupEventType.MATCH_FOUND,
  ].includes(event.type);
}

/**
 * Check if an event is a merge event
 */
export function isMergeEvent(event: RollupEvent): event is
  | RollupMergeStartedEvent
  | RollupMergeCompletedEvent
  | RollupMergeConflictEvent {
  return [
    RollupEventType.MERGE_STARTED,
    RollupEventType.MERGE_COMPLETED,
    RollupEventType.MERGE_CONFLICT,
  ].includes(event.type);
}

/**
 * Check if an event is a blast radius event
 */
export function isBlastRadiusEvent(event: RollupEvent): event is
  | RollupBlastRadiusRequestedEvent
  | RollupBlastRadiusCalculatedEvent {
  return [
    RollupEventType.BLAST_RADIUS_REQUESTED,
    RollupEventType.BLAST_RADIUS_CALCULATED,
  ].includes(event.type);
}

/**
 * Narrow event to specific type
 */
export function narrowEvent<T extends RollupEventType>(
  event: RollupEvent,
  type: T
): Extract<RollupEvent, { type: T }> | null {
  if (event.type === type) {
    return event as Extract<RollupEvent, { type: T }>;
  }
  return null;
}

// ============================================================================
// Event Handler Types
// ============================================================================

/**
 * Handler function type for a specific event
 */
export type RollupEventHandler<E extends RollupEvent> = (event: E) => Promise<void>;

/**
 * Map of event types to their handlers
 */
export type RollupEventHandlerMap = {
  [K in RollupEventType]?: RollupEventHandler<Extract<RollupEvent, { type: K }>>;
};

/**
 * Subscriber interface for rollup events
 */
export interface RollupEventSubscriber {
  /**
   * Handle a rollup event
   */
  handle(event: RollupEvent): Promise<void>;

  /**
   * Get subscribed event types
   */
  getSubscribedTypes(): RollupEventType[];
}
