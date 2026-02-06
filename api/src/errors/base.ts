/**
 * Base Error Classes
 * @module errors/base
 *
 * Foundation error classes for the IaC dependency detection system.
 * Provides a hierarchical error structure with proper serialization
 * and error cause chaining.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { ErrorCode, getHttpStatusForCode } from './codes';

// ============================================================================
// Error Context Types
// ============================================================================

/**
 * Context information for errors
 */
export interface ErrorContext {
  /** Original error that caused this error */
  cause?: Error;
  /** Additional details about the error */
  details?: Record<string, unknown>;
  /** Timestamp when error occurred */
  timestamp?: Date;
  /** Request ID for tracing */
  requestId?: string;
  /** User ID if available */
  userId?: string;
  /** Tenant ID if available */
  tenantId?: string;
  /** Operation being performed */
  operation?: string;
  /** Resource that was being accessed */
  resource?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Serialized error format for API responses
 */
export interface SerializedError {
  name: string;
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: Record<string, unknown>;
  stack?: string;
}

/**
 * Source location information
 */
export interface SourceLocation {
  file: string;
  lineStart: number;
  lineEnd: number;
  columnStart?: number;
  columnEnd?: number;
}

// ============================================================================
// Base Error Class
// ============================================================================

/**
 * Base error class for all application errors.
 * Provides consistent error handling, serialization, and cause chaining.
 */
export abstract class BaseError extends Error {
  /** Error code for programmatic handling */
  public readonly code: ErrorCode;
  /** HTTP status code */
  public readonly statusCode: number;
  /** Timestamp when the error occurred */
  public readonly timestamp: Date;
  /** Error context with additional information */
  public readonly context: ErrorContext;
  /**
   * Whether this is an operational error.
   * Operational errors are expected errors (validation, not found, etc.)
   * Non-operational errors are bugs that require attention.
   */
  public readonly isOperational: boolean;

  constructor(
    message: string,
    code: ErrorCode,
    context: ErrorContext = {},
    isOperational = true
  ) {
    super(message);

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = getHttpStatusForCode(code);
    this.timestamp = context.timestamp ?? new Date();
    this.context = context;
    this.isOperational = isOperational;

    // Capture stack trace, excluding constructor
    Error.captureStackTrace(this, this.constructor);

    // Set cause if provided (for error chaining)
    if (context.cause) {
      this.cause = context.cause;
    }
  }

  /**
   * Serialize error to JSON-safe object
   */
  toJSON(): SerializedError {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp.toISOString(),
      requestId: this.context.requestId,
      details: this.context.details,
    };
  }

  /**
   * Create a safe response object (no sensitive data)
   */
  toSafeResponse(includeStack = false): SerializedError {
    const response = this.toJSON();
    if (includeStack) {
      response.stack = this.stack;
    }
    return response;
  }

  /**
   * String representation
   */
  toString(): string {
    return `${this.name} [${this.code}]: ${this.message}`;
  }

  /**
   * Get the root cause of the error chain
   */
  getRootCause(): Error {
    let current: Error = this;
    while (current.cause instanceof Error) {
      current = current.cause;
    }
    return current;
  }

  /**
   * Get the full error chain as an array
   */
  getErrorChain(): Error[] {
    const chain: Error[] = [this];
    let current: Error = this;
    while (current.cause instanceof Error) {
      chain.push(current.cause);
      current = current.cause;
    }
    return chain;
  }

  /**
   * Create a new error with updated context
   */
  withContext(additionalContext: Partial<ErrorContext>): this {
    const Constructor = this.constructor as new (
      message: string,
      code: ErrorCode,
      context: ErrorContext,
      isOperational: boolean
    ) => this;

    return new Constructor(
      this.message,
      this.code,
      { ...this.context, ...additionalContext },
      this.isOperational
    );
  }

  /**
   * Create a new error with a request ID
   */
  withRequestId(requestId: string): this {
    return this.withContext({ requestId });
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is a BaseError
 */
export function isBaseError(error: unknown): error is BaseError {
  return error instanceof BaseError;
}

/**
 * Check if an error is operational (expected error)
 */
export function isOperationalError(error: unknown): boolean {
  if (isBaseError(error)) {
    return error.isOperational;
  }
  return false;
}

/**
 * Check if an error has a specific code
 */
export function hasErrorCode(error: unknown, code: ErrorCode): boolean {
  if (isBaseError(error)) {
    return error.code === code;
  }
  return false;
}

// ============================================================================
// Error Factory Utilities
// ============================================================================

/**
 * Wrap an unknown error into a BaseError-compatible format
 */
export function wrapError(
  error: unknown,
  message?: string,
  code: ErrorCode = 'INTERNAL_ERROR'
): Error {
  if (error instanceof BaseError) {
    return message ? error.withContext({ details: { originalMessage: message } }) : error;
  }

  if (error instanceof Error) {
    // Create a wrapper that maintains the original error as cause
    const wrappedMessage = message ?? error.message;
    return new WrappedError(wrappedMessage, code, { cause: error });
  }

  // Handle non-Error values
  const errorMessage = message ?? String(error);
  return new WrappedError(errorMessage, code, { details: { originalValue: error } });
}

/**
 * Internal error for wrapping unknown errors
 */
class WrappedError extends BaseError {
  constructor(message: string, code: ErrorCode, context: ErrorContext) {
    super(message, code, context, false);
    this.name = 'WrappedError';
  }
}

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}

/**
 * Extract error stack from unknown error
 */
export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}
