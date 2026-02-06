/**
 * Request Context Logger
 * @module logging/request-context
 *
 * Provides AsyncLocalStorage-based request context for automatic log correlation.
 * Enables request-scoped logging without explicit context passing.
 *
 * TASK-DETECT: Logging infrastructure
 */

import { AsyncLocalStorage } from 'async_hooks';
import { randomUUID } from 'crypto';
import { StructuredLogger, LogContext, createLogger, getLogger } from './logger';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Request context stored in AsyncLocalStorage
 */
export interface RequestContext {
  /** Unique request identifier */
  requestId: string;
  /** Request-scoped logger */
  logger: StructuredLogger;
  /** Request start time for duration tracking */
  startTime: number;
  /** Start time as high-resolution tuple */
  startHrTime: [number, number];
  /** Additional metadata for the request */
  metadata: Record<string, unknown>;
  /** User ID if authenticated */
  userId?: string;
  /** Tenant ID for multi-tenant isolation */
  tenantId?: string;
  /** Trace ID for distributed tracing */
  traceId?: string;
  /** Span ID for distributed tracing */
  spanId?: string;
  /** Parent span ID for distributed tracing */
  parentSpanId?: string;
}

/**
 * Options for creating a request context
 */
export interface CreateRequestContextOptions {
  requestId?: string;
  userId?: string;
  tenantId?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// AsyncLocalStorage Instance
// ============================================================================

/**
 * AsyncLocalStorage instance for request context
 */
const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

// ============================================================================
// Context Management Functions
// ============================================================================

/**
 * Creates a new request context
 */
export function createRequestContext(
  options: CreateRequestContextOptions = {}
): RequestContext {
  const requestId = options.requestId || randomUUID();
  const traceId = options.traceId || generateTraceId();
  const spanId = options.spanId || generateSpanId();

  const logContext: LogContext = {
    requestId,
    traceId,
    spanId,
    ...(options.parentSpanId && { parentSpanId: options.parentSpanId }),
    ...(options.userId && { userId: options.userId }),
    ...(options.tenantId && { tenantId: options.tenantId }),
  };

  const logger = createLogger('request', logContext);

  return {
    requestId,
    logger,
    startTime: Date.now(),
    startHrTime: process.hrtime(),
    metadata: options.metadata || {},
    userId: options.userId,
    tenantId: options.tenantId,
    traceId,
    spanId,
    parentSpanId: options.parentSpanId,
  };
}

/**
 * Runs a function within a request context
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Runs an async function within a request context
 */
export async function runWithContextAsync<T>(
  context: RequestContext,
  fn: () => Promise<T>
): Promise<T> {
  return asyncLocalStorage.run(context, fn);
}

/**
 * Gets the current request context
 */
export function getRequestContext(): RequestContext | undefined {
  return asyncLocalStorage.getStore();
}

/**
 * Gets the current request logger (falls back to root logger)
 */
export function getRequestLogger(): StructuredLogger {
  const context = getRequestContext();
  if (context) {
    return context.logger;
  }
  // Fallback to root logger with a warning marker
  return getLogger().child({ orphanLog: true });
}

/**
 * Gets the current request ID if available
 */
export function getRequestId(): string | undefined {
  return getRequestContext()?.requestId;
}

/**
 * Gets the current trace context for propagation
 */
export function getTraceContext(): { traceId?: string; spanId?: string; parentSpanId?: string } {
  const context = getRequestContext();
  if (!context) {
    return {};
  }
  return {
    traceId: context.traceId,
    spanId: context.spanId,
    parentSpanId: context.parentSpanId,
  };
}

/**
 * Adds metadata to the current request context
 */
export function addRequestMetadata(metadata: Record<string, unknown>): void {
  const context = getRequestContext();
  if (context) {
    Object.assign(context.metadata, metadata);
  }
}

/**
 * Gets the duration since request start in milliseconds
 */
export function getRequestDuration(): number {
  const context = getRequestContext();
  if (!context) {
    return 0;
  }
  return Date.now() - context.startTime;
}

/**
 * Gets high-resolution duration since request start
 */
export function getRequestDurationHr(): number {
  const context = getRequestContext();
  if (!context) {
    return 0;
  }
  const [seconds, nanoseconds] = process.hrtime(context.startHrTime);
  return seconds * 1000 + nanoseconds / 1e6;
}

// ============================================================================
// ID Generation
// ============================================================================

/**
 * Generates a trace ID (32 hex characters)
 */
function generateTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

/**
 * Generates a span ID (16 hex characters)
 */
function generateSpanId(): string {
  return randomUUID().slice(0, 18).replace(/-/g, '');
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin options
 */
export interface RequestLoggerPluginOptions {
  /** Generate request ID if not present in headers */
  generateRequestId?: boolean;
  /** Header name for request ID */
  requestIdHeader?: string;
  /** Header name for tenant ID */
  tenantIdHeader?: string;
  /** Header name for trace ID */
  traceIdHeader?: string;
  /** Header name for span ID */
  spanIdHeader?: string;
  /** Log request body (be careful with sensitive data) */
  logBody?: boolean;
  /** Log response body (be careful with sensitive data) */
  logResponseBody?: boolean;
  /** Paths to exclude from logging */
  excludePaths?: string[];
  /** Log level for request started */
  requestLogLevel?: 'trace' | 'debug' | 'info';
  /** Log level for request completed */
  responseLogLevel?: 'trace' | 'debug' | 'info';
}

const defaultPluginOptions: Required<RequestLoggerPluginOptions> = {
  generateRequestId: true,
  requestIdHeader: 'x-request-id',
  tenantIdHeader: 'x-tenant-id',
  traceIdHeader: 'x-trace-id',
  spanIdHeader: 'x-span-id',
  logBody: false,
  logResponseBody: false,
  excludePaths: ['/health', '/health/live', '/health/ready', '/metrics', '/favicon.ico'],
  requestLogLevel: 'info',
  responseLogLevel: 'info',
};

/**
 * Fastify plugin for request logging with AsyncLocalStorage context
 */
export function requestLoggerPlugin(
  fastify: any,
  opts: RequestLoggerPluginOptions,
  done: (err?: Error) => void
): void {
  const options = { ...defaultPluginOptions, ...opts };

  // Add decorator for request context
  fastify.decorateRequest('requestContext', null);

  // onRequest hook - create context and start logging
  fastify.addHook('onRequest', (request: any, reply: any, next: (err?: Error) => void) => {
    // Check if path should be excluded
    const shouldExclude = options.excludePaths.some(
      (path) => request.url === path || request.url.startsWith(path + '?')
    );

    if (shouldExclude) {
      return next();
    }

    // Extract or generate request ID
    const requestId =
      (request.headers[options.requestIdHeader] as string) ||
      (options.generateRequestId ? randomUUID() : undefined);

    // Extract trace context from headers
    const traceId = request.headers[options.traceIdHeader] as string | undefined;
    const spanId = request.headers[options.spanIdHeader] as string | undefined;
    const tenantId = request.headers[options.tenantIdHeader] as string | undefined;

    // Create request context
    const context = createRequestContext({
      requestId,
      tenantId,
      traceId,
      spanId,
      userId: request.user?.id,
    });

    // Attach to request for access in handlers
    request.requestContext = context;
    request.requestId = requestId;

    // Set response headers
    if (requestId) {
      reply.header(options.requestIdHeader, requestId);
    }
    if (context.traceId) {
      reply.header(options.traceIdHeader, context.traceId);
    }
    if (context.spanId) {
      reply.header(options.spanIdHeader, context.spanId);
    }

    // Run the rest of the request in context
    runWithContext(context, () => {
      // Log request started
      const requestLog: Record<string, unknown> = {
        event: 'http_request_started',
        method: request.method,
        url: request.url,
        path: request.routerPath || request.url.split('?')[0],
        query: request.query,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        contentType: request.headers['content-type'],
        contentLength: request.headers['content-length'],
      };

      if (options.logBody && request.body) {
        requestLog.body = request.body;
      }

      context.logger[options.requestLogLevel](requestLog, 'Request started');

      next();
    });
  });

  // onResponse hook - log completion
  fastify.addHook('onResponse', (request: any, reply: any, next: (err?: Error) => void) => {
    const context = request.requestContext as RequestContext | undefined;

    if (!context) {
      return next();
    }

    runWithContext(context, () => {
      const duration = getRequestDurationHr();

      const responseLog: Record<string, unknown> = {
        event: 'http_request_completed',
        method: request.method,
        url: request.url,
        path: request.routerPath || request.url.split('?')[0],
        statusCode: reply.statusCode,
        durationMs: Math.round(duration * 100) / 100,
        contentLength: reply.getHeader('content-length'),
        contentType: reply.getHeader('content-type'),
      };

      // Determine log level based on status code
      const logLevel =
        reply.statusCode >= 500
          ? 'error'
          : reply.statusCode >= 400
            ? 'warn'
            : options.responseLogLevel;

      context.logger[logLevel](responseLog, `Request completed: ${reply.statusCode}`);

      next();
    });
  });

  // onError hook - log errors
  fastify.addHook('onError', (request: any, reply: any, error: Error, next: (err?: Error) => void) => {
    const context = request.requestContext as RequestContext | undefined;

    if (context) {
      runWithContext(context, () => {
        context.logger.error(
          {
            event: 'http_request_error',
            method: request.method,
            url: request.url,
            err: error,
            errorCode: (error as any).code,
            statusCode: reply.statusCode,
          },
          `Request error: ${error.message}`
        );
      });
    }

    next();
  });

  done();
}

// ============================================================================
// Express/Connect Middleware (Alternative)
// ============================================================================

/**
 * Express/Connect compatible middleware for request logging
 */
export function requestLoggerMiddleware(
  options: RequestLoggerPluginOptions = {}
): (req: any, res: any, next: (err?: Error) => void) => void {
  const opts = { ...defaultPluginOptions, ...options };

  return (req: any, res: any, next: (err?: Error) => void) => {
    // Check if path should be excluded
    const path = req.path || req.url.split('?')[0];
    const shouldExclude = opts.excludePaths.some(
      (excludePath) => path === excludePath || path.startsWith(excludePath + '/')
    );

    if (shouldExclude) {
      return next();
    }

    // Extract or generate request ID
    const requestId =
      (req.headers[opts.requestIdHeader] as string) ||
      (opts.generateRequestId ? randomUUID() : undefined);

    // Create context
    const context = createRequestContext({
      requestId,
      tenantId: req.headers[opts.tenantIdHeader] as string,
      traceId: req.headers[opts.traceIdHeader] as string,
      spanId: req.headers[opts.spanIdHeader] as string,
      userId: req.user?.id,
    });

    // Attach to request
    req.requestContext = context;
    req.requestId = requestId;
    req.log = context.logger;

    // Set response headers
    if (requestId) {
      res.setHeader(opts.requestIdHeader, requestId);
    }
    if (context.traceId) {
      res.setHeader(opts.traceIdHeader, context.traceId);
    }
    if (context.spanId) {
      res.setHeader(opts.spanIdHeader, context.spanId);
    }

    // Run in context
    runWithContext(context, () => {
      // Log request
      context.logger[opts.requestLogLevel](
        {
          event: 'http_request_started',
          method: req.method,
          url: req.url,
          path,
          ip: req.ip || req.connection?.remoteAddress,
          userAgent: req.headers['user-agent'],
        },
        'Request started'
      );

      // Capture response finish
      const originalEnd = res.end;
      res.end = function (...args: any[]) {
        const duration = getRequestDurationHr();

        const logLevel =
          res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : opts.responseLogLevel;

        context.logger[logLevel](
          {
            event: 'http_request_completed',
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            durationMs: Math.round(duration * 100) / 100,
          },
          `Request completed: ${res.statusCode}`
        );

        return originalEnd.apply(res, args);
      };

      next();
    });
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Wraps an async handler to ensure it runs within the request context
 */
export function withRequestContext<T>(
  handler: (context: RequestContext) => Promise<T>
): () => Promise<T> {
  return async () => {
    const context = getRequestContext();
    if (!context) {
      throw new Error('No request context available');
    }
    return handler(context);
  };
}

/**
 * Creates a child span context for internal operations
 */
export function createChildSpan(operationName: string): RequestContext | undefined {
  const parentContext = getRequestContext();
  if (!parentContext) {
    return undefined;
  }

  return createRequestContext({
    requestId: parentContext.requestId,
    userId: parentContext.userId,
    tenantId: parentContext.tenantId,
    traceId: parentContext.traceId,
    parentSpanId: parentContext.spanId,
    metadata: {
      ...parentContext.metadata,
      operation: operationName,
    },
  });
}
