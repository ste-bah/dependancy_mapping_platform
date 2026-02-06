/**
 * Input Component
 * Form input with label, error state, and addon support
 * @module shared/components/Form/Input
 */

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  useId,
} from 'react';
import { cn, focusRing, disabledClasses } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Input label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text shown below input */
  helperText?: string;
  /** Element to show on the left side of input */
  leftAddon?: ReactNode;
  /** Element to show on the right side of input */
  rightAddon?: ReactNode;
  /** Input size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width input */
  fullWidth?: boolean;
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeStyles = {
  sm: {
    input: 'h-8 text-sm px-3',
    addon: 'px-2 text-sm',
    label: 'text-sm',
  },
  md: {
    input: 'h-10 text-sm px-3',
    addon: 'px-3 text-sm',
    label: 'text-sm',
  },
  lg: {
    input: 'h-12 text-base px-4',
    addon: 'px-4 text-base',
    label: 'text-base',
  },
};

// ============================================================================
// Input Component
// ============================================================================

/**
 * Form input component with label and error support
 *
 * @example
 * // Basic input
 * <Input label="Email" placeholder="Enter your email" />
 *
 * @example
 * // With error
 * <Input label="Email" error="Invalid email address" />
 *
 * @example
 * // With addons
 * <Input
 *   label="Website"
 *   leftAddon="https://"
 *   rightAddon=".com"
 * />
 *
 * @example
 * // With icon addons
 * <Input
 *   label="Search"
 *   leftAddon={<SearchIcon className="h-4 w-4" />}
 * />
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  function Input(
    {
      className,
      label,
      error,
      helperText,
      leftAddon,
      rightAddon,
      size = 'md',
      fullWidth = false,
      disabled,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) {
    // Generate unique IDs for accessibility
    const generatedId = useId();
    const inputId = providedId ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    // Build aria-describedby
    const describedBy = [
      ariaDescribedBy,
      hasError && errorId,
      hasHelper && !hasError && helperId,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    const sizes = sizeStyles[size];

    const inputBaseStyles = cn(
      'w-full rounded-md border bg-white text-gray-900 placeholder:text-gray-400',
      'transition-colors duration-200',
      focusRing('primary'),
      disabledClasses(),
      hasError
        ? 'border-error-500 focus:ring-error-500'
        : 'border-gray-300 hover:border-gray-400',
      sizes.input
    );

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'font-medium text-gray-700',
              sizes.label,
              disabled && 'opacity-50'
            )}
          >
            {label}
          </label>
        )}

        {/* Input wrapper with addons */}
        <div className="relative flex">
          {/* Left addon */}
          {leftAddon && (
            <div
              className={cn(
                'flex items-center justify-center rounded-l-md border border-r-0 bg-gray-50 text-gray-500',
                hasError ? 'border-error-500' : 'border-gray-300',
                sizes.addon
              )}
              aria-hidden="true"
            >
              {leftAddon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              inputBaseStyles,
              leftAddon && 'rounded-l-none',
              rightAddon && 'rounded-r-none',
              className
            )}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            {...props}
          />

          {/* Right addon */}
          {rightAddon && (
            <div
              className={cn(
                'flex items-center justify-center rounded-r-md border border-l-0 bg-gray-50 text-gray-500',
                hasError ? 'border-error-500' : 'border-gray-300',
                sizes.addon
              )}
              aria-hidden="true"
            >
              {rightAddon}
            </div>
          )}
        </div>

        {/* Error message */}
        {hasError && (
          <p
            id={errorId}
            className="text-sm text-error-500"
            role="alert"
          >
            {error}
          </p>
        )}

        {/* Helper text (only shown when no error) */}
        {hasHelper && !hasError && (
          <p
            id={helperId}
            className="text-sm text-gray-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

// ============================================================================
// Textarea Component
// ============================================================================

export interface TextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'size'> {
  /** Textarea label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Full width */
  fullWidth?: boolean;
}

/**
 * Textarea component with same styling as Input
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea(
    {
      className,
      label,
      error,
      helperText,
      fullWidth = false,
      disabled,
      id: providedId,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const inputId = providedId ?? generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    const describedBy = [hasError && errorId, hasHelper && !hasError && helperId]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              'text-sm font-medium text-gray-700',
              disabled && 'opacity-50'
            )}
          >
            {label}
          </label>
        )}

        <textarea
          ref={ref}
          id={inputId}
          className={cn(
            'min-h-[80px] w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-gray-900',
            'placeholder:text-gray-400',
            'transition-colors duration-200',
            focusRing('primary'),
            disabledClasses(),
            hasError
              ? 'border-error-500 focus:ring-error-500'
              : 'border-gray-300 hover:border-gray-400',
            className
          )}
          disabled={disabled}
          aria-invalid={hasError}
          aria-describedby={describedBy}
          {...props}
        />

        {hasError && (
          <p id={errorId} className="text-sm text-error-500" role="alert">
            {error}
          </p>
        )}

        {hasHelper && !hasError && (
          <p id={helperId} className="text-sm text-gray-500">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

export default Input;
