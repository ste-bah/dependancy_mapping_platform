/**
 * Rollup Service Factory
 * @module services/rollup/factory
 *
 * Factory functions for creating and configuring Rollup service instances.
 * Provides dependency injection and configuration management.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation factory functions
 */

import {
  IRollupService,
  IRollupRepository,
  IMatcherFactory,
  IMergeEngine,
  IBlastRadiusEngine,
  RollupServiceConfig,
  DEFAULT_ROLLUP_SERVICE_CONFIG,
} from './interfaces.js';
import { IGraphService } from '../graph-service.js';
import {
  RollupService,
  RollupServiceDependencies,
  ICacheService,
  IQueueService,
} from './rollup-service.js';
import { RollupExecutor, RollupExecutorDependencies } from './rollup-executor.js';
import {
  IRollupEventEmitter,
  RollupEventEmitter,
  InMemoryRollupEventEmitter,
  IEventPublisher,
  RollupEventEmitterConfig,
  createRollupEventEmitter,
  createInMemoryEventEmitter,
} from './rollup-event-emitter.js';
import { MatcherFactory, createMatcherFactory } from './matchers/matcher-factory.js';
import { MergeEngine, createMergeEngine } from './merge-engine.js';
import { BlastRadiusEngine, createBlastRadiusEngine } from './blast-radius-engine.js';

// ============================================================================
// Configuration Types
// ============================================================================

/**
 * Complete rollup module configuration
 */
export interface RollupModuleConfig {
  /** Service configuration */
  readonly service?: Partial<RollupServiceConfig>;
  /** Event emitter configuration */
  readonly eventEmitter?: Partial<RollupEventEmitterConfig>;
  /** Matcher factory options */
  readonly matcherFactory?: {
    readonly enableCaching?: boolean;
  };
  /** Blast radius engine options */
  readonly blastRadius?: {
    readonly cacheTtlMs?: number;
  };
}

/**
 * External dependencies required for rollup module
 */
export interface RollupModuleExternalDependencies {
  /** Repository for rollup persistence */
  readonly rollupRepository: IRollupRepository;
  /** Graph service for graph operations */
  readonly graphService: IGraphService;
  /** Optional event publisher for Redis/message queue */
  readonly eventPublisher?: IEventPublisher | null;
  /** Optional cache service */
  readonly cacheService?: ICacheService;
  /** Optional queue service for async execution */
  readonly queueService?: IQueueService;
}

/**
 * Complete rollup module with all instantiated components
 */
export interface RollupModule {
  /** Main rollup service */
  readonly service: IRollupService;
  /** Matcher factory */
  readonly matcherFactory: IMatcherFactory;
  /** Merge engine */
  readonly mergeEngine: IMergeEngine;
  /** Blast radius engine */
  readonly blastRadiusEngine: IBlastRadiusEngine;
  /** Event emitter */
  readonly eventEmitter: IRollupEventEmitter;
  /** Rollup executor */
  readonly executor: RollupExecutor;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a complete rollup module with all components
 *
 * @param externalDeps - External dependencies (repository, graph service, etc.)
 * @param config - Optional configuration overrides
 * @returns Complete rollup module
 *
 * @example
 * ```typescript
 * const rollupModule = createRollupModule({
 *   rollupRepository: myRepository,
 *   graphService: myGraphService,
 *   eventPublisher: redisClient,
 * });
 *
 * // Use the service
 * const rollup = await rollupModule.service.createRollup(tenantId, userId, request);
 * ```
 */
export function createRollupModule(
  externalDeps: RollupModuleExternalDependencies,
  config: RollupModuleConfig = {}
): RollupModule {
  // Create internal components
  const matcherFactory = createMatcherFactory(config.matcherFactory);
  const mergeEngine = createMergeEngine();
  const blastRadiusEngine = createBlastRadiusEngine(config.blastRadius);

  // Create event emitter
  const eventEmitter = createRollupEventEmitter(
    externalDeps.eventPublisher ?? null,
    config.eventEmitter
  );

  // Create service dependencies
  const serviceDeps: RollupServiceDependencies = {
    rollupRepository: externalDeps.rollupRepository,
    graphService: externalDeps.graphService,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
    cacheService: externalDeps.cacheService,
    queueService: externalDeps.queueService,
    config: config.service,
  };

  // Create main service
  const service = new RollupService(serviceDeps);

  // Create executor (for direct access if needed)
  const executorDeps: RollupExecutorDependencies = {
    rollupRepository: externalDeps.rollupRepository,
    graphService: externalDeps.graphService,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
  };
  const executor = new RollupExecutor(executorDeps);

  return {
    service,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
    executor,
  };
}

/**
 * Create just the rollup service with explicit dependencies
 *
 * @param deps - All required dependencies
 * @returns Rollup service instance
 */
export function createRollupService(deps: RollupServiceDependencies): IRollupService {
  return new RollupService(deps);
}

/**
 * Create a rollup executor with dependencies
 *
 * @param deps - Executor dependencies
 * @returns Rollup executor instance
 */
export function createRollupExecutor(deps: RollupExecutorDependencies): RollupExecutor {
  return new RollupExecutor(deps);
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Create a rollup module for testing with in-memory event emitter
 *
 * @param externalDeps - External dependencies
 * @param config - Optional configuration
 * @returns Rollup module with in-memory event emitter
 */
export function createTestRollupModule(
  externalDeps: Omit<RollupModuleExternalDependencies, 'eventPublisher'>,
  config: RollupModuleConfig = {}
): RollupModule & { eventEmitter: InMemoryRollupEventEmitter } {
  // Create internal components
  const matcherFactory = createMatcherFactory(config.matcherFactory);
  const mergeEngine = createMergeEngine();
  const blastRadiusEngine = createBlastRadiusEngine(config.blastRadius);

  // Create in-memory event emitter for testing
  const eventEmitter = createInMemoryEventEmitter();

  // Create service dependencies
  const serviceDeps: RollupServiceDependencies = {
    rollupRepository: externalDeps.rollupRepository,
    graphService: externalDeps.graphService,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
    cacheService: externalDeps.cacheService,
    queueService: externalDeps.queueService,
    config: config.service,
  };

  // Create main service
  const service = new RollupService(serviceDeps);

  // Create executor
  const executorDeps: RollupExecutorDependencies = {
    rollupRepository: externalDeps.rollupRepository,
    graphService: externalDeps.graphService,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
  };
  const executor = new RollupExecutor(executorDeps);

  return {
    service,
    matcherFactory,
    mergeEngine,
    blastRadiusEngine,
    eventEmitter,
    executor,
  };
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Get default rollup module configuration
 */
export function getDefaultRollupModuleConfig(): Required<RollupModuleConfig> {
  return {
    service: DEFAULT_ROLLUP_SERVICE_CONFIG,
    eventEmitter: {
      channelPrefix: 'rollup:events',
      source: 'rollup-service',
      logEvents: true,
      eventVersion: 1,
      retry: {
        maxAttempts: 3,
        backoffMs: 100,
      },
    },
    matcherFactory: {
      enableCaching: true,
    },
    blastRadius: {
      cacheTtlMs: 3600000, // 1 hour
    },
  };
}

/**
 * Merge configuration with defaults
 */
export function mergeRollupConfig(
  userConfig: RollupModuleConfig
): Required<RollupModuleConfig> {
  const defaults = getDefaultRollupModuleConfig();

  return {
    service: { ...defaults.service, ...userConfig.service },
    eventEmitter: { ...defaults.eventEmitter, ...userConfig.eventEmitter },
    matcherFactory: { ...defaults.matcherFactory, ...userConfig.matcherFactory },
    blastRadius: { ...defaults.blastRadius, ...userConfig.blastRadius },
  };
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate external dependencies
 * @throws Error if dependencies are invalid
 */
export function validateExternalDependencies(
  deps: RollupModuleExternalDependencies
): void {
  if (!deps.rollupRepository) {
    throw new Error('rollupRepository is required');
  }

  if (!deps.graphService) {
    throw new Error('graphService is required');
  }

  // Validate repository has required methods
  const requiredRepoMethods = [
    'create',
    'findById',
    'findMany',
    'update',
    'delete',
    'createExecution',
    'findExecutionById',
    'updateExecution',
  ];

  for (const method of requiredRepoMethods) {
    if (typeof (deps.rollupRepository as Record<string, unknown>)[method] !== 'function') {
      throw new Error(`rollupRepository missing required method: ${method}`);
    }
  }

  // Validate graph service has required methods
  const requiredGraphMethods = ['buildGraph', 'validateGraph'];

  for (const method of requiredGraphMethods) {
    if (typeof (deps.graphService as Record<string, unknown>)[method] !== 'function') {
      throw new Error(`graphService missing required method: ${method}`);
    }
  }
}
