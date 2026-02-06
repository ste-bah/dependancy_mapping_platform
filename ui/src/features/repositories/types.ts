/**
 * Repository Types
 * Type definitions for repository-related data structures
 * @module features/repositories/types
 */

// ============================================================================
// Provider and Status Types
// ============================================================================

/**
 * Supported repository providers
 */
export type RepositoryProvider = 'github' | 'gitlab' | 'bitbucket';

/**
 * Possible scan statuses
 */
export type ScanStatus = 'idle' | 'pending' | 'scanning' | 'completed' | 'failed';

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Repository entity from the API
 */
export interface Repository {
  id: string;
  provider: RepositoryProvider;
  owner: string;
  name: string;
  fullName: string;
  url: string;
  nodeCount: number;
  edgeCount: number;
  lastScanAt: string | null;
  lastScanStatus: ScanStatus;
  webhookEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Available repository from OAuth provider (not yet added)
 */
export interface AvailableRepository {
  owner: string;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Repository list filter options
 */
export interface RepositoryFilters {
  provider?: RepositoryProvider | 'all';
  status?: ScanStatus | 'all';
  search?: string;
  page?: number;
  limit?: number;
}

// ============================================================================
// Input Types
// ============================================================================

/**
 * Input for adding a new repository
 */
export interface AddRepositoryInput {
  provider: RepositoryProvider;
  owner: string;
  name: string;
  enableWebhook: boolean;
  scanOnAdd: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Paginated repositories response
 */
export interface RepositoriesResponse {
  data: Repository[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

/**
 * Scan trigger response
 */
export interface TriggerScanResponse {
  scanId: string;
  repositoryId: string;
  status: ScanStatus;
  startedAt: string;
}

// ============================================================================
// Provider Configuration
// ============================================================================

/**
 * Provider display configuration
 */
export interface ProviderConfig {
  name: string;
  icon: string;
  color: string;
}

export const PROVIDER_CONFIGS: Record<RepositoryProvider, ProviderConfig> = {
  github: {
    name: 'GitHub',
    icon: 'github',
    color: '#24292e',
  },
  gitlab: {
    name: 'GitLab',
    icon: 'gitlab',
    color: '#fc6d26',
  },
  bitbucket: {
    name: 'Bitbucket',
    icon: 'bitbucket',
    color: '#0052cc',
  },
};

/**
 * Status display configuration
 */
export interface StatusConfig {
  label: string;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'error';
}

export const STATUS_CONFIGS: Record<ScanStatus, StatusConfig> = {
  idle: {
    label: 'Idle',
    variant: 'default',
  },
  pending: {
    label: 'Pending',
    variant: 'warning',
  },
  scanning: {
    label: 'Scanning',
    variant: 'primary',
  },
  completed: {
    label: 'Completed',
    variant: 'success',
  },
  failed: {
    label: 'Failed',
    variant: 'error',
  },
};
