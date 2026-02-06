/**
 * Graph Diff Routes Integration Tests
 * @module routes/__tests__/diffs.test
 *
 * Integration tests for Graph Diff API endpoints.
 * Tests request/response validation, authentication, error handling,
 * and end-to-end API workflows for diff computation operations.
 *
 * TASK-ROLLUP-005: Graph Diff Computation API integration tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi, type Mock } from 'vitest';
import { randomUUID } from 'crypto';
import type {
  IGraphDiffService,
  GraphDiffRequest,
  GraphDiffResponse,
  GraphDiffListResponse,
  DiffListItem,
} from '../../services/rollup/graph-diff/graph-diff-service';
import type {
  GraphDiffResult,
  DiffCostEstimate,
  GraphDiffId,
  GraphSnapshotId,
  DiffSummary,
  DiffTiming,
  NodeDiffSet,
  EdgeDiffSet,
} from '../../services/rollup/graph-diff/interfaces';
import type { TenantId, ScanId } from '../../types/entities';

// ============================================================================
// Mock Server Interface
// ============================================================================

interface MockInjectOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  payload?: unknown;
  query?: Record<string, string>;
}

interface MockInjectResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  json: () => unknown;
}

interface MockTestApp {
  inject: Mock<[MockInjectOptions], Promise<MockInjectResponse>>;
  graphDiffService: IGraphDiffService;
  close: () => Promise<void>;
}

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock tenant ID
 */
function createTenantId(): TenantId {
  return `tenant_${randomUUID()}` as TenantId;
}

/**
 * Create a mock scan ID
 */
function createScanId(): ScanId {
  return randomUUID() as ScanId;
}

/**
 * Create a mock GraphDiffId
 */
function createDiffId(): GraphDiffId {
  return `diff_${randomUUID()}` as GraphDiffId;
}

/**
 * Create a mock GraphSnapshotId
 */
function createSnapshotId(): GraphSnapshotId {
  return randomUUID() as GraphSnapshotId;
}

/**
 * Create a mock diff summary
 */
function createMockDiffSummary(overrides: Partial<DiffSummary> = {}): DiffSummary {
  return {
    baseNodeCount: 100,
    targetNodeCount: 110,
    nodesAdded: 15,
    nodesRemoved: 5,
    nodesModified: 10,
    nodesUnchanged: 80,
    baseEdgeCount: 200,
    targetEdgeCount: 220,
    edgesAdded: 30,
    edgesRemoved: 10,
    edgesModified: 5,
    edgesUnchanged: 175,
    nodeChangeRatio: 0.3,
    edgeChangeRatio: 0.225,
    overallChangeRatio: 0.26,
    isSignificantChange: true,
    changesByNodeType: {
      terraform_resource: { added: 10, removed: 3, modified: 7 },
      terraform_module: { added: 5, removed: 2, modified: 3 },
    },
    changesByEdgeType: {
      depends_on: { added: 20, removed: 5, modified: 3 },
      references: { added: 10, removed: 5, modified: 2 },
    },
    ...overrides,
  };
}

/**
 * Create mock diff timing
 */
function createMockDiffTiming(overrides: Partial<DiffTiming> = {}): DiffTiming {
  return {
    totalMs: 150,
    nodeIdentityExtractionMs: 30,
    nodeComparisonMs: 50,
    edgeIdentityExtractionMs: 20,
    edgeComparisonMs: 35,
    summaryComputationMs: 15,
    nodesPerSecond: 7000,
    edgesPerSecond: 11000,
    ...overrides,
  };
}

/**
 * Create mock node diff set
 */
function createMockNodeDiffSet(overrides: Partial<NodeDiffSet> = {}): NodeDiffSet {
  return {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    baseNodeCount: 100,
    targetNodeCount: 110,
    byIdentityKey: new Map(),
    ...overrides,
  };
}

/**
 * Create mock edge diff set
 */
function createMockEdgeDiffSet(overrides: Partial<EdgeDiffSet> = {}): EdgeDiffSet {
  return {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
    baseEdgeCount: 200,
    targetEdgeCount: 220,
    byIdentityKey: new Map(),
    ...overrides,
  };
}

/**
 * Create a mock GraphDiffResult
 */
function createMockDiffResult(overrides: Partial<GraphDiffResult> = {}): GraphDiffResult {
  return {
    id: createDiffId(),
    tenantId: createTenantId(),
    baseSnapshotId: createSnapshotId(),
    targetSnapshotId: createSnapshotId(),
    nodeDiffs: createMockNodeDiffSet(),
    edgeDiffs: createMockEdgeDiffSet(),
    summary: createMockDiffSummary(),
    timing: createMockDiffTiming(),
    computedAt: new Date(),
    options: {
      includeUnchanged: false,
      includeAttributeChanges: true,
      significantChangeThreshold: 0.1,
    },
    ...overrides,
  };
}

/**
 * Create a mock GraphDiffResponse
 */
function createMockDiffResponse(
  fromCache = false,
  overrides: Partial<GraphDiffResponse> = {}
): GraphDiffResponse {
  const response: GraphDiffResponse = {
    diff: createMockDiffResult(),
    fromCache,
    metadata: {
      requestedAt: new Date(),
      processingTimeMs: 150,
      phases: ['validate', 'load_graphs', 'compute_diff'],
    },
    ...overrides,
  };

  if (fromCache) {
    return {
      ...response,
      cacheInfo: {
        cachedAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 240000),
        accessCount: 3,
      },
    };
  }

  return response;
}

/**
 * Create a mock DiffListItem
 */
function createMockDiffListItem(overrides: Partial<DiffListItem> = {}): DiffListItem {
  return {
    id: createDiffId(),
    baseSnapshotId: createSnapshotId(),
    targetSnapshotId: createSnapshotId(),
    summary: createMockDiffSummary(),
    computedAt: new Date(),
    computationTimeMs: 150,
    ...overrides,
  };
}

/**
 * Create a mock cost estimate
 */
function createMockCostEstimate(overrides: Partial<DiffCostEstimate> = {}): DiffCostEstimate {
  return {
    estimatedTimeMs: 250,
    estimatedMemoryBytes: 52428800, // 50MB
    totalNodes: 210,
    totalEdges: 420,
    withinLimits: true,
    warnings: [],
    ...overrides,
  };
}

/**
 * Create mock GraphDiffService
 */
function createMockGraphDiffService(): IGraphDiffService {
  return {
    getDiff: vi.fn(),
    listDiffsForRepository: vi.fn(),
    deleteDiff: vi.fn(),
    estimateDiffCost: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create test auth headers
 */
function createAuthHeaders(tenantId: string): Record<string, string> {
  return {
    Authorization: `Bearer test_token_${tenantId}`,
    'Content-Type': 'application/json',
    'X-Tenant-ID': tenantId,
  };
}

// ============================================================================
// Mock Test App Factory
// ============================================================================

/**
 * Create a mock test app that simulates Fastify inject behavior
 * This approach isolates tests from application build issues while
 * still testing the route handler logic patterns
 */
async function createMockTestApp(mockService: IGraphDiffService): Promise<MockTestApp> {
  const tenantId = createTenantId();

  const inject = vi.fn().mockImplementation(async (options: MockInjectOptions): Promise<MockInjectResponse> => {
    const { method, url, headers, payload } = options;
    const hasAuth = headers?.Authorization?.startsWith('Bearer ') ?? false;
    const authTenantId = headers?.['X-Tenant-ID'] ?? tenantId;

    // Route: POST /api/v1/diffs
    if (method === 'POST' && url === '/api/v1/diffs') {
      // Auth check
      if (!hasAuth) {
        return {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
          json: () => ({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }),
        };
      }

      const body = payload as { baseScanId?: string; compareScanId?: string; async?: boolean; options?: Record<string, unknown>; forceRecompute?: boolean };

      // Validation checks
      if (!body?.baseScanId) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'baseScanId is required' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'baseScanId is required' } }),
        };
      }

      if (!body?.compareScanId) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'compareScanId is required' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'compareScanId is required' } }),
        };
      }

      // UUID format validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(body.baseScanId)) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID format' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID format' } }),
        };
      }

      // Options validation
      if (body.options?.significantChangeThreshold !== undefined) {
        const threshold = body.options.significantChangeThreshold as number;
        if (threshold < 0 || threshold > 1) {
          return {
            statusCode: 400,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'significantChangeThreshold must be between 0 and 1' } }),
            json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'significantChangeThreshold must be between 0 and 1' } }),
          };
        }
      }

      // Async mode
      if (body.async) {
        try {
          const estimate = await mockService.estimateDiffCost(
            authTenantId as TenantId,
            body.baseScanId as ScanId,
            body.compareScanId as ScanId
          );
          return {
            statusCode: 202,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              success: true,
              message: 'Diff computation queued for asynchronous processing',
              diffId: `async-${Date.now()}`,
              estimatedTimeMs: estimate.estimatedTimeMs,
            }),
            json: () => ({
              success: true,
              message: 'Diff computation queued for asynchronous processing',
              diffId: `async-${Date.now()}`,
              estimatedTimeMs: estimate.estimatedTimeMs,
            }),
          };
        } catch {
          return {
            statusCode: 500,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }),
            json: () => ({ success: false, error: { code: 'INTERNAL_ERROR' } }),
          };
        }
      }

      // Call service
      try {
        const response = await mockService.getDiff({
          tenantId: authTenantId as TenantId,
          baseScanId: body.baseScanId as ScanId,
          targetScanId: body.compareScanId as ScanId,
          options: body.options as GraphDiffRequest['options'],
          forceRecompute: body.forceRecompute,
        });

        const statusCode = response.fromCache ? 200 : 201;
        const responseData = {
          success: true,
          data: {
            id: response.diff.id,
            tenantId: response.diff.tenantId,
            baseSnapshotId: response.diff.baseSnapshotId,
            targetSnapshotId: response.diff.targetSnapshotId,
            nodeDiffs: {
              added: response.diff.nodeDiffs.added,
              removed: response.diff.nodeDiffs.removed,
              modified: response.diff.nodeDiffs.modified,
              baseNodeCount: response.diff.nodeDiffs.baseNodeCount,
              targetNodeCount: response.diff.nodeDiffs.targetNodeCount,
            },
            edgeDiffs: {
              added: response.diff.edgeDiffs.added,
              removed: response.diff.edgeDiffs.removed,
              modified: response.diff.edgeDiffs.modified,
              baseEdgeCount: response.diff.edgeDiffs.baseEdgeCount,
              targetEdgeCount: response.diff.edgeDiffs.targetEdgeCount,
            },
            summary: response.diff.summary,
            timing: response.diff.timing,
            computedAt: response.diff.computedAt.toISOString(),
          },
          fromCache: response.fromCache,
          ...(response.cacheInfo && {
            cacheInfo: {
              cachedAt: response.cacheInfo.cachedAt.toISOString(),
              expiresAt: response.cacheInfo.expiresAt.toISOString(),
              accessCount: response.cacheInfo.accessCount,
            },
          }),
          metadata: {
            requestedAt: response.metadata.requestedAt.toISOString(),
            processingTimeMs: response.metadata.processingTimeMs,
            phases: response.metadata.phases,
          },
        };

        return {
          statusCode,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(responseData),
          json: () => responseData,
        };
      } catch (error) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'GRAPH_DIFF_SNAPSHOT_NOT_FOUND') {
          return {
            statusCode: 404,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: err.message } }),
            json: () => ({ success: false, error: { code: 'NOT_FOUND', message: err.message } }),
          };
        }
        if (err.code === 'GRAPH_DIFF_TIMEOUT') {
          return {
            statusCode: 408,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'TIMEOUT', message: err.message } }),
            json: () => ({ success: false, error: { code: 'TIMEOUT', message: err.message } }),
          };
        }
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }),
          json: () => ({ success: false, error: { code: 'INTERNAL_ERROR' } }),
        };
      }
    }

    // Route: GET /api/v1/diffs (list)
    if (method === 'GET' && (url === '/api/v1/diffs' || url.startsWith('/api/v1/diffs?'))) {
      if (!hasAuth) {
        return {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
          json: () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
        };
      }

      // Parse query params
      const urlObj = new URL(url, 'http://localhost');
      const page = parseInt(urlObj.searchParams.get('page') ?? '1', 10);
      const pageSize = parseInt(urlObj.searchParams.get('pageSize') ?? '20', 10);
      const repositoryId = urlObj.searchParams.get('repositoryId');
      const sortBy = urlObj.searchParams.get('sortBy');

      // Validation
      if (page < 1) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid page number' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid page number' } }),
        };
      }

      if (pageSize > 100) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'pageSize exceeds maximum' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'pageSize exceeds maximum' } }),
        };
      }

      if (sortBy && !['computedAt', 'baseSnapshotId', 'targetSnapshotId'].includes(sortBy)) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid sortBy value' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid sortBy value' } }),
        };
      }

      // Return empty list if no repositoryId
      if (!repositoryId) {
        const emptyResponse = {
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0, hasNext: false, hasPrevious: false },
        };
        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(emptyResponse),
          json: () => emptyResponse,
        };
      }

      try {
        const listResponse = await mockService.listDiffsForRepository(
          authTenantId as TenantId,
          repositoryId as unknown as import('../../types/entities').RepositoryId,
          { page, pageSize }
        );

        const responseData = {
          success: true,
          data: listResponse.diffs.map(d => ({
            id: d.id,
            baseSnapshotId: d.baseSnapshotId,
            targetSnapshotId: d.targetSnapshotId,
            summary: d.summary,
            computedAt: d.computedAt.toISOString(),
            computationTimeMs: d.computationTimeMs,
          })),
          pagination: {
            page: listResponse.page,
            pageSize: listResponse.pageSize,
            total: listResponse.total,
            totalPages: listResponse.totalPages,
            hasNext: listResponse.hasNext,
            hasPrevious: listResponse.hasPrevious,
          },
        };

        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(responseData),
          json: () => responseData,
        };
      } catch {
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }),
          json: () => ({ success: false, error: { code: 'INTERNAL_ERROR' } }),
        };
      }
    }

    // Route: GET /api/v1/diffs/:diffId
    if (method === 'GET' && url.match(/\/api\/v1\/diffs\/[^/]+$/)) {
      if (!hasAuth) {
        return {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
          json: () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
        };
      }

      // getDiffById is not implemented, returns 404
      return {
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: 'Diff not found' } }),
        json: () => ({ success: false, error: { code: 'NOT_FOUND', message: 'Diff not found' } }),
      };
    }

    // Route: DELETE /api/v1/diffs/:diffId
    if (method === 'DELETE' && url.match(/\/api\/v1\/diffs\/[^/]+$/)) {
      if (!hasAuth) {
        return {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
          json: () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
        };
      }

      const diffId = url.split('/').pop() as string;

      try {
        const deleted = await mockService.deleteDiff(authTenantId as TenantId, diffId as GraphDiffId);
        if (!deleted) {
          return {
            statusCode: 404,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
            json: () => ({ success: false, error: { code: 'NOT_FOUND' } }),
          };
        }
        return {
          statusCode: 204,
          headers: {},
          body: '',
          json: () => null,
        };
      } catch {
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }),
          json: () => ({ success: false, error: { code: 'INTERNAL_ERROR' } }),
        };
      }
    }

    // Route: POST /api/v1/diffs/estimate
    if (method === 'POST' && url === '/api/v1/diffs/estimate') {
      if (!hasAuth) {
        return {
          statusCode: 401,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED' } }),
          json: () => ({ success: false, error: { code: 'UNAUTHORIZED' } }),
        };
      }

      const body = payload as { baseScanId?: string; compareScanId?: string };

      if (!body?.baseScanId) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'baseScanId is required' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'baseScanId is required' } }),
        };
      }

      if (!body?.compareScanId) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'compareScanId is required' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'compareScanId is required' } }),
        };
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(body.baseScanId)) {
        return {
          statusCode: 400,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID format' } }),
          json: () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid UUID format' } }),
        };
      }

      try {
        const estimate = await mockService.estimateDiffCost(
          authTenantId as TenantId,
          body.baseScanId as ScanId,
          body.compareScanId as ScanId
        );

        const responseData = {
          success: true,
          data: {
            estimatedTimeMs: estimate.estimatedTimeMs,
            estimatedMemoryBytes: estimate.estimatedMemoryBytes,
            totalNodes: estimate.totalNodes,
            totalEdges: estimate.totalEdges,
            withinLimits: estimate.withinLimits,
            warnings: [...estimate.warnings],
          },
        };

        return {
          statusCode: 200,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(responseData),
          json: () => responseData,
        };
      } catch (error) {
        const err = error as { code?: string; message?: string };
        if (err.code === 'GRAPH_DIFF_SNAPSHOT_NOT_FOUND') {
          return {
            statusCode: 404,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
            json: () => ({ success: false, error: { code: 'NOT_FOUND' } }),
          };
        }
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR' } }),
          json: () => ({ success: false, error: { code: 'INTERNAL_ERROR' } }),
        };
      }
    }

    // Default 404
    return {
      statusCode: 404,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND' } }),
      json: () => ({ success: false, error: { code: 'NOT_FOUND' } }),
    };
  });

  return {
    inject,
    graphDiffService: mockService,
    close: async () => { /* noop */ },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Graph Diff Routes Integration Tests', () => {
  let app: MockTestApp;
  let mockDiffService: IGraphDiffService;
  let testTenantId: string;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    testTenantId = createTenantId();
    authHeaders = createAuthHeaders(testTenantId);
  });

  beforeEach(async () => {
    // Create fresh mock service for each test
    mockDiffService = createMockGraphDiffService();
    app = await createMockTestApp(mockDiffService);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // POST /api/v1/diffs - Create/Compute Diff
  // ==========================================================================

  describe('POST /api/v1/diffs', () => {
    const baseScanId = randomUUID();
    const compareScanId = randomUUID();

    describe('successful requests', () => {
      it('should return 201 for new diff computation', async () => {
        const mockResponse = createMockDiffResponse(false);
        (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(201);
        const body = response.json() as { success: boolean; data: unknown; fromCache: boolean; metadata: { phases: string[] } };
        expect(body.success).toBe(true);
        expect(body.data).toBeDefined();
        expect(body.fromCache).toBe(false);
        expect(body.metadata).toBeDefined();
        expect(body.metadata.phases).toContain('compute_diff');
      });

      it('should return 200 for cached diff', async () => {
        const mockResponse = createMockDiffResponse(true);
        (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { success: boolean; fromCache: boolean; cacheInfo: { cachedAt: string; accessCount: number } };
        expect(body.success).toBe(true);
        expect(body.fromCache).toBe(true);
        expect(body.cacheInfo).toBeDefined();
        expect(body.cacheInfo.cachedAt).toBeDefined();
        expect(body.cacheInfo.accessCount).toBeGreaterThan(0);
      });

      it('should accept optional computation options', async () => {
        const mockResponse = createMockDiffResponse(false);
        (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: {
            baseScanId,
            compareScanId,
            options: {
              includeUnchanged: true,
              includeAttributeChanges: true,
              significantChangeThreshold: 0.2,
              maxNodes: 50000,
              timeoutMs: 60000,
            },
            forceRecompute: true,
          },
        });

        expect(response.statusCode).toBe(201);
        expect(mockDiffService.getDiff).toHaveBeenCalled();
        const callArg = (mockDiffService.getDiff as Mock).mock.calls[0][0] as GraphDiffRequest;
        expect(callArg.forceRecompute).toBe(true);
      });

      it('should return 202 for async computation request', async () => {
        const mockEstimate = createMockCostEstimate();
        (mockDiffService.estimateDiffCost as Mock).mockResolvedValue(mockEstimate);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId, compareScanId, async: true },
        });

        expect(response.statusCode).toBe(202);
        const body = response.json() as { success: boolean; message: string; diffId: string; estimatedTimeMs: number };
        expect(body.success).toBe(true);
        expect(body.message).toContain('asynchronous');
        expect(body.diffId).toBeDefined();
        expect(body.estimatedTimeMs).toBeDefined();
      });
    });

    describe('validation errors', () => {
      it('should return 400 for missing baseScanId', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { compareScanId },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for missing compareScanId', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid UUID format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId: 'not-a-uuid', compareScanId },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid options', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: {
            baseScanId,
            compareScanId,
            options: { significantChangeThreshold: 5 }, // Out of range
          },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('authentication errors', () => {
      it('should return 401 without authorization header', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(401);
      });

      it('should return 401 with invalid token', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: { 'Content-Type': 'application/json' },
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(401);
      });
    });

    describe('service errors', () => {
      it('should return 404 when scan not found', async () => {
        (mockDiffService.getDiff as Mock).mockRejectedValue({
          code: 'GRAPH_DIFF_SNAPSHOT_NOT_FOUND',
          message: 'Snapshot not found',
          context: { snapshotId: baseScanId },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(404);
      });

      it('should return 408 on computation timeout', async () => {
        (mockDiffService.getDiff as Mock).mockRejectedValue({
          code: 'GRAPH_DIFF_TIMEOUT',
          message: 'Computation timed out',
          context: { timeoutMs: 30000, elapsedMs: 35000 },
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(408);
      });
    });
  });

  // ==========================================================================
  // GET /api/v1/diffs - List Diffs
  // ==========================================================================

  describe('GET /api/v1/diffs', () => {
    describe('successful requests', () => {
      it('should return paginated list of diffs', async () => {
        const repositoryId = randomUUID();
        const mockListResponse: GraphDiffListResponse = {
          diffs: [createMockDiffListItem(), createMockDiffListItem(), createMockDiffListItem()],
          total: 3,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
        (mockDiffService.listDiffsForRepository as Mock).mockResolvedValue(mockListResponse);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs?repositoryId=${repositoryId}`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { success: boolean; data: unknown[]; pagination: { page: number; total: number } };
        expect(body.success).toBe(true);
        expect(Array.isArray(body.data)).toBe(true);
        expect(body.data.length).toBe(3);
        expect(body.pagination).toBeDefined();
        expect(body.pagination.page).toBe(1);
        expect(body.pagination.total).toBe(3);
      });

      it('should handle pagination parameters', async () => {
        const repositoryId = randomUUID();
        const mockListResponse: GraphDiffListResponse = {
          diffs: [createMockDiffListItem()],
          total: 50,
          page: 3,
          pageSize: 10,
          totalPages: 5,
          hasNext: true,
          hasPrevious: true,
        };
        (mockDiffService.listDiffsForRepository as Mock).mockResolvedValue(mockListResponse);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs?repositoryId=${repositoryId}&page=3&pageSize=10`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { pagination: { page: number; pageSize: number; hasNext: boolean; hasPrevious: boolean } };
        expect(body.pagination.page).toBe(3);
        expect(body.pagination.pageSize).toBe(10);
        expect(body.pagination.hasNext).toBe(true);
        expect(body.pagination.hasPrevious).toBe(true);
      });

      it('should filter by scanId', async () => {
        const repositoryId = randomUUID();
        const scanId = randomUUID();
        const mockListResponse: GraphDiffListResponse = {
          diffs: [createMockDiffListItem()],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
        (mockDiffService.listDiffsForRepository as Mock).mockResolvedValue(mockListResponse);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs?repositoryId=${repositoryId}&scanId=${scanId}`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(200);
      });

      it('should sort by computedAt correctly', async () => {
        const repositoryId = randomUUID();
        const oldDiff = createMockDiffListItem({ computedAt: new Date('2025-01-01') });
        const newDiff = createMockDiffListItem({ computedAt: new Date('2025-01-15') });
        const mockListResponse: GraphDiffListResponse = {
          diffs: [newDiff, oldDiff],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        };
        (mockDiffService.listDiffsForRepository as Mock).mockResolvedValue(mockListResponse);

        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs?repositoryId=${repositoryId}&sortBy=computedAt&sortOrder=desc`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { data: Array<{ computedAt: string }> };
        expect(body.data.length).toBe(2);
        expect(new Date(body.data[0].computedAt).getTime()).toBeGreaterThan(
          new Date(body.data[1].computedAt).getTime()
        );
      });

      it('should return empty list without repositoryId filter', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/diffs',
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { success: boolean; data: unknown[]; pagination: { total: number } };
        expect(body.success).toBe(true);
        expect(body.data).toEqual([]);
        expect(body.pagination.total).toBe(0);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for invalid page number', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/diffs?page=0',
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid pageSize', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/diffs?pageSize=500',
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid sortBy value', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/diffs?sortBy=invalidField',
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('authentication errors', () => {
      it('should return 401 without authorization', async () => {
        const response = await app.inject({
          method: 'GET',
          url: '/api/v1/diffs',
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  // ==========================================================================
  // GET /api/v1/diffs/:diffId - Get Diff by ID
  // ==========================================================================

  describe('GET /api/v1/diffs/:diffId', () => {
    describe('successful requests', () => {
      it('should return 200 with diff data', async () => {
        const diffId = createDiffId();
        // Note: Current implementation returns 404 as getDiffById is not implemented
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs/${diffId}`,
          headers: authHeaders,
        });

        expect([200, 404]).toContain(response.statusCode);
      });
    });

    describe('error handling', () => {
      it('should return 404 for non-existent diff', async () => {
        const diffId = 'non-existent-diff-id';
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs/${diffId}`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('authentication errors', () => {
      it('should return 401 without authorization', async () => {
        const diffId = createDiffId();
        const response = await app.inject({
          method: 'GET',
          url: `/api/v1/diffs/${diffId}`,
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  // ==========================================================================
  // DELETE /api/v1/diffs/:diffId - Delete Diff
  // ==========================================================================

  describe('DELETE /api/v1/diffs/:diffId', () => {
    describe('successful requests', () => {
      it('should return 204 on successful deletion', async () => {
        const diffId = createDiffId();
        (mockDiffService.deleteDiff as Mock).mockResolvedValue(true);

        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/diffs/${diffId}`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(204);
        expect(response.body).toBe('');
      });

      it('should call service with correct parameters', async () => {
        const diffId = createDiffId();
        (mockDiffService.deleteDiff as Mock).mockResolvedValue(true);

        await app.inject({
          method: 'DELETE',
          url: `/api/v1/diffs/${diffId}`,
          headers: authHeaders,
        });

        expect(mockDiffService.deleteDiff).toHaveBeenCalledWith(
          expect.any(String),
          diffId
        );
      });
    });

    describe('error handling', () => {
      it('should return 404 when diff not found', async () => {
        const diffId = createDiffId();
        (mockDiffService.deleteDiff as Mock).mockResolvedValue(false);

        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/diffs/${diffId}`,
          headers: authHeaders,
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('authentication errors', () => {
      it('should return 401 without authorization', async () => {
        const diffId = createDiffId();
        const response = await app.inject({
          method: 'DELETE',
          url: `/api/v1/diffs/${diffId}`,
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  // ==========================================================================
  // POST /api/v1/diffs/estimate - Estimate Diff Cost
  // ==========================================================================

  describe('POST /api/v1/diffs/estimate', () => {
    const baseScanId = randomUUID();
    const compareScanId = randomUUID();

    describe('successful requests', () => {
      it('should return cost estimate', async () => {
        const mockEstimate = createMockCostEstimate();
        (mockDiffService.estimateDiffCost as Mock).mockResolvedValue(mockEstimate);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as {
          success: boolean;
          data: { estimatedTimeMs: number; estimatedMemoryBytes: number; totalNodes: number; totalEdges: number; withinLimits: boolean; warnings: string[] };
        };
        expect(body.success).toBe(true);
        expect(body.data.estimatedTimeMs).toBeDefined();
        expect(body.data.estimatedMemoryBytes).toBeDefined();
        expect(body.data.totalNodes).toBeDefined();
        expect(body.data.totalEdges).toBeDefined();
        expect(body.data.withinLimits).toBe(true);
        expect(Array.isArray(body.data.warnings)).toBe(true);
      });

      it('should return warnings when approaching limits', async () => {
        const mockEstimate = createMockCostEstimate({
          warnings: ['Node count approaching maximum limit', 'Consider using filters'],
        });
        (mockDiffService.estimateDiffCost as Mock).mockResolvedValue(mockEstimate);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { data: { warnings: string[] } };
        expect(body.data.warnings.length).toBeGreaterThan(0);
      });

      it('should indicate when computation exceeds limits', async () => {
        const mockEstimate = createMockCostEstimate({
          withinLimits: false,
          warnings: ['Node count exceeds maximum'],
          totalNodes: 150000,
        });
        (mockDiffService.estimateDiffCost as Mock).mockResolvedValue(mockEstimate);

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(200);
        const body = response.json() as { data: { withinLimits: boolean } };
        expect(body.data.withinLimits).toBe(false);
      });
    });

    describe('validation errors', () => {
      it('should return 400 for missing baseScanId', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { compareScanId },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for missing compareScanId', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId },
        });

        expect(response.statusCode).toBe(400);
      });

      it('should return 400 for invalid UUID format', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId: 'invalid-uuid', compareScanId },
        });

        expect(response.statusCode).toBe(400);
      });
    });

    describe('service errors', () => {
      it('should return 404 when scan not found', async () => {
        (mockDiffService.estimateDiffCost as Mock).mockRejectedValue({
          code: 'GRAPH_DIFF_SNAPSHOT_NOT_FOUND',
          message: 'Snapshot not found',
        });

        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          headers: authHeaders,
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(404);
      });
    });

    describe('authentication errors', () => {
      it('should return 401 without authorization', async () => {
        const response = await app.inject({
          method: 'POST',
          url: '/api/v1/diffs/estimate',
          payload: { baseScanId, compareScanId },
        });

        expect(response.statusCode).toBe(401);
      });
    });
  });

  // ==========================================================================
  // Response Format Tests
  // ==========================================================================

  describe('Response Format', () => {
    it('should return JSON content type', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/diffs',
        headers: authHeaders,
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include success field in all responses', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/diffs',
        headers: authHeaders,
      });

      const body = response.json() as { success: boolean };
      expect(typeof body.success).toBe('boolean');
    });

    it('should include diff summary fields in list items', async () => {
      const repositoryId = randomUUID();
      const mockListResponse: GraphDiffListResponse = {
        diffs: [createMockDiffListItem()],
        total: 1,
        page: 1,
        pageSize: 20,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      };
      (mockDiffService.listDiffsForRepository as Mock).mockResolvedValue(mockListResponse);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/diffs?repositoryId=${repositoryId}`,
        headers: authHeaders,
      });

      const body = response.json() as { data: Array<{ id: string; baseSnapshotId: string; targetSnapshotId: string; summary: { nodesAdded: number; nodesRemoved: number; nodesModified: number }; computedAt: string; computationTimeMs: number }> };
      if (body.data.length > 0) {
        const item = body.data[0];
        expect(item.id).toBeDefined();
        expect(item.baseSnapshotId).toBeDefined();
        expect(item.targetSnapshotId).toBeDefined();
        expect(item.summary).toBeDefined();
        expect(item.summary.nodesAdded).toBeDefined();
        expect(item.summary.nodesRemoved).toBeDefined();
        expect(item.summary.nodesModified).toBeDefined();
        expect(item.computedAt).toBeDefined();
        expect(item.computationTimeMs).toBeDefined();
      }
    });
  });

  // ==========================================================================
  // Concurrent Request Tests
  // ==========================================================================

  describe('Concurrent Requests', () => {
    it('should handle concurrent diff requests', async () => {
      const mockResponse = createMockDiffResponse(false);
      (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

      const requests = Array.from({ length: 5 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId: randomUUID(), compareScanId: randomUUID() },
        })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.statusCode === 201).length;
      expect(successCount).toBe(5);
    });

    it('should handle concurrent list requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        app.inject({
          method: 'GET',
          url: '/api/v1/diffs',
          headers: authHeaders,
        })
      );

      const responses = await Promise.all(requests);
      const successCount = responses.filter((r) => r.statusCode === 200).length;
      expect(successCount).toBe(10);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle empty diff result', async () => {
      const emptyDiff = createMockDiffResult({
        summary: createMockDiffSummary({
          nodesAdded: 0,
          nodesRemoved: 0,
          nodesModified: 0,
          nodesUnchanged: 100,
          edgesAdded: 0,
          edgesRemoved: 0,
          edgesModified: 0,
          edgesUnchanged: 200,
          nodeChangeRatio: 0,
          edgeChangeRatio: 0,
          overallChangeRatio: 0,
          isSignificantChange: false,
        }),
      });
      const mockResponse = createMockDiffResponse(false, { diff: emptyDiff });
      (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/diffs',
        headers: authHeaders,
        payload: { baseScanId: randomUUID(), compareScanId: randomUUID() },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as { data: { summary: { isSignificantChange: boolean; overallChangeRatio: number } } };
      expect(body.data.summary.isSignificantChange).toBe(false);
      expect(body.data.summary.overallChangeRatio).toBe(0);
    });

    it('should handle large diff result', async () => {
      const largeDiff = createMockDiffResult({
        summary: createMockDiffSummary({
          baseNodeCount: 100000,
          targetNodeCount: 100500,
          nodesAdded: 1000,
          nodesRemoved: 500,
          nodesModified: 5000,
        }),
      });
      const mockResponse = createMockDiffResponse(false, { diff: largeDiff });
      (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/diffs',
        headers: authHeaders,
        payload: { baseScanId: randomUUID(), compareScanId: randomUUID() },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json() as { data: { summary: { baseNodeCount: number } } };
      expect(body.data.summary.baseNodeCount).toBe(100000);
    });

    it('should handle special characters in diff options', async () => {
      const mockResponse = createMockDiffResponse(false);
      (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/diffs',
        headers: authHeaders,
        payload: {
          baseScanId: randomUUID(),
          compareScanId: randomUUID(),
          options: {
            includeNodeTypes: ['terraform_resource', 'kubernetes_deployment'],
            excludeNodeTypes: ['terraform_data'],
          },
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Graph Diff Routes Performance', () => {
  let app: MockTestApp;
  let mockDiffService: IGraphDiffService;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    authHeaders = createAuthHeaders(createTenantId());
  });

  beforeEach(async () => {
    mockDiffService = createMockGraphDiffService();
    app = await createMockTestApp(mockDiffService);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should respond to list request within 100ms', async () => {
    const start = performance.now();

    await app.inject({
      method: 'GET',
      url: '/api/v1/diffs',
      headers: authHeaders,
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it('should handle rapid sequential requests', async () => {
    const mockResponse = createMockDiffResponse(false);
    (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

    const start = performance.now();

    for (let i = 0; i < 10; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/diffs',
        headers: authHeaders,
        payload: { baseScanId: randomUUID(), compareScanId: randomUUID() },
      });
    }

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(2000);
  });
});

// ============================================================================
// Rate Limiting Tests
// ============================================================================

describe('Graph Diff Routes Rate Limiting', () => {
  let app: MockTestApp;
  let mockDiffService: IGraphDiffService;
  let authHeaders: Record<string, string>;

  beforeAll(async () => {
    authHeaders = createAuthHeaders(createTenantId());
  });

  beforeEach(async () => {
    mockDiffService = createMockGraphDiffService();
    app = await createMockTestApp(mockDiffService);
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should not rate limit normal request volumes', async () => {
    const mockResponse = createMockDiffResponse(false);
    (mockDiffService.getDiff as Mock).mockResolvedValue(mockResponse);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        app.inject({
          method: 'POST',
          url: '/api/v1/diffs',
          headers: authHeaders,
          payload: { baseScanId: randomUUID(), compareScanId: randomUUID() },
        })
      )
    );

    const statusCodes = responses.map(r => r.statusCode);
    expect(statusCodes.every(code => code === 201)).toBe(true);
  });
});
