/**
 * Authentication Store
 * Zustand store for managing authentication state
 * @module core/auth/auth.store
 */

import { create } from 'zustand';
import type { User, AuthState, AuthTokens } from '@/types';
import { calculateExpiresAt, isTokenExpired } from '@/types';
import { setTokenCallbacks, clearTokenCallbacks } from '@/core/api';
import * as authService from './auth.service';

// ============================================================================
// Store Types
// ============================================================================

/**
 * Auth store state and actions
 */
interface AuthStore extends AuthState {
  // Actions
  setTokens: (tokens: AuthTokens) => void;
  setUser: (user: User) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  login: () => void;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<boolean>;
  getAccessToken: () => string | null;
  initialize: () => Promise<void>;
  reset: () => void;
}

// ============================================================================
// Initial State
// ============================================================================

const initialState: AuthState = {
  isAuthenticated: false,
  isLoading: true,
  user: null,
  accessToken: null,
  refreshToken: null,
  expiresAt: null,
  error: null,
};

let initializePromise: Promise<void> | null = null;

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Auth store keeping access tokens in memory only.
 * Refresh tokens are expected to be delivered via secure cookies.
 */
export const useAuthStore = create<AuthStore>()((set, get) => ({
  ...initialState,

  /**
   * Set authentication tokens
   */
  setTokens: (tokens: AuthTokens) => {
    set((state) => ({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? state.refreshToken,
      expiresAt: calculateExpiresAt(tokens.expiresIn),
      isAuthenticated: true,
      error: null,
    }));
  },

  /**
   * Set current user
   */
  setUser: (user: User) => {
    set({ user });
  },

  /**
   * Set loading state
   */
  setLoading: (isLoading: boolean) => {
    set({ isLoading });
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * Initiate GitHub OAuth login
   */
  login: () => {
    const apiUrl = import.meta.env.VITE_API_URL ?? '';
    window.location.href = `${apiUrl}/auth/github`;
  },

  /**
   * Logout user
   */
  logout: async () => {
    try {
      await authService.logout();
    } catch (error) {
      // Continue with logout even if API call fails
      console.error('Logout API error:', error);
    } finally {
      clearTokenCallbacks();
      get().reset();
    }
  },

  /**
   * Refresh access token using the refresh cookie
   */
  refreshAccessToken: async (): Promise<boolean> => {
    try {
      const tokens = await authService.refreshToken();
      get().setTokens(tokens);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      get().reset();
      return false;
    }
  },

  /**
   * Get current access token if valid
   */
  getAccessToken: (): string | null => {
    const { accessToken, expiresAt } = get();

    if (!accessToken || isTokenExpired(expiresAt)) {
      return null;
    }

    return accessToken;
  },

  /**
   * Initialize auth state on app start
   */
  initialize: async () => {
    if (initializePromise) {
      return initializePromise;
    }

    initializePromise = (async () => {
      const store = get();

      // Set up token callbacks for API client
      setTokenCallbacks({
        getAccessToken: store.getAccessToken,
        refreshToken: store.refreshAccessToken,
        onAuthError: store.reset,
      });

      // Check for OAuth callback (tokens in URL or hash)
      const handled = await handleOAuthCallback(store);
      if (handled) {
        return;
      }

      const { accessToken, expiresAt } = get();

      // Restore the in-memory access token from the refresh cookie when needed
      if (!accessToken || isTokenExpired(expiresAt)) {
        const refreshed = await store.refreshAccessToken();
        if (!refreshed) {
          set({ isLoading: false });
          return;
        }
      }

      // Fetch user profile
      try {
        const user = await authService.getCurrentUser();
        set({ user, isAuthenticated: true, isLoading: false, error: null });
      } catch (error) {
        console.error('Failed to fetch user:', error);
        store.reset();
      }
    })();

    try {
      await initializePromise;
    } finally {
      initializePromise = null;
    }
  },

  /**
   * Reset to initial state
   */
  reset: () => {
    set({
      ...initialState,
      isLoading: false,
    });
  },
}));

// ============================================================================
// OAuth Callback Handler
// ============================================================================

/**
 * Handle OAuth callback from GitHub
 * Looks for tokens in URL query params or hash
 */
async function handleOAuthCallback(store: AuthStore): Promise<boolean> {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;

  // Check for error from OAuth
  const error = searchParams.get('error');
  if (error) {
    const errorDescription = searchParams.get('error_description') ?? 'Authentication failed';
    store.setError(errorDescription);
    store.setLoading(false);
    cleanupOAuthUrl();
    return true;
  }

  // Check for auth code (server-side flow will handle this)
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (code) {
    if (!state) {
      store.setError('Missing OAuth state parameter');
      store.setLoading(false);
      cleanupOAuthUrl();
      return true;
    }

    try {
      store.setLoading(true);
      const tokens = await authService.exchangeCode(code, state);
      store.setTokens(tokens);

      const user = await authService.getCurrentUser();
      store.setUser(user);
      store.setLoading(false);

      cleanupOAuthUrl();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      store.setError(message);
      store.setLoading(false);
      cleanupOAuthUrl();
      return true;
    }
  }

  // Check for tokens directly in response (if using implicit flow)
  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  const expiresIn = searchParams.get('expires_in');

  if (accessToken && expiresIn) {
    store.setTokens({
      accessToken,
      refreshToken: refreshToken ?? undefined,
      expiresIn: parseInt(expiresIn, 10),
      tokenType: 'Bearer',
    });

    try {
      const user = await authService.getCurrentUser();
      store.setUser(user);
    } catch (err) {
      console.error('Failed to fetch user after OAuth:', err);
    }

    store.setLoading(false);
    cleanupOAuthUrl();
    return true;
  }

  return false;
}

/**
 * Remove OAuth params from URL
 */
function cleanupOAuthUrl(): void {
  const url = new URL(window.location.href);
  const paramsToRemove = [
    'code',
    'state',
    'access_token',
    'refresh_token',
    'expires_in',
    'token_type',
    'error',
    'error_description',
  ];

  paramsToRemove.forEach((param) => {
    url.searchParams.delete(param);
  });

  // Update URL without reload
  window.history.replaceState({}, document.title, url.pathname + url.search);
}

// ============================================================================
// Selectors
// ============================================================================

/**
 * Select user from store
 */
export const selectUser = (state: AuthStore): User | null => state.user;

/**
 * Select authentication status
 */
export const selectIsAuthenticated = (state: AuthStore): boolean => state.isAuthenticated;

/**
 * Select loading state
 */
export const selectIsLoading = (state: AuthStore): boolean => state.isLoading;

/**
 * Select error message
 */
export const selectError = (state: AuthStore): string | null => state.error;
