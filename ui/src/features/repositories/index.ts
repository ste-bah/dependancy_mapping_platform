/**
 * Repositories Feature Index
 * Barrel export for the repositories feature module
 * @module features/repositories
 */

// ============================================================================
// Types
// ============================================================================

export type {
  Repository,
  RepositoryProvider,
  ScanStatus,
  RepositoryFilters,
  AddRepositoryInput,
  AvailableRepository,
  RepositoriesResponse,
  TriggerScanResponse,
  ProviderConfig,
  StatusConfig,
} from './types';

export { PROVIDER_CONFIGS, STATUS_CONFIGS } from './types';

// ============================================================================
// API
// ============================================================================

export {
  fetchRepositories,
  fetchRepository,
  fetchAvailableRepositories,
  addRepository,
  deleteRepository,
  triggerScan,
  cancelScan,
  updateRepositorySettings,
  repositoryKeys,
} from './api';

// ============================================================================
// Hooks
// ============================================================================

export {
  useRepositories,
  useRepository,
  useAddRepository,
  useDeleteRepository,
  useTriggerScan,
  useCancelScan,
  useDeleteConfirmation,
  useAvailableRepositories,
} from './hooks';

export type {
  UseRepositoriesOptions,
  UseRepositoriesReturn,
  UseAddRepositoryOptions,
  UseDeleteRepositoryOptions,
  UseTriggerScanOptions,
  UseCancelScanOptions,
  ConfirmationState,
  UseAvailableRepositoriesOptions,
  UseAvailableRepositoriesReturn,
} from './hooks';

// ============================================================================
// Components
// ============================================================================

export {
  RepositoryCard,
  FilterBar,
  CompactFilterBar,
  AddRepoModal,
  ConfirmDialog,
  RepositoryList,
  Pagination,
} from './components';

export type {
  RepositoryCardProps,
  FilterBarProps,
  CompactFilterBarProps,
  AddRepoModalProps,
  ConfirmDialogProps,
  RepositoryListProps,
  PaginationProps,
} from './components';
