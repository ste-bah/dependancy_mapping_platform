/**
 * E2E Test Error Classes
 * @module e2e/errors/e2e-errors
 *
 * E2E-specific error classes for end-to-end testing infrastructure:
 * - E2ETestError - Base class for all E2E errors
 * - FixtureError - Fixture loading and resolution failures
 * - TimeoutError - Test timeouts with phase context
 * - AssertionError - Assertion failures with diff support
 * - SetupError - Environment and test setup failures
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #26 of 47 | Phase 4: Implementation
 */

import type { TestPhase, TestCaseId, TestSuiteId, FixtureId } from '../types/test-types.js';

// ============================================================================
// Error Context Types
// ============================================================================

/**
 * Base error context for E2E errors
 */
export interface E2EErrorContext {
  /** Timestamp when error occurred */
  readonly timestamp: Date;
  /** Test phase where error occurred */
  readonly phase?: TestPhase;
  /** Test suite ID if applicable */
  readonly suiteId?: TestSuiteId;
  /** Test case ID if applicable */
  readonly caseId?: TestCaseId;
  /** Additional contextual details */
  readonly details?: Record<string, unknown>;
  /** Original error that caused this error */
  readonly cause?: Error;
}

/**
 * Serialized E2E error for reporting
 */
export interface SerializedE2EError {
  readonly name: string;
  readonly code: E2EErrorCode;
  readonly message: string;
  readonly timestamp: string;
  readonly phase?: TestPhase;
  readonly suiteId?: string;
  readonly caseId?: string;
  readonly stack?: string;
  readonly details?: Record<string, unknown>;
  readonly recoverable: boolean;
}

// ============================================================================
// Error Codes
// ============================================================================

/**
 * E2E Error code categories
 */
export const E2EErrorCodes = {
  // Test Execution Errors
  TEST_ERROR: 'E2E_TEST_ERROR',
  TEST_TIMEOUT: 'E2E_TEST_TIMEOUT',
  TEST_CANCELLED: 'E2E_TEST_CANCELLED',
  TEST_SKIPPED: 'E2E_TEST_SKIPPED',

  // Fixture Errors
  FIXTURE_NOT_FOUND: 'E2E_FIXTURE_NOT_FOUND',
  FIXTURE_LOAD_ERROR: 'E2E_FIXTURE_LOAD_ERROR',
  FIXTURE_VALIDATION_ERROR: 'E2E_FIXTURE_VALIDATION_ERROR',
  FIXTURE_DEPENDENCY_ERROR: 'E2E_FIXTURE_DEPENDENCY_ERROR',
  FIXTURE_CLEANUP_ERROR: 'E2E_FIXTURE_CLEANUP_ERROR',

  // Assertion Errors
  ASSERTION_ERROR: 'E2E_ASSERTION_ERROR',
  ASSERTION_TIMEOUT: 'E2E_ASSERTION_TIMEOUT',
  EXPECT_ELEMENT_ERROR: 'E2E_EXPECT_ELEMENT_ERROR',
  EXPECT_API_ERROR: 'E2E_EXPECT_API_ERROR',
  EXPECT_DATABASE_ERROR: 'E2E_EXPECT_DATABASE_ERROR',

  // Setup Errors
  SETUP_ERROR: 'E2E_SETUP_ERROR',
  SETUP_TIMEOUT: 'E2E_SETUP_TIMEOUT',
  DATABASE_SETUP_ERROR: 'E2E_DATABASE_SETUP_ERROR',
  MOCK_SETUP_ERROR: 'E2E_MOCK_SETUP_ERROR',
  BROWSER_SETUP_ERROR: 'E2E_BROWSER_SETUP_ERROR',
  CONFIG_ERROR: 'E2E_CONFIG_ERROR',

  // Teardown Errors
  TEARDOWN_ERROR: 'E2E_TEARDOWN_ERROR',
  CLEANUP_ERROR: 'E2E_CLEANUP_ERROR',

  // Environment Errors
  ENVIRONMENT_ERROR: 'E2E_ENVIRONMENT_ERROR',
  DEPENDENCY_MISSING: 'E2E_DEPENDENCY_MISSING',
  SERVICE_UNAVAILABLE: 'E2E_SERVICE_UNAVAILABLE',

  // Network/API Errors
  API_ERROR: 'E2E_API_ERROR',
  NETWORK_ERROR: 'E2E_NETWORK_ERROR',
  REQUEST_TIMEOUT: 'E2E_REQUEST_TIMEOUT',

  // Retry Errors
  MAX_RETRIES_EXCEEDED: 'E2E_MAX_RETRIES_EXCEEDED',
  FLAKY_TEST: 'E2E_FLAKY_TEST',
} as const;

export type E2EErrorCode = typeof E2EErrorCodes[keyof typeof E2EErrorCodes];

// ============================================================================
// Base E2E Error Class
// ============================================================================

/**
 * Base error class for all E2E test errors
 *
 * @example
 * ```typescript
 * throw new E2ETestError(
 *   'Test execution failed',
 *   E2EErrorCodes.TEST_ERROR,
 *   { phase: 'test', caseId: 'case_001' }
 * );
 * ```
 */
export class E2ETestError extends Error {
  /** Error code for programmatic handling */
  public readonly code: E2EErrorCode;
  /** Timestamp when the error occurred */
  public readonly timestamp: Date;
  /** Test phase where error occurred */
  public readonly phase?: TestPhase;
  /** Test suite ID if applicable */
  public readonly suiteId?: TestSuiteId;
  /** Test case ID if applicable */
  public readonly caseId?: TestCaseId;
  /** Additional contextual details */
  public readonly details?: Record<string, unknown>;
  /** Whether this error is recoverable */
  public readonly recoverable: boolean;

  constructor(
    message: string,
    code: E2EErrorCode = E2EErrorCodes.TEST_ERROR,
    context: Partial<E2EErrorContext> = {},
    recoverable = false
  ) {
    super(message);
    this.name = 'E2ETestError';
    this.code = code;
    this.timestamp = context.timestamp ?? new Date();
    this.phase = context.phase;
    this.suiteId = context.suiteId;
    this.caseId = context.caseId;
    this.details = context.details;
    this.recoverable = recoverable;

    // Capture stack trace
    Error.captureStackTrace(this, this.constructor);

    // Set cause if provided
    if (context.cause) {
      this.cause = context.cause;
    }
  }

  /**
   * Serialize error to JSON-safe object
   */
  toJSON(): SerializedE2EError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      phase: this.phase,
      suiteId: this.suiteId,
      caseId: this.caseId,
      details: this.details,
      recoverable: this.recoverable,
    };
  }

  /**
   * Serialize with stack trace (for debugging)
   */
  toDebugJSON(): SerializedE2EError {
    return {
      ...this.toJSON(),
      stack: this.stack,
    };
  }

  /**
   * String representation
   */
  toString(): string {
    const context = this.caseId
      ? ` [${this.caseId}]`
      : this.suiteId
        ? ` [${this.suiteId}]`
        : '';
    const phase = this.phase ? ` (${this.phase})` : '';
    return `${this.name} [${this.code}]${context}${phase}: ${this.message}`;
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
   * Create a new error with additional context
   */
  withContext(additionalContext: Partial<E2EErrorContext>): E2ETestError {
    return new E2ETestError(
      this.message,
      this.code,
      {
        timestamp: this.timestamp,
        phase: additionalContext.phase ?? this.phase,
        suiteId: additionalContext.suiteId ?? this.suiteId,
        caseId: additionalContext.caseId ?? this.caseId,
        details: { ...this.details, ...additionalContext.details },
        cause: additionalContext.cause ?? (this.cause as Error | undefined),
      },
      this.recoverable
    );
  }
}

// ============================================================================
// Fixture Errors
// ============================================================================

/**
 * Error thrown when fixture operations fail
 */
export class FixtureError extends E2ETestError {
  /** ID of the fixture that failed */
  public readonly fixtureId: FixtureId;
  /** Type of fixture operation that failed */
  public readonly operation: 'load' | 'validate' | 'resolve' | 'cleanup';

  constructor(
    message: string,
    fixtureId: FixtureId,
    operation: 'load' | 'validate' | 'resolve' | 'cleanup',
    code: E2EErrorCode = E2EErrorCodes.FIXTURE_LOAD_ERROR,
    context: Partial<E2EErrorContext> = {}
  ) {
    super(message, code, context, operation === 'cleanup');
    this.name = 'FixtureError';
    this.fixtureId = fixtureId;
    this.operation = operation;
  }

  /**
   * Create a "not found" fixture error
   */
  static notFound(fixtureId: FixtureId, context?: Partial<E2EErrorContext>): FixtureError {
    return new FixtureError(
      `Fixture '${fixtureId}' not found`,
      fixtureId,
      'load',
      E2EErrorCodes.FIXTURE_NOT_FOUND,
      context
    );
  }

  /**
   * Create a "load failed" fixture error
   */
  static loadFailed(
    fixtureId: FixtureId,
    reason: string,
    cause?: Error,
    context?: Partial<E2EErrorContext>
  ): FixtureError {
    return new FixtureError(
      `Failed to load fixture '${fixtureId}': ${reason}`,
      fixtureId,
      'load',
      E2EErrorCodes.FIXTURE_LOAD_ERROR,
      { ...context, cause }
    );
  }

  /**
   * Create a validation error
   */
  static validationFailed(
    fixtureId: FixtureId,
    validationErrors: string[],
    context?: Partial<E2EErrorContext>
  ): FixtureError {
    return new FixtureError(
      `Fixture '${fixtureId}' validation failed: ${validationErrors.join(', ')}`,
      fixtureId,
      'validate',
      E2EErrorCodes.FIXTURE_VALIDATION_ERROR,
      { ...context, details: { validationErrors } }
    );
  }

  /**
   * Create a dependency resolution error
   */
  static dependencyFailed(
    fixtureId: FixtureId,
    missingDependency: FixtureId,
    context?: Partial<E2EErrorContext>
  ): FixtureError {
    return new FixtureError(
      `Fixture '${fixtureId}' depends on missing fixture '${missingDependency}'`,
      fixtureId,
      'resolve',
      E2EErrorCodes.FIXTURE_DEPENDENCY_ERROR,
      { ...context, details: { missingDependency } }
    );
  }

  /**
   * Create a cleanup error
   */
  static cleanupFailed(
    fixtureId: FixtureId,
    reason: string,
    cause?: Error,
    context?: Partial<E2EErrorContext>
  ): FixtureError {
    return new FixtureError(
      `Failed to cleanup fixture '${fixtureId}': ${reason}`,
      fixtureId,
      'cleanup',
      E2EErrorCodes.FIXTURE_CLEANUP_ERROR,
      { ...context, cause }
    );
  }

  toJSON(): SerializedE2EError & { fixtureId: string; operation: string } {
    return {
      ...super.toJSON(),
      fixtureId: this.fixtureId,
      operation: this.operation,
    };
  }
}

// ============================================================================
// Timeout Errors
// ============================================================================

/**
 * Error thrown when a test operation times out
 */
export class TimeoutError extends E2ETestError {
  /** Duration that was exceeded (in ms) */
  public readonly timeoutMs: number;
  /** Operation that timed out */
  public readonly operation: string;
  /** Elapsed time before timeout (in ms) */
  public readonly elapsedMs?: number;

  constructor(
    message: string,
    timeoutMs: number,
    operation: string,
    context: Partial<E2EErrorContext> = {},
    elapsedMs?: number
  ) {
    super(message, E2EErrorCodes.TEST_TIMEOUT, context, false);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
    this.operation = operation;
    this.elapsedMs = elapsedMs;
  }

  /**
   * Create a test case timeout error
   */
  static testCase(
    testName: string,
    timeoutMs: number,
    context?: Partial<E2EErrorContext>
  ): TimeoutError {
    return new TimeoutError(
      `Test case '${testName}' timed out after ${timeoutMs}ms`,
      timeoutMs,
      'test_case',
      { ...context, phase: 'test' }
    );
  }

  /**
   * Create a setup timeout error
   */
  static setup(timeoutMs: number, context?: Partial<E2EErrorContext>): TimeoutError {
    return new TimeoutError(
      `Test setup timed out after ${timeoutMs}ms`,
      timeoutMs,
      'setup',
      { ...context, phase: 'setup' }
    );
  }

  /**
   * Create a teardown timeout error
   */
  static teardown(timeoutMs: number, context?: Partial<E2EErrorContext>): TimeoutError {
    return new TimeoutError(
      `Test teardown timed out after ${timeoutMs}ms`,
      timeoutMs,
      'teardown',
      { ...context, phase: 'teardown' }
    );
  }

  /**
   * Create a network request timeout error
   */
  static networkRequest(
    url: string,
    timeoutMs: number,
    context?: Partial<E2EErrorContext>
  ): TimeoutError {
    return new TimeoutError(
      `Network request to '${url}' timed out after ${timeoutMs}ms`,
      timeoutMs,
      'network_request',
      { ...context, details: { url } }
    );
  }

  /**
   * Create an assertion wait timeout error
   */
  static assertionWait(
    assertion: string,
    timeoutMs: number,
    context?: Partial<E2EErrorContext>
  ): TimeoutError {
    return new TimeoutError(
      `Assertion '${assertion}' failed to pass within ${timeoutMs}ms`,
      timeoutMs,
      'assertion_wait',
      { ...context, details: { assertion } }
    );
  }

  toJSON(): SerializedE2EError & { timeoutMs: number; operation: string; elapsedMs?: number } {
    return {
      ...super.toJSON(),
      timeoutMs: this.timeoutMs,
      operation: this.operation,
      elapsedMs: this.elapsedMs,
    };
  }
}

// ============================================================================
// Assertion Errors
// ============================================================================

/**
 * Diff information for assertion failures
 */
export interface AssertionDiff {
  readonly expected: unknown;
  readonly actual: unknown;
  readonly diffString?: string;
}

/**
 * Error thrown when a test assertion fails
 */
export class AssertionError extends E2ETestError {
  /** Name of the assertion/matcher that failed */
  public readonly assertionName: string;
  /** Expected value */
  public readonly expected?: unknown;
  /** Actual value */
  public readonly actual?: unknown;
  /** Formatted diff string */
  public readonly diffString?: string;
  /** Location in test file */
  public readonly location?: {
    readonly file: string;
    readonly line: number;
    readonly column?: number;
  };

  constructor(
    message: string,
    assertionName: string,
    diff?: AssertionDiff,
    context: Partial<E2EErrorContext> = {}
  ) {
    super(message, E2EErrorCodes.ASSERTION_ERROR, context, false);
    this.name = 'AssertionError';
    this.assertionName = assertionName;
    this.expected = diff?.expected;
    this.actual = diff?.actual;
    this.diffString = diff?.diffString;
  }

  /**
   * Create an equality assertion error
   */
  static notEqual(
    expected: unknown,
    actual: unknown,
    context?: Partial<E2EErrorContext>
  ): AssertionError {
    const diff = formatDiff(expected, actual);
    return new AssertionError(
      `Expected values to be equal:\n${diff}`,
      'toEqual',
      { expected, actual, diffString: diff },
      context
    );
  }

  /**
   * Create a "to be truthy" assertion error
   */
  static notTruthy(actual: unknown, context?: Partial<E2EErrorContext>): AssertionError {
    return new AssertionError(
      `Expected value to be truthy, but got: ${formatValue(actual)}`,
      'toBeTruthy',
      { expected: true, actual },
      context
    );
  }

  /**
   * Create a "to contain" assertion error
   */
  static notContaining(
    container: unknown,
    item: unknown,
    context?: Partial<E2EErrorContext>
  ): AssertionError {
    return new AssertionError(
      `Expected ${formatValue(container)} to contain ${formatValue(item)}`,
      'toContain',
      { expected: item, actual: container },
      context
    );
  }

  /**
   * Create an "element found" assertion error
   */
  static elementNotFound(
    selector: string,
    context?: Partial<E2EErrorContext>
  ): AssertionError {
    return new AssertionError(
      `Element with selector '${selector}' not found`,
      'toBeVisible',
      { expected: 'element present', actual: 'element not found' },
      { ...context, details: { selector } }
    );
  }

  /**
   * Create an API response assertion error
   */
  static unexpectedApiResponse(
    endpoint: string,
    expectedStatus: number,
    actualStatus: number,
    body?: unknown,
    context?: Partial<E2EErrorContext>
  ): AssertionError {
    return new AssertionError(
      `API ${endpoint} returned status ${actualStatus}, expected ${expectedStatus}`,
      'toHaveStatus',
      {
        expected: { status: expectedStatus },
        actual: { status: actualStatus, body },
      },
      { ...context, details: { endpoint, body } }
    );
  }

  /**
   * Create a database assertion error
   */
  static databaseMismatch(
    query: string,
    expected: unknown,
    actual: unknown,
    context?: Partial<E2EErrorContext>
  ): AssertionError {
    return new AssertionError(
      `Database query result mismatch`,
      'toMatchDatabaseResult',
      { expected, actual },
      { ...context, details: { query } }
    );
  }

  /**
   * Set the source location
   */
  withLocation(file: string, line: number, column?: number): AssertionError {
    const error = new AssertionError(
      this.message,
      this.assertionName,
      { expected: this.expected, actual: this.actual, diffString: this.diffString },
      {
        timestamp: this.timestamp,
        phase: this.phase,
        suiteId: this.suiteId,
        caseId: this.caseId,
        details: this.details,
        cause: this.cause as Error | undefined,
      }
    );
    (error as { location: typeof error.location }).location = { file, line, column };
    return error;
  }

  toJSON(): SerializedE2EError & {
    assertionName: string;
    expected?: unknown;
    actual?: unknown;
    diffString?: string;
  } {
    return {
      ...super.toJSON(),
      assertionName: this.assertionName,
      expected: this.expected,
      actual: this.actual,
      diffString: this.diffString,
    };
  }
}

// ============================================================================
// Setup Errors
// ============================================================================

/**
 * Error thrown when test setup fails
 */
export class SetupError extends E2ETestError {
  /** Type of setup that failed */
  public readonly setupType: 'database' | 'mock' | 'browser' | 'config' | 'general';
  /** Setup step that failed */
  public readonly step?: string;

  constructor(
    message: string,
    setupType: 'database' | 'mock' | 'browser' | 'config' | 'general',
    step?: string,
    code: E2EErrorCode = E2EErrorCodes.SETUP_ERROR,
    context: Partial<E2EErrorContext> = {}
  ) {
    super(message, code, { ...context, phase: 'setup' }, false);
    this.name = 'SetupError';
    this.setupType = setupType;
    this.step = step;
  }

  /**
   * Create a database setup error
   */
  static database(
    message: string,
    step?: string,
    cause?: Error,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      message,
      'database',
      step,
      E2EErrorCodes.DATABASE_SETUP_ERROR,
      { ...context, cause }
    );
  }

  /**
   * Create a mock setup error
   */
  static mock(
    message: string,
    step?: string,
    cause?: Error,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      message,
      'mock',
      step,
      E2EErrorCodes.MOCK_SETUP_ERROR,
      { ...context, cause }
    );
  }

  /**
   * Create a browser setup error
   */
  static browser(
    message: string,
    step?: string,
    cause?: Error,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      message,
      'browser',
      step,
      E2EErrorCodes.BROWSER_SETUP_ERROR,
      { ...context, cause }
    );
  }

  /**
   * Create a configuration error
   */
  static config(
    configKey: string,
    reason: string,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      `Invalid configuration '${configKey}': ${reason}`,
      'config',
      'configuration_validation',
      E2EErrorCodes.CONFIG_ERROR,
      { ...context, details: { configKey } }
    );
  }

  /**
   * Create a missing dependency error
   */
  static missingDependency(
    dependency: string,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      `Required dependency '${dependency}' is not available`,
      'general',
      'dependency_check',
      E2EErrorCodes.DEPENDENCY_MISSING,
      { ...context, details: { dependency } }
    );
  }

  /**
   * Create a service unavailable error
   */
  static serviceUnavailable(
    service: string,
    endpoint?: string,
    context?: Partial<E2EErrorContext>
  ): SetupError {
    return new SetupError(
      `Service '${service}' is not available${endpoint ? ` at ${endpoint}` : ''}`,
      'general',
      'service_check',
      E2EErrorCodes.SERVICE_UNAVAILABLE,
      { ...context, details: { service, endpoint } }
    );
  }

  toJSON(): SerializedE2EError & { setupType: string; step?: string } {
    return {
      ...super.toJSON(),
      setupType: this.setupType,
      step: this.step,
    };
  }
}

// ============================================================================
// Retry Errors
// ============================================================================

/**
 * Error thrown when max retries are exceeded
 */
export class RetryExhaustedError extends E2ETestError {
  /** Number of attempts made */
  public readonly attempts: number;
  /** Maximum attempts allowed */
  public readonly maxAttempts: number;
  /** Errors from each attempt */
  public readonly attemptErrors: Error[];

  constructor(
    attempts: number,
    maxAttempts: number,
    attemptErrors: Error[],
    context: Partial<E2EErrorContext> = {}
  ) {
    const lastError = attemptErrors[attemptErrors.length - 1];
    super(
      `Max retries (${maxAttempts}) exceeded. Last error: ${lastError?.message ?? 'Unknown'}`,
      E2EErrorCodes.MAX_RETRIES_EXCEEDED,
      { ...context, cause: lastError },
      false
    );
    this.name = 'RetryExhaustedError';
    this.attempts = attempts;
    this.maxAttempts = maxAttempts;
    this.attemptErrors = attemptErrors;
  }

  toJSON(): SerializedE2EError & {
    attempts: number;
    maxAttempts: number;
    attemptErrors: string[];
  } {
    return {
      ...super.toJSON(),
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      attemptErrors: this.attemptErrors.map((e) => e.message),
    };
  }
}

/**
 * Error indicating a test was identified as flaky
 */
export class FlakyTestError extends E2ETestError {
  /** Number of times test passed */
  public readonly passCount: number;
  /** Number of times test failed */
  public readonly failCount: number;
  /** Total attempts */
  public readonly totalAttempts: number;

  constructor(
    testName: string,
    passCount: number,
    failCount: number,
    context: Partial<E2EErrorContext> = {}
  ) {
    super(
      `Test '${testName}' is flaky: passed ${passCount}/${passCount + failCount} times`,
      E2EErrorCodes.FLAKY_TEST,
      context,
      true
    );
    this.name = 'FlakyTestError';
    this.passCount = passCount;
    this.failCount = failCount;
    this.totalAttempts = passCount + failCount;
  }

  toJSON(): SerializedE2EError & {
    passCount: number;
    failCount: number;
    totalAttempts: number;
  } {
    return {
      ...super.toJSON(),
      passCount: this.passCount,
      failCount: this.failCount,
      totalAttempts: this.totalAttempts,
    };
  }
}

// ============================================================================
// Network/API Errors
// ============================================================================

/**
 * Error thrown for API-related failures during tests
 */
export class ApiTestError extends E2ETestError {
  /** HTTP method */
  public readonly method: string;
  /** Request URL */
  public readonly url: string;
  /** Response status code */
  public readonly statusCode?: number;
  /** Response body */
  public readonly responseBody?: unknown;

  constructor(
    message: string,
    method: string,
    url: string,
    statusCode?: number,
    responseBody?: unknown,
    context: Partial<E2EErrorContext> = {}
  ) {
    super(message, E2EErrorCodes.API_ERROR, context, true);
    this.name = 'ApiTestError';
    this.method = method;
    this.url = url;
    this.statusCode = statusCode;
    this.responseBody = responseBody;
  }

  /**
   * Create an error for unexpected status
   */
  static unexpectedStatus(
    method: string,
    url: string,
    expected: number,
    actual: number,
    body?: unknown,
    context?: Partial<E2EErrorContext>
  ): ApiTestError {
    return new ApiTestError(
      `${method} ${url} returned ${actual}, expected ${expected}`,
      method,
      url,
      actual,
      body,
      context
    );
  }

  /**
   * Create an error for network failure
   */
  static networkFailure(
    method: string,
    url: string,
    cause: Error,
    context?: Partial<E2EErrorContext>
  ): ApiTestError {
    return new ApiTestError(
      `${method} ${url} failed: ${cause.message}`,
      method,
      url,
      undefined,
      undefined,
      { ...context, cause }
    );
  }

  toJSON(): SerializedE2EError & {
    method: string;
    url: string;
    statusCode?: number;
    responseBody?: unknown;
  } {
    return {
      ...super.toJSON(),
      method: this.method,
      url: this.url,
      statusCode: this.statusCode,
      responseBody: this.responseBody,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if error is an E2E test error
 */
export function isE2ETestError(error: unknown): error is E2ETestError {
  return error instanceof E2ETestError;
}

/**
 * Check if error is a fixture error
 */
export function isFixtureError(error: unknown): error is FixtureError {
  return error instanceof FixtureError;
}

/**
 * Check if error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Check if error is an assertion error
 */
export function isAssertionError(error: unknown): error is AssertionError {
  return error instanceof AssertionError;
}

/**
 * Check if error is a setup error
 */
export function isSetupError(error: unknown): error is SetupError {
  return error instanceof SetupError;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: unknown): boolean {
  if (isE2ETestError(error)) {
    return error.recoverable;
  }
  return false;
}

/**
 * Check if error should trigger a retry
 */
export function isRetryableE2EError(error: unknown): boolean {
  if (!isE2ETestError(error)) {
    // Network-like errors from standard Error are retryable
    if (error instanceof Error) {
      const retryablePatterns = [
        'ECONNREFUSED',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
        'socket hang up',
        'network',
      ];
      return retryablePatterns.some((pattern) =>
        error.message.toLowerCase().includes(pattern.toLowerCase())
      );
    }
    return false;
  }

  // Retryable E2E error codes
  const retryableCodes = new Set<E2EErrorCode>([
    E2EErrorCodes.TEST_TIMEOUT,
    E2EErrorCodes.NETWORK_ERROR,
    E2EErrorCodes.REQUEST_TIMEOUT,
    E2EErrorCodes.API_ERROR,
    E2EErrorCodes.SERVICE_UNAVAILABLE,
    E2EErrorCodes.ASSERTION_TIMEOUT,
  ]);

  return retryableCodes.has(error.code);
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a value for display in error messages
 */
function formatValue(value: unknown): string {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Circular]';
    }
  }
  return String(value);
}

/**
 * Format a diff between expected and actual values
 */
function formatDiff(expected: unknown, actual: unknown): string {
  const expectedStr = formatValue(expected);
  const actualStr = formatValue(actual);

  return `Expected: ${expectedStr}\nReceived: ${actualStr}`;
}

/**
 * Wrap an unknown error as an E2ETestError
 */
export function wrapAsE2EError(
  error: unknown,
  code: E2EErrorCode = E2EErrorCodes.TEST_ERROR,
  context: Partial<E2EErrorContext> = {}
): E2ETestError {
  if (error instanceof E2ETestError) {
    return error.withContext(context);
  }

  if (error instanceof Error) {
    return new E2ETestError(error.message, code, { ...context, cause: error });
  }

  return new E2ETestError(String(error), code, context);
}
