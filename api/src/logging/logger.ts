/**
 * Core Structured Logger
 * @module logging/logger
 *
 * Provides structured logging with Pino for the IaC dependency detection system.
 * Includes domain-specific logging methods for scans, parsers, detectors, and graphs.
 *
 * TASK-DETECT: Logging infrastructure
 */

import pino, { Logger, LoggerOptions, DestinationStream } from 'pino';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Log context that can be attached to log entries
 */
export interface LogContext {
  requestId?: string;
  scanId?: string;
  userId?: string;
  tenantId?: string;
  operation?: string;
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  service?: string;
  version?: string;
  environment?: string;
  [key: string]: unknown;
}

/**
 * Configuration for the logger
 */
export interface LoggerConfig {
  level: string;
  pretty: boolean;
  redact: string[];
  service: string;
  version: string;
  environment: string;
}

/**
 * Extended logger interface with domain-specific methods
 */
export interface StructuredLogger extends Logger {
  child(bindings: LogContext): StructuredLogger;
  withContext(context: LogContext): StructuredLogger;

  // Scan lifecycle methods
  scanStarted(scanId: string, repositoryId: string, metadata?: Record<string, unknown>): void;
  scanCompleted(scanId: string, duration: number, nodeCount: number, edgeCount?: number): void;
  scanFailed(scanId: string, error: Error, metadata?: Record<string, unknown>): void;
  scanCancelled(scanId: string, reason: string): void;

  // Parser methods
  parserStarted(parser: string, filePath: string): void;
  parserCompleted(parser: string, filePath: string, duration: number, nodeCount?: number): void;
  parserFailed(parser: string, filePath: string, error: Error): void;
  parserSkipped(parser: string, filePath: string, reason: string): void;

  // Detector methods
  detectorStarted(detector: string, nodeCount: number): void;
  detectorCompleted(detector: string, edgesCreated: number, duration: number): void;
  detectorFailed(detector: string, error: Error): void;

  // Graph methods
  graphBuilt(scanId: string, nodeCount: number, edgeCount: number, duration?: number): void;
  graphValidated(scanId: string, isValid: boolean, issues?: string[]): void;

  // Repository methods
  repositoryCloneStarted(repositoryUrl: string, ref?: string): void;
  repositoryCloneCompleted(repositoryUrl: string, duration: number): void;
  repositoryCloneFailed(repositoryUrl: string, error: Error): void;

  // Queue/Job methods
  jobEnqueued(jobId: string, jobType: string, priority?: number): void;
  jobStarted(jobId: string, jobType: string): void;
  jobCompleted(jobId: string, jobType: string, duration: number): void;
  jobFailed(jobId: string, jobType: string, error: Error, retryCount?: number): void;

  // Performance methods
  performanceMetric(operation: string, duration: number, metadata?: Record<string, unknown>): void;
}

// ============================================================================
// Default Configuration
// ============================================================================

const defaultConfig: LoggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  pretty: process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV === 'development',
  redact: [
    'password',
    'token',
    'authorization',
    'apiKey',
    'api_key',
    'secret',
    'secretKey',
    'secret_key',
    'accessToken',
    'access_token',
    'refreshToken',
    'refresh_token',
    'privateKey',
    'private_key',
    'creditCard',
    'credit_card',
    'ssn',
    'headers.authorization',
    'headers.cookie',
    'body.password',
    'body.token',
    'body.secret',
  ],
  service: process.env.SERVICE_NAME || 'iac-detector',
  version: process.env.SERVICE_VERSION || '1.0.0',
  environment: process.env.NODE_ENV || 'development',
};

// ============================================================================
// Redaction Utilities
// ============================================================================

/**
 * Creates a redaction function for sensitive data paths
 */
function createRedactionPaths(paths: string[]): string[] {
  const expandedPaths: string[] = [];

  for (const path of paths) {
    expandedPaths.push(path);
    // Also redact nested variations
    expandedPaths.push(`*.${path}`);
    expandedPaths.push(`[*].${path}`);
  }

  return expandedPaths;
}

// ============================================================================
// Domain Method Extensions
// ============================================================================

/**
 * Extends a Pino logger with domain-specific methods
 */
function extendWithDomainMethods(logger: Logger): StructuredLogger {
  const extended = logger as StructuredLogger;

  // Scan lifecycle methods
  extended.scanStarted = function (
    scanId: string,
    repositoryId: string,
    metadata?: Record<string, unknown>
  ) {
    this.info(
      {
        event: 'scan_started',
        scanId,
        repositoryId,
        ...metadata,
      },
      `Scan started for repository ${repositoryId}`
    );
  };

  extended.scanCompleted = function (
    scanId: string,
    duration: number,
    nodeCount: number,
    edgeCount?: number
  ) {
    this.info(
      {
        event: 'scan_completed',
        scanId,
        durationMs: duration,
        nodeCount,
        edgeCount,
        nodesPerSecond: duration > 0 ? Math.round((nodeCount / duration) * 1000) : 0,
      },
      `Scan completed: ${nodeCount} nodes${edgeCount !== undefined ? `, ${edgeCount} edges` : ''} in ${duration}ms`
    );
  };

  extended.scanFailed = function (
    scanId: string,
    error: Error,
    metadata?: Record<string, unknown>
  ) {
    this.error(
      {
        event: 'scan_failed',
        scanId,
        err: error,
        errorCode: (error as any).code,
        ...metadata,
      },
      `Scan failed: ${error.message}`
    );
  };

  extended.scanCancelled = function (scanId: string, reason: string) {
    this.warn(
      {
        event: 'scan_cancelled',
        scanId,
        reason,
      },
      `Scan cancelled: ${reason}`
    );
  };

  // Parser methods
  extended.parserStarted = function (parser: string, filePath: string) {
    this.debug(
      {
        event: 'parser_started',
        parser,
        filePath,
      },
      `Parser ${parser} started for ${filePath}`
    );
  };

  extended.parserCompleted = function (
    parser: string,
    filePath: string,
    duration: number,
    nodeCount?: number
  ) {
    this.debug(
      {
        event: 'parser_completed',
        parser,
        filePath,
        durationMs: duration,
        nodeCount,
      },
      `Parser ${parser} completed in ${duration}ms${nodeCount !== undefined ? ` (${nodeCount} nodes)` : ''}`
    );
  };

  extended.parserFailed = function (parser: string, filePath: string, error: Error) {
    this.warn(
      {
        event: 'parser_failed',
        parser,
        filePath,
        err: error,
        errorCode: (error as any).code,
      },
      `Parser ${parser} failed for ${filePath}: ${error.message}`
    );
  };

  extended.parserSkipped = function (parser: string, filePath: string, reason: string) {
    this.debug(
      {
        event: 'parser_skipped',
        parser,
        filePath,
        reason,
      },
      `Parser ${parser} skipped ${filePath}: ${reason}`
    );
  };

  // Detector methods
  extended.detectorStarted = function (detector: string, nodeCount: number) {
    this.debug(
      {
        event: 'detector_started',
        detector,
        inputNodeCount: nodeCount,
      },
      `Detector ${detector} started with ${nodeCount} nodes`
    );
  };

  extended.detectorCompleted = function (
    detector: string,
    edgesCreated: number,
    duration: number
  ) {
    this.debug(
      {
        event: 'detector_completed',
        detector,
        edgesCreated,
        durationMs: duration,
        edgesPerSecond: duration > 0 ? Math.round((edgesCreated / duration) * 1000) : 0,
      },
      `Detector ${detector} completed: ${edgesCreated} edges in ${duration}ms`
    );
  };

  extended.detectorFailed = function (detector: string, error: Error) {
    this.error(
      {
        event: 'detector_failed',
        detector,
        err: error,
        errorCode: (error as any).code,
      },
      `Detector ${detector} failed: ${error.message}`
    );
  };

  // Graph methods
  extended.graphBuilt = function (
    scanId: string,
    nodeCount: number,
    edgeCount: number,
    duration?: number
  ) {
    this.info(
      {
        event: 'graph_built',
        scanId,
        nodeCount,
        edgeCount,
        durationMs: duration,
        avgEdgesPerNode: nodeCount > 0 ? (edgeCount / nodeCount).toFixed(2) : 0,
      },
      `Graph built: ${nodeCount} nodes, ${edgeCount} edges`
    );
  };

  extended.graphValidated = function (scanId: string, isValid: boolean, issues?: string[]) {
    if (isValid) {
      this.debug(
        {
          event: 'graph_validated',
          scanId,
          isValid,
        },
        'Graph validation passed'
      );
    } else {
      this.warn(
        {
          event: 'graph_validated',
          scanId,
          isValid,
          issues,
          issueCount: issues?.length || 0,
        },
        `Graph validation failed with ${issues?.length || 0} issues`
      );
    }
  };

  // Repository methods
  extended.repositoryCloneStarted = function (repositoryUrl: string, ref?: string) {
    this.info(
      {
        event: 'repository_clone_started',
        repositoryUrl: sanitizeUrl(repositoryUrl),
        ref,
      },
      `Cloning repository${ref ? ` at ${ref}` : ''}`
    );
  };

  extended.repositoryCloneCompleted = function (repositoryUrl: string, duration: number) {
    this.info(
      {
        event: 'repository_clone_completed',
        repositoryUrl: sanitizeUrl(repositoryUrl),
        durationMs: duration,
      },
      `Repository cloned in ${duration}ms`
    );
  };

  extended.repositoryCloneFailed = function (repositoryUrl: string, error: Error) {
    this.error(
      {
        event: 'repository_clone_failed',
        repositoryUrl: sanitizeUrl(repositoryUrl),
        err: error,
        errorCode: (error as any).code,
      },
      `Repository clone failed: ${error.message}`
    );
  };

  // Queue/Job methods
  extended.jobEnqueued = function (jobId: string, jobType: string, priority?: number) {
    this.debug(
      {
        event: 'job_enqueued',
        jobId,
        jobType,
        priority,
      },
      `Job ${jobId} enqueued (${jobType})`
    );
  };

  extended.jobStarted = function (jobId: string, jobType: string) {
    this.debug(
      {
        event: 'job_started',
        jobId,
        jobType,
      },
      `Job ${jobId} started (${jobType})`
    );
  };

  extended.jobCompleted = function (jobId: string, jobType: string, duration: number) {
    this.info(
      {
        event: 'job_completed',
        jobId,
        jobType,
        durationMs: duration,
      },
      `Job ${jobId} completed in ${duration}ms`
    );
  };

  extended.jobFailed = function (
    jobId: string,
    jobType: string,
    error: Error,
    retryCount?: number
  ) {
    this.error(
      {
        event: 'job_failed',
        jobId,
        jobType,
        err: error,
        errorCode: (error as any).code,
        retryCount,
      },
      `Job ${jobId} failed: ${error.message}${retryCount !== undefined ? ` (retry ${retryCount})` : ''}`
    );
  };

  // Performance methods
  extended.performanceMetric = function (
    operation: string,
    duration: number,
    metadata?: Record<string, unknown>
  ) {
    this.debug(
      {
        event: 'performance_metric',
        operation,
        durationMs: duration,
        ...metadata,
      },
      `${operation}: ${duration}ms`
    );
  };

  // Override child to preserve domain methods
  const originalChild = extended.child.bind(extended);
  extended.child = function (bindings: LogContext): StructuredLogger {
    const childLogger = originalChild(bindings);
    return extendWithDomainMethods(childLogger);
  };

  // Add withContext alias
  extended.withContext = function (context: LogContext): StructuredLogger {
    return this.child(context);
  };

  return extended;
}

// ============================================================================
// URL Sanitization
// ============================================================================

/**
 * Sanitizes a URL by removing credentials
 */
function sanitizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password) {
      parsed.username = '[REDACTED]';
      parsed.password = '';
    }
    return parsed.toString();
  } catch {
    // If URL parsing fails, do basic sanitization
    return url.replace(/\/\/[^:]+:[^@]+@/, '//[REDACTED]@');
  }
}

// ============================================================================
// Logger Factory
// ============================================================================

/**
 * Creates a new structured logger instance
 */
export function createLogger(name: string, baseContext?: LogContext): StructuredLogger {
  const config = { ...defaultConfig };

  // Override from environment if available
  if (process.env.LOG_LEVEL) {
    config.level = process.env.LOG_LEVEL;
  }

  const options: LoggerOptions = {
    name,
    level: config.level,
    formatters: {
      level: (label) => ({ level: label }),
      bindings: (bindings) => ({
        pid: bindings.pid,
        hostname: bindings.hostname,
        name: bindings.name,
        service: config.service,
        version: config.version,
        environment: config.environment,
      }),
    },
    redact: {
      paths: createRedactionPaths(config.redact),
      censor: '[REDACTED]',
    },
    serializers: {
      err: pino.stdSerializers.err,
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: config.service,
      version: config.version,
      env: config.environment,
    },
  };

  let destination: DestinationStream | undefined;

  if (config.pretty && config.environment !== 'production') {
    // Pretty printing for development
    try {
      destination = pino.transport({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{msg}',
        },
      });
    } catch {
      // pino-pretty not available, use standard output
      destination = undefined;
    }
  }

  const baseLogger = destination ? pino(options, destination) : pino(options);

  // Create child with base context if provided
  const logger = baseContext ? baseLogger.child(baseContext) : baseLogger;

  // Extend with domain methods
  return extendWithDomainMethods(logger);
}

// ============================================================================
// Singleton Root Logger
// ============================================================================

let rootLogger: StructuredLogger | null = null;

/**
 * Gets the root logger instance (creates if not exists)
 */
export function getLogger(): StructuredLogger {
  if (!rootLogger) {
    rootLogger = createLogger('iac-detector');
  }
  return rootLogger;
}

/**
 * Initializes the root logger with custom configuration
 */
export function initLogger(context?: LogContext): StructuredLogger {
  rootLogger = createLogger('iac-detector', context);
  return rootLogger;
}

/**
 * Resets the root logger (primarily for testing)
 */
export function resetLogger(): void {
  rootLogger = null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Creates a logger for a specific module/component
 */
export function createModuleLogger(moduleName: string): StructuredLogger {
  return getLogger().child({ module: moduleName });
}

/**
 * Creates a logger for a specific scan operation
 */
export function createScanLogger(scanId: string, repositoryId?: string): StructuredLogger {
  return getLogger().child({
    scanId,
    repositoryId,
    operation: 'scan',
  });
}

/**
 * Creates a logger for a specific job
 */
export function createJobLogger(jobId: string, jobType: string): StructuredLogger {
  return getLogger().child({
    jobId,
    jobType,
    operation: 'job',
  });
}

/**
 * Wraps an async function with timing and logging
 */
export function withLogging<T>(
  logger: StructuredLogger,
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now();

  return fn()
    .then((result) => {
      const duration = Date.now() - startTime;
      logger.performanceMetric(operation, duration, { status: 'success' });
      return result;
    })
    .catch((error) => {
      const duration = Date.now() - startTime;
      logger.performanceMetric(operation, duration, { status: 'error' });
      throw error;
    });
}
