/**
 * Scan Orchestration Service
 * @module services/scan-service
 *
 * Orchestrates the complete scan workflow for IaC dependency detection.
 * Coordinates file discovery, parsing, detection, scoring, graph building, and persistence.
 *
 * TASK-DETECT: Primary scan orchestration service
 */

import pino from 'pino';
import {
  ScanId,
  ScanStatus,
  ScanConfig,
  ScanProgress,
  ScanPhase,
  ScanResultSummary,
  ScanError,
  ScanWarning,
  ScanEntity,
  RepositoryId,
  TenantId,
  UserId,
  ConfidenceDistribution,
  DEFAULT_SCAN_CONFIG,
  createScanId,
  createEmptyScanProgress,
  createEmptyConfidenceDistribution,
} from '../types/entities.js';
import { DependencyGraph, NodeType, GraphEdge } from '../types/graph.js';
import { Result, success, failure, isSuccess } from '../types/utility.js';

// Import other services (will be injected)
import type { IParserOrchestrator, ParserOrchestratorInput } from './parser-orchestrator.js';
import type { IDetectionOrchestrator, DetectionOrchestratorInput } from './detection-orchestrator.js';
import type { IGraphService } from './graph-service.js';
import type { IScoringService } from './scoring-service.js';

const logger = pino({ name: 'scan-service' });

// ============================================================================
// Types
// ============================================================================

/**
 * Scan service configuration
 */
export interface ScanServiceConfig {
  /** Maximum concurrent file processing */
  readonly maxConcurrency: number;
  /** Timeout for entire scan in milliseconds */
  readonly scanTimeoutMs: number;
  /** Progress update interval in milliseconds */
  readonly progressIntervalMs: number;
  /** Enable partial results on failure */
  readonly enablePartialResults: boolean;
  /** Retry failed operations */
  readonly retryOnFailure: boolean;
  /** Maximum retry attempts */
  readonly maxRetries: number;
}

/**
 * Default scan service configuration
 */
export const DEFAULT_SCAN_SERVICE_CONFIG: ScanServiceConfig = {
  maxConcurrency: 10,
  scanTimeoutMs: 300000, // 5 minutes
  progressIntervalMs: 1000,
  enablePartialResults: true,
  retryOnFailure: true,
  maxRetries: 3,
};

/**
 * Input for starting a scan
 */
export interface StartScanInput {
  /** Repository ID to scan */
  readonly repositoryId: RepositoryId;
  /** Tenant ID */
  readonly tenantId: TenantId;
  /** User initiating the scan */
  readonly initiatedBy: UserId;
  /** Branch/ref to scan */
  readonly ref: string;
  /** Commit SHA */
  readonly commitSha: string;
  /** Base path to the repository files */
  readonly basePath: string;
  /** Scan configuration overrides */
  readonly config?: Partial<ScanConfig>;
  /** Callback URL for progress notifications */
  readonly callbackUrl?: string;
}

/**
 * Scan result
 */
export interface ScanResult {
  /** Scan ID */
  readonly scanId: ScanId;
  /** Final status */
  readonly status: ScanStatus;
  /** Dependency graph (if successful) */
  readonly graph?: DependencyGraph;
  /** Result summary */
  readonly summary?: ScanResultSummary;
  /** Errors encountered */
  readonly errors: ScanError[];
  /** Warnings */
  readonly warnings: ScanWarning[];
  /** Total duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Progress callback function type
 */
export type ProgressCallback = (progress: ScanProgress) => void | Promise<void>;

/**
 * Scan event types
 */
export type ScanEventType =
  | 'scan.started'
  | 'scan.progress'
  | 'scan.completed'
  | 'scan.failed'
  | 'scan.cancelled';

/**
 * Scan event
 */
export interface ScanEvent {
  readonly type: ScanEventType;
  readonly scanId: ScanId;
  readonly timestamp: Date;
  readonly data: Record<string, unknown>;
}

/**
 * Event emitter interface
 */
export interface IScanEventEmitter {
  emit(event: ScanEvent): void | Promise<void>;
}

// ============================================================================
// Interfaces
// ============================================================================

/**
 * Scan service interface
 */
export interface IScanService {
  /**
   * Start a new scan
   */
  startScan(
    input: StartScanInput,
    onProgress?: ProgressCallback
  ): Promise<Result<ScanResult, ScanServiceError>>;

  /**
   * Cancel a running scan
   */
  cancelScan(scanId: ScanId): Promise<Result<void, ScanServiceError>>;

  /**
   * Get scan status
   */
  getScanStatus(scanId: ScanId): Promise<Result<ScanProgress, ScanServiceError>>;

  /**
   * Resume a paused scan
   */
  resumeScan(scanId: ScanId): Promise<Result<ScanResult, ScanServiceError>>;
}

/**
 * File discovery interface
 */
export interface IFileDiscovery {
  /**
   * Discover IaC files in a directory
   */
  discoverFiles(
    basePath: string,
    config: ScanConfig
  ): Promise<DiscoveredFile[]>;
}

/**
 * Discovered file
 */
export interface DiscoveredFile {
  readonly path: string;
  readonly relativePath: string;
  readonly type: 'terraform' | 'kubernetes' | 'helm' | 'cloudformation' | 'unknown';
  readonly size: number;
}

/**
 * Scan persistence interface
 */
export interface IScanPersistence {
  /**
   * Save scan entity
   */
  saveScan(scan: ScanEntity): Promise<void>;

  /**
   * Update scan progress
   */
  updateProgress(scanId: ScanId, progress: ScanProgress): Promise<void>;

  /**
   * Save scan results (graph, nodes, edges)
   */
  saveResults(
    scanId: ScanId,
    graph: DependencyGraph,
    summary: ScanResultSummary
  ): Promise<void>;

  /**
   * Get scan by ID
   */
  getScan(scanId: ScanId): Promise<ScanEntity | null>;
}

/**
 * Scan service error
 */
export class ScanServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ScanServiceErrorCode,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ScanServiceError';
  }
}

/**
 * Scan service error codes
 */
export type ScanServiceErrorCode =
  | 'SCAN_NOT_FOUND'
  | 'SCAN_ALREADY_RUNNING'
  | 'SCAN_CANCELLED'
  | 'SCAN_TIMEOUT'
  | 'DISCOVERY_FAILED'
  | 'PARSING_FAILED'
  | 'DETECTION_FAILED'
  | 'GRAPH_BUILD_FAILED'
  | 'PERSISTENCE_FAILED'
  | 'INVALID_INPUT'
  | 'INTERNAL_ERROR';

// ============================================================================
// Scan Service Implementation
// ============================================================================

/**
 * Main scan orchestration service
 */
export class ScanService implements IScanService {
  private readonly config: ScanServiceConfig;
  private readonly runningScans: Map<string, AbortController> = new Map();

  constructor(
    private readonly parserOrchestrator: IParserOrchestrator,
    private readonly detectionOrchestrator: IDetectionOrchestrator,
    private readonly graphService: IGraphService,
    private readonly scoringService: IScoringService,
    private readonly fileDiscovery: IFileDiscovery,
    private readonly persistence: IScanPersistence,
    private readonly eventEmitter?: IScanEventEmitter,
    config: Partial<ScanServiceConfig> = {}
  ) {
    this.config = { ...DEFAULT_SCAN_SERVICE_CONFIG, ...config };
  }

  /**
   * Start a new scan
   */
  async startScan(
    input: StartScanInput,
    onProgress?: ProgressCallback
  ): Promise<Result<ScanResult, ScanServiceError>> {
    const scanId = createScanId(crypto.randomUUID());
    const startTime = Date.now();
    const abortController = new AbortController();

    this.runningScans.set(scanId, abortController);

    const scanConfig: ScanConfig = {
      ...DEFAULT_SCAN_CONFIG,
      ...input.config,
    };

    let currentProgress: ScanProgress = {
      ...createEmptyScanProgress(),
      phase: 'initializing',
    };

    const errors: ScanError[] = [];
    const warnings: ScanWarning[] = [];

    // Helper to update progress
    const updateProgress = async (update: Partial<ScanProgress>): Promise<void> => {
      currentProgress = { ...currentProgress, ...update };

      if (onProgress) {
        try {
          await onProgress(currentProgress);
        } catch (err) {
          logger.warn({ err, scanId }, 'Progress callback failed');
        }
      }

      // Persist progress
      try {
        await this.persistence.updateProgress(scanId, currentProgress);
      } catch (err) {
        logger.warn({ err, scanId }, 'Failed to persist progress');
      }

      // Emit progress event
      this.emitEvent({
        type: 'scan.progress',
        scanId,
        timestamp: new Date(),
        data: { progress: currentProgress },
      });
    };

    // Helper to check if cancelled
    const checkCancelled = (): boolean => {
      return abortController.signal.aborted;
    };

    try {
      logger.info({ scanId, repositoryId: input.repositoryId, ref: input.ref }, 'Starting scan');

      // Create initial scan entity
      const scan: ScanEntity = {
        id: scanId,
        tenantId: input.tenantId,
        repositoryId: input.repositoryId,
        initiatedBy: input.initiatedBy,
        status: ScanStatus.RUNNING,
        config: scanConfig,
        ref: input.ref,
        commitSha: input.commitSha,
        progress: currentProgress,
        startedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await this.persistence.saveScan(scan);

      // Emit start event
      this.emitEvent({
        type: 'scan.started',
        scanId,
        timestamp: new Date(),
        data: {
          repositoryId: input.repositoryId,
          ref: input.ref,
        },
      });

      // ================================================================
      // Phase 1: File Discovery
      // ================================================================
      await updateProgress({ phase: 'discovering', percentage: 5 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 1: File discovery');

      const discoveredFiles = await this.fileDiscovery.discoverFiles(
        input.basePath,
        scanConfig
      );

      await updateProgress({
        totalFiles: discoveredFiles.length,
        percentage: 10,
      });

      logger.info({ scanId, fileCount: discoveredFiles.length }, 'Files discovered');

      if (discoveredFiles.length === 0) {
        warnings.push({
          code: 'NO_FILES_FOUND',
          message: 'No IaC files found matching the configuration',
        });

        return success(this.createEmptyResult(scanId, startTime, errors, warnings));
      }

      // ================================================================
      // Phase 2: Parsing
      // ================================================================
      await updateProgress({ phase: 'parsing', percentage: 15 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 2: Parsing files');

      const parserInput: ParserOrchestratorInput = {
        files: discoveredFiles.map(f => ({
          path: f.path,
          type: f.type,
        })),
        config: scanConfig,
        onFileProcessed: async (processed, total) => {
          await updateProgress({
            filesProcessed: processed,
            totalFiles: total,
            percentage: 15 + Math.floor((processed / total) * 25),
          });
        },
      };

      const parseResult = await this.parserOrchestrator.parseFiles(parserInput);

      if (!parseResult.success) {
        for (const error of parseResult.errors) {
          errors.push({
            code: 'PARSE_ERROR',
            message: error.message,
            file: error.file,
            recoverable: error.recoverable ?? true,
          });
        }

        if (!this.config.enablePartialResults || parseResult.results.length === 0) {
          return failure(new ScanServiceError(
            'Parsing failed',
            'PARSING_FAILED',
            { errors }
          ));
        }
      }

      warnings.push(...(parseResult.warnings ?? []).map(w => ({
        code: 'PARSE_WARNING',
        message: w.message,
        file: w.file,
      })));

      logger.info(
        { scanId, parsedFiles: parseResult.results.length },
        'Parsing completed'
      );

      // ================================================================
      // Phase 3: Detection
      // ================================================================
      await updateProgress({ phase: 'detecting', percentage: 45 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 3: Detection');

      const detectionInput: DetectionOrchestratorInput = {
        parsedFiles: parseResult.results,
        basePath: input.basePath,
        config: scanConfig,
        onProgress: async (detected) => {
          await updateProgress({
            nodesDetected: detected.nodes,
            edgesDetected: detected.edges,
            percentage: 45 + Math.floor((detected.progress ?? 0) * 25),
          });
        },
      };

      const detectionResult = await this.detectionOrchestrator.detect(detectionInput);

      if (!detectionResult.success) {
        for (const error of detectionResult.errors) {
          errors.push({
            code: 'DETECTION_ERROR',
            message: error.message,
            file: error.file,
            recoverable: error.recoverable ?? true,
          });
        }

        if (!this.config.enablePartialResults) {
          return failure(new ScanServiceError(
            'Detection failed',
            'DETECTION_FAILED',
            { errors }
          ));
        }
      }

      warnings.push(...(detectionResult.warnings ?? []).map(w => ({
        code: 'DETECTION_WARNING',
        message: w.message,
        file: w.file,
      })));

      logger.info(
        {
          scanId,
          nodes: detectionResult.nodes.length,
          edges: detectionResult.edges.length,
        },
        'Detection completed'
      );

      // ================================================================
      // Phase 4: Scoring
      // ================================================================
      await updateProgress({ phase: 'building_graph', percentage: 75 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 4: Scoring');

      // Score all edges based on evidence
      const scoredEdges = await this.scoringService.scoreEdges(
        detectionResult.edges,
        detectionResult.evidence
      );

      // Filter edges below confidence threshold
      const filteredEdges = scoredEdges.filter(
        edge => edge.metadata.confidence >= scanConfig.minConfidence
      );

      logger.info(
        { scanId, originalEdges: scoredEdges.length, filteredEdges: filteredEdges.length },
        'Scoring completed'
      );

      // ================================================================
      // Phase 5: Graph Building
      // ================================================================
      await updateProgress({ phase: 'building_graph', percentage: 85 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 5: Graph building');

      const graph = await this.graphService.buildGraph({
        nodes: detectionResult.nodes,
        edges: filteredEdges,
        metadata: {
          scanId,
          repositoryId: input.repositoryId,
          ref: input.ref,
          commitSha: input.commitSha,
        },
      });

      // Validate graph
      const validation = await this.graphService.validateGraph(graph);
      if (!validation.isValid) {
        for (const error of validation.errors) {
          warnings.push({
            code: 'GRAPH_VALIDATION_WARNING',
            message: error.message,
          });
        }
      }

      logger.info({ scanId, graphId: graph.id }, 'Graph built successfully');

      // ================================================================
      // Phase 6: Persistence
      // ================================================================
      await updateProgress({ phase: 'storing', percentage: 95 });

      if (checkCancelled()) {
        return this.handleCancellation(scanId, startTime, errors, warnings);
      }

      logger.debug({ scanId }, 'Phase 6: Persistence');

      // Calculate summary
      const summary = this.calculateSummary(
        graph,
        discoveredFiles.length,
        errors,
        warnings,
        filteredEdges
      );

      // Persist results
      await this.persistence.saveResults(scanId, graph, summary);

      // Update scan entity
      const completedScan: Partial<ScanEntity> = {
        status: ScanStatus.COMPLETED,
        progress: {
          ...currentProgress,
          phase: 'completed',
          percentage: 100,
        },
        resultSummary: summary,
        completedAt: new Date(),
        updatedAt: new Date(),
      };

      await this.persistence.saveScan({
        ...scan,
        ...completedScan,
      } as ScanEntity);

      // Clean up
      this.runningScans.delete(scanId);

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          scanId,
          durationMs,
          nodes: summary.totalNodes,
          edges: summary.totalEdges,
        },
        'Scan completed successfully'
      );

      // Emit completion event
      this.emitEvent({
        type: 'scan.completed',
        scanId,
        timestamp: new Date(),
        data: {
          summary,
          durationMs,
        },
      });

      return success({
        scanId,
        status: ScanStatus.COMPLETED,
        graph,
        summary,
        errors,
        warnings,
        durationMs,
      });

    } catch (error) {
      logger.error({ err: error, scanId }, 'Scan failed');

      this.runningScans.delete(scanId);

      const durationMs = Date.now() - startTime;

      errors.push({
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : String(error),
        recoverable: false,
      });

      // Emit failure event
      this.emitEvent({
        type: 'scan.failed',
        scanId,
        timestamp: new Date(),
        data: {
          errors,
          durationMs,
        },
      });

      return failure(new ScanServiceError(
        'Scan failed',
        'INTERNAL_ERROR',
        { errors, cause: error }
      ));
    }
  }

  /**
   * Cancel a running scan
   */
  async cancelScan(scanId: ScanId): Promise<Result<void, ScanServiceError>> {
    const controller = this.runningScans.get(scanId);

    if (!controller) {
      const scan = await this.persistence.getScan(scanId);
      if (!scan) {
        return failure(new ScanServiceError(
          'Scan not found',
          'SCAN_NOT_FOUND'
        ));
      }

      if (scan.status !== ScanStatus.RUNNING) {
        return failure(new ScanServiceError(
          'Scan is not running',
          'SCAN_NOT_FOUND'
        ));
      }
    }

    controller?.abort();

    // Update scan status
    const scan = await this.persistence.getScan(scanId);
    if (scan) {
      await this.persistence.saveScan({
        ...scan,
        status: ScanStatus.CANCELLED,
        updatedAt: new Date(),
      });
    }

    this.runningScans.delete(scanId);

    // Emit cancel event
    this.emitEvent({
      type: 'scan.cancelled',
      scanId,
      timestamp: new Date(),
      data: {},
    });

    logger.info({ scanId }, 'Scan cancelled');

    return success(undefined);
  }

  /**
   * Get scan status
   */
  async getScanStatus(scanId: ScanId): Promise<Result<ScanProgress, ScanServiceError>> {
    const scan = await this.persistence.getScan(scanId);

    if (!scan) {
      return failure(new ScanServiceError(
        'Scan not found',
        'SCAN_NOT_FOUND'
      ));
    }

    return success(scan.progress);
  }

  /**
   * Resume a paused scan (not implemented yet)
   */
  async resumeScan(_scanId: ScanId): Promise<Result<ScanResult, ScanServiceError>> {
    return failure(new ScanServiceError(
      'Resume not implemented',
      'INTERNAL_ERROR'
    ));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private handleCancellation(
    scanId: ScanId,
    startTime: number,
    errors: ScanError[],
    warnings: ScanWarning[]
  ): Result<ScanResult, ScanServiceError> {
    this.runningScans.delete(scanId);

    return success({
      scanId,
      status: ScanStatus.CANCELLED,
      errors,
      warnings,
      durationMs: Date.now() - startTime,
    });
  }

  private createEmptyResult(
    scanId: ScanId,
    startTime: number,
    errors: ScanError[],
    warnings: ScanWarning[]
  ): ScanResult {
    return {
      scanId,
      status: ScanStatus.COMPLETED,
      summary: {
        totalNodes: 0,
        totalEdges: 0,
        nodesByType: {},
        edgesByType: {},
        filesAnalyzed: 0,
        errors,
        warnings,
        confidenceDistribution: createEmptyConfidenceDistribution(),
      },
      errors,
      warnings,
      durationMs: Date.now() - startTime,
    };
  }

  private calculateSummary(
    graph: DependencyGraph,
    filesAnalyzed: number,
    errors: ScanError[],
    warnings: ScanWarning[],
    edges: GraphEdge[]
  ): ScanResultSummary {
    // Calculate confidence distribution
    const confidenceDistribution: ConfidenceDistribution = {
      certain: 0,
      high: 0,
      medium: 0,
      low: 0,
      uncertain: 0,
    };

    for (const edge of edges) {
      const confidence = edge.metadata.confidence;
      if (confidence >= 95) confidenceDistribution.certain++;
      else if (confidence >= 80) confidenceDistribution.high++;
      else if (confidence >= 60) confidenceDistribution.medium++;
      else if (confidence >= 40) confidenceDistribution.low++;
      else confidenceDistribution.uncertain++;
    }

    return {
      totalNodes: graph.nodes.size,
      totalEdges: graph.edges.length,
      nodesByType: graph.metadata.nodeCounts,
      edgesByType: graph.metadata.edgeCounts as Record<string, number>,
      filesAnalyzed,
      errors,
      warnings,
      confidenceDistribution,
    };
  }

  private emitEvent(event: ScanEvent): void {
    if (this.eventEmitter) {
      try {
        this.eventEmitter.emit(event);
      } catch (err) {
        logger.warn({ err, event: event.type }, 'Failed to emit event');
      }
    }
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new scan service
 */
export function createScanService(
  parserOrchestrator: IParserOrchestrator,
  detectionOrchestrator: IDetectionOrchestrator,
  graphService: IGraphService,
  scoringService: IScoringService,
  fileDiscovery: IFileDiscovery,
  persistence: IScanPersistence,
  eventEmitter?: IScanEventEmitter,
  config?: Partial<ScanServiceConfig>
): IScanService {
  return new ScanService(
    parserOrchestrator,
    detectionOrchestrator,
    graphService,
    scoringService,
    fileDiscovery,
    persistence,
    eventEmitter,
    config
  );
}
