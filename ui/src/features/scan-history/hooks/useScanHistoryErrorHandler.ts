/**
 * useScanHistoryErrorHandler Hook
 * Error handling hook for scan history operations
 * @module features/scan-history/hooks/useScanHistoryErrorHandler
 */

import { useCallback, useState, useRef } from 'react';
import {
  ScanHistoryError,
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  isRetryableError,
  isAuthError,
  isNotFoundError,
  getErrorType,
  type ScanHistoryErrorType,
  type ScanHistoryErrorCode,
} from '../utils/errorHandler';
import { logScanHistoryError, trackErrorMetrics } from '../utils/errorLogging';

// ============================================================================
// Types
// ============================================================================

/**
 * Toast notification configuration
 */
export interface ToastConfig {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Error handler options
 */
export interface UseScanHistoryErrorHandlerOptions {
  /** Context for error logging */
  context?: {
    component?: string;
    operation?: string;
  };
  /** Callback when authentication error occurs */
  onAuthError?: () => void;
  /** Callback to show toast notification */
  onToast?: (toast: ToastConfig) => void;
  /** Callback when navigating back is needed */
  onNavigateBack?: () => void;
  /** Maximum retry attempts for automatic retry */
  maxRetries?: number;
  /** Delay between retries in ms */
  retryDelay?: number;
  /** Whether to automatically retry on retryable errors */
  autoRetry?: boolean;
}

/**
 * Parsed error information
 */
export interface ParsedError {
  /** Original error */
  error: ScanHistoryError;
  /** Error type for UI display */
  type: ScanHistoryErrorType;
  /** Error code */
  code: ScanHistoryErrorCode;
  /** User-friendly title */
  title: string;
  /** User-friendly message */
  message: string;
  /** Whether the error is retryable */
  retryable: boolean;
  /** Whether the error requires authentication */
  requiresAuth: boolean;
  /** Whether the error is a not found error */
  isNotFound: boolean;
}

/**
 * Return type for useScanHistoryErrorHandler hook
 */
export interface UseScanHistoryErrorHandlerReturn {
  /** Parse an error into user-friendly format */
  parseError: (error: unknown) => ParsedError;
  /** Handle an error with appropriate actions */
  handleError: (error: unknown, options?: HandleErrorOptions) => void;
  /** Execute an async operation with automatic error handling */
  withErrorHandler: <T>(
    operation: () => Promise<T>,
    options?: WithErrorHandlerOptions<T>
  ) => Promise<T | undefined>;
  /** Current error state */
  currentError: ScanHistoryError | null;
  /** Clear current error */
  clearError: () => void;
  /** Whether currently retrying */
  isRetrying: boolean;
  /** Current retry count */
  retryCount: number;
}

interface HandleErrorOptions {
  /** Override context for this specific error */
  context?: {
    component?: string;
    operation?: string;
  };
  /** Whether to show a toast notification */
  showToast?: boolean;
  /** Whether to throw the error after handling */
  rethrow?: boolean;
}

interface WithErrorHandlerOptions<T> {
  /** Override context for this operation */
  context?: {
    component?: string;
    operation?: string;
  };
  /** Whether to show a toast on error */
  showToast?: boolean;
  /** Fallback value on error */
  fallback?: T;
  /** Callback on error */
  onError?: (error: ScanHistoryError) => void;
  /** Callback on success */
  onSuccess?: (result: T) => void;
  /** Whether to retry on failure */
  retry?: boolean;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Error handling hook for scan history operations
 *
 * Provides:
 * - Error parsing into user-friendly messages
 * - Appropriate handling for different error types (401/403/404/500)
 * - Toast notifications for recoverable errors
 * - Automatic retry logic for transient failures
 *
 * @example
 * ```tsx
 * const { handleError, parseError, withErrorHandler } = useScanHistoryErrorHandler({
 *   context: { component: 'ScanHistoryPage' },
 *   onAuthError: () => navigate('/login'),
 *   onToast: showToast,
 * });
 *
 * // Parse errors for display
 * const { title, message, retryable } = parseError(error);
 *
 * // Handle errors with automatic actions
 * try {
 *   await fetchScanHistory();
 * } catch (error) {
 *   handleError(error, { showToast: true });
 * }
 *
 * // Or use the wrapper for cleaner async operations
 * const result = await withErrorHandler(
 *   () => fetchScanHistory(),
 *   { showToast: true, retry: true }
 * );
 * ```
 */
export function useScanHistoryErrorHandler(
  options: UseScanHistoryErrorHandlerOptions = {}
): UseScanHistoryErrorHandlerReturn {
  const {
    context: defaultContext,
    onAuthError,
    onToast,
    onNavigateBack,
    maxRetries = 3,
    retryDelay = 1000,
    autoRetry = false,
  } = options;

  const [currentError, setCurrentError] = useState<ScanHistoryError | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const toastIdCounter = useRef(0);

  /**
   * Parse an error into user-friendly format
   */
  const parseError = useCallback((error: unknown): ParsedError => {
    const scanError = error instanceof ScanHistoryError
      ? error
      : handleApiError(error);

    return {
      error: scanError,
      type: getErrorType(scanError),
      code: scanError.code,
      title: getErrorTitle(scanError),
      message: getErrorMessage(scanError),
      retryable: isRetryableError(scanError),
      requiresAuth: isAuthError(scanError),
      isNotFound: isNotFoundError(scanError),
    };
  }, []);

  /**
   * Generate a unique toast ID
   */
  const generateToastId = useCallback((): string => {
    toastIdCounter.current += 1;
    return `scan-history-error-${toastIdCounter.current}`;
  }, []);

  /**
   * Show a toast notification for an error
   */
  const showErrorToast = useCallback((parsed: ParsedError, retryFn?: () => void): void => {
    if (!onToast) return;

    const toast: ToastConfig = {
      id: generateToastId(),
      type: parsed.retryable ? 'warning' : 'error',
      title: parsed.title,
      message: parsed.message,
      duration: parsed.retryable ? 5000 : undefined,
    };

    // Add retry action for retryable errors
    if (parsed.retryable && retryFn) {
      toast.action = {
        label: 'Retry',
        onClick: retryFn,
      };
    }

    onToast(toast);
  }, [onToast, generateToastId]);

  /**
   * Handle authentication errors
   */
  const handleAuthError = useCallback((parsed: ParsedError): void => {
    if (parsed.requiresAuth && onAuthError) {
      onAuthError();
    }
  }, [onAuthError]);

  /**
   * Handle not found errors
   */
  const handleNotFoundError = useCallback((parsed: ParsedError): void => {
    if (parsed.isNotFound && onNavigateBack) {
      // Show toast then navigate back
      showErrorToast(parsed);
      setTimeout(() => {
        onNavigateBack();
      }, 2000);
    }
  }, [onNavigateBack, showErrorToast]);

  /**
   * Handle an error with appropriate actions
   */
  const handleError = useCallback((
    error: unknown,
    handleOptions: HandleErrorOptions = {}
  ): void => {
    const { context, showToast = true, rethrow = false } = handleOptions;
    const parsed = parseError(error);
    const mergedContext = { ...defaultContext, ...context };

    // Set current error state
    setCurrentError(parsed.error);

    // Log error
    logScanHistoryError(parsed.error, mergedContext);
    trackErrorMetrics(parsed.error, mergedContext);

    // Handle based on error type
    if (parsed.requiresAuth) {
      handleAuthError(parsed);
    } else if (parsed.isNotFound) {
      handleNotFoundError(parsed);
    } else if (showToast) {
      showErrorToast(parsed);
    }

    // Rethrow if requested
    if (rethrow) {
      throw parsed.error;
    }
  }, [parseError, defaultContext, handleAuthError, handleNotFoundError, showErrorToast]);

  /**
   * Clear current error
   */
  const clearError = useCallback((): void => {
    setCurrentError(null);
    setRetryCount(0);
  }, []);

  /**
   * Execute with retry logic
   */
  const executeWithRetry = useCallback(async <T>(
    operation: () => Promise<T>,
    attemptCount: number
  ): Promise<T> => {
    try {
      return await operation();
    } catch (error) {
      const parsed = parseError(error);

      if (parsed.retryable && attemptCount < maxRetries) {
        setIsRetrying(true);
        setRetryCount(attemptCount + 1);

        // Exponential backoff
        const delay = retryDelay * Math.pow(2, attemptCount);
        await new Promise(resolve => setTimeout(resolve, delay));

        return executeWithRetry(operation, attemptCount + 1);
      }

      throw error;
    }
  }, [parseError, maxRetries, retryDelay]);

  /**
   * Execute an async operation with automatic error handling
   */
  const withErrorHandler = useCallback(async <T>(
    operation: () => Promise<T>,
    wrapperOptions: WithErrorHandlerOptions<T> = {}
  ): Promise<T | undefined> => {
    const {
      context,
      showToast = true,
      fallback,
      onError,
      onSuccess,
      retry = autoRetry,
    } = wrapperOptions;

    clearError();
    setIsRetrying(false);

    try {
      const result = retry
        ? await executeWithRetry(operation, 0)
        : await operation();

      setIsRetrying(false);
      onSuccess?.(result);
      return result;
    } catch (error) {
      setIsRetrying(false);
      const parsed = parseError(error);

      // Set current error
      setCurrentError(parsed.error);

      // Log and track
      logScanHistoryError(parsed.error, { ...defaultContext, ...context });
      trackErrorMetrics(parsed.error, { ...defaultContext, ...context });

      // Handle based on error type
      if (parsed.requiresAuth) {
        handleAuthError(parsed);
      } else if (showToast) {
        showErrorToast(parsed, retry ? () => withErrorHandler(operation, wrapperOptions) : undefined);
      }

      // Call error callback
      onError?.(parsed.error);

      // Return fallback if provided
      return fallback;
    }
  }, [
    autoRetry,
    clearError,
    executeWithRetry,
    parseError,
    defaultContext,
    handleAuthError,
    showErrorToast,
  ]);

  return {
    parseError,
    handleError,
    withErrorHandler,
    currentError,
    clearError,
    isRetrying,
    retryCount,
  };
}

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Simple hook to track error state
 */
export function useScanHistoryErrorState() {
  const [error, setError] = useState<ScanHistoryError | null>(null);

  const setErrorFromUnknown = useCallback((err: unknown): void => {
    if (err instanceof ScanHistoryError) {
      setError(err);
    } else {
      setError(handleApiError(err));
    }
  }, []);

  const clear = useCallback((): void => {
    setError(null);
  }, []);

  return {
    error,
    setError: setErrorFromUnknown,
    clearError: clear,
    hasError: error !== null,
    parsed: error ? {
      type: getErrorType(error),
      title: getErrorTitle(error),
      message: getErrorMessage(error),
      retryable: isRetryableError(error),
    } : null,
  };
}

export default useScanHistoryErrorHandler;
