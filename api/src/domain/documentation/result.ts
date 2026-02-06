/**
 * Result Type for Documentation Domain Operations
 * @module domain/documentation/result
 *
 * Provides a discriminated union type for operations that can fail,
 * enabling explicit error handling without exceptions.
 *
 * TASK-FINAL-004: Documentation system domain implementation
 */

// ============================================================================
// Result Type Definition
// ============================================================================

/**
 * Result type representing either success with a value or failure with an error.
 * Provides type-safe error handling without exceptions.
 *
 * @typeParam T - The success value type
 * @typeParam E - The error type (defaults to Error)
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

/**
 * Result namespace with utility functions
 */
export const Result = {
  /**
   * Create a successful result
   */
  ok<T>(value: T): Result<T, never> {
    return { success: true, value };
  },

  /**
   * Create a failed result
   */
  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  /**
   * Type guard to check if result is successful
   */
  isOk<T, E>(result: Result<T, E>): result is { readonly success: true; readonly value: T } {
    return result.success === true;
  },

  /**
   * Type guard to check if result is failed
   */
  isErr<T, E>(result: Result<T, E>): result is { readonly success: false; readonly error: E } {
    return result.success === false;
  },

  /**
   * Transform the success value using a mapping function
   */
  map<T, U, E>(result: Result<T, E>, fn: (t: T) => U): Result<U, E> {
    if (result.success) {
      return Result.ok(fn(result.value));
    }
    return result;
  },

  /**
   * Unwrap a successful result or return a default value
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.success) {
      return result.value;
    }
    return defaultValue;
  },

  /**
   * Combine multiple Results into a single Result of an array
   */
  all<T, E>(results: Result<T, E>[]): Result<T[], E> {
    const values: T[] = [];
    for (const result of results) {
      if (!result.success) {
        return result;
      }
      values.push(result.value);
    }
    return Result.ok(values);
  },
} as const;

// ============================================================================
// Type Aliases
// ============================================================================

/**
 * Result with validation errors
 */
export type ValidationResult<T> = Result<T, ValidationError>;

/**
 * Result with domain errors
 */
export type DomainResult<T> = Result<T, DomainError>;

// ============================================================================
// Domain Error Types
// ============================================================================

/**
 * Base validation error for domain operations
 */
export class ValidationError extends Error {
  public readonly code: string;
  public readonly field?: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    field?: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  static required(field: string): ValidationError {
    return new ValidationError(
      `${field} is required`,
      'REQUIRED_FIELD',
      field
    );
  }

  static invalidFormat(field: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `${field} has invalid format. Expected: ${expectedFormat}`,
      'INVALID_FORMAT',
      field,
      { expectedFormat }
    );
  }

  static invalidValue(
    field: string,
    value: unknown,
    reason: string
  ): ValidationError {
    return new ValidationError(
      `${field} has invalid value: ${reason}`,
      'INVALID_VALUE',
      field,
      { value, reason }
    );
  }

  static outOfRange(field: string, min?: number, max?: number): ValidationError {
    const range = min !== undefined && max !== undefined
      ? `${min}-${max}`
      : min !== undefined
        ? `>= ${min}`
        : `<= ${max}`;

    return new ValidationError(
      `${field} is out of range. Expected: ${range}`,
      'OUT_OF_RANGE',
      field,
      { min, max }
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      field: this.field,
      context: this.context,
    };
  }
}

/**
 * Domain-specific error for business rule violations
 */
export class DomainError extends Error {
  public readonly code: string;
  public readonly context: Record<string, unknown>;

  constructor(
    message: string,
    code: string,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.context = context;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DomainError);
    }
  }

  static notFound(entity: string, id: string): DomainError {
    return new DomainError(
      `${entity} not found: ${id}`,
      'NOT_FOUND',
      { entity, id }
    );
  }

  static duplicate(entity: string, identifier: string): DomainError {
    return new DomainError(
      `${entity} already exists: ${identifier}`,
      'DUPLICATE',
      { entity, identifier }
    );
  }

  static invariantViolation(message: string): DomainError {
    return new DomainError(message, 'INVARIANT_VIOLATION');
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if an error is a DomainError
 */
export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}
