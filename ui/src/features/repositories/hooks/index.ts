/**
 * Repository Hooks Index
 * Barrel export for repository hooks
 * @module features/repositories/hooks
 */

export {
  useRepositories,
  useRepository,
  type UseRepositoriesOptions,
  type UseRepositoriesReturn,
} from './useRepositories';

export {
  useAddRepository,
  useDeleteRepository,
  useTriggerScan,
  useCancelScan,
  useDeleteConfirmation,
  type UseAddRepositoryOptions,
  type UseDeleteRepositoryOptions,
  type UseTriggerScanOptions,
  type UseCancelScanOptions,
  type ConfirmationState,
} from './useRepositoryMutations';

export {
  useAvailableRepositories,
  type UseAvailableRepositoriesOptions,
  type UseAvailableRepositoriesReturn,
} from './useAvailableRepositories';
