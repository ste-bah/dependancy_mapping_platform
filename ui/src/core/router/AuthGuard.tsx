/**
 * Authentication Guard Components
 * Route protection for authenticated and public-only routes
 * @module core/router/AuthGuard
 */

import { type ReactNode, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, selectIsAuthenticated, selectIsLoading } from '@/core/auth';

// ============================================================================
// Types
// ============================================================================

interface GuardProps {
  children: ReactNode;
}

// ============================================================================
// Loading Component
// ============================================================================

/**
 * Full-screen loading spinner
 */
function LoadingScreen(): ReactNode {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm font-medium text-gray-600">
          Checking authentication...
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Auth Guard
// ============================================================================

/**
 * Protects routes that require authentication
 * Redirects to login if not authenticated
 */
export function AuthGuard({ children }: GuardProps): ReactNode {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore(selectIsLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const location = useLocation();

  // Initialize auth on mount
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Save intended destination for redirect after login
    const returnTo = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return <>{children}</>;
}

// ============================================================================
// Public Only Guard
// ============================================================================

/**
 * Protects routes that should only be accessible when NOT authenticated
 * Redirects to dashboard if already authenticated
 */
export function PublicOnlyGuard({ children }: GuardProps): ReactNode {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);
  const isLoading = useAuthStore(selectIsLoading);
  const initialize = useAuthStore((state) => state.initialize);
  const location = useLocation();

  // Initialize auth on mount
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  // Redirect to dashboard if already authenticated
  if (isAuthenticated) {
    // Check for return URL
    const searchParams = new URLSearchParams(location.search);
    const returnTo = searchParams.get('returnTo');
    const redirectPath = returnTo ? decodeURIComponent(returnTo) : '/dashboard';

    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}

// ============================================================================
// Optional Auth Wrapper
// ============================================================================

/**
 * Wrapper that provides auth context but doesn't require authentication
 * Useful for pages that show different content based on auth status
 */
export function OptionalAuth({ children }: GuardProps): ReactNode {
  const isLoading = useAuthStore(selectIsLoading);
  const initialize = useAuthStore((state) => state.initialize);

  // Initialize auth on mount
  useEffect(() => {
    void initialize();
  }, [initialize]);

  // Show loading while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  return <>{children}</>;
}

// ============================================================================
// HOC Versions
// ============================================================================

/**
 * Higher-order component for protected routes
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function ProtectedComponent(props: P) {
    return (
      <AuthGuard>
        <Component {...props} />
      </AuthGuard>
    );
  };
}

/**
 * Higher-order component for public-only routes
 */
export function withPublicOnlyGuard<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P> {
  return function PublicOnlyComponent(props: P) {
    return (
      <PublicOnlyGuard>
        <Component {...props} />
      </PublicOnlyGuard>
    );
  };
}
