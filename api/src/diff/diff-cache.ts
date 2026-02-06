/**
 * Diff Cache - Tiered Caching for Graph Diff Results
 * @module diff/diff-cache
 *
 * Provides tiered L1 (in-memory LRU) and L2 (Redis) caching for expensive
 * graph diff computations. Supports efficient scan-based invalidation and
 * comprehensive statistics tracking.
 *
 * Architecture:
 * - L1 (In-Memory): Fastest access, limited size, short TTL (5 min default)
 * - L2 (Redis): Distributed, larger capacity, longer TTL (1 hour default)
 *
 * Lookup Flow: L1 -> L2 -> miss (return null)
 * Write Flow: Write to both L1 and L2 (write-through)
 * Invalidation: Remove from both L1 and L2, clean up scan indexes
 *
 * Features:
 * - Lookup by diff ID or scan pair
 * - Scan-based invalidation for efficient cleanup when scans are updated
 * - Graceful L2 degradation (L1 still works if Redis fails)
 * - Comprehensive statistics and metrics
 * - Tenant isolation
 *
 * TASK-ROLLUP-005: Diff Computation - Cache Layer
 *
 * @example
 * ```typescript
 * const cache = createDiffCache();
 * await cache.initialize();
 *
 * // Store diff result
 * await cache.set(tenantId, diff, 3600);
 *
 * // Retrieve by diff ID
 * const cached = await cache.get(tenantId, diffId);
 *
 * // Retrieve by scan pair
 * const cached = await cache.getByScanPair(tenantId, baseScanId, compareScanId);
 *
 * // Invalidate when scan is updated
 * await cache.invalidateByScan(tenantId, scanId);
 * ```
 */

import pino from 'pino';
import { LRUCache, RedisCache } from '../optimization/cache.js';
import { TenantId } from '../types/entities.js';
import {
  DiffId,
  GraphDiff,
  CachedDiffResult,
  createDiffCacheMetadata,
  isDiffCacheEntryValid,
} from './types.js';

// ============================================================================
// Constants
// ============================================================================

/**
 * Cache key version for namespacing and invalidation by version bump
 */
export const DIFF_CACHE_VERSION = 'v1';

/**
 * Default TTL for diff cache entries (1 hour)
 * Diff results are expensive to compute, so we cache them longer
 */
export const DEFAULT_DIFF_TTL_SECONDS = 3600;

/**
 * Default L1 TTL (5 minutes)
 */
export const DEFAULT_L1_TTL_SECONDS = 300;

/**
 * Default L1 cache max size
 */
export const DEFAULT_L1_MAX_SIZE = 500;

/**
 * Cache key prefix
 */
export const DIFF_CACHE_PREFIX = 'rollup';

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Diff cache statistics for monitoring and optimization
 */
export interface DiffCacheStats {
  /** L1 (in-memory) cache hits */
  readonly hits: number;
  /** L1 + L2 cache misses */
  readonly misses: number;
  /** Overall hit rate (0-1) */
  readonly hitRate: number;
  /** Current L1 cache size (entries) */
  readonly l1Size: number;
  /** Estimated L2 cache size (based on sets minus invalidations) */
  readonly l2Size: number;
  /** Total evictions from L1 */
  readonly evictions: number;
  /** L1 specific hits */
  readonly l1Hits: number;
  /** L2 specific hits */
  readonly l2Hits: number;
  /** Total invalidations performed */
  readonly invalidationsCount: number;
  /** Total errors encountered */
  readonly errorsCount: number;
  /** Average get latency in milliseconds */
  readonly avgGetLatencyMs: number;
  /** Average set latency in milliseconds */
  readonly avgSetLatencyMs: number;
}

/**
 * Diff cache configuration options
 */
export interface IDiffCacheConfig {
  /** L1 (in-memory) cache configuration */
  readonly l1: {
    /** Maximum entries in L1 cache */
    readonly maxSize: number;
    /** TTL in seconds for L1 entries */
    readonly ttlSeconds: number;
    /** Whether L1 cache is enabled */
    readonly enabled: boolean;
  };
  /** L2 (Redis) cache configuration */
  readonly l2: {
    /** Default TTL in seconds for L2 entries */
    readonly ttlSeconds: number;
    /** Key prefix for Redis */
    readonly keyPrefix: string;
    /** Whether L2 cache is enabled */
    readonly enabled: boolean;
  };
  /** Cache version for key namespacing */
  readonly version: string;
  /** Whether to log cache operations */
  readonly enableLogging: boolean;
}

/**
 * Default diff cache configuration
 */
export const DEFAULT_DIFF_CACHE_CONFIG: IDiffCacheConfig = {
  l1: {
    maxSize: DEFAULT_L1_MAX_SIZE,
    ttlSeconds: DEFAULT_L1_TTL_SECONDS,
    enabled: true,
  },
  l2: {
    ttlSeconds: DEFAULT_DIFF_TTL_SECONDS,
    keyPrefix: DIFF_CACHE_PREFIX,
    enabled: true,
  },
  version: DIFF_CACHE_VERSION,
  enableLogging: true,
};

/**
 * Interface for the diff cache
 * Provides caching for expensive graph diff computations
 */
export interface IDiffCache {
  /**
   * Get cached diff by ID
   * @param tenantId - Tenant identifier for isolation
   * @param diffId - Diff identifier
   * @returns Cached diff result or null if not found
   */
  get(tenantId: TenantId, diffId: DiffId): Promise<CachedDiffResult | null>;

  /**
   * Get cached diff by scan pair
   * @param tenantId - Tenant identifier for isolation
   * @param baseScanId - Base scan identifier
   * @param compareScanId - Compare scan identifier
   * @returns Cached diff result or null if not found
   */
  getByScanPair(
    tenantId: TenantId,
    baseScanId: string,
    compareScanId: string
  ): Promise<CachedDiffResult | null>;

  /**
   * Store diff result in cache
   * @param tenantId - Tenant identifier for isolation
   * @param diff - Diff result to cache
   * @param ttlSeconds - Optional TTL override (default: 1 hour)
   */
  set(
    tenantId: TenantId,
    diff: GraphDiff,
    ttlSeconds?: number
  ): Promise<void>;

  /**
   * Invalidate by diff ID
   * @param tenantId - Tenant identifier
   * @param diffId - Diff identifier to invalidate
   * @returns Number of entries invalidated
   */
  invalidate(tenantId: TenantId, diffId: DiffId): Promise<number>;

  /**
   * Invalidate all diffs involving a scan
   * When a scan is updated or deleted, all diffs referencing it must be invalidated
   * @param tenantId - Tenant identifier
   * @param scanId - Scan identifier
   * @returns Number of entries invalidated
   */
  invalidateByScan(tenantId: TenantId, scanId: string): Promise<number>;

  /**
   * Get cache statistics
   * @returns Current cache statistics
   */
  getStats(): DiffCacheStats;

  /**
   * Reset cache statistics
   */
  resetStats(): void;

  /**
   * Initialize the cache (verify connections, etc.)
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the cache (close connections, cleanup)
   */
  shutdown(): Promise<void>;
}

// ============================================================================
// Types
// ============================================================================

/**
 * L1 cache entry wrapper with TTL tracking
 */
interface L1CacheEntry {
  readonly data: CachedDiffResult;
  readonly expiresAt: number;
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
 * Dependencies for DiffCache construction
 */
export interface DiffCacheDependencies {
  /** Redis cache instance (optional, uses default if not provided) */
  readonly redisCache?: RedisCache;
  /** Configuration (optional, uses defaults if not provided) */
  readonly config?: Partial<IDiffCacheConfig>;
  /** Logger (optional, uses default if not provided) */
  readonly logger?: pino.Logger;
}

// ============================================================================
// Cache Key Builder
// ============================================================================

/**
 * Build cache key by diff ID
 * Format: rollup:v1:{tenantId}:diff:{diffId}
 */
function buildDiffKey(
  version: string,
  tenantId: TenantId,
  diffId: DiffId
): string {
  return `${DIFF_CACHE_PREFIX}:${version}:${tenantId}:diff:${diffId}`;
}

/**
 * Build cache key by scan pair
 * Format: rollup:v1:{tenantId}:diff:scans:{baseScanId}:{compareScanId}
 */
function buildScanPairKey(
  version: string,
  tenantId: TenantId,
  baseScanId: string,
  compareScanId: string
): string {
  return `${DIFF_CACHE_PREFIX}:${version}:${tenantId}:diff:scans:${baseScanId}:${compareScanId}`;
}

/**
 * Build scan index key for invalidation tracking
 * Format: rollup:v1:{tenantId}:diff:scan-index:{scanId}
 * This key stores a list of diff IDs that reference the scan
 */
function buildScanIndexKey(
  version: string,
  tenantId: TenantId,
  scanId: string
): string {
  return `${DIFF_CACHE_PREFIX}:${version}:${tenantId}:diff:scan-index:${scanId}`;
}

// NOTE: buildTenantPattern removed - reserved for future batch invalidation
// function buildTenantPattern(version: string, tenantId: TenantId): string {
//   return `${DIFF_CACHE_PREFIX}:${version}:${tenantId}:diff:*`;
// }

// ============================================================================
// Implementation
// ============================================================================

/**
 * Tiered cache implementation for graph diff results.
 * Provides L1 (in-memory LRU) and L2 (Redis) caching with
 * scan-based invalidation support.
 */
export class DiffCache implements IDiffCache {
  private readonly l1Cache: LRUCache<string, L1CacheEntry>;
  private readonly l2Cache: RedisCache;
  private readonly config: IDiffCacheConfig;
  private readonly logger: pino.Logger;
  private stats: CacheStatsInternal;
  private initialized: boolean = false;
  private l2SetsCount: number = 0;

  /**
   * Create a new DiffCache instance
   * @param deps - Optional dependencies for cache construction
   */
  constructor(deps: DiffCacheDependencies = {}) {
    // Merge config with defaults
    this.config = {
      ...DEFAULT_DIFF_CACHE_CONFIG,
      ...deps.config,
      l1: {
        ...DEFAULT_DIFF_CACHE_CONFIG.l1,
        ...deps.config?.l1,
      },
      l2: {
        ...DEFAULT_DIFF_CACHE_CONFIG.l2,
        ...deps.config?.l2,
      },
    };

    // Initialize logger
    this.logger = deps.logger ?? pino({ name: 'diff-cache' });

    // Initialize L1 cache
    this.l1Cache = new LRUCache<string, L1CacheEntry>(this.config.l1.maxSize);

    // Initialize L2 cache
    this.l2Cache = deps.redisCache ?? new RedisCache({
      namespace: this.config.l2.keyPrefix,
      ttlSeconds: this.config.l2.ttlSeconds,
    });

    // Initialize statistics
    this.stats = this.createEmptyStats();

    this.logger.info(
      {
        l1MaxSize: this.config.l1.maxSize,
        l1TtlSeconds: this.config.l1.ttlSeconds,
        l2TtlSeconds: this.config.l2.ttlSeconds,
        version: this.config.version,
      },
      'Diff cache initialized'
    );
  }

  // ===========================================================================
  // Initialization and Shutdown
  // ===========================================================================

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
        const testKey = `${this.config.l2.keyPrefix}:_diff_health_check`;
        await this.l2Cache.set(testKey, { healthy: true }, 10);
        const result = await this.l2Cache.get<{ healthy: boolean }>(testKey);
        if (!result?.healthy) {
          this.logger.warn('L2 cache health check failed, continuing with L1 only');
        }
      }

      this.initialized = true;
      this.logger.info('Diff cache initialization complete');
    } catch (error) {
      this.logger.error({ error }, 'Failed to initialize diff cache');
      // Don't throw - allow operation with L1 only
      this.initialized = true;
    }
  }

  /**
   * Shutdown the cache (close connections, cleanup)
   */
  async shutdown(): Promise<void> {
    this.l1Cache.clear();
    this.initialized = false;
    this.logger.info('Diff cache shutdown complete');
  }

  // ===========================================================================
  // Get Operations
  // ===========================================================================

  /**
   * Get cached diff by ID
   * Implements read-through: L1 -> L2 -> miss
   */
  async get(tenantId: TenantId, diffId: DiffId): Promise<CachedDiffResult | null> {
    const startTime = Date.now();
    const key = buildDiffKey(this.config.version, tenantId, diffId);

    try {
      const result = await this.getByKey(key);
      this.recordGetLatency(startTime);
      return result;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId, diffId }, 'Error getting diff from cache');
      this.recordGetLatency(startTime);
      return null;
    }
  }

  /**
   * Get cached diff by scan pair
   * Implements read-through: L1 -> L2 -> miss
   */
  async getByScanPair(
    tenantId: TenantId,
    baseScanId: string,
    compareScanId: string
  ): Promise<CachedDiffResult | null> {
    const startTime = Date.now();
    const key = buildScanPairKey(this.config.version, tenantId, baseScanId, compareScanId);

    try {
      const result = await this.getByKey(key);
      this.recordGetLatency(startTime);
      return result;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error(
        { error, key, tenantId, baseScanId, compareScanId },
        'Error getting diff by scan pair from cache'
      );
      this.recordGetLatency(startTime);
      return null;
    }
  }

  /**
   * Internal get by key implementation
   * Handles L1 -> L2 lookup
   */
  private async getByKey(key: string): Promise<CachedDiffResult | null> {
    // Try L1 cache first
    if (this.config.l1.enabled) {
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && l1Entry.expiresAt > Date.now()) {
        this.stats.l1Hits++;
        this.logCacheHit(key, 'l1');
        return l1Entry.data;
      }

      // L1 entry expired or not found
      if (l1Entry) {
        this.l1Cache.delete(key);
      }
      this.stats.l1Misses++;
    }

    // Try L2 cache
    if (this.config.l2.enabled) {
      const l2Entry = await this.safeL2Get<CachedDiffResult>(key);
      if (l2Entry && isDiffCacheEntryValid(l2Entry.metadata)) {
        this.stats.l2Hits++;

        // Populate L1 on L2 hit
        if (this.config.l1.enabled) {
          this.setL1Cache(key, l2Entry);
        }

        this.logCacheHit(key, 'l2');
        return l2Entry;
      }
      this.stats.l2Misses++;
    }

    this.logCacheMiss(key);
    return null;
  }

  // ===========================================================================
  // Set Operations
  // ===========================================================================

  /**
   * Store diff result in cache
   * Implements write-through: write to both L1 and L2
   */
  async set(
    tenantId: TenantId,
    diff: GraphDiff,
    ttlSeconds?: number
  ): Promise<void> {
    const startTime = Date.now();
    const effectiveTtl = ttlSeconds ?? this.config.l2.ttlSeconds;

    // Build keys
    const diffKey = buildDiffKey(this.config.version, tenantId, diff.id);
    const scanPairKey = buildScanPairKey(
      this.config.version,
      tenantId,
      diff.baseScanId as string,
      diff.compareScanId as string
    );

    // Create metadata and cached result
    const metadata = createDiffCacheMetadata(effectiveTtl, {}, this.estimateSize(diff));
    const cachedResult: CachedDiffResult = {
      data: diff,
      metadata,
    };

    try {
      // Write to L1 (by diff ID)
      if (this.config.l1.enabled) {
        this.setL1Cache(diffKey, cachedResult);
        this.setL1Cache(scanPairKey, cachedResult);
      }

      // Write to L2
      if (this.config.l2.enabled) {
        // Store by diff ID
        await this.safeL2Set(diffKey, cachedResult, effectiveTtl);

        // Store by scan pair (for scan pair lookups)
        await this.safeL2Set(scanPairKey, cachedResult, effectiveTtl);

        // Register in scan indexes for invalidation
        await this.registerInScanIndex(tenantId, diff.baseScanId as string, diff.id);
        await this.registerInScanIndex(tenantId, diff.compareScanId as string, diff.id);

        this.l2SetsCount++;
      }

      this.stats.setsCount++;
      this.recordSetLatency(startTime);
      this.logCacheSet(diffKey);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, diffKey, tenantId }, 'Error setting diff in cache');
    }
  }

  /**
   * Register a diff ID in a scan's index for later invalidation
   */
  private async registerInScanIndex(
    tenantId: TenantId,
    scanId: string,
    diffId: DiffId
  ): Promise<void> {
    const indexKey = buildScanIndexKey(this.config.version, tenantId, scanId);

    try {
      // Get existing diff IDs for this scan
      const existingDiffs = (await this.safeL2Get<string[]>(indexKey)) ?? [];

      // Add new diff ID if not already present
      if (!existingDiffs.includes(diffId)) {
        existingDiffs.push(diffId);
        // Use longer TTL for index (2x the diff TTL)
        await this.safeL2Set(indexKey, existingDiffs, this.config.l2.ttlSeconds * 2);
      }
    } catch (error) {
      this.logger.error(
        { error, indexKey, scanId, diffId },
        'Error registering diff in scan index'
      );
    }
  }

  // ===========================================================================
  // Invalidation Operations
  // ===========================================================================

  /**
   * Invalidate by diff ID
   */
  async invalidate(tenantId: TenantId, diffId: DiffId): Promise<number> {
    const key = buildDiffKey(this.config.version, tenantId, diffId);
    let invalidated = 0;

    try {
      // First, try to get the cached result to find scan pair key
      const cached = await this.getByKey(key);
      if (cached) {
        const scanPairKey = buildScanPairKey(
          this.config.version,
          tenantId,
          cached.data.baseScanId as string,
          cached.data.compareScanId as string
        );

        // Delete scan pair key
        invalidated += await this.invalidateKey(scanPairKey);

        // Remove from scan indexes
        await this.removeFromScanIndex(tenantId, cached.data.baseScanId as string, diffId);
        await this.removeFromScanIndex(tenantId, cached.data.compareScanId as string, diffId);
      }

      // Delete diff key
      invalidated += await this.invalidateKey(key);

      if (invalidated > 0) {
        this.stats.invalidationsCount += invalidated;
        this.logger.debug({ tenantId, diffId, invalidated }, 'Invalidated diff');
      }

      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId, diffId }, 'Error invalidating diff');
      return invalidated;
    }
  }

  /**
   * Invalidate all diffs involving a scan
   * This is called when a scan is updated or deleted
   */
  async invalidateByScan(tenantId: TenantId, scanId: string): Promise<number> {
    const indexKey = buildScanIndexKey(this.config.version, tenantId, scanId);
    let invalidated = 0;

    try {
      // Get all diff IDs associated with this scan
      const diffIds = await this.safeL2Get<string[]>(indexKey);

      if (diffIds && diffIds.length > 0) {
        // Invalidate each diff
        for (const diffId of diffIds) {
          const count = await this.invalidate(tenantId, diffId as DiffId);
          invalidated += count;
        }
      }

      // Delete the scan index itself
      if (this.config.l2.enabled) {
        await this.l2Cache.delete(indexKey);
      }

      this.logger.info(
        { tenantId, scanId, invalidated, diffCount: diffIds?.length ?? 0 },
        'Invalidated diffs by scan'
      );

      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId, scanId }, 'Error invalidating diffs by scan');
      return invalidated;
    }
  }

  /**
   * Remove a diff ID from a scan's index
   */
  private async removeFromScanIndex(
    tenantId: TenantId,
    scanId: string,
    diffId: DiffId
  ): Promise<void> {
    const indexKey = buildScanIndexKey(this.config.version, tenantId, scanId);

    try {
      const existingDiffs = await this.safeL2Get<string[]>(indexKey);
      if (existingDiffs) {
        const filteredDiffs = existingDiffs.filter(id => id !== diffId);
        if (filteredDiffs.length > 0) {
          await this.safeL2Set(indexKey, filteredDiffs, this.config.l2.ttlSeconds * 2);
        } else {
          await this.l2Cache.delete(indexKey);
        }
      }
    } catch (error) {
      this.logger.error(
        { error, indexKey, scanId, diffId },
        'Error removing diff from scan index'
      );
    }
  }

  /**
   * Invalidate a single cache key from both L1 and L2
   */
  private async invalidateKey(key: string): Promise<number> {
    let invalidated = 0;

    // Delete from L1
    if (this.l1Cache.delete(key)) {
      invalidated++;
    }

    // Delete from L2
    if (this.config.l2.enabled) {
      try {
        const deleted = await this.l2Cache.delete(key);
        if (deleted) {
          invalidated++;
          this.l2SetsCount = Math.max(0, this.l2SetsCount - 1);
        }
      } catch (error) {
        this.logger.error({ error, key }, 'L2 cache delete error');
      }
    }

    return invalidated > 0 ? 1 : 0;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get cache statistics
   */
  getStats(): DiffCacheStats {
    const l1Stats = this.l1Cache.getStats();
    const totalHits = this.stats.l1Hits + this.stats.l2Hits;
    const totalMisses = this.stats.l1Misses + this.stats.l2Misses;
    const total = totalHits + totalMisses;

    return {
      hits: totalHits,
      misses: totalMisses,
      hitRate: total > 0 ? totalHits / total : 0,
      l1Size: this.l1Cache.size,
      l2Size: this.l2SetsCount,
      evictions: l1Stats.evictions,
      l1Hits: this.stats.l1Hits,
      l2Hits: this.stats.l2Hits,
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
    this.logger.debug('Diff cache statistics reset');
  }

  // ===========================================================================
  // Private Helper Methods
  // ===========================================================================

  /**
   * Set entry in L1 cache with TTL
   */
  private setL1Cache(key: string, entry: CachedDiffResult): void {
    const expiresAt = Date.now() + this.config.l1.ttlSeconds * 1000;
    this.l1Cache.set(key, {
      data: entry,
      expiresAt,
    });
  }

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
  private logCacheHit(key: string, layer: 'l1' | 'l2'): void {
    if (this.config.enableLogging) {
      this.logger.debug({ key, layer, source: 'hit' }, 'Diff cache hit');
    }
  }

  /**
   * Log cache miss
   */
  private logCacheMiss(key: string): void {
    if (this.config.enableLogging) {
      this.logger.debug({ key, source: 'miss' }, 'Diff cache miss');
    }
  }

  /**
   * Log cache set
   */
  private logCacheSet(key: string): void {
    if (this.config.enableLogging) {
      this.logger.debug({ key, source: 'set' }, 'Diff cache set');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new DiffCache instance
 * @param deps - Optional dependencies for cache construction
 * @returns Configured DiffCache instance
 *
 * @example
 * ```typescript
 * // Default configuration
 * const cache = createDiffCache();
 *
 * // With custom configuration
 * const cache = createDiffCache({
 *   config: {
 *     l1: { maxSize: 1000, ttlSeconds: 600, enabled: true },
 *     l2: { ttlSeconds: 7200, keyPrefix: 'custom', enabled: true },
 *   },
 * });
 * ```
 */
export function createDiffCache(deps?: DiffCacheDependencies): IDiffCache {
  return new DiffCache(deps);
}

/**
 * Default diff cache instance (singleton)
 */
let defaultDiffCache: DiffCache | null = null;

/**
 * Get the default diff cache instance
 * Creates a new instance if one doesn't exist
 *
 * @returns Default DiffCache instance
 *
 * @example
 * ```typescript
 * const cache = getDefaultDiffCache();
 * await cache.initialize();
 * ```
 */
export function getDefaultDiffCache(): IDiffCache {
  if (!defaultDiffCache) {
    defaultDiffCache = new DiffCache();
  }
  return defaultDiffCache;
}

/**
 * Reset the default diff cache instance
 * Useful for testing or cleanup
 *
 * @example
 * ```typescript
 * await resetDefaultDiffCache();
 * ```
 */
export async function resetDefaultDiffCache(): Promise<void> {
  if (defaultDiffCache) {
    await defaultDiffCache.shutdown();
  }
  defaultDiffCache = null;
}

// ============================================================================
// Exports
// ============================================================================

export type { CachedDiffResult, DiffCacheMetadata } from './types.js';
