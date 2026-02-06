/**
 * Auth Callback Page
 * Handles OAuth callback, token exchange, and navigation
 * @module pages/auth/AuthCallbackPage
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '@/core/auth';
import { Alert, Spinner } from '@/shared';
import { ROUTES } from '@/core/router';

// ============================================================================
// Types
// ============================================================================

type CallbackState = 'loading' | 'success' | 'error';

// ============================================================================
// Icons
// ============================================================================

function CheckCircleIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function ExclamationCircleIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
      />
    </svg>
  );
}

// ============================================================================
// Loading State Component
// ============================================================================

function LoadingState(): JSX.Element {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <Spinner size="lg" color="text-primary-600" />
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Completing sign in...
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Please wait while we verify your credentials
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Success State Component
// ============================================================================

function SuccessState(): JSX.Element {
  return (
    <div className="flex flex-col items-center space-y-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <CheckCircleIcon className="h-10 w-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Sign in successful!
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          Redirecting to dashboard...
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Error State Component
// ============================================================================

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps): JSX.Element {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center space-y-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <ExclamationCircleIcon className="h-10 w-10 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Sign in failed
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            We couldn&apos;t complete the authentication
          </p>
        </div>
      </div>

      <Alert variant="error" title="Error Details">
        {error}
      </Alert>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={onRetry}
          className="flex-1 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Try again
        </button>
        <a
          href={ROUTES.LOGIN}
          className="flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        >
          Back to login
        </a>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * OAuth callback handler page
 * Exchanges authorization code for tokens and redirects
 */
export default function AuthCallbackPage(): JSX.Element {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Auth store
  const initialize = useAuthStore((state) => state.initialize);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const storeError = useAuthStore((state) => state.error);
  const isLoading = useAuthStore((state) => state.isLoading);
  const login = useAuthStore((state) => state.login);
  const setError = useAuthStore((state) => state.setError);

  // Local state
  const [state, setState] = useState<CallbackState>('loading');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const hasInitialized = useRef(false);

  // Handle initialization
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    // Check for OAuth error in URL
    const urlError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (urlError) {
      const message = errorDescription ?? 'Authentication was denied or failed';
      setErrorMessage(message);
      setError(message);
      setState('error');
      return;
    }

    // Check for authorization code
    const code = searchParams.get('code');
    if (!code) {
      const message = 'No authorization code received from GitHub';
      setErrorMessage(message);
      setError(message);
      setState('error');
      return;
    }

    // Initialize auth store - it will handle the code exchange
    void initialize();
  }, [searchParams, initialize, setError]);

  // Watch for auth state changes
  useEffect(() => {
    if (isAuthenticated && state === 'loading') {
      setState('success');

      // Get return URL or default to dashboard
      const returnTo = searchParams.get('returnTo');
      const redirectPath = returnTo ? decodeURIComponent(returnTo) : ROUTES.DASHBOARD;

      // Delay navigation slightly to show success state
      const timer = setTimeout(() => {
        navigate(redirectPath, { replace: true });
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (storeError && state === 'loading') {
      setState('error');
      setErrorMessage(storeError);
    }

    return undefined;
  }, [isAuthenticated, storeError, state, navigate, searchParams]);

  // Handle loading state from store
  useEffect(() => {
    if (!isLoading && !isAuthenticated && !storeError && state === 'loading') {
      // Auth initialization completed without success or error
      // This might happen if there's no valid session
      const urlError = searchParams.get('error');
      if (!urlError && !searchParams.get('code')) {
        navigate(ROUTES.LOGIN, { replace: true });
      }
    }
  }, [isLoading, isAuthenticated, storeError, state, navigate, searchParams]);

  // Retry handler
  const handleRetry = useCallback(() => {
    login();
  }, [login]);

  return (
    <div className="py-4">
      {state === 'loading' && <LoadingState />}
      {state === 'success' && <SuccessState />}
      {state === 'error' && (
        <ErrorState error={errorMessage} onRetry={handleRetry} />
      )}
    </div>
  );
}
