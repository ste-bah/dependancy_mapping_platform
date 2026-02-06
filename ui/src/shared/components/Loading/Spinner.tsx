/**
 * Spinner Component
 * SVG loading spinner with size variants
 * @module shared/components/Loading/Spinner
 */

import { cn } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface SpinnerProps {
  /** Spinner size */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Custom color class */
  color?: string;
  /** Additional class names */
  className?: string;
  /** Accessible label */
  label?: string;
}

// ============================================================================
// Size Configurations
// ============================================================================

const sizeStyles = {
  xs: 'h-3 w-3',
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
  xl: 'h-12 w-12',
};

// ============================================================================
// Spinner Component
// ============================================================================

/**
 * Loading spinner component
 *
 * @example
 * // Default spinner
 * <Spinner />
 *
 * @example
 * // Large spinner
 * <Spinner size="lg" />
 *
 * @example
 * // Custom color
 * <Spinner color="text-primary-600" />
 *
 * @example
 * // With accessible label
 * <Spinner label="Loading data..." />
 */
export function Spinner({
  size = 'md',
  color = 'text-primary-600',
  className,
  label = 'Loading',
}: SpinnerProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex', className)}
    >
      <svg
        className={cn('animate-spin', sizeStyles[size], color)}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ============================================================================
// Dots Spinner Variant
// ============================================================================

export interface DotsSpinnerProps {
  /** Dots size */
  size?: 'sm' | 'md' | 'lg';
  /** Custom color class */
  color?: string;
  /** Additional class names */
  className?: string;
  /** Accessible label */
  label?: string;
}

const dotSizes = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-3 w-3',
};

/**
 * Alternative loading indicator with bouncing dots
 *
 * @example
 * <DotsSpinner />
 */
export function DotsSpinner({
  size = 'md',
  color = 'bg-primary-600',
  className,
  label = 'Loading',
}: DotsSpinnerProps): JSX.Element {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            'animate-bounce rounded-full',
            dotSizes[size],
            color
          )}
          style={{
            animationDelay: `${index * 0.1}s`,
            animationDuration: '0.6s',
          }}
          aria-hidden="true"
        />
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export default Spinner;
