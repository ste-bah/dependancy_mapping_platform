/**
 * Scan and Graph Route Behaviour Tests
 * @module tests/integration/routes/scan-graph.behaviour
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fastify, type FastifyInstance } from 'fastify';

const mockScanRepository = {
  getLatestForRepository: vi.fn(),
  create: vi.fn(),
  findByTenant: vi.fn(),
  findByRepository: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
};

const mockNodeRepository = {
  findByScan: vi.fn(),
  getCountsByType: vi.fn(),
  findById: vi.fn(),
};

const mockEdgeRepository = {
  findByScan: vi.fn(),
  getCountsByType: vi.fn(),
  findByTarget: vi.fn(),
  findBySource: vi.fn(),
};

const mockGraphQuerier = {
  getGraphStatistics: vi.fn(),
  getDownstreamDependencies: vi.fn(),
  getUpstreamDependents: vi.fn(),
  findShortestPath: vi.fn(),
  detectCycles: vi.fn(),
  analyzeImpact: vi.fn(),
};

const mockQuery = vi.fn();

vi.mock('../../../src/middleware/auth.js', () => ({
  requireAuth: vi.fn(async () => undefined),
  getAuthContext: vi.fn(() => ({
    userId: '00000000-0000-0000-0000-0000000000aa',
    tenantId: '00000000-0000-0000-0000-0000000000bb',
    email: 'test@example.com',
    name: 'Test User',
    githubId: 123,
  })),
}));

vi.mock('../../../src/repositories/scan-repository.js', () => ({
  createScanRepository: () => mockScanRepository,
}));

vi.mock('../../../src/repositories/node-repository.js', () => ({
  createNodeRepository: () => mockNodeRepository,
}));

vi.mock('../../../src/repositories/edge-repository.js', () => ({
  createEdgeRepository: () => mockEdgeRepository,
}));

vi.mock('../../../src/repositories/graph-querier.js', () => ({
  createGraphQuerier: () => mockGraphQuerier,
}));

vi.mock('../../../src/db/connection.js', () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

function makeScan(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    tenantId: '00000000-0000-0000-0000-0000000000bb',
    repositoryId: '00000000-0000-0000-0000-000000000001',
    initiatedBy: '00000000-0000-0000-0000-0000000000aa',
    status: 'pending',
    config: {
      detectTypes: ['terraform', 'kubernetes', 'helm'],
      includeImplicit: true,
      minConfidence: 40,
      maxDepth: 10,
      includePatterns: ['**/*.tf'],
      excludePatterns: ['**/node_modules/**'],
      analyzeHelmCharts: true,
      resolveRemoteModules: false,
    },
    ref: 'main',
    commitSha: '0000000000000000000000000000000000000000',
    progress: {
      phase: 'initializing',
      percentage: 0,
      filesProcessed: 0,
      totalFiles: 0,
      nodesDetected: 0,
      edgesDetected: 0,
      errors: 0,
      warnings: 0,
    },
    resultSummary: undefined,
    errorMessage: undefined,
    startedAt: undefined,
    completedAt: undefined,
    createdAt: new Date('2026-04-17T12:00:00.000Z'),
    updatedAt: new Date('2026-04-17T12:00:00.000Z'),
    ...overrides,
  };
}

function makeNode(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000100',
    scanId: '00000000-0000-0000-0000-000000000010',
    tenantId: '00000000-0000-0000-0000-0000000000bb',
    originalId: 'node-original-1',
    nodeType: 'tf_resource',
    name: 'aws_vpc.main',
    filePath: 'network/vpc.tf',
    lineStart: 1,
    lineEnd: 15,
    columnStart: 0,
    columnEnd: 10,
    metadata: { provider: 'aws' },
    createdAt: new Date('2026-04-17T12:00:00.000Z'),
    ...overrides,
  };
}

function makeEdge(overrides: Record<string, unknown> = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000200',
    scanId: '00000000-0000-0000-0000-000000000010',
    tenantId: '00000000-0000-0000-0000-0000000000bb',
    originalId: 'edge-original-1',
    sourceNodeId: '00000000-0000-0000-0000-000000000101',
    targetNodeId: '00000000-0000-0000-0000-000000000100',
    edgeType: 'references',
    label: undefined,
    isImplicit: false,
    confidence: 95,
    attribute: undefined,
    metadata: { attribute: 'vpc_id' },
    createdAt: new Date('2026-04-17T12:00:00.000Z'),
    ...overrides,
  };
}

describe('Scan and Graph Route Behaviour', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = fastify({ logger: false });
    const scanRoutes = await import('../../../src/routes/scans.js');
    const graphRoutes = await import('../../../src/routes/graph.js');
    await app.register(scanRoutes.default, { prefix: '/api/v1/scans' });
    await app.register(graphRoutes.default, { prefix: '/api/v1/scans/:scanId' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [{ id: '00000000-0000-0000-0000-000000000001', default_branch: 'main' }] });
    mockScanRepository.getLatestForRepository.mockResolvedValue(null);
    mockScanRepository.create.mockResolvedValue(makeScan());
    mockScanRepository.findByTenant.mockResolvedValue({ data: [makeScan()], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    mockScanRepository.findByRepository.mockResolvedValue({ data: [makeScan()], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    mockScanRepository.findById.mockResolvedValue(makeScan());
    mockScanRepository.update.mockResolvedValue(makeScan({ status: 'cancelled', completedAt: new Date('2026-04-17T12:10:00.000Z'), errorMessage: 'Cancelled by user' }));

    mockNodeRepository.findByScan.mockResolvedValue({ data: [makeNode()], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    mockNodeRepository.getCountsByType.mockResolvedValue({ tf_resource: 1 });
    mockNodeRepository.findById.mockResolvedValue(makeNode());

    mockEdgeRepository.findByScan.mockResolvedValue({ data: [makeEdge()], total: 1, page: 1, pageSize: 20, totalPages: 1 });
    mockEdgeRepository.getCountsByType.mockResolvedValue({ references: 1 });
    mockEdgeRepository.findByTarget.mockResolvedValue([makeEdge()]);
    mockEdgeRepository.findBySource.mockResolvedValue([makeEdge({ sourceNodeId: '00000000-0000-0000-0000-000000000100', targetNodeId: '00000000-0000-0000-0000-000000000101' })]);

    mockGraphQuerier.getGraphStatistics.mockResolvedValue({
      nodeCount: 1,
      edgeCount: 1,
      avgDegree: 1,
      maxDepth: 1,
      componentCount: 1,
      hasCycles: false,
    });
    mockGraphQuerier.getDownstreamDependencies.mockResolvedValue([makeNode({ id: '00000000-0000-0000-0000-000000000101', name: 'aws_subnet.public' })]);
    mockGraphQuerier.getUpstreamDependents.mockResolvedValue([makeNode({ id: '00000000-0000-0000-0000-000000000102', name: 'data.aws_availability_zones.available' })]);
    mockGraphQuerier.findShortestPath.mockResolvedValue({
      nodes: ['00000000-0000-0000-0000-000000000100', '00000000-0000-0000-0000-000000000101'],
      edges: ['00000000-0000-0000-0000-000000000200'],
      length: 1,
    });
    mockGraphQuerier.detectCycles.mockResolvedValue([]);
    mockGraphQuerier.analyzeImpact.mockResolvedValue({
      directDependents: [makeNode({ id: '00000000-0000-0000-0000-000000000103', name: 'aws_subnet.private' })],
      transitiveDependents: [makeNode({ id: '00000000-0000-0000-0000-000000000104', name: 'aws_instance.app' })],
      impactedEdges: [makeEdge()],
      depth: 2,
    });
  });

  it('creates a scan using the repository layer', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/scans',
      payload: {
        repositoryId: '00000000-0000-0000-0000-000000000001',
        ref: 'main',
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.id).toBe('00000000-0000-0000-0000-000000000010');
    expect(mockScanRepository.create).toHaveBeenCalledTimes(1);
  });

  it('lists scans from persistence', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/scans?page=1&pageSize=20' });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
  });

  it('gets scan detail and status from persistence', async () => {
    const [detail, status] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/scans/00000000-0000-0000-0000-000000000010' }),
      app.inject({ method: 'GET', url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/status' }),
    ]);

    expect(detail.statusCode).toBe(200);
    expect(status.statusCode).toBe(200);
    expect(detail.json().repositoryId).toBe('00000000-0000-0000-0000-000000000001');
    expect(status.json().status).toBe('pending');
  });

  it('cancels an active scan', async () => {
    mockScanRepository.findById.mockResolvedValue(makeScan({ status: 'running', startedAt: new Date('2026-04-17T12:00:00.000Z') }));

    const response = await app.inject({
      method: 'DELETE',
      url: '/api/v1/scans/00000000-0000-0000-0000-000000000010',
      payload: { reason: 'Cancelled by user' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('cancelled');
    expect(mockScanRepository.update).toHaveBeenCalledTimes(1);
  });

  it('returns the full graph for a scan', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/graph?includeMetadata=true',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.scanId).toBe('00000000-0000-0000-0000-000000000010');
    expect(body.nodes).toHaveLength(1);
    expect(body.edges).toHaveLength(1);
    expect(body.stats.totalNodes).toBe(1);
  });

  it('lists nodes and edges for a scan', async () => {
    const [nodesResponse, edgesResponse] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/nodes' }),
      app.inject({ method: 'GET', url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/edges' }),
    ]);

    expect(nodesResponse.statusCode).toBe(200);
    expect(edgesResponse.statusCode).toBe(200);
    expect(nodesResponse.json().data[0].name).toBe('aws_vpc.main');
    expect(edgesResponse.json().data[0].type).toBe('references');
  });

  it('returns node detail with incoming and outgoing edges', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/nodes/00000000-0000-0000-0000-000000000100',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.node.id).toBe('00000000-0000-0000-0000-000000000100');
    expect(body.incomingEdges).toHaveLength(1);
    expect(body.outgoingEdges).toHaveLength(1);
  });

  it('returns downstream and upstream traversals', async () => {
    const [downstream, upstream] = await Promise.all([
      app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/nodes/00000000-0000-0000-0000-000000000100/dependencies',
      }),
      app.inject({
        method: 'GET',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/nodes/00000000-0000-0000-0000-000000000100/dependents',
      }),
    ]);

    expect(downstream.statusCode).toBe(200);
    expect(upstream.statusCode).toBe(200);
    expect(downstream.json().direction).toBe('downstream');
    expect(upstream.json().direction).toBe('upstream');
  });

  it('returns cycle detection and impact analysis', async () => {
    const [cycles, impact] = await Promise.all([
      app.inject({ method: 'GET', url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/cycles' }),
      app.inject({
        method: 'POST',
        url: '/api/v1/scans/00000000-0000-0000-0000-000000000010/impact',
        payload: { nodeIds: ['00000000-0000-0000-0000-000000000100'], maxDepth: 10 },
      }),
    ]);

    expect(cycles.statusCode).toBe(200);
    expect(impact.statusCode).toBe(200);
    expect(cycles.json().hasCycles).toBe(false);
    expect(impact.json().summary.totalImpacted).toBe(2);
  });
});
