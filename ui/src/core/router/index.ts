/**
 * Router Module Index
 * Re-exports router configuration and guards
 * @module core/router
 */

export { router, ROUTES, type AppRoutes } from './routes';

export {
  AuthGuard,
  PublicOnlyGuard,
  OptionalAuth,
  withAuthGuard,
  withPublicOnlyGuard,
} from './AuthGuard';
