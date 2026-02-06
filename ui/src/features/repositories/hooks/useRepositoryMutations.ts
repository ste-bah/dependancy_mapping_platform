/**
 * Repository Mutation Hooks
 * React Query mutation hooks for repository operations
 * @module features/repositories/hooks/useRepositoryMutations
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import {
  addRepository,
  deleteRepository,
  triggerScan,
  cancelScan,
  repositoryKeys,
} from '../api';
import type {
  Repository,
  RepositoriesResponse,
  TriggerScanResponse,
} from '../types';

// ============================================================================
// Add Repository Hook
// ============================================================================

export interface UseAddRepositoryOptions {
  /** Callback on success */
  onSuccess?: (repository: Repository) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook for adding a new repository with optimistic updates
 *
 * @example
 * const { mutate, isPending, error } = useAddRepository({
 *   onSuccess: (repo) => navigate(`/repositories/${repo.id}`),
 * });
 *
 * mutate({ provider: 'github', owner: 'user', name: 'repo' });
 */
export function useAddRepository(options: UseAddRepositoryOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addRepository,
    onSuccess: (repository) => {
      // Invalidate all repository lists to refetch fresh data
      queryClient.invalidateQueries({ queryKey: repositoryKeys.lists() });

      // Call user callback
      onSuccess?.(repository);
    },
    onError: (error: Error) => {
      onError?.(error);
    },
  });
}

// ============================================================================
// Delete Repository Hook
// ============================================================================

export interface UseDeleteRepositoryOptions {
  /** Callback on success */
  onSuccess?: (id: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

export interface DeleteRepositoryContext {
  previousData: RepositoriesResponse | undefined;
}

/**
 * Hook for deleting a repository with optimistic updates
 *
 * @example
 * const { mutate, isPending } = useDeleteRepository({
 *   onSuccess: () => toast.success('Repository deleted'),
 * });
 *
 * if (confirm('Delete repository?')) {
 *   mutate('repo-id');
 * }
 */
export function useDeleteRepository(options: UseDeleteRepositoryOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, Error, string, DeleteRepositoryContext>({
    mutationFn: deleteRepository,
    // Optimistic update - remove from list immediately
    onMutate: async (deletedId) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      // Snapshot current data for rollback
      const previousData = queryClient.getQueryData<RepositoriesResponse>(
        repositoryKeys.lists()
      );

      // Optimistically remove from all cached lists
      queryClient.setQueriesData<RepositoriesResponse>(
        { queryKey: repositoryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.filter((repo) => repo.id !== deletedId),
            pagination: {
              ...old.pagination,
              total: old.pagination.total - 1,
            },
          };
        }
      );

      return { previousData };
    },
    onSuccess: (_, deletedId) => {
      // Also remove from detail cache
      queryClient.removeQueries({ queryKey: repositoryKeys.detail(deletedId) });
      onSuccess?.(deletedId);
    },
    onError: (error, _deletedId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(repositoryKeys.lists(), context.previousData);
      }
      onError?.(error);
    },
    onSettled: () => {
      // Always refetch to ensure sync with server
      queryClient.invalidateQueries({ queryKey: repositoryKeys.lists() });
    },
  });
}

// ============================================================================
// Trigger Scan Hook
// ============================================================================

export interface UseTriggerScanOptions {
  /** Callback on success */
  onSuccess?: (response: TriggerScanResponse) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook for triggering a repository scan with optimistic status update
 *
 * @example
 * const { mutate, isPending } = useTriggerScan({
 *   onSuccess: (response) => toast.success(`Scan started: ${response.scanId}`),
 * });
 *
 * mutate('repo-id');
 */
export function useTriggerScan(options: UseTriggerScanOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: triggerScan,
    // Optimistic update - set status to pending immediately
    onMutate: async (repoId) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      // Update status in all cached lists
      queryClient.setQueriesData<RepositoriesResponse>(
        { queryKey: repositoryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((repo) =>
              repo.id === repoId
                ? { ...repo, lastScanStatus: 'pending' as const }
                : repo
            ),
          };
        }
      );
    },
    onSuccess: (response) => {
      // Update status to scanning
      queryClient.setQueriesData<RepositoriesResponse>(
        { queryKey: repositoryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((repo) =>
              repo.id === response.repositoryId
                ? { ...repo, lastScanStatus: response.status }
                : repo
            ),
          };
        }
      );

      onSuccess?.(response);
    },
    onError: (error: Error) => {
      // Refetch to get correct status
      queryClient.invalidateQueries({ queryKey: repositoryKeys.lists() });
      onError?.(error);
    },
  });
}

// ============================================================================
// Cancel Scan Hook
// ============================================================================

export interface UseCancelScanOptions {
  /** Callback on success */
  onSuccess?: (id: string) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Hook for cancelling an ongoing repository scan
 *
 * @example
 * const { mutate, isPending } = useCancelScan();
 * mutate('repo-id');
 */
export function useCancelScan(options: UseCancelScanOptions = {}) {
  const { onSuccess, onError } = options;
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelScan,
    onMutate: async (repoId) => {
      await queryClient.cancelQueries({ queryKey: repositoryKeys.lists() });

      // Optimistically set status to idle
      queryClient.setQueriesData<RepositoriesResponse>(
        { queryKey: repositoryKeys.lists() },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((repo) =>
              repo.id === repoId
                ? { ...repo, lastScanStatus: 'idle' as const }
                : repo
            ),
          };
        }
      );
    },
    onSuccess: (_, repoId) => {
      onSuccess?.(repoId);
    },
    onError: (error: Error) => {
      queryClient.invalidateQueries({ queryKey: repositoryKeys.lists() });
      onError?.(error);
    },
  });
}

// ============================================================================
// Confirmation Dialog Hook
// ============================================================================

export interface ConfirmationState {
  isOpen: boolean;
  repositoryId: string | null;
  repositoryName: string | null;
}

/**
 * Hook for managing delete confirmation dialog state
 *
 * @example
 * const { confirmation, openConfirmation, closeConfirmation, confirmedId } = useDeleteConfirmation();
 *
 * <Button onClick={() => openConfirmation(repo.id, repo.name)}>Delete</Button>
 *
 * <ConfirmDialog
 *   isOpen={confirmation.isOpen}
 *   onClose={closeConfirmation}
 *   onConfirm={() => {
 *     if (confirmedId) deleteMutation.mutate(confirmedId);
 *     closeConfirmation();
 *   }}
 * />
 */
export function useDeleteConfirmation() {
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    repositoryId: null,
    repositoryName: null,
  });

  const openConfirmation = useCallback((id: string, name: string) => {
    setConfirmation({
      isOpen: true,
      repositoryId: id,
      repositoryName: name,
    });
  }, []);

  const closeConfirmation = useCallback(() => {
    setConfirmation({
      isOpen: false,
      repositoryId: null,
      repositoryName: null,
    });
  }, []);

  return {
    confirmation,
    openConfirmation,
    closeConfirmation,
    confirmedId: confirmation.repositoryId,
  };
}

// ============================================================================
// Exports
// ============================================================================

export {
  useAddRepository as default,
};
