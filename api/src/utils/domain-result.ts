/**
 * Domain Result Pattern
 * @module utils/domain-result
 *
 * Domain-specific error types and pattern matching for Result types.
 * Provides typed domain errors and utilities for handling business logic failures.
 *
 * TASK-DETECT: Final refactoring - Domain result utilities
 */

import { type Result, type Err, err, isOk } from './result.js';

// ============================================================================
// Domain Error Types
// ============================================================================

/**
 * Common domain error types for use with Result
 */
export type DomainError =
  | { type: 'not_found'; resource: string; id?: string }
  | { type: 'validation'; field: string; message: string }
  | { type: 'conflict'; message: string }
  | { type: 'permission'; action: string; resource: string }
  | { type: 'external'; service: string; message: string }
  | { type: 'timeout'; operation: string; durationMs: number };

/**
 * Result type with DomainError
 */
export type DomainResult<T> = Result<T, DomainError>;

// ============================================================================
// Domain Error Constructors
// ============================================================================

/**
 * Create a not found domain error
 */
export function notFound(resource: string, id?: string): Err<DomainError> {
  return err({ type: 'not_found', resource, id });
}

/**
 * Create a validation domain error
 */
export function validationErr(field: string, message: string): Err<DomainError> {
  return err({ type: 'validation', field, message });
}

/**
 * Create a conflict domain error
 */
export function conflictErr(message: string): Err<DomainError> {
  return err({ type: 'conflict', message });
}

/**
 * Create a permission domain error
 */
export function permissionErr(action: string, resource: string): Err<DomainError> {
  return err({ type: 'permission', action, resource });
}

/**
 * Create an external service domain error
 */
export function externalErr(service: string, message: string): Err<DomainError> {
  return err({ type: 'external', service, message });
}

/**
 * Create a timeout domain error
 */
export function timeoutErr(operation: string, durationMs: number): Err<DomainError> {
  return err({ type: 'timeout', operation, durationMs });
}

// ============================================================================
// Pattern Matching
// ============================================================================

/**
 * Pattern match on a DomainResult with typed handlers
 */
export function matchDomain<T, R>(
  result: DomainResult<T>,
  handlers: {
    ok: (value: T) => R;
    notFound?: (resource: string, id?: string) => R;
    validation?: (field: string, message: string) => R;
    conflict?: (message: string) => R;
    permission?: (action: string, resource: string) => R;
    external?: (service: string, message: string) => R;
    timeout?: (operation: string, durationMs: number) => R;
    default?: (error: DomainError) => R;
  }
): R {
  if (isOk(result)) {
    return handlers.ok(result.value);
  }

  const error = result.error;
  const throwError = (): never => {
    throw error;
  };

  switch (error.type) {
    case 'not_found':
      return handlers.notFound
        ? handlers.notFound(error.resource, error.id)
        : (handlers.default?.(error) ?? throwError());
    case 'validation':
      return handlers.validation
        ? handlers.validation(error.field, error.message)
        : (handlers.default?.(error) ?? throwError());
    case 'conflict':
      return handlers.conflict
        ? handlers.conflict(error.message)
        : (handlers.default?.(error) ?? throwError());
    case 'permission':
      return handlers.permission
        ? handlers.permission(error.action, error.resource)
        : (handlers.default?.(error) ?? throwError());
    case 'external':
      return handlers.external
        ? handlers.external(error.service, error.message)
        : (handlers.default?.(error) ?? throwError());
    case 'timeout':
      return handlers.timeout
        ? handlers.timeout(error.operation, error.durationMs)
        : (handlers.default?.(error) ?? throwError());
    default:
      throw new Error('Unknown domain error type');
  }
}

// ============================================================================
// Domain Error Utilities
// ============================================================================

/**
 * Check if a domain error is of a specific type
 */
export function isDomainErrorType<T extends DomainError['type']>(
  error: DomainError,
  type: T
): error is Extract<DomainError, { type: T }> {
  return error.type === type;
}

/**
 * Get a human-readable message from a domain error
 */
export function getDomainErrorMessage(error: DomainError): string {
  switch (error.type) {
    case 'not_found':
      return error.id
        ? `${error.resource} with ID '${error.id}' not found`
        : `${error.resource} not found`;
    case 'validation':
      return `Validation error on ${error.field}: ${error.message}`;
    case 'conflict':
      return `Conflict: ${error.message}`;
    case 'permission':
      return `Permission denied: cannot ${error.action} on ${error.resource}`;
    case 'external':
      return `External service error (${error.service}): ${error.message}`;
    case 'timeout':
      return `Operation '${error.operation}' timed out after ${error.durationMs}ms`;
  }
}

/**
 * Convert a domain error to an HTTP status code
 */
export function domainErrorToHttpStatus(error: DomainError): number {
  switch (error.type) {
    case 'not_found':
      return 404;
    case 'validation':
      return 422;
    case 'conflict':
      return 409;
    case 'permission':
      return 403;
    case 'external':
      return 502;
    case 'timeout':
      return 504;
  }
}
