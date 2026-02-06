/**
 * Authentication Module Index
 * Re-exports auth store and service
 * @module core/auth
 */

// Store
export {
  useAuthStore,
  selectUser,
  selectIsAuthenticated,
  selectIsLoading,
  selectError,
} from './auth.store';

// Service
export {
  exchangeCode,
  refreshToken,
  logout,
  getCurrentUser,
  parseTokenPayload,
  getTokenExpiration,
  isTokenExpiredFromString,
} from './auth.service';
