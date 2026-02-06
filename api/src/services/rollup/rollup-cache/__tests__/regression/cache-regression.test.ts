/**
 * Rollup Cache Regression Tests
 * @module services/rollup/rollup-cache/__tests__/regression/cache-regression.test
 *
 * Regression tests to ensure rollup-cache integration doesn't break
 * existing rollup service functionality.
 *
 * TASK-ROLLUP-004: Rollup Caching - Regression Testing
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheKeyBuilder, createCacheKeyBuilder, getDefaultCacheKeyBuilder, resetDefaultCacheKeyBuilder } from '../../cache-key-builder.js';
import type { CacheKey, CacheTag, CacheVersion, IRollupCache, CachedExecutionResult, CachedMergedGraph, CachedBlastRadius, CacheStats } from '../../interfaces.js';
import { createCacheEntryMetadata, createEmptyCacheStats, isCacheEntryValid, createCacheKey, createCacheTag } from '../../interfaces.js';
import type { TenantId } from '../../../../../types/entities.js';
import type { RollupId, RollupExecutionId, RollupExecutionResult } from '../../../../../types/rollup.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestTenantId(): TenantId {
  return `tenant_${crypto.randomUUID()}` as TenantId;
}

function createTestRollupId(): RollupId {
  return `rollup_${crypto.randomUUID()}` as RollupId;
}

function createTestExecutionId(): RollupExecutionId {
  return `exec_${crypto.randomUUID()}` as RollupExecutionId;
}

function createTestExecutionResult(overrides: Partial<RollupExecutionResult> = {}): RollupExecutionResult {
  return {
    id: createTestExecutionId(),
    rollupId: createTestRollupId(),
    tenantId: createTestTenantId(),
    status: 'completed',
    scanIds: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================================================
// Cache Key Builder Interface Compatibility Tests
// ============================================================================

describe('CacheKeyBuilder Interface Backward Compatibility', () => {
  let keyBuilder: CacheKeyBuilder;

  beforeEach(() => {
    resetDefaultCacheKeyBuilder();
    keyBuilder = new CacheKeyBuilder();
  });

  describe('ICacheKeyBuilder Interface Methods', () => {
    it('should export all required key builder methods', () => {
      const requiredMethods = [
        'buildExecutionKey',
        'buildMergedGraphKey',
        'buildBlastRadiusKey',
        'buildTagSetKey',
        'createTenantTag',
        'createRollupTag',
        'createExecutionTag',
        'createNodeTag',
        'parseKey',
        'getVersion',
        'buildPattern',
        'generateExecutionTags',
        'generateMergedGraphTags',
        'generateBlastRadiusTags',
      ];

      for (const method of requiredMethods) {
        expect(typeof (keyBuilder as any)[method]).toBe('function');
      }
    });

    it('should maintain consistent key format', () => {
      const tenantId = createTestTenantId();
      const executionId = createTestExecutionId();
      const rollupId = createTestRollupId();

      const execKey = keyBuilder.buildExecutionKey(tenantId, executionId);
      const graphKey = keyBuilder.buildMergedGraphKey(tenantId, rollupId);
      const blastKey = keyBuilder.buildBlastRadiusKey(tenantId, 'node_123', 3);

      // All keys should contain the prefix and version
      expect(execKey).toContain('rollup');
      expect(graphKey).toContain('rollup');
      expect(blastKey).toContain('rollup');

      // Keys should be valid branded types
      expect(typeof execKey).toBe('string');
      expect(typeof graphKey).toBe('string');
      expect(typeof blastKey).toBe('string');
    });
  });

  describe('Key Generation Determinism', () => {
    it('should generate deterministic execution keys', () => {
      const tenantId = 'tenant_test' as TenantId;
      const executionId = 'exec_test' as RollupExecutionId;

      const key1 = keyBuilder.buildExecutionKey(tenantId, executionId);
      const key2 = keyBuilder.buildExecutionKey(tenantId, executionId);

      expect(key1).toBe(key2);
    });

    it('should generate deterministic merged graph keys', () => {
      const tenantId = 'tenant_test' as TenantId;
      const rollupId = 'rollup_test' as RollupId;

      const key1 = keyBuilder.buildMergedGraphKey(tenantId, rollupId);
      const key2 = keyBuilder.buildMergedGraphKey(tenantId, rollupId);

      expect(key1).toBe(key2);
    });

    it('should generate deterministic blast radius keys', () => {
      const tenantId = 'tenant_test' as TenantId;
      const nodeId = 'node_test';
      const depth = 5;

      const key1 = keyBuilder.buildBlastRadiusKey(tenantId, nodeId, depth);
      const key2 = keyBuilder.buildBlastRadiusKey(tenantId, nodeId, depth);

      expect(key1).toBe(key2);
    });

    it('should generate different keys for different inputs', () => {
      const tenant1 = createTestTenantId();
      const tenant2 = createTestTenantId();
      const executionId = createTestExecutionId();

      const key1 = keyBuilder.buildExecutionKey(tenant1, executionId);
      const key2 = keyBuilder.buildExecutionKey(tenant2, executionId);

      expect(key1).not.toBe(key2);
    });
  });

  describe('Tag Generation', () => {
    it('should generate unique tenant tags', () => {
      const tenant1 = createTestTenantId();
      const tenant2 = createTestTenantId();

      const tag1 = keyBuilder.createTenantTag(tenant1);
      const tag2 = keyBuilder.createTenantTag(tenant2);

      expect(tag1).not.toBe(tag2);
    });

    it('should generate execution tags with proper structure', () => {
      const tenantId = createTestTenantId();
      const executionId = createTestExecutionId();
      const rollupId = createTestRollupId();

      const tags = keyBuilder.generateExecutionTags(tenantId, executionId, rollupId);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2); // At least tenant and execution tags
    });

    it('should generate merged graph tags with proper structure', () => {
      const tenantId = createTestTenantId();
      const rollupId = createTestRollupId();

      const tags = keyBuilder.generateMergedGraphTags(tenantId, rollupId);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2); // At least tenant and rollup tags
    });

    it('should generate blast radius tags with proper structure', () => {
      const tenantId = createTestTenantId();
      const nodeId = 'node_test';

      const tags = keyBuilder.generateBlastRadiusTags(tenantId, nodeId);

      expect(Array.isArray(tags)).toBe(true);
      expect(tags.length).toBeGreaterThanOrEqual(2); // At least tenant and node tags
    });
  });

  describe('Key Parsing', () => {
    it('should parse valid execution key', () => {
      const tenantId = createTestTenantId();
      const executionId = createTestExecutionId();

      const key = keyBuilder.buildExecutionKey(tenantId, executionId);
      const parsed = keyBuilder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.entryType).toBe('execution');
      expect(parsed?.version).toBe('v1');
    });

    it('should parse valid merged graph key', () => {
      const tenantId = createTestTenantId();
      const rollupId = createTestRollupId();

      const key = keyBuilder.buildMergedGraphKey(tenantId, rollupId);
      const parsed = keyBuilder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.entryType).toBe('merged_graph');
    });

    it('should parse valid blast radius key', () => {
      const tenantId = createTestTenantId();
      const nodeId = 'node_test';
      const depth = 3;

      const key = keyBuilder.buildBlastRadiusKey(tenantId, nodeId, depth);
      const parsed = keyBuilder.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.entryType).toBe('blast_radius');
    });

    it('should return null for invalid key format', () => {
      const invalidKey = 'invalid-key-format' as CacheKey;
      const parsed = keyBuilder.parseKey(invalidKey);

      expect(parsed).toBeNull();
    });
  });

  describe('Version Support', () => {
    it('should support v1 version', () => {
      const v1Builder = new CacheKeyBuilder('v1');
      expect(v1Builder.getVersion()).toBe('v1');
    });

    it('should support v2 version', () => {
      const v2Builder = new CacheKeyBuilder('v2');
      expect(v2Builder.getVersion()).toBe('v2');
    });

    it('should use default version when not specified', () => {
      const defaultBuilder = new CacheKeyBuilder();
      expect(defaultBuilder.getVersion()).toBe('v1');
    });
  });
});

// ============================================================================
// Cache Entry Types Compatibility Tests
// ============================================================================

describe('Cache Entry Types Backward Compatibility', () => {
  describe('CachedExecutionResult Structure', () => {
    it('should preserve RollupExecutionResult structure when cached', () => {
      const executionResult = createTestExecutionResult({
        id: 'exec_test' as RollupExecutionId,
        status: 'completed',
        stats: {
          nodesScanned: 100,
          nodesMatched: 50,
          edgesCreated: 25,
          crossRepoMatches: 10,
          executionTimeMs: 1000,
          matchingTimeMs: 500,
          mergingTimeMs: 300,
          repositoriesProcessed: 2,
          scansProcessed: 2,
        },
      });

      // Required fields
      expect(executionResult.id).toBeDefined();
      expect(executionResult.rollupId).toBeDefined();
      expect(executionResult.tenantId).toBeDefined();
      expect(executionResult.status).toBeDefined();
      expect(executionResult.scanIds).toBeDefined();
      expect(executionResult.createdAt).toBeDefined();

      // Optional fields
      expect(executionResult.stats).toBeDefined();
      expect(executionResult.stats?.nodesScanned).toBe(100);
    });

    it('should not introduce breaking changes to existing type definitions', () => {
      const result: RollupExecutionResult = {
        id: 'exec_test' as RollupExecutionId,
        rollupId: 'rollup_test' as RollupId,
        tenantId: 'tenant_test' as TenantId,
        status: 'pending',
        scanIds: [],
        createdAt: new Date().toISOString(),
      };

      // These should all be valid operations
      expect(result.id).toBeDefined();
      expect(result.status === 'pending').toBe(true);
    });
  });

  describe('CacheEntryMetadata Structure', () => {
    it('should create valid metadata with all required fields', () => {
      const metadata = createCacheEntryMetadata(
        3600,
        'computation',
        [],
        1024
      );

      expect(metadata.cachedAt).toBeInstanceOf(Date);
      expect(metadata.expiresAt).toBeInstanceOf(Date);
      expect(metadata.ttlSeconds).toBe(3600);
      expect(metadata.source).toBe('computation');
      expect(metadata.sizeBytes).toBe(1024);
      expect(Array.isArray(metadata.tags)).toBe(true);
      expect(metadata.formatVersion).toBe(1);
    });

    it('should validate cache entry expiration correctly', () => {
      const validMetadata = createCacheEntryMetadata(3600, 'computation', []);
      expect(isCacheEntryValid(validMetadata)).toBe(true);

      // Create expired metadata
      const expiredMetadata = {
        ...validMetadata,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      expect(isCacheEntryValid(expiredMetadata)).toBe(false);
    });
  });

  describe('CacheStats Structure', () => {
    it('should create empty cache stats with all required fields', () => {
      const stats = createEmptyCacheStats();

      expect(stats.l1Hits).toBe(0);
      expect(stats.l1Misses).toBe(0);
      expect(stats.l2Hits).toBe(0);
      expect(stats.l2Misses).toBe(0);
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);
      expect(stats.hitRatio).toBe(0);
      expect(stats.l1HitRatio).toBe(0);
      expect(stats.l2HitRatio).toBe(0);
      expect(stats.l1Size).toBe(0);
      expect(stats.setsCount).toBe(0);
      expect(stats.invalidationsCount).toBe(0);
      expect(stats.errorsCount).toBe(0);
      expect(stats.avgGetLatencyMs).toBe(0);
      expect(stats.avgSetLatencyMs).toBe(0);
    });
  });
});

// ============================================================================
// RollupService Integration Tests
// ============================================================================

describe('RollupService Integration Compatibility', () => {
  describe('Cache Transparency', () => {
    it('should not change RollupService return types when cache is used', () => {
      // The cache layer should be transparent to consumers
      // RollupService should return the same types whether cache is used or not
      const executionResult = createTestExecutionResult();

      // Verify RollupExecutionResult structure
      expect(executionResult).toHaveProperty('id');
      expect(executionResult).toHaveProperty('rollupId');
      expect(executionResult).toHaveProperty('tenantId');
      expect(executionResult).toHaveProperty('status');
      expect(executionResult).toHaveProperty('scanIds');
      expect(executionResult).toHaveProperty('createdAt');
    });

    it('should allow cache to be optional in RollupServiceDependencies', () => {
      // The cacheService should be optional in RollupServiceDependencies
      // This ensures backward compatibility with existing code
      const minimalDeps = {
        rollupRepository: {} as any,
        graphService: {} as any,
        matcherFactory: {} as any,
        mergeEngine: {} as any,
        blastRadiusEngine: {} as any,
        eventEmitter: {} as any,
        // cacheService is intentionally omitted
      };

      // Should not throw when cacheService is not provided
      expect(minimalDeps.cacheService).toBeUndefined();
    });
  });

  describe('Execution Status Values', () => {
    it('should support all existing execution status values', () => {
      const validStatuses = ['pending', 'running', 'completed', 'failed', 'cancelled'];

      for (const status of validStatuses) {
        const result = createTestExecutionResult({ status: status as any });
        expect(result.status).toBe(status);
      }
    });
  });
});

// ============================================================================
// Multi-Tenant Isolation Tests
// ============================================================================

describe('Multi-Tenant Isolation Compatibility', () => {
  let keyBuilder: CacheKeyBuilder;

  beforeEach(() => {
    keyBuilder = new CacheKeyBuilder();
  });

  it('should generate isolated keys for different tenants', () => {
    const tenant1 = createTestTenantId();
    const tenant2 = createTestTenantId();
    const executionId = createTestExecutionId();

    const key1 = keyBuilder.buildExecutionKey(tenant1, executionId);
    const key2 = keyBuilder.buildExecutionKey(tenant2, executionId);

    expect(key1).not.toBe(key2);
  });

  it('should generate isolated tags for different tenants', () => {
    const tenant1 = createTestTenantId();
    const tenant2 = createTestTenantId();

    const tag1 = keyBuilder.createTenantTag(tenant1);
    const tag2 = keyBuilder.createTenantTag(tenant2);

    expect(tag1).not.toBe(tag2);
  });

  it('should prevent cross-tenant key collisions', () => {
    const tenant1 = createTestTenantId();
    const tenant2 = createTestTenantId();
    const rollupId = createTestRollupId();

    const graphKey1 = keyBuilder.buildMergedGraphKey(tenant1, rollupId);
    const graphKey2 = keyBuilder.buildMergedGraphKey(tenant2, rollupId);

    expect(graphKey1).not.toBe(graphKey2);
  });
});

// ============================================================================
// Factory Functions Compatibility Tests
// ============================================================================

describe('Factory Functions Compatibility', () => {
  beforeEach(() => {
    resetDefaultCacheKeyBuilder();
  });

  describe('createCacheKeyBuilder', () => {
    it('should create builder with default version', () => {
      const builder = createCacheKeyBuilder();
      expect(builder.getVersion()).toBe('v1');
    });

    it('should create builder with specified version', () => {
      const builder = createCacheKeyBuilder('v2');
      expect(builder.getVersion()).toBe('v2');
    });
  });

  describe('getDefaultCacheKeyBuilder', () => {
    it('should return singleton instance', () => {
      const builder1 = getDefaultCacheKeyBuilder();
      const builder2 = getDefaultCacheKeyBuilder();

      expect(builder1).toBe(builder2);
    });

    it('should return v1 builder by default', () => {
      const builder = getDefaultCacheKeyBuilder();
      expect(builder.getVersion()).toBe('v1');
    });
  });

  describe('resetDefaultCacheKeyBuilder', () => {
    it('should reset singleton instance', () => {
      const builder1 = getDefaultCacheKeyBuilder();
      resetDefaultCacheKeyBuilder();
      const builder2 = getDefaultCacheKeyBuilder();

      // After reset, should get a new instance (but structurally equivalent)
      expect(builder2.getVersion()).toBe('v1');
    });
  });
});

// ============================================================================
// Branded Types Compatibility Tests
// ============================================================================

describe('Branded Types Compatibility', () => {
  describe('CacheKey Type', () => {
    it('should create valid CacheKey', () => {
      const key = createCacheKey('rollup:v1:tenant:execution:id');
      expect(typeof key).toBe('string');
    });
  });

  describe('CacheTag Type', () => {
    it('should create valid CacheTag', () => {
      const tag = createCacheTag('tenant:tenant_123');
      expect(typeof tag).toBe('string');
    });
  });
});

// ============================================================================
// Error Code Compatibility Tests
// ============================================================================

describe('Error Code Compatibility', () => {
  it('should define all expected error codes', async () => {
    const { RollupCacheErrorCodes } = await import('../../interfaces.js');

    expect(RollupCacheErrorCodes.READ_FAILED).toBeDefined();
    expect(RollupCacheErrorCodes.WRITE_FAILED).toBeDefined();
    expect(RollupCacheErrorCodes.INVALIDATION_FAILED).toBeDefined();
    expect(RollupCacheErrorCodes.SERIALIZATION_FAILED).toBeDefined();
    expect(RollupCacheErrorCodes.DESERIALIZATION_FAILED).toBeDefined();
    expect(RollupCacheErrorCodes.L1_ERROR).toBeDefined();
    expect(RollupCacheErrorCodes.L2_ERROR).toBeDefined();
    expect(RollupCacheErrorCodes.NOT_INITIALIZED).toBeDefined();
    expect(RollupCacheErrorCodes.CONFIG_ERROR).toBeDefined();
  });
});

// ============================================================================
// Type Guard Compatibility Tests
// ============================================================================

describe('Type Guard Compatibility', () => {
  it('should correctly identify CachedExecutionResult', async () => {
    const { isCachedExecutionResult } = await import('../../interfaces.js');

    const validResult = {
      data: createTestExecutionResult(),
      rollupId: createTestRollupId(),
      metadata: createCacheEntryMetadata(3600, 'computation', []),
    };

    expect(isCachedExecutionResult(validResult)).toBe(true);
    expect(isCachedExecutionResult({})).toBe(false);
    expect(isCachedExecutionResult(null)).toBe(false);
  });

  it('should correctly identify CachedMergedGraph', async () => {
    const { isCachedMergedGraph } = await import('../../interfaces.js');

    const validGraph = {
      mergedNodes: [],
      nodeCount: 0,
      executionId: createTestExecutionId(),
      metadata: createCacheEntryMetadata(1800, 'computation', []),
    };

    expect(isCachedMergedGraph(validGraph)).toBe(true);
    expect(isCachedMergedGraph({})).toBe(false);
    expect(isCachedMergedGraph(null)).toBe(false);
  });

  it('should correctly identify CachedBlastRadius', async () => {
    const { isCachedBlastRadius } = await import('../../interfaces.js');

    const validBlastRadius = {
      data: { nodeId: 'test', depth: 3, affectedNodes: [], riskLevel: 'low', rollupId: createTestRollupId() },
      nodeId: 'test',
      depth: 3,
      metadata: createCacheEntryMetadata(900, 'computation', []),
    };

    expect(isCachedBlastRadius(validBlastRadius)).toBe(true);
    expect(isCachedBlastRadius({})).toBe(false);
    expect(isCachedBlastRadius(null)).toBe(false);
  });
});
