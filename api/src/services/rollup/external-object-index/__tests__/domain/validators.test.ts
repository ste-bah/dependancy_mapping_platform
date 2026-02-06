/**
 * Domain Validators Tests
 * @module services/rollup/external-object-index/__tests__/domain/validators.test
 *
 * Unit tests for domain validation utilities.
 *
 * TASK-ROLLUP-003: Domain layer unit tests
 */

import { describe, it, expect } from 'vitest';
import {
  validateArn,
  isValidArn,
  normalizeArn,
  validateContainerImage,
  isValidContainerImage,
  validateGitUrl,
  isValidGitUrl,
  validateStoragePath,
  isValidStoragePath,
  validateK8sReference,
  isValidK8sReference,
  validateConfidence,
  validateNonEmptyString,
  validateExternalReference,
  validateBatch,
} from '../../domain/validators.js';
import { Result } from '../../domain/result.js';

describe('Validators', () => {
  // ==========================================================================
  // ARN Validation Tests
  // ==========================================================================

  describe('validateArn', () => {
    describe('valid ARNs', () => {
      const validArns = [
        {
          arn: 'arn:aws:s3:::my-bucket',
          expected: { partition: 'aws', service: 's3', region: '', account: '', resource: 'my-bucket' },
        },
        {
          arn: 'arn:aws:lambda:us-east-1:123456789012:function:my-func',
          expected: {
            partition: 'aws',
            service: 'lambda',
            region: 'us-east-1',
            account: '123456789012',
            resource: 'function:my-func',
            resourceType: 'function',
            resourceId: 'my-func',
          },
        },
        {
          arn: 'arn:aws:iam::123456789012:role/my-role',
          expected: {
            partition: 'aws',
            service: 'iam',
            region: '',
            account: '123456789012',
            resource: 'role/my-role',
            resourceType: 'role',
            resourceId: 'my-role',
          },
        },
        {
          arn: 'arn:aws-cn:ec2:cn-north-1:123456789012:instance/i-1234567890',
          expected: {
            partition: 'aws-cn',
            service: 'ec2',
            region: 'cn-north-1',
            account: '123456789012',
            resource: 'instance/i-1234567890',
            resourceType: 'instance',
            resourceId: 'i-1234567890',
          },
        },
      ];

      for (const { arn, expected } of validArns) {
        it(`should parse valid ARN: ${arn}`, () => {
          const result = validateArn(arn);

          expect(Result.isOk(result)).toBe(true);
          if (Result.isOk(result)) {
            expect(result.value.partition).toBe(expected.partition);
            expect(result.value.service).toBe(expected.service);
            expect(result.value.region).toBe(expected.region);
            expect(result.value.account).toBe(expected.account);
            expect(result.value.resource).toBe(expected.resource);
            if (expected.resourceType) {
              expect(result.value.resourceType).toBe(expected.resourceType);
            }
            if (expected.resourceId) {
              expect(result.value.resourceId).toBe(expected.resourceId);
            }
          }
        });
      }
    });

    describe('invalid ARNs', () => {
      const invalidArns = [
        { arn: '', reason: 'empty' },
        { arn: 'not-an-arn', reason: 'no arn prefix' },
        { arn: 'arn:aws:', reason: 'incomplete' },
        { arn: 'ARN:AWS:S3:::bucket', reason: 'uppercase' },
        { arn: 'arn:aws:s3', reason: 'missing resource' },
      ];

      for (const { arn, reason } of invalidArns) {
        it(`should reject invalid ARN (${reason}): ${arn}`, () => {
          const result = validateArn(arn);
          expect(Result.isErr(result)).toBe(true);
        });
      }
    });

    it('should reject null', () => {
      const result = validateArn(null as any);
      expect(Result.isErr(result)).toBe(true);
    });
  });

  describe('normalizeArn', () => {
    it('should normalize ARN for comparison', () => {
      const normalized = normalizeArn('arn:aws:s3:::My-Bucket');
      expect(normalized).toBe('arn:aws:s3:::my-bucket');
    });

    it('should remove region and account for cross-region matching', () => {
      const normalized = normalizeArn('arn:aws:lambda:us-east-1:123456789:function:my-func');
      expect(normalized).toBe('arn:aws:lambda:::function:my-func');
    });

    it('should handle invalid ARN gracefully', () => {
      const normalized = normalizeArn('invalid');
      expect(normalized).toBe('invalid');
    });
  });

  // ==========================================================================
  // Container Image Validation Tests
  // ==========================================================================

  describe('validateContainerImage', () => {
    describe('valid images', () => {
      const validImages = [
        { image: 'nginx', expected: { repository: 'nginx' } },
        { image: 'nginx:latest', expected: { repository: 'nginx', tag: 'latest' } },
        { image: 'library/nginx', expected: { repository: 'library/nginx' } },
        { image: 'docker.io/library/nginx:1.21', expected: { registry: 'docker.io', repository: 'library/nginx', tag: '1.21' } },
        { image: 'gcr.io/project/image:tag', expected: { registry: 'gcr.io', repository: 'project/image', tag: 'tag' } },
        { image: 'localhost:5000/my-app', expected: { registry: 'localhost:5000', repository: 'my-app' } },
        { image: 'nginx@sha256:abc123', expected: { repository: 'nginx', digest: 'sha256:abc123' } },
      ];

      for (const { image, expected } of validImages) {
        it(`should parse valid image: ${image}`, () => {
          const result = validateContainerImage(image);

          expect(Result.isOk(result)).toBe(true);
          if (Result.isOk(result)) {
            expect(result.value.repository).toBe(expected.repository);
            if (expected.registry) {
              expect(result.value.registry).toBe(expected.registry);
            }
            if (expected.tag) {
              expect(result.value.tag).toBe(expected.tag);
            }
            if (expected.digest) {
              expect(result.value.digest).toBe(expected.digest);
            }
          }
        });
      }
    });

    describe('invalid images', () => {
      const invalidImages = [
        { image: '', reason: 'empty' },
        { image: '   ', reason: 'whitespace only' },
      ];

      for (const { image, reason } of invalidImages) {
        it(`should reject invalid image (${reason})`, () => {
          const result = validateContainerImage(image);
          expect(Result.isErr(result)).toBe(true);
        });
      }
    });
  });

  // ==========================================================================
  // Git URL Validation Tests
  // ==========================================================================

  describe('validateGitUrl', () => {
    describe('valid URLs', () => {
      const validUrls = [
        {
          url: 'https://github.com/owner/repo',
          expected: { protocol: 'https', host: 'github.com', owner: 'owner', repo: 'repo' },
        },
        {
          url: 'https://github.com/owner/repo.git',
          expected: { protocol: 'https', host: 'github.com', owner: 'owner', repo: 'repo' },
        },
        {
          url: 'git@github.com:owner/repo.git',
          expected: { protocol: 'ssh', host: 'github.com', owner: 'owner', repo: 'repo' },
        },
        {
          url: 'https://gitlab.com/group/project',
          expected: { protocol: 'https', host: 'gitlab.com', owner: 'group', repo: 'project' },
        },
      ];

      for (const { url, expected } of validUrls) {
        it(`should parse valid URL: ${url}`, () => {
          const result = validateGitUrl(url);

          expect(Result.isOk(result)).toBe(true);
          if (Result.isOk(result)) {
            expect(result.value.protocol).toBe(expected.protocol);
            expect(result.value.host).toBe(expected.host);
            expect(result.value.owner).toBe(expected.owner);
            expect(result.value.repo).toBe(expected.repo);
          }
        });
      }
    });

    describe('invalid URLs', () => {
      const invalidUrls = [
        { url: '', reason: 'empty' },
        { url: 'not-a-url', reason: 'invalid format' },
        { url: 'https://github.com', reason: 'missing owner/repo' },
        { url: 'ftp://github.com/owner/repo', reason: 'wrong protocol' },
      ];

      for (const { url, reason } of invalidUrls) {
        it(`should reject invalid URL (${reason}): ${url}`, () => {
          const result = validateGitUrl(url);
          expect(Result.isErr(result)).toBe(true);
        });
      }
    });
  });

  // ==========================================================================
  // Storage Path Validation Tests
  // ==========================================================================

  describe('validateStoragePath', () => {
    describe('valid paths', () => {
      const validPaths = [
        {
          path: 's3://my-bucket',
          expected: { provider: 'aws', bucket: 'my-bucket' },
        },
        {
          path: 's3://my-bucket/path/to/file',
          expected: { provider: 'aws', bucket: 'my-bucket', key: 'path/to/file' },
        },
        {
          path: 'gs://my-bucket',
          expected: { provider: 'gcp', bucket: 'my-bucket' },
        },
        {
          path: 'gs://my-bucket/path/to/file',
          expected: { provider: 'gcp', bucket: 'my-bucket', key: 'path/to/file' },
        },
        {
          path: 'https://myaccount.blob.core.windows.net/container/path',
          expected: { provider: 'azure', bucket: 'container', key: 'path' },
        },
      ];

      for (const { path, expected } of validPaths) {
        it(`should parse valid path: ${path}`, () => {
          const result = validateStoragePath(path);

          expect(Result.isOk(result)).toBe(true);
          if (Result.isOk(result)) {
            expect(result.value.provider).toBe(expected.provider);
            expect(result.value.bucket).toBe(expected.bucket);
            if (expected.key) {
              expect(result.value.key).toBe(expected.key);
            }
          }
        });
      }
    });

    describe('invalid paths', () => {
      const invalidPaths = [
        { path: '', reason: 'empty' },
        { path: '/local/path', reason: 'local path' },
        { path: 'http://example.com/file', reason: 'http URL' },
      ];

      for (const { path, reason } of invalidPaths) {
        it(`should reject invalid path (${reason}): ${path}`, () => {
          const result = validateStoragePath(path);
          expect(Result.isErr(result)).toBe(true);
        });
      }
    });
  });

  // ==========================================================================
  // K8s Reference Validation Tests
  // ==========================================================================

  describe('validateK8sReference', () => {
    describe('valid references', () => {
      const validRefs = [
        {
          ref: 'deployment/nginx',
          expected: { kind: 'deployment', name: 'nginx' },
        },
        {
          ref: 'default/deployment/nginx',
          expected: { namespace: 'default', kind: 'deployment', name: 'nginx' },
        },
        {
          ref: 'kube-system/configmap/kube-proxy',
          expected: { namespace: 'kube-system', kind: 'configmap', name: 'kube-proxy' },
        },
      ];

      for (const { ref, expected } of validRefs) {
        it(`should parse valid reference: ${ref}`, () => {
          const result = validateK8sReference(ref);

          expect(Result.isOk(result)).toBe(true);
          if (Result.isOk(result)) {
            expect(result.value.kind).toBe(expected.kind);
            expect(result.value.name).toBe(expected.name);
            if (expected.namespace) {
              expect(result.value.namespace).toBe(expected.namespace);
            }
          }
        });
      }
    });

    describe('invalid references', () => {
      const invalidRefs = [
        { ref: '', reason: 'empty' },
        { ref: 'deployment', reason: 'missing name' },
        { ref: 'a/b/c/d', reason: 'too many parts' },
      ];

      for (const { ref, reason } of invalidRefs) {
        it(`should reject invalid reference (${reason}): ${ref}`, () => {
          const result = validateK8sReference(ref);
          expect(Result.isErr(result)).toBe(true);
        });
      }
    });
  });

  // ==========================================================================
  // Confidence Validation Tests
  // ==========================================================================

  describe('validateConfidence', () => {
    it('should accept valid confidence', () => {
      expect(Result.isOk(validateConfidence(0.5))).toBe(true);
      expect(Result.isOk(validateConfidence(0))).toBe(true);
      expect(Result.isOk(validateConfidence(1))).toBe(true);
    });

    it('should default to 1.0 for null/undefined', () => {
      const nullResult = validateConfidence(null);
      const undefinedResult = validateConfidence(undefined);

      expect(Result.isOk(nullResult)).toBe(true);
      expect(Result.isOk(undefinedResult)).toBe(true);
      if (Result.isOk(nullResult)) {
        expect(nullResult.value).toBe(1.0);
      }
    });

    it('should reject non-numbers', () => {
      expect(Result.isErr(validateConfidence('0.5'))).toBe(true);
      expect(Result.isErr(validateConfidence({}))).toBe(true);
    });

    it('should reject out of range values', () => {
      expect(Result.isErr(validateConfidence(-0.1))).toBe(true);
      expect(Result.isErr(validateConfidence(1.1))).toBe(true);
    });

    it('should reject NaN', () => {
      expect(Result.isErr(validateConfidence(NaN))).toBe(true);
    });
  });

  // ==========================================================================
  // External Reference Validation Tests
  // ==========================================================================

  describe('validateExternalReference', () => {
    it('should validate ARN references', () => {
      const valid = validateExternalReference('arn', 'arn:aws:s3:::my-bucket');
      const invalid = validateExternalReference('arn', 'not-an-arn');

      expect(Result.isOk(valid)).toBe(true);
      expect(Result.isErr(invalid)).toBe(true);
    });

    it('should validate container image references', () => {
      const valid = validateExternalReference('container_image', 'nginx:latest');
      // Container images have flexible validation, so most strings pass
      expect(Result.isOk(valid)).toBe(true);
    });

    it('should validate storage path references', () => {
      const valid = validateExternalReference('storage_path', 's3://bucket/key');
      const invalid = validateExternalReference('storage_path', '/local/path');

      expect(Result.isOk(valid)).toBe(true);
      expect(Result.isErr(invalid)).toBe(true);
    });

    it('should be lenient for generic resource IDs', () => {
      const result = validateExternalReference('resource_id', 'any-string-123');
      expect(Result.isOk(result)).toBe(true);
    });
  });

  // ==========================================================================
  // Batch Validation Tests
  // ==========================================================================

  describe('validateBatch', () => {
    it('should separate valid from invalid', () => {
      const values = [
        'arn:aws:s3:::bucket-1',
        'not-an-arn',
        'arn:aws:s3:::bucket-2',
        '',
      ];

      const result = validateBatch(values, validateArn);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(2);
      expect(result.invalid[0].index).toBe(1);
      expect(result.invalid[1].index).toBe(3);
    });

    it('should handle all valid', () => {
      const values = [
        'arn:aws:s3:::bucket-1',
        'arn:aws:s3:::bucket-2',
      ];

      const result = validateBatch(values, validateArn);

      expect(result.valid).toHaveLength(2);
      expect(result.invalid).toHaveLength(0);
    });

    it('should handle all invalid', () => {
      const values = ['invalid-1', 'invalid-2'];

      const result = validateBatch(values, validateArn);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const result = validateBatch([], validateArn);

      expect(result.valid).toHaveLength(0);
      expect(result.invalid).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  describe('isValid helpers', () => {
    it('isValidArn should work', () => {
      expect(isValidArn('arn:aws:s3:::bucket')).toBe(true);
      expect(isValidArn('invalid')).toBe(false);
    });

    it('isValidContainerImage should work', () => {
      expect(isValidContainerImage('nginx:latest')).toBe(true);
      expect(isValidContainerImage('')).toBe(false);
    });

    it('isValidGitUrl should work', () => {
      expect(isValidGitUrl('https://github.com/owner/repo')).toBe(true);
      expect(isValidGitUrl('invalid')).toBe(false);
    });

    it('isValidStoragePath should work', () => {
      expect(isValidStoragePath('s3://bucket/key')).toBe(true);
      expect(isValidStoragePath('/local/path')).toBe(false);
    });

    it('isValidK8sReference should work', () => {
      expect(isValidK8sReference('default/deployment/nginx')).toBe(true);
      expect(isValidK8sReference('invalid')).toBe(false);
    });
  });
});
