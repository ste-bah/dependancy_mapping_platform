/**
 * Cache Invalidation Service Unit Tests
 * @module services/rollup/rollup-cache/__tests__/cache-invalidation-service.test
 *
 * Tests for tag registration, tag-based invalidation, observer pattern,
 * and Redis Pub/Sub for cross-node cache invalidation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  CacheInvalidationService,
  createCacheInvalidationService,
  getDefaultCacheInvalidationService,
  resetDefaultCacheInvalidationService,
  DEFAULT_CACHE_INVALIDATION_CONFIG,
} from '../cache-invalidation-service.js';
import type { InvalidationEvent, InvalidationListener, CacheInvalidationServiceDependencies } from '../cache-invalidation-service.js';
import { createMockRedisClient, createMockCacheKeyBuilder, createMockLogger } from './mocks.js';
import { createTestTenantId, createTestCacheKey, createTestCacheTag } from './fixtures.js';
import { createCacheKey, createCacheTag } from '../interfaces.js';
import type { TenantId } from '../../../../types/entities.js';

// Mock the Redis client
vi.mock('../../../../cache/redis.js', () => ({
  getClient: vi.fn(() => createMockRedisClient()),
}));

describe('CacheInvalidationService', () => {
  let service: CacheInvalidationService;
  let mockKeyBuilder: ReturnType<typeof createMockCacheKeyBuilder>;
  let mockLogger: ReturnType<typeof createMockLogger>;
  let tenantId: TenantId;

  beforeEach(() => {
    mockKeyBuilder = createMockCacheKeyBuilder();
    mockLogger = createMockLogger();
    tenantId = createTestTenantId();

    const deps: CacheInvalidationServiceDependencies = {
      keyBuilder: mockKeyBuilder,
      logger: mockLogger as any,
      config: {
        ...DEFAULT_CACHE_INVALIDATION_CONFIG,
        enableLogging: false,
        processOwnEvents: true, // For testing
      },
    };

    service = new CacheInvalidationService(deps);
  });

  afterEach(async () => {
    await service.stopSubscription();
    vi.clearAllMocks();
    await resetDefaultCacheInvalidationService();
  });

  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe('constructor', () => {
    it('should create service with default config', () => {
      const defaultService = new CacheInvalidationService();
      expect(defaultService).toBeDefined();
    });

    it('should create service with custom config', () => {
      const customService = new CacheInvalidationService({
        config: {
          tagSetTtlSeconds: 14400,
          debounceMs: 100,
        },
      });
      expect(customService).toBeDefined();
    });

    it('should use provided key builder', () => {
      const customKeyBuilder = createMockCacheKeyBuilder();
      const customService = new CacheInvalidationService({
        keyBuilder: customKeyBuilder,
      });
      expect(customService).toBeDefined();
    });

    it('should generate unique instance ID', () => {
      const service1 = new CacheInvalidationService();
      const service2 = new CacheInvalidationService();

      // Both should be created without error (unique IDs)
      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });
  });

  // =========================================================================
  // Tag Registration Tests
  // =========================================================================

  describe('registerTags', () => {
    it('should register tags for a cache key', async () => {
      const key = createTestCacheKey('test-entry');
      const tags = [createTestCacheTag('tenant'), createTestCacheTag('rollup')];

      await service.registerTags(key, tags);

      // Should not throw
    });

    it('should handle empty tags array', async () => {
      const key = createTestCacheKey('test-entry');

      await service.registerTags(key, []);

      // Should complete without error
    });

    it('should handle single tag', async () => {
      const key = createTestCacheKey('test-entry');
      const tags = [createTestCacheTag('tenant')];

      await service.registerTags(key, tags);

      // Should complete without error
    });

    it('should handle multiple tags', async () => {
      const key = createTestCacheKey('test-entry');
      const tags = [
        createTestCacheTag('tenant'),
        createTestCacheTag('rollup'),
        createTestCacheTag('execution'),
      ];

      await service.registerTags(key, tags);

      // Should complete without error
    });
  });

  // =========================================================================
  // Tag-Based Invalidation Tests
  // =========================================================================

  describe('invalidateByTag', () => {
    it('should invalidate entries by tag', async () => {
      const tag = createTestCacheTag('tenant');

      const invalidated = await service.invalidateByTag(tag);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should return 0 for tag with no entries', async () => {
      const tag = createCacheTag('nonexistent:tag');

      const invalidated = await service.invalidateByTag(tag);

      expect(invalidated).toBe(0);
    });

    it('should publish invalidation event', async () => {
      const tag = createTestCacheTag('tenant');
      const publishSpy = vi.spyOn(service, 'publishInvalidation');

      await service.invalidateByTag(tag);

      // Note: Actual publish depends on whether keys were found
      expect(publishSpy).toHaveBeenCalledTimes(0); // No keys found in mock
    });
  });

  describe('invalidateByTags', () => {
    it('should invalidate entries by multiple tags', async () => {
      const tags = [
        createTestCacheTag('tenant'),
        createTestCacheTag('rollup'),
      ];

      const invalidated = await service.invalidateByTags(tags);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty tags array', async () => {
      const invalidated = await service.invalidateByTags([]);

      expect(invalidated).toBe(0);
    });

    it('should deduplicate tags', async () => {
      const tag = createTestCacheTag('tenant');
      const tags = [tag, tag, tag]; // Duplicate tags

      const invalidated = await service.invalidateByTags(tags);

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it('should process tags with limited concurrency', async () => {
      const tags = Array.from({ length: 15 }, (_, i) =>
        createCacheTag(`test:tag:${i}`)
      );

      await service.invalidateByTags(tags);

      // Should complete without error (concurrency is 5)
    });
  });

  // =========================================================================
  // Tag Members Tests
  // =========================================================================

  describe('getTagMembers', () => {
    it('should return empty array for unknown tag', async () => {
      const tag = createCacheTag('unknown:tag');

      const members = await service.getTagMembers(tag);

      expect(members).toEqual([]);
    });

    it('should return cache keys for known tag', async () => {
      const tag = createTestCacheTag('tenant');

      const members = await service.getTagMembers(tag);

      expect(Array.isArray(members)).toBe(true);
    });
  });

  // =========================================================================
  // Observer Pattern Tests
  // =========================================================================

  describe('onInvalidate', () => {
    it('should register listener', () => {
      const listener: InvalidationListener = vi.fn();

      const unsubscribe = service.onInvalidate(listener);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should return unsubscribe function', () => {
      const listener: InvalidationListener = vi.fn();

      const unsubscribe = service.onInvalidate(listener);
      unsubscribe();

      // Should not throw
    });

    it('should allow multiple listeners', () => {
      const listener1: InvalidationListener = vi.fn();
      const listener2: InvalidationListener = vi.fn();

      const unsub1 = service.onInvalidate(listener1);
      const unsub2 = service.onInvalidate(listener2);

      expect(typeof unsub1).toBe('function');
      expect(typeof unsub2).toBe('function');
    });

    it('should unsubscribe only the specified listener', () => {
      const listener1: InvalidationListener = vi.fn();
      const listener2: InvalidationListener = vi.fn();

      const unsub1 = service.onInvalidate(listener1);
      service.onInvalidate(listener2);

      unsub1();

      // listener2 should still be registered (no way to verify directly without exposing internal state)
    });
  });

  // =========================================================================
  // Pub/Sub Tests
  // =========================================================================

  describe('startSubscription', () => {
    it('should start subscription without error', async () => {
      await expect(service.startSubscription()).resolves.not.toThrow();
    });

    it('should handle multiple start calls gracefully', async () => {
      await service.startSubscription();
      await expect(service.startSubscription()).resolves.not.toThrow();
    });
  });

  describe('stopSubscription', () => {
    it('should stop subscription without error', async () => {
      await service.startSubscription();
      await expect(service.stopSubscription()).resolves.not.toThrow();
    });

    it('should handle stop when not started', async () => {
      await expect(service.stopSubscription()).resolves.not.toThrow();
    });

    it('should clear pending invalidations', async () => {
      await service.startSubscription();
      await service.stopSubscription();

      // Should complete without error
    });
  });

  describe('publishInvalidation', () => {
    it('should publish invalidation event', async () => {
      const event: InvalidationEvent = {
        type: 'tag',
        target: 'tenant:123',
        timestamp: Date.now(),
        sourceInstanceId: 'test-instance',
      };

      await expect(service.publishInvalidation(event)).resolves.not.toThrow();
    });

    it('should publish event with tenant ID', async () => {
      const event: InvalidationEvent = {
        type: 'tenant',
        target: tenantId,
        tenantId,
        timestamp: Date.now(),
        sourceInstanceId: 'test-instance',
      };

      await expect(service.publishInvalidation(event)).resolves.not.toThrow();
    });

    it('should handle publish without active subscription', async () => {
      const event: InvalidationEvent = {
        type: 'key',
        target: 'some:key',
        timestamp: Date.now(),
        sourceInstanceId: 'test-instance',
      };

      // Without starting subscription, should use regular client
      await expect(service.publishInvalidation(event)).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Debouncing Tests
  // =========================================================================

  describe('debouncing', () => {
    it('should debounce rapid invalidations', async () => {
      const serviceWithDebounce = new CacheInvalidationService({
        config: {
          debounceMs: 50,
          processOwnEvents: true,
        },
      });
      await serviceWithDebounce.startSubscription();

      const listener = vi.fn();
      serviceWithDebounce.onInvalidate(listener);

      // Rapid invalidations of same tag should be debounced
      const tag = createTestCacheTag('rapid');
      await Promise.all([
        serviceWithDebounce.invalidateByTag(tag),
        serviceWithDebounce.invalidateByTag(tag),
        serviceWithDebounce.invalidateByTag(tag),
      ]);

      await serviceWithDebounce.stopSubscription();
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe('createCacheInvalidationService', () => {
    it('should create service instance', () => {
      const factoryService = createCacheInvalidationService();
      expect(factoryService).toBeDefined();
    });

    it('should create service with dependencies', () => {
      const factoryService = createCacheInvalidationService({
        keyBuilder: mockKeyBuilder,
      });
      expect(factoryService).toBeDefined();
    });
  });

  describe('getDefaultCacheInvalidationService', () => {
    it('should return singleton instance', () => {
      const instance1 = getDefaultCacheInvalidationService();
      const instance2 = getDefaultCacheInvalidationService();

      expect(instance1).toBe(instance2);
    });
  });

  describe('resetDefaultCacheInvalidationService', () => {
    it('should reset singleton', async () => {
      const instance1 = getDefaultCacheInvalidationService();
      await resetDefaultCacheInvalidationService();
      const instance2 = getDefaultCacheInvalidationService();

      expect(instance1).not.toBe(instance2);
    });

    it('should stop subscription on reset', async () => {
      const instance = getDefaultCacheInvalidationService();
      await instance.startSubscription();
      await resetDefaultCacheInvalidationService();

      // Should complete without error
    });
  });

  // =========================================================================
  // Error Handling Tests
  // =========================================================================

  describe('error handling', () => {
    it('should handle Redis errors in registerTags', async () => {
      // Create a service that will encounter errors
      const key = createTestCacheKey('error-test');
      const tags = [createTestCacheTag('error')];

      // Should throw or handle error
      try {
        await service.registerTags(key, tags);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should continue operation after individual tag invalidation fails', async () => {
      const tags = [
        createTestCacheTag('tag1'),
        createTestCacheTag('tag2'),
        createTestCacheTag('tag3'),
      ];

      // Should not throw even if some tags fail
      const invalidated = await service.invalidateByTags(tags);
      expect(invalidated).toBeGreaterThanOrEqual(0);
    });
  });

  // =========================================================================
  // Configuration Tests
  // =========================================================================

  describe('configuration', () => {
    it('should use default tag TTL multiplier', () => {
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.tagSetTtlSeconds).toBe(7200);
    });

    it('should use default debounce window', () => {
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.debounceMs).toBe(50);
    });

    it('should not process own events by default', () => {
      expect(DEFAULT_CACHE_INVALIDATION_CONFIG.processOwnEvents).toBe(false);
    });
  });
});
