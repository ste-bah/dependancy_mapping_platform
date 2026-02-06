/**
 * E2E Error Handling Module
 * @module e2e/errors
 *
 * Comprehensive error handling for E2E testing infrastructure.
 * Exports error classes, handlers, and reporting utilities.
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #26 of 47 | Phase 4: Implementation
 */

// ============================================================================
// Error Classes
// ============================================================================

export {
  // Base error
  E2ETestError,

  // Specific error types
  FixtureError,
  TimeoutError,
  AssertionError,
  SetupError,
  RetryExhaustedError,
  FlakyTestError,
  ApiTestError,

  // Error codes
  E2EErrorCodes,

  // Type guards
  isE2ETestError,
  isFixtureError,
  isTimeoutError,
  isAssertionError,
  isSetupError,
  isRecoverableError,
  isRetryableE2EError,

  // Utilities
  wrapAsE2EError,

  // Types
  type E2EErrorCode,
  type E2EErrorContext,
  type SerializedE2EError,
  type AssertionDiff,
} from './e2e-errors.js';

// ============================================================================
// Error Handlers
// ============================================================================

export {
  // Retry
  withE2ERetry,
  E2ERetry,
  DEFAULT_E2E_RETRY_OPTIONS,

  // Fallback
  withE2EFallback,
  E2EFallback,

  // Error handler
  E2EErrorHandler,
  createErrorHandler,
  DEFAULT_ERROR_HANDLER_CONFIG,

  // Error aggregation
  ErrorAggregator,
  AggregatedE2EError,
  createErrorAggregator,

  // Cleanup
  CleanupRegistry,
  createCleanupRegistry,

  // Error boundary
  withErrorBoundary,

  // Types
  type E2ERetryOptions,
  type RetryResult,
  type E2EErrorHandlerConfig,
  type CleanupHandler,
  type ErrorHandlerContext,
  type ErrorSummary,
  type FallbackOptions,
  type AggregatedErrorSummary,
  type CleanupResult,
} from './error-handlers.js';

// ============================================================================
// Error Reporter
// ============================================================================

export {
  // Reporter
  E2EErrorReporter,
  createErrorReporter,

  // Context capturer
  ContextCapturer,
  createContextCapturer,

  // Convenience functions
  formatE2EError,
  generateE2EErrorReport,

  // Config
  DEFAULT_REPORT_CONFIG,

  // Types
  type ErrorReportFormat,
  type ErrorReportConfig,
  type ErrorReport,
  type FormattedError,
  type ProcessedStackTrace,
  type StackFrame,
  type TestInfo,
  type CapturedContext,
  type EnvironmentContext,
  type TestContext,
  type BrowserContext,
  type NetworkContext,
  type ConsoleContext,
} from './error-reporter.js';
