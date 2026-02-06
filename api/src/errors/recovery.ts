/**
 * Recovery Strategies
 * @module errors/recovery
 *
 * Fault tolerance and recovery patterns for the IaC dependency detection system.
 * Implements retry with backoff, circuit breaker, and fallback strategies.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { isRetryableError } from './codes';
import { BaseError, isBaseError } from './base';
import { ExternalServiceError } from './infrastructure';

// ============================================================================
// Retry Strategy
// ============================================================================

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  delayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs?: number;
  /** Optional jitter factor (0-1) to add randomness */
  jitterFactor?: number;
  /** Custom function to determine if error is retryable */
  retryIf?: (error: Error, attempt: number) => boolean;
  /** Callback invoked before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
  /** Callback invoked on final failure */
  onFinalFailure?: (error: Error, totalAttempts: number) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'onRetry' | 'onFinalFailure' | 'retryIf'>> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  jitterFactor: 0.1,
};

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  success: boolean;
  value?: T;
  error?: Error;
  attempts: number;
  totalDelayMs: number;
}

/**
 * Execute an operation with retry logic
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns Result of the operation
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetchData(url),
 *   { maxAttempts: 3, delayMs: 1000, backoffMultiplier: 2 }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const {
    maxAttempts,
    delayMs,
    backoffMultiplier,
    maxDelayMs,
    jitterFactor,
    retryIf = defaultRetryIf,
    onRetry,
    onFinalFailure,
  } = opts;

  let lastError: Error;
  let currentDelay = delayMs;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if this is the last attempt or error is not retryable
      if (attempt === maxAttempts || !retryIf(lastError, attempt)) {
        onFinalFailure?.(lastError, attempt);
        throw lastError;
      }

      // Calculate delay with jitter
      const jitter = jitterFactor
        ? currentDelay * jitterFactor * (Math.random() * 2 - 1)
        : 0;
      const actualDelay = Math.min(currentDelay + jitter, maxDelayMs);

      onRetry?.(lastError, attempt, actualDelay);

      await sleep(actualDelay);
      totalDelayMs += actualDelay;

      // Increase delay for next iteration
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError!;
}

/**
 * Default retry condition
 */
function defaultRetryIf(error: Error, _attempt: number): boolean {
  // Check if it's a BaseError with a retryable code
  if (isBaseError(error)) {
    return isRetryableError(error.code);
  }

  // Check for external service errors with retryable flag
  if (error instanceof ExternalServiceError) {
    return error.retryable;
  }

  // Default: retry on network-like errors
  const retryableMessages = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'ENETUNREACH',
    'socket hang up',
    'network',
    'timeout',
  ];

  return retryableMessages.some(msg =>
    error.message.toLowerCase().includes(msg.toLowerCase())
  );
}

/**
 * Decorator for adding retry behavior to class methods
 *
 * @example
 * ```typescript
 * class ApiClient {
 *   @Retry({ maxAttempts: 3, delayMs: 1000 })
 *   async fetchData(): Promise<Data> {
 *     return fetch('/api/data');
 *   }
 * }
 * ```
 */
export function Retry(options: Partial<RetryOptions> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withRetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker states
 */
export enum CircuitState {
  /** Circuit is closed, requests flow through normally */
  CLOSED = 'CLOSED',
  /** Circuit is open, requests are blocked */
  OPEN = 'OPEN',
  /** Circuit is testing if the service has recovered */
  HALF_OPEN = 'HALF_OPEN',
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successes in half-open state to close the circuit */
  successThreshold: number;
  /** Time in milliseconds before attempting to close an open circuit */
  timeout: number;
  /** Optional callback when state changes */
  onStateChange?: (from: CircuitState, to: CircuitState, breaker: CircuitBreaker) => void;
  /** Optional callback on each failure */
  onFailure?: (error: Error, failures: number, breaker: CircuitBreaker) => void;
  /** Optional callback on success */
  onSuccess?: (breaker: CircuitBreaker) => void;
}

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000, // 30 seconds
};

/**
 * Error thrown when circuit breaker is open
 */
export class CircuitOpenError extends Error {
  public readonly retryAfterMs: number;
  public readonly circuitName: string;

  constructor(circuitName: string, retryAfterMs: number) {
    super(`Circuit '${circuitName}' is open. Retry after ${retryAfterMs}ms`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
  }
}

/**
 * Circuit breaker pattern implementation
 *
 * @example
 * ```typescript
 * const breaker = new CircuitBreaker('api-service', {
 *   failureThreshold: 5,
 *   successThreshold: 2,
 *   timeout: 30000
 * });
 *
 * try {
 *   const result = await breaker.execute(() => apiCall());
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Handle circuit open state
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: Date;
  private readonly options: CircuitBreakerOptions;

  constructor(
    public readonly name: string,
    options: Partial<CircuitBreakerOptions> = {}
  ) {
    this.options = { ...DEFAULT_CIRCUIT_BREAKER_OPTIONS, ...options };
  }

  /**
   * Execute an operation through the circuit breaker
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should attempt a request
    if (this.state === CircuitState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.transitionTo(CircuitState.HALF_OPEN);
      } else {
        throw new CircuitOpenError(this.name, this.getRemainingTimeout());
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get current failure count
   */
  getFailureCount(): number {
    return this.failures;
  }

  /**
   * Get time until next retry is allowed (for open circuit)
   */
  getRemainingTimeout(): number {
    if (!this.lastFailureTime) return 0;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return Math.max(0, this.options.timeout - elapsed);
  }

  /**
   * Force the circuit to a specific state (for testing or manual override)
   */
  forceState(state: CircuitState): void {
    this.transitionTo(state);
  }

  /**
   * Reset the circuit breaker to its initial state
   */
  reset(): void {
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.transitionTo(CircuitState.CLOSED);
  }

  /**
   * Get circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      remainingTimeout: this.getRemainingTimeout(),
    };
  }

  private onSuccess(): void {
    this.options.onSuccess?.(this);

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.options.successThreshold) {
        this.transitionTo(CircuitState.CLOSED);
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  private onFailure(error: Error): void {
    this.failures++;
    this.lastFailureTime = new Date();
    this.options.onFailure?.(error, this.failures, this);

    if (this.state === CircuitState.HALF_OPEN) {
      // Any failure in half-open state opens the circuit
      this.transitionTo(CircuitState.OPEN);
    } else if (this.failures >= this.options.failureThreshold) {
      this.transitionTo(CircuitState.OPEN);
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    const elapsed = Date.now() - this.lastFailureTime.getTime();
    return elapsed >= this.options.timeout;
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === CircuitState.CLOSED) {
      this.failures = 0;
      this.successes = 0;
    } else if (newState === CircuitState.HALF_OPEN) {
      this.successes = 0;
    }

    if (oldState !== newState) {
      this.options.onStateChange?.(oldState, newState, this);
    }
  }
}

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: Date;
  remainingTimeout: number;
}

// ============================================================================
// Fallback Strategy
// ============================================================================

/**
 * Fallback configuration options
 */
export interface FallbackOptions<T> {
  /** Static fallback value to return on failure */
  fallbackValue?: T;
  /** Function to generate fallback value (can be async) */
  fallbackFn?: (error: Error) => T | Promise<T>;
  /** Optional condition to determine if fallback should be used */
  shouldFallback?: (error: Error) => boolean;
  /** Callback invoked when fallback is used */
  onFallback?: (error: Error, fallbackValue: T) => void;
}

/**
 * Execute an operation with fallback support
 *
 * @example
 * ```typescript
 * const data = await withFallback(
 *   () => fetchFromPrimary(),
 *   {
 *     fallbackFn: (error) => fetchFromCache(),
 *     shouldFallback: (error) => error.code === 'SERVICE_UNAVAILABLE'
 *   }
 * );
 * ```
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  const { fallbackValue, fallbackFn, shouldFallback, onFallback } = options;

  try {
    return await operation();
  } catch (error) {
    const err = error as Error;

    // Check if we should use fallback for this error
    if (shouldFallback && !shouldFallback(err)) {
      throw error;
    }

    // Use fallback function if provided
    if (fallbackFn) {
      const value = await fallbackFn(err);
      onFallback?.(err, value);
      return value;
    }

    // Use static fallback value if provided
    if (fallbackValue !== undefined) {
      onFallback?.(err, fallbackValue);
      return fallbackValue;
    }

    // No fallback available, rethrow
    throw error;
  }
}

/**
 * Decorator for adding fallback behavior to class methods
 *
 * @example
 * ```typescript
 * class DataService {
 *   @Fallback({ fallbackValue: [] })
 *   async getItems(): Promise<Item[]> {
 *     return fetch('/api/items');
 *   }
 * }
 * ```
 */
export function Fallback<T>(options: FallbackOptions<T>) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withFallback(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// ============================================================================
// Timeout Strategy
// ============================================================================

/**
 * Timeout options
 */
export interface TimeoutOptions {
  /** Timeout duration in milliseconds */
  timeoutMs: number;
  /** Error message when timeout occurs */
  message?: string;
  /** Callback invoked when timeout occurs */
  onTimeout?: (timeoutMs: number) => void;
}

/**
 * Error thrown when an operation times out
 */
export class TimeoutError extends Error {
  public readonly timeoutMs: number;
  public readonly operation?: string;

  constructor(timeoutMs: number, operation?: string, message?: string) {
    super(message ?? `Operation timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
  }
}

/**
 * Execute an operation with a timeout
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   () => longRunningOperation(),
 *   { timeoutMs: 5000, message: 'API call timed out' }
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  options: TimeoutOptions
): Promise<T> {
  const { timeoutMs, message, onTimeout } = options;

  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        onTimeout?.(timeoutMs);
        reject(new TimeoutError(timeoutMs, undefined, message));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Decorator for adding timeout behavior to class methods
 */
export function Timeout(options: TimeoutOptions) {
  return function (
    _target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withTimeout(
        () => originalMethod.apply(this, args),
        { ...options, message: options.message ?? `${propertyKey} timed out after ${options.timeoutMs}ms` }
      );
    };

    return descriptor;
  };
}

// ============================================================================
// Bulkhead Pattern
// ============================================================================

/**
 * Bulkhead options for limiting concurrent operations
 */
export interface BulkheadOptions {
  /** Maximum number of concurrent executions */
  maxConcurrent: number;
  /** Maximum queue size for waiting requests */
  maxQueue: number;
  /** Timeout for queued requests in milliseconds */
  queueTimeout?: number;
}

/**
 * Error thrown when bulkhead rejects a request
 */
export class BulkheadFullError extends Error {
  public readonly bulkheadName: string;
  public readonly currentConcurrent: number;
  public readonly queueSize: number;

  constructor(name: string, currentConcurrent: number, queueSize: number) {
    super(`Bulkhead '${name}' is full: ${currentConcurrent} concurrent, ${queueSize} queued`);
    this.name = 'BulkheadFullError';
    this.bulkheadName = name;
    this.currentConcurrent = currentConcurrent;
    this.queueSize = queueSize;
  }
}

/**
 * Bulkhead pattern for limiting concurrent operations
 *
 * @example
 * ```typescript
 * const bulkhead = new Bulkhead('database', {
 *   maxConcurrent: 10,
 *   maxQueue: 50
 * });
 *
 * const result = await bulkhead.execute(() => databaseQuery());
 * ```
 */
export class Bulkhead {
  private currentConcurrent: number = 0;
  private queue: Array<{
    resolve: () => void;
    reject: (error: Error) => void;
    timer?: NodeJS.Timeout;
  }> = [];

  constructor(
    public readonly name: string,
    private readonly options: BulkheadOptions
  ) {}

  /**
   * Execute an operation through the bulkhead
   */
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      return await operation();
    } finally {
      this.release();
    }
  }

  /**
   * Get current bulkhead statistics
   */
  getStats(): BulkheadStats {
    return {
      name: this.name,
      currentConcurrent: this.currentConcurrent,
      queueSize: this.queue.length,
      maxConcurrent: this.options.maxConcurrent,
      maxQueue: this.options.maxQueue,
    };
  }

  private async acquire(): Promise<void> {
    if (this.currentConcurrent < this.options.maxConcurrent) {
      this.currentConcurrent++;
      return;
    }

    if (this.queue.length >= this.options.maxQueue) {
      throw new BulkheadFullError(this.name, this.currentConcurrent, this.queue.length);
    }

    return new Promise((resolve, reject) => {
      const queueEntry = { resolve, reject, timer: undefined as NodeJS.Timeout | undefined };

      if (this.options.queueTimeout) {
        queueEntry.timer = setTimeout(() => {
          const index = this.queue.indexOf(queueEntry);
          if (index !== -1) {
            this.queue.splice(index, 1);
            reject(new Error(`Bulkhead queue timeout after ${this.options.queueTimeout}ms`));
          }
        }, this.options.queueTimeout);
      }

      this.queue.push(queueEntry);
    });
  }

  private release(): void {
    this.currentConcurrent--;

    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      if (next.timer) {
        clearTimeout(next.timer);
      }
      this.currentConcurrent++;
      next.resolve();
    }
  }
}

/**
 * Bulkhead statistics
 */
export interface BulkheadStats {
  name: string;
  currentConcurrent: number;
  queueSize: number;
  maxConcurrent: number;
  maxQueue: number;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Combine multiple resilience strategies
 *
 * @example
 * ```typescript
 * const result = await withResilience(
 *   () => apiCall(),
 *   {
 *     timeout: { timeoutMs: 5000 },
 *     retry: { maxAttempts: 3 },
 *     fallback: { fallbackValue: defaultData }
 *   }
 * );
 * ```
 */
export async function withResilience<T>(
  operation: () => Promise<T>,
  options: {
    timeout?: TimeoutOptions;
    retry?: Partial<RetryOptions>;
    fallback?: FallbackOptions<T>;
  }
): Promise<T> {
  let wrappedOperation = operation;

  // Apply timeout first (innermost)
  if (options.timeout) {
    const timeoutOpts = options.timeout;
    const originalOp = wrappedOperation;
    wrappedOperation = () => withTimeout(originalOp, timeoutOpts);
  }

  // Apply retry (wraps timeout)
  if (options.retry) {
    const retryOpts = options.retry;
    const originalOp = wrappedOperation;
    wrappedOperation = () => withRetry(originalOp, retryOpts);
  }

  // Apply fallback (outermost)
  if (options.fallback) {
    return withFallback(wrappedOperation, options.fallback);
  }

  return wrappedOperation();
}
