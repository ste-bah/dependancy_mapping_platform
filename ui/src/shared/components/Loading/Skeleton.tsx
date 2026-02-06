/**
 * Skeleton Component
 * Animated loading placeholder for content
 * @module shared/components/Loading/Skeleton
 */

import { cn } from '@/shared/utils';

// ============================================================================
// Types
// ============================================================================

export interface SkeletonProps {
  /** Width of the skeleton (CSS value) */
  width?: string | number;
  /** Height of the skeleton (CSS value) */
  height?: string | number;
  /** Make skeleton circular */
  circle?: boolean;
  /** Skeleton variant */
  variant?: 'text' | 'rectangular' | 'rounded';
  /** Animation type */
  animation?: 'pulse' | 'wave' | 'none';
  /** Additional class names */
  className?: string;
}

// ============================================================================
// Skeleton Component
// ============================================================================

/**
 * Skeleton loading placeholder
 *
 * @example
 * // Text skeleton
 * <Skeleton variant="text" width="100%" />
 *
 * @example
 * // Avatar skeleton
 * <Skeleton circle width={40} height={40} />
 *
 * @example
 * // Card skeleton
 * <Skeleton variant="rectangular" width="100%" height={200} />
 */
export function Skeleton({
  width,
  height,
  circle = false,
  variant = 'text',
  animation = 'pulse',
  className,
}: SkeletonProps): JSX.Element {
  // Convert number dimensions to pixels
  const widthStyle = typeof width === 'number' ? `${width}px` : width;
  const heightStyle = typeof height === 'number' ? `${height}px` : height;

  // Default heights based on variant
  const defaultHeight = {
    text: '1em',
    rectangular: '100%',
    rounded: '100%',
  };

  const variantStyles = {
    text: 'rounded',
    rectangular: '',
    rounded: 'rounded-lg',
  };

  const animationStyles = {
    pulse: 'animate-pulse',
    wave: 'animate-shimmer',
    none: '',
  };

  return (
    <div
      className={cn(
        'bg-gray-200',
        circle && 'rounded-full',
        !circle && variantStyles[variant],
        animationStyles[animation],
        className
      )}
      style={{
        width: widthStyle ?? '100%',
        height: heightStyle ?? defaultHeight[variant],
      }}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// Skeleton Presets
// ============================================================================

/**
 * Text line skeleton
 */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, index) => (
        <Skeleton
          key={index}
          variant="text"
          width={index === lines - 1 ? '80%' : '100%'}
          height={16}
        />
      ))}
    </div>
  );
}

/**
 * Avatar skeleton
 */
export function SkeletonAvatar({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}): JSX.Element {
  return (
    <Skeleton
      circle
      width={size}
      height={size}
      {...(className !== undefined ? { className } : {})}
    />
  );
}

/**
 * Card skeleton
 */
export function SkeletonCard({
  className,
}: {
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('rounded-lg border bg-white p-6 shadow-sm', className)}>
      <div className="flex items-center gap-4">
        <SkeletonAvatar size={48} />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" width="60%" height={20} />
          <Skeleton variant="text" width="40%" height={16} />
        </div>
      </div>
      <div className="mt-4">
        <SkeletonText lines={3} />
      </div>
    </div>
  );
}

/**
 * Table row skeleton
 */
export function SkeletonTableRow({
  columns = 4,
  className,
}: {
  columns?: number;
  className?: string;
}): JSX.Element {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton
            variant="text"
            width={index === 0 ? '70%' : '50%'}
            height={16}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Table skeleton with header and rows
 */
export function SkeletonTable({
  rows = 5,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}): JSX.Element {
  return (
    <div className={cn('overflow-hidden rounded-lg border', className)}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index} className="px-4 py-3">
                <Skeleton variant="text" width="60%" height={14} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {Array.from({ length: rows }).map((_, index) => (
            <SkeletonTableRow key={index} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Skeleton;
