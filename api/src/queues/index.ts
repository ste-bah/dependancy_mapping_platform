/**
 * Queue Module Exports
 * @module queues
 *
 * Central exports for all queue job definitions.
 * Jobs are processed by BullMQ workers.
 */

// Rollup queue jobs
export {
  // Queue names
  ROLLUP_QUEUES,
  type RollupQueueName,
  // Job types
  ROLLUP_JOB_TYPES,
  type RollupJobType,
  // Job payloads
  RollupExecuteJobPayloadSchema,
  type RollupExecuteJobPayload,
  BlastRadiusComputeJobPayloadSchema,
  type BlastRadiusComputeJobPayload,
  CleanupExecutionsJobPayloadSchema,
  type CleanupExecutionsJobPayload,
  ArchiveRollupsJobPayloadSchema,
  type ArchiveRollupsJobPayload,
  ScheduledExecutionJobPayloadSchema,
  type ScheduledExecutionJobPayload,
  SendCallbackJobPayloadSchema,
  type SendCallbackJobPayload,
  RetryExecutionJobPayloadSchema,
  type RetryExecutionJobPayload,
  type RollupJobPayload,
  // Job options
  ROLLUP_EXECUTE_JOB_OPTIONS,
  BLAST_RADIUS_JOB_OPTIONS,
  MAINTENANCE_JOB_OPTIONS,
  CALLBACK_JOB_OPTIONS,
  // Type guards
  isRollupExecuteJobPayload,
  isBlastRadiusComputeJobPayload,
  isCleanupExecutionsJobPayload,
  isArchiveRollupsJobPayload,
  isScheduledExecutionJobPayload,
  isSendCallbackJobPayload,
  isRetryExecutionJobPayload,
  // Job creation helpers
  createRollupExecuteJob,
  createBlastRadiusJob,
  createCleanupExecutionsJob,
  createSendCallbackJob,
  generateJobId,
  // Progress types
  type RollupExecutionProgress,
  type BlastRadiusProgress,
} from './rollup-jobs.js';
