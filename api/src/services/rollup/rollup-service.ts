/**
 * Rollup Service Implementation
 * @module services/rollup/rollup-service
 *
 * Main domain service for Cross-Repository Aggregation (Rollup) operations.
 * Orchestrates CRUD operations, execution, validation, and blast radius analysis.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation service implementation
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
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
  BlastRadiusQuery,
  BlastRadiusResponse,
  createRollupId,
  createRollupExecutionId,
  createDefaultMergeOptions,
  createEmptyExecutionStats,
} from '../../types/rollup.js';
import { TenantId, ScanId } from '../../types/entities.js';
import {
  IRollupService,
  IRollupRepository,
  IMatcherFactory,
  IMergeEngine,
  IBlastRadiusEngine,
  RollupEntity,
  RollupExecutionEntity,
  RollupServiceConfig,
  DEFAULT_ROLLUP_SERVICE_CONFIG,
  ConfigurationValidationResult,
  ValidationError,
  ValidationWarning,
  RollupServiceError,
} from './interfaces.js';
import {
  RollupNotFoundError,
  RollupExecutionNotFoundError,
  RollupConfigurationError,
  RollupLimitExceededError,
} from './errors.js';
import { RollupExecutor, RollupExecutorDependencies } from './rollup-executor.js';
import { IRollupEventEmitter, RollupEventType } from './rollup-event-emitter.js';
import { IGraphService } from '../graph-service.js';

const logger = pino({ name: 'rollup-service' });

// ============================================================================
// Service Dependencies
// ============================================================================

/**
 * Dependencies required by RollupService
 */
export interface RollupServiceDependencies {
  /** Repository for rollup persistence */
  readonly rollupRepository: IRollupRepository;
  /** Graph service for graph operations */
  readonly graphService: IGraphService;
  /** Matcher factory for creating matchers */
  readonly matcherFactory: IMatcherFactory;
  /** Merge engine for combining graphs */
  readonly mergeEngine: IMergeEngine;
  /** Blast radius analysis engine */
  readonly blastRadiusEngine: IBlastRadiusEngine;
  /** Event emitter for rollup events */
  readonly eventEmitter: IRollupEventEmitter;
  /** Cache service interface */
  readonly cacheService?: ICacheService;
  /** Queue service for async execution */
  readonly queueService?: IQueueService;
  /** Service configuration */
  readonly config?: Partial<RollupServiceConfig>;
}

/**
 * Cache service interface for result caching
 */
export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

/**
 * Queue service interface for async execution
 */
export interface IQueueService {
  enqueue(jobType: string, payload: Record<string, unknown>): Promise<string>;
  getJobStatus(jobId: string): Promise<{ status: string; result?: unknown }>;
}

// ============================================================================
// Rollup Service Implementation
// ============================================================================

/**
 * Main rollup service implementing all IRollupService operations.
 * Coordinates rollup configuration management, execution, and analysis.
 */
export class RollupService implements IRollupService {
  private readonly config: RollupServiceConfig;
  private readonly executor: RollupExecutor;

  constructor(private readonly deps: RollupServiceDependencies) {
    this.config = { ...DEFAULT_ROLLUP_SERVICE_CONFIG, ...deps.config };

    // Create executor with dependencies
    const executorDeps: RollupExecutorDependencies = {
      rollupRepository: deps.rollupRepository,
      graphService: deps.graphService,
      matcherFactory: deps.matcherFactory,
      mergeEngine: deps.mergeEngine,
      blastRadiusEngine: deps.blastRadiusEngine,
      eventEmitter: deps.eventEmitter,
    };
    this.executor = new RollupExecutor(executorDeps);
  }

  // ==========================================================================
  // Configuration Management
  // ==========================================================================

  /**
   * Create a new rollup configuration
   */
  async createRollup(
    tenantId: TenantId,
    userId: string,
    input: RollupCreateRequest
  ): Promise<RollupConfig> {
    logger.info({ tenantId, userId, name: input.name }, 'Creating rollup configuration');

    // Validate configuration
    const validation = await this.validateConfiguration(tenantId, input);
    if (!validation.isValid) {
      throw RollupConfigurationError.fromValidationErrors(
        validation.errors.map((e) => ({
          field: e.path,
          message: e.message,
          code: e.code,
        }))
      );
    }

    // Check repository count limit
    if (input.repositoryIds.length > this.config.maxRepositoriesPerRollup) {
      throw new RollupLimitExceededError(
        'repositories',
        input.repositoryIds.length,
        this.config.maxRepositoriesPerRollup,
        { tenantId }
      );
    }

    // Check matcher count limit
    if (input.matchers.length > this.config.maxMatchersPerRollup) {
      throw new RollupLimitExceededError(
        'matchers',
        input.matchers.length,
        this.config.maxMatchersPerRollup,
        { tenantId }
      );
    }

    // Create entity via repository
    const entity = await this.deps.rollupRepository.create(tenantId, userId, input);

    // Emit creation event
    await this.deps.eventEmitter.emit({
      type: 'rollup.created',
      rollupId: entity.id,
      tenantId,
      timestamp: new Date(),
      data: { name: entity.name, repositoryCount: entity.repositoryIds.length },
    });

    logger.info({ rollupId: entity.id, tenantId }, 'Rollup configuration created');

    return this.entityToConfig(entity);
  }

  /**
   * Get a rollup configuration by ID
   */
  async getRollup(tenantId: TenantId, rollupId: RollupId): Promise<RollupConfig> {
    logger.debug({ tenantId, rollupId }, 'Getting rollup configuration');

    const entity = await this.deps.rollupRepository.findById(tenantId, rollupId);

    if (!entity) {
      throw new RollupNotFoundError(rollupId);
    }

    return this.entityToConfig(entity);
  }

  /**
   * List rollup configurations with filtering
   */
  async listRollups(
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
  }> {
    logger.debug({ tenantId, query }, 'Listing rollup configurations');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const result = await this.deps.rollupRepository.findMany(tenantId, query);

    const totalPages = Math.ceil(result.total / pageSize);

    return {
      data: result.data.map((entity) => this.entityToConfig(entity)),
      pagination: {
        page,
        pageSize,
        total: result.total,
        totalPages,
        hasNext: page < totalPages,
        hasPrevious: page > 1,
      },
    };
  }

  /**
   * Update a rollup configuration
   */
  async updateRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    userId: string,
    input: RollupUpdateRequest
  ): Promise<RollupConfig> {
    logger.info({ tenantId, rollupId, userId }, 'Updating rollup configuration');

    // Check existence
    const existing = await this.deps.rollupRepository.findById(tenantId, rollupId);
    if (!existing) {
      throw new RollupNotFoundError(rollupId);
    }

    // Validate if configuration fields are being updated
    if (input.matchers || input.repositoryIds) {
      const validation = await this.validateConfiguration(tenantId, input);
      if (!validation.isValid) {
        throw RollupConfigurationError.fromValidationErrors(
          validation.errors.map((e) => ({
            field: e.path,
            message: e.message,
            code: e.code,
          }))
        );
      }

      // Check limits on update
      if (
        input.repositoryIds &&
        input.repositoryIds.length > this.config.maxRepositoriesPerRollup
      ) {
        throw new RollupLimitExceededError(
          'repositories',
          input.repositoryIds.length,
          this.config.maxRepositoriesPerRollup,
          { rollupId }
        );
      }

      if (input.matchers && input.matchers.length > this.config.maxMatchersPerRollup) {
        throw new RollupLimitExceededError(
          'matchers',
          input.matchers.length,
          this.config.maxMatchersPerRollup,
          { rollupId }
        );
      }
    }

    // Update via repository
    const entity = await this.deps.rollupRepository.update(
      tenantId,
      rollupId,
      userId,
      input,
      existing.version
    );

    // Emit update event
    await this.deps.eventEmitter.emit({
      type: 'rollup.updated',
      rollupId: entity.id,
      tenantId,
      timestamp: new Date(),
      data: { version: entity.version },
    });

    logger.info({ rollupId, version: entity.version }, 'Rollup configuration updated');

    return this.entityToConfig(entity);
  }

  /**
   * Delete a rollup configuration
   */
  async deleteRollup(tenantId: TenantId, rollupId: RollupId): Promise<boolean> {
    logger.info({ tenantId, rollupId }, 'Deleting rollup configuration');

    const deleted = await this.deps.rollupRepository.delete(tenantId, rollupId);

    if (!deleted) {
      throw new RollupNotFoundError(rollupId);
    }

    // Emit deletion event
    await this.deps.eventEmitter.emit({
      type: 'rollup.deleted',
      rollupId,
      tenantId,
      timestamp: new Date(),
      data: {},
    });

    // Clear any cached results
    if (this.deps.cacheService) {
      await this.deps.cacheService.delete(`rollup:${rollupId}:latest`);
    }

    logger.info({ rollupId }, 'Rollup configuration deleted');

    return true;
  }

  // ==========================================================================
  // Validation
  // ==========================================================================

  /**
   * Validate a rollup configuration
   */
  async validateConfiguration(
    tenantId: TenantId,
    input: RollupCreateRequest | RollupUpdateRequest
  ): Promise<ConfigurationValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate name if provided
    if ('name' in input && input.name) {
      if (input.name.length < 1) {
        errors.push({
          code: 'INVALID_NAME',
          message: 'Name cannot be empty',
          path: 'name',
        });
      }
      if (input.name.length > 255) {
        errors.push({
          code: 'NAME_TOO_LONG',
          message: 'Name cannot exceed 255 characters',
          path: 'name',
          value: input.name.length,
        });
      }
    }

    // Validate repositories
    if (input.repositoryIds) {
      if (input.repositoryIds.length < 2) {
        errors.push({
          code: 'INSUFFICIENT_REPOSITORIES',
          message: 'At least 2 repositories are required for aggregation',
          path: 'repositoryIds',
          value: input.repositoryIds.length,
        });
      }

      // Check for duplicates
      const uniqueRepos = new Set(input.repositoryIds);
      if (uniqueRepos.size !== input.repositoryIds.length) {
        errors.push({
          code: 'DUPLICATE_REPOSITORIES',
          message: 'Repository IDs must be unique',
          path: 'repositoryIds',
        });
      }
    }

    // Validate matchers
    if (input.matchers) {
      if (input.matchers.length === 0) {
        errors.push({
          code: 'NO_MATCHERS',
          message: 'At least one matcher is required',
          path: 'matchers',
        });
      }

      // Validate each matcher configuration
      for (let i = 0; i < input.matchers.length; i++) {
        const matcherConfig = input.matchers[i];

        try {
          const matcher = this.deps.matcherFactory.createMatcher(matcherConfig);
          const matcherValidation = matcher.validateConfig();

          for (const err of matcherValidation.errors) {
            errors.push({
              ...err,
              path: `matchers[${i}].${err.path}`,
            });
          }

          for (const warn of matcherValidation.warnings) {
            warnings.push({
              ...warn,
              path: `matchers[${i}].${warn.path}`,
            });
          }
        } catch (error) {
          errors.push({
            code: 'INVALID_MATCHER_CONFIG',
            message: error instanceof Error ? error.message : 'Invalid matcher configuration',
            path: `matchers[${i}]`,
          });
        }
      }

      // Check for enabled matchers
      const enabledMatchers = input.matchers.filter((m) => m.enabled);
      if (enabledMatchers.length === 0) {
        warnings.push({
          code: 'NO_ENABLED_MATCHERS',
          message: 'No matchers are enabled; rollup execution will produce no matches',
          path: 'matchers',
          suggestion: 'Enable at least one matcher',
        });
      }
    }

    // Validate merge options
    if (input.mergeOptions) {
      if (input.mergeOptions.maxNodes !== undefined && input.mergeOptions.maxNodes < 1) {
        errors.push({
          code: 'INVALID_MAX_NODES',
          message: 'maxNodes must be at least 1',
          path: 'mergeOptions.maxNodes',
          value: input.mergeOptions.maxNodes,
        });
      }
    }

    // Validate schedule
    if (input.schedule?.enabled && input.schedule.cron) {
      // Basic cron validation (could be more comprehensive)
      const cronParts = input.schedule.cron.split(' ');
      if (cronParts.length < 5 || cronParts.length > 6) {
        errors.push({
          code: 'INVALID_CRON',
          message: 'Invalid cron expression format',
          path: 'schedule.cron',
          value: input.schedule.cron,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ==========================================================================
  // Execution
  // ==========================================================================

  /**
   * Execute a rollup (start aggregation)
   */
  async executeRollup(
    tenantId: TenantId,
    rollupId: RollupId,
    request: RollupExecuteRequest
  ): Promise<RollupExecutionResult> {
    logger.info({ tenantId, rollupId, async: request.async }, 'Executing rollup');

    // Get rollup configuration
    const rollup = await this.deps.rollupRepository.findById(tenantId, rollupId);
    if (!rollup) {
      throw new RollupNotFoundError(rollupId);
    }

    // Determine scan IDs to use
    const scanIds = request.scanIds ?? rollup.scanIds ?? [];

    // Create execution record
    const execution = await this.deps.rollupRepository.createExecution(
      tenantId,
      rollupId,
      scanIds as ScanId[],
      request.options,
      request.callbackUrl
    );

    // Emit execution started event
    await this.deps.eventEmitter.emit({
      type: 'rollup.execution.started',
      rollupId,
      tenantId,
      timestamp: new Date(),
      data: {
        executionId: execution.id,
        scanIds,
        async: request.async,
      },
    });

    // Execute synchronously or asynchronously
    if (request.async && this.deps.queueService) {
      // Queue for async execution
      await this.deps.queueService.enqueue('rollup-execution', {
        executionId: execution.id,
        tenantId,
        rollupId,
      });

      logger.info({ executionId: execution.id }, 'Rollup execution queued');

      return this.executionEntityToResult(execution);
    }

    // Execute synchronously
    try {
      const result = await this.executor.execute(execution, this.entityToConfig(rollup));

      logger.info(
        {
          executionId: execution.id,
          nodesMatched: result.stats?.nodesMatched,
        },
        'Rollup execution completed'
      );

      return result;
    } catch (error) {
      // Update execution with error
      await this.deps.rollupRepository.updateExecution(tenantId, execution.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: error instanceof Error ? { stack: error.stack } : {},
        completedAt: new Date(),
      });

      // Emit failure event
      await this.deps.eventEmitter.emit({
        type: 'rollup.execution.failed',
        rollupId,
        tenantId,
        timestamp: new Date(),
        data: {
          executionId: execution.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Get execution result by ID
   */
  async getExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<RollupExecutionResult> {
    logger.debug({ tenantId, executionId }, 'Getting execution result');

    const execution = await this.deps.rollupRepository.findExecutionById(tenantId, executionId);

    if (!execution) {
      throw new RollupExecutionNotFoundError(executionId);
    }

    return this.executionEntityToResult(execution);
  }

  // ==========================================================================
  // Blast Radius Analysis
  // ==========================================================================

  /**
   * Get blast radius analysis for nodes
   */
  async getBlastRadius(
    tenantId: TenantId,
    rollupId: RollupId,
    query: BlastRadiusQuery
  ): Promise<BlastRadiusResponse> {
    logger.info({ tenantId, rollupId, nodeIds: query.nodeIds }, 'Computing blast radius');

    // Get latest execution for this rollup
    const execution = await this.deps.rollupRepository.findLatestExecution(tenantId, rollupId);

    if (!execution) {
      throw new RollupExecutionNotFoundError('latest', rollupId);
    }

    if (execution.status !== 'completed') {
      throw RollupServiceError.executionFailed(
        rollupId,
        `Latest execution is not completed (status: ${execution.status})`
      );
    }

    // Analyze blast radius
    const response = await this.deps.blastRadiusEngine.analyze(execution.id, query);

    // Fill in rollupId
    return {
      ...response,
      rollupId,
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  /**
   * Convert RollupEntity to RollupConfig
   */
  private entityToConfig(entity: RollupEntity): RollupConfig {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      name: entity.name,
      description: entity.description ?? undefined,
      status: entity.status,
      repositoryIds: entity.repositoryIds,
      scanIds: entity.scanIds ?? undefined,
      matchers: entity.matchers,
      includeNodeTypes: entity.includeNodeTypes ?? undefined,
      excludeNodeTypes: entity.excludeNodeTypes ?? undefined,
      preserveEdgeTypes: entity.preserveEdgeTypes ?? undefined,
      mergeOptions: entity.mergeOptions ?? createDefaultMergeOptions(),
      schedule: entity.schedule ?? undefined,
      version: entity.version,
      createdBy: entity.createdBy,
      updatedBy: entity.updatedBy ?? undefined,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      lastExecutedAt: entity.lastExecutedAt?.toISOString(),
    };
  }

  /**
   * Convert RollupExecutionEntity to RollupExecutionResult
   */
  private executionEntityToResult(entity: RollupExecutionEntity): RollupExecutionResult {
    return {
      id: entity.id,
      rollupId: entity.rollupId,
      tenantId: entity.tenantId,
      status: entity.status,
      scanIds: entity.scanIds,
      stats: entity.stats ?? undefined,
      matches: entity.matches ?? undefined,
      mergedNodes: undefined, // Merged nodes stored separately
      errorMessage: entity.errorMessage ?? undefined,
      errorDetails: entity.errorDetails ?? undefined,
      startedAt: entity.startedAt?.toISOString(),
      completedAt: entity.completedAt?.toISOString(),
      createdAt: entity.createdAt.toISOString(),
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RollupService instance
 */
export function createRollupService(deps: RollupServiceDependencies): IRollupService {
  return new RollupService(deps);
}
