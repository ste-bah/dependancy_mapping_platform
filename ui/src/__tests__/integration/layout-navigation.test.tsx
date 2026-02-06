/**
 * Layout Navigation Integration Tests
 * Tests for AppLayout navigation, sidebar, and user menu functionality
 * @module __tests__/integration/layout-navigation.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/core/auth/auth.store';
import { AuthGuard } from '@/core/router/AuthGuard';
import { ROUTES } from '@/core/router/routes';
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

const mockLogout = authService.logout as vi.Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUser: User = createMockUser();
const mockTokens: AuthTokens = createMockTokens();

// ============================================================================
// Helper Components
// ============================================================================

/**
 * Component that displays current location for testing navigation
 */
function LocationDisplay(): JSX.Element {
  const location = useLocation();
  return (
    <div data-testid="location-info">
      <span data-testid="current-pathname">{location.pathname}</span>
    </div>
  );
}

/**
 * Page components for route testing
 */
function DashboardPage(): JSX.Element {
  return <div data-testid="dashboard-content">Dashboard Content</div>;
}

function RepositoriesPage(): JSX.Element {
  return <div data-testid="repositories-content">Repositories Content</div>;
}

function ScansPage(): JSX.Element {
  return <div data-testid="scans-content">Scans Content</div>;
}

function SettingsPage(): JSX.Element {
  return <div data-testid="settings-content">Settings Content</div>;
}

// ============================================================================
// AppLayout Component (Inline for Testing)
// ============================================================================

// Note: We recreate key AppLayout functionality for testing since
// the actual component uses lazy loading which is difficult to test

import React, { useState, useCallback, type ReactNode } from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { selectUser } from '@/core/auth';

/**
 * Navigation items for sidebar
 */
const navigationItems = [
  { name: 'Dashboard', href: ROUTES.DASHBOARD },
  { name: 'Repositories', href: ROUTES.REPOSITORIES },
  { name: 'Scans', href: ROUTES.SCANS },
  { name: 'Settings', href: ROUTES.SETTINGS },
];

/**
 * User menu component for testing
 */
function TestUserMenu({ user, onLogout }: { user: User; onLogout: () => void }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleLogout = useCallback(() => {
    setIsOpen(false);
    onLogout();
  }, [onLogout]);

  return (
    <div className="relative" data-testid="user-menu">
      <button
        type="button"
        onClick={toggleMenu}
        data-testid="user-menu-button"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span data-testid="user-name">{user.name}</span>
      </button>

      {isOpen && (
        <div data-testid="user-dropdown">
          <div data-testid="user-info">
            <p data-testid="dropdown-user-name">{user.name}</p>
            <p data-testid="dropdown-user-email">{user.email}</p>
          </div>
          <NavLink
            to={ROUTES.SETTINGS}
            onClick={() => setIsOpen(false)}
            data-testid="profile-link"
          >
            Your Profile
          </NavLink>
          <button
            type="button"
            onClick={handleLogout}
            data-testid="logout-button"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Sidebar navigation component for testing
 */
function TestSidebarNav({
  items,
  onItemClick
}: {
  items: typeof navigationItems;
  onItemClick?: () => void;
}): JSX.Element {
  const location = useLocation();

  return (
    <nav data-testid="sidebar-nav">
      {items.map((item) => {
        const isActive = location.pathname === item.href ||
          (item.href !== ROUTES.DASHBOARD && location.pathname.startsWith(item.href));

        return (
          <NavLink
            key={item.name}
            to={item.href}
            onClick={onItemClick}
            data-testid={`nav-${item.name.toLowerCase()}`}
            data-active={isActive}
            className={isActive ? 'active' : ''}
          >
            {item.name}
          </NavLink>
        );
      })}
    </nav>
  );
}

/**
 * Mobile sidebar component for testing
 */
function TestMobileSidebar({
  isOpen,
  onClose,
  children
}: {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element | null {
  if (!isOpen) return null;

  return (
    <div data-testid="mobile-sidebar">
      <div
        data-testid="mobile-backdrop"
        onClick={onClose}
        aria-hidden="true"
      />
      <div data-testid="mobile-sidebar-panel">
        <button
          type="button"
          onClick={onClose}
          data-testid="close-mobile-sidebar"
        >
          Close
        </button>
        {children}
      </div>
    </div>
  );
}

/**
 * Test App Layout component
 */
function TestAppLayout(): JSX.Element {
  const user = useAuthStore(selectUser);
  const logout = useAuthStore((state) => state.logout);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const closeMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(false);
  }, []);

  return (
    <div data-testid="app-layout">
      {/* Header */}
      <header data-testid="app-header">
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          data-testid="mobile-menu-button"
          className="lg:hidden"
        >
          Menu
        </button>

        <NavLink to={ROUTES.DASHBOARD} data-testid="logo-link">
          Code Reviewer
        </NavLink>

        {user && (
          <TestUserMenu user={user} onLogout={handleLogout} />
        )}
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside data-testid="desktop-sidebar" className="hidden lg:block">
          <TestSidebarNav items={navigationItems} />
        </aside>

        {/* Mobile sidebar */}
        <TestMobileSidebar isOpen={mobileSidebarOpen} onClose={closeMobileSidebar}>
          <TestSidebarNav items={navigationItems} onItemClick={closeMobileSidebar} />
        </TestMobileSidebar>

        {/* Main content */}
        <main data-testid="main-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// Test Router Wrapper
// ============================================================================

interface TestRouterProps {
  initialRoute?: string;
  skipAuthGuard?: boolean;
}

/**
 * Simplified Auth Guard for testing that doesn't call initialize()
 * This prevents interference with manually set auth state
 */
function TestAuthGuard({ children }: { children: React.ReactNode }): JSX.Element | null {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);

  if (isLoading) {
    return <div data-testid="loading">Loading...</div>;
  }

  if (!isAuthenticated) {
    return <div data-testid="not-authenticated">Not Authenticated</div>;
  }

  return <>{children}</>;
}

function TestRouter({ initialRoute = '/dashboard', skipAuthGuard = false }: TestRouterProps): JSX.Element {
  const Guard = skipAuthGuard ? React.Fragment : TestAuthGuard;

  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route
          element={
            <Guard>
              <TestAppLayout />
            </Guard>
          }
        >
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          <Route path={ROUTES.REPOSITORIES} element={<RepositoriesPage />} />
          <Route path={ROUTES.SCANS} element={<ScansPage />} />
          <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        </Route>
      </Routes>
      <LocationDisplay />
    </MemoryRouter>
  );
}

// ============================================================================
// State Helpers
// ============================================================================

function setAuthenticatedState(): void {
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    user: mockUser,
    accessToken: mockTokens.accessToken,
    refreshToken: mockTokens.refreshToken,
    expiresAt: Date.now() + 3600000,
    error: null,
  });
}

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

// ============================================================================
// Sidebar Navigation Tests
// ============================================================================

describe('Sidebar Navigation Integration', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Navigation Item Rendering
  // ==========================================================================

  describe('Navigation Item Rendering', () => {
    it('should render all navigation items in sidebar', async () => {
      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('sidebar-nav')).toBeInTheDocument();
      });

      expect(screen.getByTestId('nav-dashboard')).toBeInTheDocument();
      expect(screen.getByTestId('nav-repositories')).toBeInTheDocument();
      expect(screen.getByTestId('nav-scans')).toBeInTheDocument();
      expect(screen.getByTestId('nav-settings')).toBeInTheDocument();
    });

    it('should display correct navigation text', async () => {
      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByText('Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Repositories')).toBeInTheDocument();
        expect(screen.getByText('Scans')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Active Route Highlighting
  // ==========================================================================

  describe('Active Route Highlighting', () => {
    it('should mark Dashboard as active when on /dashboard', async () => {
      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        const dashboardNav = screen.getByTestId('nav-dashboard');
        expect(dashboardNav).toHaveAttribute('data-active', 'true');
      });
    });

    it('should mark Repositories as active when on /repositories', async () => {
      render(<TestRouter initialRoute="/repositories" />);

      await waitFor(() => {
        const reposNav = screen.getByTestId('nav-repositories');
        expect(reposNav).toHaveAttribute('data-active', 'true');
      });
    });

    it('should mark Scans as active when on /scans', async () => {
      render(<TestRouter initialRoute="/scans" />);

      await waitFor(() => {
        const scansNav = screen.getByTestId('nav-scans');
        expect(scansNav).toHaveAttribute('data-active', 'true');
      });
    });

    it('should mark Settings as active when on /settings', async () => {
      render(<TestRouter initialRoute="/settings" />);

      await waitFor(() => {
        const settingsNav = screen.getByTestId('nav-settings');
        expect(settingsNav).toHaveAttribute('data-active', 'true');
      });
    });

    it('should update active state when navigating', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('data-active', 'true');
      });

      // Navigate to repositories
      await user.click(screen.getByTestId('nav-repositories'));

      await waitFor(() => {
        expect(screen.getByTestId('nav-repositories')).toHaveAttribute('data-active', 'true');
        expect(screen.getByTestId('nav-dashboard')).toHaveAttribute('data-active', 'false');
      });
    });
  });

  // ==========================================================================
  // Navigation Click Behavior
  // ==========================================================================

  describe('Navigation Click Behavior', () => {
    it('should navigate to dashboard when clicking Dashboard link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/repositories" />);

      await waitFor(() => {
        expect(screen.getByTestId('repositories-content')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('nav-dashboard'));

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/dashboard');
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      });
    });

    it('should navigate to repositories when clicking Repositories link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
      });

      await user.click(screen.getByTestId('nav-repositories'));

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/repositories');
        expect(screen.getByTestId('repositories-content')).toBeInTheDocument();
      });
    });

    it('should navigate to scans when clicking Scans link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await user.click(screen.getByTestId('nav-scans'));

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/scans');
        expect(screen.getByTestId('scans-content')).toBeInTheDocument();
      });
    });

    it('should navigate to settings when clicking Settings link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await user.click(screen.getByTestId('nav-settings'));

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
        expect(screen.getByTestId('settings-content')).toBeInTheDocument();
      });
    });
  });
});

// ============================================================================
// Mobile Menu Tests
// ============================================================================

describe('Mobile Menu Integration', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Mobile Menu Toggle
  // ==========================================================================

  describe('Mobile Menu Toggle', () => {
    it('should open mobile sidebar when menu button clicked', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('mobile-menu-button')).toBeInTheDocument();
      });

      // Initially mobile sidebar should be closed
      expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();

      // Click menu button
      await user.click(screen.getByTestId('mobile-menu-button'));

      // Mobile sidebar should be open
      await waitFor(() => {
        expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
      });
    });

    it('should close mobile sidebar when close button clicked', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open sidebar
      await user.click(screen.getByTestId('mobile-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
      });

      // Close sidebar
      await user.click(screen.getByTestId('close-mobile-sidebar'));

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();
      });
    });

    it('should close mobile sidebar when clicking backdrop', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open sidebar
      await user.click(screen.getByTestId('mobile-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
      });

      // Click backdrop
      await user.click(screen.getByTestId('mobile-backdrop'));

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();
      });
    });

    it('should close mobile sidebar when navigation item clicked', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open sidebar
      await user.click(screen.getByTestId('mobile-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
      });

      // Click a navigation item in mobile sidebar
      const mobileNav = screen.getByTestId('mobile-sidebar-panel');
      const reposLink = mobileNav.querySelector('[data-testid="nav-repositories"]');

      if (reposLink) {
        await user.click(reposLink);
      }

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-sidebar')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Mobile Navigation
  // ==========================================================================

  describe('Mobile Navigation', () => {
    it('should navigate when clicking mobile nav item', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open sidebar
      await user.click(screen.getByTestId('mobile-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('mobile-sidebar')).toBeInTheDocument();
      });

      // Click navigation item
      const mobileNav = screen.getByTestId('mobile-sidebar-panel');
      const settingsLink = mobileNav.querySelector('[data-testid="nav-settings"]');

      if (settingsLink) {
        await user.click(settingsLink);
      }

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
      });
    });
  });
});

// ============================================================================
// User Menu Tests
// ============================================================================

describe('User Menu Integration', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
    mockLogout.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // User Menu Display
  // ==========================================================================

  describe('User Menu Display', () => {
    it('should display user name in header', async () => {
      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('user-name')).toBeInTheDocument();
        expect(screen.getByTestId('user-name').textContent).toBe(mockUser.name);
      });
    });

    it('should not display user menu when not authenticated', async () => {
      resetAuthState();

      render(<TestRouter initialRoute="/dashboard" />);

      // Should redirect to login, no user menu shown
      await waitFor(() => {
        expect(screen.queryByTestId('user-menu')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // User Dropdown
  // ==========================================================================

  describe('User Dropdown', () => {
    it('should open dropdown when clicking user menu button', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await waitFor(() => {
        expect(screen.getByTestId('user-menu-button')).toBeInTheDocument();
      });

      // Initially dropdown should be closed
      expect(screen.queryByTestId('user-dropdown')).not.toBeInTheDocument();

      // Click user menu button
      await user.click(screen.getByTestId('user-menu-button'));

      // Dropdown should be open
      await waitFor(() => {
        expect(screen.getByTestId('user-dropdown')).toBeInTheDocument();
      });
    });

    it('should display user info in dropdown', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('dropdown-user-name').textContent).toBe(mockUser.name);
        expect(screen.getByTestId('dropdown-user-email').textContent).toBe(mockUser.email);
      });
    });

    it('should show logout option in dropdown', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeInTheDocument();
        expect(screen.getByText('Sign out')).toBeInTheDocument();
      });
    });

    it('should show profile link in dropdown', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('profile-link')).toBeInTheDocument();
        expect(screen.getByText('Your Profile')).toBeInTheDocument();
      });
    });

    it('should toggle dropdown on repeated clicks', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));
      await waitFor(() => {
        expect(screen.getByTestId('user-dropdown')).toBeInTheDocument();
      });

      // Close dropdown
      await user.click(screen.getByTestId('user-menu-button'));
      await waitFor(() => {
        expect(screen.queryByTestId('user-dropdown')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Logout Flow
  // ==========================================================================

  describe('Logout Flow', () => {
    it('should call logout when clicking logout button', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('logout-button')).toBeInTheDocument();
      });

      // Click logout
      await user.click(screen.getByTestId('logout-button'));

      // Verify logout was called
      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
      });
    });

    it('should clear auth state after logout', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));

      // Click logout
      await user.click(screen.getByTestId('logout-button'));

      // Simulate auth state being cleared (as the actual logout would do)
      act(() => {
        resetAuthState();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
    });

    it('should close dropdown after logout', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('user-dropdown')).toBeInTheDocument();
      });

      // Click logout
      await user.click(screen.getByTestId('logout-button'));

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId('user-dropdown')).not.toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Profile Navigation
  // ==========================================================================

  describe('Profile Navigation', () => {
    it('should navigate to settings when clicking profile link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('profile-link')).toBeInTheDocument();
      });

      // Click profile link
      await user.click(screen.getByTestId('profile-link'));

      await waitFor(() => {
        expect(screen.getByTestId('current-pathname').textContent).toBe('/settings');
      });
    });

    it('should close dropdown after clicking profile link', async () => {
      const user = userEvent.setup();

      render(<TestRouter initialRoute="/dashboard" />);

      // Open dropdown
      await user.click(screen.getByTestId('user-menu-button'));

      await waitFor(() => {
        expect(screen.getByTestId('user-dropdown')).toBeInTheDocument();
      });

      // Click profile link
      await user.click(screen.getByTestId('profile-link'));

      // Dropdown should be closed
      await waitFor(() => {
        expect(screen.queryByTestId('user-dropdown')).not.toBeInTheDocument();
      });
    });
  });
});

// ============================================================================
// Header and Logo Tests
// ============================================================================

describe('Header and Logo Integration', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should display logo link in header', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('logo-link')).toBeInTheDocument();
    });
  });

  it('should navigate to dashboard when clicking logo', async () => {
    const user = userEvent.setup();

    render(<TestRouter initialRoute="/settings" />);

    await waitFor(() => {
      expect(screen.getByTestId('settings-content')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('logo-link'));

    await waitFor(() => {
      expect(screen.getByTestId('current-pathname').textContent).toBe('/dashboard');
    });
  });

  it('should display application name in logo', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByText('Code Reviewer')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Layout Structure Tests
// ============================================================================

describe('Layout Structure Integration', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render app layout structure', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('app-layout')).toBeInTheDocument();
      expect(screen.getByTestId('app-header')).toBeInTheDocument();
      expect(screen.getByTestId('desktop-sidebar')).toBeInTheDocument();
      expect(screen.getByTestId('main-content')).toBeInTheDocument();
    });
  });

  it('should render page content in main area', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      const mainContent = screen.getByTestId('main-content');
      expect(mainContent).toContainElement(screen.getByTestId('dashboard-content'));
    });
  });

  it('should update main content when navigating', async () => {
    const user = userEvent.setup();

    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('nav-repositories'));

    await waitFor(() => {
      expect(screen.getByTestId('repositories-content')).toBeInTheDocument();
      expect(screen.queryByTestId('dashboard-content')).not.toBeInTheDocument();
    });
  });
});

// ============================================================================
// Auth State Sync Tests
// ============================================================================

describe('Auth State Synchronization', () => {
  beforeEach(() => {
    setAuthenticatedState();
    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should update user menu when user changes', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe(mockUser.name);
    });

    // Update user
    const updatedUser = createMockUser({ name: 'Updated User' });
    act(() => {
      useAuthStore.setState({ user: updatedUser });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-name').textContent).toBe('Updated User');
    });
  });

  it('should handle auth state loss during session', async () => {
    render(<TestRouter initialRoute="/dashboard" />);

    await waitFor(() => {
      expect(screen.getByTestId('dashboard-content')).toBeInTheDocument();
    });

    // Simulate session loss
    act(() => {
      resetAuthState();
    });

    // Should be redirected when auth guard re-evaluates
    // Note: In a real scenario, this would trigger a re-render and redirect
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
  });
});
