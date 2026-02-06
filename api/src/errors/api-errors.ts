/**
 * API Error Standardization
 * @module errors/api-errors
 *
 * Provides consistent error types and responses across all API endpoints.
 * Integrates with Fastify for standardized HTTP error handling.
 *
 * TASK-DETECT: Final refactoring - API error standardization
 */

import type { FastifyReply } from 'fastify';
import { ErrorCodes, getHttpStatusForCode } from './codes.js';

// ============================================================================
// API Error Response Type
// ============================================================================

/**
 * Standardized API error response format
 */
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId?: string;
    timestamp: string;
  };
}

/**
 * Extended API error response with debug info (non-production)
 */
export interface ApiErrorResponseDebug extends ApiErrorResponse {
  error: ApiErrorResponse['error'] & {
    stack?: string;
    cause?: string;
  };
}

// ============================================================================
// API Error Codes (subset for API layer)
// ============================================================================

export const ApiErrorCodes = {
  // Client Errors (4xx)
  BAD_REQUEST: ErrorCodes.BAD_REQUEST,
  UNAUTHORIZED: ErrorCodes.UNAUTHORIZED,
  FORBIDDEN: ErrorCodes.FORBIDDEN,
  NOT_FOUND: ErrorCodes.NOT_FOUND,
  CONFLICT: ErrorCodes.CONFLICT,
  VALIDATION_ERROR: ErrorCodes.VALIDATION_ERROR,
  RATE_LIMITED: ErrorCodes.RATE_LIMITED,
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // Server Errors (5xx)
  INTERNAL_ERROR: ErrorCodes.INTERNAL_ERROR,
  SERVICE_UNAVAILABLE: ErrorCodes.SERVICE_UNAVAILABLE,
  DATABASE_ERROR: ErrorCodes.DATABASE_ERROR,
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',

  // Domain Errors
  SCAN_NOT_FOUND: ErrorCodes.SCAN_NOT_FOUND,
  SCAN_FAILED: ErrorCodes.SCAN_FAILED,
  PARSER_ERROR: ErrorCodes.PARSE_ERROR,
  GRAPH_BUILD_ERROR: ErrorCodes.GRAPH_BUILD_ERROR,
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
} as const;

export type ApiErrorCode = (typeof ApiErrorCodes)[keyof typeof ApiErrorCodes];

// ============================================================================
// Base API Error
// ============================================================================

/**
 * Base class for all API-level errors.
 * Provides consistent serialization for HTTP responses.
 */
export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly isOperational: boolean;

  constructor(
    code: ApiErrorCode,
    message: string,
    statusCode?: number,
    details?: unknown,
    isOperational = true
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = statusCode ?? getHttpStatusForCode(code);
    this.details = details;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, ApiError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert to API response format
   */
  toResponse(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Convert to debug response format (includes stack)
   */
  toDebugResponse(requestId?: string): ApiErrorResponseDebug {
    const errorCause = (this as { cause?: unknown }).cause;
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        requestId,
        timestamp: new Date().toISOString(),
        stack: this.stack,
        cause: errorCause instanceof Error ? errorCause.message : undefined,
      },
    };
  }
}

// ============================================================================
// Specific API Error Classes
// ============================================================================

/**
 * 400 Bad Request
 */
export class BadRequestError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ApiErrorCodes.BAD_REQUEST, message, 400, details);
    this.name = 'BadRequestError';
  }
}

/**
 * 401 Unauthorized
 */
export class ApiUnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(ApiErrorCodes.UNAUTHORIZED, message, 401);
    this.name = 'ApiUnauthorizedError';
  }
}

/**
 * 403 Forbidden
 */
export class ApiForbiddenError extends ApiError {
  constructor(message = 'Access denied') {
    super(ApiErrorCodes.FORBIDDEN, message, 403);
    this.name = 'ApiForbiddenError';
  }
}

/**
 * 404 Not Found
 */
export class ApiNotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with ID '${id}' not found`
      : `${resource} not found`;
    super(ApiErrorCodes.NOT_FOUND, message, 404, { resource, id });
    this.name = 'ApiNotFoundError';
  }
}

/**
 * 409 Conflict
 */
export class ApiConflictError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(ApiErrorCodes.CONFLICT, message, 409, details);
    this.name = 'ApiConflictError';
  }
}

/**
 * 422 Validation Error
 */
export class ApiValidationError extends ApiError {
  readonly fieldErrors: Record<string, string[]>;

  constructor(message: string, fieldErrors?: Record<string, string[]>) {
    super(ApiErrorCodes.VALIDATION_ERROR, message, 422, fieldErrors);
    this.name = 'ApiValidationError';
    this.fieldErrors = fieldErrors ?? {};
  }
}

/**
 * 429 Rate Limit Error
 */
export class ApiRateLimitError extends ApiError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(ApiErrorCodes.RATE_LIMITED, 'Too many requests', 429, { retryAfter });
    this.name = 'ApiRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * 413 Payload Too Large
 */
export class PayloadTooLargeError extends ApiError {
  constructor(maxSize: number, actualSize?: number) {
    const message = `Payload size exceeds maximum allowed (${formatBytes(maxSize)})`;
    super(ApiErrorCodes.PAYLOAD_TOO_LARGE, message, 413, { maxSize, actualSize });
    this.name = 'PayloadTooLargeError';
  }
}

/**
 * 500 Internal Error
 */
export class ApiInternalError extends ApiError {
  constructor(message = 'An unexpected error occurred') {
    super(ApiErrorCodes.INTERNAL_ERROR, message, 500, undefined, false);
    this.name = 'ApiInternalError';
  }
}

/**
 * 503 Service Unavailable
 */
export class ApiServiceUnavailableError extends ApiError {
  constructor(service: string, message?: string) {
    super(
      ApiErrorCodes.SERVICE_UNAVAILABLE,
      message ?? `${service} is temporarily unavailable`,
      503,
      { service }
    );
    this.name = 'ApiServiceUnavailableError';
  }
}

/**
 * 500 Database Error (internal, generic message for clients)
 */
export class ApiDatabaseError extends ApiError {
  constructor(message = 'Database operation failed') {
    super(ApiErrorCodes.DATABASE_ERROR, message, 500, undefined, false);
    this.name = 'ApiDatabaseError';
  }
}

// ============================================================================
// Domain-Specific API Errors
// ============================================================================

/**
 * Scan not found error
 */
export class ScanNotFoundApiError extends ApiNotFoundError {
  constructor(scanId: string) {
    super('Scan', scanId);
    this.name = 'ScanNotFoundApiError';
  }
}

/**
 * Scan failed error
 */
export class ScanFailedApiError extends ApiError {
  constructor(scanId: string, reason: string) {
    super(
      ApiErrorCodes.SCAN_FAILED,
      `Scan '${scanId}' failed: ${reason}`,
      500,
      { scanId, reason }
    );
    this.name = 'ScanFailedApiError';
  }
}

/**
 * Parser error for API responses
 */
export class ParserApiError extends ApiError {
  constructor(parser: string, file: string, details?: string) {
    super(
      ApiErrorCodes.PARSER_ERROR,
      `${parser} parser failed for '${file}'`,
      400,
      { parser, file, details }
    );
    this.name = 'ParserApiError';
  }
}

/**
 * Invalid file type error
 */
export class InvalidFileTypeError extends ApiError {
  constructor(fileType: string, allowedTypes: string[]) {
    super(
      ApiErrorCodes.INVALID_FILE_TYPE,
      `File type '${fileType}' is not supported`,
      400,
      { fileType, allowedTypes }
    );
    this.name = 'InvalidFileTypeError';
  }
}

// ============================================================================
// Documentation System API Errors (TASK-FINAL-004)
// ============================================================================

/**
 * Documentation page not found API error
 */
export class DocPageNotFoundApiError extends ApiNotFoundError {
  constructor(pageId: string) {
    super('Documentation page', pageId);
    this.name = 'DocPageNotFoundApiError';
  }
}

/**
 * Slug already exists API error
 */
export class SlugExistsApiError extends ApiConflictError {
  constructor(slug: string) {
    super(`Page with slug '${slug}' already exists`, { slug });
    this.name = 'SlugExistsApiError';
  }
}

/**
 * Invalid documentation category API error
 */
export class InvalidCategoryApiError extends BadRequestError {
  constructor(category: string, validCategories?: string[]) {
    const message = validCategories
      ? `Invalid category '${category}'. Valid: ${validCategories.join(', ')}`
      : `Invalid category: ${category}`;
    super(message, { category, validCategories });
    this.name = 'InvalidCategoryApiError';
  }
}

/**
 * Invalid page status transition API error
 */
export class InvalidStatusTransitionApiError extends BadRequestError {
  constructor(currentStatus: string, targetStatus: string) {
    super(
      `Cannot transition from '${currentStatus}' to '${targetStatus}'`,
      { currentStatus, targetStatus }
    );
    this.name = 'InvalidStatusTransitionApiError';
  }
}

/**
 * Beta customer not found API error
 */
export class BetaCustomerNotFoundApiError extends ApiNotFoundError {
  constructor(identifier: string) {
    super('Beta customer', identifier);
    this.name = 'BetaCustomerNotFoundApiError';
  }
}

/**
 * Beta email already exists API error
 */
export class BetaEmailExistsApiError extends ApiConflictError {
  constructor(email: string) {
    super(`Email '${email}' is already registered`, { email });
    this.name = 'BetaEmailExistsApiError';
  }
}

/**
 * NDA required API error
 */
export class NdaRequiredApiError extends BadRequestError {
  constructor() {
    super('NDA must be signed before proceeding with onboarding');
    this.name = 'NdaRequiredApiError';
  }
}

/**
 * Checklist item not found API error
 */
export class ChecklistItemNotFoundApiError extends ApiNotFoundError {
  constructor(itemId: string) {
    super('Checklist item', itemId);
    this.name = 'ChecklistItemNotFoundApiError';
  }
}

/**
 * Item blocked by dependency API error
 */
export class BlockedByDependencyApiError extends ApiConflictError {
  constructor(itemId: string, blockerIds: string[]) {
    super(
      `Item '${itemId}' is blocked by incomplete dependencies: ${blockerIds.join(', ')}`,
      { itemId, blockerIds }
    );
    this.name = 'BlockedByDependencyApiError';
  }
}

/**
 * Circular dependency detected API error
 */
export class CircularDependencyApiError extends BadRequestError {
  constructor(cycle: string[]) {
    super(
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      { cycle }
    );
    this.name = 'CircularDependencyApiError';
  }
}

/**
 * Invalid target date API error
 */
export class InvalidTargetDateApiError extends BadRequestError {
  constructor(reason: string) {
    super(`Invalid target launch date: ${reason}`);
    this.name = 'InvalidTargetDateApiError';
  }
}

// ============================================================================
// Error Handler Utilities
// ============================================================================

/**
 * Send an API error response via Fastify reply
 */
export function sendApiError(
  reply: FastifyReply,
  error: ApiError | Error,
  requestId?: string,
  includeDebug = false
): void {
  if (error instanceof ApiError) {
    const response = includeDebug
      ? error.toDebugResponse(requestId)
      : error.toResponse(requestId);
    reply.status(error.statusCode).send(response);
  } else {
    // Wrap unknown errors
    const internalError = new ApiInternalError();
    const response = includeDebug
      ? {
          ...internalError.toResponse(requestId),
          error: {
            ...internalError.toResponse(requestId).error,
            originalMessage: error.message,
            stack: error.stack,
          },
        }
      : internalError.toResponse(requestId);
    reply.status(500).send(response);
  }
}

/**
 * Type guard to check if error is an ApiError
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * Convert a domain error to an API error
 */
export function toApiError(error: Error): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  // Check error name/type for common patterns
  const errorName = error.name.toLowerCase();

  if (errorName.includes('notfound')) {
    return new ApiNotFoundError('Resource');
  }
  if (errorName.includes('validation')) {
    return new ApiValidationError(error.message);
  }
  if (errorName.includes('unauthorized') || errorName.includes('auth')) {
    return new ApiUnauthorizedError(error.message);
  }
  if (errorName.includes('forbidden') || errorName.includes('permission')) {
    return new ApiForbiddenError(error.message);
  }

  // Default to internal error
  return new ApiInternalError(error.message);
}

/**
 * Create an API error from an HTTP status code
 */
export function fromStatusCode(
  statusCode: number,
  message?: string
): ApiError {
  switch (statusCode) {
    case 400:
      return new BadRequestError(message ?? 'Bad request');
    case 401:
      return new ApiUnauthorizedError(message);
    case 403:
      return new ApiForbiddenError(message);
    case 404:
      return new ApiNotFoundError('Resource');
    case 409:
      return new ApiConflictError(message ?? 'Conflict');
    case 422:
      return new ApiValidationError(message ?? 'Validation failed');
    case 429:
      return new ApiRateLimitError(60);
    case 503:
      return new ApiServiceUnavailableError('Service', message);
    default:
      return new ApiInternalError(message);
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(1)}${units[unitIndex]}`;
}

/**
 * Extract request ID from Fastify reply or request
 */
export function getRequestId(reply: FastifyReply): string | undefined {
  // Try to get from request headers or generated ID
  return reply.request.id as string | undefined;
}
