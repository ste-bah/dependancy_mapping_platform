/**
 * Graph Error Handling Hook
 * React hook for handling graph errors with user feedback
 * @module features/graph/hooks/useGraphErrorHandling
 */

import { useCallback, useState, useRef, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  GraphError,
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  isRetryableError,
  isAuthError,
  type RecoveryAction,
  type RecoveryActionType,
  type GraphErrorCode,
} from '../utils/errorHandler';
import { logGraphError, trackErrorMetrics, type ErrorContext } from '../utils/errorLogging';
import { graphQueryKeys } from './queryKeys';

// ============================================================================
// Types
// ============================================================================

/**
 * Error entry for tracking pending/displayed errors
 */
export interface ErrorEntry {
  /** Unique error ID */
  id: string;
  /** The error object */
  error: GraphError;
  /** When the error occurred */
  timestamp: Date;
  /** Error context */
  context?: ErrorContext;
  /** Whether the error has been dismissed */
  dismissed: boolean;
  /** Available recovery actions */
  recoveryActions: RecoveryAction[];
}

/**
 * Options for the error handling hook
 */
export interface UseGraphErrorHandlingOptions {
  /** Callback when an error occurs */
  onError?: (error: GraphError, entry: ErrorEntry) => void;
  /** Callback when an error is dismissed */
  onDismiss?: (entry: ErrorEntry) => void;
  /** Callback for authentication errors */
  onAuthError?: (error: GraphError) => void;
  /** Maximum number of errors to keep in history */
  maxHistorySize?: number;
  /** Auto-dismiss timeout in milliseconds (0 to disable) */
  autoDismissMs?: number;
  /** Enable automatic error logging */
  enableLogging?: boolean;
  /** Enable error metrics tracking */
  enableMetrics?: boolean;
}

/**
 * Return type for the error handling hook
 */
export interface UseGraphErrorHandlingReturn {
  /** Handle an error (logs, tracks, and stores it) */
  handleError: (error: unknown, context?: ErrorContext) => GraphError;
  /** Dismiss a specific error by ID */
  dismissError: (errorId: string) => void;
  /** Dismiss all errors */
  dismissAllErrors: () => void;
  /** Clear error history */
  clearHistory: () => void;
  /** Execute a recovery action */
  executeRecoveryAction: (errorId: string, actionType: RecoveryActionType) => Promise<boolean>;
  /** Current pending (not dismissed) errors */
  pendingErrors: ErrorEntry[];
  /** All errors in history (including dismissed) */
  errorHistory: ErrorEntry[];
  /** Whether there are any pending errors */
  hasErrors: boolean;
  /** Get the most recent error */
  latestError: ErrorEntry | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Generate a unique error entry ID
 */
function generateErrorId(): string {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Hook for comprehensive graph error handling
 *
 * Provides error handling, logging, metrics tracking, and recovery actions.
 *
 * @param options - Configuration options
 * @returns Error handling utilities and state
 *
 * @example
 * ```tsx
 * function GraphContainer({ scanId }: Props) {
 *   const {
 *     handleError,
 *     pendingErrors,
 *     dismissError,
 *     executeRecoveryAction,
 *   } = useGraphErrorHandling({
 *     onAuthError: () => navigate('/login'),
 *   });
 *
 *   const { data, error } = useGraphQuery(scanId);
 *
 *   useEffect(() => {
 *     if (error) {
 *       handleError(error, { operation: 'fetchGraph', scanId });
 *     }
 *   }, [error, handleError, scanId]);
 *
 *   return (
 *     <>
 *       {pendingErrors.map(entry => (
 *         <ErrorToast
 *           key={entry.id}
 *           error={entry.error}
 *           onDismiss={() => dismissError(entry.id)}
 *           onRetry={() => executeRecoveryAction(entry.id, 'retry')}
 *         />
 *       ))}
 *       <Graph data={data} />
 *     </>
 *   );
 * }
 * ```
 */
export function useGraphErrorHandling(
  options: UseGraphErrorHandlingOptions = {}
): UseGraphErrorHandlingReturn {
  const {
    onError,
    onDismiss,
    onAuthError,
    maxHistorySize = 50,
    autoDismissMs = 0,
    enableLogging = true,
    enableMetrics = true,
  } = options;

  const queryClient = useQueryClient();
  const [errorHistory, setErrorHistory] = useState<ErrorEntry[]>([]);
  const autoDismissTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Cleanup timers on unmount
  const cleanup = useCallback(() => {
    autoDismissTimers.current.forEach((timer) => clearTimeout(timer));
    autoDismissTimers.current.clear();
  }, []);

  // Create recovery handlers
  const recoveryHandlers = useMemo(
    () => createRecoveryHandlers(queryClient),
    [queryClient]
  );

  /**
   * Handle an error - log, track, and store it
   */
  const handleError = useCallback(
    (error: unknown, context?: ErrorContext): GraphError => {
      const graphError = handleApiError(error);

      // Log error if enabled
      if (enableLogging) {
        logGraphError(graphError, context);
      }

      // Track metrics if enabled
      if (enableMetrics) {
        trackErrorMetrics(graphError, context);
      }

      // Handle auth errors specially
      if (isAuthError(graphError) && onAuthError) {
        onAuthError(graphError);
      }

      // Create error entry
      const entry: ErrorEntry = {
        id: generateErrorId(),
        error: graphError,
        timestamp: new Date(),
        context,
        dismissed: false,
        recoveryActions: getErrorRecoveryActions(graphError),
      };

      // Add to history
      setErrorHistory((prev) => {
        const updated = [entry, ...prev];
        // Trim history if needed
        if (updated.length > maxHistorySize) {
          return updated.slice(0, maxHistorySize);
        }
        return updated;
      });

      // Set up auto-dismiss timer if enabled
      if (autoDismissMs > 0) {
        const timer = setTimeout(() => {
          dismissError(entry.id);
        }, autoDismissMs);
        autoDismissTimers.current.set(entry.id, timer);
      }

      // Call error callback
      onError?.(graphError, entry);

      return graphError;
    },
    [enableLogging, enableMetrics, onAuthError, onError, maxHistorySize, autoDismissMs]
  );

  /**
   * Dismiss a specific error
   */
  const dismissError = useCallback(
    (errorId: string) => {
      // Clear auto-dismiss timer
      const timer = autoDismissTimers.current.get(errorId);
      if (timer) {
        clearTimeout(timer);
        autoDismissTimers.current.delete(errorId);
      }

      setErrorHistory((prev) => {
        const updated = prev.map((entry) =>
          entry.id === errorId ? { ...entry, dismissed: true } : entry
        );

        // Find the dismissed entry for callback
        const dismissed = updated.find((e) => e.id === errorId);
        if (dismissed) {
          onDismiss?.(dismissed);
        }

        return updated;
      });
    },
    [onDismiss]
  );

  /**
   * Dismiss all pending errors
   */
  const dismissAllErrors = useCallback(() => {
    // Clear all auto-dismiss timers
    cleanup();

    setErrorHistory((prev) =>
      prev.map((entry) => {
        if (!entry.dismissed) {
          onDismiss?.(entry);
        }
        return { ...entry, dismissed: true };
      })
    );
  }, [cleanup, onDismiss]);

  /**
   * Clear error history completely
   */
  const clearHistory = useCallback(() => {
    cleanup();
    setErrorHistory([]);
  }, [cleanup]);

  /**
   * Execute a recovery action for an error
   */
  const executeRecoveryAction = useCallback(
    async (errorId: string, actionType: RecoveryActionType): Promise<boolean> => {
      const entry = errorHistory.find((e) => e.id === errorId);
      if (!entry) {
        return false;
      }

      const handler = recoveryHandlers[actionType];
      if (!handler) {
        return false;
      }

      try {
        await handler(entry);
        // Dismiss error after successful recovery
        dismissError(errorId);
        return true;
      } catch {
        return false;
      }
    },
    [errorHistory, recoveryHandlers, dismissError]
  );

  // Computed values
  const pendingErrors = useMemo(
    () => errorHistory.filter((e) => !e.dismissed),
    [errorHistory]
  );

  const hasErrors = pendingErrors.length > 0;
  const latestError = pendingErrors[0] ?? null;

  return {
    handleError,
    dismissError,
    dismissAllErrors,
    clearHistory,
    executeRecoveryAction,
    pendingErrors,
    errorHistory,
    hasErrors,
    latestError,
  };
}

// ============================================================================
// Recovery Handlers
// ============================================================================

/**
 * Create recovery action handlers
 */
function createRecoveryHandlers(
  queryClient: ReturnType<typeof useQueryClient>
): Record<RecoveryActionType, (entry: ErrorEntry) => Promise<void>> {
  return {
    retry: async (entry) => {
      // Invalidate related queries to trigger refetch
      if (entry.context?.scanId) {
        await queryClient.invalidateQueries({
          queryKey: graphQueryKeys.scan(entry.context.scanId),
        });
      } else {
        await queryClient.invalidateQueries({
          queryKey: graphQueryKeys.all,
        });
      }
    },

    refresh: async () => {
      // Refresh the page
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    },

    navigate: async () => {
      // Go back in history
      if (typeof window !== 'undefined') {
        window.history.back();
      }
    },

    clear_cache: async () => {
      // Clear all graph queries from cache
      queryClient.removeQueries({
        queryKey: graphQueryKeys.all,
      });
    },

    sign_in: async () => {
      // Navigate to login page
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    },

    apply_filters: async () => {
      // This should be handled by the component
      // We just mark it as needing implementation
      console.log('Apply filters action - should be handled by component');
    },

    contact_support: async () => {
      // Open support page or email
      if (typeof window !== 'undefined') {
        window.open('/support', '_blank');
      }
    },

    dismiss: async () => {
      // No action needed - error will be dismissed
    },
  };
}

// ============================================================================
// Global Error Handler for React Query
// ============================================================================

/**
 * Global error handler for React Query
 *
 * Use this as the onError callback in your QueryClient configuration
 * for centralized graph error handling.
 *
 * @param error - The error that occurred
 *
 * @example
 * ```ts
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: {
 *       onError: graphQueryErrorHandler,
 *     },
 *     mutations: {
 *       onError: graphQueryErrorHandler,
 *     },
 *   },
 * });
 * ```
 */
export function graphQueryErrorHandler(error: unknown): void {
  const graphError = handleApiError(error);

  // Log the error
  logGraphError(graphError, { operation: 'query' });

  // Track metrics
  trackErrorMetrics(graphError, { operation: 'query' });

  // Log to console in development
  if (import.meta.env.DEV) {
    console.error('[Graph Query Error]', {
      code: graphError.code,
      message: graphError.message,
      retryable: graphError.retryable,
    });
  }
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook for getting error display information
 *
 * @param error - The error to get display info for
 * @returns Display-ready error information
 *
 * @example
 * ```tsx
 * function ErrorMessage({ error }: { error: Error }) {
 *   const { title, message, actions, isRetryable } = useErrorDisplay(error);
 *
 *   return (
 *     <Alert variant="error">
 *       <h4>{title}</h4>
 *       <p>{message}</p>
 *       {isRetryable && <Button onClick={actions[0].action}>Retry</Button>}
 *     </Alert>
 *   );
 * }
 * ```
 */
export function useErrorDisplay(error: GraphError | Error | null | undefined): {
  title: string;
  message: string;
  code: GraphErrorCode | 'UNKNOWN_ERROR';
  actions: RecoveryAction[];
  isRetryable: boolean;
  isAuthError: boolean;
} {
  return useMemo(() => {
    if (!error) {
      return {
        title: '',
        message: '',
        code: 'UNKNOWN_ERROR' as const,
        actions: [],
        isRetryable: false,
        isAuthError: false,
      };
    }

    const graphError = error instanceof GraphError
      ? error
      : handleApiError(error);

    return {
      title: getErrorTitle(graphError),
      message: getErrorMessage(graphError),
      code: graphError.code,
      actions: getErrorRecoveryActions(graphError),
      isRetryable: isRetryableError(graphError),
      isAuthError: isAuthError(graphError),
    };
  }, [error]);
}

/**
 * Hook for tracking error state with automatic reset
 *
 * @param resetAfterMs - Time in ms after which error resets automatically (0 to disable)
 * @returns Error state and setter
 *
 * @example
 * ```tsx
 * function GraphOperation() {
 *   const [error, setError, clearError] = useErrorState(5000);
 *
 *   const handleClick = async () => {
 *     try {
 *       await performOperation();
 *     } catch (e) {
 *       setError(e);
 *     }
 *   };
 *
 *   return (
 *     <>
 *       {error && <ErrorBanner error={error} onClose={clearError} />}
 *       <Button onClick={handleClick}>Perform Operation</Button>
 *     </>
 *   );
 * }
 * ```
 */
export function useErrorState(
  resetAfterMs: number = 0
): [GraphError | null, (error: unknown) => void, () => void] {
  const [error, setErrorState] = useState<GraphError | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setError = useCallback(
    (error: unknown) => {
      const graphError = handleApiError(error);
      setErrorState(graphError);

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set auto-reset timer if enabled
      if (resetAfterMs > 0) {
        timerRef.current = setTimeout(() => {
          setErrorState(null);
        }, resetAfterMs);
      }
    },
    [resetAfterMs]
  );

  const clearError = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setErrorState(null);
  }, []);

  return [error, setError, clearError];
}

// ============================================================================
// Export
// ============================================================================

export default useGraphErrorHandling;
