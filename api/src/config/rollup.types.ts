/**
 * Rollup Configuration Types
 * @module config/rollup.types
 *
 * TypeScript interfaces and types for the cross-repository aggregation
 * (rollup) feature configuration.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation
 */

// ============================================================================
// Matching Strategy Types
// ============================================================================

/**
 * Available matching strategies for rollup rules
 */
export const MatchingStrategies = {
  /** Match by file path patterns */
  PATH: 'path',
  /** Match by file content patterns */
  CONTENT: 'content',
  /** Match by IaC resource type */
  RESOURCE_TYPE: 'resource_type',
  /** Match by repository metadata */
  REPOSITORY: 'repository',
  /** Custom AST-based matching */
  AST: 'ast',
  /** Semantic matching using embeddings */
  SEMANTIC: 'semantic',
} as const;

export type MatchingStrategy = typeof MatchingStrategies[keyof typeof MatchingStrategies];

/**
 * Priority levels for rollup rules
 */
export const RollupPriorities = {
  /** Lowest priority - processed last */
  LOW: 1,
  /** Normal priority */
  NORMAL: 5,
  /** High priority - processed first */
  HIGH: 10,
  /** Critical priority - always processed first */
  CRITICAL: 100,
} as const;

export type RollupPriority = typeof RollupPriorities[keyof typeof RollupPriorities];

// ============================================================================
// Configuration Interfaces
// ============================================================================

/**
 * Matching strategy configuration
 */
export interface MatchingStrategyConfig {
  /** Default matching strategy to use */
  defaultStrategy: MatchingStrategy;
  /** Enable semantic matching (requires ML model) */
  enableSemanticMatching: boolean;
  /** Confidence threshold for semantic matches (0-1) */
  semanticConfidenceThreshold: number;
  /** Maximum number of matchers per rollup */
  maxMatchersPerRollup: number;
  /** Enable caching of match results */
  enableMatchCaching: boolean;
}

/**
 * Execution timeout configuration
 */
export interface ExecutionTimeoutConfig {
  /** Total execution timeout in milliseconds */
  totalTimeoutMs: number;
  /** Per-repository scan timeout in milliseconds */
  perRepositoryTimeoutMs: number;
  /** Per-matcher execution timeout in milliseconds */
  perMatcherTimeoutMs: number;
  /** Blast radius analysis timeout in milliseconds */
  blastRadiusTimeoutMs: number;
}

/**
 * Batch processing configuration
 */
export interface BatchConfig {
  /** Maximum items per batch */
  batchSize: number;
  /** Maximum parallel batches */
  maxParallelBatches: number;
  /** Delay between batches in milliseconds */
  batchDelayMs: number;
  /** Enable adaptive batch sizing */
  adaptiveBatchSizing: boolean;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequestsPerWindow: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Maximum concurrent rollup executions */
  maxConcurrentRollups: number;
  /** Enable per-tenant rate limiting */
  perTenantLimiting: boolean;
  /** Burst allowance (additional requests allowed in burst) */
  burstAllowance: number;
}

/**
 * Cache configuration
 */
export interface CacheConfig {
  /** Enable result caching */
  enabled: boolean;
  /** Cache TTL in seconds */
  ttlSeconds: number;
  /** Maximum cache entries */
  maxEntries: number;
  /** Cache key prefix */
  keyPrefix: string;
  /** Enable stale-while-revalidate */
  staleWhileRevalidate: boolean;
  /** Stale TTL in seconds */
  staleTtlSeconds: number;
}

/**
 * Queue configuration for async processing
 */
export interface QueueConfig {
  /** Queue name */
  queueName: string;
  /** Worker concurrency */
  concurrency: number;
  /** Job timeout in milliseconds */
  jobTimeoutMs: number;
  /** Maximum job attempts */
  maxAttempts: number;
  /** Backoff delay in milliseconds */
  backoffDelayMs: number;
  /** Backoff type */
  backoffType: 'fixed' | 'exponential';
  /** Remove completed jobs after (count or boolean) */
  removeOnComplete: number | boolean;
  /** Remove failed jobs after (count or boolean) */
  removeOnFail: number | boolean;
}

/**
 * Retry policy configuration
 */
export interface RetryPolicyConfig {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Initial retry delay in milliseconds */
  initialDelayMs: number;
  /** Maximum retry delay in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Enable jitter */
  enableJitter: boolean;
  /** Retryable error codes */
  retryableErrors: string[];
}

/**
 * Blast radius analysis configuration
 */
export interface BlastRadiusConfig {
  /** Enable blast radius analysis */
  enabled: boolean;
  /** Maximum traversal depth */
  maxDepth: number;
  /** Maximum nodes to analyze */
  maxNodes: number;
  /** Include indirect dependencies */
  includeIndirect: boolean;
  /** Timeout for analysis in milliseconds */
  timeoutMs: number;
}

/**
 * Repository limits configuration
 */
export interface RepositoryLimitsConfig {
  /** Maximum repositories per rollup */
  maxRepositoriesPerRollup: number;
  /** Maximum total file size across all repos (bytes) */
  maxTotalFileSize: number;
  /** Maximum files per repository */
  maxFilesPerRepository: number;
  /** Allowed repository providers */
  allowedProviders: string[];
}

/**
 * Complete rollup configuration
 */
export interface RollupConfig {
  /** Matching strategy configuration */
  matching: MatchingStrategyConfig;
  /** Execution timeout configuration */
  timeouts: ExecutionTimeoutConfig;
  /** Batch processing configuration */
  batch: BatchConfig;
  /** Rate limiting configuration */
  rateLimit: RateLimitConfig;
  /** Cache configuration */
  cache: CacheConfig;
  /** Queue configuration */
  queue: QueueConfig;
  /** Retry policy configuration */
  retry: RetryPolicyConfig;
  /** Blast radius configuration */
  blastRadius: BlastRadiusConfig;
  /** Repository limits configuration */
  repositoryLimits: RepositoryLimitsConfig;
}

// ============================================================================
// Configuration Builder Utilities
// ============================================================================

/**
 * Deep partial type for configuration overrides
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Partial rollup configuration for overrides
 */
export type PartialRollupConfig = DeepPartial<RollupConfig>;

/**
 * Configuration builder for creating rollup configs
 */
export class RollupConfigBuilder {
  private config: PartialRollupConfig = {};

  /**
   * Set matching strategy configuration
   */
  withMatching(config: Partial<MatchingStrategyConfig>): this {
    this.config.matching = { ...this.config.matching, ...config };
    return this;
  }

  /**
   * Set timeout configuration
   */
  withTimeouts(config: Partial<ExecutionTimeoutConfig>): this {
    this.config.timeouts = { ...this.config.timeouts, ...config };
    return this;
  }

  /**
   * Set batch configuration
   */
  withBatch(config: Partial<BatchConfig>): this {
    this.config.batch = { ...this.config.batch, ...config };
    return this;
  }

  /**
   * Set rate limit configuration
   */
  withRateLimit(config: Partial<RateLimitConfig>): this {
    this.config.rateLimit = { ...this.config.rateLimit, ...config };
    return this;
  }

  /**
   * Set cache configuration
   */
  withCache(config: Partial<CacheConfig>): this {
    this.config.cache = { ...this.config.cache, ...config };
    return this;
  }

  /**
   * Set queue configuration
   */
  withQueue(config: Partial<QueueConfig>): this {
    this.config.queue = { ...this.config.queue, ...config };
    return this;
  }

  /**
   * Set retry policy configuration
   */
  withRetry(config: Partial<RetryPolicyConfig>): this {
    this.config.retry = { ...this.config.retry, ...config };
    return this;
  }

  /**
   * Set blast radius configuration
   */
  withBlastRadius(config: Partial<BlastRadiusConfig>): this {
    this.config.blastRadius = { ...this.config.blastRadius, ...config };
    return this;
  }

  /**
   * Set repository limits configuration
   */
  withRepositoryLimits(config: Partial<RepositoryLimitsConfig>): this {
    this.config.repositoryLimits = { ...this.config.repositoryLimits, ...config };
    return this;
  }

  /**
   * Build the partial configuration
   */
  build(): PartialRollupConfig {
    return this.config;
  }
}

/**
 * Create a new rollup configuration builder
 */
export function createRollupConfigBuilder(): RollupConfigBuilder {
  return new RollupConfigBuilder();
}

// ============================================================================
// Environment Variable Mapping
// ============================================================================

/**
 * Environment variable names for rollup configuration
 */
export const RollupEnvVars = {
  // Repository limits
  MAX_REPOSITORIES: 'ROLLUP_MAX_REPOSITORIES',
  MAX_MATCHERS: 'ROLLUP_MAX_MATCHERS',

  // Timeouts
  EXECUTION_TIMEOUT_MS: 'ROLLUP_EXECUTION_TIMEOUT_MS',
  PER_REPO_TIMEOUT_MS: 'ROLLUP_PER_REPO_TIMEOUT_MS',
  PER_MATCHER_TIMEOUT_MS: 'ROLLUP_PER_MATCHER_TIMEOUT_MS',

  // Batch processing
  BATCH_SIZE: 'ROLLUP_BATCH_SIZE',
  MAX_PARALLEL_BATCHES: 'ROLLUP_MAX_PARALLEL_BATCHES',
  BATCH_DELAY_MS: 'ROLLUP_BATCH_DELAY_MS',

  // Cache
  CACHE_TTL_SECONDS: 'ROLLUP_CACHE_TTL_SECONDS',
  CACHE_MAX_ENTRIES: 'ROLLUP_CACHE_MAX_ENTRIES',
  CACHE_ENABLED: 'ROLLUP_CACHE_ENABLED',

  // Queue
  QUEUE_CONCURRENCY: 'ROLLUP_QUEUE_CONCURRENCY',
  QUEUE_JOB_TIMEOUT_MS: 'ROLLUP_QUEUE_JOB_TIMEOUT_MS',

  // Retry
  RETRY_MAX_ATTEMPTS: 'ROLLUP_RETRY_MAX_ATTEMPTS',
  RETRY_INITIAL_DELAY_MS: 'ROLLUP_RETRY_INITIAL_DELAY_MS',
  RETRY_MAX_DELAY_MS: 'ROLLUP_RETRY_MAX_DELAY_MS',

  // Rate limiting
  RATE_LIMIT_MAX_REQUESTS: 'ROLLUP_RATE_LIMIT_MAX_REQUESTS',
  RATE_LIMIT_WINDOW_MS: 'ROLLUP_RATE_LIMIT_WINDOW_MS',
  MAX_CONCURRENT_ROLLUPS: 'ROLLUP_MAX_CONCURRENT_ROLLUPS',

  // Blast radius
  BLAST_RADIUS_MAX_DEPTH: 'ROLLUP_BLAST_RADIUS_MAX_DEPTH',
  BLAST_RADIUS_MAX_NODES: 'ROLLUP_BLAST_RADIUS_MAX_NODES',
  BLAST_RADIUS_ENABLED: 'ROLLUP_BLAST_RADIUS_ENABLED',

  // Matching
  DEFAULT_MATCHING_STRATEGY: 'ROLLUP_DEFAULT_MATCHING_STRATEGY',
  SEMANTIC_MATCHING_ENABLED: 'ROLLUP_SEMANTIC_MATCHING_ENABLED',
  SEMANTIC_CONFIDENCE_THRESHOLD: 'ROLLUP_SEMANTIC_CONFIDENCE_THRESHOLD',
} as const;

export type RollupEnvVar = typeof RollupEnvVars[keyof typeof RollupEnvVars];
