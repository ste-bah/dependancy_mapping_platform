/**
 * Rollup Executor
 * @module services/rollup/rollup-executor
 *
 * Core execution engine for Cross-Repository Aggregation (Rollup) operations.
 * Handles the complete execution flow: fetching graphs, applying matchers,
 * merging results, and storing outputs.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation executor implementation
 */

import pino from 'pino';
import {
  RollupConfig,
  RollupExecutionResult,
  RollupExecutionStats,
  MatchResult,
  MergedNode,
  MatchingStrategy,
  createEmptyExecutionStats,
} from '../../types/rollup.js';
import { TenantId, ScanId, RepositoryId } from '../../types/entities.js';
import { DependencyGraph, NodeType, GraphEdge } from '../../types/graph.js';
import {
  IRollupRepository,
  IMatcherFactory,
  IMergeEngine,
  IBlastRadiusEngine,
  RollupExecutionEntity,
  MergeInput,
  MergeOutput,
  IMatcher,
  MatchCandidate,
} from './interfaces.js';
import {
  RollupExecutionError,
  RollupLimitExceededError,
} from './errors.js';
import { IRollupEventEmitter } from './rollup-event-emitter.js';
import { IGraphService } from '../graph-service.js';

const logger = pino({ name: 'rollup-executor' });

// ============================================================================
// Types
// ============================================================================

/**
 * Dependencies required by RollupExecutor
 */
export interface RollupExecutorDependencies {
  readonly rollupRepository: IRollupRepository;
  readonly graphService: IGraphService;
  readonly matcherFactory: IMatcherFactory;
  readonly mergeEngine: IMergeEngine;
  readonly blastRadiusEngine: IBlastRadiusEngine;
  readonly eventEmitter: IRollupEventEmitter;
}

/**
 * Execution context for tracking state
 */
interface ExecutionContext {
  readonly executionId: string;
  readonly rollupId: string;
  readonly tenantId: TenantId;
  readonly startTime: number;
  stats: RollupExecutionStats;
}

/**
 * Source graph with metadata
 */
interface SourceGraph {
  readonly graph: DependencyGraph;
  readonly repositoryId: RepositoryId;
  readonly scanId: ScanId;
}

/**
 * Interface for scan repository (external dependency)
 */
export interface IScanRepository {
  findById(tenantId: TenantId, scanId: ScanId): Promise<ScanEntity | null>;
  getGraphByScanId(tenantId: TenantId, scanId: ScanId): Promise<DependencyGraph | null>;
}

/**
 * Minimal scan entity interface
 */
interface ScanEntity {
  id: ScanId;
  repositoryId: RepositoryId;
  status: string;
}

// ============================================================================
// Rollup Executor Implementation
// ============================================================================

/**
 * Core executor for rollup operations.
 * Orchestrates the complete execution pipeline.
 */
export class RollupExecutor {
  constructor(private readonly deps: RollupExecutorDependencies) {}

  /**
   * Execute a rollup aggregation
   */
  async execute(
    execution: RollupExecutionEntity,
    config: RollupConfig
  ): Promise<RollupExecutionResult> {
    const context: ExecutionContext = {
      executionId: execution.id,
      rollupId: execution.rollupId,
      tenantId: execution.tenantId,
      startTime: Date.now(),
      stats: createEmptyExecutionStats(),
    };

    logger.info(
      {
        executionId: context.executionId,
        rollupId: context.rollupId,
        scanIds: execution.scanIds,
      },
      'Starting rollup execution'
    );

    try {
      // Update status to running
      await this.updateExecutionStatus(context, 'running');

      // Phase 1: Fetch source graphs
      const sourceGraphs = await this.fetchSourceGraphs(
        execution.scanIds,
        context.tenantId,
        context
      );

      // Phase 2: Create matchers
      const matchers = this.createMatchers(config);

      // Phase 3: Apply matching strategies
      const matches = await this.applyMatchers(sourceGraphs, matchers, config, context);

      // Phase 4: Merge graphs
      const mergeOutput = await this.mergeGraphs(sourceGraphs, matches, config, context);

      // Phase 5: Store results
      await this.storeResults(context, mergeOutput, matches);

      // Phase 6: Register with blast radius engine
      await this.registerBlastRadiusData(context, mergeOutput);

      // Finalize execution
      const executionTimeMs = Date.now() - context.startTime;
      context.stats = {
        ...context.stats,
        executionTimeMs,
      };

      // Update execution record
      const updatedExecution = await this.deps.rollupRepository.updateExecution(
        context.tenantId,
        execution.id,
        {
          status: 'completed',
          stats: context.stats,
          matches,
          mergedGraphId: context.executionId, // Use execution ID as merged graph reference
          startedAt: new Date(context.startTime),
          completedAt: new Date(),
        }
      );

      // Emit completion event
      await this.deps.eventEmitter.emit({
        type: 'rollup.execution.completed',
        rollupId: context.rollupId,
        tenantId: context.tenantId,
        timestamp: new Date(),
        data: {
          executionId: context.executionId,
          stats: context.stats,
        },
      });

      logger.info(
        {
          executionId: context.executionId,
          executionTimeMs,
          nodesMatched: context.stats.nodesMatched,
          nodesUnmatched: context.stats.nodesUnmatched,
        },
        'Rollup execution completed successfully'
      );

      return {
        id: updatedExecution.id,
        rollupId: updatedExecution.rollupId,
        tenantId: updatedExecution.tenantId,
        status: 'completed',
        scanIds: updatedExecution.scanIds,
        stats: context.stats,
        matches,
        mergedNodes: mergeOutput.mergedNodes,
        createdAt: updatedExecution.createdAt.toISOString(),
        startedAt: updatedExecution.startedAt?.toISOString(),
        completedAt: updatedExecution.completedAt?.toISOString(),
      };
    } catch (error) {
      logger.error(
        {
          err: error,
          executionId: context.executionId,
        },
        'Rollup execution failed'
      );

      // Update execution with failure
      await this.deps.rollupRepository.updateExecution(context.tenantId, execution.id, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        errorDetails: this.serializeError(error),
        completedAt: new Date(),
      });

      // Emit failure event
      await this.deps.eventEmitter.emit({
        type: 'rollup.execution.failed',
        rollupId: context.rollupId,
        tenantId: context.tenantId,
        timestamp: new Date(),
        data: {
          executionId: context.executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          phase: this.determineFailedPhase(context),
        },
      });

      throw error;
    }
  }

  // ==========================================================================
  // Phase 1: Fetch Source Graphs
  // ==========================================================================

  /**
   * Fetch dependency graphs from all source scans
   */
  private async fetchSourceGraphs(
    scanIds: ScanId[],
    tenantId: TenantId,
    context: ExecutionContext
  ): Promise<SourceGraph[]> {
    logger.debug({ executionId: context.executionId, scanCount: scanIds.length }, 'Fetching source graphs');

    const sourceGraphs: SourceGraph[] = [];
    let totalNodes = 0;
    let totalEdges = 0;

    for (const scanId of scanIds) {
      // For now, we'll create empty graphs as placeholders
      // In production, this would fetch from the scan repository
      const graph = await this.fetchGraphForScan(tenantId, scanId);

      if (graph) {
        // Extract repositoryId from graph metadata or scan
        const repositoryId = (graph.metadata as { repositoryId?: string }).repositoryId || scanId;

        sourceGraphs.push({
          graph,
          repositoryId: repositoryId as RepositoryId,
          scanId,
        });

        totalNodes += graph.nodes.size;
        totalEdges += graph.edges.length;
      }
    }

    context.stats = {
      ...context.stats,
      totalNodesProcessed: totalNodes,
      totalEdgesProcessed: totalEdges,
    };

    logger.info(
      {
        executionId: context.executionId,
        graphCount: sourceGraphs.length,
        totalNodes,
        totalEdges,
      },
      'Source graphs fetched'
    );

    return sourceGraphs;
  }

  /**
   * Fetch a single graph for a scan
   */
  private async fetchGraphForScan(
    tenantId: TenantId,
    scanId: ScanId
  ): Promise<DependencyGraph | null> {
    // This would integrate with the graph storage system
    // For now, return null to indicate graph should be fetched from elsewhere
    logger.debug({ tenantId, scanId }, 'Fetching graph for scan');

    // In a real implementation, this would call:
    // return this.deps.scanRepository.getGraphByScanId(tenantId, scanId);

    // Placeholder: Create empty graph structure
    return {
      id: `graph_${scanId}`,
      nodes: new Map<string, NodeType>(),
      edges: [],
      metadata: {
        scanId,
        createdAt: new Date().toISOString(),
        nodeCount: 0,
        edgeCount: 0,
        nodeCounts: {},
        edgeCounts: {},
      },
    };
  }

  // ==========================================================================
  // Phase 2: Create Matchers
  // ==========================================================================

  /**
   * Create matcher instances from configuration
   */
  private createMatchers(config: RollupConfig): IMatcher[] {
    logger.debug({ matcherCount: config.matchers.length }, 'Creating matchers');

    return this.deps.matcherFactory.createMatchers(config.matchers);
  }

  // ==========================================================================
  // Phase 3: Apply Matching Strategies
  // ==========================================================================

  /**
   * Apply all matchers to find matches across repositories
   */
  private async applyMatchers(
    sourceGraphs: SourceGraph[],
    matchers: IMatcher[],
    config: RollupConfig,
    context: ExecutionContext
  ): Promise<MatchResult[]> {
    logger.debug(
      {
        executionId: context.executionId,
        matcherCount: matchers.length,
        graphCount: sourceGraphs.length,
      },
      'Applying matchers'
    );

    const allMatches: MatchResult[] = [];
    const matchesByStrategy: Record<MatchingStrategy, number> = {
      arn: 0,
      resource_id: 0,
      name: 0,
      tag: 0,
    };

    // For each matcher, extract candidates and find matches
    for (const matcher of matchers) {
      const candidatesByRepo: Map<string, MatchCandidate[]> = new Map();

      // Extract candidates from each graph
      for (const source of sourceGraphs) {
        const nodes = Array.from(source.graph.nodes.values());

        // Filter by node types if configured
        let filteredNodes = nodes;
        if (config.includeNodeTypes && config.includeNodeTypes.length > 0) {
          filteredNodes = nodes.filter((n) => config.includeNodeTypes!.includes(n.type));
        }
        if (config.excludeNodeTypes && config.excludeNodeTypes.length > 0) {
          filteredNodes = filteredNodes.filter(
            (n) => !config.excludeNodeTypes!.includes(n.type)
          );
        }

        const candidates = matcher.extractCandidates(
          filteredNodes,
          source.repositoryId,
          source.scanId
        );
        candidatesByRepo.set(source.repositoryId, candidates);
      }

      // Compare candidates across repositories
      const repoIds = Array.from(candidatesByRepo.keys());

      for (let i = 0; i < repoIds.length; i++) {
        for (let j = i + 1; j < repoIds.length; j++) {
          const repo1Candidates = candidatesByRepo.get(repoIds[i]) || [];
          const repo2Candidates = candidatesByRepo.get(repoIds[j]) || [];

          for (const candidate1 of repo1Candidates) {
            for (const candidate2 of repo2Candidates) {
              const match = matcher.compare(candidate1, candidate2);
              if (match && match.confidence >= (matcher.config.minConfidence || 80)) {
                allMatches.push(match);
                matchesByStrategy[matcher.strategy]++;
              }
            }
          }
        }
      }
    }

    // Deduplicate matches (keep highest confidence)
    const uniqueMatches = this.deduplicateMatches(allMatches);

    // Update stats
    const matchedNodeIds = new Set<string>();
    for (const match of uniqueMatches) {
      matchedNodeIds.add(match.sourceNodeId);
      matchedNodeIds.add(match.targetNodeId);
    }

    context.stats = {
      ...context.stats,
      nodesMatched: matchedNodeIds.size,
      nodesUnmatched: context.stats.totalNodesProcessed - matchedNodeIds.size,
      matchesByStrategy,
    };

    logger.info(
      {
        executionId: context.executionId,
        totalMatches: uniqueMatches.length,
        matchesByStrategy,
      },
      'Matching completed'
    );

    return uniqueMatches;
  }

  /**
   * Deduplicate matches keeping highest confidence
   */
  private deduplicateMatches(matches: MatchResult[]): MatchResult[] {
    const matchMap = new Map<string, MatchResult>();

    for (const match of matches) {
      // Create a canonical key (sorted node IDs to handle bidirectional)
      const nodeIds = [match.sourceNodeId, match.targetNodeId].sort();
      const key = `${nodeIds[0]}:${nodeIds[1]}`;

      const existing = matchMap.get(key);
      if (!existing || match.confidence > existing.confidence) {
        matchMap.set(key, match);
      }
    }

    return Array.from(matchMap.values());
  }

  // ==========================================================================
  // Phase 4: Merge Graphs
  // ==========================================================================

  /**
   * Merge graphs based on match results
   */
  private async mergeGraphs(
    sourceGraphs: SourceGraph[],
    matches: MatchResult[],
    config: RollupConfig,
    context: ExecutionContext
  ): Promise<MergeOutput> {
    logger.debug(
      {
        executionId: context.executionId,
        graphCount: sourceGraphs.length,
        matchCount: matches.length,
      },
      'Merging graphs'
    );

    const mergeInput: MergeInput = {
      graphs: sourceGraphs.map((sg) => ({
        graph: sg.graph,
        repositoryId: sg.repositoryId,
        scanId: sg.scanId,
      })),
      matches,
      options: config.mergeOptions,
    };

    // Check node limit before merging
    const totalNodes = sourceGraphs.reduce((sum, sg) => sum + sg.graph.nodes.size, 0);
    if (config.mergeOptions.maxNodes && totalNodes > config.mergeOptions.maxNodes) {
      throw new RollupLimitExceededError(
        'nodes',
        totalNodes,
        config.mergeOptions.maxNodes,
        { executionId: context.executionId }
      );
    }

    const output = this.deps.mergeEngine.merge(mergeInput);

    // Update stats with merge results
    context.stats = {
      ...context.stats,
      crossRepoEdgesCreated: output.stats.crossRepoEdges,
      nodesByType: this.countNodesByType(output.mergedNodes, output.unmatchedNodes),
      edgesByType: this.countEdgesByType(output.edges),
    };

    logger.info(
      {
        executionId: context.executionId,
        mergedNodes: output.mergedNodes.length,
        unmatchedNodes: output.unmatchedNodes.length,
        crossRepoEdges: output.stats.crossRepoEdges,
      },
      'Graph merge completed'
    );

    return output;
  }

  /**
   * Count nodes by type
   */
  private countNodesByType(
    mergedNodes: MergedNode[],
    unmatchedNodes: NodeType[]
  ): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const node of mergedNodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }

    for (const node of unmatchedNodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
    }

    return counts;
  }

  /**
   * Count edges by type
   */
  private countEdgesByType(edges: GraphEdge[]): Record<string, number> {
    const counts: Record<string, number> = {};

    for (const edge of edges) {
      counts[edge.type] = (counts[edge.type] || 0) + 1;
    }

    return counts;
  }

  // ==========================================================================
  // Phase 5: Store Results
  // ==========================================================================

  /**
   * Store execution results
   */
  private async storeResults(
    context: ExecutionContext,
    mergeOutput: MergeOutput,
    matches: MatchResult[]
  ): Promise<void> {
    logger.debug({ executionId: context.executionId }, 'Storing results');

    // Results are stored via the repository updateExecution call in execute()
    // This method can be extended for additional storage needs (e.g., separate graph storage)

    // Emit progress event
    await this.deps.eventEmitter.emit({
      type: 'rollup.execution.progress',
      rollupId: context.rollupId,
      tenantId: context.tenantId,
      timestamp: new Date(),
      data: {
        executionId: context.executionId,
        phase: 'storing',
        mergedNodes: mergeOutput.mergedNodes.length,
        matches: matches.length,
      },
    });
  }

  // ==========================================================================
  // Phase 6: Register Blast Radius Data
  // ==========================================================================

  /**
   * Register merged graph with blast radius engine
   */
  private async registerBlastRadiusData(
    context: ExecutionContext,
    mergeOutput: MergeOutput
  ): Promise<void> {
    logger.debug({ executionId: context.executionId }, 'Registering blast radius data');

    // Build repository names map
    const repositoryNames = new Map<string, string>();
    for (const node of mergeOutput.mergedNodes) {
      for (const repoId of node.sourceRepoIds) {
        if (!repositoryNames.has(repoId)) {
          // In production, fetch actual repository names
          repositoryNames.set(repoId, repoId);
        }
      }
    }

    // Register with blast radius engine
    this.deps.blastRadiusEngine.registerGraph(
      context.executionId,
      mergeOutput.mergedNodes,
      mergeOutput.edges,
      repositoryNames
    );

    logger.debug(
      {
        executionId: context.executionId,
        mergedNodeCount: mergeOutput.mergedNodes.length,
      },
      'Blast radius data registered'
    );
  }

  // ==========================================================================
  // Helpers
  // ==========================================================================

  /**
   * Update execution status
   */
  private async updateExecutionStatus(
    context: ExecutionContext,
    status: 'pending' | 'running' | 'completed' | 'failed'
  ): Promise<void> {
    await this.deps.rollupRepository.updateExecution(context.tenantId, context.executionId, {
      status,
      startedAt: status === 'running' ? new Date() : undefined,
    });
  }

  /**
   * Serialize error for storage
   */
  private serializeError(error: unknown): Record<string, unknown> {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error instanceof RollupExecutionError
          ? { phase: error.phase, partialResults: error.partialResults }
          : {}),
      };
    }
    return { message: String(error) };
  }

  /**
   * Determine which phase failed based on context
   */
  private determineFailedPhase(context: ExecutionContext): string {
    if (context.stats.totalNodesProcessed === 0) {
      return 'fetch';
    }
    if (context.stats.nodesMatched === 0 && context.stats.nodesUnmatched === 0) {
      return 'matching';
    }
    if (context.stats.crossRepoEdgesCreated === 0) {
      return 'merging';
    }
    return 'storing';
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new RollupExecutor instance
 */
export function createRollupExecutor(deps: RollupExecutorDependencies): RollupExecutor {
  return new RollupExecutor(deps);
}
