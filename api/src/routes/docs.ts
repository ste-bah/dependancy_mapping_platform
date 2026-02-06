/**
 * Documentation Routes
 * @module routes/docs
 *
 * REST API endpoints for documentation page management.
 * Implements CRUD operations for documentation pages, publishing,
 * and navigation structure.
 *
 * Endpoints:
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
 * TASK-FINAL-004: Documentation system routes implementation
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import { requireAuth, getAuthContext } from '../middleware/auth.js';
import { ForbiddenError, NotFoundError } from '../middleware/error-handler.js';
import { ErrorResponseSchema, createPaginationInfo } from './schemas/common.js';
import {
  CreateDocPageRequestSchema,
  UpdateDocPageRequestSchema,
  ListDocPagesQuerySchema,
  DocPageResponseSchema,
  DocPageListResponseSchema,
  PublishPageRequestSchema,
  ReorderPagesRequestSchema,
  ServiceErrorResponseSchema,
  IdParamSchema,
  type CreateDocPageRequest,
  type UpdateDocPageRequest,
  type ListDocPagesQuery,
  type PublishPageRequest,
  type ReorderPagesRequest,
  type IdParam,
} from './schemas/documentation.js';
import { DocTableOfContentsSchema } from '../types/documentation.js';
import { getDocumentationService } from '../services/index.js';
import { Result } from '../domain/documentation/index.js';

const logger = pino({ name: 'docs-routes' });

/**
 * Documentation routes plugin
 */
const docsRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  const docService = getDocumentationService();

  // ==========================================================================
  // List and Read Operations
  // ==========================================================================

  /**
   * GET /api/v1/docs - List documentation pages
   */
  fastify.get<{
    Querystring: ListDocPagesQuery;
  }>('/', {
    schema: {
      description: 'List documentation pages with filtering and pagination',
      tags: ['Documentation'],
      querystring: ListDocPagesQuerySchema,
      response: {
        200: DocPageListResponseSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const {
      page = 1,
      pageSize = 20,
      category,
      status,
      parentId,
      tags,
      search,
      sortBy = 'order',
      sortOrder = 'asc',
    } = request.query;

    logger.debug({ userId: auth.userId, page, pageSize, category }, 'Listing documentation pages');

    const result = await docService.listPages(
      {
        category,
        status,
        parentId,
        tags,
        search,
      },
      {
        field: sortBy as 'title' | 'lastUpdated' | 'createdAt' | 'order',
        direction: sortOrder as 'asc' | 'desc',
      },
      { page, pageSize }
    );

    return {
      data: result.data,
      pagination: createPaginationInfo(result.page, result.pageSize, result.total),
    };
  });

  /**
   * GET /api/v1/docs/toc - Get table of contents
   */
  fastify.get('/toc', {
    schema: {
      description: 'Get documentation table of contents',
      tags: ['Documentation'],
      response: {
        200: DocTableOfContentsSchema,
        401: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    logger.debug({ userId: auth.userId }, 'Getting table of contents');

    const toc = await docService.getTableOfContents();
    return toc;
  });

  /**
   * GET /api/v1/docs/:id - Get documentation page by ID
   */
  fastify.get<{
    Params: IdParam;
  }>('/:id', {
    schema: {
      description: 'Get documentation page by ID',
      tags: ['Documentation'],
      params: IdParamSchema,
      response: {
        200: DocPageResponseSchema,
        401: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.debug({ userId: auth.userId, pageId: id }, 'Getting documentation page');

    const page = await docService.getPage(id);
    if (!page) {
      return reply.status(404).send({ error: 'Page not found' });
    }

    return page;
  });

  /**
   * GET /api/v1/docs/slug/:slug - Get documentation page by slug
   */
  fastify.get<{
    Params: { slug: string };
  }>('/slug/:slug', {
    schema: {
      description: 'Get documentation page by slug',
      tags: ['Documentation'],
      params: {
        type: 'object',
        properties: {
          slug: { type: 'string', pattern: '^[a-z0-9-]+$' },
        },
        required: ['slug'],
      },
      response: {
        200: DocPageResponseSchema,
        401: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { slug } = request.params;

    logger.debug({ userId: auth.userId, slug }, 'Getting documentation page by slug');

    const page = await docService.getPageBySlug(slug);
    if (!page) {
      return reply.status(404).send({ error: 'Page not found' });
    }

    return page;
  });

  // ==========================================================================
  // Create and Update Operations
  // ==========================================================================

  /**
   * POST /api/v1/docs - Create documentation page
   */
  fastify.post<{
    Body: CreateDocPageRequest;
  }>('/', {
    schema: {
      description: 'Create a new documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      body: CreateDocPageRequestSchema,
      response: {
        201: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const dto = request.body;

    logger.info({ userId: auth.userId, title: dto.title, category: dto.category }, 'Creating documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.createPage({
      title: dto.title,
      content: dto.content,
      category: dto.category,
      slug: dto.slug,
      status: dto.status,
      order: dto.order,
      parentId: dto.parentId,
      tags: dto.tags,
      author: dto.author ?? auth.userId,
      metadata: dto.metadata,
    });

    if (Result.isErr(result)) {
      logger.warn({ error: result.error }, 'Failed to create documentation page');
      return reply.status(400).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: result.value.id }, 'Documentation page created');
    return reply.status(201).send(result.value);
  });

  /**
   * PUT /api/v1/docs/:id - Update documentation page
   */
  fastify.put<{
    Params: IdParam;
    Body: UpdateDocPageRequest;
  }>('/:id', {
    schema: {
      description: 'Update a documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: UpdateDocPageRequestSchema,
      response: {
        200: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const dto = request.body;

    logger.info({ userId: auth.userId, pageId: id, updates: Object.keys(dto) }, 'Updating documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.updatePage(id, dto);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: id }, 'Documentation page updated');
    return result.value;
  });

  /**
   * DELETE /api/v1/docs/:id - Delete documentation page
   */
  fastify.delete<{
    Params: IdParam;
  }>('/:id', {
    schema: {
      description: 'Delete a documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        204: { type: 'null' },
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, pageId: id }, 'Deleting documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const deleted = await docService.deletePage(id);

    if (!deleted) {
      return reply.status(404).send({ error: 'Page not found' });
    }

    logger.info({ pageId: id }, 'Documentation page deleted');
    return reply.status(204).send();
  });

  // ==========================================================================
  // Status Transition Operations
  // ==========================================================================

  /**
   * POST /api/v1/docs/:id/publish - Publish documentation page
   */
  fastify.post<{
    Params: IdParam;
    Body: PublishPageRequest;
  }>('/:id/publish', {
    schema: {
      description: 'Publish a documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      body: PublishPageRequestSchema,
      response: {
        200: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;
    const { publishedBy } = request.body;

    logger.info({ userId: auth.userId, pageId: id, publishedBy }, 'Publishing documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.publishPage(id, publishedBy);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: id }, 'Documentation page published');
    return result.value;
  });

  /**
   * POST /api/v1/docs/:id/unpublish - Unpublish documentation page
   */
  fastify.post<{
    Params: IdParam;
  }>('/:id/unpublish', {
    schema: {
      description: 'Unpublish a documentation page (return to draft)',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, pageId: id }, 'Unpublishing documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.unpublishPage(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: id }, 'Documentation page unpublished');
    return result.value;
  });

  /**
   * POST /api/v1/docs/:id/archive - Archive documentation page
   */
  fastify.post<{
    Params: IdParam;
  }>('/:id/archive', {
    schema: {
      description: 'Archive a documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, pageId: id }, 'Archiving documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.archivePage(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: id }, 'Documentation page archived');
    return result.value;
  });

  /**
   * POST /api/v1/docs/:id/restore - Restore documentation page
   */
  fastify.post<{
    Params: IdParam;
  }>('/:id/restore', {
    schema: {
      description: 'Restore an archived documentation page',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      params: IdParamSchema,
      response: {
        200: DocPageResponseSchema,
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ServiceErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { id } = request.params;

    logger.info({ userId: auth.userId, pageId: id }, 'Restoring documentation page');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.restorePage(id);

    if (Result.isErr(result)) {
      const statusCode = result.error.code === 'NOT_FOUND' ? 404 : 400;
      return reply.status(statusCode).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ pageId: id }, 'Documentation page restored');
    return result.value;
  });

  // ==========================================================================
  // Reordering Operations
  // ==========================================================================

  /**
   * POST /api/v1/docs/reorder - Reorder pages within category
   */
  fastify.post<{
    Body: ReorderPagesRequest;
  }>('/reorder', {
    schema: {
      description: 'Reorder documentation pages within a category',
      tags: ['Documentation'],
      security: [{ bearerAuth: [] }],
      body: ReorderPagesRequestSchema,
      response: {
        200: { type: 'object', properties: { success: { type: 'boolean' } } },
        400: ServiceErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
    },
    preHandler: [requireAuth],
  }, async (request, reply) => {
    const auth = getAuthContext(request);
    const { category, pageIds } = request.body;

    logger.info({ userId: auth.userId, category, pageIds }, 'Reordering documentation pages');

    const tenantId = auth.tenantId;
    if (!tenantId) {
      throw new ForbiddenError('Tenant context required');
    }

    const result = await docService.reorderPages(category, pageIds);

    if (Result.isErr(result)) {
      return reply.status(400).send({
        error: result.error.message,
        code: result.error.code,
        context: result.error.context,
      });
    }

    logger.info({ category }, 'Documentation pages reordered');
    return { success: true };
  });
};

export default docsRoutes;
