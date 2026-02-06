/**
 * Rollup Cache Mocks
 * @module services/rollup/rollup-cache/__tests__/mocks
 *
 * Mock implementations for rollup cache testing.
 * Provides mock Redis cache, LRU cache, and data providers.
 */

import { vi, type Mock } from 'vitest';
import type { IRollupCache, ICacheKeyBuilder, CacheStats, CacheTag, CacheKey } from '../interfaces.js';
import type { ICacheWarmingDataProvider, CacheWarmingJobStatus, CacheWarmingJobState } from '../cache-warming-processor.js';
import type { ICacheInvalidationService, InvalidationEvent, InvalidationListener } from '../cache-invalidation-service.js';
import type { TenantId } from '../../../../types/entities.js';
import type { RollupId, RollupExecutionId } from '../../../../types/rollup.js';
import { createEmptyCacheStats, createCacheKey, createCacheTag } from '../interfaces.js';
import {
  createTestCachedExecutionResult,
  createTestCachedMergedGraph,
  createTestCachedBlastRadius,
  createTestExecutionId,
  createTestRollupId,
} from './fixtures.js';

// ============================================================================
// Mock Redis Cache
// ============================================================================

export interface MockRedisCache {
  get: Mock;
  set: Mock;
  delete: Mock;
  deleteByPattern: Mock;
  clear: Mock;
  size: Mock;
  _store: Map<string, { value: unknown; expiresAt: number }>;
  _reset: () => void;
}

export function createMockRedisCache(): MockRedisCache {
  const store = new Map<string, { value: unknown; expiresAt: number }>();

  const mockCache: MockRedisCache = {
    _store: store,
    _reset: () => {
      store.clear();
      vi.clearAllMocks();
    },
    get: vi.fn().mockImplementation(async <T>(key: string): Promise<T | null> => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt < Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    }),
    set: vi.fn().mockImplementation(async (key: string, value: unknown, ttlSeconds: number): Promise<void> => {
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    }),
    delete: vi.fn().mockImplementation(async (key: string): Promise<boolean> => {
      return store.delete(key);
    }),
    deleteByPattern: vi.fn().mockImplementation(async (pattern: string): Promise<number> => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      let count = 0;
      for (const key of store.keys()) {
        if (regex.test(key)) {
          store.delete(key);
          count++;
        }
      }
      return count;
    }),
    clear: vi.fn().mockImplementation(async (): Promise<void> => {
      store.clear();
    }),
    size: vi.fn().mockImplementation((): number => store.size),
  };

  return mockCache;
}

// ============================================================================
// Mock LRU Cache
// ============================================================================

export interface MockLRUCache<K, V> {
  get: Mock;
  set: Mock;
  delete: Mock;
  clear: Mock;
  has: Mock;
  size: number;
  _store: Map<K, V>;
  _reset: () => void;
}

export function createMockLRUCache<K, V>(maxSize: number = 100): MockLRUCache<K, V> {
  const store = new Map<K, V>();

  const mockCache: MockLRUCache<K, V> = {
    _store: store,
    _reset: () => {
      store.clear();
      vi.clearAllMocks();
    },
    get size() {
      return store.size;
    },
    get: vi.fn().mockImplementation((key: K): V | undefined => {
      return store.get(key);
    }),
    set: vi.fn().mockImplementation((key: K, value: V): void => {
      if (store.size >= maxSize && !store.has(key)) {
        // Evict oldest (first) entry
        const firstKey = store.keys().next().value;
        if (firstKey !== undefined) {
          store.delete(firstKey);
        }
      }
      store.set(key, value);
    }),
    delete: vi.fn().mockImplementation((key: K): boolean => {
      return store.delete(key);
    }),
    clear: vi.fn().mockImplementation((): void => {
      store.clear();
    }),
    has: vi.fn().mockImplementation((key: K): boolean => {
      return store.has(key);
    }),
  };

  return mockCache;
}

// ============================================================================
// Mock Rollup Cache
// ============================================================================

export interface MockRollupCache extends IRollupCache {
  _stats: CacheStats;
  _reset: () => void;
}

export function createMockRollupCache(): MockRollupCache {
  let stats = createEmptyCacheStats();

  const mockCache: MockRollupCache = {
    _stats: stats,
    _reset: () => {
      stats = createEmptyCacheStats();
      vi.clearAllMocks();
    },
    getExecutionResult: vi.fn().mockResolvedValue(null),
    setExecutionResult: vi.fn().mockResolvedValue(undefined),
    invalidateExecution: vi.fn().mockResolvedValue(1),
    getMergedGraph: vi.fn().mockResolvedValue(null),
    setMergedGraph: vi.fn().mockResolvedValue(undefined),
    invalidateMergedGraph: vi.fn().mockResolvedValue(1),
    getBlastRadius: vi.fn().mockResolvedValue(null),
    setBlastRadius: vi.fn().mockResolvedValue(undefined),
    invalidateBlastRadius: vi.fn().mockResolvedValue(1),
    invalidateByTag: vi.fn().mockResolvedValue(1),
    invalidateByTags: vi.fn().mockResolvedValue(1),
    invalidateTenant: vi.fn().mockResolvedValue(10),
    getStats: vi.fn().mockReturnValue(stats),
    resetStats: vi.fn().mockImplementation(() => {
      stats = createEmptyCacheStats();
    }),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };

  return mockCache;
}

// ============================================================================
// Mock Cache Key Builder
// ============================================================================

export function createMockCacheKeyBuilder(): ICacheKeyBuilder {
  return {
    buildExecutionKey: vi.fn().mockImplementation((tenantId: TenantId, executionId: RollupExecutionId) =>
      createCacheKey(`rollup:v1:${tenantId}:execution:${executionId}`)
    ),
    buildMergedGraphKey: vi.fn().mockImplementation((tenantId: TenantId, rollupId: RollupId) =>
      createCacheKey(`rollup:v1:${tenantId}:merged_graph:${rollupId}`)
    ),
    buildBlastRadiusKey: vi.fn().mockImplementation((tenantId: TenantId, nodeId: string, depth: number) =>
      createCacheKey(`rollup:v1:${tenantId}:blast_radius:${nodeId}:depth=${depth}`)
    ),
    buildTagSetKey: vi.fn().mockImplementation((tagType: string, tagValue: string) =>
      createCacheKey(`rollup:v1:tag:${tagType}:${tagValue}`)
    ),
    createTenantTag: vi.fn().mockImplementation((tenantId: TenantId) =>
      createCacheTag(`tenant:${tenantId}`)
    ),
    createRollupTag: vi.fn().mockImplementation((tenantId: TenantId, rollupId: RollupId) =>
      createCacheTag(`rollup:${tenantId}:${rollupId}`)
    ),
    createExecutionTag: vi.fn().mockImplementation((tenantId: TenantId, executionId: RollupExecutionId) =>
      createCacheTag(`execution:${tenantId}:${executionId}`)
    ),
    createNodeTag: vi.fn().mockImplementation((tenantId: TenantId, nodeId: string) =>
      createCacheTag(`node:${tenantId}:${nodeId}`)
    ),
    parseKey: vi.fn().mockReturnValue(null),
    getVersion: vi.fn().mockReturnValue('v1'),
    buildPattern: vi.fn().mockImplementation((tenantId: TenantId) =>
      `rollup:v1:${tenantId}:*`
    ),
    generateExecutionTags: vi.fn().mockImplementation((tenantId: TenantId, executionId: RollupExecutionId, rollupId: RollupId) => [
      createCacheTag(`tenant:${tenantId}`),
      createCacheTag(`rollup:${tenantId}:${rollupId}`),
      createCacheTag(`execution:${tenantId}:${executionId}`),
    ]),
    generateMergedGraphTags: vi.fn().mockImplementation((tenantId: TenantId, rollupId: RollupId) => [
      createCacheTag(`tenant:${tenantId}`),
      createCacheTag(`rollup:${tenantId}:${rollupId}`),
    ]),
    generateBlastRadiusTags: vi.fn().mockImplementation((tenantId: TenantId, nodeId: string, rollupId?: RollupId) => {
      const tags = [
        createCacheTag(`tenant:${tenantId}`),
        createCacheTag(`node:${tenantId}:${nodeId}`),
      ];
      if (rollupId) {
        tags.push(createCacheTag(`rollup:${tenantId}:${rollupId}`));
      }
      return tags;
    }),
  };
}

// ============================================================================
// Mock Cache Warming Data Provider
// ============================================================================

export function createMockCacheWarmingDataProvider(): ICacheWarmingDataProvider {
  return {
    fetchExecutionResult: vi.fn().mockResolvedValue(createTestCachedExecutionResult()),
    fetchMergedGraph: vi.fn().mockResolvedValue(createTestCachedMergedGraph()),
    listExecutionIds: vi.fn().mockResolvedValue([
      createTestExecutionId(),
      createTestExecutionId(),
      createTestExecutionId(),
    ]),
    listRollupIds: vi.fn().mockResolvedValue([
      createTestRollupId(),
      createTestRollupId(),
    ]),
  };
}

// ============================================================================
// Mock Cache Invalidation Service
// ============================================================================

export function createMockCacheInvalidationService(): ICacheInvalidationService & { _listeners: Set<InvalidationListener> } {
  const listeners = new Set<InvalidationListener>();

  return {
    _listeners: listeners,
    registerTags: vi.fn().mockResolvedValue(undefined),
    invalidateByTag: vi.fn().mockResolvedValue(5),
    invalidateByTags: vi.fn().mockResolvedValue(10),
    getTagMembers: vi.fn().mockResolvedValue([]),
    onInvalidate: vi.fn().mockImplementation((listener: InvalidationListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    startSubscription: vi.fn().mockResolvedValue(undefined),
    stopSubscription: vi.fn().mockResolvedValue(undefined),
    publishInvalidation: vi.fn().mockResolvedValue(undefined),
  };
}

// ============================================================================
// Mock Logger
// ============================================================================

export function createMockLogger() {
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
// Mock Redis Client
// ============================================================================

export function createMockRedisClient() {
  const store = new Map<string, string>();
  const sets = new Map<string, Set<string>>();

  return {
    get: vi.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    set: vi.fn().mockImplementation((key: string, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    setex: vi.fn().mockImplementation((key: string, _ttl: number, value: string) => {
      store.set(key, value);
      return Promise.resolve('OK');
    }),
    del: vi.fn().mockImplementation((key: string) => {
      const existed = store.delete(key);
      return Promise.resolve(existed ? 1 : 0);
    }),
    expire: vi.fn().mockResolvedValue(1),
    sadd: vi.fn().mockImplementation((key: string, ...members: string[]) => {
      if (!sets.has(key)) sets.set(key, new Set());
      members.forEach(m => sets.get(key)!.add(m));
      return Promise.resolve(members.length);
    }),
    smembers: vi.fn().mockImplementation((key: string) => {
      const set = sets.get(key);
      return Promise.resolve(set ? Array.from(set) : []);
    }),
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
    _store: store,
    _sets: sets,
    _reset: () => {
      store.clear();
      sets.clear();
    },
  };
}
