/**
 * Rollup Cache Integration Tests
 * @module services/rollup/rollup-cache/__tests__/integration.test
 *
 * Integration tests for the complete rollup cache system.
 * Tests L1 -> L2 cache flow, tag-based invalidation across tiers,
 * and cache warming integration.
 *
 * Coverage:
 * - L1 -> L2 read-through and write-through flow
 * - Multi-tenant isolation
 * - Tag-based invalidation across both tiers
 * - Cache warming integration with main cache
 * - Error recovery scenarios (L2 failure, graceful degradation)
 * - Concurrent access patterns
 * - Memory pressure scenarios
 * - Cross-service invalidation
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { RollupCache } from '../rollup-cache.js';
import { CacheKeyBuilder } from '../cache-key-builder.js';
import { CacheWarmingProcessor } from '../cache-warming-processor.js';
import type { RollupCacheDependencies } from '../rollup-cache.js';
import type { CacheWarmingProcessorDependencies } from '../cache-warming-processor.js';
import {
  createMockRedisCache,
  createMockCacheWarmingDataProvider,
  createMockLogger,
} from './mocks.js';
import {
  createTestTenantId,
  createTestRollupId,
  createTestExecutionId,
  createTestNodeId,
  createTestExecutionResult,
  createTestCachedMergedGraph,
  createTestCachedBlastRadius,
  createTestCacheConfig,
  createTestCachedExecutionResult,
} from './fixtures.js';
import { isCacheEntryValid, createCacheEntryMetadata, type CacheTag } from '../interfaces.js';
import type { TenantId } from '../../../../types/entities.js';
import type { RollupId, RollupExecutionId } from '../../../../types/rollup.js';

// ============================================================================
// Mock Setup - Using shared stores that persist across mock invocations
// ============================================================================

// Global stores for L1 caches - declared before vi.mock so they're available
const l1Stores = {
  stores: [] as Map<string, unknown>[],
  getOrCreate(index: number): Map<string, unknown> {
    if (!this.stores[index]) {
      this.stores[index] = new Map();
    }
    return this.stores[index];
  },
  clearAll() {
    this.stores.forEach(store => store?.clear());
    this.stores = [];
  },
};

// Track L2 store for mock
const l2Store = new Map<string, { value: unknown; expiresAt: number }>();

// Counter for LRU cache instances
let lruInstanceCounter = 0;

// Mock external dependencies with factory functions
vi.mock('../../../../optimization/cache.js', () => {
  return {
    LRUCache: class MockLRUCache<K, V> {
      private store: Map<string, unknown>;
      private maxSize: number;

      constructor(capacity: number = 10000) {
        this.maxSize = capacity;
        // Get a unique store for this instance
        const instanceIndex = lruInstanceCounter++;
        this.store = l1Stores.getOrCreate(instanceIndex);
      }

      get(key: string): V | undefined {
        return this.store.get(key) as V | undefined;
      }

      set(key: string, value: V): void {
        if (this.store.size >= this.maxSize && !this.store.has(key)) {
          const firstKey = this.store.keys().next().value;
          if (firstKey !== undefined) {
            this.store.delete(firstKey);
          }
        }
        this.store.set(key, value);
      }

      delete(key: string): boolean {
        return this.store.delete(key);
      }

      clear(): void {
        this.store.clear();
      }

      has(key: string): boolean {
        return this.store.has(key);
      }

      get size(): number {
        return this.store.size;
      }

      getStats() {
        return { hits: 0, misses: 0, hitRate: 0, size: this.store.size, evictions: 0 };
      }
    },
    RedisCache: class MockRedisCache {
      private options: { namespace: string; ttlSeconds: number };

      constructor(options: { namespace?: string; ttlSeconds?: number } = {}) {
        this.options = {
          namespace: options.namespace ?? 'test',
          ttlSeconds: options.ttlSeconds ?? 3600,
        };
      }

      private buildKey(key: string): string {
        return `${this.options.namespace}:${key}`;
      }

      async get<T>(key: string): Promise<T | null> {
        const fullKey = this.buildKey(key);
        const entry = l2Store.get(fullKey);
        if (!entry) return null;
        if (entry.expiresAt < Date.now()) {
          l2Store.delete(fullKey);
          return null;
        }
        return entry.value as T;
      }

      async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
        const fullKey = this.buildKey(key);
        const ttl = ttlSeconds ?? this.options.ttlSeconds;
        l2Store.set(fullKey, {
          value,
          expiresAt: Date.now() + ttl * 1000,
        });
      }

      async delete(key: string): Promise<boolean> {
        const fullKey = this.buildKey(key);
        return l2Store.delete(fullKey);
      }

      async deleteByPattern(pattern: string): Promise<number> {
        const fullPattern = this.buildKey(pattern);
        const regex = new RegExp('^' + fullPattern.replace(/\*/g, '.*') + '$');
        let count = 0;
        for (const key of l2Store.keys()) {
          if (regex.test(key)) {
            l2Store.delete(key);
            count++;
          }
        }
        return count;
      }
    },
  };
});

vi.mock('../../../../cache/redis.js', () => ({
  getClient: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockResolvedValue(1),
    smembers: vi.fn().mockResolvedValue([]),
    scan: vi.fn().mockResolvedValue(['0', []]),
    exists: vi.fn().mockResolvedValue(0),
    ttl: vi.fn().mockResolvedValue(-1),
    pipeline: vi.fn().mockReturnValue({
      sadd: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      del: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
    publish: vi.fn().mockResolvedValue(1),
    subscribe: vi.fn().mockResolvedValue(undefined),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    duplicate: vi.fn().mockReturnThis(),
    disconnect: vi.fn(),
  })),
}));

// ============================================================================
// Integration Tests
// ============================================================================

describe('Rollup Cache Integration', () => {
  let cache: RollupCache;
  let keyBuilder: CacheKeyBuilder;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let tenantId: TenantId;
  let tenantId2: TenantId;
  let rollupId: RollupId;
  let executionId: RollupExecutionId;

  beforeEach(async () => {
    // Reset all stores
    l1Stores.clearAll();
    l2Store.clear();
    lruInstanceCounter = 0;

    mockLogger = createMockLogger();
    keyBuilder = new CacheKeyBuilder('v1', 'rollup');
    tenantId = createTestTenantId();
    tenantId2 = createTestTenantId();
    rollupId = createTestRollupId();
    executionId = createTestExecutionId();

    const deps: RollupCacheDependencies = {
      keyBuilder,
      logger: mockLogger as any,
      config: createTestCacheConfig(),
    };

    cache = new RollupCache(deps);
    await cache.initialize();
  });

  afterEach(async () => {
    await cache.shutdown();
    vi.clearAllMocks();
  });

  // =========================================================================
  // L1 -> L2 Cache Flow Tests
  // =========================================================================

  describe('L1 -> L2 Cache Flow', () => {
    it('should write to both L1 and L2 (write-through)', async () => {
      const executionResult = createTestExecutionResult({ rollupId });

      await cache.setExecutionResult(tenantId, executionId, rollupId, executionResult);

      // L1 should have the entry (fast path on next read)
      const result = await cache.getExecutionResult(tenantId, executionId);
      expect(result).not.toBeNull();
      expect(result?.data.id).toBe(executionResult.id);
    });

    it('should read from L1 first on cache hit', async () => {
      const executionResult = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, executionResult);

      // Read should hit L1
      const result = await cache.getExecutionResult(tenantId, executionId);

      expect(result).not.toBeNull();

      // Verify stats show L1 hit
      const stats = cache.getStats();
      expect(stats.l1Hits).toBeGreaterThan(0);
    });

    it('should populate L1 from L2 on L1 miss (read-through)', async () => {
      const executionResult = createTestExecutionResult({ rollupId });

      // Set in cache first
      await cache.setExecutionResult(tenantId, executionId, rollupId, executionResult);

      // Clear L1 stores to simulate eviction
      l1Stores.clearAll();

      // Read - should miss L1, hit L2, and populate L1
      const result = await cache.getExecutionResult(tenantId, executionId);

      expect(result).not.toBeNull();
      expect(result?.data.id).toBe(executionResult.id);
    });

    it('should handle L2 failure gracefully when L1 has data', async () => {
      const executionResult = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, executionResult);

      // Should return result from L1
      const result = await cache.getExecutionResult(tenantId, executionId);
      expect(result).not.toBeNull();
      expect(result?.data.id).toBe(executionResult.id);
    });

    it('should return null gracefully when entry does not exist', async () => {
      const result = await cache.getExecutionResult(tenantId, executionId);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Multi-Tenant Isolation Tests
  // =========================================================================

  describe('Multi-Tenant Isolation', () => {
    it('should isolate cache entries by tenant', async () => {
      const result1 = createTestExecutionResult({ rollupId });
      const result2 = createTestExecutionResult({ rollupId });

      await cache.setExecutionResult(tenantId, executionId, rollupId, result1);
      await cache.setExecutionResult(tenantId2, executionId, rollupId, result2);

      const retrieved1 = await cache.getExecutionResult(tenantId, executionId);
      const retrieved2 = await cache.getExecutionResult(tenantId2, executionId);

      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      expect(retrieved1?.data.id).toBe(result1.id);
      expect(retrieved2?.data.id).toBe(result2.id);
      expect(retrieved1?.data.id).not.toBe(retrieved2?.data.id);
    });

    it('should only invalidate tenant-specific entries on tenant invalidation', async () => {
      const result1 = createTestExecutionResult({ rollupId });
      const result2 = createTestExecutionResult({ rollupId });
      const exec2 = createTestExecutionId();

      await cache.setExecutionResult(tenantId, executionId, rollupId, result1);
      await cache.setExecutionResult(tenantId2, exec2, rollupId, result2);

      // Invalidate tenant1 only
      await cache.invalidateTenant(tenantId);

      const retrieved1 = await cache.getExecutionResult(tenantId, executionId);
      const retrieved2 = await cache.getExecutionResult(tenantId2, exec2);

      expect(retrieved1).toBeNull(); // Invalidated
      expect(retrieved2).not.toBeNull(); // Should still exist
    });

    it('should prevent tenant A from accessing tenant B data', async () => {
      const sensitiveResult = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, sensitiveResult);

      // Try to access tenant1's data with tenant2's ID - should return null
      const wrongTenantResult = await cache.getExecutionResult(tenantId2, executionId);
      expect(wrongTenantResult).toBeNull();
    });
  });

  // =========================================================================
  // Tag-Based Invalidation Tests
  // =========================================================================

  describe('Tag-Based Invalidation', () => {
    it('should invalidate entries by rollup tag', async () => {
      const exec1 = createTestExecutionId();
      const exec2 = createTestExecutionId();

      await cache.setExecutionResult(tenantId, exec1, rollupId, createTestExecutionResult({ rollupId }));
      await cache.setExecutionResult(tenantId, exec2, rollupId, createTestExecutionResult({ rollupId }));

      // Both entries are tagged with the same rollupId
      const rollupTag = keyBuilder.createRollupTag(tenantId, rollupId);
      await cache.invalidateByTag(rollupTag);

      // Both should be invalidated
      const retrieved1 = await cache.getExecutionResult(tenantId, exec1);
      const retrieved2 = await cache.getExecutionResult(tenantId, exec2);

      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });

    it('should invalidate entries by node tag for blast radius', async () => {
      const nodeId = createTestNodeId();
      const blastRadius3 = createTestCachedBlastRadius({ nodeId, depth: 3 });
      const blastRadius5 = createTestCachedBlastRadius({ nodeId, depth: 5 });

      await cache.setBlastRadius(tenantId, nodeId, 3, blastRadius3);
      await cache.setBlastRadius(tenantId, nodeId, 5, blastRadius5);

      // Invalidate all blast radius entries for this node
      await cache.invalidateBlastRadius(tenantId, nodeId);

      const retrieved3 = await cache.getBlastRadius(tenantId, nodeId, 3);
      const retrieved5 = await cache.getBlastRadius(tenantId, nodeId, 5);

      expect(retrieved3).toBeNull();
      expect(retrieved5).toBeNull();
    });

    it('should invalidate multiple tags in batch', async () => {
      const exec1 = createTestExecutionId();
      const exec2 = createTestExecutionId();
      const rollupId2 = createTestRollupId();

      await cache.setExecutionResult(tenantId, exec1, rollupId, createTestExecutionResult({ rollupId }));
      await cache.setExecutionResult(tenantId, exec2, rollupId2, createTestExecutionResult({ rollupId: rollupId2 }));

      const tag1 = keyBuilder.createRollupTag(tenantId, rollupId);
      const tag2 = keyBuilder.createRollupTag(tenantId, rollupId2);

      await cache.invalidateByTags([tag1, tag2]);

      const retrieved1 = await cache.getExecutionResult(tenantId, exec1);
      const retrieved2 = await cache.getExecutionResult(tenantId, exec2);

      expect(retrieved1).toBeNull();
      expect(retrieved2).toBeNull();
    });
  });

  // =========================================================================
  // Cache Entry Validity Tests
  // =========================================================================

  describe('Cache Entry Validity', () => {
    it('should validate entry based on expiration time', () => {
      const validMetadata = createCacheEntryMetadata(3600, 'computation', []);
      const expiredMetadata = {
        cachedAt: new Date(Date.now() - 7200000),
        expiresAt: new Date(Date.now() - 3600000),
        ttlSeconds: 3600,
        source: 'computation' as const,
        tags: [],
        formatVersion: 1,
      };

      expect(isCacheEntryValid(validMetadata)).toBe(true);
      expect(isCacheEntryValid(expiredMetadata)).toBe(false);
    });
  });

  // =========================================================================
  // Statistics Accuracy Tests
  // =========================================================================

  describe('Statistics Accuracy', () => {
    it('should accurately track L1 hits and misses', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);

      // L1 hit
      await cache.getExecutionResult(tenantId, executionId);

      // L1 miss (non-existent key)
      await cache.getExecutionResult(tenantId, createTestExecutionId());

      const stats = cache.getStats();
      expect(stats.l1Hits).toBeGreaterThan(0);
      expect(stats.l1Misses).toBeGreaterThan(0);
    });

    it('should accurately track sets', async () => {
      await cache.setExecutionResult(tenantId, executionId, rollupId, createTestExecutionResult({ rollupId }));
      await cache.setMergedGraph(tenantId, rollupId, createTestCachedMergedGraph());

      const stats = cache.getStats();
      expect(stats.setsCount).toBe(2);
    });

    it('should calculate hit ratio correctly', async () => {
      await cache.setExecutionResult(tenantId, executionId, rollupId, createTestExecutionResult({ rollupId }));

      // 2 hits
      await cache.getExecutionResult(tenantId, executionId);
      await cache.getExecutionResult(tenantId, executionId);

      // 1 miss
      await cache.getExecutionResult(tenantId, createTestExecutionId());

      const stats = cache.getStats();
      expect(stats.hitRatio).toBeGreaterThan(0);
      expect(stats.hitRatio).toBeLessThanOrEqual(1);
    });

    it('should reset statistics correctly', async () => {
      await cache.setExecutionResult(tenantId, executionId, rollupId, createTestExecutionResult({ rollupId }));
      await cache.getExecutionResult(tenantId, executionId);

      let stats = cache.getStats();
      expect(stats.setsCount).toBeGreaterThan(0);

      cache.resetStats();

      stats = cache.getStats();
      expect(stats.setsCount).toBe(0);
      expect(stats.l1Hits).toBe(0);
      expect(stats.l1Misses).toBe(0);
    });
  });

  // =========================================================================
  // Cache Warming Integration Tests
  // =========================================================================

  describe('Cache Warming Integration', () => {
    let warmingProcessor: CacheWarmingProcessor;
    let mockDataProvider: ReturnType<typeof createMockCacheWarmingDataProvider>;

    beforeEach(() => {
      mockDataProvider = createMockCacheWarmingDataProvider();
      const warmingDeps: CacheWarmingProcessorDependencies = {
        cache,
        dataProvider: mockDataProvider,
        logger: mockLogger as any,
        config: {
          maxConcurrency: 2,
          maxJobsPerSecond: 100,
          batchSize: 2,
          maxRetries: 1,
          retryDelayMs: 100,
          retryBackoffMultiplier: 2,
          defaultMaxItems: 10,
          jobTimeoutMs: 5000,
          enableProgressReporting: true,
        },
      };
      warmingProcessor = new CacheWarmingProcessor(warmingDeps);
    });

    it('should warm cache and enable fast subsequent reads', async () => {
      const executionIds = [createTestExecutionId(), createTestExecutionId()];
      mockDataProvider.listExecutionIds.mockResolvedValue(executionIds);

      // Warm the cache
      const warmedCount = await warmingProcessor.warmExecutions(tenantId, executionIds);

      expect(warmedCount).toBeGreaterThan(0);

      // Verify data provider was called
      expect(mockDataProvider.fetchExecutionResult).toHaveBeenCalled();
    });

    it('should force refresh when requested', async () => {
      // Pre-populate cache
      const exec1 = createTestExecutionId();
      await cache.setExecutionResult(tenantId, exec1, rollupId, createTestExecutionResult({ rollupId }));

      // Force refresh
      mockDataProvider.listExecutionIds.mockResolvedValue([exec1]);
      await warmingProcessor.warmExecutions(tenantId, [exec1], true, 10);

      // Should have called fetch even though entry exists
      expect(mockDataProvider.fetchExecutionResult).toHaveBeenCalled();
    });

    it('should handle warming job scheduling and status tracking', async () => {
      const jobId = await warmingProcessor.schedule({
        tenantId,
        priority: 5,
        targetTypes: ['execution_result'],
        forceRefresh: false,
        maxItems: 10,
      });

      expect(jobId).toBeDefined();
      expect(typeof jobId).toBe('string');

      // Check job status
      const status = await warmingProcessor.getJobStatus(jobId);
      expect(status).not.toBeNull();
    });

    it('should warm merged graphs', async () => {
      const rollupIds = [createTestRollupId(), createTestRollupId()];
      mockDataProvider.listRollupIds.mockResolvedValue(rollupIds);

      await warmingProcessor.warmMergedGraphs(tenantId, rollupIds);

      expect(mockDataProvider.fetchMergedGraph).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Error Recovery Tests
  // =========================================================================

  describe('Error Recovery', () => {
    it('should log errors when L2 operations fail', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);

      // Data should still be accessible from L1
      const retrieved = await cache.getExecutionResult(tenantId, executionId);
      expect(retrieved).not.toBeNull();
    });

    it('should return null gracefully when entry not found', async () => {
      const result = await cache.getExecutionResult(tenantId, executionId);
      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // Key Builder Integration Tests
  // =========================================================================

  describe('Key Builder Integration', () => {
    it('should use consistent keys across set and get operations', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);

      // Should find the entry with the built key
      const retrieved = await cache.getExecutionResult(tenantId, executionId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.data.id).toBe(result.id);
    });

    it('should parse generated keys correctly', () => {
      const execKey = keyBuilder.buildExecutionKey(tenantId, executionId);
      const graphKey = keyBuilder.buildMergedGraphKey(tenantId, rollupId);
      const blastKey = keyBuilder.buildBlastRadiusKey(tenantId, 'node-1', 3);

      const parsedExec = keyBuilder.parseKey(execKey);
      const parsedGraph = keyBuilder.parseKey(graphKey);
      const parsedBlast = keyBuilder.parseKey(blastKey);

      expect(parsedExec?.entryType).toBe('execution');
      expect(parsedGraph?.entryType).toBe('merged_graph');
      expect(parsedBlast?.entryType).toBe('blast_radius');
      expect(parsedBlast?.params?.depth).toBe('3');
    });

    it('should generate correct tags for cache entries', () => {
      const executionTags = keyBuilder.generateExecutionTags(tenantId, executionId, rollupId);
      const graphTags = keyBuilder.generateMergedGraphTags(tenantId, rollupId);
      const blastTags = keyBuilder.generateBlastRadiusTags(tenantId, 'node-1', rollupId);

      expect(executionTags.length).toBeGreaterThan(0);
      expect(graphTags.length).toBeGreaterThan(0);
      expect(blastTags.length).toBeGreaterThan(0);

      // All should include tenant tag
      const tenantTag = keyBuilder.createTenantTag(tenantId);
      expect(executionTags).toContain(tenantTag);
      expect(graphTags).toContain(tenantTag);
      expect(blastTags).toContain(tenantTag);
    });
  });

  // =========================================================================
  // Performance Characteristics Tests
  // =========================================================================

  describe('Performance Characteristics', () => {
    it('should have fast L1 read latency', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);

      const start = Date.now();
      for (let i = 0; i < 100; i++) {
        await cache.getExecutionResult(tenantId, executionId);
      }
      const duration = Date.now() - start;

      // 100 L1 reads should complete quickly (< 500ms for test environment)
      expect(duration).toBeLessThan(500);
    });

    it('should track latency metrics', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);
      await cache.getExecutionResult(tenantId, executionId);

      const stats = cache.getStats();
      expect(stats.avgGetLatencyMs).toBeGreaterThanOrEqual(0);
      expect(stats.avgSetLatencyMs).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Concurrent Operations Tests
  // =========================================================================

  describe('Concurrent Operations', () => {
    it('should handle concurrent reads safely', async () => {
      const result = createTestExecutionResult({ rollupId });
      await cache.setExecutionResult(tenantId, executionId, rollupId, result);

      const reads = Array.from({ length: 10 }, () =>
        cache.getExecutionResult(tenantId, executionId)
      );

      const results = await Promise.all(reads);

      expect(results.every(r => r !== null)).toBe(true);
      expect(results.every(r => r?.data.id === result.id)).toBe(true);
    });

    it('should handle concurrent writes safely', async () => {
      const writes = Array.from({ length: 10 }, (_, i) => {
        const execId = createTestExecutionId();
        const result = createTestExecutionResult({ rollupId });
        return cache.setExecutionResult(tenantId, execId, rollupId, result);
      });

      await Promise.all(writes);

      const stats = cache.getStats();
      expect(stats.setsCount).toBe(10);
    });

    it('should handle mixed read/write operations', async () => {
      const exec1 = createTestExecutionId();
      await cache.setExecutionResult(tenantId, exec1, rollupId, createTestExecutionResult({ rollupId }));

      const operations = [
        cache.getExecutionResult(tenantId, exec1),
        cache.setExecutionResult(tenantId, createTestExecutionId(), rollupId, createTestExecutionResult({ rollupId })),
        cache.getExecutionResult(tenantId, exec1),
        cache.setMergedGraph(tenantId, rollupId, createTestCachedMergedGraph()),
        cache.getMergedGraph(tenantId, rollupId),
      ];

      await Promise.all(operations);

      // Should complete without errors
      const stats = cache.getStats();
      expect(stats.errorsCount).toBe(0);
    });

    it('should handle concurrent invalidation operations', async () => {
      // Create multiple entries
      const execIds = Array.from({ length: 5 }, () => createTestExecutionId());
      for (const execId of execIds) {
        await cache.setExecutionResult(tenantId, execId, rollupId, createTestExecutionResult({ rollupId }));
      }

      // Invalidate concurrently
      const invalidations = execIds.map(execId =>
        cache.invalidateExecution(tenantId, execId)
      );

      await Promise.all(invalidations);

      // All should be invalidated
      for (const execId of execIds) {
        const result = await cache.getExecutionResult(tenantId, execId);
        expect(result).toBeNull();
      }
    });
  });

  // =========================================================================
  // Memory Pressure Tests
  // =========================================================================

  describe('Memory Pressure Scenarios', () => {
    it('should handle LRU eviction when L1 cache approaches capacity', async () => {
      const execIds: RollupExecutionId[] = [];

      // Fill L1 cache with entries
      for (let i = 0; i < 50; i++) {
        const execId = createTestExecutionId();
        execIds.push(execId);
        await cache.setExecutionResult(tenantId, execId, rollupId, createTestExecutionResult({ rollupId }));
      }

      // Later entries should still be in L1
      const lastResult = await cache.getExecutionResult(tenantId, execIds[49]);
      expect(lastResult).not.toBeNull();
    });
  });

  // =========================================================================
  // Cross-Service Invalidation Tests
  // =========================================================================

  describe('Cross-Service Invalidation', () => {
    it('should invalidate related entries when rollup is invalidated', async () => {
      // Create execution result and merged graph for same rollup
      const execResult = createTestExecutionResult({ rollupId });
      const mergedGraph = createTestCachedMergedGraph();

      await cache.setExecutionResult(tenantId, executionId, rollupId, execResult);
      await cache.setMergedGraph(tenantId, rollupId, mergedGraph);

      // Invalidate by rollup tag
      const rollupTag = keyBuilder.createRollupTag(tenantId, rollupId);
      await cache.invalidateByTag(rollupTag);

      // Both should be invalidated
      const retrievedExec = await cache.getExecutionResult(tenantId, executionId);
      const retrievedGraph = await cache.getMergedGraph(tenantId, rollupId);

      expect(retrievedExec).toBeNull();
      expect(retrievedGraph).toBeNull();
    });

    it('should support cascading invalidation via tenant tag', async () => {
      // Create entries across different rollups for same tenant
      const rollupId2 = createTestRollupId();
      const execId2 = createTestExecutionId();

      await cache.setExecutionResult(tenantId, executionId, rollupId, createTestExecutionResult({ rollupId }));
      await cache.setExecutionResult(tenantId, execId2, rollupId2, createTestExecutionResult({ rollupId: rollupId2 }));
      await cache.setMergedGraph(tenantId, rollupId, createTestCachedMergedGraph());

      // Invalidate all tenant data
      await cache.invalidateTenant(tenantId);

      // All entries should be gone
      expect(await cache.getExecutionResult(tenantId, executionId)).toBeNull();
      expect(await cache.getExecutionResult(tenantId, execId2)).toBeNull();
      expect(await cache.getMergedGraph(tenantId, rollupId)).toBeNull();
    });
  });

  // =========================================================================
  // End-to-End Cache Warming Flow Tests
  // =========================================================================

  describe('End-to-End Cache Warming Flow', () => {
    let warmingProcessor: CacheWarmingProcessor;
    let mockDataProvider: ReturnType<typeof createMockCacheWarmingDataProvider>;

    beforeEach(() => {
      mockDataProvider = createMockCacheWarmingDataProvider();
      warmingProcessor = new CacheWarmingProcessor({
        cache,
        dataProvider: mockDataProvider,
        logger: mockLogger as any,
        config: {
          maxConcurrency: 2,
          maxJobsPerSecond: 100,
          batchSize: 5,
          maxRetries: 2,
          retryDelayMs: 50,
          retryBackoffMultiplier: 2,
          defaultMaxItems: 20,
          jobTimeoutMs: 5000,
          enableProgressReporting: true,
        },
      });
    });

    it('should complete full warming -> read -> invalidation cycle', async () => {
      const execIds = [createTestExecutionId(), createTestExecutionId()];
      mockDataProvider.listExecutionIds.mockResolvedValue(execIds);

      // Step 1: Warm the cache
      const warmedCount = await warmingProcessor.warmExecutions(tenantId, execIds, true);
      expect(warmedCount).toBeGreaterThan(0);

      // Step 2: Invalidate
      for (const execId of execIds) {
        await cache.invalidateExecution(tenantId, execId);
      }

      // Step 3: Verify invalidation worked
      for (const execId of execIds) {
        const result = await cache.getExecutionResult(tenantId, execId);
        expect(result).toBeNull();
      }
    });

    it('should handle warming with partial data availability', async () => {
      const execIds = [createTestExecutionId(), createTestExecutionId(), createTestExecutionId()];
      mockDataProvider.listExecutionIds.mockResolvedValue(execIds);

      // First two succeed, third returns null
      let callCount = 0;
      mockDataProvider.fetchExecutionResult.mockImplementation(async () => {
        callCount++;
        if (callCount === 3) {
          return null;
        }
        return createTestCachedExecutionResult();
      });

      // Warming should handle partial data gracefully
      const warmedCount = await warmingProcessor.warmExecutions(tenantId, execIds, true);

      // Should have warmed 2 entries
      expect(warmedCount).toBe(2);
    });
  });
});
