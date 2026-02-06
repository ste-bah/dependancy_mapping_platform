/**
 * Scan History Error Handler
 * Centralized error handling for scan history API calls and operations
 * @module features/scan-history/utils/errorHandler
 */

import { ApiClientError } from '@/core/api/client';

// ============================================================================
// Error Types
// ============================================================================

/**
 * Scan History specific error codes for categorizing errors
 */
export type ScanHistoryErrorCode =
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'SERVER_ERROR'
  | 'RATE_LIMITED'
  | 'SCAN_NOT_FOUND'
  | 'DIFF_FAILED'
  | 'EXPORT_FAILED'
  | 'UNKNOWN_ERROR';

/**
 * Scan History error type for UI display
 */
export type ScanHistoryErrorType =
  | 'network'
  | 'timeout'
  | 'not_found'
  | 'unauthorized'
  | 'forbidden'
  | 'server'
  | 'validation'
  | 'unknown';

/**
 * HTTP status code to ScanHistoryErrorCode mapping
 */
const STATUS_CODE_MAP: Record<number, ScanHistoryErrorCode> = {
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

/**
 * Map error code to error type
 */
const ERROR_CODE_TO_TYPE: Record<ScanHistoryErrorCode, ScanHistoryErrorType> = {
  NETWORK_ERROR: 'network',
  TIMEOUT_ERROR: 'timeout',
  NOT_FOUND: 'not_found',
  SCAN_NOT_FOUND: 'not_found',
  FORBIDDEN: 'forbidden',
  UNAUTHORIZED: 'unauthorized',
  VALIDATION_ERROR: 'validation',
  SERVER_ERROR: 'server',
  RATE_LIMITED: 'server',
  DIFF_FAILED: 'server',
  EXPORT_FAILED: 'server',
  UNKNOWN_ERROR: 'unknown',
};

// ============================================================================
// ScanHistoryError Class
// ============================================================================

/**
 * Custom error class for scan history related errors
 * Provides structured error information for consistent handling
 */
export class ScanHistoryError extends Error {
  /** Error classification code */
  readonly code: ScanHistoryErrorCode;
  /** Error type for UI display */
  readonly type: ScanHistoryErrorType;
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
    code: ScanHistoryErrorCode,
    options: {
      statusCode?: number;
      retryable?: boolean;
      details?: Record<string, unknown>;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ScanHistoryError';
    this.code = code;
    this.type = ERROR_CODE_TO_TYPE[code];
    this.statusCode = options.statusCode;
    this.retryable = options.retryable ?? isRetryableCode(code);
    this.details = options.details;
    this.timestamp = new Date();
    this.cause = options.cause;

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ScanHistoryError);
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
      type: this.type,
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
    return `ScanHistoryError [${this.code}]: ${this.message}`;
  }
}

// ============================================================================
// Error Code Helpers
// ============================================================================

/**
 * Determine if an error code represents a retryable error
 */
function isRetryableCode(code: ScanHistoryErrorCode): boolean {
  const retryableCodes: ScanHistoryErrorCode[] = [
    'NETWORK_ERROR',
    'TIMEOUT_ERROR',
    'SERVER_ERROR',
    'RATE_LIMITED',
  ];
  return retryableCodes.includes(code);
}

/**
 * Map a status code to a ScanHistoryErrorCode
 */
function statusCodeToErrorCode(statusCode: number): ScanHistoryErrorCode {
  return STATUS_CODE_MAP[statusCode] ?? 'UNKNOWN_ERROR';
}

// ============================================================================
// Error Handler Functions
// ============================================================================

/**
 * Transform any error into a structured ScanHistoryError
 * Handles ApiClientError, standard Error, and unknown error types
 *
 * @param error - The error to transform
 * @returns A structured ScanHistoryError
 *
 * @example
 * ```ts
 * try {
 *   await fetchScanHistory();
 * } catch (error) {
 *   const scanError = handleApiError(error);
 *   console.log(scanError.code, scanError.message);
 * }
 * ```
 */
export function handleApiError(error: unknown): ScanHistoryError {
  // Already a ScanHistoryError
  if (error instanceof ScanHistoryError) {
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
  return new ScanHistoryError(
    'An unexpected error occurred',
    'UNKNOWN_ERROR',
    {
      details: { originalError: String(error) },
    }
  );
}

/**
 * Transform an ApiClientError to a ScanHistoryError
 */
function transformApiClientError(error: ApiClientError): ScanHistoryError {
  // Handle network errors
  if (error.isNetworkError) {
    return new ScanHistoryError(
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
    return new ScanHistoryError(
      'The request took too long to complete. Please try again.',
      'TIMEOUT_ERROR',
      {
        cause: error,
        retryable: true,
      }
    );
  }

  // Map status code to error code
  const code = statusCodeToErrorCode(error.statusCode);

  // Check for scan-specific error codes from API
  const apiCode = error.code;
  let finalCode = code;
  if (apiCode === 'SCAN_NOT_FOUND') {
    finalCode = 'SCAN_NOT_FOUND';
  } else if (apiCode === 'DIFF_COMPUTATION_FAILED') {
    finalCode = 'DIFF_FAILED';
  } else if (apiCode === 'EXPORT_FAILED') {
    finalCode = 'EXPORT_FAILED';
  }

  // Generate user-friendly message based on code
  const message = getMessageForCode(finalCode, error.message);

  return new ScanHistoryError(message, finalCode, {
    statusCode: error.statusCode,
    cause: error,
    details: error.details,
  });
}

/**
 * Transform a standard Error to a ScanHistoryError
 */
function transformStandardError(error: Error): ScanHistoryError {
  // Check for common error patterns
  const message = error.message.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) {
    return new ScanHistoryError(
      'A network error occurred. Please check your connection and try again.',
      'NETWORK_ERROR',
      { cause: error, retryable: true }
    );
  }

  if (message.includes('timeout') || message.includes('timed out')) {
    return new ScanHistoryError(
      'The operation timed out. Please try again.',
      'TIMEOUT_ERROR',
      { cause: error, retryable: true }
    );
  }

  if (message.includes('abort')) {
    return new ScanHistoryError(
      'The request was cancelled.',
      'UNKNOWN_ERROR',
      { cause: error, retryable: false }
    );
  }

  return new ScanHistoryError(
    error.message || 'An unexpected error occurred',
    'UNKNOWN_ERROR',
    { cause: error }
  );
}

/**
 * Generate a user-friendly message for an error code
 */
function getMessageForCode(code: ScanHistoryErrorCode, originalMessage?: string): string {
  const messages: Record<ScanHistoryErrorCode, string> = {
    NETWORK_ERROR: 'Unable to connect to the server. Please check your internet connection.',
    TIMEOUT_ERROR: 'The request took too long to complete. Please try again.',
    NOT_FOUND: 'The requested resource could not be found.',
    SCAN_NOT_FOUND: 'The scan you are looking for could not be found. It may have been deleted.',
    FORBIDDEN: 'You do not have permission to access this scan history.',
    UNAUTHORIZED: 'Your session has expired. Please sign in again.',
    VALIDATION_ERROR: originalMessage || 'The provided data is invalid.',
    SERVER_ERROR: 'An error occurred on the server. Please try again later.',
    RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
    DIFF_FAILED: 'Failed to compute the scan comparison. Please try again.',
    EXPORT_FAILED: 'Failed to export scan data. Please try again.',
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
 * @param error - The error to check (ScanHistoryError or any Error)
 * @returns Whether the error can be recovered by retrying
 */
export function isRetryableError(error: ScanHistoryError | Error): boolean {
  if (error instanceof ScanHistoryError) {
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
export function isAuthError(error: ScanHistoryError | Error): boolean {
  if (error instanceof ScanHistoryError) {
    return error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN';
  }
  return false;
}

/**
 * Check if an error is a validation error
 */
export function isValidationError(error: ScanHistoryError | Error): boolean {
  if (error instanceof ScanHistoryError) {
    return error.code === 'VALIDATION_ERROR';
  }
  return false;
}

/**
 * Check if an error is a not found error
 */
export function isNotFoundError(error: ScanHistoryError | Error): boolean {
  if (error instanceof ScanHistoryError) {
    return error.code === 'NOT_FOUND' || error.code === 'SCAN_NOT_FOUND';
  }
  return false;
}

/**
 * Get the error type from an error
 */
export function getErrorType(error: ScanHistoryError | Error | unknown): ScanHistoryErrorType {
  if (error instanceof ScanHistoryError) {
    return error.type;
  }

  const scanError = handleApiError(error);
  return scanError.type;
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
 */
export function getErrorMessage(error: ScanHistoryError | Error | unknown): string {
  if (error instanceof ScanHistoryError) {
    return error.message;
  }

  if (error instanceof Error) {
    const scanError = handleApiError(error);
    return scanError.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Get a short error title suitable for toast notifications
 */
export function getErrorTitle(error: ScanHistoryError | Error | unknown): string {
  const titles: Record<ScanHistoryErrorCode, string> = {
    NETWORK_ERROR: 'Connection Error',
    TIMEOUT_ERROR: 'Request Timeout',
    NOT_FOUND: 'Not Found',
    SCAN_NOT_FOUND: 'Scan Not Found',
    FORBIDDEN: 'Access Denied',
    UNAUTHORIZED: 'Authentication Required',
    VALIDATION_ERROR: 'Invalid Data',
    SERVER_ERROR: 'Server Error',
    RATE_LIMITED: 'Rate Limited',
    DIFF_FAILED: 'Comparison Failed',
    EXPORT_FAILED: 'Export Failed',
    UNKNOWN_ERROR: 'Error',
  };

  if (error instanceof ScanHistoryError) {
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
  | 'navigate_back'
  | 'sign_in'
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
 */
export function getErrorRecoveryActions(error: ScanHistoryError | Error): RecoveryAction[] {
  const scanError = error instanceof ScanHistoryError ? error : handleApiError(error);
  const actions: RecoveryAction[] = [];

  switch (scanError.code) {
    case 'NETWORK_ERROR':
    case 'TIMEOUT_ERROR':
    case 'SERVER_ERROR':
    case 'DIFF_FAILED':
    case 'EXPORT_FAILED':
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
        { type: 'navigate_back', label: 'Go Back', primary: true },
        { type: 'contact_support', label: 'Contact Support' }
      );
      break;

    case 'NOT_FOUND':
    case 'SCAN_NOT_FOUND':
      actions.push(
        { type: 'navigate_back', label: 'Go Back', primary: true },
        { type: 'refresh', label: 'Refresh' }
      );
      break;

    case 'RATE_LIMITED':
      actions.push(
        { type: 'retry', label: 'Try Again Later', primary: true, description: 'Wait a moment before retrying' }
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
export function getPrimaryRecoveryAction(error: ScanHistoryError | Error): RecoveryAction | null {
  const actions = getErrorRecoveryActions(error);
  return actions.find(a => a.primary) ?? actions[0] ?? null;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a ScanHistoryError
 */
export function isScanHistoryError(value: unknown): value is ScanHistoryError {
  return value instanceof ScanHistoryError;
}

/**
 * Type guard to check if an error has a specific code
 */
export function hasErrorCode(
  error: unknown,
  code: ScanHistoryErrorCode
): error is ScanHistoryError {
  return error instanceof ScanHistoryError && error.code === code;
}
