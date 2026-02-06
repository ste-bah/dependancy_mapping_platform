/**
 * Event Integration Tests
 * @module services/rollup/__tests__/integration/events.test
 *
 * Integration tests for Redis pub/sub events, event ordering,
 * payload validation, and subscriber notification.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation event integration tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import {
  RollupEventEmitter,
  InMemoryRollupEventEmitter,
  RollupEvent,
  RollupEventWithMetadata,
  RollupEventType,
  IEventPublisher,
  DEFAULT_EVENT_EMITTER_CONFIG,
  createInMemoryEventEmitter,
} from '../../rollup-event-emitter.js';
import {
  createTenantId,
  createRollupId,
  createExecutionId,
  createExecutionStats,
} from '../fixtures/rollup-fixtures.js';
import type { TenantId } from '../../../../types/entities.js';

// ============================================================================
// Mock Redis Pub/Sub Implementation
// ============================================================================

/**
 * In-memory message broker simulating Redis pub/sub behavior
 */
class MockRedisPublisher implements IEventPublisher {
  private channels: Map<string, Set<(message: string) => void>> = new Map();
  private publishedMessages: Array<{ channel: string; message: string; timestamp: Date }> = [];
  private shouldFail = false;
  private failureCount = 0;
  private maxFailures = 0;
  private latencyMs = 0;

  async publish(channel: string, message: string): Promise<void> {
    // Simulate network latency
    if (this.latencyMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    }

    // Simulate failures
    if (this.shouldFail) {
      this.failureCount++;
      if (this.failureCount <= this.maxFailures) {
        throw new Error('Simulated publish failure');
      }
    }

    this.publishedMessages.push({
      channel,
      message,
      timestamp: new Date(),
    });

    // Notify subscribers
    const handlers = this.channels.get(channel);
    if (handlers) {
      for (const handler of handlers) {
        handler(message);
      }
    }

    // Pattern matching for wildcards (e.g., "rollup:events:*")
    for (const [pattern, patternHandlers] of this.channels.entries()) {
      if (pattern.endsWith('*')) {
        const prefix = pattern.slice(0, -1);
        if (channel.startsWith(prefix)) {
          for (const handler of patternHandlers) {
            handler(message);
          }
        }
      }
    }
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<() => void> {
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
    }
    this.channels.get(channel)!.add(handler);

    return () => {
      this.channels.get(channel)?.delete(handler);
    };
  }

  // Test helpers
  getPublishedMessages(): Array<{ channel: string; message: string; timestamp: Date }> {
    return [...this.publishedMessages];
  }

  getMessagesByChannel(channel: string): string[] {
    return this.publishedMessages
      .filter(m => m.channel === channel)
      .map(m => m.message);
  }

  clear(): void {
    this.publishedMessages = [];
    this.failureCount = 0;
  }

  simulateFailure(maxFailures: number): void {
    this.shouldFail = true;
    this.maxFailures = maxFailures;
    this.failureCount = 0;
  }

  stopSimulatingFailure(): void {
    this.shouldFail = false;
    this.maxFailures = 0;
    this.failureCount = 0;
  }

  setLatency(ms: number): void {
    this.latencyMs = ms;
  }
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('Event Integration Tests', () => {
  let publisher: MockRedisPublisher;
  let eventEmitter: RollupEventEmitter;
  const tenantId = createTenantId();

  beforeAll(() => {
    publisher = new MockRedisPublisher();
    eventEmitter = new RollupEventEmitter(publisher, {
      channelPrefix: 'rollup:events',
      logEvents: false, // Disable logging during tests
    });
  });

  beforeEach(() => {
    publisher.clear();
    publisher.stopSimulatingFailure();
    publisher.setLatency(0);
  });

  // ==========================================================================
  // Event Publishing
  // ==========================================================================

  describe('Event Publishing', () => {
    it('should publish rollup created event', async () => {
      const rollupId = createRollupId();
      const event: RollupEvent = {
        type: 'rollup.created',
        rollupId,
        tenantId,
        timestamp: new Date(),
        data: {
          name: 'Test Rollup',
          repositoryCount: 2,
        },
      };

      await eventEmitter.emit(event);

      const messages = publisher.getPublishedMessages();
      expect(messages.length).toBe(1);
      expect(messages[0].channel).toBe('rollup:events:lifecycle');

      const payload = JSON.parse(messages[0].message);
      expect(payload.type).toBe('rollup.created');
      expect(payload.rollupId).toBe(rollupId);
      expect(payload.data.name).toBe('Test Rollup');
    });

    it('should publish execution events to correct channel', async () => {
      const rollupId = createRollupId();
      const executionId = createExecutionId();

      const events: RollupEvent[] = [
        {
          type: 'rollup.execution.started',
          rollupId,
          tenantId,
          timestamp: new Date(),
          data: { executionId },
        },
        {
          type: 'rollup.execution.progress',
          rollupId,
          tenantId,
          timestamp: new Date(),
          data: { executionId, progress: 50 },
        },
        {
          type: 'rollup.execution.completed',
          rollupId,
          tenantId,
          timestamp: new Date(),
          data: { executionId, stats: createExecutionStats() },
        },
      ];

      for (const event of events) {
        await eventEmitter.emit(event);
      }

      const executionMessages = publisher.getMessagesByChannel('rollup:events:execution');
      expect(executionMessages.length).toBe(3);

      const types = executionMessages.map(m => JSON.parse(m).type);
      expect(types).toEqual([
        'rollup.execution.started',
        'rollup.execution.progress',
        'rollup.execution.completed',
      ]);
    });

    it('should include event metadata', async () => {
      const event: RollupEvent = {
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      };

      await eventEmitter.emit(event);

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.eventId).toBeDefined();
      expect(payload.correlationId).toBeDefined();
      expect(payload.version).toBe(1);
      expect(payload.source).toBe('rollup-service');
      expect(payload.timestamp).toBeDefined();
    });

    it('should serialize timestamp as ISO string', async () => {
      const timestamp = new Date('2024-01-15T10:30:00.000Z');
      const event: RollupEvent = {
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp,
        data: {},
      };

      await eventEmitter.emit(event);

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.timestamp).toBe('2024-01-15T10:30:00.000Z');
    });
  });

  // ==========================================================================
  // Event Ordering
  // ==========================================================================

  describe('Event Ordering', () => {
    it('should maintain event order within same rollup', async () => {
      const rollupId = createRollupId();
      const events: RollupEvent[] = [];

      // Create events with explicit order
      for (let i = 0; i < 10; i++) {
        events.push({
          type: 'rollup.execution.progress',
          rollupId,
          tenantId,
          timestamp: new Date(Date.now() + i),
          data: { progress: i * 10 },
        });
      }

      for (const event of events) {
        await eventEmitter.emit(event);
      }

      const messages = publisher.getPublishedMessages();
      const progressValues = messages.map(m => JSON.parse(m.message).data.progress);

      expect(progressValues).toEqual([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]);
    });

    it('should preserve correlation ID across related events', async () => {
      const rollupId = createRollupId();

      // First event establishes correlation
      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      // Subsequent events should share correlation ID
      await eventEmitter.emit({
        type: 'rollup.execution.started',
        rollupId,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await eventEmitter.emit({
        type: 'rollup.execution.completed',
        rollupId,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      const messages = publisher.getPublishedMessages();
      const correlationIds = messages.map(m => JSON.parse(m.message).correlationId);

      // All events for same rollup should have same correlation ID
      expect(new Set(correlationIds).size).toBe(1);
    });

    it('should use different correlation IDs for different rollups', async () => {
      const rollupId1 = createRollupId();
      const rollupId2 = createRollupId();

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: rollupId1,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: rollupId2,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      const messages = publisher.getPublishedMessages();
      const correlations = messages.map(m => ({
        rollupId: JSON.parse(m.message).rollupId,
        correlationId: JSON.parse(m.message).correlationId,
      }));

      expect(correlations[0].correlationId).not.toBe(correlations[1].correlationId);
    });

    it('should accept explicit correlation ID', async () => {
      const explicitCorrelationId = randomUUID();

      await eventEmitter.emit(
        {
          type: 'rollup.created',
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        },
        explicitCorrelationId
      );

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.correlationId).toBe(explicitCorrelationId);
    });
  });

  // ==========================================================================
  // Event Payload Validation
  // ==========================================================================

  describe('Event Payload Validation', () => {
    it('should include required fields in all events', async () => {
      const eventTypes: RollupEventType[] = [
        'rollup.created',
        'rollup.updated',
        'rollup.deleted',
        'rollup.execution.started',
        'rollup.execution.progress',
        'rollup.execution.completed',
        'rollup.execution.failed',
        'rollup.execution.cancelled',
      ];

      for (const eventType of eventTypes) {
        await eventEmitter.emit({
          type: eventType,
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        });
      }

      const messages = publisher.getPublishedMessages();

      for (const message of messages) {
        const payload = JSON.parse(message.message);

        // All events must have these fields
        expect(payload.type).toBeDefined();
        expect(payload.rollupId).toBeDefined();
        expect(payload.tenantId).toBeDefined();
        expect(payload.timestamp).toBeDefined();
        expect(payload.eventId).toBeDefined();
        expect(payload.correlationId).toBeDefined();
        expect(payload.version).toBeDefined();
        expect(payload.source).toBeDefined();
        expect(payload.data).toBeDefined();
      }
    });

    it('should preserve complex data structures', async () => {
      const stats = createExecutionStats();
      const event: RollupEvent = {
        type: 'rollup.execution.completed',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {
          stats,
          matches: [
            { source: 'node_1', target: 'node_2', confidence: 95 },
            { source: 'node_3', target: 'node_4', confidence: 88 },
          ],
        },
      };

      await eventEmitter.emit(event);

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.data.stats).toEqual(stats);
      expect(payload.data.matches.length).toBe(2);
    });

    it('should handle empty data object', async () => {
      await eventEmitter.emit({
        type: 'rollup.deleted',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.data).toEqual({});
    });

    it('should handle special characters in data', async () => {
      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {
          name: 'Test "Rollup" with \'quotes\' and \\ backslash',
          description: 'Contains\nnewlines\tand\ttabs',
          unicode: '\u0000\u001f\u007f',
        },
      });

      const messages = publisher.getPublishedMessages();
      const payload = JSON.parse(messages[0].message);

      expect(payload.data.name).toBe('Test "Rollup" with \'quotes\' and \\ backslash');
      expect(payload.data.description).toBe('Contains\nnewlines\tand\ttabs');
    });
  });

  // ==========================================================================
  // Subscriber Notification
  // ==========================================================================

  describe('Subscriber Notification', () => {
    it('should notify subscribers of events', async () => {
      const receivedEvents: RollupEventWithMetadata[] = [];

      const unsubscribe = await eventEmitter.subscribe!(
        async (event) => {
          receivedEvents.push(event);
        }
      );

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe('rollup.created');

      unsubscribe();
    });

    it('should filter events by type', async () => {
      const receivedEvents: RollupEventWithMetadata[] = [];

      const unsubscribe = await eventEmitter.subscribe!(
        async (event) => {
          receivedEvents.push(event);
        },
        ['rollup.execution.completed']
      );

      // Emit various events
      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await eventEmitter.emit({
        type: 'rollup.execution.started',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await eventEmitter.emit({
        type: 'rollup.execution.completed',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should only receive completion event
      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0].type).toBe('rollup.execution.completed');

      unsubscribe();
    });

    it('should support multiple subscribers', async () => {
      const subscriber1Events: RollupEventWithMetadata[] = [];
      const subscriber2Events: RollupEventWithMetadata[] = [];

      const unsub1 = await eventEmitter.subscribe!(
        async (event) => {
          subscriber1Events.push(event);
        }
      );

      const unsub2 = await eventEmitter.subscribe!(
        async (event) => {
          subscriber2Events.push(event);
        }
      );

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(subscriber1Events.length).toBe(1);
      expect(subscriber2Events.length).toBe(1);

      unsub1();
      unsub2();
    });

    it('should unsubscribe correctly', async () => {
      const receivedEvents: RollupEventWithMetadata[] = [];

      const unsubscribe = await eventEmitter.subscribe!(
        async (event) => {
          receivedEvents.push(event);
        }
      );

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedEvents.length).toBe(1);

      // Unsubscribe
      unsubscribe();

      // Emit another event
      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Should not receive the second event
      expect(receivedEvents.length).toBe(1);
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    it('should retry publishing on failure', async () => {
      publisher.simulateFailure(2); // Fail first 2 attempts

      await eventEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      // Should eventually succeed after retries
      const messages = publisher.getPublishedMessages();
      expect(messages.length).toBe(1);
    });

    it('should give up after max retry attempts', async () => {
      const failingPublisher = new MockRedisPublisher();
      failingPublisher.simulateFailure(10); // Fail all attempts

      const failingEmitter = new RollupEventEmitter(failingPublisher, {
        channelPrefix: 'rollup:events',
        logEvents: false,
        retry: { maxAttempts: 3, backoffMs: 10 },
      });

      // Should not throw - fire and forget semantics
      await expect(
        failingEmitter.emit({
          type: 'rollup.created',
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        })
      ).resolves.not.toThrow();

      // No message should be published
      const messages = failingPublisher.getPublishedMessages();
      expect(messages.length).toBe(0);
    });

    it('should handle null publisher gracefully', async () => {
      const nullPublisherEmitter = new RollupEventEmitter(null, {
        logEvents: false,
      });

      // Should not throw
      await expect(
        nullPublisherEmitter.emit({
          type: 'rollup.created',
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        })
      ).resolves.not.toThrow();
    });

    it('should handle subscriber errors gracefully', async () => {
      const errorThrowingSubscriber = vi.fn().mockRejectedValue(new Error('Subscriber error'));

      await eventEmitter.subscribe!(errorThrowingSubscriber);

      // Should not throw even if subscriber throws
      await expect(
        eventEmitter.emit({
          type: 'rollup.created',
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        })
      ).resolves.not.toThrow();
    });
  });

  // ==========================================================================
  // In-Memory Event Emitter
  // ==========================================================================

  describe('In-Memory Event Emitter', () => {
    let inMemoryEmitter: InMemoryRollupEventEmitter;

    beforeEach(() => {
      inMemoryEmitter = createInMemoryEventEmitter();
    });

    it('should store events in memory', async () => {
      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: { name: 'Test' },
      });

      const events = inMemoryEmitter.getEvents();
      expect(events.length).toBe(1);
      expect(events[0].type).toBe('rollup.created');
    });

    it('should get events by type', async () => {
      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await inMemoryEmitter.emit({
        type: 'rollup.execution.started',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await inMemoryEmitter.emit({
        type: 'rollup.execution.completed',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      const createdEvents = inMemoryEmitter.getEventsByType('rollup.created');
      const executionEvents = inMemoryEmitter.getEventsByType('rollup.execution.started');

      expect(createdEvents.length).toBe(1);
      expect(executionEvents.length).toBe(1);
    });

    it('should get events by rollup ID', async () => {
      const rollupId1 = createRollupId();
      const rollupId2 = createRollupId();

      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: rollupId1,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await inMemoryEmitter.emit({
        type: 'rollup.execution.started',
        rollupId: rollupId1,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: rollupId2,
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      const rollup1Events = inMemoryEmitter.getEventsByRollupId(rollupId1);
      expect(rollup1Events.length).toBe(2);
    });

    it('should clear events', async () => {
      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      expect(inMemoryEmitter.getEvents().length).toBe(1);

      inMemoryEmitter.clear();

      expect(inMemoryEmitter.getEvents().length).toBe(0);
    });

    it('should notify handlers immediately', async () => {
      const receivedEvents: RollupEventWithMetadata[] = [];

      await inMemoryEmitter.subscribe(async (event) => {
        receivedEvents.push(event);
      });

      await inMemoryEmitter.emit({
        type: 'rollup.created',
        rollupId: createRollupId(),
        tenantId,
        timestamp: new Date(),
        data: {},
      });

      expect(receivedEvents.length).toBe(1);
    });
  });

  // ==========================================================================
  // Channel Routing
  // ==========================================================================

  describe('Channel Routing', () => {
    it('should route lifecycle events to lifecycle channel', async () => {
      const lifecycleEvents: RollupEventType[] = [
        'rollup.created',
        'rollup.updated',
        'rollup.deleted',
      ];

      for (const eventType of lifecycleEvents) {
        await eventEmitter.emit({
          type: eventType,
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        });
      }

      const lifecycleMessages = publisher.getMessagesByChannel('rollup:events:lifecycle');
      expect(lifecycleMessages.length).toBe(3);
    });

    it('should route execution events to execution channel', async () => {
      const executionEvents: RollupEventType[] = [
        'rollup.execution.started',
        'rollup.execution.progress',
        'rollup.execution.completed',
        'rollup.execution.failed',
        'rollup.execution.cancelled',
      ];

      for (const eventType of executionEvents) {
        await eventEmitter.emit({
          type: eventType,
          rollupId: createRollupId(),
          tenantId,
          timestamp: new Date(),
          data: {},
        });
      }

      const executionMessages = publisher.getMessagesByChannel('rollup:events:execution');
      expect(executionMessages.length).toBe(5);
    });
  });
});
