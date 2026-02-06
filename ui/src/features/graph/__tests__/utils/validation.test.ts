/**
 * Validation Tests
 * Tests for input validation utilities
 * @module features/graph/__tests__/utils/validation.test
 */

import { describe, it, expect } from 'vitest';
import {
  validateScanId,
  validateNodeId,
  isValidNodeType,
  isValidEdgeType,
  validateFilters,
  validateExtendedFilters,
  validateSearchQuery,
  validateDepth,
  MAX_DEPTH,
  validateConfidence,
  validateGraphFetchParams,
  validateBlastRadiusParams,
  formatValidationErrors,
  getFirstError,
  hasFieldError,
  getFieldError,
} from '../../utils/validation';
import { createMockFilters, createMockExtendedFilters } from './testUtils';

describe('validation', () => {
  describe('validateScanId', () => {
    it('should reject undefined/null', () => {
      expect(validateScanId(undefined)).toEqual({
        valid: false,
        error: 'Scan ID is required',
        field: 'scanId',
      });
      expect(validateScanId(null)).toEqual({
        valid: false,
        error: 'Scan ID is required',
        field: 'scanId',
      });
    });

    it('should reject non-string values', () => {
      const result = validateScanId(123 as any);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Scan ID must be a string');
    });

    it('should reject empty string', () => {
      expect(validateScanId('')).toMatchObject({ valid: false, error: 'Scan ID cannot be empty' });
      expect(validateScanId('   ')).toMatchObject({ valid: false, error: 'Scan ID cannot be empty' });
    });

    it('should reject too long IDs', () => {
      const longId = 'a'.repeat(101);

      const result = validateScanId(longId);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Scan ID is too long');
    });

    it('should accept valid UUID', () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';

      const result = validateScanId(uuid);

      expect(result.valid).toBe(true);
    });

    it('should accept valid alphanumeric ID', () => {
      expect(validateScanId('scan-123')).toEqual({ valid: true });
      expect(validateScanId('scan_123')).toEqual({ valid: true });
      expect(validateScanId('SCAN123')).toEqual({ valid: true });
    });

    it('should reject invalid format', () => {
      const result = validateScanId('scan id with spaces');

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid scan ID format');
    });
  });

  describe('validateNodeId', () => {
    it('should reject undefined/null', () => {
      expect(validateNodeId(undefined)).toMatchObject({
        valid: false,
        error: 'Node ID is required',
      });
      expect(validateNodeId(null)).toMatchObject({
        valid: false,
        error: 'Node ID is required',
      });
    });

    it('should reject non-string values', () => {
      const result = validateNodeId({} as any);

      expect(result.valid).toBe(false);
    });

    it('should reject empty string', () => {
      expect(validateNodeId('')).toMatchObject({ valid: false });
    });

    it('should reject too long IDs', () => {
      const longId = 'a'.repeat(201);

      expect(validateNodeId(longId)).toMatchObject({
        valid: false,
        error: 'Node ID is too long',
      });
    });

    it('should reject control characters', () => {
      expect(validateNodeId('node\x00id')).toMatchObject({
        valid: false,
        error: 'Node ID contains invalid characters',
      });
    });

    it('should accept various valid node IDs', () => {
      expect(validateNodeId('aws_s3_bucket.main')).toEqual({ valid: true });
      expect(validateNodeId('module.vpc/resource.subnet')).toEqual({ valid: true });
      expect(validateNodeId('terraform-resource-123')).toEqual({ valid: true });
    });
  });

  describe('isValidNodeType', () => {
    it('should return true for valid node types', () => {
      expect(isValidNodeType('terraform_resource')).toBe(true);
      expect(isValidNodeType('terraform_module')).toBe(true);
      expect(isValidNodeType('helm_chart')).toBe(true);
      expect(isValidNodeType('k8s_resource')).toBe(true);
      expect(isValidNodeType('terraform_data_source')).toBe(true);
      expect(isValidNodeType('external_reference')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidNodeType('invalid')).toBe(false);
      expect(isValidNodeType('')).toBe(false);
      expect(isValidNodeType(null)).toBe(false);
      expect(isValidNodeType(123)).toBe(false);
    });
  });

  describe('isValidEdgeType', () => {
    it('should return true for standard edge types', () => {
      expect(isValidEdgeType('DEPENDS_ON')).toBe(true);
      expect(isValidEdgeType('REFERENCES')).toBe(true);
      expect(isValidEdgeType('CONTAINS')).toBe(true);
      expect(isValidEdgeType('IMPORTS')).toBe(true);
    });

    it('should return true for Terragrunt edge types (TASK-TG-008)', () => {
      expect(isValidEdgeType('tg_includes')).toBe(true);
      expect(isValidEdgeType('tg_depends_on')).toBe(true);
      expect(isValidEdgeType('tg_passes_input')).toBe(true);
      expect(isValidEdgeType('tg_sources')).toBe(true);
    });

    it('should return false for invalid types', () => {
      expect(isValidEdgeType('INVALID')).toBe(false);
      expect(isValidEdgeType('depends_on')).toBe(false); // Case sensitive
      expect(isValidEdgeType('TG_INCLUDES')).toBe(false); // Wrong case
    });
  });

  describe('validateFilters', () => {
    it('should return valid for null/undefined', () => {
      expect(validateFilters(null)).toEqual({ valid: true, errors: [] });
      expect(validateFilters(undefined)).toEqual({ valid: true, errors: [] });
    });

    it('should validate nodeTypes is array', () => {
      const result = validateFilters({ nodeTypes: 'not-array' as any });

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('nodeTypes');
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should reject invalid node types', () => {
      const result = validateFilters({
        nodeTypes: ['terraform_resource', 'invalid_type'] as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_NODE_TYPE');
    });

    it('should validate search is string', () => {
      const result = validateFilters({ search: 123 as any });

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('search');
    });

    it('should reject too long search', () => {
      const result = validateFilters({ search: 'a'.repeat(201) });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('TOO_LONG');
    });

    it('should validate showBlastRadius is boolean', () => {
      const result = validateFilters({ showBlastRadius: 'yes' as any });

      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('showBlastRadius');
    });

    it('should accept valid filters', () => {
      const filters = createMockFilters();

      const result = validateFilters(filters);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateExtendedFilters', () => {
    it('should include base filter validation', () => {
      const result = validateExtendedFilters({ search: 123 as any });

      expect(result.valid).toBe(false);
      expect(result.errors.find((e) => e.field === 'search')).toBeDefined();
    });

    it('should validate edgeTypes', () => {
      const result = validateExtendedFilters({
        edgeTypes: ['DEPENDS_ON', 'INVALID'] as any,
      });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_EDGE_TYPE');
    });

    it('should validate minConfidence range', () => {
      expect(validateExtendedFilters({ minConfidence: -0.1 })).toMatchObject({
        valid: false,
      });
      expect(validateExtendedFilters({ minConfidence: 1.5 })).toMatchObject({
        valid: false,
      });
    });

    it('should validate minConfidence type', () => {
      const result = validateExtendedFilters({ minConfidence: 'high' as any });

      expect(result.valid).toBe(false);
      expect(result.errors[0].code).toBe('INVALID_TYPE');
    });

    it('should validate maxDepth', () => {
      expect(validateExtendedFilters({ maxDepth: -1 })).toMatchObject({
        valid: false,
      });
    });

    it('should allow Infinity for maxDepth', () => {
      const result = validateExtendedFilters({ maxDepth: Infinity });

      expect(result.valid).toBe(true);
    });

    it('should validate showConnectedOnly', () => {
      const result = validateExtendedFilters({ showConnectedOnly: 1 as any });

      expect(result.valid).toBe(false);
    });

    it('should accept valid extended filters', () => {
      const filters = createMockExtendedFilters();

      const result = validateExtendedFilters(filters);

      expect(result.valid).toBe(true);
    });
  });

  describe('validateSearchQuery', () => {
    it('should return valid for null/undefined (optional)', () => {
      expect(validateSearchQuery(null)).toEqual({ valid: true });
      expect(validateSearchQuery(undefined)).toEqual({ valid: true });
    });

    it('should reject non-string', () => {
      const result = validateSearchQuery(123 as any);

      expect(result.valid).toBe(false);
    });

    it('should reject too long query', () => {
      const result = validateSearchQuery('a'.repeat(201));

      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should reject HTML characters', () => {
      expect(validateSearchQuery('<script>')).toMatchObject({
        valid: false,
        error: 'Search query contains invalid characters',
      });
      expect(validateSearchQuery('test>alert')).toMatchObject({ valid: false });
    });

    it('should accept valid queries', () => {
      expect(validateSearchQuery('aws_s3_bucket')).toEqual({ valid: true });
      expect(validateSearchQuery('my-resource')).toEqual({ valid: true });
    });
  });

  describe('validateDepth', () => {
    it('should return valid for null/undefined (optional)', () => {
      expect(validateDepth(null)).toEqual({ valid: true });
      expect(validateDepth(undefined)).toEqual({ valid: true });
    });

    it('should reject non-numbers', () => {
      expect(validateDepth('5' as any)).toMatchObject({ valid: false });
      expect(validateDepth(NaN)).toMatchObject({ valid: false });
      expect(validateDepth(Infinity)).toMatchObject({ valid: false });
    });

    it('should reject non-integers', () => {
      expect(validateDepth(5.5)).toMatchObject({
        valid: false,
        error: 'Depth must be a whole number',
      });
    });

    it('should reject negative', () => {
      expect(validateDepth(-1)).toMatchObject({
        valid: false,
        error: 'Depth cannot be negative',
      });
    });

    it('should reject values exceeding MAX_DEPTH', () => {
      expect(validateDepth(MAX_DEPTH + 1)).toMatchObject({
        valid: false,
        error: `Depth cannot exceed ${MAX_DEPTH}`,
      });
    });

    it('should accept valid depth values', () => {
      expect(validateDepth(0)).toEqual({ valid: true });
      expect(validateDepth(5)).toEqual({ valid: true });
      expect(validateDepth(MAX_DEPTH)).toEqual({ valid: true });
    });
  });

  describe('validateConfidence', () => {
    it('should return valid for null/undefined', () => {
      expect(validateConfidence(null)).toEqual({ valid: true });
      expect(validateConfidence(undefined)).toEqual({ valid: true });
    });

    it('should reject non-numbers', () => {
      expect(validateConfidence('0.5' as any)).toMatchObject({ valid: false });
      expect(validateConfidence(NaN)).toMatchObject({ valid: false });
    });

    it('should reject out of range values', () => {
      expect(validateConfidence(-0.1)).toMatchObject({
        valid: false,
        error: 'Confidence cannot be negative',
      });
      expect(validateConfidence(1.1)).toMatchObject({
        valid: false,
        error: 'Confidence cannot exceed 1',
      });
    });

    it('should accept valid confidence values', () => {
      expect(validateConfidence(0)).toEqual({ valid: true });
      expect(validateConfidence(0.5)).toEqual({ valid: true });
      expect(validateConfidence(1)).toEqual({ valid: true });
    });
  });

  describe('validateGraphFetchParams', () => {
    it('should validate all params', () => {
      const result = validateGraphFetchParams({
        scanId: '',
        nodeTypes: ['invalid'] as any,
        search: '<script>',
        maxDepth: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });

    it('should accept valid params', () => {
      const result = validateGraphFetchParams({
        scanId: 'valid-scan-id',
        nodeTypes: ['terraform_resource'],
        search: 'test',
        maxDepth: 5,
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('validateBlastRadiusParams', () => {
    it('should validate all params', () => {
      const result = validateBlastRadiusParams({
        scanId: '',
        nodeId: '',
        maxDepth: -1,
      });

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('should accept valid params', () => {
      const result = validateBlastRadiusParams({
        scanId: 'scan-123',
        nodeId: 'node-456',
        maxDepth: 3,
      });

      expect(result.valid).toBe(true);
    });
  });

  describe('formatValidationErrors', () => {
    it('should return empty string for no errors', () => {
      expect(formatValidationErrors([])).toBe('');
    });

    it('should return single error message directly', () => {
      expect(
        formatValidationErrors([{ field: 'test', message: 'Error message' }])
      ).toBe('Error message');
    });

    it('should format multiple errors', () => {
      const formatted = formatValidationErrors([
        { field: 'field1', message: 'Error 1' },
        { field: 'field2', message: 'Error 2' },
      ]);

      expect(formatted).toContain('Multiple validation errors');
      expect(formatted).toContain('field1: Error 1');
      expect(formatted).toContain('field2: Error 2');
    });
  });

  describe('getFirstError', () => {
    it('should return undefined for no errors', () => {
      expect(getFirstError({ valid: true, errors: [] })).toBeUndefined();
    });

    it('should return first error message', () => {
      expect(
        getFirstError({
          valid: false,
          errors: [
            { field: 'a', message: 'First' },
            { field: 'b', message: 'Second' },
          ],
        })
      ).toBe('First');
    });
  });

  describe('hasFieldError', () => {
    it('should return false when no errors', () => {
      expect(hasFieldError({ valid: true, errors: [] }, 'field')).toBe(false);
    });

    it('should return true when field has error', () => {
      expect(
        hasFieldError(
          { valid: false, errors: [{ field: 'myField', message: 'Error' }] },
          'myField'
        )
      ).toBe(true);
    });

    it('should return false for different field', () => {
      expect(
        hasFieldError(
          { valid: false, errors: [{ field: 'other', message: 'Error' }] },
          'myField'
        )
      ).toBe(false);
    });
  });

  describe('getFieldError', () => {
    it('should return undefined when no error for field', () => {
      expect(getFieldError({ valid: true, errors: [] }, 'field')).toBeUndefined();
    });

    it('should return error message for field', () => {
      expect(
        getFieldError(
          { valid: false, errors: [{ field: 'myField', message: 'My error' }] },
          'myField'
        )
      ).toBe('My error');
    });
  });
});
