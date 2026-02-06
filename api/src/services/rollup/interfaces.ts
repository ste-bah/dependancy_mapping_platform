/**
 * Rollup Service Interfaces
 * @module services/rollup/interfaces
 *
 * Interface definitions for the Cross-Repository Aggregation (Rollup) service.
 * Implements the Strategy pattern for matching and the Repository pattern for persistence.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation service interfaces
 */

import {
  RollupId,
  RollupExecutionId,
  RollupConfig,
  RollupStatus,
  RollupCreateRequest,
  RollupUpdateRequest,
  RollupExecuteRequest,
  RollupListQuery,
  RollupExecutionResult,
  RollupExecutionStats,
  MatchResult,
  MergedNode,
  MatcherConfig,
  MatchingStrategy,
  BlastRadiusQuery,
  BlastRadiusResponse,
  RollupErrorCode,
  RollupErrorCodes,
} from '../../types/rollup.js';
import { TenantId, RepositoryId, ScanId } from '../../types/entities.js';
import { NodeType, GraphEdge, DependencyGraph } from '../../types/graph.js';

// ============================================================================
// Service Error
// ============================================================================

/**
 * Rollup service error with structured error codes
 */
export class RollupServiceError extends Error {
  /**
   * Create a new RollupServiceError
   * @param message - Human-readable error message
   * @param code - Machine-readable error code
   * @param context - Additional error context
   * @param cause - Original error if wrapping
   */
  constructor(
    message: string,
    public readonly code: RollupErrorCode,
    public readonly context?: Record<string, unknown>,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RollupServiceError';

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RollupServiceError);
    }
  }

  /**
   * Create a not found error
   */
  static notFound(resourceType: 'rollup' | 'execution', id: string): RollupServiceError {
    const code = resourceType === 'rollup'
      ? RollupErrorCodes.ROLLUP_NOT_FOUND
      : RollupErrorCodes.EXECUTION_NOT_FOUND;

    return new RollupServiceError(
      `${resourceType === 'rollup' ? 'Rollup' : 'Execution'} not found: ${id}`,
      code,
      { [`${resourceType}Id`]: id }
    );
  }

  /**
   * Create an invalid configuration error
   */
  static invalidConfiguration(message: string, details?: Record<string, unknown>): RollupServiceError {
    return new RollupServiceError(
      message,
      RollupErrorCodes.INVALID_CONFIGURATION,
      details
    );
  }

  /**
   * Create an execution failed error
   */
  static executionFailed(rollupId: string, reason: string, cause?: Error): RollupServiceError {
    return new RollupServiceError(
      `Rollup execution failed: ${reason}`,
      RollupErrorCodes.EXECUTION_FAILED,
      { rollupId, reason },
      cause
    );
  }

  /**
   * Create a permission denied error
   */
  static permissionDenied(action: string, resourceId?: string): RollupServiceError {
    return new RollupServiceError(
      `Permission denied: ${action}`,
      RollupErrorCodes.PERMISSION_DENIED,
      { action, resourceId }
    );
  }

  /**
   * Create a rate limited error
   */
  static rateLimited(retryAfter?: number): RollupServiceError {
    return new RollupServiceError(
      'Rate limit exceeded for rollup operations',
      RollupErrorCodes.RATE_LIMITED,
      { retryAfter }
    );
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Result of configuration validation
 */
export interface ConfigurationValidationResult {
  /** Whether the configuration is valid */
  readonly isValid: boolean;
  /** Validation errors */
  readonly errors: ValidationError[];
  /** Validation warnings */
  readonly warnings: ValidationWarning[];
}

/**
 * Validation error detail
 */
export interface ValidationError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** JSON path to the invalid field */
  readonly path: string;
  /** Invalid value (if safe to include) */
  readonly value?: unknown;
}

/**
 * Validation warning detail
 */
export interface ValidationWarning {
  /** Warning code */
  readonly code: string;
  /** Warning message */
  readonly message: string;
  /** JSON path to the field */
  readonly path: string;
  /** Suggestion for improvement */
  readonly suggestion?: string;
}

// ============================================================================
// Entity Interfaces
// ============================================================================

/**
 * Rollup entity for database storage
 */
export interface RollupEntity {
  /** Unique rollup ID */
  readonly id: RollupId;
  /** Tenant ID (multi-tenancy) */
  readonly tenantId: TenantId;
  /** Human-readable name */
  readonly name: string;
  /** Description */
  readonly description: string | null;
  /** Current status */
  readonly status: RollupStatus;
  /** Repository IDs (JSON) */
  readonly repositoryIds: RepositoryId[];
  /** Scan IDs (JSON, optional) */
  readonly scanIds: ScanId[] | null;
  /** Matcher configurations (JSON) */
  readonly matchers: MatcherConfig[];
  /** Include node types (JSON, optional) */
  readonly includeNodeTypes: string[] | null;
  /** Exclude node types (JSON, optional) */
  readonly excludeNodeTypes: string[] | null;
  /** Preserve edge types (JSON, optional) */
  readonly preserveEdgeTypes: string[] | null;
  /** Merge options (JSON) */
  readonly mergeOptions: RollupConfig['mergeOptions'];
  /** Schedule configuration (JSON, optional) */
  readonly schedule: RollupConfig['schedule'] | null;
  /** Version for optimistic locking */
  readonly version: number;
  /** Created by user ID */
  readonly createdBy: string;
  /** Updated by user ID */
  readonly updatedBy: string | null;
  /** Creation timestamp */
  readonly createdAt: Date;
  /** Last update timestamp */
  readonly updatedAt: Date;
  /** Last execution timestamp */
  readonly lastExecutedAt: Date | null;
}

/**
 * Rollup execution entity for database storage
 */
export interface RollupExecutionEntity {
  /** Unique execution ID */
  readonly id: RollupExecutionId;
  /** Rollup ID */
  readonly rollupId: RollupId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Execution status */
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  /** Scan IDs used (JSON) */
  readonly scanIds: ScanId[];
  /** Execution statistics (JSON, optional) */
  readonly stats: RollupExecutionStats | null;
  /** Match results (JSON, optional) */
  readonly matches: MatchResult[] | null;
  /** Merged graph ID (if completed) */
  readonly mergedGraphId: string | null;
  /** Error message (if failed) */
  readonly errorMessage: string | null;
  /** Error details (JSON, if failed) */
  readonly errorDetails: Record<string, unknown> | null;
  /** Callback URL (optional) */
  readonly callbackUrl: string | null;
  /** Execution options used (JSON) */
  readonly options: RollupExecuteRequest['options'] | null;
  /** Started timestamp */
  readonly startedAt: Date | null;
  /** Completed timestamp */
  readonly completedAt: Date | null;
  /** Creation timestamp */
  readonly createdAt: Date;
}

// ============================================================================
// Matcher Interfaces (Strategy Pattern)
// ============================================================================

/**
 * Match candidate for comparison
 */
export interface MatchCandidate {
  /** Node being compared */
  readonly node: NodeType;
  /** Repository ID this node belongs to */
  readonly repositoryId: RepositoryId;
  /** Scan ID this node came from */
  readonly scanId: ScanId;
  /** Extracted match key (strategy-specific) */
  readonly matchKey: string;
  /** Additional attributes for matching */
  readonly attributes: Record<string, unknown>;
}

/**
 * Interface for a single matching strategy
 */
export interface IMatcher {
  /** Strategy type */
  readonly strategy: MatchingStrategy;
  /** Configuration for this matcher */
  readonly config: MatcherConfig;

  /**
   * Extract match candidates from nodes
   * @param nodes - Nodes to process
   * @param repositoryId - Repository these nodes belong to
   * @param scanId - Scan these nodes came from
   * @returns Match candidates that can be compared
   */
  extractCandidates(
    nodes: NodeType[],
    repositoryId: RepositoryId,
    scanId: ScanId
  ): MatchCandidate[];

  /**
   * Compare two candidates for a match
   * @param candidate1 - First candidate
   * @param candidate2 - Second candidate
   * @returns Match result if matched, null otherwise
   */
  compare(
    candidate1: MatchCandidate,
    candidate2: MatchCandidate
  ): MatchResult | null;

  /**
   * Validate the matcher configuration
   * @returns Validation result
   */
  validateConfig(): ConfigurationValidationResult;

  /**
   * Check if the matcher is enabled
   * @returns True if enabled
   */
  isEnabled(): boolean;

  /**
   * Get the matcher priority
   * @returns Priority value (0-100)
   */
  getPriority(): number;
}

/**
 * Factory for creating matchers based on configuration
 */
export interface IMatcherFactory {
  /**
   * Create a matcher from configuration
   * @param config - Matcher configuration
   * @returns Configured matcher instance
   */
  createMatcher(config: MatcherConfig): IMatcher;

  /**
   * Create all matchers from a rollup configuration
   * @param matchers - Array of matcher configurations
   * @returns Array of configured matchers sorted by priority
   */
  createMatchers(matchers: MatcherConfig[]): IMatcher[];

  /**
   * Get available matcher types
   * @returns List of supported matcher types
   */
  getAvailableTypes(): MatchingStrategy[];
}

// ============================================================================
// Merge Engine Interface
// ============================================================================

/**
 * Input for merge operation
 */
export interface MergeInput {
  /** Graphs to merge (one per repository) */
  readonly graphs: Array<{
    graph: DependencyGraph;
    repositoryId: RepositoryId;
    scanId: ScanId;
  }>;
  /** Match results to use for merging */
  readonly matches: MatchResult[];
  /** Merge options */
  readonly options: RollupConfig['mergeOptions'];
}

/**
 * Output from merge operation
 */
export interface MergeOutput {
  /** Merged nodes */
  readonly mergedNodes: MergedNode[];
  /** All edges (including cross-repo) */
  readonly edges: GraphEdge[];
  /** Unmatched nodes (preserved as-is) */
  readonly unmatchedNodes: NodeType[];
  /** Statistics about the merge */
  readonly stats: {
    readonly nodesBeforeMerge: number;
    readonly nodesAfterMerge: number;
    readonly edgesBeforeMerge: number;
    readonly edgesAfterMerge: number;
    readonly crossRepoEdges: number;
    readonly conflicts: number;
    readonly conflictsResolved: number;
  };
}

/**
 * Interface for the merge engine that combines matched nodes
 */
export interface IMergeEngine {
  /**
   * Merge multiple graphs based on match results
   * @param input - Merge input with graphs and matches
   * @returns Merge output with combined graph
   */
  merge(input: MergeInput): MergeOutput;

  /**
   * Validate merge input
   * @param input - Input to validate
   * @returns Validation result
   */
  validateInput(input: MergeInput): ConfigurationValidationResult;
}

// ============================================================================
// Blast Radius Engine Interface
// ============================================================================

/**
 * Interface for blast radius analysis engine
 */
export interface IBlastRadiusEngine {
  /**
   * Analyze blast radius from a merged graph
   * @param executionId - Execution ID to analyze
   * @param query - Blast radius query parameters
   * @returns Blast radius analysis results
   */
  analyze(
    executionId: RollupExecutionId,
    query: BlastRadiusQuery
  ): Promise<BlastRadiusResponse>;

  /**
   * Get cached analysis if available
   * @param executionId - Execution ID
   * @param nodeIds - Node IDs in query
   * @returns Cached result or null
   */
  getCached(
    executionId: RollupExecutionId,
    nodeIds: string[]
  ): Promise<BlastRadiusResponse | null>;
}

// ============================================================================
// Repository Interface
// ============================================================================

/**
 * Repository interface for rollup persistence
 */
export interface IRollupRepository {
  // ===== Rollup CRUD =====

  /**
   * Create a new rollup configuration
   * @param tenantId - Tenant ID
   * @param userId - User creating the rollup
   * @param input - Rollup creation input
   * @returns Created rollup entity
   */
  create(
    tenantId: TenantId,
    userId: string,
    input: RollupCreateRequest
  ): Promise<RollupEntity>;

  /**
   * Get a rollup by ID
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @returns Rollup entity or null if not found
   */
  findById(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupEntity | null>;

  /**
   * List rollups with filtering and pagination
   * @param tenantId - Tenant ID
   * @param query - Query parameters
   * @returns Paginated list of rollups
   */
  findMany(
    tenantId: TenantId,
    query: RollupListQuery
  ): Promise<{
    data: RollupEntity[];
    total: number;
  }>;

  /**
   * Update a rollup configuration
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param userId - User making the update
   * @param input - Update input
   * @param expectedVersion - Expected version for optimistic locking
   * @returns Updated rollup entity
   */
  update(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    input: RollupUpdateRequest,
    expectedVersion?: number
  ): Promise<RollupEntity>;

  /**
   * Delete a rollup configuration
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @returns True if deleted, false if not found
   */
  delete(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<boolean>;

  /**
   * Update rollup status
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param status - New status
   * @returns Updated rollup entity
   */
  updateStatus(
    tenantId: TenantId,
    rollupId: RollupId,
    status: RollupStatus
  ): Promise<RollupEntity>;

  // ===== Execution CRUD =====

  /**
   * Create a new execution record
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param scanIds - Scan IDs to use
   * @param options - Execution options
   * @returns Created execution entity
   */
  createExecution(
    tenantId: TenantId,
    rollupId: RollupId,
    scanIds: ScanId[],
    options?: RollupExecuteRequest['options'],
    callbackUrl?: string
  ): Promise<RollupExecutionEntity>;

  /**
   * Get an execution by ID
   * @param tenantId - Tenant ID
   * @param executionId - Execution ID
   * @returns Execution entity or null
   */
  findExecutionById(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionEntity | null>;

  /**
   * Get the latest execution for a rollup
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @returns Latest execution or null
   */
  findLatestExecution(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupExecutionEntity | null>;

  /**
   * Update execution status and results
   * @param tenantId - Tenant ID
   * @param executionId - Execution ID
   * @param update - Update data
   * @returns Updated execution entity
   */
  updateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    update: {
      status?: RollupExecutionEntity['status'];
      stats?: RollupExecutionStats;
      matches?: MatchResult[];
      mergedGraphId?: string;
      errorMessage?: string;
      errorDetails?: Record<string, unknown>;
      startedAt?: Date;
      completedAt?: Date;
    }
  ): Promise<RollupExecutionEntity>;

  /**
   * List executions for a rollup
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param limit - Maximum results
   * @returns List of executions
   */
  listExecutions(
    tenantId: TenantId,
    rollupId: RollupId,
    limit?: number
  ): Promise<RollupExecutionEntity[]>;
}

// ============================================================================
// Service Interface
// ============================================================================

/**
 * Main rollup service interface
 */
export interface IRollupService {
  // ===== Configuration Management =====

  /**
   * Create a new rollup configuration
   * @param tenantId - Tenant ID
   * @param userId - User creating the rollup
   * @param input - Creation request
   * @returns Created rollup configuration
   */
  createRollup(
    tenantId: TenantId,
    userId: string,
    input: RollupCreateRequest
  ): Promise<RollupConfig>;

  /**
   * Get a rollup configuration by ID
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @returns Rollup configuration
   * @throws RollupServiceError if not found
   */
  getRollup(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<RollupConfig>;

  /**
   * List rollup configurations with filtering
   * @param tenantId - Tenant ID
   * @param query - Query parameters
   * @returns Paginated list of rollups
   */
  listRollups(
    tenantId: TenantId,
    query: RollupListQuery
  ): Promise<{
    data: RollupConfig[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
      hasNext: boolean;
      hasPrevious: boolean;
    };
  }>;

  /**
   * Update a rollup configuration
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param userId - User making the update
   * @param input - Update request
   * @returns Updated rollup configuration
   */
  updateRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    input: RollupUpdateRequest
  ): Promise<RollupConfig>;

  /**
   * Delete a rollup configuration
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @returns True if deleted
   */
  deleteRollup(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<boolean>;

  // ===== Validation =====

  /**
   * Validate a rollup configuration
   * @param tenantId - Tenant ID
   * @param input - Configuration to validate
   * @returns Validation result
   */
  validateConfiguration(
    tenantId: TenantId,
    input: RollupCreateRequest | RollupUpdateRequest
  ): Promise<ConfigurationValidationResult>;

  // ===== Execution =====

  /**
   * Execute a rollup (start aggregation)
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param request - Execution request
   * @returns Execution result (may be pending if async)
   */
  executeRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    request: RollupExecuteRequest
  ): Promise<RollupExecutionResult>;

  /**
   * Get execution result by ID
   * @param tenantId - Tenant ID
   * @param executionId - Execution ID
   * @returns Execution result
   */
  getExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionResult>;

  // ===== Blast Radius =====

  /**
   * Get blast radius analysis for nodes
   * @param tenantId - Tenant ID
   * @param rollupId - Rollup ID
   * @param query - Blast radius query
   * @returns Blast radius analysis
   */
  getBlastRadius(
    tenantId: TenantId,
    rollupId: RollupId,
    query: BlastRadiusQuery
  ): Promise<BlastRadiusResponse>;
}

// ============================================================================
// Service Configuration
// ============================================================================

/**
 * Rollup service configuration
 */
export interface RollupServiceConfig {
  /** Maximum repositories per rollup */
  readonly maxRepositoriesPerRollup: number;
  /** Maximum matchers per rollup */
  readonly maxMatchersPerRollup: number;
  /** Maximum nodes in merged result */
  readonly maxMergedNodes: number;
  /** Default execution timeout in seconds */
  readonly defaultTimeoutSeconds: number;
  /** Maximum execution timeout in seconds */
  readonly maxTimeoutSeconds: number;
  /** Enable execution result caching */
  readonly enableResultCaching: boolean;
  /** Result cache TTL in seconds */
  readonly resultCacheTtlSeconds: number;
  /** Maximum concurrent executions per tenant */
  readonly maxConcurrentExecutions: number;
}

/**
 * Default rollup service configuration
 */
export const DEFAULT_ROLLUP_SERVICE_CONFIG: RollupServiceConfig = {
  maxRepositoriesPerRollup: 10,
  maxMatchersPerRollup: 20,
  maxMergedNodes: 50000,
  defaultTimeoutSeconds: 300,
  maxTimeoutSeconds: 3600,
  enableResultCaching: true,
  resultCacheTtlSeconds: 3600,
  maxConcurrentExecutions: 5,
};
