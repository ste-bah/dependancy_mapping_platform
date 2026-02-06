/**
 * Authentication Layout
 * Layout for login and authentication pages
 * @module layouts/AuthLayout
 */

import { Outlet } from 'react-router-dom';

// ============================================================================
// Logo Component
// ============================================================================

function Logo(): JSX.Element {
  return (
    <div className="flex items-center justify-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-600 shadow-lg">
        <svg
          className="h-7 w-7 text-white"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      </div>
      <div className="text-left">
        <h1 className="text-2xl font-bold text-gray-900">Code Reviewer</h1>
        <p className="text-sm text-gray-500">Dependency Graph Analysis</p>
      </div>
    </div>
  );
}

// ============================================================================
// Background Pattern
// ============================================================================

function BackgroundPattern(): JSX.Element {
  return (
    <div className="absolute inset-0 -z-10 overflow-hidden">
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-gray-50" />

      {/* Grid pattern */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.03]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="auth-grid"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M0 40L40 0M-10 10L10 -10M30 50L50 30"
              stroke="currentColor"
              strokeWidth="1"
              fill="none"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* Decorative blobs */}
      <div className="absolute -left-1/4 -top-1/4 h-1/2 w-1/2 rounded-full bg-primary-100/50 blur-3xl" />
      <div className="absolute -bottom-1/4 -right-1/4 h-1/2 w-1/2 rounded-full bg-primary-100/30 blur-3xl" />
    </div>
  );
}

// ============================================================================
// Footer
// ============================================================================

function Footer(): JSX.Element {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-white/80 py-6 backdrop-blur-sm">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center text-sm text-gray-500 sm:flex-row sm:justify-between">
          <p>{currentYear} Code Reviewer. All rights reserved.</p>
          <div className="flex gap-4">
            <a
              href="#"
              className="transition-colors hover:text-gray-700"
              onClick={(e) => e.preventDefault()}
            >
              Privacy Policy
            </a>
            <a
              href="#"
              className="transition-colors hover:text-gray-700"
              onClick={(e) => e.preventDefault()}
            >
              Terms of Service
            </a>
            <a
              href="#"
              className="transition-colors hover:text-gray-700"
              onClick={(e) => e.preventDefault()}
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ============================================================================
// Auth Layout Component
// ============================================================================

/**
 * Authentication layout
 * Centered layout for auth-related pages with branding
 */
export default function AuthLayout(): JSX.Element {
  return (
    <div className="relative flex min-h-screen flex-col">
      {/* Background */}
      <BackgroundPattern />

      {/* Main content area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
        {/* Logo section */}
        <div className="mb-8">
          <Logo />
        </div>

        {/* Card container */}
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-gray-200 bg-white/90 p-8 shadow-xl backdrop-blur-sm">
            <Outlet />
          </div>
        </div>

        {/* Additional info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            Analyze your codebase dependencies with powerful graph visualization
          </p>
        </div>
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
