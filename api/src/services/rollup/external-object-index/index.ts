/**
 * External Object Index Module Exports
 * @module services/rollup/external-object-index
 *
 * Central exports for the External Object Index subsystem.
 * Provides indexing, lookup, and reverse lookup for external references
 * including AWS ARNs, Resource IDs, and Kubernetes references.
 *
 * TASK-ROLLUP-003: External Object Index with reverse lookup support
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

// ============================================================================
// Interfaces and Types
// ============================================================================

export type {
  // External Object Types
  ExternalReferenceType,
  ExternalObjectEntry,
  ExternalObjectLookupResult,
  ReverseLookupResult,
  ExternalObjectIndexStats,
  IndexBuildOptions,
  IndexBuildResult,
  // Service Interface
  IExternalObjectIndexService,
  // Engine Interface
  IIndexEngine,
  // Repository Interface
  IExternalObjectRepository,
  // Cache Interface
  IExternalObjectCache,
  ExternalObjectCacheConfig,
  // Extractor Interfaces
  IExternalReferenceExtractor,
  IExtractorFactory,
  ExtractedReference,
  // Configuration
  ExternalObjectIndexServiceConfig,
} from './interfaces.js';

export {
  DEFAULT_EXTERNAL_OBJECT_CACHE_CONFIG,
  DEFAULT_EXTERNAL_OBJECT_INDEX_CONFIG,
} from './interfaces.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Configuration schemas
  ExternalIndexConfigSchema,
  L1CacheConfigSchema,
  L2CacheConfigSchema,
  CacheConfigSchema,
  IndexingConfigSchema,
  PerformanceConfigSchema,
  ExtractionConfigSchema,

  // Configuration types
  type ExternalIndexConfig,
  type L1CacheConfig,
  type L2CacheConfig,
  type CacheConfig,
  type IndexingConfig,
  type PerformanceConfig,
  type ExtractionConfig,

  // Environment variable names
  ExternalIndexEnvVars,

  // Default configuration
  DEFAULT_EXTERNAL_INDEX_CONFIG,

  // Configuration loaders
  loadExternalIndexConfig,
  loadExternalIndexConfigWithDefaults,
  getEnvironmentDefaults as getExternalIndexEnvironmentDefaults,
  // Re-export without rename for direct config access
  getEnvironmentDefaults,

  // Singleton accessors
  getExternalIndexConfig,
  resetExternalIndexConfig,
  setExternalIndexConfig,

  // Section accessors
  getCacheConfig as getExternalIndexCacheConfig,
  getCacheConfig,
  getL1CacheConfig,
  getL2CacheConfig,
  getIndexingConfig,
  getPerformanceConfig,
  getExtractionConfig,

  // Validation utilities
  validateExternalIndexConfig,
  isValidExternalIndexConfig,
  getConfigValidationErrors,
  ExternalIndexConfigError,

  // Summary and debugging
  getExternalIndexConfigSummary,

  // Test utilities
  createTestConfig as createTestExternalIndexConfig,
} from './config.js';

// ============================================================================
// Main Service
// ============================================================================

export {
  ExternalObjectIndexService,
  createExternalObjectIndexService,
  type ExternalObjectIndexServiceDependencies,
  type IGraphService,
} from './external-object-index-service.js';

// ============================================================================
// Index Engine
// ============================================================================

export {
  IndexEngine,
  createIndexEngine,
  getDefaultIndexEngine,
  resetDefaultIndexEngine,
} from './index-engine.js';

// ============================================================================
// Cache Layer
// ============================================================================

export {
  ExternalObjectCache,
  createExternalObjectCache,
  getDefaultExternalObjectCache,
  resetDefaultExternalObjectCache,
} from './external-object-cache.js';

// ============================================================================
// Repository
// ============================================================================

export {
  ExternalObjectRepository,
  createExternalObjectRepository,
  createExternalObjectId,
  type IDatabaseClient,
  type IExternalObjectIndexRepository,
  type ExternalObjectId,
  type PaginationOptions,
  type NodeReference,
  type IndexEntry,
  type IndexEntryCreate,
  type RepositoryIndexStats,
} from './external-object-repository.js';

// ============================================================================
// Data Mappers
// ============================================================================

export {
  ExternalObjectMapper,
  createExternalObjectMapper,
  getDefaultMapper,
  resetDefaultMapper,
  type ExternalObjectIndexRow,
  type NodeExternalObjectRow,
  type ExternalObjectMasterRow,
  type ExternalObjectIndexPersistence,
  type NodeExternalObjectPersistence,
} from './mappers/index.js';

// ============================================================================
// Extractors
// ============================================================================

export {
  // Base extractor
  BaseExtractor,
  // Concrete extractors
  ArnExtractor,
  createArnExtractor,
  ResourceIdExtractor,
  createResourceIdExtractor,
  K8sExtractor,
  createK8sExtractor,
  // Factory
  ExtractorFactory,
  createExtractorFactory,
  getDefaultExtractorFactory,
  resetDefaultExtractorFactory,
} from './extractors/index.js';

// ============================================================================
// Event Handlers
// ============================================================================

export {
  ScanCompletedEventHandler,
  createEventHandlers,
  registerEventHandlers,
  type ScanCompletedEvent,
  type IndexUpdatedEvent,
  type IEventPublisher,
  type EventHandlerConfig,
  DEFAULT_EVENT_HANDLER_CONFIG,
} from './event-handlers.js';

// ============================================================================
// Logger
// ============================================================================

export {
  // Logger factory functions
  createIndexLogger,
  createOperationLogger,
  createBuildLogger,
  createLookupLogger,
  getIndexLogger,
  resetIndexLogger,

  // Logger interface and context types
  type ExternalIndexLogger,
  type ExternalIndexLogContext,
  type ExternalIndexOperation,

  // Log events and constants
  LogEvents,
  type LogEvent,
  PerformanceThresholds,

  // Utility functions
  logPerformance,
  createIndexTimer,
  withIndexLogging,
} from './logger.js';

// ============================================================================
// Errors
// ============================================================================

export {
  // Error codes and mappings
  ExternalObjectIndexErrorCodes,
  type ExternalObjectIndexErrorCode,
  ExternalObjectIndexErrorSeverity,
  ExternalObjectIndexHttpStatus,
  ExternalObjectIndexRetryable,
  ExternalObjectIndexErrorMessage,

  // Extended error context
  type ExternalObjectIndexErrorContext,

  // Error classes (all have static factory methods)
  ExternalObjectIndexError,
  IndexBuildError,
  LookupError,
  ExtractionError,
  CacheError,
  RepositoryError,
  IndexValidationError,
  InfrastructureError,
  AggregateIndexError,

  // Type guards
  isExternalObjectIndexError,
  isIndexBuildError,
  isLookupError,
  isExtractionError,
  isCacheError,
  isRepositoryError,
  isIndexValidationError,
  isInfrastructureError,
  isAggregateIndexError,
  isRetryableIndexError,

  // HTTP mapping utilities
  errorToHttpStatus,
  errorCodeToHttpStatus,

  // Error wrapping
  wrapAsIndexError,

  // Recovery utilities
  type IndexRetryOptions,
  DEFAULT_INDEX_RETRY_OPTIONS,
  withIndexRetry,
  withIndexFallback,
  withIndexTimeout,

  // Factory and info functions
  createIndexError,
  getIndexErrorInfo,
  type IndexErrorInfo,
  getRetryableErrorCodes,
  getErrorCodesBySeverity,

  // Utility predicates
  isValidationErrorCode,
  isCacheErrorCode,
  isInfrastructureErrorCode,
  isPermissionErrorCode,
  allowsGracefulDegradation,
} from './errors.js';

// ============================================================================
// Domain Layer
// ============================================================================

export {
  // Result type
  Result,
  type StringResult,
  type ValidationResult,
  type DomainResult,
  ValidationError,
  DomainError,
  isValidationError,
  isDomainError,

  // Domain types
  type ReferenceHash,
  type IndexEntryId,
  ExternalRefType,
  CloudProvider,
  ALL_EXTERNAL_REF_TYPES,
  ALL_CLOUD_PROVIDERS,
  isExternalRefType,
  isCloudProvider,
  computeReferenceHash,
  computeCollectionHash,
  createIndexEntryId,
  createReferenceHash,
  ConfidenceLevel,
  getConfidenceLevel,
  type ExternalReferenceDTO,
  type IndexEntryDTO,
  type CreateExternalReferenceParams,
  type CreateIndexEntryParams,
  type NodeReferenceSource,

  // Value Objects
  ExternalReferenceVO,
  createArnReference,
  createK8sReference,
  createContainerImageReference,
  createStoragePathReference,

  // Aggregate Roots
  IndexEntryAggregate,
  createIndexEntryWithReferences,
  createIndexEntriesBatch,

  // Factories
  ExternalReferenceFactory,
  IndexEntryFactory,
  getDefaultReferenceFactory,
  getDefaultEntryFactory,
  resetFactories,
  createArnRef,
  createK8sRef,
  createEntryFromNode,
  type IdGenerator,
  defaultIdGenerator,

  // Validators
  validateArn,
  isValidArn,
  normalizeArn,
  type ParsedArn,
  validateContainerImage,
  isValidContainerImage,
  type ParsedContainerImage,
  validateGitUrl,
  isValidGitUrl,
  type ParsedGitUrl,
  validateStoragePath,
  isValidStoragePath,
  type ParsedStoragePath,
  validateK8sReference,
  isValidK8sReference,
  type ParsedK8sReference,
  validateConfidence,
  validateNonEmptyString,
  validateExternalReference,
  validateBatch,
  type BatchValidationResult,
} from './domain/index.js';

// ============================================================================
// Factory Function (Convenience)
// ============================================================================

import { createExternalObjectIndexService } from './external-object-index-service.js';
import { createIndexEngine } from './index-engine.js';
import { createExternalObjectCache } from './external-object-cache.js';
import { createExternalObjectRepository, IDatabaseClient } from './external-object-repository.js';
import { createEventHandlers, IEventPublisher } from './event-handlers.js';
import type { ExternalObjectIndexServiceConfig } from './interfaces.js';
import type { IGraphService } from './external-object-index-service.js';
import {
  getExternalIndexConfig,
  type ExternalIndexConfig,
} from './config.js';

/**
 * External dependencies required to create the module
 */
export interface ExternalObjectIndexModuleDependencies {
  /** Database client */
  readonly databaseClient: IDatabaseClient;
  /** Graph service for retrieving scan data */
  readonly graphService: IGraphService;
  /** Optional event publisher */
  readonly eventPublisher?: IEventPublisher;
  /** Optional service configuration (legacy) */
  readonly config?: Partial<ExternalObjectIndexServiceConfig>;
  /** Optional external index configuration (new) */
  readonly externalIndexConfig?: Partial<ExternalIndexConfig>;
}

/**
 * External object index module components
 */
export interface ExternalObjectIndexModule {
  /** Main service */
  readonly service: ReturnType<typeof createExternalObjectIndexService>;
  /** Index engine */
  readonly indexEngine: ReturnType<typeof createIndexEngine>;
  /** Cache */
  readonly cache: ReturnType<typeof createExternalObjectCache>;
  /** Repository */
  readonly repository: ReturnType<typeof createExternalObjectRepository>;
  /** Event handlers */
  readonly eventHandlers: ReturnType<typeof createEventHandlers>;
}

/**
 * Create a complete External Object Index module with all components wired together.
 * Convenience factory for production use.
 *
 * @param deps - External dependencies
 * @returns Fully configured module
 *
 * @example
 * ```typescript
 * const externalObjectIndexModule = createExternalObjectIndexModule({
 *   databaseClient: db,
 *   graphService: graphService,
 * });
 *
 * // Use the service
 * await externalObjectIndexModule.service.buildIndex(tenantId, repositoryIds);
 * const result = await externalObjectIndexModule.service.lookupByExternalId(
 *   tenantId,
 *   'arn:aws:s3:::my-bucket'
 * );
 * ```
 */
export function createExternalObjectIndexModule(
  deps: ExternalObjectIndexModuleDependencies
): ExternalObjectIndexModule {
  // Get configuration (merged with environment)
  const indexConfig = getExternalIndexConfig();

  // Create components with configuration
  const indexEngine = createIndexEngine();
  const cache = createExternalObjectCache({
    ...deps.config?.cache,
    // Apply new config values
    l1MaxSize: deps.externalIndexConfig?.cache?.l1?.maxEntries ?? indexConfig.cache.l1.maxEntries,
    l1TtlMs: deps.externalIndexConfig?.cache?.l1?.ttlMs ?? indexConfig.cache.l1.ttlMs,
    l2TtlMs: deps.externalIndexConfig?.cache?.l2?.ttlMs ?? indexConfig.cache.l2.ttlMs,
    l2KeyPrefix: deps.externalIndexConfig?.cache?.l2?.prefix ?? indexConfig.cache.l2.prefix,
  });
  const repository = createExternalObjectRepository(deps.databaseClient);

  // Create main service
  const service = createExternalObjectIndexService({
    repository,
    cache,
    indexEngine,
    graphService: deps.graphService,
    config: deps.config,
  });

  // Create event handlers
  const eventHandlers = createEventHandlers(service, deps.eventPublisher);

  return {
    service,
    indexEngine,
    cache,
    repository,
    eventHandlers,
  };
}

/**
 * Create a test module with mock dependencies.
 * For use in unit tests.
 *
 * @param overrides - Optional component overrides
 * @returns Test module
 */
export function createTestExternalObjectIndexModule(overrides?: {
  repository?: ReturnType<typeof createExternalObjectRepository>;
  cache?: ReturnType<typeof createExternalObjectCache>;
  indexEngine?: ReturnType<typeof createIndexEngine>;
  graphService?: IGraphService;
}): ExternalObjectIndexModule {
  const indexEngine = overrides?.indexEngine ?? createIndexEngine();
  const cache = overrides?.cache ?? createExternalObjectCache({ enableL2: false });

  // Create mock repository if not provided
  const repository = overrides?.repository ?? ({
    saveEntries: async () => 0,
    findByExternalId: async () => [],
    findByNodeId: async () => [],
    deleteEntries: async () => 0,
    countEntries: async () => 0,
    countByType: async () => ({
      arn: 0,
      resource_id: 0,
      k8s_reference: 0,
      gcp_resource: 0,
      azure_resource: 0,
    }),
  } as ReturnType<typeof createExternalObjectRepository>);

  // Create mock graph service if not provided
  const graphService = overrides?.graphService ?? {
    getScanGraph: async () => null,
    getLatestScanForRepository: async () => null,
  };

  const service = createExternalObjectIndexService({
    repository,
    cache,
    indexEngine,
    graphService,
  });

  const eventHandlers = createEventHandlers(service);

  return {
    service,
    indexEngine,
    cache,
    repository,
    eventHandlers,
  };
}
