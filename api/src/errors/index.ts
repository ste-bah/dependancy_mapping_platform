/**
 * Error Handling Module
 * @module errors
 *
 * Comprehensive error handling infrastructure for the IaC dependency detection system.
 * Provides error classes, recovery strategies, and tracking integration.
 *
 * TASK-DETECT: Error handling infrastructure
 *
 * @example
 * ```typescript
 * import {
 *   ParseError,
 *   DetectionError,
 *   withRetry,
 *   CircuitBreaker,
 *   createErrorReporter
 * } from './errors';
 *
 * // Throw domain-specific errors
 * throw new ParseError('Invalid HCL syntax', 'INVALID_HCL', location);
 *
 * // Use recovery strategies
 * const result = await withRetry(() => fetchData(), { maxAttempts: 3 });
 *
 * // Create circuit breaker for external services
 * const breaker = new CircuitBreaker('github-api', { failureThreshold: 5 });
 * const data = await breaker.execute(() => githubClient.getRepo());
 *
 * // Report errors to tracking service
 * const reporter = createErrorReporter({ environment: 'production' });
 * await reporter.report(error, { requestId });
 * ```
 */

// ============================================================================
// Error Codes
// ============================================================================

export {
  // Code categories
  HttpErrorCodes,
  ParserErrorCodes,
  DetectionErrorCodes,
  ScoringErrorCodes,
  RepositoryErrorCodes,
  GraphErrorCodes,
  ExternalServiceErrorCodes,
  ScanErrorCodes,
  DocumentationErrorCodes,
  BetaCustomerErrorCodes,
  LaunchChecklistErrorCodes,

  // Combined codes
  ErrorCodes,

  // Types
  type ErrorCode,
  type HttpErrorCode,
  type ParserErrorCode,
  type DetectionErrorCode,
  type ScoringErrorCode,
  type RepositoryErrorCode,
  type GraphErrorCode,
  type ExternalServiceErrorCode,
  type ScanErrorCode,
  type DocumentationErrorCode,
  type BetaCustomerErrorCode,
  type LaunchChecklistErrorCode,

  // Utilities
  errorCodeToHttpStatus,
  getHttpStatusForCode,
  isClientError,
  isServerError,
  isRetryableError,
} from './codes';

// ============================================================================
// Base Error Classes
// ============================================================================

export {
  // Base class
  BaseError,

  // Types
  type ErrorContext,
  type SerializedError,
  type SourceLocation,

  // Type guards
  isBaseError,
  isOperationalError,
  hasErrorCode,

  // Utilities
  wrapError,
  getErrorMessage,
  getErrorStack,
} from './base';

// ============================================================================
// Domain Error Classes
// ============================================================================

export {
  // Parser errors
  ParseError,
  HCLParseError,
  YAMLParseError,
  HelmParseError,
  FileProcessingError,

  // Detection errors
  DetectionError,
  UnresolvedReferenceError,
  CircularReferenceError,
  ModuleResolutionError,
  DetectionTimeoutError,

  // Scoring errors
  ScoringError,
  InvalidEvidenceError,
  RuleEvaluationError,

  // Graph errors
  GraphError,
  NodeNotFoundError,
  EdgeNotFoundError,
  DanglingEdgeError,
  GraphValidationError,

  // Scan errors
  ScanError,
  ScanNotFoundError,
  ScanAlreadyRunningError,
  ScanFailedError,
  ScanTimeoutError,
  PartialScanFailureError,
} from './domain';

// ============================================================================
// Infrastructure Error Classes
// ============================================================================

export {
  // Database errors
  DatabaseError,
  ConnectionError,
  QueryError,
  TransactionError,
  ConstraintViolationError,

  // Repository errors
  RepositoryError,
  RepositoryNotFoundError,
  RepositoryAccessDeniedError,
  CloneError,
  InvalidRefError,

  // External service errors
  ExternalServiceError,
  GitHubError,
  GitLabError,
  BitbucketError,
  RegistryError,
  RateLimitError,
  NetworkError,
  WebhookError,
  InvalidWebhookSignatureError,

  // Application errors
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  ServiceUnavailableError,

  // Configuration errors
  ConfigurationError,

  // Types
  type ValidationFieldError,
} from './infrastructure';

// ============================================================================
// Documentation System Error Classes (TASK-FINAL-004)
// ============================================================================

export {
  // Documentation page errors
  DocumentationError,
  DocPageNotFoundError,
  InvalidCategoryError,
  SlugExistsError,
  InvalidStatusTransitionError,
  PublishFailedError,
  PageVersionConflictError,
  InvalidPageContentError,

  // Beta customer errors
  BetaCustomerError,
  BetaCustomerNotFoundError,
  EmailExistsError,
  NdaNotSignedError,
  InvalidOnboardingStatusError,
  OnboardingIncompleteError,
  CustomerAlreadyOnboardedError,
  InvalidTierError,

  // Launch checklist errors
  LaunchChecklistError,
  ChecklistItemNotFoundError,
  BlockedByDependencyError,
  LaunchCircularDependencyError,
  InvalidTargetDateError,
  ItemAlreadyCompletedError,
  LaunchCategoryNotFoundError,
  InvalidPriorityError,
} from './documentation';

// ============================================================================
// Recovery Strategies
// ============================================================================

export {
  // Retry
  withRetry,
  Retry,
  type RetryOptions,
  type RetryResult,
  DEFAULT_RETRY_OPTIONS,

  // Circuit breaker
  CircuitBreaker,
  CircuitState,
  CircuitOpenError,
  type CircuitBreakerOptions,
  type CircuitBreakerStats,
  DEFAULT_CIRCUIT_BREAKER_OPTIONS,

  // Fallback
  withFallback,
  Fallback,
  type FallbackOptions,

  // Timeout
  withTimeout,
  Timeout,
  TimeoutError,
  type TimeoutOptions,

  // Bulkhead
  Bulkhead,
  BulkheadFullError,
  type BulkheadOptions,
  type BulkheadStats,

  // Combined resilience
  withResilience,
} from './recovery';

// ============================================================================
// Error Tracking
// ============================================================================

export {
  // Error reporter
  ErrorReporter,
  type ErrorReporterConfig,
  type ErrorReporterStats,
  DEFAULT_ERROR_REPORTER_CONFIG,

  // Severity
  ErrorSeverity,

  // Report types
  type ErrorReport,
  type ErrorReportContext,
  type ErrorReportUser,
  type Breadcrumb,
  type BreadcrumbCategory,

  // Backends
  type IErrorReporterBackend,
  ConsoleReporterBackend,
  NullReporterBackend,
  HttpReporterBackend,

  // Factory functions
  createErrorReporter,
  createDevErrorReporter,
  createTestErrorReporter,
} from './tracking';

// ============================================================================
// API Error Standardization
// ============================================================================

export {
  // API Error Response Types
  type ApiErrorResponse,
  type ApiErrorResponseDebug,

  // API Error Codes
  ApiErrorCodes,
  type ApiErrorCode,

  // Base API Error
  ApiError,

  // Specific API Errors
  BadRequestError,
  ApiUnauthorizedError,
  ApiForbiddenError,
  ApiNotFoundError,
  ApiConflictError,
  ApiValidationError,
  ApiRateLimitError,
  PayloadTooLargeError,
  ApiInternalError,
  ApiServiceUnavailableError,
  ApiDatabaseError,

  // Domain-Specific API Errors
  ScanNotFoundApiError,
  ScanFailedApiError,
  ParserApiError,
  InvalidFileTypeError,

  // Documentation System API Errors (TASK-FINAL-004)
  DocPageNotFoundApiError,
  SlugExistsApiError,
  InvalidCategoryApiError,
  InvalidStatusTransitionApiError,
  BetaCustomerNotFoundApiError,
  BetaEmailExistsApiError,
  NdaRequiredApiError,
  ChecklistItemNotFoundApiError,
  BlockedByDependencyApiError,
  CircularDependencyApiError,
  InvalidTargetDateApiError,

  // API Error Utilities
  sendApiError,
  isApiError,
  toApiError,
  fromStatusCode,
  getRequestId,
} from './api-errors.js';

// ============================================================================
// Convenience Re-exports for Common Use Cases
// ============================================================================

/**
 * Create a parser error with location
 */
export function createParseError(
  message: string,
  file: string,
  line: number,
  column?: number
): ParseError {
  const { ParseError } = require('./domain');
  return new ParseError(message, 'PARSE_ERROR', {
    file,
    lineStart: line,
    lineEnd: line,
    columnStart: column,
    columnEnd: column,
  });
}

/**
 * Create a not found error for an entity
 */
export function createNotFoundError(resource: string, id?: string): NotFoundError {
  const { NotFoundError } = require('./infrastructure');
  return new NotFoundError(resource, id);
}

/**
 * Create a validation error with field errors
 */
export function createValidationError(
  message: string,
  fieldErrors: Array<{ field: string; message: string }>
): ValidationError {
  const { ValidationError } = require('./infrastructure');
  return new ValidationError(message, fieldErrors);
}

/**
 * Check if an error should trigger a retry
 */
export function shouldRetry(error: unknown, attempt: number, maxAttempts: number): boolean {
  if (attempt >= maxAttempts) return false;

  if (isBaseError(error as Error)) {
    return isRetryableError((error as BaseError).code);
  }

  // For non-BaseError, check for common retryable patterns
  const errorMessage = getErrorMessage(error);
  const retryablePatterns = [
    'ECONNREFUSED',
    'ETIMEDOUT',
    'ENOTFOUND',
    'timeout',
    'network',
    'socket hang up',
  ];

  return retryablePatterns.some(pattern =>
    errorMessage.toLowerCase().includes(pattern.toLowerCase())
  );
}
