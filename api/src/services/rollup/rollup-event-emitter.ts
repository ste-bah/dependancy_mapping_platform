/**
 * Rollup Event Emitter
 * @module services/rollup/rollup-event-emitter
 *
 * Event emitter for Cross-Repository Aggregation (Rollup) lifecycle events.
 * Publishes events via Redis pub/sub for distributed consumption.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation event emitter implementation
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import { TenantId } from '../../types/entities.js';
import { RollupId, RollupExecutionId, RollupExecutionStats } from '../../types/rollup.js';

const logger = pino({ name: 'rollup-event-emitter' });

// ============================================================================
// Event Types
// ============================================================================

/**
 * All possible rollup event types
 */
export type RollupEventType =
  | 'rollup.created'
  | 'rollup.updated'
  | 'rollup.deleted'
  | 'rollup.execution.started'
  | 'rollup.execution.progress'
  | 'rollup.execution.completed'
  | 'rollup.execution.failed'
  | 'rollup.execution.cancelled';

/**
 * Base rollup event structure
 */
export interface RollupEvent {
  /** Event type */
  readonly type: RollupEventType;
  /** Rollup ID */
  readonly rollupId: string;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** Event timestamp */
  readonly timestamp: Date;
  /** Event data (varies by type) */
  readonly data: Record<string, unknown>;
}

/**
 * Full event with metadata
 */
export interface RollupEventWithMetadata extends RollupEvent {
  /** Unique event ID */
  readonly eventId: string;
  /** Correlation ID for tracing */
  readonly correlationId: string;
  /** Event version for schema evolution */
  readonly version: number;
  /** Source service */
  readonly source: string;
}

// ============================================================================
// Event Emitter Interface
// ============================================================================

/**
 * Interface for rollup event emission
 */
export interface IRollupEventEmitter {
  /**
   * Emit a rollup event
   * @param event - Event to emit
   * @param correlationId - Optional correlation ID for tracing
   */
  emit(event: RollupEvent, correlationId?: string): Promise<void>;

  /**
   * Subscribe to rollup events (optional)
   * @param handler - Event handler function
   * @param eventTypes - Event types to subscribe to (all if not specified)
   */
  subscribe?(
    handler: (event: RollupEventWithMetadata) => Promise<void>,
    eventTypes?: RollupEventType[]
  ): Promise<() => void>;
}

// ============================================================================
// Event Publisher Interface (for Redis/message queue)
// ============================================================================

/**
 * Interface for underlying pub/sub system
 */
export interface IEventPublisher {
  /**
   * Publish a message to a channel
   * @param channel - Channel name
   * @param message - Message payload
   */
  publish(channel: string, message: string): Promise<void>;

  /**
   * Subscribe to a channel
   * @param channel - Channel name
   * @param handler - Message handler
   */
  subscribe?(channel: string, handler: (message: string) => void): Promise<() => void>;
}

// ============================================================================
// Rollup Event Emitter Implementation
// ============================================================================

/**
 * Configuration for the event emitter
 */
export interface RollupEventEmitterConfig {
  /** Channel prefix for pub/sub */
  readonly channelPrefix: string;
  /** Source identifier */
  readonly source: string;
  /** Whether to log events */
  readonly logEvents: boolean;
  /** Event version */
  readonly eventVersion: number;
  /** Retry configuration */
  readonly retry: {
    readonly maxAttempts: number;
    readonly backoffMs: number;
  };
}

/**
 * Default event emitter configuration
 */
export const DEFAULT_EVENT_EMITTER_CONFIG: RollupEventEmitterConfig = {
  channelPrefix: 'rollup:events',
  source: 'rollup-service',
  logEvents: true,
  eventVersion: 1,
  retry: {
    maxAttempts: 3,
    backoffMs: 100,
  },
};

/**
 * Rollup event emitter implementation
 * Emits events via pub/sub system with resilient error handling
 */
export class RollupEventEmitter implements IRollupEventEmitter {
  private readonly config: RollupEventEmitterConfig;
  private readonly correlationIdStore: Map<string, string> = new Map();

  constructor(
    private readonly publisher: IEventPublisher | null,
    config: Partial<RollupEventEmitterConfig> = {}
  ) {
    this.config = { ...DEFAULT_EVENT_EMITTER_CONFIG, ...config };
  }

  /**
   * Emit a rollup event
   */
  async emit(event: RollupEvent, correlationId?: string): Promise<void> {
    const eventId = randomUUID();
    const effectiveCorrelationId =
      correlationId ||
      this.correlationIdStore.get(event.rollupId) ||
      randomUUID();

    // Store correlation ID for future events in this rollup
    this.correlationIdStore.set(event.rollupId, effectiveCorrelationId);

    const fullEvent: RollupEventWithMetadata = {
      ...event,
      eventId,
      correlationId: effectiveCorrelationId,
      version: this.config.eventVersion,
      source: this.config.source,
    };

    // Log the event if configured
    if (this.config.logEvents) {
      logger.info(
        {
          eventId,
          eventType: event.type,
          rollupId: event.rollupId,
          tenantId: event.tenantId,
          correlationId: effectiveCorrelationId,
        },
        `Rollup event: ${event.type}`
      );
    }

    // Publish to pub/sub if publisher available
    if (this.publisher) {
      await this.publishWithRetry(fullEvent);
    }

    // Clean up correlation ID on terminal events
    if (
      event.type === 'rollup.deleted' ||
      event.type === 'rollup.execution.completed' ||
      event.type === 'rollup.execution.failed' ||
      event.type === 'rollup.execution.cancelled'
    ) {
      // Keep correlation ID for a short time for any follow-up events
      setTimeout(() => {
        this.correlationIdStore.delete(event.rollupId);
      }, 60000);
    }
  }

  /**
   * Subscribe to rollup events (if publisher supports subscriptions)
   */
  async subscribe(
    handler: (event: RollupEventWithMetadata) => Promise<void>,
    eventTypes?: RollupEventType[]
  ): Promise<() => void> {
    if (!this.publisher?.subscribe) {
      logger.warn('Event subscription not supported by publisher');
      return () => {};
    }

    const channel = `${this.config.channelPrefix}:*`;

    const unsubscribe = await this.publisher.subscribe(channel, async (message) => {
      try {
        const event = JSON.parse(message) as RollupEventWithMetadata;

        // Filter by event types if specified
        if (eventTypes && !eventTypes.includes(event.type)) {
          return;
        }

        await handler(event);
      } catch (error) {
        logger.error(
          { err: error, message },
          'Failed to process subscribed event'
        );
      }
    });

    return unsubscribe;
  }

  /**
   * Publish event with retry logic
   */
  private async publishWithRetry(event: RollupEventWithMetadata): Promise<void> {
    const channel = this.getChannelForEvent(event.type);
    const message = JSON.stringify(this.serializeEvent(event));

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.retry.maxAttempts; attempt++) {
      try {
        await this.publisher!.publish(channel, message);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(
          {
            eventId: event.eventId,
            attempt: attempt + 1,
            maxAttempts: this.config.retry.maxAttempts,
            err: lastError,
          },
          'Failed to publish event, retrying...'
        );

        // Exponential backoff
        if (attempt < this.config.retry.maxAttempts - 1) {
          await this.delay(this.config.retry.backoffMs * Math.pow(2, attempt));
        }
      }
    }

    // Log failure but don't throw - events are fire-and-forget
    logger.error(
      {
        eventId: event.eventId,
        eventType: event.type,
        err: lastError,
      },
      'Failed to publish event after all retries'
    );
  }

  /**
   * Get pub/sub channel for event type
   */
  private getChannelForEvent(eventType: RollupEventType): string {
    // Map event types to channels
    const channelMap: Record<string, string> = {
      'rollup.created': 'lifecycle',
      'rollup.updated': 'lifecycle',
      'rollup.deleted': 'lifecycle',
      'rollup.execution.started': 'execution',
      'rollup.execution.progress': 'execution',
      'rollup.execution.completed': 'execution',
      'rollup.execution.failed': 'execution',
      'rollup.execution.cancelled': 'execution',
    };

    const channelSuffix = channelMap[eventType] || 'general';
    return `${this.config.channelPrefix}:${channelSuffix}`;
  }

  /**
   * Serialize event for transport
   */
  private serializeEvent(event: RollupEventWithMetadata): Record<string, unknown> {
    return {
      ...event,
      timestamp: event.timestamp.toISOString(),
    };
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// In-Memory Event Emitter (for testing/development)
// ============================================================================

/**
 * In-memory event emitter for testing
 */
export class InMemoryRollupEventEmitter implements IRollupEventEmitter {
  private readonly events: RollupEventWithMetadata[] = [];
  private readonly handlers: Map<
    string,
    Array<{
      handler: (event: RollupEventWithMetadata) => Promise<void>;
      eventTypes?: RollupEventType[];
    }>
  > = new Map();

  /**
   * Emit an event (stores in memory and notifies handlers)
   */
  async emit(event: RollupEvent, correlationId?: string): Promise<void> {
    const fullEvent: RollupEventWithMetadata = {
      ...event,
      eventId: randomUUID(),
      correlationId: correlationId || randomUUID(),
      version: 1,
      source: 'in-memory',
    };

    this.events.push(fullEvent);

    // Notify all handlers
    for (const [, subscribers] of this.handlers) {
      for (const { handler, eventTypes } of subscribers) {
        if (!eventTypes || eventTypes.includes(event.type)) {
          try {
            await handler(fullEvent);
          } catch (error) {
            logger.warn({ err: error, eventType: event.type }, 'Handler error');
          }
        }
      }
    }
  }

  /**
   * Subscribe to events
   */
  async subscribe(
    handler: (event: RollupEventWithMetadata) => Promise<void>,
    eventTypes?: RollupEventType[]
  ): Promise<() => void> {
    const subscriptionId = randomUUID();

    if (!this.handlers.has(subscriptionId)) {
      this.handlers.set(subscriptionId, []);
    }

    this.handlers.get(subscriptionId)!.push({ handler, eventTypes });

    return () => {
      this.handlers.delete(subscriptionId);
    };
  }

  /**
   * Get all emitted events (for testing)
   */
  getEvents(): readonly RollupEventWithMetadata[] {
    return this.events;
  }

  /**
   * Get events by type (for testing)
   */
  getEventsByType(type: RollupEventType): RollupEventWithMetadata[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get events by rollup ID (for testing)
   */
  getEventsByRollupId(rollupId: string): RollupEventWithMetadata[] {
    return this.events.filter((e) => e.rollupId === rollupId);
  }

  /**
   * Clear all events (for testing)
   */
  clear(): void {
    this.events.length = 0;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new RollupEventEmitter with a pub/sub publisher
 */
export function createRollupEventEmitter(
  publisher: IEventPublisher | null,
  config?: Partial<RollupEventEmitterConfig>
): IRollupEventEmitter {
  return new RollupEventEmitter(publisher, config);
}

/**
 * Create an in-memory event emitter (for testing)
 */
export function createInMemoryEventEmitter(): InMemoryRollupEventEmitter {
  return new InMemoryRollupEventEmitter();
}
