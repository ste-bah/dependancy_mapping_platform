/**
 * Cache Invalidation Service
 * @module services/rollup/rollup-cache/cache-invalidation-service
 *
 * Provides cross-node cache invalidation via Redis Pub/Sub and tag-based
 * invalidation management. Supports observer pattern for invalidation listeners.
 *
 * Features:
 * - Tag registration: Associate cache keys with tags for grouped invalidation
 * - Tag-based invalidation: Invalidate all keys with a given tag
 * - Cross-node Pub/Sub: Broadcast invalidation events to all instances
 * - Observer pattern: Register listeners for invalidation events
 * - Debouncing: Batch rapid invalidations for efficiency
 *
 * Redis Data Structures:
 * - Tag Sets: rollup:v1:tag:{tagName} -> Set of cache keys
 * - Pub/Sub Channel: rollup:v1:invalidation:{tenantId}
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pino from 'pino';
import type { Redis as RedisType } from 'ioredis';
import { getClient } from '../../../cache/redis.js';
import { TenantId } from '../../../types/entities.js';
import {
  CacheKey,
  CacheTag,
  CacheVersion,
  ICacheKeyBuilder,
  createCacheKey,
} from './interfaces.js';
import { createCacheKeyBuilder } from './cache-key-builder.js';
import { RollupCacheError } from './errors.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Invalidation event for Pub/Sub
 */
export interface InvalidationEvent {
  /** Event type */
  readonly type: 'key' | 'tag' | 'pattern' | 'tenant';
  /** Target identifier (key, tag, pattern, or tenantId) */
  readonly target: string;
  /** Tenant ID for scoping */
  readonly tenantId?: TenantId;
  /** Timestamp when event was created */
  readonly timestamp: number;
  /** Source instance ID */
  readonly sourceInstanceId: string;
  /** Optional metadata */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Listener callback for invalidation events
 */
export type InvalidationListener = (event: InvalidationEvent) => void | Promise<void>;

/**
 * Cache Invalidation Service interface
 */
export interface ICacheInvalidationService {
  /** Register cache tags for a key */
  registerTags(key: CacheKey, tags: readonly CacheTag[]): Promise<void>;
  /** Invalidate all cache entries with a specific tag */
  invalidateByTag(tag: CacheTag): Promise<number>;
  /** Invalidate all cache entries with any of the specified tags */
  invalidateByTags(tags: readonly CacheTag[]): Promise<number>;
  /** Get all cache keys associated with a tag */
  getTagMembers(tag: CacheTag): Promise<readonly CacheKey[]>;
  /** Register an invalidation listener */
  onInvalidate(listener: InvalidationListener): () => void;
  /** Start Pub/Sub subscription */
  startSubscription(): Promise<void>;
  /** Stop Pub/Sub subscription */
  stopSubscription(): Promise<void>;
  /** Publish invalidation event to other nodes */
  publishInvalidation(event: InvalidationEvent): Promise<void>;
}

/**
 * Configuration for CacheInvalidationService
 */
export interface CacheInvalidationServiceConfig {
  /** Cache version for key namespacing */
  readonly version: CacheVersion;
  /** TTL for tag sets in seconds (default: 7200 = 2x cache TTL) */
  readonly tagSetTtlSeconds: number;
  /** Pub/Sub channel prefix */
  readonly channelPrefix: string;
  /** Debounce window for batching invalidations (ms) */
  readonly debounceMs: number;
  /** Unique instance ID for this server */
  readonly instanceId: string;
  /** Whether to process own invalidation events */
  readonly processOwnEvents: boolean;
  /** Enable logging */
  readonly enableLogging: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_CACHE_INVALIDATION_CONFIG: CacheInvalidationServiceConfig = {
  version: 'v1',
  tagSetTtlSeconds: 7200, // 2 hours (2x default cache TTL)
  channelPrefix: 'rollup',
  debounceMs: 50,
  instanceId: `instance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  processOwnEvents: false,
  enableLogging: true,
};

/**
 * Dependencies for CacheInvalidationService
 */
export interface CacheInvalidationServiceDependencies {
  /** Cache key builder */
  readonly keyBuilder?: ICacheKeyBuilder;
  /** Configuration */
  readonly config?: Partial<CacheInvalidationServiceConfig>;
  /** Logger */
  readonly logger?: pino.Logger;
}

// ============================================================================
// Cache Invalidation Service Implementation
// ============================================================================

/**
 * Service for managing cache invalidation across nodes.
 * Uses Redis Pub/Sub for broadcasting invalidation events and
 * Redis Sets for tag-based key tracking.
 */
export class CacheInvalidationService implements ICacheInvalidationService {
  private readonly config: CacheInvalidationServiceConfig;
  private readonly keyBuilder: ICacheKeyBuilder;
  private readonly logger: pino.Logger;
  private readonly listeners: Set<InvalidationListener>;
  private subscriber: RedisType | null = null;
  private publisher: RedisType | null = null;
  private subscribed: boolean = false;

  // Debouncing state
  private pendingInvalidations: Map<string, NodeJS.Timeout> = new Map();
  private invalidationBatch: Set<string> = new Set();

  constructor(deps: CacheInvalidationServiceDependencies = {}) {
    this.config = {
      ...DEFAULT_CACHE_INVALIDATION_CONFIG,
      ...deps.config,
    };

    this.keyBuilder = deps.keyBuilder ?? createCacheKeyBuilder(this.config.version);
    this.logger = deps.logger ?? pino({ name: 'cache-invalidation-service' });
    this.listeners = new Set();

    this.logInfo('Cache invalidation service initialized', {
      instanceId: this.config.instanceId,
      version: this.config.version,
    });
  }

  // =========================================================================
  // Tag Registration
  // =========================================================================

  /**
   * Register cache tags for a key.
   * Adds the key to each tag's set in Redis.
   *
   * @param key - Cache key to register
   * @param tags - Tags to associate with the key
   */
  async registerTags(key: CacheKey, tags: readonly CacheTag[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }

    const redis = getClient();

    try {
      // Use pipeline for atomic operation
      const pipeline = redis.pipeline();

      for (const tag of tags) {
        const tagSetKey = this.buildTagSetKey(tag);
        pipeline.sadd(tagSetKey, key);
        pipeline.expire(tagSetKey, this.config.tagSetTtlSeconds);
      }

      await pipeline.exec();

      this.logDebug('Registered tags for key', {
        key,
        tagCount: tags.length,
        tags: tags.slice(0, 5), // Log first 5 tags
      });
    } catch (error) {
      this.logError('Failed to register tags', { error, key, tags });
      throw RollupCacheError.writeFailed(key, 'l2', error as Error);
    }
  }

  // =========================================================================
  // Tag-Based Invalidation
  // =========================================================================

  /**
   * Invalidate all cache entries with a specific tag.
   * Gets all keys from the tag set and deletes them.
   *
   * @param tag - Tag to invalidate
   * @returns Number of keys invalidated
   */
  async invalidateByTag(tag: CacheTag): Promise<number> {
    const redis = getClient();

    try {
      const tagSetKey = this.buildTagSetKey(tag);

      // Get all keys in the tag set
      const keys = await redis.smembers(tagSetKey);

      if (keys.length === 0) {
        this.logDebug('No keys found for tag', { tag });
        return 0;
      }

      // Delete all keys and the tag set
      const pipeline = redis.pipeline();
      for (const key of keys) {
        pipeline.del(key);
      }
      pipeline.del(tagSetKey);

      await pipeline.exec();

      // Publish invalidation event
      await this.publishInvalidation({
        type: 'tag',
        target: tag,
        timestamp: Date.now(),
        sourceInstanceId: this.config.instanceId,
      });

      // Notify local listeners
      await this.notifyListeners({
        type: 'tag',
        target: tag,
        timestamp: Date.now(),
        sourceInstanceId: this.config.instanceId,
      });

      this.logInfo('Invalidated by tag', { tag, keysInvalidated: keys.length });

      return keys.length;
    } catch (error) {
      this.logError('Failed to invalidate by tag', { error, tag });
      throw RollupCacheError.invalidationFailed(tag, error as Error);
    }
  }

  /**
   * Invalidate all cache entries with any of the specified tags.
   *
   * @param tags - Tags to invalidate
   * @returns Total number of keys invalidated
   */
  async invalidateByTags(tags: readonly CacheTag[]): Promise<number> {
    if (tags.length === 0) {
      return 0;
    }

    // Deduplicate and batch invalidations
    const uniqueTags = [...new Set(tags)];
    let totalInvalidated = 0;

    // Process in parallel with limited concurrency
    const concurrency = 5;
    for (let i = 0; i < uniqueTags.length; i += concurrency) {
      const batch = uniqueTags.slice(i, i + concurrency);
      const results = await Promise.allSettled(
        batch.map(tag => this.invalidateByTag(tag))
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          totalInvalidated += result.value;
        }
      }
    }

    return totalInvalidated;
  }

  /**
   * Get all cache keys associated with a tag.
   *
   * @param tag - Tag to query
   * @returns Array of cache keys
   */
  async getTagMembers(tag: CacheTag): Promise<readonly CacheKey[]> {
    const redis = getClient();

    try {
      const tagSetKey = this.buildTagSetKey(tag);
      const members = await redis.smembers(tagSetKey);

      return members.map((m: string) => createCacheKey(m));
    } catch (error) {
      this.logError('Failed to get tag members', { error, tag });
      return [];
    }
  }

  // =========================================================================
  // Observer Pattern
  // =========================================================================

  /**
   * Register an invalidation listener.
   * Returns an unsubscribe function.
   *
   * @param listener - Callback for invalidation events
   * @returns Unsubscribe function
   */
  onInvalidate(listener: InvalidationListener): () => void {
    this.listeners.add(listener);

    this.logDebug('Listener registered', {
      listenerCount: this.listeners.size,
    });

    return () => {
      this.listeners.delete(listener);
      this.logDebug('Listener unregistered', {
        listenerCount: this.listeners.size,
      });
    };
  }

  /**
   * Notify all registered listeners of an invalidation event.
   */
  private async notifyListeners(event: InvalidationEvent): Promise<void> {
    if (this.listeners.size === 0) {
      return;
    }

    const notifications = Array.from(this.listeners).map(async (listener) => {
      try {
        await Promise.resolve(listener(event));
      } catch (error) {
        this.logError('Listener threw error', { error, event });
      }
    });

    await Promise.allSettled(notifications);
  }

  // =========================================================================
  // Pub/Sub Management
  // =========================================================================

  /**
   * Start Pub/Sub subscription for cross-node invalidation.
   */
  async startSubscription(): Promise<void> {
    if (this.subscribed) {
      this.logDebug('Already subscribed to invalidation channel');
      return;
    }

    try {
      // Create a duplicate connection for subscription
      // (ioredis requires separate connections for pub/sub)
      const client = getClient();
      const subscriber = client.duplicate();
      const publisher = client.duplicate();

      const channel = this.buildInvalidationChannel();

      // Subscribe to the invalidation channel
      await subscriber.subscribe(channel);

      // Handle incoming messages
      subscriber.on('message', (ch: string, message: string) => {
        if (ch === channel) {
          this.handleInvalidationMessage(message);
        }
      });

      // Store references after successful setup
      this.subscriber = subscriber;
      this.publisher = publisher;
      this.subscribed = true;

      this.logInfo('Started Pub/Sub subscription', { channel });
    } catch (error) {
      this.logError('Failed to start Pub/Sub subscription', { error });
      throw error;
    }
  }

  /**
   * Stop Pub/Sub subscription.
   */
  async stopSubscription(): Promise<void> {
    if (!this.subscribed) {
      return;
    }

    try {
      const channel = this.buildInvalidationChannel();

      if (this.subscriber) {
        await this.subscriber.unsubscribe(channel);
        this.subscriber.disconnect();
        this.subscriber = null;
      }

      if (this.publisher) {
        this.publisher.disconnect();
        this.publisher = null;
      }

      this.subscribed = false;

      // Clear pending invalidations
      for (const timeout of this.pendingInvalidations.values()) {
        clearTimeout(timeout);
      }
      this.pendingInvalidations.clear();
      this.invalidationBatch.clear();

      this.logInfo('Stopped Pub/Sub subscription');
    } catch (error) {
      this.logError('Failed to stop Pub/Sub subscription', { error });
    }
  }

  /**
   * Publish invalidation event to other nodes via Pub/Sub.
   *
   * @param event - Invalidation event to publish
   */
  async publishInvalidation(event: InvalidationEvent): Promise<void> {
    if (!this.publisher) {
      // Use regular client if publisher not initialized
      const redis = getClient();
      await this.publishToChannel(redis, event);
      return;
    }

    await this.publishToChannel(this.publisher, event);
  }

  /**
   * Publish to the invalidation channel.
   */
  private async publishToChannel(
    redis: RedisType,
    event: InvalidationEvent
  ): Promise<void> {
    try {
      const channel = event.tenantId
        ? this.buildInvalidationChannel(event.tenantId)
        : this.buildInvalidationChannel();

      const message = JSON.stringify(event);
      await redis.publish(channel, message);

      this.logDebug('Published invalidation event', {
        type: event.type,
        target: event.target,
        channel,
      });
    } catch (error) {
      this.logError('Failed to publish invalidation event', { error, event });
    }
  }

  /**
   * Handle incoming invalidation message from Pub/Sub.
   */
  private async handleInvalidationMessage(message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as InvalidationEvent;

      // Skip own events unless configured to process them
      if (
        !this.config.processOwnEvents &&
        event.sourceInstanceId === this.config.instanceId
      ) {
        this.logDebug('Skipping own invalidation event', { event });
        return;
      }

      this.logDebug('Received invalidation event', { event });

      // Apply debouncing for rapid invalidations
      if (this.config.debounceMs > 0) {
        this.debouncedNotify(event);
      } else {
        await this.notifyListeners(event);
      }
    } catch (error) {
      this.logError('Failed to handle invalidation message', {
        error,
        message,
      });
    }
  }

  /**
   * Debounced notification to batch rapid invalidations.
   */
  private debouncedNotify(event: InvalidationEvent): void {
    const batchKey = `${event.type}:${event.target}`;

    // Clear existing timeout if present
    const existingTimeout = this.pendingInvalidations.get(batchKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Add to batch
    this.invalidationBatch.add(batchKey);

    // Set new timeout
    const timeout = setTimeout(async () => {
      this.pendingInvalidations.delete(batchKey);

      // Process if still in batch (not cleared by another invalidation)
      if (this.invalidationBatch.has(batchKey)) {
        this.invalidationBatch.delete(batchKey);
        await this.notifyListeners(event);
      }
    }, this.config.debounceMs);

    this.pendingInvalidations.set(batchKey, timeout);
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Build the tag set key for a given tag.
   */
  private buildTagSetKey(tag: CacheTag): string {
    // Extract tag type and value from the tag format "type:value"
    const parts = tag.split(':');
    const tagType = parts[0] ?? 'tag';
    const tagValue = parts.slice(1).join(':');

    return this.keyBuilder.buildTagSetKey(tagType, tagValue);
  }

  /**
   * Build the Pub/Sub channel name.
   */
  private buildInvalidationChannel(tenantId?: TenantId): string {
    const base = `${this.config.channelPrefix}:${this.config.version}:invalidation`;
    return tenantId ? `${base}:${tenantId}` : `${base}:global`;
  }

  /**
   * Log info message if logging is enabled.
   */
  private logInfo(message: string, context?: Record<string, unknown>): void {
    if (this.config.enableLogging) {
      this.logger.info(context ?? {}, message);
    }
  }

  /**
   * Log debug message if logging is enabled.
   */
  private logDebug(message: string, context?: Record<string, unknown>): void {
    if (this.config.enableLogging) {
      this.logger.debug(context ?? {}, message);
    }
  }

  /**
   * Log error message (always logged).
   */
  private logError(message: string, context?: Record<string, unknown>): void {
    this.logger.error(context ?? {}, message);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new CacheInvalidationService instance.
 */
export function createCacheInvalidationService(
  deps?: CacheInvalidationServiceDependencies
): ICacheInvalidationService {
  return new CacheInvalidationService(deps);
}

/**
 * Default service instance (singleton).
 */
let defaultInvalidationService: CacheInvalidationService | null = null;

/**
 * Get the default CacheInvalidationService instance.
 */
export function getDefaultCacheInvalidationService(): ICacheInvalidationService {
  if (!defaultInvalidationService) {
    defaultInvalidationService = new CacheInvalidationService();
  }
  return defaultInvalidationService;
}

/**
 * Reset the default CacheInvalidationService instance.
 * Useful for testing or graceful shutdown.
 */
export async function resetDefaultCacheInvalidationService(): Promise<void> {
  if (defaultInvalidationService) {
    await defaultInvalidationService.stopSubscription();
  }
  defaultInvalidationService = null;
}
