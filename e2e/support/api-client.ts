/**
 * E2E Test API Client
 * @module e2e/support/api-client
 *
 * Type-safe test API client that wraps Fastify inject:
 * - Provides typed methods for all endpoints
 * - Handles authentication automatically
 * - Supports request/response validation
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import type { FastifyInstance } from 'fastify';
import type { AuthContext } from '../../api/src/types/auth.js';
import type { TenantId, RepositoryId, ScanId } from '../../api/src/types/entities.js';
import type { RollupId, RollupExecutionId } from '../../api/src/types/rollup.js';
import type { TestResponse } from './test-context.js';

// ============================================================================
// Types - Health API
// ============================================================================

/**
 * Health check response
 */
export interface HealthResponse {
  readonly status: 'healthy' | 'unhealthy' | 'degraded';
  readonly version?: string;
  readonly uptime?: number;
  readonly timestamp: string;
}

/**
 * Detailed health check response
 */
export interface DetailedHealthResponse extends HealthResponse {
  readonly checks: {
    readonly database: boolean;
    readonly memory: {
      readonly heapUsed: number;
      readonly heapTotal: number;
    };
  };
}

/**
 * Liveness probe response
 */
export interface LivenessResponse {
  readonly alive: boolean;
  readonly timestamp: string;
}

/**
 * Readiness probe response
 */
export interface ReadinessResponse {
  readonly ready: boolean;
  readonly timestamp: string;
  readonly dependencies: {
    readonly database: boolean;
  };
}

// ============================================================================
// Types - Repository API
// ============================================================================

/**
 * Repository response
 */
export interface RepositoryResponse {
  readonly id: RepositoryId;
  readonly tenantId: TenantId;
  readonly provider: 'github' | 'gitlab' | 'bitbucket';
  readonly owner: string;
  readonly name: string;
  readonly cloneUrl: string;
  readonly defaultBranch: string;
  readonly lastScanAt: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Repository create request
 */
export interface RepositoryCreateRequest {
  readonly provider: 'github' | 'gitlab' | 'bitbucket';
  readonly owner: string;
  readonly name: string;
  readonly cloneUrl: string;
  readonly defaultBranch?: string;
}

/**
 * Repository list response
 */
export interface RepositoryListResponse {
  readonly data: RepositoryResponse[];
  readonly pagination: PaginationMeta;
}

// ============================================================================
// Types - Scan API
// ============================================================================

/**
 * Scan response
 */
export interface ScanResponse {
  readonly id: ScanId;
  readonly repositoryId: RepositoryId;
  readonly commitSha: string;
  readonly branch: string;
  readonly status: 'pending' | 'cloning' | 'analyzing' | 'indexing' | 'completed' | 'failed';
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly errorMessage: string | null;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly createdAt: string;
}

/**
 * Scan create request
 */
export interface ScanCreateRequest {
  readonly repositoryId: RepositoryId;
  readonly commitSha?: string;
  readonly branch?: string;
}

/**
 * Scan list response
 */
export interface ScanListResponse {
  readonly data: ScanResponse[];
  readonly pagination: PaginationMeta;
}

// ============================================================================
// Types - Graph API
// ============================================================================

/**
 * Graph node response
 */
export interface GraphNodeResponse {
  readonly id: string;
  readonly scanId: ScanId;
  readonly type: string;
  readonly name: string;
  readonly qualifiedName: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly metadata: Record<string, unknown>;
}

/**
 * Graph edge response
 */
export interface GraphEdgeResponse {
  readonly id: string;
  readonly scanId: ScanId;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly type: string;
  readonly confidence: number;
  readonly evidence: Record<string, unknown>;
}

/**
 * Graph response
 */
export interface GraphResponse {
  readonly scanId: ScanId;
  readonly nodes: GraphNodeResponse[];
  readonly edges: GraphEdgeResponse[];
  readonly stats: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly nodesByType: Record<string, number>;
    readonly edgesByType: Record<string, number>;
  };
}

// ============================================================================
// Types - Rollup API
// ============================================================================

/**
 * Rollup response
 */
export interface RollupResponse {
  readonly id: RollupId;
  readonly tenantId: TenantId;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'draft' | 'active' | 'paused' | 'archived';
  readonly repositoryIds: RepositoryId[];
  readonly matchers: Array<{
    readonly type: string;
    readonly enabled: boolean;
    readonly priority: number;
  }>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly lastExecutedAt: string | null;
}

/**
 * Rollup create request
 */
export interface RollupCreateRequest {
  readonly name: string;
  readonly description?: string;
  readonly repositoryIds: RepositoryId[];
  readonly matchers: Array<{
    readonly type: string;
    readonly enabled?: boolean;
    readonly priority?: number;
    readonly minConfidence?: number;
  }>;
}

/**
 * Rollup execution response
 */
export interface RollupExecutionResponse {
  readonly id: RollupExecutionId;
  readonly rollupId: RollupId;
  readonly status: 'pending' | 'running' | 'completed' | 'failed';
  readonly stats: {
    readonly nodesProcessed: number;
    readonly edgesProcessed: number;
    readonly matchesFound: number;
    readonly durationMs: number;
  } | null;
  readonly errorMessage: string | null;
  readonly createdAt: string;
  readonly completedAt: string | null;
}

/**
 * Blast radius response
 */
export interface BlastRadiusResponse {
  readonly query: {
    readonly nodeIds: string[];
    readonly maxDepth: number;
  };
  readonly rollupId: RollupId;
  readonly executionId: RollupExecutionId;
  readonly directImpact: GraphNodeResponse[];
  readonly indirectImpact: GraphNodeResponse[];
  readonly crossRepoImpact: GraphNodeResponse[];
  readonly summary: {
    readonly totalImpacted: number;
    readonly directCount: number;
    readonly indirectCount: number;
    readonly crossRepoCount: number;
    readonly riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ============================================================================
// Types - Common
// ============================================================================

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly totalPages: number;
  readonly hasNext: boolean;
  readonly hasPrevious: boolean;
}

/**
 * Error response
 */
export interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ============================================================================
// API Client Implementation
// ============================================================================

/**
 * Type-safe E2E test API client
 */
export class TestApiClient {
  private readonly app: FastifyInstance;
  private auth: AuthContext | null = null;
  private defaultTenantId: TenantId;

  constructor(app: FastifyInstance, defaultTenantId: TenantId) {
    this.app = app;
    this.defaultTenantId = defaultTenantId;
  }

  /**
   * Set authentication context for requests
   */
  setAuth(auth: AuthContext): TestApiClient {
    this.auth = auth;
    return this;
  }

  /**
   * Clear authentication context
   */
  clearAuth(): TestApiClient {
    this.auth = null;
    return this;
  }

  // ==========================================================================
  // Health Endpoints
  // ==========================================================================

  /**
   * GET /health
   */
  async getHealth(): Promise<TestResponse<HealthResponse>> {
    return this.request('GET', '/health', { authenticated: false });
  }

  /**
   * GET /health/detailed
   */
  async getDetailedHealth(): Promise<TestResponse<DetailedHealthResponse>> {
    return this.request('GET', '/health/detailed', { authenticated: false });
  }

  /**
   * GET /health/live
   */
  async getLiveness(): Promise<TestResponse<LivenessResponse>> {
    return this.request('GET', '/health/live', { authenticated: false });
  }

  /**
   * GET /health/ready
   */
  async getReadiness(): Promise<TestResponse<ReadinessResponse>> {
    return this.request('GET', '/health/ready', { authenticated: false });
  }

  // ==========================================================================
  // Repository Endpoints
  // ==========================================================================

  /**
   * GET /api/v1/repositories
   */
  async listRepositories(
    params?: { page?: number; pageSize?: number }
  ): Promise<TestResponse<RepositoryListResponse>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const url = query.toString()
      ? `/api/v1/repositories?${query.toString()}`
      : '/api/v1/repositories';

    return this.request('GET', url);
  }

  /**
   * GET /api/v1/repositories/:id
   */
  async getRepository(
    id: RepositoryId
  ): Promise<TestResponse<RepositoryResponse>> {
    return this.request('GET', `/api/v1/repositories/${id}`);
  }

  /**
   * POST /api/v1/repositories
   */
  async createRepository(
    data: RepositoryCreateRequest
  ): Promise<TestResponse<RepositoryResponse>> {
    return this.request('POST', '/api/v1/repositories', { body: data });
  }

  /**
   * DELETE /api/v1/repositories/:id
   */
  async deleteRepository(
    id: RepositoryId
  ): Promise<TestResponse<{ deleted: boolean }>> {
    return this.request('DELETE', `/api/v1/repositories/${id}`);
  }

  // ==========================================================================
  // Scan Endpoints
  // ==========================================================================

  /**
   * GET /api/v1/scans
   */
  async listScans(
    params?: { repositoryId?: RepositoryId; page?: number; pageSize?: number }
  ): Promise<TestResponse<ScanListResponse>> {
    const query = new URLSearchParams();
    if (params?.repositoryId) query.set('repositoryId', params.repositoryId);
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));

    const url = query.toString()
      ? `/api/v1/scans?${query.toString()}`
      : '/api/v1/scans';

    return this.request('GET', url);
  }

  /**
   * GET /api/v1/scans/:id
   */
  async getScan(id: ScanId): Promise<TestResponse<ScanResponse>> {
    return this.request('GET', `/api/v1/scans/${id}`);
  }

  /**
   * POST /api/v1/scans
   */
  async createScan(
    data: ScanCreateRequest
  ): Promise<TestResponse<ScanResponse>> {
    return this.request('POST', '/api/v1/scans', { body: data });
  }

  /**
   * GET /api/v1/scans/:id/graph
   */
  async getScanGraph(id: ScanId): Promise<TestResponse<GraphResponse>> {
    return this.request('GET', `/api/v1/scans/${id}/graph`);
  }

  // ==========================================================================
  // Rollup Endpoints
  // ==========================================================================

  /**
   * GET /api/v1/rollups
   */
  async listRollups(
    params?: { page?: number; pageSize?: number; status?: string }
  ): Promise<TestResponse<{ data: RollupResponse[]; pagination: PaginationMeta }>> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.pageSize) query.set('pageSize', String(params.pageSize));
    if (params?.status) query.set('status', params.status);

    const url = query.toString()
      ? `/api/v1/rollups?${query.toString()}`
      : '/api/v1/rollups';

    return this.request('GET', url);
  }

  /**
   * GET /api/v1/rollups/:id
   */
  async getRollup(id: RollupId): Promise<TestResponse<RollupResponse>> {
    return this.request('GET', `/api/v1/rollups/${id}`);
  }

  /**
   * POST /api/v1/rollups
   */
  async createRollup(
    data: RollupCreateRequest
  ): Promise<TestResponse<RollupResponse>> {
    return this.request('POST', '/api/v1/rollups', { body: data });
  }

  /**
   * POST /api/v1/rollups/:id/execute
   */
  async executeRollup(
    id: RollupId,
    data?: { scanIds?: ScanId[] }
  ): Promise<TestResponse<RollupExecutionResponse>> {
    return this.request('POST', `/api/v1/rollups/${id}/execute`, { body: data });
  }

  /**
   * GET /api/v1/rollups/:id/executions/:execId
   */
  async getRollupExecution(
    rollupId: RollupId,
    executionId: RollupExecutionId
  ): Promise<TestResponse<RollupExecutionResponse>> {
    return this.request(
      'GET',
      `/api/v1/rollups/${rollupId}/executions/${executionId}`
    );
  }

  /**
   * POST /api/v1/rollups/:id/blast-radius
   */
  async getBlastRadius(
    rollupId: RollupId,
    data: { nodeIds: string[]; maxDepth?: number }
  ): Promise<TestResponse<BlastRadiusResponse>> {
    return this.request('POST', `/api/v1/rollups/${rollupId}/blast-radius`, {
      body: data,
    });
  }

  // ==========================================================================
  // Auth Endpoints
  // ==========================================================================

  /**
   * GET /auth/github
   */
  async startGitHubOAuth(): Promise<TestResponse<{ redirectUrl: string }>> {
    return this.request('GET', '/auth/github', { authenticated: false });
  }

  /**
   * GET /auth/me
   */
  async getCurrentUser(): Promise<
    TestResponse<{
      id: string;
      email: string;
      name: string;
      githubId: number;
    }>
  > {
    return this.request('GET', '/auth/me');
  }

  // ==========================================================================
  // Internal Request Method
  // ==========================================================================

  /**
   * Make an HTTP request to the test app
   */
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      authenticated?: boolean;
    }
  ): Promise<TestResponse<T>> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...options?.headers,
    };

    // Add auth headers if authenticated
    if (options?.authenticated !== false && this.auth) {
      headers['x-user-id'] = this.auth.userId;
      headers['x-tenant-id'] = this.auth.tenantId ?? this.defaultTenantId;
    }

    const response = await this.app.inject({
      method,
      url,
      headers,
      payload: options?.body ? JSON.stringify(options.body) : undefined,
    });

    let body: T;
    try {
      body = response.json();
    } catch {
      body = response.payload as unknown as T;
    }

    return {
      statusCode: response.statusCode,
      headers: response.headers as Record<string, string | string[] | undefined>,
      body,
      rawBody: response.payload,
      raw: response,
      expectStatus(expected: number) {
        if (response.statusCode !== expected) {
          throw new Error(
            `Expected status ${expected}, got ${response.statusCode}. Body: ${response.payload}`
          );
        }
        return this;
      },
      expectBody(expected: Partial<T>) {
        for (const [key, value] of Object.entries(expected)) {
          const actualValue = (body as Record<string, unknown>)[key];
          if (JSON.stringify(actualValue) !== JSON.stringify(value)) {
            throw new Error(
              `Expected body.${key} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`
            );
          }
        }
        return this;
      },
      expectBodyProperty<K extends keyof T>(key: K, value?: T[K]) {
        const actualValue = (body as T)[key];
        if (actualValue === undefined) {
          throw new Error(`Expected body to have property ${String(key)}`);
        }
        if (value !== undefined && actualValue !== value) {
          throw new Error(
            `Expected body.${String(key)} to be ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`
          );
        }
        return this;
      },
      expectHeader(name: string, value?: string) {
        const headerValue = response.headers[name.toLowerCase()];
        if (headerValue === undefined) {
          throw new Error(`Expected header ${name} to be present`);
        }
        if (value !== undefined && headerValue !== value) {
          throw new Error(
            `Expected header ${name} to be ${value}, got ${headerValue}`
          );
        }
        return this;
      },
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a test API client
 */
export function createApiClient(
  app: FastifyInstance,
  defaultTenantId: TenantId
): TestApiClient {
  return new TestApiClient(app, defaultTenantId);
}

// ============================================================================
// Exports
// ============================================================================

export {
  HealthResponse,
  DetailedHealthResponse,
  LivenessResponse,
  ReadinessResponse,
  RepositoryResponse,
  RepositoryCreateRequest,
  RepositoryListResponse,
  ScanResponse,
  ScanCreateRequest,
  ScanListResponse,
  GraphNodeResponse,
  GraphEdgeResponse,
  GraphResponse,
  RollupResponse,
  RollupCreateRequest,
  RollupExecutionResponse,
  BlastRadiusResponse,
  PaginationMeta,
  ErrorResponse,
  TestApiClient,
};
