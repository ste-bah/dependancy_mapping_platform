/**
 * Rollup Utility Types and Functions
 * @module types/rollup-utils
 *
 * Utility types and helper functions for the Cross-Repository Aggregation (Rollup) system.
 * Provides type transformations, validation utilities, and serialization helpers.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation type utilities
 */

import {
  RollupConfig,
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupStatus,
  MatchingStrategy,
  MatcherConfig,
  ArnMatcherConfig,
  ResourceIdMatcherConfig,
  NameMatcherConfig,
  TagMatcherConfig,
  RollupExecutionResult,
  RollupExecutionStats,
  MatchResult,
  MergedNode,
  BlastRadiusResponse,
} from './rollup.js';
import { DeepPartial, DeepReadonly, RequireKeys } from './utility.js';

// ============================================================================
// Extended Utility Types
// ============================================================================

/**
 * Make all properties deeply optional (re-export with rollup context)
 */
export type RollupDeepPartial<T> = DeepPartial<T>;

/**
 * Make specific fields required on a type
 * @example
 * type RequiredName = RollupRequiredFields<RollupUpdateRequest, 'name'>;
 */
export type RollupRequiredFields<T, K extends keyof T> = RequireKeys<T, K>;

/**
 * Extract only the mutable fields from RollupConfig
 */
export type RollupMutableFields = Pick<
  RollupConfig,
  | 'name'
  | 'description'
  | 'status'
  | 'repositoryIds'
  | 'scanIds'
  | 'matchers'
  | 'includeNodeTypes'
  | 'excludeNodeTypes'
  | 'preserveEdgeTypes'
  | 'mergeOptions'
  | 'schedule'
>;

/**
 * Extract the immutable/system fields from RollupConfig
 */
export type RollupImmutableFields = Omit<RollupConfig, keyof RollupMutableFields>;

/**
 * Config with only the fields settable during creation
 */
export type RollupCreatableFields = Omit<
  RollupConfig,
  'id' | 'tenantId' | 'status' | 'version' | 'createdBy' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'lastExecutedAt'
>;

/**
 * Config diff for optimistic locking updates
 */
export interface RollupConfigDiff {
  readonly field: keyof RollupMutableFields;
  readonly previousValue: unknown;
  readonly newValue: unknown;
}

/**
 * Type for matcher config discriminated by type
 */
export type MatcherConfigByType<T extends MatchingStrategy> = T extends 'arn'
  ? ArnMatcherConfig
  : T extends 'resource_id'
    ? ResourceIdMatcherConfig
    : T extends 'name'
      ? NameMatcherConfig
      : T extends 'tag'
        ? TagMatcherConfig
        : never;

/**
 * Extract the type discriminator from a matcher config
 */
export type MatcherType<T extends MatcherConfig> = T['type'];

/**
 * Partial update type for specific matcher configs
 */
export type PartialMatcherUpdate<T extends MatcherConfig> = Partial<Omit<T, 'type'>> & { type: T['type'] };

// ============================================================================
// Validation Types
// ============================================================================

/**
 * Validation error structure
 */
export interface RollupValidationError {
  readonly field: string;
  readonly message: string;
  readonly code: string;
  readonly value?: unknown;
}

/**
 * Validation result
 */
export interface RollupValidationResult {
  readonly isValid: boolean;
  readonly errors: readonly RollupValidationError[];
  readonly warnings: readonly RollupValidationError[];
}

/**
 * Field-level validation function type
 */
export type FieldValidator<T> = (value: T) => RollupValidationError | null;

/**
 * Collection of validators for a type
 */
export type TypeValidators<T> = {
  [K in keyof T]?: FieldValidator<T[K]>;
};

// ============================================================================
// Configuration Validation Utilities
// ============================================================================

/**
 * Rollup configuration validator class
 */
export class RollupConfigValidator {
  private readonly errors: RollupValidationError[] = [];
  private readonly warnings: RollupValidationError[] = [];

  /**
   * Validate a create request
   */
  validateCreateRequest(request: RollupCreateRequest): RollupValidationResult {
    this.errors.length = 0;
    this.warnings.length = 0;

    this.validateName(request.name);
    this.validateDescription(request.description);
    this.validateRepositoryIds(request.repositoryIds);
    this.validateMatchers(request.matchers);
    this.validateMergeOptions(request.mergeOptions);
    this.validateSchedule(request.schedule);
    this.validateNodeTypeFilters(request.includeNodeTypes, request.excludeNodeTypes);

    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  /**
   * Validate an update request
   */
  validateUpdateRequest(request: RollupUpdateRequest): RollupValidationResult {
    this.errors.length = 0;
    this.warnings.length = 0;

    if (request.name !== undefined) {
      this.validateName(request.name);
    }
    if (request.description !== undefined) {
      this.validateDescription(request.description);
    }
    if (request.repositoryIds !== undefined) {
      this.validateRepositoryIds(request.repositoryIds);
    }
    if (request.matchers !== undefined) {
      this.validateMatchers(request.matchers);
    }
    if (request.mergeOptions !== undefined) {
      this.validateMergeOptions(request.mergeOptions);
    }
    if (request.schedule !== undefined) {
      this.validateSchedule(request.schedule);
    }
    if (request.includeNodeTypes !== undefined || request.excludeNodeTypes !== undefined) {
      this.validateNodeTypeFilters(request.includeNodeTypes, request.excludeNodeTypes);
    }

    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  /**
   * Validate a complete configuration
   */
  validateConfig(config: RollupConfig): RollupValidationResult {
    this.errors.length = 0;
    this.warnings.length = 0;

    this.validateName(config.name);
    this.validateDescription(config.description);
    this.validateRepositoryIds(config.repositoryIds);
    this.validateMatchers(config.matchers);
    this.validateMergeOptions(config.mergeOptions);
    this.validateSchedule(config.schedule);
    this.validateNodeTypeFilters(config.includeNodeTypes, config.excludeNodeTypes);

    // Additional config-specific validations
    if (config.version < 1) {
      this.addError('version', 'Version must be at least 1', 'INVALID_VERSION');
    }

    return {
      isValid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }

  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      this.addError('name', 'Name is required', 'NAME_REQUIRED');
    } else if (name.length > 255) {
      this.addError('name', 'Name must be 255 characters or less', 'NAME_TOO_LONG');
    } else if (name.length < 3) {
      this.addWarning('name', 'Name is very short, consider a more descriptive name', 'NAME_TOO_SHORT');
    }
  }

  private validateDescription(description: string | undefined): void {
    if (description !== undefined && description.length > 2000) {
      this.addError('description', 'Description must be 2000 characters or less', 'DESCRIPTION_TOO_LONG');
    }
  }

  private validateRepositoryIds(repositoryIds: string[]): void {
    if (!repositoryIds || repositoryIds.length < 2) {
      this.addError('repositoryIds', 'At least 2 repositories are required', 'INSUFFICIENT_REPOSITORIES');
    }

    // Check for duplicates
    const uniqueIds = new Set(repositoryIds);
    if (uniqueIds.size !== repositoryIds.length) {
      this.addError('repositoryIds', 'Duplicate repository IDs are not allowed', 'DUPLICATE_REPOSITORIES');
    }

    // Warn if too many repositories
    if (repositoryIds.length > 10) {
      this.addWarning(
        'repositoryIds',
        'Many repositories may impact performance',
        'MANY_REPOSITORIES'
      );
    }
  }

  private validateMatchers(matchers: MatcherConfig[]): void {
    if (!matchers || matchers.length === 0) {
      this.addError('matchers', 'At least one matcher is required', 'NO_MATCHERS');
      return;
    }

    // Check for at least one enabled matcher
    const enabledMatchers = matchers.filter((m) => m.enabled);
    if (enabledMatchers.length === 0) {
      this.addError('matchers', 'At least one matcher must be enabled', 'NO_ENABLED_MATCHERS');
    }

    // Validate each matcher
    matchers.forEach((matcher, index) => {
      this.validateMatcher(matcher, index);
    });
  }

  private validateMatcher(matcher: MatcherConfig, index: number): void {
    const prefix = `matchers[${index}]`;

    // Validate priority
    if (matcher.priority < 0 || matcher.priority > 100) {
      this.addError(`${prefix}.priority`, 'Priority must be between 0 and 100', 'INVALID_PRIORITY');
    }

    // Validate minConfidence
    if (matcher.minConfidence < 0 || matcher.minConfidence > 100) {
      this.addError(
        `${prefix}.minConfidence`,
        'Min confidence must be between 0 and 100',
        'INVALID_MIN_CONFIDENCE'
      );
    }

    // Strategy-specific validation
    switch (matcher.type) {
      case 'arn':
        this.validateArnMatcher(matcher, prefix);
        break;
      case 'resource_id':
        this.validateResourceIdMatcher(matcher, prefix);
        break;
      case 'name':
        this.validateNameMatcher(matcher, prefix);
        break;
      case 'tag':
        this.validateTagMatcher(matcher, prefix);
        break;
    }
  }

  private validateArnMatcher(matcher: ArnMatcherConfig, prefix: string): void {
    if (!matcher.pattern || matcher.pattern.trim().length === 0) {
      this.addError(`${prefix}.pattern`, 'ARN pattern is required', 'ARN_PATTERN_REQUIRED');
    }
  }

  private validateResourceIdMatcher(matcher: ResourceIdMatcherConfig, prefix: string): void {
    if (!matcher.resourceType || matcher.resourceType.trim().length === 0) {
      this.addError(`${prefix}.resourceType`, 'Resource type is required', 'RESOURCE_TYPE_REQUIRED');
    }
  }

  private validateNameMatcher(matcher: NameMatcherConfig, prefix: string): void {
    if (matcher.fuzzyThreshold !== undefined) {
      if (matcher.fuzzyThreshold < 0 || matcher.fuzzyThreshold > 100) {
        this.addError(
          `${prefix}.fuzzyThreshold`,
          'Fuzzy threshold must be between 0 and 100',
          'INVALID_FUZZY_THRESHOLD'
        );
      }
    }
  }

  private validateTagMatcher(matcher: TagMatcherConfig, prefix: string): void {
    if (!matcher.requiredTags || matcher.requiredTags.length === 0) {
      this.addError(`${prefix}.requiredTags`, 'At least one required tag is needed', 'NO_REQUIRED_TAGS');
    }
  }

  private validateMergeOptions(options: RollupCreateRequest['mergeOptions']): void {
    if (!options) return;

    if (options.maxNodes !== undefined && options.maxNodes < 1) {
      this.addError('mergeOptions.maxNodes', 'Max nodes must be at least 1', 'INVALID_MAX_NODES');
    }
  }

  private validateSchedule(schedule: RollupCreateRequest['schedule']): void {
    if (!schedule) return;

    if (schedule.enabled && !schedule.cron && !schedule.onScanComplete) {
      this.addWarning(
        'schedule',
        'Schedule is enabled but no trigger (cron or onScanComplete) is configured',
        'NO_SCHEDULE_TRIGGER'
      );
    }
  }

  private validateNodeTypeFilters(
    includeNodeTypes: string[] | undefined,
    excludeNodeTypes: string[] | undefined
  ): void {
    if (includeNodeTypes && excludeNodeTypes) {
      const overlap = includeNodeTypes.filter((t) => excludeNodeTypes.includes(t));
      if (overlap.length > 0) {
        this.addError(
          'includeNodeTypes',
          `Node types cannot be both included and excluded: ${overlap.join(', ')}`,
          'CONFLICTING_NODE_TYPES'
        );
      }
    }
  }

  private addError(field: string, message: string, code: string, value?: unknown): void {
    this.errors.push({ field, message, code, value });
  }

  private addWarning(field: string, message: string, code: string, value?: unknown): void {
    this.warnings.push({ field, message, code, value });
  }
}

/**
 * Create a validator instance
 */
export function createConfigValidator(): RollupConfigValidator {
  return new RollupConfigValidator();
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * JSON-safe representation of RollupConfig
 */
export interface RollupConfigJSON {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  status: string;
  repositoryIds: string[];
  scanIds?: string[];
  matchers: MatcherConfig[];
  includeNodeTypes?: string[];
  excludeNodeTypes?: string[];
  preserveEdgeTypes?: string[];
  mergeOptions: RollupConfig['mergeOptions'];
  schedule?: RollupConfig['schedule'];
  version: number;
  createdBy: string;
  updatedBy?: string;
  createdAt: string;
  updatedAt: string;
  lastExecutedAt?: string;
}

/**
 * Convert RollupConfig to JSON-serializable format
 */
export function rollupConfigToJSON(config: RollupConfig): RollupConfigJSON {
  return {
    id: config.id,
    tenantId: config.tenantId,
    name: config.name,
    description: config.description,
    status: config.status,
    repositoryIds: [...config.repositoryIds],
    scanIds: config.scanIds ? [...config.scanIds] : undefined,
    matchers: config.matchers.map((m) => ({ ...m })),
    includeNodeTypes: config.includeNodeTypes ? [...config.includeNodeTypes] : undefined,
    excludeNodeTypes: config.excludeNodeTypes ? [...config.excludeNodeTypes] : undefined,
    preserveEdgeTypes: config.preserveEdgeTypes ? [...config.preserveEdgeTypes] : undefined,
    mergeOptions: { ...config.mergeOptions },
    schedule: config.schedule ? { ...config.schedule } : undefined,
    version: config.version,
    createdBy: config.createdBy,
    updatedBy: config.updatedBy,
    createdAt: config.createdAt,
    updatedAt: config.updatedAt,
    lastExecutedAt: config.lastExecutedAt,
  };
}

/**
 * Parse RollupConfig from JSON
 */
export function rollupConfigFromJSON(json: RollupConfigJSON): RollupConfig {
  return {
    id: json.id,
    tenantId: json.tenantId,
    name: json.name,
    description: json.description,
    status: json.status as RollupStatus,
    repositoryIds: json.repositoryIds,
    scanIds: json.scanIds,
    matchers: json.matchers,
    includeNodeTypes: json.includeNodeTypes,
    excludeNodeTypes: json.excludeNodeTypes,
    preserveEdgeTypes: json.preserveEdgeTypes,
    mergeOptions: json.mergeOptions,
    schedule: json.schedule,
    version: json.version,
    createdBy: json.createdBy,
    updatedBy: json.updatedBy,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    lastExecutedAt: json.lastExecutedAt,
  };
}

/**
 * JSON-safe representation of RollupExecutionResult
 */
export interface RollupExecutionResultJSON {
  id: string;
  rollupId: string;
  tenantId: string;
  status: string;
  scanIds: string[];
  stats?: RollupExecutionStats;
  matches?: MatchResult[];
  mergedNodes?: MergedNode[];
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

/**
 * Convert RollupExecutionResult to JSON-serializable format
 */
export function executionResultToJSON(result: RollupExecutionResult): RollupExecutionResultJSON {
  return {
    id: result.id,
    rollupId: result.rollupId,
    tenantId: result.tenantId,
    status: result.status,
    scanIds: [...result.scanIds],
    stats: result.stats ? { ...result.stats } : undefined,
    matches: result.matches?.map((m) => ({ ...m })),
    mergedNodes: result.mergedNodes?.map((n) => ({ ...n })),
    errorMessage: result.errorMessage,
    errorDetails: result.errorDetails ? { ...result.errorDetails } : undefined,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    createdAt: result.createdAt,
  };
}

/**
 * Parse RollupExecutionResult from JSON
 */
export function executionResultFromJSON(json: RollupExecutionResultJSON): RollupExecutionResult {
  return {
    id: json.id,
    rollupId: json.rollupId,
    tenantId: json.tenantId,
    status: json.status as RollupExecutionResult['status'],
    scanIds: json.scanIds,
    stats: json.stats,
    matches: json.matches,
    mergedNodes: json.mergedNodes,
    errorMessage: json.errorMessage,
    errorDetails: json.errorDetails,
    startedAt: json.startedAt,
    completedAt: json.completedAt,
    createdAt: json.createdAt,
  };
}

// ============================================================================
// Type Narrowing Utilities
// ============================================================================

/**
 * Narrow matcher config to specific type with type predicate
 */
export function narrowToArnMatcher(config: MatcherConfig): config is ArnMatcherConfig {
  return config.type === 'arn';
}

/**
 * Narrow matcher config to ResourceId type
 */
export function narrowToResourceIdMatcher(config: MatcherConfig): config is ResourceIdMatcherConfig {
  return config.type === 'resource_id';
}

/**
 * Narrow matcher config to Name type
 */
export function narrowToNameMatcher(config: MatcherConfig): config is NameMatcherConfig {
  return config.type === 'name';
}

/**
 * Narrow matcher config to Tag type
 */
export function narrowToTagMatcher(config: MatcherConfig): config is TagMatcherConfig {
  return config.type === 'tag';
}

/**
 * Switch handler for matcher configs with exhaustive type checking
 */
export function matcherConfigSwitch<T>(
  config: MatcherConfig,
  handlers: {
    arn: (config: ArnMatcherConfig) => T;
    resource_id: (config: ResourceIdMatcherConfig) => T;
    name: (config: NameMatcherConfig) => T;
    tag: (config: TagMatcherConfig) => T;
  }
): T {
  switch (config.type) {
    case 'arn':
      return handlers.arn(config);
    case 'resource_id':
      return handlers.resource_id(config);
    case 'name':
      return handlers.name(config);
    case 'tag':
      return handlers.tag(config);
    default:
      // Exhaustive check
      const _exhaustive: never = config;
      throw new Error(`Unknown matcher type: ${(_exhaustive as MatcherConfig).type}`);
  }
}

// ============================================================================
// Configuration Merge Utilities
// ============================================================================

/**
 * Merge an update into an existing config
 */
export function mergeRollupUpdate(
  existing: RollupConfig,
  update: RollupUpdateRequest,
  updatedBy: string
): RollupConfig {
  return {
    ...existing,
    name: update.name ?? existing.name,
    description: update.description !== undefined ? update.description : existing.description,
    repositoryIds: update.repositoryIds ?? existing.repositoryIds,
    scanIds: update.scanIds !== undefined ? update.scanIds : existing.scanIds,
    matchers: update.matchers ?? existing.matchers,
    includeNodeTypes: update.includeNodeTypes !== undefined ? update.includeNodeTypes : existing.includeNodeTypes,
    excludeNodeTypes: update.excludeNodeTypes !== undefined ? update.excludeNodeTypes : existing.excludeNodeTypes,
    preserveEdgeTypes: update.preserveEdgeTypes !== undefined ? update.preserveEdgeTypes : existing.preserveEdgeTypes,
    mergeOptions: update.mergeOptions
      ? { ...existing.mergeOptions, ...update.mergeOptions }
      : existing.mergeOptions,
    schedule: update.schedule !== undefined
      ? update.schedule
        ? { ...existing.schedule, ...update.schedule }
        : update.schedule
      : existing.schedule,
    version: existing.version + 1,
    updatedBy,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Calculate the differences between two configs
 */
export function diffRollupConfigs(
  oldConfig: RollupConfig,
  newConfig: RollupConfig
): RollupConfigDiff[] {
  const diffs: RollupConfigDiff[] = [];
  const mutableFields: (keyof RollupMutableFields)[] = [
    'name',
    'description',
    'status',
    'repositoryIds',
    'scanIds',
    'matchers',
    'includeNodeTypes',
    'excludeNodeTypes',
    'preserveEdgeTypes',
    'mergeOptions',
    'schedule',
  ];

  for (const field of mutableFields) {
    const oldValue = oldConfig[field];
    const newValue = newConfig[field];

    if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
      diffs.push({
        field,
        previousValue: oldValue,
        newValue: newValue,
      });
    }
  }

  return diffs;
}

// ============================================================================
// Statistics Utilities
// ============================================================================

/**
 * Aggregate multiple execution stats
 */
export function aggregateExecutionStats(stats: RollupExecutionStats[]): RollupExecutionStats {
  return stats.reduce(
    (acc, stat) => ({
      totalNodesProcessed: acc.totalNodesProcessed + stat.totalNodesProcessed,
      nodesMatched: acc.nodesMatched + stat.nodesMatched,
      nodesUnmatched: acc.nodesUnmatched + stat.nodesUnmatched,
      totalEdgesProcessed: acc.totalEdgesProcessed + stat.totalEdgesProcessed,
      crossRepoEdgesCreated: acc.crossRepoEdgesCreated + stat.crossRepoEdgesCreated,
      matchesByStrategy: mergeMatchCounts(acc.matchesByStrategy, stat.matchesByStrategy),
      nodesByType: mergeCounts(acc.nodesByType, stat.nodesByType),
      edgesByType: mergeCounts(acc.edgesByType, stat.edgesByType),
      executionTimeMs: acc.executionTimeMs + stat.executionTimeMs,
      memoryPeakBytes:
        acc.memoryPeakBytes && stat.memoryPeakBytes
          ? Math.max(acc.memoryPeakBytes, stat.memoryPeakBytes)
          : acc.memoryPeakBytes ?? stat.memoryPeakBytes,
    }),
    createEmptyStats()
  );
}

/**
 * Create empty execution stats
 */
export function createEmptyStats(): RollupExecutionStats {
  return {
    totalNodesProcessed: 0,
    nodesMatched: 0,
    nodesUnmatched: 0,
    totalEdgesProcessed: 0,
    crossRepoEdgesCreated: 0,
    matchesByStrategy: {
      arn: 0,
      resource_id: 0,
      name: 0,
      tag: 0,
    },
    nodesByType: {},
    edgesByType: {},
    executionTimeMs: 0,
  };
}

function mergeMatchCounts(
  a: Record<MatchingStrategy, number>,
  b: Record<MatchingStrategy, number>
): Record<MatchingStrategy, number> {
  return {
    arn: (a.arn || 0) + (b.arn || 0),
    resource_id: (a.resource_id || 0) + (b.resource_id || 0),
    name: (a.name || 0) + (b.name || 0),
    tag: (a.tag || 0) + (b.tag || 0),
  };
}

function mergeCounts(
  a: Record<string, number>,
  b: Record<string, number>
): Record<string, number> {
  const result: Record<string, number> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    result[key] = (result[key] || 0) + value;
  }
  return result;
}
