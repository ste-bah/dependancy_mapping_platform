/**
 * Graph Routes
 * @module routes/graph
 *
 * REST API endpoints for dependency graph queries and traversals.
 *
 * Endpoints:
 * - GET /api/v1/scans/:scanId/graph - Get full dependency graph
 * - GET /api/v1/scans/:scanId/nodes - List nodes (filtered)
 * - GET /api/v1/scans/:scanId/nodes/:nodeId - Get node details
 * - GET /api/v1/scans/:scanId/nodes/:nodeId/dependencies - Get downstream
 * - GET /api/v1/scans/:scanId/nodes/:nodeId/dependents - Get upstream
 * - GET /api/v1/scans/:scanId/edges - List edges
 * - GET /api/v1/scans/:scanId/cycles - Detect cycles
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import {
  NotFoundError,
  ForbiddenError,
} from '../middleware/error-handler.js';
import {
  ScanIdParamSchema,
  NodeIdParamSchema,
  ErrorResponseSchema,
  createPaginationInfo,
} from './schemas/common.js';
import {
  NodeFilterQuerySchema,
  EdgeFilterQuerySchema,
  TraversalQuerySchema,
  GraphResponseSchema,
  NodeListResponseSchema,
  NodeDetailSchema,
  EdgeListResponseSchema,
  TraversalResultSchema,
  CycleDetectionResultSchema,
  ImpactAnalysisResultSchema,
  type NodeFilterQuery,
  type EdgeFilterQuery,
  type TraversalQuery,
  type GraphResponse,
  type NodeListResponse,
  type NodeDetail,
  type EdgeListResponse,
  type TraversalResult,
  type CycleDetectionResult,
  type ImpactAnalysisResult,
  type GraphNode,
  type GraphEdge,
} from './schemas/graph.js';
import { Type } from '@sinclair/typebox';
import {
  createScanId,
  createTenantId,
  createDbNodeId,
  type ScanEntity,
  type NodeEntity,
  type EdgeEntity,
} from '../types/entities.js';
import { createScanRepository } from '../repositories/scan-repository.js';
import { createNodeRepository } from '../repositories/node-repository.js';
import { createEdgeRepository } from '../repositories/edge-repository.js';
import { createGraphQuerier } from '../repositories/graph-querier.js';

const logger = pino({ name: 'graph-routes' });
const scanRepository = createScanRepository();
const nodeRepository = createNodeRepository();
const edgeRepository = createEdgeRepository();
const graphQuerier = createGraphQuerier();

function getTenantId(request: { auth?: { tenantId?: string }; tenant?: { tenantId?: string } }): string {
  const tenantId = request.auth?.tenantId ?? request.tenant?.tenantId;
  if (!tenantId) {
    throw new ForbiddenError('Tenant context required');
  }
  return tenantId;
}

async function requireScan(scanId: string, tenantId: string): Promise<ScanEntity> {
  const scan = await scanRepository.findById(createScanId(scanId), createTenantId(tenantId));
  if (!scan) {
    throw new NotFoundError('Scan', scanId);
  }
  return scan;
}

function mapNodeToGraphNode(node: NodeEntity, includeMetadata = true): GraphNode {
  return {
    id: node.id,
    type: node.nodeType,
    name: node.name,
    location: {
      file: node.filePath,
      lineStart: node.lineStart,
      lineEnd: node.lineEnd,
      columnStart: node.columnStart,
      columnEnd: node.columnEnd,
    },
    metadata: includeMetadata ? node.metadata : undefined,
  };
}

function mapEdgeToGraphEdge(edge: EdgeEntity): GraphEdge {
  return {
    id: edge.id,
    source: edge.sourceNodeId,
    target: edge.targetNodeId,
    type: edge.edgeType,
    label: edge.label,
    confidence: edge.confidence,
    isImplicit: edge.isImplicit,
    attribute: edge.attribute,
    metadata: edge.metadata,
  };
}

function filterEdgesByTypes(edges: EdgeEntity[], edgeTypes?: string[]): EdgeEntity[] {
  if (!edgeTypes || edgeTypes.length === 0) {
    return edges;
  }
  const allowed = new Set(edgeTypes);
  return edges.filter((edge) => allowed.has(edge.edgeType));
}

function buildRiskLevel(totalImpacted: number): 'low' | 'medium' | 'high' | 'critical' {
  if (totalImpacted >= 25) {
    return 'critical';
  }
  if (totalImpacted >= 10) {
    return 'high';
  }
  if (totalImpacted >= 4) {
    return 'medium';
  }
  return 'low';
}

function buildTraversalSubgraph(startNodeId: string, reachableNodes: NodeEntity[], allEdges: EdgeEntity[]): { edges: EdgeEntity[]; nodeIds: Set<string> } {
  const nodeIds = new Set<string>([startNodeId, ...reachableNodes.map((node) => node.id)]);
  const edges = allEdges.filter((edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId));
  return { edges, nodeIds };
}

/**
 * Graph routes plugin
 */
const graphRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  /**
   * GET /api/v1/scans/:scanId/graph - Get full dependency graph
   */
  fastify.get<{
    Params: { scanId: string };
    Querystring: { includeMetadata?: boolean };
  }>('/graph', {
    schema: {
      description: 'Get the full dependency graph for a scan',
      tags: ['Graph'],
      params: ScanIdParamSchema,
      querystring: Type.Object({
        includeMetadata: Type.Optional(Type.Boolean({ default: true })),
      }),
      response: {
        200: GraphResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<GraphResponse> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const { includeMetadata = true } = request.query;

    logger.debug({ scanId, userId: auth.userId }, 'Getting full graph');

    const tenantId = getTenantId(request);
    const scan = await requireScan(scanId, tenantId);

    const [nodesResult, edgesResult, stats] = await Promise.all([
      nodeRepository.findByScan(createScanId(scanId), createTenantId(tenantId), undefined, { page: 1, pageSize: 10000 }),
      edgeRepository.findByScan(createScanId(scanId), createTenantId(tenantId), undefined, { page: 1, pageSize: 10000 }),
      graphQuerier.getGraphStatistics(createScanId(scanId), createTenantId(tenantId)),
    ]);

    return {
      scanId,
      nodes: nodesResult.data.map((node) => mapNodeToGraphNode(node, includeMetadata)),
      edges: edgesResult.data.map(mapEdgeToGraphEdge),
      stats: {
        totalNodes: stats.nodeCount,
        totalEdges: stats.edgeCount,
        nodesByType: await nodeRepository.getCountsByType(createScanId(scanId), createTenantId(tenantId)),
        edgesByType: await edgeRepository.getCountsByType(createScanId(scanId), createTenantId(tenantId)),
        avgEdgesPerNode: stats.nodeCount > 0 ? Number((stats.edgeCount / stats.nodeCount).toFixed(2)) : 0,
        density: stats.nodeCount > 1 ? Number((stats.edgeCount / (stats.nodeCount * (stats.nodeCount - 1))).toFixed(4)) : 0,
        hasCycles: stats.hasCycles,
      },
      metadata: includeMetadata ? {
        ref: scan.ref,
        commitSha: scan.commitSha,
        generatedAt: new Date().toISOString(),
      } : undefined,
    };
  });

  /**
   * GET /api/v1/scans/:scanId/nodes - List nodes with filtering
   */
  fastify.get<{
    Params: { scanId: string };
    Querystring: NodeFilterQuery;
  }>('/nodes', {
    schema: {
      description: 'List nodes in a scan with optional filtering',
      tags: ['Graph'],
      params: ScanIdParamSchema,
      querystring: NodeFilterQuerySchema,
      response: {
        200: NodeListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<NodeListResponse> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const {
      page = 1,
      pageSize = 20,
      type,
      types,
      filePath,
      name,
      search,
    } = request.query;

    logger.debug({ scanId, userId: auth.userId, type, page }, 'Listing nodes');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const nodeTypes = types ? types.split(',').map(t => t.trim()) : (type ? [type] : undefined);
    const result = await nodeRepository.findByScan(
      createScanId(scanId),
      createTenantId(tenantId),
      {
        nodeType: nodeTypes,
        filePath: search || filePath,
        name: search || name,
      },
      { page, pageSize }
    );

    return {
      data: result.data.map((node) => mapNodeToGraphNode(node, true)),
      pagination: createPaginationInfo(page, pageSize, result.total),
    };
  });

  /**
   * GET /api/v1/scans/:scanId/nodes/:nodeId - Get node details
   */
  fastify.get<{
    Params: { scanId: string; nodeId: string };
  }>('/nodes/:nodeId', {
    schema: {
      description: 'Get detailed information about a specific node',
      tags: ['Graph'],
      params: NodeIdParamSchema,
      response: {
        200: NodeDetailSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<NodeDetail> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;

    logger.debug({ scanId, nodeId, userId: auth.userId }, 'Getting node details');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const node = await nodeRepository.findById(createDbNodeId(nodeId), createTenantId(tenantId));
    if (!node || node.scanId !== scanId) {
      throw new NotFoundError('Node', nodeId);
    }

    const [incomingEdges, outgoingEdges] = await Promise.all([
      edgeRepository.findByTarget(createScanId(scanId), createTenantId(tenantId), createDbNodeId(nodeId)),
      edgeRepository.findBySource(createScanId(scanId), createTenantId(tenantId), createDbNodeId(nodeId)),
    ]);

    return {
      node: mapNodeToGraphNode(node, true),
      incomingEdges: incomingEdges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        type: edge.edgeType,
        label: edge.label,
        confidence: edge.confidence,
      })),
      outgoingEdges: outgoingEdges.map((edge) => ({
        id: edge.id,
        target: edge.targetNodeId,
        type: edge.edgeType,
        label: edge.label,
        confidence: edge.confidence,
      })),
      dependencyCount: outgoingEdges.length,
      dependentCount: incomingEdges.length,
    };
  });

  /**
   * GET /api/v1/scans/:scanId/nodes/:nodeId/dependencies - Get downstream dependencies
   */
  fastify.get<{
    Params: { scanId: string; nodeId: string };
    Querystring: TraversalQuery;
  }>('/nodes/:nodeId/dependencies', {
    schema: {
      description: 'Get downstream dependencies for a node',
      tags: ['Graph'],
      params: NodeIdParamSchema,
      querystring: TraversalQuerySchema,
      response: {
        200: TraversalResultSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<TraversalResult> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;
    const { maxDepth = 5, edgeTypes, includeMetadata = true } = request.query;

    logger.debug({ scanId, nodeId, maxDepth, userId: auth.userId }, 'Getting downstream dependencies');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const startNode = await nodeRepository.findById(createDbNodeId(nodeId), createTenantId(tenantId));
    if (!startNode || startNode.scanId !== scanId) {
      throw new NotFoundError('Node', nodeId);
    }

    const reachableNodes = await graphQuerier.getDownstreamDependencies(
      createScanId(scanId),
      createTenantId(tenantId),
      createDbNodeId(nodeId),
      maxDepth
    );

    const allEdges = await edgeRepository.findByScan(
      createScanId(scanId),
      createTenantId(tenantId),
      undefined,
      { page: 1, pageSize: 10000 }
    );
    const { edges: subgraphEdges } = buildTraversalSubgraph(nodeId, reachableNodes, allEdges.data);
    const filteredEdges = filterEdgesByTypes(subgraphEdges, edgeTypes ? edgeTypes.split(',').map((t) => t.trim()) : undefined);

    const paths = await Promise.all(
      reachableNodes.slice(0, 25).map(async (node) => {
        const path = await graphQuerier.findShortestPath(
          createScanId(scanId),
          createTenantId(tenantId),
          createDbNodeId(nodeId),
          createDbNodeId(node.id)
        );
        return path ? { nodeIds: path.nodes, length: path.length } : null;
      })
    );

    return {
      startNode: nodeId,
      direction: 'downstream',
      nodes: reachableNodes.map((node) => mapNodeToGraphNode(node, includeMetadata)),
      edges: filteredEdges.map(mapEdgeToGraphEdge),
      paths: paths.filter((path): path is { nodeIds: string[]; length: number } => path !== null),
      stats: {
        nodesVisited: reachableNodes.length,
        edgesTraversed: filteredEdges.length,
        maxDepthReached: paths.reduce((max, path) => Math.max(max, path?.length ?? 0), 0),
      },
    };
  });

  /**
   * GET /api/v1/scans/:scanId/nodes/:nodeId/dependents - Get upstream dependents
   */
  fastify.get<{
    Params: { scanId: string; nodeId: string };
    Querystring: TraversalQuery;
  }>('/nodes/:nodeId/dependents', {
    schema: {
      description: 'Get upstream dependents for a node',
      tags: ['Graph'],
      params: NodeIdParamSchema,
      querystring: TraversalQuerySchema,
      response: {
        200: TraversalResultSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<TraversalResult> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;
    const { maxDepth = 5, edgeTypes, includeMetadata = true } = request.query;

    logger.debug({ scanId, nodeId, maxDepth, userId: auth.userId }, 'Getting upstream dependents');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const startNode = await nodeRepository.findById(createDbNodeId(nodeId), createTenantId(tenantId));
    if (!startNode || startNode.scanId !== scanId) {
      throw new NotFoundError('Node', nodeId);
    }

    const reachableNodes = await graphQuerier.getUpstreamDependents(
      createScanId(scanId),
      createTenantId(tenantId),
      createDbNodeId(nodeId),
      maxDepth
    );

    const allEdges = await edgeRepository.findByScan(
      createScanId(scanId),
      createTenantId(tenantId),
      undefined,
      { page: 1, pageSize: 10000 }
    );
    const { edges: subgraphEdges } = buildTraversalSubgraph(nodeId, reachableNodes, allEdges.data);
    const filteredEdges = filterEdgesByTypes(subgraphEdges, edgeTypes ? edgeTypes.split(',').map((t) => t.trim()) : undefined);

    const paths = await Promise.all(
      reachableNodes.slice(0, 25).map(async (node) => {
        const path = await graphQuerier.findShortestPath(
          createScanId(scanId),
          createTenantId(tenantId),
          createDbNodeId(node.id),
          createDbNodeId(nodeId)
        );
        return path ? { nodeIds: path.nodes, length: path.length } : null;
      })
    );

    return {
      startNode: nodeId,
      direction: 'upstream',
      nodes: reachableNodes.map((node) => mapNodeToGraphNode(node, includeMetadata)),
      edges: filteredEdges.map(mapEdgeToGraphEdge),
      paths: paths.filter((path): path is { nodeIds: string[]; length: number } => path !== null),
      stats: {
        nodesVisited: reachableNodes.length,
        edgesTraversed: filteredEdges.length,
        maxDepthReached: paths.reduce((max, path) => Math.max(max, path?.length ?? 0), 0),
      },
    };
  });

  /**
   * GET /api/v1/scans/:scanId/edges - List edges with filtering
   */
  fastify.get<{
    Params: { scanId: string };
    Querystring: EdgeFilterQuery;
  }>('/edges', {
    schema: {
      description: 'List edges in a scan with optional filtering',
      tags: ['Graph'],
      params: ScanIdParamSchema,
      querystring: EdgeFilterQuerySchema,
      response: {
        200: EdgeListResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<EdgeListResponse> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const {
      page = 1,
      pageSize = 20,
      type,
      types,
      minConfidence,
      isImplicit,
    } = request.query;

    logger.debug({ scanId, userId: auth.userId, type, page }, 'Listing edges');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const edgeTypes = types ? types.split(',').map(t => t.trim()) : (type ? [type] : undefined);
    const result = await edgeRepository.findByScan(
      createScanId(scanId),
      createTenantId(tenantId),
      {
        edgeType: edgeTypes,
        minConfidence,
        isImplicit,
      },
      { page, pageSize }
    );

    return {
      data: result.data.map(mapEdgeToGraphEdge),
      pagination: createPaginationInfo(page, pageSize, result.total),
    };
  });

  /**
   * GET /api/v1/scans/:scanId/cycles - Detect cycles in the graph
   */
  fastify.get<{
    Params: { scanId: string };
  }>('/cycles', {
    schema: {
      description: 'Detect circular dependencies in the graph',
      tags: ['Graph'],
      params: ScanIdParamSchema,
      response: {
        200: CycleDetectionResultSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<CycleDetectionResult> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;

    logger.debug({ scanId, userId: auth.userId }, 'Detecting cycles');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const startedAt = Date.now();
    const cycles = await graphQuerier.detectCycles(createScanId(scanId), createTenantId(tenantId));
    const nodeIds = new Set(cycles.flatMap((cycle) => cycle.nodes));

    return {
      hasCycles: cycles.length > 0,
      cycles: cycles.map((cycle) => ({
        nodeIds: cycle.nodes,
        edgeIds: cycle.edges,
        length: cycle.nodes.length,
      })),
      stats: {
        cyclesFound: cycles.length,
        nodesInCycles: nodeIds.size,
        detectionTimeMs: Date.now() - startedAt,
      },
    };
  });

  /**
   * POST /api/v1/scans/:scanId/impact - Analyze impact of node changes
   */
  fastify.post<{
    Params: { scanId: string };
    Body: { nodeIds: string[]; maxDepth?: number };
  }>('/impact', {
    schema: {
      description: 'Analyze the impact of changing specified nodes',
      tags: ['Graph'],
      params: ScanIdParamSchema,
      body: Type.Object({
        nodeIds: Type.Array(Type.String(), { minItems: 1, maxItems: 50, description: 'Nodes to analyze' }),
        maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 20, default: 10 })),
      }),
      response: {
        200: ImpactAnalysisResultSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request): Promise<ImpactAnalysisResult> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const { nodeIds, maxDepth = 10 } = request.body;

    logger.debug({ scanId, nodeIds, maxDepth, userId: auth.userId }, 'Analyzing impact');

    const tenantId = getTenantId(request);
    await requireScan(scanId, tenantId);

    const allResults = await Promise.all(
      nodeIds.map(async (nodeId) => {
        const node = await nodeRepository.findById(createDbNodeId(nodeId), createTenantId(tenantId));
        if (!node || node.scanId !== scanId) {
          throw new NotFoundError('Node', nodeId);
        }
        return graphQuerier.analyzeImpact(
          createScanId(scanId),
          createTenantId(tenantId),
          createDbNodeId(nodeId),
          maxDepth
        );
      })
    );

    const directImpactMap = new Map<string, NodeEntity>();
    const transitiveImpactMap = new Map<string, NodeEntity>();
    const impactByType: Record<string, number> = {};
    const impactByDepth: Record<string, number> = {};

    for (const result of allResults) {
      for (const node of result.directDependents) {
        directImpactMap.set(node.id, node);
      }
      for (const node of result.transitiveDependents) {
        transitiveImpactMap.set(node.id, node);
      }
    }

    const allImpactedNodes = [...directImpactMap.values(), ...transitiveImpactMap.values()];
    for (const node of allImpactedNodes) {
      impactByType[node.nodeType] = (impactByType[node.nodeType] ?? 0) + 1;
    }

    for (const node of directImpactMap.values()) {
      impactByDepth['1'] = (impactByDepth['1'] ?? 0) + 1;
    }

    for (const node of transitiveImpactMap.values()) {
      let shortestDepth = maxDepth;
      for (const targetNodeId of nodeIds) {
        const path = await graphQuerier.findShortestPath(
          createScanId(scanId),
          createTenantId(tenantId),
          createDbNodeId(node.id),
          createDbNodeId(targetNodeId)
        );
        if (path) {
          shortestDepth = Math.min(shortestDepth, path.length);
        }
      }
      const key = String(shortestDepth);
      impactByDepth[key] = (impactByDepth[key] ?? 0) + 1;
    }

    const totalImpacted = directImpactMap.size + transitiveImpactMap.size;

    return {
      targetNodes: nodeIds,
      directImpact: [...directImpactMap.values()].map((node) => mapNodeToGraphNode(node, true)),
      transitiveImpact: [...transitiveImpactMap.values()].map((node) => mapNodeToGraphNode(node, true)),
      summary: {
        totalImpacted,
        impactByType,
        impactByDepth,
        riskLevel: buildRiskLevel(totalImpacted),
      },
    };
  });
};

export default graphRoutes;
