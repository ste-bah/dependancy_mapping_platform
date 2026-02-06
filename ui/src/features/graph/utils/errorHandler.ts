/**
 * Graph Error Handler
 * Centralized error handling for graph API calls and operations
 * @module features/graph/utils/errorHandler
 */

import { ApiClientError } from '@/core/api/client';

// ============================================================================
// Error Codes
// ============================================================================

/**
 * Graph-specific error codes for categorizing errors
 */
export type GraphErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'GRAPH_TOO_LARGE'
  | 'CALCULATION_TIMEOUT'
  | 'UNKNOWN_ERROR';

/**
 * HTTP status code to GraphErrorCode mapping
 */
const STATUS_CODE_MAP: Record<number, GraphErrorCode> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  408: 'TIMEOUT_ERROR',
  429: 'RATE_LIMITED',
  500: 'SERVER_ERROR',
  502: 'SERVER_ERROR',
  503: 'SERVER_ERROR',
  504: 'TIMEOUT_ERROR',
};

// ============================================================================
// GraphError Class
// ============================================================================

/**
 * Custom error class for graph-related errors
 * Provides structured error information for consistent handling
 */
export class GraphError extends Error {
  /** Error classification code */
  readonly code: GraphErrorCode;
  /** HTTP status code if applicable */
  readonly statusCode: number | undefined;
  /** Whether this error can be recovered by retrying */
  readonly retryable: boolean;
  /** Additional error context */
  readonly details: Record<string, unknown> | undefined;
  /** Timestamp when error occurred */
  readonly timestamp: Date;
  /** Original error that caused this */
  readonly cause: Error | undefined;

  constructor(
    message: string,
    code: GraphErrorCode,
    options: {
      statusCode?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'GraphError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? isRetryableCode(code);
    this.details = options.details;
    this.timestamp = new Date();
    this.cause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, GraphError);
    }
  }

  /**
   * Create a JSON-serializable representation of the error
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      retryable: this.retryable,
      timestamp: this.timestamp.toISOString(),
      ...(this.details && { details: this.details }),
    };
  }

  /**
   * Create a string representation of the error
   */
  toString(): string {
    return `GraphError [${this.code}]: ${this.message}`;
  }
}

// ============================================================================
// Error Code Helpers
// ============================================================================

/**
 * Determine if an error code represents a retryable error
 */
function isRetryableCode(code: GraphErrorCode): boolean {
  const retryableCodes: GraphErrorCode[] = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVER_ERROR',
    'RATE_LIMITED',
  ];
  return retryableCodes.includes(code);
}

/**
 * Map a status code to a GraphErrorCode
 */
function statusCodeToGraphErrorCode(statusCode: number): GraphErrorCode {
  return STATUS_CODE_MAP[statusCode] ?? 'UNKNOWN_ERROR';
}

// ============================================================================
// Error Handler Functions
// ============================================================================

/**
 * Transform any error into a structured GraphError
 * Handles ApiClientError, standard Error, and unknown error types
 *
 * @param error - The error to transform
 * @returns A structured GraphError
 *
 * @example
 * ```ts
 * try {
 *   await fetchGraph(scanId);
 * } catch (error) {
 *   const graphError = handleApiError(error);
 *   console.log(graphError.code, graphError.message);
 * }
 * ```
 */
export function handleApiError(error: unknown): GraphError {
  // Already a GraphError
  if (error instanceof GraphError) {
    return error;
  }

  // ApiClientError from the API client
  if (error instanceof ApiClientError) {
    return transformApiClientError(error);
  }

  // Standard Error
  if (error instanceof Error) {
    return transformStandardError(error);
  }

  // Unknown error type
  return new GraphError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    {
      details: { originalError: String(error) },
    }
  );
}

/**
 * Transform an ApiClientError to a GraphError
 */
function transformApiClientError(error: ApiClientError): GraphError {
  // Handle network errors
  if (error.isNetworkError) {
    return new GraphError(
      'Unable to connect to the server. Please check your internet connection.',
      'NETWORK_ERROR',
      {
        cause: error,
        retryable: true,
      }
    );
  }

  // Handle timeout errors
  if (error.isTimeout) {
    return new GraphError(
      'The request took too long to complete. Please try again.',
      'TIMEOUT_ERROR',
      {
        cause: error,
        retryable: true,
      }
    );
  }

  // Map status code to error code
  const code = statusCodeToGraphErrorCode(error.statusCode);

  // Generate user-friendly message based on code
  const message = getMessageForCode(code, error.message);

  return new GraphError(message, code, {
    statusCode: error.statusCode,
    cause: error,
    details: error.details,
  });
}

/**
 * Transform a standard Error to a GraphError
 */
function transformStandardError(error: Error): GraphError {
  // Check for common error patterns
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return new GraphError(
      'A network error occurred. Please check your connection and try again.',
      'NETWORK_ERROR',
      { cause: error, retryable: true }
    );
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return new GraphError(
      'The operation timed out. Please try again.',
      'TIMEOUT_ERROR',
      { cause: error, retryable: true }
    );
  }

  if (message.includes('abort')) {
    return new GraphError(
      'The request was cancelled.',
      'UNKNOWN_ERROR',
      { cause: error, retryable: false }
    );
  }

  return new GraphError(
    error.message || 'An unexpected error occurred',
    'UNKNOWN_ERROR',
    { cause: error }
  );
}

/**
 * Generate a user-friendly message for an error code
 */
function getMessageForCode(code: GraphErrorCode, originalMessage?: string): string {
  const messages: Record<GraphErrorCode, string> = {
    NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
    TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',
    NOT_FOUND: 'The requested resource could not be found.',
    FORBIDDEN: 'You do not have permission to access this resource.',
    UNAUTHORIZED: 'Please sign in to access this feature.',
    VALIDATION_ERROR: originalMessage || 'The provided data is invalid.',
    SERVER_ERROR: 'An error occurred on the server. Please try again later.',
    RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
    GRAPH_TOO_LARGE: 'The dependency graph is too large to display. Try applying filters.',
    CALCULATION_TIMEOUT: 'The calculation took too long. Try with fewer nodes.',
    UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  };

  return messages[code];
}

// ============================================================================
// Error Classification Functions
// ============================================================================

/**
 * Check if an error is retryable
 *
 * @param error - The error to check (GraphError or any Error)
 * @returns Whether the error can be recovered by retrying
 *
 * @example
 * ```ts
 * const graphError = handleApiError(error);
 * if (isRetryableError(graphError)) {
 *   // Show retry button
 * }
 * ```
 */
export function isRetryableError(error: GraphError | Error): boolean {
  if (error instanceof GraphError) {
    return error.retryable;
  }
  // For standard errors, check message patterns
  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch')
  );
}

/**
 * Check if an error requires authentication
 */
export function isAuthError(error: GraphError | Error): boolean {
  if (error instanceof GraphError) {
    return error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN';
  }
  return false;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: GraphError | Error): boolean {
  if (error instanceof GraphError) {
    return error.code === 'VALIDATION_ERROR';
  }
  return false;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: GraphError | Error): boolean {
  if (error instanceof GraphError) {
    return error.code === 'NOT_FOUND';
  }
  return false;
}

// ============================================================================
// User Message Functions
// ============================================================================

/**
 * Get a user-friendly error message
 * Never exposes technical details to users
 *
 * @param error - The error to get a message for
 * @returns A user-friendly error message
 *
 * @example
 * ```tsx
 * <Alert variant="error">
 *   {getErrorMessage(error)}
 * </Alert>
 * ```
 */
export function getErrorMessage(error: GraphError | Error | unknown): string {
  if (error instanceof GraphError) {
    return error.message;
  }

  if (error instanceof Error) {
    const graphError = handleApiError(error);
    return graphError.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get a short error title suitable for toast notifications
 */
export function getErrorTitle(error: GraphError | Error | unknown): string {
  const titles: Record<GraphErrorCode, string> = {
    NETWORK_ERROR: 'Connection Error',
    TIMEOUT_ERROR: 'Request Timeout',
    NOT_FOUND: 'Not Found',
    FORBIDDEN: 'Access Denied',
    UNAUTHORIZED: 'Authentication Required',
    VALIDATION_ERROR: 'Invalid Data',
    SERVER_ERROR: 'Server Error',
    RATE_LIMITED: 'Rate Limited',
    GRAPH_TOO_LARGE: 'Graph Too Large',
    CALCULATION_TIMEOUT: 'Calculation Timeout',
    UNKNOWN_ERROR: 'Error',
  };

  if (error instanceof GraphError) {
    return titles[error.code];
  }

  return 'Error';
}

// ============================================================================
// Recovery Action Types
// ============================================================================

/**
 * Recovery action types for error handling
 */
export type RecoveryActionType =
  | 'retry'
  | 'refresh'
  | 'navigate'
  | 'clear_cache'
  | 'sign_in'
  | 'apply_filters'
  | 'contact_support'
  | 'dismiss';

/**
 * Recovery action configuration
 */
export interface RecoveryAction {
  /** Type of recovery action */
  type: RecoveryActionType;
  /** Display label for the action button */
  label: string;
  /** Optional description of what the action does */
  description?: string;
  /** Whether this is the primary/recommended action */
  primary?: boolean;
}

/**
 * Get available recovery actions for an error
 *
 * @param error - The error to get recovery actions for
 * @returns Array of available recovery actions
 *
 * @example
 * ```tsx
 * const actions = getErrorRecoveryActions(error);
 * actions.map(action => (
 *   <Button onClick={() => handleAction(action.type)}>
 *     {action.label}
 *   </Button>
 * ))
 * ```
 */
export function getErrorRecoveryActions(error: GraphError | Error): RecoveryAction[] {
  const graphError = error instanceof GraphError ? error : handleApiError(error);
  const actions: RecoveryAction[] = [];

  switch (graphError.code) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
    case 'SERVER_ERROR':
      actions.push(
        { type: 'retry', label: 'Try Again', primary: true },
        { type: 'refresh', label: 'Refresh Page' }
      );
      break;

    case 'UNAUTHORIZED':
      actions.push(
        { type: 'sign_in', label: 'Sign In', primary: true }
      );
      break;

    case 'FORBIDDEN':
      actions.push(
        { type: 'navigate', label: 'Go Back', primary: true },
        { type: 'contact_support', label: 'Contact Support' }
      );
      break;

    case 'NOT_FOUND':
      actions.push(
        { type: 'navigate', label: 'Go Back', primary: true },
        { type: 'refresh', label: 'Refresh' }
      );
      break;

    case 'RATE_LIMITED':
      actions.push(
        { type: 'retry', label: 'Try Again Later', primary: true, description: 'Wait a moment before retrying' }
      );
      break;

    case 'GRAPH_TOO_LARGE':
      actions.push(
        { type: 'apply_filters', label: 'Apply Filters', primary: true, description: 'Reduce the number of nodes' }
      );
      break;

    case 'CALCULATION_TIMEOUT':
      actions.push(
        { type: 'apply_filters', label: 'Simplify Selection', primary: true },
        { type: 'retry', label: 'Try Again' }
      );
      break;

    case 'VALIDATION_ERROR':
      actions.push(
        { type: 'dismiss', label: 'OK', primary: true }
      );
      break;

    default:
      actions.push(
        { type: 'retry', label: 'Try Again', primary: true },
        { type: 'contact_support', label: 'Report Issue' }
      );
  }

  return actions;
}

/**
 * Get the primary recovery action for an error
 */
export function getPrimaryRecoveryAction(error: GraphError | Error): RecoveryAction | null {
  const actions = getErrorRecoveryActions(error);
  return actions.find(a => a.primary) ?? actions[0] ?? null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a GraphError
 */
export function isGraphError(value: unknown): value is GraphError {
  return value instanceof GraphError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(
  error: unknown,
  code: GraphErrorCode
): error is GraphError {
  return error instanceof GraphError && error.code === code;
}
