/**
 * GraphErrorBoundary Component
 * Error boundary for catching and displaying React Flow errors
 * @module features/graph/components/GraphErrorBoundary
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Alert } from '@/shared';
import { cn } from '@/shared/utils';
import {
  GraphError,
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  isRetryableError,
  type RecoveryAction,
} from '../utils/errorHandler';
import { logGraphError } from '../utils/errorLogging';

// ============================================================================
// Types
// ============================================================================

export interface GraphErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Fallback component to render on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Additional CSS class names */
  className?: string;
}

interface GraphErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

// ============================================================================
// Icons
// ============================================================================

function ExclamationIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
      />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99"
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Error boundary component that catches errors in the graph visualization
 * and displays a user-friendly error message with retry option
 */
export class GraphErrorBoundary extends Component<
  GraphErrorBoundaryProps,
  GraphErrorBoundaryState
> {
  constructor(props: GraphErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<GraphErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error using centralized error logging
    logGraphError(error, {
      operation: 'render',
      component: 'GraphErrorBoundary',
      metadata: {
        componentStack: errorInfo.componentStack,
      },
    });

    // Call onError callback if provided
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call onRetry callback if provided
    this.props.onRetry?.();
  };

  render(): ReactNode {
    const { children, fallback, className } = this.props;
    const { hasError, error } = this.state;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <GraphErrorFallback
          error={error}
          onRetry={this.handleRetry}
          className={className}
        />
      );
    }

    return children;
  }
}

// ============================================================================
// Default Error Fallback
// ============================================================================

interface GraphErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  className?: string;
}

/**
 * Default error fallback UI for the error boundary
 * Now integrates with the centralized error handling system
 */
function GraphErrorFallback({
  error,
  onRetry,
  className,
}: GraphErrorFallbackProps): JSX.Element {
  const isDevelopment = import.meta.env.DEV;

  // Convert to GraphError for consistent handling
  const graphError: GraphError | null = error
    ? (error instanceof GraphError ? error : handleApiError(error))
    : null;

  // Get user-friendly message and title
  const errorTitle = graphError ? getErrorTitle(graphError) : 'Error';
  const errorMessage = graphError
    ? getErrorMessage(graphError)
    : 'An unexpected error occurred';

  // Get recovery actions
  const recoveryActions: RecoveryAction[] = graphError
    ? getErrorRecoveryActions(graphError)
    : [];

  // Check if retryable
  const canRetry = graphError ? isRetryableError(graphError) : false;

  // Find primary action
  const primaryAction = recoveryActions.find((a) => a.primary);
  const secondaryActions = recoveryActions.filter((a) => !a.primary);

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-gray-50 p-8',
        className
      )}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center justify-center text-center max-w-lg">
        {/* Error Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-6">
          <ExclamationIcon className="h-8 w-8 text-red-600" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {errorTitle}
        </h3>

        {/* User-friendly Message */}
        <p className="text-sm text-gray-500 mb-4">
          {errorMessage}
        </p>

        {/* Error Alert with code (if GraphError) */}
        {graphError && (
          <Alert variant="error" className="mb-6 w-full text-left">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Error Code: {graphError.code}</p>
              {graphError.retryable && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  Retryable
                </span>
              )}
            </div>
            {graphError.details && isDevelopment && (
              <p className="mt-1 text-xs text-gray-500">
                Details: {JSON.stringify(graphError.details)}
              </p>
            )}
          </Alert>
        )}

        {/* Development Stack Trace */}
        {isDevelopment && error?.stack && (
          <details className="mb-6 w-full text-left">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              View Stack Trace (Development)
            </summary>
            <pre className="mt-2 p-3 bg-gray-800 text-gray-100 text-xs rounded-lg overflow-auto max-h-40">
              {error.stack}
            </pre>
          </details>
        )}

        {/* Recovery Actions */}
        <div className="flex gap-3">
          {/* Primary action or retry */}
          {(canRetry || primaryAction) && onRetry && (
            <Button
              variant="primary"
              leftIcon={<RefreshIcon className="h-4 w-4" />}
              onClick={onRetry}
            >
              {primaryAction?.label ?? 'Try Again'}
            </Button>
          )}

          {/* Secondary actions */}
          {secondaryActions.slice(0, 1).map((action) => (
            <Button
              key={action.type}
              variant="outline"
              onClick={() => {
                if (action.type === 'refresh') {
                  window.location.reload();
                } else if (action.type === 'navigate') {
                  window.history.back();
                } else if (action.type === 'contact_support') {
                  window.open('/support', '_blank');
                }
              }}
            >
              {action.label}
            </Button>
          ))}

          {/* Fallback reload button */}
          {!canRetry && !primaryAction && (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          )}
        </div>

        {/* Help text */}
        <p className="mt-6 text-xs text-gray-400">
          If this problem persists, please contact support.
          {graphError && ` Error code: ${graphError.code}`}
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Functional Error Display (for non-boundary errors)
// ============================================================================

export interface GraphErrorDisplayProps {
  /** Error object or message */
  error: Error | string | GraphError;
  /** Retry callback */
  onRetry?: () => void;
  /** Navigate back callback */
  onNavigateBack?: () => void;
  /** Additional CSS class names */
  className?: string;
  /** Whether to show a compact version */
  compact?: boolean;
}

/**
 * Functional component for displaying graph errors (used outside error boundary)
 * Integrates with centralized error handling for consistent error messages
 */
export function GraphErrorDisplay({
  error,
  onRetry,
  onNavigateBack,
  className,
  compact = false,
}: GraphErrorDisplayProps): JSX.Element {
  // Normalize to GraphError for consistent handling
  const graphError: GraphError = (() => {
    if (error instanceof GraphError) {
      return error;
    }
    if (typeof error === 'string') {
      return new GraphError(error, 'UNKNOWN_ERROR');
    }
    return handleApiError(error);
  })();

  const errorTitle = getErrorTitle(graphError);
  const errorMessage = getErrorMessage(graphError);
  const recoveryActions = getErrorRecoveryActions(graphError);
  const canRetry = isRetryableError(graphError);

  // Compact version for inline display
  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg',
          className
        )}
        role="alert"
      >
        <ExclamationIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800">{errorTitle}</p>
          <p className="text-xs text-red-600 truncate">{errorMessage}</p>
        </div>
        {canRetry && onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
          >
            Retry
          </Button>
        )}
      </div>
    );
  }

  // Full version
  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center bg-gray-50 p-8',
        className
      )}
      role="alert"
    >
      <div className="flex flex-col items-center justify-center text-center max-w-md">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
          <ExclamationIcon className="h-7 w-7 text-red-600" />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {errorTitle}
        </h3>

        <p className="text-sm text-gray-500 mb-4">
          {errorMessage}
        </p>

        {/* Show error code for debugging */}
        <p className="text-xs text-gray-400 mb-4">
          Error code: {graphError.code}
        </p>

        <div className="flex gap-3">
          {canRetry && onRetry && (
            <Button
              variant="primary"
              leftIcon={<RefreshIcon className="h-4 w-4" />}
              onClick={onRetry}
            >
              Retry
            </Button>
          )}

          {onNavigateBack && (
            <Button
              variant="outline"
              onClick={onNavigateBack}
            >
              Go Back
            </Button>
          )}

          {!canRetry && !onRetry && !onNavigateBack && (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline Error Alert (for use in forms/panels)
// ============================================================================

export interface GraphInlineErrorProps {
  /** The error to display */
  error: Error | GraphError | string | null | undefined;
  /** Callback to dismiss the error */
  onDismiss?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Inline error alert for displaying errors in forms or panels
 */
export function GraphInlineError({
  error,
  onDismiss,
  className,
}: GraphInlineErrorProps): JSX.Element | null {
  if (!error) {
    return null;
  }

  const errorMessage = typeof error === 'string'
    ? error
    : getErrorMessage(error);

  return (
    <Alert variant="error" className={cn('mt-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm">{errorMessage}</p>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-red-500 hover:text-red-700 flex-shrink-0"
            aria-label="Dismiss error"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </Alert>
  );
}

export default GraphErrorBoundary;

// Re-export error types for convenience
export type { GraphError, RecoveryAction } from '../utils/errorHandler';
