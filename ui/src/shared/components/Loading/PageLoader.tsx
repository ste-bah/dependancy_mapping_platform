/**
 * PageLoader Component
 * Full page loading overlay
 * @module shared/components/Loading/PageLoader
 */

import { cn } from '@/shared/utils';
import { Spinner } from './Spinner';

// ============================================================================
// Types
// ============================================================================

export interface PageLoaderProps {
  /** Loading message */
  message?: string;
  /** Show as overlay on top of content */
  overlay?: boolean;
  /** Background opacity for overlay */
  overlayOpacity?: 'light' | 'medium' | 'heavy';
  /** Additional class names */
  className?: string;
}

// ============================================================================
// PageLoader Component
// ============================================================================

/**
 * Full page loading indicator
 *
 * @example
 * // Full page loader
 * <PageLoader message="Loading your dashboard..." />
 *
 * @example
 * // Overlay mode
 * <PageLoader overlay message="Saving changes..." />
 */
export function PageLoader({
  message = 'Loading...',
  overlay = false,
  overlayOpacity = 'medium',
  className,
}: PageLoaderProps): JSX.Element {
  const opacityStyles = {
    light: 'bg-white/50',
    medium: 'bg-white/75',
    heavy: 'bg-white/90',
  };

  const containerStyles = overlay
    ? cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        opacityStyles[overlayOpacity],
        'backdrop-blur-sm'
      )
    : 'flex min-h-[400px] items-center justify-center';

  return (
    <div className={cn(containerStyles, className)} role="status">
      <div className="flex flex-col items-center gap-4">
        <Spinner size="xl" />
        {message && (
          <p className="text-sm font-medium text-gray-600">{message}</p>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Inline Loader
// ============================================================================

export interface InlineLoaderProps {
  /** Loading message */
  message?: string;
  /** Spinner size */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

/**
 * Inline loading indicator for sections
 *
 * @example
 * <InlineLoader message="Fetching data..." />
 */
export function InlineLoader({
  message,
  size = 'md',
  className,
}: InlineLoaderProps): JSX.Element {
  return (
    <div
      className={cn('flex items-center justify-center gap-2 py-8', className)}
      role="status"
    >
      <Spinner size={size} />
      {message && (
        <span className="text-sm text-gray-600">{message}</span>
      )}
    </div>
  );
}

// ============================================================================
// Button Loading Content
// ============================================================================

export interface LoadingContentProps {
  /** Whether loading */
  loading: boolean;
  /** Loading text */
  loadingText?: string;
  /** Normal content */
  children: React.ReactNode;
}

/**
 * Helper for button loading states
 *
 * @example
 * <button disabled={loading}>
 *   <LoadingContent loading={loading} loadingText="Saving...">
 *     Save Changes
 *   </LoadingContent>
 * </button>
 */
export function LoadingContent({
  loading,
  loadingText = 'Loading...',
  children,
}: LoadingContentProps): JSX.Element {
  if (loading) {
    return (
      <span className="flex items-center gap-2">
        <Spinner size="sm" color="text-current" />
        {loadingText}
      </span>
    );
  }

  return <>{children}</>;
}

// ============================================================================
// Loading Gate
// ============================================================================

export interface LoadingGateProps {
  /** Whether loading */
  loading: boolean;
  /** Content to show while loading */
  fallback?: React.ReactNode;
  /** Content to show when loaded */
  children: React.ReactNode;
}

/**
 * Conditional rendering based on loading state
 *
 * @example
 * <LoadingGate loading={isLoading} fallback={<SkeletonCard />}>
 *   <ActualContent />
 * </LoadingGate>
 */
export function LoadingGate({
  loading,
  fallback,
  children,
}: LoadingGateProps): JSX.Element {
  if (loading) {
    return <>{fallback ?? <InlineLoader />}</>;
  }

  return <>{children}</>;
}

export default PageLoader;
