/**
 * Mock Provider Domain Entity
 * @module e2e/domain/mock-provider
 *
 * Provides external API mocking capabilities using MSW (Mock Service Worker).
 * Supports handler registration, response stubbing, and request recording.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #21 of 47 | Phase 4: Implementation
 */

import type { Brand, Result } from '../../api/src/types/utility.js';
import { success, failure } from '../../api/src/types/utility.js';

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Branded type for Mock Handler IDs
 */
export type MockHandlerId = Brand<string, 'MockHandlerId'>;

/**
 * Create a MockHandlerId from a string
 */
export function createMockHandlerId(id: string): MockHandlerId {
  return id as MockHandlerId;
}

// ============================================================================
// Types
// ============================================================================

/**
 * HTTP method type
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Mock request matcher
 */
export interface RequestMatcher {
  /** URL pattern (string or RegExp) */
  readonly url: string | RegExp;
  /** HTTP method (optional, matches all if not specified) */
  readonly method?: HttpMethod | ReadonlyArray<HttpMethod>;
  /** Headers to match (all must match) */
  readonly headers?: Readonly<Record<string, string | RegExp>>;
  /** Query parameters to match */
  readonly query?: Readonly<Record<string, string | RegExp>>;
  /** Body matcher (JSON path or function) */
  readonly body?: BodyMatcher;
}

/**
 * Body matcher type
 */
export type BodyMatcher =
  | Readonly<Record<string, unknown>>
  | ((body: unknown) => boolean);

/**
 * Mock response configuration
 */
export interface MockResponse {
  /** HTTP status code */
  readonly status: number;
  /** Response headers */
  readonly headers?: Readonly<Record<string, string>>;
  /** Response body */
  readonly body?: unknown;
  /** Response delay in milliseconds */
  readonly delay?: number;
  /** Network error to simulate */
  readonly networkError?: string;
}

/**
 * Mock handler definition
 */
export interface MockHandler {
  /** Unique handler ID */
  readonly id: MockHandlerId;
  /** Handler name for debugging */
  readonly name: string;
  /** Request matcher */
  readonly matcher: RequestMatcher;
  /** Response or response generator */
  readonly response: MockResponse | MockResponseGenerator;
  /** Priority (higher runs first) */
  readonly priority: number;
  /** Whether handler is active */
  readonly active: boolean;
  /** Number of times to match (undefined = unlimited) */
  readonly times?: number;
  /** Current match count */
  matchCount: number;
}

/**
 * Response generator function
 */
export type MockResponseGenerator = (
  request: RecordedRequest
) => MockResponse | Promise<MockResponse>;

/**
 * Recorded HTTP request
 */
export interface RecordedRequest {
  /** Request ID */
  readonly id: string;
  /** Request timestamp */
  readonly timestamp: Date;
  /** HTTP method */
  readonly method: HttpMethod;
  /** Full URL */
  readonly url: string;
  /** URL path */
  readonly path: string;
  /** Query parameters */
  readonly query: Readonly<Record<string, string>>;
  /** Request headers */
  readonly headers: Readonly<Record<string, string>>;
  /** Request body */
  readonly body?: unknown;
  /** Matched handler ID */
  readonly matchedHandler?: MockHandlerId;
  /** Response sent */
  readonly response?: RecordedResponse;
}

/**
 * Recorded HTTP response
 */
export interface RecordedResponse {
  /** Response timestamp */
  readonly timestamp: Date;
  /** HTTP status code */
  readonly status: number;
  /** Response headers */
  readonly headers: Readonly<Record<string, string>>;
  /** Response body */
  readonly body?: unknown;
  /** Response delay applied */
  readonly delay?: number;
}

/**
 * Mock provider configuration
 */
export interface MockProviderConfig {
  /** Enable request recording */
  readonly recordRequests: boolean;
  /** Maximum recorded requests to keep */
  readonly maxRecordedRequests: number;
  /** Default response delay */
  readonly defaultDelay: number;
  /** Enable passthrough for unmatched requests */
  readonly passthrough: boolean;
  /** Base URL for relative paths */
  readonly baseUrl?: string;
}

/**
 * Default provider configuration
 */
export const DEFAULT_MOCK_PROVIDER_CONFIG: MockProviderConfig = {
  recordRequests: true,
  maxRecordedRequests: 1000,
  defaultDelay: 0,
  passthrough: false,
};

/**
 * Provider error
 */
export interface MockProviderError {
  /** Error code */
  readonly code: string;
  /** Error message */
  readonly message: string;
  /** Handler ID if applicable */
  readonly handlerId?: MockHandlerId;
  /** Additional context */
  readonly context?: Readonly<Record<string, unknown>>;
}

// ============================================================================
// Mock Provider Class
// ============================================================================

/**
 * MockProvider manages MSW handlers for external API mocking.
 * Provides handler registration, response stubbing, and request recording.
 */
export class MockProvider {
  private readonly _config: MockProviderConfig;
  private readonly _handlers: Map<MockHandlerId, MockHandler>;
  private readonly _recordedRequests: RecordedRequest[];
  private _requestIdCounter: number;
  private _isStarted: boolean;

  constructor(config?: Partial<MockProviderConfig>) {
    this._config = { ...DEFAULT_MOCK_PROVIDER_CONFIG, ...config };
    this._handlers = new Map();
    this._recordedRequests = [];
    this._requestIdCounter = 0;
    this._isStarted = false;
  }

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Start the mock provider
   */
  async start(): Promise<Result<void, MockProviderError>> {
    if (this._isStarted) {
      return success(undefined);
    }

    try {
      // In a real implementation, this would initialize MSW
      // For now, we just mark as started
      this._isStarted = true;
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'START_FAILED',
        message: `Failed to start mock provider: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Stop the mock provider
   */
  async stop(): Promise<Result<void, MockProviderError>> {
    if (!this._isStarted) {
      return success(undefined);
    }

    try {
      // In a real implementation, this would stop MSW
      this._isStarted = false;
      return success(undefined);
    } catch (error) {
      return failure({
        code: 'STOP_FAILED',
        message: `Failed to stop mock provider: ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }

  /**
   * Check if provider is started
   */
  get isStarted(): boolean {
    return this._isStarted;
  }

  // ============================================================================
  // Handler Registration
  // ============================================================================

  /**
   * Register a mock handler
   */
  registerHandler(
    name: string,
    matcher: RequestMatcher,
    response: MockResponse | MockResponseGenerator,
    options?: {
      priority?: number;
      times?: number;
    }
  ): Result<MockHandlerId, MockProviderError> {
    const id = createMockHandlerId(`handler_${Date.now()}_${this._handlers.size}`);

    const handler: MockHandler = {
      id,
      name,
      matcher,
      response,
      priority: options?.priority ?? 0,
      active: true,
      times: options?.times,
      matchCount: 0,
    };

    this._handlers.set(id, handler);
    return success(id);
  }

  /**
   * Register a GET handler
   */
  get(
    url: string | RegExp,
    response: MockResponse | MockResponseGenerator,
    options?: { name?: string; priority?: number; times?: number }
  ): Result<MockHandlerId, MockProviderError> {
    return this.registerHandler(
      options?.name ?? `GET ${String(url)}`,
      { url, method: 'GET' },
      response,
      options
    );
  }

  /**
   * Register a POST handler
   */
  post(
    url: string | RegExp,
    response: MockResponse | MockResponseGenerator,
    options?: { name?: string; priority?: number; times?: number }
  ): Result<MockHandlerId, MockProviderError> {
    return this.registerHandler(
      options?.name ?? `POST ${String(url)}`,
      { url, method: 'POST' },
      response,
      options
    );
  }

  /**
   * Register a PUT handler
   */
  put(
    url: string | RegExp,
    response: MockResponse | MockResponseGenerator,
    options?: { name?: string; priority?: number; times?: number }
  ): Result<MockHandlerId, MockProviderError> {
    return this.registerHandler(
      options?.name ?? `PUT ${String(url)}`,
      { url, method: 'PUT' },
      response,
      options
    );
  }

  /**
   * Register a DELETE handler
   */
  delete(
    url: string | RegExp,
    response: MockResponse | MockResponseGenerator,
    options?: { name?: string; priority?: number; times?: number }
  ): Result<MockHandlerId, MockProviderError> {
    return this.registerHandler(
      options?.name ?? `DELETE ${String(url)}`,
      { url, method: 'DELETE' },
      response,
      options
    );
  }

  /**
   * Unregister a handler
   */
  unregisterHandler(id: MockHandlerId): boolean {
    return this._handlers.delete(id);
  }

  /**
   * Enable/disable a handler
   */
  setHandlerActive(id: MockHandlerId, active: boolean): Result<void, MockProviderError> {
    const handler = this._handlers.get(id);
    if (!handler) {
      return failure({
        code: 'HANDLER_NOT_FOUND',
        message: `Handler "${id}" not found`,
        handlerId: id,
      });
    }

    // Create new handler with updated active state
    const updated: MockHandler = { ...handler, active };
    this._handlers.set(id, updated);
    return success(undefined);
  }

  /**
   * Get a handler by ID
   */
  getHandler(id: MockHandlerId): MockHandler | undefined {
    return this._handlers.get(id);
  }

  /**
   * Get all handlers
   */
  getAllHandlers(): ReadonlyArray<MockHandler> {
    return Array.from(this._handlers.values());
  }

  /**
   * Get active handlers sorted by priority
   */
  getActiveHandlers(): ReadonlyArray<MockHandler> {
    return Array.from(this._handlers.values())
      .filter((h) => h.active && (h.times === undefined || h.matchCount < h.times))
      .sort((a, b) => b.priority - a.priority);
  }

  /**
   * Clear all handlers
   */
  clearHandlers(): void {
    this._handlers.clear();
  }

  // ============================================================================
  // Request Matching
  // ============================================================================

  /**
   * Find matching handler for a request
   */
  findMatchingHandler(request: RecordedRequest): MockHandler | undefined {
    const activeHandlers = this.getActiveHandlers();

    for (const handler of activeHandlers) {
      if (this.matchesRequest(handler.matcher, request)) {
        return handler;
      }
    }

    return undefined;
  }

  /**
   * Check if a request matches a matcher
   */
  private matchesRequest(matcher: RequestMatcher, request: RecordedRequest): boolean {
    // Match URL
    if (!this.matchesUrl(matcher.url, request.url, request.path)) {
      return false;
    }

    // Match method
    if (matcher.method) {
      const methods = Array.isArray(matcher.method) ? matcher.method : [matcher.method];
      if (!methods.includes(request.method)) {
        return false;
      }
    }

    // Match headers
    if (matcher.headers) {
      for (const [key, pattern] of Object.entries(matcher.headers)) {
        const value = request.headers[key.toLowerCase()];
        if (!value || !this.matchesPattern(pattern, value)) {
          return false;
        }
      }
    }

    // Match query
    if (matcher.query) {
      for (const [key, pattern] of Object.entries(matcher.query)) {
        const value = request.query[key];
        if (!value || !this.matchesPattern(pattern, value)) {
          return false;
        }
      }
    }

    // Match body
    if (matcher.body) {
      if (typeof matcher.body === 'function') {
        if (!matcher.body(request.body)) {
          return false;
        }
      } else {
        if (!this.matchesBodyObject(matcher.body, request.body)) {
          return false;
        }
      }
    }

    return true;
  }

  private matchesUrl(
    pattern: string | RegExp,
    fullUrl: string,
    path: string
  ): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(fullUrl) || pattern.test(path);
    }

    // Add base URL if configured
    const normalizedPattern = this._config.baseUrl
      ? new URL(pattern, this._config.baseUrl).toString()
      : pattern;

    return fullUrl === normalizedPattern || path === pattern;
  }

  private matchesPattern(pattern: string | RegExp, value: string): boolean {
    if (pattern instanceof RegExp) {
      return pattern.test(value);
    }
    return pattern === value;
  }

  private matchesBodyObject(pattern: Record<string, unknown>, body: unknown): boolean {
    if (typeof body !== 'object' || body === null) {
      return false;
    }

    for (const [key, expected] of Object.entries(pattern)) {
      const actual = (body as Record<string, unknown>)[key];
      if (expected !== actual) {
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Request Processing
  // ============================================================================

  /**
   * Process an incoming request
   */
  async processRequest(
    method: HttpMethod,
    url: string,
    options?: {
      headers?: Record<string, string>;
      body?: unknown;
    }
  ): Promise<Result<RecordedResponse, MockProviderError>> {
    const parsedUrl = new URL(url, this._config.baseUrl ?? 'http://localhost');

    const request: RecordedRequest = {
      id: `req_${++this._requestIdCounter}`,
      timestamp: new Date(),
      method,
      url,
      path: parsedUrl.pathname,
      query: Object.fromEntries(parsedUrl.searchParams),
      headers: options?.headers ?? {},
      body: options?.body,
    };

    // Find matching handler
    const handler = this.findMatchingHandler(request);

    if (!handler) {
      if (this._config.passthrough) {
        return failure({
          code: 'PASSTHROUGH',
          message: 'No matching handler, passthrough enabled',
        });
      }
      return failure({
        code: 'NO_MATCHING_HANDLER',
        message: `No handler matches ${method} ${url}`,
      });
    }

    // Generate response
    let mockResponse: MockResponse;
    if (typeof handler.response === 'function') {
      mockResponse = await handler.response(request);
    } else {
      mockResponse = handler.response;
    }

    // Check for network error
    if (mockResponse.networkError) {
      return failure({
        code: 'NETWORK_ERROR',
        message: mockResponse.networkError,
        handlerId: handler.id,
      });
    }

    // Apply delay
    const delay = mockResponse.delay ?? this._config.defaultDelay;
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    // Update handler match count
    const updatedHandler = { ...handler, matchCount: handler.matchCount + 1 };
    this._handlers.set(handler.id, updatedHandler);

    const response: RecordedResponse = {
      timestamp: new Date(),
      status: mockResponse.status,
      headers: mockResponse.headers ?? {},
      body: mockResponse.body,
      delay,
    };

    // Record request
    if (this._config.recordRequests) {
      const recordedWithResponse: RecordedRequest = {
        ...request,
        matchedHandler: handler.id,
        response,
      };
      this.recordRequest(recordedWithResponse);
    }

    return success(response);
  }

  // ============================================================================
  // Request Recording
  // ============================================================================

  /**
   * Record a request
   */
  private recordRequest(request: RecordedRequest): void {
    this._recordedRequests.push(request);

    // Trim if over limit
    while (this._recordedRequests.length > this._config.maxRecordedRequests) {
      this._recordedRequests.shift();
    }
  }

  /**
   * Get all recorded requests
   */
  getRecordedRequests(): ReadonlyArray<RecordedRequest> {
    return [...this._recordedRequests];
  }

  /**
   * Get recorded requests matching a filter
   */
  getRecordedRequestsMatching(filter: {
    method?: HttpMethod;
    urlPattern?: string | RegExp;
    handlerId?: MockHandlerId;
  }): ReadonlyArray<RecordedRequest> {
    return this._recordedRequests.filter((req) => {
      if (filter.method && req.method !== filter.method) {
        return false;
      }
      if (filter.urlPattern) {
        const pattern = filter.urlPattern;
        const matches =
          pattern instanceof RegExp
            ? pattern.test(req.url) || pattern.test(req.path)
            : req.url.includes(pattern) || req.path.includes(pattern);
        if (!matches) {
          return false;
        }
      }
      if (filter.handlerId && req.matchedHandler !== filter.handlerId) {
        return false;
      }
      return true;
    });
  }

  /**
   * Get request count for a handler
   */
  getRequestCount(handlerId: MockHandlerId): number {
    return this._recordedRequests.filter((r) => r.matchedHandler === handlerId).length;
  }

  /**
   * Get last request for a handler
   */
  getLastRequest(handlerId: MockHandlerId): RecordedRequest | undefined {
    for (let i = this._recordedRequests.length - 1; i >= 0; i--) {
      if (this._recordedRequests[i].matchedHandler === handlerId) {
        return this._recordedRequests[i];
      }
    }
    return undefined;
  }

  /**
   * Clear recorded requests
   */
  clearRecordedRequests(): void {
    this._recordedRequests.length = 0;
  }

  // ============================================================================
  // GitHub API Mocking Helpers
  // ============================================================================

  /**
   * Mock GitHub user endpoint
   */
  mockGitHubUser(user: {
    id: number;
    login: string;
    email?: string;
    name?: string;
    avatar_url?: string;
  }): Result<MockHandlerId, MockProviderError> {
    return this.get(
      /\/user$/,
      {
        status: 200,
        body: {
          id: user.id,
          login: user.login,
          email: user.email ?? `${user.login}@github.local`,
          name: user.name ?? user.login,
          avatar_url: user.avatar_url ?? `https://avatars.githubusercontent.com/u/${user.id}`,
        },
      },
      { name: 'GitHub User' }
    );
  }

  /**
   * Mock GitHub repos endpoint
   */
  mockGitHubRepos(
    repos: ReadonlyArray<{
      id: number;
      name: string;
      full_name: string;
      private?: boolean;
      default_branch?: string;
    }>
  ): Result<MockHandlerId, MockProviderError> {
    return this.get(
      /\/user\/repos/,
      {
        status: 200,
        body: repos.map((repo) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
          private: repo.private ?? false,
          default_branch: repo.default_branch ?? 'main',
          clone_url: `https://github.com/${repo.full_name}.git`,
          html_url: `https://github.com/${repo.full_name}`,
        })),
      },
      { name: 'GitHub Repos' }
    );
  }

  /**
   * Mock GitHub repository contents
   */
  mockGitHubContent(
    repo: string,
    path: string,
    content: string
  ): Result<MockHandlerId, MockProviderError> {
    const encodedContent = Buffer.from(content).toString('base64');
    const urlPattern = new RegExp(`/repos/${repo}/contents/${path}`);

    return this.get(
      urlPattern,
      {
        status: 200,
        body: {
          type: 'file',
          encoding: 'base64',
          size: content.length,
          name: path.split('/').pop(),
          path,
          content: encodedContent,
        },
      },
      { name: `GitHub Content: ${repo}/${path}` }
    );
  }

  // ============================================================================
  // Reset
  // ============================================================================

  /**
   * Reset all handlers and recordings
   */
  reset(): void {
    this._handlers.clear();
    this._recordedRequests.length = 0;
    this._requestIdCounter = 0;
  }

  // ============================================================================
  // Serialization
  // ============================================================================

  /**
   * Get provider state for debugging
   */
  toJSON(): Record<string, unknown> {
    return {
      config: this._config,
      isStarted: this._isStarted,
      handlers: Array.from(this._handlers.values()).map((h) => ({
        id: h.id,
        name: h.name,
        active: h.active,
        matchCount: h.matchCount,
        times: h.times,
      })),
      recordedRequests: this._recordedRequests.length,
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new mock provider
 */
export function createMockProvider(config?: Partial<MockProviderConfig>): MockProvider {
  return new MockProvider(config);
}

/**
 * Type guard for MockProviderError
 */
export function isMockProviderError(value: unknown): value is MockProviderError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}

/**
 * Type guard for RecordedRequest
 */
export function isRecordedRequest(value: unknown): value is RecordedRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'method' in value &&
    'url' in value &&
    'timestamp' in value
  );
}
