/**
 * Diff Cache for Graph Diff Computation
 * @module services/rollup/graph-diff/diff-cache
 *
 * Tiered cache implementation for graph diff results with:
 * - L1: In-memory LRU cache for hot entries (max 100 diffs)
 * - L2: Redis cache for persistence (24-hour TTL)
 *
 * Key Pattern: rollup:v1:{tenantId}:diff:{baseScanId}:{compareScanId}
 * Note: Scan IDs are always sorted to ensure consistent key regardless of order.
 *
 * Cache Tags for Invalidation:
 * - tenant:{tenantId}
 * - scan:{tenantId}:{scanId} (applied for both base and compare scans)
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pino from 'pino';
import { LRUCache, RedisCache } from '../../../optimization/cache.js';
import { TenantId, ScanId } from '../../../types/entities.js';
import {
  IDiffCache,
  GraphDiffResult,
  GraphDiffId,
  GraphSnapshotId,
  DiffSummary,
  CachedDiffResult,
  DiffCacheMetadata,
  DiffCacheStats,
} from './interfaces.js';
import {
  CacheTag,
  CacheKey,
  CacheVersion,
  createCacheKey,
  createCacheTag,
} from '../rollup-cache/interfaces.js';

// ============================================================================
// Constants
// ============================================================================

/** Cache key prefix for diff entries */
const DIFF_CACHE_PREFIX = 'rollup';

/** Current cache version */
const CACHE_VERSION: CacheVersion = 'v1';

/** Key segment separator */
const SEPARATOR = ':';

/** L1 cache configuration */
const L1_CONFIG = {
  /** Maximum number of diffs to cache in memory */
  MAX_ENTRIES: 100,
  /** TTL for L1 entries in milliseconds */
  TTL_MS: 5 * 60 * 1000, // 5 minutes
} as const;

/** L2 cache configuration */
const L2_CONFIG = {
  /** TTL for L2 entries in seconds */
  TTL_SECONDS: 24 * 60 * 60, // 24 hours
  /** Redis namespace */
  NAMESPACE: 'diff-cache',
} as const;

// ============================================================================
// Types
// ============================================================================

/**
 * L1 cache entry wrapper with TTL and metadata tracking
 */
interface L1CacheEntry {
  readonly data: CachedDiffResult;
  readonly expiresAt: number;
  readonly tags: readonly CacheTag[];
}

/**
 * Internal statistics tracking
 */
interface DiffCacheStatsInternal {
  hits: number;
  misses: number;
  l1Hits: number;
  l1Misses: number;
  l2Hits: number;
  l2Misses: number;
  setsCount: number;
  invalidationsCount: number;
  errorsCount: number;
  totalSizeBytes: number;
}

/**
 * Dependencies for DiffCache construction
 */
export interface DiffCacheDependencies {
  /** Redis cache instance (optional, uses default if not provided) */
  readonly redisCache?: RedisCache;
  /** Logger (optional, uses default if not provided) */
  readonly logger?: pino.Logger;
  /** L1 max entries (optional, uses default if not provided) */
  readonly l1MaxEntries?: number;
  /** L2 TTL in seconds (optional, uses default if not provided) */
  readonly l2TtlSeconds?: number;
  /** Enable logging (default: true) */
  readonly enableLogging?: boolean;
}

/**
 * Options for setting diff cache entries
 */
export interface DiffCacheOptions {
  /** Additional cache tags for invalidation */
  readonly additionalTags?: readonly CacheTag[];
  /** Custom TTL in seconds (overrides default) */
  readonly ttlSeconds?: number;
}

// ============================================================================
// Diff Cache Key Builder
// ============================================================================

/**
 * Builds consistent cache keys for diff entries.
 * Scan IDs are sorted to ensure the same key regardless of comparison order.
 */
class DiffCacheKeyBuilder {
  private readonly version: CacheVersion;
  private readonly prefix: string;

  constructor(version: CacheVersion = CACHE_VERSION, prefix: string = DIFF_CACHE_PREFIX) {
    this.version = version;
    this.prefix = prefix;
  }

  /**
   * Build cache key for a diff result.
   *
   * Pattern: rollup:v1:{tenantId}:diff:{sortedBaseScanId}:{sortedCompareScanId}
   *
   * Scan IDs are sorted alphabetically to ensure consistent key regardless
   * of which scan is passed as base vs compare.
   */
  buildDiffKey(tenantId: TenantId, baseScanId: ScanId, compareScanId: ScanId): CacheKey {
    // Sort scan IDs for consistent key
    const [firstScanId, secondScanId] = this.sortScanIds(baseScanId, compareScanId);

    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'diff',
      this.sanitizeSegment(firstScanId),
      this.sanitizeSegment(secondScanId),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for diff result by GraphDiffId
   */
  buildDiffKeyById(tenantId: TenantId, diffId: GraphDiffId): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'diff_id',
      this.sanitizeSegment(diffId),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for summary (lightweight cached summary)
   */
  buildSummaryKey(tenantId: TenantId, baseScanId: ScanId, compareScanId: ScanId): CacheKey {
    const [firstScanId, secondScanId] = this.sortScanIds(baseScanId, compareScanId);

    const segments = [
      this.prefix,
      this.version,
      this.sanitizeSegment(tenantId),
      'diff_summary',
      this.sanitizeSegment(firstScanId),
      this.sanitizeSegment(secondScanId),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Build cache key for tag set
   */
  buildTagSetKey(tagType: string, tagValue: string): CacheKey {
    const segments = [
      this.prefix,
      this.version,
      'tag',
      this.sanitizeSegment(tagType),
      this.sanitizeSegment(tagValue),
    ];
    return createCacheKey(segments.join(SEPARATOR));
  }

  /**
   * Create a tenant tag for invalidation
   */
  createTenantTag(tenantId: TenantId): CacheTag {
    return createCacheTag(`tenant${SEPARATOR}${this.sanitizeSegment(tenantId)}`);
  }

  /**
   * Create a scan tag for invalidation
   */
  createScanTag(tenantId: TenantId, scanId: ScanId): CacheTag {
    return createCacheTag(
      `scan${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}${this.sanitizeSegment(scanId)}`
    );
  }

  /**
   * Generate cache tags for a diff result
   */
  generateDiffTags(
    tenantId: TenantId,
    baseScanId: ScanId,
    compareScanId: ScanId
  ): CacheTag[] {
    return [
      this.createTenantTag(tenantId),
      this.createScanTag(tenantId, baseScanId),
      this.createScanTag(tenantId, compareScanId),
    ];
  }

  /**
   * Build pattern for matching diff keys by tenant
   */
  buildTenantPattern(tenantId: TenantId): string {
    return `${this.prefix}${SEPARATOR}${this.version}${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}diff*`;
  }

  /**
   * Build pattern for matching diff keys by scan
   */
  buildScanPattern(tenantId: TenantId, scanId: ScanId): string {
    return `${this.prefix}${SEPARATOR}${this.version}${SEPARATOR}${this.sanitizeSegment(tenantId)}${SEPARATOR}diff*${this.sanitizeSegment(scanId)}*`;
  }

  /**
   * Sort scan IDs for consistent key generation
   */
  private sortScanIds(scanId1: ScanId, scanId2: ScanId): [ScanId, ScanId] {
    return scanId1 <= scanId2 ? [scanId1, scanId2] : [scanId2, scanId1];
  }

  /**
   * Sanitize a segment for use in cache keys
   */
  private sanitizeSegment(segment: string): string {
    return segment
      .replace(/:/g, '_')
      .replace(/\s+/g, '_')
      .replace(/[^\w\-_.]/g, '');
  }
}

// ============================================================================
// Diff Cache Implementation
// ============================================================================

/**
 * Tiered cache implementation for graph diff results.
 * Provides L1 (in-memory LRU) and L2 (Redis) caching with
 * tag-based invalidation support.
 */
export class DiffCache implements IDiffCache {
  private readonly l1Cache: LRUCache<string, L1CacheEntry>;
  private readonly l2Cache: RedisCache;
  private readonly keyBuilder: DiffCacheKeyBuilder;
  private readonly logger: pino.Logger;
  private readonly l1TtlMs: number;
  private readonly l2TtlSeconds: number;
  private readonly enableLogging: boolean;
  private stats: DiffCacheStatsInternal;
  private initialized: boolean = false;

  /**
   * Create a new DiffCache
   * @param deps - Dependencies for cache construction
   */
  constructor(deps: DiffCacheDependencies = {}) {
    // Initialize logger
    this.logger = deps.logger ?? pino({ name: 'diff-cache' });

    // Initialize configuration
    const l1MaxEntries = deps.l1MaxEntries ?? L1_CONFIG.MAX_ENTRIES;
    this.l1TtlMs = L1_CONFIG.TTL_MS;
    this.l2TtlSeconds = deps.l2TtlSeconds ?? L2_CONFIG.TTL_SECONDS;
    this.enableLogging = deps.enableLogging ?? true;

    // Initialize key builder
    this.keyBuilder = new DiffCacheKeyBuilder();

    // Initialize L1 cache
    this.l1Cache = new LRUCache<string, L1CacheEntry>(l1MaxEntries);

    // Initialize L2 cache
    this.l2Cache = deps.redisCache ?? new RedisCache({
      namespace: L2_CONFIG.NAMESPACE,
      ttlSeconds: this.l2TtlSeconds,
    });

    // Initialize statistics
    this.stats = this.createEmptyStats();

    this.logger.info(
      {
        l1MaxEntries,
        l1TtlMs: this.l1TtlMs,
        l2TtlSeconds: this.l2TtlSeconds,
      },
      'Diff cache initialized'
    );
  }

  // =========================================================================
  // Initialization
  // =========================================================================

  /**
   * Initialize the cache (verify Redis connection)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      // Verify L2 connection with a health check
      const testKey = `${L2_CONFIG.NAMESPACE}:_health_check`;
      await this.l2Cache.set(testKey, { healthy: true }, 10);
      const result = await this.l2Cache.get<{ healthy: boolean }>(testKey);

      if (!result?.healthy) {
        this.logger.warn('L2 diff cache health check failed, continuing with L1 only');
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
   * Shutdown the cache
   */
  async shutdown(): Promise<void> {
    this.l1Cache.clear();
    this.initialized = false;
    this.logger.info('Diff cache shutdown complete');
  }

  // =========================================================================
  // Core Cache Operations
  // =========================================================================

  /**
   * Get a cached diff result by GraphDiffId
   */
  async getDiff(
    tenantId: TenantId,
    diffId: GraphDiffId
  ): Promise<CachedDiffResult | null> {
    const key = this.keyBuilder.buildDiffKeyById(tenantId, diffId);
    return this.getFromCache(key);
  }

  /**
   * Cache a diff result
   */
  async setDiff(
    tenantId: TenantId,
    diff: GraphDiffResult,
    tags?: readonly CacheTag[]
  ): Promise<void> {
    // Build keys for both access patterns (by ID and by snapshot pair)
    const keyById = this.keyBuilder.buildDiffKeyById(tenantId, diff.id);

    // Extract scan IDs from snapshot IDs
    const baseScanId = diff.baseSnapshotId as unknown as ScanId;
    const compareScanId = diff.targetSnapshotId as unknown as ScanId;
    const keyBySnapshots = this.keyBuilder.buildDiffKey(tenantId, baseScanId, compareScanId);

    // Generate tags
    const generatedTags = this.keyBuilder.generateDiffTags(tenantId, baseScanId, compareScanId);
    const allTags = [...generatedTags, ...(tags ?? [])] as readonly CacheTag[];

    // Create cached result with metadata
    const cachedResult = this.createCachedResult(diff, allTags);

    // Store under both keys
    await Promise.all([
      this.setToCache(keyById, cachedResult, allTags),
      this.setToCache(keyBySnapshots, cachedResult, allTags),
    ]);

    // Also cache the summary separately for lightweight access
    await this.cacheSummary(tenantId, baseScanId, compareScanId, diff.summary);
  }

  /**
   * Get diff by snapshot pair
   */
  async getDiffBySnapshots(
    tenantId: TenantId,
    baseSnapshotId: GraphSnapshotId,
    targetSnapshotId: GraphSnapshotId
  ): Promise<CachedDiffResult | null> {
    const baseScanId = baseSnapshotId as unknown as ScanId;
    const compareScanId = targetSnapshotId as unknown as ScanId;
    const key = this.keyBuilder.buildDiffKey(tenantId, baseScanId, compareScanId);
    return this.getFromCache(key);
  }

  /**
   * Get diff summary (lightweight cached summary only)
   */
  async getSummary(
    tenantId: TenantId,
    baseScanId: ScanId,
    compareScanId: ScanId
  ): Promise<DiffSummary | null> {
    const key = this.keyBuilder.buildSummaryKey(tenantId, baseScanId, compareScanId);

    try {
      // Try L1 first
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && l1Entry.expiresAt > Date.now()) {
        this.stats.l1Hits++;
        this.stats.hits++;
        return l1Entry.data.diff.summary;
      }

      if (l1Entry) {
        this.l1Cache.delete(key);
      }
      this.stats.l1Misses++;

      // Try L2
      const l2Entry = await this.safeL2Get<DiffSummary>(key);
      if (l2Entry) {
        this.stats.l2Hits++;
        this.stats.hits++;
        return l2Entry;
      }

      this.stats.l2Misses++;
      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key, tenantId }, 'Error getting summary from cache');
      return null;
    }
  }

  // =========================================================================
  // Invalidation Operations
  // =========================================================================

  /**
   * Invalidate cached diffs for a scan.
   * Invalidates all diffs where this scan is either base or compare.
   */
  async invalidateBySnapshot(
    tenantId: TenantId,
    snapshotId: GraphSnapshotId
  ): Promise<number> {
    const scanId = snapshotId as unknown as ScanId;
    return this.invalidateForScan(tenantId, scanId);
  }

  /**
   * Invalidate cached diffs for a scan
   */
  async invalidateForScan(tenantId: TenantId, scanId: ScanId): Promise<number> {
    let invalidated = 0;

    try {
      // Invalidate by scan tag
      const scanTag = this.keyBuilder.createScanTag(tenantId, scanId);
      invalidated += await this.invalidateByTag(scanTag);

      // Also use pattern-based invalidation for L2
      const pattern = this.keyBuilder.buildScanPattern(tenantId, scanId);
      const patternInvalidated = await this.l2Cache.deleteByPattern(pattern);
      invalidated += patternInvalidated;

      this.stats.invalidationsCount += invalidated;
      this.logInvalidation('scan', scanId, invalidated);

      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId, scanId }, 'Error invalidating cache for scan');
      return invalidated;
    }
  }

  /**
   * Invalidate all cached diffs for a tenant
   */
  async invalidateTenant(tenantId: TenantId): Promise<number> {
    return this.invalidateForTenant(tenantId);
  }

  /**
   * Invalidate all cached diffs for a tenant
   */
  async invalidateForTenant(tenantId: TenantId): Promise<number> {
    let invalidated = 0;

    try {
      // Invalidate by tenant tag
      const tenantTag = this.keyBuilder.createTenantTag(tenantId);
      invalidated += await this.invalidateByTag(tenantTag);

      // Also use pattern-based invalidation for L2
      const pattern = this.keyBuilder.buildTenantPattern(tenantId);
      const patternInvalidated = await this.l2Cache.deleteByPattern(pattern);
      invalidated += patternInvalidated;

      // Clear L1 entirely (can't efficiently filter by tenant)
      this.l1Cache.clear();

      this.stats.invalidationsCount += invalidated;
      this.logInvalidation('tenant', tenantId, invalidated);

      return invalidated;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, tenantId }, 'Error invalidating cache for tenant');
      return invalidated;
    }
  }

  // =========================================================================
  // Statistics
  // =========================================================================

  /**
   * Get cache statistics
   */
  getStats(): DiffCacheStats {
    const total = this.stats.hits + this.stats.misses;
    const entryCount = this.l1Cache.size;
    const avgDiffSizeBytes = entryCount > 0
      ? this.stats.totalSizeBytes / entryCount
      : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRatio: total > 0 ? this.stats.hits / total : 0,
      entryCount,
      totalSizeBytes: this.stats.totalSizeBytes,
      avgDiffSizeBytes,
      setsCount: this.stats.setsCount,
      invalidationsCount: this.stats.invalidationsCount,
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = this.createEmptyStats();
    this.logger.debug('Diff cache statistics reset');
  }

  // =========================================================================
  // Private Helper Methods - Cache Operations
  // =========================================================================

  /**
   * Get entry from tiered cache (L1 -> L2 -> miss)
   */
  private async getFromCache(key: CacheKey): Promise<CachedDiffResult | null> {
    try {
      // Try L1 cache first
      const l1Entry = this.l1Cache.get(key);
      if (l1Entry && l1Entry.expiresAt > Date.now()) {
        this.stats.l1Hits++;
        this.stats.hits++;
        this.updateAccessMetadata(l1Entry.data);
        this.logCacheHit(key, 'l1');
        return l1Entry.data;
      }

      // L1 entry expired or not found
      if (l1Entry) {
        this.l1Cache.delete(key);
      }
      this.stats.l1Misses++;

      // Try L2 cache
      const l2Entry = await this.safeL2Get<CachedDiffResult>(key);
      if (l2Entry && this.isValidCacheEntry(l2Entry)) {
        this.stats.l2Hits++;
        this.stats.hits++;

        // Populate L1 on L2 hit
        this.setL1Cache(key, l2Entry);
        this.updateAccessMetadata(l2Entry);
        this.logCacheHit(key, 'l2');
        return l2Entry;
      }

      this.stats.l2Misses++;
      this.stats.misses++;
      this.logCacheMiss(key);
      return null;
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key }, 'Error getting entry from cache');
      return null;
    }
  }

  /**
   * Set entry to tiered cache (write-through: L1 + L2)
   */
  private async setToCache(
    key: CacheKey,
    entry: CachedDiffResult,
    tags: readonly CacheTag[]
  ): Promise<void> {
    try {
      // Write to L1
      this.setL1Cache(key, entry, tags);

      // Write to L2
      await this.safeL2Set(key, entry, this.l2TtlSeconds);
      await this.registerKeyWithTags(key, tags);

      // Update stats
      this.stats.setsCount++;
      this.stats.totalSizeBytes += entry.metadata.sizeBytes ?? 0;
      this.logCacheSet(key);
    } catch (error) {
      this.stats.errorsCount++;
      this.logger.error({ error, key }, 'Error setting entry in cache');
    }
  }

  /**
   * Set entry in L1 cache with TTL
   */
  private setL1Cache(
    key: CacheKey,
    entry: CachedDiffResult,
    tags?: readonly CacheTag[]
  ): void {
    const expiresAt = Date.now() + this.l1TtlMs;
    this.l1Cache.set(key, {
      data: entry,
      expiresAt,
      tags: tags ?? entry.metadata.tags,
    });
  }

  /**
   * Cache summary separately for lightweight access
   */
  private async cacheSummary(
    tenantId: TenantId,
    baseScanId: ScanId,
    compareScanId: ScanId,
    summary: DiffSummary
  ): Promise<void> {
    const key = this.keyBuilder.buildSummaryKey(tenantId, baseScanId, compareScanId);

    try {
      await this.safeL2Set(key, summary, this.l2TtlSeconds);
    } catch (error) {
      this.logger.error({ error, key }, 'Error caching summary');
    }
  }

  // =========================================================================
  // Private Helper Methods - Tag Operations
  // =========================================================================

  /**
   * Invalidate all cache entries with a specific tag
   */
  private async invalidateByTag(tag: CacheTag): Promise<number> {
    let invalidated = 0;

    try {
      // Get keys associated with this tag from L2
      const tagSetKey = this.getTagSetKey(tag);
      const keys = await this.safeL2Get<string[]>(tagSetKey);

      if (keys && keys.length > 0) {
        for (const key of keys) {
          // Delete from L1
          if (this.l1Cache.delete(key as CacheKey)) {
            invalidated++;
          }

          // Delete from L2
          const deleted = await this.l2Cache.delete(key);
          if (deleted) invalidated++;
        }

        // Clear the tag set
        await this.l2Cache.delete(tagSetKey);
      }

      return invalidated;
    } catch (error) {
      this.logger.error({ error, tag }, 'Error invalidating by tag');
      return invalidated;
    }
  }

  /**
   * Register a cache key with its associated tags
   */
  private async registerKeyWithTags(key: CacheKey, tags: readonly CacheTag[]): Promise<void> {
    for (const tag of tags) {
      const tagSetKey = this.getTagSetKey(tag);
      try {
        const existingKeys = (await this.safeL2Get<string[]>(tagSetKey)) ?? [];

        if (!existingKeys.includes(key)) {
          existingKeys.push(key);
          await this.safeL2Set(tagSetKey, existingKeys, this.l2TtlSeconds);
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

  // =========================================================================
  // Private Helper Methods - L2 Operations
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

  // =========================================================================
  // Private Helper Methods - Utility
  // =========================================================================

  /**
   * Create a cached result with metadata
   */
  private createCachedResult(
    diff: GraphDiffResult,
    tags: readonly CacheTag[]
  ): CachedDiffResult {
    const now = new Date();
    const sizeBytes = this.estimateSize(diff);

    const metadata: DiffCacheMetadata = {
      cachedAt: now,
      expiresAt: new Date(now.getTime() + this.l2TtlSeconds * 1000),
      ttlSeconds: this.l2TtlSeconds,
      sizeBytes,
      tags,
      accessCount: 0,
      lastAccessedAt: now,
    };

    return { diff, metadata };
  }

  /**
   * Update access metadata for a cache entry
   */
  private updateAccessMetadata(entry: CachedDiffResult): void {
    // Note: In a real implementation, we'd update L2 with new access count
    // For now, just tracking locally
    (entry.metadata as { accessCount: number; lastAccessedAt: Date }).accessCount++;
    (entry.metadata as { lastAccessedAt: Date }).lastAccessedAt = new Date();
  }

  /**
   * Check if a cache entry is still valid
   */
  private isValidCacheEntry(entry: CachedDiffResult): boolean {
    if (!entry.metadata?.expiresAt) {
      return false;
    }
    return new Date() < new Date(entry.metadata.expiresAt);
  }

  /**
   * Create empty internal stats
   */
  private createEmptyStats(): DiffCacheStatsInternal {
    return {
      hits: 0,
      misses: 0,
      l1Hits: 0,
      l1Misses: 0,
      l2Hits: 0,
      l2Misses: 0,
      setsCount: 0,
      invalidationsCount: 0,
      errorsCount: 0,
      totalSizeBytes: 0,
    };
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

  // =========================================================================
  // Private Helper Methods - Logging
  // =========================================================================

  /**
   * Log cache hit
   */
  private logCacheHit(key: string, layer: 'l1' | 'l2'): void {
    if (this.enableLogging) {
      this.logger.debug({ key, layer, source: 'hit' }, 'Diff cache hit');
    }
  }

  /**
   * Log cache miss
   */
  private logCacheMiss(key: string): void {
    if (this.enableLogging) {
      this.logger.debug({ key, source: 'miss' }, 'Diff cache miss');
    }
  }

  /**
   * Log cache set
   */
  private logCacheSet(key: string): void {
    if (this.enableLogging) {
      this.logger.debug({ key, source: 'set' }, 'Diff cache set');
    }
  }

  /**
   * Log invalidation
   */
  private logInvalidation(type: string, id: string, count: number): void {
    if (this.enableLogging) {
      this.logger.debug({ type, id, count }, 'Diff cache invalidation');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new DiffCache instance
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
 */
export function getDefaultDiffCache(): IDiffCache {
  if (!defaultDiffCache) {
    defaultDiffCache = new DiffCache();
  }
  return defaultDiffCache;
}

/**
 * Reset the default diff cache instance
 */
export async function resetDefaultDiffCache(): Promise<void> {
  if (defaultDiffCache) {
    await defaultDiffCache.shutdown();
  }
  defaultDiffCache = null;
}

// ============================================================================
// Re-exports
// ============================================================================

export type { IDiffCache, CachedDiffResult, DiffCacheMetadata, DiffCacheStats };
