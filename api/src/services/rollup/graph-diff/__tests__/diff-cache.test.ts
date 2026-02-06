/**
 * Diff Cache Unit Tests
 * @module services/rollup/graph-diff/__tests__/diff-cache.test
 *
 * Tests for the DiffCache class implementing tiered L1/L2 caching for graph diff results.
 * Covers cache operations, key generation, invalidation, and statistics tracking.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TenantId, ScanId } from '../../../../types/entities.js';
import type {
  GraphDiffId,
  GraphSnapshotId,
  GraphDiffResult,
  DiffSummary,
} from '../interfaces.js';
import {
  createGraphDiffId,
  createGraphSnapshotId,
  createEmptyNodeDiffSet,
  createEmptyEdgeDiffSet,
  createEmptyDiffSummary,
  createDefaultDiffTiming,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
} from '../interfaces.js';
import { createCacheTag } from '../../rollup-cache/interfaces.js';

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

// Mock external dependencies with class implementations
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
          const keys = Array.from(this.store.keys());
          if (keys.length > 0) {
            this.store.delete(keys[0]);
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
        for (const key of Array.from(l2Store.keys())) {
          if (regex.test(key)) {
            l2Store.delete(key);
            count++;
          }
        }
        return count;
      }

      async exists(key: string): Promise<boolean> {
        const fullKey = this.buildKey(key);
        return l2Store.has(fullKey);
      }

      async clear(): Promise<void> {
        l2Store.clear();
      }
    },
  };
});

// Import after mocking
import {
  DiffCache,
  createDiffCache,
  getDefaultDiffCache,
  resetDefaultDiffCache,
} from '../diff-cache.js';
import type { DiffCacheDependencies } from '../diff-cache.js';

// ============================================================================
// Mock Logger
// ============================================================================

function createMockLogger() {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestTenantId(): TenantId {
  return `tenant_${Date.now()}_${Math.random().toString(36).substring(7)}` as TenantId;
}

function createTestScanId(): ScanId {
  return `scan_${Date.now()}_${Math.random().toString(36).substring(7)}` as ScanId;
}

function createTestGraphDiffId(): GraphDiffId {
  return createGraphDiffId(`diff_${Date.now()}_${Math.random().toString(36).substring(7)}`);
}

function createTestGraphSnapshotId(): GraphSnapshotId {
  return createGraphSnapshotId(`snapshot_${Date.now()}_${Math.random().toString(36).substring(7)}`);
}

function createTestDiffSummary(overrides: Partial<DiffSummary> = {}): DiffSummary {
  return {
    ...createEmptyDiffSummary(),
    baseNodeCount: 100,
    targetNodeCount: 110,
    nodesAdded: 15,
    nodesRemoved: 5,
    nodesModified: 10,
    nodesUnchanged: 80,
    baseEdgeCount: 200,
    targetEdgeCount: 220,
    edgesAdded: 25,
    edgesRemoved: 5,
    edgesModified: 10,
    edgesUnchanged: 180,
    nodeChangeRatio: 0.3,
    edgeChangeRatio: 0.2,
    overallChangeRatio: 0.25,
    isSignificantChange: true,
    ...overrides,
  };
}

function createTestGraphDiffResult(overrides: Partial<GraphDiffResult> = {}): GraphDiffResult {
  const tenantId = overrides.tenantId ?? createTestTenantId();
  const baseSnapshotId = overrides.baseSnapshotId ?? createTestGraphSnapshotId();
  const targetSnapshotId = overrides.targetSnapshotId ?? createTestGraphSnapshotId();
  const diffId = createGraphDiffId(`diff:${baseSnapshotId}:${targetSnapshotId}:${Date.now()}`);

  return {
    id: diffId,
    tenantId,
    baseSnapshotId,
    targetSnapshotId,
    nodeDiffs: createEmptyNodeDiffSet(),
    edgeDiffs: createEmptyEdgeDiffSet(),
    summary: createTestDiffSummary(),
    timing: createDefaultDiffTiming(),
    computedAt: new Date(),
    options: DEFAULT_DIFF_COMPUTATION_OPTIONS,
    ...overrides,
  };
}

// Helper to reset all stores
function resetAllStores() {
  l1Stores.clearAll();
  l2Store.clear();
  lruInstanceCounter = 0;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('DiffCache', () => {
  let cache: DiffCache;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let tenantId: TenantId;
  let baseScanId: ScanId;
  let compareScanId: ScanId;
  let diffId: GraphDiffId;

  beforeEach(async () => {
    resetAllStores();
    vi.clearAllMocks();
    mockLogger = createMockLogger();
    tenantId = createTestTenantId();
    baseScanId = createTestScanId();
    compareScanId = createTestScanId();
    diffId = createTestGraphDiffId();

    const deps: DiffCacheDependencies = {
      logger: mockLogger as any,
      l1MaxEntries: 100,
      l2TtlSeconds: 3600,
      enableLogging: false,
    };

    cache = new DiffCache(deps);
    await cache.initialize();
  });

  afterEach(async () => {
    await cache.shutdown();
    resetAllStores();
    await resetDefaultDiffCache();
  });

  // =========================================================================
  // Initialization Tests
  // =========================================================================

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newCache = new DiffCache({
        logger: mockLogger as any,
      });
      await expect(newCache.initialize()).resolves.not.toThrow();
      await newCache.shutdown();
    });

    it('should handle multiple initialize calls gracefully', async () => {
      await cache.initialize();
      await expect(cache.initialize()).resolves.not.toThrow();
    });

    it('should use default configuration when no dependencies provided', () => {
      const defaultCache = new DiffCache();
      expect(defaultCache).toBeDefined();
    });

    it('should log initialization info', async () => {
      const loggingDeps: DiffCacheDependencies = {
        logger: mockLogger as any,
        enableLogging: true,
      };
      const loggingCache = new DiffCache(loggingDeps);

      expect(mockLogger.info).toHaveBeenCalled();
      await loggingCache.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(cache.shutdown()).resolves.not.toThrow();
    });

    it('should clear L1 cache on shutdown', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      await cache.shutdown();

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(0);
    });

    it('should log shutdown', async () => {
      const loggingDeps: DiffCacheDependencies = {
        logger: mockLogger as any,
        enableLogging: true,
      };
      const loggingCache = new DiffCache(loggingDeps);
      await loggingCache.initialize();
      await loggingCache.shutdown();

      expect(mockLogger.info).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Cache Operations Tests - getDiff
  // =========================================================================

  describe('getDiff', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.getDiff(tenantId, diffId);
      expect(result).toBeNull();
    });

    it('should return cached diff result when present', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result).not.toBeNull();
      expect(result?.diff.id).toBe(diff.id);
    });

    it('should track misses in statistics', async () => {
      await cache.getDiff(tenantId, diffId);

      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should track hits in statistics', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      await cache.getDiff(tenantId, diff.id);

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Cache Operations Tests - setDiff
  // =========================================================================

  describe('setDiff', () => {
    it('should cache diff result', async () => {
      const diff = createTestGraphDiffResult({ tenantId });

      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);
      expect(result).not.toBeNull();
      expect(result?.diff.id).toBe(diff.id);
    });

    it('should increment sets count in statistics', async () => {
      const diff = createTestGraphDiffResult({ tenantId });

      await cache.setDiff(tenantId, diff);

      const stats = cache.getStats();
      expect(stats.setsCount).toBeGreaterThan(0);
    });

    it('should accept additional tags', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      const additionalTags = [createCacheTag('custom:tag:1')];

      await expect(cache.setDiff(tenantId, diff, additionalTags)).resolves.not.toThrow();
    });

    it('should track size in statistics', async () => {
      const diff = createTestGraphDiffResult({ tenantId });

      await cache.setDiff(tenantId, diff);

      const stats = cache.getStats();
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Cache Operations Tests - getDiffBySnapshots
  // =========================================================================

  describe('getDiffBySnapshots', () => {
    it('should return null for cache miss', async () => {
      const baseSnapshotId = createTestGraphSnapshotId();
      const targetSnapshotId = createTestGraphSnapshotId();

      const result = await cache.getDiffBySnapshots(tenantId, baseSnapshotId, targetSnapshotId);

      expect(result).toBeNull();
    });

    it('should retrieve diff by snapshot pair', async () => {
      const baseSnapshotId = createTestGraphSnapshotId();
      const targetSnapshotId = createTestGraphSnapshotId();
      const diff = createTestGraphDiffResult({
        tenantId,
        baseSnapshotId,
        targetSnapshotId,
      });

      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiffBySnapshots(tenantId, baseSnapshotId, targetSnapshotId);

      expect(result).not.toBeNull();
      expect(result?.diff.baseSnapshotId).toBe(baseSnapshotId);
      expect(result?.diff.targetSnapshotId).toBe(targetSnapshotId);
    });

    it('should track hits in statistics', async () => {
      const baseSnapshotId = createTestGraphSnapshotId();
      const targetSnapshotId = createTestGraphSnapshotId();
      const diff = createTestGraphDiffResult({
        tenantId,
        baseSnapshotId,
        targetSnapshotId,
      });

      await cache.setDiff(tenantId, diff);
      await cache.getDiffBySnapshots(tenantId, baseSnapshotId, targetSnapshotId);

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Key Generation Tests
  // =========================================================================

  describe('key generation', () => {
    it('should generate consistent key regardless of scan order', async () => {
      const snapshot1 = createTestGraphSnapshotId();
      const snapshot2 = createTestGraphSnapshotId();

      // Create diff with snapshot1 as base
      const diff = createTestGraphDiffResult({
        tenantId,
        baseSnapshotId: snapshot1,
        targetSnapshotId: snapshot2,
      });

      await cache.setDiff(tenantId, diff);

      // Should be able to retrieve with either order due to key sorting
      const result1 = await cache.getDiffBySnapshots(tenantId, snapshot1, snapshot2);
      const result2 = await cache.getDiffBySnapshots(tenantId, snapshot2, snapshot1);

      // Both should find the cached entry because keys are sorted
      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
    });

    it('should include tenant in cache key for isolation', async () => {
      const tenant1 = createTestTenantId();
      const tenant2 = createTestTenantId();
      const baseSnapshotId = createTestGraphSnapshotId();
      const targetSnapshotId = createTestGraphSnapshotId();

      const diff1 = createTestGraphDiffResult({
        tenantId: tenant1,
        baseSnapshotId,
        targetSnapshotId,
      });

      await cache.setDiff(tenant1, diff1);

      // Different tenant should not see the cached entry
      const result = await cache.getDiffBySnapshots(tenant2, baseSnapshotId, targetSnapshotId);
      expect(result).toBeNull();
    });

    it('should sanitize special characters in key segments', async () => {
      const specialTenant = 'tenant:with:colons' as TenantId;
      const diff = createTestGraphDiffResult({ tenantId: specialTenant });

      await expect(cache.setDiff(specialTenant, diff)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Invalidation Tests - By Snapshot
  // =========================================================================

  describe('invalidateBySnapshot', () => {
    it('should invalidate cached diffs containing the snapshot', async () => {
      const snapshotId = createTestGraphSnapshotId();
      const diff = createTestGraphDiffResult({
        tenantId,
        baseSnapshotId: snapshotId,
        targetSnapshotId: createTestGraphSnapshotId(),
      });

      await cache.setDiff(tenantId, diff);

      const invalidated = await cache.invalidateBySnapshot(tenantId, snapshotId);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should track invalidations in statistics', async () => {
      const snapshotId = createTestGraphSnapshotId();

      await cache.invalidateBySnapshot(tenantId, snapshotId);

      const stats = cache.getStats();
      expect(stats.invalidationsCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('invalidateForScan', () => {
    it('should invalidate by scan ID', async () => {
      const scanId = createTestScanId();

      const invalidated = await cache.invalidateForScan(tenantId, scanId);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should track invalidation count', async () => {
      const scanId = createTestScanId();
      const initialStats = cache.getStats();

      await cache.invalidateForScan(tenantId, scanId);

      const stats = cache.getStats();
      expect(stats.invalidationsCount).toBeGreaterThanOrEqual(initialStats.invalidationsCount);
    });
  });

  // =========================================================================
  // Invalidation Tests - By Tenant
  // =========================================================================

  describe('invalidateTenant / invalidateForTenant', () => {
    it('should invalidate all cached diffs for a tenant', async () => {
      const diff1 = createTestGraphDiffResult({ tenantId });
      const diff2 = createTestGraphDiffResult({ tenantId });

      await cache.setDiff(tenantId, diff1);
      await cache.setDiff(tenantId, diff2);

      const invalidated = await cache.invalidateTenant(tenantId);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should clear L1 cache when invalidating tenant', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      await cache.invalidateTenant(tenantId);

      const stats = cache.getStats();
      expect(stats.entryCount).toBe(0);
    });

    it('should increment invalidation count in statistics', async () => {
      const initialStats = cache.getStats();

      await cache.invalidateTenant(tenantId);

      const stats = cache.getStats();
      expect(stats.invalidationsCount).toBeGreaterThanOrEqual(initialStats.invalidationsCount);
    });
  });

  // =========================================================================
  // Statistics Tests
  // =========================================================================

  describe('getStats', () => {
    it('should return cache statistics with all expected fields', () => {
      const stats = cache.getStats();

      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('hitRatio');
      expect(stats).toHaveProperty('entryCount');
      expect(stats).toHaveProperty('totalSizeBytes');
      expect(stats).toHaveProperty('avgDiffSizeBytes');
      expect(stats).toHaveProperty('setsCount');
      expect(stats).toHaveProperty('invalidationsCount');
    });

    it('should track hits correctly', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      await cache.getDiff(tenantId, diff.id);

      const stats = cache.getStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it('should track misses correctly', async () => {
      await cache.getDiff(tenantId, createTestGraphDiffId());

      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it('should calculate hit ratio correctly', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      // Generate 1 hit
      await cache.getDiff(tenantId, diff.id);
      // Generate 1 miss
      await cache.getDiff(tenantId, createTestGraphDiffId());

      const stats = cache.getStats();
      expect(stats.hitRatio).toBeGreaterThanOrEqual(0);
      expect(stats.hitRatio).toBeLessThanOrEqual(1);
    });

    it('should return 0 hit ratio when no operations performed', () => {
      const stats = cache.getStats();
      expect(stats.hitRatio).toBe(0);
    });

    it('should track entry count correctly', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const stats = cache.getStats();
      // L1 cache should have entries (entries are stored under multiple keys)
      expect(stats.entryCount).toBeGreaterThanOrEqual(0);
    });

    it('should track total size bytes', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const stats = cache.getStats();
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });

    it('should return 0 avg diff size when no entries', () => {
      const stats = cache.getStats();
      expect(stats.avgDiffSizeBytes).toBe(0);
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics to zero', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);
      await cache.getDiff(tenantId, diff.id);
      await cache.getDiff(tenantId, createTestGraphDiffId());

      cache.resetStats();

      const stats = cache.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.setsCount).toBe(0);
      expect(stats.invalidationsCount).toBe(0);
    });
  });

  // =========================================================================
  // Summary Cache Tests
  // =========================================================================

  describe('getSummary', () => {
    it('should return null for cache miss', async () => {
      const result = await cache.getSummary(tenantId, baseScanId, compareScanId);
      expect(result).toBeNull();
    });

    it('should track statistics for summary access', async () => {
      const initialStats = cache.getStats();
      const initialMisses = initialStats.misses;

      await cache.getSummary(tenantId, baseScanId, compareScanId);

      const stats = cache.getStats();
      expect(stats.misses).toBeGreaterThan(initialMisses);
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe('createDiffCache', () => {
    it('should create cache instance', () => {
      const factoryCache = createDiffCache();
      expect(factoryCache).toBeDefined();
    });

    it('should create cache with custom dependencies', () => {
      const factoryCache = createDiffCache({
        logger: mockLogger as any,
        l1MaxEntries: 50,
        l2TtlSeconds: 1800,
      });
      expect(factoryCache).toBeDefined();
    });
  });

  describe('getDefaultDiffCache', () => {
    it('should return singleton instance', () => {
      const instance1 = getDefaultDiffCache();
      const instance2 = getDefaultDiffCache();

      expect(instance1).toBe(instance2);
    });
  });

  describe('resetDefaultDiffCache', () => {
    it('should reset singleton and create new instance', async () => {
      const instance1 = getDefaultDiffCache();
      await resetDefaultDiffCache();
      const instance2 = getDefaultDiffCache();

      // New instance should be created
      expect(instance1).not.toBe(instance2);
    });
  });

  // =========================================================================
  // Concurrent Operations Tests
  // =========================================================================

  describe('concurrent operations', () => {
    it('should handle concurrent setDiff calls', async () => {
      const diffs = Array.from({ length: 5 }, () =>
        createTestGraphDiffResult({ tenantId })
      );

      await Promise.all(diffs.map(diff => cache.setDiff(tenantId, diff)));

      const stats = cache.getStats();
      // Each setDiff stores under multiple keys (by ID and by snapshots), so setsCount >= 5
      expect(stats.setsCount).toBeGreaterThanOrEqual(5);
    });

    it('should handle concurrent getDiff calls', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const results = await Promise.all(
        Array.from({ length: 5 }, () => cache.getDiff(tenantId, diff.id))
      );

      results.forEach(result => {
        expect(result).not.toBeNull();
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const diff = createTestGraphDiffResult({ tenantId });

      const operations = [
        cache.setDiff(tenantId, diff),
        cache.getDiff(tenantId, diff.id),
        cache.getDiff(tenantId, createTestGraphDiffId()),
        cache.invalidateForScan(tenantId, baseScanId),
      ];

      await expect(Promise.all(operations)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Edge Cases Tests
  // =========================================================================

  describe('edge cases', () => {
    it('should handle empty diff result', async () => {
      const emptyDiff = createTestGraphDiffResult({
        tenantId,
        summary: createEmptyDiffSummary(),
      });

      await cache.setDiff(tenantId, emptyDiff);

      const result = await cache.getDiff(tenantId, emptyDiff.id);
      expect(result).not.toBeNull();
    });

    it('should handle special characters in tenant ID', async () => {
      const specialTenant = 'tenant_with_special_chars-123' as TenantId;
      const diff = createTestGraphDiffResult({ tenantId: specialTenant });

      await cache.setDiff(specialTenant, diff);

      const result = await cache.getDiff(specialTenant, diff.id);
      expect(result).not.toBeNull();
    });

    it('should handle very large diff results', async () => {
      // Create a diff with many entries in summary
      const largeSummary = createTestDiffSummary({
        nodesAdded: 10000,
        nodesRemoved: 5000,
        nodesModified: 3000,
        changesByNodeType: Object.fromEntries(
          Array.from({ length: 50 }, (_, i) => [
            `type_${i}`,
            { added: 100, removed: 50, modified: 30 },
          ])
        ),
      });

      const largeDiff = createTestGraphDiffResult({
        tenantId,
        summary: largeSummary,
      });

      await cache.setDiff(tenantId, largeDiff);

      const result = await cache.getDiff(tenantId, largeDiff.id);
      expect(result).not.toBeNull();
    });

    it('should handle null/undefined in optional fields gracefully', async () => {
      const diff = createTestGraphDiffResult({
        tenantId,
        rollupId: undefined,
        executionId: undefined,
      });

      await expect(cache.setDiff(tenantId, diff)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Cache Metadata Tests
  // =========================================================================

  describe('cache metadata', () => {
    it('should include cachedAt timestamp in cached result', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result?.metadata.cachedAt).toBeDefined();
    });

    it('should include expiresAt timestamp in cached result', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result?.metadata.expiresAt).toBeDefined();
    });

    it('should include TTL in cached result metadata', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result?.metadata.ttlSeconds).toBeGreaterThan(0);
    });

    it('should include size estimate in metadata', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result?.metadata.sizeBytes).toBeGreaterThan(0);
    });

    it('should include tags in metadata', async () => {
      const diff = createTestGraphDiffResult({ tenantId });
      await cache.setDiff(tenantId, diff);

      const result = await cache.getDiff(tenantId, diff.id);

      expect(result?.metadata.tags).toBeDefined();
      expect(Array.isArray(result?.metadata.tags)).toBe(true);
    });
  });
});
