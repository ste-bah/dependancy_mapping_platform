/**
 * Performance Optimization: Caching Utilities
 * @module optimization/cache
 *
 * Provides caching layers for expensive operations including:
 * - Expression parsing memoization
 * - Scan result caching via Redis
 * - Graph traversal result caching
 * - LRU cache for in-memory operations
 *
 * TASK-DETECT: Performance optimization implementation
 */

import { getClient } from '../cache/redis.js';
import pino from 'pino';

const logger = pino({ name: 'optimization:cache' });

// ============================================================================
// Types
// ============================================================================

/**
 * Cache options for different use cases
 */
export interface CacheOptions {
  /** TTL in seconds */
  readonly ttlSeconds: number;
  /** Namespace prefix for cache keys */
  readonly namespace: string;
  /** Whether to use compression for large values */
  readonly compress?: boolean;
  /** Max size for LRU cache (in-memory only) */
  readonly maxSize?: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
}

/**
 * Default cache options
 */
const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  ttlSeconds: 3600, // 1 hour
  namespace: 'perf',
  compress: false,
  maxSize: 10000,
};

// ============================================================================
// LRU Cache Implementation (In-Memory)
// ============================================================================

/**
 * LRU Cache for in-memory caching with O(1) operations
 * Uses a doubly linked list + Map for efficient access and eviction
 */
export class LRUCache<K, V> {
  private readonly capacity: number;
  private readonly cache: Map<K, LRUNode<K, V>>;
  private head: LRUNode<K, V> | null = null;
  private tail: LRUNode<K, V> | null = null;
  private stats: CacheStats;

  constructor(capacity: number = 10000) {
    this.capacity = capacity;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      evictions: 0,
    };
  }

  /**
   * Get value from cache, returns undefined if not found
   */
  get(key: K): V | undefined {
    const node = this.cache.get(key);

    if (!node) {
      this.stats.misses++;
      this.updateHitRate();
      return undefined;
    }

    this.stats.hits++;
    this.updateHitRate();

    // Move to front (most recently used)
    this.moveToFront(node);

    return node.value;
  }

  /**
   * Set value in cache
   */
  set(key: K, value: V): void {
    const existing = this.cache.get(key);

    if (existing) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    // Create new node
    const node: LRUNode<K, V> = { key, value, prev: null, next: null };

    // Add to cache
    this.cache.set(key, node);
    this.addToFront(node);
    this.stats.size++;

    // Evict if over capacity
    if (this.cache.size > this.capacity) {
      this.evictLRU();
    }
  }

  /**
   * Check if key exists in cache
   */
  has(key: K): boolean {
    return this.cache.has(key);
  }

  /**
   * Delete key from cache
   */
  delete(key: K): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    this.removeNode(node);
    this.cache.delete(key);
    this.stats.size--;
    return true;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.stats.size = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  // Private helper methods

  private moveToFront(node: LRUNode<K, V>): void {
    if (node === this.head) return;

    this.removeNode(node);
    this.addToFront(node);
  }

  private addToFront(node: LRUNode<K, V>): void {
    node.prev = null;
    node.next = this.head;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: LRUNode<K, V>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  private evictLRU(): void {
    if (!this.tail) return;

    const key = this.tail.key;
    this.removeNode(this.tail);
    this.cache.delete(key);
    this.stats.size--;
    this.stats.evictions++;
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }
}

interface LRUNode<K, V> {
  key: K;
  value: V;
  prev: LRUNode<K, V> | null;
  next: LRUNode<K, V> | null;
}

// ============================================================================
// Expression Cache (Memoization)
// ============================================================================

/**
 * Memoization cache for parsed expressions
 * Uses LRU eviction to prevent unbounded memory growth
 */
export class ExpressionCache {
  private readonly cache: LRUCache<string, unknown>;

  constructor(maxSize: number = 10000) {
    this.cache = new LRUCache(maxSize);
  }

  /**
   * Get or compute cached expression
   */
  getOrCompute<T>(
    expression: string,
    compute: (expr: string) => T
  ): T {
    const cached = this.cache.get(expression);
    if (cached !== undefined) {
      return cached as T;
    }

    const result = compute(expression);
    this.cache.set(expression, result);
    return result;
  }

  /**
   * Directly get cached value
   */
  get<T>(expression: string): T | undefined {
    return this.cache.get(expression) as T | undefined;
  }

  /**
   * Directly set cached value
   */
  set<T>(expression: string, value: T): void {
    this.cache.set(expression, value);
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return this.cache.getStats();
  }

  /**
   * Clear the cache
   */
  clear(): void {
    this.cache.clear();
  }
}

// Singleton expression cache
let expressionCache: ExpressionCache | null = null;

/**
 * Get the singleton expression cache instance
 */
export function getExpressionCache(): ExpressionCache {
  if (!expressionCache) {
    expressionCache = new ExpressionCache(10000);
  }
  return expressionCache;
}

// ============================================================================
// Redis Cache Layer
// ============================================================================

/**
 * Redis-backed cache for distributed caching
 */
export class RedisCache {
  private readonly options: CacheOptions;

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options };
  }

  /**
   * Build cache key with namespace
   */
  private buildKey(key: string): string {
    return `${this.options.namespace}:${key}`;
  }

  /**
   * Get value from Redis cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const redis = getClient();
      const fullKey = this.buildKey(key);
      const data = await redis.get(fullKey);

      if (!data) {
        logger.debug({ key: fullKey }, 'Cache miss');
        return null;
      }

      logger.debug({ key: fullKey }, 'Cache hit');
      return JSON.parse(data) as T;
    } catch (error) {
      logger.error({ error, key }, 'Redis cache get error');
      return null;
    }
  }

  /**
   * Set value in Redis cache
   */
  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    try {
      const redis = getClient();
      const fullKey = this.buildKey(key);
      const ttl = ttlSeconds ?? this.options.ttlSeconds;

      await redis.setex(fullKey, ttl, JSON.stringify(value));
      logger.debug({ key: fullKey, ttl }, 'Cache set');
    } catch (error) {
      logger.error({ error, key }, 'Redis cache set error');
    }
  }

  /**
   * Get or set value with compute function
   */
  async getOrSet<T>(
    key: string,
    compute: () => Promise<T>,
    ttlSeconds?: number
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await compute();
    await this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Delete key from cache
   */
  async delete(key: string): Promise<boolean> {
    try {
      const redis = getClient();
      const fullKey = this.buildKey(key);
      const result = await redis.del(fullKey);
      return result > 0;
    } catch (error) {
      logger.error({ error, key }, 'Redis cache delete error');
      return false;
    }
  }

  /**
   * Delete multiple keys by pattern
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const redis = getClient();
      const fullPattern = this.buildKey(pattern);

      // Use SCAN to avoid blocking
      let cursor = '0';
      let deleted = 0;

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          fullPattern,
          'COUNT',
          100
        );
        cursor = nextCursor;

        if (keys.length > 0) {
          deleted += await redis.del(...keys);
        }
      } while (cursor !== '0');

      return deleted;
    } catch (error) {
      logger.error({ error, pattern }, 'Redis cache pattern delete error');
      return 0;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const redis = getClient();
      const fullKey = this.buildKey(key);
      return (await redis.exists(fullKey)) === 1;
    } catch (error) {
      logger.error({ error, key }, 'Redis cache exists error');
      return false;
    }
  }

  /**
   * Get TTL for a key
   */
  async getTTL(key: string): Promise<number> {
    try {
      const redis = getClient();
      const fullKey = this.buildKey(key);
      return await redis.ttl(fullKey);
    } catch (error) {
      logger.error({ error, key }, 'Redis cache TTL error');
      return -1;
    }
  }
}

// ============================================================================
// Scan Cache (Domain-specific)
// ============================================================================

/**
 * Cache for scan results
 */
export class ScanCache extends RedisCache {
  constructor() {
    super({ namespace: 'scan', ttlSeconds: 3600 }); // 1 hour default
  }

  /**
   * Cache scan result
   */
  async cacheScanResult(
    scanId: string,
    result: unknown,
    ttlSeconds: number = 3600
  ): Promise<void> {
    await this.set(`result:${scanId}`, result, ttlSeconds);
  }

  /**
   * Get cached scan result
   */
  async getCachedScanResult<T>(scanId: string): Promise<T | null> {
    return this.get<T>(`result:${scanId}`);
  }

  /**
   * Cache scan graph
   */
  async cacheScanGraph(
    scanId: string,
    graph: unknown,
    ttlSeconds: number = 3600
  ): Promise<void> {
    await this.set(`graph:${scanId}`, graph, ttlSeconds);
  }

  /**
   * Get cached scan graph
   */
  async getCachedScanGraph<T>(scanId: string): Promise<T | null> {
    return this.get<T>(`graph:${scanId}`);
  }

  /**
   * Invalidate all caches for a scan
   */
  async invalidateScan(scanId: string): Promise<void> {
    await Promise.all([
      this.delete(`result:${scanId}`),
      this.delete(`graph:${scanId}`),
    ]);
  }
}

// ============================================================================
// Graph Traversal Cache
// ============================================================================

/**
 * Cache for graph traversal results
 */
export class GraphTraversalCache extends RedisCache {
  constructor() {
    super({ namespace: 'graph', ttlSeconds: 1800 }); // 30 minutes default
  }

  /**
   * Cache downstream dependencies
   */
  async cacheDownstream(
    scanId: string,
    nodeId: string,
    maxDepth: number,
    result: unknown
  ): Promise<void> {
    const key = `downstream:${scanId}:${nodeId}:${maxDepth}`;
    await this.set(key, result);
  }

  /**
   * Get cached downstream dependencies
   */
  async getCachedDownstream<T>(
    scanId: string,
    nodeId: string,
    maxDepth: number
  ): Promise<T | null> {
    const key = `downstream:${scanId}:${nodeId}:${maxDepth}`;
    return this.get<T>(key);
  }

  /**
   * Cache upstream dependents
   */
  async cacheUpstream(
    scanId: string,
    nodeId: string,
    maxDepth: number,
    result: unknown
  ): Promise<void> {
    const key = `upstream:${scanId}:${nodeId}:${maxDepth}`;
    await this.set(key, result);
  }

  /**
   * Get cached upstream dependents
   */
  async getCachedUpstream<T>(
    scanId: string,
    nodeId: string,
    maxDepth: number
  ): Promise<T | null> {
    const key = `upstream:${scanId}:${nodeId}:${maxDepth}`;
    return this.get<T>(key);
  }

  /**
   * Cache cycle detection result
   */
  async cacheCycles(scanId: string, cycles: unknown): Promise<void> {
    const key = `cycles:${scanId}`;
    await this.set(key, cycles);
  }

  /**
   * Get cached cycles
   */
  async getCachedCycles<T>(scanId: string): Promise<T | null> {
    const key = `cycles:${scanId}`;
    return this.get<T>(key);
  }

  /**
   * Invalidate all graph caches for a scan
   */
  async invalidateGraphCaches(scanId: string): Promise<void> {
    await this.deleteByPattern(`*:${scanId}:*`);
    await this.delete(`cycles:${scanId}`);
  }
}

// ============================================================================
// Cache Factory
// ============================================================================

/**
 * Create and manage cache instances
 */
export class CacheFactory {
  private static scanCache: ScanCache | null = null;
  private static graphCache: GraphTraversalCache | null = null;

  static getScanCache(): ScanCache {
    if (!this.scanCache) {
      this.scanCache = new ScanCache();
    }
    return this.scanCache;
  }

  static getGraphCache(): GraphTraversalCache {
    if (!this.graphCache) {
      this.graphCache = new GraphTraversalCache();
    }
    return this.graphCache;
  }

  static clearAll(): void {
    this.scanCache = null;
    this.graphCache = null;
    expressionCache = null;
  }
}

// ============================================================================
// Decorator for Method Caching
// ============================================================================

/**
 * Creates a memoized version of a function
 */
export function memoize<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => TReturn,
  options: {
    keyGenerator?: (...args: TArgs) => string;
    maxSize?: number;
  } = {}
): (...args: TArgs) => TReturn {
  const cache = new LRUCache<string, TReturn>(options.maxSize ?? 1000);
  const keyGen = options.keyGenerator ?? ((...args) => JSON.stringify(args));

  return function memoized(...args: TArgs): TReturn {
    const key = keyGen(...args);
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Creates an async memoized version of a function
 */
export function memoizeAsync<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: {
    keyGenerator?: (...args: TArgs) => string;
    maxSize?: number;
  } = {}
): (...args: TArgs) => Promise<TReturn> {
  const cache = new LRUCache<string, TReturn>(options.maxSize ?? 1000);
  const pending = new Map<string, Promise<TReturn>>();
  const keyGen = options.keyGenerator ?? ((...args) => JSON.stringify(args));

  return async function memoizedAsync(...args: TArgs): Promise<TReturn> {
    const key = keyGen(...args);

    // Check cache
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    // Check pending requests to avoid duplicate calls
    const pendingRequest = pending.get(key);
    if (pendingRequest) {
      return pendingRequest;
    }

    // Execute and cache
    const promise = fn(...args).then((result) => {
      cache.set(key, result);
      pending.delete(key);
      return result;
    });

    pending.set(key, promise);
    return promise;
  };
}
