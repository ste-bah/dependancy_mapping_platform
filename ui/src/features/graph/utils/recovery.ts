/**
 * Graph Recovery Strategies
 * Recovery mechanisms and automatic retry logic for graph operations
 * @module features/graph/utils/recovery
 */

import {
  GraphError,
  handleApiError,
  isRetryableError,
  type GraphErrorCode,
  type RecoveryAction,
  type RecoveryActionType,
} from './errorHandler';

// ============================================================================
// Retry Configuration
// ============================================================================

/**
 * Configuration options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  /** Initial delay between retries in milliseconds */
  initialDelayMs: number;
  /** Multiplier for exponential backoff */
  backoffMultiplier: number;
  /** Maximum delay between retries */
  maxDelayMs: number;
  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: GraphError, attempt: number) => boolean;
  /** Callback called before each retry attempt */
  onRetry?: (error: GraphError, attempt: number, delayMs: number) => void;
  /** Callback called when all retries are exhausted */
  onMaxRetriesExceeded?: (error: GraphError) => void;
}

/**
 * Default retry options
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 10000,
};

// ============================================================================
// Retry Implementation
// ============================================================================

/**
 * Execute an async operation with automatic retry on failure
 *
 * @param operation - The async operation to execute
 * @param options - Retry configuration options
 * @returns The result of the operation
 * @throws The last error if all retries are exhausted
 *
 * @example
 * ```ts
 * const data = await withRetry(
 *   () => fetchGraph(scanId),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt) => {
 *       console.log(`Retry attempt ${attempt} after error: ${error.message}`);
 *     },
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const config: RetryOptions = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: GraphError | undefined;
  let currentDelay = config.initialDelayMs;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = handleApiError(error);

      // Check if we should retry
      const shouldRetry = config.shouldRetry
        ? config.shouldRetry(lastError, attempt)
        : isRetryableError(lastError);

      // Don't retry if:
      // - This was the last attempt
      // - The error is not retryable
      // - Custom shouldRetry returns false
      if (attempt === config.maxAttempts || !shouldRetry) {
        if (attempt === config.maxAttempts) {
          config.onMaxRetriesExceeded?.(lastError);
        }
        throw lastError;
      }

      // Notify about retry
      config.onRetry?.(lastError, attempt, currentDelay);

      // Wait before retry
      await sleep(currentDelay);

      // Increase delay for next attempt (exponential backoff)
      currentDelay = Math.min(
        currentDelay * config.backoffMultiplier,
        config.maxDelayMs
      );
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError ?? new GraphError('Retry failed', 'UNKNOWN_ERROR');
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// Circuit Breaker
// ============================================================================

/**
 * Circuit breaker states
 */
export type CircuitState = 'closed' | 'open' | 'half-open';

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening the circuit */
  failureThreshold: number;
  /** Number of successful calls needed to close the circuit */
  successThreshold: number;
  /** Time in milliseconds to wait before trying again (half-open state) */
  resetTimeout: number;
  /** Callback when circuit state changes */
  onStateChange?: (from: CircuitState, to: CircuitState) => void;
}

/**
 * Default circuit breaker options
 */
export const DEFAULT_CIRCUIT_BREAKER_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  successThreshold: 2,
  resetTimeout: 30000,
};

/**
 * Circuit breaker for protecting against cascading failures
 *
 * @example
 * ```ts
 * const circuitBreaker = createCircuitBreaker({
 *   failureThreshold: 3,
 *   resetTimeout: 30000,
 *   onStateChange: (from, to) => {
 *     console.log(`Circuit changed from ${from} to ${to}`);
 *   },
 * });
 *
 * try {
 *   const data = await circuitBreaker.execute(() => fetchGraph(scanId));
 * } catch (error) {
 *   if (error instanceof CircuitOpenError) {
 *     // Circuit is open, show cached data or error message
 *   }
 * }
 * ```
 */
export function createCircuitBreaker(
  options: Partial<CircuitBreakerOptions> = {}
): CircuitBreaker {
  const config: CircuitBreakerOptions = {
    ...DEFAULT_CIRCUIT_BREAKER_OPTIONS,
    ...options,
  };

  let state: CircuitState = 'closed';
  let failures = 0;
  let successes = 0;
  let lastFailureTime: number | undefined;

  function transitionTo(newState: CircuitState): void {
    if (state !== newState) {
      const oldState = state;
      state = newState;

      if (newState === 'closed') {
        failures = 0;
        successes = 0;
      } else if (newState === 'half-open') {
        successes = 0;
      }

      config.onStateChange?.(oldState, newState);
    }
  }

  function shouldAttemptReset(): boolean {
    if (!lastFailureTime) return true;
    return Date.now() - lastFailureTime >= config.resetTimeout;
  }

  async function execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if circuit is open
    if (state === 'open') {
      if (shouldAttemptReset()) {
        transitionTo('half-open');
      } else {
        const remainingTime = lastFailureTime
          ? config.resetTimeout - (Date.now() - lastFailureTime)
          : 0;
        throw new CircuitOpenError(Math.max(0, remainingTime));
      }
    }

    try {
      const result = await operation();
      onSuccess();
      return result;
    } catch (error) {
      onFailure();
      throw error;
    }
  }

  function onSuccess(): void {
    if (state === 'half-open') {
      successes++;
      if (successes >= config.successThreshold) {
        transitionTo('closed');
      }
    } else {
      failures = 0;
    }
  }

  function onFailure(): void {
    failures++;
    lastFailureTime = Date.now();

    if (state === 'half-open') {
      transitionTo('open');
    } else if (failures >= config.failureThreshold) {
      transitionTo('open');
    }
  }

  function getState(): CircuitState {
    return state;
  }

  function reset(): void {
    transitionTo('closed');
    lastFailureTime = undefined;
  }

  return {
    execute,
    getState,
    reset,
  };
}

/**
 * Circuit breaker interface
 */
export interface CircuitBreaker {
  execute<T>(operation: () => Promise<T>): Promise<T>;
  getState(): CircuitState;
  reset(): void;
}

/**
 * Error thrown when circuit is open
 */
export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Circuit is open. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`);
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

// ============================================================================
// Fallback Strategies
// ============================================================================

/**
 * Configuration for fallback behavior
 */
export interface FallbackOptions<T> {
  /** Static fallback value to use */
  fallbackValue?: T;
  /** Function to compute fallback value */
  fallbackFn?: (error: GraphError) => T | Promise<T>;
  /** Determine if fallback should be used for this error */
  shouldFallback?: (error: GraphError) => boolean;
}

/**
 * Execute an operation with fallback on failure
 *
 * @param operation - The async operation to execute
 * @param options - Fallback configuration
 * @returns The result of the operation or the fallback value
 *
 * @example
 * ```ts
 * const data = await withFallback(
 *   () => fetchGraph(scanId),
 *   {
 *     fallbackFn: (error) => getCachedGraph(scanId),
 *     shouldFallback: (error) => error.code === 'NETWORK_ERROR',
 *   }
 * );
 * ```
 */
export async function withFallback<T>(
  operation: () => Promise<T>,
  options: FallbackOptions<T>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const graphError = handleApiError(error);

    // Check if we should use fallback
    if (options.shouldFallback && !options.shouldFallback(graphError)) {
      throw graphError;
    }

    // Use fallback function if provided
    if (options.fallbackFn) {
      return options.fallbackFn(graphError);
    }

    // Use fallback value if provided
    if (options.fallbackValue !== undefined) {
      return options.fallbackValue;
    }

    // No fallback available, rethrow
    throw graphError;
  }
}

// ============================================================================
// Timeout Handling
// ============================================================================

/**
 * Execute an operation with a timeout
 *
 * @param operation - The async operation to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Optional custom timeout message
 * @returns The result of the operation
 * @throws GraphError with TIMEOUT_ERROR code if timeout is exceeded
 *
 * @example
 * ```ts
 * const data = await withTimeout(
 *   () => calculateBlastRadius(scanId, nodeId),
 *   30000, // 30 second timeout
 *   'Blast radius calculation timed out'
 * );
 * ```
 */
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  timeoutMessage?: string
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new GraphError(
          timeoutMessage ?? 'Operation timed out',
          'TIMEOUT_ERROR',
          { retryable: true }
        )
      );
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([operation(), timeoutPromise]);
    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// Auto-Recovery
// ============================================================================

/**
 * Automatic recovery result
 */
export interface AutoRecoveryResult {
  /** Whether recovery was successful */
  recovered: boolean;
  /** Recovery action that was taken */
  action?: RecoveryActionType;
  /** Error message if recovery failed */
  error?: string;
}

/**
 * Attempt automatic recovery based on error type
 *
 * @param error - The error to recover from
 * @param handlers - Recovery handlers for different action types
 * @returns Whether recovery was successful
 *
 * @example
 * ```ts
 * const result = await attemptAutoRecovery(error, {
 *   retry: () => refetch(),
 *   clear_cache: () => queryClient.invalidateQueries(),
 * });
 *
 * if (result.recovered) {
 *   console.log(`Recovered via ${result.action}`);
 * }
 * ```
 */
export async function attemptAutoRecovery(
  error: GraphError | Error,
  handlers: Partial<Record<RecoveryActionType, () => void | Promise<void>>>
): Promise<AutoRecoveryResult> {
  const graphError = error instanceof GraphError ? error : handleApiError(error);

  // Map error codes to automatic recovery actions
  const autoRecoveryActions: Partial<Record<GraphErrorCode, RecoveryActionType>> = {
    NETWORK_ERROR: 'retry',
    TIMEOUT_ERROR: 'retry',
    SERVER_ERROR: 'retry',
  };

  const action = autoRecoveryActions[graphError.code];

  if (!action || !handlers[action]) {
    return {
      recovered: false,
      error: 'No automatic recovery available for this error',
    };
  }

  try {
    await handlers[action]?.();
    return {
      recovered: true,
      action,
    };
  } catch (recoveryError) {
    return {
      recovered: false,
      action,
      error: recoveryError instanceof Error
        ? recoveryError.message
        : 'Recovery action failed',
    };
  }
}

// ============================================================================
// Recovery Action Executors
// ============================================================================

/**
 * Create recovery action handlers with callbacks
 *
 * @param callbacks - Implementation of recovery actions
 * @returns Object with execute function for each action
 *
 * @example
 * ```ts
 * const recovery = createRecoveryHandlers({
 *   retry: () => refetch(),
 *   refresh: () => window.location.reload(),
 *   navigate: () => router.back(),
 *   clear_cache: () => queryClient.clear(),
 * });
 *
 * // Execute an action
 * recovery.execute('retry');
 * ```
 */
export function createRecoveryHandlers(
  callbacks: Partial<Record<RecoveryActionType, () => void | Promise<void>>>
): {
  execute: (action: RecoveryActionType) => Promise<boolean>;
  canExecute: (action: RecoveryActionType) => boolean;
} {
  return {
    execute: async (action: RecoveryActionType): Promise<boolean> => {
      const handler = callbacks[action];
      if (!handler) {
        return false;
      }

      try {
        await handler();
        return true;
      } catch {
        return false;
      }
    },
    canExecute: (action: RecoveryActionType): boolean => {
      return action in callbacks && callbacks[action] !== undefined;
    },
  };
}

// ============================================================================
// Graceful Degradation
// ============================================================================

/**
 * Options for graceful degradation
 */
export interface DegradationOptions<T> {
  /** Full-featured operation */
  primary: () => Promise<T>;
  /** Degraded operation with reduced functionality */
  degraded?: () => Promise<T>;
  /** Minimal fallback data */
  minimal?: T;
  /** Determine if we should degrade for this error */
  shouldDegrade?: (error: GraphError) => boolean;
}

/**
 * Result of graceful degradation
 */
export interface DegradationResult<T> {
  /** The result data */
  data: T;
  /** Level of degradation */
  level: 'full' | 'degraded' | 'minimal';
  /** Error that caused degradation (if any) */
  error?: GraphError;
}

/**
 * Execute with graceful degradation through multiple fallback levels
 *
 * @param options - Degradation configuration
 * @returns Result with data and degradation level
 *
 * @example
 * ```ts
 * const result = await withGracefulDegradation({
 *   primary: () => fetchFullGraph(scanId),
 *   degraded: () => fetchGraphSummary(scanId),
 *   minimal: { nodes: [], edges: [], metadata: undefined },
 * });
 *
 * if (result.level === 'degraded') {
 *   showWarning('Showing limited graph data');
 * }
 * ```
 */
export async function withGracefulDegradation<T>(
  options: DegradationOptions<T>
): Promise<DegradationResult<T>> {
  // Try primary operation
  try {
    const data = await options.primary();
    return { data, level: 'full' };
  } catch (primaryError) {
    const graphError = handleApiError(primaryError);

    // Check if we should degrade
    if (options.shouldDegrade && !options.shouldDegrade(graphError)) {
      throw graphError;
    }

    // Try degraded operation if available
    if (options.degraded) {
      try {
        const data = await options.degraded();
        return { data, level: 'degraded', error: graphError };
      } catch (degradedError) {
        // Fall through to minimal
      }
    }

    // Use minimal fallback if available
    if (options.minimal !== undefined) {
      return { data: options.minimal, level: 'minimal', error: graphError };
    }

    // No fallback available
    throw graphError;
  }
}
