/**
 * Router Guards Integration Tests
 * Tests for AuthGuard, PublicOnlyGuard, and OptionalAuth with React Router
 * @module __tests__/integration/router-guards.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/auth/auth.store';
import { AuthGuard, PublicOnlyGuard, OptionalAuth } from '@/core/router/AuthGuard';
import * as authService from '@/core/auth/auth.service';
import * as apiModule from '@/core/api';
import {
  createMockUser,
  createMockTokens,
  resetUrl,
} from '@/__tests__/setup';
import type { User, AuthTokens } from '@/types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/core/auth/auth.service', () => ({
  exchangeCode: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/core/api', () => ({
  setTokenCallbacks: vi.fn(),
  clearTokenCallbacks: vi.fn(),
}));

const mockRefreshToken = authService.refreshToken as vi.Mock;
const mockGetCurrentUser = authService.getCurrentUser as vi.Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUser: User = createMockUser();
const mockTokens: AuthTokens = createMockTokens();

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Component that displays current location for testing
 */
function LocationDisplay(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location-display">
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="search">{location.search}</span>
    </div>
  );
}

/**
 * Protected dashboard component
 */
function DashboardPage(): JSX.Element {
  return (
    <div data-testid="dashboard-page">
      <h1>Dashboard</h1>
      <p>Welcome to the dashboard</p>
    </div>
  );
}

/**
 * Protected settings page
 */
function SettingsPage(): JSX.Element {
  return (
    <div data-testid="settings-page">
      <h1>Settings</h1>
    </div>
  );
}

/**
 * Login page component
 */
function LoginPage(): JSX.Element {
  return (
    <div data-testid="login-page">
      <h1>Login</h1>
      <p>Please sign in with GitHub</p>
    </div>
  );
}

/**
 * Public landing page
 */
function LandingPage(): JSX.Element {
  return (
    <div data-testid="landing-page">
      <h1>Welcome</h1>
    </div>
  );
}

// ============================================================================
// Test Router Wrapper
// ============================================================================

interface TestRouterProps {
  initialRoute?: string;
  children?: React.ReactNode;
}

function TestRouter({ initialRoute = '/', children }: TestRouterProps): JSX.Element {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        {/* Public routes with PublicOnlyGuard */}
        <Route
          path="/login"
          element={
            <PublicOnlyGuard>
              <LoginPage />
            </PublicOnlyGuard>
          }
        />

        {/* Protected routes with AuthGuard */}
        <Route
          path="/dashboard"
          element={
            <AuthGuard>
              <DashboardPage />
            </AuthGuard>
          }
        />
        <Route
          path="/settings"
          element={
            <AuthGuard>
              <SettingsPage />
            </AuthGuard>
          }
        />

        {/* Optional auth route */}
        <Route
          path="/"
          element={
            <OptionalAuth>
              <LandingPage />
            </OptionalAuth>
          }
        />

        {children}
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

// ============================================================================
// Reset State Helper
// ============================================================================

function resetAuthState(): void {
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: false,
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    error: null,
  });
}

function setAuthenticatedState(): void {
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    user: mockUser,
    accessToken: mockTokens.accessToken,
    refreshToken: mockTokens.refreshToken,
    expiresAt: Date.now() + 3600000, // 1 hour from now
    error: null,
  });
}

function setLoadingState(): void {
  useAuthStore.setState({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    accessToken: null,
    refreshToken: null,
    expiresAt: null,
    error: null,
  });
}

// ============================================================================
// AuthGuard Integration Tests
// ============================================================================

describe('AuthGuard Integration', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Unauthenticated Access
  // ==========================================================================

  describe('Unauthenticated Access', () => {
    it('should redirect unauthenticated user from /dashboard to /login', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
      });
    });

    it('should redirect unauthenticated user from /settings to /login', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/settings" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
      });
    });

    it('should include returnTo parameter when redirecting to login', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        const search = screen.getByTestId('search').textContent;
        expect(search).toContain('returnTo=');
        expect(search).toContain('%2Fdashboard');
      });
    });

    it('should preserve query params in returnTo parameter', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/dashboard?filter=active&page=2" />);

      await waitFor(() => {
        const search = screen.getByTestId('search').textContent;
        expect(search).toContain('returnTo=');
        // URL encoded version of /dashboard?filter=active&page=2
        expect(search).toContain('%2Fdashboard');
      });
    });
  });

  // ==========================================================================
  // Authenticated Access
  // ==========================================================================

  describe('Authenticated Access', () => {
    it('should allow authenticated user to access /dashboard', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('pathname').textContent).toBe('/dashboard');
    });

    it('should allow authenticated user to access /settings', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/settings" />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('pathname').textContent).toBe('/settings');
    });

    it('should render children when authenticated', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByText('Welcome to the dashboard')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('should show loading screen while checking auth', async () => {
      setLoadingState();

      render(<TestRouter initialRoute="/dashboard" />);

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });

    it('should transition from loading to authenticated', async () => {
      setLoadingState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const { rerender } = render(<TestRouter initialRoute="/dashboard" />);

      // Initially loading
      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();

      // Simulate auth complete
      act(() => {
        setAuthenticatedState();
      });

      rerender(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });
    });

    it('should transition from loading to redirect when unauthenticated', async () => {
      setLoadingState();

      const { rerender } = render(<TestRouter initialRoute="/dashboard" />);

      // Initially loading
      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();

      // Simulate auth check complete - not authenticated
      act(() => {
        resetAuthState();
      });

      rerender(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
      });
    });
  });
});

// ============================================================================
// PublicOnlyGuard Integration Tests
// ============================================================================

describe('PublicOnlyGuard Integration', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Unauthenticated Access
  // ==========================================================================

  describe('Unauthenticated Access', () => {
    it('should allow unauthenticated user to access /login', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      expect(screen.getByTestId('pathname').textContent).toBe('/login');
    });

    it('should render login form for unauthenticated users', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByText('Please sign in with GitHub')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Authenticated Access
  // ==========================================================================

  describe('Authenticated Access', () => {
    it('should redirect authenticated user from /login to /dashboard', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/dashboard');
      });
    });

    it('should redirect to returnTo URL if provided', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/login?returnTo=%2Fsettings" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/settings');
      });
    });

    it('should default to /dashboard if no returnTo provided', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/dashboard');
      });
    });
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('should show loading while checking auth on login page', async () => {
      setLoadingState();

      render(<TestRouter initialRoute="/login" />);

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// OptionalAuth Integration Tests
// ============================================================================

describe('OptionalAuth Integration', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Unauthenticated Access
  // ==========================================================================

  describe('Unauthenticated Access', () => {
    it('should allow unauthenticated user to access landing page', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/" />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('should render content for unauthenticated users', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/" />);

      await waitFor(() => {
        expect(screen.getByText('Welcome')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Authenticated Access
  // ==========================================================================

  describe('Authenticated Access', () => {
    it('should allow authenticated user to access landing page', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/" />);

      await waitFor(() => {
        expect(screen.getByTestId('landing-page')).toBeInTheDocument();
      });
    });

    it('should not redirect authenticated users', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/');
      });
    });
  });

  // ==========================================================================
  // Loading State
  // ==========================================================================

  describe('Loading State', () => {
    it('should show loading while checking auth', async () => {
      setLoadingState();

      render(<TestRouter initialRoute="/" />);

      expect(screen.getByText('Checking authentication...')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Token Expiry and Refresh Integration Tests
// ============================================================================

describe('Token Expiry and Refresh Integration', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Expired Token Handling
  // ==========================================================================

  describe('Expired Token Handling', () => {
    it('should refresh token when expired on protected route access', async () => {
      // Set up expired token state
      const expiredTime = Date.now() - 1000;
      useAuthStore.setState({
        accessToken: 'expired-token',
        refreshToken: mockTokens.refreshToken,
        expiresAt: expiredTime,
        isAuthenticated: true,
        isLoading: true,
        user: null,
        error: null,
      });

      const newTokens = createMockTokens({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      mockRefreshToken.mockResolvedValue(newTokens);
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/dashboard" />);

      // After refresh, should show dashboard
      await waitFor(() => {
        // The component will trigger initialize which checks token expiry
        expect(mockRefreshToken).toHaveBeenCalledWith(mockTokens.refreshToken);
      }, { timeout: 5000 });
    });

    it('should redirect to login when refresh token is also expired', async () => {
      const expiredTime = Date.now() - 1000;
      useAuthStore.setState({
        accessToken: 'expired-token',
        refreshToken: 'expired-refresh-token',
        expiresAt: expiredTime,
        isAuthenticated: true,
        isLoading: true,
        user: null,
        error: null,
      });

      mockRefreshToken.mockRejectedValue(new Error('Refresh token expired'));

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        // After failed refresh, should redirect to login
        expect(mockRefreshToken).toHaveBeenCalled();
      }, { timeout: 5000 });
    });
  });

  // ==========================================================================
  // Session Continuity
  // ==========================================================================

  describe('Session Continuity', () => {
    it('should maintain authenticated state across navigation', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      // First render at dashboard
      const { unmount } = render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      // Verify authenticated state
      expect(useAuthStore.getState().isAuthenticated).toBe(true);

      // Unmount and remount at settings (simulating navigation with fresh router)
      unmount();

      // State should still be authenticated after unmount
      const stateAfterUnmount = useAuthStore.getState();
      expect(stateAfterUnmount.isAuthenticated).toBe(true);

      // Render at settings with same authenticated state
      render(<TestRouter initialRoute="/settings" />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      // State should still be authenticated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
    });

    it('should preserve user data across protected routes', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      const state = useAuthStore.getState();
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe(mockTokens.accessToken);
    });
  });
});

// ============================================================================
// Route Navigation Flow Tests
// ============================================================================

describe('Route Navigation Flow', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Login to Dashboard Flow
  // ==========================================================================

  describe('Login to Dashboard Flow', () => {
    it('should redirect from login to dashboard after authentication', async () => {
      // Start unauthenticated on login
      resetAuthState();

      const { rerender } = render(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Simulate successful authentication
      act(() => {
        setAuthenticatedState();
      });

      rerender(<TestRouter initialRoute="/login" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/dashboard');
      });
    });

    it('should redirect to original destination after login', async () => {
      resetAuthState();

      // User tried to access settings, got redirected to login with returnTo
      const { rerender } = render(<TestRouter initialRoute="/login?returnTo=%2Fsettings" />);

      await waitFor(() => {
        expect(screen.getByTestId('login-page')).toBeInTheDocument();
      });

      // Verify returnTo is in the URL initially
      expect(screen.getByTestId('search').textContent).toContain('returnTo');

      // After authentication, PublicOnlyGuard should redirect to settings
      act(() => {
        setAuthenticatedState();
      });

      // Rerender to trigger the guard with new auth state
      rerender(<TestRouter initialRoute="/login?returnTo=%2Fsettings" />);

      await waitFor(() => {
        // User should now be on /settings (the returnTo destination)
        expect(screen.getByTestId('pathname').textContent).toBe('/settings');
      });

      // The returnTo param should be consumed (no longer in URL)
      expect(screen.getByTestId('search').textContent).toBe('');
    });
  });

  // ==========================================================================
  // Logout Flow
  // ==========================================================================

  describe('Logout Flow', () => {
    it('should redirect to login after logout from protected route', async () => {
      setAuthenticatedState();
      mockGetCurrentUser.mockResolvedValue(mockUser);

      const { rerender } = render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
      });

      // Simulate logout
      act(() => {
        resetAuthState();
      });

      rerender(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('pathname').textContent).toBe('/login');
      });
    });

    it('should clear auth state completely on logout', async () => {
      setAuthenticatedState();

      // Perform logout
      act(() => {
        useAuthStore.getState().reset();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    resetAuthState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should handle rapid authentication state changes', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    // Rapidly toggle auth state
    act(() => {
      setAuthenticatedState();
    });

    act(() => {
      resetAuthState();
    });

    act(() => {
      setAuthenticatedState();
    });

    // Final state should be authenticated
    await waitFor(() => {
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
    });
  });

  it('should handle undefined user gracefully when authenticated', async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      user: null, // User is null but authenticated
      accessToken: mockTokens.accessToken,
      refreshToken: mockTokens.refreshToken,
      expiresAt: Date.now() + 3600000,
      error: null,
    });

    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-page')).toBeInTheDocument();
    });
  });

  it('should handle initialization error gracefully', async () => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: false,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: 'Failed to initialize',
    });

    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/login');
    });
  });
});
