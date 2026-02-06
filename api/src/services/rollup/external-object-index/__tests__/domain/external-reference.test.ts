/**
 * External Reference Value Object Tests
 * @module services/rollup/external-object-index/__tests__/domain/external-reference.test
 *
 * Unit tests for ExternalReferenceVO value object.
 *
 * TASK-ROLLUP-003: Domain layer unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  ExternalReferenceVO,
  createArnReference,
  createK8sReference,
  createContainerImageReference,
  createStoragePathReference,
} from '../../domain/external-reference.js';
import { Result } from '../../domain/result.js';
import { CloudProvider, computeReferenceHash } from '../../domain/types.js';

describe('ExternalReferenceVO', () => {
  // ==========================================================================
  // Factory Method Tests
  // ==========================================================================

  describe('create', () => {
    it('should create a valid ARN reference', () => {
      const result = ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        provider: CloudProvider.AWS,
        confidence: 1.0,
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.refType).toBe('arn');
        expect(result.value.identifier).toBe('arn:aws:s3:::my-bucket');
        expect(result.value.provider).toBe(CloudProvider.AWS);
        expect(result.value.confidence).toBe(1.0);
      }
    });

    it('should auto-detect provider for ARN', () => {
      const result = ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:lambda:us-east-1:123456789:function:my-func',
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.provider).toBe(CloudProvider.AWS);
      }
    });

    it('should auto-detect provider for S3 storage path', () => {
      const result = ExternalReferenceVO.create({
        refType: 'storage_path',
        identifier: 's3://my-bucket/path/to/file',
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.provider).toBe(CloudProvider.AWS);
      }
    });

    it('should auto-detect provider for GCS storage path', () => {
      const result = ExternalReferenceVO.create({
        refType: 'storage_path',
        identifier: 'gs://my-bucket/path/to/file',
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.provider).toBe(CloudProvider.GCP);
      }
    });

    it('should default confidence to 1.0', () => {
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'i-1234567890abcdef0',
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.confidence).toBe(1.0);
      }
    });

    it('should accept attributes as Map', () => {
      const attrs = new Map([['key', 'value']]);
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'test-id',
        attributes: attrs,
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.attributes.get('key')).toBe('value');
      }
    });

    it('should accept attributes as object', () => {
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'test-id',
        attributes: { key: 'value' },
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.attributes.get('key')).toBe('value');
      }
    });
  });

  // ==========================================================================
  // Validation Tests
  // ==========================================================================

  describe('validation', () => {
    it('should reject invalid refType', () => {
      const result = ExternalReferenceVO.create({
        refType: 'invalid_type' as any,
        identifier: 'test',
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('INVALID_VALUE');
      }
    });

    it('should reject empty identifier', () => {
      const result = ExternalReferenceVO.create({
        refType: 'arn',
        identifier: '',
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        // Empty string is treated as "not provided" by implementation
        expect(result.error.code).toBe('REQUIRED_FIELD');
      }
    });

    it('should reject null identifier', () => {
      const result = ExternalReferenceVO.create({
        refType: 'arn',
        identifier: null as any,
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('REQUIRED_FIELD');
      }
    });

    it('should reject invalid ARN format', () => {
      const result = ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'not-a-valid-arn',
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('INVALID_FORMAT');
      }
    });

    it('should reject confidence below 0', () => {
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'test',
        confidence: -0.1,
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('OUT_OF_RANGE');
      }
    });

    it('should reject confidence above 1', () => {
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'test',
        confidence: 1.1,
      });

      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error.code).toBe('OUT_OF_RANGE');
      }
    });

    it('should reject NaN confidence', () => {
      const result = ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'test',
        confidence: NaN,
      });

      expect(Result.isErr(result)).toBe(true);
    });
  });

  // ==========================================================================
  // ARN Validation Tests
  // ==========================================================================

  describe('ARN validation', () => {
    const validArns = [
      'arn:aws:s3:::my-bucket',
      'arn:aws:lambda:us-east-1:123456789:function:my-func',
      'arn:aws:iam::123456789:role/my-role',
      'arn:aws-cn:ec2:cn-north-1:123456789:instance/i-1234567890',
      'arn:aws-gov:s3:::gov-bucket',
    ];

    for (const arn of validArns) {
      it(`should accept valid ARN: ${arn}`, () => {
        const result = ExternalReferenceVO.create({
          refType: 'arn',
          identifier: arn,
        });
        expect(Result.isOk(result)).toBe(true);
      });
    }

    const invalidArns = [
      'not-an-arn',
      'arn:aws:',
      'arn:aws:s3',
      'ARN:AWS:S3:::bucket', // uppercase
    ];

    for (const arn of invalidArns) {
      it(`should reject invalid ARN: ${arn}`, () => {
        const result = ExternalReferenceVO.create({
          refType: 'arn',
          identifier: arn,
        });
        expect(Result.isErr(result)).toBe(true);
      });
    }
  });

  // ==========================================================================
  // Reference Hash Tests
  // ==========================================================================

  describe('referenceHash', () => {
    it('should compute consistent hash for same reference', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      expect(ref1.referenceHash).toBe(ref2.referenceHash);
    });

    it('should compute different hash for different identifiers', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::bucket-1',
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::bucket-2',
      }));

      expect(ref1.referenceHash).not.toBe(ref2.referenceHash);
    });

    it('should compute different hash for different types', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'resource_id',
        identifier: 'arn:aws:s3:::my-bucket', // Same identifier, different type
      }));

      expect(ref1.referenceHash).not.toBe(ref2.referenceHash);
    });

    it('should match computeReferenceHash function', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      const directHash = computeReferenceHash('arn', 'arn:aws:s3:::my-bucket');
      expect(ref.referenceHash).toBe(directHash);
    });
  });

  // ==========================================================================
  // Equality Tests
  // ==========================================================================

  describe('equals', () => {
    it('should be equal for same reference', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      expect(ref1.equals(ref2)).toBe(true);
    });

    it('should not be equal for different identifiers', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::bucket-1',
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::bucket-2',
      }));

      expect(ref1.equals(ref2)).toBe(false);
    });

    it('should handle null comparison', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      expect(ref.equals(null as any)).toBe(false);
      expect(ref.equals(undefined as any)).toBe(false);
    });
  });

  describe('deepEquals', () => {
    it('should compare all properties', () => {
      const ref1 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        confidence: 0.8,
        attributes: { key: 'value' },
      }));

      const ref2 = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        confidence: 0.9, // Different confidence
        attributes: { key: 'value' },
      }));

      expect(ref1.equals(ref2)).toBe(true); // Same hash
      expect(ref1.deepEquals(ref2)).toBe(false); // Different confidence
    });
  });

  // ==========================================================================
  // Serialization Tests
  // ==========================================================================

  describe('toJSON', () => {
    it('should serialize to plain object', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        provider: CloudProvider.AWS,
        confidence: 0.95,
        attributes: { region: 'us-east-1' },
      }));

      const json = ref.toJSON();

      expect(json.refType).toBe('arn');
      expect(json.identifier).toBe('arn:aws:s3:::my-bucket');
      expect(json.provider).toBe('aws');
      expect(json.confidence).toBe(0.95);
      expect(json.attributes).toEqual({ region: 'us-east-1' });
      expect(json.referenceHash).toBe(ref.referenceHash);
    });
  });

  describe('reconstitute', () => {
    it('should reconstitute from DTO', () => {
      const dto = {
        refType: 'arn' as const,
        identifier: 'arn:aws:s3:::my-bucket',
        provider: 'aws' as const,
        attributes: { key: 'value' },
        confidence: 0.9,
        referenceHash: 'hash',
      };

      const ref = ExternalReferenceVO.reconstitute(dto);

      expect(ref.refType).toBe('arn');
      expect(ref.identifier).toBe('arn:aws:s3:::my-bucket');
      expect(ref.provider).toBe('aws');
      expect(ref.confidence).toBe(0.9);
      expect(ref.attributes.get('key')).toBe('value');
    });
  });

  // ==========================================================================
  // Transformation Tests
  // ==========================================================================

  describe('withConfidence', () => {
    it('should create copy with new confidence', () => {
      const original = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        confidence: 0.5,
      }));

      const updated = Result.unwrap(original.withConfidence(0.9));

      expect(updated.confidence).toBe(0.9);
      expect(original.confidence).toBe(0.5); // Original unchanged
      expect(updated.identifier).toBe(original.identifier);
    });

    it('should reject invalid confidence', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      const result = ref.withConfidence(1.5);
      expect(Result.isErr(result)).toBe(true);
    });
  });

  describe('withAttributes', () => {
    it('should create copy with merged attributes', () => {
      const original = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
        attributes: { key1: 'value1' },
      }));

      const updated = original.withAttributes({ key2: 'value2' });

      expect(updated.attributes.get('key1')).toBe('value1');
      expect(updated.attributes.get('key2')).toBe('value2');
      expect(original.attributes.has('key2')).toBe(false); // Original unchanged
    });
  });

  // ==========================================================================
  // Factory Function Tests
  // ==========================================================================

  describe('createArnReference', () => {
    it('should create ARN reference', () => {
      const result = createArnReference('arn:aws:s3:::my-bucket', 0.95);

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.refType).toBe('arn');
        expect(result.value.provider).toBe('aws');
        expect(result.value.confidence).toBe(0.95);
      }
    });
  });

  describe('createK8sReference', () => {
    it('should create K8s reference', () => {
      const result = createK8sReference('default', 'deployment', 'nginx');

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.refType).toBe('k8s_reference');
        expect(result.value.identifier).toBe('default/deployment/nginx');
        expect(result.value.provider).toBe('kubernetes');
        expect(result.value.attributes.get('namespace')).toBe('default');
        expect(result.value.attributes.get('kind')).toBe('deployment');
        expect(result.value.attributes.get('name')).toBe('nginx');
      }
    });
  });

  describe('createStoragePathReference', () => {
    it('should create S3 path reference', () => {
      const result = createStoragePathReference('s3://my-bucket/path/to/file');

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.refType).toBe('storage_path');
        expect(result.value.provider).toBe('aws');
      }
    });

    it('should create GCS path reference', () => {
      const result = createStoragePathReference('gs://my-bucket/path/to/file');

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.refType).toBe('storage_path');
        expect(result.value.provider).toBe('gcp');
      }
    });
  });

  // ==========================================================================
  // Immutability Tests
  // ==========================================================================

  describe('immutability', () => {
    it('should be frozen', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      expect(Object.isFrozen(ref)).toBe(true);
    });

    it('should not allow property modification', () => {
      const ref = Result.unwrap(ExternalReferenceVO.create({
        refType: 'arn',
        identifier: 'arn:aws:s3:::my-bucket',
      }));

      expect(() => {
        (ref as any).identifier = 'modified';
      }).toThrow();
    });
  });
});
