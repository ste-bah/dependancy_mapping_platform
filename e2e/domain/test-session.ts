/**
 * Test Session Domain Entity
 * @module e2e/domain/test-session
 *
 * Manages test session lifecycle with explicit state machine transitions.
 * Provides fixture tracking, cleanup registration, and session metadata.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #21 of 47 | Phase 4: Implementation
 */

import { v4 as uuidv4 } from 'uuid';
import type { Brand, Result } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';
import type { FixtureId } from '../types/test-types.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Session IDs
 */
export type SessionId = Brand<string, 'SessionId'>;

/**
 * Create a SessionId from a string
 */
export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

/**
 * Generate a new unique SessionId
 */
export function generateSessionId(): SessionId {
  return createSessionId(`session_${uuidv4()}`);
}

// ============================================================================
// Session State Machine
// ============================================================================

/**
 * Session states as a discriminated union
 */
export type SessionState =
  | 'pending'
  | 'initializing'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Valid state transitions
 */
const VALID_TRANSITIONS: ReadonlyMap<SessionState, ReadonlyArray<SessionState>> = new Map([
  ['pending', ['initializing', 'cancelled']],
  ['initializing', ['running', 'failed', 'cancelled']],
  ['running', ['completed', 'failed', 'cancelled']],
  ['completed', []],
  ['failed', []],
  ['cancelled', []],
]);

/**
 * Check if a state transition is valid
 */
export function isValidTransition(from: SessionState, to: SessionState): boolean {
  const validTargets = VALID_TRANSITIONS.get(from);
  return validTargets?.includes(to) ?? false;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session configuration options
 */
export interface SessionConfig {
  /** Session name for identification */
  readonly name: string;
  /** Maximum duration in milliseconds */
  readonly timeout: number;
  /** Whether to run cleanup on failure */
  readonly cleanupOnFailure: boolean;
  /** Tags for session categorization */
  readonly tags: ReadonlyArray<string>;
  /** Custom metadata */
  readonly metadata: Readonly<Record<string, unknown>>;
}

/**
 * Default session configuration
 */
export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  name: 'E2E Test Session',
  timeout: 300000, // 5 minutes
  cleanupOnFailure: true,
  tags: [],
  metadata: {},
};

/**
 * Session timing information
 */
export interface SessionTiming {
  /** Session creation time */
  readonly createdAt: Date;
  /** Session start time */
  readonly startedAt?: Date;
  /** Session end time */
  readonly endedAt?: Date;
  /** Total duration in milliseconds */
  readonly duration?: number;
}

/**
 * Cleanup handler registration
 */
export interface CleanupHandler {
  /** Unique handler ID */
  readonly id: string;
  /** Handler name for debugging */
  readonly name: string;
  /** Priority (lower runs first) */
  readonly priority: number;
  /** The cleanup function */
  readonly handler: () => Promise<void>;
}

/**
 * Session error information
 */
export interface SessionError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Error stack trace */
  readonly stack?: string;
  /** Timestamp when error occurred */
  readonly timestamp: Date;
  /** Context where error occurred */
  readonly context?: string;
}

/**
 * Fixture registration entry
 */
export interface FixtureEntry {
  /** Fixture ID */
  readonly id: FixtureId;
  /** Fixture name */
  readonly name: string;
  /** Registration time */
  readonly registeredAt: Date;
  /** Whether fixture is active */
  readonly active: boolean;
  /** Fixture metadata */
  readonly metadata: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Test Session Class
// ============================================================================

/**
 * Test Session manages the lifecycle of an E2E test session.
 * Provides state management, fixture tracking, and cleanup orchestration.
 */
export class TestSession {
  private readonly _id: SessionId;
  private readonly _config: SessionConfig;
  private _state: SessionState;
  private _timing: SessionTiming;
  private _fixtures: Map<FixtureId, FixtureEntry>;
  private _cleanupHandlers: Map<string, CleanupHandler>;
  private _errors: SessionError[];
  private _timeoutId: NodeJS.Timeout | null;

  private constructor(id: SessionId, config: SessionConfig) {
    this._id = id;
    this._config = config;
    this._state = 'pending';
    this._timing = { createdAt: new Date() };
    this._fixtures = new Map();
    this._cleanupHandlers = new Map();
    this._errors = [];
    this._timeoutId = null;
  }

  // ============================================================================
  // Factory Methods
  // ============================================================================

  /**
   * Create a new test session
   */
  static create(config?: Partial<SessionConfig>): TestSession {
    const id = generateSessionId();
    const fullConfig: SessionConfig = {
      ...DEFAULT_SESSION_CONFIG,
      ...config,
    };
    return new TestSession(id, fullConfig);
  }

  /**
   * Create a session with a specific ID (for reconstitution)
   */
  static withId(id: SessionId, config?: Partial<SessionConfig>): TestSession {
    const fullConfig: SessionConfig = {
      ...DEFAULT_SESSION_CONFIG,
      ...config,
    };
    return new TestSession(id, fullConfig);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get id(): SessionId {
    return this._id;
  }

  get config(): SessionConfig {
    return this._config;
  }

  get state(): SessionState {
    return this._state;
  }

  get timing(): SessionTiming {
    return { ...this._timing };
  }

  get fixtures(): ReadonlyArray<FixtureEntry> {
    return Array.from(this._fixtures.values());
  }

  get errors(): ReadonlyArray<SessionError> {
    return [...this._errors];
  }

  get isActive(): boolean {
    return this._state === 'initializing' || this._state === 'running';
  }

  get isTerminal(): boolean {
    return this._state === 'completed' || this._state === 'failed' || this._state === 'cancelled';
  }

  // ============================================================================
  // State Transitions
  // ============================================================================

  /**
   * Initialize the session (transition from pending to initializing)
   */
  initialize(): Result<void, SessionError> {
    return this.transition('initializing');
  }

  /**
   * Start the session (transition from initializing to running)
   */
  start(): Result<void, SessionError> {
    const result = this.transition('running');
    if (result.success) {
      this._timing = {
        ...this._timing,
        startedAt: new Date(),
      };
      this.startTimeout();
    }
    return result;
  }

  /**
   * Complete the session successfully
   */
  complete(): Result<void, SessionError> {
    this.clearTimeout();
    const result = this.transition('completed');
    if (result.success) {
      this.finalizeTiming();
    }
    return result;
  }

  /**
   * Mark the session as failed
   */
  fail(error: Omit<SessionError, 'timestamp'>): Result<void, SessionError> {
    this.clearTimeout();
    const sessionError: SessionError = {
      ...error,
      timestamp: new Date(),
    };
    this._errors.push(sessionError);

    const result = this.transition('failed');
    if (result.success) {
      this.finalizeTiming();
    }
    return result;
  }

  /**
   * Cancel the session
   */
  cancel(): Result<void, SessionError> {
    this.clearTimeout();
    const result = this.transition('cancelled');
    if (result.success) {
      this.finalizeTiming();
    }
    return result;
  }

  /**
   * Execute a state transition
   */
  private transition(to: SessionState): Result<void, SessionError> {
    if (!isValidTransition(this._state, to)) {
      const error: SessionError = {
        code: 'INVALID_TRANSITION',
        message: `Cannot transition from ${this._state} to ${to}`,
        timestamp: new Date(),
        context: 'state_machine',
      };
      return failure(error);
    }

    this._state = to;
    return success(undefined);
  }

  // ============================================================================
  // Fixture Management
  // ============================================================================

  /**
   * Register a fixture with the session
   */
  registerFixture(
    id: FixtureId,
    name: string,
    metadata: Readonly<Record<string, unknown>> = {}
  ): Result<void, SessionError> {
    if (this.isTerminal) {
      return failure({
        code: 'SESSION_TERMINATED',
        message: 'Cannot register fixtures on terminated session',
        timestamp: new Date(),
      });
    }

    const entry: FixtureEntry = {
      id,
      name,
      registeredAt: new Date(),
      active: true,
      metadata,
    };

    this._fixtures.set(id, entry);
    return success(undefined);
  }

  /**
   * Deactivate a fixture
   */
  deactivateFixture(id: FixtureId): Result<void, SessionError> {
    const fixture = this._fixtures.get(id);
    if (!fixture) {
      return failure({
        code: 'FIXTURE_NOT_FOUND',
        message: `Fixture ${id} not found in session`,
        timestamp: new Date(),
      });
    }

    this._fixtures.set(id, { ...fixture, active: false });
    return success(undefined);
  }

  /**
   * Get a fixture by ID
   */
  getFixture(id: FixtureId): FixtureEntry | undefined {
    return this._fixtures.get(id);
  }

  /**
   * Check if a fixture is registered
   */
  hasFixture(id: FixtureId): boolean {
    return this._fixtures.has(id);
  }

  /**
   * Get all active fixtures
   */
  getActiveFixtures(): ReadonlyArray<FixtureEntry> {
    return Array.from(this._fixtures.values()).filter((f) => f.active);
  }

  // ============================================================================
  // Cleanup Management
  // ============================================================================

  /**
   * Register a cleanup handler
   */
  registerCleanup(
    name: string,
    handler: () => Promise<void>,
    priority: number = 100
  ): string {
    const id = `cleanup_${uuidv4()}`;
    this._cleanupHandlers.set(id, {
      id,
      name,
      priority,
      handler,
    });
    return id;
  }

  /**
   * Unregister a cleanup handler
   */
  unregisterCleanup(id: string): boolean {
    return this._cleanupHandlers.delete(id);
  }

  /**
   * Run all cleanup handlers in priority order
   */
  async runCleanup(): Promise<ReadonlyArray<SessionError>> {
    const errors: SessionError[] = [];

    // Sort handlers by priority (lower first)
    const handlers = Array.from(this._cleanupHandlers.values()).sort(
      (a, b) => a.priority - b.priority
    );

    for (const handler of handlers) {
      try {
        await handler.handler();
      } catch (error) {
        errors.push({
          code: 'CLEANUP_FAILED',
          message: `Cleanup handler "${handler.name}" failed: ${error instanceof Error ? error.message : String(error)}`,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date(),
          context: `cleanup:${handler.name}`,
        });
      }
    }

    // Clear handlers after running
    this._cleanupHandlers.clear();

    return errors;
  }

  // ============================================================================
  // Error Management
  // ============================================================================

  /**
   * Add an error to the session
   */
  addError(error: Omit<SessionError, 'timestamp'>): void {
    this._errors.push({
      ...error,
      timestamp: new Date(),
    });
  }

  /**
   * Check if session has errors
   */
  hasErrors(): boolean {
    return this._errors.length > 0;
  }

  /**
   * Get the last error
   */
  getLastError(): SessionError | undefined {
    return this._errors[this._errors.length - 1];
  }

  // ============================================================================
  // Timeout Management
  // ============================================================================

  private startTimeout(): void {
    if (this._config.timeout > 0) {
      this._timeoutId = setTimeout(() => {
        this.fail({
          code: 'SESSION_TIMEOUT',
          message: `Session timed out after ${this._config.timeout}ms`,
          context: 'timeout',
        });
      }, this._config.timeout);
    }
  }

  private clearTimeout(): void {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  // ============================================================================
  // Timing Management
  // ============================================================================

  private finalizeTiming(): void {
    const endedAt = new Date();
    const duration = this._timing.startedAt
      ? endedAt.getTime() - this._timing.startedAt.getTime()
      : undefined;

    this._timing = {
      ...this._timing,
      endedAt,
      duration,
    };
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Convert session to a plain object for serialization
   */
  toJSON(): Record<string, unknown> {
    return {
      id: this._id,
      config: this._config,
      state: this._state,
      timing: this._timing,
      fixtures: Array.from(this._fixtures.values()),
      errors: this._errors,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new test session with the given configuration
 */
export function createTestSession(config?: Partial<SessionConfig>): TestSession {
  return TestSession.create(config);
}

/**
 * Type guard for SessionState
 */
export function isSessionState(value: unknown): value is SessionState {
  return (
    typeof value === 'string' &&
    ['pending', 'initializing', 'running', 'completed', 'failed', 'cancelled'].includes(value)
  );
}

/**
 * Type guard for SessionError
 */
export function isSessionError(value: unknown): value is SessionError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  );
}
