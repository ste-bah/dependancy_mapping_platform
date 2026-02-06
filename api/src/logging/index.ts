/**
 * Logging Module
 * @module logging
 *
 * Exports all logging infrastructure components for the IaC dependency detection system.
 * Provides structured logging, metrics, audit logging, and distributed tracing.
 *
 * TASK-DETECT: Logging infrastructure
 */

// ============================================================================
// Core Logger
// ============================================================================

export {
  // Types
  LogContext,
  LoggerConfig,
  StructuredLogger,
  // Factory functions
  createLogger,
  getLogger,
  initLogger,
  resetLogger,
  // Utility functions
  createModuleLogger,
  createScanLogger,
  createJobLogger,
  withLogging,
} from './logger';

// ============================================================================
// Request Context
// ============================================================================

export {
  // Types
  RequestContext,
  CreateRequestContextOptions,
  RequestLoggerPluginOptions,
  // Context management
  createRequestContext,
  runWithContext,
  runWithContextAsync,
  getRequestContext,
  getRequestLogger,
  getRequestId,
  getTraceContext,
  addRequestMetadata,
  getRequestDuration,
  getRequestDurationHr,
  // Plugins/Middleware
  requestLoggerPlugin,
  requestLoggerMiddleware,
  // Utilities
  withRequestContext,
  createChildSpan,
} from './request-context';

// ============================================================================
// Metrics
// ============================================================================

export {
  // Registry
  metricsRegistry,
  // HTTP metrics
  httpRequestsTotal,
  httpRequestDuration,
  httpRequestSize,
  httpResponseSize,
  httpActiveConnections,
  // Scan metrics
  scansTotal,
  scanDuration,
  activeScans,
  nodesPerScan,
  edgesPerScan,
  filesPerScan,
  // Parser metrics
  parserInvocations,
  parserDuration,
  parserErrors,
  parsedFileSize,
  // Detector metrics
  detectorInvocations,
  detectorDuration,
  detectorEdgesCreated,
  // Graph metrics
  graphBuildDuration,
  graphValidationDuration,
  graphSize,
  // Repository metrics
  repositoryClones,
  repositoryCloneDuration,
  repositorySize,
  // Queue metrics
  queueDepth,
  jobsProcessed,
  jobDuration,
  jobWaitTime,
  jobRetries,
  // Database metrics
  dbQueries,
  dbQueryDuration,
  dbConnectionPool,
  // Error metrics
  errorsTotal,
  unhandledErrors,
  // Cache metrics
  cacheOperations,
  cacheSize,
  // External service metrics
  externalRequests,
  externalRequestDuration,
  // Helper object
  metrics,
  // Functions
  getMetrics,
  getMetricsContentType,
  resetMetrics,
  // Plugin
  metricsPlugin,
} from './metrics';

// ============================================================================
// Audit Logging
// ============================================================================

export {
  // Enums
  AuditEventType,
  AuditSeverity,
  AuditOutcome,
  // Types
  AuditActor,
  AuditTarget,
  AuditEvent,
  AuditChange,
  CreateAuditEventOptions,
  // Class
  AuditLogger,
  // Factory functions
  getAuditLogger,
  createAuditLogger,
  resetAuditLogger,
  // Convenience functions
  audit,
  createAuditChange,
  compareForAudit,
} from './audit';

// ============================================================================
// Distributed Tracing
// ============================================================================

export {
  // Types
  TracingConfig,
  SpanContext,
  CreateSpanOptions,
  // Initialization
  initTracing,
  shutdownTracing,
  // Tracer access
  getTracer,
  getActiveSpan,
  getCurrentContext,
  // Span creation
  startSpan,
  withSpan,
  withSpanAsync,
  // Span utilities
  recordException,
  addSpanAttributes,
  addSpanEvent,
  setSpanStatus,
  // Context propagation
  extractContextFromHeaders,
  injectContextToHeaders,
  getTraceContext as getTracingContext,
  // Domain-specific tracing
  traceScan,
  traceParser,
  traceDetector,
  traceDatabase,
  traceHttpRequest,
  traceExternalService,
  // Plugins/Middleware
  tracingPlugin,
  tracingMiddleware,
} from './tracing';

// Re-export OpenTelemetry types that consumers might need
export { SpanKind, SpanStatusCode, Span } from '@opentelemetry/api';

// ============================================================================
// Documentation Module Logging
// ============================================================================

export {
  // Child loggers
  documentationLogger,
  betaLogger,
  launchLogger,
  openApiLogger,
  // Documentation page logging
  logDocPageCreated,
  logDocPageUpdated,
  logDocPagePublished,
  logDocPageArchived,
  logDocPageDeleted,
  logDocPageViewed,
  // Beta customer logging
  logBetaCustomerRegistered,
  logNdaSigned,
  logOnboardingStarted,
  logOnboardingStepCompleted,
  logOnboardingCompleted,
  logBetaAccessGranted,
  logBetaAccessRevoked,
  // Launch checklist logging
  logChecklistItemCompleted,
  logChecklistItemUncompleted,
  logBlockerIdentified,
  logBlockerResolved,
  logLaunchReadinessAssessed,
  logLaunchApproved,
  // OpenAPI generation logging
  logOpenApiGenerationStarted,
  logOpenApiGenerated,
  logOpenApiGenerationFailed,
  logOpenApiValidated,
  // Utilities
  maskEmail,
  maskName,
} from './documentation';

// ============================================================================
// Combined Initialization
// ============================================================================

import { initLogger, LogContext } from './logger';
import { initTracing, TracingConfig } from './tracing';

/**
 * Combined logging configuration
 */
export interface LoggingConfig {
  /** Logger context */
  loggerContext?: LogContext;
  /** Tracing configuration */
  tracing?: Partial<TracingConfig>;
  /** Enable tracing */
  enableTracing?: boolean;
}

/**
 * Initializes all logging infrastructure
 */
export function initLogging(config: LoggingConfig = {}): void {
  // Initialize logger
  initLogger(config.loggerContext);

  // Initialize tracing if enabled
  if (config.enableTracing !== false && config.tracing) {
    initTracing(config.tracing);
  }
}

/**
 * Shuts down all logging infrastructure
 */
export async function shutdownLogging(): Promise<void> {
  const { shutdownTracing } = await import('./tracing');
  await shutdownTracing();
}

// ============================================================================
// Fastify Plugin (Combined)
// ============================================================================

/**
 * Combined Fastify plugin options
 */
export interface LoggingPluginOptions {
  /** Request logger options */
  requestLogger?: import('./request-context').RequestLoggerPluginOptions;
  /** Metrics options */
  metrics?: { path?: string; excludePaths?: string[] };
  /** Tracing options */
  tracing?: { excludePaths?: string[] };
  /** Enable metrics endpoint */
  enableMetrics?: boolean;
  /** Enable tracing */
  enableTracing?: boolean;
}

/**
 * Combined Fastify plugin for all logging features
 */
export function loggingPlugin(
  fastify: any,
  opts: LoggingPluginOptions,
  done: (err?: Error) => void
): void {
  const {
    requestLogger = {},
    metrics: metricsOpts = {},
    tracing: tracingOpts = {},
    enableMetrics = true,
    enableTracing = true,
  } = opts;

  // Register request logger
  fastify.register(
    require('./request-context').requestLoggerPlugin,
    requestLogger
  );

  // Register metrics if enabled
  if (enableMetrics) {
    fastify.register(
      require('./metrics').metricsPlugin,
      metricsOpts
    );
  }

  // Register tracing if enabled
  if (enableTracing) {
    fastify.register(
      require('./tracing').tracingPlugin,
      tracingOpts
    );
  }

  done();
}
