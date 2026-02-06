/**
 * API Type Definitions
 * Common types for API requests, responses, and error handling
 * @module types/api
 */

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination parameters for list requests
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

/**
 * Pagination information in responses
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  nextCursor?: string;
  previousCursor?: string;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Standard API error response
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  field?: string;
  timestamp: string;
  requestId: string;
}

/**
 * HTTP error response from the API
 */
export interface HttpErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
}

/**
 * Common error codes matching backend
 */
export const ErrorCodes = {
  // Client errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Domain errors
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  REPOSITORY_NOT_ACCESSIBLE: 'REPOSITORY_NOT_ACCESSIBLE',
  INVALID_REF: 'INVALID_REF',
  PARSE_ERROR: 'PARSE_ERROR',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Response Wrappers
// ============================================================================

/**
 * Standard API success response
 */
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    requestId: string;
    timestamp: string;
    duration: number;
  };
}

/**
 * Standard API failure response
 */
export interface ApiFailureResponse {
  success: false;
  error: ApiError;
}

/**
 * Union type for API responses
 */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiFailureResponse;

// ============================================================================
// Request Types
// ============================================================================

/**
 * Sort order for list requests
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Base list query parameters
 */
export interface ListQueryParams extends PaginationParams {
  sortBy?: string;
  sortOrder?: SortOrder;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if response is an error
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard to check if response is a failure
 */
export function isApiFailure(response: ApiResponse<unknown>): response is ApiFailureResponse {
  return response.success === false;
}

/**
 * Type guard to check if response is successful
 */
export function isApiSuccess<T>(response: ApiResponse<T>): response is ApiSuccessResponse<T> {
  return response.success === true;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create pagination info from response data
 */
export function createPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Get default pagination params
 */
export function getDefaultPaginationParams(): Required<PaginationParams> {
  return {
    page: 1,
    pageSize: 20,
  };
}
