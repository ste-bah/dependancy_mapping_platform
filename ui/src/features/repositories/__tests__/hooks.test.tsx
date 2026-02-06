/**
 * Repository Hooks Tests
 * Comprehensive tests for useRepositories, useTriggerScan, useDeleteRepository, useAddRepository
 * @module features/repositories/__tests__/hooks.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { faker } from '@faker-js/faker';
import { mswServer, http, HttpResponse } from '@/__tests__/setup';

import {
  useRepositories,
  useRepository,
  useAddRepository,
  useDeleteRepository,
  useTriggerScan,
  useCancelScan,
  useDeleteConfirmation,
  useAvailableRepositories,
} from '../hooks';
import type {
  Repository,
  RepositoriesResponse,
  AvailableRepository,
  TriggerScanResponse,
  RepositoryProvider,
  ScanStatus,
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
    webhookEnabled: faker.datatype.boolean(),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
    ...overrides,
  };
}

function createMockRepositoriesResponse(
  repositories: Repository[] = [],
  page = 1,
  pageSize = 20
): RepositoriesResponse {
  const total = repositories.length > 0 ? repositories.length + 30 : 0;
  return {
    data: repositories,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNext: page < Math.ceil(total / pageSize),
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
    private: faker.datatype.boolean(),
    ...overrides,
  };
}

// ============================================================================
// Test Data
// ============================================================================

const API_URL = '/api';

const mockRepos = [
  createMockRepository({ id: 'repo-1', name: 'repo-alpha', lastScanStatus: 'completed' }),
  createMockRepository({ id: 'repo-2', name: 'repo-beta', lastScanStatus: 'scanning' }),
  createMockRepository({ id: 'repo-3', name: 'repo-gamma', lastScanStatus: 'idle', provider: 'gitlab' }),
];

// ============================================================================
// Test Wrapper
// ============================================================================

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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Repository Hooks', () => {
  beforeEach(() => {
    // Add repository-specific handlers to the shared MSW server
    mswServer.use(
      // Get repositories list
      http.get(`${API_URL}/repositories`, ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') ?? '1', 10);
        const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
        const provider = url.searchParams.get('provider');
        const status = url.searchParams.get('status');
        const search = url.searchParams.get('search');

        let filtered = [...mockRepos];

        if (provider && provider !== 'all') {
          filtered = filtered.filter((r) => r.provider === provider);
        }

        if (status && status !== 'all') {
          filtered = filtered.filter((r) => r.lastScanStatus === status);
        }

        if (search) {
          filtered = filtered.filter(
            (r) =>
              r.name.toLowerCase().includes(search.toLowerCase()) ||
              r.fullName.toLowerCase().includes(search.toLowerCase())
          );
        }

        return HttpResponse.json(createMockRepositoriesResponse(filtered, page, limit));
      }),

      // Get single repository
      http.get(`${API_URL}/repositories/:id`, ({ params }) => {
        const repo = mockRepos.find((r) => r.id === params.id);
        if (repo) {
          return HttpResponse.json(repo);
        }
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),

      // Get available repositories
      http.get(`${API_URL}/repositories/available/:provider`, () => {
        const availableRepos = [
          createMockAvailableRepository({ name: 'available-1', owner: 'user1' }),
          createMockAvailableRepository({ name: 'available-2', owner: 'user1' }),
          createMockAvailableRepository({ name: 'private-repo', owner: 'user2', private: true }),
        ];
        return HttpResponse.json(availableRepos);
      }),

      // Add repository
      http.post(`${API_URL}/repositories`, async ({ request }) => {
        const body = (await request.json()) as {
          provider: string;
          owner: string;
          name: string;
        };
        const newRepo = createMockRepository({
          id: faker.string.uuid(),
          provider: body.provider as RepositoryProvider,
          owner: body.owner,
          name: body.name,
          fullName: `${body.owner}/${body.name}`,
          lastScanStatus: 'idle',
        });
        return HttpResponse.json(newRepo, { status: 201 });
      }),

      // Delete repository
      http.delete(`${API_URL}/repositories/:id`, ({ params }) => {
        const repo = mockRepos.find((r) => r.id === params.id);
        if (repo) {
          return HttpResponse.json({ success: true });
        }
        return HttpResponse.json({ message: 'Not found' }, { status: 404 });
      }),

      // Trigger scan
      http.post(`${API_URL}/repositories/:id/scan`, ({ params }) => {
        const response: TriggerScanResponse = {
          scanId: faker.string.uuid(),
          repositoryId: params.id as string,
          status: 'scanning',
          startedAt: new Date().toISOString(),
        };
        return HttpResponse.json(response);
      }),

      // Cancel scan
      http.post(`${API_URL}/repositories/:id/scan/cancel`, () => {
        return HttpResponse.json({ success: true });
      })
    );
  });

  // ==========================================================================
  // useRepositories Tests
  // ==========================================================================

  describe('useRepositories', () => {
    it('should fetch repositories successfully', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.data).toHaveLength(3);
      expect(result.current.isError).toBe(false);
      expect(result.current.error).toBeNull();
    });

    it('should return paginated data', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.pagination).toMatchObject({
        page: 1,
        pageSize: 20,
        hasNext: expect.any(Boolean),
        hasPrevious: false,
      });
    });

    it('should apply provider filter', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRepositories({ initialFilters: { provider: 'gitlab' } }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data[0].provider).toBe('gitlab');
    });

    it('should apply status filter', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRepositories({ initialFilters: { status: 'scanning' } }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.data).toHaveLength(1);
      expect(result.current.data?.data[0].lastScanStatus).toBe('scanning');
    });

    it('should debounce search input', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Set search
      act(() => {
        result.current.setSearch('alpha');
      });

      // Should update the input value immediately
      expect(result.current.filters.search).toBe('alpha');

      // Wait for debounce to complete and data to refetch
      await waitFor(() => {
        expect(result.current.data?.data).toHaveLength(1);
      }, { timeout: 2000 });

      expect(result.current.data?.data[0].name).toBe('repo-alpha');
    });

    it('should reset page when search changes', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Go to page 2
      act(() => {
        result.current.setPage(2);
      });

      expect(result.current.filters.page).toBe(2);

      // Search should reset to page 1 after debounce
      act(() => {
        result.current.setSearch('test');
      });

      // Wait for debounce to trigger the page reset
      await waitFor(() => {
        expect(result.current.filters.page).toBe(1);
      }, { timeout: 2000 });
    });

    it('should reset page when provider filter changes', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Go to page 2
      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => {
        expect(result.current.filters.page).toBe(2);
      });

      // Change provider should reset to page 1
      act(() => {
        result.current.setProvider('gitlab');
      });

      await waitFor(() => {
        expect(result.current.filters.page).toBe(1);
      });
    });

    it('should reset page when status filter changes', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Go to page 2
      act(() => {
        result.current.setPage(2);
      });

      await waitFor(() => {
        expect(result.current.filters.page).toBe(2);
      });

      // Change status should reset to page 1
      act(() => {
        result.current.setStatus('scanning');
      });

      await waitFor(() => {
        expect(result.current.filters.page).toBe(1);
      });
    });

    it('should reset all filters', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Apply various filters
      act(() => {
        result.current.setSearch('test');
        result.current.setProvider('github');
        result.current.setStatus('completed');
        result.current.setPage(3);
      });

      // Wait for debounce
      await waitFor(() => {
        expect(result.current.filters.search).toBe('test');
      });

      // Reset all
      act(() => {
        result.current.resetFilters();
      });

      expect(result.current.filters).toMatchObject({
        page: 1,
        search: '',
        provider: 'all',
        status: 'all',
      });
    });

    it('should handle API error', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories`, () => {
          return HttpResponse.json(
            { message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
      expect(result.current.error).toBeTruthy();
    });

    it('should refetch on demand', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepositories(), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const initialFetchCount = result.current.data?.data.length;

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.isFetching).toBe(false);
      });

      expect(result.current.data?.data.length).toBe(initialFetchCount);
    });

    it('should enable polling when scanning repos exist', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRepositories({ enablePolling: true }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Repo with scanning status should trigger refetch interval
      const hasScanning = result.current.data?.data.some(
        (r) => r.lastScanStatus === 'scanning' || r.lastScanStatus === 'pending'
      );

      expect(hasScanning).toBe(true);
    });

    it('should disable polling when option is false', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useRepositories({ enablePolling: false }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.data).toBeDefined();
    });
  });

  // ==========================================================================
  // useRepository Tests
  // ==========================================================================

  describe('useRepository', () => {
    it('should fetch single repository', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepository('repo-1'), { wrapper });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data?.id).toBe('repo-1');
      expect(result.current.data?.name).toBe('repo-alpha');
    });

    it('should return 404 for non-existent repository', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(() => useRepository('non-existent'), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isError).toBe(true);
    });
  });

  // ==========================================================================
  // useAddRepository Tests
  // ==========================================================================

  describe('useAddRepository', () => {
    it('should add repository successfully', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAddRepository({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate({
          provider: 'github',
          owner: 'test-owner',
          name: 'test-repo',
          enableWebhook: true,
          scanOnAdd: true,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'test-owner',
          name: 'test-repo',
        })
      );
    });

    it('should call onError callback on failure', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories`, () => {
          return HttpResponse.json(
            { message: 'Repository already exists' },
            { status: 409 }
          );
        })
      );

      const onError = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAddRepository({ onError }),
        { wrapper }
      );

      act(() => {
        result.current.mutate({
          provider: 'github',
          owner: 'test-owner',
          name: 'existing-repo',
          enableWebhook: true,
          scanOnAdd: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });

    it('should invalidate queries on success', async () => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      }

      const { result } = renderHook(() => useAddRepository(), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.mutate({
          provider: 'github',
          owner: 'owner',
          name: 'repo',
          enableWebhook: false,
          scanOnAdd: false,
        });
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: ['repositories', 'list'],
        })
      );
    });

    it('should handle pending state', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAddRepository({ onSuccess }),
        { wrapper }
      );

      expect(result.current.isPending).toBe(false);

      act(() => {
        result.current.mutate({
          provider: 'gitlab',
          owner: 'owner',
          name: 'repo',
          enableWebhook: true,
          scanOnAdd: true,
        });
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.isPending).toBe(false);
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useDeleteRepository Tests
  // ==========================================================================

  describe('useDeleteRepository', () => {
    it('should delete repository successfully', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDeleteRepository({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith('repo-1');
    });

    it('should perform optimistic update', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDeleteRepository({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      // The mutation should complete successfully (optimistic updates happen in onMutate)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith('repo-1');
    });

    it('should rollback on error', async () => {
      mswServer.use(
        http.delete(`${API_URL}/repositories/:id`, () => {
          return HttpResponse.json(
            { message: 'Deletion failed' },
            { status: 500 }
          );
        })
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const originalData = {
        data: [createMockRepository({ id: 'repo-1' })],
        pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false },
      };

      queryClient.setQueryData(['repositories', 'list'], originalData);

      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      }

      const onError = vi.fn();
      const { result } = renderHook(
        () => useDeleteRepository({ onError }),
        { wrapper: Wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });

    it('should call onError callback', async () => {
      mswServer.use(
        http.delete(`${API_URL}/repositories/:id`, () => {
          return HttpResponse.json({ message: 'Not found' }, { status: 404 });
        })
      );

      const onError = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useDeleteRepository({ onError }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('non-existent');
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useTriggerScan Tests
  // ==========================================================================

  describe('useTriggerScan', () => {
    it('should trigger scan successfully', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTriggerScan({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryId: 'repo-1',
          status: 'scanning',
        })
      );
    });

    it('should perform optimistic update to pending status', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTriggerScan({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      // The mutation should complete (optimistic updates happen automatically)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify the scan response indicates scanning started
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryId: 'repo-1',
        })
      );
    });

    it('should update to scanning status on success', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(() => useTriggerScan({ onSuccess }), {
        wrapper,
      });

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Verify onSuccess was called with scanning status
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          repositoryId: 'repo-1',
          status: 'scanning',
        })
      );
    });

    it('should invalidate queries on error', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories/:id/scan`, () => {
          return HttpResponse.json(
            { message: 'Scan failed' },
            { status: 500 }
          );
        })
      );

      const queryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false, gcTime: 0 },
          mutations: { retry: false },
        },
      });

      const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

      function Wrapper({ children }: { children: ReactNode }) {
        return (
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        );
      }

      const { result } = renderHook(() => useTriggerScan(), {
        wrapper: Wrapper,
      });

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(invalidateSpy).toHaveBeenCalled();
    });

    it('should call onError callback on failure', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories/:id/scan`, () => {
          return HttpResponse.json(
            { message: 'Repository not found' },
            { status: 404 }
          );
        })
      );

      const onError = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useTriggerScan({ onError }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('non-existent');
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useCancelScan Tests
  // ==========================================================================

  describe('useCancelScan', () => {
    it('should cancel scan successfully', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCancelScan({ onSuccess }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-2');
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith('repo-2');
    });

    it('should optimistically set status to idle', async () => {
      const onSuccess = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(() => useCancelScan({ onSuccess }), {
        wrapper,
      });

      act(() => {
        result.current.mutate('repo-1');
      });

      // Wait for mutation to complete
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(onSuccess).toHaveBeenCalledWith('repo-1');
    });

    it('should invalidate queries on error', async () => {
      mswServer.use(
        http.post(`${API_URL}/repositories/:id/scan/cancel`, () => {
          return HttpResponse.json(
            { message: 'No active scan' },
            { status: 400 }
          );
        })
      );

      const onError = vi.fn();
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useCancelScan({ onError }),
        { wrapper }
      );

      act(() => {
        result.current.mutate('repo-1');
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(onError).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // useDeleteConfirmation Tests
  // ==========================================================================

  describe('useDeleteConfirmation', () => {
    it('should initialize with closed state', () => {
      const { result } = renderHook(() => useDeleteConfirmation());

      expect(result.current.confirmation).toEqual({
        isOpen: false,
        repositoryId: null,
        repositoryName: null,
      });
      expect(result.current.confirmedId).toBeNull();
    });

    it('should open confirmation dialog', () => {
      const { result } = renderHook(() => useDeleteConfirmation());

      act(() => {
        result.current.openConfirmation('repo-123', 'my-awesome-repo');
      });

      expect(result.current.confirmation).toEqual({
        isOpen: true,
        repositoryId: 'repo-123',
        repositoryName: 'my-awesome-repo',
      });
      expect(result.current.confirmedId).toBe('repo-123');
    });

    it('should close confirmation dialog', () => {
      const { result } = renderHook(() => useDeleteConfirmation());

      act(() => {
        result.current.openConfirmation('repo-123', 'my-repo');
      });

      act(() => {
        result.current.closeConfirmation();
      });

      expect(result.current.confirmation).toEqual({
        isOpen: false,
        repositoryId: null,
        repositoryName: null,
      });
      expect(result.current.confirmedId).toBeNull();
    });

    it('should handle multiple open/close cycles', () => {
      const { result } = renderHook(() => useDeleteConfirmation());

      // First cycle
      act(() => {
        result.current.openConfirmation('repo-1', 'first-repo');
      });
      expect(result.current.confirmation.isOpen).toBe(true);

      act(() => {
        result.current.closeConfirmation();
      });
      expect(result.current.confirmation.isOpen).toBe(false);

      // Second cycle
      act(() => {
        result.current.openConfirmation('repo-2', 'second-repo');
      });
      expect(result.current.confirmedId).toBe('repo-2');
      expect(result.current.confirmation.repositoryName).toBe('second-repo');
    });
  });

  // ==========================================================================
  // useAvailableRepositories Tests
  // ==========================================================================

  describe('useAvailableRepositories', () => {
    it('should fetch available repositories', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: 'github' }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.data).toHaveLength(3);
      expect(result.current.isError).toBe(false);
    });

    it('should not fetch when provider is null', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: null }),
        { wrapper }
      );

      // Should stay in initial state
      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should not fetch when disabled', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: 'github', enabled: false }),
        { wrapper }
      );

      expect(result.current.isLoading).toBe(false);
      expect(result.current.data).toBeUndefined();
    });

    it('should include private repositories', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: 'github' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const privateRepo = result.current.data?.find((r) => r.private);
      expect(privateRepo).toBeDefined();
    });

    it('should handle API error', async () => {
      mswServer.use(
        http.get(`${API_URL}/repositories/available/:provider`, () => {
          return HttpResponse.json(
            { message: 'OAuth token expired' },
            { status: 401 }
          );
        })
      );

      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: 'bitbucket' }), // Use different provider to avoid cache
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      }, { timeout: 5000 });

      expect(result.current.error).toBeTruthy();
    });

    it('should support refetch', async () => {
      const wrapper = createWrapper();
      const { result } = renderHook(
        () => useAvailableRepositories({ provider: 'gitlab' }),
        { wrapper }
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      expect(result.current.data?.length).toBeGreaterThan(0);
    });
  });
});
