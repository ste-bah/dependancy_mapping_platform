/**
 * TestSession Unit Tests
 * @module e2e/tests/unit/domain/test-session.test
 *
 * Unit tests for TestSession state machine that manages test lifecycle:
 * - Session creation and initialization
 * - State transitions (pending -> running -> completed/failed)
 * - Resource cleanup and teardown
 * - Event emission and subscription
 *
 * TASK-E2E-032: Comprehensive test generation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================================================
// Types
// ============================================================================

type SessionState = 'created' | 'initializing' | 'ready' | 'running' | 'paused' | 'completed' | 'failed' | 'cleaning';

interface SessionConfig {
  readonly id: string;
  readonly timeout: number;
  readonly retries: number;
  readonly parallel: boolean;
  readonly cleanupOnFail: boolean;
}

interface SessionEvent {
  readonly type: 'state_changed' | 'error' | 'progress' | 'completed';
  readonly timestamp: Date;
  readonly data?: unknown;
}

interface SessionMetrics {
  readonly startTime: Date | null;
  readonly endTime: Date | null;
  readonly testsRun: number;
  readonly testsPassed: number;
  readonly testsFailed: number;
  readonly testsDuration: number;
}

// ============================================================================
// TestSession Implementation (Inline for Unit Testing)
// ============================================================================

class TestSession {
  private _state: SessionState = 'created';
  private _config: SessionConfig;
  private _metrics: SessionMetrics;
  private _events: SessionEvent[] = [];
  private _listeners: Map<string, Array<(event: SessionEvent) => void>> = new Map();
  private _resources: Set<string> = new Set();
  private _error: Error | null = null;

  constructor(config: Partial<SessionConfig> = {}) {
    this._config = {
      id: config.id ?? `session_${Date.now()}`,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 1,
      parallel: config.parallel ?? false,
      cleanupOnFail: config.cleanupOnFail ?? true,
    };

    this._metrics = {
      startTime: null,
      endTime: null,
      testsRun: 0,
      testsPassed: 0,
      testsFailed: 0,
      testsDuration: 0,
    };
  }

  get id(): string {
    return this._config.id;
  }

  get state(): SessionState {
    return this._state;
  }

  get config(): Readonly<SessionConfig> {
    return this._config;
  }

  get metrics(): Readonly<SessionMetrics> {
    return this._metrics;
  }

  get events(): readonly SessionEvent[] {
    return this._events;
  }

  get error(): Error | null {
    return this._error;
  }

  get isActive(): boolean {
    return ['initializing', 'ready', 'running', 'paused'].includes(this._state);
  }

  get isComplete(): boolean {
    return ['completed', 'failed'].includes(this._state);
  }

  // ========================================================================
  // State Transitions
  // ========================================================================

  private static readonly VALID_TRANSITIONS: Record<SessionState, SessionState[]> = {
    created: ['initializing'],
    initializing: ['ready', 'failed'],
    ready: ['running', 'cleaning'],
    running: ['paused', 'completed', 'failed', 'cleaning'],
    paused: ['running', 'completed', 'failed', 'cleaning'],
    completed: ['cleaning'],
    failed: ['cleaning'],
    cleaning: [],
  };

  private canTransitionTo(newState: SessionState): boolean {
    return TestSession.VALID_TRANSITIONS[this._state].includes(newState);
  }

  private transitionTo(newState: SessionState): void {
    if (!this.canTransitionTo(newState)) {
      throw new Error(`Invalid state transition: ${this._state} -> ${newState}`);
    }

    const previousState = this._state;
    this._state = newState;

    this.emitEvent({
      type: 'state_changed',
      timestamp: new Date(),
      data: { from: previousState, to: newState },
    });
  }

  // ========================================================================
  // Lifecycle Methods
  // ========================================================================

  async initialize(): Promise<void> {
    this.transitionTo('initializing');

    try {
      // Simulate async initialization
      await this.delay(10);
      this.transitionTo('ready');
    } catch (error) {
      this._error = error as Error;
      this.transitionTo('failed');
      throw error;
    }
  }

  async start(): Promise<void> {
    if (this._state !== 'ready' && this._state !== 'paused') {
      throw new Error(`Cannot start session in state: ${this._state}`);
    }

    this.transitionTo('running');
    this._metrics = { ...this._metrics, startTime: new Date() };
  }

  pause(): void {
    if (this._state !== 'running') {
      throw new Error(`Cannot pause session in state: ${this._state}`);
    }

    this.transitionTo('paused');
  }

  resume(): void {
    if (this._state !== 'paused') {
      throw new Error(`Cannot resume session in state: ${this._state}`);
    }

    this.transitionTo('running');
  }

  complete(): void {
    if (this._state !== 'running' && this._state !== 'paused') {
      throw new Error(`Cannot complete session in state: ${this._state}`);
    }

    this._metrics = { ...this._metrics, endTime: new Date() };
    this.transitionTo('completed');

    this.emitEvent({
      type: 'completed',
      timestamp: new Date(),
      data: this._metrics,
    });
  }

  fail(error: Error): void {
    this._error = error;
    this._metrics = { ...this._metrics, endTime: new Date() };

    // Can fail from most active states
    if (this.isActive || this._state === 'initializing') {
      this.transitionTo('failed');
    }

    this.emitEvent({
      type: 'error',
      timestamp: new Date(),
      data: { message: error.message, stack: error.stack },
    });
  }

  async cleanup(): Promise<void> {
    if (this._state === 'cleaning') return;

    // Only cleanup from terminal states
    if (this._state === 'completed' || this._state === 'failed') {
      this.transitionTo('cleaning');
    } else if (this._state !== 'created') {
      // Force transition through a valid path
      if (this.isActive) {
        this.fail(new Error('Cleanup requested while active'));
      }
      this.transitionTo('cleaning');
    }

    // Clean up resources
    for (const resource of this._resources) {
      await this.releaseResource(resource);
    }

    this._resources.clear();
    this._listeners.clear();
  }

  // ========================================================================
  // Resource Management
  // ========================================================================

  registerResource(resourceId: string): void {
    this._resources.add(resourceId);
  }

  async releaseResource(resourceId: string): Promise<void> {
    // Simulate async cleanup
    await this.delay(1);
    this._resources.delete(resourceId);
  }

  hasResource(resourceId: string): boolean {
    return this._resources.has(resourceId);
  }

  get resourceCount(): number {
    return this._resources.size;
  }

  // ========================================================================
  // Test Recording
  // ========================================================================

  recordTest(passed: boolean, durationMs: number): void {
    if (this._state !== 'running') {
      throw new Error('Cannot record test outside running state');
    }

    this._metrics = {
      ...this._metrics,
      testsRun: this._metrics.testsRun + 1,
      testsPassed: this._metrics.testsPassed + (passed ? 1 : 0),
      testsFailed: this._metrics.testsFailed + (passed ? 0 : 1),
      testsDuration: this._metrics.testsDuration + durationMs,
    };

    this.emitEvent({
      type: 'progress',
      timestamp: new Date(),
      data: { passed, durationMs, total: this._metrics.testsRun },
    });
  }

  // ========================================================================
  // Event System
  // ========================================================================

  on(eventType: SessionEvent['type'], listener: (event: SessionEvent) => void): () => void {
    if (!this._listeners.has(eventType)) {
      this._listeners.set(eventType, []);
    }
    this._listeners.get(eventType)!.push(listener);

    // Return unsubscribe function
    return () => {
      const listeners = this._listeners.get(eventType);
      if (listeners) {
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      }
    };
  }

  private emitEvent(event: SessionEvent): void {
    this._events.push(event);

    const listeners = this._listeners.get(event.type) ?? [];
    for (const listener of listeners) {
      try {
        listener(event);
      } catch {
        // Swallow listener errors
      }
    }
  }

  // ========================================================================
  // Utilities
  // ========================================================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TestSession', () => {
  let session: TestSession;

  beforeEach(() => {
    session = new TestSession();
  });

  afterEach(async () => {
    if (session.isActive || session.isComplete) {
      await session.cleanup();
    }
  });

  // ==========================================================================
  // Construction Tests
  // ==========================================================================

  describe('Construction', () => {
    it('should create session with default config', () => {
      const s = new TestSession();

      expect(s.id).toMatch(/^session_\d+$/);
      expect(s.state).toBe('created');
      expect(s.config.timeout).toBe(30000);
      expect(s.config.retries).toBe(1);
      expect(s.config.parallel).toBe(false);
      expect(s.config.cleanupOnFail).toBe(true);
    });

    it('should create session with custom config', () => {
      const s = new TestSession({
        id: 'custom-session',
        timeout: 60000,
        retries: 3,
        parallel: true,
        cleanupOnFail: false,
      });

      expect(s.id).toBe('custom-session');
      expect(s.config.timeout).toBe(60000);
      expect(s.config.retries).toBe(3);
      expect(s.config.parallel).toBe(true);
      expect(s.config.cleanupOnFail).toBe(false);
    });

    it('should initialize metrics with null timestamps', () => {
      expect(session.metrics.startTime).toBeNull();
      expect(session.metrics.endTime).toBeNull();
      expect(session.metrics.testsRun).toBe(0);
      expect(session.metrics.testsPassed).toBe(0);
      expect(session.metrics.testsFailed).toBe(0);
    });

    it('should start with empty events array', () => {
      expect(session.events).toHaveLength(0);
    });

    it('should not be active or complete when created', () => {
      expect(session.isActive).toBe(false);
      expect(session.isComplete).toBe(false);
    });
  });

  // ==========================================================================
  // State Transition Tests
  // ==========================================================================

  describe('State Transitions', () => {
    it('should transition: created -> initializing -> ready', async () => {
      expect(session.state).toBe('created');

      await session.initialize();

      expect(session.state).toBe('ready');
    });

    it('should transition: ready -> running', async () => {
      await session.initialize();
      await session.start();

      expect(session.state).toBe('running');
      expect(session.isActive).toBe(true);
    });

    it('should transition: running -> paused -> running', async () => {
      await session.initialize();
      await session.start();

      session.pause();
      expect(session.state).toBe('paused');

      session.resume();
      expect(session.state).toBe('running');
    });

    it('should transition: running -> completed', async () => {
      await session.initialize();
      await session.start();

      session.complete();

      expect(session.state).toBe('completed');
      expect(session.isComplete).toBe(true);
    });

    it('should transition: running -> failed', async () => {
      await session.initialize();
      await session.start();

      session.fail(new Error('Test failure'));

      expect(session.state).toBe('failed');
      expect(session.isComplete).toBe(true);
      expect(session.error?.message).toBe('Test failure');
    });

    it('should reject invalid transitions', async () => {
      // Cannot start without initializing
      expect(() => session.start()).rejects.toThrow('Cannot start session in state');

      // Cannot pause without running
      await session.initialize();
      expect(() => session.pause()).toThrow('Cannot pause session in state');
    });

    it('should reject completing from invalid state', async () => {
      await session.initialize();
      // Cannot complete from ready (must be running first)
      expect(() => session.complete()).toThrow('Cannot complete session in state');
    });
  });

  // ==========================================================================
  // Lifecycle Tests
  // ==========================================================================

  describe('Lifecycle', () => {
    it('should set start time when running', async () => {
      await session.initialize();
      expect(session.metrics.startTime).toBeNull();

      await session.start();
      expect(session.metrics.startTime).toBeInstanceOf(Date);
    });

    it('should set end time when completed', async () => {
      await session.initialize();
      await session.start();
      expect(session.metrics.endTime).toBeNull();

      session.complete();
      expect(session.metrics.endTime).toBeInstanceOf(Date);
    });

    it('should set end time when failed', async () => {
      await session.initialize();
      await session.start();

      session.fail(new Error('Failure'));
      expect(session.metrics.endTime).toBeInstanceOf(Date);
    });

    it('should allow cleanup from completed state', async () => {
      await session.initialize();
      await session.start();
      session.complete();

      await session.cleanup();
      expect(session.state).toBe('cleaning');
    });

    it('should allow cleanup from failed state', async () => {
      await session.initialize();
      await session.start();
      session.fail(new Error('Failure'));

      await session.cleanup();
      expect(session.state).toBe('cleaning');
    });

    it('should be idempotent for cleanup', async () => {
      await session.initialize();
      await session.start();
      session.complete();

      await session.cleanup();
      await session.cleanup(); // Second call should not throw

      expect(session.state).toBe('cleaning');
    });
  });

  // ==========================================================================
  // Resource Management Tests
  // ==========================================================================

  describe('Resource Management', () => {
    it('should register resources', () => {
      session.registerResource('db-connection');
      session.registerResource('file-handle');

      expect(session.hasResource('db-connection')).toBe(true);
      expect(session.hasResource('file-handle')).toBe(true);
      expect(session.resourceCount).toBe(2);
    });

    it('should release individual resources', async () => {
      session.registerResource('resource-1');
      session.registerResource('resource-2');

      await session.releaseResource('resource-1');

      expect(session.hasResource('resource-1')).toBe(false);
      expect(session.hasResource('resource-2')).toBe(true);
      expect(session.resourceCount).toBe(1);
    });

    it('should cleanup all resources', async () => {
      session.registerResource('resource-1');
      session.registerResource('resource-2');
      session.registerResource('resource-3');

      await session.initialize();
      await session.start();
      session.complete();
      await session.cleanup();

      expect(session.resourceCount).toBe(0);
    });

    it('should not error when releasing non-existent resource', async () => {
      await expect(session.releaseResource('non-existent')).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Test Recording Tests
  // ==========================================================================

  describe('Test Recording', () => {
    beforeEach(async () => {
      await session.initialize();
      await session.start();
    });

    it('should record passing test', () => {
      session.recordTest(true, 100);

      expect(session.metrics.testsRun).toBe(1);
      expect(session.metrics.testsPassed).toBe(1);
      expect(session.metrics.testsFailed).toBe(0);
      expect(session.metrics.testsDuration).toBe(100);
    });

    it('should record failing test', () => {
      session.recordTest(false, 50);

      expect(session.metrics.testsRun).toBe(1);
      expect(session.metrics.testsPassed).toBe(0);
      expect(session.metrics.testsFailed).toBe(1);
    });

    it('should accumulate test metrics', () => {
      session.recordTest(true, 100);
      session.recordTest(false, 50);
      session.recordTest(true, 75);
      session.recordTest(true, 200);

      expect(session.metrics.testsRun).toBe(4);
      expect(session.metrics.testsPassed).toBe(3);
      expect(session.metrics.testsFailed).toBe(1);
      expect(session.metrics.testsDuration).toBe(425);
    });

    it('should reject recording outside running state', async () => {
      session.pause();

      expect(() => session.recordTest(true, 100)).toThrow(
        'Cannot record test outside running state'
      );
    });
  });

  // ==========================================================================
  // Event System Tests
  // ==========================================================================

  describe('Event System', () => {
    it('should emit state_changed events', async () => {
      const stateChanges: Array<{ from: SessionState; to: SessionState }> = [];

      session.on('state_changed', (event) => {
        stateChanges.push(event.data as { from: SessionState; to: SessionState });
      });

      await session.initialize();
      await session.start();
      session.complete();

      expect(stateChanges).toHaveLength(4);
      expect(stateChanges[0]).toEqual({ from: 'created', to: 'initializing' });
      expect(stateChanges[1]).toEqual({ from: 'initializing', to: 'ready' });
      expect(stateChanges[2]).toEqual({ from: 'ready', to: 'running' });
      expect(stateChanges[3]).toEqual({ from: 'running', to: 'completed' });
    });

    it('should emit progress events', async () => {
      const progress: Array<{ passed: boolean; total: number }> = [];

      session.on('progress', (event) => {
        progress.push(event.data as { passed: boolean; total: number });
      });

      await session.initialize();
      await session.start();
      session.recordTest(true, 100);
      session.recordTest(false, 50);

      expect(progress).toHaveLength(2);
      expect(progress[0]).toMatchObject({ passed: true, total: 1 });
      expect(progress[1]).toMatchObject({ passed: false, total: 2 });
    });

    it('should emit error events', async () => {
      const errors: string[] = [];

      session.on('error', (event) => {
        errors.push((event.data as { message: string }).message);
      });

      await session.initialize();
      await session.start();
      session.fail(new Error('Test error message'));

      expect(errors).toHaveLength(1);
      expect(errors[0]).toBe('Test error message');
    });

    it('should emit completed event', async () => {
      let completedEvent: SessionEvent | null = null;

      session.on('completed', (event) => {
        completedEvent = event;
      });

      await session.initialize();
      await session.start();
      session.recordTest(true, 100);
      session.complete();

      expect(completedEvent).not.toBeNull();
      expect(completedEvent!.type).toBe('completed');
    });

    it('should allow unsubscribing from events', async () => {
      const calls: number[] = [];

      const unsubscribe = session.on('state_changed', () => {
        calls.push(1);
      });

      await session.initialize(); // 2 state changes
      unsubscribe();
      await session.start(); // Should not be recorded

      expect(calls).toHaveLength(2);
    });

    it('should store all events in history', async () => {
      await session.initialize();
      await session.start();
      session.recordTest(true, 100);
      session.complete();

      expect(session.events.length).toBeGreaterThan(0);
      expect(session.events.every((e) => e.timestamp instanceof Date)).toBe(true);
    });

    it('should handle listener errors gracefully', async () => {
      session.on('state_changed', () => {
        throw new Error('Listener error');
      });

      // Should not throw despite listener error
      await expect(session.initialize()).resolves.toBeUndefined();
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle rapid state transitions', async () => {
      await session.initialize();
      await session.start();
      session.pause();
      session.resume();
      session.pause();
      session.resume();
      session.complete();

      expect(session.state).toBe('completed');
      expect(session.events.filter((e) => e.type === 'state_changed').length).toBe(8);
    });

    it('should handle many resources', async () => {
      for (let i = 0; i < 100; i++) {
        session.registerResource(`resource-${i}`);
      }

      expect(session.resourceCount).toBe(100);

      await session.initialize();
      await session.start();
      session.complete();
      await session.cleanup();

      expect(session.resourceCount).toBe(0);
    });

    it('should handle many listeners', async () => {
      const counts = new Map<string, number>();

      for (let i = 0; i < 50; i++) {
        session.on('state_changed', (event) => {
          const count = counts.get(event.type) ?? 0;
          counts.set(event.type, count + 1);
        });
      }

      await session.initialize();

      // Each of 50 listeners should be called for each state change
      expect(counts.get('state_changed')).toBe(100); // 2 changes * 50 listeners
    });
  });

  // ==========================================================================
  // Metrics Calculation Tests
  // ==========================================================================

  describe('Metrics Calculation', () => {
    it('should calculate pass rate correctly', async () => {
      await session.initialize();
      await session.start();

      for (let i = 0; i < 80; i++) session.recordTest(true, 10);
      for (let i = 0; i < 20; i++) session.recordTest(false, 10);

      const { testsPassed, testsFailed, testsRun } = session.metrics;
      const passRate = (testsPassed / testsRun) * 100;

      expect(passRate).toBe(80);
      expect(testsFailed).toBe(20);
    });

    it('should calculate average test duration', async () => {
      await session.initialize();
      await session.start();

      session.recordTest(true, 100);
      session.recordTest(true, 200);
      session.recordTest(true, 300);

      const avgDuration = session.metrics.testsDuration / session.metrics.testsRun;

      expect(avgDuration).toBe(200);
    });
  });
});
