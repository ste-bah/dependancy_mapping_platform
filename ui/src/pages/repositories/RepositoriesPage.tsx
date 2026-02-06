/**
 * Repositories Page
 * Full-featured repository management page
 * @module pages/repositories/RepositoriesPage
 */

import { useState, useCallback } from 'react';
import { Button, Alert } from '@/shared/components';
import {
  useRepositories,
  useAddRepository,
  useDeleteRepository,
  useTriggerScan,
  useCancelScan,
  useDeleteConfirmation,
  FilterBar,
  AddRepoModal,
  ConfirmDialog,
  RepositoryList,
  Pagination,
  type AddRepositoryInput,
} from '@/features/repositories';

// ============================================================================
// Component
// ============================================================================

/**
 * Repositories list page with filtering, pagination, and CRUD operations
 */
export default function RepositoriesPage(): JSX.Element {
  // ============================================================================
  // State
  // ============================================================================

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [scanningRepoId, setScanningRepoId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ============================================================================
  // Hooks
  // ============================================================================

  // Repository list with filtering
  const {
    data,
    isLoading,
    isFetching,
    error,
    filters,
    setSearch,
    setProvider,
    setStatus,
    setPage,
    resetFilters,
  } = useRepositories();

  // Delete confirmation
  const {
    confirmation,
    openConfirmation,
    closeConfirmation,
    confirmedId,
  } = useDeleteConfirmation();

  // Mutations
  const addMutation = useAddRepository({
    onSuccess: (repo) => {
      setIsAddModalOpen(false);
      setSuccessMessage(`Successfully connected ${repo.fullName}`);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const deleteMutation = useDeleteRepository({
    onSuccess: () => {
      closeConfirmation();
      setSuccessMessage('Repository removed successfully');
      setTimeout(() => setSuccessMessage(null), 5000);
    },
  });

  const scanMutation = useTriggerScan({
    onSuccess: () => {
      setScanningRepoId(null);
      setSuccessMessage(`Scan started for repository`);
      setTimeout(() => setSuccessMessage(null), 5000);
    },
    onError: () => {
      setScanningRepoId(null);
    },
  });

  const cancelScanMutation = useCancelScan();

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleOpenAddModal = useCallback(() => {
    setIsAddModalOpen(true);
  }, []);

  const handleCloseAddModal = useCallback(() => {
    setIsAddModalOpen(false);
    addMutation.reset();
  }, [addMutation]);

  const handleAddRepository = useCallback(
    (input: AddRepositoryInput) => {
      addMutation.mutate(input);
    },
    [addMutation]
  );

  const handleTriggerScan = useCallback(
    (id: string) => {
      setScanningRepoId(id);
      scanMutation.mutate(id);
    },
    [scanMutation]
  );

  const handleCancelScan = useCallback(
    (id: string) => {
      cancelScanMutation.mutate(id);
    },
    [cancelScanMutation]
  );

  const handleDeleteRequest = useCallback(
    (id: string, name: string) => {
      openConfirmation(id, name);
    },
    [openConfirmation]
  );

  const handleConfirmDelete = useCallback(() => {
    if (confirmedId) {
      deleteMutation.mutate(confirmedId);
    }
  }, [confirmedId, deleteMutation]);

  const handleDismissSuccess = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  // ============================================================================
  // Derived State
  // ============================================================================

  const repositories = data?.data ?? [];
  const pagination = data?.pagination;
  const hasActiveFilters = Boolean(
    filters.search ||
      (filters.provider && filters.provider !== 'all') ||
      (filters.status && filters.status !== 'all')
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Repositories</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your connected repositories and run dependency scans.
          </p>
        </div>
        <Button onClick={handleOpenAddModal} leftIcon={<PlusIcon className="h-4 w-4" />}>
          Connect Repository
        </Button>
      </div>

      {/* Success Message */}
      {successMessage && (
        <Alert variant="success" dismissible onDismiss={handleDismissSuccess}>
          {successMessage}
        </Alert>
      )}

      {/* Filters */}
      <FilterBar
        filters={filters}
        onSearchChange={setSearch}
        onProviderChange={setProvider}
        onStatusChange={setStatus}
        onReset={hasActiveFilters ? resetFilters : undefined}
      />

      {/* Loading indicator for background fetches */}
      {isFetching && !isLoading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <RefreshIcon className="h-4 w-4 animate-spin" />
          Refreshing...
        </div>
      )}

      {/* Repository List */}
      <RepositoryList
        repositories={repositories}
        isLoading={isLoading}
        error={error}
        onTriggerScan={handleTriggerScan}
        onCancelScan={handleCancelScan}
        onDelete={handleDeleteRequest}
        onAdd={handleOpenAddModal}
        scanningRepoId={scanningRepoId}
        deletingRepoId={deleteMutation.isPending ? confirmedId : null}
      />

      {/* Empty state with filters */}
      {!isLoading && repositories.length === 0 && hasActiveFilters && (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-12">
          <SearchOffIcon className="h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No repositories match your filters
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Try adjusting your search or filter criteria.
          </p>
          <Button variant="outline" onClick={resetFilters} className="mt-4">
            Clear Filters
          </Button>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          pageSize={pagination.pageSize}
          onPageChange={setPage}
        />
      )}

      {/* Add Repository Modal */}
      <AddRepoModal
        isOpen={isAddModalOpen}
        onClose={handleCloseAddModal}
        onAdd={handleAddRepository}
        isAdding={addMutation.isPending}
        addError={addMutation.error}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmation.isOpen}
        title="Delete Repository"
        message={`Are you sure you want to delete "${confirmation.repositoryName}"? This will remove all associated scan data and cannot be undone.`}
        confirmText="Delete"
        confirmVariant="danger"
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
        onCancel={closeConfirmation}
      />
    </div>
  );
}

// ============================================================================
// Icons
// ============================================================================

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M15.312 11.424a5.5 5.5 0 01-9.201 2.466l-.312-.311h2.433a.75.75 0 000-1.5H3.989a.75.75 0 00-.75.75v4.242a.75.75 0 001.5 0v-2.43l.31.31a7 7 0 0011.712-3.138.75.75 0 00-1.449-.39zm1.23-3.723a.75.75 0 00.219-.53V2.929a.75.75 0 00-1.5 0v2.43l-.31-.31A7 7 0 003.239 8.188a.75.75 0 101.448.389 5.5 5.5 0 019.2-2.466l.312.311h-2.433a.75.75 0 000 1.5h4.243a.75.75 0 00.53-.22z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SearchOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
      />
    </svg>
  );
}
