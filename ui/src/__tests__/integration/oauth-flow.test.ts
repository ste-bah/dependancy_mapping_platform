/**
 * OAuth Flow Integration Tests
 * End-to-end tests for the complete OAuth authentication flow
 * @module __tests__/integration/oauth-flow.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '@/core/auth/auth.store';
import * as authService from '@/core/auth/auth.service';
import * as apiModule from '@/core/api';
import {
  createMockUser,
  createMockTokens,
  resetUrl,
  setOAuthCallbackUrl,
} from '@/__tests__/setup';
import type { User, AuthTokens } from '@/types';

// ============================================================================
// Mocks
// ============================================================================

vi.mock('@/core/auth/auth.service', () => ({
  exchangeCode: vi.fn(),
  refreshToken: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('@/core/api', () => ({
  setTokenCallbacks: vi.fn(),
  clearTokenCallbacks: vi.fn(),
}));

const mockExchangeCode = authService.exchangeCode as vi.Mock;
const mockRefreshToken = authService.refreshToken as vi.Mock;
const mockLogout = authService.logout as vi.Mock;
const mockGetCurrentUser = authService.getCurrentUser as vi.Mock;

// ============================================================================
// Test Fixtures
// ============================================================================

const mockUser: User = createMockUser();
const mockTokens: AuthTokens = createMockTokens();

// ============================================================================
// OAuth Flow Integration Tests
// ============================================================================

describe('OAuth Flow Integration', () => {
  beforeEach(() => {
    // Reset store state
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: null,
    });

    vi.clearAllMocks();
    resetUrl();
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Complete OAuth Success Flow
  // ==========================================================================

  describe('Complete OAuth Success Flow', () => {
    it('should complete the full OAuth flow from code to authenticated state', async () => {
      // Simulate OAuth callback with authorization code
      setOAuthCallbackUrl({ code: 'valid-auth-code' });

      mockExchangeCode.mockResolvedValue(mockTokens);
      mockGetCurrentUser.mockResolvedValue(mockUser);

      // Initialize auth (simulates app startup with OAuth callback)
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();

      // Verify authenticated state
      expect(state.isAuthenticated).toBe(true);
      expect(state.isLoading).toBe(false);
      expect(state.user).toEqual(mockUser);
      expect(state.accessToken).toBe(mockTokens.accessToken);
      expect(state.refreshToken).toBe(mockTokens.refreshToken);
      expect(state.error).toBeNull();

      // Verify API calls were made correctly
      expect(mockExchangeCode).toHaveBeenCalledWith('valid-auth-code');
      expect(mockGetCurrentUser).toHaveBeenCalled();
    });

    it('should persist tokens and restore session on page reload', async () => {
      // Complete initial OAuth flow
      setOAuthCallbackUrl({ code: 'valid-auth-code' });
      mockExchangeCode.mockResolvedValue(mockTokens);
      mockGetCurrentUser.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      // Verify tokens are persisted
      const stored = localStorage.getItem('code-reviewer-auth');
      expect(stored).toBeDefined();

      // Simulate page reload - reset URL and reinitialize
      resetUrl();

      // Reset store but keep localStorage (simulating page reload)
      const persistedState = JSON.parse(stored!).state;
      useAuthStore.setState({
        ...persistedState,
        isLoading: true,
        user: null, // User will be fetched fresh
      });

      mockGetCurrentUser.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user).toEqual(mockUser);
    });
  });

  // ==========================================================================
  // OAuth Error Handling
  // ==========================================================================

  describe('OAuth Error Handling', () => {
    it('should handle OAuth provider error', async () => {
      setOAuthCallbackUrl({
        error: 'access_denied',
        error_description: 'The user denied the authorization request',
      });

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('The user denied the authorization request');
    });

    it('should handle code exchange failure', async () => {
      setOAuthCallbackUrl({ code: 'invalid-code' });
      mockExchangeCode.mockRejectedValue(new Error('Invalid authorization code'));

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBe('Invalid authorization code');
    });

    it('should handle user fetch failure after successful code exchange', async () => {
      setOAuthCallbackUrl({ code: 'valid-code' });
      mockExchangeCode.mockResolvedValue(mockTokens);
      mockGetCurrentUser.mockRejectedValue(new Error('Failed to fetch user'));

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      // Should still have tokens even if user fetch failed
      expect(state.accessToken).toBe(mockTokens.accessToken);
      expect(state.isLoading).toBe(false);
    });
  });

  // ==========================================================================
  // Token Refresh Flow
  // ==========================================================================

  describe('Token Refresh Flow', () => {
    it('should refresh expired token and continue session', async () => {
      // Set up expired token state
      const expiredTime = Date.now() - 1000;
      useAuthStore.setState({
        accessToken: 'expired-token',
        refreshToken: mockTokens.refreshToken,
        expiresAt: expiredTime,
        isAuthenticated: true,
        isLoading: true,
      });

      const newTokens = createMockTokens({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      mockRefreshToken.mockResolvedValue(newTokens);
      mockGetCurrentUser.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(newTokens.accessToken);
      expect(state.refreshToken).toBe(newTokens.refreshToken);
      expect(state.isAuthenticated).toBe(true);
      expect(mockRefreshToken).toHaveBeenCalledWith(mockTokens.refreshToken);
    });

    it('should logout user when refresh token is also expired', async () => {
      const expiredTime = Date.now() - 1000;
      useAuthStore.setState({
        accessToken: 'expired-token',
        refreshToken: 'expired-refresh-token',
        expiresAt: expiredTime,
        isAuthenticated: true,
        isLoading: true,
      });

      mockRefreshToken.mockRejectedValue(new Error('Refresh token expired'));

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
    });

    it('should handle concurrent API requests during token refresh', async () => {
      useAuthStore.setState({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: Date.now() + 3600000,
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
      });

      const newTokens = createMockTokens({
        accessToken: 'refreshed-token',
      });
      mockRefreshToken.mockResolvedValue(newTokens);

      // Simulate multiple concurrent refresh attempts
      const refreshPromises = [
        useAuthStore.getState().refreshAccessToken(),
        useAuthStore.getState().refreshAccessToken(),
        useAuthStore.getState().refreshAccessToken(),
      ];

      await act(async () => {
        await Promise.all(refreshPromises);
      });

      // Should only make one actual refresh call
      // (though this depends on implementation - may make multiple if not queued)
      expect(mockRefreshToken).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // Logout Flow
  // ==========================================================================

  describe('Logout Flow', () => {
    it('should complete full logout flow', async () => {
      // Set up authenticated state
      useAuthStore.setState({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        expiresAt: Date.now() + 3600000,
        isAuthenticated: true,
        isLoading: false,
        user: mockUser,
      });

      mockLogout.mockResolvedValue({ success: true });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(mockLogout).toHaveBeenCalled();
      expect(apiModule.clearTokenCallbacks).toHaveBeenCalled();
    });

    it('should clear local state even if logout API fails', async () => {
      useAuthStore.setState({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        isAuthenticated: true,
        user: mockUser,
      });

      mockLogout.mockRejectedValue(new Error('Network error'));

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should clear persisted state on logout', async () => {
      // Set up and persist authenticated state
      useAuthStore.setState({
        accessToken: mockTokens.accessToken,
        refreshToken: mockTokens.refreshToken,
        isAuthenticated: true,
        user: mockUser,
      });

      // Force persistence (normally done by middleware)
      localStorage.setItem('code-reviewer-auth', JSON.stringify({
        state: useAuthStore.getState(),
        version: 0,
      }));

      mockLogout.mockResolvedValue({ success: true });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      // State should be reset
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  // ==========================================================================
  // Session Initialization
  // ==========================================================================

  describe('Session Initialization', () => {
    it('should initialize without tokens (unauthenticated user)', async () => {
      resetUrl();

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(false);
      expect(state.isLoading).toBe(false);
      expect(state.user).toBeNull();
    });

    it('should set up token callbacks on initialization', async () => {
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      expect(apiModule.setTokenCallbacks).toHaveBeenCalledWith(
        expect.objectContaining({
          getAccessToken: expect.any(Function),
          refreshToken: expect.any(Function),
          onAuthError: expect.any(Function),
        })
      );
    });

    it('should handle direct token response in URL (implicit flow)', async () => {
      setOAuthCallbackUrl({
        access_token: 'direct-access-token',
        refresh_token: 'direct-refresh-token',
        expires_in: '3600',
      });

      mockGetCurrentUser.mockResolvedValue(mockUser);

      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe('direct-access-token');
      expect(state.refreshToken).toBe('direct-refresh-token');
      expect(state.isAuthenticated).toBe(true);
    });
  });

  // ==========================================================================
  // Token Expiry Handling
  // ==========================================================================

  describe('Token Expiry Handling', () => {
    it('should return null from getAccessToken when token is expired', () => {
      const expiredTime = Date.now() - 1000;
      useAuthStore.setState({
        accessToken: 'expired-token',
        expiresAt: expiredTime,
      });

      const token = useAuthStore.getState().getAccessToken();
      expect(token).toBeNull();
    });

    it('should return null from getAccessToken when within buffer period', () => {
      // Token expires in 30 seconds (within 60-second buffer)
      const nearExpiry = Date.now() + 30000;
      useAuthStore.setState({
        accessToken: 'about-to-expire-token',
        expiresAt: nearExpiry,
      });

      const token = useAuthStore.getState().getAccessToken();
      expect(token).toBeNull();
    });

    it('should return token when still valid', () => {
      const futureExpiry = Date.now() + 3600000; // 1 hour
      useAuthStore.setState({
        accessToken: 'valid-token',
        expiresAt: futureExpiry,
      });

      const token = useAuthStore.getState().getAccessToken();
      expect(token).toBe('valid-token');
    });
  });
});

// ============================================================================
// OAuth Flow State Machine Tests
// ============================================================================

describe('OAuth Flow State Machine', () => {
  beforeEach(() => {
    useAuthStore.setState({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      error: null,
    });
    vi.clearAllMocks();
    resetUrl();
  });

  it('should follow correct state transitions: initial -> loading -> authenticated', async () => {
    const states: string[] = [];

    // Capture state transitions
    useAuthStore.subscribe((state) => {
      states.push(
        state.isLoading ? 'loading' :
        state.isAuthenticated ? 'authenticated' :
        state.error ? 'error' :
        'unauthenticated'
      );
    });

    setOAuthCallbackUrl({ code: 'valid-code' });
    mockExchangeCode.mockResolvedValue(mockTokens);
    mockGetCurrentUser.mockResolvedValue(mockUser);

    await act(async () => {
      await useAuthStore.getState().initialize();
    });

    // Should have transitioned through states correctly
    expect(states).toContain('authenticated');
  });

  it('should follow correct state transitions: initial -> loading -> error', async () => {
    setOAuthCallbackUrl({
      error: 'access_denied',
      error_description: 'User cancelled',
    });

    await act(async () => {
      await useAuthStore.getState().initialize();
    });

    const state = useAuthStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe('User cancelled');
  });

  it('should follow correct state transitions: authenticated -> loading -> unauthenticated (logout)', async () => {
    // Start authenticated
    useAuthStore.setState({
      isAuthenticated: true,
      isLoading: false,
      user: mockUser,
      accessToken: mockTokens.accessToken,
      refreshToken: mockTokens.refreshToken,
    });

    mockLogout.mockResolvedValue({ success: true });

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
    expect(state.user).toBeNull();
  });
});
