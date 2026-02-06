/**
 * Route Schemas Module Index
 * @module routes/schemas
 *
 * Central export for all route schemas.
 */

// Common schemas
export * from './common.js';

// Domain-specific schemas
export * from './scan.js';
export * from './graph.js';
export * from './webhook.js';
export * from './repository.js';
export * from './rollup.js';
export * from './external-index.js';
export * from './cache.js';

// Diff schemas - Note: Uses DiffRouteSchema to avoid conflict with RouteSchema
export * from './diff.js';

// Security audit schemas (TASK-SECURITY)
export * from './security-audit.js';

// Documentation system schemas (TASK-FINAL-004)
export * from './documentation.js';
