/**
 * E2E Test Management Routes
 * @module e2e/api/routes
 *
 * REST API endpoints for E2E test management:
 * - POST /e2e/runs - Create test run
 * - GET /e2e/runs/:id - Get test run status
 * - GET /e2e/runs/:id/results - Get test results
 * - GET /e2e/runs - List test runs
 * - POST /e2e/fixtures - Load fixtures
 * - DELETE /e2e/cleanup - Cleanup test data
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #24 of 47 | Phase 4: Implementation
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import {
  CreateTestRunRequestSchema,
  TestRunResponseSchema,
  TestRunResultResponseSchema,
  TestRunListResponseSchema,
  LoadFixturesRequestSchema,
  LoadFixturesResponseSchema,
  CleanupRequestSchema,
  CleanupResultSchema,
  ErrorResponseSchema,
  TestRunIdParamSchema,
  ListTestRunsQuerySchema,
  type CreateTestRunRequest,
  type TestRunIdParam,
  type ListTestRunsQuery,
  type LoadFixturesRequest,
  type CleanupRequest,
} from './schemas.js';
import {
  createE2EHandlers,
  type HandlerDependencies,
  type E2EHandlers,
} from './handlers.js';
import type { TestDatabase } from '../domain/test-database.js';
import type { ITestOrchestrator } from '../services/test-orchestrator.js';
import type { ITestResultRepository } from '../data/test-result-repository.js';
import type { IFixtureRepository } from '../data/fixture-repository.js';
import type { ICleanupService } from '../data/cleanup.js';

const logger = pino({ name: 'e2e-routes' });

// ============================================================================
// Route Options
// ============================================================================

/**
 * E2E routes plugin options
 */
export interface E2ERoutesOptions {
  /** Test orchestrator instance */
  orchestrator?: ITestOrchestrator;
  /** Test result repository instance */
  resultRepository?: ITestResultRepository;
  /** Fixture repository instance */
  fixtureRepository?: IFixtureRepository;
  /** Cleanup service instance */
  cleanupService?: ICleanupService;
  /** Database instance for cleanup operations */
  database?: TestDatabase;
  /** Require authentication for routes */
  requireAuth?: boolean;
  /** Enable route documentation tags */
  enableDocs?: boolean;
}

// ============================================================================
// Route Registration
// ============================================================================

/**
 * E2E test management routes plugin
 */
const e2eRoutes: FastifyPluginAsync<E2ERoutesOptions> = async (
  fastify: FastifyInstance,
  options: E2ERoutesOptions = {}
): Promise<void> => {
  const {
    orchestrator,
    resultRepository,
    fixtureRepository,
    cleanupService,
    database,
    requireAuth = false,
    enableDocs = true,
  } = options;

  // Create handlers with dependencies
  const handlers = createE2EHandlers({
    orchestrator,
    resultRepository,
    fixtureRepository,
    cleanupService,
    database,
  });

  // Common tags for OpenAPI documentation
  const tags = enableDocs ? ['E2E Tests'] : undefined;

  // ============================================================================
  // Test Run Routes
  // ============================================================================

  /**
   * POST /e2e/runs - Create and start a new test run
   */
  fastify.post<{
    Body: CreateTestRunRequest;
  }>('/', {
    schema: {
      description: 'Create and start a new E2E test run',
      tags,
      body: CreateTestRunRequestSchema,
      response: {
        201: TestRunResponseSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    logger.info({ suites: request.body.suites.length }, 'Creating new test run');

    try {
      const result = await handlers.createTestRun(request, reply);
      logger.info({ runId: result.id }, 'Test run created');
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to create test run');
      throw error;
    }
  });

  /**
   * GET /e2e/runs - List test runs
   */
  fastify.get<{
    Querystring: ListTestRunsQuery;
  }>('/', {
    schema: {
      description: 'List E2E test runs with filtering and pagination',
      tags,
      querystring: ListTestRunsQuerySchema,
      response: {
        200: TestRunListResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { page, pageSize, status } = request.query;
    logger.debug({ page, pageSize, status }, 'Listing test runs');

    try {
      return await handlers.listTestRuns(request, reply);
    } catch (error) {
      logger.error({ error }, 'Failed to list test runs');
      throw error;
    }
  });

  /**
   * GET /e2e/runs/:id - Get test run status
   */
  fastify.get<{
    Params: TestRunIdParam;
  }>('/:id', {
    schema: {
      description: 'Get test run status and progress',
      tags,
      params: TestRunIdParamSchema,
      response: {
        200: TestRunResponseSchema,
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    logger.debug({ runId: id }, 'Getting test run status');

    try {
      return await handlers.getTestRun(request, reply);
    } catch (error) {
      logger.error({ error, runId: id }, 'Failed to get test run');
      throw error;
    }
  });

  /**
   * GET /e2e/runs/:id/results - Get detailed test results
   */
  fastify.get<{
    Params: TestRunIdParam;
  }>('/:id/results', {
    schema: {
      description: 'Get detailed test results for a completed run',
      tags,
      params: TestRunIdParamSchema,
      response: {
        200: TestRunResultResponseSchema,
        202: ErrorResponseSchema, // In progress
        401: ErrorResponseSchema,
        404: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    logger.debug({ runId: id }, 'Getting test run results');

    try {
      return await handlers.getTestRunResults(request, reply);
    } catch (error) {
      logger.error({ error, runId: id }, 'Failed to get test run results');
      throw error;
    }
  });

  logger.info('Test run routes registered');
};

/**
 * E2E fixture routes plugin
 */
const fixtureRoutes: FastifyPluginAsync<E2ERoutesOptions> = async (
  fastify: FastifyInstance,
  options: E2ERoutesOptions = {}
): Promise<void> => {
  const { fixtureRepository, enableDocs = true } = options;

  const handlers = createE2EHandlers({
    fixtureRepository,
  });

  const tags = enableDocs ? ['E2E Fixtures'] : undefined;

  /**
   * POST /e2e/fixtures - Load test fixtures
   */
  fastify.post<{
    Body: LoadFixturesRequest;
  }>('/', {
    schema: {
      description: 'Load test fixtures into the test environment',
      tags,
      body: LoadFixturesRequestSchema,
      response: {
        201: LoadFixturesResponseSchema,
        207: LoadFixturesResponseSchema, // Partial success
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const fixtureCount = request.body.fixtures.length;
    logger.info({ fixtureCount }, 'Loading fixtures');

    try {
      const result = await handlers.loadFixtures(request, reply);
      logger.info({ loaded: result.loaded, errors: result.errors?.length ?? 0 }, 'Fixtures loaded');
      return result;
    } catch (error) {
      logger.error({ error }, 'Failed to load fixtures');
      throw error;
    }
  });

  logger.info('Fixture routes registered');
};

/**
 * E2E cleanup routes plugin
 */
const cleanupRoutes: FastifyPluginAsync<E2ERoutesOptions> = async (
  fastify: FastifyInstance,
  options: E2ERoutesOptions = {}
): Promise<void> => {
  const {
    resultRepository,
    fixtureRepository,
    cleanupService,
    database,
    enableDocs = true,
  } = options;

  const handlers = createE2EHandlers({
    resultRepository,
    fixtureRepository,
    cleanupService,
    database,
  });

  const tags = enableDocs ? ['E2E Cleanup'] : undefined;

  /**
   * DELETE /e2e/cleanup - Clean up test data
   */
  fastify.delete<{
    Body: CleanupRequest;
  }>('/', {
    schema: {
      description: 'Clean up E2E test data',
      tags,
      body: CleanupRequestSchema,
      response: {
        200: CleanupResultSchema,
        207: CleanupResultSchema, // Partial success
        401: ErrorResponseSchema,
        500: ErrorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { scope, dryRun } = request.body;
    logger.info({ scope, dryRun }, 'Starting cleanup');

    try {
      const result = await handlers.cleanup(request, reply);
      logger.info({ deleted: result.deleted, duration: result.duration }, 'Cleanup complete');
      return result;
    } catch (error) {
      logger.error({ error }, 'Cleanup failed');
      throw error;
    }
  });

  logger.info('Cleanup routes registered');
};

// ============================================================================
// Combined Routes Plugin
// ============================================================================

/**
 * All E2E routes combined
 */
const allE2ERoutes: FastifyPluginAsync<E2ERoutesOptions> = async (
  fastify: FastifyInstance,
  options: E2ERoutesOptions = {}
): Promise<void> => {
  // Register test run routes at /runs
  await fastify.register(e2eRoutes, { ...options, prefix: '/runs' });

  // Register fixture routes at /fixtures
  await fastify.register(fixtureRoutes, { ...options, prefix: '/fixtures' });

  // Register cleanup routes at /cleanup
  await fastify.register(cleanupRoutes, { ...options, prefix: '/cleanup' });

  logger.info('All E2E routes registered');
};

export default allE2ERoutes;

// Export individual route plugins for granular registration
export {
  e2eRoutes,
  fixtureRoutes,
  cleanupRoutes,
  type E2ERoutesOptions,
};

// ============================================================================
// OpenAPI Documentation
// ============================================================================

/**
 * Generate OpenAPI specification for E2E routes
 */
export function getE2EOpenAPISpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'E2E Test Management API',
      version: '1.0.0',
      description: 'REST API for managing E2E test execution, fixtures, and cleanup',
    },
    servers: [
      {
        url: '/api/v1/e2e',
        description: 'E2E Test API',
      },
    ],
    tags: [
      {
        name: 'E2E Tests',
        description: 'Test run management operations',
      },
      {
        name: 'E2E Fixtures',
        description: 'Test fixture management operations',
      },
      {
        name: 'E2E Cleanup',
        description: 'Test data cleanup operations',
      },
    ],
    paths: {
      '/runs': {
        post: {
          summary: 'Create test run',
          tags: ['E2E Tests'],
          operationId: 'createTestRun',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CreateTestRunRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Test run created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TestRunResponse' },
                },
              },
            },
          },
        },
        get: {
          summary: 'List test runs',
          tags: ['E2E Tests'],
          operationId: 'listTestRuns',
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 20 } },
            { name: 'status', in: 'query', schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'List of test runs',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TestRunListResponse' },
                },
              },
            },
          },
        },
      },
      '/runs/{id}': {
        get: {
          summary: 'Get test run status',
          tags: ['E2E Tests'],
          operationId: 'getTestRun',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Test run status',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TestRunResponse' },
                },
              },
            },
            '404': {
              description: 'Test run not found',
            },
          },
        },
      },
      '/runs/{id}/results': {
        get: {
          summary: 'Get test run results',
          tags: ['E2E Tests'],
          operationId: 'getTestRunResults',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'Test run results',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/TestRunResultResponse' },
                },
              },
            },
            '202': {
              description: 'Test run still in progress',
            },
            '404': {
              description: 'Test run not found',
            },
          },
        },
      },
      '/fixtures': {
        post: {
          summary: 'Load fixtures',
          tags: ['E2E Fixtures'],
          operationId: 'loadFixtures',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LoadFixturesRequest' },
              },
            },
          },
          responses: {
            '201': {
              description: 'Fixtures loaded',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/LoadFixturesResponse' },
                },
              },
            },
          },
        },
      },
      '/cleanup': {
        delete: {
          summary: 'Clean up test data',
          tags: ['E2E Cleanup'],
          operationId: 'cleanup',
          requestBody: {
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/CleanupRequest' },
              },
            },
          },
          responses: {
            '200': {
              description: 'Cleanup complete',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CleanupResult' },
                },
              },
            },
          },
        },
      },
    },
  };
}
