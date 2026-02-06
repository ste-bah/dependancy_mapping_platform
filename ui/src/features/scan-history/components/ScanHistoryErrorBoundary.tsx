/**
 * ScanHistoryErrorBoundary Component
 * Error boundary for catching and displaying React errors in scan history
 * @module features/scan-history/components/ScanHistoryErrorBoundary
 */

import { Component, type ReactNode, type ErrorInfo } from 'react';
import { Button, Alert } from '@/shared';
import { cn } from '@/shared/utils';
import {
  ScanHistoryError,
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  isRetryableError,
  type RecoveryAction,
} from '../utils/errorHandler';
import { logScanHistoryError } from '../utils/errorLogging';

// ============================================================================
// Types
// ============================================================================

export interface ScanHistoryErrorBoundaryProps {
  /** Child components to render */
  children: ReactNode;
  /** Fallback component to render on error */
  fallback?: ReactNode;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Callback for retry action */
  onRetry?: () => void;
  /** Callback for navigate back action */
  onNavigateBack?: () => void;
  /** Additional CSS class names */
  className?: string;
}

interface ScanHistoryErrorBoundaryState {
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

function ArrowLeftIcon({ className }: { className?: string }): JSX.Element {
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
        d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
      />
    </svg>
  );
}

// ============================================================================
// Component
// ============================================================================

/**
 * Error boundary component that catches errors in the scan history feature
 * and displays a user-friendly error message with retry option
 */
export class ScanHistoryErrorBoundary extends Component<
  ScanHistoryErrorBoundaryProps,
  ScanHistoryErrorBoundaryState
> {
  constructor(props: ScanHistoryErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ScanHistoryErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    // Log error using centralized error logging
    logScanHistoryError(error, {
      operation: 'render',
      component: 'ScanHistoryErrorBoundary',
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

  handleNavigateBack = (): void => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call onNavigateBack callback or default to browser back
    if (this.props.onNavigateBack) {
      this.props.onNavigateBack();
    } else {
      window.history.back();
    }
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
        <ScanHistoryErrorFallback
          error={error}
          onRetry={this.handleRetry}
          onNavigateBack={this.handleNavigateBack}
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

interface ScanHistoryErrorFallbackProps {
  error: Error | null;
  onRetry?: () => void;
  onNavigateBack?: () => void;
  className?: string;
}

/**
 * Default error fallback UI for the error boundary
 * Integrates with the centralized error handling system
 */
function ScanHistoryErrorFallback({
  error,
  onRetry,
  onNavigateBack,
  className,
}: ScanHistoryErrorFallbackProps): JSX.Element {
  const isDevelopment = import.meta.env.DEV;

  // Convert to ScanHistoryError for consistent handling
  const scanError: ScanHistoryError | null = error
    ? (error instanceof ScanHistoryError ? error : handleApiError(error))
    : null;

  // Get user-friendly message and title
  const errorTitle = scanError ? getErrorTitle(scanError) : 'Error';
  const errorMessage = scanError
    ? getErrorMessage(scanError)
    : 'An unexpected error occurred';

  // Get recovery actions
  const recoveryActions: RecoveryAction[] = scanError
    ? getErrorRecoveryActions(scanError)
    : [];

  // Check if retryable
  const canRetry = scanError ? isRetryableError(scanError) : false;

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

        {/* Error Alert with code (if ScanHistoryError) */}
        {scanError && (
          <Alert variant="error" className="mb-6 w-full text-left">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Error Code: {scanError.code}</p>
              {scanError.retryable && (
                <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                  Retryable
                </span>
              )}
            </div>
            {scanError.details && isDevelopment && (
              <p className="mt-1 text-xs text-gray-500">
                Details: {JSON.stringify(scanError.details)}
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

          {/* Navigate back */}
          {onNavigateBack && (
            <Button
              variant="outline"
              leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
              onClick={onNavigateBack}
            >
              Go Back
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
                } else if (action.type === 'navigate_back') {
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
          {!canRetry && !primaryAction && !onNavigateBack && (
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
          {scanError && ` Error code: ${scanError.code}`}
        </p>
      </div>
    </div>
  );
}

export default ScanHistoryErrorBoundary;
