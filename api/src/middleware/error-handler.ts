/**
 * Global Error Handler Middleware
 * @module middleware/error-handler
 *
 * Fastify error handler that integrates with the comprehensive error
 * handling infrastructure. Maps domain errors to HTTP responses and
 * handles error logging/tracking.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import pino from 'pino';
import {
  BaseError,
  isBaseError,
  isOperationalError,
  getHttpStatusForCode,
  ErrorReporter,
  ErrorSeverity,
  createDevErrorReporter,
  // Re-export legacy error classes for backward compatibility
  NotFoundError as NotFoundErr,
  ValidationError as ValidationErr,
  UnauthorizedError as UnauthorizedErr,
  ForbiddenError as ForbiddenErr,
  ConflictError as ConflictErr,
  DatabaseError as DatabaseErr,
} from '../errors';

const logger = pino({ name: 'error-handler' });

// ============================================================================
// Legacy Error Classes (for backward compatibility)
// ============================================================================

/**
 * @deprecated Use errors from '../errors' module instead
 * Custom application error class
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * @deprecated Use NotFoundError from '../errors' module instead
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id
      ? `${resource} with id '${id}' not found`
      : `${resource} not found`;
    super(message, 404, 'NOT_FOUND');
  }
}

/**
 * @deprecated Use ValidationError from '../errors' module instead
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, 'VALIDATION_ERROR', details);
  }
}

/**
 * @deprecated Use UnauthorizedError from '../errors' module instead
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/**
 * @deprecated Use ForbiddenError from '../errors' module instead
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * @deprecated Use ConflictError from '../errors' module instead
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

/**
 * @deprecated Use DatabaseError from '../errors' module instead
 */
export class DatabaseError extends AppError {
  constructor(message: string = 'Database error', details?: unknown) {
    super(message, 500, 'DATABASE_ERROR', details);
  }
}

// ============================================================================
// Error Response Types
// ============================================================================

/**
 * Error response formatter
 */
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
  requestId?: string;
  timestamp?: string;
}

/**
 * Extended error response with additional fields
 */
interface ExtendedErrorResponse extends ErrorResponse {
  validationErrors?: Array<{ field: string; message: string }>;
  cause?: string;
  stack?: string;
}

// ============================================================================
// Error Formatting
// ============================================================================

/**
 * Format error for response
 */
function formatError(
  error: FastifyError | AppError | BaseError | Error,
  requestId?: string
): ErrorResponse {
  const isProduction = process.env.NODE_ENV === 'production';

  // Handle new BaseError instances from errors module
  if (isBaseError(error)) {
    const baseError = error as BaseError;
    const response: ExtendedErrorResponse = {
      statusCode: baseError.statusCode,
      error: getHttpErrorName(baseError.statusCode),
      message: baseError.message,
      code: baseError.code,
      requestId,
      timestamp: baseError.timestamp.toISOString(),
    };

    // Include details in non-production
    if (!isProduction) {
      response.details = baseError.context.details;
      if (baseError.cause instanceof Error) {
        response.cause = baseError.cause.message;
      }
    }

    // Include validation errors if present
    if ('validationErrors' in baseError && Array.isArray((baseError as any).validationErrors)) {
      response.validationErrors = (baseError as any).validationErrors;
    }

    return response;
  }

  // Handle legacy AppError instances
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      error: getHttpErrorName(error.statusCode),
      message: error.message,
      code: error.code,
      details: !isProduction ? error.details : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle Fastify validation errors
  if ('validation' in error && error.validation) {
    return {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: !isProduction ? error.validation : undefined,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle Fastify errors with statusCode
  if ('statusCode' in error && typeof error.statusCode === 'number') {
    return {
      statusCode: error.statusCode,
      error: getHttpErrorName(error.statusCode),
      message: error.message,
      code: error.code,
      requestId,
      timestamp: new Date().toISOString(),
    };
  }

  // Handle generic errors (hide details in production)
  return {
    statusCode: 500,
    error: 'Internal Server Error',
    message: isProduction ? 'An unexpected error occurred' : error.message,
    code: 'INTERNAL_ERROR',
    requestId,
    timestamp: new Date().toISOString(),
  };
}

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
    429: 'Too Many Requests',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
    504: 'Gateway Timeout',
  };
  return names[statusCode] || 'Error';
}

// ============================================================================
// Error Handler Options
// ============================================================================

/**
 * Error handler plugin options
 */
export interface ErrorHandlerOptions {
  /** Enable error tracking/reporting */
  enableTracking?: boolean;
  /** Custom error reporter instance */
  errorReporter?: ErrorReporter;
  /** Include stack traces in error responses */
  includeStackTraces?: boolean;
  /** Log all errors to console */
  logErrors?: boolean;
  /** Custom error transformer */
  transformError?: (error: Error, request: FastifyRequest) => Error;
}

/**
 * Default error handler options
 */
const DEFAULT_OPTIONS: ErrorHandlerOptions = {
  enableTracking: process.env.NODE_ENV === 'production',
  includeStackTraces: process.env.NODE_ENV !== 'production',
  logErrors: true,
};

// ============================================================================
// Error Handler Plugin
// ============================================================================

/**
 * Global error handler plugin with comprehensive error handling support
 */
async function errorHandlerPlugin(
  fastify: FastifyInstance,
  options: ErrorHandlerOptions = {}
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errorReporter = opts.errorReporter ?? (
    opts.enableTracking ? createDevErrorReporter() : undefined
  );

  // Main error handler
  fastify.setErrorHandler(
    async (error: FastifyError | AppError | BaseError | Error, request: FastifyRequest, reply: FastifyReply) => {
      // Apply custom transform if provided
      const finalError = opts.transformError
        ? opts.transformError(error, request)
        : error;

      const formattedError = formatError(finalError, request.id);

      // Log error with request context
      if (opts.logErrors) {
        const logContext = {
          err: finalError,
          requestId: request.id,
          method: request.method,
          url: request.url,
          statusCode: formattedError.statusCode,
          code: formattedError.code,
          userId: (request as any).userId,
          tenantId: (request as any).tenantId,
        };

        // Use appropriate log level based on status code and error type
        const isOperational = isBaseError(finalError)
          ? (finalError as BaseError).isOperational
          : finalError instanceof AppError
            ? finalError.isOperational
            : false;

        if (formattedError.statusCode >= 500 && !isOperational) {
          logger.error(logContext, 'Non-operational server error');
        } else if (formattedError.statusCode >= 500) {
          logger.error(logContext, 'Server error');
        } else if (formattedError.statusCode >= 400) {
          logger.warn(logContext, 'Client error');
        }
      }

      // Report error to tracking service
      if (errorReporter && formattedError.statusCode >= 500) {
        errorReporter.addBreadcrumb('http', `${request.method} ${request.url}`, {
          statusCode: formattedError.statusCode,
          params: request.params,
        });

        await errorReporter.report(finalError, {
          requestId: request.id,
          operation: `${request.method} ${request.routeOptions?.url ?? request.url}`,
          userId: (request as any).userId,
          tenantId: (request as any).tenantId,
        }).catch(reportErr => {
          logger.error({ err: reportErr }, 'Failed to report error');
        });
      }

      // Add retry-after header for rate limit errors
      if (formattedError.code === 'RATE_LIMITED' || formattedError.code === 'RATE_LIMIT_EXCEEDED') {
        const retryAfter = isBaseError(finalError) && 'retryAfter' in finalError
          ? (finalError as any).retryAfter
          : 60;
        reply.header('Retry-After', retryAfter);
      }

      // Add stack trace in development
      if (opts.includeStackTraces && formattedError.statusCode >= 500) {
        (formattedError as ExtendedErrorResponse).stack = finalError.stack;
      }

      return reply.status(formattedError.statusCode).send(formattedError);
    }
  );

  // Handle 404 for unmatched routes
  fastify.setNotFoundHandler(
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (opts.logErrors) {
        logger.warn(
          { method: request.method, url: request.url, requestId: request.id },
          'Route not found'
        );
      }

      return reply.status(404).send({
        statusCode: 404,
        error: 'Not Found',
        message: `Route ${request.method} ${request.url} not found`,
        code: 'ROUTE_NOT_FOUND',
        requestId: request.id,
        timestamp: new Date().toISOString(),
      });
    }
  );

  // Decorate fastify with error reporter for access in routes
  if (errorReporter) {
    fastify.decorate('errorReporter', errorReporter);
  }
}

export default fp(errorHandlerPlugin, {
  name: 'error-handler',
  fastify: '4.x',
});

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    errorReporter?: ErrorReporter;
  }
}
