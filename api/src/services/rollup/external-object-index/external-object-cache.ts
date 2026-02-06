/**
 * External Object Cache
 * @module services/rollup/external-object-index/external-object-cache
 *
 * 3-tier caching implementation for external object lookups.
 * L1: In-memory LRU cache (TTL: 5 min)
 * L2: Redis cache (TTL: 1 hr)
 * L3: Database (persistent)
 *
 * Cache key pattern: ext-idx:{tenant}:{repo}:{hash}
 *
 * TASK-ROLLUP-003: External Object Index caching
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pino from 'pino';
import { LRUCache, RedisCache } from '../../../optimization/cache.js';
import { TenantId } from '../../../types/entities.js';
import type {
  IExternalObjectCache,
  ExternalObjectEntry,
  ExternalObjectCacheConfig,
  DEFAULT_EXTERNAL_OBJECT_CACHE_CONFIG,
} from './interfaces.js';
import { CacheError } from './errors.js';

const logger = pino({ name: 'external-object-cache' });

/**
 * Cache statistics
 */
interface CacheStats {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
}

/**
 * L1 cache entry with TTL
 */
interface L1CacheEntry {
  entries: ExternalObjectEntry[];
  expiresAt: number;
}

/**
 * 3-tier cache implementation for external object lookups.
 *
 * Architecture:
 * - L1 (In-Memory): Fastest, limited size, short TTL
 * - L2 (Redis): Distributed, larger capacity, longer TTL
 * - L3 (Database): Persistent storage (handled by repository)
 *
 * Lookup flow: L1 -> L2 -> L3 (database via repository)
 * Write flow: Write to all tiers (write-through)
 */
export class ExternalObjectCache implements IExternalObjectCache {
  private readonly config: ExternalObjectCacheConfig;
  private readonly l1Cache: LRUCache<string, L1CacheEntry>;
  private readonly l2Cache: RedisCache;
  private readonly stats: CacheStats;

  /**
   * Create a new ExternalObjectCache
   * @param config - Cache configuration
   */
  constructor(config: Partial<ExternalObjectCacheConfig> = {}) {
    this.config = {
      l1MaxSize: config.l1MaxSize ?? 10000,
      l1TtlSeconds: config.l1TtlSeconds ?? 300,
      l2TtlSeconds: config.l2TtlSeconds ?? 3600,
      keyPrefix: config.keyPrefix ?? 'ext-idx',
      enableL1: config.enableL1 ?? true,
      enableL2: config.enableL2 ?? true,
    };

    // Initialize L1 (in-memory) cache
    this.l1Cache = new LRUCache<string, L1CacheEntry>(this.config.l1MaxSize);

    // Initialize L2 (Redis) cache
    this.l2Cache = new RedisCache({
      namespace: this.config.keyPrefix,
      ttlSeconds: this.config.l2TtlSeconds,
    });

    // Initialize statistics
    this.stats = {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
    };

    logger.info(
      {
        l1MaxSize: this.config.l1MaxSize,
        l1TtlSeconds: this.config.l1TtlSeconds,
        l2TtlSeconds: this.config.l2TtlSeconds,
      },
      'External object cache initialized'
    );
  }

  /**
   * Get entries from cache
   * Implements read-through caching: L1 -> L2
   */
  async get(key: string): Promise<ExternalObjectEntry[] | null> {
    const startTime = Date.now();

    // Try L1 cache first
    if (this.config.enableL1) {
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && l1Entry.expiresAt > Date.now()) {
        this.stats.l1Hits++;
        logger.debug({ key, source: 'l1', timeMs: Date.now() - startTime }, 'Cache hit');
        return l1Entry.entries;
      }

      // L1 entry expired or not found
      if (l1Entry) {
        this.l1Cache.delete(key);
      }
      this.stats.l1Misses++;
    }

    // Try L2 cache
    if (this.config.enableL2) {
      try {
        const l2Entry = await this.l2Cache.get<ExternalObjectEntry[]>(key);
        if (l2Entry) {
          this.stats.l2Hits++;

          // Populate L1 cache on L2 hit
          if (this.config.enableL1) {
            this.setL1(key, l2Entry);
          }

          logger.debug({ key, source: 'l2', timeMs: Date.now() - startTime }, 'Cache hit');
          return l2Entry;
        }
        this.stats.l2Misses++;
      } catch (error) {
        logger.error({ error, key }, 'L2 cache read error');
        // Continue with cache miss on error
      }
    }

    logger.debug({ key, timeMs: Date.now() - startTime }, 'Cache miss');
    return null;
  }

  /**
   * Set entries in cache
   * Implements write-through caching: write to L1 and L2
   */
  async set(
    key: string,
    entries: ExternalObjectEntry[],
    ttlSeconds?: number
  ): Promise<void> {
    const l1Ttl = ttlSeconds ?? this.config.l1TtlSeconds;
    const l2Ttl = ttlSeconds ?? this.config.l2TtlSeconds;

    // Write to L1
    if (this.config.enableL1) {
      this.setL1(key, entries, l1Ttl);
    }

    // Write to L2
    if (this.config.enableL2) {
      try {
        await this.l2Cache.set(key, entries, l2Ttl);
        logger.debug({ key, entryCount: entries.length, l2Ttl }, 'Cache set');
      } catch (error) {
        logger.error({ error, key }, 'L2 cache write error');
        // Don't throw - L1 cache is still valid
      }
    }
  }

  /**
   * Delete entry from cache
   */
  async delete(key: string): Promise<void> {
    // Delete from L1
    if (this.config.enableL1) {
      this.l1Cache.delete(key);
    }

    // Delete from L2
    if (this.config.enableL2) {
      try {
        await this.l2Cache.delete(key);
      } catch (error) {
        logger.error({ error, key }, 'L2 cache delete error');
      }
    }

    logger.debug({ key }, 'Cache entry deleted');
  }

  /**
   * Delete entries by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    let deleted = 0;

    // L1: Can't do pattern matching efficiently, skip
    // We rely on TTL expiration for L1

    // L2: Use Redis SCAN for pattern deletion
    if (this.config.enableL2) {
      try {
        deleted = await this.l2Cache.deleteByPattern(pattern);
        logger.debug({ pattern, deleted }, 'Cache entries deleted by pattern');
      } catch (error) {
        logger.error({ error, pattern }, 'L2 cache pattern delete error');
        throw CacheError.invalidationFailed(pattern, error as Error);
      }
    }

    return deleted;
  }

  /**
   * Invalidate cache for a tenant
   */
  async invalidateTenant(tenantId: TenantId): Promise<void> {
    const pattern = `${tenantId}:*`;

    try {
      await this.deleteByPattern(pattern);
      logger.info({ tenantId }, 'Tenant cache invalidated');
    } catch (error) {
      logger.error({ error, tenantId }, 'Tenant cache invalidation error');
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    l1Hits: number;
    l1Misses: number;
    l2Hits: number;
    l2Misses: number;
    hitRatio: number;
  } {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalMisses = this.stats.l1Misses + this.stats.l2Misses;
    const total = totalHits + totalMisses;

    return {
      ...this.stats,
      hitRatio: total > 0 ? totalHits / total : 0,
    };
  }

  /**
   * Build a cache key
   */
  buildKey(tenantId: TenantId, externalId: string, repositoryId?: string): string {
    const hash = this.hashString(externalId);
    if (repositoryId) {
      return `${tenantId}:${repositoryId}:${hash}`;
    }
    return `${tenantId}:${hash}`;
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    // Clear L1
    this.l1Cache.clear();

    // Clear L2
    if (this.config.enableL2) {
      try {
        await this.deleteByPattern('*');
      } catch (error) {
        logger.error({ error }, 'L2 cache clear error');
      }
    }

    // Reset stats
    this.stats.l1Hits = 0;
    this.stats.l1Misses = 0;
    this.stats.l2Hits = 0;
    this.stats.l2Misses = 0;

    logger.info('Cache cleared');
  }

  /**
   * Get L1 cache size
   */
  getL1Size(): number {
    return this.l1Cache.size;
  }

  /**
   * Warm up cache with entries
   */
  async warmUp(entries: Map<string, ExternalObjectEntry[]>): Promise<number> {
    let warmedUp = 0;

    for (const [key, value] of entries) {
      await this.set(key, value);
      warmedUp++;
    }

    logger.info({ warmedUp }, 'Cache warmed up');
    return warmedUp;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Set entry in L1 cache with TTL
   */
  private setL1(key: string, entries: ExternalObjectEntry[], ttlSeconds?: number): void {
    const ttl = ttlSeconds ?? this.config.l1TtlSeconds;
    const expiresAt = Date.now() + ttl * 1000;

    this.l1Cache.set(key, { entries, expiresAt });
  }

  /**
   * Hash a string for cache key generation
   */
  private hashString(value: string): string {
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Default cache instance
 */
let defaultCache: ExternalObjectCache | null = null;

/**
 * Create a new ExternalObjectCache instance
 */
export function createExternalObjectCache(
  config?: Partial<ExternalObjectCacheConfig>
): ExternalObjectCache {
  return new ExternalObjectCache(config);
}

/**
 * Get the default cache instance
 */
export function getDefaultExternalObjectCache(): ExternalObjectCache {
  if (!defaultCache) {
    defaultCache = new ExternalObjectCache();
  }
  return defaultCache;
}

/**
 * Reset the default cache instance
 */
export async function resetDefaultExternalObjectCache(): Promise<void> {
  if (defaultCache) {
    await defaultCache.clear();
  }
  defaultCache = null;
}
