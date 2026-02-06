/**
 * Select Component
 * Form select/dropdown with label and error support
 * @module shared/components/Form/Select
 */

import {
  forwardRef,
  type SelectHTMLAttributes,
  useId,
} from 'react';
import { cn, focusRing, disabledClasses } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface SelectOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Whether option is disabled */
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  /** Select label */
  label?: string;
  /** Error message */
  error?: string;
  /** Helper text */
  helperText?: string;
  /** Placeholder text (shown as first disabled option) */
  placeholder?: string;
  /** Select options */
  options: SelectOption[];
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Full width */
  fullWidth?: boolean;
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeStyles = {
  sm: 'h-8 text-sm pl-3 pr-8',
  md: 'h-10 text-sm pl-3 pr-10',
  lg: 'h-12 text-base pl-4 pr-12',
};

// ============================================================================
// Select Component
// ============================================================================

/**
 * Form select component with options array
 *
 * @example
 * // Basic select
 * <Select
 *   label="Country"
 *   placeholder="Select a country"
 *   options={[
 *     { value: 'us', label: 'United States' },
 *     { value: 'uk', label: 'United Kingdom' },
 *     { value: 'ca', label: 'Canada' },
 *   ]}
 * />
 *
 * @example
 * // With error
 * <Select
 *   label="Role"
 *   error="Please select a role"
 *   options={roleOptions}
 * />
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    {
      className,
      label,
      error,
      helperText,
      placeholder,
      options,
      size = 'md',
      fullWidth = false,
      disabled,
      id: providedId,
      'aria-describedby': ariaDescribedBy,
      ...props
    },
    ref
  ) {
    const generatedId = useId();
    const selectId = providedId ?? generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    const hasError = Boolean(error);
    const hasHelper = Boolean(helperText);

    const describedBy = [
      ariaDescribedBy,
      hasError && errorId,
      hasHelper && !hasError && helperId,
    ]
      .filter(Boolean)
      .join(' ') || undefined;

    return (
      <div className={cn('flex flex-col gap-1.5', fullWidth && 'w-full')}>
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
            className={cn(
              'text-sm font-medium text-gray-700',
              disabled && 'opacity-50'
            )}
          >
            {label}
          </label>
        )}

        {/* Select wrapper */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none rounded-md border bg-white text-gray-900',
              'transition-colors duration-200',
              focusRing('primary'),
              disabledClasses(),
              hasError
                ? 'border-error-500 focus:ring-error-500'
                : 'border-gray-300 hover:border-gray-400',
              sizeStyles[size],
              className
            )}
            disabled={disabled}
            aria-invalid={hasError}
            aria-describedby={describedBy}
            {...props}
          >
            {/* Placeholder option */}
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}

            {/* Options */}
            {options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom dropdown arrow */}
          <div
            className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3"
            aria-hidden="true"
          >
            <svg
              className={cn(
                'h-4 w-4',
                hasError ? 'text-error-500' : 'text-gray-400'
              )}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </div>
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

        {/* Helper text */}
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
// Form Group Wrapper
// ============================================================================

export interface FormGroupProps {
  /** Group label */
  label?: string;
  /** Group description */
  description?: string;
  /** Child form elements */
  children: React.ReactNode;
  /** Additional class names */
  className?: string;
}

/**
 * Wrapper for grouping related form fields
 */
export function FormGroup({
  label,
  description,
  children,
  className,
}: FormGroupProps): JSX.Element {
  return (
    <fieldset className={cn('space-y-4', className)}>
      {(label || description) && (
        <div>
          {label && (
            <legend className="text-base font-medium text-gray-900">
              {label}
            </legend>
          )}
          {description && (
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          )}
        </div>
      )}
      {children}
    </fieldset>
  );
}

export default Select;
