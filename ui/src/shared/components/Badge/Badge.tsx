/**
 * Badge Component
 * Status indicators and labels
 * @module shared/components/Badge
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { cn, createVariants } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export type BadgeVariant = 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: BadgeVariant;
  /** Badge size */
  size?: BadgeSize;
  /** Icon to display before text */
  icon?: ReactNode;
  /** Show dot indicator instead of icon */
  dot?: boolean;
  /** Make badge rounded/pill shaped */
  rounded?: boolean;
  /** Remove badge (for removable badges) */
  onRemove?: () => void;
}

// ============================================================================
// Variants
// ============================================================================

const badgeVariants = createVariants({
  base: 'inline-flex items-center gap-1 font-medium',
  variants: {
    variant: {
      default: 'bg-gray-100 text-gray-800',
      primary: 'bg-primary-100 text-primary-800',
      secondary: 'bg-gray-500 text-white',
      success: 'bg-success-50 text-green-800',
      warning: 'bg-warning-50 text-amber-800',
      error: 'bg-error-50 text-red-800',
      outline: 'border border-gray-300 bg-transparent text-gray-700',
    },
    size: {
      sm: 'px-1.5 py-0.5 text-xs',
      md: 'px-2 py-0.5 text-xs',
      lg: 'px-2.5 py-1 text-sm',
    },
  },
  defaultVariants: {
    variant: 'default',
    size: 'md',
  },
});

// ============================================================================
// Dot Colors
// ============================================================================

const dotColorStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-500',
  primary: 'bg-primary-500',
  secondary: 'bg-gray-600',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  outline: 'bg-gray-500',
};

// ============================================================================
// Badge Component
// ============================================================================

/**
 * Badge component for status indicators
 *
 * @example
 * // Basic badge
 * <Badge>Default</Badge>
 *
 * @example
 * // Status badge with dot
 * <Badge variant="success" dot>Active</Badge>
 *
 * @example
 * // With icon
 * <Badge variant="primary" icon={<StarIcon />}>Featured</Badge>
 *
 * @example
 * // Removable badge
 * <Badge variant="secondary" onRemove={() => handleRemove()}>
 *   Tag name
 * </Badge>
 */
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  function Badge(
    {
      className,
      variant = 'default',
      size = 'md',
      icon,
      dot = false,
      rounded = true,
      onRemove,
      children,
      ...props
    },
    ref
  ) {
    const dotSizes = {
      sm: 'h-1 w-1',
      md: 'h-1.5 w-1.5',
      lg: 'h-2 w-2',
    };

    return (
      <span
        ref={ref}
        className={cn(
          badgeVariants({ variant, size }),
          rounded ? 'rounded-full' : 'rounded',
          className
        )}
        {...props}
      >
        {/* Dot indicator */}
        {dot && (
          <span
            className={cn(
              'shrink-0 rounded-full',
              dotSizes[size],
              dotColorStyles[variant]
            )}
            aria-hidden="true"
          />
        )}

        {/* Icon */}
        {!dot && icon && (
          <span className="shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        {/* Content */}
        {children}

        {/* Remove button */}
        {onRemove && (
          <button
            type="button"
            className={cn(
              'ml-0.5 shrink-0 rounded-full p-0.5',
              'hover:bg-black/10 focus:outline-none focus:ring-1 focus:ring-inset'
            )}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove"
          >
            <svg
              className={cn(
                size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
              )}
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
        )}
      </span>
    );
  }
);

// ============================================================================
// Status Badge
// ============================================================================

export type StatusType = 'active' | 'inactive' | 'pending' | 'error' | 'success' | 'warning';

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'dot'> {
  /** Status type */
  status: StatusType;
  /** Show status dot */
  showDot?: boolean;
}

const statusVariantMap: Record<StatusType, BadgeVariant> = {
  active: 'success',
  inactive: 'default',
  pending: 'warning',
  error: 'error',
  success: 'success',
  warning: 'warning',
};

const statusLabelMap: Record<StatusType, string> = {
  active: 'Active',
  inactive: 'Inactive',
  pending: 'Pending',
  error: 'Error',
  success: 'Success',
  warning: 'Warning',
};

/**
 * Pre-configured badge for common status types
 *
 * @example
 * <StatusBadge status="active" />
 * <StatusBadge status="pending" showDot />
 */
export function StatusBadge({
  status,
  showDot = true,
  children,
  ...props
}: StatusBadgeProps): JSX.Element {
  return (
    <Badge
      variant={statusVariantMap[status]}
      dot={showDot}
      {...props}
    >
      {children ?? statusLabelMap[status]}
    </Badge>
  );
}

// ============================================================================
// Count Badge
// ============================================================================

export interface CountBadgeProps {
  /** Count value */
  count: number;
  /** Maximum count to display (shows max+) */
  max?: number;
  /** Badge variant */
  variant?: BadgeVariant;
  /** Additional class names */
  className?: string;
}

/**
 * Numeric count badge
 *
 * @example
 * <CountBadge count={5} />
 * <CountBadge count={150} max={99} />
 */
export function CountBadge({
  count,
  max = 99,
  variant = 'primary',
  className,
}: CountBadgeProps): JSX.Element {
  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <Badge
      variant={variant}
      size="sm"
      className={cn('min-w-[20px] justify-center px-1.5', className)}
    >
      {displayCount}
    </Badge>
  );
}

export default Badge;
