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
} from './schemas/graph.js';
import { Type } from '@sinclair/typebox';

const logger = pino({ name: 'graph-routes' });

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
  }, async (request, reply): Promise<GraphResponse> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const { includeMetadata = true } = request.query;

    logger.debug({ scanId, userId: auth.userId }, 'Getting full graph');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject graph service and repositories
    // const scan = await scanRepository.findById(createScanId(scanId), tenantId);
    // if (!scan) throw new NotFoundError('Scan', scanId);
    // const nodes = await nodeRepository.findByScan(scanId, tenantId);
    // const edges = await edgeRepository.findByScan(scanId, tenantId);
    // const stats = await graphQuerier.getGraphStatistics(scanId, tenantId);

    // Mock response structure
    throw new NotFoundError('Scan', scanId);
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
  }, async (request, reply): Promise<NodeListResponse> => {
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

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // Parse comma-separated types if provided
    const nodeTypes = types ? types.split(',').map(t => t.trim()) : (type ? [type] : undefined);

    // TODO: Inject node repository
    // const filter = { nodeType: nodeTypes, filePath, name };
    // const result = await nodeRepository.findByScan(scanId, tenantId, filter, { page, pageSize });

    // Mock response
    return {
      data: [],
      pagination: createPaginationInfo(page, pageSize, 0),
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
  }, async (request, reply): Promise<NodeDetail> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;

    logger.debug({ scanId, nodeId, userId: auth.userId }, 'Getting node details');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject repositories
    // const node = await nodeRepository.findById(nodeId, tenantId);
    // if (!node || node.scanId !== scanId) throw new NotFoundError('Node', nodeId);
    // const incomingEdges = await edgeRepository.findByTarget(scanId, tenantId, nodeId);
    // const outgoingEdges = await edgeRepository.findBySource(scanId, tenantId, nodeId);

    throw new NotFoundError('Node', nodeId);
  });

  /**
   * GET /api/v1/scans/:scanId/nodes/:nodeId/dependencies - Get downstream dependencies
   */
  fastify.get<{
    Params: { scanId: string; nodeId: string };
    Querystring: TraversalQuery;
  }>('/nodes/:nodeId/dependencies', {
    schema: {
      description: 'Get downstream dependencies (nodes that depend on this node)',
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
  }, async (request, reply): Promise<TraversalResult> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;
    const { maxDepth = 5, edgeTypes, includeMetadata = true } = request.query;

    logger.debug({ scanId, nodeId, maxDepth, userId: auth.userId }, 'Getting downstream dependencies');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // Parse edge types
    const edgeTypeFilter = edgeTypes ? edgeTypes.split(',').map(t => t.trim()) : undefined;

    // TODO: Inject graph querier
    // const result = await graphQuerier.getDownstreamDependencies(scanId, tenantId, nodeId, maxDepth);

    throw new NotFoundError('Node', nodeId);
  });

  /**
   * GET /api/v1/scans/:scanId/nodes/:nodeId/dependents - Get upstream dependents
   */
  fastify.get<{
    Params: { scanId: string; nodeId: string };
    Querystring: TraversalQuery;
  }>('/nodes/:nodeId/dependents', {
    schema: {
      description: 'Get upstream dependents (nodes that this node depends on)',
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
  }, async (request, reply): Promise<TraversalResult> => {
    const auth = getAuthContext(request);
    const { scanId, nodeId } = request.params;
    const { maxDepth = 5, edgeTypes, includeMetadata = true } = request.query;

    logger.debug({ scanId, nodeId, maxDepth, userId: auth.userId }, 'Getting upstream dependents');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject graph querier
    // const result = await graphQuerier.getUpstreamDependents(scanId, tenantId, nodeId, maxDepth);

    throw new NotFoundError('Node', nodeId);
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
  }, async (request, reply): Promise<EdgeListResponse> => {
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

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // Parse comma-separated types
    const edgeTypes = types ? types.split(',').map(t => t.trim()) : (type ? [type] : undefined);

    // TODO: Inject edge repository
    // const filter = { edgeType: edgeTypes, minConfidence, isImplicit };
    // const result = await edgeRepository.findByScan(scanId, tenantId, filter, { page, pageSize });

    return {
      data: [],
      pagination: createPaginationInfo(page, pageSize, 0),
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
  }, async (request, reply): Promise<CycleDetectionResult> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;

    logger.debug({ scanId, userId: auth.userId }, 'Detecting cycles');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject graph querier
    // const result = await graphQuerier.detectCycles(scanId, tenantId);

    // Mock response - would come from graph querier
    return {
      hasCycles: false,
      cycles: [],
      stats: {
        cyclesFound: 0,
        nodesInCycles: 0,
        detectionTimeMs: 0,
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
  }, async (request, reply): Promise<ImpactAnalysisResult> => {
    const auth = getAuthContext(request);
    const { scanId } = request.params;
    const { nodeIds, maxDepth = 10 } = request.body;

    logger.debug({ scanId, nodeIds, maxDepth, userId: auth.userId }, 'Analyzing impact');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    // TODO: Inject graph querier/service
    // const result = await graphService.analyzeImpact(graph, nodeIds);

    // Mock response
    return {
      targetNodes: nodeIds,
      directImpact: [],
      transitiveImpact: [],
      summary: {
        totalImpacted: 0,
        impactByType: {},
        impactByDepth: {},
        riskLevel: 'low',
      },
    };
  });
};

export default graphRoutes;
