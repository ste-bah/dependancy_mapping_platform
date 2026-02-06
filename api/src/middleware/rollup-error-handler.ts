/**
 * Rollup Error Handler Middleware
 * @module middleware/rollup-error-handler
 *
 * Fastify error handler plugin for rollup routes.
 * Maps domain errors to HTTP responses, logs errors with correlation IDs,
 * handles TypeBox validation errors, and returns standardized error responses.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation error handling
 */

import { FastifyInstance, FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import fp from 'fastify-plugin';
import pino from 'pino';
import {
  RollupError,
  RollupNotFoundError,
  RollupConfigurationError,
  RollupExecutionError,
  RollupExecutionNotFoundError,
  RollupMergeError,
  RollupBlastRadiusError,
  RollupBlastRadiusExceededError,
  RollupLimitExceededError,
  RollupAggregateError,
  isRollupError,
  isRetryableRollupError,
  wrapAsRollupError,
  SerializedRollupError,
} from '../services/rollup/errors.js';
import {
  RollupErrorCode,
  RollupErrorHttpStatus,
  RollupErrorSeverity,
  RollupErrorSeverityMap,
  RollupErrorCodeType,
  getRollupErrorInfo,
} from '../services/rollup/error-codes.js';
import { ErrorReporter, ErrorSeverity } from '../errors/index.js';

const logger = pino({ name: 'rollup-error-handler' });

// ============================================================================
// Types
// ============================================================================

/**
 * Standardized rollup error response
 */
export interface RollupErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
  correlationId?: string;
  requestId?: string;
  timestamp: string;
  isRetryable?: boolean;
  retryAfter?: number;
  suggestedAction?: string;
  details?: Record<string, unknown>;
  validationErrors?: Array<{
    field: string;
    message: string;
    code?: string;
  }>;
}

/**
 * Rollup error handler options
 */
export interface RollupErrorHandlerOptions {
  /** Include detailed error information */
  includeDetails?: boolean;
  /** Include stack traces in development */
  includeStackTraces?: boolean;
  /** Enable error tracking/reporting */
  enableTracking?: boolean;
  /** Custom error reporter */
  errorReporter?: ErrorReporter;
  /** Custom error transformer */
  transformError?: (error: Error, request: FastifyRequest) => Error;
  /** Log all errors */
  logErrors?: boolean;
  /** Custom correlation ID header name */
  correlationIdHeader?: string;
}

/**
 * Default options
 */
const DEFAULT_OPTIONS: Required<Omit<RollupErrorHandlerOptions, 'errorReporter' | 'transformError'>> = {
  includeDetails: process.env.NODE_ENV !== 'production',
  includeStackTraces: process.env.NODE_ENV !== 'production',
  enableTracking: process.env.NODE_ENV === 'production',
  logErrors: true,
  correlationIdHeader: 'x-correlation-id',
};

// ============================================================================
// HTTP Status Code Mapping
// ============================================================================

/**
 * Get HTTP error name from status code
 */
function getHttpErrorName(statusCode: number): string {
  const names: Record<number, string> = {
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    423: 'Locked',
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    501: 'Not Implemented',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return names[statusCode] || 'Error';
}

/**
 * Map error to HTTP status code
 */
function getStatusCodeForError(error: Error): number {
  // Rollup errors with explicit status
  if (isRollupError(error)) {
    const code = error.code as unknown as RollupErrorCodeType;
    const status = RollupErrorHttpStatus[code];
    if (status) return status;
  }

  // Specific error class mappings
  if (error instanceof RollupNotFoundError) return 404;
  if (error instanceof RollupExecutionNotFoundError) return 404;
  if (error instanceof RollupConfigurationError) return 400;
  if (error instanceof RollupLimitExceededError) return 422;
  if (error instanceof RollupBlastRadiusExceededError) return 422;
  if (error instanceof RollupMergeError) return 422;

  // Fastify validation errors
  if ('validation' in error) return 400;

  // Fastify errors with statusCode
  if ('statusCode' in error && typeof (error as FastifyError).statusCode === 'number') {
    return (error as FastifyError).statusCode!;
  }

  return 500;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Extract correlation ID from request
 */
function getCorrelationId(request: FastifyRequest, headerName: string): string | undefined {
  return (
    request.headers[headerName.toLowerCase()] as string |
    request.id ||
    undefined
  );
}

/**
 * Format TypeBox validation errors
 */
function formatValidationErrors(
  validation: FastifyError['validation']
): Array<{ field: string; message: string; code?: string }> | undefined {
  if (!validation || !Array.isArray(validation)) {
    return undefined;
  }

  return validation.map((err) => ({
    field: err.instancePath?.replace(/^\//, '').replace(/\//g, '.') || 'root',
    message: err.message || 'Validation failed',
    code: err.keyword,
  }));
}

/**
 * Format rollup error for response
 */
function formatRollupError(
  error: Error,
  request: FastifyRequest,
  options: Required<Omit<RollupErrorHandlerOptions, 'errorReporter' | 'transformError'>> & Partial<Pick<RollupErrorHandlerOptions, 'errorReporter' | 'transformError'>>
): RollupErrorResponse {
  const correlationId = getCorrelationId(request, options.correlationIdHeader);
  const statusCode = getStatusCodeForError(error);
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle RollupError instances
  if (error instanceof RollupError) {
    const serialized = error.toSafeResponse(options.includeStackTraces);
    const response: RollupErrorResponse = {
      statusCode: error.statusCode,
      error: getHttpErrorName(error.statusCode),
      message: error.message,
      code: error.code,
      correlationId: correlationId || serialized.correlationId,
      requestId: request.id,
      timestamp: serialized.timestamp,
      isRetryable: error.isRetryable,
      suggestedAction: error.suggestedAction,
    };

    // Include details in non-production
    if (options.includeDetails && serialized.details) {
      response.details = serialized.details;
    }

    // Add retry-after for rate limited errors
    if (error.code === 'ROLLUP_RATE_LIMITED' || error.code === 'ROLLUP_LIMIT_RATE') {
      const retryAfter = (error.rollupContext['retryAfter'] as number) || 60;
      response.retryAfter = retryAfter;
    }

    return response;
  }

  // Handle RollupConfigurationError with validation errors
  if (error instanceof RollupConfigurationError) {
    return {
      statusCode,
      error: getHttpErrorName(statusCode),
      message: error.message,
      code: error.code,
      correlationId,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      isRetryable: false,
      validationErrors: error.validationErrors.map((e) => ({
        field: e.field,
        message: e.message,
        code: e.code,
      })),
    };
  }

  // Handle Fastify validation errors (TypeBox)
  if ('validation' in error && (error as FastifyError).validation) {
    const fastifyError = error as FastifyError;
    return {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      code: 'ROLLUP_VAL_ERROR',
      correlationId,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      isRetryable: false,
      validationErrors: formatValidationErrors(fastifyError.validation),
    };
  }

  // Handle aggregate errors
  if (error instanceof RollupAggregateError) {
    return {
      statusCode,
      error: getHttpErrorName(statusCode),
      message: error.message,
      code: error.code,
      correlationId,
      requestId: request.id,
      timestamp: new Date().toISOString(),
      isRetryable: false,
      details: options.includeDetails
        ? {
            successCount: error.successCount,
            totalCount: error.totalCount,
            errorCount: error.errors.length,
            errors: error.errors.slice(0, 5).map((e) => e.message),
          }
        : undefined,
    };
  }

  // Handle generic errors
  return {
    statusCode,
    error: getHttpErrorName(statusCode),
    message: isProduction ? 'An unexpected error occurred' : error.message,
    code: 'ROLLUP_GEN_ERROR',
    correlationId,
    requestId: request.id,
    timestamp: new Date().toISOString(),
    isRetryable: false,
  };
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Log rollup error with appropriate level
 */
function logRollupError(
  error: Error,
  request: FastifyRequest,
  statusCode: number,
  correlationId?: string
): void {
  const logContext = {
    err: error,
    correlationId,
    requestId: request.id,
    method: request.method,
    url: request.url,
    statusCode,
    code: (error as RollupError).code,
    userId: (request as any).userId,
    tenantId: (request as any).tenantId,
    rollupId: (error as RollupError).rollupContext?.['rollupId'],
    executionId: (error as RollupError).rollupContext?.['executionId'],
    isRetryable: isRetryableRollupError(error),
  };

  // Determine log level based on status code and error severity
  if (error instanceof RollupError) {
    switch (error.severity) {
      case RollupErrorSeverity.CRITICAL:
        logger.fatal(logContext, 'Critical rollup error');
        break;
      case RollupErrorSeverity.ERROR:
        logger.error(logContext, 'Rollup error');
        break;
      case RollupErrorSeverity.WARNING:
        logger.warn(logContext, 'Rollup warning');
        break;
      default:
        logger.info(logContext, 'Rollup info');
    }
  } else if (statusCode >= 500) {
    logger.error(logContext, 'Server error in rollup route');
  } else if (statusCode >= 400) {
    logger.warn(logContext, 'Client error in rollup route');
  } else {
    logger.info(logContext, 'Rollup error handled');
  }
}

/**
 * Map rollup severity to error reporter severity
 */
function mapSeverity(rollupSeverity: RollupErrorSeverity): ErrorSeverity {
  switch (rollupSeverity) {
    case RollupErrorSeverity.CRITICAL:
      return ErrorSeverity.CRITICAL;
    case RollupErrorSeverity.ERROR:
      return ErrorSeverity.HIGH;
    case RollupErrorSeverity.WARNING:
      return ErrorSeverity.MEDIUM;
    default:
      return ErrorSeverity.LOW;
  }
}

// ============================================================================
// Error Handler Plugin
// ============================================================================

/**
 * Rollup error handler Fastify plugin
 *
 * Provides specialized error handling for rollup routes:
 * - Maps domain errors to HTTP responses
 * - Logs errors with correlation IDs
 * - Handles TypeBox validation errors
 * - Returns standardized error responses
 *
 * @example
 * ```typescript
 * // Register for all routes
 * fastify.register(rollupErrorHandler, {
 *   includeDetails: process.env.NODE_ENV !== 'production',
 *   enableTracking: true,
 * });
 *
 * // Or register for rollup routes only
 * fastify.register(async (instance) => {
 *   instance.register(rollupErrorHandler);
 *   instance.register(rollupRoutes, { prefix: '/rollups' });
 * });
 * ```
 */
async function rollupErrorHandlerPlugin(
  fastify: FastifyInstance,
  options: RollupErrorHandlerOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Add correlation ID to request if not present
  fastify.addHook('onRequest', async (request, reply) => {
    const correlationId = getCorrelationId(request, opts.correlationIdHeader);
    if (correlationId) {
      reply.header(opts.correlationIdHeader, correlationId);
    }
  });

  // Set error handler
  fastify.setErrorHandler(async (error, request, reply) => {
    // Apply custom transform if provided
    const finalError = opts.transformError
      ? opts.transformError(error, request)
      : error;

    const correlationId = getCorrelationId(request, opts.correlationIdHeader);
    const statusCode = getStatusCodeForError(finalError);

    // Log the error
    if (opts.logErrors) {
      logRollupError(finalError, request, statusCode, correlationId);
    }

    // Report to error tracking service
    if (opts.enableTracking && opts.errorReporter && statusCode >= 500) {
      const severity = finalError instanceof RollupError
        ? mapSeverity(finalError.severity)
        : ErrorSeverity.HIGH;

      opts.errorReporter.addBreadcrumb('http', `${request.method} ${request.url}`, {
        statusCode,
        correlationId,
      });

      await opts.errorReporter.report(finalError, {
        requestId: request.id,
        operation: `${request.method} ${request.routeOptions?.url ?? request.url}`,
        userId: (request as any).userId,
        tenantId: (request as any).tenantId,
      }).catch((reportErr) => {
        logger.error({ err: reportErr }, 'Failed to report rollup error');
      });
    }

    // Format the error response
    const response = formatRollupError(finalError, request, opts);

    // Set headers
    if (response.retryAfter) {
      reply.header('Retry-After', response.retryAfter);
    }

    // Send response
    return reply.status(response.statusCode).send(response);
  });
}

// ============================================================================
// Exports
// ============================================================================

export default fp(rollupErrorHandlerPlugin, {
  name: 'rollup-error-handler',
  fastify: '4.x',
  dependencies: [],
});

export {
  rollupErrorHandlerPlugin,
  formatRollupError,
  getStatusCodeForError,
  getCorrelationId,
};

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyRequest {
    correlationId?: string;
  }
}
