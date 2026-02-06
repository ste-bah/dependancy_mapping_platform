/**
 * Rollup Configuration Schema
 * @module config/rollup.config
 *
 * Zod schemas for validating rollup (cross-repository aggregation) configuration.
 * Provides type-safe configuration with compile-time type inference.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation
 */

import { z } from 'zod';
import pino from 'pino';
import {
  RollupConfig,
  PartialRollupConfig,
  MatchingStrategies,
  MatchingStrategy,
  RollupEnvVars,
} from './rollup.types.js';

const logger = pino({ name: 'rollup-config' });

// ============================================================================
// Schema Definitions
// ============================================================================

/**
 * Matching strategy enum schema
 */
export const MatchingStrategySchema = z.enum([
  'path',
  'content',
  'resource_type',
  'repository',
  'ast',
  'semantic',
]);

/**
 * Matching strategy configuration schema
 */
export const MatchingStrategyConfigSchema = z.object({
  /** Default matching strategy to use */
  defaultStrategy: MatchingStrategySchema.default('path'),
  /** Enable semantic matching (requires ML model) */
  enableSemanticMatching: z.coerce.boolean().default(false),
  /** Confidence threshold for semantic matches (0-1) */
  semanticConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.8),
  /** Maximum number of matchers per rollup */
  maxMatchersPerRollup: z.coerce.number().int().min(1).max(100).default(20),
  /** Enable caching of match results */
  enableMatchCaching: z.coerce.boolean().default(true),
});

/**
 * Execution timeout configuration schema
 */
export const ExecutionTimeoutConfigSchema = z.object({
  /** Total execution timeout in milliseconds (default: 5 minutes) */
  totalTimeoutMs: z.coerce.number().int().min(10000).max(3600000).default(300000),
  /** Per-repository scan timeout in milliseconds (default: 1 minute) */
  perRepositoryTimeoutMs: z.coerce.number().int().min(5000).max(600000).default(60000),
  /** Per-matcher execution timeout in milliseconds (default: 30 seconds) */
  perMatcherTimeoutMs: z.coerce.number().int().min(1000).max(120000).default(30000),
  /** Blast radius analysis timeout in milliseconds (default: 2 minutes) */
  blastRadiusTimeoutMs: z.coerce.number().int().min(5000).max(600000).default(120000),
});

/**
 * Batch processing configuration schema
 */
export const BatchConfigSchema = z.object({
  /** Maximum items per batch */
  batchSize: z.coerce.number().int().min(10).max(10000).default(1000),
  /** Maximum parallel batches */
  maxParallelBatches: z.coerce.number().int().min(1).max(20).default(4),
  /** Delay between batches in milliseconds */
  batchDelayMs: z.coerce.number().int().min(0).max(10000).default(100),
  /** Enable adaptive batch sizing */
  adaptiveBatchSizing: z.coerce.boolean().default(true),
});

/**
 * Rate limiting configuration schema
 */
export const RateLimitConfigSchema = z.object({
  /** Maximum requests per window */
  maxRequestsPerWindow: z.coerce.number().int().min(1).max(10000).default(100),
  /** Window duration in milliseconds (default: 1 minute) */
  windowMs: z.coerce.number().int().min(1000).max(3600000).default(60000),
  /** Maximum concurrent rollup executions */
  maxConcurrentRollups: z.coerce.number().int().min(1).max(100).default(10),
  /** Enable per-tenant rate limiting */
  perTenantLimiting: z.coerce.boolean().default(true),
  /** Burst allowance (additional requests allowed in burst) */
  burstAllowance: z.coerce.number().int().min(0).max(100).default(10),
});

/**
 * Cache configuration schema
 */
export const CacheConfigSchema = z.object({
  /** Enable result caching */
  enabled: z.coerce.boolean().default(true),
  /** Cache TTL in seconds (default: 1 hour) */
  ttlSeconds: z.coerce.number().int().min(60).max(86400).default(3600),
  /** Maximum cache entries */
  maxEntries: z.coerce.number().int().min(100).max(1000000).default(10000),
  /** Cache key prefix */
  keyPrefix: z.string().default('rollup:'),
  /** Enable stale-while-revalidate */
  staleWhileRevalidate: z.coerce.boolean().default(true),
  /** Stale TTL in seconds */
  staleTtlSeconds: z.coerce.number().int().min(60).max(86400).default(300),
});

/**
 * Queue configuration schema
 */
export const QueueConfigSchema = z.object({
  /** Queue name */
  queueName: z.string().default('rollup-execution'),
  /** Worker concurrency */
  concurrency: z.coerce.number().int().min(1).max(50).default(5),
  /** Job timeout in milliseconds (default: 10 minutes) */
  jobTimeoutMs: z.coerce.number().int().min(10000).max(3600000).default(600000),
  /** Maximum job attempts */
  maxAttempts: z.coerce.number().int().min(1).max(10).default(3),
  /** Backoff delay in milliseconds */
  backoffDelayMs: z.coerce.number().int().min(100).max(60000).default(5000),
  /** Backoff type */
  backoffType: z.enum(['fixed', 'exponential']).default('exponential'),
  /** Remove completed jobs after (count) */
  removeOnComplete: z.union([z.coerce.boolean(), z.coerce.number()]).default(100),
  /** Remove failed jobs after (count) */
  removeOnFail: z.union([z.coerce.boolean(), z.coerce.number()]).default(500),
});

/**
 * Retry policy configuration schema
 */
export const RetryPolicyConfigSchema = z.object({
  /** Maximum retry attempts */
  maxAttempts: z.coerce.number().int().min(0).max(10).default(3),
  /** Initial retry delay in milliseconds */
  initialDelayMs: z.coerce.number().int().min(100).max(30000).default(1000),
  /** Maximum retry delay in milliseconds */
  maxDelayMs: z.coerce.number().int().min(1000).max(300000).default(30000),
  /** Backoff multiplier */
  backoffMultiplier: z.coerce.number().min(1).max(10).default(2),
  /** Enable jitter */
  enableJitter: z.coerce.boolean().default(true),
  /** Retryable error codes */
  retryableErrors: z.array(z.string()).default([
    'NETWORK_ERROR',
    'CONNECTION_TIMEOUT',
    'SERVICE_UNAVAILABLE',
    'GATEWAY_TIMEOUT',
    'API_RATE_LIMITED',
  ]),
});

/**
 * Blast radius analysis configuration schema
 */
export const BlastRadiusConfigSchema = z.object({
  /** Enable blast radius analysis */
  enabled: z.coerce.boolean().default(true),
  /** Maximum traversal depth */
  maxDepth: z.coerce.number().int().min(1).max(50).default(10),
  /** Maximum nodes to analyze */
  maxNodes: z.coerce.number().int().min(100).max(100000).default(10000),
  /** Include indirect dependencies */
  includeIndirect: z.coerce.boolean().default(true),
  /** Timeout for analysis in milliseconds */
  timeoutMs: z.coerce.number().int().min(5000).max(600000).default(120000),
});

/**
 * Repository limits configuration schema
 */
export const RepositoryLimitsConfigSchema = z.object({
  /** Maximum repositories per rollup */
  maxRepositoriesPerRollup: z.coerce.number().int().min(1).max(100).default(10),
  /** Maximum total file size across all repos (bytes) - default 1GB */
  maxTotalFileSize: z.coerce.number().int().min(1024 * 1024).max(10 * 1024 * 1024 * 1024).default(1024 * 1024 * 1024),
  /** Maximum files per repository */
  maxFilesPerRepository: z.coerce.number().int().min(100).max(100000).default(10000),
  /** Allowed repository providers */
  allowedProviders: z.array(z.string()).default(['github', 'gitlab', 'bitbucket']),
});

/**
 * Complete rollup configuration schema
 */
export const RollupConfigSchema = z.object({
  /** Matching strategy configuration */
  matching: MatchingStrategyConfigSchema.default({}),
  /** Execution timeout configuration */
  timeouts: ExecutionTimeoutConfigSchema.default({}),
  /** Batch processing configuration */
  batch: BatchConfigSchema.default({}),
  /** Rate limiting configuration */
  rateLimit: RateLimitConfigSchema.default({}),
  /** Cache configuration */
  cache: CacheConfigSchema.default({}),
  /** Queue configuration */
  queue: QueueConfigSchema.default({}),
  /** Retry policy configuration */
  retry: RetryPolicyConfigSchema.default({}),
  /** Blast radius configuration */
  blastRadius: BlastRadiusConfigSchema.default({}),
  /** Repository limits configuration */
  repositoryLimits: RepositoryLimitsConfigSchema.default({}),
});

// ============================================================================
// Type Exports
// ============================================================================

export type RollupConfigSchemaType = z.infer<typeof RollupConfigSchema>;
export type MatchingStrategyConfigSchemaType = z.infer<typeof MatchingStrategyConfigSchema>;
export type ExecutionTimeoutConfigSchemaType = z.infer<typeof ExecutionTimeoutConfigSchema>;
export type BatchConfigSchemaType = z.infer<typeof BatchConfigSchema>;
export type RateLimitConfigSchemaType = z.infer<typeof RateLimitConfigSchema>;
export type CacheConfigSchemaType = z.infer<typeof CacheConfigSchema>;
export type QueueConfigSchemaType = z.infer<typeof QueueConfigSchema>;
export type RetryPolicyConfigSchemaType = z.infer<typeof RetryPolicyConfigSchema>;
export type BlastRadiusConfigSchemaType = z.infer<typeof BlastRadiusConfigSchema>;
export type RepositoryLimitsConfigSchemaType = z.infer<typeof RepositoryLimitsConfigSchema>;

// ============================================================================
// Environment Variable Loading
// ============================================================================

/**
 * Load rollup configuration from environment variables
 */
export function loadRollupConfigFromEnv(): PartialRollupConfig {
  const env = process.env;

  const config: PartialRollupConfig = {
    matching: filterUndefined({
      defaultStrategy: env[RollupEnvVars.DEFAULT_MATCHING_STRATEGY] as MatchingStrategy | undefined,
      enableSemanticMatching: env[RollupEnvVars.SEMANTIC_MATCHING_ENABLED]
        ? env[RollupEnvVars.SEMANTIC_MATCHING_ENABLED] === 'true'
        : undefined,
      semanticConfidenceThreshold: env[RollupEnvVars.SEMANTIC_CONFIDENCE_THRESHOLD]
        ? parseFloat(env[RollupEnvVars.SEMANTIC_CONFIDENCE_THRESHOLD])
        : undefined,
      maxMatchersPerRollup: env[RollupEnvVars.MAX_MATCHERS]
        ? parseInt(env[RollupEnvVars.MAX_MATCHERS], 10)
        : undefined,
    }),
    timeouts: filterUndefined({
      totalTimeoutMs: env[RollupEnvVars.EXECUTION_TIMEOUT_MS]
        ? parseInt(env[RollupEnvVars.EXECUTION_TIMEOUT_MS], 10)
        : undefined,
      perRepositoryTimeoutMs: env[RollupEnvVars.PER_REPO_TIMEOUT_MS]
        ? parseInt(env[RollupEnvVars.PER_REPO_TIMEOUT_MS], 10)
        : undefined,
      perMatcherTimeoutMs: env[RollupEnvVars.PER_MATCHER_TIMEOUT_MS]
        ? parseInt(env[RollupEnvVars.PER_MATCHER_TIMEOUT_MS], 10)
        : undefined,
    }),
    batch: filterUndefined({
      batchSize: env[RollupEnvVars.BATCH_SIZE]
        ? parseInt(env[RollupEnvVars.BATCH_SIZE], 10)
        : undefined,
      maxParallelBatches: env[RollupEnvVars.MAX_PARALLEL_BATCHES]
        ? parseInt(env[RollupEnvVars.MAX_PARALLEL_BATCHES], 10)
        : undefined,
      batchDelayMs: env[RollupEnvVars.BATCH_DELAY_MS]
        ? parseInt(env[RollupEnvVars.BATCH_DELAY_MS], 10)
        : undefined,
    }),
    rateLimit: filterUndefined({
      maxRequestsPerWindow: env[RollupEnvVars.RATE_LIMIT_MAX_REQUESTS]
        ? parseInt(env[RollupEnvVars.RATE_LIMIT_MAX_REQUESTS], 10)
        : undefined,
      windowMs: env[RollupEnvVars.RATE_LIMIT_WINDOW_MS]
        ? parseInt(env[RollupEnvVars.RATE_LIMIT_WINDOW_MS], 10)
        : undefined,
      maxConcurrentRollups: env[RollupEnvVars.MAX_CONCURRENT_ROLLUPS]
        ? parseInt(env[RollupEnvVars.MAX_CONCURRENT_ROLLUPS], 10)
        : undefined,
    }),
    cache: filterUndefined({
      enabled: env[RollupEnvVars.CACHE_ENABLED]
        ? env[RollupEnvVars.CACHE_ENABLED] === 'true'
        : undefined,
      ttlSeconds: env[RollupEnvVars.CACHE_TTL_SECONDS]
        ? parseInt(env[RollupEnvVars.CACHE_TTL_SECONDS], 10)
        : undefined,
      maxEntries: env[RollupEnvVars.CACHE_MAX_ENTRIES]
        ? parseInt(env[RollupEnvVars.CACHE_MAX_ENTRIES], 10)
        : undefined,
    }),
    queue: filterUndefined({
      concurrency: env[RollupEnvVars.QUEUE_CONCURRENCY]
        ? parseInt(env[RollupEnvVars.QUEUE_CONCURRENCY], 10)
        : undefined,
      jobTimeoutMs: env[RollupEnvVars.QUEUE_JOB_TIMEOUT_MS]
        ? parseInt(env[RollupEnvVars.QUEUE_JOB_TIMEOUT_MS], 10)
        : undefined,
    }),
    retry: filterUndefined({
      maxAttempts: env[RollupEnvVars.RETRY_MAX_ATTEMPTS]
        ? parseInt(env[RollupEnvVars.RETRY_MAX_ATTEMPTS], 10)
        : undefined,
      initialDelayMs: env[RollupEnvVars.RETRY_INITIAL_DELAY_MS]
        ? parseInt(env[RollupEnvVars.RETRY_INITIAL_DELAY_MS], 10)
        : undefined,
      maxDelayMs: env[RollupEnvVars.RETRY_MAX_DELAY_MS]
        ? parseInt(env[RollupEnvVars.RETRY_MAX_DELAY_MS], 10)
        : undefined,
    }),
    blastRadius: filterUndefined({
      enabled: env[RollupEnvVars.BLAST_RADIUS_ENABLED]
        ? env[RollupEnvVars.BLAST_RADIUS_ENABLED] === 'true'
        : undefined,
      maxDepth: env[RollupEnvVars.BLAST_RADIUS_MAX_DEPTH]
        ? parseInt(env[RollupEnvVars.BLAST_RADIUS_MAX_DEPTH], 10)
        : undefined,
      maxNodes: env[RollupEnvVars.BLAST_RADIUS_MAX_NODES]
        ? parseInt(env[RollupEnvVars.BLAST_RADIUS_MAX_NODES], 10)
        : undefined,
    }),
    repositoryLimits: filterUndefined({
      maxRepositoriesPerRollup: env[RollupEnvVars.MAX_REPOSITORIES]
        ? parseInt(env[RollupEnvVars.MAX_REPOSITORIES], 10)
        : undefined,
    }),
  };

  return filterUndefined(config);
}

/**
 * Filter out undefined values from an object
 */
function filterUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        const filtered = filterUndefined(value as Record<string, unknown>);
        if (Object.keys(filtered).length > 0) {
          result[key] = filtered;
        }
      } else {
        result[key] = value;
      }
    }
  }

  return result as Partial<T>;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validation error for rollup configuration
 */
export class RollupConfigValidationError extends Error {
  public readonly errors: z.ZodError;
  public readonly configSection?: string;

  constructor(zodError: z.ZodError, configSection?: string) {
    const formattedErrors = zodError.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    const prefix = configSection ? `Rollup ${configSection} configuration` : 'Rollup configuration';
    super(`${prefix} validation failed:\n${
      formattedErrors.map(e => `  - ${e.path}: ${e.message}`).join('\n')
    }`);

    this.name = 'RollupConfigValidationError';
    this.errors = zodError;
    this.configSection = configSection;
  }
}

/**
 * Validate rollup configuration
 */
export function validateRollupConfig(config: unknown): RollupConfig {
  const result = RollupConfigSchema.safeParse(config);

  if (!result.success) {
    logger.error({ errors: result.error.errors }, 'Rollup configuration validation failed');
    throw new RollupConfigValidationError(result.error);
  }

  return result.data;
}

/**
 * Validate partial rollup configuration (for overrides)
 */
export function validatePartialRollupConfig(config: unknown): PartialRollupConfig {
  const partialSchema = RollupConfigSchema.deepPartial();
  const result = partialSchema.safeParse(config);

  if (!result.success) {
    logger.error({ errors: result.error.errors }, 'Partial rollup configuration validation failed');
    throw new RollupConfigValidationError(result.error);
  }

  return result.data as PartialRollupConfig;
}

/**
 * Check if rollup configuration is valid
 */
export function isValidRollupConfig(config: unknown): config is RollupConfig {
  const result = RollupConfigSchema.safeParse(config);
  return result.success;
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Get default rollup configuration
 */
export function getDefaultRollupConfig(): RollupConfig {
  return RollupConfigSchema.parse({});
}

/**
 * Merge rollup configurations (deep merge, later configs override earlier)
 */
export function mergeRollupConfigs(...configs: PartialRollupConfig[]): RollupConfig {
  const merged: Record<string, unknown> = {};

  for (const config of configs) {
    deepMerge(merged, config);
  }

  return validateRollupConfig(merged);
}

/**
 * Deep merge two objects
 */
function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (sourceValue === undefined) {
      continue;
    }

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      target[key] = sourceValue;
    }
  }
}

// ============================================================================
// Environment-specific Defaults
// ============================================================================

/**
 * Get environment-specific rollup configuration defaults
 */
export function getRollupEnvironmentDefaults(env: string): PartialRollupConfig {
  const defaults: Record<string, PartialRollupConfig> = {
    development: {
      timeouts: {
        totalTimeoutMs: 600000, // 10 minutes for development
      },
      cache: {
        enabled: false, // Disable caching in development for easier debugging
        ttlSeconds: 60,
      },
      rateLimit: {
        maxRequestsPerWindow: 1000, // Higher limits in development
        maxConcurrentRollups: 50,
      },
    },
    test: {
      timeouts: {
        totalTimeoutMs: 30000, // Short timeouts for tests
        perRepositoryTimeoutMs: 10000,
        perMatcherTimeoutMs: 5000,
      },
      cache: {
        enabled: false,
      },
      queue: {
        concurrency: 1, // Sequential processing in tests
      },
      rateLimit: {
        maxRequestsPerWindow: 10000,
        maxConcurrentRollups: 100,
      },
    },
    staging: {
      // Use mostly defaults, with some relaxed limits for testing
      rateLimit: {
        maxConcurrentRollups: 20,
      },
      cache: {
        ttlSeconds: 1800, // 30 minutes
      },
    },
    production: {
      // Strict production settings
      timeouts: {
        totalTimeoutMs: 300000, // 5 minutes max
      },
      cache: {
        enabled: true,
        ttlSeconds: 3600,
        staleWhileRevalidate: true,
      },
      rateLimit: {
        perTenantLimiting: true,
        maxConcurrentRollups: 10,
      },
      retry: {
        maxAttempts: 3,
        enableJitter: true,
      },
    },
  };

  return defaults[env] ?? defaults.development;
}

// ============================================================================
// Configuration Summary
// ============================================================================

/**
 * Get a human-readable summary of rollup configuration
 */
export function getRollupConfigSummary(config: RollupConfig): string {
  return [
    'Rollup Configuration Summary:',
    `  Max Repositories: ${config.repositoryLimits.maxRepositoriesPerRollup}`,
    `  Max Matchers: ${config.matching.maxMatchersPerRollup}`,
    `  Total Timeout: ${config.timeouts.totalTimeoutMs}ms`,
    `  Batch Size: ${config.batch.batchSize}`,
    `  Cache TTL: ${config.cache.ttlSeconds}s (${config.cache.enabled ? 'enabled' : 'disabled'})`,
    `  Queue Concurrency: ${config.queue.concurrency}`,
    `  Retry Attempts: ${config.retry.maxAttempts}`,
    `  Blast Radius: depth=${config.blastRadius.maxDepth} (${config.blastRadius.enabled ? 'enabled' : 'disabled'})`,
  ].join('\n');
}
