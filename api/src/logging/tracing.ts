/**
 * OpenTelemetry Tracing
 * @module logging/tracing
 *
 * Provides distributed tracing integration using OpenTelemetry.
 * Enables request tracing across services and operations.
 *
 * TASK-DETECT: Logging infrastructure
 */

import {
  trace,
  context,
  SpanKind,
  SpanStatusCode,
  Span,
  Tracer,
  Context,
  propagation,
  SpanOptions,
  Attributes,
  AttributeValue,
} from '@opentelemetry/api';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import {
  SimpleSpanProcessor,
  BatchSpanProcessor,
  SpanProcessor,
  ConsoleSpanExporter,
} from '@opentelemetry/sdk-trace-base';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';
import { getRequestContext } from './request-context';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Tracing configuration options
 */
export interface TracingConfig {
  /** Service name */
  serviceName: string;
  /** Service version */
  serviceVersion: string;
  /** Environment (production, staging, development) */
  environment: string;
  /** OTLP endpoint URL */
  otlpEndpoint?: string;
  /** Enable console exporter for debugging */
  consoleExporter?: boolean;
  /** Use batch processor (recommended for production) */
  batchProcessor?: boolean;
  /** Sampling ratio (0.0 to 1.0) */
  samplingRatio?: number;
  /** Additional resource attributes */
  resourceAttributes?: Record<string, AttributeValue>;
}

/**
 * Span context for manual propagation
 */
export interface SpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

/**
 * Options for creating a span
 */
export interface CreateSpanOptions {
  /** Span name */
  name: string;
  /** Span kind */
  kind?: SpanKind;
  /** Initial attributes */
  attributes?: Attributes;
  /** Parent context */
  parentContext?: Context;
}

// ============================================================================
// Global State
// ============================================================================

let provider: NodeTracerProvider | null = null;
let isInitialized = false;
const defaultTracerName = 'iac-detector';

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initializes the OpenTelemetry tracing system
 */
export function initTracing(config: Partial<TracingConfig> = {}): NodeTracerProvider {
  if (isInitialized && provider) {
    return provider;
  }

  const fullConfig: TracingConfig = {
    serviceName: config.serviceName || process.env.SERVICE_NAME || 'iac-detector',
    serviceVersion: config.serviceVersion || process.env.SERVICE_VERSION || '1.0.0',
    environment: config.environment || process.env.NODE_ENV || 'development',
    otlpEndpoint: config.otlpEndpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    consoleExporter: config.consoleExporter ?? process.env.OTEL_CONSOLE_EXPORTER === 'true',
    batchProcessor: config.batchProcessor ?? process.env.NODE_ENV === 'production',
    samplingRatio: config.samplingRatio ?? parseFloat(process.env.OTEL_SAMPLING_RATIO || '1.0'),
    resourceAttributes: config.resourceAttributes || {},
  };

  // Create resource with service information
  const resource = new Resource({
    [ATTR_SERVICE_NAME]: fullConfig.serviceName,
    [ATTR_SERVICE_VERSION]: fullConfig.serviceVersion,
    [ATTR_DEPLOYMENT_ENVIRONMENT]: fullConfig.environment,
    ...fullConfig.resourceAttributes,
  });

  // Create the tracer provider
  provider = new NodeTracerProvider({
    resource,
  });

  // Configure exporters
  const processors: SpanProcessor[] = [];

  // OTLP exporter for production
  if (fullConfig.otlpEndpoint) {
    const otlpExporter = new OTLPTraceExporter({
      url: fullConfig.otlpEndpoint,
    });

    const processor = fullConfig.batchProcessor
      ? new BatchSpanProcessor(otlpExporter)
      : new SimpleSpanProcessor(otlpExporter);

    processors.push(processor);
  }

  // Console exporter for debugging
  if (fullConfig.consoleExporter) {
    processors.push(new SimpleSpanProcessor(new ConsoleSpanExporter()));
  }

  // Add processors
  for (const processor of processors) {
    provider.addSpanProcessor(processor);
  }

  // Register the provider
  provider.register({
    propagator: new W3CTraceContextPropagator(),
  });

  isInitialized = true;

  return provider;
}

/**
 * Shuts down the tracing system
 */
export async function shutdownTracing(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
    isInitialized = false;
  }
}

// ============================================================================
// Tracer Access
// ============================================================================

/**
 * Gets a tracer instance
 */
export function getTracer(name?: string): Tracer {
  return trace.getTracer(name || defaultTracerName);
}

/**
 * Gets the current active span
 */
export function getActiveSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Gets the current context
 */
export function getCurrentContext(): Context {
  return context.active();
}

// ============================================================================
// Span Creation
// ============================================================================

/**
 * Creates and starts a new span
 */
export function startSpan(options: CreateSpanOptions): Span {
  const tracer = getTracer();
  const parentCtx = options.parentContext || context.active();

  const spanOptions: SpanOptions = {
    kind: options.kind || SpanKind.INTERNAL,
    attributes: options.attributes,
  };

  return tracer.startSpan(options.name, spanOptions, parentCtx);
}

/**
 * Runs a function within a new span
 */
export function withSpan<T>(
  name: string,
  fn: (span: Span) => T,
  options?: Partial<CreateSpanOptions>
): T {
  const tracer = getTracer();
  const spanOptions: SpanOptions = {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes,
  };

  return tracer.startActiveSpan(name, spanOptions, (span) => {
    try {
      const result = fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      recordException(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Runs an async function within a new span
 */
export async function withSpanAsync<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: Partial<CreateSpanOptions>
): Promise<T> {
  const tracer = getTracer();
  const spanOptions: SpanOptions = {
    kind: options?.kind || SpanKind.INTERNAL,
    attributes: options?.attributes,
  };

  return tracer.startActiveSpan(name, spanOptions, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      recordException(span, error as Error);
      throw error;
    } finally {
      span.end();
    }
  });
}

// ============================================================================
// Span Utilities
// ============================================================================

/**
 * Records an exception on a span
 */
export function recordException(span: Span, error: Error, attributes?: Attributes): void {
  span.recordException(error);
  span.setStatus({
    code: SpanStatusCode.ERROR,
    message: error.message,
  });

  if (attributes) {
    span.setAttributes(attributes);
  }
}

/**
 * Adds attributes to the current active span
 */
export function addSpanAttributes(attributes: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Adds an event to the current active span
 */
export function addSpanEvent(name: string, attributes?: Attributes): void {
  const span = getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Sets the status of the current active span
 */
export function setSpanStatus(code: SpanStatusCode, message?: string): void {
  const span = getActiveSpan();
  if (span) {
    span.setStatus({ code, message });
  }
}

// ============================================================================
// Context Propagation
// ============================================================================

/**
 * Extracts trace context from HTTP headers
 */
export function extractContextFromHeaders(headers: Record<string, string | string[] | undefined>): Context {
  // Normalize headers for propagation
  const normalizedHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value) {
      normalizedHeaders[key.toLowerCase()] = Array.isArray(value) ? value[0] : value;
    }
  }

  return propagation.extract(context.active(), normalizedHeaders);
}

/**
 * Injects trace context into HTTP headers
 */
export function injectContextToHeaders(headers: Record<string, string> = {}): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
}

/**
 * Gets the current trace context for logging
 */
export function getTraceContext(): { traceId?: string; spanId?: string } {
  const span = getActiveSpan();
  if (!span) {
    // Try to get from request context
    const reqCtx = getRequestContext();
    return {
      traceId: reqCtx?.traceId,
      spanId: reqCtx?.spanId,
    };
  }

  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

// ============================================================================
// Domain-Specific Tracing
// ============================================================================

/**
 * Creates a span for scan operations
 */
export function traceScan<T>(
  scanId: string,
  repositoryId: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpanAsync(
    'scan.execute',
    fn,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'scan.id': scanId,
        'repository.id': repositoryId,
        'operation.type': 'scan',
      },
    }
  );
}

/**
 * Creates a span for parser operations
 */
export function traceParser<T>(
  parserType: string,
  filePath: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpanAsync(
    `parser.${parserType}`,
    fn,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'parser.type': parserType,
        'file.path': filePath,
        'operation.type': 'parse',
      },
    }
  );
}

/**
 * Creates a span for detector operations
 */
export function traceDetector<T>(
  detectorType: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpanAsync(
    `detector.${detectorType}`,
    fn,
    {
      kind: SpanKind.INTERNAL,
      attributes: {
        'detector.type': detectorType,
        'operation.type': 'detect',
      },
    }
  );
}

/**
 * Creates a span for database operations
 */
export function traceDatabase<T>(
  operation: string,
  table: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpanAsync(
    `db.${operation}`,
    fn,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.operation': operation,
        'db.table': table,
        'db.system': 'postgresql',
      },
    }
  );
}

/**
 * Creates a span for HTTP client requests
 */
export function traceHttpRequest<T>(
  method: string,
  url: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  const urlObj = new URL(url);

  return withSpanAsync(
    `http.${method.toLowerCase()}`,
    fn,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'http.method': method,
        'http.url': url,
        'http.host': urlObj.host,
        'http.scheme': urlObj.protocol.replace(':', ''),
      },
    }
  );
}

/**
 * Creates a span for external service calls
 */
export function traceExternalService<T>(
  serviceName: string,
  operation: string,
  fn: (span: Span) => Promise<T>
): Promise<T> {
  return withSpanAsync(
    `external.${serviceName}.${operation}`,
    fn,
    {
      kind: SpanKind.CLIENT,
      attributes: {
        'service.name': serviceName,
        'operation.name': operation,
        'operation.type': 'external',
      },
    }
  );
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin for automatic request tracing
 */
export function tracingPlugin(
  fastify: any,
  opts: { excludePaths?: string[] },
  done: (err?: Error) => void
): void {
  const excludePaths = opts.excludePaths || ['/health', '/metrics', '/favicon.ico'];

  fastify.addHook('onRequest', (request: any, reply: any, next: (err?: Error) => void) => {
    const path = request.url.split('?')[0];

    // Skip excluded paths
    if (excludePaths.some((p) => path === p || path.startsWith(p + '/'))) {
      return next();
    }

    // Extract parent context from headers
    const parentContext = extractContextFromHeaders(request.headers);

    // Start a new span for this request
    const tracer = getTracer();
    const span = tracer.startSpan(
      `HTTP ${request.method} ${request.routerPath || path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': request.method,
          'http.url': request.url,
          'http.route': request.routerPath || path,
          'http.host': request.headers.host,
          'http.user_agent': request.headers['user-agent'],
          'http.request_id': request.requestId,
        },
      },
      parentContext
    );

    // Store span on request for later access
    request.span = span;

    // Set trace headers on response
    const headers = injectContextToHeaders();
    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }

    // Run the rest of the request in the span context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  });

  fastify.addHook('onResponse', (request: any, reply: any, next: (err?: Error) => void) => {
    const span = request.span as Span | undefined;

    if (span) {
      span.setAttributes({
        'http.status_code': reply.statusCode,
        'http.response_content_length': reply.getHeader('content-length'),
      });

      if (reply.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${reply.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
    }

    next();
  });

  fastify.addHook('onError', (request: any, reply: any, error: Error, next: (err?: Error) => void) => {
    const span = request.span as Span | undefined;

    if (span) {
      recordException(span, error, {
        'error.type': error.name,
        'error.code': (error as any).code,
      });
    }

    next();
  });

  done();
}

// ============================================================================
// Express/Connect Middleware
// ============================================================================

/**
 * Express/Connect middleware for automatic request tracing
 */
export function tracingMiddleware(
  opts: { excludePaths?: string[] } = {}
): (req: any, res: any, next: (err?: Error) => void) => void {
  const excludePaths = opts.excludePaths || ['/health', '/metrics', '/favicon.ico'];

  return (req: any, res: any, next: (err?: Error) => void) => {
    const path = req.path || req.url.split('?')[0];

    // Skip excluded paths
    if (excludePaths.some((p) => path === p || path.startsWith(p + '/'))) {
      return next();
    }

    // Extract parent context from headers
    const parentContext = extractContextFromHeaders(req.headers);

    // Start a new span
    const tracer = getTracer();
    const span = tracer.startSpan(
      `HTTP ${req.method} ${path}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.route': path,
          'http.host': req.headers.host,
          'http.user_agent': req.headers['user-agent'],
        },
      },
      parentContext
    );

    // Store span on request
    req.span = span;

    // Inject trace headers
    const headers = injectContextToHeaders();
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }

    // Capture response finish
    const originalEnd = res.end;
    res.end = function (...args: any[]) {
      span.setAttributes({
        'http.status_code': res.statusCode,
      });

      if (res.statusCode >= 400) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: `HTTP ${res.statusCode}`,
        });
      } else {
        span.setStatus({ code: SpanStatusCode.OK });
      }

      span.end();
      return originalEnd.apply(res, args);
    };

    // Run in span context
    context.with(trace.setSpan(context.active(), span), () => {
      next();
    });
  };
}
