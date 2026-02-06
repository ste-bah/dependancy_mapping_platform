/**
 * Result Type for Domain Operations
 * @module services/rollup/external-object-index/domain/result
 *
 * Provides a discriminated union type for operations that can fail,
 * enabling explicit error handling without exceptions.
 *
 * TASK-ROLLUP-003: Domain layer implementation
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
 *
 * @example
 * ```typescript
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) {
 *     return Result.err('Division by zero');
 *   }
 *   return Result.ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (Result.isOk(result)) {
 *   console.log(result.value); // 5
 * }
 * ```
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
   * @param value - The success value
   * @returns A successful Result containing the value
   *
   * @example
   * ```typescript
   * const result = Result.ok(42);
   * // { success: true, value: 42 }
   * ```
   */
  ok<T>(value: T): Result<T, never> {
    return { success: true, value };
  },

  /**
   * Create a failed result
   * @param error - The error value
   * @returns A failed Result containing the error
   *
   * @example
   * ```typescript
   * const result = Result.err(new ValidationError('Invalid input'));
   * // { success: false, error: ValidationError }
   * ```
   */
  err<E>(error: E): Result<never, E> {
    return { success: false, error };
  },

  /**
   * Type guard to check if result is successful
   * @param result - The result to check
   * @returns True if the result is successful
   *
   * @example
   * ```typescript
   * if (Result.isOk(result)) {
   *   // TypeScript knows result.value exists here
   *   console.log(result.value);
   * }
   * ```
   */
  isOk<T, E>(result: Result<T, E>): result is { readonly success: true; readonly value: T } {
    return result.success === true;
  },

  /**
   * Type guard to check if result is failed
   * @param result - The result to check
   * @returns True if the result is failed
   *
   * @example
   * ```typescript
   * if (Result.isErr(result)) {
   *   // TypeScript knows result.error exists here
   *   console.error(result.error);
   * }
   * ```
   */
  isErr<T, E>(result: Result<T, E>): result is { readonly success: false; readonly error: E } {
    return result.success === false;
  },

  /**
   * Transform the success value using a mapping function
   * @param result - The result to transform
   * @param fn - The mapping function
   * @returns A new Result with the transformed value
   *
   * @example
   * ```typescript
   * const result = Result.ok(5);
   * const doubled = Result.map(result, x => x * 2);
   * // { success: true, value: 10 }
   * ```
   */
  map<T, U, E>(result: Result<T, E>, fn: (t: T) => U): Result<U, E> {
    if (result.success) {
      return Result.ok(fn(result.value));
    }
    return result;
  },

  /**
   * Transform the error value using a mapping function
   * @param result - The result to transform
   * @param fn - The error mapping function
   * @returns A new Result with the transformed error
   *
   * @example
   * ```typescript
   * const result = Result.err('not found');
   * const detailed = Result.mapErr(result, e => new Error(e));
   * // { success: false, error: Error('not found') }
   * ```
   */
  mapErr<T, E, F>(result: Result<T, E>, fn: (e: E) => F): Result<T, F> {
    if (result.success) {
      return result;
    }
    return Result.err(fn(result.error));
  },

  /**
   * Chain operations that return Results (flatMap/bind)
   * @param result - The result to chain from
   * @param fn - The function returning a new Result
   * @returns The chained Result
   *
   * @example
   * ```typescript
   * const parseNumber = (s: string): Result<number, string> =>
   *   isNaN(Number(s)) ? Result.err('not a number') : Result.ok(Number(s));
   *
   * const result = Result.flatMap(
   *   Result.ok('42'),
   *   parseNumber
   * );
   * // { success: true, value: 42 }
   * ```
   */
  flatMap<T, U, E>(result: Result<T, E>, fn: (t: T) => Result<U, E>): Result<U, E> {
    if (result.success) {
      return fn(result.value);
    }
    return result;
  },

  /**
   * Unwrap a successful result or throw the error
   * @param result - The result to unwrap
   * @returns The success value
   * @throws The error if the result is failed
   *
   * @example
   * ```typescript
   * const value = Result.unwrap(Result.ok(42)); // 42
   * Result.unwrap(Result.err(new Error('failed'))); // throws Error
   * ```
   */
  unwrap<T, E>(result: Result<T, E>): T {
    if (result.success) {
      return result.value;
    }
    throw result.error;
  },

  /**
   * Unwrap a successful result or return a default value
   * @param result - The result to unwrap
   * @param defaultValue - The default value if failed
   * @returns The success value or the default
   *
   * @example
   * ```typescript
   * const value = Result.unwrapOr(Result.err('error'), 0); // 0
   * ```
   */
  unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
    if (result.success) {
      return result.value;
    }
    return defaultValue;
  },

  /**
   * Unwrap a successful result or compute a default from the error
   * @param result - The result to unwrap
   * @param fn - Function to compute default from error
   * @returns The success value or the computed default
   *
   * @example
   * ```typescript
   * const value = Result.unwrapOrElse(
   *   Result.err('not found'),
   *   e => `default: ${e}`
   * );
   * // 'default: not found'
   * ```
   */
  unwrapOrElse<T, E>(result: Result<T, E>, fn: (e: E) => T): T {
    if (result.success) {
      return result.value;
    }
    return fn(result.error);
  },

  /**
   * Combine multiple Results into a single Result of an array
   * @param results - Array of Results to combine
   * @returns Result containing array of values or first error
   *
   * @example
   * ```typescript
   * const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
   * const combined = Result.all(results);
   * // { success: true, value: [1, 2, 3] }
   * ```
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

  /**
   * Create a Result from a nullable value
   * @param value - The potentially null/undefined value
   * @param error - Error to use if value is null/undefined
   * @returns Result containing the value or error
   *
   * @example
   * ```typescript
   * const result = Result.fromNullable(maybeValue, 'Value not found');
   * ```
   */
  fromNullable<T, E>(value: T | null | undefined, error: E): Result<T, E> {
    if (value === null || value === undefined) {
      return Result.err(error);
    }
    return Result.ok(value);
  },

  /**
   * Create a Result from a function that may throw
   * @param fn - Function that may throw
   * @returns Result containing the return value or caught error
   *
   * @example
   * ```typescript
   * const result = Result.fromTry(() => JSON.parse(input));
   * ```
   */
  fromTry<T>(fn: () => T): Result<T, Error> {
    try {
      return Result.ok(fn());
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  },

  /**
   * Create a Result from an async function that may throw
   * @param fn - Async function that may throw
   * @returns Promise of Result
   *
   * @example
   * ```typescript
   * const result = await Result.fromTryAsync(async () => fetch(url));
   * ```
   */
  async fromTryAsync<T>(fn: () => Promise<T>): Promise<Result<T, Error>> {
    try {
      return Result.ok(await fn());
    } catch (error) {
      return Result.err(error instanceof Error ? error : new Error(String(error)));
    }
  },

  /**
   * Execute side effect on success without changing the Result
   * @param result - The result
   * @param fn - Side effect function
   * @returns The original result unchanged
   *
   * @example
   * ```typescript
   * Result.tap(result, value => console.log('Got:', value));
   * ```
   */
  tap<T, E>(result: Result<T, E>, fn: (t: T) => void): Result<T, E> {
    if (result.success) {
      fn(result.value);
    }
    return result;
  },

  /**
   * Execute side effect on error without changing the Result
   * @param result - The result
   * @param fn - Side effect function
   * @returns The original result unchanged
   */
  tapErr<T, E>(result: Result<T, E>, fn: (e: E) => void): Result<T, E> {
    if (!result.success) {
      fn(result.error);
    }
    return result;
  },

  /**
   * Match on the Result and execute appropriate handler
   * @param result - The result to match on
   * @param handlers - Object with ok and err handlers
   * @returns The result of the matching handler
   *
   * @example
   * ```typescript
   * const message = Result.match(result, {
   *   ok: value => `Success: ${value}`,
   *   err: error => `Error: ${error}`,
   * });
   * ```
   */
  match<T, E, U>(
    result: Result<T, E>,
    handlers: {
      ok: (value: T) => U;
      err: (error: E) => U;
    }
  ): U {
    if (result.success) {
      return handlers.ok(result.value);
    }
    return handlers.err(result.error);
  },
} as const;

// ============================================================================
// Type Aliases for Common Patterns
// ============================================================================

/**
 * Result with string error messages
 */
export type StringResult<T> = Result<T, string>;

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
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * Field that failed validation (if applicable)
   */
  public readonly field?: string;

  /**
   * Additional context about the error
   */
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

    // Maintain proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ValidationError);
    }
  }

  /**
   * Create a required field error
   */
  static required(field: string): ValidationError {
    return new ValidationError(
      `${field} is required`,
      'REQUIRED_FIELD',
      field
    );
  }

  /**
   * Create an invalid format error
   */
  static invalidFormat(field: string, expectedFormat: string): ValidationError {
    return new ValidationError(
      `${field} has invalid format. Expected: ${expectedFormat}`,
      'INVALID_FORMAT',
      field,
      { expectedFormat }
    );
  }

  /**
   * Create an out of range error
   */
  static outOfRange(
    field: string,
    min?: number,
    max?: number
  ): ValidationError {
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

  /**
   * Create an invalid value error
   */
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

  /**
   * Convert to JSON-serializable object
   */
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
  /**
   * Error code for programmatic handling
   */
  public readonly code: string;

  /**
   * Additional context about the error
   */
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

  /**
   * Create a not found error
   */
  static notFound(entity: string, id: string): DomainError {
    return new DomainError(
      `${entity} not found: ${id}`,
      'NOT_FOUND',
      { entity, id }
    );
  }

  /**
   * Create a duplicate error
   */
  static duplicate(entity: string, identifier: string): DomainError {
    return new DomainError(
      `${entity} already exists: ${identifier}`,
      'DUPLICATE',
      { entity, identifier }
    );
  }

  /**
   * Create an invariant violation error
   */
  static invariantViolation(message: string): DomainError {
    return new DomainError(message, 'INVARIANT_VIOLATION');
  }

  /**
   * Convert to JSON-serializable object
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

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
