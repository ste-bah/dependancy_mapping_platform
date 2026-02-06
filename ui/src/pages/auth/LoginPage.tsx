/**
 * Login Page
 * GitHub OAuth login page with error handling
 * @module pages/auth/LoginPage
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore, selectError } from '@/core/auth';
import { Alert, Button } from '@/shared';

// ============================================================================
// Icons
// ============================================================================

function GitHubIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }): JSX.Element {
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
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

function GraphIcon({ className }: { className?: string }): JSX.Element {
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
        d="M7.5 14.25v2.25m3-4.5v4.5m3-6.75v6.75m3-9v9M6 20.25h12A2.25 2.25 0 0020.25 18V6A2.25 2.25 0 0018 3.75H6A2.25 2.25 0 003.75 6v12A2.25 2.25 0 006 20.25z"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }): JSX.Element {
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
        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
      />
    </svg>
  );
}

// ============================================================================
// Feature Item Component
// ============================================================================

interface FeatureItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function FeatureItem({ icon, title, description }: FeatureItemProps): JSX.Element {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-600">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

// ============================================================================
// Login Page Component
// ============================================================================

/**
 * Login page component
 * Displays GitHub OAuth login button with error handling
 */
export default function LoginPage(): JSX.Element {
  const login = useAuthStore((state) => state.login);
  const storeError = useAuthStore(selectError);
  const setError = useAuthStore((state) => state.setError);
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  // Check for error in URL params (from OAuth callback)
  useEffect(() => {
    const urlError = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    if (urlError) {
      const message = errorDescription ?? 'Authentication failed. Please try again.';
      setError(message);

      // Clean up URL params
      const url = new URL(window.location.href);
      url.searchParams.delete('error');
      url.searchParams.delete('error_description');
      window.history.replaceState({}, document.title, url.pathname);
    }
  }, [searchParams, setError]);

  const handleLogin = (): void => {
    setIsLoading(true);
    // Clear any previous errors
    setError(null);
    // Redirect to GitHub OAuth
    login();
  };

  const handleDismissError = (): void => {
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900">
          Welcome back
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Sign in with your GitHub account to continue
        </p>
      </div>

      {/* Error message */}
      {storeError && (
        <Alert
          variant="error"
          title="Authentication Error"
          dismissible
          onDismiss={handleDismissError}
        >
          {storeError}
        </Alert>
      )}

      {/* Login button */}
      <div className="space-y-4">
        <Button
          onClick={handleLogin}
          loading={isLoading}
          fullWidth
          size="lg"
          leftIcon={<GitHubIcon className="h-5 w-5" />}
          className="bg-gray-900 hover:bg-gray-800"
        >
          Continue with GitHub
        </Button>

        <p className="text-center text-xs text-gray-500">
          We only request read access to your public repositories.
        </p>
      </div>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-4 text-gray-500">Why GitHub?</span>
        </div>
      </div>

      {/* Features */}
      <div className="space-y-4">
        <FeatureItem
          icon={<ShieldIcon className="h-4 w-4" />}
          title="Secure Access"
          description="OAuth 2.0 authentication keeps your credentials safe"
        />
        <FeatureItem
          icon={<GraphIcon className="h-4 w-4" />}
          title="Analyze Dependencies"
          description="Visualize your project's dependency graph"
        />
        <FeatureItem
          icon={<LockIcon className="h-4 w-4" />}
          title="Privacy First"
          description="Your code stays on GitHub, we only read metadata"
        />
      </div>

      {/* Terms */}
      <p className="text-center text-xs text-gray-500">
        By signing in, you agree to our{' '}
        <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
          Terms of Service
        </a>{' '}
        and{' '}
        <a href="#" className="font-medium text-primary-600 hover:text-primary-500">
          Privacy Policy
        </a>
      </p>
    </div>
  );
}
