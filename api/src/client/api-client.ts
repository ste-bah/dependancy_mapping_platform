/**
 * IaC Dependency Detection API Client
 * @module client/api-client
 *
 * TypeScript client for consuming the IaC dependency detection REST API.
 * Provides typed request/response handling, error management, and authentication.
 *
 * @example
 * ```typescript
 * import { IaCClient } from '@dmp/api-client';
 *
 * const client = new IaCClient({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Create a scan
 * const scan = await client.scans.create({
 *   repositoryId: 'repo-uuid',
 *   ref: 'main',
 * });
 *
 * // Get graph
 * const graph = await client.graph.get(scan.id);
 * ```
 */

import type {
  // Scan types
  CreateScanRequest,
  ScanResponse,
  CancelScanRequest,
  ListScansQuery,
  // Graph types
  GraphResponse,
  NodeDetail,
  NodeFilterQuery,
  EdgeFilterQuery,
  TraversalQuery,
  TraversalResult,
  CycleDetectionResult,
  ImpactAnalysisResult,
  GraphNode,
  GraphEdge,
  // Repository types
  RepositoryResponse,
  AddRepositoryRequest,
  UpdateRepositoryRequest,
  ListRepositoriesQuery,
  RepositoryDeletedResponse,
  // Health types
  HealthCheckResponse,
  DetailedHealthCheckResponse,
  // Common types
  PaginatedResponse,
  ApiErrorResponse,
} from './types.js';

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * API client configuration options
 */
export interface IaCClientConfig {
  /** Base URL for the API (e.g., 'https://api.example.com') */
  baseUrl: string;
  /** API key for authentication */
  apiKey?: string;
  /** OAuth/JWT token for authentication */
  token?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Custom headers to include in all requests */
  headers?: Record<string, string>;
  /** Custom fetch implementation (for Node.js or testing) */
  fetch?: typeof fetch;
  /** Retry configuration */
  retry?: {
    /** Maximum number of retries (default: 3) */
    maxRetries?: number;
    /** Base delay between retries in ms (default: 1000) */
    baseDelay?: number;
    /** Maximum delay between retries in ms (default: 10000) */
    maxDelay?: number;
  };
}

/**
 * Request options for individual API calls
 */
export interface RequestOptions {
  /** Request timeout override */
  timeout?: number;
  /** Additional headers for this request */
  headers?: Record<string, string>;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
  /** Skip retry logic for this request */
  skipRetry?: boolean;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for API errors
 */
export class IaCApiError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(response: ApiErrorResponse, requestId?: string) {
    super(response.message);
    this.name = 'IaCApiError';
    this.statusCode = response.statusCode;
    this.code = response.code ?? 'UNKNOWN_ERROR';
    this.details = response.details;
    this.requestId = requestId;
  }

  /**
   * Check if error is a specific type
   */
  is(code: string): boolean {
    return this.code === code;
  }

  /**
   * Check if error is retryable
   */
  get isRetryable(): boolean {
    return (
      this.statusCode >= 500 ||
      this.statusCode === 429 ||
      this.code === 'TIMEOUT'
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      statusCode: this.statusCode,
      code: this.code,
      details: this.details,
      requestId: this.requestId,
    };
  }
}

/**
 * Network error (connection failed, timeout, etc.)
 */
export class NetworkError extends Error {
  public readonly cause?: Error;

  constructor(message: string, cause?: Error) {
    super(message);
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

/**
 * Validation error for client-side input validation
 */
export class ValidationError extends Error {
  public readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

// ============================================================================
// HTTP Client Implementation
// ============================================================================

/**
 * Internal HTTP client for making API requests
 */
class HttpClient {
  private readonly config: Required<
    Pick<IaCClientConfig, 'baseUrl' | 'timeout'>
  > &
    IaCClientConfig;
  private readonly fetchFn: typeof fetch;

  constructor(config: IaCClientConfig) {
    this.config = {
      ...config,
      timeout: config.timeout ?? 30000,
    };
    this.fetchFn = config.fetch ?? globalThis.fetch;

    if (!this.fetchFn) {
      throw new Error(
        'fetch is not available. Please provide a fetch implementation.'
      );
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrl(
    path: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    const url = new URL(path, this.config.baseUrl);

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }
    }

    return url.toString();
  }

  /**
   * Build request headers
   */
  private buildHeaders(options?: RequestOptions): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...this.config.headers,
      ...options?.headers,
    });

    if (this.config.apiKey) {
      headers.set('X-API-Key', this.config.apiKey);
    }

    if (this.config.token) {
      headers.set('Authorization', `Bearer ${this.config.token}`);
    }

    return headers;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(attempt: number): number {
    const baseDelay = this.config.retry?.baseDelay ?? 1000;
    const maxDelay = this.config.retry?.maxDelay ?? 10000;
    const delay = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
    // Add jitter
    return delay + Math.random() * 100;
  }

  /**
   * Execute HTTP request with retries
   */
  async request<T>(
    method: string,
    path: string,
    options?: RequestOptions & {
      body?: unknown;
      params?: Record<string, string | number | boolean | undefined>;
    }
  ): Promise<T> {
    const url = this.buildUrl(path, options?.params);
    const headers = this.buildHeaders(options);
    const timeout = options?.timeout ?? this.config.timeout;
    const maxRetries =
      options?.skipRetry ? 0 : (this.config.retry?.maxRetries ?? 3);

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // Combine signals if one was provided
        const signal = options?.signal
          ? this.combineAbortSignals(options.signal, controller.signal)
          : controller.signal;

        const response = await this.fetchFn(url, {
          method,
          headers,
          body: options?.body ? JSON.stringify(options.body) : undefined,
          signal,
        });

        clearTimeout(timeoutId);

        const requestId = response.headers.get('X-Request-Id') ?? undefined;

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => ({
            statusCode: response.status,
            error: response.statusText,
            message: `Request failed with status ${response.status}`,
          }))) as ApiErrorResponse;

          const error = new IaCApiError(
            {
              ...errorBody,
              statusCode: response.status,
            },
            requestId
          );

          // Don't retry client errors (except rate limiting)
          if (!error.isRetryable || attempt === maxRetries) {
            throw error;
          }

          lastError = error;
        } else {
          // Handle 204 No Content
          if (response.status === 204) {
            return undefined as T;
          }

          return (await response.json()) as T;
        }
      } catch (error) {
        if (error instanceof IaCApiError) {
          throw error;
        }

        if (error instanceof DOMException && error.name === 'AbortError') {
          if (options?.signal?.aborted) {
            throw new NetworkError('Request was cancelled');
          }
          throw new NetworkError('Request timed out');
        }

        lastError =
          error instanceof Error ? error : new Error(String(error));

        if (attempt === maxRetries) {
          throw new NetworkError(
            `Network request failed: ${lastError.message}`,
            lastError
          );
        }
      }

      // Wait before retry
      if (attempt < maxRetries) {
        await this.sleep(this.getRetryDelay(attempt));
      }
    }

    throw lastError ?? new NetworkError('Request failed after retries');
  }

  private combineAbortSignals(
    ...signals: AbortSignal[]
  ): AbortSignal {
    const controller = new AbortController();

    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort();
        break;
      }
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller.signal;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Convenience methods
  get<T>(
    path: string,
    params?: Record<string, string | number | boolean | undefined>,
    options?: RequestOptions
  ): Promise<T> {
    return this.request<T>('GET', path, { ...options, params });
  }

  post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }
}

// ============================================================================
// API Resource Classes
// ============================================================================

/**
 * Scans API resource
 */
export class ScansApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Create a new scan
   */
  async create(
    request: CreateScanRequest,
    options?: RequestOptions
  ): Promise<ScanResponse> {
    return this.http.post<ScanResponse>('/api/v1/scans', request, options);
  }

  /**
   * Get a scan by ID
   */
  async get(scanId: string, options?: RequestOptions): Promise<ScanResponse> {
    return this.http.get<ScanResponse>(`/api/v1/scans/${scanId}`, undefined, options);
  }

  /**
   * List scans with optional filtering
   */
  async list(
    query?: ListScansQuery,
    options?: RequestOptions
  ): Promise<PaginatedResponse<ScanResponse>> {
    return this.http.get<PaginatedResponse<ScanResponse>>(
      '/api/v1/scans',
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Get scan status (lightweight endpoint for polling)
   */
  async getStatus(
    scanId: string,
    options?: RequestOptions
  ): Promise<Pick<ScanResponse, 'id' | 'status' | 'progress' | 'startedAt'>> {
    return this.http.get(`/api/v1/scans/${scanId}/status`, undefined, options);
  }

  /**
   * Cancel a running scan
   */
  async cancel(
    scanId: string,
    request?: CancelScanRequest,
    options?: RequestOptions
  ): Promise<ScanResponse> {
    return this.http.post<ScanResponse>(
      `/api/v1/scans/${scanId}/cancel`,
      request,
      options
    );
  }

  /**
   * Delete a scan and its results
   */
  async delete(scanId: string, options?: RequestOptions): Promise<void> {
    return this.http.delete(`/api/v1/scans/${scanId}`, options);
  }

  /**
   * Poll for scan completion
   * @param scanId Scan ID to poll
   * @param options Polling options
   * @returns Final scan response when complete
   */
  async waitForCompletion(
    scanId: string,
    options?: {
      /** Polling interval in ms (default: 2000) */
      interval?: number;
      /** Maximum time to wait in ms (default: 300000 = 5 minutes) */
      timeout?: number;
      /** Callback for progress updates */
      onProgress?: (scan: ScanResponse) => void;
      /** Abort signal */
      signal?: AbortSignal;
    }
  ): Promise<ScanResponse> {
    const interval = options?.interval ?? 2000;
    const timeout = options?.timeout ?? 300000;
    const startTime = Date.now();

    while (true) {
      if (options?.signal?.aborted) {
        throw new NetworkError('Polling was cancelled');
      }

      const scan = await this.get(scanId, { signal: options?.signal });

      options?.onProgress?.(scan);

      if (['completed', 'failed', 'cancelled'].includes(scan.status)) {
        return scan;
      }

      if (Date.now() - startTime > timeout) {
        throw new NetworkError(
          `Scan did not complete within ${timeout}ms timeout`
        );
      }

      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
}

/**
 * Graph API resource
 */
export class GraphApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Get full dependency graph for a scan
   */
  async get(scanId: string, options?: RequestOptions): Promise<GraphResponse> {
    return this.http.get<GraphResponse>(
      `/api/v1/scans/${scanId}/graph`,
      undefined,
      options
    );
  }

  /**
   * List nodes with filtering
   */
  async listNodes(
    scanId: string,
    query?: NodeFilterQuery,
    options?: RequestOptions
  ): Promise<PaginatedResponse<GraphNode>> {
    return this.http.get<PaginatedResponse<GraphNode>>(
      `/api/v1/scans/${scanId}/graph/nodes`,
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Get node details with relationships
   */
  async getNode(
    scanId: string,
    nodeId: string,
    options?: RequestOptions
  ): Promise<NodeDetail> {
    return this.http.get<NodeDetail>(
      `/api/v1/scans/${scanId}/graph/nodes/${nodeId}`,
      undefined,
      options
    );
  }

  /**
   * List edges with filtering
   */
  async listEdges(
    scanId: string,
    query?: EdgeFilterQuery,
    options?: RequestOptions
  ): Promise<PaginatedResponse<GraphEdge>> {
    return this.http.get<PaginatedResponse<GraphEdge>>(
      `/api/v1/scans/${scanId}/graph/edges`,
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Get downstream dependencies (what this node depends on)
   */
  async getDependencies(
    scanId: string,
    nodeId: string,
    query?: TraversalQuery,
    options?: RequestOptions
  ): Promise<TraversalResult> {
    return this.http.get<TraversalResult>(
      `/api/v1/scans/${scanId}/graph/nodes/${nodeId}/dependencies`,
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Get upstream dependents (what depends on this node)
   */
  async getDependents(
    scanId: string,
    nodeId: string,
    query?: TraversalQuery,
    options?: RequestOptions
  ): Promise<TraversalResult> {
    return this.http.get<TraversalResult>(
      `/api/v1/scans/${scanId}/graph/nodes/${nodeId}/dependents`,
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Detect cycles in the graph
   */
  async detectCycles(
    scanId: string,
    options?: RequestOptions
  ): Promise<CycleDetectionResult> {
    return this.http.get<CycleDetectionResult>(
      `/api/v1/scans/${scanId}/graph/cycles`,
      undefined,
      options
    );
  }

  /**
   * Analyze impact of changes to specified nodes
   */
  async analyzeImpact(
    scanId: string,
    nodeIds: string[],
    options?: RequestOptions
  ): Promise<ImpactAnalysisResult> {
    return this.http.post<ImpactAnalysisResult>(
      `/api/v1/scans/${scanId}/graph/impact`,
      { nodeIds },
      options
    );
  }

  /**
   * Export graph in various formats
   */
  async export(
    scanId: string,
    format: 'json' | 'dot' | 'mermaid' | 'cytoscape' | 'd3' = 'json',
    options?: RequestOptions
  ): Promise<string | GraphResponse> {
    return this.http.get(
      `/api/v1/scans/${scanId}/graph/export`,
      { format },
      options
    );
  }
}

/**
 * Repositories API resource
 */
export class RepositoriesApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Add a repository to track
   */
  async add(
    request: AddRepositoryRequest,
    options?: RequestOptions
  ): Promise<RepositoryResponse> {
    return this.http.post<RepositoryResponse>(
      '/api/v1/repositories',
      request,
      options
    );
  }

  /**
   * Get a repository by ID
   */
  async get(
    repositoryId: string,
    options?: RequestOptions
  ): Promise<RepositoryResponse> {
    return this.http.get<RepositoryResponse>(
      `/api/v1/repositories/${repositoryId}`,
      undefined,
      options
    );
  }

  /**
   * List repositories with optional filtering
   */
  async list(
    query?: ListRepositoriesQuery,
    options?: RequestOptions
  ): Promise<PaginatedResponse<RepositoryResponse>> {
    return this.http.get<PaginatedResponse<RepositoryResponse>>(
      '/api/v1/repositories',
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }

  /**
   * Update a repository
   */
  async update(
    repositoryId: string,
    request: UpdateRepositoryRequest,
    options?: RequestOptions
  ): Promise<RepositoryResponse> {
    return this.http.patch<RepositoryResponse>(
      `/api/v1/repositories/${repositoryId}`,
      request,
      options
    );
  }

  /**
   * Delete a repository and all its scans
   */
  async delete(
    repositoryId: string,
    options?: RequestOptions
  ): Promise<RepositoryDeletedResponse> {
    return this.http.delete<RepositoryDeletedResponse>(
      `/api/v1/repositories/${repositoryId}`,
      options
    );
  }

  /**
   * Trigger a scan for a repository
   */
  async scan(
    repositoryId: string,
    request?: Pick<CreateScanRequest, 'ref' | 'config' | 'priority' | 'callbackUrl'>,
    options?: RequestOptions
  ): Promise<ScanResponse> {
    return this.http.post<ScanResponse>(
      `/api/v1/repositories/${repositoryId}/scan`,
      request,
      options
    );
  }

  /**
   * List scans for a repository
   */
  async listScans(
    repositoryId: string,
    query?: Omit<ListScansQuery, 'repositoryId'>,
    options?: RequestOptions
  ): Promise<PaginatedResponse<ScanResponse>> {
    return this.http.get<PaginatedResponse<ScanResponse>>(
      `/api/v1/repositories/${repositoryId}/scans`,
      query as Record<string, string | number | boolean | undefined>,
      options
    );
  }
}

/**
 * Health API resource
 */
export class HealthApi {
  constructor(private readonly http: HttpClient) {}

  /**
   * Basic health check
   */
  async check(options?: RequestOptions): Promise<HealthCheckResponse> {
    return this.http.get<HealthCheckResponse>('/health', undefined, options);
  }

  /**
   * Detailed health check with dependency status
   */
  async detailed(options?: RequestOptions): Promise<DetailedHealthCheckResponse> {
    return this.http.get<DetailedHealthCheckResponse>(
      '/health/detailed',
      undefined,
      options
    );
  }

  /**
   * Liveness probe (for Kubernetes)
   */
  async liveness(options?: RequestOptions): Promise<{ alive: boolean }> {
    return this.http.get<{ alive: boolean }>('/health/live', undefined, options);
  }

  /**
   * Readiness probe (for Kubernetes)
   */
  async readiness(
    options?: RequestOptions
  ): Promise<{ ready: boolean; dependencies: Record<string, boolean> }> {
    return this.http.get('/health/ready', undefined, options);
  }
}

// ============================================================================
// Main Client Class
// ============================================================================

/**
 * IaC Dependency Detection API Client
 *
 * @example
 * ```typescript
 * const client = new IaCClient({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: 'your-api-key',
 * });
 *
 * // Add a repository
 * const repo = await client.repositories.add({
 *   provider: 'github',
 *   owner: 'your-org',
 *   name: 'your-repo',
 * });
 *
 * // Create and wait for a scan
 * const scan = await client.scans.create({ repositoryId: repo.id });
 * const completed = await client.scans.waitForCompletion(scan.id);
 *
 * // Get the dependency graph
 * const graph = await client.graph.get(completed.id);
 * console.log(`Found ${graph.stats.totalNodes} nodes and ${graph.stats.totalEdges} edges`);
 * ```
 */
export class IaCClient {
  private readonly http: HttpClient;

  /** Scans API */
  public readonly scans: ScansApi;
  /** Graph API */
  public readonly graph: GraphApi;
  /** Repositories API */
  public readonly repositories: RepositoriesApi;
  /** Health API */
  public readonly health: HealthApi;

  /**
   * Create a new API client instance
   */
  constructor(config: IaCClientConfig) {
    if (!config.baseUrl) {
      throw new ValidationError('baseUrl is required', 'baseUrl');
    }

    this.http = new HttpClient(config);
    this.scans = new ScansApi(this.http);
    this.graph = new GraphApi(this.http);
    this.repositories = new RepositoriesApi(this.http);
    this.health = new HealthApi(this.http);
  }

  /**
   * Update authentication token
   */
  setToken(token: string): void {
    (this.http as unknown as { config: IaCClientConfig }).config.token = token;
  }

  /**
   * Clear authentication
   */
  clearAuth(): void {
    const config = (this.http as unknown as { config: IaCClientConfig }).config;
    config.token = undefined;
    config.apiKey = undefined;
  }
}

/**
 * Create a pre-configured client instance
 */
export function createClient(config: IaCClientConfig): IaCClient {
  return new IaCClient(config);
}

// Default export
export default IaCClient;
