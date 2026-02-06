/**
 * Rollup Type Definitions
 * @module types/rollup
 *
 * TypeBox schemas and type definitions for the Cross-Repository Aggregation (Rollup) system.
 * Implements 4 matching strategies (ARN, ResourceId, Name, Tag) for merging nodes across repositories.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation types
 */

import { Type, Static, TSchema } from '@sinclair/typebox';

// ============================================================================
// Branded ID Types
// ============================================================================

/**
 * Branded type for Rollup IDs
 * @example
 * const rollupId = 'rollup_01HXYZ...' as RollupId;
 */
export type RollupId = string & { readonly __brand: 'RollupId' };

/**
 * Branded type for Rollup Execution IDs
 * @example
 * const execId = 'rollup_exec_01HXYZ...' as RollupExecutionId;
 */
export type RollupExecutionId = string & { readonly __brand: 'RollupExecutionId' };

// ============================================================================
// Matching Strategy Types
// ============================================================================

/**
 * Available matching strategies for node aggregation
 */
export const MatchingStrategy = {
  /** Match by AWS ARN pattern */
  ARN: 'arn',
  /** Match by resource identifier */
  RESOURCE_ID: 'resource_id',
  /** Match by resource name with optional namespace */
  NAME: 'name',
  /** Match by tag key-value pairs */
  TAG: 'tag',
} as const;

export type MatchingStrategy = typeof MatchingStrategy[keyof typeof MatchingStrategy];

/**
 * TypeBox schema for matching strategy
 */
export const MatchingStrategySchema = Type.Union([
  Type.Literal('arn'),
  Type.Literal('resource_id'),
  Type.Literal('name'),
  Type.Literal('tag'),
], { description: 'Strategy for matching nodes across repositories' });

// ============================================================================
// Rollup Status Types
// ============================================================================

/**
 * Rollup execution status
 */
export const RollupStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  ARCHIVED: 'archived',
} as const;

export type RollupStatus = typeof RollupStatus[keyof typeof RollupStatus];

/**
 * TypeBox schema for rollup status
 */
export const RollupStatusSchema = Type.Union([
  Type.Literal('draft'),
  Type.Literal('active'),
  Type.Literal('executing'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('archived'),
], { description: 'Current status of the rollup configuration' });

// ============================================================================
// Matcher Configuration Schemas
// ============================================================================

/**
 * Base matcher configuration shared by all strategies
 */
export const BaseMatcherConfigSchema = Type.Object({
  /** Whether this matcher is enabled */
  enabled: Type.Boolean({ default: true }),
  /** Priority weight for this matcher (higher = more preferred) */
  priority: Type.Number({ minimum: 0, maximum: 100, default: 50 }),
  /** Minimum confidence threshold for matches */
  minConfidence: Type.Number({ minimum: 0, maximum: 100, default: 80 }),
  /** Description of this matcher's purpose */
  description: Type.Optional(Type.String({ maxLength: 500 })),
});

export type BaseMatcherConfig = Static<typeof BaseMatcherConfigSchema>;

/**
 * ARN-based matcher configuration
 * Matches AWS resources by ARN pattern
 */
export const ArnMatcherConfigSchema = Type.Intersect([
  BaseMatcherConfigSchema,
  Type.Object({
    type: Type.Literal('arn'),
    /** ARN pattern with wildcards (e.g., arn:aws:s3:::*) */
    pattern: Type.String({ minLength: 1, description: 'ARN pattern with optional wildcards' }),
    /** Whether to match partial ARNs */
    allowPartial: Type.Boolean({ default: false }),
    /** Specific ARN components to compare */
    components: Type.Optional(Type.Object({
      partition: Type.Boolean({ default: true }),
      service: Type.Boolean({ default: true }),
      region: Type.Boolean({ default: false }),
      account: Type.Boolean({ default: false }),
      resource: Type.Boolean({ default: true }),
    })),
  }),
]);

export type ArnMatcherConfig = Static<typeof ArnMatcherConfigSchema>;

/**
 * Resource ID-based matcher configuration
 * Matches resources by their unique identifier
 */
export const ResourceIdMatcherConfigSchema = Type.Intersect([
  BaseMatcherConfigSchema,
  Type.Object({
    type: Type.Literal('resource_id'),
    /** Resource type to match (e.g., aws_s3_bucket) */
    resourceType: Type.String({ minLength: 1 }),
    /** ID attribute path (e.g., 'id', 'metadata.uid') */
    idAttribute: Type.String({ default: 'id' }),
    /** Whether to normalize IDs (lowercase, trim) */
    normalize: Type.Boolean({ default: true }),
    /** Regex pattern for ID extraction */
    extractionPattern: Type.Optional(Type.String()),
  }),
]);

export type ResourceIdMatcherConfig = Static<typeof ResourceIdMatcherConfigSchema>;

/**
 * Name-based matcher configuration
 * Matches resources by name with optional namespace
 */
export const NameMatcherConfigSchema = Type.Intersect([
  BaseMatcherConfigSchema,
  Type.Object({
    type: Type.Literal('name'),
    /** Name pattern with optional wildcards */
    pattern: Type.Optional(Type.String()),
    /** Whether to include namespace in match */
    includeNamespace: Type.Boolean({ default: true }),
    /** Namespace pattern to match */
    namespacePattern: Type.Optional(Type.String()),
    /** Whether name matching is case-sensitive */
    caseSensitive: Type.Boolean({ default: false }),
    /** Similarity threshold for fuzzy matching (0-100) */
    fuzzyThreshold: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
  }),
]);

export type NameMatcherConfig = Static<typeof NameMatcherConfigSchema>;

/**
 * Tag-based matcher configuration
 * Matches resources by tag key-value pairs
 */
export const TagMatcherConfigSchema = Type.Intersect([
  BaseMatcherConfigSchema,
  Type.Object({
    type: Type.Literal('tag'),
    /** Required tags that must match */
    requiredTags: Type.Array(Type.Object({
      key: Type.String({ minLength: 1 }),
      value: Type.Optional(Type.String()),
      valuePattern: Type.Optional(Type.String()),
    }), { minItems: 1 }),
    /** Whether all tags must match or just one */
    matchMode: Type.Union([
      Type.Literal('all'),
      Type.Literal('any'),
    ], { default: 'all' }),
    /** Tag keys to ignore during matching */
    ignoreTags: Type.Optional(Type.Array(Type.String())),
  }),
]);

export type TagMatcherConfig = Static<typeof TagMatcherConfigSchema>;

/**
 * Union of all matcher configuration types
 */
export const MatcherConfigSchema = Type.Union([
  ArnMatcherConfigSchema,
  ResourceIdMatcherConfigSchema,
  NameMatcherConfigSchema,
  TagMatcherConfigSchema,
]);

export type MatcherConfig = Static<typeof MatcherConfigSchema>;

// ============================================================================
// Rollup Configuration Schema
// ============================================================================

/**
 * Complete rollup configuration
 */
export const RollupConfigSchema = Type.Object({
  /** Unique rollup identifier */
  id: Type.String({ format: 'uuid' }),
  /** Tenant ID (multi-tenancy) */
  tenantId: Type.String({ format: 'uuid' }),
  /** Human-readable name */
  name: Type.String({ minLength: 1, maxLength: 255 }),
  /** Description of this rollup */
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  /** Current status */
  status: RollupStatusSchema,
  /** Repository IDs to aggregate */
  repositoryIds: Type.Array(Type.String({ format: 'uuid' }), {
    minItems: 2,
    description: 'At least 2 repositories required for aggregation',
  }),
  /** Scan IDs to use (optional, defaults to latest per repo) */
  scanIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  /** Matching strategies configuration */
  matchers: Type.Array(MatcherConfigSchema, { minItems: 1 }),
  /** Node types to include in aggregation */
  includeNodeTypes: Type.Optional(Type.Array(Type.String())),
  /** Node types to exclude from aggregation */
  excludeNodeTypes: Type.Optional(Type.Array(Type.String())),
  /** Edge types to preserve during merge */
  preserveEdgeTypes: Type.Optional(Type.Array(Type.String())),
  /** Merge options */
  mergeOptions: Type.Object({
    /** How to handle conflicting metadata */
    conflictResolution: Type.Union([
      Type.Literal('first'),
      Type.Literal('last'),
      Type.Literal('merge'),
      Type.Literal('error'),
    ], { default: 'merge' }),
    /** Whether to preserve source repository information */
    preserveSourceInfo: Type.Boolean({ default: true }),
    /** Whether to create cross-repo edges */
    createCrossRepoEdges: Type.Boolean({ default: true }),
    /** Maximum nodes in merged result */
    maxNodes: Type.Optional(Type.Number({ minimum: 1 })),
  }),
  /** Scheduling configuration */
  schedule: Type.Optional(Type.Object({
    /** Whether automatic execution is enabled */
    enabled: Type.Boolean({ default: false }),
    /** Cron expression for scheduled execution */
    cron: Type.Optional(Type.String()),
    /** Timezone for cron expression */
    timezone: Type.Optional(Type.String({ default: 'UTC' })),
    /** Execute on scan completion */
    onScanComplete: Type.Boolean({ default: false }),
  })),
  /** Version for optimistic locking */
  version: Type.Number({ minimum: 1, default: 1 }),
  /** Created by user ID */
  createdBy: Type.String({ format: 'uuid' }),
  /** Last modified by user ID */
  updatedBy: Type.Optional(Type.String({ format: 'uuid' })),
  /** Creation timestamp */
  createdAt: Type.String({ format: 'date-time' }),
  /** Last update timestamp */
  updatedAt: Type.String({ format: 'date-time' }),
  /** Last execution timestamp */
  lastExecutedAt: Type.Optional(Type.String({ format: 'date-time' })),
});

export type RollupConfig = Static<typeof RollupConfigSchema>;

// ============================================================================
// Request/Response Schemas
// ============================================================================

/**
 * Create rollup request
 */
export const RollupCreateRequestSchema = Type.Object({
  name: Type.String({ minLength: 1, maxLength: 255 }),
  description: Type.Optional(Type.String({ maxLength: 2000 })),
  repositoryIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 2 }),
  scanIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  matchers: Type.Array(MatcherConfigSchema, { minItems: 1 }),
  includeNodeTypes: Type.Optional(Type.Array(Type.String())),
  excludeNodeTypes: Type.Optional(Type.Array(Type.String())),
  preserveEdgeTypes: Type.Optional(Type.Array(Type.String())),
  mergeOptions: Type.Optional(Type.Object({
    conflictResolution: Type.Optional(Type.Union([
      Type.Literal('first'),
      Type.Literal('last'),
      Type.Literal('merge'),
      Type.Literal('error'),
    ])),
    preserveSourceInfo: Type.Optional(Type.Boolean()),
    createCrossRepoEdges: Type.Optional(Type.Boolean()),
    maxNodes: Type.Optional(Type.Number({ minimum: 1 })),
  })),
  schedule: Type.Optional(Type.Object({
    enabled: Type.Optional(Type.Boolean()),
    cron: Type.Optional(Type.String()),
    timezone: Type.Optional(Type.String()),
    onScanComplete: Type.Optional(Type.Boolean()),
  })),
});

export type RollupCreateRequest = Static<typeof RollupCreateRequestSchema>;

/**
 * Update rollup request
 */
export const RollupUpdateRequestSchema = Type.Partial(Type.Omit(RollupCreateRequestSchema, []));

export type RollupUpdateRequest = Static<typeof RollupUpdateRequestSchema>;

/**
 * Execute rollup request
 */
export const RollupExecuteRequestSchema = Type.Object({
  /** Override scan IDs for this execution */
  scanIds: Type.Optional(Type.Array(Type.String({ format: 'uuid' }))),
  /** Force re-execution even if recent result exists */
  force: Type.Boolean({ default: false }),
  /** Whether to run asynchronously */
  async: Type.Boolean({ default: true }),
  /** Callback URL for async execution */
  callbackUrl: Type.Optional(Type.String({ format: 'uri' })),
  /** Custom execution options */
  options: Type.Optional(Type.Object({
    /** Skip validation checks */
    skipValidation: Type.Boolean({ default: false }),
    /** Include detailed match information */
    includeMatchDetails: Type.Boolean({ default: false }),
    /** Timeout in seconds */
    timeoutSeconds: Type.Optional(Type.Number({ minimum: 1, maximum: 3600 })),
  })),
});

export type RollupExecuteRequest = Static<typeof RollupExecuteRequestSchema>;

/**
 * List rollups query parameters
 */
export const RollupListQuerySchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  status: Type.Optional(RollupStatusSchema),
  repositoryId: Type.Optional(Type.String({ format: 'uuid' })),
  search: Type.Optional(Type.String({ description: 'Search in name and description' })),
  sortBy: Type.Optional(Type.Union([
    Type.Literal('name'),
    Type.Literal('createdAt'),
    Type.Literal('updatedAt'),
    Type.Literal('lastExecutedAt'),
  ], { default: 'createdAt' })),
  sortOrder: Type.Optional(Type.Union([
    Type.Literal('asc'),
    Type.Literal('desc'),
  ], { default: 'desc' })),
});

export type RollupListQuery = Static<typeof RollupListQuerySchema>;

/**
 * Rollup ID parameter
 */
export const RollupIdParamSchema = Type.Object({
  rollupId: Type.String({ format: 'uuid', description: 'Rollup UUID' }),
});

export type RollupIdParam = Static<typeof RollupIdParamSchema>;

// ============================================================================
// Match Result Schemas
// ============================================================================

/**
 * Individual match result between two nodes
 */
export const MatchResultSchema = Type.Object({
  /** Source node ID (from first repository) */
  sourceNodeId: Type.String(),
  /** Target node ID (from second repository) */
  targetNodeId: Type.String(),
  /** Source repository ID */
  sourceRepoId: Type.String({ format: 'uuid' }),
  /** Target repository ID */
  targetRepoId: Type.String({ format: 'uuid' }),
  /** Strategy that produced this match */
  strategy: MatchingStrategySchema,
  /** Confidence score (0-100) */
  confidence: Type.Number({ minimum: 0, maximum: 100 }),
  /** Match details */
  details: Type.Object({
    /** What was matched */
    matchedAttribute: Type.String(),
    /** Source value */
    sourceValue: Type.String(),
    /** Target value */
    targetValue: Type.String(),
    /** Additional context */
    context: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }),
});

export type MatchResult = Static<typeof MatchResultSchema>;

/**
 * Merged node representation
 */
export const MergedNodeSchema = Type.Object({
  /** New merged node ID */
  id: Type.String(),
  /** Original node IDs that were merged */
  sourceNodeIds: Type.Array(Type.String(), { minItems: 1 }),
  /** Source repository IDs */
  sourceRepoIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
  /** Node type */
  type: Type.String(),
  /** Merged name */
  name: Type.String(),
  /** Merged location info */
  locations: Type.Array(Type.Object({
    repoId: Type.String({ format: 'uuid' }),
    file: Type.String(),
    lineStart: Type.Number(),
    lineEnd: Type.Number(),
  })),
  /** Merged metadata */
  metadata: Type.Record(Type.String(), Type.Unknown()),
  /** Match information that led to this merge */
  matchInfo: Type.Object({
    strategy: MatchingStrategySchema,
    confidence: Type.Number({ minimum: 0, maximum: 100 }),
    matchCount: Type.Number(),
  }),
});

export type MergedNode = Static<typeof MergedNodeSchema>;

// ============================================================================
// Execution Result Schemas
// ============================================================================

/**
 * Rollup execution statistics
 */
export const RollupExecutionStatsSchema = Type.Object({
  /** Total nodes processed */
  totalNodesProcessed: Type.Number(),
  /** Nodes matched across repos */
  nodesMatched: Type.Number(),
  /** Nodes that remained unmatched */
  nodesUnmatched: Type.Number(),
  /** Total edges processed */
  totalEdgesProcessed: Type.Number(),
  /** Cross-repo edges created */
  crossRepoEdgesCreated: Type.Number(),
  /** Matches by strategy */
  matchesByStrategy: Type.Record(MatchingStrategySchema, Type.Number()),
  /** Nodes by type in result */
  nodesByType: Type.Record(Type.String(), Type.Number()),
  /** Edges by type in result */
  edgesByType: Type.Record(Type.String(), Type.Number()),
  /** Execution time in milliseconds */
  executionTimeMs: Type.Number(),
  /** Memory peak in bytes */
  memoryPeakBytes: Type.Optional(Type.Number()),
});

export type RollupExecutionStats = Static<typeof RollupExecutionStatsSchema>;

/**
 * Rollup execution result
 */
export const RollupExecutionResultSchema = Type.Object({
  /** Execution ID */
  id: Type.String({ format: 'uuid' }),
  /** Rollup ID */
  rollupId: Type.String({ format: 'uuid' }),
  /** Tenant ID */
  tenantId: Type.String({ format: 'uuid' }),
  /** Execution status */
  status: Type.Union([
    Type.Literal('pending'),
    Type.Literal('running'),
    Type.Literal('completed'),
    Type.Literal('failed'),
  ]),
  /** Scan IDs used */
  scanIds: Type.Array(Type.String({ format: 'uuid' })),
  /** Execution statistics */
  stats: Type.Optional(RollupExecutionStatsSchema),
  /** Match results (if includeMatchDetails was true) */
  matches: Type.Optional(Type.Array(MatchResultSchema)),
  /** Merged nodes (if completed) */
  mergedNodes: Type.Optional(Type.Array(MergedNodeSchema)),
  /** Error message (if failed) */
  errorMessage: Type.Optional(Type.String()),
  /** Error details (if failed) */
  errorDetails: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  /** Started timestamp */
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  /** Completed timestamp */
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  /** Created timestamp */
  createdAt: Type.String({ format: 'date-time' }),
});

export type RollupExecutionResult = Static<typeof RollupExecutionResultSchema>;

// ============================================================================
// API Response Schemas
// ============================================================================

/**
 * Single rollup response
 */
export const RollupResponseSchema = Type.Object({
  data: RollupConfigSchema,
  /** Latest execution info */
  latestExecution: Type.Optional(Type.Object({
    id: Type.String({ format: 'uuid' }),
    status: Type.String(),
    startedAt: Type.Optional(Type.String({ format: 'date-time' })),
    completedAt: Type.Optional(Type.String({ format: 'date-time' })),
    stats: Type.Optional(RollupExecutionStatsSchema),
  })),
});

export type RollupResponse = Static<typeof RollupResponseSchema>;

/**
 * Rollup list response
 */
export const RollupListResponseSchema = Type.Object({
  data: Type.Array(RollupConfigSchema),
  pagination: Type.Object({
    page: Type.Number(),
    pageSize: Type.Number(),
    total: Type.Number(),
    totalPages: Type.Number(),
    hasNext: Type.Boolean(),
    hasPrevious: Type.Boolean(),
  }),
});

export type RollupListResponse = Static<typeof RollupListResponseSchema>;

// ============================================================================
// Blast Radius Schemas
// ============================================================================

/**
 * Blast radius query parameters
 */
export const BlastRadiusQuerySchema = Type.Object({
  /** Node IDs to analyze */
  nodeIds: Type.Array(Type.String(), { minItems: 1 }),
  /** Maximum traversal depth */
  maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 20, default: 5 })),
  /** Edge types to follow */
  edgeTypes: Type.Optional(Type.Array(Type.String())),
  /** Include cross-repo impacts */
  includeCrossRepo: Type.Boolean({ default: true }),
  /** Include indirect impacts */
  includeIndirect: Type.Boolean({ default: true }),
});

export type BlastRadiusQuery = Static<typeof BlastRadiusQuerySchema>;

/**
 * Blast radius response
 */
export const BlastRadiusResponseSchema = Type.Object({
  /** Query that was executed */
  query: BlastRadiusQuerySchema,
  /** Rollup ID used */
  rollupId: Type.String({ format: 'uuid' }),
  /** Execution ID used */
  executionId: Type.String({ format: 'uuid' }),
  /** Direct impact nodes */
  directImpact: Type.Array(Type.Object({
    nodeId: Type.String(),
    nodeType: Type.String(),
    nodeName: Type.String(),
    repoId: Type.String({ format: 'uuid' }),
    repoName: Type.String(),
    depth: Type.Number(),
  })),
  /** Indirect impact nodes */
  indirectImpact: Type.Array(Type.Object({
    nodeId: Type.String(),
    nodeType: Type.String(),
    nodeName: Type.String(),
    repoId: Type.String({ format: 'uuid' }),
    repoName: Type.String(),
    depth: Type.Number(),
    path: Type.Array(Type.String()),
  })),
  /** Cross-repo impacts */
  crossRepoImpact: Type.Array(Type.Object({
    sourceRepoId: Type.String({ format: 'uuid' }),
    sourceRepoName: Type.String(),
    targetRepoId: Type.String({ format: 'uuid' }),
    targetRepoName: Type.String(),
    impactedNodes: Type.Number(),
    edgeType: Type.String(),
  })),
  /** Impact summary */
  summary: Type.Object({
    totalImpacted: Type.Number(),
    directCount: Type.Number(),
    indirectCount: Type.Number(),
    crossRepoCount: Type.Number(),
    impactByType: Type.Record(Type.String(), Type.Number()),
    impactByRepo: Type.Record(Type.String(), Type.Number()),
    impactByDepth: Type.Record(Type.String(), Type.Number()),
    riskLevel: Type.Union([
      Type.Literal('low'),
      Type.Literal('medium'),
      Type.Literal('high'),
      Type.Literal('critical'),
    ]),
    /**
     * Weighted impact score with depth decay.
     * Higher scores indicate greater potential blast radius.
     * ADR-002: Uses DECAY_FACTOR=0.7 per depth level.
     * ADR-004: Summary-level only (not per-node).
     */
    impactScore: Type.Number({ description: 'Weighted impact score with depth decay' }),
  }),
});

export type BlastRadiusResponse = Static<typeof BlastRadiusResponseSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for RollupId
 */
export function isRollupId(value: unknown): value is RollupId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for RollupExecutionId
 */
export function isRollupExecutionId(value: unknown): value is RollupExecutionId {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Type guard for MatchingStrategy
 */
export function isMatchingStrategy(value: unknown): value is MatchingStrategy {
  return (
    value === 'arn' ||
    value === 'resource_id' ||
    value === 'name' ||
    value === 'tag'
  );
}

/**
 * Type guard for RollupStatus
 */
export function isRollupStatus(value: unknown): value is RollupStatus {
  return (
    value === 'draft' ||
    value === 'active' ||
    value === 'executing' ||
    value === 'completed' ||
    value === 'failed' ||
    value === 'archived'
  );
}

/**
 * Type guard for ArnMatcherConfig
 */
export function isArnMatcherConfig(config: MatcherConfig): config is ArnMatcherConfig {
  return config.type === 'arn';
}

/**
 * Type guard for ResourceIdMatcherConfig
 */
export function isResourceIdMatcherConfig(config: MatcherConfig): config is ResourceIdMatcherConfig {
  return config.type === 'resource_id';
}

/**
 * Type guard for NameMatcherConfig
 */
export function isNameMatcherConfig(config: MatcherConfig): config is NameMatcherConfig {
  return config.type === 'name';
}

/**
 * Type guard for TagMatcherConfig
 */
export function isTagMatcherConfig(config: MatcherConfig): config is TagMatcherConfig {
  return config.type === 'tag';
}

/**
 * Type guard for RollupConfig
 */
export function isRollupConfig(value: unknown): value is RollupConfig {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'tenantId' in value &&
    'name' in value &&
    'matchers' in value &&
    'repositoryIds' in value
  );
}

/**
 * Type guard for RollupExecutionResult
 */
export function isRollupExecutionResult(value: unknown): value is RollupExecutionResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'rollupId' in value &&
    'status' in value
  );
}

/**
 * Type guard for MatchResult
 */
export function isMatchResult(value: unknown): value is MatchResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sourceNodeId' in value &&
    'targetNodeId' in value &&
    'strategy' in value &&
    'confidence' in value
  );
}

/**
 * Type guard for MergedNode
 */
export function isMergedNode(value: unknown): value is MergedNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'sourceNodeIds' in value &&
    'type' in value &&
    'matchInfo' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a RollupId
 */
export function createRollupId(id: string): RollupId {
  return id as RollupId;
}

/**
 * Create a RollupExecutionId
 */
export function createRollupExecutionId(id: string): RollupExecutionId {
  return id as RollupExecutionId;
}

/**
 * Create default merge options
 */
export function createDefaultMergeOptions(): RollupConfig['mergeOptions'] {
  return {
    conflictResolution: 'merge',
    preserveSourceInfo: true,
    createCrossRepoEdges: true,
  };
}

/**
 * Create empty execution stats
 */
export function createEmptyExecutionStats(): RollupExecutionStats {
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

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Rollup-specific error codes
 */
export const RollupErrorCodes = {
  // Validation errors
  INVALID_CONFIGURATION: 'ROLLUP_INVALID_CONFIGURATION',
  INVALID_MATCHER: 'ROLLUP_INVALID_MATCHER',
  REPOSITORY_NOT_FOUND: 'ROLLUP_REPOSITORY_NOT_FOUND',
  SCAN_NOT_FOUND: 'ROLLUP_SCAN_NOT_FOUND',

  // Execution errors
  EXECUTION_FAILED: 'ROLLUP_EXECUTION_FAILED',
  EXECUTION_TIMEOUT: 'ROLLUP_EXECUTION_TIMEOUT',
  EXECUTION_IN_PROGRESS: 'ROLLUP_EXECUTION_IN_PROGRESS',

  // Resource errors
  ROLLUP_NOT_FOUND: 'ROLLUP_NOT_FOUND',
  ROLLUP_ALREADY_EXISTS: 'ROLLUP_ALREADY_EXISTS',
  EXECUTION_NOT_FOUND: 'ROLLUP_EXECUTION_NOT_FOUND',

  // Limit errors
  MAX_NODES_EXCEEDED: 'ROLLUP_MAX_NODES_EXCEEDED',
  MAX_REPOSITORIES_EXCEEDED: 'ROLLUP_MAX_REPOSITORIES_EXCEEDED',
  RATE_LIMITED: 'ROLLUP_RATE_LIMITED',

  // Permission errors
  PERMISSION_DENIED: 'ROLLUP_PERMISSION_DENIED',
  REPOSITORY_ACCESS_DENIED: 'ROLLUP_REPOSITORY_ACCESS_DENIED',
} as const;

export type RollupErrorCode = typeof RollupErrorCodes[keyof typeof RollupErrorCodes];
