/**
 * External Object Index Configuration
 * @module services/rollup/external-object-index/config
 *
 * TypeBox-based configuration schema and loader for the External Object Index system.
 * Provides type-safe configuration with environment variable mapping and validation.
 *
 * Features:
 * - Two-tier cache configuration (L1 in-memory, L2 Redis)
 * - Performance tuning for NFR-PERF-008 (100K nodes < 500ms)
 * - Batch processing and concurrency settings
 * - Extraction type filtering and confidence thresholds
 *
 * TASK-ROLLUP-003: External Object Index configuration management
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import { Type, Static } from '@sinclair/typebox';
import { Value } from '@sinclair/typebox/value';
import pino from 'pino';

const logger = pino({ name: 'external-index-config' });

// ============================================================================
// Environment Variable Names
// ============================================================================

/**
 * Environment variable names for External Object Index configuration
 */
export const ExternalIndexEnvVars = {
  // Cache L1 (In-Memory) Configuration
  CACHE_L1_MAX_ENTRIES: 'EXTERNAL_INDEX_CACHE_L1_MAX_ENTRIES',
  CACHE_L1_TTL_MS: 'EXTERNAL_INDEX_CACHE_L1_TTL_MS',

  // Cache L2 (Redis) Configuration
  CACHE_L2_TTL_MS: 'EXTERNAL_INDEX_CACHE_L2_TTL_MS',
  CACHE_L2_PREFIX: 'EXTERNAL_INDEX_CACHE_L2_PREFIX',

  // Indexing Configuration
  BATCH_SIZE: 'EXTERNAL_INDEX_BATCH_SIZE',
  MAX_CONCURRENT_BUILDS: 'EXTERNAL_INDEX_MAX_CONCURRENT_BUILDS',
  BUILD_TIMEOUT_MS: 'EXTERNAL_INDEX_BUILD_TIMEOUT_MS',

  // Performance Configuration
  LOOKUP_TIMEOUT_MS: 'EXTERNAL_INDEX_LOOKUP_TIMEOUT_MS',
  REVERSE_LOOKUP_TIMEOUT_MS: 'EXTERNAL_INDEX_REVERSE_LOOKUP_TIMEOUT_MS',
  MAX_BATCH_LOOKUP_SIZE: 'EXTERNAL_INDEX_MAX_BATCH_LOOKUP_SIZE',

  // Extraction Configuration
  ENABLED_TYPES: 'EXTERNAL_INDEX_ENABLED_TYPES',
  MAX_REFERENCES_PER_NODE: 'EXTERNAL_INDEX_MAX_REFERENCES_PER_NODE',
  CONFIDENCE_THRESHOLD: 'EXTERNAL_INDEX_CONFIDENCE_THRESHOLD',
} as const;

// ============================================================================
// Configuration Schema Definitions
// ============================================================================

/**
 * L1 (In-Memory) Cache Configuration Schema
 */
export const L1CacheConfigSchema = Type.Object({
  /** Maximum number of entries in L1 cache */
  maxEntries: Type.Number({
    minimum: 100,
    maximum: 100000,
    default: 10000,
    description: 'Maximum entries in L1 (in-memory) cache',
  }),
  /** Time-to-live for L1 cache entries in milliseconds */
  ttlMs: Type.Number({
    minimum: 1000,
    maximum: 3600000,
    default: 300000, // 5 minutes
    description: 'TTL for L1 cache entries (ms)',
  }),
});

export type L1CacheConfig = Static<typeof L1CacheConfigSchema>;

/**
 * L2 (Redis/Distributed) Cache Configuration Schema
 */
export const L2CacheConfigSchema = Type.Object({
  /** Time-to-live for L2 cache entries in milliseconds */
  ttlMs: Type.Number({
    minimum: 60000,
    maximum: 86400000,
    default: 3600000, // 1 hour
    description: 'TTL for L2 cache entries (ms)',
  }),
  /** Cache key prefix for namespacing */
  prefix: Type.String({
    default: 'ext-idx:',
    description: 'Redis key prefix for external index cache',
  }),
});

export type L2CacheConfig = Static<typeof L2CacheConfigSchema>;

/**
 * Combined Cache Configuration Schema
 */
export const CacheConfigSchema = Type.Object({
  /** L1 (in-memory) cache configuration */
  l1: L1CacheConfigSchema,
  /** L2 (Redis/distributed) cache configuration */
  l2: L2CacheConfigSchema,
});

export type CacheConfig = Static<typeof CacheConfigSchema>;

/**
 * Indexing Configuration Schema
 */
export const IndexingConfigSchema = Type.Object({
  /** Batch size for processing nodes during index build */
  batchSize: Type.Number({
    minimum: 100,
    maximum: 5000,
    default: 1000,
    description: 'Number of nodes to process per batch',
  }),
  /** Maximum concurrent index build operations */
  maxConcurrentBuilds: Type.Number({
    minimum: 1,
    maximum: 10,
    default: 3,
    description: 'Maximum concurrent index builds',
  }),
  /** Timeout for a single index build operation in milliseconds */
  buildTimeoutMs: Type.Number({
    minimum: 60000,
    maximum: 1800000,
    default: 300000, // 5 minutes
    description: 'Index build timeout (ms)',
  }),
});

export type IndexingConfig = Static<typeof IndexingConfigSchema>;

/**
 * Performance Configuration Schema
 * Optimized for NFR-PERF-008: 100K nodes < 500ms benchmark target
 */
export const PerformanceConfigSchema = Type.Object({
  /** Timeout for single lookup operations in milliseconds
   * NFR-PERF-008 requires < 100ms for single lookups
   */
  lookupTimeoutMs: Type.Number({
    minimum: 10,
    maximum: 1000,
    default: 100,
    description: 'Single lookup timeout (ms) - NFR-PERF-008 target',
  }),
  /** Timeout for reverse lookup operations in milliseconds */
  reverseLookupTimeoutMs: Type.Number({
    minimum: 100,
    maximum: 5000,
    default: 500,
    description: 'Reverse lookup timeout (ms)',
  }),
  /** Maximum number of items in a batch lookup request */
  maxBatchLookupSize: Type.Number({
    minimum: 10,
    maximum: 1000,
    default: 100,
    description: 'Maximum items per batch lookup',
  }),
});

export type PerformanceConfig = Static<typeof PerformanceConfigSchema>;

/**
 * Extraction Configuration Schema
 */
export const ExtractionConfigSchema = Type.Object({
  /** Types of external references to extract and index */
  enabledTypes: Type.Array(Type.String(), {
    default: ['arn', 'container_image', 'cloud_resource_id', 'helm_chart', 'git_url'],
    description: 'External reference types to extract',
  }),
  /** Maximum number of external references to extract per node */
  maxReferencesPerNode: Type.Number({
    minimum: 10,
    maximum: 500,
    default: 100,
    description: 'Maximum references per node',
  }),
  /** Minimum confidence score for including a reference (0-1) */
  confidenceThreshold: Type.Number({
    minimum: 0,
    maximum: 1,
    default: 0.5,
    description: 'Minimum extraction confidence (0-1)',
  }),
});

export type ExtractionConfig = Static<typeof ExtractionConfigSchema>;

/**
 * Complete External Object Index Configuration Schema
 */
export const ExternalIndexConfigSchema = Type.Object({
  /** Cache configuration (L1 and L2) */
  cache: CacheConfigSchema,
  /** Indexing configuration */
  indexing: IndexingConfigSchema,
  /** Performance configuration */
  performance: PerformanceConfigSchema,
  /** Extraction configuration */
  extraction: ExtractionConfigSchema,
});

export type ExternalIndexConfig = Static<typeof ExternalIndexConfigSchema>;

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default External Object Index configuration values
 * Optimized for production performance targets
 */
export const DEFAULT_EXTERNAL_INDEX_CONFIG: ExternalIndexConfig = {
  cache: {
    l1: {
      maxEntries: 10000,
      ttlMs: 300000, // 5 minutes
    },
    l2: {
      ttlMs: 3600000, // 1 hour
      prefix: 'ext-idx:',
    },
  },
  indexing: {
    batchSize: 1000,
    maxConcurrentBuilds: 3,
    buildTimeoutMs: 300000, // 5 minutes
  },
  performance: {
    lookupTimeoutMs: 100, // NFR-PERF-008 target
    reverseLookupTimeoutMs: 500,
    maxBatchLookupSize: 100,
  },
  extraction: {
    enabledTypes: ['arn', 'container_image', 'cloud_resource_id', 'helm_chart', 'git_url'],
    maxReferencesPerNode: 100,
    confidenceThreshold: 0.5,
  },
};

// ============================================================================
// Environment-Specific Defaults
// ============================================================================

/**
 * Get environment-specific configuration defaults
 */
export function getEnvironmentDefaults(env: string): Partial<ExternalIndexConfig> {
  const defaults: Record<string, Partial<ExternalIndexConfig>> = {
    development: {
      cache: {
        l1: { maxEntries: 1000, ttlMs: 60000 }, // Smaller cache, shorter TTL
        l2: { ttlMs: 300000, prefix: 'ext-idx-dev:' },
      },
      indexing: {
        batchSize: 500, // Smaller batches for easier debugging
        maxConcurrentBuilds: 2,
        buildTimeoutMs: 600000, // Longer timeout for debugging
      },
      performance: {
        lookupTimeoutMs: 500, // Relaxed for development
        reverseLookupTimeoutMs: 2000,
        maxBatchLookupSize: 50,
      },
    },
    test: {
      cache: {
        l1: { maxEntries: 100, ttlMs: 10000 },
        l2: { ttlMs: 30000, prefix: 'ext-idx-test:' },
      },
      indexing: {
        batchSize: 100, // Small batches for fast tests
        maxConcurrentBuilds: 1,
        buildTimeoutMs: 30000, // Short timeout for tests
      },
      performance: {
        lookupTimeoutMs: 1000, // Relaxed for test reliability
        reverseLookupTimeoutMs: 5000,
        maxBatchLookupSize: 20,
      },
    },
    staging: {
      cache: {
        l1: { maxEntries: 5000, ttlMs: 180000 },
        l2: { ttlMs: 1800000, prefix: 'ext-idx-stage:' },
      },
      indexing: {
        batchSize: 800,
        maxConcurrentBuilds: 2,
        buildTimeoutMs: 300000,
      },
    },
    production: {
      // Use defaults (already optimized for production)
    },
  };

  return defaults[env] ?? {};
}

// ============================================================================
// Configuration Loader
// ============================================================================

/**
 * Configuration validation error for External Object Index
 */
export class ExternalIndexConfigError extends Error {
  public readonly configErrors: Array<{ path: string; message: string }>;

  constructor(errors: Array<{ path: string; message: string }>) {
    const message = `External Index configuration validation failed:\n${
      errors.map(e => `  - ${e.path}: ${e.message}`).join('\n')
    }`;
    super(message);
    this.name = 'ExternalIndexConfigError';
    this.configErrors = errors;
  }
}

/**
 * Parse comma-separated string to array
 */
function parseCommaSeparatedList(value: string | undefined, defaultValue: string[]): string[] {
  if (!value || value.trim() === '') {
    return defaultValue;
  }
  return value.split(',').map(s => s.trim()).filter(s => s.length > 0);
}

/**
 * Safe integer parsing with default
 */
function parseIntOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Safe float parsing with default
 */
function parseFloatOrDefault(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Load External Object Index configuration from environment variables
 *
 * @returns Raw configuration object (not yet validated)
 *
 * @example
 * ```typescript
 * const config = loadExternalIndexConfig();
 * console.log(config.cache.l1.maxEntries); // 10000
 * ```
 */
export function loadExternalIndexConfig(): ExternalIndexConfig {
  const env = process.env;
  const defaults = DEFAULT_EXTERNAL_INDEX_CONFIG;

  // Load raw configuration from environment
  const raw: ExternalIndexConfig = {
    cache: {
      l1: {
        maxEntries: parseIntOrDefault(
          env[ExternalIndexEnvVars.CACHE_L1_MAX_ENTRIES],
          defaults.cache.l1.maxEntries
        ),
        ttlMs: parseIntOrDefault(
          env[ExternalIndexEnvVars.CACHE_L1_TTL_MS],
          defaults.cache.l1.ttlMs
        ),
      },
      l2: {
        ttlMs: parseIntOrDefault(
          env[ExternalIndexEnvVars.CACHE_L2_TTL_MS],
          defaults.cache.l2.ttlMs
        ),
        prefix: env[ExternalIndexEnvVars.CACHE_L2_PREFIX] ?? defaults.cache.l2.prefix,
      },
    },
    indexing: {
      batchSize: parseIntOrDefault(
        env[ExternalIndexEnvVars.BATCH_SIZE],
        defaults.indexing.batchSize
      ),
      maxConcurrentBuilds: parseIntOrDefault(
        env[ExternalIndexEnvVars.MAX_CONCURRENT_BUILDS],
        defaults.indexing.maxConcurrentBuilds
      ),
      buildTimeoutMs: parseIntOrDefault(
        env[ExternalIndexEnvVars.BUILD_TIMEOUT_MS],
        defaults.indexing.buildTimeoutMs
      ),
    },
    performance: {
      lookupTimeoutMs: parseIntOrDefault(
        env[ExternalIndexEnvVars.LOOKUP_TIMEOUT_MS],
        defaults.performance.lookupTimeoutMs
      ),
      reverseLookupTimeoutMs: parseIntOrDefault(
        env[ExternalIndexEnvVars.REVERSE_LOOKUP_TIMEOUT_MS],
        defaults.performance.reverseLookupTimeoutMs
      ),
      maxBatchLookupSize: parseIntOrDefault(
        env[ExternalIndexEnvVars.MAX_BATCH_LOOKUP_SIZE],
        defaults.performance.maxBatchLookupSize
      ),
    },
    extraction: {
      enabledTypes: parseCommaSeparatedList(
        env[ExternalIndexEnvVars.ENABLED_TYPES],
        defaults.extraction.enabledTypes
      ),
      maxReferencesPerNode: parseIntOrDefault(
        env[ExternalIndexEnvVars.MAX_REFERENCES_PER_NODE],
        defaults.extraction.maxReferencesPerNode
      ),
      confidenceThreshold: parseFloatOrDefault(
        env[ExternalIndexEnvVars.CONFIDENCE_THRESHOLD],
        defaults.extraction.confidenceThreshold
      ),
    },
  };

  // Validate against schema
  if (!Value.Check(ExternalIndexConfigSchema, raw)) {
    const errors = [...Value.Errors(ExternalIndexConfigSchema, raw)].map(error => ({
      path: error.path,
      message: error.message,
    }));
    logger.error({ errors }, 'External Index configuration validation failed');
    throw new ExternalIndexConfigError(errors);
  }

  return raw;
}

/**
 * Load configuration with environment-specific defaults merged
 *
 * @param nodeEnv - Environment name (defaults to NODE_ENV)
 * @returns Merged configuration
 */
export function loadExternalIndexConfigWithDefaults(nodeEnv?: string): ExternalIndexConfig {
  const env = nodeEnv ?? process.env.NODE_ENV ?? 'development';
  const envDefaults = getEnvironmentDefaults(env);
  const loadedConfig = loadExternalIndexConfig();

  // Deep merge: envDefaults -> loadedConfig (loaded takes precedence)
  return deepMergeConfig(
    deepMergeConfig(DEFAULT_EXTERNAL_INDEX_CONFIG, envDefaults),
    loadedConfig
  );
}

/**
 * Deep merge two configuration objects
 */
function deepMergeConfig<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key as keyof T];
    const targetValue = result[key as keyof T];

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
      (result as Record<string, unknown>)[key] = deepMergeConfig(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else {
      (result as Record<string, unknown>)[key] = sourceValue;
    }
  }

  return result;
}

// ============================================================================
// Validation Utilities
// ============================================================================

/**
 * Validate an External Index configuration object
 *
 * @param config - Configuration to validate
 * @returns Validated configuration
 * @throws ExternalIndexConfigError if validation fails
 */
export function validateExternalIndexConfig(config: unknown): ExternalIndexConfig {
  if (!Value.Check(ExternalIndexConfigSchema, config)) {
    const errors = [...Value.Errors(ExternalIndexConfigSchema, config)].map(error => ({
      path: error.path,
      message: error.message,
    }));
    throw new ExternalIndexConfigError(errors);
  }
  return config;
}

/**
 * Check if a configuration object is valid
 *
 * @param config - Configuration to check
 * @returns True if valid, false otherwise
 */
export function isValidExternalIndexConfig(config: unknown): config is ExternalIndexConfig {
  return Value.Check(ExternalIndexConfigSchema, config);
}

/**
 * Get validation errors for a configuration object
 *
 * @param config - Configuration to validate
 * @returns Array of validation errors (empty if valid)
 */
export function getConfigValidationErrors(
  config: unknown
): Array<{ path: string; message: string }> {
  if (Value.Check(ExternalIndexConfigSchema, config)) {
    return [];
  }
  return [...Value.Errors(ExternalIndexConfigSchema, config)].map(error => ({
    path: error.path,
    message: error.message,
  }));
}

// ============================================================================
// Singleton Configuration Instance
// ============================================================================

/**
 * Singleton configuration instance
 */
let configInstance: ExternalIndexConfig | null = null;

/**
 * Get the External Index configuration singleton
 * Initializes from environment on first call
 *
 * @returns Configuration instance
 */
export function getExternalIndexConfig(): ExternalIndexConfig {
  if (!configInstance) {
    configInstance = loadExternalIndexConfigWithDefaults();
    logger.info(
      {
        cacheL1MaxEntries: configInstance.cache.l1.maxEntries,
        lookupTimeoutMs: configInstance.performance.lookupTimeoutMs,
        batchSize: configInstance.indexing.batchSize,
        enabledTypes: configInstance.extraction.enabledTypes,
      },
      'External Index configuration loaded'
    );
  }
  return configInstance;
}

/**
 * Reset the configuration singleton (for testing)
 */
export function resetExternalIndexConfig(): void {
  configInstance = null;
  logger.debug('External Index configuration reset');
}

/**
 * Override the configuration singleton (for testing)
 *
 * @param config - Configuration to use
 */
export function setExternalIndexConfig(config: ExternalIndexConfig): void {
  if (!isValidExternalIndexConfig(config)) {
    throw new ExternalIndexConfigError(getConfigValidationErrors(config));
  }
  configInstance = config;
  logger.debug('External Index configuration overridden');
}

// ============================================================================
// Configuration Summary
// ============================================================================

/**
 * Get a human-readable summary of the configuration
 *
 * @param config - Configuration to summarize (defaults to current)
 * @returns Multi-line summary string
 */
export function getExternalIndexConfigSummary(
  config: ExternalIndexConfig = getExternalIndexConfig()
): string {
  return [
    'External Object Index Configuration:',
    '  Cache:',
    `    L1: ${config.cache.l1.maxEntries} entries, TTL ${config.cache.l1.ttlMs}ms`,
    `    L2: TTL ${config.cache.l2.ttlMs}ms, prefix "${config.cache.l2.prefix}"`,
    '  Indexing:',
    `    Batch size: ${config.indexing.batchSize}`,
    `    Max concurrent builds: ${config.indexing.maxConcurrentBuilds}`,
    `    Build timeout: ${config.indexing.buildTimeoutMs}ms`,
    '  Performance:',
    `    Lookup timeout: ${config.performance.lookupTimeoutMs}ms (NFR-PERF-008)`,
    `    Reverse lookup timeout: ${config.performance.reverseLookupTimeoutMs}ms`,
    `    Max batch lookup size: ${config.performance.maxBatchLookupSize}`,
    '  Extraction:',
    `    Enabled types: ${config.extraction.enabledTypes.join(', ')}`,
    `    Max refs per node: ${config.extraction.maxReferencesPerNode}`,
    `    Confidence threshold: ${config.extraction.confidenceThreshold}`,
  ].join('\n');
}

// ============================================================================
// Typed Accessors
// ============================================================================

/**
 * Get cache configuration
 */
export function getCacheConfig(): CacheConfig {
  return getExternalIndexConfig().cache;
}

/**
 * Get L1 cache configuration
 */
export function getL1CacheConfig(): L1CacheConfig {
  return getExternalIndexConfig().cache.l1;
}

/**
 * Get L2 cache configuration
 */
export function getL2CacheConfig(): L2CacheConfig {
  return getExternalIndexConfig().cache.l2;
}

/**
 * Get indexing configuration
 */
export function getIndexingConfig(): IndexingConfig {
  return getExternalIndexConfig().indexing;
}

/**
 * Get performance configuration
 */
export function getPerformanceConfig(): PerformanceConfig {
  return getExternalIndexConfig().performance;
}

/**
 * Get extraction configuration
 */
export function getExtractionConfig(): ExtractionConfig {
  return getExternalIndexConfig().extraction;
}

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a test configuration with custom overrides
 *
 * @param overrides - Configuration overrides
 * @returns Merged test configuration
 */
export function createTestConfig(
  overrides: Partial<{
    cache: Partial<CacheConfig>;
    indexing: Partial<IndexingConfig>;
    performance: Partial<PerformanceConfig>;
    extraction: Partial<ExtractionConfig>;
  }> = {}
): ExternalIndexConfig {
  const testDefaults = getEnvironmentDefaults('test');
  const base = deepMergeConfig(DEFAULT_EXTERNAL_INDEX_CONFIG, testDefaults);

  return deepMergeConfig(base, overrides as Partial<ExternalIndexConfig>);
}
