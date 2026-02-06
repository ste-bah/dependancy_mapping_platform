/**
 * Rollup Type Guards
 * @module types/rollup-guards
 *
 * Comprehensive type guards for the Cross-Repository Aggregation (Rollup) system.
 * Provides runtime type checking with proper type narrowing for all rollup types.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation type guards
 */

import {
  RollupId,
  RollupExecutionId,
  RollupConfig,
  RollupStatus,
  RollupResponse,
  RollupListResponse,
  RollupExecutionResult,
  MatchResult,
  MergedNode,
  MatcherConfig,
  ArnMatcherConfig,
  ResourceIdMatcherConfig,
  NameMatcherConfig,
  TagMatcherConfig,
  MatchingStrategy,
  BlastRadiusResponse,
} from './rollup.js';
import {
  RollupExecuteJobPayload,
  BlastRadiusComputeJobPayload,
  RollupJobPayload,
} from '../queues/rollup-jobs.js';
import { isString, isNumber, isBoolean, isObject, isArray, isDefined } from './utility.js';

// ============================================================================
// Primitive Type Guards
// ============================================================================

/**
 * UUID regex pattern for validation
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 */
export function isUUID(value: unknown): value is string {
  return isString(value) && UUID_REGEX.test(value);
}

/**
 * Check if a value is a valid RollupId (branded UUID string)
 */
export function isRollupId(value: unknown): value is RollupId {
  return isUUID(value);
}

/**
 * Check if a value is a valid RollupExecutionId (branded UUID string)
 */
export function isRollupExecutionId(value: unknown): value is RollupExecutionId {
  return isUUID(value);
}

// ============================================================================
// Enum Type Guards
// ============================================================================

/**
 * All valid matching strategy values
 */
const MATCHING_STRATEGIES: readonly MatchingStrategy[] = ['arn', 'resource_id', 'name', 'tag'];

/**
 * Check if a value is a valid MatchingStrategy
 */
export function isMatchingStrategy(value: unknown): value is MatchingStrategy {
  return isString(value) && MATCHING_STRATEGIES.includes(value as MatchingStrategy);
}

/**
 * All valid rollup status values
 */
const ROLLUP_STATUSES: readonly RollupStatus[] = [
  'draft',
  'active',
  'executing',
  'completed',
  'failed',
  'archived',
];

/**
 * Check if a value is a valid RollupStatus
 */
export function isRollupStatus(value: unknown): value is RollupStatus {
  return isString(value) && ROLLUP_STATUSES.includes(value as RollupStatus);
}

/**
 * Execution status values
 */
const EXECUTION_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/**
 * Check if a value is a valid execution status
 */
export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return isString(value) && EXECUTION_STATUSES.includes(value as ExecutionStatus);
}

// ============================================================================
// Matcher Configuration Type Guards
// ============================================================================

/**
 * Check if a value is a valid base matcher configuration
 */
function hasBaseMatcherFields(value: unknown): boolean {
  if (!isObject(value)) return false;
  const obj = value as Record<string, unknown>;

  // Check required fields
  if (!isBoolean(obj.enabled)) return false;
  if (!isNumber(obj.priority) || obj.priority < 0 || obj.priority > 100) return false;
  if (!isNumber(obj.minConfidence) || obj.minConfidence < 0 || obj.minConfidence > 100) return false;

  // Check optional field
  if (obj.description !== undefined && !isString(obj.description)) return false;

  return true;
}

/**
 * Check if a value is an ARN matcher configuration
 */
export function isArnMatcherConfig(value: unknown): value is ArnMatcherConfig {
  if (!hasBaseMatcherFields(value)) return false;

  const obj = value as Record<string, unknown>;
  if (obj.type !== 'arn') return false;
  if (!isString(obj.pattern) || obj.pattern.length === 0) return false;

  // Check optional fields
  if (obj.allowPartial !== undefined && !isBoolean(obj.allowPartial)) return false;
  if (obj.components !== undefined) {
    if (!isObject(obj.components)) return false;
    const components = obj.components as Record<string, unknown>;
    const booleanFields = ['partition', 'service', 'region', 'account', 'resource'];
    for (const field of booleanFields) {
      if (components[field] !== undefined && !isBoolean(components[field])) return false;
    }
  }

  return true;
}

/**
 * Check if a value is a ResourceId matcher configuration
 */
export function isResourceIdMatcherConfig(value: unknown): value is ResourceIdMatcherConfig {
  if (!hasBaseMatcherFields(value)) return false;

  const obj = value as Record<string, unknown>;
  if (obj.type !== 'resource_id') return false;
  if (!isString(obj.resourceType) || obj.resourceType.length === 0) return false;

  // Check optional fields
  if (obj.idAttribute !== undefined && !isString(obj.idAttribute)) return false;
  if (obj.normalize !== undefined && !isBoolean(obj.normalize)) return false;
  if (obj.extractionPattern !== undefined && !isString(obj.extractionPattern)) return false;

  return true;
}

/**
 * Check if a value is a Name matcher configuration
 */
export function isNameMatcherConfig(value: unknown): value is NameMatcherConfig {
  if (!hasBaseMatcherFields(value)) return false;

  const obj = value as Record<string, unknown>;
  if (obj.type !== 'name') return false;

  // Check optional fields
  if (obj.pattern !== undefined && !isString(obj.pattern)) return false;
  if (obj.includeNamespace !== undefined && !isBoolean(obj.includeNamespace)) return false;
  if (obj.namespacePattern !== undefined && !isString(obj.namespacePattern)) return false;
  if (obj.caseSensitive !== undefined && !isBoolean(obj.caseSensitive)) return false;
  if (obj.fuzzyThreshold !== undefined) {
    if (!isNumber(obj.fuzzyThreshold) || obj.fuzzyThreshold < 0 || obj.fuzzyThreshold > 100) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a value is a Tag matcher configuration
 */
export function isTagMatcherConfig(value: unknown): value is TagMatcherConfig {
  if (!hasBaseMatcherFields(value)) return false;

  const obj = value as Record<string, unknown>;
  if (obj.type !== 'tag') return false;

  // Check required tags array
  if (!isArray(obj.requiredTags) || obj.requiredTags.length === 0) return false;
  for (const tag of obj.requiredTags) {
    if (!isObject(tag)) return false;
    const tagObj = tag as Record<string, unknown>;
    if (!isString(tagObj.key) || tagObj.key.length === 0) return false;
    if (tagObj.value !== undefined && !isString(tagObj.value)) return false;
    if (tagObj.valuePattern !== undefined && !isString(tagObj.valuePattern)) return false;
  }

  // Check optional fields
  if (obj.matchMode !== undefined && obj.matchMode !== 'all' && obj.matchMode !== 'any') return false;
  if (obj.ignoreTags !== undefined) {
    if (!isArray(obj.ignoreTags)) return false;
    for (const tag of obj.ignoreTags) {
      if (!isString(tag)) return false;
    }
  }

  return true;
}

/**
 * Check if a value is any valid matcher configuration
 */
export function isMatcherConfig(value: unknown): value is MatcherConfig {
  return (
    isArnMatcherConfig(value) ||
    isResourceIdMatcherConfig(value) ||
    isNameMatcherConfig(value) ||
    isTagMatcherConfig(value)
  );
}

// ============================================================================
// Entity Type Guards
// ============================================================================

/**
 * Check if a value is a valid MatchResult
 */
export function isMatchResult(value: unknown): value is MatchResult {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required string fields
  if (!isString(obj.sourceNodeId)) return false;
  if (!isString(obj.targetNodeId)) return false;
  if (!isUUID(obj.sourceRepoId)) return false;
  if (!isUUID(obj.targetRepoId)) return false;
  if (!isMatchingStrategy(obj.strategy)) return false;
  if (!isNumber(obj.confidence) || obj.confidence < 0 || obj.confidence > 100) return false;

  // Check details object
  if (!isObject(obj.details)) return false;
  const details = obj.details as Record<string, unknown>;
  if (!isString(details.matchedAttribute)) return false;
  if (!isString(details.sourceValue)) return false;
  if (!isString(details.targetValue)) return false;

  return true;
}

/**
 * Check if a value is a valid MergedNode
 */
export function isMergedNode(value: unknown): value is MergedNode {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required fields
  if (!isString(obj.id)) return false;
  if (!isString(obj.type)) return false;
  if (!isString(obj.name)) return false;

  // Check sourceNodeIds array
  if (!isArray(obj.sourceNodeIds) || obj.sourceNodeIds.length === 0) return false;
  for (const nodeId of obj.sourceNodeIds) {
    if (!isString(nodeId)) return false;
  }

  // Check sourceRepoIds array
  if (!isArray(obj.sourceRepoIds) || obj.sourceRepoIds.length === 0) return false;
  for (const repoId of obj.sourceRepoIds) {
    if (!isUUID(repoId)) return false;
  }

  // Check locations array
  if (!isArray(obj.locations)) return false;
  for (const loc of obj.locations) {
    if (!isObject(loc)) return false;
    const locObj = loc as Record<string, unknown>;
    if (!isUUID(locObj.repoId)) return false;
    if (!isString(locObj.file)) return false;
    if (!isNumber(locObj.lineStart)) return false;
    if (!isNumber(locObj.lineEnd)) return false;
  }

  // Check metadata
  if (!isObject(obj.metadata)) return false;

  // Check matchInfo
  if (!isObject(obj.matchInfo)) return false;
  const matchInfo = obj.matchInfo as Record<string, unknown>;
  if (!isMatchingStrategy(matchInfo.strategy)) return false;
  if (!isNumber(matchInfo.confidence) || matchInfo.confidence < 0 || matchInfo.confidence > 100) return false;
  if (!isNumber(matchInfo.matchCount)) return false;

  return true;
}

/**
 * Check if a value is a valid RollupConfig
 */
export function isRollupConfig(value: unknown): value is RollupConfig {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required UUID fields
  if (!isUUID(obj.id)) return false;
  if (!isUUID(obj.tenantId)) return false;
  if (!isUUID(obj.createdBy)) return false;

  // Check required string fields
  if (!isString(obj.name) || obj.name.length === 0) return false;

  // Check status
  if (!isRollupStatus(obj.status)) return false;

  // Check repositoryIds (must have at least 2)
  if (!isArray(obj.repositoryIds) || obj.repositoryIds.length < 2) return false;
  for (const repoId of obj.repositoryIds) {
    if (!isUUID(repoId)) return false;
  }

  // Check matchers (must have at least 1)
  if (!isArray(obj.matchers) || obj.matchers.length === 0) return false;
  for (const matcher of obj.matchers) {
    if (!isMatcherConfig(matcher)) return false;
  }

  // Check mergeOptions
  if (!isObject(obj.mergeOptions)) return false;

  // Check version
  if (!isNumber(obj.version) || obj.version < 1) return false;

  // Check timestamps
  if (!isString(obj.createdAt)) return false;
  if (!isString(obj.updatedAt)) return false;

  return true;
}

/**
 * Check if a value is a valid RollupExecutionResult
 */
export function isRollupExecutionResult(value: unknown): value is RollupExecutionResult {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required UUID fields
  if (!isUUID(obj.id)) return false;
  if (!isUUID(obj.rollupId)) return false;
  if (!isUUID(obj.tenantId)) return false;

  // Check status
  if (!isExecutionStatus(obj.status)) return false;

  // Check scanIds array
  if (!isArray(obj.scanIds)) return false;
  for (const scanId of obj.scanIds) {
    if (!isUUID(scanId)) return false;
  }

  // Check createdAt
  if (!isString(obj.createdAt)) return false;

  return true;
}

// ============================================================================
// Response Type Guards
// ============================================================================

/**
 * Check if a value is a valid RollupResponse
 */
export function isRollupResponse(value: unknown): value is RollupResponse {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check data field
  if (!isRollupConfig(obj.data)) return false;

  // Check optional latestExecution
  if (obj.latestExecution !== undefined) {
    if (!isObject(obj.latestExecution)) return false;
    const exec = obj.latestExecution as Record<string, unknown>;
    if (!isUUID(exec.id)) return false;
    if (!isString(exec.status)) return false;
  }

  return true;
}

/**
 * Check if a value is a valid RollupListResponse
 */
export function isRollupListResponse(value: unknown): value is RollupListResponse {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check data array
  if (!isArray(obj.data)) return false;
  for (const item of obj.data) {
    if (!isRollupConfig(item)) return false;
  }

  // Check pagination
  if (!isObject(obj.pagination)) return false;
  const pagination = obj.pagination as Record<string, unknown>;
  if (!isNumber(pagination.page)) return false;
  if (!isNumber(pagination.pageSize)) return false;
  if (!isNumber(pagination.total)) return false;
  if (!isNumber(pagination.totalPages)) return false;
  if (!isBoolean(pagination.hasNext)) return false;
  if (!isBoolean(pagination.hasPrevious)) return false;

  return true;
}

/**
 * Check if a value is a valid BlastRadiusResponse
 */
export function isBlastRadiusResponse(value: unknown): value is BlastRadiusResponse {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check required UUID fields
  if (!isUUID(obj.rollupId)) return false;
  if (!isUUID(obj.executionId)) return false;

  // Check query object
  if (!isObject(obj.query)) return false;

  // Check arrays exist
  if (!isArray(obj.directImpact)) return false;
  if (!isArray(obj.indirectImpact)) return false;
  if (!isArray(obj.crossRepoImpact)) return false;

  // Check summary
  if (!isObject(obj.summary)) return false;
  const summary = obj.summary as Record<string, unknown>;
  if (!isNumber(summary.totalImpacted)) return false;
  if (!isNumber(summary.directCount)) return false;
  if (!isNumber(summary.indirectCount)) return false;
  if (!isNumber(summary.crossRepoCount)) return false;

  return true;
}

// ============================================================================
// Job Payload Type Guards
// ============================================================================

/**
 * Check if a value is a valid RollupExecuteJobPayload
 */
export function isRollupExecuteJobPayload(value: unknown): value is RollupExecuteJobPayload {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check type discriminator
  if (obj.type !== 'execute-rollup') return false;

  // Check required UUID fields
  if (!isUUID(obj.tenantId)) return false;
  if (!isUUID(obj.rollupId)) return false;
  if (!isUUID(obj.executionId)) return false;

  // Check scanIds array
  if (!isArray(obj.scanIds)) return false;
  for (const scanId of obj.scanIds) {
    if (!isUUID(scanId)) return false;
  }

  // Check options object
  if (!isObject(obj.options)) return false;

  return true;
}

/**
 * Check if a value is a valid BlastRadiusComputeJobPayload
 */
export function isBlastRadiusComputeJobPayload(value: unknown): value is BlastRadiusComputeJobPayload {
  if (!isObject(value)) return false;

  const obj = value as Record<string, unknown>;

  // Check type discriminator
  if (obj.type !== 'compute-blast-radius') return false;

  // Check required UUID fields
  if (!isUUID(obj.tenantId)) return false;
  if (!isUUID(obj.rollupId)) return false;
  if (!isUUID(obj.executionId)) return false;

  // Check query object
  if (!isObject(obj.query)) return false;
  const query = obj.query as Record<string, unknown>;
  if (!isArray(query.nodeIds) || query.nodeIds.length === 0) return false;

  return true;
}

// ============================================================================
// Permission Type Guards
// ============================================================================

/**
 * Status values that allow rollup execution
 */
const EXECUTABLE_STATUSES: readonly RollupStatus[] = ['active', 'completed', 'failed'];

/**
 * Check if a rollup can be executed based on its status
 */
export function canExecuteRollup(rollup: RollupConfig): boolean {
  return EXECUTABLE_STATUSES.includes(rollup.status);
}

/**
 * Status values that allow rollup modification
 */
const MODIFIABLE_STATUSES: readonly RollupStatus[] = ['draft', 'active', 'completed', 'failed'];

/**
 * Check if a rollup can be modified based on its status
 */
export function canModifyRollup(rollup: RollupConfig): boolean {
  return MODIFIABLE_STATUSES.includes(rollup.status);
}

/**
 * Check if a rollup can be archived based on its status
 */
export function canArchiveRollup(rollup: RollupConfig): boolean {
  return rollup.status !== 'executing' && rollup.status !== 'archived';
}

/**
 * Check if a rollup can be deleted based on its status
 */
export function canDeleteRollup(rollup: RollupConfig): boolean {
  return rollup.status === 'draft' || rollup.status === 'archived';
}

/**
 * Check if an execution can be retried based on its status
 */
export function canRetryExecution(execution: RollupExecutionResult): boolean {
  return execution.status === 'failed';
}

/**
 * Check if an execution can be cancelled based on its status
 */
export function canCancelExecution(execution: RollupExecutionResult): boolean {
  return execution.status === 'pending' || execution.status === 'running';
}

// ============================================================================
// Validation Type Guards
// ============================================================================

/**
 * Check if a matcher configuration is valid and usable
 */
export function isValidMatcherConfig(config: MatcherConfig): boolean {
  // Basic type check
  if (!isMatcherConfig(config)) return false;

  // Check if enabled
  if (!config.enabled) return true; // Disabled configs are technically valid

  // Strategy-specific validation
  switch (config.type) {
    case 'arn':
      // ARN pattern should look like an ARN
      return config.pattern.startsWith('arn:') || config.pattern.includes('*');

    case 'resource_id':
      // Resource type should be non-empty
      return config.resourceType.length > 0;

    case 'name':
      // Name matcher just needs to exist
      return true;

    case 'tag':
      // Must have at least one required tag
      return config.requiredTags.length > 0;

    default:
      return false;
  }
}

/**
 * Check if a rollup configuration has valid matchers
 */
export function hasValidMatchers(config: RollupConfig): boolean {
  // Must have at least one enabled matcher
  const enabledMatchers = config.matchers.filter((m) => m.enabled);
  if (enabledMatchers.length === 0) return false;

  // All matchers must be valid
  return config.matchers.every(isValidMatcherConfig);
}

/**
 * Check if a rollup configuration has sufficient repositories
 */
export function hasSufficientRepositories(config: RollupConfig): boolean {
  return config.repositoryIds.length >= 2;
}

/**
 * Check if a rollup configuration is ready for execution
 */
export function isReadyForExecution(config: RollupConfig): boolean {
  return (
    canExecuteRollup(config) &&
    hasValidMatchers(config) &&
    hasSufficientRepositories(config)
  );
}

// ============================================================================
// Discriminated Union Narrowing Helpers
// ============================================================================

/**
 * Narrow a job payload to its specific type based on the type discriminator
 */
export function narrowJobPayload<T extends RollupJobPayload['type']>(
  payload: RollupJobPayload,
  type: T
): Extract<RollupJobPayload, { type: T }> | null {
  if (payload.type === type) {
    return payload as Extract<RollupJobPayload, { type: T }>;
  }
  return null;
}

/**
 * Narrow a matcher config to its specific type based on the type discriminator
 */
export function narrowMatcherConfig<T extends MatcherConfig['type']>(
  config: MatcherConfig,
  type: T
): Extract<MatcherConfig, { type: T }> | null {
  if (config.type === type) {
    return config as Extract<MatcherConfig, { type: T }>;
  }
  return null;
}

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Assert that a value is a valid RollupId, throwing if not
 */
export function assertRollupId(value: unknown, message = 'Invalid RollupId'): asserts value is RollupId {
  if (!isRollupId(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is a valid RollupExecutionId, throwing if not
 */
export function assertRollupExecutionId(
  value: unknown,
  message = 'Invalid RollupExecutionId'
): asserts value is RollupExecutionId {
  if (!isRollupExecutionId(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is a valid MatchingStrategy, throwing if not
 */
export function assertMatchingStrategy(
  value: unknown,
  message = 'Invalid MatchingStrategy'
): asserts value is MatchingStrategy {
  if (!isMatchingStrategy(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is a valid RollupStatus, throwing if not
 */
export function assertRollupStatus(
  value: unknown,
  message = 'Invalid RollupStatus'
): asserts value is RollupStatus {
  if (!isRollupStatus(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is a valid RollupConfig, throwing if not
 */
export function assertRollupConfig(
  value: unknown,
  message = 'Invalid RollupConfig'
): asserts value is RollupConfig {
  if (!isRollupConfig(value)) {
    throw new Error(message);
  }
}

/**
 * Assert that a value is a valid MatcherConfig, throwing if not
 */
export function assertMatcherConfig(
  value: unknown,
  message = 'Invalid MatcherConfig'
): asserts value is MatcherConfig {
  if (!isMatcherConfig(value)) {
    throw new Error(message);
  }
}
