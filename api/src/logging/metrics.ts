/**
 * Prometheus Metrics
 * @module logging/metrics
 *
 * Provides Prometheus-compatible metrics for monitoring the IaC dependency detection system.
 * Includes counters, histograms, and gauges for all major operations.
 *
 * TASK-DETECT: Logging infrastructure
 */

import {
  Counter,
  Histogram,
  Gauge,
  Summary,
  Registry,
  collectDefaultMetrics,
  register as defaultRegister,
} from 'prom-client';

// ============================================================================
// Registry Setup
// ============================================================================

/**
 * Dedicated metrics registry for the application
 */
export const metricsRegistry = new Registry();

/**
 * Default labels applied to all metrics
 */
metricsRegistry.setDefaultLabels({
  service: process.env.SERVICE_NAME || 'iac-detector',
  environment: process.env.NODE_ENV || 'development',
});

// Collect default Node.js metrics (memory, CPU, event loop, etc.)
collectDefaultMetrics({
  register: metricsRegistry,
  prefix: 'iac_',
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// ============================================================================
// HTTP Request Metrics
// ============================================================================

/**
 * Total HTTP requests counter
 */
export const httpRequestsTotal = new Counter({
  name: 'iac_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status_code'],
  registers: [metricsRegistry],
});

/**
 * HTTP request duration histogram
 */
export const httpRequestDuration = new Histogram({
  name: 'iac_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/**
 * HTTP request size histogram
 */
export const httpRequestSize = new Histogram({
  name: 'iac_http_request_size_bytes',
  help: 'HTTP request size in bytes',
  labelNames: ['method', 'path'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [metricsRegistry],
});

/**
 * HTTP response size histogram
 */
export const httpResponseSize = new Histogram({
  name: 'iac_http_response_size_bytes',
  help: 'HTTP response size in bytes',
  labelNames: ['method', 'path', 'status_code'],
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [metricsRegistry],
});

/**
 * Active HTTP connections gauge
 */
export const httpActiveConnections = new Gauge({
  name: 'iac_http_active_connections',
  help: 'Number of active HTTP connections',
  registers: [metricsRegistry],
});

// ============================================================================
// Scan Metrics
// ============================================================================

/**
 * Total scans counter
 */
export const scansTotal = new Counter({
  name: 'iac_scans_total',
  help: 'Total number of scans performed',
  labelNames: ['status', 'repository_type', 'trigger'],
  registers: [metricsRegistry],
});

/**
 * Scan duration histogram
 */
export const scanDuration = new Histogram({
  name: 'iac_scan_duration_seconds',
  help: 'Scan duration in seconds',
  labelNames: ['repository_type', 'status'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

/**
 * Active scans gauge
 */
export const activeScans = new Gauge({
  name: 'iac_active_scans',
  help: 'Number of currently running scans',
  labelNames: ['repository_type'],
  registers: [metricsRegistry],
});

/**
 * Nodes per scan histogram
 */
export const nodesPerScan = new Histogram({
  name: 'iac_nodes_per_scan',
  help: 'Number of nodes created per scan',
  labelNames: ['repository_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

/**
 * Edges per scan histogram
 */
export const edgesPerScan = new Histogram({
  name: 'iac_edges_per_scan',
  help: 'Number of edges created per scan',
  labelNames: ['repository_type'],
  buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
  registers: [metricsRegistry],
});

/**
 * Files per scan histogram
 */
export const filesPerScan = new Histogram({
  name: 'iac_files_per_scan',
  help: 'Number of files processed per scan',
  labelNames: ['repository_type'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});

// ============================================================================
// Parser Metrics
// ============================================================================

/**
 * Parser invocations counter
 */
export const parserInvocations = new Counter({
  name: 'iac_parser_invocations_total',
  help: 'Total number of parser invocations',
  labelNames: ['parser_type', 'file_type', 'status'],
  registers: [metricsRegistry],
});

/**
 * Parser duration histogram
 */
export const parserDuration = new Histogram({
  name: 'iac_parser_duration_seconds',
  help: 'Parser duration in seconds',
  labelNames: ['parser_type', 'file_type'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

/**
 * Parser errors counter
 */
export const parserErrors = new Counter({
  name: 'iac_parser_errors_total',
  help: 'Total number of parser errors',
  labelNames: ['parser_type', 'error_code'],
  registers: [metricsRegistry],
});

/**
 * File size histogram
 */
export const parsedFileSize = new Histogram({
  name: 'iac_parsed_file_size_bytes',
  help: 'Size of parsed files in bytes',
  labelNames: ['parser_type', 'file_type'],
  buckets: [100, 1000, 10000, 50000, 100000, 500000, 1000000],
  registers: [metricsRegistry],
});

// ============================================================================
// Detector Metrics
// ============================================================================

/**
 * Detector invocations counter
 */
export const detectorInvocations = new Counter({
  name: 'iac_detector_invocations_total',
  help: 'Total number of detector invocations',
  labelNames: ['detector_type', 'status'],
  registers: [metricsRegistry],
});

/**
 * Detector duration histogram
 */
export const detectorDuration = new Histogram({
  name: 'iac_detector_duration_seconds',
  help: 'Detector duration in seconds',
  labelNames: ['detector_type'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5, 10, 30],
  registers: [metricsRegistry],
});

/**
 * Edges created per detector histogram
 */
export const detectorEdgesCreated = new Histogram({
  name: 'iac_detector_edges_created',
  help: 'Number of edges created per detector run',
  labelNames: ['detector_type'],
  buckets: [0, 1, 5, 10, 50, 100, 500, 1000],
  registers: [metricsRegistry],
});

// ============================================================================
// Graph Metrics
// ============================================================================

/**
 * Graph build duration histogram
 */
export const graphBuildDuration = new Histogram({
  name: 'iac_graph_build_duration_seconds',
  help: 'Graph build duration in seconds',
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

/**
 * Graph validation duration histogram
 */
export const graphValidationDuration = new Histogram({
  name: 'iac_graph_validation_duration_seconds',
  help: 'Graph validation duration in seconds',
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

/**
 * Graph size summary
 */
export const graphSize = new Summary({
  name: 'iac_graph_size',
  help: 'Graph size statistics',
  labelNames: ['metric'],
  percentiles: [0.5, 0.9, 0.95, 0.99],
  registers: [metricsRegistry],
});

// ============================================================================
// Repository Metrics
// ============================================================================

/**
 * Repository clone operations counter
 */
export const repositoryClones = new Counter({
  name: 'iac_repository_clones_total',
  help: 'Total number of repository clone operations',
  labelNames: ['provider', 'status'],
  registers: [metricsRegistry],
});

/**
 * Repository clone duration histogram
 */
export const repositoryCloneDuration = new Histogram({
  name: 'iac_repository_clone_duration_seconds',
  help: 'Repository clone duration in seconds',
  labelNames: ['provider'],
  buckets: [1, 5, 10, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

/**
 * Repository size histogram
 */
export const repositorySize = new Histogram({
  name: 'iac_repository_size_bytes',
  help: 'Repository size in bytes',
  labelNames: ['provider'],
  buckets: [1000000, 10000000, 50000000, 100000000, 500000000, 1000000000],
  registers: [metricsRegistry],
});

// ============================================================================
// Queue Metrics
// ============================================================================

/**
 * Queue depth gauge
 */
export const queueDepth = new Gauge({
  name: 'iac_queue_depth',
  help: 'Number of jobs in the queue',
  labelNames: ['queue_name', 'state'],
  registers: [metricsRegistry],
});

/**
 * Job processing counter
 */
export const jobsProcessed = new Counter({
  name: 'iac_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['queue_name', 'job_type', 'status'],
  registers: [metricsRegistry],
});

/**
 * Job processing duration histogram
 */
export const jobDuration = new Histogram({
  name: 'iac_job_duration_seconds',
  help: 'Job processing duration in seconds',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 0.5, 1, 5, 10, 30, 60, 120, 300, 600],
  registers: [metricsRegistry],
});

/**
 * Job wait time histogram
 */
export const jobWaitTime = new Histogram({
  name: 'iac_job_wait_time_seconds',
  help: 'Time jobs spend waiting in queue',
  labelNames: ['queue_name', 'job_type'],
  buckets: [0.1, 1, 5, 10, 30, 60, 120, 300, 600, 1800],
  registers: [metricsRegistry],
});

/**
 * Job retries counter
 */
export const jobRetries = new Counter({
  name: 'iac_job_retries_total',
  help: 'Total number of job retries',
  labelNames: ['queue_name', 'job_type'],
  registers: [metricsRegistry],
});

// ============================================================================
// Database Metrics
// ============================================================================

/**
 * Database query counter
 */
export const dbQueries = new Counter({
  name: 'iac_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['operation', 'table', 'status'],
  registers: [metricsRegistry],
});

/**
 * Database query duration histogram
 */
export const dbQueryDuration = new Histogram({
  name: 'iac_db_query_duration_seconds',
  help: 'Database query duration in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [metricsRegistry],
});

/**
 * Database connection pool gauge
 */
export const dbConnectionPool = new Gauge({
  name: 'iac_db_connection_pool',
  help: 'Database connection pool statistics',
  labelNames: ['state'],
  registers: [metricsRegistry],
});

// ============================================================================
// Error Metrics
// ============================================================================

/**
 * Application errors counter
 */
export const errorsTotal = new Counter({
  name: 'iac_errors_total',
  help: 'Total number of application errors',
  labelNames: ['error_type', 'error_code', 'operation'],
  registers: [metricsRegistry],
});

/**
 * Unhandled errors counter
 */
export const unhandledErrors = new Counter({
  name: 'iac_unhandled_errors_total',
  help: 'Total number of unhandled errors',
  labelNames: ['type'],
  registers: [metricsRegistry],
});

// ============================================================================
// Cache Metrics
// ============================================================================

/**
 * Cache operations counter
 */
export const cacheOperations = new Counter({
  name: 'iac_cache_operations_total',
  help: 'Total number of cache operations',
  labelNames: ['cache_name', 'operation', 'result'],
  registers: [metricsRegistry],
});

/**
 * Cache size gauge
 */
export const cacheSize = new Gauge({
  name: 'iac_cache_size',
  help: 'Current cache size',
  labelNames: ['cache_name', 'metric'],
  registers: [metricsRegistry],
});

// ============================================================================
// External Service Metrics
// ============================================================================

/**
 * External service requests counter
 */
export const externalRequests = new Counter({
  name: 'iac_external_requests_total',
  help: 'Total number of external service requests',
  labelNames: ['service', 'operation', 'status'],
  registers: [metricsRegistry],
});

/**
 * External service request duration histogram
 */
export const externalRequestDuration = new Histogram({
  name: 'iac_external_request_duration_seconds',
  help: 'External service request duration in seconds',
  labelNames: ['service', 'operation'],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

// ============================================================================
// Metrics Helper Object
// ============================================================================

/**
 * Metrics helper with convenient recording methods
 */
export const metrics = {
  // HTTP
  recordHttpRequest(method: string, path: string, statusCode: number, duration: number) {
    const normalizedPath = normalizePath(path);
    httpRequestsTotal.inc({ method, path: normalizedPath, status_code: statusCode.toString() });
    httpRequestDuration.observe(
      { method, path: normalizedPath, status_code: statusCode.toString() },
      duration
    );
  },

  recordHttpRequestSize(method: string, path: string, size: number) {
    httpRequestSize.observe({ method, path: normalizePath(path) }, size);
  },

  recordHttpResponseSize(method: string, path: string, statusCode: number, size: number) {
    httpResponseSize.observe(
      { method, path: normalizePath(path), status_code: statusCode.toString() },
      size
    );
  },

  // Scans
  recordScanStarted(repositoryType: string) {
    activeScans.inc({ repository_type: repositoryType });
  },

  recordScanCompleted(
    repositoryType: string,
    durationSeconds: number,
    nodeCount: number,
    edgeCount: number,
    fileCount: number,
    trigger: string = 'manual'
  ) {
    activeScans.dec({ repository_type: repositoryType });
    scansTotal.inc({ status: 'success', repository_type: repositoryType, trigger });
    scanDuration.observe({ repository_type: repositoryType, status: 'success' }, durationSeconds);
    nodesPerScan.observe({ repository_type: repositoryType }, nodeCount);
    edgesPerScan.observe({ repository_type: repositoryType }, edgeCount);
    filesPerScan.observe({ repository_type: repositoryType }, fileCount);
  },

  recordScanFailed(repositoryType: string, durationSeconds: number, trigger: string = 'manual') {
    activeScans.dec({ repository_type: repositoryType });
    scansTotal.inc({ status: 'failure', repository_type: repositoryType, trigger });
    scanDuration.observe({ repository_type: repositoryType, status: 'failure' }, durationSeconds);
  },

  // Parsers
  recordParserInvocation(
    parserType: string,
    fileType: string,
    status: 'success' | 'failure' | 'skipped'
  ) {
    parserInvocations.inc({ parser_type: parserType, file_type: fileType, status });
  },

  recordParserDuration(parserType: string, fileType: string, durationSeconds: number) {
    parserDuration.observe({ parser_type: parserType, file_type: fileType }, durationSeconds);
  },

  recordParserError(parserType: string, errorCode: string) {
    parserErrors.inc({ parser_type: parserType, error_code: errorCode });
  },

  recordParsedFileSize(parserType: string, fileType: string, sizeBytes: number) {
    parsedFileSize.observe({ parser_type: parserType, file_type: fileType }, sizeBytes);
  },

  // Detectors
  recordDetectorInvocation(detectorType: string, status: 'success' | 'failure') {
    detectorInvocations.inc({ detector_type: detectorType, status });
  },

  recordDetectorDuration(detectorType: string, durationSeconds: number, edgesCreated: number) {
    detectorDuration.observe({ detector_type: detectorType }, durationSeconds);
    detectorEdgesCreated.observe({ detector_type: detectorType }, edgesCreated);
  },

  // Graph
  recordGraphBuild(durationSeconds: number, nodeCount: number, edgeCount: number) {
    graphBuildDuration.observe(durationSeconds);
    graphSize.observe({ metric: 'nodes' }, nodeCount);
    graphSize.observe({ metric: 'edges' }, edgeCount);
  },

  recordGraphValidation(durationSeconds: number) {
    graphValidationDuration.observe(durationSeconds);
  },

  // Repository
  recordRepositoryClone(provider: string, status: 'success' | 'failure', durationSeconds?: number) {
    repositoryClones.inc({ provider, status });
    if (status === 'success' && durationSeconds !== undefined) {
      repositoryCloneDuration.observe({ provider }, durationSeconds);
    }
  },

  recordRepositorySize(provider: string, sizeBytes: number) {
    repositorySize.observe({ provider }, sizeBytes);
  },

  // Queue
  setQueueDepth(queueName: string, waiting: number, active: number, delayed: number) {
    queueDepth.set({ queue_name: queueName, state: 'waiting' }, waiting);
    queueDepth.set({ queue_name: queueName, state: 'active' }, active);
    queueDepth.set({ queue_name: queueName, state: 'delayed' }, delayed);
  },

  recordJobProcessed(
    queueName: string,
    jobType: string,
    status: 'completed' | 'failed',
    durationSeconds: number,
    waitTimeSeconds?: number
  ) {
    jobsProcessed.inc({ queue_name: queueName, job_type: jobType, status });
    jobDuration.observe({ queue_name: queueName, job_type: jobType }, durationSeconds);
    if (waitTimeSeconds !== undefined) {
      jobWaitTime.observe({ queue_name: queueName, job_type: jobType }, waitTimeSeconds);
    }
  },

  recordJobRetry(queueName: string, jobType: string) {
    jobRetries.inc({ queue_name: queueName, job_type: jobType });
  },

  // Database
  recordDbQuery(
    operation: string,
    table: string,
    status: 'success' | 'failure',
    durationSeconds: number
  ) {
    dbQueries.inc({ operation, table, status });
    dbQueryDuration.observe({ operation, table }, durationSeconds);
  },

  setDbPoolStats(total: number, idle: number, waiting: number) {
    dbConnectionPool.set({ state: 'total' }, total);
    dbConnectionPool.set({ state: 'idle' }, idle);
    dbConnectionPool.set({ state: 'waiting' }, waiting);
    dbConnectionPool.set({ state: 'active' }, total - idle);
  },

  // Errors
  recordError(errorType: string, errorCode: string, operation: string) {
    errorsTotal.inc({ error_type: errorType, error_code: errorCode, operation });
  },

  recordUnhandledError(type: 'exception' | 'rejection') {
    unhandledErrors.inc({ type });
  },

  // Cache
  recordCacheHit(cacheName: string) {
    cacheOperations.inc({ cache_name: cacheName, operation: 'get', result: 'hit' });
  },

  recordCacheMiss(cacheName: string) {
    cacheOperations.inc({ cache_name: cacheName, operation: 'get', result: 'miss' });
  },

  recordCacheSet(cacheName: string) {
    cacheOperations.inc({ cache_name: cacheName, operation: 'set', result: 'success' });
  },

  setCacheSize(cacheName: string, itemCount: number, sizeBytes?: number) {
    cacheSize.set({ cache_name: cacheName, metric: 'items' }, itemCount);
    if (sizeBytes !== undefined) {
      cacheSize.set({ cache_name: cacheName, metric: 'bytes' }, sizeBytes);
    }
  },

  // External services
  recordExternalRequest(
    service: string,
    operation: string,
    status: 'success' | 'failure',
    durationSeconds: number
  ) {
    externalRequests.inc({ service, operation, status });
    externalRequestDuration.observe({ service, operation }, durationSeconds);
  },
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Normalizes URL paths for metrics (removes IDs, query strings)
 */
function normalizePath(path: string): string {
  // Remove query string
  const withoutQuery = path.split('?')[0];

  // Replace UUIDs
  const withoutUuids = withoutQuery.replace(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
    ':id'
  );

  // Replace numeric IDs
  const withoutNumericIds = withoutUuids.replace(/\/\d+(?=\/|$)/g, '/:id');

  return withoutNumericIds;
}

/**
 * Gets metrics in Prometheus format
 */
export async function getMetrics(): Promise<string> {
  return metricsRegistry.metrics();
}

/**
 * Gets metrics content type header
 */
export function getMetricsContentType(): string {
  return metricsRegistry.contentType;
}

/**
 * Resets all metrics (primarily for testing)
 */
export async function resetMetrics(): Promise<void> {
  metricsRegistry.resetMetrics();
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin for metrics collection
 */
export function metricsPlugin(
  fastify: any,
  opts: { path?: string; excludePaths?: string[] },
  done: (err?: Error) => void
): void {
  const metricsPath = opts.path || '/metrics';
  const excludePaths = opts.excludePaths || ['/health', '/metrics', '/favicon.ico'];

  // Register metrics endpoint
  fastify.get(metricsPath, async (request: any, reply: any) => {
    const metrics = await getMetrics();
    reply.header('Content-Type', getMetricsContentType());
    return metrics;
  });

  // Collect HTTP metrics
  fastify.addHook('onResponse', (request: any, reply: any, done: () => void) => {
    const path = request.routerPath || request.url.split('?')[0];

    // Skip excluded paths
    if (excludePaths.some((p) => path === p || path.startsWith(p + '/'))) {
      return done();
    }

    const duration = reply.getResponseTime() / 1000; // Convert to seconds
    metrics.recordHttpRequest(request.method, path, reply.statusCode, duration);

    // Record request/response sizes if available
    const requestSize = parseInt(request.headers['content-length'] || '0', 10);
    if (requestSize > 0) {
      metrics.recordHttpRequestSize(request.method, path, requestSize);
    }

    const responseSize = parseInt(reply.getHeader('content-length') || '0', 10);
    if (responseSize > 0) {
      metrics.recordHttpResponseSize(request.method, path, reply.statusCode, responseSize);
    }

    done();
  });

  done();
}
