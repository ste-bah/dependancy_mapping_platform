/**
 * Admin Routes
 * @module routes/admin
 *
 * Administrative API endpoints for system management.
 * All routes require admin authentication.
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import pino from 'pino';
import cacheAdminRoutes from './cache-routes.js';

const logger = pino({ name: 'admin-routes' });

/**
 * Admin routes plugin
 * Registers all administrative API endpoints under /api/admin
 */
const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Cache management routes
  // GET  /api/admin/cache/stats          - Get cache statistics
  // POST /api/admin/cache/invalidate     - Manually invalidate cache entries
  // POST /api/admin/cache/warm           - Trigger cache warming
  // GET  /api/admin/cache/warming-jobs   - List warming job status
  await fastify.register(cacheAdminRoutes, { prefix: '/cache' });

  logger.info('Admin routes registered');
};

export default adminRoutes;

// Export individual admin route modules for testing
export { cacheAdminRoutes };
