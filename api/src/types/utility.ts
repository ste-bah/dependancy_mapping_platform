/**
 * Utility Type Definitions
 * @module types/utility
 *
 * Reusable utility types for the codebase. Provides generic type helpers,
 * branded types, result types, and conditional types.
 */

// ============================================================================
// Branded Types
// ============================================================================

/**
 * Brand a primitive type for type safety.
 * Creates a nominal type that cannot be accidentally mixed with other types.
 *
 * @example
 * type UserId = Brand<string, 'UserId'>;
 * type OrderId = Brand<string, 'OrderId'>;
 *
 * const userId: UserId = 'user-123' as UserId;
 * const orderId: OrderId = 'order-456' as OrderId;
 * // userId = orderId; // Error: Type 'OrderId' is not assignable to type 'UserId'
 */
export type Brand<T, B extends string> = T & { readonly __brand: B };

/**
 * Create a branded type factory
 *
 * @example
 * const createUserId = makeBrandedFactory<string, 'UserId'>();
 * const userId = createUserId('user-123');
 */
export function makeBrandedFactory<T, B extends string>(): (value: T) => Brand<T, B> {
  return (value: T) => value as Brand<T, B>;
}

// ============================================================================
// Deep Utility Types
// ============================================================================

/**
 * Make all properties deeply readonly
 *
 * @example
 * interface User { name: string; address: { city: string } }
 * type ReadonlyUser = DeepReadonly<User>;
 * // { readonly name: string; readonly address: { readonly city: string } }
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object
    ? T[P] extends Function
      ? T[P]
      : T[P] extends Array<infer U>
        ? ReadonlyArray<DeepReadonly<U>>
        : DeepReadonly<T[P]>
    : T[P];
};

/**
 * Make all properties deeply partial
 *
 * @example
 * interface Config { db: { host: string; port: number } }
 * type PartialConfig = DeepPartial<Config>;
 * // { db?: { host?: string; port?: number } }
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepPartial<U>>
      : DeepPartial<T[P]>
    : T[P];
};

/**
 * Make all properties deeply required
 *
 * @example
 * interface Config { db?: { host?: string } }
 * type RequiredConfig = DeepRequired<Config>;
 * // { db: { host: string } }
 */
export type DeepRequired<T> = {
  [P in keyof T]-?: T[P] extends object
    ? T[P] extends Array<infer U>
      ? Array<DeepRequired<U>>
      : DeepRequired<T[P]>
    : T[P];
};

/**
 * Make all properties deeply nullable
 *
 * @example
 * interface User { name: string; address: { city: string } }
 * type NullableUser = DeepNullable<User>;
 */
export type DeepNullable<T> = {
  [P in keyof T]: T[P] extends object
    ? DeepNullable<T[P]> | null
    : T[P] | null;
};

// ============================================================================
// Key Manipulation Types
// ============================================================================

/**
 * Make specific properties required
 *
 * @example
 * interface User { name?: string; email?: string }
 * type UserWithEmail = RequireKeys<User, 'email'>;
 * // { name?: string; email: string }
 */
export type RequireKeys<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 *
 * @example
 * interface User { name: string; email: string }
 * type UserWithOptionalEmail = OptionalKeys<User, 'email'>;
 * // { name: string; email?: string }
 */
export type OptionalKeys<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract keys of a certain type
 *
 * @example
 * interface User { name: string; age: number; active: boolean }
 * type StringKeys = KeysOfType<User, string>; // 'name'
 */
export type KeysOfType<T, V> = {
  [K in keyof T]: T[K] extends V ? K : never;
}[keyof T];

/**
 * Omit keys of a certain type
 *
 * @example
 * interface User { name: string; age: number }
 * type WithoutNumbers = OmitByType<User, number>; // { name: string }
 */
export type OmitByType<T, V> = {
  [K in keyof T as T[K] extends V ? never : K]: T[K];
};

/**
 * Pick keys of a certain type
 *
 * @example
 * interface User { name: string; age: number }
 * type OnlyStrings = PickByType<User, string>; // { name: string }
 */
export type PickByType<T, V> = {
  [K in keyof T as T[K] extends V ? K : never]: T[K];
};

// ============================================================================
// Result Types
// ============================================================================

/**
 * Result type for operations that can fail
 *
 * @example
 * function divide(a: number, b: number): Result<number, string> {
 *   if (b === 0) return { success: false, error: 'Division by zero' };
 *   return { success: true, value: a / b };
 * }
 */
export type Result<T, E = Error> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: E };

/**
 * Async result type
 */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>;

/**
 * Extract the success value type from a Result
 */
export type ResultValue<R> = R extends Result<infer T, unknown> ? T : never;

/**
 * Extract the error type from a Result
 */
export type ResultError<R> = R extends Result<unknown, infer E> ? E : never;

/**
 * Create a success result
 */
export function success<T>(value: T): Result<T, never> {
  return { success: true, value };
}

/**
 * Create a failure result
 */
export function failure<E>(error: E): Result<never, E> {
  return { success: false, error };
}

/**
 * Check if result is success
 */
export function isSuccess<T, E>(result: Result<T, E>): result is { success: true; value: T } {
  return result.success === true;
}

/**
 * Check if result is failure
 */
export function isFailure<T, E>(result: Result<T, E>): result is { success: false; error: E } {
  return result.success === false;
}

/**
 * Unwrap a result or throw
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.success) return result.value;
  throw result.error;
}

/**
 * Unwrap a result with default value
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (result.success) return result.value;
  return defaultValue;
}

// ============================================================================
// Nullable Types
// ============================================================================

/**
 * Make all properties nullable
 */
export type Nullable<T> = {
  [P in keyof T]: T[P] | null;
};

/**
 * Remove null and undefined from type
 */
export type NonNullableDeep<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Make type nullable
 */
export type Maybe<T> = T | null | undefined;

// ============================================================================
// Array Types
// ============================================================================

/**
 * NonEmptyArray type
 *
 * @example
 * function first<T>(arr: NonEmptyArray<T>): T {
 *   return arr[0]; // No undefined possible
 * }
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Get first element type of tuple
 */
export type First<T extends unknown[]> = T extends [infer F, ...unknown[]] ? F : never;

/**
 * Get last element type of tuple
 */
export type Last<T extends unknown[]> = T extends [...unknown[], infer L] ? L : never;

/**
 * Get all but first element types
 */
export type Tail<T extends unknown[]> = T extends [unknown, ...infer R] ? R : never;

/**
 * Get array element type
 */
export type ArrayElement<T> = T extends readonly (infer E)[] ? E : never;

/**
 * Type guard for non-empty array
 */
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

// ============================================================================
// Function Types
// ============================================================================

/**
 * Async function type
 */
export type AsyncFunction<TArgs extends unknown[], TReturn> = (
  ...args: TArgs
) => Promise<TReturn>;

/**
 * Sync function type
 */
export type SyncFunction<TArgs extends unknown[], TReturn> = (...args: TArgs) => TReturn;

/**
 * Any function type
 */
export type AnyFunction = (...args: unknown[]) => unknown;

/**
 * Constructor type
 */
export type Constructor<T = unknown, TArgs extends unknown[] = unknown[]> = new (
  ...args: TArgs
) => T;

/**
 * Get function parameters type
 */
export type ParamsOf<T extends AnyFunction> = T extends (...args: infer P) => unknown ? P : never;

/**
 * Get function return type (unwrap promise)
 */
export type AwaitedReturnType<T extends AnyFunction> = Awaited<ReturnType<T>>;

// ============================================================================
// Promise Types
// ============================================================================

/**
 * Promisify a type
 */
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>;

/**
 * Awaited type (unwrap promise)
 */
export type AwaitedType<T> = T extends Promise<infer U> ? U : T;

// ============================================================================
// JSON Types
// ============================================================================

/**
 * JSON primitive types
 */
export type JsonPrimitive = string | number | boolean | null;

/**
 * JSON array type
 */
export type JsonArray = JsonValue[];

/**
 * JSON object type
 */
export type JsonObject = { [key: string]: JsonValue };

/**
 * Any JSON value
 */
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

/**
 * JSON serializable (same as JsonValue but more descriptive)
 */
export type JsonSerializable = JsonValue;

// ============================================================================
// Path Types
// ============================================================================

/**
 * Get all paths in an object as dot-separated strings
 *
 * @example
 * interface User { name: string; address: { city: string } }
 * type UserPaths = Path<User>; // 'name' | 'address' | 'address.city'
 */
export type Path<T, Key extends keyof T = keyof T> = Key extends string
  ? T[Key] extends Record<string, unknown>
    ? `${Key}.${Path<T[Key]>}` | Key
    : Key
  : never;

/**
 * Get type at a path
 *
 * @example
 * interface User { address: { city: string } }
 * type CityType = PathValue<User, 'address.city'>; // string
 */
export type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? PathValue<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

// ============================================================================
// Conditional Types
// ============================================================================

/**
 * If-Then-Else type
 */
export type If<C extends boolean, T, F> = C extends true ? T : F;

/**
 * Check if two types are equal
 */
export type Equals<X, Y> = (<T>() => T extends X ? 1 : 2) extends <T>() => T extends Y ? 1 : 2
  ? true
  : false;

/**
 * Check if type is never
 */
export type IsNever<T> = [T] extends [never] ? true : false;

/**
 * Check if type is any
 */
export type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Check if type is unknown
 */
export type IsUnknown<T> = unknown extends T ? (T extends unknown ? true : false) : false;

// ============================================================================
// XOR and Exclusive Types
// ============================================================================

/**
 * Exclusive Or type - only one of T or U can have values
 *
 * @example
 * type Props = XOR<{ id: string }, { name: string }>;
 * // { id: string; name?: never } | { id?: never; name: string }
 */
export type XOR<T, U> = T | U extends object
  ? (T & { [K in Exclude<keyof U, keyof T>]?: never }) |
    (U & { [K in Exclude<keyof T, keyof U>]?: never })
  : T | U;

/**
 * At least one of the keys must be present
 *
 * @example
 * type Props = RequireAtLeastOne<{ a?: number; b?: string; c?: boolean }, 'a' | 'b'>;
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> & {
  [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
}[Keys];

/**
 * Exactly one of the keys must be present
 *
 * @example
 * type Props = RequireExactlyOne<{ a?: number; b?: string }, 'a' | 'b'>;
 */
export type RequireExactlyOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> & {
  [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, never>>;
}[Keys];

// ============================================================================
// Assertion Functions
// ============================================================================

/**
 * Assert a condition is true
 */
export function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Assert value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message = 'Value is not defined'
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
}

/**
 * Assert value is a string
 */
export function assertString(value: unknown, message = 'Value is not a string'): asserts value is string {
  if (typeof value !== 'string') {
    throw new Error(message);
  }
}

/**
 * Assert value is a number
 */
export function assertNumber(value: unknown, message = 'Value is not a number'): asserts value is number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new Error(message);
  }
}

/**
 * Exhaustive check for switch statements
 *
 * @example
 * type Status = 'active' | 'inactive';
 * function handle(status: Status) {
 *   switch (status) {
 *     case 'active': return 1;
 *     case 'inactive': return 2;
 *     default: return exhaustiveCheck(status);
 *   }
 * }
 */
export function exhaustiveCheck(value: never, message = 'Exhaustive check failed'): never {
  throw new Error(`${message}: ${JSON.stringify(value)}`);
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for checking if value is defined
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Type guard for string
 */
export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard for number
 */
export function isNumber(value: unknown): value is number {
  return typeof value === 'number' && !Number.isNaN(value);
}

/**
 * Type guard for boolean
 */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard for object (non-null, non-array)
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for array
 */
export function isArray<T>(
  value: unknown,
  itemGuard?: (item: unknown) => item is T
): value is T[] {
  if (!Array.isArray(value)) return false;
  if (itemGuard) return value.every(itemGuard);
  return true;
}

/**
 * Type guard for function
 */
export function isFunction(value: unknown): value is AnyFunction {
  return typeof value === 'function';
}

/**
 * Type guard for Date
 */
export function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * Type guard for Error
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}
