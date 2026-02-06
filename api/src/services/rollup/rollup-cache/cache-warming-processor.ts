/**
 * Cache Warming Processor
 * @module services/rollup/rollup-cache/cache-warming-processor
 *
 * BullMQ-based processor for proactive cache warming of expensive rollup computations.
 * Handles priority-based warming with concurrency control and rate limiting.
 *
 * Features:
 * - BullMQ job processing for cache warming
 * - Proactive cache population after scans
 * - Priority-based warming (critical nodes first)
 * - Concurrency control and rate limiting
 * - Progress tracking and error handling with retries
 *
 * TASK-ROLLUP-004: Caching layer for expensive rollup computations
 */

import { randomUUID } from 'crypto';
import pino from 'pino';
import { TenantId } from '../../../types/entities.js';
import { RollupId, RollupExecutionId } from '../../../types/rollup.js';
import {
  IRollupCache,
  CachedExecutionResult,
  CachedMergedGraph,
} from './interfaces.js';

// ============================================================================
// Types and Interfaces
// ============================================================================

/**
 * Cache warming target types
 */
export const CacheWarmingTargetType = {
  EXECUTION_RESULT: 'execution_result',
  MERGED_GRAPH: 'merged_graph',
  BLAST_RADIUS: 'blast_radius',
} as const;

export type CacheWarmingTargetType =
  typeof CacheWarmingTargetType[keyof typeof CacheWarmingTargetType];

/**
 * Warming priority levels
 */
export const WarmingPriority = {
  CRITICAL: 10,
  HIGH: 7,
  NORMAL: 5,
  LOW: 3,
  BACKGROUND: 1,
} as const;

export type WarmingPriority = typeof WarmingPriority[keyof typeof WarmingPriority];

/**
 * Job status for cache warming
 */
export const CacheWarmingJobState = {
  PENDING: 'pending',
  ACTIVE: 'active',
  COMPLETED: 'completed',
  FAILED: 'failed',
  DELAYED: 'delayed',
  CANCELLED: 'cancelled',
} as const;

export type CacheWarmingJobState =
  typeof CacheWarmingJobState[keyof typeof CacheWarmingJobState];

/**
 * Cache warming job data payload
 */
export interface CacheWarmingJobData {
  /** Unique job identifier */
  readonly jobId: string;
  /** Tenant identifier */
  readonly tenantId: TenantId;
  /** Priority level for processing */
  readonly priority: WarmingPriority;
  /** Target cache types to warm */
  readonly targetTypes: readonly CacheWarmingTargetType[];
  /** Specific rollup IDs to warm (optional, warms all if not provided) */
  readonly rollupIds?: readonly RollupId[];
  /** Specific execution IDs to warm */
  readonly executionIds?: readonly RollupExecutionId[];
  /** Force refresh even if cached */
  readonly forceRefresh: boolean;
  /** Maximum items to warm in this job */
  readonly maxItems: number;
  /** Job creation timestamp */
  readonly createdAt: string;
}

/**
 * Cache warming job status
 */
export interface CacheWarmingJobStatus {
  /** Job identifier */
  readonly jobId: string;
  /** Current state */
  readonly state: CacheWarmingJobState;
  /** Progress percentage (0-100) */
  readonly progress: number;
  /** Items warmed so far */
  readonly itemsWarmed: number;
  /** Total items to warm */
  readonly totalItems: number;
  /** Cache hits during warming */
  readonly cacheHits: number;
  /** Cache misses (new entries created) */
  readonly cacheMisses: number;
  /** Errors encountered */
  readonly errors: number;
  /** Start timestamp */
  readonly startedAt?: string;
  /** Completion timestamp */
  readonly completedAt?: string;
  /** Error message if failed */
  readonly errorMessage?: string;
}

/**
 * Result of a cache warming operation
 */
export interface CacheWarmingResult {
  /** Job identifier */
  readonly jobId: string;
  /** Whether warming completed successfully */
  readonly success: boolean;
  /** Number of execution results warmed */
  readonly executionsWarmed: number;
  /** Number of merged graphs warmed */
  readonly graphsWarmed: number;
  /** Number of blast radius entries warmed */
  readonly blastRadiusWarmed: number;
  /** Total items warmed */
  readonly totalWarmed: number;
  /** Errors encountered */
  readonly errors: readonly WarmingError[];
  /** Duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Error during cache warming
 */
export interface WarmingError {
  /** Target type that failed */
  readonly targetType: CacheWarmingTargetType;
  /** Identifier of the failed item */
  readonly identifier: string;
  /** Error message */
  readonly message: string;
  /** Error code */
  readonly code: string;
}

/**
 * Configuration for the cache warming processor
 */
export interface CacheWarmingProcessorConfig {
  /** Maximum concurrent warming jobs */
  readonly maxConcurrency: number;
  /** Rate limit: max jobs per second */
  readonly maxJobsPerSecond: number;
  /** Default job timeout in milliseconds */
  readonly jobTimeoutMs: number;
  /** Maximum retry attempts */
  readonly maxRetries: number;
  /** Initial retry delay in milliseconds */
  readonly retryDelayMs: number;
  /** Retry backoff multiplier */
  readonly retryBackoffMultiplier: number;
  /** Default max items per job */
  readonly defaultMaxItems: number;
  /** Batch size for warming operations */
  readonly batchSize: number;
  /** Enable progress reporting */
  readonly enableProgressReporting: boolean;
}

/**
 * Default processor configuration
 */
export const DEFAULT_CACHE_WARMING_CONFIG: CacheWarmingProcessorConfig = {
  maxConcurrency: 5,
  maxJobsPerSecond: 10,
  jobTimeoutMs: 300000, // 5 minutes
  maxRetries: 3,
  retryDelayMs: 1000,
  retryBackoffMultiplier: 2,
  defaultMaxItems: 100,
  batchSize: 10,
  enableProgressReporting: true,
};

/**
 * Cache warming processor interface
 */
export interface ICacheWarmingProcessor {
  /**
   * Process a cache warming job
   */
  process(data: CacheWarmingJobData): Promise<CacheWarmingResult>;

  /**
   * Warm execution results for a tenant
   */
  warmExecutions(
    tenantId: TenantId,
    executionIds?: readonly RollupExecutionId[],
    forceRefresh?: boolean,
    maxItems?: number
  ): Promise<number>;

  /**
   * Warm merged graphs for a tenant
   */
  warmMergedGraphs(
    tenantId: TenantId,
    rollupIds?: readonly RollupId[],
    forceRefresh?: boolean,
    maxItems?: number
  ): Promise<number>;

  /**
   * Schedule a cache warming job
   */
  schedule(
    data: Omit<CacheWarmingJobData, 'jobId' | 'createdAt'>
  ): Promise<string>;

  /**
   * Cancel a scheduled or active job
   */
  cancel(jobId: string): Promise<boolean>;

  /**
   * Get status of a warming job
   */
  getJobStatus(jobId: string): Promise<CacheWarmingJobStatus | null>;
}

/**
 * Data provider interface for fetching rollup data
 */
export interface ICacheWarmingDataProvider {
  /**
   * Fetch execution result for caching
   */
  fetchExecutionResult(
    tenantId: TenantId,
    executionId: RollupExecutionId
  ): Promise<CachedExecutionResult | null>;

  /**
   * Fetch merged graph for caching
   */
  fetchMergedGraph(
    tenantId: TenantId,
    rollupId: RollupId
  ): Promise<CachedMergedGraph | null>;

  /**
   * List execution IDs for a tenant
   */
  listExecutionIds(
    tenantId: TenantId,
    limit: number
  ): Promise<readonly RollupExecutionId[]>;

  /**
   * List rollup IDs for a tenant
   */
  listRollupIds(
    tenantId: TenantId,
    limit: number
  ): Promise<readonly RollupId[]>;
}

/**
 * Dependencies for CacheWarmingProcessor
 */
export interface CacheWarmingProcessorDependencies {
  /** Rollup cache instance */
  readonly cache: IRollupCache;
  /** Data provider for fetching rollup data */
  readonly dataProvider: ICacheWarmingDataProvider;
  /** Configuration (optional) */
  readonly config?: Partial<CacheWarmingProcessorConfig>;
  /** Logger instance (optional) */
  readonly logger?: pino.Logger;
}

// ============================================================================
// Cache Warming Processor Implementation
// ============================================================================

/**
 * BullMQ-based processor for proactive cache warming.
 * Handles priority-based warming with concurrency control.
 */
export class CacheWarmingProcessor implements ICacheWarmingProcessor {
  private readonly cache: IRollupCache;
  private readonly dataProvider: ICacheWarmingDataProvider;
  private readonly config: CacheWarmingProcessorConfig;
  private readonly logger: pino.Logger;
  private readonly jobs: Map<string, CacheWarmingJobStatus>;
  private readonly rateLimiter: RateLimiter;
  private activeJobs: number = 0;

  constructor(deps: CacheWarmingProcessorDependencies) {
    this.cache = deps.cache;
    this.dataProvider = deps.dataProvider;
    this.config = { ...DEFAULT_CACHE_WARMING_CONFIG, ...deps.config };
    this.logger = deps.logger ?? pino({ name: 'cache-warming-processor' });
    this.jobs = new Map();
    this.rateLimiter = new RateLimiter(this.config.maxJobsPerSecond);

    this.logger.info(
      {
        maxConcurrency: this.config.maxConcurrency,
        maxJobsPerSecond: this.config.maxJobsPerSecond,
        batchSize: this.config.batchSize,
      },
      'Cache warming processor initialized'
    );
  }

  // =========================================================================
  // Main Processing
  // =========================================================================

  /**
   * Process a cache warming job
   */
  async process(data: CacheWarmingJobData): Promise<CacheWarmingResult> {
    const startTime = Date.now();
    const { jobId, tenantId, targetTypes, forceRefresh, maxItems } = data;

    this.logger.info(
      { jobId, tenantId, targetTypes, priority: data.priority },
      'Starting cache warming job'
    );

    // Initialize job status
    const status: CacheWarmingJobStatus = {
      jobId,
      state: CacheWarmingJobState.ACTIVE,
      progress: 0,
      itemsWarmed: 0,
      totalItems: maxItems,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      startedAt: new Date().toISOString(),
    };
    this.jobs.set(jobId, status);

    const errors: WarmingError[] = [];
    let executionsWarmed = 0;
    let graphsWarmed = 0;
    let blastRadiusWarmed = 0;

    try {
      // Check concurrency limit
      await this.waitForConcurrencySlot();
      this.activeJobs++;

      // Process each target type
      for (const targetType of targetTypes) {
        // Apply rate limiting
        await this.rateLimiter.acquire();

        try {
          switch (targetType) {
            case CacheWarmingTargetType.EXECUTION_RESULT:
              executionsWarmed = await this.warmExecutions(
                tenantId,
                data.executionIds,
                forceRefresh,
                maxItems
              );
              break;

            case CacheWarmingTargetType.MERGED_GRAPH:
              graphsWarmed = await this.warmMergedGraphs(
                tenantId,
                data.rollupIds,
                forceRefresh,
                maxItems
              );
              break;

            case CacheWarmingTargetType.BLAST_RADIUS:
              // Blast radius warming requires specific node context
              // Skip if no specific IDs provided
              this.logger.debug(
                { jobId },
                'Blast radius warming skipped (requires specific node context)'
              );
              break;
          }

          // Update progress
          this.updateJobProgress(jobId, targetTypes, targetType, status);
        } catch (error) {
          const errMsg = error instanceof Error ? error.message : String(error);
          errors.push({
            targetType,
            identifier: tenantId,
            message: errMsg,
            code: 'WARMING_FAILED',
          });

          this.logger.error(
            { error, jobId, targetType },
            'Error warming cache target type'
          );
        }
      }

      // Mark job completed - build object conditionally to satisfy exactOptionalPropertyTypes
      const baseStatus = {
        jobId: status.jobId,
        state: errors.length > 0 ? CacheWarmingJobState.FAILED : CacheWarmingJobState.COMPLETED,
        progress: 100,
        itemsWarmed: executionsWarmed + graphsWarmed + blastRadiusWarmed,
        totalItems: status.totalItems,
        cacheHits: status.cacheHits,
        cacheMisses: executionsWarmed + graphsWarmed + blastRadiusWarmed,
        errors: errors.length,
        completedAt: new Date().toISOString(),
      };

      // Add optional properties only if defined
      const finalStatus: CacheWarmingJobStatus = status.startedAt
        ? { ...baseStatus, startedAt: status.startedAt }
        : baseStatus;

      // Add errorMessage only if there are errors
      const statusWithError: CacheWarmingJobStatus = errors.length > 0
        ? { ...finalStatus, errorMessage: errors.map(e => e.message).join('; ') }
        : finalStatus;

      this.jobs.set(jobId, statusWithError);

      const result: CacheWarmingResult = {
        jobId,
        success: errors.length === 0,
        executionsWarmed,
        graphsWarmed,
        blastRadiusWarmed,
        totalWarmed: executionsWarmed + graphsWarmed + blastRadiusWarmed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.info(
        {
          jobId,
          totalWarmed: result.totalWarmed,
          durationMs: result.durationMs,
          errors: errors.length,
        },
        'Cache warming job completed'
      );

      return result;
    } finally {
      this.activeJobs--;
    }
  }

  // =========================================================================
  // Execution Warming
  // =========================================================================

  /**
   * Warm execution results for a tenant
   */
  async warmExecutions(
    tenantId: TenantId,
    executionIds?: readonly RollupExecutionId[],
    forceRefresh: boolean = false,
    maxItems: number = this.config.defaultMaxItems
  ): Promise<number> {
    this.logger.debug(
      { tenantId, executionIds: executionIds?.length, forceRefresh, maxItems },
      'Warming execution results'
    );

    // Get execution IDs to warm
    const idsToWarm = executionIds ??
      await this.dataProvider.listExecutionIds(tenantId, maxItems);

    if (idsToWarm.length === 0) {
      this.logger.debug({ tenantId }, 'No execution results to warm');
      return 0;
    }

    let warmed = 0;

    // Process in batches
    for (let i = 0; i < idsToWarm.length; i += this.config.batchSize) {
      const batch = idsToWarm.slice(i, i + this.config.batchSize);

      const results = await Promise.allSettled(
        batch.map(async (executionId) => {
          // Check if already cached (unless force refresh)
          if (!forceRefresh) {
            const existing = await this.cache.getExecutionResult(tenantId, executionId);
            if (existing) {
              this.logger.trace({ executionId }, 'Execution result already cached');
              return false;
            }
          }

          // Fetch and cache
          const result = await this.dataProvider.fetchExecutionResult(tenantId, executionId);
          if (result) {
            await this.cache.setExecutionResult(
              tenantId,
              executionId,
              result.rollupId,
              result.data
            );
            return true;
          }
          return false;
        })
      );

      // Count successful warmings
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          warmed++;
        }
      }
    }

    this.logger.info(
      { tenantId, warmed, total: idsToWarm.length },
      'Execution results warming completed'
    );

    return warmed;
  }

  // =========================================================================
  // Merged Graph Warming
  // =========================================================================

  /**
   * Warm merged graphs for a tenant
   */
  async warmMergedGraphs(
    tenantId: TenantId,
    rollupIds?: readonly RollupId[],
    forceRefresh: boolean = false,
    maxItems: number = this.config.defaultMaxItems
  ): Promise<number> {
    this.logger.debug(
      { tenantId, rollupIds: rollupIds?.length, forceRefresh, maxItems },
      'Warming merged graphs'
    );

    // Get rollup IDs to warm
    const idsToWarm = rollupIds ??
      await this.dataProvider.listRollupIds(tenantId, maxItems);

    if (idsToWarm.length === 0) {
      this.logger.debug({ tenantId }, 'No merged graphs to warm');
      return 0;
    }

    let warmed = 0;

    // Process in batches
    for (let i = 0; i < idsToWarm.length; i += this.config.batchSize) {
      const batch = idsToWarm.slice(i, i + this.config.batchSize);

      const results = await Promise.allSettled(
        batch.map(async (rollupId) => {
          // Check if already cached (unless force refresh)
          if (!forceRefresh) {
            const existing = await this.cache.getMergedGraph(tenantId, rollupId);
            if (existing) {
              this.logger.trace({ rollupId }, 'Merged graph already cached');
              return false;
            }
          }

          // Fetch and cache
          const graph = await this.dataProvider.fetchMergedGraph(tenantId, rollupId);
          if (graph) {
            await this.cache.setMergedGraph(tenantId, rollupId, graph);
            return true;
          }
          return false;
        })
      );

      // Count successful warmings
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value) {
          warmed++;
        }
      }
    }

    this.logger.info(
      { tenantId, warmed, total: idsToWarm.length },
      'Merged graphs warming completed'
    );

    return warmed;
  }

  // =========================================================================
  // Job Scheduling
  // =========================================================================

  /**
   * Schedule a cache warming job
   */
  async schedule(
    data: Omit<CacheWarmingJobData, 'jobId' | 'createdAt'>
  ): Promise<string> {
    const jobId = generateWarmingJobId(data.tenantId);
    const jobData: CacheWarmingJobData = {
      ...data,
      jobId,
      createdAt: new Date().toISOString(),
    };

    // Initialize pending status
    const status: CacheWarmingJobStatus = {
      jobId,
      state: CacheWarmingJobState.PENDING,
      progress: 0,
      itemsWarmed: 0,
      totalItems: data.maxItems,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
    };
    this.jobs.set(jobId, status);

    this.logger.info(
      { jobId, tenantId: data.tenantId, priority: data.priority },
      'Cache warming job scheduled'
    );

    // Start processing (in production, this would be queued to BullMQ)
    // For now, we process immediately in the background
    this.processWithRetry(jobData).catch((error) => {
      this.logger.error({ error, jobId }, 'Failed to process warming job');
    });

    return jobId;
  }

  /**
   * Cancel a scheduled or active job
   */
  async cancel(jobId: string): Promise<boolean> {
    const status = this.jobs.get(jobId);

    if (!status) {
      this.logger.warn({ jobId }, 'Job not found for cancellation');
      return false;
    }

    if (status.state === CacheWarmingJobState.COMPLETED ||
        status.state === CacheWarmingJobState.FAILED) {
      this.logger.warn({ jobId }, 'Cannot cancel completed or failed job');
      return false;
    }

    // Mark as cancelled
    this.jobs.set(jobId, {
      ...status,
      state: CacheWarmingJobState.CANCELLED,
      completedAt: new Date().toISOString(),
    });

    this.logger.info({ jobId }, 'Cache warming job cancelled');
    return true;
  }

  /**
   * Get status of a warming job
   */
  async getJobStatus(jobId: string): Promise<CacheWarmingJobStatus | null> {
    return this.jobs.get(jobId) ?? null;
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Wait for a concurrency slot to become available
   */
  private async waitForConcurrencySlot(): Promise<void> {
    while (this.activeJobs >= this.config.maxConcurrency) {
      await sleep(100);
    }
  }

  /**
   * Process job with retry logic
   */
  private async processWithRetry(data: CacheWarmingJobData): Promise<CacheWarmingResult> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.config.maxRetries) {
      attempt++;

      try {
        // Check if cancelled
        const status = this.jobs.get(data.jobId);
        if (status?.state === CacheWarmingJobState.CANCELLED) {
          throw new Error('Job was cancelled');
        }

        return await this.process(data);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxRetries) {
          const delay = this.config.retryDelayMs *
            Math.pow(this.config.retryBackoffMultiplier, attempt - 1);

          this.logger.warn(
            { jobId: data.jobId, attempt, delay, error: lastError.message },
            'Warming job failed, retrying'
          );

          // Update status to delayed
          const status = this.jobs.get(data.jobId);
          if (status) {
            this.jobs.set(data.jobId, {
              ...status,
              state: CacheWarmingJobState.DELAYED,
            });
          }

          await sleep(delay);
        }
      }
    }

    // All retries exhausted
    const status = this.jobs.get(data.jobId);
    if (status) {
      this.jobs.set(data.jobId, {
        ...status,
        state: CacheWarmingJobState.FAILED,
        completedAt: new Date().toISOString(),
        errorMessage: lastError?.message ?? 'Unknown error',
      });
    }

    throw lastError ?? new Error('Unknown error after retries');
  }

  /**
   * Update job progress
   */
  private updateJobProgress(
    jobId: string,
    targetTypes: readonly CacheWarmingTargetType[],
    completedType: CacheWarmingTargetType,
    currentStatus: CacheWarmingJobStatus
  ): void {
    if (!this.config.enableProgressReporting) return;

    const completedIndex = targetTypes.indexOf(completedType);
    const progress = Math.round(((completedIndex + 1) / targetTypes.length) * 100);

    this.jobs.set(jobId, {
      ...currentStatus,
      progress,
    });
  }
}

// ============================================================================
// Rate Limiter
// ============================================================================

/**
 * Simple token bucket rate limiter
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly maxTokens: number;
  private readonly refillRate: number;

  constructor(tokensPerSecond: number) {
    this.maxTokens = tokensPerSecond;
    this.tokens = tokensPerSecond;
    this.refillRate = tokensPerSecond;
    this.lastRefill = Date.now();
  }

  async acquire(): Promise<void> {
    this.refill();

    while (this.tokens < 1) {
      await sleep(100);
      this.refill();
    }

    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate a unique warming job ID
 * @param _tenantId - Tenant ID (reserved for future use in job ID format)
 */
function generateWarmingJobId(_tenantId: TenantId): string {
  const timestamp = Date.now().toString(36);
  const random = randomUUID().split('-')[0];
  return `warm_${timestamp}_${random}`;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new CacheWarmingProcessor instance
 */
export function createCacheWarmingProcessor(
  deps: CacheWarmingProcessorDependencies
): ICacheWarmingProcessor {
  return new CacheWarmingProcessor(deps);
}

/**
 * Default processor instance holder
 */
let defaultProcessor: CacheWarmingProcessor | null = null;

/**
 * Get the default cache warming processor
 * @throws Error if not initialized
 */
export function getDefaultCacheWarmingProcessor(): ICacheWarmingProcessor {
  if (!defaultProcessor) {
    throw new Error(
      'Default cache warming processor not initialized. ' +
      'Call initializeDefaultCacheWarmingProcessor first.'
    );
  }
  return defaultProcessor;
}

/**
 * Initialize the default cache warming processor
 */
export function initializeDefaultCacheWarmingProcessor(
  deps: CacheWarmingProcessorDependencies
): ICacheWarmingProcessor {
  defaultProcessor = new CacheWarmingProcessor(deps);
  return defaultProcessor;
}

/**
 * Reset the default cache warming processor
 */
export function resetDefaultCacheWarmingProcessor(): void {
  defaultProcessor = null;
}

// ============================================================================
// BullMQ Job Options
// ============================================================================

/**
 * Default job options for cache warming
 */
export const CACHE_WARMING_JOB_OPTIONS = {
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 100, // Keep last 100 completed jobs
  },
  removeOnFail: {
    age: 86400, // Keep failed jobs for 24 hours
    count: 500, // Keep last 500 failed jobs
  },
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  timeout: 300000, // 5 minutes
} as const;

/**
 * Queue name for cache warming jobs
 */
export const CACHE_WARMING_QUEUE_NAME = 'rollup:cache-warming' as const;

/**
 * Job type identifier
 */
export const CACHE_WARMING_JOB_TYPE = 'warm-cache' as const;
