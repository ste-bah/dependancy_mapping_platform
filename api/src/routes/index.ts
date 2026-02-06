/**
 * Route Registration
 * @module routes
 *
 * Central route registration for the API.
 * Registers all route plugins with appropriate prefixes.
 */

import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import apiKeyRoutes from './api-keys.js';
import repositoryRoutes from './repositories.js';

// IaC Dependency Detection Routes
import scanRoutes from './scans.js';
import graphRoutes from './graph.js';
import webhookRoutes from './webhooks.js';
import iacRepositoryRoutes from './repos.js';

// Cross-Repository Aggregation Routes (TASK-ROLLUP-001)
import rollupRoutes from './rollups.js';

// Graph Diff Computation Routes (TASK-ROLLUP-005)
import diffRoutes from './diffs.js';

// External Object Index Routes (TASK-ROLLUP-003)
import externalIndexRoutes from './external-index.js';

// Admin Routes (TASK-ROLLUP-004)
import adminRoutes from './admin/index.js';

// Security Audit Routes (TASK-SECURITY)
import securityAuditRoutes from './security-audit.js';

// Documentation System Routes (TASK-FINAL-004)
import docsRoutes from './docs.js';
import betaRoutes from './beta.js';
import launchRoutes from './launch.js';

/**
 * API routes plugin
 * Registers all application routes with optional prefix
 */
const routes: FastifyPluginAsync = async (fastify: FastifyInstance): Promise<void> => {
  // Register health check routes (no prefix, available at root)
  await fastify.register(healthRoutes);

  // Register authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Register API key management routes
  await fastify.register(apiKeyRoutes, { prefix: '/api/v1/api-keys' });

  // Register repository routes (GitHub integration)
  await fastify.register(repositoryRoutes, { prefix: '/api/v1/repositories' });

  // =========================================================================
  // IaC Dependency Detection API Routes
  // =========================================================================

  // Scan routes
  // POST /api/v1/scans - Start new scan
  // GET /api/v1/scans - List scans (paginated)
  // GET /api/v1/scans/:id - Get scan by ID
  // GET /api/v1/scans/:id/status - Get scan status/progress
  // DELETE /api/v1/scans/:id - Cancel scan
  await fastify.register(scanRoutes, { prefix: '/api/v1/scans' });

  // Graph routes (nested under scans)
  // GET /api/v1/scans/:scanId/graph - Get full dependency graph
  // GET /api/v1/scans/:scanId/nodes - List nodes (filtered)
  // GET /api/v1/scans/:scanId/nodes/:nodeId - Get node details
  // GET /api/v1/scans/:scanId/nodes/:nodeId/dependencies - Get downstream
  // GET /api/v1/scans/:scanId/nodes/:nodeId/dependents - Get upstream
  // GET /api/v1/scans/:scanId/edges - List edges
  // GET /api/v1/scans/:scanId/cycles - Detect cycles
  // POST /api/v1/scans/:scanId/impact - Impact analysis
  await fastify.register(graphRoutes, { prefix: '/api/v1/scans/:scanId' });

  // Webhook routes (for Git provider push events)
  // POST /api/v1/webhooks/github - GitHub push webhook
  // POST /api/v1/webhooks/gitlab - GitLab push webhook
  await fastify.register(webhookRoutes, { prefix: '/api/v1/webhooks' });

  // IaC managed repositories routes
  // GET /api/v1/iac/repositories - List managed repositories
  // POST /api/v1/iac/repositories - Add repository for scanning
  // GET /api/v1/iac/repositories/:id - Get managed repository by ID
  // PATCH /api/v1/iac/repositories/:id - Update managed repository settings
  // DELETE /api/v1/iac/repositories/:id - Remove repository from scanning
  await fastify.register(iacRepositoryRoutes, { prefix: '/api/v1/iac/repositories' });

  // =========================================================================
  // Cross-Repository Aggregation (Rollup) API Routes
  // TASK-ROLLUP-001: Cross-Repository Aggregation
  // =========================================================================

  // Rollup routes
  // POST /api/v1/rollups - Create rollup configuration
  // GET /api/v1/rollups - List rollups (paginated)
  // GET /api/v1/rollups/:rollupId - Get rollup by ID
  // PATCH /api/v1/rollups/:rollupId - Update rollup configuration
  // DELETE /api/v1/rollups/:rollupId - Delete rollup configuration
  // POST /api/v1/rollups/:rollupId/execute - Execute rollup aggregation
  // GET /api/v1/rollups/:rollupId/executions/:executionId - Get execution result
  // POST /api/v1/rollups/:rollupId/blast-radius - Compute blast radius
  // POST /api/v1/rollups/validate - Validate rollup configuration
  await fastify.register(rollupRoutes, { prefix: '/api/v1/rollups' });

  // =========================================================================
  // Graph Diff Computation API Routes
  // TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
  // =========================================================================

  // Diff routes
  // POST /api/v1/diffs - Compute or retrieve a graph diff
  // GET /api/v1/diffs - List diffs (paginated, filtered)
  // GET /api/v1/diffs/:diffId - Get diff by ID
  // DELETE /api/v1/diffs/:diffId - Delete a diff result
  // POST /api/v1/diffs/estimate - Estimate diff computation cost
  await fastify.register(diffRoutes, { prefix: '/api/v1/diffs' });

  // =========================================================================
  // External Object Index API Routes
  // TASK-ROLLUP-003: External Object Index with reverse lookup support
  // =========================================================================

  // External Index routes
  // GET /api/v1/external-index/lookup - Look up external object by identifier
  // POST /api/v1/external-index/lookup/batch - Batch lookup of external objects
  // GET /api/v1/external-index/scans/:scanId/nodes/:nodeId/external-objects - Reverse lookup
  // POST /api/v1/external-index/reverse-lookup/batch - Batch reverse lookup
  // GET /api/v1/external-index/objects - List external objects
  // POST /api/v1/external-index/search - Search external objects
  // GET /api/v1/external-index/objects/:externalObjectId - Get external object details
  // POST /api/v1/external-index/build - Trigger index build
  // GET /api/v1/external-index/builds - List build operations
  // GET /api/v1/external-index/builds/:buildId - Get build status
  // POST /api/v1/external-index/builds/:buildId/cancel - Cancel a running build
  // GET /api/v1/external-index/stats - Get index statistics
  // POST /api/v1/external-index/cache/clear - Clear the index cache
  // GET /api/v1/external-index/health - Health check for the index
  await fastify.register(externalIndexRoutes, { prefix: '/api/v1/external-index' });

  // =========================================================================
  // Admin API Routes
  // TASK-ROLLUP-004: Cache management and administration
  // =========================================================================

  // Admin routes (cache management)
  // GET  /api/admin/cache/stats          - Get cache statistics
  // POST /api/admin/cache/invalidate     - Manually invalidate cache entries
  // POST /api/admin/cache/warm           - Trigger cache warming
  // GET  /api/admin/cache/warming-jobs   - List warming job status
  await fastify.register(adminRoutes, { prefix: '/api/admin' });

  // =========================================================================
  // Security Audit API Routes
  // TASK-SECURITY: Security audit and compliance checking
  // =========================================================================

  // Security audit routes
  // GET  /api/v1/security/audit          - Get security audit report
  // POST /api/v1/security/audit/run      - Trigger new security audit
  // GET  /api/v1/security/dependencies   - Get dependency vulnerability report
  // POST /api/v1/security/compliance     - Check compliance against frameworks
  await fastify.register(securityAuditRoutes, { prefix: '/api/v1/security' });

  // =========================================================================
  // Documentation System API Routes
  // TASK-FINAL-004: Documentation, Beta Onboarding, Launch Readiness
  // =========================================================================

  // Documentation routes
  // GET  /api/v1/docs                    - List documentation pages
  // POST /api/v1/docs                    - Create documentation page
  // GET  /api/v1/docs/toc                - Get table of contents
  // GET  /api/v1/docs/:id                - Get documentation page by ID
  // GET  /api/v1/docs/slug/:slug         - Get documentation page by slug
  // PUT  /api/v1/docs/:id                - Update documentation page
  // DELETE /api/v1/docs/:id              - Delete documentation page
  // POST /api/v1/docs/:id/publish        - Publish documentation page
  // POST /api/v1/docs/:id/unpublish      - Unpublish documentation page
  // POST /api/v1/docs/:id/archive        - Archive documentation page
  // POST /api/v1/docs/:id/restore        - Restore documentation page
  // POST /api/v1/docs/reorder            - Reorder pages within category
  await fastify.register(docsRoutes, { prefix: '/api/v1/docs' });

  // Beta onboarding routes
  // GET  /api/v1/beta/customers          - List beta customers
  // POST /api/v1/beta/customers          - Register beta customer
  // GET  /api/v1/beta/customers/stats    - Get customer statistics
  // GET  /api/v1/beta/customers/:id      - Get customer by ID
  // GET  /api/v1/beta/customers/email/:email - Get customer by email
  // PUT  /api/v1/beta/customers/:id      - Update customer
  // DELETE /api/v1/beta/customers/:id    - Delete customer
  // POST /api/v1/beta/customers/:id/nda/sign    - Sign NDA
  // POST /api/v1/beta/customers/:id/nda/revoke  - Revoke NDA
  // POST /api/v1/beta/customers/:id/onboarding/start    - Start onboarding
  // POST /api/v1/beta/customers/:id/onboarding/complete - Complete onboarding
  // POST /api/v1/beta/customers/:id/churn       - Mark as churned
  // POST /api/v1/beta/customers/:id/reactivate  - Reactivate customer
  // POST /api/v1/beta/customers/:id/feedback    - Record feedback
  // POST /api/v1/beta/customers/:id/activity    - Record activity
  await fastify.register(betaRoutes, { prefix: '/api/v1/beta' });

  // Launch readiness routes
  // GET  /api/v1/launch/checklist        - Get launch checklist
  // POST /api/v1/launch/checklist/target-date   - Set target launch date
  // DELETE /api/v1/launch/checklist/target-date - Clear target launch date
  // GET  /api/v1/launch/items            - List checklist items
  // POST /api/v1/launch/items            - Create checklist item
  // GET  /api/v1/launch/items/:itemId    - Get checklist item
  // PUT  /api/v1/launch/items/:itemId    - Update checklist item
  // DELETE /api/v1/launch/items/:itemId  - Delete checklist item
  // POST /api/v1/launch/items/:itemId/complete   - Complete item
  // POST /api/v1/launch/items/:itemId/uncomplete - Uncomplete item
  // POST /api/v1/launch/items/:itemId/blocker    - Add blocker
  // DELETE /api/v1/launch/items/:itemId/blocker/:blockerId - Remove blocker
  // POST /api/v1/launch/items/bulk/complete  - Bulk complete items
  // POST /api/v1/launch/items/bulk/assign    - Bulk assign items
  // GET  /api/v1/launch/summary          - Get readiness summary
  // GET  /api/v1/launch/assessment       - Get readiness assessment
  // GET  /api/v1/launch/progress         - Get progress by category
  // GET  /api/v1/launch/blocked          - Get blocked items
  // GET  /api/v1/launch/overdue          - Get overdue items
  // GET  /api/v1/launch/critical         - Get critical items
  // POST /api/v1/launch/reset            - Reset checklist
  await fastify.register(launchRoutes, { prefix: '/api/v1/launch' });

  fastify.log.info('All routes registered');
};

export default routes;

// Export individual route modules for testing
export {
  healthRoutes,
  authRoutes,
  apiKeyRoutes,
  repositoryRoutes,
  scanRoutes,
  graphRoutes,
  webhookRoutes,
  iacRepositoryRoutes,
  rollupRoutes,
  diffRoutes,
  externalIndexRoutes,
  adminRoutes,
  securityAuditRoutes,
  docsRoutes,
  betaRoutes,
  launchRoutes,
};
