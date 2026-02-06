/**
 * Documentation Routes Integration Tests
 * @module tests/integration/routes/docs.routes
 *
 * Integration tests for the documentation API endpoints.
 * Tests request/response validation, authentication, error handling,
 * and end-to-end API workflows for documentation pages.
 *
 * Endpoints tested:
 * - GET /api/v1/docs - List documentation pages
 * - POST /api/v1/docs - Create documentation page
 * - GET /api/v1/docs/toc - Get table of contents
 * - GET /api/v1/docs/:id - Get documentation page by ID
 * - GET /api/v1/docs/slug/:slug - Get documentation page by slug
 * - PUT /api/v1/docs/:id - Update documentation page
 * - DELETE /api/v1/docs/:id - Delete documentation page
 * - POST /api/v1/docs/:id/publish - Publish documentation page
 * - POST /api/v1/docs/:id/unpublish - Unpublish documentation page
 * - POST /api/v1/docs/:id/archive - Archive documentation page
 * - POST /api/v1/docs/:id/restore - Restore documentation page
 * - POST /api/v1/docs/reorder - Reorder pages within category
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { FastifyInstance } from 'fastify';

// ============================================================================
// Mock Setup
// ============================================================================

// Mock the documentation service
const mockDocService = {
  listPages: vi.fn(),
  getTableOfContents: vi.fn(),
  getPage: vi.fn(),
  getPageBySlug: vi.fn(),
  createPage: vi.fn(),
  updatePage: vi.fn(),
  deletePage: vi.fn(),
  publishPage: vi.fn(),
  unpublishPage: vi.fn(),
  archivePage: vi.fn(),
  restorePage: vi.fn(),
  reorderPages: vi.fn(),
};

vi.mock('../../../src/services/index.js', () => ({
  getDocumentationService: () => mockDocService,
}));

// Mock auth middleware
vi.mock('../../../src/middleware/auth.js', () => ({
  requireAuth: vi.fn((req: unknown, reply: unknown, done: () => void) => done()),
  getAuthContext: vi.fn(() => ({
    userId: 'test-user-id',
    tenantId: 'test-tenant-id',
    email: 'test@example.com',
  })),
}));

// ============================================================================
// Test Data Factories
// ============================================================================

function createMockDocPage(overrides: Record<string, unknown> = {}) {
  const now = new Date().toISOString();
  return {
    id: 'page-123',
    title: 'Test Page',
    slug: 'test-page',
    content: '# Test Page\n\nThis is test content.',
    category: 'user-guide',
    status: 'draft',
    order: 0,
    tags: ['test', 'documentation'],
    author: 'test@example.com',
    lastUpdated: now,
    createdAt: now,
    ...overrides,
  };
}

function createMockTableOfContents() {
  return {
    categories: [
      {
        category: 'user-guide',
        label: 'User Guide',
        items: [
          { id: 'page-1', title: 'Getting Started', slug: 'getting-started', order: 0 },
          { id: 'page-2', title: 'Configuration', slug: 'configuration', order: 1 },
        ],
      },
      {
        category: 'api-reference',
        label: 'API Reference',
        items: [
          { id: 'page-3', title: 'Authentication', slug: 'authentication', order: 0 },
        ],
      },
    ],
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Documentation Routes Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Dynamically import and build the test app
    // In real scenario, use buildTestApp from the project
    const fastify = await import('fastify');
    app = fastify.fastify({ logger: false });

    // Register routes
    const docsRoutes = await import('../../../src/routes/docs.js');
    await app.register(docsRoutes.default, { prefix: '/api/v1/docs' });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // List Documentation Pages Tests
  // ==========================================================================

  describe('GET /api/v1/docs', () => {
    it('should return list of documentation pages', async () => {
      const mockPages = [
        createMockDocPage({ id: 'page-1', title: 'Page 1' }),
        createMockDocPage({ id: 'page-2', title: 'Page 2' }),
      ];

      mockDocService.listPages.mockResolvedValue({
        data: mockPages,
        page: 1,
        pageSize: 20,
        total: 2,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination).toBeDefined();
      expect(body.pagination.total).toBe(2);
    });

    it('should support pagination parameters', async () => {
      mockDocService.listPages.mockResolvedValue({
        data: [],
        page: 2,
        pageSize: 10,
        total: 25,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs?page=2&pageSize=10',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      expect(mockDocService.listPages).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        { page: 2, pageSize: 10 }
      );
    });

    it('should support category filter', async () => {
      mockDocService.listPages.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs?category=api-reference',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      expect(mockDocService.listPages).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'api-reference' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should support status filter', async () => {
      mockDocService.listPages.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs?status=published',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      expect(mockDocService.listPages).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'published' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should support search parameter', async () => {
      mockDocService.listPages.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs?search=getting%20started',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      expect(mockDocService.listPages).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'getting started' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    it('should support sorting parameters', async () => {
      mockDocService.listPages.mockResolvedValue({
        data: [],
        page: 1,
        pageSize: 20,
        total: 0,
      });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs?sortBy=lastUpdated&sortOrder=desc',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      expect(mockDocService.listPages).toHaveBeenCalledWith(
        expect.any(Object),
        { field: 'lastUpdated', direction: 'desc' },
        expect.any(Object)
      );
    });
  });

  // ==========================================================================
  // Get Table of Contents Tests
  // ==========================================================================

  describe('GET /api/v1/docs/toc', () => {
    it('should return table of contents', async () => {
      const mockToc = createMockTableOfContents();
      mockDocService.getTableOfContents.mockResolvedValue(mockToc);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs/toc',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.categories).toBeDefined();
      expect(body.categories).toHaveLength(2);
      expect(body.lastUpdated).toBeDefined();
    });
  });

  // ==========================================================================
  // Get Documentation Page by ID Tests
  // ==========================================================================

  describe('GET /api/v1/docs/:id', () => {
    it('should return documentation page by ID', async () => {
      const mockPage = createMockDocPage();
      mockDocService.getPage.mockResolvedValue(mockPage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs/page-123',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.id).toBe('page-123');
      expect(body.title).toBe('Test Page');
    });

    it('should return 404 for non-existent page', async () => {
      mockDocService.getPage.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs/non-existent',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.error).toBe('Page not found');
    });
  });

  // ==========================================================================
  // Get Documentation Page by Slug Tests
  // ==========================================================================

  describe('GET /api/v1/docs/slug/:slug', () => {
    it('should return documentation page by slug', async () => {
      const mockPage = createMockDocPage();
      mockDocService.getPageBySlug.mockResolvedValue(mockPage);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs/slug/test-page',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.slug).toBe('test-page');
    });

    it('should return 404 for non-existent slug', async () => {
      mockDocService.getPageBySlug.mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/docs/slug/non-existent',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // Create Documentation Page Tests
  // ==========================================================================

  describe('POST /api/v1/docs', () => {
    it('should create a new documentation page', async () => {
      const newPage = createMockDocPage();
      mockDocService.createPage.mockResolvedValue({
        success: true,
        value: newPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: 'Test Page',
          content: '# Test\n\nContent here.',
          category: 'user-guide',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Test Page');
    });

    it('should return 400 for validation errors', async () => {
      mockDocService.createPage.mockResolvedValue({
        success: false,
        error: {
          message: 'Title is required',
          code: 'REQUIRED_FIELD',
          context: { field: 'title' },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: '',
          content: 'Content',
          category: 'user-guide',
        },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      // Fastify schema validation rejects before reaching service layer
      expect(body.code).toBe('FST_ERR_VALIDATION');
    });

    it('should create page with all optional fields', async () => {
      const newPage = createMockDocPage({
        slug: 'custom-slug',
        order: 5,
        parentId: 'parent-123',
        tags: ['tag1', 'tag2'],
      });
      mockDocService.createPage.mockResolvedValue({
        success: true,
        value: newPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: 'Test Page',
          content: 'Content',
          category: 'user-guide',
          slug: 'custom-slug',
          order: 5,
          parentId: 'parent-123',
          tags: ['tag1', 'tag2'],
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  // ==========================================================================
  // Update Documentation Page Tests
  // ==========================================================================

  describe('PUT /api/v1/docs/:id', () => {
    it('should update a documentation page', async () => {
      const updatedPage = createMockDocPage({ title: 'Updated Title' });
      mockDocService.updatePage.mockResolvedValue({
        success: true,
        value: updatedPage,
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/docs/page-123',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.title).toBe('Updated Title');
    });

    it('should return 404 for non-existent page', async () => {
      mockDocService.updatePage.mockResolvedValue({
        success: false,
        error: {
          message: 'Page not found',
          code: 'NOT_FOUND',
          context: { id: 'non-existent' },
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/docs/non-existent',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: 'Updated Title',
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 for validation errors', async () => {
      mockDocService.updatePage.mockResolvedValue({
        success: false,
        error: {
          message: 'Title cannot be empty',
          code: 'INVALID_VALUE',
          context: { field: 'title' },
        },
      });

      const response = await app.inject({
        method: 'PUT',
        url: '/api/v1/docs/page-123',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: '',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // Delete Documentation Page Tests
  // ==========================================================================

  describe('DELETE /api/v1/docs/:id', () => {
    it('should delete a documentation page', async () => {
      mockDocService.deletePage.mockResolvedValue(true);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/docs/page-123',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('should return 404 for non-existent page', async () => {
      mockDocService.deletePage.mockResolvedValue(false);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/v1/docs/non-existent',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ==========================================================================
  // Publish Documentation Page Tests
  // ==========================================================================

  describe('POST /api/v1/docs/:id/publish', () => {
    it('should publish a documentation page', async () => {
      const publishedPage = createMockDocPage({ status: 'published' });
      mockDocService.publishPage.mockResolvedValue({
        success: true,
        value: publishedPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/publish',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          publishedBy: 'admin@example.com',
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('published');
    });

    it('should return 404 for non-existent page', async () => {
      mockDocService.publishPage.mockResolvedValue({
        success: false,
        error: {
          message: 'Page not found',
          code: 'NOT_FOUND',
          context: { id: 'non-existent' },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/non-existent/publish',
        headers: { authorization: 'Bearer test-token' },
        payload: { publishedBy: 'test-user' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return 400 for invalid status transition', async () => {
      mockDocService.publishPage.mockResolvedValue({
        success: false,
        error: {
          message: 'Cannot publish archived page',
          code: 'INVALID_STATUS_TRANSITION',
          context: { currentStatus: 'archived', targetStatus: 'published' },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/publish',
        headers: { authorization: 'Bearer test-token' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // Unpublish Documentation Page Tests
  // ==========================================================================

  describe('POST /api/v1/docs/:id/unpublish', () => {
    it('should unpublish a documentation page', async () => {
      const unpublishedPage = createMockDocPage({ status: 'draft' });
      mockDocService.unpublishPage.mockResolvedValue({
        success: true,
        value: unpublishedPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/unpublish',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('draft');
    });
  });

  // ==========================================================================
  // Archive Documentation Page Tests
  // ==========================================================================

  describe('POST /api/v1/docs/:id/archive', () => {
    it('should archive a documentation page', async () => {
      const archivedPage = createMockDocPage({ status: 'archived' });
      mockDocService.archivePage.mockResolvedValue({
        success: true,
        value: archivedPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/archive',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('archived');
    });
  });

  // ==========================================================================
  // Restore Documentation Page Tests
  // ==========================================================================

  describe('POST /api/v1/docs/:id/restore', () => {
    it('should restore an archived documentation page', async () => {
      const restoredPage = createMockDocPage({ status: 'draft' });
      mockDocService.restorePage.mockResolvedValue({
        success: true,
        value: restoredPage,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/restore',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.status).toBe('draft');
    });

    it('should return 400 when restoring non-archived page', async () => {
      mockDocService.restorePage.mockResolvedValue({
        success: false,
        error: {
          message: 'Only archived pages can be restored',
          code: 'INVALID_STATUS_TRANSITION',
          context: { currentStatus: 'published' },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/page-123/restore',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // Reorder Pages Tests
  // ==========================================================================

  describe('POST /api/v1/docs/reorder', () => {
    it('should reorder pages within category', async () => {
      mockDocService.reorderPages.mockResolvedValue({
        success: true,
        value: undefined,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/reorder',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          category: 'user-guide',
          pageIds: ['page-3', 'page-1', 'page-2'],
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.success).toBe(true);
    });

    it('should return 400 for invalid category', async () => {
      mockDocService.reorderPages.mockResolvedValue({
        success: false,
        error: {
          message: 'Invalid category',
          code: 'INVALID_CATEGORY',
          context: { category: 'invalid' },
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/docs/reorder',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          category: 'invalid',
          pageIds: ['page-1'],
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ==========================================================================
  // Full Workflow Tests
  // ==========================================================================

  describe('Documentation Page Lifecycle', () => {
    it('should complete full page lifecycle: create -> publish -> archive -> restore', async () => {
      // Create
      const createdPage = createMockDocPage({ status: 'draft' });
      mockDocService.createPage.mockResolvedValue({
        success: true,
        value: createdPage,
      });

      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/v1/docs',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          title: 'Lifecycle Test Page',
          content: '# Test Content',
          category: 'tutorials',
        },
      });

      expect(createResponse.statusCode).toBe(201);

      // Publish
      const publishedPage = { ...createdPage, status: 'published' };
      mockDocService.publishPage.mockResolvedValue({
        success: true,
        value: publishedPage,
      });

      const publishResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/docs/${createdPage.id}/publish`,
        headers: { authorization: 'Bearer test-token' },
        payload: { publishedBy: 'admin@example.com' },
      });

      expect(publishResponse.statusCode).toBe(200);
      expect(publishResponse.json().status).toBe('published');

      // Archive
      const archivedPage = { ...publishedPage, status: 'archived' };
      mockDocService.archivePage.mockResolvedValue({
        success: true,
        value: archivedPage,
      });

      const archiveResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/docs/${createdPage.id}/archive`,
        headers: { authorization: 'Bearer test-token' },
      });

      expect(archiveResponse.statusCode).toBe(200);
      expect(archiveResponse.json().status).toBe('archived');

      // Restore
      const restoredPage = { ...archivedPage, status: 'draft' };
      mockDocService.restorePage.mockResolvedValue({
        success: true,
        value: restoredPage,
      });

      const restoreResponse = await app.inject({
        method: 'POST',
        url: `/api/v1/docs/${createdPage.id}/restore`,
        headers: { authorization: 'Bearer test-token' },
      });

      expect(restoreResponse.statusCode).toBe(200);
      expect(restoreResponse.json().status).toBe('draft');
    });
  });
});
