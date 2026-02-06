/**
 * Swagger/OpenAPI Documentation Plugin
 * @module plugins/swagger
 *
 * Configures OpenAPI 3.1.0 documentation with Swagger UI
 * for the Code-Reviewer API. Provides interactive API documentation
 * and schema generation for all endpoints.
 *
 * TASK-FINAL-004: Documentation and Beta Launch
 */

import { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import pino from 'pino';

const logger = pino({ name: 'swagger-plugin' });

// ============================================================================
// Types
// ============================================================================

/**
 * Swagger plugin configuration options
 */
export interface SwaggerPluginOptions {
  /**
   * Route prefix for the Swagger UI
   * @default '/docs'
   */
  routePrefix?: string;

  /**
   * Whether to expose the Swagger UI route
   * @default true
   */
  exposeRoute?: boolean;

  /**
   * Custom API title
   * @default 'Code-Reviewer API'
   */
  title?: string;

  /**
   * Custom API description
   */
  description?: string;

  /**
   * API version
   * @default '1.0.0'
   */
  version?: string;

  /**
   * Additional servers to include in the spec
   */
  additionalServers?: Array<{
    url: string;
    description: string;
  }>;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_OPTIONS: Required<Omit<SwaggerPluginOptions, 'additionalServers'>> & {
  additionalServers: SwaggerPluginOptions['additionalServers'];
} = {
  routePrefix: '/docs',
  exposeRoute: true,
  title: 'Code-Reviewer API',
  description: 'Dependency Mapping Platform API for managing infrastructure dependency graphs',
  version: '1.0.0',
  additionalServers: undefined,
};

// ============================================================================
// Plugin Implementation
// ============================================================================

/**
 * Swagger documentation plugin
 *
 * Registers @fastify/swagger with OpenAPI 3.1.0 configuration and
 * @fastify/swagger-ui for interactive documentation.
 *
 * @example
 * ```typescript
 * await app.register(swaggerPlugin, {
 *   routePrefix: '/api-docs',
 *   exposeRoute: true,
 * });
 * ```
 */
async function swaggerPlugin(
  fastify: FastifyInstance,
  options: SwaggerPluginOptions
): Promise<void> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Build servers list
  const servers = [
    {
      url: process.env.API_BASE_URL ?? 'http://localhost:3000',
      description: process.env.NODE_ENV === 'production'
        ? 'Production server'
        : 'Development server',
    },
  ];

  // Add production server if in development
  if (process.env.NODE_ENV !== 'production') {
    servers.push({
      url: 'https://api.code-reviewer.io',
      description: 'Production server',
    });
  }

  // Add any additional custom servers
  if (opts.additionalServers) {
    servers.push(...opts.additionalServers);
  }

  // Register swagger specification generator
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: opts.title,
        description: opts.description,
        version: opts.version,
        contact: {
          name: 'Code-Reviewer API Support',
          email: 'support@code-reviewer.io',
          url: 'https://github.com/org/code-reviewer',
        },
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
        },
        termsOfService: 'https://code-reviewer.io/terms',
      },
      externalDocs: {
        description: 'Full documentation',
        url: 'https://docs.code-reviewer.io',
      },
      servers,
      tags: [
        {
          name: 'Health',
          description: 'Health check and readiness endpoints',
        },
        {
          name: 'Auth',
          description: 'Authentication and authorization endpoints',
        },
        {
          name: 'API Keys',
          description: 'API key management for programmatic access',
        },
        {
          name: 'Repositories',
          description: 'Repository management and GitHub integration',
        },
        {
          name: 'Scans',
          description: 'Dependency scanning operations',
        },
        {
          name: 'Graphs',
          description: 'Dependency graph queries and analysis',
        },
        {
          name: 'Rollups',
          description: 'Cross-repository aggregation',
        },
        {
          name: 'Diffs',
          description: 'Graph diff computation',
        },
        {
          name: 'External Index',
          description: 'External object indexing and lookup',
        },
        {
          name: 'Webhooks',
          description: 'Git provider webhook handlers',
        },
        {
          name: 'Admin',
          description: 'Administrative operations',
        },
        {
          name: 'Security',
          description: 'Security audit and compliance',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token obtained from OAuth login flow. Include in Authorization header as: Bearer <token>',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-API-Key',
            description: 'API key for programmatic access. Obtain from /api/v1/api-keys endpoint.',
          },
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'session',
            description: 'Session cookie set after OAuth login',
          },
        },
        schemas: {
          // Common error response schema
          ErrorResponse: {
            type: 'object',
            required: ['statusCode', 'error', 'message'],
            properties: {
              statusCode: {
                type: 'integer',
                description: 'HTTP status code',
                example: 400,
              },
              error: {
                type: 'string',
                description: 'HTTP error name',
                example: 'Bad Request',
              },
              message: {
                type: 'string',
                description: 'Error message',
                example: 'Validation failed',
              },
              code: {
                type: 'string',
                description: 'Application error code',
                example: 'VALIDATION_ERROR',
              },
              details: {
                type: 'object',
                description: 'Additional error details',
                additionalProperties: true,
              },
              requestId: {
                type: 'string',
                description: 'Request ID for tracing',
                example: 'req-abc123',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'Error timestamp',
              },
            },
          },
          // Pagination metadata
          PaginationMeta: {
            type: 'object',
            required: ['page', 'pageSize', 'total', 'totalPages'],
            properties: {
              page: {
                type: 'integer',
                minimum: 1,
                description: 'Current page number',
                example: 1,
              },
              pageSize: {
                type: 'integer',
                minimum: 1,
                maximum: 100,
                description: 'Items per page',
                example: 20,
              },
              total: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of items',
                example: 150,
              },
              totalPages: {
                type: 'integer',
                minimum: 0,
                description: 'Total number of pages',
                example: 8,
              },
            },
          },
        },
        responses: {
          BadRequest: {
            description: 'Invalid request parameters',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          Unauthorized: {
            description: 'Authentication required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          Forbidden: {
            description: 'Insufficient permissions',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          NotFound: {
            description: 'Resource not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          Conflict: {
            description: 'Resource conflict',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          TooManyRequests: {
            description: 'Rate limit exceeded',
            headers: {
              'Retry-After': {
                schema: { type: 'integer' },
                description: 'Seconds to wait before retrying',
              },
            },
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
          InternalError: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
      security: [
        { bearerAuth: [] },
        { apiKey: [] },
        { cookieAuth: [] },
      ],
    },
  });

  // Register Swagger UI if enabled
  if (opts.exposeRoute) {
    await fastify.register(swaggerUi, {
      routePrefix: opts.routePrefix,
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        tryItOutEnabled: process.env.NODE_ENV !== 'production',
      },
      uiHooks: {
        onRequest: function (request, reply, next) {
          // Add any pre-request hooks here
          next();
        },
        preHandler: function (request, reply, next) {
          // Add any pre-handler hooks here
          next();
        },
      },
      staticCSP: true,
      transformStaticCSP: (header) => header,
      transformSpecification: (swaggerObject) => {
        // Add any runtime spec transformations here
        return swaggerObject;
      },
      transformSpecificationClone: true,
    });

    logger.info(
      { routePrefix: opts.routePrefix },
      'Swagger UI registered'
    );
  }

  // Add route to get raw OpenAPI JSON
  fastify.get('/openapi.json', {
    schema: {
      hide: true, // Hide from Swagger UI itself
    },
  }, async (_request, reply) => {
    return reply
      .type('application/json')
      .send(fastify.swagger());
  });

  // Add route to get raw OpenAPI YAML
  fastify.get('/openapi.yaml', {
    schema: {
      hide: true,
    },
  }, async (_request, reply) => {
    // Dynamic import for yaml since it might not always be needed
    const { stringify } = await import('yaml');
    const spec = fastify.swagger();
    return reply
      .type('application/x-yaml')
      .send(stringify(spec));
  });

  logger.info('Swagger documentation plugin initialized');
}

// ============================================================================
// Plugin Export
// ============================================================================

export default fp(swaggerPlugin, {
  name: 'swagger',
  fastify: '4.x',
  dependencies: [], // No dependencies - should be registered early
});

// ============================================================================
// Type Declarations
// ============================================================================

declare module 'fastify' {
  interface FastifyInstance {
    /**
     * Generate OpenAPI specification object
     */
    swagger: () => Record<string, unknown>;
  }
}
