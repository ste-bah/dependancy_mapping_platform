/**
 * API Routes Re-export
 * @module routes/api
 *
 * Re-exports from index.ts for backward compatibility.
 * The main route registration is in index.ts.
 */

export {
  default,
  healthRoutes,
  authRoutes,
  apiKeyRoutes,
  repositoryRoutes,
  scanRoutes,
  graphRoutes,
  webhookRoutes,
  iacRepositoryRoutes,
} from './index.js';
