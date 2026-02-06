/**
 * Rollup Cache Module
 * @module services/rollup/rollup-cache
 *
 * Tiered caching system for expensive rollup computations.
 * Provides L1 (in-memory LRU) and L2 (Redis) caching with
 * read-through access and tag-based invalidation.
 *
 * Features:
 * - Execution result caching
 * - Merged graph caching
 * - Blast radius calculation caching
 * - Tag-based cache invalidation
 * - Tenant isolation
 * - Graceful degradation
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

// ============================================================================
// Interfaces
// ============================================================================

export {
  // Types
  type CacheKey,
  type CacheTag,
  type CacheVersion,
  type CacheEntryType,
  type ParsedCacheKey,
  type CacheEntryMetadata,
  type CacheEntrySource,
  type CachedExecutionResult,
  type CachedMergedGraph,
  type CachedBlastRadius,
  type CacheStats,
  type IRollupCacheConfig,
  type ICacheKeyBuilder,
  type IRollupCache,
  type RollupCacheErrorCode,

  // Constants
  RollupCacheErrorCodes,
  DEFAULT_ROLLUP_CACHE_CONFIG,

  // Factory functions
  createCacheKey,
  createCacheTag,
  createCacheEntryMetadata,
  createEmptyCacheStats,

  // Type guards
  isCachedExecutionResult,
  isCachedMergedGraph,
  isCachedBlastRadius,
  isCacheEntryValid,
} from './interfaces.js';

// ============================================================================
// Cache Key Builder
// ============================================================================

export {
  CacheKeyBuilder,
  createCacheKeyBuilder,
  getDefaultCacheKeyBuilder,
  resetDefaultCacheKeyBuilder,
} from './cache-key-builder.js';

// ============================================================================
// Rollup Cache
// ============================================================================

export {
  RollupCache,
  createRollupCache,
  getDefaultRollupCache,
  resetDefaultRollupCache,
  type RollupCacheDependencies,
} from './rollup-cache.js';

// ============================================================================
// Errors
// ============================================================================

export {
  RollupCacheError,
  RollupCacheErrorSeverity,
  RollupCacheErrorRetryable,
  RollupCacheErrorHttpStatus,
  RollupCacheErrorMessage,
  isRollupCacheError,
  isRetryableCacheError,
  allowsCacheFallback,
  wrapAsCacheError,
  type RollupCacheErrorContext,
} from './errors.js';

// ============================================================================
// Configuration
// ============================================================================

export {
  // Types
  type L1Config,
  type RedisConfig,
  type L2Config,
  type InvalidationConfig,
  type WarmingConfig,
  type RollupCacheConfig,
  type PartialRollupCacheConfig,
  type RollupCacheEnvVar,

  // Constants
  RollupCacheEnvVars,
  DEFAULT_CONFIG,

  // Schemas
  L1ConfigSchema,
  RedisConfigSchema,
  L2ConfigSchema,
  InvalidationConfigSchema,
  WarmingConfigSchema,
  CacheVersionSchema,
  RollupCacheConfigSchema,

  // Factory functions
  createConfig,
  createTestConfig,
  loadConfigFromEnv,
  getEnvironmentDefaults,

  // Singleton management
  getConfig,
  resetConfig,
  initConfig,

  // Validation
  validateConfig,
  validatePartialConfig,
  isValidConfig,
  mergeConfigs,
  RollupCacheConfigValidationError,

  // Utilities
  getConfigSummary,
} from './config.js';

// ============================================================================
// Cache Invalidation Service
// ============================================================================

export {
  CacheInvalidationService,
  createCacheInvalidationService,
  getDefaultCacheInvalidationService,
  resetDefaultCacheInvalidationService,
  DEFAULT_CACHE_INVALIDATION_CONFIG,
  type ICacheInvalidationService,
  type InvalidationEvent,
  type InvalidationListener,
  type CacheInvalidationServiceConfig,
  type CacheInvalidationServiceDependencies,
} from './cache-invalidation-service.js';

// ============================================================================
// Cache Warming Processor
// ============================================================================

export {
  // Implementation
  CacheWarmingProcessor,
  createCacheWarmingProcessor,
  getDefaultCacheWarmingProcessor,
  initializeDefaultCacheWarmingProcessor,
  resetDefaultCacheWarmingProcessor,

  // Types
  type ICacheWarmingProcessor,
  type ICacheWarmingDataProvider,
  type CacheWarmingJobData,
  type CacheWarmingJobStatus,
  type CacheWarmingResult,
  type WarmingError,
  type CacheWarmingProcessorConfig,
  type CacheWarmingProcessorDependencies,

  // Constants
  CacheWarmingTargetType,
  WarmingPriority,
  CacheWarmingJobState,
  DEFAULT_CACHE_WARMING_CONFIG,
  CACHE_WARMING_JOB_OPTIONS,
  CACHE_WARMING_QUEUE_NAME,
  CACHE_WARMING_JOB_TYPE,
} from './cache-warming-processor.js';
