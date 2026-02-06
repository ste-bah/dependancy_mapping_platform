/**
 * Rollup Entity-to-Response Mappers
 * @module types/rollup-mappers
 *
 * Mapper functions for converting between database entities and API responses
 * for the Cross-Repository Aggregation (Rollup) system.
 *
 * TASK-ROLLUP-001: Cross-Repository Aggregation mappers
 */

import {
  RollupConfig,
  RollupResponse,
  RollupListResponse,
  RollupExecutionResult,
  RollupExecutionStats,
  MatchResult,
  MergedNode,
  BlastRadiusResponse,
  BlastRadiusQuery,
  createRollupId,
  createRollupExecutionId,
} from './rollup.js';
import {
  RollupEntity,
  RollupExecutionEntity,
  ConfigurationValidationResult,
} from '../services/rollup/interfaces.js';
import { NodeType, GraphEdge, NodeLocation } from './graph.js';
import { RepositoryId, ScanId, TenantId } from './entities.js';

// ============================================================================
// Entity to Config Mappers
// ============================================================================

/**
 * Map a RollupEntity to a RollupConfig
 */
export function mapRollupEntityToConfig(entity: RollupEntity): RollupConfig {
  return {
    id: entity.id,
    tenantId: entity.tenantId as string,
    name: entity.name,
    description: entity.description ?? undefined,
    status: entity.status,
    repositoryIds: entity.repositoryIds as string[],
    scanIds: entity.scanIds ?? undefined,
    matchers: entity.matchers,
    includeNodeTypes: entity.includeNodeTypes ?? undefined,
    excludeNodeTypes: entity.excludeNodeTypes ?? undefined,
    preserveEdgeTypes: entity.preserveEdgeTypes ?? undefined,
    mergeOptions: entity.mergeOptions,
    schedule: entity.schedule ?? undefined,
    version: entity.version,
    createdBy: entity.createdBy,
    updatedBy: entity.updatedBy ?? undefined,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    lastExecutedAt: entity.lastExecutedAt?.toISOString(),
  };
}

/**
 * Map a RollupEntity to a RollupResponse (with optional execution info)
 */
export function mapRollupEntityToResponse(
  entity: RollupEntity,
  latestExecution?: RollupExecutionEntity | null
): RollupResponse {
  const config = mapRollupEntityToConfig(entity);

  const response: RollupResponse = {
    data: config,
  };

  if (latestExecution) {
    response.latestExecution = {
      id: latestExecution.id as string,
      status: latestExecution.status,
      startedAt: latestExecution.startedAt?.toISOString(),
      completedAt: latestExecution.completedAt?.toISOString(),
      stats: latestExecution.stats ?? undefined,
    };
  }

  return response;
}

/**
 * Map multiple RollupEntities to a RollupListResponse
 */
export function mapRollupEntitiesToListResponse(
  entities: RollupEntity[],
  total: number,
  page: number,
  pageSize: number
): RollupListResponse {
  const totalPages = Math.ceil(total / pageSize);

  return {
    data: entities.map(mapRollupEntityToConfig),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    },
  };
}

// ============================================================================
// Execution Entity Mappers
// ============================================================================

/**
 * Map a RollupExecutionEntity to a RollupExecutionResult
 */
export function mapRollupExecutionEntityToResult(entity: RollupExecutionEntity): RollupExecutionResult {
  return {
    id: entity.id as string,
    rollupId: entity.rollupId as string,
    tenantId: entity.tenantId as string,
    status: entity.status,
    scanIds: entity.scanIds as string[],
    stats: entity.stats ?? undefined,
    matches: entity.matches ?? undefined,
    mergedNodes: undefined, // Merged nodes are stored separately
    errorMessage: entity.errorMessage ?? undefined,
    errorDetails: entity.errorDetails ?? undefined,
    startedAt: entity.startedAt?.toISOString(),
    completedAt: entity.completedAt?.toISOString(),
    createdAt: entity.createdAt.toISOString(),
  };
}

/**
 * Map multiple execution entities to results
 */
export function mapExecutionEntitiesToResults(
  entities: RollupExecutionEntity[]
): RollupExecutionResult[] {
  return entities.map(mapRollupExecutionEntityToResult);
}

// ============================================================================
// Match Result Mappers
// ============================================================================

/**
 * Create a MatchResult from comparison data
 */
export function createMatchResult(
  sourceNode: NodeType,
  targetNode: NodeType,
  sourceRepoId: RepositoryId,
  targetRepoId: RepositoryId,
  strategy: MatchResult['strategy'],
  confidence: number,
  matchedAttribute: string,
  sourceValue: string,
  targetValue: string,
  context?: Record<string, unknown>
): MatchResult {
  return {
    sourceNodeId: sourceNode.id,
    targetNodeId: targetNode.id,
    sourceRepoId: sourceRepoId as string,
    targetRepoId: targetRepoId as string,
    strategy,
    confidence,
    details: {
      matchedAttribute,
      sourceValue,
      targetValue,
      context,
    },
  };
}

/**
 * Map internal match data to MatchResult
 */
export function mapMatchEntityToResult(
  entity: {
    sourceNodeId: string;
    targetNodeId: string;
    sourceRepoId: string;
    targetRepoId: string;
    strategy: MatchResult['strategy'];
    confidence: number;
    matchedAttribute: string;
    sourceValue: string;
    targetValue: string;
    context?: Record<string, unknown>;
  }
): MatchResult {
  return {
    sourceNodeId: entity.sourceNodeId,
    targetNodeId: entity.targetNodeId,
    sourceRepoId: entity.sourceRepoId,
    targetRepoId: entity.targetRepoId,
    strategy: entity.strategy,
    confidence: entity.confidence,
    details: {
      matchedAttribute: entity.matchedAttribute,
      sourceValue: entity.sourceValue,
      targetValue: entity.targetValue,
      context: entity.context,
    },
  };
}

/**
 * Batch map match entities to results
 */
export function mapMatchEntitiesToResults(
  entities: Array<{
    sourceNodeId: string;
    targetNodeId: string;
    sourceRepoId: string;
    targetRepoId: string;
    strategy: MatchResult['strategy'];
    confidence: number;
    matchedAttribute: string;
    sourceValue: string;
    targetValue: string;
    context?: Record<string, unknown>;
  }>
): MatchResult[] {
  return entities.map(mapMatchEntityToResult);
}

// ============================================================================
// Merged Node Mappers
// ============================================================================

/**
 * Create a MergedNode from merged node data
 */
export function createMergedNode(
  id: string,
  sourceNodes: NodeType[],
  sourceRepoIds: RepositoryId[],
  strategy: MergedNode['matchInfo']['strategy'],
  confidence: number,
  matchCount: number
): MergedNode {
  // Determine the merged name (use first non-empty name)
  const name = sourceNodes.find((n) => n.name)?.name ?? 'Unknown';

  // Determine the type (should be same for all matched nodes)
  const type = sourceNodes[0]?.type ?? 'unknown';

  // Collect all locations
  const locations = sourceNodes.map((node, index) => ({
    repoId: sourceRepoIds[index] as string,
    file: node.location.file,
    lineStart: node.location.lineStart,
    lineEnd: node.location.lineEnd,
  }));

  // Merge metadata from all source nodes
  const metadata = mergeNodeMetadata(sourceNodes);

  return {
    id,
    sourceNodeIds: sourceNodes.map((n) => n.id),
    sourceRepoIds: sourceRepoIds as string[],
    type,
    name,
    locations,
    metadata,
    matchInfo: {
      strategy,
      confidence,
      matchCount,
    },
  };
}

/**
 * Map internal merged node entity to schema
 */
export function mapMergedNodeEntityToSchema(
  entity: {
    id: string;
    sourceNodeIds: string[];
    sourceRepoIds: string[];
    type: string;
    name: string;
    locations: Array<{
      repoId: string;
      file: string;
      lineStart: number;
      lineEnd: number;
    }>;
    metadata: Record<string, unknown>;
    strategy: MergedNode['matchInfo']['strategy'];
    confidence: number;
    matchCount: number;
  }
): MergedNode {
  return {
    id: entity.id,
    sourceNodeIds: entity.sourceNodeIds,
    sourceRepoIds: entity.sourceRepoIds,
    type: entity.type,
    name: entity.name,
    locations: entity.locations,
    metadata: entity.metadata,
    matchInfo: {
      strategy: entity.strategy,
      confidence: entity.confidence,
      matchCount: entity.matchCount,
    },
  };
}

/**
 * Batch map merged node entities to schema
 */
export function mapMergedNodeEntitiesToSchema(
  entities: Array<{
    id: string;
    sourceNodeIds: string[];
    sourceRepoIds: string[];
    type: string;
    name: string;
    locations: Array<{
      repoId: string;
      file: string;
      lineStart: number;
      lineEnd: number;
    }>;
    metadata: Record<string, unknown>;
    strategy: MergedNode['matchInfo']['strategy'];
    confidence: number;
    matchCount: number;
  }>
): MergedNode[] {
  return entities.map(mapMergedNodeEntityToSchema);
}

/**
 * Merge metadata from multiple nodes
 */
function mergeNodeMetadata(nodes: NodeType[]): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  for (const node of nodes) {
    for (const [key, value] of Object.entries(node.metadata)) {
      if (merged[key] === undefined) {
        merged[key] = value;
      } else if (Array.isArray(merged[key]) && Array.isArray(value)) {
        // Merge arrays
        merged[key] = [...new Set([...(merged[key] as unknown[]), ...value])];
      } else if (typeof merged[key] === 'object' && typeof value === 'object') {
        // Merge objects
        merged[key] = { ...(merged[key] as Record<string, unknown>), ...(value as Record<string, unknown>) };
      }
      // Otherwise, keep the first value (conflict resolution: first wins)
    }
  }

  // Add merge metadata
  merged._mergedFrom = nodes.map((n) => n.id);
  merged._mergedAt = new Date().toISOString();

  return merged;
}

// ============================================================================
// Blast Radius Mappers
// ============================================================================

/**
 * Map blast radius analysis data to response
 */
export function mapBlastRadiusToResponse(
  rollupId: string,
  executionId: string,
  query: BlastRadiusQuery,
  analysis: {
    directImpact: Array<{
      nodeId: string;
      nodeType: string;
      nodeName: string;
      repoId: string;
      repoName: string;
      depth: number;
    }>;
    indirectImpact: Array<{
      nodeId: string;
      nodeType: string;
      nodeName: string;
      repoId: string;
      repoName: string;
      depth: number;
      path: string[];
    }>;
    crossRepoImpact: Array<{
      sourceRepoId: string;
      sourceRepoName: string;
      targetRepoId: string;
      targetRepoName: string;
      impactedNodes: number;
      edgeType: string;
    }>;
    summary: {
      totalImpacted: number;
      directCount: number;
      indirectCount: number;
      crossRepoCount: number;
      impactByType: Record<string, number>;
      impactByRepo: Record<string, number>;
      impactByDepth: Record<string, number>;
    };
  }
): BlastRadiusResponse {
  // Calculate risk level based on impact
  const riskLevel = calculateRiskLevel(analysis.summary);

  return {
    query,
    rollupId,
    executionId,
    directImpact: analysis.directImpact,
    indirectImpact: analysis.indirectImpact,
    crossRepoImpact: analysis.crossRepoImpact,
    summary: {
      ...analysis.summary,
      riskLevel,
    },
  };
}

/**
 * Calculate risk level based on impact summary
 */
function calculateRiskLevel(summary: {
  totalImpacted: number;
  crossRepoCount: number;
}): BlastRadiusResponse['summary']['riskLevel'] {
  const { totalImpacted, crossRepoCount } = summary;

  // Critical: Many impacted nodes with cross-repo impact
  if (totalImpacted > 100 && crossRepoCount > 3) {
    return 'critical';
  }

  // High: Significant impact or multiple repos affected
  if (totalImpacted > 50 || crossRepoCount > 2) {
    return 'high';
  }

  // Medium: Moderate impact
  if (totalImpacted > 10 || crossRepoCount > 0) {
    return 'medium';
  }

  // Low: Minimal impact
  return 'low';
}

// ============================================================================
// Statistics Mappers
// ============================================================================

/**
 * Create execution stats from processing results
 */
export function createExecutionStats(
  nodesProcessed: number,
  nodesMatched: number,
  edgesProcessed: number,
  crossRepoEdgesCreated: number,
  matchesByStrategy: Record<string, number>,
  nodesByType: Record<string, number>,
  edgesByType: Record<string, number>,
  executionTimeMs: number,
  memoryPeakBytes?: number
): RollupExecutionStats {
  return {
    totalNodesProcessed: nodesProcessed,
    nodesMatched,
    nodesUnmatched: nodesProcessed - nodesMatched,
    totalEdgesProcessed: edgesProcessed,
    crossRepoEdgesCreated,
    matchesByStrategy: {
      arn: matchesByStrategy['arn'] || 0,
      resource_id: matchesByStrategy['resource_id'] || 0,
      name: matchesByStrategy['name'] || 0,
      tag: matchesByStrategy['tag'] || 0,
    },
    nodesByType,
    edgesByType,
    executionTimeMs,
    memoryPeakBytes,
  };
}

/**
 * Map raw stats data to RollupExecutionStats
 */
export function mapStatsToExecutionStats(
  raw: {
    totalNodesProcessed: number;
    nodesMatched: number;
    nodesUnmatched: number;
    totalEdgesProcessed: number;
    crossRepoEdgesCreated: number;
    matchesByStrategy: Record<string, number>;
    nodesByType: Record<string, number>;
    edgesByType: Record<string, number>;
    executionTimeMs: number;
    memoryPeakBytes?: number;
  }
): RollupExecutionStats {
  return {
    totalNodesProcessed: raw.totalNodesProcessed,
    nodesMatched: raw.nodesMatched,
    nodesUnmatched: raw.nodesUnmatched,
    totalEdgesProcessed: raw.totalEdgesProcessed,
    crossRepoEdgesCreated: raw.crossRepoEdgesCreated,
    matchesByStrategy: {
      arn: raw.matchesByStrategy['arn'] || 0,
      resource_id: raw.matchesByStrategy['resource_id'] || 0,
      name: raw.matchesByStrategy['name'] || 0,
      tag: raw.matchesByStrategy['tag'] || 0,
    },
    nodesByType: { ...raw.nodesByType },
    edgesByType: { ...raw.edgesByType },
    executionTimeMs: raw.executionTimeMs,
    memoryPeakBytes: raw.memoryPeakBytes,
  };
}

// ============================================================================
// Validation Result Mappers
// ============================================================================

/**
 * Map validation result to API response format
 */
export function mapValidationResultToResponse(
  result: ConfigurationValidationResult
): {
  isValid: boolean;
  errors: Array<{
    code: string;
    message: string;
    path: string;
    value?: unknown;
  }>;
  warnings: Array<{
    code: string;
    message: string;
    path: string;
    suggestion?: string;
  }>;
} {
  return {
    isValid: result.isValid,
    errors: result.errors.map((e) => ({
      code: e.code,
      message: e.message,
      path: e.path,
      value: e.value,
    })),
    warnings: result.warnings.map((w) => ({
      code: w.code,
      message: w.message,
      path: w.path,
      suggestion: w.suggestion,
    })),
  };
}

// ============================================================================
// Batch Mapping Utilities
// ============================================================================

/**
 * Batch map function with chunking for large datasets
 */
export function batchMap<T, R>(
  items: T[],
  mapper: (item: T) => R,
  chunkSize: number = 1000
): R[] {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(...chunk.map(mapper));
  }

  return results;
}

/**
 * Batch map with async mapper function
 */
export async function batchMapAsync<T, R>(
  items: T[],
  mapper: (item: T) => Promise<R>,
  chunkSize: number = 100,
  concurrency: number = 5
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += chunkSize * concurrency) {
    const chunks: Promise<R[]>[] = [];

    for (let j = 0; j < concurrency && i + j * chunkSize < items.length; j++) {
      const start = i + j * chunkSize;
      const end = Math.min(start + chunkSize, items.length);
      const chunk = items.slice(start, end);
      chunks.push(Promise.all(chunk.map(mapper)));
    }

    const chunkResults = await Promise.all(chunks);
    for (const result of chunkResults) {
      results.push(...result);
    }
  }

  return results;
}

// ============================================================================
// ID Mapping Utilities
// ============================================================================

/**
 * Create a bidirectional ID mapping for merged nodes
 */
export function createIdMapping(
  sourceIds: string[],
  mergedId: string
): {
  sourceToMerged: Map<string, string>;
  mergedToSources: Map<string, string[]>;
} {
  const sourceToMerged = new Map<string, string>();
  const mergedToSources = new Map<string, string[]>();

  for (const sourceId of sourceIds) {
    sourceToMerged.set(sourceId, mergedId);
  }

  mergedToSources.set(mergedId, [...sourceIds]);

  return { sourceToMerged, mergedToSources };
}

/**
 * Build a complete ID mapping from merged nodes
 */
export function buildIdMappingFromMergedNodes(
  mergedNodes: MergedNode[]
): {
  sourceToMerged: Map<string, string>;
  mergedToSources: Map<string, string[]>;
} {
  const sourceToMerged = new Map<string, string>();
  const mergedToSources = new Map<string, string[]>();

  for (const node of mergedNodes) {
    for (const sourceId of node.sourceNodeIds) {
      sourceToMerged.set(sourceId, node.id);
    }
    mergedToSources.set(node.id, [...node.sourceNodeIds]);
  }

  return { sourceToMerged, mergedToSources };
}
