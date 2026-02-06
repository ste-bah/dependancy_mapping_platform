/**
 * API Client Unit Tests
 * Comprehensive tests for Axios-based HTTP client with interceptors
 * @module core/api/__tests__/client.test
 */

import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest';
import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  apiClient,
  get,
  post,
  put,
  patch,
  del,
  setTokenCallbacks,
  clearTokenCallbacks,
  ApiClientError,
  isApiClientError,
  buildQueryString,
} from '../client';

// ============================================================================
// Test Setup
// ============================================================================

describe('API Client', () => {
  let mockAxios: MockAdapter;
  let mockGetAccessToken: Mock<[], string | null>;
  let mockRefreshToken: Mock<[], Promise<boolean>>;
  let mockOnAuthError: Mock<[], void>;

  beforeEach(() => {
    mockAxios = new MockAdapter(apiClient);
    mockGetAccessToken = vi.fn();
    mockRefreshToken = vi.fn();
    mockOnAuthError = vi.fn();

    // Set up default token callbacks
    setTokenCallbacks({
      getAccessToken: mockGetAccessToken,
      refreshToken: mockRefreshToken,
      onAuthError: mockOnAuthError,
    });
  });

  afterEach(() => {
    mockAxios.reset();
    clearTokenCallbacks();
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Request Interceptor Tests
  // ==========================================================================

  describe('Request Interceptor', () => {
    it('should add Authorization header when token is available', async () => {
      const token = 'valid-access-token';
      mockGetAccessToken.mockReturnValue(token);
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await get('/test');

      const request = mockAxios.history.get[0];
      expect(request?.headers?.Authorization).toBe(`Bearer ${token}`);
    });

    it('should not add Authorization header when token is null', async () => {
      mockGetAccessToken.mockReturnValue(null);
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await get('/test');

      const request = mockAxios.history.get[0];
      expect(request?.headers?.Authorization).toBeUndefined();
    });

    it('should include Content-Type header', async () => {
      mockGetAccessToken.mockReturnValue(null);
      mockAxios.onPost('/test').reply(200, { data: 'success' });

      await post('/test', { key: 'value' });

      const request = mockAxios.history.post[0];
      expect(request?.headers?.['Content-Type']).toBe('application/json');
    });
  });

  // ==========================================================================
  // Response Interceptor Tests
  // ==========================================================================

  describe('Response Interceptor', () => {
    it('should pass through successful responses', async () => {
      mockGetAccessToken.mockReturnValue('token');
      mockAxios.onGet('/test').reply(200, { message: 'success' });

      const result = await get<{ message: string }>('/test');

      expect(result).toEqual({ message: 'success' });
    });

    it('should transform server errors to ApiClientError', async () => {
      mockGetAccessToken.mockReturnValue('token');
      mockAxios.onGet('/test').reply(400, {
        message: 'Bad request',
        code: 'BAD_REQUEST',
      });

      await expect(get('/test')).rejects.toThrow(ApiClientError);

      try {
        await get('/test');
      } catch (error) {
        expect(isApiClientError(error)).toBe(true);
        if (isApiClientError(error)) {
          expect(error.statusCode).toBe(400);
          expect(error.code).toBe('BAD_REQUEST');
          expect(error.message).toBe('Bad request');
        }
      }
    });

    it('should handle network errors', async () => {
      mockGetAccessToken.mockReturnValue('token');
      mockAxios.onGet('/test').networkError();

      await expect(get('/test')).rejects.toThrow(ApiClientError);

      try {
        await get('/test');
      } catch (error) {
        if (isApiClientError(error)) {
          expect(error.isNetworkError).toBe(true);
          expect(error.statusCode).toBe(0);
        }
      }
    });

    it('should handle timeout errors', async () => {
      mockGetAccessToken.mockReturnValue('token');
      mockAxios.onGet('/test').timeout();

      await expect(get('/test')).rejects.toThrow(ApiClientError);

      try {
        await get('/test');
      } catch (error) {
        if (isApiClientError(error)) {
          expect(error.isTimeout).toBe(true);
          expect(error.code).toBe('TIMEOUT');
        }
      }
    });
  });

  // ==========================================================================
  // 401 Handling and Token Refresh Tests
  // ==========================================================================

  describe('401 Handling and Token Refresh', () => {
    it('should attempt token refresh on 401 response', async () => {
      mockGetAccessToken.mockReturnValue('expired-token');
      mockRefreshToken.mockResolvedValue(true);

      // First call returns 401, second (after refresh) returns 200
      mockAxios
        .onGet('/test')
        .replyOnce(401, { message: 'Token expired' })
        .onGet('/test')
        .replyOnce(200, { data: 'success' });

      // After refresh, return new token
      mockGetAccessToken
        .mockReturnValueOnce('expired-token')
        .mockReturnValue('new-token');

      const result = await get<{ data: string }>('/test');

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(result).toEqual({ data: 'success' });
    });

    it('should call onAuthError when refresh fails', async () => {
      mockGetAccessToken.mockReturnValue('expired-token');
      mockRefreshToken.mockResolvedValue(false);

      mockAxios.onGet('/test').reply(401, { message: 'Token expired' });

      await expect(get('/test')).rejects.toThrow();

      expect(mockRefreshToken).toHaveBeenCalled();
      expect(mockOnAuthError).toHaveBeenCalled();
    });

    it('should call onAuthError when refresh throws', async () => {
      mockGetAccessToken.mockReturnValue('expired-token');
      mockRefreshToken.mockRejectedValue(new Error('Refresh failed'));

      mockAxios.onGet('/test').reply(401, { message: 'Token expired' });

      await expect(get('/test')).rejects.toThrow();

      expect(mockOnAuthError).toHaveBeenCalled();
    });

    it('should not refresh token for auth endpoints', async () => {
      mockGetAccessToken.mockReturnValue('token');

      mockAxios.onPost('/auth/login').reply(401, { message: 'Invalid credentials' });

      await expect(post('/auth/login', {})).rejects.toThrow();

      expect(mockRefreshToken).not.toHaveBeenCalled();
    });

    it('should queue concurrent requests during refresh', async () => {
      mockGetAccessToken.mockReturnValue('expired-token');

      // Slow refresh to allow queuing
      mockRefreshToken.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      // All requests return 401 initially
      mockAxios
        .onGet('/test1')
        .replyOnce(401)
        .onGet('/test1')
        .replyOnce(200, { data: '1' });
      mockAxios
        .onGet('/test2')
        .replyOnce(401)
        .onGet('/test2')
        .replyOnce(200, { data: '2' });
      mockAxios
        .onGet('/test3')
        .replyOnce(401)
        .onGet('/test3')
        .replyOnce(200, { data: '3' });

      // After refresh, return new token
      mockGetAccessToken
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('expired-token')
        .mockReturnValueOnce('expired-token')
        .mockReturnValue('new-token');

      // Make concurrent requests
      const results = await Promise.all([
        get<{ data: string }>('/test1'),
        get<{ data: string }>('/test2'),
        get<{ data: string }>('/test3'),
      ]);

      // Refresh should only be called once
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);

      // All requests should succeed after refresh
      expect(results).toEqual([{ data: '1' }, { data: '2' }, { data: '3' }]);
    });

    it('should not retry same request multiple times', async () => {
      mockGetAccessToken.mockReturnValue('expired-token');
      mockRefreshToken.mockResolvedValue(true);

      // Always return 401
      mockAxios.onGet('/test').reply(401, { message: 'Unauthorized' });

      await expect(get('/test')).rejects.toThrow();

      // Should only try refresh once per request
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Convenience Method Tests
  // ==========================================================================

  describe('Convenience Methods', () => {
    beforeEach(() => {
      mockGetAccessToken.mockReturnValue('token');
    });

    describe('get', () => {
      it('should make GET request and return data', async () => {
        mockAxios.onGet('/users').reply(200, { users: [{ id: 1 }] });

        const result = await get<{ users: { id: number }[] }>('/users');

        expect(result).toEqual({ users: [{ id: 1 }] });
      });

      it('should pass config options', async () => {
        mockAxios.onGet('/users').reply((config) => {
          return [200, { params: config.params }];
        });

        const result = await get<{ params: { page: number } }>('/users', {
          params: { page: 1 },
        });

        expect(result.params).toEqual({ page: 1 });
      });
    });

    describe('post', () => {
      it('should make POST request with data', async () => {
        const requestData = { name: 'Test User' };
        mockAxios.onPost('/users').reply((config) => {
          return [201, JSON.parse(config.data as string)];
        });

        const result = await post<{ name: string }>('/users', requestData);

        expect(result).toEqual(requestData);
      });
    });

    describe('put', () => {
      it('should make PUT request with data', async () => {
        const requestData = { id: 1, name: 'Updated User' };
        mockAxios.onPut('/users/1').reply((config) => {
          return [200, JSON.parse(config.data as string)];
        });

        const result = await put<{ id: number; name: string }>('/users/1', requestData);

        expect(result).toEqual(requestData);
      });
    });

    describe('patch', () => {
      it('should make PATCH request with data', async () => {
        const requestData = { name: 'Patched User' };
        mockAxios.onPatch('/users/1').reply((config) => {
          return [200, { id: 1, ...JSON.parse(config.data as string) }];
        });

        const result = await patch<{ id: number; name: string }>('/users/1', requestData);

        expect(result).toEqual({ id: 1, name: 'Patched User' });
      });
    });

    describe('del', () => {
      it('should make DELETE request', async () => {
        mockAxios.onDelete('/users/1').reply(200, { deleted: true });

        const result = await del<{ deleted: boolean }>('/users/1');

        expect(result).toEqual({ deleted: true });
      });
    });
  });

  // ==========================================================================
  // ApiClientError Tests
  // ==========================================================================

  describe('ApiClientError', () => {
    it('should create error with correct properties', () => {
      const error = new ApiClientError(
        'Not found',
        404,
        'NOT_FOUND',
        { resource: 'user' }
      );

      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
      expect(error.details).toEqual({ resource: 'user' });
      expect(error.name).toBe('ApiClientError');
      expect(error.isNetworkError).toBe(false);
      expect(error.isTimeout).toBe(false);
    });

    it('should identify network errors', () => {
      const error = new ApiClientError('Network error', 0, 'NETWORK_ERROR');

      expect(error.isNetworkError).toBe(true);
    });

    it('should identify timeout errors', () => {
      const error = new ApiClientError('Timeout', 0, 'ECONNABORTED');

      expect(error.isTimeout).toBe(true);
    });

    it('should identify timeout errors with TIMEOUT code', () => {
      const error = new ApiClientError('Request timeout', 0, 'TIMEOUT');

      expect(error.isTimeout).toBe(true);
    });
  });

  // ==========================================================================
  // isApiClientError Type Guard Tests
  // ==========================================================================

  describe('isApiClientError', () => {
    it('should return true for ApiClientError instances', () => {
      const error = new ApiClientError('Test error', 400, 'TEST_ERROR');

      expect(isApiClientError(error)).toBe(true);
    });

    it('should return false for regular Error instances', () => {
      const error = new Error('Regular error');

      expect(isApiClientError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isApiClientError(null)).toBe(false);
      expect(isApiClientError(undefined)).toBe(false);
      expect(isApiClientError('string')).toBe(false);
      expect(isApiClientError(123)).toBe(false);
      expect(isApiClientError({})).toBe(false);
    });
  });

  // ==========================================================================
  // buildQueryString Tests
  // ==========================================================================

  describe('buildQueryString', () => {
    it('should build query string from params', () => {
      const params = { page: 1, limit: 10, search: 'test' };

      const result = buildQueryString(params);

      expect(result).toBe('?page=1&limit=10&search=test');
    });

    it('should handle boolean values', () => {
      const params = { active: true, archived: false };

      const result = buildQueryString(params);

      expect(result).toBe('?active=true&archived=false');
    });

    it('should filter out undefined and null values', () => {
      const params = {
        page: 1,
        search: undefined,
        filter: null,
        status: 'active',
      };

      const result = buildQueryString(params);

      expect(result).toBe('?page=1&status=active');
    });

    it('should return empty string for empty params', () => {
      const result = buildQueryString({});

      expect(result).toBe('');
    });

    it('should return empty string when all values are null/undefined', () => {
      const params = { a: undefined, b: null };

      const result = buildQueryString(params);

      expect(result).toBe('');
    });
  });

  // ==========================================================================
  // Token Callback Management Tests
  // ==========================================================================

  describe('Token Callback Management', () => {
    it('should work without callbacks set', async () => {
      clearTokenCallbacks();
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      const result = await get<{ data: string }>('/test');

      expect(result).toEqual({ data: 'success' });
    });

    it('should not add auth header when callbacks are cleared', async () => {
      clearTokenCallbacks();
      mockAxios.onGet('/test').reply(200, { data: 'success' });

      await get('/test');

      const request = mockAxios.history.get[0];
      expect(request?.headers?.Authorization).toBeUndefined();
    });
  });

  // ==========================================================================
  // Error Response Transformation Tests
  // ==========================================================================

  describe('Error Response Transformation', () => {
    beforeEach(() => {
      mockGetAccessToken.mockReturnValue('token');
    });

    it('should extract message from response data', async () => {
      mockAxios.onGet('/test').reply(400, {
        message: 'Custom error message',
        code: 'CUSTOM_ERROR',
      });

      try {
        await get('/test');
      } catch (error) {
        if (isApiClientError(error)) {
          expect(error.message).toBe('Custom error message');
        }
      }
    });

    it('should use UNKNOWN_ERROR code when not provided', async () => {
      mockAxios.onGet('/test').reply(500, {
        message: 'Server error',
      });

      try {
        await get('/test');
      } catch (error) {
        if (isApiClientError(error)) {
          expect(error.code).toBe('UNKNOWN_ERROR');
        }
      }
    });

    it('should include response data as details', async () => {
      const responseData = {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        fields: { email: 'Invalid format' },
      };
      mockAxios.onGet('/test').reply(400, responseData);

      try {
        await get('/test');
      } catch (error) {
        if (isApiClientError(error)) {
          expect(error.details).toEqual(expect.objectContaining(responseData));
        }
      }
    });
  });
});
