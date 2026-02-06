/**
 * Application Constants
 * @module constants
 *
 * Centralized constants for consistency across the codebase.
 * All magic numbers and configuration defaults should be defined here.
 *
 * TASK-DETECT: Final refactoring - Centralized constants
 */

// ============================================================================
// API Constants
// ============================================================================

export const API = {
  /** Current API version */
  VERSION: 'v1',
  /** Base path for API endpoints */
  BASE_PATH: '/api/v1',
  /** Default page size for paginated endpoints */
  DEFAULT_PAGE_SIZE: 20,
  /** Maximum allowed page size */
  MAX_PAGE_SIZE: 100,
  /** Default request timeout in milliseconds */
  REQUEST_TIMEOUT_MS: 30_000,
  /** Maximum request body size in bytes (10MB) */
  MAX_BODY_SIZE: 10 * 1024 * 1024,
} as const;

// ============================================================================
// Scan Constants
// ============================================================================

export const SCAN = {
  /** Maximum file size in bytes (10MB) */
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
  /** Maximum number of files per scan */
  MAX_FILES_PER_SCAN: 10_000,
  /** Maximum directory depth to traverse */
  MAX_DEPTH: 50,
  /** Supported file extensions */
  SUPPORTED_EXTENSIONS: [
    '.tf',
    '.tf.json',
    '.tfvars',
    '.yaml',
    '.yml',
    '.json',
    '.hcl',
  ] as const,
  /** Scan status values */
  STATUS: {
    PENDING: 'pending',
    QUEUED: 'queued',
    RUNNING: 'running',
    COMPLETED: 'completed',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  } as const,
  /** Default scan timeout in milliseconds (5 minutes) */
  DEFAULT_TIMEOUT_MS: 5 * 60 * 1000,
  /** Maximum scan timeout in milliseconds (30 minutes) */
  MAX_TIMEOUT_MS: 30 * 60 * 1000,
  /** Minimum poll interval for status checks (1 second) */
  MIN_POLL_INTERVAL_MS: 1000,
} as const;

export type ScanStatus = (typeof SCAN.STATUS)[keyof typeof SCAN.STATUS];

// ============================================================================
// Parser Constants
// ============================================================================

export const PARSER = {
  TERRAFORM: {
    NAME: 'terraform',
    EXTENSIONS: ['.tf', '.tf.json', '.tfvars', '.hcl'],
    BLOCK_TYPES: [
      'resource',
      'data',
      'module',
      'variable',
      'output',
      'locals',
      'provider',
      'terraform',
      'moved',
      'import',
      'check',
    ] as const,
    /** Maximum expression depth for parsing */
    MAX_EXPRESSION_DEPTH: 100,
  },
  CLOUDFORMATION: {
    NAME: 'cloudformation',
    EXTENSIONS: ['.yaml', '.yml', '.json'],
    RESOURCE_PREFIX: 'AWS::',
    INTRINSIC_FUNCTIONS: [
      'Ref',
      'Fn::GetAtt',
      'Fn::Sub',
      'Fn::Join',
      'Fn::If',
      'Fn::ImportValue',
    ] as const,
  },
  KUBERNETES: {
    NAME: 'kubernetes',
    EXTENSIONS: ['.yaml', '.yml'],
    API_VERSIONS: ['v1', 'apps/v1', 'batch/v1', 'networking.k8s.io/v1'] as const,
    WORKLOAD_KINDS: [
      'Deployment',
      'StatefulSet',
      'DaemonSet',
      'Job',
      'CronJob',
      'Pod',
    ] as const,
  },
  HELM: {
    NAME: 'helm',
    CHART_FILE: 'Chart.yaml',
    VALUES_FILE: 'values.yaml',
    TEMPLATES_DIR: 'templates',
  },
} as const;

// ============================================================================
// Graph Constants
// ============================================================================

export const GRAPH = {
  /** Maximum nodes in a single graph */
  MAX_NODES: 100_000,
  /** Maximum edges in a single graph */
  MAX_EDGES: 500_000,
  /** Batch size for graph operations */
  BATCH_SIZE: 1000,
  /** Maximum traversal depth */
  MAX_TRAVERSAL_DEPTH: 100,
  /** Node types */
  NODE_TYPES: {
    RESOURCE: 'resource',
    DATA_SOURCE: 'data_source',
    MODULE: 'module',
    VARIABLE: 'variable',
    OUTPUT: 'output',
    PROVIDER: 'provider',
    LOCAL: 'local',
  } as const,
  /** Edge types */
  EDGE_TYPES: {
    DEPENDS_ON: 'depends_on',
    REFERENCES: 'references',
    CONTAINS: 'contains',
    PROVIDES: 'provides',
    CONSUMES: 'consumes',
    IMPORTS: 'imports',
  } as const,
} as const;

export type GraphNodeType = (typeof GRAPH.NODE_TYPES)[keyof typeof GRAPH.NODE_TYPES];
export type GraphEdgeType = (typeof GRAPH.EDGE_TYPES)[keyof typeof GRAPH.EDGE_TYPES];

// ============================================================================
// Cache Constants
// ============================================================================

export const CACHE = {
  /** Default TTL in milliseconds (5 minutes) */
  DEFAULT_TTL_MS: 5 * 60 * 1000,
  /** Maximum cache size (entries) */
  MAX_SIZE: 10_000,
  /** Cache key prefixes */
  KEYS: {
    SCAN_RESULT: 'scan:result:',
    GRAPH_QUERY: 'graph:query:',
    PARSER_RESULT: 'parser:result:',
    EXPRESSION: 'expr:',
    MODULE: 'module:',
  } as const,
  /** Cache namespaces */
  NAMESPACES: {
    SCAN: 'scan',
    GRAPH: 'graph',
    PARSER: 'parser',
    EXPRESSION: 'expression',
  } as const,
} as const;

// ============================================================================
// Queue Constants
// ============================================================================

export const QUEUE = {
  /** Queue names */
  NAMES: {
    SCAN: 'scan-queue',
    PARSE: 'parse-queue',
    GRAPH_BUILD: 'graph-build-queue',
    NOTIFICATION: 'notification-queue',
    WEBHOOK: 'webhook-queue',
  } as const,
  /** Priority levels */
  PRIORITIES: {
    CRITICAL: 1,
    HIGH: 2,
    NORMAL: 3,
    LOW: 4,
    BACKGROUND: 5,
  } as const,
  /** Retry configuration */
  RETRY: {
    MAX_ATTEMPTS: 3,
    INITIAL_BACKOFF_MS: 1000,
    MAX_BACKOFF_MS: 60_000,
    BACKOFF_MULTIPLIER: 2,
  },
  /** Concurrency limits */
  CONCURRENCY: {
    SCAN: 5,
    PARSE: 10,
    GRAPH_BUILD: 3,
    NOTIFICATION: 20,
  },
} as const;

export type QueuePriority = (typeof QUEUE.PRIORITIES)[keyof typeof QUEUE.PRIORITIES];

// ============================================================================
// Scoring Constants
// ============================================================================

export const SCORING = {
  /** Confidence thresholds */
  CONFIDENCE_THRESHOLDS: {
    CERTAIN: 0.95,
    HIGH: 0.8,
    MEDIUM: 0.6,
    LOW: 0.4,
    UNCERTAIN: 0.2,
  } as const,
  /** Evidence weights by type */
  EVIDENCE_WEIGHTS: {
    EXPLICIT: 1.0,
    INFERRED: 0.7,
    PATTERN: 0.5,
    HEURISTIC: 0.3,
  } as const,
  /** Default confidence for unknown evidence */
  DEFAULT_CONFIDENCE: 0.5,
  /** Minimum confidence to include in results */
  MIN_CONFIDENCE: 0.1,
  /** Maximum evidence entries per edge */
  MAX_EVIDENCE_PER_EDGE: 50,
} as const;

// ============================================================================
// HTTP Status Codes
// ============================================================================

export const HTTP_STATUS = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  // 3xx Redirection
  MOVED_PERMANENTLY: 301,
  FOUND: 302,
  NOT_MODIFIED: 304,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  CONFLICT: 409,
  GONE: 410,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  // 5xx Server Errors
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
} as const;

// ============================================================================
// Environment Constants
// ============================================================================

export const ENV = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production',
  TEST: 'test',
} as const;

export type Environment = (typeof ENV)[keyof typeof ENV];

// ============================================================================
// Rate Limiting Constants
// ============================================================================

export const RATE_LIMIT = {
  /** Default requests per window */
  DEFAULT_MAX: 100,
  /** Default window in milliseconds (1 minute) */
  DEFAULT_WINDOW_MS: 60_000,
  /** Rate limits by endpoint category */
  BY_ENDPOINT: {
    SCAN_CREATE: { max: 10, windowMs: 60_000 },
    GRAPH_QUERY: { max: 100, windowMs: 60_000 },
    WEBHOOK: { max: 1000, windowMs: 60_000 },
    AUTH: { max: 20, windowMs: 60_000 },
  },
} as const;

// ============================================================================
// Validation Constants
// ============================================================================

export const VALIDATION = {
  /** ID format (UUID v4) */
  ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  /** Maximum string lengths */
  MAX_LENGTHS: {
    NAME: 255,
    DESCRIPTION: 2000,
    PATH: 4096,
    URL: 2048,
    TAG: 100,
  },
  /** Allowed characters in names */
  NAME_PATTERN: /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/,
} as const;

// ============================================================================
// Database Constants
// ============================================================================

export const DATABASE = {
  /** Default connection pool size */
  DEFAULT_POOL_SIZE: 20,
  /** Maximum pool size */
  MAX_POOL_SIZE: 100,
  /** Connection timeout in milliseconds */
  CONNECT_TIMEOUT_MS: 10_000,
  /** Query timeout in milliseconds */
  QUERY_TIMEOUT_MS: 30_000,
  /** Idle connection timeout in milliseconds */
  IDLE_TIMEOUT_MS: 10_000,
  /** Maximum number of retries for transactions */
  MAX_TRANSACTION_RETRIES: 3,
} as const;

// ============================================================================
// Logging Constants
// ============================================================================

export const LOGGING = {
  /** Log levels */
  LEVELS: {
    FATAL: 60,
    ERROR: 50,
    WARN: 40,
    INFO: 30,
    DEBUG: 20,
    TRACE: 10,
  } as const,
  /** Maximum log message length */
  MAX_MESSAGE_LENGTH: 10_000,
  /** Redacted field names */
  REDACTED_FIELDS: [
    'password',
    'token',
    'secret',
    'apiKey',
    'authorization',
    'cookie',
  ],
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

export const FEATURE_FLAGS = {
  /** Enable experimental features */
  EXPERIMENTAL: 'experimental',
  /** Enable debug endpoints */
  DEBUG_ENDPOINTS: 'debug_endpoints',
  /** Enable graph caching */
  GRAPH_CACHING: 'graph_caching',
  /** Enable parallel parsing */
  PARALLEL_PARSING: 'parallel_parsing',
  /** Enable ML-based scoring */
  ML_SCORING: 'ml_scoring',
} as const;

// ============================================================================
// Utility: Get constants for environment
// ============================================================================

/**
 * Environment-specific overrides type
 */
export interface ScanOverrides {
  DEFAULT_TIMEOUT_MS?: number;
  MAX_TIMEOUT_MS?: number;
  MAX_FILES_PER_SCAN?: number;
  MAX_FILE_SIZE_BYTES?: number;
  MAX_DEPTH?: number;
}

/**
 * Get environment-specific overrides
 */
export function getEnvConstants(env: Environment): ScanOverrides {
  switch (env) {
    case ENV.DEVELOPMENT:
      return {
        DEFAULT_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes in dev
      };
    case ENV.TEST:
      return {
        DEFAULT_TIMEOUT_MS: 30_000, // 30 seconds in test
        MAX_FILES_PER_SCAN: 100,
      };
    case ENV.PRODUCTION:
    case ENV.STAGING:
    default:
      return {};
  }
}
