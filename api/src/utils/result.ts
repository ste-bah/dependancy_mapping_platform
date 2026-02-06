/**
 * Result Type Pattern
 * @module utils/result
 *
 * Type-safe error handling without exceptions using the Ok/Err pattern.
 * Provides functional composition utilities for Result types.
 *
 * This complements the success/failure pattern in types/utility.ts with
 * a more functional programming-oriented approach using ok/err naming.
 *
 * TASK-DETECT: Final refactoring - Result type pattern
 *
 * @example
 * ```typescript
 * import { ok, err, Result, isOk, map, andThen } from './result';
 *
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return err('Division by zero');
 *   return ok(a / b);
 * }
 *
 * const result = divide(10, 2);
 * if (isOk(result)) {
 *   console.log(result.value); // 5
 * }
 * ```
 */

// ============================================================================
// Result Type Definition
// ============================================================================

/**
 * Ok variant - represents a successful result
 */
export interface Ok<T> {
  readonly ok: true;
  readonly value: T;
}

/**
 * Err variant - represents a failed result
 */
export interface Err<E> {
  readonly ok: false;
  readonly error: E;
}

/**
 * Result type - either Ok<T> or Err<E>
 */
export type Result<T, E = Error> = Ok<T> | Err<E>;

// ============================================================================
// Constructors
// ============================================================================

/**
 * Create a successful result
 */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

/**
 * Create a failed result
 */
export function err<E>(error: E): Err<E> {
  return { ok: false, error };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a result is Ok
 */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok === true;
}

/**
 * Check if a result is Err
 */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return result.ok === false;
}

// ============================================================================
// Unwrap Functions
// ============================================================================

/**
 * Unwrap the value from a Result, throwing if it's an error
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (isOk(result)) {
    return result.value;
  }
  throw result.error instanceof Error
    ? result.error
    : new Error(String(result.error));
}

/**
 * Unwrap with a default value if the result is an error
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return isOk(result) ? result.value : defaultValue;
}

/**
 * Unwrap with a function to compute default value from error
 */
export function unwrapOrElse<T, E>(
  result: Result<T, E>,
  fn: (error: E) => T
): T {
  return isOk(result) ? result.value : fn(result.error);
}

/**
 * Unwrap the error, throwing if it's Ok
 */
export function unwrapErr<T, E>(result: Result<T, E>): E {
  if (isErr(result)) {
    return result.error;
  }
  throw new Error('Called unwrapErr on Ok value');
}

/**
 * Expect the result to be Ok, with a custom error message
 */
export function expect<T, E>(result: Result<T, E>, message: string): T {
  if (isOk(result)) {
    return result.value;
  }
  throw new Error(`${message}: ${String(result.error)}`);
}

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Map over the Ok value
 */
export function map<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U
): Result<U, E> {
  return isOk(result) ? ok(fn(result.value)) : result;
}

/**
 * Map over the Err value
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F
): Result<T, F> {
  return isErr(result) ? err(fn(result.error)) : result;
}

/**
 * Map with a default value for errors
 */
export function mapOr<T, U, E>(
  result: Result<T, E>,
  defaultValue: U,
  fn: (value: T) => U
): U {
  return isOk(result) ? fn(result.value) : defaultValue;
}

/**
 * Map with a function to compute default from error
 */
export function mapOrElse<T, U, E>(
  result: Result<T, E>,
  errFn: (error: E) => U,
  okFn: (value: T) => U
): U {
  return isOk(result) ? okFn(result.value) : errFn(result.error);
}

// ============================================================================
// Chaining Functions
// ============================================================================

/**
 * Chain operations that return Results (flatMap)
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  return isOk(result) ? fn(result.value) : result;
}

/**
 * Provide an alternative if the result is an error
 */
export function orElse<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => Result<T, F>
): Result<T, F> {
  return isErr(result) ? fn(result.error) : result;
}

/**
 * Return the value if Ok, or the provided alternative
 */
export function or<T, E>(result: Result<T, E>, alternative: Result<T, E>): Result<T, E> {
  return isOk(result) ? result : alternative;
}

/**
 * Return the value if Ok, or compute alternative
 */
export function orElseGet<T, E>(
  result: Result<T, E>,
  fn: () => Result<T, E>
): Result<T, E> {
  return isOk(result) ? result : fn();
}

// ============================================================================
// Async Utilities
// ============================================================================

/**
 * Wrap an async function that might throw into a Result
 */
export async function tryCatch<T>(
  fn: () => Promise<T>
): Promise<Result<T, Error>> {
  try {
    return ok(await fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Wrap a sync function that might throw into a Result
 */
export function tryCatchSync<T>(fn: () => T): Result<T, Error> {
  try {
    return ok(fn());
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

/**
 * Map over an async Result
 */
export async function mapAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<U>
): Promise<Result<U, E>> {
  if (isErr(result)) {
    return result;
  }
  try {
    return ok(await fn(result.value));
  } catch (e) {
    return err(e as E);
  }
}

/**
 * Chain async operations
 */
export async function andThenAsync<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Promise<Result<U, E>>
): Promise<Result<U, E>> {
  return isOk(result) ? fn(result.value) : result;
}

// ============================================================================
// Collection Utilities
// ============================================================================

/**
 * Collect an array of Results into a Result of array
 * Returns the first error encountered, or all values
 */
export function collect<T, E>(results: Result<T, E>[]): Result<T[], E> {
  const values: T[] = [];

  for (const result of results) {
    if (isErr(result)) {
      return result;
    }
    values.push(result.value);
  }

  return ok(values);
}

/**
 * Partition results into successes and failures
 */
export function partition<T, E>(results: Result<T, E>[]): [T[], E[]] {
  const successes: T[] = [];
  const failures: E[] = [];

  for (const result of results) {
    if (isOk(result)) {
      successes.push(result.value);
    } else {
      failures.push(result.error);
    }
  }

  return [successes, failures];
}

/**
 * Filter and collect only successful results
 */
export function filterOk<T, E>(results: Result<T, E>[]): T[] {
  return results.filter(isOk).map((r) => r.value);
}

/**
 * Filter and collect only error results
 */
export function filterErr<T, E>(results: Result<T, E>[]): E[] {
  return results.filter(isErr).map((r) => r.error);
}

/**
 * Combine two Results
 */
export function combine<T1, T2, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>
): Result<[T1, T2], E> {
  if (isErr(r1)) return r1;
  if (isErr(r2)) return r2;
  return ok([r1.value, r2.value]);
}

/**
 * Combine three Results
 */
export function combine3<T1, T2, T3, E>(
  r1: Result<T1, E>,
  r2: Result<T2, E>,
  r3: Result<T3, E>
): Result<[T1, T2, T3], E> {
  if (isErr(r1)) return r1;
  if (isErr(r2)) return r2;
  if (isErr(r3)) return r3;
  return ok([r1.value, r2.value, r3.value]);
}

// ============================================================================
// Pattern Matching Helper
// ============================================================================

/**
 * Pattern match on a Result
 */
export function match<T, E, R>(
  result: Result<T, E>,
  handlers: {
    ok: (value: T) => R;
    err: (error: E) => R;
  }
): R {
  return isOk(result) ? handlers.ok(result.value) : handlers.err(result.error);
}
