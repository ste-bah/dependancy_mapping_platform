/**
 * Graph Diff Health Check Integration
 * @module services/rollup/graph-diff/health
 *
 * Health check implementation for the Graph Diff Computation service.
 * Monitors connectivity and status of critical dependencies:
 * - Scan repository connectivity
 * - Diff cache (L1 + L2) status
 * - Rate limiter availability
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

import type { Logger } from 'pino';
import pino from 'pino';
import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import type { TenantId, ScanId } from '../../../types/entities.js';
import type { IScanRepository } from '../../../repositories/interfaces.js';
import type { IDiffCache, DiffCacheStats } from './interfaces.js';
import type { IRateLimiter, RateLimitResult } from './graph-diff-service.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Status levels for health checks
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Status of an individual dependency
 */
export type DependencyStatus = 'up' | 'down' | 'degraded';

/**
 * Health check result for a single dependency
 */
export interface DependencyHealth {
  /** Name of the dependency */
  readonly name: string;
  /** Current status */
  readonly status: DependencyStatus;
  /** Latency in milliseconds (if applicable) */
  readonly latencyMs?: number | undefined;
  /** Additional details or error message */
  readonly message?: string | undefined;
  /** When this check was performed */
  readonly checkedAt: Date;
  /** Additional metadata */
  readonly metadata?: Readonly<Record<string, unknown>> | undefined;
}

/**
 * Metrics included in health response
 */
export interface DiffServiceMetrics {
  /** Cache hit rate (0-1) */
  readonly cacheHitRate: number;
  /** Average compute time in milliseconds */
  readonly avgComputeTimeMs: number;
  /** Total diffs computed (since last reset) */
  readonly totalDiffsComputed?: number | undefined;
  /** Current L1 cache size */
  readonly l1CacheSize?: number | undefined;
  /** Current rate limit usage percentage */
  readonly rateLimitUsagePercent?: number | undefined;
}

/**
 * Complete health response for the diff service
 */
export interface DiffServiceHealth {
  /** Overall service status */
  readonly status: HealthStatus;
  /** ISO timestamp of the health check */
  readonly timestamp: string;
  /** Health status of each dependency */
  readonly dependencies: readonly DependencyHealth[];
  /** Service metrics (optional) */
  readonly metrics?: DiffServiceMetrics | undefined;
  /** Service version (if available) */
  readonly version?: string | undefined;
  /** Uptime in seconds (if available) */
  readonly uptimeSeconds?: number | undefined;
}

/**
 * Dependencies for DiffHealthCheck construction
 */
export interface DiffHealthCheckDependencies {
  /** Scan repository for connectivity check */
  readonly scanRepository: IScanRepository;
  /** Diff cache for status check */
  readonly diffCache: IDiffCache;
  /** Rate limiter for availability check (optional) */
  readonly rateLimiter?: IRateLimiter | undefined;
  /** Logger (optional) */
  readonly logger?: Logger | undefined;
}

/**
 * Configuration for health checks (internal resolved version)
 */
interface ResolvedDiffHealthCheckConfig {
  /** Tenant ID to use for test queries */
  readonly testTenantId: TenantId;
  /** Scan ID to use for test queries (optional) */
  readonly testScanId: ScanId | null;
  /** Timeout for individual checks in milliseconds */
  readonly checkTimeoutMs: number;
  /** Include detailed metrics in response */
  readonly includeMetrics: boolean;
  /** Service version string */
  readonly version: string;
  /** Cache hit rate threshold for degraded status (0-1) */
  readonly cacheHitRateThreshold: number;
  /** Latency threshold for degraded status in milliseconds */
  readonly latencyThresholdMs: number;
}

/**
 * Configuration for health checks (public input version)
 */
export interface DiffHealthCheckConfig {
  /** Tenant ID to use for test queries */
  readonly testTenantId?: TenantId | undefined;
  /** Scan ID to use for test queries (optional) */
  readonly testScanId?: ScanId | undefined;
  /** Timeout for individual checks in milliseconds */
  readonly checkTimeoutMs?: number | undefined;
  /** Include detailed metrics in response */
  readonly includeMetrics?: boolean | undefined;
  /** Service version string */
  readonly version?: string | undefined;
  /** Cache hit rate threshold for degraded status (0-1) */
  readonly cacheHitRateThreshold?: number | undefined;
  /** Latency threshold for degraded status in milliseconds */
  readonly latencyThresholdMs?: number | undefined;
}

/**
 * Default health check configuration
 */
export const DEFAULT_HEALTH_CHECK_CONFIG: ResolvedDiffHealthCheckConfig = {
  testTenantId: 'health-check-tenant' as TenantId,
  testScanId: null,
  checkTimeoutMs: 5000,
  includeMetrics: true,
  version: '1.0.0',
  cacheHitRateThreshold: 0.5, // Below 50% is degraded
  latencyThresholdMs: 500, // Above 500ms is degraded
};

// ============================================================================
// Health Check Implementation
// ============================================================================

/**
 * Health check implementation for the Graph Diff service.
 * Monitors the status of all critical dependencies and reports overall health.
 */
export class DiffHealthCheck {
  private readonly scanRepository: IScanRepository;
  private readonly diffCache: IDiffCache;
  private readonly rateLimiter: IRateLimiter | undefined;
  private readonly logger: Logger;
  private readonly config: ResolvedDiffHealthCheckConfig;
  private readonly startTime: number;
  private totalDiffsComputed: number = 0;
  private totalComputeTimeMs: number = 0;

  /**
   * Create a new DiffHealthCheck instance
   * @param deps - Health check dependencies
   * @param config - Health check configuration
   */
  constructor(
    deps: DiffHealthCheckDependencies,
    config?: DiffHealthCheckConfig
  ) {
    this.scanRepository = deps.scanRepository;
    this.diffCache = deps.diffCache;
    this.rateLimiter = deps.rateLimiter;
    this.logger = deps.logger ?? pino({ name: 'diff-health-check' });

    // Merge configuration with defaults
    this.config = {
      testTenantId: config?.testTenantId ?? DEFAULT_HEALTH_CHECK_CONFIG.testTenantId,
      testScanId: config?.testScanId ?? DEFAULT_HEALTH_CHECK_CONFIG.testScanId,
      checkTimeoutMs: config?.checkTimeoutMs ?? DEFAULT_HEALTH_CHECK_CONFIG.checkTimeoutMs,
      includeMetrics: config?.includeMetrics ?? DEFAULT_HEALTH_CHECK_CONFIG.includeMetrics,
      version: config?.version ?? DEFAULT_HEALTH_CHECK_CONFIG.version,
      cacheHitRateThreshold: config?.cacheHitRateThreshold ?? DEFAULT_HEALTH_CHECK_CONFIG.cacheHitRateThreshold,
      latencyThresholdMs: config?.latencyThresholdMs ?? DEFAULT_HEALTH_CHECK_CONFIG.latencyThresholdMs,
    };

    this.startTime = Date.now();

    this.logger.debug(
      { config: this.config },
      'DiffHealthCheck initialized'
    );
  }

  // ==========================================================================
  // Public Methods
  // ==========================================================================

  /**
   * Perform a complete health check
   * @returns Health check response
   */
  async check(): Promise<DiffServiceHealth> {
    const checkStart = Date.now();
    const dependencies: DependencyHealth[] = [];

    this.logger.debug('Starting health check');

    // Check all dependencies in parallel
    const [
      scanRepoHealth,
      cacheHealth,
      rateLimiterHealth,
    ] = await Promise.all([
      this.checkScanRepository(),
      this.checkDiffCache(),
      this.checkRateLimiter(),
    ]);

    dependencies.push(scanRepoHealth);
    dependencies.push(cacheHealth);

    if (rateLimiterHealth) {
      dependencies.push(rateLimiterHealth);
    }

    // Determine overall status
    const status = this.determineOverallStatus(dependencies);

    // Build metrics if enabled
    const metrics: DiffServiceMetrics | undefined = this.config.includeMetrics
      ? this.buildMetrics(cacheHealth)
      : undefined;

    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const checkDuration = Date.now() - checkStart;

    this.logger.debug(
      { status, dependencyCount: dependencies.length, checkDurationMs: checkDuration },
      'Health check completed'
    );

    const result: DiffServiceHealth = {
      status,
      timestamp: new Date().toISOString(),
      dependencies,
      metrics,
      version: this.config.version,
      uptimeSeconds,
    };

    return result;
  }

  /**
   * Record a diff computation for metrics tracking
   * @param computeTimeMs - Computation time in milliseconds
   */
  recordDiffComputation(computeTimeMs: number): void {
    this.totalDiffsComputed++;
    this.totalComputeTimeMs += computeTimeMs;
  }

  /**
   * Reset metrics counters
   */
  resetMetrics(): void {
    this.totalDiffsComputed = 0;
    this.totalComputeTimeMs = 0;
    this.logger.debug('Health check metrics reset');
  }

  // ==========================================================================
  // Individual Dependency Checks
  // ==========================================================================

  /**
   * Check scan repository connectivity
   */
  private async checkScanRepository(): Promise<DependencyHealth> {
    const checkStart = Date.now();
    const name = 'scan-repository';

    try {
      // Perform a lightweight query to verify connectivity
      // Using findById with a non-existent ID is a minimal operation
      await Promise.race([
        this.performScanRepositoryCheck(),
        this.createTimeout('Scan repository check timed out'),
      ]);

      const latencyMs = Date.now() - checkStart;
      const isDegraded = latencyMs > this.config.latencyThresholdMs;
      const status: DependencyStatus = isDegraded ? 'degraded' : 'up';

      const result: DependencyHealth = {
        name,
        status,
        latencyMs,
        checkedAt: new Date(),
      };

      if (isDegraded) {
        return {
          ...result,
          message: `Latency (${latencyMs}ms) exceeds threshold (${this.config.latencyThresholdMs}ms)`,
        };
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - checkStart;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        { error: message, latencyMs },
        'Scan repository health check failed'
      );

      return {
        name,
        status: 'down',
        latencyMs,
        message,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Perform the actual scan repository check
   */
  private async performScanRepositoryCheck(): Promise<void> {
    // Try to query for a non-existent scan
    // This verifies the connection without modifying data
    const testScanId = this.config.testScanId ?? ('health-check-scan' as ScanId);
    await this.scanRepository.findById(testScanId, this.config.testTenantId);
  }

  /**
   * Check diff cache status (L1 + L2)
   */
  private async checkDiffCache(): Promise<DependencyHealth> {
    const checkStart = Date.now();
    const name = 'diff-cache';

    try {
      // Get cache statistics
      const stats = this.diffCache.getStats();
      const latencyMs = Date.now() - checkStart;

      // Determine status based on cache health indicators
      let status: DependencyStatus = 'up';
      let message: string | undefined;

      // Check hit ratio if there's been any activity
      const totalOperations = stats.hits + stats.misses;
      const threshold = this.config.cacheHitRateThreshold;
      if (totalOperations > 0 && stats.hitRatio < threshold) {
        status = 'degraded';
        message = `Cache hit ratio (${(stats.hitRatio * 100).toFixed(1)}%) below threshold (${threshold * 100}%)`;
      }

      const result: DependencyHealth = {
        name,
        status,
        latencyMs,
        checkedAt: new Date(),
        metadata: {
          hitRatio: stats.hitRatio,
          entryCount: stats.entryCount,
          totalSizeBytes: stats.totalSizeBytes,
          hits: stats.hits,
          misses: stats.misses,
          setsCount: stats.setsCount,
          invalidationsCount: stats.invalidationsCount,
        },
      };

      if (message !== undefined) {
        return { ...result, message };
      }

      return result;
    } catch (error) {
      const latencyMs = Date.now() - checkStart;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        { error: message, latencyMs },
        'Diff cache health check failed'
      );

      return {
        name,
        status: 'down',
        latencyMs,
        message,
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Check rate limiter availability
   * @returns Health check result or null if rate limiter not configured
   */
  private async checkRateLimiter(): Promise<DependencyHealth | null> {
    if (!this.rateLimiter) {
      return null;
    }

    const checkStart = Date.now();
    const name = 'rate-limiter';

    try {
      // Check rate limit status for health check tenant
      const result = await Promise.race([
        this.rateLimiter.checkLimit(this.config.testTenantId, 'health_check'),
        this.createTimeout('Rate limiter check timed out'),
      ]) as RateLimitResult;

      const latencyMs = Date.now() - checkStart;

      // Rate limiter is up as long as we can query it
      // Being rate limited is not a failure condition for the service
      const threshold = this.config.latencyThresholdMs;
      const isDegraded = latencyMs > threshold;
      const status: DependencyStatus = isDegraded ? 'degraded' : 'up';

      const healthResult: DependencyHealth = {
        name,
        status,
        latencyMs,
        checkedAt: new Date(),
        metadata: {
          currentCount: result.currentCount,
          limit: result.limit,
          windowSeconds: result.windowSeconds,
          usagePercent: result.limit > 0
            ? Math.round((result.currentCount / result.limit) * 100)
            : 0,
        },
      };

      if (isDegraded) {
        return {
          ...healthResult,
          message: `Latency (${latencyMs}ms) exceeds threshold (${threshold}ms)`,
        };
      }

      return healthResult;
    } catch (error) {
      const latencyMs = Date.now() - checkStart;
      const message = error instanceof Error ? error.message : 'Unknown error';

      this.logger.warn(
        { error: message, latencyMs },
        'Rate limiter health check failed'
      );

      return {
        name,
        status: 'down',
        latencyMs,
        message,
        checkedAt: new Date(),
      };
    }
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Determine overall health status from dependency statuses
   */
  private determineOverallStatus(dependencies: readonly DependencyHealth[]): HealthStatus {
    const hasDown = dependencies.some(d => d.status === 'down');
    const hasDegraded = dependencies.some(d => d.status === 'degraded');

    // Any critical dependency down = unhealthy
    // Check if scan repository is down (critical dependency)
    const scanRepoDown = dependencies.find(d => d.name === 'scan-repository')?.status === 'down';
    if (scanRepoDown) {
      return 'unhealthy';
    }

    // Cache down is degraded (can still function without cache)
    const cacheDown = dependencies.find(d => d.name === 'diff-cache')?.status === 'down';
    if (cacheDown) {
      return 'degraded';
    }

    // Other down dependencies or any degraded = degraded
    if (hasDown || hasDegraded) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Build service metrics from cache health data
   */
  private buildMetrics(cacheHealth: DependencyHealth): DiffServiceMetrics {
    const cacheStats = cacheHealth.metadata as DiffCacheStats | undefined;

    const avgComputeTimeMs = this.totalDiffsComputed > 0
      ? Math.round(this.totalComputeTimeMs / this.totalDiffsComputed)
      : 0;

    const metrics: DiffServiceMetrics = {
      cacheHitRate: cacheStats?.hitRatio ?? 0,
      avgComputeTimeMs,
      totalDiffsComputed: this.totalDiffsComputed,
      l1CacheSize: cacheStats?.entryCount,
    };

    return metrics;
  }

  /**
   * Create a timeout promise for check operations
   */
  private createTimeout(message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, this.config.checkTimeoutMs);
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new DiffHealthCheck instance
 * @param deps - Health check dependencies
 * @param config - Health check configuration
 * @returns Configured DiffHealthCheck instance
 */
export function createDiffHealthCheck(
  deps: DiffHealthCheckDependencies,
  config?: DiffHealthCheckConfig
): DiffHealthCheck {
  return new DiffHealthCheck(deps, config);
}

// ============================================================================
// Fastify Route Registration
// ============================================================================

/**
 * Schema for health check response
 */
const DiffServiceHealthSchema = {
  type: 'object',
  properties: {
    status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
    timestamp: { type: 'string', format: 'date-time' },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          status: { type: 'string', enum: ['up', 'down', 'degraded'] },
          latencyMs: { type: 'number' },
          message: { type: 'string' },
          checkedAt: { type: 'string', format: 'date-time' },
          metadata: { type: 'object', additionalProperties: true },
        },
        required: ['name', 'status', 'checkedAt'],
      },
    },
    metrics: {
      type: 'object',
      properties: {
        cacheHitRate: { type: 'number' },
        avgComputeTimeMs: { type: 'number' },
        totalDiffsComputed: { type: 'number' },
        l1CacheSize: { type: 'number' },
        rateLimitUsagePercent: { type: 'number' },
      },
    },
    version: { type: 'string' },
    uptimeSeconds: { type: 'number' },
  },
  required: ['status', 'timestamp', 'dependencies'],
} as const;

/**
 * Options for registering health routes
 */
export interface DiffHealthRouteOptions {
  /** Health check instance */
  readonly healthCheck: DiffHealthCheck;
  /** Route prefix (default: '/api/v1/graph-diff') */
  readonly prefix?: string | undefined;
}

/**
 * Register graph diff health check routes with Fastify
 * @param fastify - Fastify instance
 * @param options - Route options
 */
export const registerDiffHealthRoutes: FastifyPluginAsync<DiffHealthRouteOptions> = async (
  fastify: FastifyInstance,
  options: DiffHealthRouteOptions
): Promise<void> => {
  const { healthCheck } = options;

  /**
   * GET /health - Graph diff service health check
   */
  fastify.get<{ Reply: DiffServiceHealth }>(
    '/health',
    {
      schema: {
        response: {
          200: DiffServiceHealthSchema,
          503: DiffServiceHealthSchema,
        },
      },
    },
    async (_request, reply) => {
      const health = await healthCheck.check();

      const statusCode = health.status === 'healthy' ? 200 : 503;
      return reply.status(statusCode).send(health);
    }
  );

  /**
   * GET /health/live - Liveness probe
   */
  fastify.get(
    '/health/live',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              alive: { type: 'boolean' },
              timestamp: { type: 'string', format: 'date-time' },
            },
            required: ['alive', 'timestamp'],
          },
        },
      },
    },
    async (_request, reply) => {
      return reply.status(200).send({
        alive: true,
        timestamp: new Date().toISOString(),
      });
    }
  );

  /**
   * GET /health/ready - Readiness probe
   */
  fastify.get<{ Reply: { ready: boolean; timestamp: string; dependencies: Record<string, boolean> } }>(
    '/health/ready',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              timestamp: { type: 'string', format: 'date-time' },
              dependencies: {
                type: 'object',
                additionalProperties: { type: 'boolean' },
              },
            },
            required: ['ready', 'timestamp', 'dependencies'],
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              timestamp: { type: 'string', format: 'date-time' },
              dependencies: {
                type: 'object',
                additionalProperties: { type: 'boolean' },
              },
            },
            required: ['ready', 'timestamp', 'dependencies'],
          },
        },
      },
    },
    async (_request, reply) => {
      const health = await healthCheck.check();

      // Service is ready if status is healthy or degraded
      const ready = health.status !== 'unhealthy';

      // Convert dependency health to simple boolean map
      const dependencies: Record<string, boolean> = {};
      for (const dep of health.dependencies) {
        dependencies[dep.name] = dep.status !== 'down';
      }

      const statusCode = ready ? 200 : 503;
      return reply.status(statusCode).send({
        ready,
        timestamp: new Date().toISOString(),
        dependencies,
      });
    }
  );
};

/**
 * Create and register health routes as a Fastify plugin
 * @param deps - Health check dependencies
 * @param config - Health check configuration
 * @param routeOptions - Additional route options
 * @returns Fastify plugin async function
 */
export function createDiffHealthPlugin(
  deps: DiffHealthCheckDependencies,
  config?: DiffHealthCheckConfig,
  routeOptions?: Omit<DiffHealthRouteOptions, 'healthCheck'>
): FastifyPluginAsync {
  const healthCheck = createDiffHealthCheck(deps, config);

  return async (fastify: FastifyInstance): Promise<void> => {
    await registerDiffHealthRoutes(fastify, {
      ...routeOptions,
      healthCheck,
    });
  };
}

// ============================================================================
// Default Instance Management
// ============================================================================

let defaultDiffHealthCheck: DiffHealthCheck | null = null;

/**
 * Get the default DiffHealthCheck instance
 * @param deps - Dependencies for creation if not exists
 * @param config - Configuration for creation if not exists
 * @returns Default DiffHealthCheck instance
 * @throws Error if no instance exists and deps not provided
 */
export function getDefaultDiffHealthCheck(
  deps?: DiffHealthCheckDependencies,
  config?: DiffHealthCheckConfig
): DiffHealthCheck {
  if (!defaultDiffHealthCheck) {
    if (!deps) {
      throw new Error(
        'DiffHealthCheck not initialized. Provide dependencies for first call.'
      );
    }
    defaultDiffHealthCheck = new DiffHealthCheck(deps, config);
  }
  return defaultDiffHealthCheck;
}

/**
 * Reset the default DiffHealthCheck instance
 */
export function resetDefaultDiffHealthCheck(): void {
  defaultDiffHealthCheck = null;
}

// ============================================================================
// Re-exports
// ============================================================================

export type {
  DiffCacheStats,
  IRateLimiter,
  RateLimitResult,
};
