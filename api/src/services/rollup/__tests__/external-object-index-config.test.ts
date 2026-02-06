/**
 * External Object Index Configuration Tests
 * @module services/rollup/__tests__/external-object-index-config.test
 *
 * Tests for the External Object Index configuration module.
 *
 * TASK-ROLLUP-003: External Object Index configuration management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  // Schemas
  ExternalIndexConfigSchema,
  L1CacheConfigSchema,
  L2CacheConfigSchema,
  CacheConfigSchema,
  IndexingConfigSchema,
  PerformanceConfigSchema,
  ExtractionConfigSchema,

  // Types
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

  // Loaders
  loadExternalIndexConfig,
  loadExternalIndexConfigWithDefaults,
  getEnvironmentDefaults,

  // Singleton
  getExternalIndexConfig,
  resetExternalIndexConfig,
  setExternalIndexConfig,

  // Section accessors (these use the internal names from config.ts)
  getCacheConfig,
  getL1CacheConfig,
  getL2CacheConfig,
  getIndexingConfig,
  getPerformanceConfig,
  getExtractionConfig,

  // Validation
  validateExternalIndexConfig,
  isValidExternalIndexConfig,
  getConfigValidationErrors,
  ExternalIndexConfigError,

  // Summary
  getExternalIndexConfigSummary,

  // Test helpers
  createTestConfig,
} from '../external-object-index/config.js';
import { Value } from '@sinclair/typebox/value';

describe('ExternalObjectIndex Config', () => {
  // Store original env
  const originalEnv = { ...process.env };

  beforeEach(() => {
    // Reset config singleton before each test
    resetExternalIndexConfig();
    // Restore original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Cleanup
    resetExternalIndexConfig();
    process.env = originalEnv;
  });

  describe('Schema Validation', () => {
    it('should validate default configuration against schema', () => {
      const isValid = Value.Check(ExternalIndexConfigSchema, DEFAULT_EXTERNAL_INDEX_CONFIG);
      expect(isValid).toBe(true);
    });

    it('should validate L1 cache config with minimum values', () => {
      const config: L1CacheConfig = {
        maxEntries: 100,
        ttlMs: 1000,
      };
      expect(Value.Check(L1CacheConfigSchema, config)).toBe(true);
    });

    it('should validate L1 cache config with maximum values', () => {
      const config: L1CacheConfig = {
        maxEntries: 100000,
        ttlMs: 3600000,
      };
      expect(Value.Check(L1CacheConfigSchema, config)).toBe(true);
    });

    it('should reject L1 cache config below minimum', () => {
      const config = {
        maxEntries: 50, // below minimum of 100
        ttlMs: 500, // below minimum of 1000
      };
      expect(Value.Check(L1CacheConfigSchema, config)).toBe(false);
    });

    it('should reject L1 cache config above maximum', () => {
      const config = {
        maxEntries: 150000, // above maximum of 100000
        ttlMs: 4000000, // above maximum of 3600000
      };
      expect(Value.Check(L1CacheConfigSchema, config)).toBe(false);
    });

    it('should validate performance config for NFR-PERF-008 target', () => {
      const config: PerformanceConfig = {
        lookupTimeoutMs: 100, // NFR-PERF-008 target
        reverseLookupTimeoutMs: 500,
        maxBatchLookupSize: 100,
      };
      expect(Value.Check(PerformanceConfigSchema, config)).toBe(true);
    });

    it('should validate extraction config with enabled types', () => {
      const config: ExtractionConfig = {
        enabledTypes: ['arn', 'container_image', 'git_url'],
        maxReferencesPerNode: 100,
        confidenceThreshold: 0.7,
      };
      expect(Value.Check(ExtractionConfigSchema, config)).toBe(true);
    });

    it('should reject confidence threshold above 1', () => {
      const config = {
        enabledTypes: ['arn'],
        maxReferencesPerNode: 100,
        confidenceThreshold: 1.5, // above maximum of 1
      };
      expect(Value.Check(ExtractionConfigSchema, config)).toBe(false);
    });
  });

  describe('Default Configuration', () => {
    it('should have correct default L1 cache settings', () => {
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.cache.l1.maxEntries).toBe(10000);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.cache.l1.ttlMs).toBe(300000);
    });

    it('should have correct default L2 cache settings', () => {
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.cache.l2.ttlMs).toBe(3600000);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.cache.l2.prefix).toBe('ext-idx:');
    });

    it('should have correct default indexing settings', () => {
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.indexing.batchSize).toBe(1000);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.indexing.maxConcurrentBuilds).toBe(3);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.indexing.buildTimeoutMs).toBe(300000);
    });

    it('should have correct default performance settings for NFR-PERF-008', () => {
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.performance.lookupTimeoutMs).toBe(100);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.performance.reverseLookupTimeoutMs).toBe(500);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.performance.maxBatchLookupSize).toBe(100);
    });

    it('should have correct default extraction settings', () => {
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.extraction.enabledTypes).toContain('arn');
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.extraction.enabledTypes).toContain('container_image');
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.extraction.maxReferencesPerNode).toBe(100);
      expect(DEFAULT_EXTERNAL_INDEX_CONFIG.extraction.confidenceThreshold).toBe(0.5);
    });
  });

  describe('Environment Variable Names', () => {
    it('should have all expected environment variable names', () => {
      expect(ExternalIndexEnvVars.CACHE_L1_MAX_ENTRIES).toBe('EXTERNAL_INDEX_CACHE_L1_MAX_ENTRIES');
      expect(ExternalIndexEnvVars.CACHE_L1_TTL_MS).toBe('EXTERNAL_INDEX_CACHE_L1_TTL_MS');
      expect(ExternalIndexEnvVars.CACHE_L2_TTL_MS).toBe('EXTERNAL_INDEX_CACHE_L2_TTL_MS');
      expect(ExternalIndexEnvVars.CACHE_L2_PREFIX).toBe('EXTERNAL_INDEX_CACHE_L2_PREFIX');
      expect(ExternalIndexEnvVars.BATCH_SIZE).toBe('EXTERNAL_INDEX_BATCH_SIZE');
      expect(ExternalIndexEnvVars.MAX_CONCURRENT_BUILDS).toBe('EXTERNAL_INDEX_MAX_CONCURRENT_BUILDS');
      expect(ExternalIndexEnvVars.BUILD_TIMEOUT_MS).toBe('EXTERNAL_INDEX_BUILD_TIMEOUT_MS');
      expect(ExternalIndexEnvVars.LOOKUP_TIMEOUT_MS).toBe('EXTERNAL_INDEX_LOOKUP_TIMEOUT_MS');
      expect(ExternalIndexEnvVars.REVERSE_LOOKUP_TIMEOUT_MS).toBe('EXTERNAL_INDEX_REVERSE_LOOKUP_TIMEOUT_MS');
      expect(ExternalIndexEnvVars.MAX_BATCH_LOOKUP_SIZE).toBe('EXTERNAL_INDEX_MAX_BATCH_LOOKUP_SIZE');
      expect(ExternalIndexEnvVars.ENABLED_TYPES).toBe('EXTERNAL_INDEX_ENABLED_TYPES');
      expect(ExternalIndexEnvVars.MAX_REFERENCES_PER_NODE).toBe('EXTERNAL_INDEX_MAX_REFERENCES_PER_NODE');
      expect(ExternalIndexEnvVars.CONFIDENCE_THRESHOLD).toBe('EXTERNAL_INDEX_CONFIDENCE_THRESHOLD');
    });
  });

  describe('Environment-Specific Defaults', () => {
    it('should return development defaults', () => {
      const devDefaults = getEnvironmentDefaults('development');
      expect(devDefaults.cache?.l1?.maxEntries).toBe(1000);
      expect(devDefaults.performance?.lookupTimeoutMs).toBe(500);
    });

    it('should return test defaults', () => {
      const testDefaults = getEnvironmentDefaults('test');
      expect(testDefaults.cache?.l1?.maxEntries).toBe(100);
      expect(testDefaults.indexing?.batchSize).toBe(100);
      expect(testDefaults.indexing?.maxConcurrentBuilds).toBe(1);
    });

    it('should return staging defaults', () => {
      const stagingDefaults = getEnvironmentDefaults('staging');
      expect(stagingDefaults.cache?.l1?.maxEntries).toBe(5000);
      expect(stagingDefaults.cache?.l2?.prefix).toBe('ext-idx-stage:');
    });

    it('should return empty object for production (uses defaults)', () => {
      const prodDefaults = getEnvironmentDefaults('production');
      expect(Object.keys(prodDefaults).length).toBe(0);
    });

    it('should return empty object for unknown environment', () => {
      const unknownDefaults = getEnvironmentDefaults('unknown');
      expect(Object.keys(unknownDefaults).length).toBe(0);
    });
  });

  describe('Configuration Loading from Environment', () => {
    it('should load config from environment variables', () => {
      process.env[ExternalIndexEnvVars.CACHE_L1_MAX_ENTRIES] = '5000';
      process.env[ExternalIndexEnvVars.CACHE_L1_TTL_MS] = '120000';
      process.env[ExternalIndexEnvVars.LOOKUP_TIMEOUT_MS] = '50';
      process.env[ExternalIndexEnvVars.ENABLED_TYPES] = 'arn,git_url';
      process.env[ExternalIndexEnvVars.CONFIDENCE_THRESHOLD] = '0.8';

      const config = loadExternalIndexConfig();

      expect(config.cache.l1.maxEntries).toBe(5000);
      expect(config.cache.l1.ttlMs).toBe(120000);
      expect(config.performance.lookupTimeoutMs).toBe(50);
      expect(config.extraction.enabledTypes).toEqual(['arn', 'git_url']);
      expect(config.extraction.confidenceThreshold).toBe(0.8);
    });

    it('should use defaults when environment variables are not set', () => {
      const config = loadExternalIndexConfig();
      expect(config).toEqual(DEFAULT_EXTERNAL_INDEX_CONFIG);
    });

    it('should parse comma-separated enabled types correctly', () => {
      process.env[ExternalIndexEnvVars.ENABLED_TYPES] = 'arn, container_image, helm_chart';

      const config = loadExternalIndexConfig();

      expect(config.extraction.enabledTypes).toEqual(['arn', 'container_image', 'helm_chart']);
    });

    it('should handle empty enabled types string', () => {
      process.env[ExternalIndexEnvVars.ENABLED_TYPES] = '';

      const config = loadExternalIndexConfig();

      expect(config.extraction.enabledTypes).toEqual(DEFAULT_EXTERNAL_INDEX_CONFIG.extraction.enabledTypes);
    });

    it('should throw on invalid configuration values', () => {
      process.env[ExternalIndexEnvVars.CACHE_L1_MAX_ENTRIES] = '50'; // below minimum

      expect(() => loadExternalIndexConfig()).toThrow(ExternalIndexConfigError);
    });
  });

  describe('Configuration Singleton', () => {
    it('should return same instance on multiple calls', () => {
      const config1 = getExternalIndexConfig();
      const config2 = getExternalIndexConfig();

      expect(config1).toBe(config2);
    });

    it('should reset singleton correctly', () => {
      const config1 = getExternalIndexConfig();
      resetExternalIndexConfig();
      const config2 = getExternalIndexConfig();

      expect(config1).not.toBe(config2);
    });

    it('should allow overriding configuration', () => {
      const customConfig: ExternalIndexConfig = {
        ...DEFAULT_EXTERNAL_INDEX_CONFIG,
        cache: {
          ...DEFAULT_EXTERNAL_INDEX_CONFIG.cache,
          l1: { maxEntries: 5000, ttlMs: 120000 },
        },
      };

      setExternalIndexConfig(customConfig);
      const config = getExternalIndexConfig();

      expect(config.cache.l1.maxEntries).toBe(5000);
    });

    it('should throw when setting invalid configuration', () => {
      const invalidConfig = {
        ...DEFAULT_EXTERNAL_INDEX_CONFIG,
        cache: {
          l1: { maxEntries: 50, ttlMs: 100 }, // below minimums
          l2: DEFAULT_EXTERNAL_INDEX_CONFIG.cache.l2,
        },
      };

      expect(() => setExternalIndexConfig(invalidConfig as ExternalIndexConfig)).toThrow(ExternalIndexConfigError);
    });
  });

  describe('Section Accessors', () => {
    beforeEach(() => {
      // Initialize config
      getExternalIndexConfig();
    });

    it('should return cache config', () => {
      const cacheConfig = getCacheConfig();
      expect(cacheConfig.l1).toBeDefined();
      expect(cacheConfig.l2).toBeDefined();
    });

    it('should return L1 cache config', () => {
      const l1Config = getL1CacheConfig();
      expect(l1Config.maxEntries).toBeDefined();
      expect(l1Config.ttlMs).toBeDefined();
    });

    it('should return L2 cache config', () => {
      const l2Config = getL2CacheConfig();
      expect(l2Config.ttlMs).toBeDefined();
      expect(l2Config.prefix).toBeDefined();
    });

    it('should return indexing config', () => {
      const indexingConfig = getIndexingConfig();
      expect(indexingConfig.batchSize).toBeDefined();
      expect(indexingConfig.maxConcurrentBuilds).toBeDefined();
      expect(indexingConfig.buildTimeoutMs).toBeDefined();
    });

    it('should return performance config', () => {
      const perfConfig = getPerformanceConfig();
      expect(perfConfig.lookupTimeoutMs).toBeDefined();
      expect(perfConfig.reverseLookupTimeoutMs).toBeDefined();
      expect(perfConfig.maxBatchLookupSize).toBeDefined();
    });

    it('should return extraction config', () => {
      const extractionConfig = getExtractionConfig();
      expect(extractionConfig.enabledTypes).toBeDefined();
      expect(extractionConfig.maxReferencesPerNode).toBeDefined();
      expect(extractionConfig.confidenceThreshold).toBeDefined();
    });
  });

  describe('Validation Utilities', () => {
    it('should validate correct configuration', () => {
      expect(() => validateExternalIndexConfig(DEFAULT_EXTERNAL_INDEX_CONFIG)).not.toThrow();
    });

    it('should throw on invalid configuration', () => {
      const invalid = { cache: {} };
      expect(() => validateExternalIndexConfig(invalid)).toThrow(ExternalIndexConfigError);
    });

    it('should return true for valid configuration', () => {
      expect(isValidExternalIndexConfig(DEFAULT_EXTERNAL_INDEX_CONFIG)).toBe(true);
    });

    it('should return false for invalid configuration', () => {
      expect(isValidExternalIndexConfig({ cache: {} })).toBe(false);
    });

    it('should return empty array for valid configuration', () => {
      const errors = getConfigValidationErrors(DEFAULT_EXTERNAL_INDEX_CONFIG);
      expect(errors).toHaveLength(0);
    });

    it('should return errors for invalid configuration', () => {
      const errors = getConfigValidationErrors({ cache: {} });
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('ExternalIndexConfigError', () => {
    it('should contain error details', () => {
      const errors = [
        { path: '/cache/l1/maxEntries', message: 'Expected number' },
        { path: '/performance/lookupTimeoutMs', message: 'Expected number' },
      ];
      const error = new ExternalIndexConfigError(errors);

      expect(error.configErrors).toEqual(errors);
      expect(error.message).toContain('/cache/l1/maxEntries');
      expect(error.message).toContain('/performance/lookupTimeoutMs');
      expect(error.name).toBe('ExternalIndexConfigError');
    });
  });

  describe('Configuration Summary', () => {
    it('should generate readable summary', () => {
      const summary = getExternalIndexConfigSummary();

      expect(summary).toContain('External Object Index Configuration:');
      expect(summary).toContain('Cache:');
      expect(summary).toContain('L1:');
      expect(summary).toContain('L2:');
      expect(summary).toContain('Indexing:');
      expect(summary).toContain('Performance:');
      expect(summary).toContain('NFR-PERF-008');
      expect(summary).toContain('Extraction:');
    });

    it('should include actual configuration values', () => {
      const config: ExternalIndexConfig = {
        ...DEFAULT_EXTERNAL_INDEX_CONFIG,
        cache: {
          l1: { maxEntries: 5000, ttlMs: 120000 },
          l2: { ttlMs: 1800000, prefix: 'custom:' },
        },
      };

      const summary = getExternalIndexConfigSummary(config);

      expect(summary).toContain('5000 entries');
      expect(summary).toContain('120000ms');
      expect(summary).toContain('"custom:"');
    });
  });

  describe('Test Helper', () => {
    it('should create test config with defaults', () => {
      const testConfig = createTestConfig();

      // Should have test environment defaults
      expect(testConfig.cache.l1.maxEntries).toBe(100);
      expect(testConfig.indexing.batchSize).toBe(100);
    });

    it('should create test config with overrides', () => {
      const testConfig = createTestConfig({
        cache: {
          l1: { maxEntries: 200, ttlMs: 5000 },
          l2: { ttlMs: 60000, prefix: 'test:' },
        },
      });

      expect(testConfig.cache.l1.maxEntries).toBe(200);
      expect(testConfig.cache.l1.ttlMs).toBe(5000);
    });

    it('should merge overrides with test defaults', () => {
      const testConfig = createTestConfig({
        performance: {
          lookupTimeoutMs: 200,
          reverseLookupTimeoutMs: 1000,
          maxBatchLookupSize: 50,
        },
      });

      // Override should take effect
      expect(testConfig.performance.lookupTimeoutMs).toBe(200);
      // Other test defaults should remain
      expect(testConfig.cache.l1.maxEntries).toBe(100);
    });
  });

  describe('Load with Environment Defaults', () => {
    it('should merge environment defaults with loaded config', () => {
      process.env.NODE_ENV = 'development';
      process.env[ExternalIndexEnvVars.CACHE_L1_MAX_ENTRIES] = '2000';

      const config = loadExternalIndexConfigWithDefaults();

      // Environment variable override
      expect(config.cache.l1.maxEntries).toBe(2000);
      // Development defaults for other settings
      expect(config.performance.lookupTimeoutMs).toBe(100);
    });

    it('should use production defaults in production', () => {
      process.env.NODE_ENV = 'production';

      const config = loadExternalIndexConfigWithDefaults();

      // Production uses default config values
      expect(config.cache.l1.maxEntries).toBe(10000);
      expect(config.performance.lookupTimeoutMs).toBe(100);
    });
  });
});
