/**
 * E2E Test API Types
 * @module e2e/types/api-types
 *
 * API testing type definitions:
 * - ApiResponse<T> - Generic API response wrapper
 * - ApiError - Error response type
 * - RequestOptions - HTTP request configuration
 * - AuthenticatedRequest - Request with auth context
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #20 of 47 | Phase 4: Implementation
 */

import type { LightMyRequestResponse } from 'fastify';
import type { TenantId, RepositoryId, ScanId, UserId } from '../../api/src/types/entities.js';
import type { Brand } from '../../api/src/types/utility.js';

// ============================================================================
// Branded Types for API Testing
// ============================================================================

/**
 * Branded type for Request IDs
 */
export type RequestId = Brand<string, 'RequestId'>;

/**
 * Branded type for Correlation IDs
 */
export type CorrelationId = Brand<string, 'CorrelationId'>;

/**
 * Create a RequestId from a string
 */
export function createRequestId(id: string): RequestId {
  return id as RequestId;
}

/**
 * Create a CorrelationId from a string
 */
export function createCorrelationId(id: string): CorrelationId {
  return id as CorrelationId;
}

// ============================================================================
// HTTP Method Types
// ============================================================================

/**
 * HTTP method type
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * HTTP status code categories
 */
export type HttpStatusCategory = 'informational' | 'success' | 'redirection' | 'clientError' | 'serverError';

/**
 * Common HTTP status codes
 */
export const HttpStatus = {
  // Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,
  // Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,
  // Client Error
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  // Server Error
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

export type HttpStatusCode = typeof HttpStatus[keyof typeof HttpStatus];

// ============================================================================
// Generic API Response Types
// ============================================================================

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  /** Whether the request was successful */
  readonly success: boolean;
  /** Response data (present on success) */
  readonly data?: T;
  /** Error information (present on failure) */
  readonly error?: ApiError;
  /** Response metadata */
  readonly meta?: ResponseMeta;
}

/**
 * Success response type
 */
export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: ResponseMeta;
}

/**
 * Error response type
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiError;
  readonly meta?: ResponseMeta;
}

/**
 * API error structure
 */
export interface ApiError {
  /** Error code for programmatic handling */
  readonly code: string;
  /** Human-readable error message */
  readonly message: string;
  /** Additional error details */
  readonly details?: Readonly<Record<string, unknown>>;
  /** Field that caused the error (for validation errors) */
  readonly field?: string;
  /** HTTP status code */
  readonly statusCode?: number;
  /** Stack trace (only in development) */
  readonly stack?: string;
  /** Nested errors */
  readonly errors?: ReadonlyArray<ApiError>;
}

/**
 * Response metadata
 */
export interface ResponseMeta {
  /** Request ID for tracing */
  readonly requestId: RequestId;
  /** Response timestamp */
  readonly timestamp: string;
  /** Request duration in milliseconds */
  readonly duration: number;
  /** API version */
  readonly version: string;
  /** Deprecation warnings */
  readonly deprecationWarnings?: ReadonlyArray<DeprecationWarning>;
}

/**
 * Deprecation warning
 */
export interface DeprecationWarning {
  readonly message: string;
  readonly replacementEndpoint?: string;
  readonly sunsetDate?: string;
}

// ============================================================================
// Paginated Response Types
// ============================================================================

/**
 * Paginated API response
 */
export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
  readonly pagination: PaginationInfo;
}

/**
 * Pagination information
 */
export interface PaginationInfo {
  /** Current page number (1-indexed) */
  readonly page: number;
  /** Items per page */
  readonly pageSize: number;
  /** Total number of items */
  readonly total: number;
  /** Total number of pages */
  readonly totalPages: number;
  /** Whether there is a next page */
  readonly hasNext: boolean;
  /** Whether there is a previous page */
  readonly hasPrevious: boolean;
  /** Cursor for next page (cursor-based pagination) */
  readonly nextCursor?: string;
  /** Cursor for previous page (cursor-based pagination) */
  readonly previousCursor?: string;
}

/**
 * Pagination request parameters
 */
export interface PaginationParams {
  /** Page number (1-indexed) */
  readonly page?: number;
  /** Items per page */
  readonly pageSize?: number;
  /** Cursor for cursor-based pagination */
  readonly cursor?: string;
}

// ============================================================================
// Request Options Types
// ============================================================================

/**
 * HTTP request configuration options
 */
export interface RequestOptions {
  /** HTTP method */
  readonly method: HttpMethod;
  /** Request URL path */
  readonly url: string;
  /** Request body */
  readonly body?: unknown;
  /** Query parameters */
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  /** Request headers */
  readonly headers?: Readonly<Record<string, string>>;
  /** Request timeout in milliseconds */
  readonly timeout?: number;
  /** Whether to follow redirects */
  readonly followRedirects?: boolean;
  /** Maximum number of redirects to follow */
  readonly maxRedirects?: number;
}

/**
 * Authenticated request options
 */
export interface AuthenticatedRequest extends RequestOptions {
  /** Whether request requires authentication */
  readonly authenticated: boolean;
  /** Authentication context override */
  readonly authContext?: AuthContext;
  /** API key authentication */
  readonly apiKey?: string;
  /** Bearer token authentication */
  readonly bearerToken?: string;
}

/**
 * Authentication context
 */
export interface AuthContext {
  readonly userId: string;
  readonly email: string;
  readonly name: string;
  readonly githubId: number;
  readonly tenantId?: string;
  readonly permissions?: ReadonlyArray<string>;
  readonly roles?: ReadonlyArray<string>;
}

/**
 * Request with tenant context
 */
export interface TenantRequest extends AuthenticatedRequest {
  /** Tenant ID for the request */
  readonly tenantId: TenantId;
  /** Override tenant isolation */
  readonly bypassTenantIsolation?: boolean;
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Test response wrapper with assertion helpers
 */
export interface TestResponse<T = unknown> {
  /** HTTP status code */
  readonly statusCode: number;
  /** Response headers */
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /** Parsed response body */
  readonly body: T;
  /** Raw response body */
  readonly rawBody: string;
  /** Original Fastify response */
  readonly raw: LightMyRequestResponse;
  /** Request duration in milliseconds */
  readonly duration: number;
  /** Assert status code */
  expectStatus(expected: number): TestResponse<T>;
  /** Assert body matches partial */
  expectBody(expected: Partial<T>): TestResponse<T>;
  /** Assert body property exists and optionally matches value */
  expectBodyProperty<K extends keyof T>(key: K, value?: T[K]): TestResponse<T>;
  /** Assert header exists and optionally matches value */
  expectHeader(name: string, value?: string | RegExp): TestResponse<T>;
  /** Assert response is JSON */
  expectJson(): TestResponse<T>;
  /** Assert content type */
  expectContentType(type: string): TestResponse<T>;
}

/**
 * Streaming response
 */
export interface StreamResponse<T> {
  /** Event type */
  readonly type: 'data' | 'error' | 'complete' | 'heartbeat';
  /** Event data */
  readonly data?: T;
  /** Error information */
  readonly error?: ApiError;
  /** Sequence number */
  readonly sequence: number;
  /** Timestamp */
  readonly timestamp: string;
}

/**
 * Batch operation response
 */
export interface BatchResponse<T, E = unknown> {
  /** Successfully processed items */
  readonly succeeded: ReadonlyArray<T>;
  /** Failed items with errors */
  readonly failed: ReadonlyArray<BatchFailure<E>>;
  /** Operation summary */
  readonly summary: BatchSummary;
}

/**
 * Batch failure item
 */
export interface BatchFailure<T = unknown> {
  /** Original item that failed */
  readonly item: T;
  /** Error information */
  readonly error: ApiError;
  /** Index in original batch */
  readonly index: number;
}

/**
 * Batch operation summary
 */
export interface BatchSummary {
  readonly total: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly skipped: number;
}

// ============================================================================
// API Error Codes
// ============================================================================

/**
 * API error codes
 */
export const ApiErrorCode = {
  // Client Errors
  BAD_REQUEST: 'BAD_REQUEST',
  INVALID_INPUT: 'INVALID_INPUT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  NOT_FOUND: 'NOT_FOUND',
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  CONFLICT: 'CONFLICT',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMITED: 'RATE_LIMITED',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server Errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Domain Errors
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  REPOSITORY_NOT_ACCESSIBLE: 'REPOSITORY_NOT_ACCESSIBLE',
  INVALID_REF: 'INVALID_REF',
  PARSE_ERROR: 'PARSE_ERROR',
  GRAPH_ERROR: 'GRAPH_ERROR',
  ROLLUP_ERROR: 'ROLLUP_ERROR',
} as const;

export type ApiErrorCodeType = typeof ApiErrorCode[keyof typeof ApiErrorCode];

// ============================================================================
// Content Type Constants
// ============================================================================

/**
 * Common content types
 */
export const ContentType = {
  JSON: 'application/json',
  TEXT: 'text/plain',
  HTML: 'text/html',
  XML: 'application/xml',
  FORM_URLENCODED: 'application/x-www-form-urlencoded',
  MULTIPART: 'multipart/form-data',
  OCTET_STREAM: 'application/octet-stream',
  EVENT_STREAM: 'text/event-stream',
} as const;

export type ContentTypeValue = typeof ContentType[keyof typeof ContentType];

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  /** Maximum requests allowed */
  readonly limit: number;
  /** Remaining requests */
  readonly remaining: number;
  /** Reset time (Unix timestamp) */
  readonly reset: number;
  /** Retry after seconds (when rate limited) */
  readonly retryAfter?: number;
}

/**
 * Rate limit headers
 */
export const RateLimitHeaders = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  RETRY_AFTER: 'Retry-After',
} as const;

// ============================================================================
// Request/Response Interceptors
// ============================================================================

/**
 * Request interceptor function
 */
export type RequestInterceptor = (
  request: AuthenticatedRequest
) => AuthenticatedRequest | Promise<AuthenticatedRequest>;

/**
 * Response interceptor function
 */
export type ResponseInterceptor<T = unknown> = (
  response: TestResponse<T>
) => TestResponse<T> | Promise<TestResponse<T>>;

/**
 * Error interceptor function
 */
export type ErrorInterceptor = (
  error: ApiError
) => ApiError | Promise<ApiError>;

// ============================================================================
// API Client Configuration
// ============================================================================

/**
 * API client configuration
 */
export interface ApiClientConfig {
  /** Base URL for API requests */
  readonly baseUrl: string;
  /** Default timeout in milliseconds */
  readonly timeout: number;
  /** Default headers */
  readonly headers: Readonly<Record<string, string>>;
  /** Request interceptors */
  readonly requestInterceptors: ReadonlyArray<RequestInterceptor>;
  /** Response interceptors */
  readonly responseInterceptors: ReadonlyArray<ResponseInterceptor>;
  /** Error interceptors */
  readonly errorInterceptors: ReadonlyArray<ErrorInterceptor>;
  /** Retry configuration */
  readonly retry: RetryConfig;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Initial delay in milliseconds */
  readonly initialDelay: number;
  /** Maximum delay in milliseconds */
  readonly maxDelay: number;
  /** Backoff multiplier */
  readonly backoffMultiplier: number;
  /** Status codes to retry */
  readonly retryableStatusCodes: ReadonlyArray<number>;
  /** Whether to retry on network errors */
  readonly retryOnNetworkError: boolean;
}

/**
 * Default API client configuration
 */
export const DEFAULT_API_CLIENT_CONFIG: ApiClientConfig = {
  baseUrl: 'http://localhost:3000',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  requestInterceptors: [],
  responseInterceptors: [],
  errorInterceptors: [],
  retry: {
    maxRetries: 3,
    initialDelay: 100,
    maxDelay: 5000,
    backoffMultiplier: 2,
    retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    retryOnNetworkError: true,
  },
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ApiResponse
 */
export function isApiResponse<T>(value: unknown): value is ApiResponse<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as ApiResponse<T>).success === 'boolean'
  );
}

/**
 * Type guard for ApiSuccessResponse
 */
export function isApiSuccessResponse<T>(value: unknown): value is ApiSuccessResponse<T> {
  return isApiResponse<T>(value) && value.success === true && 'data' in value;
}

/**
 * Type guard for ApiErrorResponse
 */
export function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  return isApiResponse(value) && value.success === false && 'error' in value;
}

/**
 * Type guard for ApiError
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as ApiError).code === 'string' &&
    typeof (value as ApiError).message === 'string'
  );
}

/**
 * Type guard for PaginatedApiResponse
 */
export function isPaginatedResponse<T>(value: unknown): value is PaginatedApiResponse<T> {
  return isApiResponse<T[]>(value) && 'pagination' in value;
}

/**
 * Type guard for AuthContext
 */
export function isAuthContext(value: unknown): value is AuthContext {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    'email' in value &&
    typeof (value as AuthContext).userId === 'string' &&
    typeof (value as AuthContext).email === 'string'
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Extract data type from ApiResponse
 */
export type ResponseData<T> = T extends ApiResponse<infer D> ? D : never;

/**
 * Make ApiResponse type from data type
 */
export type AsApiResponse<T> = ApiResponse<T>;

/**
 * Make paginated response type from item type
 */
export type AsPaginatedResponse<T> = PaginatedApiResponse<T>;

/**
 * Request without authentication
 */
export type UnauthenticatedRequest = Omit<AuthenticatedRequest, 'authenticated' | 'authContext'>;
