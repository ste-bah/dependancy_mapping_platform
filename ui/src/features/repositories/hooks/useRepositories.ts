/**
 * useRepositories Hook
 * React Query hook for fetching and managing repository lists
 * @module features/repositories/hooks/useRepositories
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useCallback, useMemo, useEffect } from 'react';
import { fetchRepositories, repositoryKeys } from '../api';
import type { Repository, RepositoryFilters, RepositoriesResponse } from '../types';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PAGE_SIZE = 20;
const DEBOUNCE_DELAY = 300;
const SCANNING_REFETCH_INTERVAL = 5000; // 5 seconds

// ============================================================================
// Debounce Hook
// ============================================================================

/**
 * Custom debounce hook for search input
 */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseRepositoriesOptions {
  /** Initial filters */
  initialFilters?: Partial<RepositoryFilters>;
  /** Enable automatic refetching when scanning repos exist */
  enablePolling?: boolean;
}

export interface UseRepositoriesReturn {
  /** Paginated repository data */
  data: RepositoriesResponse | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Is currently fetching (including background) */
  isFetching: boolean;
  /** Current filters */
  filters: RepositoryFilters;
  /** Set search term (debounced) */
  setSearch: (search: string) => void;
  /** Set provider filter */
  setProvider: (provider: RepositoryFilters['provider']) => void;
  /** Set status filter */
  setStatus: (status: RepositoryFilters['status']) => void;
  /** Go to specific page */
  setPage: (page: number) => void;
  /** Reset all filters */
  resetFilters: () => void;
  /** Refetch data */
  refetch: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching and managing repository lists with filtering and pagination
 *
 * @example
 * const { data, isLoading, setSearch, setProvider } = useRepositories();
 *
 * @example
 * // With initial filters
 * const { data } = useRepositories({
 *   initialFilters: { provider: 'github' }
 * });
 */
export function useRepositories(
  options: UseRepositoriesOptions = {}
): UseRepositoriesReturn {
  const { initialFilters = {}, enablePolling = true } = options;

  // ============================================================================
  // Filter State
  // ============================================================================

  const [filters, setFilters] = useState<RepositoryFilters>({
    page: 1,
    limit: DEFAULT_PAGE_SIZE,
    provider: 'all',
    status: 'all',
    search: '',
    ...initialFilters,
  });

  // Debounced search for API calls
  const [searchInput, setSearchInput] = useState(filters.search ?? '');
  const debouncedSearch = useDebounce(searchInput, DEBOUNCE_DELAY);

  // Update filters when debounced search changes
  useEffect(() => {
    setFilters((prev) => ({
      ...prev,
      search: debouncedSearch,
      page: 1, // Reset to first page on search
    }));
  }, [debouncedSearch]);

  // ============================================================================
  // Query
  // ============================================================================

  // Build query filters (excluding empty search)
  const queryFilters = useMemo(() => {
    const result: RepositoryFilters = { ...filters };
    if (!result.search) {
      delete result.search;
    }
    return result;
  }, [filters]);

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<RepositoriesResponse, Error>({
    queryKey: repositoryKeys.list(queryFilters),
    queryFn: () => fetchRepositories(queryFilters),
    staleTime: 30_000, // Consider stale after 30 seconds
    // Poll for updates if any repositories are scanning
    refetchInterval: enablePolling
      ? (query) => {
          const queryData = query.state.data;
          if (!queryData) return false;
          const hasScanning = queryData.data.some(
            (repo: Repository) =>
              repo.lastScanStatus === 'scanning' ||
              repo.lastScanStatus === 'pending'
          );
          return hasScanning ? SCANNING_REFETCH_INTERVAL : false;
        }
      : false,
  });

  // ============================================================================
  // Filter Actions
  // ============================================================================

  const setSearch = useCallback((search: string) => {
    setSearchInput(search);
  }, []);

  const setProvider = useCallback(
    (provider: RepositoryFilters['provider']) => {
      setFilters((prev) => ({ ...prev, provider: provider ?? 'all', page: 1 }));
    },
    []
  );

  const setStatus = useCallback((status: RepositoryFilters['status']) => {
    setFilters((prev) => ({ ...prev, status: status ?? 'all', page: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters((prev) => ({ ...prev, page }));
  }, []);

  const resetFilters = useCallback(() => {
    setSearchInput('');
    setFilters({
      page: 1,
      limit: DEFAULT_PAGE_SIZE,
      provider: 'all',
      status: 'all',
      search: '',
    });
  }, []);

  // ============================================================================
  // Return Value
  // ============================================================================

  return {
    data,
    isLoading,
    isError,
    error: error ?? null,
    isFetching,
    filters: { ...filters, search: searchInput },
    setSearch,
    setProvider,
    setStatus,
    setPage,
    resetFilters,
    refetch,
  };
}

// ============================================================================
// Additional Hooks
// ============================================================================

/**
 * Hook to get a single repository from the cache or fetch it
 */
export function useRepository(id: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: repositoryKeys.detail(id),
    queryFn: async () => {
      // First try to find in cached list
      const listsData = queryClient.getQueriesData<RepositoriesResponse>({
        queryKey: repositoryKeys.lists(),
      });

      for (const [, listData] of listsData) {
        const found = listData?.data.find((repo) => repo.id === id);
        if (found) return found;
      }

      // If not in cache, fetch from API
      const { get } = await import('@/core/api/client');
      return get<Repository>(`/repositories/${id}`);
    },
    staleTime: 60_000,
  });
}

export default useRepositories;
