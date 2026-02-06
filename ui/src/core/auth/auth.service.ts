/**
 * Authentication Service
 * API calls for authentication operations
 * @module core/auth/auth.service
 */

import { apiClient } from '@/core/api';
import type { User, AuthTokens, LogoutResponse } from '@/types';

// ============================================================================
// API Endpoints
// ============================================================================

const AUTH_ENDPOINTS = {
  CALLBACK: '/auth/github/callback',
  REFRESH: '/auth/refresh',
  LOGOUT: '/auth/logout',
  ME: '/auth/me',
} as const;

// ============================================================================
// Authentication Functions
// ============================================================================

/**
 * Exchange OAuth code for tokens
 * @param code - Authorization code from OAuth callback
 */
export async function exchangeCode(code: string): Promise<AuthTokens> {
  const response = await apiClient.get<AuthTokens>(AUTH_ENDPOINTS.CALLBACK, {
    params: { code },
  });
  return response.data;
}

/**
 * Refresh access token
 * @param refreshToken - Current refresh token
 */
export async function refreshToken(refreshToken: string): Promise<AuthTokens> {
  const response = await apiClient.post<AuthTokens>(AUTH_ENDPOINTS.REFRESH, {
    refreshToken,
  });
  return response.data;
}

/**
 * Logout current user
 */
export async function logout(): Promise<LogoutResponse> {
  const response = await apiClient.post<LogoutResponse>(AUTH_ENDPOINTS.LOGOUT);
  return response.data;
}

/**
 * Get current user profile
 */
export async function getCurrentUser(): Promise<User> {
  const response = await apiClient.get<User>(AUTH_ENDPOINTS.ME);
  return response.data;
}

// ============================================================================
// Token Utilities
// ============================================================================

/**
 * Parse JWT token payload (without verification)
 * For display purposes only - actual verification happens server-side
 */
export function parseTokenPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1];
    if (!payload) {
      return null;
    }

    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Get token expiration time
 * @returns Expiration timestamp in milliseconds, or null if invalid
 */
export function getTokenExpiration(token: string): number | null {
  const payload = parseTokenPayload(token);
  if (!payload || typeof payload.exp !== 'number') {
    return null;
  }
  return payload.exp * 1000; // Convert to milliseconds
}

/**
 * Check if token is expired
 * @param token - JWT token
 * @param bufferSeconds - Buffer time before actual expiration
 */
export function isTokenExpiredFromString(token: string, bufferSeconds = 60): boolean {
  const exp = getTokenExpiration(token);
  if (exp === null) {
    return true;
  }
  const bufferMs = bufferSeconds * 1000;
  return Date.now() >= exp - bufferMs;
}
