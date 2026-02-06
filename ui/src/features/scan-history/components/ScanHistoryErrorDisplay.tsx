/**
 * ScanHistoryErrorDisplay Component
 * Error display components for scan history errors
 * @module features/scan-history/components/ScanHistoryErrorDisplay
 */

import { Button, Alert } from '@/shared';
import { cn } from '@/shared/utils';
import {
  ScanHistoryError,
  handleApiError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  isRetryableError,
  getErrorType,
  type ScanHistoryErrorType,
  type RecoveryAction,
} from '../utils/errorHandler';

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

function WifiOffIcon({ className }: { className?: string }): JSX.Element {
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
        d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 3l18 18"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }): JSX.Element {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }): JSX.Element {
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
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }): JSX.Element {
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
        d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }): JSX.Element {
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
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

// ============================================================================
// Error Type Config
// ============================================================================

interface ErrorTypeConfig {
  icon: React.ComponentType<{ className?: string }>;
  iconBgColor: string;
  iconColor: string;
  title: string;
  message: string;
}

const ERROR_TYPE_CONFIGS: Record<ScanHistoryErrorType, ErrorTypeConfig> = {
  network: {
    icon: WifiOffIcon,
    iconBgColor: 'bg-orange-100',
    iconColor: 'text-orange-600',
    title: 'Connection Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
  },
  timeout: {
    icon: ClockIcon,
    iconBgColor: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    title: 'Request Timeout',
    message: 'The request took too long to complete. Please try again.',
  },
  not_found: {
    icon: SearchIcon,
    iconBgColor: 'bg-gray-100',
    iconColor: 'text-gray-600',
    title: 'Not Found',
    message: 'The scan you are looking for could not be found. It may have been deleted or moved.',
  },
  unauthorized: {
    icon: LockIcon,
    iconBgColor: 'bg-blue-100',
    iconColor: 'text-blue-600',
    title: 'Session Expired',
    message: 'Your session has expired. Please sign in again to continue.',
  },
  forbidden: {
    icon: LockIcon,
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Access Denied',
    message: 'You do not have permission to access this scan history.',
  },
  server: {
    icon: ServerIcon,
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Server Error',
    message: 'An error occurred on the server. Our team has been notified and is working on it.',
  },
  validation: {
    icon: ExclamationIcon,
    iconBgColor: 'bg-yellow-100',
    iconColor: 'text-yellow-600',
    title: 'Invalid Request',
    message: 'The request could not be processed. Please check your input and try again.',
  },
  unknown: {
    icon: ExclamationIcon,
    iconBgColor: 'bg-red-100',
    iconColor: 'text-red-600',
    title: 'Unexpected Error',
    message: 'An unexpected error occurred. Please try again or contact support if the problem persists.',
  },
};

// ============================================================================
// Main Error Display Component
// ============================================================================

export interface ScanHistoryErrorDisplayProps {
  /** Error object or message */
  error: Error | string | ScanHistoryError;
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
 * Functional component for displaying scan history errors
 * Integrates with centralized error handling for consistent error messages
 */
export function ScanHistoryErrorDisplay({
  error,
  onRetry,
  onNavigateBack,
  className,
  compact = false,
}: ScanHistoryErrorDisplayProps): JSX.Element {
  // Normalize to ScanHistoryError for consistent handling
  const scanError: ScanHistoryError = (() => {
    if (error instanceof ScanHistoryError) {
      return error;
    }
    if (typeof error === 'string') {
      return new ScanHistoryError(error, 'UNKNOWN_ERROR');
    }
    return handleApiError(error);
  })();

  const errorType = getErrorType(scanError);
  const config = ERROR_TYPE_CONFIGS[errorType];
  const IconComponent = config.icon;
  const errorTitle = getErrorTitle(scanError);
  const errorMessage = getErrorMessage(scanError);
  const recoveryActions = getErrorRecoveryActions(scanError);
  const canRetry = isRetryableError(scanError);

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
        <IconComponent className={cn('h-5 w-5 flex-shrink-0', config.iconColor)} />
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
        <div className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full mb-4',
          config.iconBgColor
        )}>
          <IconComponent className={cn('h-7 w-7', config.iconColor)} />
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {errorTitle}
        </h3>

        <p className="text-sm text-gray-500 mb-4">
          {errorMessage}
        </p>

        {/* Show error code for debugging */}
        <p className="text-xs text-gray-400 mb-4">
          Error code: {scanError.code}
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
              leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
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

export interface ScanHistoryInlineErrorProps {
  /** The error to display */
  error: Error | ScanHistoryError | string | null | undefined;
  /** Callback to dismiss the error */
  onDismiss?: () => void;
  /** Callback to retry */
  onRetry?: () => void;
  /** Additional CSS class names */
  className?: string;
}

/**
 * Inline error alert for displaying errors in forms or panels
 */
export function ScanHistoryInlineError({
  error,
  onDismiss,
  onRetry,
  className,
}: ScanHistoryInlineErrorProps): JSX.Element | null {
  if (!error) {
    return null;
  }

  const errorMessage = typeof error === 'string'
    ? error
    : getErrorMessage(error);

  const canRetry = error instanceof ScanHistoryError
    ? isRetryableError(error)
    : error instanceof Error
      ? isRetryableError(handleApiError(error))
      : false;

  return (
    <Alert variant="error" className={cn('mt-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-sm">{errorMessage}</p>
          {canRetry && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-1 text-xs text-red-700 underline hover:text-red-900"
            >
              Try again
            </button>
          )}
        </div>
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

// ============================================================================
// Error by Type Components
// ============================================================================

interface TypedErrorDisplayProps {
  onRetry?: () => void;
  onNavigateBack?: () => void;
  className?: string;
}

/**
 * Network error display
 */
export function NetworkErrorDisplay({
  onRetry,
  className,
}: TypedErrorDisplayProps): JSX.Element {
  const config = ERROR_TYPE_CONFIGS.network;
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
      role="alert"
    >
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-full mb-4', config.iconBgColor)}>
        <IconComponent className={cn('h-7 w-7', config.iconColor)} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h3>
      <p className="text-sm text-gray-500 mb-4">{config.message}</p>
      {onRetry && (
        <Button
          variant="primary"
          leftIcon={<RefreshIcon className="h-4 w-4" />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

/**
 * Not found error display
 */
export function NotFoundErrorDisplay({
  onNavigateBack,
  className,
}: TypedErrorDisplayProps): JSX.Element {
  const config = ERROR_TYPE_CONFIGS.not_found;
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
      role="alert"
    >
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-full mb-4', config.iconBgColor)}>
        <IconComponent className={cn('h-7 w-7', config.iconColor)} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h3>
      <p className="text-sm text-gray-500 mb-4">{config.message}</p>
      <Button
        variant="outline"
        leftIcon={<ArrowLeftIcon className="h-4 w-4" />}
        onClick={onNavigateBack ?? (() => window.history.back())}
      >
        Go Back
      </Button>
    </div>
  );
}

/**
 * Server error display
 */
export function ServerErrorDisplay({
  onRetry,
  className,
}: TypedErrorDisplayProps): JSX.Element {
  const config = ERROR_TYPE_CONFIGS.server;
  const IconComponent = config.icon;

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center p-8',
        className
      )}
      role="alert"
    >
      <div className={cn('flex h-14 w-14 items-center justify-center rounded-full mb-4', config.iconBgColor)}>
        <IconComponent className={cn('h-7 w-7', config.iconColor)} />
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{config.title}</h3>
      <p className="text-sm text-gray-500 mb-4">{config.message}</p>
      {onRetry && (
        <Button
          variant="primary"
          leftIcon={<RefreshIcon className="h-4 w-4" />}
          onClick={onRetry}
        >
          Try Again
        </Button>
      )}
    </div>
  );
}

export default ScanHistoryErrorDisplay;

// Re-export error types for convenience
export type { ScanHistoryError, RecoveryAction } from '../utils/errorHandler';
