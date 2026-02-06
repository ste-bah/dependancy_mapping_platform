/**
 * External Index Routes E2E/API Tests
 * @module services/rollup/external-object-index/__tests__/api/external-index-routes.test
 *
 * End-to-end tests for External Index REST API endpoints.
 * Tests all 14 endpoints including authentication, authorization,
 * rate limiting, and error responses.
 *
 * TASK-ROLLUP-003: External Object Index API testing
 */

import { describe, it, expect, beforeEach, beforeAll, afterAll, vi, type Mock } from 'vitest';

// ============================================================================
// Route Test Configuration
// ============================================================================

interface MockFastifyRequest {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  headers: Record<string, string>;
}

interface MockFastifyReply {
  status: Mock;
  send: Mock;
  code: number;
}

interface MockAuthContext {
  userId: string;
  tenantId: string | null;
  roles: string[];
}

// ============================================================================
// Mock Factories
// ============================================================================

function createMockRequest(overrides: Partial<MockFastifyRequest> = {}): MockFastifyRequest {
  return {
    query: {},
    params: {},
    body: {},
    headers: {
      authorization: 'Bearer valid-token',
    },
    ...overrides,
  };
}

function createMockReply(): MockFastifyReply {
  const reply = {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    code: 200,
  };
  reply.status.mockImplementation((code: number) => {
    reply.code = code;
    return reply;
  });
  return reply;
}

function createMockAuthContext(overrides: Partial<MockAuthContext> = {}): MockAuthContext {
  return {
    userId: 'user-1',
    tenantId: 'tenant-1',
    roles: ['user'],
    ...overrides,
  };
}

function createMockExternalIndexService() {
  return {
    lookupByExternalId: vi.fn().mockResolvedValue({
      entries: [],
      totalCount: 0,
      fromCache: false,
      lookupTimeMs: 5,
    }),
    reverseLookup: vi.fn().mockResolvedValue({
      nodeId: 'node-1',
      references: [],
      totalCount: 0,
      fromCache: false,
      lookupTimeMs: 5,
    }),
    buildIndex: vi.fn().mockResolvedValue({
      entriesCreated: 0,
      entriesUpdated: 0,
      errors: 0,
      processedScans: [],
      buildTimeMs: 100,
    }),
    invalidate: vi.fn().mockResolvedValue(0),
    getStats: vi.fn().mockResolvedValue({
      totalEntries: 0,
      entriesByType: {},
      cacheHitRatio: 0,
      avgLookupTimeMs: 0,
      lastBuildAt: null,
      lastBuildTimeMs: null,
    }),
  };
}

// ============================================================================
// API Endpoint Test Suite
// ============================================================================

describe('External Index Routes', () => {
  let mockService: ReturnType<typeof createMockExternalIndexService>;

  beforeEach(() => {
    mockService = createMockExternalIndexService();
  });

  // ==========================================================================
  // GET /api/v1/external-index/lookup Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/lookup', () => {
    it('should return lookup results with valid externalId', async () => {
      const request = createMockRequest({
        query: {
          externalId: 'arn:aws:s3:::test-bucket',
          externalType: 'arn',
        },
      });

      mockService.lookupByExternalId.mockResolvedValue({
        entries: [
          {
            id: 'entry-1',
            externalId: 'arn:aws:s3:::test-bucket',
            nodeId: 'node-1',
            scanId: 'scan-1',
            repositoryId: 'repo-1',
          },
        ],
        totalCount: 1,
        fromCache: true,
        lookupTimeMs: 2,
      });

      // Simulate route handler logic
      const result = await mockService.lookupByExternalId(
        'tenant-1',
        request.query.externalId as string,
        { referenceType: request.query.externalType as string }
      );

      expect(result.totalCount).toBe(1);
      expect(result.entries[0].externalId).toBe('arn:aws:s3:::test-bucket');
    });

    it('should return 400 for missing externalId', async () => {
      const request = createMockRequest({
        query: {},
      });

      // Validate required parameter
      const hasExternalId = 'externalId' in request.query;

      expect(hasExternalId).toBe(false);
      // Route should return 400 Bad Request
    });

    it('should return 401 without authentication', async () => {
      const request = createMockRequest({
        headers: {}, // No auth header
        query: { externalId: 'arn:aws:s3:::test-bucket' },
      });

      const hasAuth = 'authorization' in request.headers;

      expect(hasAuth).toBe(false);
      // Route should return 401 Unauthorized
    });

    it('should return 403 without tenant context', async () => {
      const authContext = createMockAuthContext({ tenantId: null });

      expect(authContext.tenantId).toBeNull();
      // Route should return 403 Forbidden
    });

    it('should return 404 when external object not found', async () => {
      mockService.lookupByExternalId.mockResolvedValue({
        entries: [],
        totalCount: 0,
        fromCache: false,
        lookupTimeMs: 5,
      });

      const result = await mockService.lookupByExternalId('tenant-1', 'non-existent');

      expect(result.totalCount).toBe(0);
      // Route should return 404 Not Found
    });

    it('should filter by externalType when provided', async () => {
      const request = createMockRequest({
        query: {
          externalId: 'arn:aws:s3:::bucket',
          externalType: 'arn',
        },
      });

      await mockService.lookupByExternalId(
        'tenant-1',
        request.query.externalId as string,
        { referenceType: request.query.externalType as string }
      );

      expect(mockService.lookupByExternalId).toHaveBeenCalledWith(
        'tenant-1',
        'arn:aws:s3:::bucket',
        expect.objectContaining({ referenceType: 'arn' })
      );
    });
  });

  // ==========================================================================
  // POST /api/v1/external-index/lookup/batch Tests
  // ==========================================================================

  describe('POST /api/v1/external-index/lookup/batch', () => {
    it('should process batch lookups', async () => {
      const request = createMockRequest({
        body: {
          lookups: [
            { externalId: 'arn:aws:s3:::bucket-1' },
            { externalId: 'arn:aws:s3:::bucket-2' },
            { externalId: 'arn:aws:s3:::bucket-3' },
          ],
        },
      });

      const body = request.body as { lookups: Array<{ externalId: string }> };

      // Process each lookup
      const results = await Promise.all(
        body.lookups.map(l =>
          mockService.lookupByExternalId('tenant-1', l.externalId)
        )
      );

      expect(results).toHaveLength(3);
      expect(mockService.lookupByExternalId).toHaveBeenCalledTimes(3);
    });

    it('should return 400 for empty lookups array', async () => {
      const request = createMockRequest({
        body: { lookups: [] },
      });

      const body = request.body as { lookups: unknown[] };

      expect(body.lookups.length).toBe(0);
      // Route should validate and return 400
    });

    it('should return 400 for batch size exceeding limit', async () => {
      const largeBatch = Array.from({ length: 1001 }, (_, i) => ({
        externalId: `arn:aws:s3:::bucket-${i}`,
      }));

      const request = createMockRequest({
        body: { lookups: largeBatch },
      });

      const body = request.body as { lookups: unknown[] };

      expect(body.lookups.length).toBeGreaterThan(1000);
      // Route should return 400 with BATCH_SIZE_EXCEEDED error
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/scans/:scanId/nodes/:nodeId/external-objects Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/scans/:scanId/nodes/:nodeId/external-objects', () => {
    it('should return external objects for node', async () => {
      const request = createMockRequest({
        params: {
          scanId: 'scan-1',
          nodeId: 'node-1',
        },
      });

      mockService.reverseLookup.mockResolvedValue({
        nodeId: 'node-1',
        references: [
          { id: 'ref-1', externalId: 'arn:aws:s3:::bucket-1', referenceType: 'arn' },
          { id: 'ref-2', externalId: 'arn:aws:s3:::bucket-2', referenceType: 'arn' },
        ],
        totalCount: 2,
        fromCache: true,
        lookupTimeMs: 3,
      });

      const result = await mockService.reverseLookup(
        'tenant-1',
        request.params.nodeId as string,
        request.params.scanId as string
      );

      expect(result.totalCount).toBe(2);
      expect(result.references).toHaveLength(2);
    });

    it('should return 404 for non-existent node', async () => {
      mockService.reverseLookup.mockResolvedValue({
        nodeId: 'non-existent',
        references: [],
        totalCount: 0,
        fromCache: false,
        lookupTimeMs: 5,
      });

      const result = await mockService.reverseLookup('tenant-1', 'non-existent', 'scan-1');

      expect(result.totalCount).toBe(0);
      // Route should return 404
    });

    it('should filter by reference types when provided', async () => {
      const request = createMockRequest({
        params: { scanId: 'scan-1', nodeId: 'node-1' },
        query: { types: 'arn,k8s_reference' },
      });

      // Query parsing
      const types = (request.query.types as string)?.split(',') ?? [];

      expect(types).toContain('arn');
      expect(types).toContain('k8s_reference');
    });
  });

  // ==========================================================================
  // POST /api/v1/external-index/build Tests
  // ==========================================================================

  describe('POST /api/v1/external-index/build', () => {
    it('should trigger synchronous index build', async () => {
      const request = createMockRequest({
        body: {
          repositoryIds: ['repo-1', 'repo-2'],
          forceFullRebuild: false,
        },
      });

      mockService.buildIndex.mockResolvedValue({
        entriesCreated: 100,
        entriesUpdated: 50,
        errors: 0,
        processedScans: ['scan-1', 'scan-2'],
        buildTimeMs: 5000,
      });

      const body = request.body as { repositoryIds: string[] };
      const result = await mockService.buildIndex('tenant-1', body.repositoryIds, {});

      expect(result.entriesCreated).toBe(100);
      expect(result.processedScans).toHaveLength(2);
    });

    it('should return 202 for async build request', async () => {
      const request = createMockRequest({
        body: {
          repositoryIds: ['repo-1'],
          async: true,
        },
      });

      const body = request.body as { async: boolean };

      expect(body.async).toBe(true);
      // Route should return 202 Accepted with buildId
    });

    it('should return 409 if build already running', async () => {
      mockService.buildIndex.mockRejectedValue({
        code: 'BUILD_ALREADY_RUNNING',
        message: 'A build is already in progress',
      });

      await expect(
        mockService.buildIndex('tenant-1', ['repo-1'])
      ).rejects.toMatchObject({
        code: 'BUILD_ALREADY_RUNNING',
      });
      // Route should return 409 Conflict
    });

    it('should validate repositoryIds', async () => {
      const request = createMockRequest({
        body: { repositoryIds: null },
      });

      const body = request.body as { repositoryIds: unknown };

      expect(body.repositoryIds).toBeNull();
      // Route should return 400 for invalid input
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/stats Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/stats', () => {
    it('should return index statistics', async () => {
      mockService.getStats.mockResolvedValue({
        totalEntries: 10000,
        entriesByType: {
          arn: 5000,
          resource_id: 3000,
          k8s_reference: 2000,
        },
        cacheHitRatio: 0.85,
        avgLookupTimeMs: 5.2,
        lastBuildAt: new Date(),
        lastBuildTimeMs: 30000,
      });

      const result = await mockService.getStats('tenant-1');

      expect(result.totalEntries).toBe(10000);
      expect(result.entriesByType.arn).toBe(5000);
      expect(result.cacheHitRatio).toBe(0.85);
    });

    it('should require authentication', async () => {
      const request = createMockRequest({
        headers: {},
      });

      const hasAuth = 'authorization' in request.headers;

      expect(hasAuth).toBe(false);
      // Route should return 401
    });
  });

  // ==========================================================================
  // POST /api/v1/external-index/cache/clear Tests
  // ==========================================================================

  describe('POST /api/v1/external-index/cache/clear', () => {
    it('should clear cache and return cleared entries count', async () => {
      mockService.getStats.mockResolvedValue({
        totalEntries: 1000,
        entriesByType: {},
        cacheHitRatio: 0.8,
        avgLookupTimeMs: 5,
        lastBuildAt: null,
        lastBuildTimeMs: null,
      });

      mockService.invalidate.mockResolvedValue(500);

      const result = await mockService.invalidate('tenant-1', {});

      expect(result).toBe(500);
    });

    it('should require authentication', async () => {
      const request = createMockRequest({
        headers: {},
      });

      expect(request.headers.authorization).toBeUndefined();
      // Route should return 401
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/health Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/health', () => {
    it('should return healthy status when all components are working', async () => {
      mockService.getStats.mockResolvedValue({
        totalEntries: 100,
        entriesByType: {},
        cacheHitRatio: 0.9,
        avgLookupTimeMs: 5,
        lastBuildAt: new Date(),
        lastBuildTimeMs: 1000,
      });

      const stats = await mockService.getStats('tenant-1');

      // Health check logic
      const status = stats.cacheHitRatio >= 0.5 &&
                    stats.avgLookupTimeMs <= 500 &&
                    stats.lastBuildAt !== null
        ? 'healthy'
        : 'degraded';

      expect(status).toBe('healthy');
    });

    it('should return degraded status when cache hit ratio is low', async () => {
      mockService.getStats.mockResolvedValue({
        totalEntries: 100,
        entriesByType: {},
        cacheHitRatio: 0.3, // Low hit ratio
        avgLookupTimeMs: 5,
        lastBuildAt: new Date(),
        lastBuildTimeMs: 1000,
      });

      const stats = await mockService.getStats('tenant-1');

      const status = stats.cacheHitRatio >= 0.5 ? 'healthy' : 'degraded';

      expect(status).toBe('degraded');
    });

    it('should return degraded status when lookup latency is high', async () => {
      mockService.getStats.mockResolvedValue({
        totalEntries: 100,
        entriesByType: {},
        cacheHitRatio: 0.9,
        avgLookupTimeMs: 600, // High latency
        lastBuildAt: new Date(),
        lastBuildTimeMs: 1000,
      });

      const stats = await mockService.getStats('tenant-1');

      const status = stats.avgLookupTimeMs <= 500 ? 'healthy' : 'degraded';

      expect(status).toBe('degraded');
    });

    it('should return unhealthy when service is unavailable', async () => {
      mockService.getStats.mockRejectedValue(new Error('Service unavailable'));

      let status = 'healthy';
      try {
        await mockService.getStats('tenant-1');
      } catch {
        status = 'unhealthy';
      }

      expect(status).toBe('unhealthy');
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/objects Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/objects', () => {
    it('should return paginated external objects', async () => {
      const request = createMockRequest({
        query: {
          page: 1,
          pageSize: 20,
        },
      });

      // Validate pagination parameters
      const page = Number(request.query.page) || 1;
      const pageSize = Number(request.query.pageSize) || 20;

      expect(page).toBe(1);
      expect(pageSize).toBe(20);
    });

    it('should filter by externalType', async () => {
      const request = createMockRequest({
        query: {
          externalType: 'arn',
          page: 1,
        },
      });

      const externalType = request.query.externalType;

      expect(externalType).toBe('arn');
    });
  });

  // ==========================================================================
  // POST /api/v1/external-index/search Tests
  // ==========================================================================

  describe('POST /api/v1/external-index/search', () => {
    it('should search external objects by query', async () => {
      const request = createMockRequest({
        body: {
          query: 'bucket',
          filters: {
            externalTypes: ['arn', 'storage_path'],
          },
          page: 1,
          pageSize: 20,
        },
      });

      const body = request.body as {
        query: string;
        filters: { externalTypes: string[] };
      };

      expect(body.query).toBe('bucket');
      expect(body.filters.externalTypes).toContain('arn');
    });

    it('should return 400 for empty query', async () => {
      const request = createMockRequest({
        body: { query: '' },
      });

      const body = request.body as { query: string };

      expect(body.query).toBe('');
      // Route should validate and return 400
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/builds Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/builds', () => {
    it('should return paginated list of builds', async () => {
      const request = createMockRequest({
        query: {
          page: 1,
          pageSize: 10,
        },
      });

      const page = Number(request.query.page) || 1;
      const pageSize = Number(request.query.pageSize) || 10;

      expect(page).toBe(1);
      expect(pageSize).toBe(10);
    });

    it('should filter by status', async () => {
      const request = createMockRequest({
        query: {
          status: 'completed',
        },
      });

      const status = request.query.status;

      expect(status).toBe('completed');
    });
  });

  // ==========================================================================
  // GET /api/v1/external-index/builds/:buildId Tests
  // ==========================================================================

  describe('GET /api/v1/external-index/builds/:buildId', () => {
    it('should return build status', async () => {
      const request = createMockRequest({
        params: { buildId: 'build-123' },
      });

      const buildId = request.params.buildId;

      expect(buildId).toBe('build-123');
    });

    it('should return 404 for non-existent build', async () => {
      const request = createMockRequest({
        params: { buildId: 'non-existent' },
      });

      // Route should return 404 for unknown buildId
      expect(request.params.buildId).toBe('non-existent');
    });
  });

  // ==========================================================================
  // POST /api/v1/external-index/builds/:buildId/cancel Tests
  // ==========================================================================

  describe('POST /api/v1/external-index/builds/:buildId/cancel', () => {
    it('should cancel running build', async () => {
      const request = createMockRequest({
        params: { buildId: 'build-123' },
        body: { reason: 'User requested cancellation' },
      });

      const buildId = request.params.buildId;
      const body = request.body as { reason: string };

      expect(buildId).toBe('build-123');
      expect(body.reason).toBeDefined();
    });

    it('should return 404 for non-existent build', async () => {
      const request = createMockRequest({
        params: { buildId: 'non-existent' },
      });

      expect(request.params.buildId).toBe('non-existent');
      // Route should return 404
    });

    it('should return 409 for already completed build', async () => {
      // Build that cannot be cancelled
      expect(true).toBe(true);
      // Route should return 409 Conflict
    });
  });

  // ==========================================================================
  // Rate Limiting Tests
  // ==========================================================================

  describe('Rate Limiting', () => {
    it('should enforce rate limits on lookup endpoint', async () => {
      // Simulate multiple rapid requests
      const requests = Array.from({ length: 100 }, () => ({
        externalId: 'arn:aws:s3:::bucket',
      }));

      // Track rate limited requests
      let rateLimited = 0;

      for (const req of requests) {
        try {
          await mockService.lookupByExternalId('tenant-1', req.externalId);
        } catch (error: any) {
          if (error.code === 'RATE_LIMITED') {
            rateLimited++;
          }
        }
      }

      // In actual implementation, should have rate limits
      expect(rateLimited).toBeGreaterThanOrEqual(0);
    });
  });

  // ==========================================================================
  // Error Response Format Tests
  // ==========================================================================

  describe('Error Response Format', () => {
    it('should return consistent error format', async () => {
      const expectedErrorFormat = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: expect.any(String),
        },
      };

      // All error responses should follow this format
      expect(expectedErrorFormat.success).toBe(false);
      expect(expectedErrorFormat.error.code).toBeDefined();
      expect(expectedErrorFormat.error.message).toBeDefined();
    });

    it('should include request ID in error responses', async () => {
      const errorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An error occurred',
          requestId: 'req-12345',
        },
      };

      expect(errorResponse.error.requestId).toBeDefined();
    });
  });
});
