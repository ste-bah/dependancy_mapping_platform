/**
 * Core Module Index
 * Re-exports all core modules
 * @module core
 */

// API
export {
  apiClient,
  get,
  post,
  put,
  patch,
  del,
  setTokenCallbacks,
  clearTokenCallbacks,
  buildQueryString,
  isApiClientError,
  ApiClientError,
  type ApiConfig,
} from './api';

// Auth
export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
  exchangeCode,
  refreshToken,
  logout,
  getCurrentUser,
  parseTokenPayload,
  getTokenExpiration,
  isTokenExpiredFromString,
} from './auth';

// Router
export {
  router,
  ROUTES,
  AuthGuard,
  PublicOnlyGuard,
  OptionalAuth,
  withAuthGuard,
  withPublicOnlyGuard,
  type AppRoutes,
} from './router';
