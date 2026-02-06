/**
 * ErrorState Component
 * Error display with retry button
 * @module pages/dashboard/components/ErrorState
 */

import { Button } from '@/shared';
import { ExclamationIcon, RefreshIcon } from './icons';

export interface ErrorStateProps {
  /** Error message to display */
  message: string;
  /** Optional retry callback */
  onRetry?: () => void;
}

/**
 * ErrorState displays an error message with optional retry action
 */
export function ErrorState({ message, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <ExclamationIcon className="h-6 w-6 text-red-600" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-gray-900">
        Failed to load data
      </h3>
      <p className="mt-1 text-sm text-gray-500">{message}</p>
      {onRetry && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          leftIcon={<RefreshIcon className="h-4 w-4" />}
          onClick={onRetry}
        >
          Try again
        </Button>
      )}
    </div>
  );
}
