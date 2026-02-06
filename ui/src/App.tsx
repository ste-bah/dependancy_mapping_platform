/**
 * Application Root Component
 * Main application component with providers and error boundary
 * @module App
 */

import { Component, type ReactNode, type ErrorInfo, Suspense } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from '@/core/router';

// ============================================================================
// Query Client Configuration
// ============================================================================

/**
 * React Query client with default options
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// ============================================================================
// Loading Fallback
// ============================================================================

/**
 * Full-screen loading fallback for Suspense
 */
function AppLoadingFallback(): JSX.Element {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-600 border-t-transparent" />
        <span className="text-sm font-medium text-gray-600">Loading...</span>
      </div>
    </div>
  );
}

// ============================================================================
// Error Boundary
// ============================================================================

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary component to catch and display errors
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console in development
    console.error('Application error:', error, errorInfo);

    // TODO: Send to error reporting service in production
    // e.g., Sentry.captureException(error, { extra: errorInfo });
  }

  handleReload = (): void => {
    window.location.reload();
  };

  handleGoHome = (): void => {
    window.location.href = '/';
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
          <div className="w-full max-w-md text-center">
            {/* Error icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
              <svg
                className="h-8 w-8 text-red-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                />
              </svg>
            </div>

            {/* Error message */}
            <h1 className="mt-6 text-2xl font-bold text-gray-900">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-gray-600">
              We encountered an unexpected error. Please try reloading the page.
            </p>

            {/* Error details (development only) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-4 rounded-lg bg-gray-100 p-4 text-left">
                <p className="text-xs font-medium text-gray-700">
                  Error Details:
                </p>
                <pre className="mt-2 overflow-auto text-xs text-red-600">
                  {this.state.error.message}
                </pre>
              </div>
            )}

            {/* Actions */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                Go to Homepage
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// App Component
// ============================================================================

/**
 * Root application component
 * Sets up providers and error boundaries
 */
export default function App(): JSX.Element {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<AppLoadingFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

// ============================================================================
// Re-export for backwards compatibility
// ============================================================================

export { queryClient };
