/**
 * useAvailableRepositories Hook
 * React Query hook for fetching available repositories from OAuth providers
 * @module features/repositories/hooks/useAvailableRepositories
 */

import { useQuery } from '@tanstack/react-query';
import { fetchAvailableRepositories, repositoryKeys } from '../api';
import type { RepositoryProvider, AvailableRepository } from '../types';

// ============================================================================
// Hook Interface
// ============================================================================

export interface UseAvailableRepositoriesOptions {
  /** OAuth provider to fetch from */
  provider: RepositoryProvider | null;
  /** Enable/disable the query */
  enabled?: boolean;
}

export interface UseAvailableRepositoriesReturn {
  /** List of available repositories */
  data: AvailableRepository[] | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  isError: boolean;
  /** Error object */
  error: Error | null;
  /** Is currently fetching (including background) */
  isFetching: boolean;
  /** Refetch data */
  refetch: () => void;
}

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for fetching available repositories from an OAuth provider
 * Used in the Add Repository flow to list repos the user can connect
 *
 * @example
 * const { data, isLoading } = useAvailableRepositories({
 *   provider: 'github',
 * });
 *
 * @example
 * // Conditionally enabled
 * const { data } = useAvailableRepositories({
 *   provider: selectedProvider,
 *   enabled: step === 2,
 * });
 */
export function useAvailableRepositories(
  options: UseAvailableRepositoriesOptions
): UseAvailableRepositoriesReturn {
  const { provider, enabled = true } = options;

  const {
    data,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
  } = useQuery<AvailableRepository[], Error>({
    queryKey: repositoryKeys.available(provider ?? 'github'),
    queryFn: () => {
      if (!provider) {
        throw new Error('Provider is required');
      }
      return fetchAvailableRepositories(provider);
    },
    enabled: enabled && provider !== null,
    staleTime: 60_000, // Cache for 1 minute
    retry: 1, // Only retry once on failure
  });

  return {
    data,
    isLoading,
    isError,
    error: error ?? null,
    isFetching,
    refetch,
  };
}

export default useAvailableRepositories;
