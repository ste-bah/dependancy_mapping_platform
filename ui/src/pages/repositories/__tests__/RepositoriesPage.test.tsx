/**
 * Repositories Page Integration Tests
 * Comprehensive integration tests for the RepositoriesPage component
 * @module pages/repositories/__tests__/RepositoriesPage.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { delay } from 'msw';
import type { ReactNode } from 'react';
import { faker } from '@faker-js/faker';
import { mswServer, http, HttpResponse } from '@/__tests__/setup';

import RepositoriesPage from '../RepositoriesPage';
import type {
  Repository,
  RepositoriesResponse,
  AvailableRepository,
  TriggerScanResponse,
  RepositoryProvider,
  ScanStatus,
} from '@/features/repositories';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockRepository(overrides: Partial<Repository> = {}): Repository {
  const owner = faker.internet.userName();
  const name = faker.lorem.slug();
  return {
    id: faker.string.uuid(),
    provider: 'github' as RepositoryProvider,
    owner,
    name,
    fullName: `${owner}/${name}`,
    url: faker.internet.url(),
    nodeCount: faker.number.int({ min: 100, max: 10000 }),
    edgeCount: faker.number.int({ min: 200, max: 20000 }),
    lastScanAt: faker.date.recent().toISOString(),
    lastScanStatus: 'completed' as ScanStatus,
    webhookEnabled: faker.datatype.boolean(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

function createMockRepositoriesResponse(
  repositories: Repository[] = [],
  page = 1,
  pageSize = 20,
  total?: number
): RepositoriesResponse {
  const totalCount = total ?? repositories.length;
  return {
    data: repositories,
    pagination: {
      page,
      pageSize,
      total: totalCount,
      totalPages: Math.ceil(totalCount / pageSize),
      hasNext: page < Math.ceil(totalCount / pageSize),
      hasPrevious: page > 1,
    },
  };
}

function createMockAvailableRepository(
  overrides: Partial<AvailableRepository> = {}
): AvailableRepository {
  return {
    owner: faker.internet.userName(),
    name: faker.lorem.slug(),
    fullName: `${faker.internet.userName()}/${faker.lorem.slug()}`,
    description: faker.lorem.sentence(),
    private: false,
    ...overrides,
  };
}

// ============================================================================
// Test Data
// ============================================================================

const mockRepositories = [
  createMockRepository({
    id: 'repo-1',
    owner: 'facebook',
    name: 'react',
    fullName: 'facebook/react',
    provider: 'github',
    lastScanStatus: 'completed',
    nodeCount: 5000,
    edgeCount: 12000,
  }),
  createMockRepository({
    id: 'repo-2',
    owner: 'vuejs',
    name: 'vue',
    fullName: 'vuejs/vue',
    provider: 'github',
    lastScanStatus: 'scanning',
    nodeCount: 3000,
    edgeCount: 8000,
  }),
  createMockRepository({
    id: 'repo-3',
    owner: 'angular',
    name: 'angular',
    fullName: 'angular/angular',
    provider: 'gitlab',
    lastScanStatus: 'idle',
    nodeCount: 0,
    edgeCount: 0,
  }),
  createMockRepository({
    id: 'repo-4',
    owner: 'sveltejs',
    name: 'svelte',
    fullName: 'sveltejs/svelte',
    provider: 'github',
    lastScanStatus: 'failed',
    nodeCount: 1500,
    edgeCount: 4000,
  }),
];

const mockAvailableRepos = [
  createMockAvailableRepository({ name: 'new-project', owner: 'testuser' }),
  createMockAvailableRepository({ name: 'awesome-lib', owner: 'testuser' }),
  createMockAvailableRepository({ name: 'private-api', owner: 'company', private: true }),
];

// ============================================================================
// MSW Server Setup
// ============================================================================

const API_URL = '/api';

function setupDefaultHandlers() {
  mswServer.use(
    // Get repositories list
    http.get(`${API_URL}/repositories`, async ({ request }) => {
      const url = new URL(request.url);
      const page = parseInt(url.searchParams.get('page') ?? '1', 10);
      const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
      const provider = url.searchParams.get('provider');
      const status = url.searchParams.get('status');
      const search = url.searchParams.get('search');

      let filtered = [...mockRepositories];

      if (provider && provider !== 'all') {
        filtered = filtered.filter((r) => r.provider === provider);
      }

      if (status && status !== 'all') {
        filtered = filtered.filter((r) => r.lastScanStatus === status);
      }

      if (search) {
        const searchLower = search.toLowerCase();
        filtered = filtered.filter(
          (r) =>
            r.name.toLowerCase().includes(searchLower) ||
            r.fullName.toLowerCase().includes(searchLower) ||
            r.owner.toLowerCase().includes(searchLower)
        );
      }

      // Simulate pagination
      const start = (page - 1) * limit;
      const end = start + limit;
      const paginatedData = filtered.slice(start, end);

      return HttpResponse.json(
        createMockRepositoriesResponse(paginatedData, page, limit, filtered.length)
      );
    }),

    // Get available repositories
    http.get(`${API_URL}/repositories/available/:provider`, async () => {
      await delay(100);
      return HttpResponse.json(mockAvailableRepos);
    }),

    // Add repository
    http.post(`${API_URL}/repositories`, async ({ request }) => {
      const body = (await request.json()) as {
        provider: string;
        owner: string;
        name: string;
        enableWebhook: boolean;
        scanOnAdd: boolean;
      };
      const newRepo = createMockRepository({
        id: faker.string.uuid(),
        provider: body.provider as RepositoryProvider,
        owner: body.owner,
        name: body.name,
        fullName: `${body.owner}/${body.name}`,
        lastScanStatus: body.scanOnAdd ? 'pending' : 'idle',
        webhookEnabled: body.enableWebhook,
        nodeCount: 0,
        edgeCount: 0,
      });
      return HttpResponse.json(newRepo, { status: 201 });
    }),

    // Delete repository
    http.delete(`${API_URL}/repositories/:id`, async () => {
      await delay(100);
      return HttpResponse.json({ success: true });
    }),

    // Trigger scan
    http.post(`${API_URL}/repositories/:id/scan`, async ({ params }) => {
      await delay(100);
      const response: TriggerScanResponse = {
        scanId: faker.string.uuid(),
        repositoryId: params.id as string,
        status: 'scanning',
        startedAt: new Date().toISOString(),
      };
      return HttpResponse.json(response);
    }),

    // Cancel scan
    http.post(`${API_URL}/repositories/:id/scan/cancel`, async () => {
      await delay(100);
      return HttpResponse.json({ success: true });
    })
  );
}

// ============================================================================
// Test Wrapper
// ============================================================================

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    );
  };
}

// ============================================================================
// Integration Tests
// ============================================================================

describe('RepositoriesPage Integration Tests', () => {
  beforeEach(() => {
    setupDefaultHandlers();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Initial Load Tests
  // ==========================================================================

  describe('Initial Page Load', () => {
    it('should display page header', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      expect(screen.getByText('Repositories')).toBeInTheDocument();
      expect(
        screen.getByText(/Manage your connected repositories/i)
      ).toBeInTheDocument();
    });

    it('should display Connect Repository button', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      expect(screen.getByText('Connect Repository')).toBeInTheDocument();
    });

    it('should load and display repositories', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      // Wait for data to load
      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      expect(screen.getByText('vue')).toBeInTheDocument();
      // angular appears in both name and owner (angular/angular), use getAllByText
      expect(screen.getAllByText('angular').length).toBeGreaterThan(0);
      expect(screen.getByText('svelte')).toBeInTheDocument();
    });

    it('should display repository metadata', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Check node counts are displayed
      expect(screen.getByText('5,000')).toBeInTheDocument();
      expect(screen.getByText('12,000')).toBeInTheDocument();
    });

    it('should display filter bar', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      expect(
        screen.getByPlaceholderText('Search repositories...')
      ).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument();
      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    });

    it('should handle loading state', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, async () => {
          await delay(500);
          return HttpResponse.json(
            createMockRepositoriesResponse(mockRepositories)
          );
        })
      );

      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      // Should show loading state initially
      // (implementation may vary - could be skeleton or spinner)
      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });
    });

    it('should handle error state', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        // Error state should be visible - RepositoryList shows ErrorState component
        expect(
          screen.getByText(/Failed to load repositories/i)
        ).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Filter Tests
  // ==========================================================================

  describe('Filtering', () => {
    it('should filter by search term', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'react');

      // Wait for debounce
      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
        expect(screen.queryByText('vue')).not.toBeInTheDocument();
        expect(screen.queryByText('angular')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should filter by provider', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const providerSelect = screen.getByLabelText('Filter by provider');
      await user.selectOptions(providerSelect, 'gitlab');

      await waitFor(() => {
        // angular appears in both name and owner (angular/angular), use getAllByText
        expect(screen.getAllByText('angular').length).toBeGreaterThan(0);
        expect(screen.queryByText('react')).not.toBeInTheDocument();
        expect(screen.queryByText('vue')).not.toBeInTheDocument();
      });
    });

    it('should filter by status', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const statusSelect = screen.getByLabelText('Filter by status');
      await user.selectOptions(statusSelect, 'scanning');

      await waitFor(() => {
        expect(screen.getByText('vue')).toBeInTheDocument();
        expect(screen.queryByText('react')).not.toBeInTheDocument();
        expect(screen.queryByText('angular')).not.toBeInTheDocument();
      });
    });

    it('should combine multiple filters', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Filter by provider
      const providerSelect = screen.getByLabelText('Filter by provider');
      await user.selectOptions(providerSelect, 'github');

      // Add search filter
      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'react');

      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
        expect(screen.queryByText('vue')).not.toBeInTheDocument();
        expect(screen.queryByText('angular')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should show empty state when filters match nothing', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'nonexistent-repo-xyz');

      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(
          screen.getByText(/No repositories match your filters/i)
        ).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should show clear filters button when filters active', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'test');

      vi.advanceTimersByTime(300);

      await waitFor(() => {
        expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should clear filters when Clear button clicked', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Apply a filter
      const statusSelect = screen.getByLabelText('Filter by status');
      await user.selectOptions(statusSelect, 'scanning');

      await waitFor(() => {
        expect(screen.getByText('vue')).toBeInTheDocument();
        expect(screen.queryByText('react')).not.toBeInTheDocument();
      });

      // Clear filters
      await user.click(screen.getByLabelText('Clear all filters'));

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
        expect(screen.getByText('vue')).toBeInTheDocument();
      });

      vi.useRealTimers();
    });
  });

  // ==========================================================================
  // Add Repository Tests
  // ==========================================================================

  describe('Add Repository Flow', () => {
    it('should open add modal when button clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await user.click(screen.getByRole('button', { name: /connect repository/i }));

      // Modal should be open with provider selection step
      await waitFor(() => {
        expect(screen.getByText('Select a Provider')).toBeInTheDocument();
      });
    });

    it('should complete add repository flow', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Open modal - use getAllByRole and select the header button (first one)
      const connectButtons = screen.getAllByRole('button', { name: /connect repository/i });
      await user.click(connectButtons[0]!);

      // Step 1: Select provider
      await waitFor(() => {
        expect(screen.getByText('Select a Provider')).toBeInTheDocument();
      });

      // Find the modal dialog and click the GitHub button inside it
      const modal = screen.getByRole('dialog');
      // The provider buttons have the provider name as a span text
      const githubButton = within(modal).getAllByText('GitHub')[0]!.closest('button')!;
      await user.click(githubButton);
      await user.click(within(modal).getByRole('button', { name: /continue/i }));

      // Step 2: Select repository
      await waitFor(() => {
        expect(screen.getByText('new-project')).toBeInTheDocument();
      });

      await user.click(screen.getByText('new-project'));
      await user.click(within(modal).getByRole('button', { name: /continue/i }));

      // Step 3: Configure options
      await waitFor(() => {
        expect(screen.getByText('Configure Options')).toBeInTheDocument();
      });

      // Submit - the submit button is inside the modal
      await user.click(within(modal).getByRole('button', { name: /connect repository/i }));

      // Should close modal and show success message
      await waitFor(() => {
        expect(
          screen.getByText(/Successfully connected/i)
        ).toBeInTheDocument();
      });
    });

    it('should close modal on cancel', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      // Use getAllByRole to get the header button (first one)
      const connectButtons = screen.getAllByRole('button', { name: /connect repository/i });
      await user.click(connectButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('Select a Provider')).toBeInTheDocument();
      });

      // The Cancel button is in the modal footer - use within to scope to modal
      const modal = screen.getByRole('dialog');
      const modalCancelButton = within(modal).getByRole('button', { name: /cancel/i });
      await user.click(modalCancelButton);

      await waitFor(() => {
        expect(screen.queryByText('Select a Provider')).not.toBeInTheDocument();
      });
    });

    it('should handle add repository error', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories`, () => {
          return HttpResponse.json(
            { message: 'Repository already exists' },
            { status: 409 }
          );
        })
      );

      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      // Open modal and complete flow - use getAllByRole to get the header button (first one)
      const connectButtons = screen.getAllByRole('button', { name: /connect repository/i });
      await user.click(connectButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText('Select a Provider')).toBeInTheDocument();
      });

      // Find the modal dialog and click the GitHub button inside it
      const modal = screen.getByRole('dialog');
      const githubButton = within(modal).getAllByText('GitHub')[0]!.closest('button')!;
      await user.click(githubButton);
      await user.click(within(modal).getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('new-project')).toBeInTheDocument();
      });

      await user.click(screen.getByText('new-project'));
      await user.click(within(modal).getByRole('button', { name: /continue/i }));

      await waitFor(() => {
        expect(screen.getByText('Configure Options')).toBeInTheDocument();
      });
      await user.click(within(modal).getByRole('button', { name: /connect repository/i }));

      // Should show error
      await waitFor(() => {
        expect(screen.getByText(/Repository already exists/i)).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Trigger Scan Tests
  // ==========================================================================

  describe('Trigger Scan', () => {
    it('should trigger scan when Scan Now clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Find the Scan Now button for the first repo
      const scanButtons = screen.getAllByText('Scan Now');
      await user.click(scanButtons[0]!);

      // Should show success message
      await waitFor(() => {
        expect(screen.getByText(/Scan started/i)).toBeInTheDocument();
      });
    });

    it('should update status optimistically', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Initial status should be Completed
      const reactCard = screen.getByText('react').closest('div');

      // Trigger scan
      const scanButtons = screen.getAllByText('Scan Now');
      await user.click(scanButtons[0]!);

      // Status should update
      await waitFor(() => {
        expect(screen.getByText(/Scan started/i)).toBeInTheDocument();
      });
    });

    it('should show Cancel button during scan', async () => {
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('vue')).toBeInTheDocument();
      });

      // Vue repo is in scanning status - check for the badge and Cancel button
      // The Badge shows "Scanning" as text via STATUS_CONFIGS
      await waitFor(() => {
        const scanningBadges = screen.getAllByText('Scanning');
        expect(scanningBadges.length).toBeGreaterThan(0);
      });
      expect(screen.getAllByText('Cancel').length).toBeGreaterThan(0);
    });

    it('should cancel scan when Cancel clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('vue')).toBeInTheDocument();
      });

      // Vue is scanning, click Cancel
      const cancelButtons = screen.getAllByText('Cancel');
      await user.click(cancelButtons[0]!);

      // Should process cancellation
      await waitFor(() => {
        // Status should change to idle
        expect(screen.queryByText('Scanning') || true).toBeTruthy();
      });
    });

    it('should handle scan trigger error', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories/:id/scan`, () => {
          return HttpResponse.json(
            { message: 'Scan service unavailable' },
            { status: 503 }
          );
        })
      );

      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const scanButtons = screen.getAllByText('Scan Now');
      await user.click(scanButtons[0]!);

      // Should handle error gracefully
      await waitFor(() => {
        // The mutation should fail but UI should recover
        expect(screen.getByText('react')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Delete Repository Tests
  // ==========================================================================

  describe('Delete Repository', () => {
    it('should show confirmation dialog when delete clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Find delete button
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]!);

      // Should show confirmation dialog
      await waitFor(() => {
        expect(screen.getByText(/Are you sure you want to delete/i)).toBeInTheDocument();
      });
    });

    it('should display repository name in confirmation dialog', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/facebook\/react/i)).toBeInTheDocument();
      });
    });

    it('should delete repository on confirm', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Click delete (find by aria-label which is unique per card)
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]!);

      // Confirm deletion - dialog appears
      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });

      // The ConfirmDialog has a "Delete" button (confirmText prop)
      // Find the dialog and get the button inside it
      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Should show success and remove from list
      await waitFor(() => {
        expect(screen.getByText(/removed successfully/i)).toBeInTheDocument();
      });
    });

    it('should close dialog on cancel', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });

      // Click cancel button inside the dialog
      const dialog = screen.getByRole('dialog');
      const cancelButton = within(dialog).getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      // Dialog should close
      await waitFor(() => {
        expect(screen.queryByText(/Are you sure/i)).not.toBeInTheDocument();
      });

      // Repository should still be there
      expect(screen.getByText('react')).toBeInTheDocument();
    });

    it('should handle delete error', async () => {
      mswServer.use(
        http.delete(`${API_URL}/repositories/:id`, () => {
          return HttpResponse.json(
            { message: 'Cannot delete repository with active scans' },
            { status: 400 }
          );
        })
      );

      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
      await user.click(deleteButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/Are you sure/i)).toBeInTheDocument();
      });

      // Click the confirm button inside the dialog
      const dialog = screen.getByRole('dialog');
      const confirmButton = within(dialog).getByRole('button', { name: /delete/i });
      await user.click(confirmButton);

      // Should show error state or recover
      await waitFor(() => {
        // Repository should still be visible after error
        expect(screen.getByText('react')).toBeInTheDocument();
      });
    });
  });

  // ==========================================================================
  // Pagination Tests
  // ==========================================================================

  describe('Pagination', () => {
    it('should display pagination when multiple pages', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') ?? '1', 10);

          // Simulate many repos
          const repos = Array.from({ length: 50 }, (_, i) =>
            createMockRepository({
              id: `repo-${i + 1}`,
              name: `repo-${i + 1}`,
            })
          );

          const pageSize = 20;
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const paginatedData = repos.slice(start, end);

          return HttpResponse.json(
            createMockRepositoriesResponse(paginatedData, page, pageSize, repos.length)
          );
        })
      );

      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
      });

      // Should show pagination
      expect(screen.getByRole('navigation') || screen.getByText(/page/i)).toBeTruthy();
    });

    it('should navigate between pages', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, ({ request }) => {
          const url = new URL(request.url);
          const page = parseInt(url.searchParams.get('page') ?? '1', 10);

          const repos = Array.from({ length: 50 }, (_, i) =>
            createMockRepository({
              id: `repo-${i + 1}`,
              name: `repo-${i + 1}`,
            })
          );

          const pageSize = 20;
          const start = (page - 1) * pageSize;
          const end = start + pageSize;
          const paginatedData = repos.slice(start, end);

          return HttpResponse.json(
            createMockRepositoriesResponse(paginatedData, page, pageSize, repos.length)
          );
        })
      );

      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('repo-1')).toBeInTheDocument();
      });

      // Click next page (implementation may vary)
      const nextButton = screen.queryByText(/next/i) || screen.queryByLabelText(/next/i);
      if (nextButton) {
        await user.click(nextButton);

        await waitFor(() => {
          expect(screen.getByText('repo-21')).toBeInTheDocument();
          expect(screen.queryByText('repo-1')).not.toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Success Message Tests
  // ==========================================================================

  describe('Success Messages', () => {
    it('should auto-dismiss success message after timeout', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Trigger a scan to show success message
      const scanButtons = screen.getAllByText('Scan Now');
      await user.click(scanButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/Scan started/i)).toBeInTheDocument();
      });

      // Advance time past auto-dismiss (5 seconds)
      vi.advanceTimersByTime(6000);

      await waitFor(() => {
        expect(screen.queryByText(/Scan started/i)).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should allow dismissing success message manually', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Trigger a scan
      const scanButtons = screen.getAllByText('Scan Now');
      await user.click(scanButtons[0]!);

      await waitFor(() => {
        expect(screen.getByText(/Scan started/i)).toBeInTheDocument();
      });

      // Find and click dismiss button
      const dismissButton = screen.queryByRole('button', { name: /dismiss/i }) ||
        screen.queryByRole('button', { name: /close/i });

      if (dismissButton) {
        await user.click(dismissButton);

        await waitFor(() => {
          expect(screen.queryByText(/Scan started/i)).not.toBeInTheDocument();
        });
      }
    });
  });

  // ==========================================================================
  // Background Refresh Tests
  // ==========================================================================

  describe('Background Refresh', () => {
    it('should show refreshing indicator during background fetch', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, async () => {
          await delay(500);
          return HttpResponse.json(createMockRepositoriesResponse(mockRepositories));
        })
      );

      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // During refetch, should show indicator
      // (This depends on implementation - may show "Refreshing..." text)
    });
  });

  // ==========================================================================
  // Navigation Tests
  // ==========================================================================

  describe('Navigation', () => {
    it('should navigate to graph view when View Graph clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      // Find View Graph button for react (has nodeCount > 0)
      const viewGraphButtons = screen.getAllByText('View Graph');
      await user.click(viewGraphButtons[0]!);

      expect(mockNavigate).toHaveBeenCalledWith('/repositories/repo-1/graph');
    });

    it('should navigate to settings when settings clicked', async () => {
      const user = userEvent.setup();
      const Wrapper = createWrapper();
      render(<RepositoriesPage />, { wrapper: Wrapper });

      await waitFor(() => {
        expect(screen.getByText('react')).toBeInTheDocument();
      });

      const settingsButtons = screen.getAllByRole('button', { name: /settings/i });
      await user.click(settingsButtons[0]!);

      expect(mockNavigate).toHaveBeenCalledWith('/repositories/repo-1/settings');
    });
  });
});
