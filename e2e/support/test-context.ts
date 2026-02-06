/**
 * E2E Test Context
 * @module e2e/support/test-context
 *
 * Provides the E2ETestContext factory for integration testing with:
 * - TestAppBuilder for Fastify inject-based testing
 * - Database setup/teardown with Testcontainers
 * - MSW mock handlers for external APIs
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 */

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';
import { buildTestApp, type AppOptions } from '../../api/src/app.js';
import type { AuthContext } from '../../api/src/types/auth.js';
import type { TenantId, RepositoryId, ScanId } from '../../api/src/types/entities.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Test database configuration
 */
export interface TestDatabaseConfig {
  /** PostgreSQL connection string */
  readonly connectionString: string;
  /** Database name */
  readonly database: string;
  /** Run migrations on setup */
  readonly runMigrations: boolean;
  /** Clean database before each test */
  readonly cleanBeforeTest: boolean;
}

/**
 * Test context configuration
 */
export interface TestContextConfig {
  /** App configuration overrides */
  readonly appOptions?: Partial<AppOptions>;
  /** Database configuration */
  readonly database?: Partial<TestDatabaseConfig>;
  /** Enable MSW mocking */
  readonly enableMocking?: boolean;
  /** Default tenant for tests */
  readonly defaultTenantId?: TenantId;
  /** Default user for tests */
  readonly defaultUserId?: string;
  /** Test timeout in milliseconds */
  readonly timeout?: number;
}

/**
 * Authentication helper interface
 */
export interface TestAuthHelper {
  /** Create a test user and return auth context */
  createTestUser(userData?: Partial<TestUserData>): Promise<AuthContext>;
  /** Generate a valid JWT token for a user */
  generateToken(auth: AuthContext): Promise<string>;
  /** Get authorization header for requests */
  getAuthHeader(auth: AuthContext): Promise<Record<string, string>>;
  /** Clear all test users */
  clearTestUsers(): Promise<void>;
}

/**
 * Test user data
 */
export interface TestUserData {
  userId: string;
  email: string;
  name: string;
  githubId: number;
  tenantId?: TenantId;
}

/**
 * HTTP request options for test client
 */
export interface TestRequestOptions {
  /** HTTP method */
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** URL path */
  url: string;
  /** Request body (will be JSON stringified) */
  body?: unknown;
  /** Query parameters */
  query?: Record<string, string | number | boolean>;
  /** Custom headers */
  headers?: Record<string, string>;
  /** Use authenticated request */
  authenticated?: boolean;
  /** Custom auth context (overrides default) */
  authContext?: AuthContext;
}

/**
 * HTTP response wrapper for test assertions
 */
export interface TestResponse<T = unknown> {
  /** HTTP status code */
  readonly statusCode: number;
  /** Response headers */
  readonly headers: Record<string, string | string[] | undefined>;
  /** Parsed response body */
  readonly body: T;
  /** Raw response body */
  readonly rawBody: string;
  /** Original Fastify response */
  readonly raw: LightMyRequestResponse;
  /** Assert status code */
  expectStatus(expected: number): TestResponse<T>;
  /** Assert body matches */
  expectBody(expected: Partial<T>): TestResponse<T>;
  /** Assert body contains property */
  expectBodyProperty<K extends keyof T>(key: K, value?: T[K]): TestResponse<T>;
  /** Assert header value */
  expectHeader(name: string, value?: string): TestResponse<T>;
}

/**
 * Database helper interface
 */
export interface TestDatabaseHelper {
  /** Execute raw SQL query */
  query<R>(sql: string, params?: unknown[]): Promise<R[]>;
  /** Insert a record and return ID */
  insert<T extends Record<string, unknown>>(
    table: string,
    data: T
  ): Promise<string>;
  /** Delete records by condition */
  delete(table: string, conditions: Record<string, unknown>): Promise<number>;
  /** Clean all test data from database */
  clean(): Promise<void>;
  /** Run pending migrations */
  migrate(): Promise<void>;
  /** Create test tenant */
  createTenant(name?: string): Promise<TenantId>;
  /** Create test repository */
  createRepository(
    tenantId: TenantId,
    repoData?: Partial<TestRepositoryData>
  ): Promise<RepositoryId>;
  /** Create test scan */
  createScan(
    repositoryId: RepositoryId,
    scanData?: Partial<TestScanData>
  ): Promise<ScanId>;
}

/**
 * Test repository data
 */
export interface TestRepositoryData {
  provider: 'github' | 'gitlab' | 'bitbucket';
  owner: string;
  name: string;
  cloneUrl: string;
  defaultBranch: string;
}

/**
 * Test scan data
 */
export interface TestScanData {
  commitSha: string;
  branch: string;
  status: 'pending' | 'completed' | 'failed';
  nodeCount: number;
  edgeCount: number;
}

/**
 * MSW mock handler interface
 */
export interface MockHandlerHelper {
  /** Add a mock handler for GitHub API */
  mockGitHubApi(handlers: GitHubMockConfig): void;
  /** Add a mock handler for external services */
  mockExternalService(url: string, response: MockResponse): void;
  /** Clear all mock handlers */
  clearMocks(): void;
  /** Get recorded requests */
  getRecordedRequests(): RecordedRequest[];
}

/**
 * GitHub mock configuration
 */
export interface GitHubMockConfig {
  /** Mock /user endpoint */
  user?: { id: number; login: string; email: string; name: string };
  /** Mock /user/repos endpoint */
  repos?: Array<{ id: number; name: string; full_name: string }>;
  /** Mock repository content */
  repoContent?: Record<string, string>;
}

/**
 * Mock response configuration
 */
export interface MockResponse {
  status: number;
  body?: unknown;
  headers?: Record<string, string>;
  delay?: number;
}

/**
 * Recorded HTTP request
 */
export interface RecordedRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  timestamp: Date;
}

// ============================================================================
// E2E Test Context Implementation
// ============================================================================

/**
 * Main E2E test context class
 * Provides a unified interface for integration testing
 */
export class E2ETestContext {
  private app: FastifyInstance | null = null;
  private defaultAuth: AuthContext | null = null;
  private readonly config: Required<TestContextConfig>;
  private isSetup = false;

  constructor(config: TestContextConfig = {}) {
    this.config = {
      appOptions: config.appOptions ?? {},
      database: {
        connectionString:
          config.database?.connectionString ??
          process.env.TEST_DATABASE_URL ??
          'postgresql://test:test@localhost:5433/test_db',
        database: config.database?.database ?? 'test_db',
        runMigrations: config.database?.runMigrations ?? true,
        cleanBeforeTest: config.database?.cleanBeforeTest ?? true,
      },
      enableMocking: config.enableMocking ?? true,
      defaultTenantId: (config.defaultTenantId ??
        '00000000-0000-0000-0000-000000000001') as TenantId,
      defaultUserId: config.defaultUserId ?? 'test-user-001',
      timeout: config.timeout ?? 30000,
    };
  }

  /**
   * Set up the test context
   * Call this in beforeAll or beforeEach
   */
  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    // Build the test app
    this.app = await buildTestApp({
      ...this.config.appOptions,
      logger: false,
      tenantContext: false,
    });

    // Set up default auth context
    this.defaultAuth = {
      userId: this.config.defaultUserId,
      email: 'test@example.com',
      name: 'Test User',
      githubId: 12345,
      tenantId: this.config.defaultTenantId,
    };

    this.isSetup = true;
  }

  /**
   * Tear down the test context
   * Call this in afterAll or afterEach
   */
  async teardown(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
    }
    this.defaultAuth = null;
    this.isSetup = false;
  }

  /**
   * Get the Fastify app instance
   */
  getApp(): FastifyInstance {
    if (!this.app) {
      throw new Error('Test context not set up. Call setup() first.');
    }
    return this.app;
  }

  /**
   * Get the default auth context
   */
  getDefaultAuth(): AuthContext {
    if (!this.defaultAuth) {
      throw new Error('Test context not set up. Call setup() first.');
    }
    return this.defaultAuth;
  }

  /**
   * Make an HTTP request to the test app
   */
  async request<T = unknown>(
    options: TestRequestOptions
  ): Promise<TestResponse<T>> {
    const app = this.getApp();

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...options.headers,
    };

    // Add auth header if authenticated
    if (options.authenticated !== false) {
      const auth = options.authContext ?? this.defaultAuth;
      if (auth) {
        headers['x-user-id'] = auth.userId;
        headers['x-tenant-id'] = auth.tenantId ?? this.config.defaultTenantId;
      }
    }

    // Build query string
    let url = options.url;
    if (options.query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(options.query)) {
        params.append(key, String(value));
      }
      url = `${url}?${params.toString()}`;
    }

    const response = await app.inject({
      method: options.method,
      url,
      headers,
      payload: options.body ? JSON.stringify(options.body) : undefined,
    });

    return this.wrapResponse<T>(response);
  }

  /**
   * Make a GET request
   */
  async get<T = unknown>(
    url: string,
    options?: Omit<TestRequestOptions, 'method' | 'url'>
  ): Promise<TestResponse<T>> {
    return this.request<T>({ ...options, method: 'GET', url });
  }

  /**
   * Make a POST request
   */
  async post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<TestRequestOptions, 'method' | 'url' | 'body'>
  ): Promise<TestResponse<T>> {
    return this.request<T>({ ...options, method: 'POST', url, body });
  }

  /**
   * Make a PUT request
   */
  async put<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<TestRequestOptions, 'method' | 'url' | 'body'>
  ): Promise<TestResponse<T>> {
    return this.request<T>({ ...options, method: 'PUT', url, body });
  }

  /**
   * Make a PATCH request
   */
  async patch<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<TestRequestOptions, 'method' | 'url' | 'body'>
  ): Promise<TestResponse<T>> {
    return this.request<T>({ ...options, method: 'PATCH', url, body });
  }

  /**
   * Make a DELETE request
   */
  async delete<T = unknown>(
    url: string,
    options?: Omit<TestRequestOptions, 'method' | 'url'>
  ): Promise<TestResponse<T>> {
    return this.request<T>({ ...options, method: 'DELETE', url });
  }

  /**
   * Wrap Fastify response with test assertions
   */
  private wrapResponse<T>(response: LightMyRequestResponse): TestResponse<T> {
    let body: T;
    try {
      body = response.json();
    } catch {
      body = response.payload as unknown as T;
    }

    const result: TestResponse<T> = {
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
        return result;
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
        return result;
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
        return result;
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
        return result;
      },
    };

    return result;
  }

  /**
   * Create auth context for tests
   */
  createAuthContext(overrides?: Partial<AuthContext>): AuthContext {
    return {
      ...this.getDefaultAuth(),
      ...overrides,
    };
  }
}

// ============================================================================
// Test App Builder
// ============================================================================

/**
 * Builder pattern for test app configuration
 */
export class TestAppBuilder {
  private config: TestContextConfig = {};

  /**
   * Set app options
   */
  withAppOptions(options: Partial<AppOptions>): TestAppBuilder {
    this.config.appOptions = { ...this.config.appOptions, ...options };
    return this;
  }

  /**
   * Set database configuration
   */
  withDatabase(config: Partial<TestDatabaseConfig>): TestAppBuilder {
    this.config.database = { ...this.config.database, ...config };
    return this;
  }

  /**
   * Enable/disable MSW mocking
   */
  withMocking(enabled: boolean): TestAppBuilder {
    this.config.enableMocking = enabled;
    return this;
  }

  /**
   * Set default tenant
   */
  withDefaultTenant(tenantId: TenantId): TestAppBuilder {
    this.config.defaultTenantId = tenantId;
    return this;
  }

  /**
   * Set default user
   */
  withDefaultUser(userId: string): TestAppBuilder {
    this.config.defaultUserId = userId;
    return this;
  }

  /**
   * Set timeout
   */
  withTimeout(timeoutMs: number): TestAppBuilder {
    this.config.timeout = timeoutMs;
    return this;
  }

  /**
   * Build the test context
   */
  build(): E2ETestContext {
    return new E2ETestContext(this.config);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new E2E test context with default configuration
 */
export function createTestContext(
  config?: TestContextConfig
): E2ETestContext {
  return new E2ETestContext(config);
}

/**
 * Create a test app builder
 */
export function createTestAppBuilder(): TestAppBuilder {
  return new TestAppBuilder();
}

// ============================================================================
// Exports
// ============================================================================

export type {
  TestDatabaseConfig,
  TestContextConfig,
  TestAuthHelper,
  TestUserData,
  TestRequestOptions,
  TestResponse,
  TestDatabaseHelper,
  TestRepositoryData,
  TestScanData,
  MockHandlerHelper,
  GitHubMockConfig,
  MockResponse,
  RecordedRequest,
};
