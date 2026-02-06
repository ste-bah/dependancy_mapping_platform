/**
 * Rollup Cache
 * @module services/rollup/rollup-cache/rollup-cache
 *
 * Tiered cache facade implementing read-through caching with L1 (LRU in-memory)
 * and L2 (Redis) layers for expensive rollup computations.
 *
 * Architecture:
 * - L1 (In-Memory): Fastest access, limited size, short TTL (5 min default)
 * - L2 (Redis): Distributed, larger capacity, longer TTL (1 hour default)
 *
 * Lookup Flow: L1 -> L2 -> miss (return null)
 * Write Flow: Write to both L1 and L2 (write-through)
 * Invalidation: Remove from both L1 and L2, clean up tag sets
 *
 * Features:
 * - Tag-based invalidation for efficient cache cleanup
 * - Graceful L2 degradation (L1 still works if Redis fails)
 * - Comprehensive statistics and metrics
 * - Tenant isolation
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pino from 'pino';
import { LRUCache, RedisCache } from '../../../optimization/cache.js';
import { TenantId } from '../../../types/entities.js';
import {
  RollupId,
  RollupExecutionId,
  RollupExecutionResult,
} from '../../../types/rollup.js';
import {
  IRollupCache,
  IRollupCacheConfig,
  ICacheKeyBuilder,
  CachedExecutionResult,
  CachedMergedGraph,
  CachedBlastRadius,
  CacheStats,
  CacheTag,
  CacheKey,
  CacheEntrySource,
  createCacheEntryMetadata,
  isCacheEntryValid,
  DEFAULT_ROLLUP_CACHE_CONFIG,
} from './interfaces.js';
import { createCacheKeyBuilder } from './cache-key-builder.js';

// ============================================================================
// Types
// ============================================================================

/**
 * L1 cache entry wrapper with TTL tracking
 */
interface L1CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
  readonly tags: readonly CacheTag[];
}

/**
 * Internal statistics tracking
 */
interface CacheStatsInternal {
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  setsCount: number;
  invalidationsCount: number;
  errorsCount: number;
  totalGetLatencyMs: number;
  totalSetLatencyMs: number;
  getOperations: number;
  setOperations: number;
}

/**
 * Dependencies for RollupCache construction
 */
export interface RollupCacheDependencies {
  /** Redis cache instance (optional, uses default if not provided) */
  readonly redisCache?: RedisCache;
  /** Cache key builder (optional, uses default if not provided) */
  readonly keyBuilder?: ICacheKeyBuilder;
  /** Configuration (optional, uses defaults if not provided) */
  readonly config?: Partial<IRollupCacheConfig>;
  /** Logger (optional, uses default if not provided) */
  readonly logger?: pino.Logger;
}

// ============================================================================
// Rollup Cache Implementation
// ============================================================================

/**
 * Tiered cache implementation for rollup computations.
 * Provides L1 (in-memory LRU) and L2 (Redis) caching with
 * read-through access and tag-based invalidation.
 */
export class RollupCache implements IRollupCache {
  private readonly l1ExecutionCache: LRUCache<string, L1CacheEntry<CachedExecutionResult>>;
  private readonly l1GraphCache: LRUCache<string, L1CacheEntry<CachedMergedGraph>>;
  private readonly l1BlastRadiusCache: LRUCache<string, L1CacheEntry<CachedBlastRadius>>;
  private readonly l2Cache: RedisCache;
  private readonly keyBuilder: ICacheKeyBuilder;
  private readonly config: IRollupCacheConfig;
  private readonly logger: pino.Logger;
  private stats: CacheStatsInternal;
  private initialized: boolean = false;

  /**
   * Create a new RollupCache
   * @param deps - Dependencies for cache construction
   */
  constructor(deps: RollupCacheDependencies = {}) {
    // Merge config with defaults
    this.config = {
      ...DEFAULT_ROLLUP_CACHE_CONFIG,
      ...deps.config,
      l1: {
        ...DEFAULT_ROLLUP_CACHE_CONFIG.l1,
        ...deps.config?.l1,
      },
      l2: {
        ...DEFAULT_ROLLUP_CACHE_CONFIG.l2,
        ...deps.config?.l2,
      },
    };

    // Initialize logger
    this.logger = deps.logger ?? pino({ name: 'rollup-cache' });

    // Initialize key builder
    this.keyBuilder = deps.keyBuilder ?? createCacheKeyBuilder(this.config.version);

    // Initialize L1 caches
    this.l1ExecutionCache = new LRUCache<string, L1CacheEntry<CachedExecutionResult>>(
      this.config.l1.executionMaxSize
    );
    this.l1GraphCache = new LRUCache<string, L1CacheEntry<CachedMergedGraph>>(
      this.config.l1.graphMaxSize
    );
    this.l1BlastRadiusCache = new LRUCache<string, L1CacheEntry<CachedBlastRadius>>(
      this.config.l1.blastRadiusMaxSize
    );

    // Initialize L2 cache
    this.l2Cache = deps.redisCache ?? new RedisCache({
      namespace: this.config.l2.keyPrefix,
      ttlSeconds: this.config.l2.executionTtlSeconds,
    });

    // Initialize statistics
    this.stats = this.createEmptyStats();

    this.logger.info(
      {
        l1ExecutionMaxSize: this.config.l1.executionMaxSize,
        l1GraphMaxSize: this.config.l1.graphMaxSize,
        l1BlastRadiusMaxSize: this.config.l1.blastRadiusMaxSize,
        l1TtlSeconds: this.config.l1.ttlSeconds,
        l2ExecutionTtlSeconds: this.config.l2.executionTtlSeconds,
        l2GraphTtlSeconds: this.config.l2.graphTtlSeconds,
        l2BlastRadiusTtlSeconds: this.config.l2.blastRadiusTtlSeconds,
        version: this.config.version,
      },
      'Rollup cache initialized'
    );
  }

  // =========================================================================
  // Initialization and Shutdown
  // =========================================================================

  /**
   * Initialize the cache (verify Redis connection, etc.)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify L2 connection if enabled
      if (this.config.l2.enabled) {
        const testKey = `${this.config.l2.keyPrefix}:_health_check`;
        await this.l2Cache.set(testKey, { healthy: true }, 10);
        const result = await this.l2Cache.get<{ healthy: boolean }>(testKey);
        if (!result?.healthy) {
          this.logger.warn('L2 cache health check failed, continuing with L1 only');
        }
      }

      this.initialized = true;
      this.logger.info('Rollup cache initialization complete');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize rollup cache');
      // Don't throw - allow operation with L1 only
      this.initialized = true;
    }
  }

  /**
   * Shutdown the cache (close connections, etc.)
   */
  async shutdown(): Promise<void> {
    this.l1ExecutionCache.clear();
    this.l1GraphCache.clear();
    this.l1BlastRadiusCache.clear();
    this.initialized = false;
    this.logger.info('Rollup cache shutdown complete');
  }

  // =========================================================================
  // Execution Result Cache
  // =========================================================================

  /**
   * Get cached execution result
   * Implements read-through: L1 -> L2 -> miss
   */
  async getExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<CachedExecutionResult | null> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildExecutionKey(tenantId, executionId);

    try {
      // Try L1 cache first
      if (this.config.l1.enabled) {
        const l1Entry = this.l1ExecutionCache.get(key);
        if (l1Entry && l1Entry.expiresAt > Date.now()) {
          this.stats.l1Hits++;
          this.recordGetLatency(startTime);
          this.logCacheHit('execution', key, 'l1');
          return l1Entry.data;
        }

        // L1 entry expired or not found
        if (l1Entry) {
          this.l1ExecutionCache.delete(key);
        }
        this.stats.l1Misses++;
      }

      // Try L2 cache
      if (this.config.l2.enabled) {
        const l2Entry = await this.safeL2Get<CachedExecutionResult>(key);
        if (l2Entry && isCacheEntryValid(l2Entry.metadata)) {
          this.stats.l2Hits++;

          // Populate L1 on L2 hit
          if (this.config.l1.enabled) {
            this.setL1ExecutionCache(key, l2Entry);
          }

          this.recordGetLatency(startTime);
          this.logCacheHit('execution', key, 'l2');
          return l2Entry;
        }
        this.stats.l2Misses++;
      }

      this.recordGetLatency(startTime);
      this.logCacheMiss('execution', key);
      return null;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, executionId }, 'Error getting execution result from cache');
      return null;
    }
  }

  /**
   * Cache execution result
   * Implements write-through: write to both L1 and L2
   */
  async setExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId,
    rollupId: RollupId,
    result: RollupExecutionResult,
    additionalTags: readonly CacheTag[] = []
  ): Promise<void> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildExecutionKey(tenantId, executionId);
    const tags = [
      ...this.keyBuilder.generateExecutionTags(tenantId, executionId, rollupId),
      ...additionalTags,
    ] as readonly CacheTag[];

    const metadata = createCacheEntryMetadata(
      this.config.l2.executionTtlSeconds,
      'computation' as CacheEntrySource,
      tags,
      this.estimateSize(result)
    );

    const cachedResult: CachedExecutionResult = {
      data: result,
      rollupId,
      metadata,
    };

    try {
      // Write to L1
      if (this.config.l1.enabled) {
        this.setL1ExecutionCache(key, cachedResult);
      }

      // Write to L2
      if (this.config.l2.enabled) {
        await this.safeL2Set(key, cachedResult, this.config.l2.executionTtlSeconds);
        await this.registerKeyWithTags(key, tags);
      }

      this.stats.setsCount++;
      this.recordSetLatency(startTime);
      this.logCacheSet('execution', key);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, executionId }, 'Error setting execution result in cache');
    }
  }

  /**
   * Invalidate cached execution result
   */
  async invalidateExecution(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<number> {
    const key = this.keyBuilder.buildExecutionKey(tenantId, executionId);
    return this.invalidateKey(key, 'execution');
  }

  // =========================================================================
  // Merged Graph Cache
  // =========================================================================

  /**
   * Get cached merged graph
   */
  async getMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<CachedMergedGraph | null> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildMergedGraphKey(tenantId, rollupId);

    try {
      // Try L1 cache first
      if (this.config.l1.enabled) {
        const l1Entry = this.l1GraphCache.get(key);
        if (l1Entry && l1Entry.expiresAt > Date.now()) {
          this.stats.l1Hits++;
          this.recordGetLatency(startTime);
          this.logCacheHit('merged_graph', key, 'l1');
          return l1Entry.data;
        }

        if (l1Entry) {
          this.l1GraphCache.delete(key);
        }
        this.stats.l1Misses++;
      }

      // Try L2 cache
      if (this.config.l2.enabled) {
        const l2Entry = await this.safeL2Get<CachedMergedGraph>(key);
        if (l2Entry && isCacheEntryValid(l2Entry.metadata)) {
          this.stats.l2Hits++;

          if (this.config.l1.enabled) {
            this.setL1GraphCache(key, l2Entry);
          }

          this.recordGetLatency(startTime);
          this.logCacheHit('merged_graph', key, 'l2');
          return l2Entry;
        }
        this.stats.l2Misses++;
      }

      this.recordGetLatency(startTime);
      this.logCacheMiss('merged_graph', key);
      return null;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, rollupId }, 'Error getting merged graph from cache');
      return null;
    }
  }

  /**
   * Cache merged graph
   */
  async setMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId,
    graph: CachedMergedGraph,
    additionalTags: readonly CacheTag[] = []
  ): Promise<void> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildMergedGraphKey(tenantId, rollupId);
    const tags = [
      ...this.keyBuilder.generateMergedGraphTags(tenantId, rollupId),
      ...additionalTags,
    ] as readonly CacheTag[];

    // Update metadata with current tags
    const updatedGraph: CachedMergedGraph = {
      ...graph,
      metadata: {
        ...graph.metadata,
        tags,
      },
    };

    try {
      if (this.config.l1.enabled) {
        this.setL1GraphCache(key, updatedGraph);
      }

      if (this.config.l2.enabled) {
        await this.safeL2Set(key, updatedGraph, this.config.l2.graphTtlSeconds);
        await this.registerKeyWithTags(key, tags);
      }

      this.stats.setsCount++;
      this.recordSetLatency(startTime);
      this.logCacheSet('merged_graph', key);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, rollupId }, 'Error setting merged graph in cache');
    }
  }

  /**
   * Invalidate cached merged graph
   */
  async invalidateMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<number> {
    const key = this.keyBuilder.buildMergedGraphKey(tenantId, rollupId);
    return this.invalidateKey(key, 'merged_graph');
  }

  // =========================================================================
  // Blast Radius Cache
  // =========================================================================

  /**
   * Get cached blast radius result
   */
  async getBlastRadius(
    tenantId: TenantId,
    nodeId: string,
    depth: number
  ): Promise<CachedBlastRadius | null> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildBlastRadiusKey(tenantId, nodeId, depth);

    try {
      // Try L1 cache first
      if (this.config.l1.enabled) {
        const l1Entry = this.l1BlastRadiusCache.get(key);
        if (l1Entry && l1Entry.expiresAt > Date.now()) {
          this.stats.l1Hits++;
          this.recordGetLatency(startTime);
          this.logCacheHit('blast_radius', key, 'l1');
          return l1Entry.data;
        }

        if (l1Entry) {
          this.l1BlastRadiusCache.delete(key);
        }
        this.stats.l1Misses++;
      }

      // Try L2 cache
      if (this.config.l2.enabled) {
        const l2Entry = await this.safeL2Get<CachedBlastRadius>(key);
        if (l2Entry && isCacheEntryValid(l2Entry.metadata)) {
          this.stats.l2Hits++;

          if (this.config.l1.enabled) {
            this.setL1BlastRadiusCache(key, l2Entry);
          }

          this.recordGetLatency(startTime);
          this.logCacheHit('blast_radius', key, 'l2');
          return l2Entry;
        }
        this.stats.l2Misses++;
      }

      this.recordGetLatency(startTime);
      this.logCacheMiss('blast_radius', key);
      return null;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, nodeId, depth }, 'Error getting blast radius from cache');
      return null;
    }
  }

  /**
   * Cache blast radius result
   */
  async setBlastRadius(
    tenantId: TenantId,
    nodeId: string,
    depth: number,
    result: CachedBlastRadius,
    additionalTags: readonly CacheTag[] = []
  ): Promise<void> {
    const startTime = Date.now();
    const key = this.keyBuilder.buildBlastRadiusKey(tenantId, nodeId, depth);
    const tags = [
      ...this.keyBuilder.generateBlastRadiusTags(tenantId, nodeId),
      ...additionalTags,
    ] as readonly CacheTag[];

    const updatedResult: CachedBlastRadius = {
      ...result,
      metadata: {
        ...result.metadata,
        tags,
      },
    };

    try {
      if (this.config.l1.enabled) {
        this.setL1BlastRadiusCache(key, updatedResult);
      }

      if (this.config.l2.enabled) {
        await this.safeL2Set(key, updatedResult, this.config.l2.blastRadiusTtlSeconds);
        await this.registerKeyWithTags(key, tags);
      }

      this.stats.setsCount++;
      this.recordSetLatency(startTime);
      this.logCacheSet('blast_radius', key);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, nodeId, depth }, 'Error setting blast radius in cache');
    }
  }

  /**
   * Invalidate cached blast radius results for a node
   */
  async invalidateBlastRadius(
    tenantId: TenantId,
    nodeId: string
  ): Promise<number> {
    const tag = this.keyBuilder.createNodeTag(tenantId, nodeId);
    return this.invalidateByTag(tag);
  }

  // =========================================================================
  // Tag-Based Invalidation
  // =========================================================================

  /**
   * Invalidate all cache entries with a specific tag
   */
  async invalidateByTag(tag: CacheTag): Promise<number> {
    let invalidated = 0;

    try {
      // Get keys associated with this tag from L2
      if (this.config.l2.enabled) {
        const tagSetKey = this.getTagSetKey(tag);
        const keys = await this.safeL2Get<string[]>(tagSetKey);

        if (keys && keys.length > 0) {
          for (const key of keys) {
            const count = await this.invalidateKey(key as CacheKey, 'tag');
            invalidated += count;
          }

          // Clear the tag set
          await this.l2Cache.delete(tagSetKey);
        }
      }

      // Also scan L1 caches for entries with this tag
      invalidated += this.invalidateL1ByTag(tag);

      this.stats.invalidationsCount += invalidated;
      this.logger.debug({ tag, invalidated }, 'Invalidated cache entries by tag');

      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tag }, 'Error invalidating cache by tag');
      return invalidated;
    }
  }

  /**
   * Invalidate all cache entries with any of the specified tags
   */
  async invalidateByTags(tags: readonly CacheTag[]): Promise<number> {
    let totalInvalidated = 0;

    for (const tag of tags) {
      const count = await this.invalidateByTag(tag);
      totalInvalidated += count;
    }

    return totalInvalidated;
  }

  /**
   * Invalidate all cache entries for a tenant
   */
  async invalidateTenant(tenantId: TenantId): Promise<number> {
    let invalidated = 0;

    try {
      // Invalidate by tenant tag
      const tenantTag = this.keyBuilder.createTenantTag(tenantId);
      invalidated += await this.invalidateByTag(tenantTag);

      // Also use pattern-based invalidation for L2
      if (this.config.l2.enabled) {
        const pattern = this.keyBuilder.buildPattern(tenantId);
        const patternInvalidated = await this.l2Cache.deleteByPattern(pattern);
        invalidated += patternInvalidated;
      }

      // Clear L1 entries for tenant
      invalidated += this.invalidateL1ByTenant(tenantId);

      this.logger.info({ tenantId, invalidated }, 'Invalidated tenant cache');
      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId }, 'Error invalidating tenant cache');
      return invalidated;
    }
  }

  // =========================================================================
  // Statistics and Management
  // =========================================================================

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalMisses = this.stats.l1Misses + this.stats.l2Misses;
    const total = totalHits + totalMisses;
    const l1Total = this.stats.l1Hits + this.stats.l1Misses;
    const l2Total = this.stats.l2Hits + this.stats.l2Misses;

    return {
      l1Hits: this.stats.l1Hits,
      l1Misses: this.stats.l1Misses,
      l2Hits: this.stats.l2Hits,
      l2Misses: this.stats.l2Misses,
      totalHits,
      totalMisses,
      hitRatio: total > 0 ? totalHits / total : 0,
      l1HitRatio: l1Total > 0 ? this.stats.l1Hits / l1Total : 0,
      l2HitRatio: l2Total > 0 ? this.stats.l2Hits / l2Total : 0,
      l1Size:
        this.l1ExecutionCache.size +
        this.l1GraphCache.size +
        this.l1BlastRadiusCache.size,
      setsCount: this.stats.setsCount,
      invalidationsCount: this.stats.invalidationsCount,
      errorsCount: this.stats.errorsCount,
      avgGetLatencyMs:
        this.stats.getOperations > 0
          ? this.stats.totalGetLatencyMs / this.stats.getOperations
          : 0,
      avgSetLatencyMs:
        this.stats.setOperations > 0
          ? this.stats.totalSetLatencyMs / this.stats.setOperations
          : 0,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.logger.debug('Cache statistics reset');
  }

  // =========================================================================
  // Private Helper Methods - L1 Cache Operations
  // =========================================================================

  /**
   * Set entry in L1 execution cache with TTL
   */
  private setL1ExecutionCache(key: CacheKey, entry: CachedExecutionResult): void {
    const expiresAt = Date.now() + this.config.l1.ttlSeconds * 1000;
    this.l1ExecutionCache.set(key, {
      data: entry,
      expiresAt,
      tags: entry.metadata.tags,
    });
  }

  /**
   * Set entry in L1 graph cache with TTL
   */
  private setL1GraphCache(key: CacheKey, entry: CachedMergedGraph): void {
    const expiresAt = Date.now() + this.config.l1.ttlSeconds * 1000;
    this.l1GraphCache.set(key, {
      data: entry,
      expiresAt,
      tags: entry.metadata.tags,
    });
  }

  /**
   * Set entry in L1 blast radius cache with TTL
   */
  private setL1BlastRadiusCache(key: CacheKey, entry: CachedBlastRadius): void {
    const expiresAt = Date.now() + this.config.l1.ttlSeconds * 1000;
    this.l1BlastRadiusCache.set(key, {
      data: entry,
      expiresAt,
      tags: entry.metadata.tags,
    });
  }

  /**
   * Invalidate L1 entries by tag
   * @param _tag - The cache tag to invalidate by (currently unused - see note)
   * @returns Number of entries invalidated
   */
  private invalidateL1ByTag(_tag: CacheTag): number {
    // Note: LRUCache doesn't support iteration, so we rely on TTL expiration
    // and tag-based L2 tracking for invalidation. For production, consider
    // maintaining a separate tag->key index for L1.
    return 0;
  }

  /**
   * Invalidate L1 entries by tenant
   * @param _tenantId - Tenant ID to invalidate (currently clears all L1 caches)
   * @returns Number of entries invalidated (0 as exact count not tracked)
   */
  private invalidateL1ByTenant(_tenantId: TenantId): number {
    // Clear all L1 caches since we can't efficiently filter by tenant
    // In production, consider maintaining tenant-specific LRU caches
    this.l1ExecutionCache.clear();
    this.l1GraphCache.clear();
    this.l1BlastRadiusCache.clear();

    return 0; // Return 0 as we don't track exact count
  }

  // =========================================================================
  // Private Helper Methods - L2 Cache Operations
  // =========================================================================

  /**
   * Safe L2 get with error handling
   */
  private async safeL2Get<T>(key: string): Promise<T | null> {
    try {
      return await this.l2Cache.get<T>(key);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key }, 'L2 cache get error');
      return null;
    }
  }

  /**
   * Safe L2 set with error handling
   */
  private async safeL2Set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    try {
      await this.l2Cache.set(key, value, ttlSeconds);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key }, 'L2 cache set error');
    }
  }

  /**
   * Register a cache key with its associated tags
   */
  private async registerKeyWithTags(key: CacheKey, tags: readonly CacheTag[]): Promise<void> {
    if (!this.config.l2.enabled) {
      return;
    }

    for (const tag of tags) {
      const tagSetKey = this.getTagSetKey(tag);
      try {
        // Get existing keys for this tag
        const existingKeys = (await this.safeL2Get<string[]>(tagSetKey)) ?? [];

        // Add new key if not already present
        if (!existingKeys.includes(key)) {
          existingKeys.push(key);
          await this.safeL2Set(tagSetKey, existingKeys, this.config.l2.executionTtlSeconds);
        }
      } catch (error) {
        this.logger.error({ error, tag, key }, 'Error registering key with tag');
      }
    }
  }

  /**
   * Get the tag set key for a given tag
   */
  private getTagSetKey(tag: CacheTag): string {
    const parts = tag.split(':');
    return this.keyBuilder.buildTagSetKey(parts[0] ?? 'tag', parts.slice(1).join(':'));
  }

  /**
   * Invalidate a single cache key
   */
  private async invalidateKey(key: CacheKey, source: string): Promise<number> {
    let invalidated = 0;

    // Delete from L1 caches
    if (this.l1ExecutionCache.delete(key)) invalidated++;
    if (this.l1GraphCache.delete(key)) invalidated++;
    if (this.l1BlastRadiusCache.delete(key)) invalidated++;

    // Delete from L2
    if (this.config.l2.enabled) {
      try {
        const deleted = await this.l2Cache.delete(key);
        if (deleted) invalidated++;
      } catch (error) {
        this.logger.error({ error, key }, 'L2 cache delete error');
      }
    }

    if (invalidated > 0) {
      this.logger.debug({ key, source, invalidated }, 'Invalidated cache key');
    }

    return invalidated > 0 ? 1 : 0;
  }

  // =========================================================================
  // Private Helper Methods - Utility
  // =========================================================================

  /**
   * Create empty internal stats
   */
  private createEmptyStats(): CacheStatsInternal {
    return {
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      setsCount: 0,
      invalidationsCount: 0,
      errorsCount: 0,
      totalGetLatencyMs: 0,
      totalSetLatencyMs: 0,
      getOperations: 0,
      setOperations: 0,
    };
  }

  /**
   * Record get operation latency
   */
  private recordGetLatency(startTime: number): void {
    this.stats.totalGetLatencyMs += Date.now() - startTime;
    this.stats.getOperations++;
  }

  /**
   * Record set operation latency
   */
  private recordSetLatency(startTime: number): void {
    this.stats.totalSetLatencyMs += Date.now() - startTime;
    this.stats.setOperations++;
  }

  /**
   * Estimate size of an object in bytes
   */
  private estimateSize(obj: unknown): number {
    try {
      return JSON.stringify(obj).length * 2; // Rough estimate (2 bytes per char)
    } catch {
      return 0;
    }
  }

  /**
   * Log cache hit
   */
  private logCacheHit(type: string, key: string, layer: 'l1' | 'l2'): void {
    if (this.config.enableLogging) {
      this.logger.debug({ type, key, layer, source: 'hit' }, 'Cache hit');
    }
  }

  /**
   * Log cache miss
   */
  private logCacheMiss(type: string, key: string): void {
    if (this.config.enableLogging) {
      this.logger.debug({ type, key, source: 'miss' }, 'Cache miss');
    }
  }

  /**
   * Log cache set
   */
  private logCacheSet(type: string, key: string): void {
    if (this.config.enableLogging) {
      this.logger.debug({ type, key, source: 'set' }, 'Cache set');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new RollupCache instance
 */
export function createRollupCache(
  deps?: RollupCacheDependencies
): IRollupCache {
  return new RollupCache(deps);
}

/**
 * Default rollup cache instance
 */
let defaultRollupCache: RollupCache | null = null;

/**
 * Get the default rollup cache instance
 */
export function getDefaultRollupCache(): IRollupCache {
  if (!defaultRollupCache) {
    defaultRollupCache = new RollupCache();
  }
  return defaultRollupCache;
}

/**
 * Reset the default rollup cache instance
 */
export async function resetDefaultRollupCache(): Promise<void> {
  if (defaultRollupCache) {
    await defaultRollupCache.shutdown();
  }
  defaultRollupCache = null;
}
