/**
 * Event Handlers
 * @module services/rollup/external-object-index/event-handlers
 *
 * Event handlers for scan.completed events to trigger index updates.
 * Integrates with the event system for automatic index maintenance.
 *
 * TASK-ROLLUP-003: External Object Index event handling
 */

import pino from 'pino';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import type { IExternalObjectIndexService } from './interfaces.js';

const logger = pino({ name: 'external-object-index-events' });

/**
 * Scan completed event payload
 */
export interface ScanCompletedEvent {
  readonly type: 'scan.completed';
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
  readonly timestamp: Date;
  readonly data: {
    readonly nodesDetected: number;
    readonly edgesDetected: number;
    readonly duration: number;
  };
}

/**
 * Index updated event payload
 */
export interface IndexUpdatedEvent {
  readonly type: 'external-object-index.updated';
  readonly tenantId: TenantId;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
  readonly timestamp: Date;
  readonly data: {
    readonly entriesCreated: number;
    readonly entriesUpdated: number;
    readonly buildTimeMs: number;
  };
}

/**
 * Event publisher interface
 */
export interface IEventPublisher {
  publish(event: IndexUpdatedEvent): Promise<void>;
}

/**
 * Event handler configuration
 */
export interface EventHandlerConfig {
  /** Whether to process events asynchronously */
  readonly async: boolean;
  /** Maximum retry attempts for failed updates */
  readonly maxRetries: number;
  /** Retry delay in milliseconds */
  readonly retryDelayMs: number;
  /** Minimum nodes threshold to trigger index update */
  readonly minNodesThreshold: number;
}

/**
 * Default event handler configuration
 */
export const DEFAULT_EVENT_HANDLER_CONFIG: EventHandlerConfig = {
  async: true,
  maxRetries: 3,
  retryDelayMs: 1000,
  minNodesThreshold: 0,
};

/**
 * Event handler for scan.completed events.
 * Automatically updates the external object index when scans complete.
 */
export class ScanCompletedEventHandler {
  private readonly indexService: IExternalObjectIndexService;
  private readonly publisher: IEventPublisher | null;
  private readonly config: EventHandlerConfig;

  /**
   * Create a new ScanCompletedEventHandler
   * @param indexService - External object index service
   * @param publisher - Optional event publisher for emitting index events
   * @param config - Handler configuration
   */
  constructor(
    indexService: IExternalObjectIndexService,
    publisher?: IEventPublisher,
    config?: Partial<EventHandlerConfig>
  ) {
    this.indexService = indexService;
    this.publisher = publisher ?? null;
    this.config = { ...DEFAULT_EVENT_HANDLER_CONFIG, ...config };

    logger.info({ config: this.config }, 'Scan completed event handler initialized');
  }

  /**
   * Handle scan.completed event
   */
  async handle(event: ScanCompletedEvent): Promise<void> {
    const { tenantId, repositoryId, scanId, data } = event;

    logger.info(
      { tenantId, repositoryId, scanId, nodesDetected: data.nodesDetected },
      'Handling scan.completed event'
    );

    // Check threshold
    if (data.nodesDetected < this.config.minNodesThreshold) {
      logger.debug(
        { nodesDetected: data.nodesDetected, threshold: this.config.minNodesThreshold },
        'Skipping index update - below threshold'
      );
      return;
    }

    // Process with retries
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await this.indexService.buildIndex(tenantId, [repositoryId], {
          forceRebuild: false,
        });

        logger.info(
          {
            tenantId,
            repositoryId,
            scanId,
            entriesCreated: result.entriesCreated,
            buildTimeMs: result.buildTimeMs,
          },
          'Index updated from scan.completed event'
        );

        // Publish index updated event
        if (this.publisher) {
          await this.publisher.publish({
            type: 'external-object-index.updated',
            tenantId,
            repositoryId,
            scanId,
            timestamp: new Date(),
            data: {
              entriesCreated: result.entriesCreated,
              entriesUpdated: result.entriesUpdated,
              buildTimeMs: result.buildTimeMs,
            },
          });
        }

        return; // Success
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { error, tenantId, repositoryId, scanId, attempt, maxRetries: this.config.maxRetries },
          'Index update failed, retrying'
        );

        if (attempt < this.config.maxRetries) {
          await this.delay(this.config.retryDelayMs * attempt);
        }
      }
    }

    // All retries exhausted
    logger.error(
      { error: lastError, tenantId, repositoryId, scanId },
      'Index update failed after all retries'
    );

    // Don't throw - the scan is still successful even if index update failed
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create event handlers for external object index
 */
export function createEventHandlers(
  indexService: IExternalObjectIndexService,
  publisher?: IEventPublisher,
  config?: Partial<EventHandlerConfig>
): {
  scanCompleted: ScanCompletedEventHandler;
} {
  return {
    scanCompleted: new ScanCompletedEventHandler(indexService, publisher, config),
  };
}

/**
 * Register event handlers with an event emitter
 */
export function registerEventHandlers(
  emitter: {
    on(event: string, handler: (event: unknown) => Promise<void>): void;
  },
  handlers: {
    scanCompleted: ScanCompletedEventHandler;
  }
): void {
  emitter.on('scan.completed', async (event) => {
    await handlers.scanCompleted.handle(event as ScanCompletedEvent);
  });

  logger.info('Event handlers registered');
}
