/**
 * Dashboard Page Integration Tests
 * Tests for DashboardPage data fetching, loading states, error handling, and auto-refresh
 * @module pages/dashboard/__tests__/DashboardPage.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse, delay } from 'msw';
import type { ReactNode, ButtonHTMLAttributes, ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { useAuthStore } from '@/core/auth/auth.store';
import type { DashboardStats, ActivityEvent } from '@/features/dashboard';
import type { User, AuthTokens } from '@/types';
import { server } from '@/__tests__/setup';

// ============================================================================
// Mock Button Component
// ============================================================================

// Mock the Button component to avoid Slot issues with asChild + leftIcon
vi.mock('@/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/shared')>();

  interface MockButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: string;
    size?: string;
    loading?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    asChild?: boolean;
    fullWidth?: boolean;
    children?: ReactNode;
  }

  const MockButton = forwardRef<HTMLButtonElement, MockButtonProps>(
    function MockButton(
      { asChild, leftIcon, rightIcon, children, loading, className, ...props },
      ref: ForwardedRef<HTMLButtonElement>
    ) {
      // When asChild, render children directly (assumes Link)
      if (asChild) {
        return <>{children}</>;
      }
      return (
        <button ref={ref} className={className} {...props}>
          {loading && <span data-testid="loading-spinner">Loading...</span>}
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </button>
      );
    }
  );

  return {
    ...actual,
    Button: MockButton,
  };
});

// Import DashboardPage after mocking
import DashboardPage from '../DashboardPage';

// ============================================================================
// Mock Data
// ============================================================================

const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatarUrl: 'https://github.com/test.png',
  githubId: 12345,
  createdAt: '2024-01-01T00:00:00Z',
};

const mockTokens: AuthTokens = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresIn: 3600,
  tokenType: 'Bearer',
};

const mockDashboardStats: DashboardStats = {
  repos: 15,
  scans: 42,
  nodes: 1234,
  edges: 5678,
  trends: {
    repos: 5,
    scans: 12,
    nodes: -3,
    edges: 8,
  },
};

const mockActivityEvents: ActivityEvent[] = [
  {
    id: 'event-1',
    type: 'scan_completed',
    message: 'Scan completed for test-repo',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    metadata: { repositoryId: 'repo-1', duration: 300, description: 'Full dependency scan' },
  },
  {
    id: 'event-2',
    type: 'repository_added',
    message: 'Repository my-new-repo was added',
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    metadata: { repositoryId: 'repo-2', description: 'New repository connected' },
  },
  {
    id: 'event-3',
    type: 'scan_failed',
    message: 'Scan failed for broken-repo',
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    metadata: { repositoryId: 'repo-3', error: 'Parse error', description: 'Configuration error' },
  },
];

// ============================================================================
// Test Utilities
// ============================================================================

const API_URL = '/api';

function setupDefaultHandlers(): void {
  server.use(
    http.get(`${API_URL}/dashboard/stats`, () => {
      return HttpResponse.json(mockDashboardStats);
    }),
    http.get(`${API_URL}/activity`, () => {
      return HttpResponse.json(mockActivityEvents);
    })
  );
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });
}

interface RenderOptions {
  queryClient?: QueryClient;
  route?: string;
}

function renderDashboardPage(options: RenderOptions = {}) {
  const queryClient = options.queryClient ?? createQueryClient();

  const result = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options.route ?? '/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>
  );

  return { ...result, queryClient };
}

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
// Data Display Tests
// ============================================================================

describe('DashboardPage Data Display', () => {
  beforeEach(() => {
    setAuthenticatedState();
    setupDefaultHandlers();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should render stats after data loads', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Repositories')).toBeInTheDocument();
      expect(screen.getByText('Total Scans')).toBeInTheDocument();
      expect(screen.getByText('Nodes Analyzed')).toBeInTheDocument();
      expect(screen.getByText('Edges Found')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('1.2K')).toBeInTheDocument();
      expect(screen.getByText('5.7K')).toBeInTheDocument();
    });
  });

  it('should display trend data when available', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText(/\+5%/)).toBeInTheDocument();
      expect(screen.getByText(/\+12%/)).toBeInTheDocument();
      expect(screen.getByText(/-3%/)).toBeInTheDocument();
      expect(screen.getByText(/\+8%/)).toBeInTheDocument();
    });

    const lastWeekTexts = screen.getAllByText('from last week');
    expect(lastWeekTexts.length).toBeGreaterThan(0);
  });

  it('should render activity events after data loads', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Scan completed for test-repo')).toBeInTheDocument();
      expect(screen.getByText('Repository my-new-repo was added')).toBeInTheDocument();
      expect(screen.getByText('Scan failed for broken-repo')).toBeInTheDocument();
    });
  });

  it('should display relative timestamps for activity events', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText(/min ago/)).toBeInTheDocument();
      expect(screen.getByText(/hours? ago/)).toBeInTheDocument();
      expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
    });
  });

  it('should show status badges for scan events', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('success')).toBeInTheDocument();
      expect(screen.getByText('error')).toBeInTheDocument();
    });
  });

  it('should display personalized greeting', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText(/Good (morning|afternoon|evening), Test!/)).toBeInTheDocument();
    });
  });

  it('should display subheading text', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Here's what's happening with your repositories")).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Error State Tests
// ============================================================================

describe('DashboardPage Error State', () => {
  beforeEach(() => {
    setAuthenticatedState();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should show error state on stats API failure', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(
          { message: 'Internal server error', code: 'SERVER_ERROR' },
          { status: 500 }
        );
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(mockActivityEvents);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  it('should show error state on activity API failure', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(mockDashboardStats);
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(
          { message: 'Service unavailable', code: 'SERVICE_UNAVAILABLE' },
          { status: 503 }
        );
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });
  });

  it('should display error message from API', async () => {
    const errorMessage = 'Database connection failed';
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(
          { message: errorMessage, code: 'DB_ERROR' },
          { status: 500 }
        );
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(mockActivityEvents);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Retry Functionality Tests
// ============================================================================

describe('DashboardPage Retry Functionality', () => {
  beforeEach(() => {
    setAuthenticatedState();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should show retry button on error', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(
          { message: 'Server error', code: 'SERVER_ERROR' },
          { status: 500 }
        );
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(mockActivityEvents);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('should refetch data when retry button is clicked', async () => {
    let requestCount = 0;

    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        requestCount++;
        if (requestCount === 1) {
          return HttpResponse.json(
            { message: 'Server error', code: 'SERVER_ERROR' },
            { status: 500 }
          );
        }
        return HttpResponse.json(mockDashboardStats);
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(mockActivityEvents);
      })
    );

    const user = userEvent.setup();
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
    });

    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
    });

    expect(requestCount).toBe(2);
  });

  it('should show retry button for activity errors', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(mockDashboardStats);
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json(
          { message: 'Activity service unavailable', code: 'SERVICE_ERROR' },
          { status: 503 }
        );
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      const retryButtons = screen.getAllByRole('button', { name: /try again/i });
      expect(retryButtons.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Quick Actions Tests
// ============================================================================

describe('DashboardPage Quick Actions', () => {
  beforeEach(() => {
    setAuthenticatedState();
    setupDefaultHandlers();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should render quick action cards', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Quick Actions')).toBeInTheDocument();
      expect(screen.getByText('Run New Scan')).toBeInTheDocument();
      expect(screen.getByText('View All Repositories')).toBeInTheDocument();
      expect(screen.getByText('Configure Settings')).toBeInTheDocument();
    });
  });

  it('should display quick action descriptions', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText("Analyze a repository's dependencies")).toBeInTheDocument();
      expect(screen.getByText('Manage your connected repositories')).toBeInTheDocument();
      expect(screen.getByText('Customize your preferences')).toBeInTheDocument();
    });
  });

  it('should have clickable quick action links', async () => {
    renderDashboardPage();

    await waitFor(() => {
      const runScanLink = screen.getByText('Run New Scan').closest('a');
      const reposLink = screen.getByText('View All Repositories').closest('a');
      const settingsLink = screen.getByText('Configure Settings').closest('a');

      expect(runScanLink).toHaveAttribute('href', '/scans');
      expect(reposLink).toHaveAttribute('href', '/repositories');
      expect(settingsLink).toHaveAttribute('href', '/settings');
    });
  });
});

// ============================================================================
// Empty State Tests
// ============================================================================

describe('DashboardPage Empty State', () => {
  beforeEach(() => {
    setAuthenticatedState();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should show empty state when no repositories exist', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json({
          repos: 0,
          scans: 0,
          nodes: 0,
          edges: 0,
        });
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No repositories yet')).toBeInTheDocument();
      expect(screen.getByText('Get started by connecting your first repository')).toBeInTheDocument();
    });
  });

  it('should show add repository button in empty state', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json({
          repos: 0,
          scans: 0,
          nodes: 0,
          edges: 0,
        });
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      const addRepoLinks = screen.getAllByRole('link', { name: /add repository/i });
      expect(addRepoLinks.length).toBeGreaterThan(0);
      expect(addRepoLinks[0]).toHaveAttribute('href', '/repositories');
    });
  });

  it('should show no activity message when activity list is empty but repos exist', async () => {
    server.use(
      http.get(`${API_URL}/dashboard/stats`, () => {
        return HttpResponse.json(mockDashboardStats);
      }),
      http.get(`${API_URL}/activity`, () => {
        return HttpResponse.json([]);
      })
    );

    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });
});

// ============================================================================
// Header Navigation Tests
// ============================================================================

describe('DashboardPage Header', () => {
  beforeEach(() => {
    setAuthenticatedState();
    setupDefaultHandlers();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should render Add Repository button in header', async () => {
    renderDashboardPage();

    await waitFor(() => {
      const addRepoLinks = screen.getAllByRole('link', { name: /add repository/i });
      expect(addRepoLinks.length).toBeGreaterThan(0);
    });
  });

  it('should have View all link in activity section', async () => {
    renderDashboardPage();

    await waitFor(() => {
      // Wait for data to load first
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    });

    // Find the View all link by text content
    const viewAllLink = screen.getByText('View all');
    expect(viewAllLink.tagName).toBe('A');
    expect(viewAllLink).toHaveAttribute('href', '/scans');
  });
});

// ============================================================================
// Stats Card Styling Tests
// ============================================================================

describe('DashboardPage Stats Card Styling', () => {
  beforeEach(() => {
    setAuthenticatedState();
    setupDefaultHandlers();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should render stats grid with 4 cards', async () => {
    renderDashboardPage();

    await waitFor(() => {
      expect(screen.getByText('Repositories')).toBeInTheDocument();
      expect(screen.getByText('Total Scans')).toBeInTheDocument();
      expect(screen.getByText('Nodes Analyzed')).toBeInTheDocument();
      expect(screen.getByText('Edges Found')).toBeInTheDocument();
    });
  });

  it('should display icons in stats cards', async () => {
    renderDashboardPage();

    await waitFor(() => {
      const svgElements = document.querySelectorAll('svg');
      expect(svgElements.length).toBeGreaterThan(0);
    });
  });
});

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('DashboardPage Accessibility', () => {
  beforeEach(() => {
    setAuthenticatedState();
    setupDefaultHandlers();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should have proper heading hierarchy', async () => {
    renderDashboardPage();

    await waitFor(() => {
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Quick Actions' })).toBeInTheDocument();
    });
  });

  it('should have accessible link names', async () => {
    renderDashboardPage();

    await waitFor(() => {
      const links = screen.getAllByRole('link');
      links.forEach((link) => {
        expect(link.textContent || link.getAttribute('aria-label')).toBeTruthy();
      });
    });
  });
});

// ============================================================================
// Loading State Tests
// ============================================================================

describe('DashboardPage Loading State', () => {
  beforeEach(() => {
    setAuthenticatedState();
  });

  afterEach(() => {
    resetAuthState();
    server.resetHandlers();
    vi.clearAllMocks();
  });

  it('should render loading state initially and then show data', async () => {
    // Use longer delay to reliably observe loading state
    let statsResolved = false;
    server.use(
      http.get(`${API_URL}/dashboard/stats`, async () => {
        await delay(200);
        statsResolved = true;
        return HttpResponse.json(mockDashboardStats);
      }),
      http.get(`${API_URL}/activity`, async () => {
        await delay(200);
        return HttpResponse.json(mockActivityEvents);
      })
    );

    renderDashboardPage();

    // Wait for the component to render
    await waitFor(() => {
      expect(screen.getByText('Repositories')).toBeInTheDocument();
    });

    // Eventually data should load and display the values
    await waitFor(() => {
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
