/**
 * E2E Error Handlers
 * @module e2e/errors/error-handlers
 *
 * Error handling strategies and handlers for E2E testing:
 * - Retry logic for flaky tests with exponential backoff
 * - Graceful degradation strategies
 * - Cleanup on failure handlers
 * - Error aggregation and collection
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #26 of 47 | Phase 4: Implementation
 */

import {
  E2ETestError,
  E2EErrorCodes,
  TimeoutError,
  AssertionError,
  SetupError,
  FixtureError,
  RetryExhaustedError,
  FlakyTestError,
  isE2ETestError,
  isRetryableE2EError,
  wrapAsE2EError,
  type E2EErrorContext,
  type E2EErrorCode,
} from './e2e-errors.js';
import type { TestPhase, TestCaseId, TestSuiteId } from '../types/test-types.js';

// ============================================================================
// Retry Strategy Types
// ============================================================================

/**
 * Retry configuration options
 */
export interface E2ERetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay in milliseconds */
  initialDelayMs: number;
  /** Maximum delay cap in milliseconds */
  maxDelayMs: number;
  /** Backoff multiplier for exponential delay */
  backoffMultiplier: number;
  /** Jitter factor (0-1) to add randomness */
  jitterFactor: number;
  /** Custom predicate to determine if error is retryable */
  retryIf?: (error: Error, attempt: number) => boolean;
  /** Callback invoked before each retry */
  onRetry?: (error: Error, attempt: number, delayMs: number) => void | Promise<void>;
  /** Callback invoked when all retries are exhausted */
  onExhausted?: (error: Error, attempts: number) => void | Promise<void>;
  /** Timeout for each attempt in milliseconds */
  attemptTimeout?: number;
}

/**
 * Default retry options
 */
export const DEFAULT_E2E_RETRY_OPTIONS: Required<Omit<E2ERetryOptions, 'retryIf' | 'onRetry' | 'onExhausted' | 'attemptTimeout'>> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.1,
};

/**
 * Retry result with attempt information
 */
export interface RetryResult<T> {
  readonly success: boolean;
  readonly value?: T;
  readonly attempts: number;
  readonly totalDelayMs: number;
  readonly errors: Error[];
}

// ============================================================================
// Retry Implementation
// ============================================================================

/**
 * Execute an operation with retry logic
 *
 * @example
 * ```typescript
 * const result = await withE2ERetry(
 *   async () => {
 *     const response = await fetch('/api/data');
 *     if (!response.ok) throw new Error('API failed');
 *     return response.json();
 *   },
 *   {
 *     maxAttempts: 3,
 *     initialDelayMs: 1000,
 *     onRetry: (error, attempt) => console.log(`Retry ${attempt}: ${error.message}`)
 *   }
 * );
 * ```
 */
export async function withE2ERetry<T>(
  operation: () => Promise<T>,
  options: Partial<E2ERetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_E2E_RETRY_OPTIONS, ...options };
  const {
    maxAttempts,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
    jitterFactor,
    retryIf = isRetryableE2EError,
    onRetry,
    onExhausted,
    attemptTimeout,
  } = opts;

  const errors: Error[] = [];
  let currentDelay = initialDelayMs;
  let totalDelayMs = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Execute with optional timeout
      const result = attemptTimeout
        ? await withAttemptTimeout(operation, attemptTimeout, attempt)
        : await operation();
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);

      // Check if we should retry
      if (attempt === maxAttempts || !retryIf(err, attempt)) {
        await onExhausted?.(err, attempt);
        throw new RetryExhaustedError(attempt, maxAttempts, errors);
      }

      // Calculate delay with jitter
      const jitter = currentDelay * jitterFactor * (Math.random() * 2 - 1);
      const actualDelay = Math.min(currentDelay + jitter, maxDelayMs);

      await onRetry?.(err, attempt, actualDelay);

      // Wait before retrying
      await sleep(actualDelay);
      totalDelayMs += actualDelay;

      // Increase delay for next iteration
      currentDelay = Math.min(currentDelay * backoffMultiplier, maxDelayMs);
    }
  }

  // Should never reach here, but TypeScript needs it
  throw new RetryExhaustedError(maxAttempts, maxAttempts, errors);
}

/**
 * Execute with attempt timeout
 */
async function withAttemptTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  attempt: number
): Promise<T> {
  return Promise.race([
    operation(),
    new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(
          `Attempt ${attempt} timed out after ${timeoutMs}ms`,
          timeoutMs,
          'retry_attempt'
        ));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Decorator for adding retry behavior to test functions
 */
export function E2ERetry(options: Partial<E2ERetryOptions> = {}) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withE2ERetry(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// ============================================================================
// Error Handler Types
// ============================================================================

/**
 * Error handler configuration
 */
export interface E2EErrorHandlerConfig {
  /** Log errors to console */
  logErrors: boolean;
  /** Capture screenshots on failure (for browser tests) */
  captureScreenshots: boolean;
  /** Collect browser console logs on failure */
  collectConsoleLogs: boolean;
  /** Collect network logs on failure */
  collectNetworkLogs: boolean;
  /** Run cleanup handlers on failure */
  runCleanupOnFailure: boolean;
  /** Maximum cleanup timeout */
  cleanupTimeoutMs: number;
  /** Custom error reporter */
  errorReporter?: (error: E2ETestError) => void | Promise<void>;
}

/**
 * Default error handler config
 */
export const DEFAULT_ERROR_HANDLER_CONFIG: E2EErrorHandlerConfig = {
  logErrors: true,
  captureScreenshots: true,
  collectConsoleLogs: true,
  collectNetworkLogs: false,
  runCleanupOnFailure: true,
  cleanupTimeoutMs: 5000,
};

/**
 * Cleanup handler function type
 */
export type CleanupHandler = () => void | Promise<void>;

/**
 * Error handler context
 */
export interface ErrorHandlerContext {
  readonly testId?: TestCaseId;
  readonly suiteId?: TestSuiteId;
  readonly phase: TestPhase;
  readonly metadata?: Record<string, unknown>;
}

// ============================================================================
// Error Handler Implementation
// ============================================================================

/**
 * E2E Error Handler manages error processing and cleanup
 */
export class E2EErrorHandler {
  private readonly config: E2EErrorHandlerConfig;
  private readonly cleanupHandlers: CleanupHandler[] = [];
  private readonly collectedErrors: E2ETestError[] = [];

  constructor(config: Partial<E2EErrorHandlerConfig> = {}) {
    this.config = { ...DEFAULT_ERROR_HANDLER_CONFIG, ...config };
  }

  /**
   * Register a cleanup handler
   */
  registerCleanup(handler: CleanupHandler): void {
    this.cleanupHandlers.push(handler);
  }

  /**
   * Clear all cleanup handlers
   */
  clearCleanupHandlers(): void {
    this.cleanupHandlers.length = 0;
  }

  /**
   * Handle an error with full processing
   */
  async handle(error: unknown, context: ErrorHandlerContext): Promise<E2ETestError> {
    // Normalize error
    const e2eError = this.normalizeError(error, context);

    // Collect the error
    this.collectedErrors.push(e2eError);

    // Log if configured
    if (this.config.logErrors) {
      this.logError(e2eError);
    }

    // Report to custom reporter
    if (this.config.errorReporter) {
      try {
        await this.config.errorReporter(e2eError);
      } catch (reportError) {
        console.error('Error reporter failed:', reportError);
      }
    }

    // Run cleanup if configured
    if (this.config.runCleanupOnFailure) {
      await this.runCleanupHandlers();
    }

    return e2eError;
  }

  /**
   * Handle error synchronously (no cleanup)
   */
  handleSync(error: unknown, context: ErrorHandlerContext): E2ETestError {
    const e2eError = this.normalizeError(error, context);
    this.collectedErrors.push(e2eError);

    if (this.config.logErrors) {
      this.logError(e2eError);
    }

    return e2eError;
  }

  /**
   * Run all cleanup handlers with timeout
   */
  async runCleanupHandlers(): Promise<void> {
    if (this.cleanupHandlers.length === 0) return;

    const handlers = [...this.cleanupHandlers];
    this.cleanupHandlers.length = 0;

    const results = await Promise.allSettled(
      handlers.map((handler) =>
        Promise.race([
          Promise.resolve().then(handler),
          new Promise<void>((_, reject) => {
            setTimeout(() => {
              reject(new Error('Cleanup handler timeout'));
            }, this.config.cleanupTimeoutMs);
          }),
        ])
      )
    );

    // Log cleanup failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(`Cleanup handler ${index} failed:`, result.reason);
      }
    });
  }

  /**
   * Get all collected errors
   */
  getCollectedErrors(): ReadonlyArray<E2ETestError> {
    return [...this.collectedErrors];
  }

  /**
   * Clear collected errors
   */
  clearCollectedErrors(): void {
    this.collectedErrors.length = 0;
  }

  /**
   * Check if any errors were collected
   */
  hasErrors(): boolean {
    return this.collectedErrors.length > 0;
  }

  /**
   * Get error summary
   */
  getErrorSummary(): ErrorSummary {
    const byCode = new Map<E2EErrorCode, number>();
    const byPhase = new Map<TestPhase, number>();

    for (const error of this.collectedErrors) {
      byCode.set(error.code, (byCode.get(error.code) ?? 0) + 1);
      if (error.phase) {
        byPhase.set(error.phase, (byPhase.get(error.phase) ?? 0) + 1);
      }
    }

    return {
      totalErrors: this.collectedErrors.length,
      byCode: Object.fromEntries(byCode),
      byPhase: Object.fromEntries(byPhase),
      firstError: this.collectedErrors[0],
      lastError: this.collectedErrors[this.collectedErrors.length - 1],
    };
  }

  /**
   * Normalize any error to E2ETestError
   */
  private normalizeError(error: unknown, context: ErrorHandlerContext): E2ETestError {
    if (isE2ETestError(error)) {
      return error.withContext({
        phase: context.phase,
        suiteId: context.suiteId,
        caseId: context.testId,
        details: context.metadata,
      });
    }

    return wrapAsE2EError(error, E2EErrorCodes.TEST_ERROR, {
      phase: context.phase,
      suiteId: context.suiteId,
      caseId: context.testId,
      details: context.metadata,
    });
  }

  /**
   * Log error to console
   */
  private logError(error: E2ETestError): void {
    const prefix = `[E2E:${error.code}]`;
    const context = error.caseId ?? error.suiteId ?? 'unknown';
    const phase = error.phase ? `(${error.phase})` : '';

    console.error(`${prefix} ${context}${phase}: ${error.message}`);

    if (error.stack) {
      console.error(error.stack);
    }
  }
}

/**
 * Error summary statistics
 */
export interface ErrorSummary {
  readonly totalErrors: number;
  readonly byCode: Record<string, number>;
  readonly byPhase: Record<string, number>;
  readonly firstError?: E2ETestError;
  readonly lastError?: E2ETestError;
}

// ============================================================================
// Graceful Degradation
// ============================================================================

/**
 * Fallback options for graceful degradation
 */
export interface FallbackOptions<T> {
  /** Static fallback value */
  fallbackValue?: T;
  /** Function to compute fallback value */
  fallbackFn?: (error: Error) => T | Promise<T>;
  /** Predicate to determine if fallback should be used */
  shouldFallback?: (error: Error) => boolean;
  /** Callback when fallback is used */
  onFallback?: (error: Error, fallbackValue: T) => void | Promise<void>;
}

/**
 * Execute operation with fallback support
 *
 * @example
 * ```typescript
 * const data = await withE2EFallback(
 *   () => fetchFromPrimaryService(),
 *   {
 *     fallbackFn: () => fetchFromCacheService(),
 *     shouldFallback: (error) => error.code === 'SERVICE_UNAVAILABLE'
 *   }
 * );
 * ```
 */
export async function withE2EFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  const { fallbackValue, fallbackFn, shouldFallback = () => true, onFallback } = options;

  try {
    return await operation();
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    // Check if fallback should be used
    if (!shouldFallback(err)) {
      throw error;
    }

    // Use fallback function if provided
    if (fallbackFn) {
      const value = await fallbackFn(err);
      await onFallback?.(err, value);
      return value;
    }

    // Use static fallback value
    if (fallbackValue !== undefined) {
      await onFallback?.(err, fallbackValue);
      return fallbackValue;
    }

    // No fallback available
    throw error;
  }
}

/**
 * Decorator for adding fallback behavior
 */
export function E2EFallback<T>(options: FallbackOptions<T>) {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      return withE2EFallback(() => originalMethod.apply(this, args), options);
    };

    return descriptor;
  };
}

// ============================================================================
// Error Aggregation
// ============================================================================

/**
 * Error aggregator for collecting multiple errors
 */
export class ErrorAggregator {
  private readonly errors: E2ETestError[] = [];
  private readonly maxErrors: number;

  constructor(maxErrors = 100) {
    this.maxErrors = maxErrors;
  }

  /**
   * Add an error to the aggregator
   */
  add(error: unknown, context?: Partial<E2EErrorContext>): void {
    if (this.errors.length >= this.maxErrors) {
      // Remove oldest error
      this.errors.shift();
    }

    const e2eError = isE2ETestError(error)
      ? context ? error.withContext(context) : error
      : wrapAsE2EError(error, E2EErrorCodes.TEST_ERROR, context);

    this.errors.push(e2eError);
  }

  /**
   * Get all aggregated errors
   */
  getAll(): ReadonlyArray<E2ETestError> {
    return [...this.errors];
  }

  /**
   * Get errors by code
   */
  getByCode(code: E2EErrorCode): ReadonlyArray<E2ETestError> {
    return this.errors.filter((e) => e.code === code);
  }

  /**
   * Get errors by phase
   */
  getByPhase(phase: TestPhase): ReadonlyArray<E2ETestError> {
    return this.errors.filter((e) => e.phase === phase);
  }

  /**
   * Get error count
   */
  count(): number {
    return this.errors.length;
  }

  /**
   * Check if any errors exist
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Clear all errors
   */
  clear(): void {
    this.errors.length = 0;
  }

  /**
   * Throw aggregated error if any exist
   */
  throwIfErrors(): void {
    if (this.errors.length === 0) return;

    if (this.errors.length === 1) {
      throw this.errors[0];
    }

    throw new AggregatedE2EError(this.errors);
  }

  /**
   * Get summary of aggregated errors
   */
  getSummary(): AggregatedErrorSummary {
    const byCode = new Map<E2EErrorCode, number>();
    const byPhase = new Map<TestPhase, number>();

    for (const error of this.errors) {
      byCode.set(error.code, (byCode.get(error.code) ?? 0) + 1);
      if (error.phase) {
        byPhase.set(error.phase, (byPhase.get(error.phase) ?? 0) + 1);
      }
    }

    return {
      total: this.errors.length,
      byCode: Object.fromEntries(byCode),
      byPhase: Object.fromEntries(byPhase),
      recoverable: this.errors.filter((e) => e.recoverable).length,
      nonRecoverable: this.errors.filter((e) => !e.recoverable).length,
    };
  }
}

/**
 * Aggregated error summary
 */
export interface AggregatedErrorSummary {
  readonly total: number;
  readonly byCode: Record<string, number>;
  readonly byPhase: Record<string, number>;
  readonly recoverable: number;
  readonly nonRecoverable: number;
}

/**
 * Error containing multiple aggregated errors
 */
export class AggregatedE2EError extends E2ETestError {
  public readonly errors: ReadonlyArray<E2ETestError>;

  constructor(errors: E2ETestError[], context?: Partial<E2EErrorContext>) {
    super(
      `${errors.length} errors occurred during test execution`,
      E2EErrorCodes.TEST_ERROR,
      context,
      false
    );
    this.name = 'AggregatedE2EError';
    this.errors = errors;
  }

  /**
   * Get first error
   */
  getFirst(): E2ETestError | undefined {
    return this.errors[0];
  }

  /**
   * Get last error
   */
  getLast(): E2ETestError | undefined {
    return this.errors[this.errors.length - 1];
  }

  toJSON() {
    return {
      ...super.toJSON(),
      errorCount: this.errors.length,
      errors: this.errors.map((e) => e.toJSON()),
    };
  }
}

// ============================================================================
// Cleanup Utilities
// ============================================================================

/**
 * Cleanup registry for managing test cleanup handlers
 */
export class CleanupRegistry {
  private readonly handlers: Map<string, CleanupHandler> = new Map();
  private readonly order: string[] = [];

  /**
   * Register a cleanup handler with a unique key
   */
  register(key: string, handler: CleanupHandler): void {
    if (!this.handlers.has(key)) {
      this.order.push(key);
    }
    this.handlers.set(key, handler);
  }

  /**
   * Unregister a cleanup handler
   */
  unregister(key: string): boolean {
    const existed = this.handlers.delete(key);
    if (existed) {
      const index = this.order.indexOf(key);
      if (index !== -1) {
        this.order.splice(index, 1);
      }
    }
    return existed;
  }

  /**
   * Run all cleanup handlers in reverse order
   */
  async runAll(timeoutMs = 5000): Promise<CleanupResult> {
    const results: Array<{ key: string; success: boolean; error?: Error }> = [];

    // Run in reverse order (LIFO)
    for (const key of [...this.order].reverse()) {
      const handler = this.handlers.get(key);
      if (!handler) continue;

      try {
        await Promise.race([
          Promise.resolve().then(handler),
          new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error(`Cleanup '${key}' timed out`)), timeoutMs);
          }),
        ]);
        results.push({ key, success: true });
      } catch (error) {
        results.push({
          key,
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    // Clear all handlers
    this.handlers.clear();
    this.order.length = 0;

    return {
      total: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Get number of registered handlers
   */
  count(): number {
    return this.handlers.size;
  }

  /**
   * Check if a handler is registered
   */
  has(key: string): boolean {
    return this.handlers.has(key);
  }

  /**
   * Clear all handlers without running
   */
  clear(): void {
    this.handlers.clear();
    this.order.length = 0;
  }
}

/**
 * Cleanup execution result
 */
export interface CleanupResult {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly results: ReadonlyArray<{
    readonly key: string;
    readonly success: boolean;
    readonly error?: Error;
  }>;
}

// ============================================================================
// Error Boundary Pattern
// ============================================================================

/**
 * Execute operation within an error boundary
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  options: {
    phase?: TestPhase;
    suiteId?: TestSuiteId;
    caseId?: TestCaseId;
    onError?: (error: E2ETestError) => void | Promise<void>;
    cleanup?: CleanupHandler;
  } = {}
): Promise<{ success: true; value: T } | { success: false; error: E2ETestError }> {
  try {
    const value = await operation();
    return { success: true, value };
  } catch (error) {
    const e2eError = wrapAsE2EError(error, E2EErrorCodes.TEST_ERROR, {
      phase: options.phase,
      suiteId: options.suiteId,
      caseId: options.caseId,
    });

    // Run error handler
    if (options.onError) {
      try {
        await options.onError(e2eError);
      } catch (handlerError) {
        console.error('Error handler failed:', handlerError);
      }
    }

    // Run cleanup
    if (options.cleanup) {
      try {
        await options.cleanup();
      } catch (cleanupError) {
        console.error('Cleanup failed:', cleanupError);
      }
    }

    return { success: false, error: e2eError };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create an error handler instance
 */
export function createErrorHandler(
  config?: Partial<E2EErrorHandlerConfig>
): E2EErrorHandler {
  return new E2EErrorHandler(config);
}

/**
 * Create an error aggregator instance
 */
export function createErrorAggregator(maxErrors?: number): ErrorAggregator {
  return new ErrorAggregator(maxErrors);
}

/**
 * Create a cleanup registry instance
 */
export function createCleanupRegistry(): CleanupRegistry {
  return new CleanupRegistry();
}
