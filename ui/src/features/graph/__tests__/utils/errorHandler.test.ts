/**
 * Error Handler Tests
 * Tests for centralized error handling
 * @module features/graph/__tests__/utils/errorHandler.test
 */

import { describe, it, expect, vi } from 'vitest';

// Use vi.hoisted to define the mock class before it's used in vi.mock
const { MockApiClientError } = vi.hoisted(() => {
  class MockApiClientError extends Error {
    statusCode: number;
    isNetworkError: boolean;
    isTimeout: boolean;
    details?: Record<string, unknown>;

    constructor(
      message: string,
      statusCode: number,
      options: { isNetworkError?: boolean; isTimeout?: boolean; details?: Record<string, unknown> } = {}
    ) {
      super(message);
      this.name = 'ApiClientError';
      this.statusCode = statusCode;
      this.isNetworkError = options.isNetworkError ?? false;
      this.isTimeout = options.isTimeout ?? false;
      this.details = options.details;
    }
  }
  return { MockApiClientError };
});

// Mock the module with the hoisted class
vi.mock('@/core/api/client', () => ({
  ApiClientError: MockApiClientError,
}));

import {
  GraphError,
  handleApiError,
  isRetryableError,
  isAuthError,
  isValidationError,
  isNotFoundError,
  getErrorMessage,
  getErrorTitle,
  getErrorRecoveryActions,
  getPrimaryRecoveryAction,
  isGraphError,
  hasErrorCode,
  type GraphErrorCode,
} from '../../utils/errorHandler';

describe('errorHandler', () => {
  describe('GraphError', () => {
    it('should create error with code and message', () => {
      const error = new GraphError('Test error', 'NETWORK_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('GraphError');
    });

    it('should set retryable based on code', () => {
      expect(new GraphError('', 'NETWORK_ERROR').retryable).toBe(true);
      expect(new GraphError('', 'TIMEOUT_ERROR').retryable).toBe(true);
      expect(new GraphError('', 'SERVER_ERROR').retryable).toBe(true);
      expect(new GraphError('', 'RATE_LIMITED').retryable).toBe(true);
      expect(new GraphError('', 'NOT_FOUND').retryable).toBe(false);
      expect(new GraphError('', 'UNAUTHORIZED').retryable).toBe(false);
    });

    it('should allow retryable override', () => {
      const error = new GraphError('', 'NOT_FOUND', { retryable: true });

      expect(error.retryable).toBe(true);
    });

    it('should include statusCode and details', () => {
      const error = new GraphError('Test', 'SERVER_ERROR', {
        statusCode: 500,
        details: { requestId: '123' },
      });

      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ requestId: '123' });
    });

    it('should include timestamp', () => {
      const before = new Date();
      const error = new GraphError('Test', 'UNKNOWN_ERROR');
      const after = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should serialize to JSON', () => {
      const error = new GraphError('Test', 'NETWORK_ERROR', {
        statusCode: 0,
        details: { test: true },
      });

      const json = error.toJSON();

      expect(json.name).toBe('GraphError');
      expect(json.message).toBe('Test');
      expect(json.code).toBe('NETWORK_ERROR');
      expect(json.details).toEqual({ test: true });
      expect(json.timestamp).toBeDefined();
    });

    it('should convert to string', () => {
      const error = new GraphError('Test message', 'NOT_FOUND');

      expect(error.toString()).toBe('GraphError [NOT_FOUND]: Test message');
    });

    it('should preserve cause', () => {
      const originalError = new Error('Original');
      const graphError = new GraphError('Wrapped', 'UNKNOWN_ERROR', {
        cause: originalError,
      });

      expect(graphError.cause).toBe(originalError);
    });
  });

  describe('handleApiError', () => {
    it('should return GraphError as-is', () => {
      const original = new GraphError('Already handled', 'NOT_FOUND');

      const result = handleApiError(original);

      expect(result).toBe(original);
    });

    it('should transform network errors', () => {
      const apiError = new MockApiClientError('Network failed', 0, {
        isNetworkError: true,
      });

      const result = handleApiError(apiError);

      expect(result.code).toBe('NETWORK_ERROR');
      expect(result.retryable).toBe(true);
      expect(result.message).toContain('internet connection');
    });

    it('should transform timeout errors', () => {
      const apiError = new MockApiClientError('Timed out', 0, {
        isTimeout: true,
      });

      const result = handleApiError(apiError);

      expect(result.code).toBe('TIMEOUT_ERROR');
      expect(result.retryable).toBe(true);
    });

    it('should map status codes to error codes', () => {
      expect(handleApiError(new MockApiClientError('', 400)).code).toBe('VALIDATION_ERROR');
      expect(handleApiError(new MockApiClientError('', 401)).code).toBe('UNAUTHORIZED');
      expect(handleApiError(new MockApiClientError('', 403)).code).toBe('FORBIDDEN');
      expect(handleApiError(new MockApiClientError('', 404)).code).toBe('NOT_FOUND');
      expect(handleApiError(new MockApiClientError('', 429)).code).toBe('RATE_LIMITED');
      expect(handleApiError(new MockApiClientError('', 500)).code).toBe('SERVER_ERROR');
      expect(handleApiError(new MockApiClientError('', 502)).code).toBe('SERVER_ERROR');
      expect(handleApiError(new MockApiClientError('', 503)).code).toBe('SERVER_ERROR');
      expect(handleApiError(new MockApiClientError('', 504)).code).toBe('TIMEOUT_ERROR');
    });

    it('should handle standard Error with network message', () => {
      const error = new Error('Failed to fetch');

      const result = handleApiError(error);

      expect(result.code).toBe('NETWORK_ERROR');
    });

    it('should handle standard Error with timeout message', () => {
      const error = new Error('Request timed out');

      const result = handleApiError(error);

      expect(result.code).toBe('TIMEOUT_ERROR');
    });

    it('should handle unknown error types', () => {
      const result = handleApiError('string error');

      expect(result.code).toBe('UNKNOWN_ERROR');
      expect(result.message).toBe('An unexpected error occurred');
    });
  });

  describe('isRetryableError', () => {
    it('should return retryable property for GraphError', () => {
      expect(isRetryableError(new GraphError('', 'NETWORK_ERROR'))).toBe(true);
      expect(isRetryableError(new GraphError('', 'NOT_FOUND'))).toBe(false);
    });

    it('should detect network errors in standard Error', () => {
      expect(isRetryableError(new Error('network failure'))).toBe(true);
      expect(isRetryableError(new Error('timeout occurred'))).toBe(true);
      expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      expect(isRetryableError(new Error('validation failed'))).toBe(false);
    });
  });

  describe('isAuthError', () => {
    it('should return true for auth error codes', () => {
      expect(isAuthError(new GraphError('', 'UNAUTHORIZED'))).toBe(true);
      expect(isAuthError(new GraphError('', 'FORBIDDEN'))).toBe(true);
    });

    it('should return false for non-auth errors', () => {
      expect(isAuthError(new GraphError('', 'NOT_FOUND'))).toBe(false);
      expect(isAuthError(new Error('test'))).toBe(false);
    });
  });

  describe('isValidationError', () => {
    it('should return true for validation errors', () => {
      expect(isValidationError(new GraphError('', 'VALIDATION_ERROR'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isValidationError(new GraphError('', 'SERVER_ERROR'))).toBe(false);
      expect(isValidationError(new Error('test'))).toBe(false);
    });
  });

  describe('isNotFoundError', () => {
    it('should return true for not found errors', () => {
      expect(isNotFoundError(new GraphError('', 'NOT_FOUND'))).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isNotFoundError(new GraphError('', 'SERVER_ERROR'))).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return message for GraphError', () => {
      const error = new GraphError('Custom message', 'NOT_FOUND');

      expect(getErrorMessage(error)).toBe('Custom message');
    });

    it('should transform standard Error to GraphError message', () => {
      const error = new Error('Network failure');

      const message = getErrorMessage(error);

      expect(message).toContain('connection');
    });

    it('should return default for unknown types', () => {
      expect(getErrorMessage(null)).toBe('An unexpected error occurred. Please try again.');
      expect(getErrorMessage(123)).toBe('An unexpected error occurred. Please try again.');
    });
  });

  describe('getErrorTitle', () => {
    it('should return appropriate titles for each error code', () => {
      expect(getErrorTitle(new GraphError('', 'NETWORK_ERROR'))).toBe('Connection Error');
      expect(getErrorTitle(new GraphError('', 'TIMEOUT_ERROR'))).toBe('Request Timeout');
      expect(getErrorTitle(new GraphError('', 'NOT_FOUND'))).toBe('Not Found');
      expect(getErrorTitle(new GraphError('', 'FORBIDDEN'))).toBe('Access Denied');
      expect(getErrorTitle(new GraphError('', 'UNAUTHORIZED'))).toBe('Authentication Required');
      expect(getErrorTitle(new GraphError('', 'VALIDATION_ERROR'))).toBe('Invalid Data');
      expect(getErrorTitle(new GraphError('', 'SERVER_ERROR'))).toBe('Server Error');
      expect(getErrorTitle(new GraphError('', 'RATE_LIMITED'))).toBe('Rate Limited');
      expect(getErrorTitle(new GraphError('', 'GRAPH_TOO_LARGE'))).toBe('Graph Too Large');
      expect(getErrorTitle(new GraphError('', 'CALCULATION_TIMEOUT'))).toBe('Calculation Timeout');
      expect(getErrorTitle(new GraphError('', 'UNKNOWN_ERROR'))).toBe('Error');
    });

    it('should return generic title for non-GraphError', () => {
      expect(getErrorTitle(new Error('test'))).toBe('Error');
    });
  });

  describe('getErrorRecoveryActions', () => {
    it('should return retry actions for network errors', () => {
      const actions = getErrorRecoveryActions(new GraphError('', 'NETWORK_ERROR'));

      expect(actions.find((a) => a.type === 'retry')).toBeDefined();
      expect(actions.find((a) => a.type === 'refresh')).toBeDefined();
    });

    it('should return sign in action for unauthorized', () => {
      const actions = getErrorRecoveryActions(new GraphError('', 'UNAUTHORIZED'));

      expect(actions.find((a) => a.type === 'sign_in')).toBeDefined();
    });

    it('should return navigation actions for forbidden', () => {
      const actions = getErrorRecoveryActions(new GraphError('', 'FORBIDDEN'));

      expect(actions.find((a) => a.type === 'navigate')).toBeDefined();
      expect(actions.find((a) => a.type === 'contact_support')).toBeDefined();
    });

    it('should return filter action for large graph', () => {
      const actions = getErrorRecoveryActions(new GraphError('', 'GRAPH_TOO_LARGE'));

      expect(actions.find((a) => a.type === 'apply_filters')).toBeDefined();
    });

    it('should mark primary action', () => {
      const actions = getErrorRecoveryActions(new GraphError('', 'SERVER_ERROR'));

      const primary = actions.find((a) => a.primary);
      expect(primary).toBeDefined();
    });
  });

  describe('getPrimaryRecoveryAction', () => {
    it('should return primary action', () => {
      const action = getPrimaryRecoveryAction(new GraphError('', 'NETWORK_ERROR'));

      expect(action?.primary).toBe(true);
      expect(action?.type).toBe('retry');
    });

    it('should return first action if no primary', () => {
      // For most errors, there's always a primary, but the function handles edge cases
      const action = getPrimaryRecoveryAction(new GraphError('', 'VALIDATION_ERROR'));

      expect(action).toBeDefined();
    });
  });

  describe('isGraphError', () => {
    it('should return true for GraphError instances', () => {
      expect(isGraphError(new GraphError('', 'NOT_FOUND'))).toBe(true);
    });

    it('should return false for other values', () => {
      expect(isGraphError(new Error('test'))).toBe(false);
      expect(isGraphError(null)).toBe(false);
      expect(isGraphError({ code: 'NOT_FOUND' })).toBe(false);
    });
  });

  describe('hasErrorCode', () => {
    it('should return true when error has matching code', () => {
      expect(hasErrorCode(new GraphError('', 'NOT_FOUND'), 'NOT_FOUND')).toBe(true);
    });

    it('should return false when codes do not match', () => {
      expect(hasErrorCode(new GraphError('', 'NOT_FOUND'), 'SERVER_ERROR')).toBe(false);
    });

    it('should return false for non-GraphError', () => {
      expect(hasErrorCode(new Error('test'), 'NOT_FOUND')).toBe(false);
    });
  });
});
