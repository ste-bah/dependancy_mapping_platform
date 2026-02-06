/**
 * External Object Index Service
 * @module services/rollup/external-object-index/external-object-index-service
 *
 * Main service for external object indexing and lookup operations.
 * Provides reverse lookup support for ARNs, Resource IDs, and K8s references.
 *
 * TASK-ROLLUP-003: External Object Index service implementation
 * NFR-PERF-008: 100K nodes < 500ms benchmark target
 */

import pino from 'pino';
import { TenantId, RepositoryId, ScanId } from '../../../types/entities.js';
import { NodeType, DependencyGraph } from '../../../types/graph.js';
import type {
  IExternalObjectIndexService,
  IExternalObjectRepository,
  IExternalObjectCache,
  IIndexEngine,
  ExternalObjectEntry,
  ExternalObjectLookupResult,
  ReverseLookupResult,
  ExternalObjectIndexStats,
  IndexBuildOptions,
  IndexBuildResult,
  ExternalReferenceType,
  ExternalObjectIndexServiceConfig,
  DEFAULT_EXTERNAL_OBJECT_INDEX_CONFIG,
} from './interfaces.js';
import { ExternalObjectIndexError, LookupError } from './errors.js';

const logger = pino({ name: 'external-object-index-service' });

/**
 * Dependencies for ExternalObjectIndexService
 */
export interface ExternalObjectIndexServiceDependencies {
  /** Repository for persistence */
  readonly repository: IExternalObjectRepository;
  /** Cache for lookups */
  readonly cache: IExternalObjectCache;
  /** Index engine for building */
  readonly indexEngine: IIndexEngine;
  /** Graph service for retrieving scan data */
  readonly graphService: IGraphService;
  /** Configuration */
  readonly config?: Partial<ExternalObjectIndexServiceConfig>;
}

/**
 * Graph service interface (minimal for dependency injection)
 */
export interface IGraphService {
  getScanGraph(tenantId: TenantId, scanId: ScanId): Promise<DependencyGraph | null>;
  getLatestScanForRepository(tenantId: TenantId, repositoryId: RepositoryId): Promise<ScanId | null>;
}

/**
 * Main External Object Index Service.
 * Provides indexing, lookup, and reverse lookup for external references.
 */
export class ExternalObjectIndexService implements IExternalObjectIndexService {
  private readonly config: ExternalObjectIndexServiceConfig;
  private readonly repository: IExternalObjectRepository;
  private readonly cache: IExternalObjectCache;
  private readonly indexEngine: IIndexEngine;
  private readonly graphService: IGraphService;

  /**
   * Statistics tracking
   */
  private stats = {
    lastBuildTimeMs: 0,
    lastBuildAt: null as Date | null,
    totalLookups: 0,
    totalLookupTimeMs: 0,
  };

  /**
   * Create a new ExternalObjectIndexService
   * @param deps - Service dependencies
   */
  constructor(deps: ExternalObjectIndexServiceDependencies) {
    this.repository = deps.repository;
    this.cache = deps.cache;
    this.indexEngine = deps.indexEngine;
    this.graphService = deps.graphService;

    // Merge config with defaults
    this.config = {
      cache: {
        l1MaxSize: deps.config?.cache?.l1MaxSize ?? 10000,
        l1TtlSeconds: deps.config?.cache?.l1TtlSeconds ?? 300,
        l2TtlSeconds: deps.config?.cache?.l2TtlSeconds ?? 3600,
        keyPrefix: deps.config?.cache?.keyPrefix ?? 'ext-idx',
        enableL1: deps.config?.cache?.enableL1 ?? true,
        enableL2: deps.config?.cache?.enableL2 ?? true,
      },
      defaultBatchSize: deps.config?.defaultBatchSize ?? 1000,
      maxLookupResults: deps.config?.maxLookupResults ?? 1000,
      enableParallelProcessing: deps.config?.enableParallelProcessing ?? true,
      parallelWorkers: deps.config?.parallelWorkers ?? 4,
      defaultReferenceTypes: deps.config?.defaultReferenceTypes ?? ['arn', 'resource_id', 'k8s_reference'],
    };

    logger.info({ config: this.config }, 'External object index service initialized');
  }

  /**
   * Build or update the index from scan data
   */
  async buildIndex(
    tenantId: TenantId,
    repositoryIds: RepositoryId[],
    options?: IndexBuildOptions
  ): Promise<IndexBuildResult> {
    const startTime = Date.now();
    const result: IndexBuildResult = {
      entriesCreated: 0,
      entriesUpdated: 0,
      entriesSkipped: 0,
      errors: 0,
      buildTimeMs: 0,
      processedScans: [],
    };

    logger.info(
      { tenantId, repositoryCount: repositoryIds.length, options },
      'Starting index build'
    );

    try {
      // Get latest scans for each repository
      const scanPromises = repositoryIds.map(async (repoId) => {
        const scanId = await this.graphService.getLatestScanForRepository(tenantId, repoId);
        return { repositoryId: repoId, scanId };
      });

      const scanResults = await Promise.all(scanPromises);

      // Process each repository's scan
      for (const { repositoryId, scanId } of scanResults) {
        if (!scanId) {
          logger.warn({ repositoryId }, 'No scan found for repository');
          continue;
        }

        try {
          const scanResult = await this.processRepositoryScan(
            tenantId,
            repositoryId,
            scanId,
            options
          );

          result.entriesCreated += scanResult.entriesCreated;
          result.entriesUpdated += scanResult.entriesUpdated;
          result.entriesSkipped += scanResult.entriesSkipped;
          (result.processedScans as ScanId[]).push(scanId);
        } catch (error) {
          logger.error(
            { error, repositoryId, scanId },
            'Failed to process repository scan'
          );
          result.errors++;
        }
      }

      // Update statistics
      const buildTimeMs = Date.now() - startTime;
      this.stats.lastBuildTimeMs = buildTimeMs;
      this.stats.lastBuildAt = new Date();

      // Update result with timing
      (result as { buildTimeMs: number }).buildTimeMs = buildTimeMs;

      logger.info(
        {
          tenantId,
          ...result,
        },
        'Index build completed'
      );

      return result;
    } catch (error) {
      logger.error({ error, tenantId }, 'Index build failed');
      throw new ExternalObjectIndexError(
        `Index build failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXT_OBJ_INDEX_BUILD_FAILED',
        { tenantId, repositoryIds }
      );
    }
  }

  /**
   * Lookup entries by external ID
   */
  async lookupByExternalId(
    tenantId: TenantId,
    externalId: string,
    options?: {
      referenceType?: ExternalReferenceType;
      repositoryIds?: RepositoryId[];
      limit?: number;
      offset?: number;
    }
  ): Promise<ExternalObjectLookupResult> {
    const startTime = Date.now();
    this.stats.totalLookups++;

    // Validate input
    if (!externalId || externalId.trim().length === 0) {
      throw LookupError.invalidExternalId(externalId, 'External ID cannot be empty');
    }

    logger.debug({ tenantId, externalId, options }, 'Looking up external ID');

    try {
      // Build cache key
      const cacheKey = this.cache.buildKey(
        tenantId,
        externalId,
        options?.repositoryIds?.join(',')
      );

      // Try cache first
      let entries = await this.cache.get(cacheKey);
      let fromCache = false;

      if (entries) {
        fromCache = true;
        logger.debug({ cacheKey, entryCount: entries.length }, 'Cache hit');
      } else {
        // Query repository
        entries = await this.repository.findByExternalId(tenantId, externalId, {
          referenceType: options?.referenceType,
          repositoryIds: options?.repositoryIds,
          limit: options?.limit ?? this.config.maxLookupResults,
          offset: options?.offset ?? 0,
        });

        // Cache the result
        if (entries.length > 0) {
          await this.cache.set(cacheKey, entries);
        }
      }

      // Apply post-filtering if needed
      if (options?.referenceType && fromCache) {
        entries = entries.filter((e) => e.referenceType === options.referenceType);
      }

      const lookupTimeMs = Date.now() - startTime;
      this.stats.totalLookupTimeMs += lookupTimeMs;

      const result: ExternalObjectLookupResult = {
        externalId,
        entries,
        totalCount: entries.length,
        fromCache,
        lookupTimeMs,
      };

      logger.debug(
        {
          externalId,
          entryCount: entries.length,
          fromCache,
          lookupTimeMs,
        },
        'Lookup completed'
      );

      return result;
    } catch (error) {
      if (error instanceof LookupError) {
        throw error;
      }
      logger.error({ error, tenantId, externalId }, 'Lookup failed');
      throw new LookupError(
        `Lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        externalId,
        { tenantId }
      );
    }
  }

  /**
   * Reverse lookup: find external references from a node
   */
  async reverseLookup(
    tenantId: TenantId,
    nodeId: string,
    scanId: ScanId
  ): Promise<ReverseLookupResult> {
    const startTime = Date.now();

    logger.debug({ tenantId, nodeId, scanId }, 'Reverse lookup');

    try {
      // Build cache key for reverse lookup
      const cacheKey = `reverse:${tenantId}:${scanId}:${nodeId}`;

      // Try cache first
      let entries = await this.cache.get(cacheKey);
      let fromCache = false;

      if (entries) {
        fromCache = true;
      } else {
        // Query repository
        entries = await this.repository.findByNodeId(tenantId, nodeId, scanId);

        // Cache the result
        if (entries.length > 0) {
          await this.cache.set(cacheKey, entries);
        }
      }

      const lookupTimeMs = Date.now() - startTime;

      const result: ReverseLookupResult = {
        nodeId,
        references: entries,
        totalCount: entries.length,
        fromCache,
        lookupTimeMs,
      };

      logger.debug(
        {
          nodeId,
          scanId,
          referenceCount: entries.length,
          fromCache,
          lookupTimeMs,
        },
        'Reverse lookup completed'
      );

      return result;
    } catch (error) {
      logger.error({ error, tenantId, nodeId, scanId }, 'Reverse lookup failed');
      throw new ExternalObjectIndexError(
        `Reverse lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXT_OBJ_LOOKUP_FAILED',
        { tenantId, nodeId, scanId }
      );
    }
  }

  /**
   * Invalidate index entries
   */
  async invalidate(
    tenantId: TenantId,
    options: {
      repositoryId?: RepositoryId;
      scanId?: ScanId;
      referenceType?: ExternalReferenceType;
    }
  ): Promise<number> {
    logger.info({ tenantId, options }, 'Invalidating index entries');

    try {
      // Delete from repository
      const deletedCount = await this.repository.deleteEntries(tenantId, options);

      // Invalidate cache
      if (options.repositoryId) {
        await this.cache.deleteByPattern(`${tenantId}:${options.repositoryId}:*`);
      } else {
        await this.cache.invalidateTenant(tenantId);
      }

      logger.info({ tenantId, deletedCount }, 'Index entries invalidated');
      return deletedCount;
    } catch (error) {
      logger.error({ error, tenantId, options }, 'Invalidation failed');
      throw new ExternalObjectIndexError(
        `Invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXT_OBJ_CACHE_INVALIDATION_FAILED',
        { tenantId, ...options }
      );
    }
  }

  /**
   * Get index statistics
   */
  async getStats(tenantId: TenantId): Promise<ExternalObjectIndexStats> {
    try {
      const [totalEntries, entriesByType] = await Promise.all([
        this.repository.countEntries(tenantId),
        this.repository.countByType(tenantId),
      ]);

      const cacheStats = this.cache.getStats();
      const avgLookupTimeMs =
        this.stats.totalLookups > 0
          ? this.stats.totalLookupTimeMs / this.stats.totalLookups
          : 0;

      return {
        totalEntries,
        entriesByType,
        entriesByTenant: { [tenantId]: totalEntries },
        lastBuildTimeMs: this.stats.lastBuildTimeMs,
        lastBuildAt: this.stats.lastBuildAt,
        cacheHitRatio: cacheStats.hitRatio,
        avgLookupTimeMs,
      };
    } catch (error) {
      logger.error({ error, tenantId }, 'Failed to get stats');
      throw new ExternalObjectIndexError(
        `Failed to get stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'EXT_OBJ_REPOSITORY_ERROR',
        { tenantId }
      );
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Process a single repository scan
   */
  private async processRepositoryScan(
    tenantId: TenantId,
    repositoryId: RepositoryId,
    scanId: ScanId,
    options?: IndexBuildOptions
  ): Promise<{
    entriesCreated: number;
    entriesUpdated: number;
    entriesSkipped: number;
  }> {
    // Get the scan graph
    const graph = await this.graphService.getScanGraph(tenantId, scanId);
    if (!graph) {
      logger.warn({ scanId }, 'Scan graph not found');
      return { entriesCreated: 0, entriesUpdated: 0, entriesSkipped: 0 };
    }

    // Convert nodes to array
    const nodes = Array.from(graph.nodes.values());

    // Apply batch size limit if specified
    const maxNodes = options?.maxNodes ?? nodes.length;
    const nodesToProcess = nodes.slice(0, maxNodes);

    // Process nodes and extract entries
    const entries = this.indexEngine.processNodes(nodesToProcess, {
      tenantId,
      repositoryId,
      scanId,
    });

    // Save to repository
    const savedCount = await this.repository.saveEntries(entries);

    // Invalidate relevant cache entries
    await this.cache.deleteByPattern(`${tenantId}:${repositoryId}:*`);

    return {
      entriesCreated: savedCount,
      entriesUpdated: 0, // Upserts are counted as created
      entriesSkipped: entries.length - savedCount,
    };
  }
}

/**
 * Create a new ExternalObjectIndexService instance
 */
export function createExternalObjectIndexService(
  deps: ExternalObjectIndexServiceDependencies
): ExternalObjectIndexService {
  return new ExternalObjectIndexService(deps);
}
