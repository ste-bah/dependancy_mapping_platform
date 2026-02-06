/**
 * Rollup Cache Configuration
 * @module services/rollup/rollup-cache/config
 *
 * Configuration management for the Rollup Cache system.
 * Provides type-safe configuration with Zod validation,
 * environment variable overrides, and sensible defaults.
 *
 * Configuration Hierarchy:
 * 1. Default values (development-friendly)
 * 2. Environment-specific defaults
 * 3. Environment variable overrides
 * 4. Programmatic overrides
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 */

import { z } from 'zod';
import pino from 'pino';
import { CacheVersion } from './interfaces.js';

// ============================================================================
// Logger
// ============================================================================

const logger = pino({ name: 'rollup-cache-config' });

// ============================================================================
// Environment Variable Names
// ============================================================================

/**
 * Environment variable names for rollup cache configuration
 */
export const RollupCacheEnvVars = {
  // L1 (In-Memory) Cache Settings
  L1_ENABLED: 'ROLLUP_CACHE_L1_ENABLED',
  L1_MAX_ENTRIES: 'ROLLUP_CACHE_L1_MAX_ENTRIES',
  L1_TTL_SECONDS: 'ROLLUP_CACHE_L1_TTL_SECONDS',

  // L2 (Redis) Cache Settings
  L2_ENABLED: 'ROLLUP_CACHE_L2_ENABLED',
  L2_REDIS_HOST: 'ROLLUP_CACHE_REDIS_HOST',
  L2_REDIS_PORT: 'ROLLUP_CACHE_REDIS_PORT',
  L2_REDIS_PASSWORD: 'ROLLUP_CACHE_REDIS_PASSWORD',
  L2_REDIS_DB: 'ROLLUP_CACHE_REDIS_DB',
  L2_KEY_PREFIX: 'ROLLUP_CACHE_KEY_PREFIX',
  L2_TTL_SECONDS: 'ROLLUP_CACHE_L2_TTL_SECONDS',

  // Invalidation Settings
  INVALIDATION_ENABLED: 'ROLLUP_CACHE_INVALIDATION_ENABLED',
  INVALIDATION_PUBSUB_CHANNEL: 'ROLLUP_CACHE_PUBSUB_CHANNEL',
  INVALIDATION_TAG_TTL_MULTIPLIER: 'ROLLUP_CACHE_TAG_TTL_MULTIPLIER',

  // Warming Settings
  WARMING_ENABLED: 'ROLLUP_CACHE_WARMING_ENABLED',
  WARMING_QUEUE_NAME: 'ROLLUP_CACHE_WARMING_QUEUE',
  WARMING_CONCURRENCY: 'ROLLUP_CACHE_WARMING_CONCURRENCY',

  // General Settings
  CACHE_VERSION: 'ROLLUP_CACHE_VERSION',
  ENABLE_LOGGING: 'ROLLUP_CACHE_ENABLE_LOGGING',
  ENABLE_METRICS: 'ROLLUP_CACHE_ENABLE_METRICS',
} as const;

export type RollupCacheEnvVar = typeof RollupCacheEnvVars[keyof typeof RollupCacheEnvVars];

// ============================================================================
// Zod Schemas
// ============================================================================

/**
 * L1 (In-Memory) cache configuration schema
 */
export const L1ConfigSchema = z.object({
  /** Whether L1 cache is enabled */
  enabled: z.coerce.boolean().default(true),
  /** Maximum entries in L1 cache */
  maxEntries: z.coerce.number().int().min(100).max(100000).default(1000),
  /** TTL in seconds for L1 entries */
  ttlSeconds: z.coerce.number().int().min(10).max(3600).default(300),
});

/**
 * Redis connection configuration schema
 */
export const RedisConfigSchema = z.object({
  /** Redis host */
  host: z.string().default('localhost'),
  /** Redis port */
  port: z.coerce.number().int().min(1).max(65535).default(6379),
  /** Redis password (optional) */
  password: z.string().optional(),
  /** Redis database number */
  db: z.coerce.number().int().min(0).max(15).default(0),
  /** Key prefix for all cache keys */
  keyPrefix: z.string().default('rollup-cache'),
});

/**
 * L2 (Redis) cache configuration schema
 */
export const L2ConfigSchema = z.object({
  /** Whether L2 cache is enabled */
  enabled: z.coerce.boolean().default(true),
  /** Redis connection configuration */
  redis: RedisConfigSchema.default({}),
  /** Default TTL in seconds for L2 entries */
  defaultTtlSeconds: z.coerce.number().int().min(60).max(86400).default(3600),
});

/**
 * Cache invalidation configuration schema
 */
export const InvalidationConfigSchema = z.object({
  /** Whether cache invalidation is enabled */
  enabled: z.coerce.boolean().default(true),
  /** Pub/Sub channel for invalidation messages */
  pubSubChannel: z.string().default('rollup-cache:invalidate'),
  /** Tag TTL multiplier (tags live longer than entries) */
  tagTtlMultiplier: z.coerce.number().min(1).max(10).default(2),
});

/**
 * Cache warming configuration schema
 */
export const WarmingConfigSchema = z.object({
  /** Whether cache warming is enabled */
  enabled: z.coerce.boolean().default(false),
  /** Queue name for warming jobs */
  queueName: z.string().default('rollup-cache:warming'),
  /** Number of concurrent warming operations */
  concurrency: z.coerce.number().int().min(1).max(20).default(5),
});

/**
 * Cache version schema
 */
export const CacheVersionSchema = z.enum(['v1', 'v2']).default('v1');

/**
 * Complete rollup cache configuration schema
 */
export const RollupCacheConfigSchema = z.object({
  /** L1 (in-memory) cache configuration */
  l1: L1ConfigSchema.default({}),
  /** L2 (Redis) cache configuration */
  l2: L2ConfigSchema.default({}),
  /** Cache invalidation configuration */
  invalidation: InvalidationConfigSchema.default({}),
  /** Cache warming configuration */
  warming: WarmingConfigSchema.default({}),
  /** Cache version for key namespacing */
  version: CacheVersionSchema,
  /** Enable cache operation logging */
  enableLogging: z.coerce.boolean().default(true),
  /** Enable detailed metrics collection */
  enableMetrics: z.coerce.boolean().default(true),
});

// ============================================================================
// Type Exports
// ============================================================================

export type L1Config = z.infer<typeof L1ConfigSchema>;
export type RedisConfig = z.infer<typeof RedisConfigSchema>;
export type L2Config = z.infer<typeof L2ConfigSchema>;
export type InvalidationConfig = z.infer<typeof InvalidationConfigSchema>;
export type WarmingConfig = z.infer<typeof WarmingConfigSchema>;
export type RollupCacheConfig = z.infer<typeof RollupCacheConfigSchema>;
export type PartialRollupCacheConfig = z.input<typeof RollupCacheConfigSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default rollup cache configuration (development-friendly)
 */
export const DEFAULT_CONFIG: RollupCacheConfig = {
  l1: {
    enabled: true,
    maxEntries: 1000,
    ttlSeconds: 300, // 5 minutes
  },
  l2: {
    enabled: true,
    redis: {
      host: 'localhost',
      port: 6379,
      password: undefined,
      db: 0,
      keyPrefix: 'rollup-cache',
    },
    defaultTtlSeconds: 3600, // 1 hour
  },
  invalidation: {
    enabled: true,
    pubSubChannel: 'rollup-cache:invalidate',
    tagTtlMultiplier: 2,
  },
  warming: {
    enabled: false,
    queueName: 'rollup-cache:warming',
    concurrency: 5,
  },
  version: 'v1',
  enableLogging: true,
  enableMetrics: true,
};

// ============================================================================
// Environment Variable Loading
// ============================================================================

/**
 * Safely parse an integer from an environment variable value
 */
function safeParseInt(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Safely parse a float from an environment variable value
 */
function safeParseFloat(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? undefined : parsed;
}

/**
 * Load rollup cache configuration from environment variables
 */
export function loadConfigFromEnv(): PartialRollupCacheConfig {
  const env = process.env;

  const config: PartialRollupCacheConfig = {
    l1: filterUndefined({
      enabled: env[RollupCacheEnvVars.L1_ENABLED]
        ? env[RollupCacheEnvVars.L1_ENABLED] === 'true'
        : undefined,
      maxEntries: safeParseInt(env[RollupCacheEnvVars.L1_MAX_ENTRIES]),
      ttlSeconds: safeParseInt(env[RollupCacheEnvVars.L1_TTL_SECONDS]),
    }),
    l2: filterUndefined({
      enabled: env[RollupCacheEnvVars.L2_ENABLED]
        ? env[RollupCacheEnvVars.L2_ENABLED] === 'true'
        : undefined,
      redis: filterUndefined({
        host: env[RollupCacheEnvVars.L2_REDIS_HOST],
        port: safeParseInt(env[RollupCacheEnvVars.L2_REDIS_PORT]),
        password: env[RollupCacheEnvVars.L2_REDIS_PASSWORD],
        db: safeParseInt(env[RollupCacheEnvVars.L2_REDIS_DB]),
        keyPrefix: env[RollupCacheEnvVars.L2_KEY_PREFIX],
      }),
      defaultTtlSeconds: safeParseInt(env[RollupCacheEnvVars.L2_TTL_SECONDS]),
    }),
    invalidation: filterUndefined({
      enabled: env[RollupCacheEnvVars.INVALIDATION_ENABLED]
        ? env[RollupCacheEnvVars.INVALIDATION_ENABLED] === 'true'
        : undefined,
      pubSubChannel: env[RollupCacheEnvVars.INVALIDATION_PUBSUB_CHANNEL],
      tagTtlMultiplier: safeParseFloat(env[RollupCacheEnvVars.INVALIDATION_TAG_TTL_MULTIPLIER]),
    }),
    warming: filterUndefined({
      enabled: env[RollupCacheEnvVars.WARMING_ENABLED]
        ? env[RollupCacheEnvVars.WARMING_ENABLED] === 'true'
        : undefined,
      queueName: env[RollupCacheEnvVars.WARMING_QUEUE_NAME],
      concurrency: safeParseInt(env[RollupCacheEnvVars.WARMING_CONCURRENCY]),
    }),
    version: env[RollupCacheEnvVars.CACHE_VERSION] as CacheVersion | undefined,
    enableLogging: env[RollupCacheEnvVars.ENABLE_LOGGING]
      ? env[RollupCacheEnvVars.ENABLE_LOGGING] === 'true'
      : undefined,
    enableMetrics: env[RollupCacheEnvVars.ENABLE_METRICS]
      ? env[RollupCacheEnvVars.ENABLE_METRICS] === 'true'
      : undefined,
  };

  return filterUndefined(config);
}

// ============================================================================
// Environment-Specific Defaults
// ============================================================================

/**
 * Get environment-specific configuration defaults
 */
export function getEnvironmentDefaults(env: string): PartialRollupCacheConfig {
  const defaults: Record<string, PartialRollupCacheConfig> = {
    development: {
      l1: {
        maxEntries: 500,
        ttlSeconds: 60, // Short TTL for development
      },
      l2: {
        enabled: false, // Disable Redis by default in development
      },
      enableLogging: true,
      enableMetrics: false,
    },
    test: {
      l1: {
        maxEntries: 100,
        ttlSeconds: 30,
      },
      l2: {
        enabled: false, // Disable Redis in tests by default
      },
      invalidation: {
        enabled: false,
      },
      warming: {
        enabled: false,
      },
      enableLogging: false,
      enableMetrics: false,
    },
    staging: {
      l1: {
        maxEntries: 2000,
        ttlSeconds: 300,
      },
      l2: {
        defaultTtlSeconds: 1800, // 30 minutes in staging
      },
      enableLogging: true,
      enableMetrics: true,
    },
    production: {
      l1: {
        maxEntries: 5000,
        ttlSeconds: 300,
      },
      l2: {
        defaultTtlSeconds: 3600, // 1 hour in production
      },
      invalidation: {
        enabled: true,
        tagTtlMultiplier: 2,
      },
      warming: {
        enabled: true,
        concurrency: 10,
      },
      enableLogging: false, // Reduce log noise in production
      enableMetrics: true,
    },
  };

  return (defaults[env] ?? defaults.development) as PartialRollupCacheConfig;
}

// ============================================================================
// Validation
// ============================================================================

/**
 * Configuration validation error
 */
export class RollupCacheConfigValidationError extends Error {
  public readonly errors: z.ZodError;
  public readonly configSection?: string;

  constructor(zodError: z.ZodError, configSection?: string) {
    const formattedErrors = zodError.errors.map(e => ({
      path: e.path.join('.'),
      message: e.message,
    }));

    const prefix = configSection
      ? `Rollup cache ${configSection} configuration`
      : 'Rollup cache configuration';
    super(
      `${prefix} validation failed:\n${formattedErrors.map(e => `  - ${e.path}: ${e.message}`).join('\n')}`
    );

    this.name = 'RollupCacheConfigValidationError';
    this.errors = zodError;
    // Use conditional assignment for optional property (exactOptionalPropertyTypes)
    if (configSection !== undefined) {
      this.configSection = configSection;
    }
  }
}

/**
 * Validate rollup cache configuration
 */
export function validateConfig(config: unknown): RollupCacheConfig {
  const result = RollupCacheConfigSchema.safeParse(config);

  if (!result.success) {
    logger.error({ errors: result.error.errors }, 'Rollup cache configuration validation failed');
    throw new RollupCacheConfigValidationError(result.error);
  }

  return result.data;
}

/**
 * Validate partial rollup cache configuration
 */
export function validatePartialConfig(config: unknown): PartialRollupCacheConfig {
  const partialSchema = RollupCacheConfigSchema.deepPartial();
  const result = partialSchema.safeParse(config);

  if (!result.success) {
    logger.error({ errors: result.error.errors }, 'Partial rollup cache configuration validation failed');
    throw new RollupCacheConfigValidationError(result.error);
  }

  return result.data as PartialRollupCacheConfig;
}

/**
 * Check if configuration is valid
 */
export function isValidConfig(config: unknown): config is RollupCacheConfig {
  const result = RollupCacheConfigSchema.safeParse(config);
  return result.success;
}

// ============================================================================
// Configuration Merging
// ============================================================================

/**
 * Deep merge configurations (later configs override earlier)
 */
export function mergeConfigs(...configs: PartialRollupCacheConfig[]): RollupCacheConfig {
  const merged: Record<string, unknown> = {};

  for (const config of configs) {
    deepMerge(merged, config);
  }

  return validateConfig(merged);
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): void {
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
// Factory Functions
// ============================================================================

/**
 * Create rollup cache configuration with all sources merged
 *
 * Merge order (later overrides earlier):
 * 1. Default configuration
 * 2. Environment-specific defaults
 * 3. Environment variable overrides
 * 4. Programmatic overrides
 *
 * @param overrides - Optional programmatic configuration overrides
 * @param environment - Optional environment name (defaults to NODE_ENV)
 * @returns Validated, merged configuration
 */
export function createConfig(
  overrides?: PartialRollupCacheConfig,
  environment?: string
): RollupCacheConfig {
  const env = environment ?? process.env.NODE_ENV ?? 'development';

  const config = mergeConfigs(
    DEFAULT_CONFIG,
    getEnvironmentDefaults(env),
    loadConfigFromEnv(),
    overrides ?? {}
  );

  logger.info(
    {
      environment: env,
      l1Enabled: config.l1.enabled,
      l1MaxEntries: config.l1.maxEntries,
      l2Enabled: config.l2.enabled,
      l2Host: config.l2.redis.host,
      version: config.version,
    },
    'Rollup cache configuration created'
  );

  return config;
}

/**
 * Create configuration for testing
 * Provides minimal, fast configuration suitable for unit tests
 */
export function createTestConfig(overrides?: PartialRollupCacheConfig): RollupCacheConfig {
  return mergeConfigs(
    DEFAULT_CONFIG,
    getEnvironmentDefaults('test'),
    overrides ?? {}
  );
}

// ============================================================================
// Configuration Singleton
// ============================================================================

let configInstance: RollupCacheConfig | null = null;

/**
 * Get the rollup cache configuration singleton
 * Creates the configuration on first access
 */
export function getConfig(): RollupCacheConfig {
  if (!configInstance) {
    configInstance = createConfig();
  }
  return configInstance;
}

/**
 * Reset the configuration singleton
 * Useful for testing or configuration reload
 */
export function resetConfig(): void {
  configInstance = null;
  logger.debug('Rollup cache configuration reset');
}

/**
 * Initialize configuration with specific overrides
 * Should be called early in application startup
 */
export function initConfig(overrides?: PartialRollupCacheConfig): RollupCacheConfig {
  if (configInstance) {
    logger.warn('Configuration already initialized, returning existing config');
    return configInstance;
  }

  configInstance = createConfig(overrides);
  return configInstance;
}

// ============================================================================
// Configuration Summary
// ============================================================================

/**
 * Get a human-readable summary of the configuration
 */
export function getConfigSummary(config: RollupCacheConfig): string {
  return [
    'Rollup Cache Configuration Summary:',
    `  Version: ${config.version}`,
    `  L1 Cache: ${config.l1.enabled ? 'enabled' : 'disabled'}`,
    `    Max Entries: ${config.l1.maxEntries}`,
    `    TTL: ${config.l1.ttlSeconds}s`,
    `  L2 Cache: ${config.l2.enabled ? 'enabled' : 'disabled'}`,
    `    Redis: ${config.l2.redis.host}:${config.l2.redis.port}`,
    `    Key Prefix: ${config.l2.redis.keyPrefix}`,
    `    Default TTL: ${config.l2.defaultTtlSeconds}s`,
    `  Invalidation: ${config.invalidation.enabled ? 'enabled' : 'disabled'}`,
    `    Pub/Sub Channel: ${config.invalidation.pubSubChannel}`,
    `    Tag TTL Multiplier: ${config.invalidation.tagTtlMultiplier}x`,
    `  Warming: ${config.warming.enabled ? 'enabled' : 'disabled'}`,
    `    Queue: ${config.warming.queueName}`,
    `    Concurrency: ${config.warming.concurrency}`,
    `  Logging: ${config.enableLogging ? 'enabled' : 'disabled'}`,
    `  Metrics: ${config.enableMetrics ? 'enabled' : 'disabled'}`,
  ].join('\n');
}
