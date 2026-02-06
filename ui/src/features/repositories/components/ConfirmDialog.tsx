/**
 * Confirm Dialog Component
 * Reusable confirmation dialog for destructive actions
 * @module features/repositories/components/ConfirmDialog
 */

import { useCallback, useRef, useEffect } from 'react';
import { Button } from '@/shared/components';

// ============================================================================
// Types
// ============================================================================

export interface ConfirmDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Dialog title */
  title: string;
  /** Dialog message/description */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: 'primary' | 'danger';
  /** Is the confirm action pending */
  isLoading?: boolean;
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled/closed */
  onCancel: () => void;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Confirmation dialog for destructive actions
 *
 * @example
 * <ConfirmDialog
 *   isOpen={isOpen}
 *   title="Delete Repository"
 *   message="Are you sure you want to delete this repository? This action cannot be undone."
 *   confirmText="Delete"
 *   confirmVariant="danger"
 *   isLoading={isDeleting}
 *   onConfirm={handleDelete}
 *   onCancel={() => setIsOpen(false)}
 * />
 */
export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmVariant = 'danger',
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap and keyboard handling
  useEffect(() => {
    if (isOpen) {
      // Focus cancel button on open
      cancelButtonRef.current?.focus();

      // Handle escape key
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !isLoading) {
          onCancel();
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
    return undefined;
  }, [isOpen, isLoading, onCancel]);

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
    return undefined;
  }, [isOpen]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isLoading) {
        onCancel();
      }
    },
    [isLoading, onCancel]
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 transition-opacity"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Dialog Panel */}
      <div className="relative z-10 w-full max-w-md transform overflow-hidden rounded-xl bg-white p-6 shadow-2xl transition-all">
        {/* Icon */}
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
          <WarningIcon className="h-6 w-6 text-red-600" />
        </div>

        {/* Content */}
        <div className="mt-4 text-center">
          <h3
            id="confirm-dialog-title"
            className="text-lg font-semibold text-gray-900"
          >
            {title}
          </h3>
          <p
            id="confirm-dialog-description"
            className="mt-2 text-sm text-gray-500"
          >
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <Button
            ref={cancelButtonRef}
            variant="outline"
            onClick={onCancel}
            disabled={isLoading}
            fullWidth
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            loading={isLoading}
            fullWidth
          >
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default ConfirmDialog;
