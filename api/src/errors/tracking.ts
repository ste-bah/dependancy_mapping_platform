/**
 * Error Tracking Integration
 * @module errors/tracking
 *
 * Error tracking hooks and integration points for external error reporting services.
 * Provides a unified interface for error tracking with Sentry-like capabilities.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { BaseError, isBaseError, isOperationalError, ErrorContext } from './base';
import { ErrorCode, isServerError } from './codes';

// ============================================================================
// Error Severity Levels
// ============================================================================

/**
 * Error severity levels for tracking
 */
export enum ErrorSeverity {
  /** Debug-level issues, not usually tracked */
  DEBUG = 'debug',
  /** Informational issues */
  INFO = 'info',
  /** Warnings that don't affect functionality */
  WARNING = 'warning',
  /** Errors that affect functionality but are recoverable */
  ERROR = 'error',
  /** Critical errors that require immediate attention */
  CRITICAL = 'critical',
  /** Fatal errors that cause system failure */
  FATAL = 'fatal',
}

// ============================================================================
// Error Report Types
// ============================================================================

/**
 * Complete error report for external tracking
 */
export interface ErrorReport {
  /** Unique report ID */
  id: string;
  /** The error being reported */
  error: Error;
  /** Error severity */
  severity: ErrorSeverity;
  /** Context information */
  context: ErrorReportContext;
  /** Timestamp when the error occurred */
  timestamp: Date;
  /** Tags for categorization */
  tags: Record<string, string>;
  /** Extra data for debugging */
  extras: Record<string, unknown>;
  /** User information if available */
  user?: ErrorReportUser;
  /** Breadcrumbs leading up to the error */
  breadcrumbs: Breadcrumb[];
  /** Whether the error has been handled */
  handled: boolean;
}

/**
 * Context for error reports
 */
export interface ErrorReportContext {
  /** Request ID for tracing */
  requestId?: string;
  /** Tenant ID */
  tenantId?: string;
  /** Operation being performed */
  operation?: string;
  /** Environment (development, staging, production) */
  environment: string;
  /** Application version */
  version: string;
  /** Server hostname */
  hostname?: string;
  /** Node.js version */
  nodeVersion?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * User information for error reports
 */
export interface ErrorReportUser {
  id: string;
  email?: string;
  username?: string;
  ipAddress?: string;
}

/**
 * Breadcrumb for tracking actions leading to error
 */
export interface Breadcrumb {
  /** Timestamp of the action */
  timestamp: Date;
  /** Category of the breadcrumb */
  category: BreadcrumbCategory;
  /** Message describing the action */
  message: string;
  /** Severity level */
  level: 'debug' | 'info' | 'warning' | 'error';
  /** Additional data */
  data?: Record<string, unknown>;
}

/**
 * Breadcrumb categories
 */
export type BreadcrumbCategory =
  | 'http'
  | 'query'
  | 'navigation'
  | 'ui'
  | 'user'
  | 'console'
  | 'error'
  | 'custom';

// ============================================================================
// Error Reporter Backend Interface
// ============================================================================

/**
 * Interface for error reporter backends (Sentry, Datadog, etc.)
 */
export interface IErrorReporterBackend {
  /** Backend name for identification */
  readonly name: string;

  /**
   * Report an error to the backend
   */
  report(report: ErrorReport): Promise<void>;

  /**
   * Add a breadcrumb
   */
  addBreadcrumb?(breadcrumb: Breadcrumb): void;

  /**
   * Set user context
   */
  setUser?(user: ErrorReportUser | null): void;

  /**
   * Set tag value
   */
  setTag?(key: string, value: string): void;

  /**
   * Set extra data
   */
  setExtra?(key: string, value: unknown): void;

  /**
   * Flush pending events
   */
  flush?(): Promise<boolean>;

  /**
   * Check if backend is healthy
   */
  healthCheck?(): Promise<boolean>;
}

// ============================================================================
// Error Reporter Implementation
// ============================================================================

/**
 * Error reporter configuration
 */
export interface ErrorReporterConfig {
  /** Environment name */
  environment: string;
  /** Application version */
  version: string;
  /** Enable/disable reporting */
  enabled: boolean;
  /** Minimum severity to report */
  minSeverity: ErrorSeverity;
  /** Maximum breadcrumbs to keep */
  maxBreadcrumbs: number;
  /** Sample rate for error reporting (0-1) */
  sampleRate: number;
  /** Error codes to ignore */
  ignoreCodes: ErrorCode[];
  /** Custom severity mapper */
  severityMapper?: (error: Error) => ErrorSeverity;
  /** Before send hook (return false to skip) */
  beforeSend?: (report: ErrorReport) => boolean | ErrorReport;
}

/**
 * Default error reporter configuration
 */
export const DEFAULT_ERROR_REPORTER_CONFIG: ErrorReporterConfig = {
  environment: process.env.NODE_ENV ?? 'development',
  version: process.env.APP_VERSION ?? '0.0.0',
  enabled: true,
  minSeverity: ErrorSeverity.WARNING,
  maxBreadcrumbs: 100,
  sampleRate: 1.0,
  ignoreCodes: [],
};

/**
 * Central error reporter with support for multiple backends
 */
export class ErrorReporter {
  private readonly backends: IErrorReporterBackend[] = [];
  private readonly breadcrumbs: Breadcrumb[] = [];
  private readonly tags: Map<string, string> = new Map();
  private readonly extras: Map<string, unknown> = new Map();
  private currentUser: ErrorReportUser | null = null;
  private reportCounter = 0;

  constructor(private readonly config: ErrorReporterConfig) {}

  /**
   * Add a reporter backend
   */
  addBackend(backend: IErrorReporterBackend): void {
    this.backends.push(backend);
  }

  /**
   * Remove a reporter backend
   */
  removeBackend(name: string): boolean {
    const index = this.backends.findIndex(b => b.name === name);
    if (index !== -1) {
      this.backends.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Report an error
   */
  async report(
    error: Error,
    context: Partial<ErrorReportContext> = {}
  ): Promise<string | null> {
    if (!this.config.enabled) return null;

    // Apply sampling
    if (Math.random() > this.config.sampleRate) return null;

    const severity = this.determineSeverity(error);

    // Check minimum severity
    if (this.severityOrder(severity) < this.severityOrder(this.config.minSeverity)) {
      return null;
    }

    // Check ignored codes
    if (isBaseError(error) && this.config.ignoreCodes.includes(error.code)) {
      return null;
    }

    const report = this.createReport(error, severity, context);

    // Apply beforeSend hook
    if (this.config.beforeSend) {
      const result = this.config.beforeSend(report);
      if (result === false) return null;
      if (typeof result === 'object') {
        Object.assign(report, result);
      }
    }

    // Send to all backends
    await Promise.all(
      this.backends.map(backend =>
        backend.report(report).catch(e => {
          console.error(`Error reporter backend '${backend.name}' failed:`, e);
        })
      )
    );

    return report.id;
  }

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(
    category: BreadcrumbCategory,
    message: string,
    data?: Record<string, unknown>,
    level: Breadcrumb['level'] = 'info'
  ): void {
    const breadcrumb: Breadcrumb = {
      timestamp: new Date(),
      category,
      message,
      level,
      data,
    };

    this.breadcrumbs.push(breadcrumb);

    // Trim breadcrumbs if exceeding max
    while (this.breadcrumbs.length > this.config.maxBreadcrumbs) {
      this.breadcrumbs.shift();
    }

    // Forward to backends
    for (const backend of this.backends) {
      backend.addBreadcrumb?.(breadcrumb);
    }
  }

  /**
   * Set user context
   */
  setUser(user: ErrorReportUser | null): void {
    this.currentUser = user;
    for (const backend of this.backends) {
      backend.setUser?.(user);
    }
  }

  /**
   * Set a tag
   */
  setTag(key: string, value: string): void {
    this.tags.set(key, value);
    for (const backend of this.backends) {
      backend.setTag?.(key, value);
    }
  }

  /**
   * Set extra data
   */
  setExtra(key: string, value: unknown): void {
    this.extras.set(key, value);
    for (const backend of this.backends) {
      backend.setExtra?.(key, value);
    }
  }

  /**
   * Clear current context
   */
  clearContext(): void {
    this.breadcrumbs.length = 0;
    this.tags.clear();
    this.extras.clear();
    this.currentUser = null;
  }

  /**
   * Flush all pending events
   */
  async flush(): Promise<void> {
    await Promise.all(
      this.backends.map(backend => backend.flush?.() ?? Promise.resolve(true))
    );
  }

  /**
   * Get reporter statistics
   */
  getStats(): ErrorReporterStats {
    return {
      totalReports: this.reportCounter,
      backendsCount: this.backends.length,
      breadcrumbsCount: this.breadcrumbs.length,
      tagsCount: this.tags.size,
      extrasCount: this.extras.size,
      hasUser: this.currentUser !== null,
    };
  }

  private createReport(
    error: Error,
    severity: ErrorSeverity,
    contextOverrides: Partial<ErrorReportContext>
  ): ErrorReport {
    this.reportCounter++;

    return {
      id: `err-${Date.now()}-${this.reportCounter}`,
      error,
      severity,
      context: {
        environment: this.config.environment,
        version: this.config.version,
        hostname: this.getHostname(),
        nodeVersion: process.version,
        ...contextOverrides,
      },
      timestamp: new Date(),
      tags: Object.fromEntries(this.tags),
      extras: {
        ...Object.fromEntries(this.extras),
        ...(isBaseError(error) ? { errorContext: error.context } : {}),
      },
      user: this.currentUser ?? undefined,
      breadcrumbs: [...this.breadcrumbs],
      handled: isOperationalError(error),
    };
  }

  private determineSeverity(error: Error): ErrorSeverity {
    // Use custom mapper if provided
    if (this.config.severityMapper) {
      return this.config.severityMapper(error);
    }

    // Use default severity mapping
    if (isBaseError(error)) {
      if (!error.isOperational) {
        return ErrorSeverity.FATAL;
      }
      if (isServerError(error.code)) {
        return ErrorSeverity.ERROR;
      }
      return ErrorSeverity.WARNING;
    }

    // Default for unknown errors
    return ErrorSeverity.ERROR;
  }

  private severityOrder(severity: ErrorSeverity): number {
    const order: Record<ErrorSeverity, number> = {
      [ErrorSeverity.DEBUG]: 0,
      [ErrorSeverity.INFO]: 1,
      [ErrorSeverity.WARNING]: 2,
      [ErrorSeverity.ERROR]: 3,
      [ErrorSeverity.CRITICAL]: 4,
      [ErrorSeverity.FATAL]: 5,
    };
    return order[severity];
  }

  private getHostname(): string | undefined {
    try {
      return require('os').hostname();
    } catch {
      return undefined;
    }
  }
}

/**
 * Error reporter statistics
 */
export interface ErrorReporterStats {
  totalReports: number;
  backendsCount: number;
  breadcrumbsCount: number;
  tagsCount: number;
  extrasCount: number;
  hasUser: boolean;
}

// ============================================================================
// Console Reporter Backend (for development)
// ============================================================================

/**
 * Console reporter backend for development
 */
export class ConsoleReporterBackend implements IErrorReporterBackend {
  readonly name = 'console';

  async report(report: ErrorReport): Promise<void> {
    const prefix = `[${report.severity.toUpperCase()}] ${report.id}`;
    const errorInfo = {
      message: report.error.message,
      name: report.error.name,
      code: isBaseError(report.error) ? report.error.code : undefined,
      stack: report.error.stack,
    };

    console.group(prefix);
    console.error('Error:', errorInfo);
    console.info('Context:', report.context);
    console.info('Tags:', report.tags);
    if (Object.keys(report.extras).length > 0) {
      console.info('Extras:', report.extras);
    }
    if (report.user) {
      console.info('User:', report.user);
    }
    if (report.breadcrumbs.length > 0) {
      console.info('Breadcrumbs:', report.breadcrumbs.slice(-10));
    }
    console.groupEnd();
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    if (process.env.DEBUG) {
      console.debug(`[Breadcrumb] ${breadcrumb.category}: ${breadcrumb.message}`);
    }
  }
}

// ============================================================================
// Null Reporter Backend (for testing)
// ============================================================================

/**
 * Null reporter backend for testing
 */
export class NullReporterBackend implements IErrorReporterBackend {
  readonly name = 'null';
  public readonly reports: ErrorReport[] = [];
  public readonly breadcrumbs: Breadcrumb[] = [];

  async report(report: ErrorReport): Promise<void> {
    this.reports.push(report);
  }

  addBreadcrumb(breadcrumb: Breadcrumb): void {
    this.breadcrumbs.push(breadcrumb);
  }

  clear(): void {
    this.reports.length = 0;
    this.breadcrumbs.length = 0;
  }
}

// ============================================================================
// HTTP Reporter Backend (for remote services)
// ============================================================================

/**
 * HTTP reporter backend for sending to remote services
 */
export class HttpReporterBackend implements IErrorReporterBackend {
  readonly name: string;
  private pendingReports: ErrorReport[] = [];

  constructor(
    private readonly endpoint: string,
    private readonly options: {
      name?: string;
      headers?: Record<string, string>;
      batchSize?: number;
      flushInterval?: number;
    } = {}
  ) {
    this.name = options.name ?? 'http';

    // Set up periodic flushing
    if (options.flushInterval) {
      setInterval(() => this.flush(), options.flushInterval);
    }
  }

  async report(report: ErrorReport): Promise<void> {
    this.pendingReports.push(report);

    // Flush if batch size reached
    if (this.options.batchSize && this.pendingReports.length >= this.options.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<boolean> {
    if (this.pendingReports.length === 0) return true;

    const reports = [...this.pendingReports];
    this.pendingReports = [];

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.options.headers,
        },
        body: JSON.stringify(reports.map(r => this.serializeReport(r))),
      });

      if (!response.ok) {
        // Re-queue failed reports
        this.pendingReports.push(...reports);
        return false;
      }

      return true;
    } catch (error) {
      // Re-queue failed reports
      this.pendingReports.push(...reports);
      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(this.endpoint.replace(/\/report$/, '/health'), {
        method: 'GET',
        headers: this.options.headers,
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private serializeReport(report: ErrorReport): Record<string, unknown> {
    return {
      id: report.id,
      timestamp: report.timestamp.toISOString(),
      severity: report.severity,
      handled: report.handled,
      error: {
        name: report.error.name,
        message: report.error.message,
        stack: report.error.stack,
        code: isBaseError(report.error) ? report.error.code : undefined,
      },
      context: report.context,
      tags: report.tags,
      extras: report.extras,
      user: report.user,
      breadcrumbs: report.breadcrumbs.map(b => ({
        timestamp: b.timestamp.toISOString(),
        category: b.category,
        message: b.message,
        level: b.level,
        data: b.data,
      })),
    };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an error reporter with default configuration
 */
export function createErrorReporter(
  config: Partial<ErrorReporterConfig> = {}
): ErrorReporter {
  return new ErrorReporter({
    ...DEFAULT_ERROR_REPORTER_CONFIG,
    ...config,
  });
}

/**
 * Create a development error reporter (console logging)
 */
export function createDevErrorReporter(): ErrorReporter {
  const reporter = new ErrorReporter({
    ...DEFAULT_ERROR_REPORTER_CONFIG,
    environment: 'development',
    minSeverity: ErrorSeverity.DEBUG,
  });
  reporter.addBackend(new ConsoleReporterBackend());
  return reporter;
}

/**
 * Create a test error reporter (captures errors for assertions)
 */
export function createTestErrorReporter(): {
  reporter: ErrorReporter;
  backend: NullReporterBackend;
} {
  const backend = new NullReporterBackend();
  const reporter = new ErrorReporter({
    ...DEFAULT_ERROR_REPORTER_CONFIG,
    environment: 'test',
  });
  reporter.addBackend(backend);
  return { reporter, backend };
}
