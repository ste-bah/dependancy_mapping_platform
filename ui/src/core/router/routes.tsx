/**
 * Route Configuration
 * Application routes with lazy loading
 * @module core/router/routes
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { AuthGuard, PublicOnlyGuard } from './AuthGuard';

// ============================================================================
// Lazy-loaded Page Components
// ============================================================================

// Auth pages
const LoginPage = lazy(() => import('@/pages/auth/LoginPage'));
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallbackPage'));

// Dashboard pages
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));

// Repository pages
const RepositoriesPage = lazy(() => import('@/pages/repositories/RepositoriesPage'));
const RepositoryDetailPage = lazy(() => import('@/pages/repositories/RepositoryDetailPage'));

// Scan pages
const ScansPage = lazy(() => import('@/pages/scans/ScansPage'));
const ScanDetailPage = lazy(() => import('@/pages/scans/ScanDetailPage'));

// Graph pages
const GraphViewPage = lazy(() => import('@/pages/graph/GraphViewPage'));

// Settings pages
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'));

// Error pages
const NotFoundPage = lazy(() => import('@/pages/errors/NotFoundPage'));

// Layout components
const AppLayout = lazy(() => import('@/layouts/AppLayout'));
const AuthLayout = lazy(() => import('@/layouts/AuthLayout'));

// ============================================================================
// Loading Fallback
// ============================================================================

/**
 * Loading spinner for lazy-loaded components
 */
function PageLoader(): ReactNode {
  return (
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    </div>
  );
}

/**
 * Wrap component with Suspense
 */
function withSuspense(Component: React.LazyExoticComponent<() => JSX.Element>): ReactNode {
  return (
    <Suspense fallback={<PageLoader />}>
      <Component />
    </Suspense>
  );
}

// ============================================================================
// Route Definitions
// ============================================================================

/**
 * Public routes (accessible without authentication)
 */
const publicRoutes: RouteObject[] = [
  {
    element: (
      <PublicOnlyGuard>
        <Suspense fallback={<PageLoader />}>
          <AuthLayout />
        </Suspense>
      </PublicOnlyGuard>
    ),
    children: [
      {
        path: '/login',
        element: withSuspense(LoginPage),
      },
      {
        path: '/auth/callback',
        element: withSuspense(AuthCallbackPage),
      },
    ],
  },
];

/**
 * Protected routes (require authentication)
 */
const protectedRoutes: RouteObject[] = [
  {
    element: (
      <AuthGuard>
        <Suspense fallback={<PageLoader />}>
          <AppLayout />
        </Suspense>
      </AuthGuard>
    ),
    children: [
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },
      {
        path: '/dashboard',
        element: withSuspense(DashboardPage),
      },
      {
        path: '/repositories',
        element: withSuspense(RepositoriesPage),
      },
      {
        path: '/repositories/:owner/:name',
        element: withSuspense(RepositoryDetailPage),
      },
      {
        path: '/scans',
        element: withSuspense(ScansPage),
      },
      {
        path: '/scans/:scanId',
        element: withSuspense(ScanDetailPage),
      },
      {
        path: '/scans/:scanId/graph',
        element: withSuspense(GraphViewPage),
      },
      {
        path: '/settings',
        element: withSuspense(SettingsPage),
      },
      {
        path: '/settings/:section',
        element: withSuspense(SettingsPage),
      },
    ],
  },
];

/**
 * Error/fallback routes
 */
const errorRoutes: RouteObject[] = [
  {
    path: '/404',
    element: withSuspense(NotFoundPage),
  },
  {
    path: '*',
    element: <Navigate to="/404" replace />,
  },
];

// ============================================================================
// Router Instance
// ============================================================================

/**
 * Application router
 */
export const router = createBrowserRouter([
  ...publicRoutes,
  ...protectedRoutes,
  ...errorRoutes,
]);

// ============================================================================
// Route Helpers
// ============================================================================

/**
 * Route path constants
 */
export const ROUTES = {
  // Auth
  LOGIN: '/login',
  AUTH_CALLBACK: '/auth/callback',

  // Dashboard
  DASHBOARD: '/dashboard',

  // Repositories
  REPOSITORIES: '/repositories',
  REPOSITORY_DETAIL: (owner: string, name: string) => `/repositories/${owner}/${name}`,

  // Scans
  SCANS: '/scans',
  SCAN_DETAIL: (scanId: string) => `/scans/${scanId}`,
  SCAN_GRAPH: (scanId: string) => `/scans/${scanId}/graph`,

  // Settings
  SETTINGS: '/settings',
  SETTINGS_SECTION: (section: string) => `/settings/${section}`,

  // Errors
  NOT_FOUND: '/404',
} as const;

/**
 * Navigation helper type
 */
export type AppRoutes = typeof ROUTES;
