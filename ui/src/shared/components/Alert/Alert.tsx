/**
 * Alert Component
 * Contextual feedback messages
 * @module shared/components/Alert
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn, createVariants } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

export interface AlertProps extends HTMLAttributes<HTMLDivElement> {
  /** Alert variant */
  variant?: AlertVariant;
  /** Alert title */
  title?: string;
  /** Alert content */
  children: ReactNode;
  /** Icon to display */
  icon?: ReactNode;
  /** Action element (button, link) */
  action?: ReactNode;
  /** Whether the alert can be dismissed */
  dismissible?: boolean;
  /** Callback when dismissed */
  onDismiss?: () => void;
}

// ============================================================================
// Icons
// ============================================================================

const AlertIcons: Record<AlertVariant, JSX.Element> = {
  info: (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
        clipRule="evenodd"
      />
    </svg>
  ),
  success: (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  ),
  warning: (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  ),
  error: (
    <svg
      className="h-5 w-5"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
        clipRule="evenodd"
      />
    </svg>
  ),
};

// ============================================================================
// Variants
// ============================================================================

const alertVariants = createVariants({
  base: 'relative rounded-lg border p-4',
  variants: {
    variant: {
      info: 'border-primary-200 bg-primary-50 text-primary-800',
      success: 'border-success-500/30 bg-success-50 text-green-800',
      warning: 'border-warning-500/30 bg-warning-50 text-amber-800',
      error: 'border-error-500/30 bg-error-50 text-red-800',
    },
  },
  defaultVariants: {
    variant: 'info',
  },
});

const iconColorStyles: Record<AlertVariant, string> = {
  info: 'text-primary-500',
  success: 'text-success-500',
  warning: 'text-warning-500',
  error: 'text-error-500',
};

// ============================================================================
// Alert Component
// ============================================================================

/**
 * Alert component for contextual feedback
 *
 * @example
 * // Info alert
 * <Alert variant="info" title="Information">
 *   This is an informational message.
 * </Alert>
 *
 * @example
 * // Success with action
 * <Alert
 *   variant="success"
 *   title="Success!"
 *   action={<button>Undo</button>}
 * >
 *   Your changes have been saved.
 * </Alert>
 *
 * @example
 * // Dismissible error
 * <Alert
 *   variant="error"
 *   title="Error"
 *   dismissible
 *   onDismiss={() => setShowError(false)}
 * >
 *   Something went wrong. Please try again.
 * </Alert>
 */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(
  function Alert(
    {
      className,
      variant = 'info',
      title,
      children,
      icon,
      action,
      dismissible = false,
      onDismiss,
      ...props
    },
    ref
  ) {
    const displayIcon = icon ?? AlertIcons[variant];

    return (
      <div
        ref={ref}
        className={cn(alertVariants({ variant }), className)}
        role="alert"
        {...props}
      >
        <div className="flex">
          {/* Icon */}
          <div className={cn('shrink-0', iconColorStyles[variant])}>
            {displayIcon}
          </div>

          {/* Content */}
          <div className="ml-3 flex-1">
            {title && (
              <h3 className="text-sm font-medium">{title}</h3>
            )}
            <div className={cn('text-sm', title && 'mt-1')}>
              {children}
            </div>
            {action && (
              <div className="mt-3">{action}</div>
            )}
          </div>

          {/* Dismiss button */}
          {dismissible && (
            <div className="ml-3 shrink-0">
              <button
                type="button"
                className={cn(
                  'inline-flex rounded-md p-1.5',
                  'hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2',
                  variant === 'info' && 'focus:ring-primary-500',
                  variant === 'success' && 'focus:ring-success-500',
                  variant === 'warning' && 'focus:ring-warning-500',
                  variant === 'error' && 'focus:ring-error-500'
                )}
                onClick={onDismiss}
                aria-label="Dismiss"
              >
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }
);

// ============================================================================
// Alert Description
// ============================================================================

export interface AlertDescriptionProps {
  /** Description content */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Additional description for alerts
 */
export function AlertDescription({
  children,
  className,
}: AlertDescriptionProps): JSX.Element {
  return (
    <div className={cn('mt-2 text-sm opacity-90', className)}>
      {children}
    </div>
  );
}

// ============================================================================
// Inline Alert
// ============================================================================

export interface InlineAlertProps {
  /** Alert variant */
  variant?: AlertVariant;
  /** Alert message */
  children: ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Compact inline alert for form fields or small notices
 */
export function InlineAlert({
  variant = 'info',
  children,
  className,
}: InlineAlertProps): JSX.Element {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-sm',
        iconColorStyles[variant],
        className
      )}
      role="alert"
    >
      <span className="shrink-0">{AlertIcons[variant]}</span>
      <span>{children}</span>
    </div>
  );
}

export default Alert;
