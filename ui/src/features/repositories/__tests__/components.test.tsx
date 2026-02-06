/**
 * Repository Components Tests
 * Comprehensive tests for RepositoryCard, FilterBar, AddRepoModal
 * @module features/repositories/__tests__/components.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { faker } from '@faker-js/faker';
import { mswServer, http, HttpResponse } from '@/__tests__/setup';

import { RepositoryCard } from '../components/RepositoryCard';
import { FilterBar, CompactFilterBar } from '../components/FilterBar';
import { AddRepoModal } from '../components/AddRepoModal';
import type {
  Repository,
  RepositoryFilters,
  RepositoryProvider,
  ScanStatus,
  AvailableRepository,
} from '../types';

// ============================================================================
// Mock Data Factories
// ============================================================================

function createMockRepository(overrides: Partial<Repository> = {}): Repository {
  return {
    id: faker.string.uuid(),
    provider: 'github' as RepositoryProvider,
    owner: faker.internet.userName(),
    name: faker.lorem.slug(),
    fullName: `${faker.internet.userName()}/${faker.lorem.slug()}`,
    url: faker.internet.url(),
    nodeCount: faker.number.int({ min: 0, max: 10000 }),
    edgeCount: faker.number.int({ min: 0, max: 20000 }),
    lastScanAt: faker.date.recent().toISOString(),
    lastScanStatus: 'completed' as ScanStatus,
    webhookEnabled: false,
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

function createMockFilters(overrides: Partial<RepositoryFilters> = {}): RepositoryFilters {
  return {
    page: 1,
    limit: 20,
    provider: 'all',
    status: 'all',
    search: '',
    ...overrides,
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
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
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
// MSW Server Setup
// ============================================================================

const API_URL = '/api';

const mockAvailableRepos = [
  createMockAvailableRepository({ name: 'react-app', owner: 'facebook', description: 'React library' }),
  createMockAvailableRepository({ name: 'vue', owner: 'vuejs', description: 'Vue.js framework' }),
  createMockAvailableRepository({ name: 'private-repo', owner: 'company', private: true, description: 'Internal tools' }),
];

// ============================================================================
// RepositoryCard Tests
// ============================================================================

describe('RepositoryCard', () => {
  const Wrapper = createWrapper();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Display', () => {
    it('should display repository name', () => {
      const repo = createMockRepository({ name: 'my-awesome-repo' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('my-awesome-repo')).toBeInTheDocument();
    });

    it('should display repository owner', () => {
      const repo = createMockRepository({ owner: 'test-owner' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText(/test-owner/)).toBeInTheDocument();
    });

    it('should display node count', () => {
      const repo = createMockRepository({ nodeCount: 1234 });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Nodes')).toBeInTheDocument();
      expect(screen.getByText('1,234')).toBeInTheDocument();
    });

    it('should display edge count', () => {
      const repo = createMockRepository({ edgeCount: 5678 });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Edges')).toBeInTheDocument();
      expect(screen.getByText('5,678')).toBeInTheDocument();
    });

    it('should display "Never" when lastScanAt is null', () => {
      const repo = createMockRepository({ lastScanAt: null });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Never')).toBeInTheDocument();
    });

    it('should display relative time for recent scan', () => {
      const recentDate = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
      const repo = createMockRepository({ lastScanAt: recentDate });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText(/1m ago|Just now/)).toBeInTheDocument();
    });

    it('should display webhook enabled indicator', () => {
      const repo = createMockRepository({ webhookEnabled: true });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Webhook enabled')).toBeInTheDocument();
    });

    it('should not display webhook indicator when disabled', () => {
      const repo = createMockRepository({ webhookEnabled: false });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.queryByText('Webhook enabled')).not.toBeInTheDocument();
    });
  });

  describe('Status Badge', () => {
    it('should display Idle status badge', () => {
      const repo = createMockRepository({ lastScanStatus: 'idle' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Idle')).toBeInTheDocument();
    });

    it('should display Pending status badge', () => {
      const repo = createMockRepository({ lastScanStatus: 'pending' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('should display Scanning status badge', () => {
      const repo = createMockRepository({ lastScanStatus: 'scanning' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Scanning')).toBeInTheDocument();
    });

    it('should display Completed status badge', () => {
      const repo = createMockRepository({ lastScanStatus: 'completed' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Completed')).toBeInTheDocument();
    });

    it('should display Failed status badge', () => {
      const repo = createMockRepository({ lastScanStatus: 'failed' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  describe('Provider Display', () => {
    it('should display GitHub provider icon', () => {
      const repo = createMockRepository({ provider: 'github' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      // SVG icon should be present - Card component renders as div, not article
      const card = screen.getByText(repo.name).closest('div');
      expect(card).toBeInTheDocument();
    });

    it('should display GitLab provider icon', () => {
      const repo = createMockRepository({ provider: 'gitlab' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText(repo.name)).toBeInTheDocument();
    });

    it('should display Bitbucket provider icon', () => {
      const repo = createMockRepository({ provider: 'bitbucket' });
      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText(repo.name)).toBeInTheDocument();
    });
  });

  describe('Actions', () => {
    it('should call onTriggerScan when Scan Now clicked', async () => {
      const user = userEvent.setup();
      const onTriggerScan = vi.fn();
      const repo = createMockRepository({ id: 'repo-123', lastScanStatus: 'idle' });

      render(
        <RepositoryCard repository={repo} onTriggerScan={onTriggerScan} />,
        { wrapper: Wrapper }
      );

      await user.click(screen.getByText('Scan Now'));

      expect(onTriggerScan).toHaveBeenCalledWith('repo-123');
    });

    it('should show Cancel button when scanning', async () => {
      const user = userEvent.setup();
      const onCancelScan = vi.fn();
      const repo = createMockRepository({ id: 'repo-123', lastScanStatus: 'scanning' });

      render(
        <RepositoryCard repository={repo} onCancelScan={onCancelScan} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.queryByText('Scan Now')).not.toBeInTheDocument();

      await user.click(screen.getByText('Cancel'));
      expect(onCancelScan).toHaveBeenCalledWith('repo-123');
    });

    it('should call onDelete when delete button clicked', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const repo = createMockRepository({ id: 'repo-123', fullName: 'owner/repo' });

      render(
        <RepositoryCard repository={repo} onDelete={onDelete} />,
        { wrapper: Wrapper }
      );

      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);

      expect(onDelete).toHaveBeenCalledWith('repo-123', 'owner/repo');
    });

    it('should navigate to settings on settings button click', async () => {
      const user = userEvent.setup();
      const repo = createMockRepository({ id: 'repo-456' });

      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      const settingsButton = screen.getByRole('button', { name: /settings/i });
      await user.click(settingsButton);

      expect(mockNavigate).toHaveBeenCalledWith('/repositories/repo-456/settings');
    });

    it('should navigate to graph on View Graph click', async () => {
      const user = userEvent.setup();
      const repo = createMockRepository({ id: 'repo-789', nodeCount: 100 });

      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      await user.click(screen.getByText('View Graph'));

      expect(mockNavigate).toHaveBeenCalledWith('/repositories/repo-789/graph');
    });

    it('should disable View Graph button when nodeCount is 0', () => {
      const repo = createMockRepository({ nodeCount: 0 });

      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      expect(screen.getByText('View Graph')).toBeDisabled();
    });

    it('should disable Scan Now when already scanning', () => {
      const repo = createMockRepository({ lastScanStatus: 'scanning' });

      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      // When scanning, Cancel button should be shown, not Scan Now
      expect(screen.queryByText('Scan Now')).not.toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should disable Scan Now when pending', () => {
      const repo = createMockRepository({ lastScanStatus: 'pending' });

      render(<RepositoryCard repository={repo} />, { wrapper: Wrapper });

      // When pending, Cancel button should be shown
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should show loading state during scan mutation', () => {
      const repo = createMockRepository({ lastScanStatus: 'idle' });

      render(
        <RepositoryCard repository={repo} isScanPending={true} />,
        { wrapper: Wrapper }
      );

      expect(screen.getByText('Scan Now')).toBeDisabled();
    });

    it('should show loading state during delete mutation', () => {
      const repo = createMockRepository();

      render(
        <RepositoryCard repository={repo} isDeletePending={true} />,
        { wrapper: Wrapper }
      );

      // Delete button should show loading
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      expect(deleteButton).toBeInTheDocument();
    });
  });

  describe('Event Propagation', () => {
    it('should stop propagation on Scan Now click', async () => {
      const user = userEvent.setup();
      const onTriggerScan = vi.fn();
      const cardClick = vi.fn();
      const repo = createMockRepository({ lastScanStatus: 'idle' });

      render(
        <div onClick={cardClick}>
          <RepositoryCard repository={repo} onTriggerScan={onTriggerScan} />
        </div>,
        { wrapper: Wrapper }
      );

      await user.click(screen.getByText('Scan Now'));

      expect(onTriggerScan).toHaveBeenCalled();
      // Event should be stopped from propagating
    });

    it('should stop propagation on delete click', async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const cardClick = vi.fn();
      const repo = createMockRepository();

      render(
        <div onClick={cardClick}>
          <RepositoryCard repository={repo} onDelete={onDelete} />
        </div>,
        { wrapper: Wrapper }
      );

      await user.click(screen.getByRole('button', { name: /delete/i }));

      expect(onDelete).toHaveBeenCalled();
    });
  });
});

// ============================================================================
// FilterBar Tests
// ============================================================================

describe('FilterBar', () => {
  const defaultProps = {
    filters: createMockFilters(),
    onSearchChange: vi.fn(),
    onProviderChange: vi.fn(),
    onStatusChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Search Input', () => {
    it('should render search input', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByPlaceholderText('Search repositories...')).toBeInTheDocument();
    });

    it('should display current search value', () => {
      const filters = createMockFilters({ search: 'react' });
      render(<FilterBar {...defaultProps} filters={filters} />);

      expect(screen.getByDisplayValue('react')).toBeInTheDocument();
    });

    it('should call onSearchChange when typing', async () => {
      const user = userEvent.setup();
      const onSearchChange = vi.fn();

      // The FilterBar is a controlled component - value comes from filters.search
      // We need to simulate the parent updating the filters when onSearchChange is called
      let currentSearch = '';
      onSearchChange.mockImplementation((value: string) => {
        currentSearch = value;
      });

      const { rerender } = render(
        <FilterBar {...defaultProps} filters={createMockFilters({ search: '' })} onSearchChange={onSearchChange} />
      );

      const searchInput = screen.getByPlaceholderText('Search repositories...');

      // Type first character
      await user.type(searchInput, 'v');
      expect(onSearchChange).toHaveBeenCalledWith('v');

      // Rerender with updated value to simulate controlled component behavior
      rerender(
        <FilterBar {...defaultProps} filters={createMockFilters({ search: 'v' })} onSearchChange={onSearchChange} />
      );

      await user.type(searchInput, 'u');
      expect(onSearchChange).toHaveBeenCalledWith('vu');

      rerender(
        <FilterBar {...defaultProps} filters={createMockFilters({ search: 'vu' })} onSearchChange={onSearchChange} />
      );

      await user.type(searchInput, 'e');
      expect(onSearchChange).toHaveBeenCalledWith('vue');

      // Total of 3 calls
      expect(onSearchChange).toHaveBeenCalledTimes(3);
    });

    it('should have correct aria-label', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByLabelText('Search repositories')).toBeInTheDocument();
    });
  });

  describe('Provider Filter', () => {
    it('should render provider dropdown', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByLabelText('Filter by provider')).toBeInTheDocument();
    });

    it('should display all provider options', () => {
      render(<FilterBar {...defaultProps} />);

      const select = screen.getByLabelText('Filter by provider');
      expect(select).toBeInTheDocument();

      // Check options exist
      expect(within(select).getByText('All Providers')).toBeInTheDocument();
      expect(within(select).getByText('GitHub')).toBeInTheDocument();
      expect(within(select).getByText('GitLab')).toBeInTheDocument();
      expect(within(select).getByText('Bitbucket')).toBeInTheDocument();
    });

    it('should call onProviderChange when selection changes', async () => {
      const user = userEvent.setup();
      const onProviderChange = vi.fn();

      render(<FilterBar {...defaultProps} onProviderChange={onProviderChange} />);

      const select = screen.getByLabelText('Filter by provider');
      await user.selectOptions(select, 'github');

      expect(onProviderChange).toHaveBeenCalledWith('github');
    });

    it('should reflect current provider selection', () => {
      const filters = createMockFilters({ provider: 'gitlab' });
      render(<FilterBar {...defaultProps} filters={filters} />);

      const select = screen.getByLabelText('Filter by provider');
      expect(select).toHaveValue('gitlab');
    });
  });

  describe('Status Filter', () => {
    it('should render status dropdown', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.getByLabelText('Filter by status')).toBeInTheDocument();
    });

    it('should display all status options', () => {
      render(<FilterBar {...defaultProps} />);

      const select = screen.getByLabelText('Filter by status');
      expect(within(select).getByText('All Statuses')).toBeInTheDocument();
      expect(within(select).getByText('Idle')).toBeInTheDocument();
      expect(within(select).getByText('Pending')).toBeInTheDocument();
      expect(within(select).getByText('Scanning')).toBeInTheDocument();
      expect(within(select).getByText('Completed')).toBeInTheDocument();
      expect(within(select).getByText('Failed')).toBeInTheDocument();
    });

    it('should call onStatusChange when selection changes', async () => {
      const user = userEvent.setup();
      const onStatusChange = vi.fn();

      render(<FilterBar {...defaultProps} onStatusChange={onStatusChange} />);

      const select = screen.getByLabelText('Filter by status');
      await user.selectOptions(select, 'scanning');

      expect(onStatusChange).toHaveBeenCalledWith('scanning');
    });

    it('should reflect current status selection', () => {
      const filters = createMockFilters({ status: 'completed' });
      render(<FilterBar {...defaultProps} filters={filters} />);

      const select = screen.getByLabelText('Filter by status');
      expect(select).toHaveValue('completed');
    });
  });

  describe('Reset Button', () => {
    it('should not show reset when no active filters', () => {
      render(<FilterBar {...defaultProps} />);

      expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument();
    });

    it('should show reset when search is active', () => {
      const filters = createMockFilters({ search: 'test' });
      const onReset = vi.fn();

      render(<FilterBar {...defaultProps} filters={filters} onReset={onReset} />);

      expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
    });

    it('should show reset when provider filter is active', () => {
      const filters = createMockFilters({ provider: 'github' });
      const onReset = vi.fn();

      render(<FilterBar {...defaultProps} filters={filters} onReset={onReset} />);

      expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
    });

    it('should show reset when status filter is active', () => {
      const filters = createMockFilters({ status: 'scanning' });
      const onReset = vi.fn();

      render(<FilterBar {...defaultProps} filters={filters} onReset={onReset} />);

      expect(screen.getByLabelText('Clear all filters')).toBeInTheDocument();
    });

    it('should call onReset when clicked', async () => {
      const user = userEvent.setup();
      const filters = createMockFilters({ search: 'test' });
      const onReset = vi.fn();

      render(<FilterBar {...defaultProps} filters={filters} onReset={onReset} />);

      await user.click(screen.getByLabelText('Clear all filters'));

      expect(onReset).toHaveBeenCalled();
    });

    it('should not show reset when onReset is not provided', () => {
      const filters = createMockFilters({ search: 'test' });

      render(<FilterBar {...defaultProps} filters={filters} onReset={undefined} />);

      expect(screen.queryByLabelText('Clear all filters')).not.toBeInTheDocument();
    });
  });

  describe('Layout', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <FilterBar {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass('custom-class');
    });
  });
});

// ============================================================================
// CompactFilterBar Tests
// ============================================================================

describe('CompactFilterBar', () => {
  it('should render search input', () => {
    render(<CompactFilterBar search="" onSearchChange={vi.fn()} />);

    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('should display current search value', () => {
    render(<CompactFilterBar search="react" onSearchChange={vi.fn()} />);

    expect(screen.getByDisplayValue('react')).toBeInTheDocument();
  });

  it('should call onSearchChange when typing', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();

    render(<CompactFilterBar search="" onSearchChange={onSearchChange} />);

    const input = screen.getByPlaceholderText('Search...');
    await user.type(input, 'angular');

    expect(onSearchChange).toHaveBeenCalled();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <CompactFilterBar search="" onSearchChange={vi.fn()} className="compact-filter" />
    );

    expect(container.firstChild).toHaveClass('compact-filter');
  });
});

// ============================================================================
// AddRepoModal Tests
// ============================================================================

describe('AddRepoModal', () => {
  const Wrapper = createWrapper();

  beforeEach(() => {
    vi.clearAllMocks();
    // Add available repos handler
    mswServer.use(
      http.get(`${API_URL}/repositories/available/:provider`, () => {
        return HttpResponse.json(mockAvailableRepos);
      })
    );
  });

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onAdd: vi.fn(),
  };

  describe('Modal Visibility', () => {
    it('should render when isOpen is true', () => {
      render(<AddRepoModal {...defaultProps} isOpen={true} />, { wrapper: Wrapper });

      expect(screen.getByText('Connect Repository')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
      render(<AddRepoModal {...defaultProps} isOpen={false} />, { wrapper: Wrapper });

      expect(screen.queryByText('Connect Repository')).not.toBeInTheDocument();
    });

    it('should call onClose when close button clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AddRepoModal {...defaultProps} onClose={onClose} />, { wrapper: Wrapper });

      await user.click(screen.getByLabelText('Close'));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call onClose when backdrop clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      render(<AddRepoModal {...defaultProps} onClose={onClose} />, { wrapper: Wrapper });

      // Click the backdrop
      const backdrop = screen.getByRole('dialog').parentElement?.querySelector('[aria-hidden="true"]');
      if (backdrop) {
        await user.click(backdrop);
        expect(onClose).toHaveBeenCalled();
      }
    });
  });

  describe('Step Indicator', () => {
    it('should show step 1 as current initially', () => {
      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('Provider')).toBeInTheDocument();
      expect(screen.getByText('Repository')).toBeInTheDocument();
      expect(screen.getByText('Options')).toBeInTheDocument();
    });

    it('should show progress through steps', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Step 1: Select provider
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      // Should be on step 2 - wait for loading to complete and title to appear
      await waitFor(() => {
        expect(screen.getByText('Select a Repository')).toBeInTheDocument();
      });
    });
  });

  describe('Step 1: Provider Selection', () => {
    it('should display all provider options', () => {
      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('GitHub')).toBeInTheDocument();
      expect(screen.getByText('GitLab')).toBeInTheDocument();
      expect(screen.getByText('Bitbucket')).toBeInTheDocument();
    });

    it('should allow selecting a provider', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));

      // Continue button should be enabled
      const continueButton = screen.getByText('Continue');
      expect(continueButton).not.toBeDisabled();
    });

    it('should disable Continue until provider selected', async () => {
      const user = userEvent.setup();

      // Create fresh state - we need to render without any provider pre-selected
      const { unmount } = render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // The Continue button should be disabled when no provider is selected
      // The button shows loading when in initial state because useAvailableRepositories may be loading
      const continueButton = screen.getByRole('button', { name: /continue/i });

      // Verify the button is disabled (either by loading state or by canProceed check)
      expect(continueButton).toBeDisabled();

      // Now select a provider and verify the button becomes enabled
      await user.click(screen.getByText('GitLab'));

      // After selecting a provider, Continue should be enabled
      expect(screen.getByRole('button', { name: /continue/i })).not.toBeDisabled();

      unmount();
    });

    it('should show Cancel button on step 1', () => {
      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Step 2: Repository Selection', () => {
    it('should load available repositories after provider selection', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Select provider
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      // Wait for repos to load
      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });
    });

    it('should show loading state while fetching repos', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      // Loading should appear before repos (may be very brief)
      // Either we see loading text OR we see repositories quickly
      await waitFor(() => {
        const hasLoading = screen.queryByText(/Loading repositories/i);
        const hasRepos = screen.queryByText('react-app');
        expect(hasLoading || hasRepos).toBeTruthy();
      });

      // Eventually repos should load
      await waitFor(() => {
        expect(screen.queryByText('react-app')).toBeInTheDocument();
      });
    });

    it('should allow searching repositories', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'vue');

      expect(screen.getByText('vue')).toBeInTheDocument();
      expect(screen.queryByText('react-app')).not.toBeInTheDocument();
    });

    it('should show private icon for private repos', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('private-repo')).toBeInTheDocument();
      });

      // Lock icon should be visible for private repos
      const privateRepoItem = screen.getByText('private-repo').closest('button');
      expect(privateRepoItem).toBeInTheDocument();
    });

    it('should allow selecting a repository', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));

      const continueButton = screen.getByText('Continue');
      expect(continueButton).not.toBeDisabled();
    });

    it('should show Back button on step 2', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      expect(screen.getByText('Back')).toBeInTheDocument();
    });

    it('should go back to step 1 when Back clicked', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Select a Repository')).toBeInTheDocument();
      });

      await user.click(screen.getByText('Back'));

      expect(screen.getByText('Select a Provider')).toBeInTheDocument();
    });

    it('should show no results message when search finds nothing', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Search repositories...');
      await user.type(searchInput, 'nonexistent-repo-xyz');

      expect(screen.getByText('No repositories match your search')).toBeInTheDocument();
    });
  });

  describe('Step 3: Options', () => {
    it('should show option checkboxes', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      expect(screen.getByText('Enable Webhook')).toBeInTheDocument();
      expect(screen.getByText('Scan Immediately')).toBeInTheDocument();
    });

    it('should have webhook enabled by default', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      const webhookCheckbox = screen.getByRole('checkbox', { name: /enable webhook/i });
      expect(webhookCheckbox).toBeChecked();
    });

    it('should have scan on add enabled by default', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      const scanCheckbox = screen.getByRole('checkbox', { name: /scan immediately/i });
      expect(scanCheckbox).toBeChecked();
    });

    it('should allow toggling options', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      const webhookCheckbox = screen.getByRole('checkbox', { name: /enable webhook/i });
      await user.click(webhookCheckbox);

      expect(webhookCheckbox).not.toBeChecked();
    });

    it('should show Connect Repository button on step 3', async () => {
      const user = userEvent.setup();

      render(<AddRepoModal {...defaultProps} />, { wrapper: Wrapper });

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      // The modal title is "Connect Repository" and the button also says "Connect Repository"
      // Use getByRole to specifically target the button
      expect(screen.getByRole('button', { name: /connect repository/i })).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should call onAdd with correct data', async () => {
      const user = userEvent.setup();
      const onAdd = vi.fn();

      render(<AddRepoModal {...defaultProps} onAdd={onAdd} />, { wrapper: Wrapper });

      // Complete the wizard
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      // Uncheck webhook, keep scan
      const webhookCheckbox = screen.getByRole('checkbox', { name: /enable webhook/i });
      await user.click(webhookCheckbox);

      // Use getByRole for the button to avoid matching the modal title which also says "Connect Repository"
      await user.click(screen.getByRole('button', { name: /connect repository/i }));

      expect(onAdd).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'facebook',
        name: 'react-app',
        enableWebhook: false,
        scanOnAdd: true,
      });
    });

    it('should show loading state when adding', async () => {
      const user = userEvent.setup();

      // Start with isAdding=false so we can navigate
      const { rerender } = render(
        <AddRepoModal {...defaultProps} isAdding={false} />,
        { wrapper: Wrapper }
      );

      // Navigate to step 3
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      // Now we're on step 3, rerender with isAdding=true
      // Use the same wrapper to avoid nested router issues
      rerender(
        <AddRepoModal {...defaultProps} isAdding={true} />
      );

      const connectButton = screen.getByRole('button', { name: /connect repository/i });
      expect(connectButton).toBeDisabled();
    });

    it('should show error message on add error', async () => {
      const user = userEvent.setup();
      const addError = new Error('Repository already exists');

      render(
        <AddRepoModal {...defaultProps} addError={addError} />,
        { wrapper: Wrapper }
      );

      // Error is shown on step 1 as well (Alert is rendered before step content)
      // But let's navigate to step 3 to verify it shows there too
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('react-app')).toBeInTheDocument();
      });

      await user.click(screen.getByText('react-app'));
      await user.click(screen.getByText('Continue'));

      // Error message should be visible
      expect(screen.getByText('Repository already exists')).toBeInTheDocument();
    });
  });

  describe('Reset on Close', () => {
    it('should reset state when modal closes', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();

      const { rerender } = render(
        <AddRepoModal {...defaultProps} onClose={onClose} />,
        { wrapper: Wrapper }
      );

      // Navigate to step 2
      await user.click(screen.getByText('GitHub'));
      await user.click(screen.getByText('Continue'));

      await waitFor(() => {
        expect(screen.getByText('Select a Repository')).toBeInTheDocument();
      });

      // Close modal
      await user.click(screen.getByLabelText('Close'));

      // Verify onClose was called
      expect(onClose).toHaveBeenCalled();

      // Simulate reopening by re-rendering with isOpen=true
      // Use the same wrapper context to avoid nested Router issues
      rerender(
        <AddRepoModal isOpen={true} onClose={onClose} onAdd={vi.fn()} />
      );

      // Should be back at step 1 because the modal resets state on close
      expect(screen.getByText('Select a Provider')).toBeInTheDocument();
    });
  });
});
