/**
 * Authentication Store
 * Zustand store for managing authentication state
 * @module core/auth/auth.store
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

// ============================================================================
// Store Implementation
// ============================================================================

/**
 * Auth store with persistence
 */
export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      /**
       * Set authentication tokens
       */
      setTokens: (tokens: AuthTokens) => {
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt: calculateExpiresAt(tokens.expiresIn),
          isAuthenticated: true,
          error: null,
        });
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
        const { refreshToken } = get();

        try {
          if (refreshToken) {
            await authService.logout();
          }
        } catch (error) {
          // Continue with logout even if API call fails
          console.error('Logout API error:', error);
        } finally {
          clearTokenCallbacks();
          get().reset();
        }
      },

      /**
       * Refresh access token using refresh token
       */
      refreshAccessToken: async (): Promise<boolean> => {
        const { refreshToken } = get();

        if (!refreshToken) {
          return false;
        }

        try {
          const tokens = await authService.refreshToken(refreshToken);
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

        // Check existing session
        const { accessToken, refreshToken, expiresAt } = store;

        if (!accessToken || !refreshToken) {
          set({ isLoading: false });
          return;
        }

        // If token is expired, try to refresh
        if (isTokenExpired(expiresAt)) {
          const refreshed = await store.refreshAccessToken();
          if (!refreshed) {
            set({ isLoading: false });
            return;
          }
        }

        // Fetch user profile
        try {
          const user = await authService.getCurrentUser();
          set({ user, isLoading: false });
        } catch (error) {
          console.error('Failed to fetch user:', error);
          store.reset();
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
    }),
    {
      name: 'code-reviewer-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

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
    // Clean up URL
    cleanupOAuthUrl();
    return true;
  }

  // Check for auth code (server-side flow will handle this)
  const code = searchParams.get('code');
  if (code) {
    try {
      store.setLoading(true);
      const tokens = await authService.exchangeCode(code);
      store.setTokens(tokens);

      const user = await authService.getCurrentUser();
      store.setUser(user);
      store.setLoading(false);

      // Clean up URL
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

  if (accessToken && refreshToken && expiresIn) {
    store.setTokens({
      accessToken,
      refreshToken,
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
