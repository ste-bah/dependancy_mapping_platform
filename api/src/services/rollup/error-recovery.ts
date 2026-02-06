/**
 * Rollup Error Recovery Service
 * @module services/rollup/error-recovery
 *
 * Recovery mechanisms for rollup execution failures:
 * - Retry policies for transient failures
 * - Circuit breaker for external dependencies
 * - Dead letter queue handling for failed jobs
 * - Execution recovery after crashes
 * - Partial result handling
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation error handling
 */

import pino from 'pino';
import { EventEmitter } from 'events';
import {
  RollupError,
  RollupExecutionError,
  RollupNotFoundError,
  isRetryableRollupError,
  wrapAsRollupError,
  RollupErrorCodes,
} from './errors.js';
import {
  RollupErrorCode,
  RollupErrorRetryable,
  RollupErrorCodeType,
} from './error-codes.js';
import {
  withRetry,
  withFallback,
  withTimeout,
  withResilience,
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  RetryOptions,
  TimeoutError,
} from '../../errors/recovery.js';
import { RollupExecutionEntity, IRollupRepository } from './interfaces.js';
import { TenantId } from '../../types/entities.js';

const logger = pino({ name: 'rollup-error-recovery' });

// ============================================================================
// Types
// ============================================================================

/**
 * Retry policy configuration
 */
export interface RollupRetryPolicy {
  /** Maximum retry attempts */
  maxAttempts: number;
  /** Base delay in milliseconds */
  baseDelayMs: number;
  /** Backoff multiplier */
  backoffMultiplier: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Jitter factor (0-1) */
  jitterFactor: number;
  /** Operation timeout in milliseconds */
  timeoutMs?: number;
}

/**
 * Circuit breaker configuration
 */
export interface RollupCircuitBreakerConfig {
  /** Number of failures before opening */
  failureThreshold: number;
  /** Number of successes to close in half-open state */
  successThreshold: number;
  /** Time in ms before attempting reset */
  resetTimeoutMs: number;
  /** Time window for counting failures */
  failureWindowMs?: number;
}

/**
 * Dead letter queue entry
 */
export interface DeadLetterEntry {
  /** Unique entry ID */
  id: string;
  /** Execution ID that failed */
  executionId: string;
  /** Rollup ID */
  rollupId: string;
  /** Tenant ID */
  tenantId: string;
  /** Error that caused the failure */
  error: {
    name: string;
    message: string;
    code?: string;
    stack?: string;
  };
  /** Number of retry attempts made */
  attemptCount: number;
  /** Maximum attempts allowed */
  maxAttempts: number;
  /** Phase where failure occurred */
  phase?: string;
  /** Partial results if available */
  partialResults?: Record<string, unknown>;
  /** Original execution options */
  options?: Record<string, unknown>;
  /** When the entry was created */
  createdAt: Date;
  /** Last retry attempt time */
  lastAttemptAt?: Date;
  /** When the next retry is scheduled */
  nextRetryAt?: Date;
  /** Entry status */
  status: 'pending' | 'retrying' | 'exhausted' | 'recovered' | 'discarded';
}

/**
 * Recovery result
 */
export interface RecoveryResult {
  /** Whether recovery was successful */
  success: boolean;
  /** Recovered execution if successful */
  executionId?: string;
  /** Error if recovery failed */
  error?: Error;
  /** Recovery method used */
  method: 'retry' | 'resume' | 'restart' | 'discard';
  /** Number of attempts made */
  attempts: number;
  /** Total recovery time in ms */
  recoveryTimeMs: number;
}

/**
 * Execution state for recovery
 */
export interface ExecutionState {
  executionId: string;
  rollupId: string;
  tenantId: TenantId;
  phase: 'fetch' | 'match' | 'merge' | 'store' | 'callback';
  progress: {
    scansProcessed: number;
    totalScans: number;
    nodesProcessed: number;
    matchesFound: number;
  };
  checkpoint?: {
    timestamp: Date;
    data: Record<string, unknown>;
  };
}

// ============================================================================
// Default Configurations
// ============================================================================

/**
 * Default retry policy for execution operations
 */
export const DEFAULT_EXECUTION_RETRY_POLICY: RollupRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
  timeoutMs: 300000, // 5 minutes
};

/**
 * Default retry policy for external service calls
 */
export const DEFAULT_EXTERNAL_RETRY_POLICY: RollupRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 500,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
  jitterFactor: 0.2,
  timeoutMs: 30000, // 30 seconds
};

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: RollupCircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeoutMs: 30000,
  failureWindowMs: 60000,
};

// ============================================================================
// Recovery Service
// ============================================================================

/**
 * Rollup Error Recovery Service
 *
 * Provides comprehensive error recovery mechanisms for rollup operations:
 * - Automatic retry with exponential backoff for transient failures
 * - Circuit breaker pattern for external dependencies
 * - Dead letter queue for failed executions
 * - Execution state recovery after crashes
 * - Partial result handling and resumption
 */
export class RollupErrorRecoveryService extends EventEmitter {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private deadLetterQueue: Map<string, DeadLetterEntry> = new Map();
  private executionStates: Map<string, ExecutionState> = new Map();
  private retryTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    private readonly rollupRepository: IRollupRepository,
    private readonly config: {
      executionRetryPolicy?: Partial<RollupRetryPolicy>;
      externalRetryPolicy?: Partial<RollupRetryPolicy>;
      circuitBreakerConfig?: Partial<RollupCircuitBreakerConfig>;
      deadLetterQueueMaxSize?: number;
      deadLetterRetentionMs?: number;
    } = {}
  ) {
    super();
    this.startDeadLetterProcessor();
  }

  // ==========================================================================
  // Retry Policies
  // ==========================================================================

  /**
   * Execute an operation with retry policy
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options: {
      policy?: Partial<RollupRetryPolicy>;
      context?: {
        correlationId?: string;
        rollupId?: string;
        executionId?: string;
        operation?: string;
      };
      shouldRetry?: (error: Error, attempt: number) => boolean;
    } = {}
  ): Promise<T> {
    const policy = {
      ...DEFAULT_EXECUTION_RETRY_POLICY,
      ...this.config.executionRetryPolicy,
      ...options.policy,
    };

    const retryOptions: Partial<RetryOptions> = {
      maxAttempts: policy.maxAttempts,
      delayMs: policy.baseDelayMs,
      backoffMultiplier: policy.backoffMultiplier,
      maxDelayMs: policy.maxDelayMs,
      jitterFactor: policy.jitterFactor,
      retryIf: (error: Error, attempt: number) => {
        // Use custom retry check if provided
        if (options.shouldRetry) {
          return options.shouldRetry(error, attempt);
        }
        // Default: check if error is retryable
        return this.isRetryableError(error);
      },
      onRetry: (error: Error, attempt: number, delayMs: number) => {
        logger.warn(
          {
            ...options.context,
            attempt,
            delayMs,
            error: error.message,
          },
          'Retrying rollup operation'
        );
        this.emit('retry', { ...options.context, attempt, error, delayMs });
      },
      onFinalFailure: (error: Error, totalAttempts: number) => {
        logger.error(
          {
            ...options.context,
            totalAttempts,
            error: error.message,
          },
          'Rollup operation failed after all retries'
        );
        this.emit('retryExhausted', { ...options.context, totalAttempts, error });
      },
    };

    // Wrap with timeout if configured
    const wrappedOperation = policy.timeoutMs
      ? () => withTimeout(operation, { timeoutMs: policy.timeoutMs! })
      : operation;

    return withRetry(wrappedOperation, retryOptions);
  }

  /**
   * Execute an external service call with retry and circuit breaker
   */
  async executeExternalCall<T>(
    serviceName: string,
    operation: () => Promise<T>,
    options: {
      policy?: Partial<RollupRetryPolicy>;
      fallbackValue?: T;
      context?: Record<string, unknown>;
    } = {}
  ): Promise<T> {
    const circuitBreaker = this.getOrCreateCircuitBreaker(serviceName);
    const policy = {
      ...DEFAULT_EXTERNAL_RETRY_POLICY,
      ...this.config.externalRetryPolicy,
      ...options.policy,
    };

    // Execute through circuit breaker
    return circuitBreaker.execute(async () => {
      // Apply retry policy
      return this.executeWithRetry(operation, {
        policy,
        context: { operation: serviceName, ...options.context },
      });
    }).catch((error) => {
      // Handle circuit open errors
      if (error instanceof CircuitOpenError) {
        logger.warn(
          { serviceName, retryAfter: error.retryAfterMs },
          'Circuit breaker is open'
        );

        // Use fallback if provided
        if (options.fallbackValue !== undefined) {
          return options.fallbackValue;
        }
      }
      throw error;
    });
  }

  // ==========================================================================
  // Circuit Breaker Management
  // ==========================================================================

  /**
   * Get or create a circuit breaker for a service
   */
  private getOrCreateCircuitBreaker(serviceName: string): CircuitBreaker {
    let breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) {
      const config = {
        ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
        ...this.config.circuitBreakerConfig,
      };

      breaker = new CircuitBreaker(serviceName, {
        failureThreshold: config.failureThreshold,
        successThreshold: config.successThreshold,
        timeout: config.resetTimeoutMs,
        onStateChange: (from, to) => {
          logger.info(
            { serviceName, from, to },
            'Circuit breaker state changed'
          );
          this.emit('circuitStateChange', { serviceName, from, to });
        },
      });

      this.circuitBreakers.set(serviceName, breaker);
    }
    return breaker;
  }

  /**
   * Get circuit breaker status for a service
   */
  getCircuitBreakerStatus(serviceName: string): {
    state: CircuitState;
    failures: number;
    remainingTimeout: number;
  } | null {
    const breaker = this.circuitBreakers.get(serviceName);
    if (!breaker) return null;

    return {
      state: breaker.getState(),
      failures: breaker.getFailureCount(),
      remainingTimeout: breaker.getRemainingTimeout(),
    };
  }

  /**
   * Reset a circuit breaker
   */
  resetCircuitBreaker(serviceName: string): void {
    const breaker = this.circuitBreakers.get(serviceName);
    if (breaker) {
      breaker.reset();
      logger.info({ serviceName }, 'Circuit breaker reset');
    }
  }

  // ==========================================================================
  // Dead Letter Queue
  // ==========================================================================

  /**
   * Add a failed execution to the dead letter queue
   */
  addToDeadLetterQueue(
    executionId: string,
    rollupId: string,
    tenantId: string,
    error: Error,
    options: {
      attemptCount?: number;
      maxAttempts?: number;
      phase?: string;
      partialResults?: Record<string, unknown>;
      executionOptions?: Record<string, unknown>;
    } = {}
  ): DeadLetterEntry {
    const entry: DeadLetterEntry = {
      id: `dlq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      executionId,
      rollupId,
      tenantId,
      error: {
        name: error.name,
        message: error.message,
        code: (error as RollupError).code,
        stack: error.stack,
      },
      attemptCount: options.attemptCount ?? 1,
      maxAttempts: options.maxAttempts ?? DEFAULT_EXECUTION_RETRY_POLICY.maxAttempts,
      phase: options.phase,
      partialResults: options.partialResults,
      options: options.executionOptions,
      createdAt: new Date(),
      lastAttemptAt: new Date(),
      status: 'pending',
    };

    // Check if already exhausted
    if (entry.attemptCount >= entry.maxAttempts) {
      entry.status = 'exhausted';
    } else {
      // Calculate next retry time
      const delay = this.calculateNextRetryDelay(entry.attemptCount);
      entry.nextRetryAt = new Date(Date.now() + delay);
    }

    // Enforce max queue size
    const maxSize = this.config.deadLetterQueueMaxSize ?? 1000;
    if (this.deadLetterQueue.size >= maxSize) {
      // Remove oldest entry
      const oldestKey = this.deadLetterQueue.keys().next().value;
      if (oldestKey) {
        this.deadLetterQueue.delete(oldestKey);
      }
    }

    this.deadLetterQueue.set(entry.id, entry);

    logger.warn(
      {
        entryId: entry.id,
        executionId,
        rollupId,
        status: entry.status,
        attemptCount: entry.attemptCount,
        nextRetryAt: entry.nextRetryAt,
      },
      'Added execution to dead letter queue'
    );

    this.emit('deadLetterAdded', entry);

    return entry;
  }

  /**
   * Get dead letter queue entries
   */
  getDeadLetterEntries(options: {
    status?: DeadLetterEntry['status'];
    rollupId?: string;
    tenantId?: string;
    limit?: number;
  } = {}): DeadLetterEntry[] {
    let entries = Array.from(this.deadLetterQueue.values());

    if (options.status) {
      entries = entries.filter((e) => e.status === options.status);
    }
    if (options.rollupId) {
      entries = entries.filter((e) => e.rollupId === options.rollupId);
    }
    if (options.tenantId) {
      entries = entries.filter((e) => e.tenantId === options.tenantId);
    }

    // Sort by creation time, oldest first
    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    if (options.limit) {
      entries = entries.slice(0, options.limit);
    }

    return entries;
  }

  /**
   * Retry a dead letter queue entry
   */
  async retryDeadLetterEntry(
    entryId: string,
    executor: (entry: DeadLetterEntry) => Promise<void>
  ): Promise<RecoveryResult> {
    const entry = this.deadLetterQueue.get(entryId);
    if (!entry) {
      return {
        success: false,
        error: new Error(`Dead letter entry not found: ${entryId}`),
        method: 'retry',
        attempts: 0,
        recoveryTimeMs: 0,
      };
    }

    const startTime = Date.now();
    entry.status = 'retrying';
    entry.lastAttemptAt = new Date();
    entry.attemptCount++;

    try {
      await executor(entry);

      entry.status = 'recovered';
      this.emit('deadLetterRecovered', entry);

      logger.info(
        { entryId, executionId: entry.executionId },
        'Dead letter entry recovered'
      );

      return {
        success: true,
        executionId: entry.executionId,
        method: 'retry',
        attempts: entry.attemptCount,
        recoveryTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      // Update entry status
      if (entry.attemptCount >= entry.maxAttempts) {
        entry.status = 'exhausted';
        this.emit('deadLetterExhausted', entry);
      } else {
        entry.status = 'pending';
        const delay = this.calculateNextRetryDelay(entry.attemptCount);
        entry.nextRetryAt = new Date(Date.now() + delay);
      }

      entry.error = {
        name: (error as Error).name,
        message: (error as Error).message,
        code: (error as RollupError).code,
        stack: (error as Error).stack,
      };

      logger.error(
        { entryId, executionId: entry.executionId, error: (error as Error).message },
        'Dead letter entry retry failed'
      );

      return {
        success: false,
        error: error as Error,
        method: 'retry',
        attempts: entry.attemptCount,
        recoveryTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Discard a dead letter queue entry
   */
  discardDeadLetterEntry(entryId: string): boolean {
    const entry = this.deadLetterQueue.get(entryId);
    if (!entry) return false;

    entry.status = 'discarded';
    this.emit('deadLetterDiscarded', entry);

    logger.info({ entryId, executionId: entry.executionId }, 'Dead letter entry discarded');

    return true;
  }

  /**
   * Remove old entries from dead letter queue
   */
  cleanupDeadLetterQueue(maxAgeMs?: number): number {
    const retention = maxAgeMs ?? this.config.deadLetterRetentionMs ?? 7 * 24 * 60 * 60 * 1000; // 7 days
    const cutoff = Date.now() - retention;
    let removed = 0;

    for (const [id, entry] of this.deadLetterQueue) {
      if (entry.createdAt.getTime() < cutoff) {
        this.deadLetterQueue.delete(id);
        removed++;
      }
    }

    if (removed > 0) {
      logger.info({ removed }, 'Cleaned up dead letter queue entries');
    }

    return removed;
  }

  // ==========================================================================
  // Execution State Recovery
  // ==========================================================================

  /**
   * Save execution state checkpoint
   */
  saveExecutionState(state: ExecutionState): void {
    state.checkpoint = {
      timestamp: new Date(),
      data: { ...state.progress },
    };
    this.executionStates.set(state.executionId, state);

    logger.debug(
      { executionId: state.executionId, phase: state.phase, progress: state.progress },
      'Execution state checkpoint saved'
    );
  }

  /**
   * Get execution state for recovery
   */
  getExecutionState(executionId: string): ExecutionState | undefined {
    return this.executionStates.get(executionId);
  }

  /**
   * Recover execution from saved state
   */
  async recoverExecution(
    executionId: string,
    executor: (state: ExecutionState) => Promise<void>
  ): Promise<RecoveryResult> {
    const state = this.executionStates.get(executionId);
    if (!state) {
      return {
        success: false,
        error: new Error(`No saved state for execution: ${executionId}`),
        method: 'resume',
        attempts: 0,
        recoveryTimeMs: 0,
      };
    }

    const startTime = Date.now();

    try {
      logger.info(
        {
          executionId,
          phase: state.phase,
          progress: state.progress,
        },
        'Recovering execution from checkpoint'
      );

      await executor(state);

      this.executionStates.delete(executionId);

      return {
        success: true,
        executionId,
        method: 'resume',
        attempts: 1,
        recoveryTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        error: error as Error,
        method: 'resume',
        attempts: 1,
        recoveryTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Clear execution state (after completion or discard)
   */
  clearExecutionState(executionId: string): void {
    this.executionStates.delete(executionId);
  }

  /**
   * Recover all interrupted executions
   */
  async recoverInterruptedExecutions(
    tenantId: TenantId,
    executor: (state: ExecutionState) => Promise<void>
  ): Promise<RecoveryResult[]> {
    const results: RecoveryResult[] = [];

    for (const [executionId, state] of this.executionStates) {
      if (state.tenantId === tenantId) {
        const result = await this.recoverExecution(executionId, executor);
        results.push(result);
      }
    }

    return results;
  }

  // ==========================================================================
  // Partial Results Handling
  // ==========================================================================

  /**
   * Handle partial results from a failed execution
   */
  async handlePartialResults(
    tenantId: TenantId,
    executionId: string,
    partialResults: {
      nodesProcessed: number;
      matchesFound: number;
      mergedNodes?: number;
      phase: string;
    }
  ): Promise<void> {
    // Update execution record with partial results
    try {
      await this.rollupRepository.updateExecution(
        tenantId,
        executionId,
        {
          status: 'failed',
          errorDetails: {
            partialResults,
            hasPartialResults: true,
            failedPhase: partialResults.phase,
          },
        }
      );

      logger.info(
        { executionId, partialResults },
        'Partial results saved for failed execution'
      );
    } catch (error) {
      logger.error(
        { executionId, error: (error as Error).message },
        'Failed to save partial results'
      );
    }
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error): boolean {
    // Check using the rollup error system
    if (isRetryableRollupError(error)) {
      return true;
    }

    // Check for transient network errors
    const transientPatterns = [
      'ECONNREFUSED',
      'ETIMEDOUT',
      'ENOTFOUND',
      'ENETUNREACH',
      'socket hang up',
      'connection reset',
    ];

    const message = error.message.toLowerCase();
    return transientPatterns.some((p) => message.includes(p.toLowerCase()));
  }

  /**
   * Calculate delay for next retry
   */
  private calculateNextRetryDelay(attemptCount: number): number {
    const policy = {
      ...DEFAULT_EXECUTION_RETRY_POLICY,
      ...this.config.executionRetryPolicy,
    };

    const baseDelay = policy.baseDelayMs * Math.pow(policy.backoffMultiplier, attemptCount - 1);
    const jitter = policy.jitterFactor * baseDelay * (Math.random() * 2 - 1);
    return Math.min(baseDelay + jitter, policy.maxDelayMs);
  }

  /**
   * Start background dead letter queue processor
   */
  private startDeadLetterProcessor(): void {
    // Process dead letter queue every minute
    setInterval(() => {
      const now = Date.now();
      const pendingEntries = Array.from(this.deadLetterQueue.values())
        .filter(
          (e) =>
            e.status === 'pending' &&
            e.nextRetryAt &&
            e.nextRetryAt.getTime() <= now
        );

      if (pendingEntries.length > 0) {
        this.emit('deadLetterReady', pendingEntries);
      }

      // Cleanup old entries
      this.cleanupDeadLetterQueue();
    }, 60000);
  }

  /**
   * Shutdown the recovery service
   */
  shutdown(): void {
    // Clear all timers
    for (const timer of this.retryTimers.values()) {
      clearTimeout(timer);
    }
    this.retryTimers.clear();

    // Emit shutdown event
    this.emit('shutdown');

    logger.info('Rollup error recovery service shut down');
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RollupErrorRecoveryService instance
 */
export function createErrorRecoveryService(
  rollupRepository: IRollupRepository,
  config?: {
    executionRetryPolicy?: Partial<RollupRetryPolicy>;
    externalRetryPolicy?: Partial<RollupRetryPolicy>;
    circuitBreakerConfig?: Partial<RollupCircuitBreakerConfig>;
    deadLetterQueueMaxSize?: number;
    deadLetterRetentionMs?: number;
  }
): RollupErrorRecoveryService {
  return new RollupErrorRecoveryService(rollupRepository, config);
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Wrap an operation with rollup-specific retry logic
 */
export async function withRollupRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxAttempts?: number;
    timeoutMs?: number;
    context?: Record<string, unknown>;
  }
): Promise<T> {
  return withResilience(operation, {
    timeout: options?.timeoutMs ? { timeoutMs: options.timeoutMs } : undefined,
    retry: {
      maxAttempts: options?.maxAttempts ?? DEFAULT_EXECUTION_RETRY_POLICY.maxAttempts,
      delayMs: DEFAULT_EXECUTION_RETRY_POLICY.baseDelayMs,
      backoffMultiplier: DEFAULT_EXECUTION_RETRY_POLICY.backoffMultiplier,
      maxDelayMs: DEFAULT_EXECUTION_RETRY_POLICY.maxDelayMs,
      retryIf: (error: Error) => isRetryableRollupError(error),
    },
  });
}

/**
 * Wrap an external call with circuit breaker and retry
 */
export async function withRollupCircuitBreaker<T>(
  breaker: CircuitBreaker,
  operation: () => Promise<T>,
  fallbackValue?: T
): Promise<T> {
  try {
    return await breaker.execute(() =>
      withResilience(operation, {
        timeout: { timeoutMs: DEFAULT_EXTERNAL_RETRY_POLICY.timeoutMs! },
        retry: {
          maxAttempts: DEFAULT_EXTERNAL_RETRY_POLICY.maxAttempts,
          delayMs: DEFAULT_EXTERNAL_RETRY_POLICY.baseDelayMs,
        },
      })
    );
  } catch (error) {
    if (error instanceof CircuitOpenError && fallbackValue !== undefined) {
      return fallbackValue;
    }
    throw error;
  }
}
