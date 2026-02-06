/**
 * Rollup Cache Error Tests
 * @module services/rollup/rollup-cache/__tests__/errors.test
 *
 * Tests for cache error classes, error handling, and error utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  RollupCacheError,
  RollupCacheErrorSeverity,
  RollupCacheErrorRetryable,
  RollupCacheErrorHttpStatus,
  RollupCacheErrorMessage,
  isRollupCacheError,
  isRetryableCacheError,
  allowsCacheFallback,
  wrapAsCacheError,
} from '../errors.js';
import { RollupCacheErrorCodes, createCacheKey } from '../interfaces.js';
import { RollupErrorSeverity } from '../../error-codes.js';

describe('RollupCacheError', () => {
  // =========================================================================
  // Constructor Tests
  // =========================================================================

  describe('constructor', () => {
    it('should create error with message', () => {
      const error = new RollupCacheError('Test error message');

      expect(error.message).toBe('Test error message');
      expect(error.name).toBe('RollupCacheError');
    });

    it('should create error with code', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.READ_FAILED);
    });

    it('should create error with context', () => {
      const context = {
        cacheKey: 'test:key',
        cacheLayer: 'l1' as const,
        operation: 'get' as const,
      };

      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED,
        context
      );

      expect(error.cacheContext.cacheKey).toBe('test:key');
      expect(error.cacheContext.cacheLayer).toBe('l1');
      expect(error.cacheContext.operation).toBe('get');
    });

    it('should set retryable based on error code', () => {
      const retryableError = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );
      const nonRetryableError = new RollupCacheError(
        'Config error',
        RollupCacheErrorCodes.CONFIG_ERROR
      );

      expect(retryableError.retryable).toBe(true);
      expect(nonRetryableError.retryable).toBe(false);
    });

    it('should calculate retryAfterMs for retryable errors with retry info', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED,
        { retryInfo: { attempt: 2, maxAttempts: 5 } }
      );

      expect(error.retryAfterMs).toBeDefined();
      expect(error.retryAfterMs).toBeGreaterThan(0);
    });

    it('should not set retryAfterMs for non-retryable errors', () => {
      const error = new RollupCacheError(
        'Config error',
        RollupCacheErrorCodes.CONFIG_ERROR,
        { retryInfo: { attempt: 1, maxAttempts: 3 } }
      );

      expect(error.retryAfterMs).toBeUndefined();
    });
  });

  // =========================================================================
  // Method Tests
  // =========================================================================

  describe('getHttpStatus', () => {
    it('should return 500 for READ_FAILED', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(error.getHttpStatus()).toBe(500);
    });

    it('should return 503 for L2_ERROR', () => {
      const error = new RollupCacheError(
        'L2 error',
        RollupCacheErrorCodes.L2_ERROR
      );

      expect(error.getHttpStatus()).toBe(503);
    });

    it('should return 500 for unknown code', () => {
      const error = new RollupCacheError('Unknown error');

      expect(error.getHttpStatus()).toBe(500);
    });
  });

  describe('getSeverity', () => {
    it('should return WARNING for READ_FAILED', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(error.getSeverity()).toBe(RollupErrorSeverity.WARNING);
    });

    it('should return ERROR for NOT_INITIALIZED', () => {
      const error = new RollupCacheError(
        'Not initialized',
        RollupCacheErrorCodes.NOT_INITIALIZED
      );

      expect(error.getSeverity()).toBe(RollupErrorSeverity.ERROR);
    });

    it('should return ERROR for CONFIG_ERROR', () => {
      const error = new RollupCacheError(
        'Config error',
        RollupCacheErrorCodes.CONFIG_ERROR
      );

      expect(error.getSeverity()).toBe(RollupErrorSeverity.ERROR);
    });
  });

  describe('getUserMessage', () => {
    it('should return user-friendly message for known code', () => {
      const error = new RollupCacheError(
        'Technical error details',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(error.getUserMessage()).toBe('Failed to read from cache.');
    });

    it('should return predefined message for default code (READ_FAILED)', () => {
      // When no code is provided, defaults to READ_FAILED which has a predefined message
      const error = new RollupCacheError('Custom error message');

      expect(error.getUserMessage()).toBe('Failed to read from cache.');
    });
  });

  describe('allowsFallback', () => {
    it('should return true for READ_FAILED', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(error.allowsFallback()).toBe(true);
    });

    it('should return true for WRITE_FAILED', () => {
      const error = new RollupCacheError(
        'Write failed',
        RollupCacheErrorCodes.WRITE_FAILED
      );

      expect(error.allowsFallback()).toBe(true);
    });

    it('should return true for L2_ERROR', () => {
      const error = new RollupCacheError(
        'L2 error',
        RollupCacheErrorCodes.L2_ERROR
      );

      expect(error.allowsFallback()).toBe(true);
    });

    it('should return false for NOT_INITIALIZED', () => {
      const error = new RollupCacheError(
        'Not initialized',
        RollupCacheErrorCodes.NOT_INITIALIZED
      );

      expect(error.allowsFallback()).toBe(false);
    });

    it('should return false for CONFIG_ERROR', () => {
      const error = new RollupCacheError(
        'Config error',
        RollupCacheErrorCodes.CONFIG_ERROR
      );

      expect(error.allowsFallback()).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should create new error with retry context', () => {
      const originalError = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      const retryError = originalError.withRetry(2, 5, 500);

      expect(retryError.cacheContext.retryInfo).toEqual({
        attempt: 2,
        maxAttempts: 5,
        backoffMs: 500,
      });
    });

    it('should preserve original message and code', () => {
      const originalError = new RollupCacheError(
        'Original message',
        RollupCacheErrorCodes.READ_FAILED
      );

      const retryError = originalError.withRetry(1, 3);

      expect(retryError.message).toBe('Original message');
      expect(retryError.cacheErrorCode).toBe(RollupCacheErrorCodes.READ_FAILED);
    });
  });

  describe('toJSON', () => {
    it('should serialize error to JSON', () => {
      const error = new RollupCacheError(
        'Test error',
        RollupCacheErrorCodes.READ_FAILED,
        { cacheKey: 'test:key' }
      );

      const json = error.toJSON();

      expect(json).toHaveProperty('code', RollupCacheErrorCodes.READ_FAILED);
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('statusCode', 500);
      expect(json.details).toHaveProperty('retryable', true);
      expect(json.details).toHaveProperty('allowsFallback', true);
    });
  });

  // =========================================================================
  // Static Factory Method Tests
  // =========================================================================

  describe('static factory methods', () => {
    const testKey = createCacheKey('test:key');

    describe('readFailed', () => {
      it('should create read failed error', () => {
        const error = RollupCacheError.readFailed(testKey, 'l1');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.READ_FAILED);
        expect(error.cacheContext.cacheLayer).toBe('l1');
        expect(error.cacheContext.operation).toBe('get');
      });

      it('should include cause if provided', () => {
        const cause = new Error('Connection timeout');
        const error = RollupCacheError.readFailed(testKey, 'l2', cause);

        expect(error.message).toContain('Connection timeout');
      });
    });

    describe('writeFailed', () => {
      it('should create write failed error', () => {
        const error = RollupCacheError.writeFailed(testKey, 'l2');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.WRITE_FAILED);
        expect(error.cacheContext.cacheLayer).toBe('l2');
        expect(error.cacheContext.operation).toBe('set');
      });
    });

    describe('invalidationFailed', () => {
      it('should create invalidation failed error', () => {
        const error = RollupCacheError.invalidationFailed('tenant:123');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.INVALIDATION_FAILED);
        expect(error.cacheContext.operation).toBe('invalidate');
      });
    });

    describe('serializationFailed', () => {
      it('should create serialization failed error', () => {
        const error = RollupCacheError.serializationFailed(testKey);

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.SERIALIZATION_FAILED);
        expect(error.retryable).toBe(false);
      });
    });

    describe('deserializationFailed', () => {
      it('should create deserialization failed error', () => {
        const error = RollupCacheError.deserializationFailed(testKey);

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.DESERIALIZATION_FAILED);
        expect(error.retryable).toBe(false);
      });
    });

    describe('l1Error', () => {
      it('should create L1 error', () => {
        const error = RollupCacheError.l1Error('get');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.L1_ERROR);
        expect(error.cacheContext.cacheLayer).toBe('l1');
      });
    });

    describe('l2Error', () => {
      it('should create L2 error', () => {
        const error = RollupCacheError.l2Error('set');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.L2_ERROR);
        expect(error.cacheContext.cacheLayer).toBe('l2');
      });
    });

    describe('notInitialized', () => {
      it('should create not initialized error', () => {
        const error = RollupCacheError.notInitialized();

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.NOT_INITIALIZED);
        expect(error.retryable).toBe(false);
        expect(error.allowsFallback()).toBe(false);
      });
    });

    describe('configError', () => {
      it('should create config error', () => {
        const error = RollupCacheError.configError('Invalid TTL value');

        expect(error.cacheErrorCode).toBe(RollupCacheErrorCodes.CONFIG_ERROR);
        expect(error.message).toContain('Invalid TTL value');
        expect(error.retryable).toBe(false);
      });
    });
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isRollupCacheError', () => {
    it('should return true for RollupCacheError instances', () => {
      const error = new RollupCacheError('Test error');

      expect(isRollupCacheError(error)).toBe(true);
    });

    it('should return false for regular Error', () => {
      const error = new Error('Regular error');

      expect(isRollupCacheError(error)).toBe(false);
    });

    it('should return false for non-error values', () => {
      expect(isRollupCacheError(null)).toBe(false);
      expect(isRollupCacheError(undefined)).toBe(false);
      expect(isRollupCacheError('string')).toBe(false);
      expect(isRollupCacheError({})).toBe(false);
    });
  });

  describe('isRetryableCacheError', () => {
    it('should return true for retryable cache errors', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(isRetryableCacheError(error)).toBe(true);
    });

    it('should return false for non-retryable cache errors', () => {
      const error = new RollupCacheError(
        'Config error',
        RollupCacheErrorCodes.CONFIG_ERROR
      );

      expect(isRetryableCacheError(error)).toBe(false);
    });

    it('should return false for non-cache errors', () => {
      const error = new Error('Regular error');

      expect(isRetryableCacheError(error)).toBe(false);
    });
  });

  describe('allowsCacheFallback', () => {
    it('should return true for cache errors that allow fallback', () => {
      const error = new RollupCacheError(
        'Read failed',
        RollupCacheErrorCodes.READ_FAILED
      );

      expect(allowsCacheFallback(error)).toBe(true);
    });

    it('should return false for cache errors that do not allow fallback', () => {
      const error = new RollupCacheError(
        'Not initialized',
        RollupCacheErrorCodes.NOT_INITIALIZED
      );

      expect(allowsCacheFallback(error)).toBe(false);
    });

    it('should return true for non-cache errors', () => {
      const error = new Error('Regular error');

      // Non-cache errors should not prevent fallback
      expect(allowsCacheFallback(error)).toBe(true);
    });

    it('should return true for null/undefined', () => {
      expect(allowsCacheFallback(null)).toBe(true);
      expect(allowsCacheFallback(undefined)).toBe(true);
    });
  });
});

// ============================================================================
// Error Wrapping Tests
// ============================================================================

describe('wrapAsCacheError', () => {
  it('should return same error if already RollupCacheError', () => {
    const original = new RollupCacheError(
      'Original error',
      RollupCacheErrorCodes.READ_FAILED
    );

    const wrapped = wrapAsCacheError(original);

    expect(wrapped).toBe(original);
  });

  it('should enhance existing cache error with additional context', () => {
    const original = new RollupCacheError(
      'Original error',
      RollupCacheErrorCodes.READ_FAILED
    );

    const wrapped = wrapAsCacheError(original, RollupCacheErrorCodes.READ_FAILED, {
      cacheKey: 'new:key',
    });

    expect(wrapped.cacheContext.cacheKey).toBe('new:key');
  });

  it('should wrap regular Error', () => {
    const original = new Error('Standard error');

    const wrapped = wrapAsCacheError(original);

    expect(wrapped).toBeInstanceOf(RollupCacheError);
    expect(wrapped.message).toBe('Standard error');
  });

  it('should wrap string error', () => {
    const wrapped = wrapAsCacheError('String error message');

    expect(wrapped).toBeInstanceOf(RollupCacheError);
    expect(wrapped.message).toBe('String error message');
  });

  it('should use default code if not provided', () => {
    const wrapped = wrapAsCacheError(new Error('Test'));

    expect(wrapped.cacheErrorCode).toBe(RollupCacheErrorCodes.READ_FAILED);
  });

  it('should use provided code', () => {
    const wrapped = wrapAsCacheError(
      new Error('Test'),
      RollupCacheErrorCodes.WRITE_FAILED
    );

    expect(wrapped.cacheErrorCode).toBe(RollupCacheErrorCodes.WRITE_FAILED);
  });

  it('should include provided context', () => {
    const wrapped = wrapAsCacheError(
      new Error('Test'),
      RollupCacheErrorCodes.READ_FAILED,
      { tenantId: 'tenant-123', operation: 'get' }
    );

    expect(wrapped.cacheContext.tenantId).toBe('tenant-123');
    expect(wrapped.cacheContext.operation).toBe('get');
  });
});

// ============================================================================
// Error Severity Mapping Tests
// ============================================================================

describe('RollupCacheErrorSeverity', () => {
  it('should map all error codes', () => {
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(RollupCacheErrorSeverity[code]).toBeDefined();
    }
  });
});

// ============================================================================
// Error Retryability Mapping Tests
// ============================================================================

describe('RollupCacheErrorRetryable', () => {
  it('should map all error codes', () => {
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(typeof RollupCacheErrorRetryable[code]).toBe('boolean');
    }
  });

  it('should mark transient errors as retryable', () => {
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.READ_FAILED]).toBe(true);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.WRITE_FAILED]).toBe(true);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.L1_ERROR]).toBe(true);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.L2_ERROR]).toBe(true);
  });

  it('should mark permanent errors as non-retryable', () => {
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.SERIALIZATION_FAILED]).toBe(false);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.DESERIALIZATION_FAILED]).toBe(false);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.NOT_INITIALIZED]).toBe(false);
    expect(RollupCacheErrorRetryable[RollupCacheErrorCodes.CONFIG_ERROR]).toBe(false);
  });
});

// ============================================================================
// Error HTTP Status Mapping Tests
// ============================================================================

describe('RollupCacheErrorHttpStatus', () => {
  it('should map all error codes', () => {
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(typeof RollupCacheErrorHttpStatus[code]).toBe('number');
    }
  });

  it('should return 5xx for all cache errors', () => {
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(RollupCacheErrorHttpStatus[code]).toBeGreaterThanOrEqual(500);
      expect(RollupCacheErrorHttpStatus[code]).toBeLessThan(600);
    }
  });
});

// ============================================================================
// Error Message Mapping Tests
// ============================================================================

describe('RollupCacheErrorMessage', () => {
  it('should map all error codes', () => {
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(RollupCacheErrorMessage[code]).toBeDefined();
      expect(typeof RollupCacheErrorMessage[code]).toBe('string');
    }
  });

  it('should provide user-friendly messages', () => {
    // Messages should be sentences (end with period)
    const codes = Object.values(RollupCacheErrorCodes);

    for (const code of codes) {
      expect(RollupCacheErrorMessage[code]).toMatch(/\.$/);
    }
  });
});
