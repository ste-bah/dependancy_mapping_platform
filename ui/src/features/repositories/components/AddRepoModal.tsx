/**
 * Add Repository Modal Component
 * 3-step wizard for connecting new repositories
 * @module features/repositories/components/AddRepoModal
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
  Spinner,
  Alert,
} from '@/shared/components';
import { cn } from '@/shared/utils';
import { useAvailableRepositories } from '../hooks/useAvailableRepositories';
import type {
  RepositoryProvider,
  AvailableRepository,
  AddRepositoryInput,
} from '../types';
import { PROVIDER_CONFIGS } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface AddRepoModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** Callback when repository is added */
  onAdd: (input: AddRepositoryInput) => void;
  /** Is the add mutation pending */
  isAdding?: boolean;
  /** Error from the add mutation */
  addError?: Error | null;
}

type WizardStep = 1 | 2 | 3;

interface WizardState {
  step: WizardStep;
  provider: RepositoryProvider | null;
  selectedRepo: AvailableRepository | null;
  enableWebhook: boolean;
  scanOnAdd: boolean;
  search: string;
}

// ============================================================================
// Step Components
// ============================================================================

interface StepIndicatorProps {
  currentStep: WizardStep;
}

function StepIndicator({ currentStep }: StepIndicatorProps) {
  const steps = [
    { number: 1, label: 'Provider' },
    { number: 2, label: 'Repository' },
    { number: 3, label: 'Options' },
  ];

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-center space-x-4">
        {steps.map((step, index) => {
          const isCompleted = step.number < currentStep;
          const isCurrent = step.number === currentStep;

          return (
            <li key={step.number} className="flex items-center">
              <div className="flex items-center">
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium',
                    isCompleted && 'bg-primary-600 text-white',
                    isCurrent && 'border-2 border-primary-600 text-primary-600',
                    !isCompleted && !isCurrent && 'border-2 border-gray-300 text-gray-500'
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </span>
                <span
                  className={cn(
                    'ml-2 text-sm font-medium',
                    isCurrent ? 'text-gray-900' : 'text-gray-500'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'ml-4 h-0.5 w-12',
                    isCompleted ? 'bg-primary-600' : 'bg-gray-300'
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ============================================================================
// Step 1: Provider Selection
// ============================================================================

interface ProviderStepProps {
  selectedProvider: RepositoryProvider | null;
  onSelect: (provider: RepositoryProvider) => void;
}

function ProviderStep({ selectedProvider, onSelect }: ProviderStepProps) {
  const providers: RepositoryProvider[] = ['github', 'gitlab', 'bitbucket'];

  return (
    <div>
      <h3 className="mb-4 text-lg font-medium text-gray-900">
        Select a Provider
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        Choose the platform where your repository is hosted.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {providers.map((provider) => {
          const config = PROVIDER_CONFIGS[provider];
          const isSelected = selectedProvider === provider;

          return (
            <button
              key={provider}
              type="button"
              onClick={() => onSelect(provider)}
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border-2 p-6 transition-all',
                isSelected
                  ? 'border-primary-600 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
            >
              <ProviderIcon provider={provider} className="h-12 w-12 mb-3" />
              <span
                className={cn(
                  'text-sm font-medium',
                  isSelected ? 'text-primary-600' : 'text-gray-900'
                )}
              >
                {config.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Step 2: Repository Selection
// ============================================================================

interface RepositoryStepProps {
  provider: RepositoryProvider;
  selectedRepo: AvailableRepository | null;
  search: string;
  onSearchChange: (search: string) => void;
  onSelect: (repo: AvailableRepository) => void;
}

function RepositoryStep({
  provider,
  selectedRepo,
  search,
  onSearchChange,
  onSelect,
}: RepositoryStepProps) {
  const { data, isLoading, isError, error } = useAvailableRepositories({
    provider,
  });

  const filteredRepos = useMemo(() => {
    if (!data) return [];
    if (!search) return data;

    const searchLower = search.toLowerCase();
    return data.filter(
      (repo) =>
        repo.name.toLowerCase().includes(searchLower) ||
        repo.fullName.toLowerCase().includes(searchLower) ||
        repo.description?.toLowerCase().includes(searchLower)
    );
  }, [data, search]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="mt-4 text-sm text-gray-500">
          Loading repositories from {PROVIDER_CONFIGS[provider].name}...
        </p>
      </div>
    );
  }

  if (isError) {
    return (
      <Alert variant="error">
        Failed to load repositories: {error?.message ?? 'Unknown error'}
      </Alert>
    );
  }

  return (
    <div>
      <h3 className="mb-4 text-lg font-medium text-gray-900">
        Select a Repository
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        Choose the repository you want to analyze.
      </p>

      <Input
        placeholder="Search repositories..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="mb-4"
        fullWidth
      />

      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border p-2">
        {filteredRepos.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">
            {search ? 'No repositories match your search' : 'No repositories found'}
          </p>
        ) : (
          filteredRepos.map((repo) => {
            const isSelected = selectedRepo?.fullName === repo.fullName;

            return (
              <button
                key={repo.fullName}
                type="button"
                onClick={() => onSelect(repo)}
                className={cn(
                  'flex w-full items-center justify-between rounded-md px-4 py-3 text-left transition-colors',
                  isSelected
                    ? 'bg-primary-50 ring-2 ring-primary-600'
                    : 'hover:bg-gray-50'
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">
                      {repo.name}
                    </span>
                    {repo.private && (
                      <LockIcon className="h-3.5 w-3.5 text-gray-400" />
                    )}
                  </div>
                  <p className="truncate text-sm text-gray-500">
                    {repo.owner}
                  </p>
                  {repo.description && (
                    <p className="mt-1 truncate text-xs text-gray-400">
                      {repo.description}
                    </p>
                  )}
                </div>
                {isSelected && (
                  <CheckCircleIcon className="h-5 w-5 shrink-0 text-primary-600" />
                )}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Step 3: Options
// ============================================================================

interface OptionsStepProps {
  selectedRepo: AvailableRepository;
  enableWebhook: boolean;
  scanOnAdd: boolean;
  onEnableWebhookChange: (enabled: boolean) => void;
  onScanOnAddChange: (enabled: boolean) => void;
}

function OptionsStep({
  selectedRepo,
  enableWebhook,
  scanOnAdd,
  onEnableWebhookChange,
  onScanOnAddChange,
}: OptionsStepProps) {
  return (
    <div>
      <h3 className="mb-4 text-lg font-medium text-gray-900">
        Configure Options
      </h3>
      <p className="mb-6 text-sm text-gray-500">
        Set up how you want to monitor{' '}
        <span className="font-medium">{selectedRepo.fullName}</span>.
      </p>

      <div className="space-y-4">
        {/* Webhook Toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-gray-50">
          <input
            type="checkbox"
            checked={enableWebhook}
            onChange={(e) => onEnableWebhookChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <span className="font-medium text-gray-900">
              Enable Webhook
            </span>
            <p className="text-sm text-gray-500">
              Automatically scan when code is pushed to the repository.
            </p>
          </div>
        </label>

        {/* Scan on Add Toggle */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-gray-50">
          <input
            type="checkbox"
            checked={scanOnAdd}
            onChange={(e) => onScanOnAddChange(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div>
            <span className="font-medium text-gray-900">
              Scan Immediately
            </span>
            <p className="text-sm text-gray-500">
              Run an initial scan right after adding the repository.
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ============================================================================
// Main Modal Component
// ============================================================================

/**
 * 3-step wizard modal for adding new repositories
 *
 * @example
 * <AddRepoModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onAdd={(input) => addRepo.mutate(input)}
 *   isAdding={addRepo.isPending}
 *   addError={addRepo.error}
 * />
 */
export function AddRepoModal({
  isOpen,
  onClose,
  onAdd,
  isAdding = false,
  addError,
}: AddRepoModalProps) {
  // ============================================================================
  // State
  // ============================================================================

  const [state, setState] = useState<WizardState>({
    step: 1,
    provider: null,
    selectedRepo: null,
    enableWebhook: true,
    scanOnAdd: true,
    search: '',
  });

  // ============================================================================
  // Handlers
  // ============================================================================

  const handleClose = useCallback(() => {
    setState({
      step: 1,
      provider: null,
      selectedRepo: null,
      enableWebhook: true,
      scanOnAdd: true,
      search: '',
    });
    onClose();
  }, [onClose]);

  const handleProviderSelect = useCallback((provider: RepositoryProvider) => {
    setState((prev) => ({
      ...prev,
      provider,
      selectedRepo: null,
      search: '',
    }));
  }, []);

  const handleRepoSelect = useCallback((repo: AvailableRepository) => {
    setState((prev) => ({
      ...prev,
      selectedRepo: repo,
    }));
  }, []);

  const handleNext = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.min(prev.step + 1, 3) as WizardStep,
    }));
  }, []);

  const handleBack = useCallback(() => {
    setState((prev) => ({
      ...prev,
      step: Math.max(prev.step - 1, 1) as WizardStep,
    }));
  }, []);

  const handleSubmit = useCallback(() => {
    if (!state.provider || !state.selectedRepo) return;

    onAdd({
      provider: state.provider,
      owner: state.selectedRepo.owner,
      name: state.selectedRepo.name,
      enableWebhook: state.enableWebhook,
      scanOnAdd: state.scanOnAdd,
    });
  }, [state, onAdd]);

  // ============================================================================
  // Derived State
  // ============================================================================

  const canProceed = useMemo(() => {
    switch (state.step) {
      case 1:
        return state.provider !== null;
      case 2:
        return state.selectedRepo !== null;
      case 3:
        return true;
      default:
        return false;
    }
  }, [state.step, state.provider, state.selectedRepo]);

  // ============================================================================
  // Render
  // ============================================================================

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      aria-labelledby="modal-title"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-gray-900/50 transition-opacity"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div className="relative z-10 w-full max-w-lg transform overflow-hidden rounded-xl bg-white p-6 shadow-2xl transition-all">
        {/* Close Button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          aria-label="Close"
        >
          <XIcon className="h-5 w-5" />
        </button>

        {/* Title */}
        <h2
          id="modal-title"
          className="mb-6 text-xl font-semibold text-gray-900"
        >
          Connect Repository
        </h2>

        {/* Step Indicator */}
        <StepIndicator currentStep={state.step} />

        {/* Error Alert */}
        {addError && (
          <Alert variant="error" className="mb-4">
            {addError.message}
          </Alert>
        )}

        {/* Step Content */}
        <div className="min-h-[300px]">
          {state.step === 1 && (
            <ProviderStep
              selectedProvider={state.provider}
              onSelect={handleProviderSelect}
            />
          )}
          {state.step === 2 && state.provider && (
            <RepositoryStep
              provider={state.provider}
              selectedRepo={state.selectedRepo}
              search={state.search}
              onSearchChange={(search) =>
                setState((prev) => ({ ...prev, search }))
              }
              onSelect={handleRepoSelect}
            />
          )}
          {state.step === 3 && state.selectedRepo && (
            <OptionsStep
              selectedRepo={state.selectedRepo}
              enableWebhook={state.enableWebhook}
              scanOnAdd={state.scanOnAdd}
              onEnableWebhookChange={(enabled) =>
                setState((prev) => ({ ...prev, enableWebhook: enabled }))
              }
              onScanOnAddChange={(enabled) =>
                setState((prev) => ({ ...prev, scanOnAdd: enabled }))
              }
            />
          )}
        </div>

        {/* Footer Buttons */}
        <div className="mt-8 flex justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={state.step === 1 ? handleClose : handleBack}
            disabled={isAdding}
          >
            {state.step === 1 ? 'Cancel' : 'Back'}
          </Button>
          <Button
            onClick={state.step === 3 ? handleSubmit : handleNext}
            disabled={!canProceed || isAdding}
            loading={isAdding}
          >
            {state.step === 3 ? 'Connect Repository' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Icon Components
// ============================================================================

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path
        d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z"
      />
    </svg>
  );
}

interface ProviderIconProps {
  provider: RepositoryProvider;
  className?: string;
}

function ProviderIcon({ provider, className }: ProviderIconProps) {
  const config = PROVIDER_CONFIGS[provider];

  switch (provider) {
    case 'github':
      return (
        <svg className={className} viewBox="0 0 24 24" fill={config.color}>
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
      );
    case 'gitlab':
      return (
        <svg className={className} viewBox="0 0 24 24" fill={config.color}>
          <path d="m23.6 9.593-.033-.086L20.3.98a.85.85 0 0 0-.336-.405.869.869 0 0 0-1.003.063.875.875 0 0 0-.29.44l-2.2 6.748H7.53L5.33 1.078a.857.857 0 0 0-.29-.44.869.869 0 0 0-1.003-.063.85.85 0 0 0-.336.405L.433 9.507l-.032.086a6.066 6.066 0 0 0 2.012 7.01l.01.008.028.02 4.97 3.722 2.458 1.86 1.496 1.13a1.012 1.012 0 0 0 1.22 0l1.497-1.13 2.458-1.86 5-3.745.012-.01a6.068 6.068 0 0 0 2.008-7.005z" />
        </svg>
      );
    case 'bitbucket':
      return (
        <svg className={className} viewBox="0 0 24 24" fill={config.color}>
          <path d="M.778 1.213a.768.768 0 0 0-.768.892l3.263 19.81c.084.5.515.868 1.022.873H19.95a.772.772 0 0 0 .77-.646l3.27-20.03a.768.768 0 0 0-.768-.891L.778 1.213zM14.52 15.53H9.522L8.17 8.466h7.561l-1.211 7.064z" />
        </svg>
      );
    default:
      return null;
  }
}

export default AddRepoModal;
