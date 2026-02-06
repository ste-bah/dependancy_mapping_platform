/**
 * Graph Logger
 * Feature-specific logger with structured logging for the graph visualization feature
 * @module features/graph/utils/logger
 */

import { isDevelopment, isProduction } from '../config/env';

// ============================================================================
// Types
// ============================================================================

/**
 * Log levels for the graph logger
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context information for log entries
 */
export interface LogContext {
  /** Scan identifier */
  scanId?: string;
  /** Node identifier */
  nodeId?: string;
  /** Action being performed */
  action?: string;
  /** Operation duration in milliseconds */
  duration?: number;
  /** Component where the log originated */
  component?: string;
  /** Additional metadata */
  [key: string]: unknown;
}

/**
 * Structured log entry
 */
export interface LogEntry {
  /** Log level */
  level: LogLevel;
  /** Log message */
  message: string;
  /** Timestamp in ISO format */
  timestamp: string;
  /** Feature name (always 'graph') */
  feature: 'graph';
  /** Optional context */
  context?: LogContext;
  /** Error object if present */
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Logger configuration options
 */
export interface LoggerConfig {
  /** Minimum log level to output */
  minLevel: LogLevel;
  /** Enable console output */
  enableConsole: boolean;
  /** Enable structured JSON output */
  enableJson: boolean;
  /** Enable colored console output (development only) */
  enableColors: boolean;
  /** Custom log handler for external integrations */
  customHandler?: (entry: LogEntry) => void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Log level priority for filtering
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Console colors for log levels (ANSI escape codes)
 */
const LOG_LEVEL_COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // Cyan
  info: '\x1b[32m',  // Green
  warn: '\x1b[33m',  // Yellow
  error: '\x1b[31m', // Red
};

const RESET_COLOR = '\x1b[0m';

/**
 * Default configuration based on environment
 */
const DEFAULT_CONFIG: LoggerConfig = {
  minLevel: isDevelopment() ? 'debug' : 'warn',
  enableConsole: true,
  enableJson: isProduction(),
  enableColors: isDevelopment(),
  customHandler: undefined,
};

// ============================================================================
// Logger State
// ============================================================================

let currentConfig: LoggerConfig = { ...DEFAULT_CONFIG };

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a log level should be output based on current config
 */
function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[currentConfig.minLevel];
}

/**
 * Sanitize context to remove potentially sensitive data
 * Ensures no PII is logged
 */
function sanitizeContext(context?: LogContext): LogContext | undefined {
  if (!context) return undefined;

  const sanitized: LogContext = {};
  const sensitiveKeys = ['password', 'token', 'secret', 'apiKey', 'authorization', 'cookie', 'email', 'ssn', 'creditCard'];

  for (const [key, value] of Object.entries(context)) {
    const lowerKey = key.toLowerCase();

    // Check if key contains sensitive patterns
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      // Recursively sanitize nested objects (limited depth)
      sanitized[key] = JSON.parse(JSON.stringify(value, (k, v) => {
        if (sensitiveKeys.some(sensitive => k.toLowerCase().includes(sensitive))) {
          return '[REDACTED]';
        }
        return v;
      }));
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Create a structured log entry
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  context?: LogContext,
  error?: Error
): LogEntry {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    feature: 'graph',
  };

  const sanitizedContext = sanitizeContext(context);
  if (sanitizedContext && Object.keys(sanitizedContext).length > 0) {
    entry.context = sanitizedContext;
  }

  if (error) {
    entry.error = {
      name: error.name,
      message: error.message,
      // Only include stack in development
      ...(isDevelopment() && error.stack && { stack: error.stack }),
    };
  }

  return entry;
}

/**
 * Format log entry for console output
 */
function formatForConsole(entry: LogEntry): string {
  const levelStr = entry.level.toUpperCase().padEnd(5);
  const time = entry.timestamp.split('T')[1]?.slice(0, 12) ?? entry.timestamp;

  let contextStr = '';
  if (entry.context) {
    const parts: string[] = [];
    if (entry.context.scanId) parts.push(`scan:${entry.context.scanId.slice(0, 8)}`);
    if (entry.context.nodeId) parts.push(`node:${entry.context.nodeId.slice(0, 8)}`);
    if (entry.context.action) parts.push(`action:${entry.context.action}`);
    if (entry.context.duration !== undefined) parts.push(`${entry.context.duration}ms`);
    if (parts.length > 0) {
      contextStr = ` [${parts.join(' ')}]`;
    }
  }

  if (currentConfig.enableColors) {
    const color = LOG_LEVEL_COLORS[entry.level];
    return `${color}[${time}] ${levelStr}${RESET_COLOR} [Graph]${contextStr} ${entry.message}`;
  }

  return `[${time}] ${levelStr} [Graph]${contextStr} ${entry.message}`;
}

/**
 * Output log entry to console
 */
function outputToConsole(entry: LogEntry): void {
  if (!currentConfig.enableConsole) return;

  const consoleMethod = entry.level === 'error' ? console.error
    : entry.level === 'warn' ? console.warn
    : entry.level === 'debug' ? console.debug
    : console.log;

  if (currentConfig.enableJson && isProduction()) {
    // Structured JSON output for production log aggregation
    consoleMethod(JSON.stringify(entry));
  } else {
    // Human-readable output for development
    consoleMethod(formatForConsole(entry));

    // Log additional details in development
    if (isDevelopment()) {
      if (entry.context && Object.keys(entry.context).length > 3) {
        console.debug('  Context:', entry.context);
      }
      if (entry.error) {
        console.debug('  Error:', entry.error);
      }
    }
  }
}

/**
 * Process a log entry through all outputs
 */
function processLogEntry(entry: LogEntry): void {
  outputToConsole(entry);

  if (currentConfig.customHandler) {
    try {
      currentConfig.customHandler(entry);
    } catch {
      // Silently fail - don't let logging cause errors
    }
  }
}

// ============================================================================
// Main Logger Interface
// ============================================================================

/**
 * Graph logger for feature-specific logging
 *
 * Provides structured logging with context, automatic PII redaction,
 * and environment-appropriate output formatting.
 *
 * @example
 * ```ts
 * // Basic logging
 * graphLogger.info('Graph loaded successfully', { scanId, nodeCount: 50 });
 *
 * // Error logging
 * graphLogger.error('Failed to fetch graph', error, { scanId });
 *
 * // Debug with timing
 * graphLogger.debug('Layout calculated', { duration: 125, nodeCount: 100 });
 * ```
 */
export const graphLogger = {
  /**
   * Log a debug message
   * Only output in development mode by default
   */
  debug(message: string, context?: LogContext): void {
    if (!shouldLog('debug')) return;
    const entry = createLogEntry('debug', message, context);
    processLogEntry(entry);
  },

  /**
   * Log an info message
   */
  info(message: string, context?: LogContext): void {
    if (!shouldLog('info')) return;
    const entry = createLogEntry('info', message, context);
    processLogEntry(entry);
  },

  /**
   * Log a warning message
   */
  warn(message: string, context?: LogContext): void {
    if (!shouldLog('warn')) return;
    const entry = createLogEntry('warn', message, context);
    processLogEntry(entry);
  },

  /**
   * Log an error message
   * @param message - Error description
   * @param error - Optional Error object
   * @param context - Optional context
   */
  error(message: string, error?: Error, context?: LogContext): void {
    if (!shouldLog('error')) return;
    const entry = createLogEntry('error', message, context, error ?? undefined);
    processLogEntry(entry);
  },

  /**
   * Create a child logger with preset context
   * Useful for adding consistent context across multiple log calls
   *
   * @example
   * ```ts
   * const scanLogger = graphLogger.child({ scanId: 'abc123' });
   * scanLogger.info('Processing started');
   * scanLogger.info('Processing complete', { duration: 500 });
   * ```
   */
  child(baseContext: LogContext) {
    return {
      debug: (message: string, context?: LogContext) =>
        graphLogger.debug(message, { ...baseContext, ...context }),
      info: (message: string, context?: LogContext) =>
        graphLogger.info(message, { ...baseContext, ...context }),
      warn: (message: string, context?: LogContext) =>
        graphLogger.warn(message, { ...baseContext, ...context }),
      error: (message: string, error?: Error, context?: LogContext) =>
        graphLogger.error(message, error, { ...baseContext, ...context }),
    };
  },

  /**
   * Configure the logger
   * @param config - Partial configuration to merge
   */
  configure(config: Partial<LoggerConfig>): void {
    currentConfig = { ...currentConfig, ...config };
  },

  /**
   * Get current configuration
   */
  getConfig(): Readonly<LoggerConfig> {
    return { ...currentConfig };
  },

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    currentConfig = { ...DEFAULT_CONFIG };
  },
};

// ============================================================================
// Convenience Exports
// ============================================================================

/**
 * Create a component-specific logger
 *
 * @example
 * ```ts
 * const logger = createComponentLogger('GraphContainer');
 * logger.info('Component mounted');
 * ```
 */
export function createComponentLogger(component: string) {
  return graphLogger.child({ component });
}

/**
 * Create an operation-specific logger with timing support
 *
 * @example
 * ```ts
 * const opLogger = createOperationLogger('fetchGraph', { scanId });
 * // ... do work ...
 * opLogger.complete({ nodeCount: 50 });
 * ```
 */
export function createOperationLogger(operation: string, context?: LogContext) {
  const startTime = performance.now();
  const baseContext = { ...context, action: operation };

  graphLogger.debug(`${operation} started`, baseContext);

  return {
    log: (message: string, additionalContext?: LogContext) =>
      graphLogger.debug(message, { ...baseContext, ...additionalContext }),

    warn: (message: string, additionalContext?: LogContext) =>
      graphLogger.warn(message, { ...baseContext, ...additionalContext }),

    error: (message: string, error?: Error, additionalContext?: LogContext) =>
      graphLogger.error(message, error, { ...baseContext, ...additionalContext }),

    complete: (additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - startTime);
      graphLogger.debug(`${operation} completed`, {
        ...baseContext,
        ...additionalContext,
        duration,
      });
      return duration;
    },

    fail: (error: Error, additionalContext?: LogContext) => {
      const duration = Math.round(performance.now() - startTime);
      graphLogger.error(`${operation} failed`, error, {
        ...baseContext,
        ...additionalContext,
        duration,
      });
      return duration;
    },
  };
}

export default graphLogger;
