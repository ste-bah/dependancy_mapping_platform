/**
 * Diff Event Handlers
 * @module services/rollup/graph-diff/diff-event-handlers
 *
 * Event handlers for scan lifecycle events that affect graph diff cache.
 * Handles scan.deleted and scan.updated events to maintain cache consistency.
 * Also provides event emission for diff computation lifecycle.
 *
 * Events Handled:
 * - scan.deleted: Invalidates all diffs involving the deleted scan
 * - scan.updated: Invalidates affected diffs if graph-related fields changed
 *
 * Events Emitted:
 * - diff.computed: When a diff computation completes successfully
 * - diff.failed: When a diff computation fails
 * - diff.cache.invalidated: When cache entries are invalidated
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import type { IDiffCache, GraphDiffId, GraphSnapshotId, DiffSummary } from './interfaces.js';

const logger = pino({ name: 'diff-event-handlers' });

// ============================================================================
// Event Types
// ============================================================================

/**
 * All possible diff event types
 */
export type DiffEventType =
  | 'diff.computed'
  | 'diff.failed'
  | 'diff.cache.invalidated';

/**
 * Scan deleted event payload
 */
export interface ScanDeletedEvent {
  readonly type: 'scan.deleted';
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
  readonly timestamp: Date;
  readonly data: {
    readonly deletedBy?: string;
    readonly reason?: string;
  };
}

/**
 * Scan updated event payload
 */
export interface ScanUpdatedEvent {
  readonly type: 'scan.updated';
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
  readonly timestamp: Date;
  readonly data: {
    /** Fields that were updated */
    readonly updatedFields: readonly string[];
    /** Whether graph-related data changed */
    readonly graphDataChanged?: boolean;
    /** Node count after update */
    readonly nodeCount?: number;
    /** Edge count after update */
    readonly edgeCount?: number;
  };
}

/**
 * Diff computed event payload
 */
export interface DiffComputedEvent {
  readonly type: 'diff.computed';
  readonly tenantId: TenantId;
  readonly diffId: GraphDiffId;
  readonly baseSnapshotId: GraphSnapshotId;
  readonly targetSnapshotId: GraphSnapshotId;
  readonly timestamp: Date;
  readonly data: {
    readonly summary: DiffSummary;
    readonly computationTimeMs: number;
    readonly cached: boolean;
  };
}

/**
 * Diff computation failed event payload
 */
export interface DiffFailedEvent {
  readonly type: 'diff.failed';
  readonly tenantId: TenantId;
  readonly baseSnapshotId: GraphSnapshotId;
  readonly targetSnapshotId: GraphSnapshotId;
  readonly timestamp: Date;
  readonly data: {
    readonly errorCode: string;
    readonly errorMessage: string;
    readonly attemptCount?: number;
  };
}

/**
 * Cache invalidation event payload
 */
export interface CacheInvalidatedEvent {
  readonly type: 'diff.cache.invalidated';
  readonly tenantId: TenantId;
  readonly timestamp: Date;
  readonly data: {
    readonly reason: 'scan_deleted' | 'scan_updated' | 'tenant_invalidation' | 'manual';
    readonly scanId?: ScanId;
    readonly entriesInvalidated: number;
  };
}

/**
 * Union type for all diff-related events
 */
export type DiffEvent = DiffComputedEvent | DiffFailedEvent | CacheInvalidatedEvent;

/**
 * CloudEvents-compatible event structure
 */
export interface CloudEvent<T extends DiffEvent = DiffEvent> {
  /** Unique event identifier (UUID) */
  readonly id: string;
  /** Event type (e.g., 'diff.computed') */
  readonly type: T['type'];
  /** Source of the event */
  readonly source: string;
  /** Event timestamp (ISO 8601) */
  readonly time: string;
  /** CloudEvents spec version */
  readonly specversion: '1.0';
  /** Content type */
  readonly datacontenttype: 'application/json';
  /** Event payload */
  readonly data: T;
  /** Correlation ID for tracing */
  readonly correlationid?: string;
  /** Tenant ID for routing */
  readonly tenantid: TenantId;
}

// ============================================================================
// Event Publisher Interface
// ============================================================================

/**
 * Interface for publishing diff events
 */
export interface IDiffEventPublisher {
  /**
   * Publish an event to the event bus
   * @param channel - Channel to publish to
   * @param event - Event payload
   */
  publish(channel: string, event: string): Promise<void>;
}

// ============================================================================
// Event Handler Configuration
// ============================================================================

/**
 * Configuration for diff event handlers
 */
export interface DiffEventHandlerConfig {
  /** Channel prefix for pub/sub */
  readonly channelPrefix: string;
  /** Source identifier for CloudEvents */
  readonly source: string;
  /** Whether to log events */
  readonly logEvents: boolean;
  /** Maximum retry attempts for failed operations */
  readonly maxRetries: number;
  /** Retry delay in milliseconds */
  readonly retryDelayMs: number;
  /** Graph-related fields that trigger cache invalidation on update */
  readonly graphRelatedFields: readonly string[];
}

/**
 * Default event handler configuration
 */
export const DEFAULT_DIFF_EVENT_HANDLER_CONFIG: DiffEventHandlerConfig = {
  channelPrefix: 'diff:events',
  source: 'graph-diff-service',
  logEvents: true,
  maxRetries: 3,
  retryDelayMs: 100,
  graphRelatedFields: [
    'nodes',
    'edges',
    'graphData',
    'graphHash',
    'nodeCount',
    'edgeCount',
    'dependencies',
    'dependencyGraph',
  ],
};

// ============================================================================
// Diff Event Emitter
// ============================================================================

/**
 * Event emitter for diff-related events.
 * Publishes CloudEvents-compatible messages via Redis pub/sub.
 */
export class DiffEventEmitter {
  private readonly config: DiffEventHandlerConfig;

  constructor(
    private readonly publisher: IDiffEventPublisher | null,
    config: Partial<DiffEventHandlerConfig> = {}
  ) {
    this.config = { ...DEFAULT_DIFF_EVENT_HANDLER_CONFIG, ...config };
    logger.info({ config: this.config }, 'Diff event emitter initialized');
  }

  /**
   * Emit a diff.computed event
   */
  async emitDiffComputed(
    tenantId: TenantId,
    payload: {
      diffId: GraphDiffId;
      baseSnapshotId: GraphSnapshotId;
      targetSnapshotId: GraphSnapshotId;
      summary: DiffSummary;
      computationTimeMs: number;
      cached: boolean;
    },
    correlationId?: string
  ): Promise<void> {
    const event: DiffComputedEvent = {
      type: 'diff.computed',
      tenantId,
      diffId: payload.diffId,
      baseSnapshotId: payload.baseSnapshotId,
      targetSnapshotId: payload.targetSnapshotId,
      timestamp: new Date(),
      data: {
        summary: payload.summary,
        computationTimeMs: payload.computationTimeMs,
        cached: payload.cached,
      },
    };

    await this.emit(event, correlationId);
  }

  /**
   * Emit a diff.failed event
   */
  async emitDiffFailed(
    tenantId: TenantId,
    payload: {
      baseSnapshotId: GraphSnapshotId;
      targetSnapshotId: GraphSnapshotId;
      errorCode: string;
      errorMessage: string;
      attemptCount?: number;
    },
    correlationId?: string
  ): Promise<void> {
    const eventData: DiffFailedEvent['data'] = {
      errorCode: payload.errorCode,
      errorMessage: payload.errorMessage,
    };
    // Only include attemptCount if defined (exactOptionalPropertyTypes compliance)
    if (payload.attemptCount !== undefined) {
      (eventData as { attemptCount: number }).attemptCount = payload.attemptCount;
    }

    const event: DiffFailedEvent = {
      type: 'diff.failed',
      tenantId,
      baseSnapshotId: payload.baseSnapshotId,
      targetSnapshotId: payload.targetSnapshotId,
      timestamp: new Date(),
      data: eventData,
    };

    await this.emit(event, correlationId);
  }

  /**
   * Emit a diff.cache.invalidated event
   */
  async emitCacheInvalidated(
    tenantId: TenantId,
    payload: {
      reason: 'scan_deleted' | 'scan_updated' | 'tenant_invalidation' | 'manual';
      scanId?: ScanId;
      entriesInvalidated: number;
    },
    correlationId?: string
  ): Promise<void> {
    const eventData: CacheInvalidatedEvent['data'] = {
      reason: payload.reason,
      entriesInvalidated: payload.entriesInvalidated,
    };
    // Only include scanId if defined (exactOptionalPropertyTypes compliance)
    if (payload.scanId !== undefined) {
      (eventData as { scanId: ScanId }).scanId = payload.scanId;
    }

    const event: CacheInvalidatedEvent = {
      type: 'diff.cache.invalidated',
      tenantId,
      timestamp: new Date(),
      data: eventData,
    };

    await this.emit(event, correlationId);
  }

  /**
   * Internal emit method - wraps event in CloudEvents envelope
   */
  private async emit(event: DiffEvent, correlationId?: string): Promise<void> {
    const cloudEvent = this.wrapInCloudEvent(event, correlationId);

    if (this.config.logEvents) {
      logger.info(
        {
          eventId: cloudEvent.id,
          eventType: cloudEvent.type,
          tenantId: cloudEvent.tenantid,
          correlationId: cloudEvent.correlationid,
        },
        `Diff event: ${cloudEvent.type}`
      );
    }

    if (this.publisher) {
      await this.publishWithRetry(cloudEvent);
    }
  }

  /**
   * Wrap event in CloudEvents envelope
   */
  private wrapInCloudEvent<T extends DiffEvent>(
    event: T,
    correlationId?: string
  ): CloudEvent<T> {
    const cloudEvent: CloudEvent<T> = {
      id: randomUUID(),
      type: event.type,
      source: this.config.source,
      time: event.timestamp.toISOString(),
      specversion: '1.0',
      datacontenttype: 'application/json',
      data: event,
      tenantid: event.tenantId,
    };

    // Only include correlationid if defined (exactOptionalPropertyTypes compliance)
    if (correlationId !== undefined) {
      (cloudEvent as { correlationid: string }).correlationid = correlationId;
    }

    return cloudEvent;
  }

  /**
   * Publish event with retry logic
   */
  private async publishWithRetry(event: CloudEvent): Promise<void> {
    const channel = this.getChannelForEvent(event.type);
    const message = JSON.stringify(event);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        await this.publisher!.publish(channel, message);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          {
            eventId: event.id,
            attempt: attempt + 1,
            maxAttempts: this.config.maxRetries,
            err: lastError,
          },
          'Failed to publish diff event, retrying...'
        );

        if (attempt < this.config.maxRetries - 1) {
          await this.delay(this.config.retryDelayMs * Math.pow(2, attempt));
        }
      }
    }

    // Log failure but don't throw - events are fire-and-forget
    logger.error(
      {
        eventId: event.id,
        eventType: event.type,
        err: lastError,
      },
      'Failed to publish diff event after all retries'
    );
  }

  /**
   * Get pub/sub channel for event type
   */
  private getChannelForEvent(eventType: DiffEventType): string {
    const channelMap: Record<DiffEventType, string> = {
      'diff.computed': 'computation',
      'diff.failed': 'computation',
      'diff.cache.invalidated': 'cache',
    };

    const channelSuffix = channelMap[eventType] ?? 'general';
    return `${this.config.channelPrefix}:${channelSuffix}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Scan Event Handlers
// ============================================================================

/**
 * Handler for scan lifecycle events that affect diff cache.
 * Invalidates cached diffs when scans are deleted or updated.
 */
export class ScanEventHandler {
  private readonly cache: IDiffCache;
  private readonly eventEmitter: DiffEventEmitter | null;
  private readonly config: DiffEventHandlerConfig;

  /**
   * Create a new ScanEventHandler
   * @param cache - Diff cache for invalidation
   * @param eventEmitter - Optional event emitter for publishing invalidation events
   * @param config - Handler configuration
   */
  constructor(
    cache: IDiffCache,
    eventEmitter?: DiffEventEmitter,
    config?: Partial<DiffEventHandlerConfig>
  ) {
    this.cache = cache;
    this.eventEmitter = eventEmitter ?? null;
    this.config = { ...DEFAULT_DIFF_EVENT_HANDLER_CONFIG, ...config };

    logger.info({ config: this.config }, 'Scan event handler initialized');
  }

  /**
   * Handle scan.deleted event.
   * Invalidates all cached diffs where this scan is either base or compare snapshot.
   */
  async handleScanDeleted(event: ScanDeletedEvent): Promise<void> {
    const { tenantId, repositoryId, scanId } = event;

    logger.info(
      { tenantId, repositoryId, scanId },
      'Handling scan.deleted event - invalidating related diffs'
    );

    let invalidatedCount = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Invalidate all diffs involving this scan
        // The cache uses scanId as GraphSnapshotId
        const snapshotId = scanId as unknown as GraphSnapshotId;
        invalidatedCount = await this.cache.invalidateBySnapshot(tenantId, snapshotId);

        logger.info(
          { tenantId, repositoryId, scanId, invalidatedCount },
          'Diff cache invalidated after scan deletion'
        );

        // Emit cache invalidation event
        if (this.eventEmitter) {
          await this.eventEmitter.emitCacheInvalidated(tenantId, {
            reason: 'scan_deleted',
            scanId,
            entriesInvalidated: invalidatedCount,
          });
        }

        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { error, tenantId, scanId, attempt, maxRetries: this.config.maxRetries },
          'Cache invalidation failed, retrying'
        );

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    // Log failure - don't throw as event handling should be resilient
    logger.error(
      { error: lastError, tenantId, repositoryId, scanId },
      'Failed to invalidate diff cache after scan deletion'
    );
  }

  /**
   * Handle scan.updated event.
   * Only invalidates cache if graph-related fields were updated.
   */
  async handleScanUpdated(event: ScanUpdatedEvent): Promise<void> {
    const { tenantId, repositoryId, scanId, data } = event;

    // Check if any graph-related fields changed
    const graphFieldsChanged = this.hasGraphRelatedChanges(data.updatedFields, data.graphDataChanged);

    if (!graphFieldsChanged) {
      logger.debug(
        { tenantId, repositoryId, scanId, updatedFields: data.updatedFields },
        'Scan updated but no graph-related changes - skipping cache invalidation'
      );
      return;
    }

    logger.info(
      { tenantId, repositoryId, scanId, updatedFields: data.updatedFields },
      'Handling scan.updated event with graph changes - invalidating related diffs'
    );

    let invalidatedCount = 0;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Invalidate all diffs involving this scan
        const snapshotId = scanId as unknown as GraphSnapshotId;
        invalidatedCount = await this.cache.invalidateBySnapshot(tenantId, snapshotId);

        logger.info(
          { tenantId, repositoryId, scanId, invalidatedCount },
          'Diff cache invalidated after scan update'
        );

        // Emit cache invalidation event
        if (this.eventEmitter) {
          await this.eventEmitter.emitCacheInvalidated(tenantId, {
            reason: 'scan_updated',
            scanId,
            entriesInvalidated: invalidatedCount,
          });
        }

        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { error, tenantId, scanId, attempt, maxRetries: this.config.maxRetries },
          'Cache invalidation failed, retrying'
        );

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    // Log failure - don't throw as event handling should be resilient
    logger.error(
      { error: lastError, tenantId, repositoryId, scanId },
      'Failed to invalidate diff cache after scan update'
    );
  }

  /**
   * Check if any graph-related fields were updated
   */
  private hasGraphRelatedChanges(
    updatedFields: readonly string[],
    graphDataChanged?: boolean
  ): boolean {
    // Explicit flag takes precedence
    if (graphDataChanged !== undefined) {
      return graphDataChanged;
    }

    // Check if any updated fields are graph-related
    return updatedFields.some((field) =>
      this.config.graphRelatedFields.some((graphField) =>
        field.toLowerCase().includes(graphField.toLowerCase())
      )
    );
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// In-Memory Event Emitter (for testing)
// ============================================================================

/**
 * In-memory event emitter for testing purposes
 */
export class InMemoryDiffEventEmitter extends DiffEventEmitter {
  private readonly events: CloudEvent[] = [];

  constructor(config?: Partial<DiffEventHandlerConfig>) {
    // Use a mock publisher that captures events
    const mockPublisher: IDiffEventPublisher = {
      publish: async (_channel: string, event: string) => {
        const parsed = JSON.parse(event) as CloudEvent;
        this.events.push(parsed);
      },
    };

    super(mockPublisher, config);
  }

  /**
   * Get all emitted events
   */
  getEvents(): readonly CloudEvent[] {
    return [...this.events];
  }

  /**
   * Get events by type
   */
  getEventsByType(type: DiffEventType): CloudEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by tenant
   */
  getEventsByTenant(tenantId: TenantId): CloudEvent[] {
    return this.events.filter((e) => e.tenantid === tenantId);
  }

  /**
   * Clear all stored events
   */
  clear(): void {
    this.events.length = 0;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a diff event emitter
 */
export function createDiffEventEmitter(
  publisher: IDiffEventPublisher | null,
  config?: Partial<DiffEventHandlerConfig>
): DiffEventEmitter {
  return new DiffEventEmitter(publisher, config);
}

/**
 * Create an in-memory event emitter for testing
 */
export function createInMemoryDiffEventEmitter(
  config?: Partial<DiffEventHandlerConfig>
): InMemoryDiffEventEmitter {
  return new InMemoryDiffEventEmitter(config);
}

/**
 * Create a scan event handler
 */
export function createScanEventHandler(
  cache: IDiffCache,
  eventEmitter?: DiffEventEmitter,
  config?: Partial<DiffEventHandlerConfig>
): ScanEventHandler {
  return new ScanEventHandler(cache, eventEmitter, config);
}

/**
 * Create event handlers for diff service integration
 */
export function createDiffEventHandlers(
  cache: IDiffCache,
  publisher?: IDiffEventPublisher,
  config?: Partial<DiffEventHandlerConfig>
): {
  scanEventHandler: ScanEventHandler;
  diffEventEmitter: DiffEventEmitter;
} {
  const diffEventEmitter = new DiffEventEmitter(publisher ?? null, config);
  const scanEventHandler = new ScanEventHandler(cache, diffEventEmitter, config);

  return {
    scanEventHandler,
    diffEventEmitter,
  };
}

/**
 * Register event handlers with an event emitter/bus
 */
export function registerDiffEventHandlers(
  emitter: {
    on(event: string, handler: (event: unknown) => Promise<void>): void;
  },
  handlers: {
    scanEventHandler: ScanEventHandler;
  }
): void {
  emitter.on('scan.deleted', async (event) => {
    await handlers.scanEventHandler.handleScanDeleted(event as ScanDeletedEvent);
  });

  emitter.on('scan.updated', async (event) => {
    await handlers.scanEventHandler.handleScanUpdated(event as ScanUpdatedEvent);
  });

  logger.info('Diff event handlers registered');
}

// ============================================================================
// Re-exports (for convenient access)
// ============================================================================

// Note: DEFAULT_DIFF_EVENT_HANDLER_CONFIG is already exported at declaration
