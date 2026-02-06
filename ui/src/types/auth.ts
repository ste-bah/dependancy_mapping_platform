/**
 * Authentication Type Definitions
 * Types for user, session, and token management
 * @module types/auth
 */

// ============================================================================
// User Types
// ============================================================================

/**
 * User profile from the API
 */
export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  githubId: number;
  createdAt: string;
}

/**
 * Minimal user info for display
 */
export interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
}

// ============================================================================
// Token Types
// ============================================================================

/**
 * Authentication tokens from the API
 */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

/**
 * Decoded JWT token payload
 */
export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  avatarUrl?: string;
  githubId: number;
  tenantId?: string;
  iat: number;
  exp: number;
  iss?: string;
}

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session data stored in Redis (from backend)
 */
export interface Session {
  userId: string;
  refreshToken: string;
  userAgent?: string;
  ipAddress?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Client-side auth state
 */
export interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  error: string | null;
}

// ============================================================================
// Auth Request/Response Types
// ============================================================================

/**
 * Login response from OAuth callback
 */
export interface LoginResponse extends AuthTokens {
  user?: User;
}

/**
 * Refresh token request
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * Logout response
 */
export interface LogoutResponse {
  success: boolean;
}

// ============================================================================
// Auth Context Types
// ============================================================================

/**
 * Auth context for components
 */
export interface AuthContextValue extends AuthState {
  login: () => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  getAccessToken: () => string | null;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * OAuth provider type
 */
export type OAuthProvider = 'github' | 'gitlab' | 'bitbucket';

/**
 * Auth error types
 */
export type AuthErrorType =
  | 'invalid_credentials'
  | 'session_expired'
  | 'token_refresh_failed'
  | 'unauthorized'
  | 'network_error';

/**
 * Auth error with type
 */
export interface AuthError {
  type: AuthErrorType;
  message: string;
  originalError?: Error;
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if value is a User
 */
export function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value &&
    'name' in value &&
    'githubId' in value
  );
}

/**
 * Type guard to check if value contains auth tokens
 */
export function hasAuthTokens(value: unknown): value is AuthTokens {
  return (
    typeof value === 'object' &&
    value !== null &&
    'accessToken' in value &&
    'refreshToken' in value &&
    'expiresIn' in value &&
    'tokenType' in value
  );
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Check if token is expired or about to expire
 * @param expiresAt - Expiration timestamp in milliseconds
 * @param bufferSeconds - Buffer time before actual expiration (default 60s)
 */
export function isTokenExpired(expiresAt: number | null, bufferSeconds = 60): boolean {
  if (expiresAt === null) {
    return true;
  }
  const bufferMs = bufferSeconds * 1000;
  return Date.now() >= expiresAt - bufferMs;
}

/**
 * Calculate expiration timestamp from expiresIn seconds
 * @param expiresIn - Token lifetime in seconds
 */
export function calculateExpiresAt(expiresIn: number): number {
  return Date.now() + expiresIn * 1000;
}
