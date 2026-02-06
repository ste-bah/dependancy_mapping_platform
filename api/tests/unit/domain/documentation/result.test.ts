/**
 * Result Type Unit Tests
 * @module tests/unit/domain/documentation/result
 *
 * Tests for the Result type and utility functions including:
 * - Result.ok and Result.err
 * - Type guards (isOk, isErr)
 * - Utility functions (map, unwrapOr, all)
 * - ValidationError class
 * - DomainError class
 * - Error type guards
 *
 * TASK-FINAL-004: Documentation system testing
 */

import { describe, it, expect } from 'vitest';
import {
  Result,
  ValidationError,
  DomainError,
  isValidationError,
  isDomainError,
} from '../../../../src/domain/documentation/result.js';

// ============================================================================
// Result Type Tests
// ============================================================================

describe('Result', () => {
  describe('ok', () => {
    it('should create a successful result', () => {
      const result = Result.ok('success');

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('success');
      }
    });

    it('should create result with complex value', () => {
      const value = { id: 1, name: 'test', data: [1, 2, 3] };
      const result = Result.ok(value);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(value);
      }
    });

    it('should create result with null value', () => {
      const result = Result.ok(null);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeNull();
      }
    });

    it('should create result with undefined value', () => {
      const result = Result.ok(undefined);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeUndefined();
      }
    });
  });

  describe('err', () => {
    it('should create a failed result', () => {
      const error = new Error('test error');
      const result = Result.err(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    it('should create result with string error', () => {
      const result = Result.err('error message');

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('error message');
      }
    });

    it('should create result with custom error object', () => {
      const error = { code: 'ERR_001', message: 'Custom error' };
      const result = Result.err(error);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toEqual(error);
      }
    });
  });

  describe('isOk', () => {
    it('should return true for successful result', () => {
      const result = Result.ok('value');

      expect(Result.isOk(result)).toBe(true);
    });

    it('should return false for failed result', () => {
      const result = Result.err('error');

      expect(Result.isOk(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = Result.ok('value');

      if (Result.isOk(result)) {
        // TypeScript should know result.value exists
        expect(result.value).toBe('value');
      }
    });
  });

  describe('isErr', () => {
    it('should return true for failed result', () => {
      const result = Result.err('error');

      expect(Result.isErr(result)).toBe(true);
    });

    it('should return false for successful result', () => {
      const result = Result.ok('value');

      expect(Result.isErr(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result = Result.err('error');

      if (Result.isErr(result)) {
        // TypeScript should know result.error exists
        expect(result.error).toBe('error');
      }
    });
  });

  describe('map', () => {
    it('should transform successful result', () => {
      const result = Result.ok(5);
      const mapped = Result.map(result, (n) => n * 2);

      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.value).toBe(10);
      }
    });

    it('should not transform failed result', () => {
      const result = Result.err('error');
      const mapped = Result.map(result, (n: number) => n * 2);

      expect(mapped.success).toBe(false);
      if (!mapped.success) {
        expect(mapped.error).toBe('error');
      }
    });

    it('should support type transformation', () => {
      const result = Result.ok(42);
      const mapped = Result.map(result, (n) => n.toString());

      expect(mapped.success).toBe(true);
      if (mapped.success) {
        expect(mapped.value).toBe('42');
        expect(typeof mapped.value).toBe('string');
      }
    });
  });

  describe('unwrapOr', () => {
    it('should return value for successful result', () => {
      const result = Result.ok('success');
      const value = Result.unwrapOr(result, 'default');

      expect(value).toBe('success');
    });

    it('should return default for failed result', () => {
      const result = Result.err('error');
      const value = Result.unwrapOr(result, 'default');

      expect(value).toBe('default');
    });

    it('should work with complex default values', () => {
      const result = Result.err('error');
      const value = Result.unwrapOr(result, { id: 0, name: 'default' });

      expect(value).toEqual({ id: 0, name: 'default' });
    });
  });

  describe('all', () => {
    it('should combine successful results', () => {
      const results = [Result.ok(1), Result.ok(2), Result.ok(3)];
      const combined = Result.all(results);

      expect(combined.success).toBe(true);
      if (combined.success) {
        expect(combined.value).toEqual([1, 2, 3]);
      }
    });

    it('should return first error for failed results', () => {
      const results = [Result.ok(1), Result.err('error1'), Result.err('error2')];
      const combined = Result.all(results);

      expect(combined.success).toBe(false);
      if (!combined.success) {
        expect(combined.error).toBe('error1');
      }
    });

    it('should return success for empty array', () => {
      const results: Result<number, string>[] = [];
      const combined = Result.all(results);

      expect(combined.success).toBe(true);
      if (combined.success) {
        expect(combined.value).toEqual([]);
      }
    });

    it('should preserve order of values', () => {
      const results = [Result.ok('a'), Result.ok('b'), Result.ok('c')];
      const combined = Result.all(results);

      expect(combined.success).toBe(true);
      if (combined.success) {
        expect(combined.value).toEqual(['a', 'b', 'c']);
      }
    });
  });
});

// ============================================================================
// ValidationError Tests
// ============================================================================

describe('ValidationError', () => {
  describe('constructor', () => {
    it('should create error with all parameters', () => {
      const error = new ValidationError(
        'Field is invalid',
        'INVALID_FIELD',
        'fieldName',
        { extra: 'data' }
      );

      expect(error.message).toBe('Field is invalid');
      expect(error.code).toBe('INVALID_FIELD');
      expect(error.field).toBe('fieldName');
      expect(error.context).toEqual({ extra: 'data' });
      expect(error.name).toBe('ValidationError');
    });

    it('should create error with minimal parameters', () => {
      const error = new ValidationError('Error message', 'ERROR_CODE');

      expect(error.message).toBe('Error message');
      expect(error.code).toBe('ERROR_CODE');
      expect(error.field).toBeUndefined();
      expect(error.context).toEqual({});
    });

    it('should be instance of Error', () => {
      const error = new ValidationError('Error', 'CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
    });
  });

  describe('required', () => {
    it('should create required field error', () => {
      const error = ValidationError.required('username');

      expect(error.message).toBe('username is required');
      expect(error.code).toBe('REQUIRED_FIELD');
      expect(error.field).toBe('username');
    });
  });

  describe('invalidFormat', () => {
    it('should create invalid format error', () => {
      const error = ValidationError.invalidFormat('email', 'valid email address');

      expect(error.message).toBe('email has invalid format. Expected: valid email address');
      expect(error.code).toBe('INVALID_FORMAT');
      expect(error.field).toBe('email');
      expect(error.context).toEqual({ expectedFormat: 'valid email address' });
    });
  });

  describe('invalidValue', () => {
    it('should create invalid value error', () => {
      const error = ValidationError.invalidValue('status', 'invalid', 'Must be active or inactive');

      expect(error.message).toBe('status has invalid value: Must be active or inactive');
      expect(error.code).toBe('INVALID_VALUE');
      expect(error.field).toBe('status');
      expect(error.context).toEqual({ value: 'invalid', reason: 'Must be active or inactive' });
    });
  });

  describe('outOfRange', () => {
    it('should create out of range error with min and max', () => {
      const error = ValidationError.outOfRange('age', 18, 100);

      expect(error.message).toBe('age is out of range. Expected: 18-100');
      expect(error.code).toBe('OUT_OF_RANGE');
      expect(error.field).toBe('age');
      expect(error.context).toEqual({ min: 18, max: 100 });
    });

    it('should create out of range error with min only', () => {
      const error = ValidationError.outOfRange('count', 0, undefined);

      expect(error.message).toBe('count is out of range. Expected: >= 0');
      expect(error.code).toBe('OUT_OF_RANGE');
      expect(error.context).toEqual({ min: 0, max: undefined });
    });

    it('should create out of range error with max only', () => {
      const error = ValidationError.outOfRange('size', undefined, 1000);

      expect(error.message).toBe('size is out of range. Expected: <= 1000');
      expect(error.code).toBe('OUT_OF_RANGE');
      expect(error.context).toEqual({ min: undefined, max: 1000 });
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON correctly', () => {
      const error = new ValidationError('Error', 'CODE', 'field', { key: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'ValidationError',
        message: 'Error',
        code: 'CODE',
        field: 'field',
        context: { key: 'value' },
      });
    });
  });
});

// ============================================================================
// DomainError Tests
// ============================================================================

describe('DomainError', () => {
  describe('constructor', () => {
    it('should create error with all parameters', () => {
      const error = new DomainError(
        'Business rule violated',
        'BUSINESS_RULE_VIOLATION',
        { rule: 'minimum_balance' }
      );

      expect(error.message).toBe('Business rule violated');
      expect(error.code).toBe('BUSINESS_RULE_VIOLATION');
      expect(error.context).toEqual({ rule: 'minimum_balance' });
      expect(error.name).toBe('DomainError');
    });

    it('should create error with minimal parameters', () => {
      const error = new DomainError('Error message', 'ERROR_CODE');

      expect(error.message).toBe('Error message');
      expect(error.code).toBe('ERROR_CODE');
      expect(error.context).toEqual({});
    });

    it('should be instance of Error', () => {
      const error = new DomainError('Error', 'CODE');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(DomainError);
    });
  });

  describe('notFound', () => {
    it('should create not found error', () => {
      const error = DomainError.notFound('User', 'user-123');

      expect(error.message).toBe('User not found: user-123');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.context).toEqual({ entity: 'User', id: 'user-123' });
    });
  });

  describe('duplicate', () => {
    it('should create duplicate error', () => {
      const error = DomainError.duplicate('User', 'john@example.com');

      expect(error.message).toBe('User already exists: john@example.com');
      expect(error.code).toBe('DUPLICATE');
      expect(error.context).toEqual({ entity: 'User', identifier: 'john@example.com' });
    });
  });

  describe('invariantViolation', () => {
    it('should create invariant violation error', () => {
      const error = DomainError.invariantViolation('Balance cannot be negative');

      expect(error.message).toBe('Balance cannot be negative');
      expect(error.code).toBe('INVARIANT_VIOLATION');
      expect(error.context).toEqual({});
    });
  });

  describe('toJSON', () => {
    it('should serialize to JSON correctly', () => {
      const error = new DomainError('Error', 'CODE', { key: 'value' });
      const json = error.toJSON();

      expect(json).toEqual({
        name: 'DomainError',
        message: 'Error',
        code: 'CODE',
        context: { key: 'value' },
      });
    });
  });
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('isValidationError', () => {
  it('should return true for ValidationError', () => {
    const error = new ValidationError('Error', 'CODE');

    expect(isValidationError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Error');

    expect(isValidationError(error)).toBe(false);
  });

  it('should return false for DomainError', () => {
    const error = new DomainError('Error', 'CODE');

    expect(isValidationError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isValidationError(null)).toBe(false);
    expect(isValidationError(undefined)).toBe(false);
    expect(isValidationError('string')).toBe(false);
    expect(isValidationError({ code: 'CODE' })).toBe(false);
  });
});

describe('isDomainError', () => {
  it('should return true for DomainError', () => {
    const error = new DomainError('Error', 'CODE');

    expect(isDomainError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Error');

    expect(isDomainError(error)).toBe(false);
  });

  it('should return false for ValidationError', () => {
    const error = new ValidationError('Error', 'CODE');

    expect(isDomainError(error)).toBe(false);
  });

  it('should return false for non-error values', () => {
    expect(isDomainError(null)).toBe(false);
    expect(isDomainError(undefined)).toBe(false);
    expect(isDomainError('string')).toBe(false);
    expect(isDomainError({ code: 'CODE' })).toBe(false);
  });
});
