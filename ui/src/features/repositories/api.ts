/**
 * Repository API Functions
 * API functions for repository management
 * @module features/repositories/api
 */

import { get, post, del, buildQueryString } from '@/core/api/client';
import type {
  Repository,
  RepositoryFilters,
  RepositoriesResponse,
  AvailableRepository,
  AddRepositoryInput,
  TriggerScanResponse,
  RepositoryProvider,
} from './types';

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch paginated list of repositories with optional filters
 * @param filters - Filter options for the repository list
 * @returns Paginated repositories response
 */
export async function fetchRepositories(
  filters: RepositoryFilters = {}
): Promise<RepositoriesResponse> {
  const params: Record<string, string | number | undefined> = {
    page: filters.page ?? 1,
    limit: filters.limit ?? 20,
  };

  // Only add filters if they're not 'all'
  if (filters.provider && filters.provider !== 'all') {
    params.provider = filters.provider;
  }

  if (filters.status && filters.status !== 'all') {
    params.status = filters.status;
  }

  if (filters.search) {
    params.search = filters.search;
  }

  const queryString = buildQueryString(params);
  return get<RepositoriesResponse>(`/repositories${queryString}`);
}

/**
 * Fetch a single repository by ID
 * @param id - Repository ID
 * @returns Repository details
 */
export async function fetchRepository(id: string): Promise<Repository> {
  return get<Repository>(`/repositories/${id}`);
}

/**
 * Fetch available repositories from OAuth provider
 * @param provider - The OAuth provider to fetch from
 * @returns List of available repositories
 */
export async function fetchAvailableRepositories(
  provider: RepositoryProvider
): Promise<AvailableRepository[]> {
  return get<AvailableRepository[]>(`/repositories/available/${provider}`);
}

/**
 * Add a new repository
 * @param input - Repository configuration
 * @returns Newly created repository
 */
export async function addRepository(
  input: AddRepositoryInput
): Promise<Repository> {
  return post<Repository, AddRepositoryInput>('/repositories', input);
}

/**
 * Delete a repository
 * @param id - Repository ID
 * @returns Deletion confirmation
 */
export async function deleteRepository(
  id: string
): Promise<{ success: boolean }> {
  return del<{ success: boolean }>(`/repositories/${id}`);
}

/**
 * Trigger a scan for a repository
 * @param id - Repository ID
 * @returns Scan trigger response with scan ID
 */
export async function triggerScan(id: string): Promise<TriggerScanResponse> {
  return post<TriggerScanResponse>(`/repositories/${id}/scan`);
}

/**
 * Cancel an ongoing scan for a repository
 * @param id - Repository ID
 * @returns Cancellation confirmation
 */
export async function cancelScan(id: string): Promise<{ success: boolean }> {
  return post<{ success: boolean }>(`/repositories/${id}/scan/cancel`);
}

/**
 * Update repository settings
 * @param id - Repository ID
 * @param settings - Settings to update
 * @returns Updated repository
 */
export async function updateRepositorySettings(
  id: string,
  settings: Partial<Pick<Repository, 'webhookEnabled'>>
): Promise<Repository> {
  return post<Repository>(`/repositories/${id}/settings`, settings);
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for repositories
 */
export const repositoryKeys = {
  all: ['repositories'] as const,
  lists: () => [...repositoryKeys.all, 'list'] as const,
  list: (filters: RepositoryFilters) =>
    [...repositoryKeys.lists(), filters] as const,
  details: () => [...repositoryKeys.all, 'detail'] as const,
  detail: (id: string) => [...repositoryKeys.details(), id] as const,
  available: (provider: RepositoryProvider) =>
    [...repositoryKeys.all, 'available', provider] as const,
};
