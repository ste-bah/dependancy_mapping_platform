/**
 * Test Setup Configuration
 * Global test configuration, mocks, and utilities
 * @module __tests__/setup
 */

import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { SetupServer } from 'msw/node';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';
import type { User, AuthTokens } from '@/types';

// ============================================================================
// Test Cleanup
// ============================================================================

afterEach(() => {
  cleanup();
});

// ============================================================================
// Mock Window Location
// ============================================================================

const originalLocation = window.location;

beforeAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...originalLocation,
      href: 'http://localhost:3000',
      pathname: '/',
      search: '',
      hash: '',
      assign: vi.fn(),
      replace: vi.fn(),
      reload: vi.fn(),
    },
  });
});

afterAll(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  });
});

// ============================================================================
// Mock localStorage
// ============================================================================

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get length() {
      return Object.keys(store).length;
    },
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

// ============================================================================
// Mock history.replaceState
// ============================================================================

const historyMock = {
  replaceState: vi.fn(),
  pushState: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  go: vi.fn(),
  length: 1,
  state: null,
  scrollRestoration: 'auto' as ScrollRestoration,
};

Object.defineProperty(window, 'history', {
  value: historyMock,
  writable: true,
});

// ============================================================================
// Mock Data Factories
// ============================================================================

/**
 * Create a mock user for testing
 */
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    avatarUrl: 'https://github.com/test.png',
    githubId: 12345,
    createdAt: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

/**
 * Create mock auth tokens for testing
 */
export function createMockTokens(overrides: Partial<AuthTokens> = {}): AuthTokens {
  return {
    accessToken: 'mock-access-token-xyz',
    refreshToken: 'mock-refresh-token-abc',
    expiresIn: 3600, // 1 hour
    tokenType: 'Bearer',
    ...overrides,
  };
}

/**
 * Create an expired token scenario
 */
export function createExpiredTokens(): AuthTokens {
  return {
    accessToken: 'expired-access-token',
    refreshToken: 'expired-refresh-token',
    expiresIn: -1, // Already expired
    tokenType: 'Bearer',
  };
}

// ============================================================================
// MSW Server Setup
// ============================================================================

const API_URL = '/api';

/**
 * Default MSW handlers for common API endpoints
 */
export const defaultHandlers = [
  // Auth callback - exchange code for tokens
  http.get(`${API_URL}/auth/github/callback`, ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get('code');

    if (code === 'valid-code') {
      return HttpResponse.json({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
    }

    if (code === 'invalid-code') {
      return HttpResponse.json(
        { message: 'Invalid authorization code', code: 'INVALID_CODE' },
        { status: 400 }
      );
    }

    return HttpResponse.json(
      { message: 'Code is required', code: 'BAD_REQUEST' },
      { status: 400 }
    );
  }),

  // Token refresh
  http.post(`${API_URL}/auth/refresh`, async ({ request }) => {
    const body = await request.json() as { refreshToken?: string };

    if (body.refreshToken === 'valid-refresh-token' || body.refreshToken === 'mock-refresh-token-abc') {
      return HttpResponse.json({
        accessToken: 'refreshed-access-token',
        refreshToken: 'refreshed-refresh-token',
        expiresIn: 3600,
        tokenType: 'Bearer',
      });
    }

    if (body.refreshToken === 'expired-refresh-token') {
      return HttpResponse.json(
        { message: 'Refresh token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    return HttpResponse.json(
      { message: 'Invalid refresh token', code: 'INVALID_TOKEN' },
      { status: 401 }
    );
  }),

  // Logout
  http.post(`${API_URL}/auth/logout`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Get current user
  http.get(`${API_URL}/auth/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return HttpResponse.json(
        { message: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    if (token === 'expired-access-token') {
      return HttpResponse.json(
        { message: 'Token expired', code: 'TOKEN_EXPIRED' },
        { status: 401 }
      );
    }

    return HttpResponse.json(createMockUser());
  }),
];

/**
 * Create and configure MSW server
 */
export function createMockServer(handlers = defaultHandlers): SetupServer {
  return setupServer(...handlers);
}

/**
 * Pre-configured MSW server with default handlers
 */
export const server = createMockServer();

// ============================================================================
// Server Lifecycle Hooks
// ============================================================================

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'warn' });
});

afterEach(() => {
  server.resetHandlers();
  localStorageMock.clear();
});

afterAll(() => {
  server.close();
});

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Wait for async state updates
 */
export async function waitForStateUpdate(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Mock URL with OAuth parameters
 */
export function setOAuthCallbackUrl(params: Record<string, string>): void {
  const searchParams = new URLSearchParams(params);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href: `http://localhost:3000/?${searchParams.toString()}`,
      search: `?${searchParams.toString()}`,
    },
  });
}

/**
 * Reset URL to default
 */
export function resetUrl(): void {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...window.location,
      href: 'http://localhost:3000/',
      search: '',
    },
  });
}

/**
 * Flush all pending promises
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

// ============================================================================
// Zustand Store Test Utilities
// ============================================================================

/**
 * Reset Zustand store state
 * Use this between tests to ensure clean state
 */
export function resetZustandStores(): void {
  localStorageMock.clear();
}

// ============================================================================
// Custom Matchers (optional extension)
// ============================================================================

// Add any custom matchers here if needed

// ============================================================================
// Re-exports
// ============================================================================

export { server as mswServer };
export { http, HttpResponse } from 'msw';
export { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
export { renderHook } from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';
