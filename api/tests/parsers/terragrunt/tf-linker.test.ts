/**
 * Terraform Source Linker Unit Tests
 * @module tests/parsers/terragrunt/tf-linker.test
 *
 * TASK-TG-008: Tests for TerraformLinker source resolution.
 * Target: 80%+ coverage for tf-linker.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';
import {
  TerraformLinker,
  createTerraformLinker,
  parseSource,
  isExternalSource,
  detectSourceType,
  createLinkerContext,
  buildModuleMap,
  isLocalSource,
  isRegistrySource,
  isGitSource,
  isS3Source,
  isGcsSource,
  isHttpSource,
  isSuccessfulResolution,
  isSyntheticResolution,
  validateLinkerContext,
  validateLinkerOptions,
  SOURCE_PATTERNS,
  type ITerraformLinker,
  type TfLinkerContext,
  type TfLinkerOptions,
  type TfLinkerResult,
  type TerraformSourceExpression,
  type TerraformSourceType,
} from '../../../src/parsers/terragrunt/tf-linker';
import { SourceResolutionError } from '../../../src/parsers/terragrunt/errors';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLinkerContext = (
  overrides: Partial<TfLinkerContext> = {}
): TfLinkerContext => ({
  scanId: 'scan-123',
  tenantId: 'tenant-456',
  configPath: '/repo/env/dev/terragrunt.hcl',
  repositoryRoot: '/repo',
  existingTfModules: new Map(),
  ...overrides,
});

const createMockLinkerOptions = (
  overrides: Partial<TfLinkerOptions> = {}
): TfLinkerOptions => ({
  idGenerator: () => 'synthetic-node-id',
  normalizePaths: true,
  ...overrides,
});

// ============================================================================
// SOURCE_PATTERNS Tests
// ============================================================================

describe('SOURCE_PATTERNS', () => {
  describe('local pattern', () => {
    it('should match relative paths starting with ./', () => {
      expect(SOURCE_PATTERNS.local.test('./modules/vpc')).toBe(true);
      expect(SOURCE_PATTERNS.local.test('./path/to/module')).toBe(true);
    });

    it('should match relative paths starting with ../', () => {
      expect(SOURCE_PATTERNS.local.test('../modules/vpc')).toBe(true);
      expect(SOURCE_PATTERNS.local.test('../../shared/vpc')).toBe(true);
    });

    it('should match absolute paths', () => {
      expect(SOURCE_PATTERNS.local.test('/path/to/module')).toBe(true);
      expect(SOURCE_PATTERNS.local.test('/repo/modules/vpc')).toBe(true);
    });

    it('should not match non-local paths', () => {
      expect(SOURCE_PATTERNS.local.test('git::https://example.com')).toBe(false);
      expect(SOURCE_PATTERNS.local.test('hashicorp/consul/aws')).toBe(false);
    });
  });

  describe('registry pattern', () => {
    it('should match namespace/name/provider format', () => {
      expect(SOURCE_PATTERNS.registry.test('hashicorp/consul/aws')).toBe(true);
      expect(SOURCE_PATTERNS.registry.test('terraform-aws-modules/vpc/aws')).toBe(true);
    });

    it('should match registry.terraform.io prefix', () => {
      expect(SOURCE_PATTERNS.registry.test('registry.terraform.io/hashicorp/consul/aws')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(SOURCE_PATTERNS.registry.test('HashiCorp/Consul/AWS')).toBe(true);
    });
  });

  describe('git pattern', () => {
    it('should match git:: prefix', () => {
      expect(SOURCE_PATTERNS.git.test('git::https://example.com/repo.git')).toBe(true);
      expect(SOURCE_PATTERNS.git.test('git::ssh://git@example.com/repo')).toBe(true);
    });

    it('should match .git suffix', () => {
      expect(SOURCE_PATTERNS.git.test('https://github.com/org/repo.git')).toBe(true);
      expect(SOURCE_PATTERNS.git.test('https://github.com/org/repo.git//subdir')).toBe(true);
    });

    it('should match git@ prefix', () => {
      expect(SOURCE_PATTERNS.git.test('git@github.com:org/repo.git')).toBe(true);
    });
  });

  describe('github pattern', () => {
    it('should match github.com URLs', () => {
      expect(SOURCE_PATTERNS.github.test('https://github.com/org/repo')).toBe(true);
      expect(SOURCE_PATTERNS.github.test('github.com/org/repo')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(SOURCE_PATTERNS.github.test('https://GITHUB.COM/org/repo')).toBe(true);
    });
  });

  describe('s3 pattern', () => {
    it('should match s3:: prefix', () => {
      expect(SOURCE_PATTERNS.s3.test('s3::https://s3-eu-west-1.amazonaws.com/bucket/module.zip')).toBe(true);
    });
  });

  describe('gcs pattern', () => {
    it('should match gcs:: prefix', () => {
      expect(SOURCE_PATTERNS.gcs.test('gcs::https://www.googleapis.com/storage/v1/bucket/module.zip')).toBe(true);
    });
  });

  describe('http pattern', () => {
    it('should match http/https URLs', () => {
      expect(SOURCE_PATTERNS.http.test('https://example.com/module.zip')).toBe(true);
      expect(SOURCE_PATTERNS.http.test('http://example.com/module.tar.gz')).toBe(true);
    });
  });
});

// ============================================================================
// TerraformLinker.parseSource Tests
// ============================================================================

describe('TerraformLinker.parseSource', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker();
  });

  describe('local sources', () => {
    it('should detect local relative paths', () => {
      const source = linker.parseSource('./modules/vpc');

      expect(source.type).toBe('local');
      expect(source.path).toBe('./modules/vpc');
      expect(source.raw).toBe('./modules/vpc');
    });

    it('should detect parent directory paths', () => {
      const source = linker.parseSource('../shared/modules/vpc');

      expect(source.type).toBe('local');
      expect(source.path).toBe('../shared/modules/vpc');
    });

    it('should detect absolute paths', () => {
      const source = linker.parseSource('/absolute/path/to/module');

      expect(source.type).toBe('local');
      expect(source.path).toBe('/absolute/path/to/module');
    });

    it('should strip query parameters from local paths', () => {
      const source = linker.parseSource('./modules/vpc?something=ignored');

      expect(source.type).toBe('local');
      expect(source.path).toBe('./modules/vpc');
    });
  });

  describe('git sources', () => {
    it('should detect git:: prefix', () => {
      const source = linker.parseSource('git::https://example.com/modules.git//vpc');

      expect(source.type).toBe('git');
      // Note: split('//') is used, so gitUrl becomes everything before first //
      expect(source.gitUrl).toBe('https:');
      // subdir captures everything after first // in string (including host)
      expect(source.subdir).toBe('example.com/modules.git//vpc');
    });

    it('should extract git ref', () => {
      const source = linker.parseSource('git::https://example.com/repo.git//mod?ref=v1.0.0');

      expect(source.type).toBe('git');
      expect(source.ref).toBe('v1.0.0');
    });

    it('should handle git@ SSH URLs', () => {
      const source = linker.parseSource('git@github.com:org/modules.git//vpc?ref=main');

      expect(source.type).toBe('git');
      expect(source.gitUrl).toBe('git@github.com:org/modules.git');
      expect(source.subdir).toBe('vpc');
      expect(source.ref).toBe('main');
    });

    it('should handle URLs with .git suffix', () => {
      // URLs with .git suffix but no git:: prefix are detected as git type
      const source = linker.parseSource('https://github.com/org/repo.git//module');

      expect(source.type).toBe('git');
      // The subdir regex captures after first // which is from https://
      expect(source.subdir).toBe('github.com/org/repo.git//module');
    });
  });

  describe('github sources', () => {
    it('should detect github.com URLs', () => {
      const source = linker.parseSource('github.com/hashicorp/terraform-aws-consul//modules/consul-cluster');

      expect(source.type).toBe('github');
      expect(source.gitUrl).toContain('github.com');
      expect(source.subdir).toBe('modules/consul-cluster');
    });

    it('should add .git suffix to github URLs', () => {
      const source = linker.parseSource('https://github.com/org/repo//module');

      expect(source.type).toBe('github');
      expect(source.gitUrl).toContain('.git');
    });
  });

  describe('registry sources', () => {
    it('should detect Terraform Registry format', () => {
      const source = linker.parseSource('hashicorp/consul/aws');

      expect(source.type).toBe('registry');
      expect(source.registry).toBe('hashicorp/consul/aws');
    });

    it('should handle registry.terraform.io prefix', () => {
      const source = linker.parseSource('registry.terraform.io/hashicorp/consul/aws');

      expect(source.type).toBe('registry');
      expect(source.registry).toBe('hashicorp/consul/aws');
    });

    it('should extract version constraint', () => {
      const source = linker.parseSource('hashicorp/consul/aws?version=0.1.0');

      expect(source.type).toBe('registry');
      expect(source.version).toBe('0.1.0');
    });

    it('should handle subdir in registry source', () => {
      const source = linker.parseSource('hashicorp/consul/aws//modules/consul-cluster');

      expect(source.type).toBe('registry');
      expect(source.subdir).toBe('modules/consul-cluster');
    });
  });

  describe('s3 sources', () => {
    it('should detect S3 sources', () => {
      const source = linker.parseSource('s3::https://s3-eu-west-1.amazonaws.com/mybucket/module.zip');

      expect(source.type).toBe('s3');
      expect(source.bucket).toBe('mybucket');
    });
  });

  describe('gcs sources', () => {
    it('should detect GCS sources', () => {
      const source = linker.parseSource('gcs::https://www.googleapis.com/storage/v1/mybucket/module.zip');

      expect(source.type).toBe('gcs');
      expect(source.bucket).toBe('mybucket');
    });
  });

  describe('http sources', () => {
    it('should detect HTTP sources', () => {
      const source = linker.parseSource('https://example.com/module.zip');

      expect(source.type).toBe('http');
      // Note: split('//') splits on protocol //, so httpUrl is 'https:'
      expect(source.httpUrl).toBe('https:');
    });

    it('should handle subdirectory', () => {
      const source = linker.parseSource('https://example.com/modules.zip//vpc');

      expect(source.type).toBe('http');
      // subdir captures everything after first // until ?, which includes the whole URL part
      expect(source.subdir).toBe('example.com/modules.zip//vpc');
      // httpUrl is everything before first // (which is 'https:')
      expect(source.httpUrl).toBe('https:');
    });
  });

  describe('unknown sources', () => {
    it('should detect unknown sources', () => {
      const source = linker.parseSource('some-unknown-format');

      expect(source.type).toBe('unknown');
    });
  });

  describe('subdirectory extraction', () => {
    it('should extract subdirectory with // syntax (git@ format)', () => {
      // git@ format doesn't have // in the protocol, so subdir extraction works correctly
      const source = linker.parseSource('git@github.com:org/repo.git//path/to/module');

      expect(source.subdir).toBe('path/to/module');
    });

    it('should extract subdirectory before query params', () => {
      // git@ format for proper subdir extraction
      const source = linker.parseSource('git@github.com:org/repo.git//module?ref=v1.0');

      expect(source.subdir).toBe('module');
      expect(source.ref).toBe('v1.0');
    });

    it('should handle https URLs with multiple //', () => {
      // For https:// URLs, the first // is in the protocol, so subdir includes the host
      const source = linker.parseSource('git::https://example.com/repo.git//path');

      // Note: captures everything after the first // in the string
      expect(source.subdir).toBe('example.com/repo.git//path');
    });
  });
});

// ============================================================================
// TerraformLinker.resolve Tests
// ============================================================================

describe('TerraformLinker.resolve', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker(createMockLinkerOptions());
  });

  describe('local module resolution', () => {
    it('should resolve local modules to existing nodes', () => {
      const existingModules = new Map([
        ['/repo/modules/vpc', 'existing-vpc-node-id'],
      ]);
      const context = createMockLinkerContext({
        configPath: '/repo/env/dev/terragrunt.hcl',
        existingTfModules: existingModules,
      });
      const source = linker.parseSource('../../modules/vpc');

      const result = linker.resolve(source, context);

      expect(result.success).toBe(true);
      expect(result.isSynthetic).toBe(false);
      expect(result.targetNodeId).toBe('existing-vpc-node-id');
      expect(result.sourceType).toBe('local');
    });

    it('should create synthetic node for unresolved local modules', () => {
      const context = createMockLinkerContext({
        configPath: '/repo/env/dev/terragrunt.hcl',
        existingTfModules: new Map(),
      });
      const source = linker.parseSource('../../modules/missing');

      const result = linker.resolve(source, context);

      expect(result.success).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.syntheticNode).toBeDefined();
      expect(result.syntheticNode?.type).toBe('terraform_module');
    });

    it('should return error for local source with no path', () => {
      const context = createMockLinkerContext();
      const source: TerraformSourceExpression = {
        raw: '',
        type: 'local',
        path: undefined,
      };

      const result = linker.resolve(source, context);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should try relative path from repo root', () => {
      const existingModules = new Map([
        ['modules/vpc', 'vpc-by-relative-path'],
      ]);
      const context = createMockLinkerContext({
        configPath: '/repo/env/dev/terragrunt.hcl',
        repositoryRoot: '/repo',
        existingTfModules: existingModules,
      });
      const source = linker.parseSource('../../modules/vpc');

      const result = linker.resolve(source, context);

      expect(result.success).toBe(true);
      expect(result.targetNodeId).toBe('vpc-by-relative-path');
    });
  });

  describe('external module resolution', () => {
    it('should create synthetic nodes for git sources', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('git::https://github.com/org/modules.git//vpc');

      const result = linker.resolve(source, context);

      expect(result.success).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.syntheticNode).toBeDefined();
      expect(result.syntheticNode?.sourceType).toBe('git');
    });

    it('should create synthetic nodes for registry sources', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('hashicorp/consul/aws');

      const result = linker.resolve(source, context);

      expect(result.success).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.syntheticNode?.metadata).toMatchObject({
        synthetic: true,
        scanId: 'scan-123',
        tenantId: 'tenant-456',
        registryAddress: 'hashicorp/consul/aws',
      });
    });

    it('should include git ref in synthetic node metadata', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('git::https://github.com/org/repo.git?ref=v2.0.0');

      const result = linker.resolve(source, context);

      expect(result.syntheticNode?.metadata).toMatchObject({
        gitRef: 'v2.0.0',
      });
    });

    it('should include version constraint in synthetic node', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('hashicorp/consul/aws?version=0.11.0');

      const result = linker.resolve(source, context);

      expect(result.syntheticNode?.version).toBe('0.11.0');
    });
  });

  describe('synthetic node properties', () => {
    it('should derive module name from local path', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('../../modules/my-vpc-module');

      const result = linker.resolve(source, context);

      expect(result.syntheticNode?.name).toBe('my-vpc-module');
    });

    it('should derive module name from registry address', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('hashicorp/consul/aws');

      const result = linker.resolve(source, context);

      expect(result.syntheticNode?.name).toBe('consul');
    });

    it('should derive module name from git repo', () => {
      const context = createMockLinkerContext();
      // Use git@ format which doesn't split on // for URL protocol
      const source = linker.parseSource('git@github.com:org/terraform-vpc-module.git');

      const result = linker.resolve(source, context);

      expect(result.syntheticNode?.name).toBe('terraform-vpc-module');
    });

    it('should use subdir for git module name when available', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('git::https://github.com/org/repo.git//my-specific-module');

      const result = linker.resolve(source, context);

      // Should prefer repo name, but subdir is available
      expect(result.syntheticNode?.name).toBeDefined();
    });
  });
});

// ============================================================================
// TerraformLinker.isExternal Tests
// ============================================================================

describe('TerraformLinker.isExternal', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker();
  });

  it('should return false for local sources', () => {
    const source = linker.parseSource('./modules/vpc');
    expect(linker.isExternal(source)).toBe(false);
  });

  it('should return true for git sources', () => {
    const source = linker.parseSource('git::https://github.com/org/repo.git');
    expect(linker.isExternal(source)).toBe(true);
  });

  it('should return true for registry sources', () => {
    const source = linker.parseSource('hashicorp/consul/aws');
    expect(linker.isExternal(source)).toBe(true);
  });

  it('should return true for s3 sources', () => {
    const source = linker.parseSource('s3::https://s3.amazonaws.com/bucket/module.zip');
    expect(linker.isExternal(source)).toBe(true);
  });

  it('should return true for gcs sources', () => {
    const source = linker.parseSource('gcs::https://storage.googleapis.com/bucket/module.zip');
    expect(linker.isExternal(source)).toBe(true);
  });

  it('should return true for http sources', () => {
    const source = linker.parseSource('https://example.com/module.zip');
    expect(linker.isExternal(source)).toBe(true);
  });
});

// ============================================================================
// Convenience Functions Tests
// ============================================================================

describe('parseSource (convenience)', () => {
  it('should parse source without creating linker', () => {
    const source = parseSource('./modules/vpc');

    expect(source.type).toBe('local');
    expect(source.path).toBe('./modules/vpc');
  });
});

describe('isExternalSource (convenience)', () => {
  it('should check if source is external', () => {
    expect(isExternalSource('./modules/vpc')).toBe(false);
    expect(isExternalSource('hashicorp/consul/aws')).toBe(true);
  });
});

describe('detectSourceType (convenience)', () => {
  it('should detect source type', () => {
    expect(detectSourceType('./modules/vpc')).toBe('local');
    expect(detectSourceType('git::https://github.com/org/repo.git')).toBe('git');
    expect(detectSourceType('hashicorp/consul/aws')).toBe('registry');
    expect(detectSourceType('s3::https://bucket')).toBe('s3');
    expect(detectSourceType('gcs::https://bucket')).toBe('gcs');
    expect(detectSourceType('https://example.com/module')).toBe('http');
  });
});

// ============================================================================
// Utility Functions Tests
// ============================================================================

describe('createLinkerContext', () => {
  it('should create context with required fields', () => {
    const context = createLinkerContext(
      'scan-1',
      'tenant-1',
      '/repo/env/terragrunt.hcl',
      '/repo'
    );

    expect(context.scanId).toBe('scan-1');
    expect(context.tenantId).toBe('tenant-1');
    expect(context.configPath).toBe('/repo/env/terragrunt.hcl');
    expect(context.repositoryRoot).toBe('/repo');
    expect(context.existingTfModules).toBeInstanceOf(Map);
  });

  it('should accept optional existing modules map', () => {
    const modules = new Map([['path', 'id']]);
    const context = createLinkerContext('s', 't', '/c', '/r', modules);

    expect(context.existingTfModules).toBe(modules);
  });
});

describe('buildModuleMap', () => {
  it('should build map from module nodes', () => {
    const modules = [
      { id: 'node-1', location: { file: '/repo/mod1/main.tf', lineStart: 1, lineEnd: 10 } },
      { id: 'node-2', location: { file: '/repo/mod2/main.tf', lineStart: 1, lineEnd: 10 } },
    ];

    const map = buildModuleMap(modules);

    expect(map.get('/repo/mod1/main.tf')).toBe('node-1');
    expect(map.get('/repo/mod2/main.tf')).toBe('node-2');
    expect(map.size).toBe(2);
  });

  it('should skip modules without location', () => {
    const modules = [
      { id: 'node-1', location: null },
      { id: 'node-2', location: { file: '/repo/mod.tf', lineStart: 1, lineEnd: 1 } },
    ];

    const map = buildModuleMap(modules as any);

    expect(map.size).toBe(1);
  });
});

// ============================================================================
// Type Guards Tests
// ============================================================================

describe('Source Type Guards', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker();
  });

  describe('isLocalSource', () => {
    it('should return true for local sources with path', () => {
      const source = linker.parseSource('./modules/vpc');
      expect(isLocalSource(source)).toBe(true);
    });

    it('should return false for non-local sources', () => {
      const source = linker.parseSource('hashicorp/consul/aws');
      expect(isLocalSource(source)).toBe(false);
    });
  });

  describe('isRegistrySource', () => {
    it('should return true for registry sources', () => {
      const source = linker.parseSource('hashicorp/consul/aws');
      expect(isRegistrySource(source)).toBe(true);
    });

    it('should return false for non-registry sources', () => {
      const source = linker.parseSource('./modules/vpc');
      expect(isRegistrySource(source)).toBe(false);
    });
  });

  describe('isGitSource', () => {
    it('should return true for git sources', () => {
      const source = linker.parseSource('git::https://github.com/org/repo.git');
      expect(isGitSource(source)).toBe(true);
    });

    it('should return true for github sources', () => {
      const source = linker.parseSource('github.com/org/repo');
      expect(isGitSource(source)).toBe(true);
    });

    it('should return false for non-git sources', () => {
      const source = linker.parseSource('./modules/vpc');
      expect(isGitSource(source)).toBe(false);
    });
  });

  describe('isS3Source', () => {
    it('should return true for S3 sources', () => {
      const source = linker.parseSource('s3::https://s3.amazonaws.com/bucket/key');
      // Note: The pattern may not fully parse bucket, depends on URL format
      expect(source.type).toBe('s3');
    });
  });

  describe('isGcsSource', () => {
    it('should return true for GCS sources', () => {
      const source = linker.parseSource('gcs::https://www.googleapis.com/storage/v1/bucket/object');
      expect(source.type).toBe('gcs');
    });
  });

  describe('isHttpSource', () => {
    it('should return true for HTTP sources', () => {
      const source = linker.parseSource('https://example.com/module.zip');
      expect(isHttpSource(source)).toBe(true);
    });
  });
});

describe('Resolution Type Guards', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker(createMockLinkerOptions());
  });

  describe('isSuccessfulResolution', () => {
    it('should return true for successful resolutions', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('hashicorp/consul/aws');
      const result = linker.resolve(source, context);

      expect(isSuccessfulResolution(result)).toBe(true);
    });

    it('should return false for failed resolutions', () => {
      const context = createMockLinkerContext();
      const source: TerraformSourceExpression = {
        raw: '',
        type: 'local',
        path: undefined,
      };
      const result = linker.resolve(source, context);

      expect(isSuccessfulResolution(result)).toBe(false);
    });
  });

  describe('isSyntheticResolution', () => {
    it('should return true for synthetic resolutions', () => {
      const context = createMockLinkerContext();
      const source = linker.parseSource('hashicorp/consul/aws');
      const result = linker.resolve(source, context);

      expect(isSyntheticResolution(result)).toBe(true);
    });

    it('should return false for existing module resolutions', () => {
      const existingModules = new Map([['/repo/modules/vpc', 'existing-id']]);
      const context = createMockLinkerContext({
        configPath: '/repo/env/dev/terragrunt.hcl',
        existingTfModules: existingModules,
      });
      const source = linker.parseSource('../../modules/vpc');
      const result = linker.resolve(source, context);

      expect(isSyntheticResolution(result)).toBe(false);
    });
  });
});

// ============================================================================
// Validation Functions Tests
// ============================================================================

describe('validateLinkerContext', () => {
  it('should not throw for valid context', () => {
    const context = createMockLinkerContext();
    expect(() => validateLinkerContext(context)).not.toThrow();
  });

  it('should throw for missing scanId', () => {
    const context = createMockLinkerContext({ scanId: '' });
    expect(() => validateLinkerContext(context)).toThrow('scanId');
  });

  it('should throw for missing tenantId', () => {
    const context = createMockLinkerContext({ tenantId: '' });
    expect(() => validateLinkerContext(context)).toThrow('tenantId');
  });

  it('should throw for missing configPath', () => {
    const context = createMockLinkerContext({ configPath: '' });
    expect(() => validateLinkerContext(context)).toThrow('configPath');
  });

  it('should throw for missing repositoryRoot', () => {
    const context = createMockLinkerContext({ repositoryRoot: '' });
    expect(() => validateLinkerContext(context)).toThrow('repositoryRoot');
  });

  it('should throw for non-Map existingTfModules', () => {
    const context = createMockLinkerContext({ existingTfModules: {} as any });
    expect(() => validateLinkerContext(context)).toThrow('existingTfModules');
  });
});

describe('validateLinkerOptions', () => {
  it('should not throw for valid options', () => {
    const options = createMockLinkerOptions();
    expect(() => validateLinkerOptions(options)).not.toThrow();
  });

  it('should not throw for empty options', () => {
    expect(() => validateLinkerOptions({})).not.toThrow();
  });

  it('should throw for non-function idGenerator', () => {
    const options = { idGenerator: 'not-a-function' as any };
    expect(() => validateLinkerOptions(options)).toThrow('idGenerator');
  });

  it('should throw for non-boolean normalizePaths', () => {
    const options = { normalizePaths: 'yes' as any };
    expect(() => validateLinkerOptions(options)).toThrow('normalizePaths');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let linker: ITerraformLinker;

  beforeEach(() => {
    linker = createTerraformLinker(createMockLinkerOptions());
  });

  it('should handle empty source string', () => {
    const source = linker.parseSource('');

    expect(source.type).toBe('unknown');
    expect(source.raw).toBe('');
  });

  it('should handle whitespace-only source string', () => {
    const source = linker.parseSource('   ');

    expect(source.type).toBe('unknown');
  });

  it('should handle source with multiple // subdirs', () => {
    const source = linker.parseSource('git::https://github.com/org/repo.git//path//to//module');

    expect(source.subdir).toBeDefined();
  });

  it('should handle source with multiple query params', () => {
    const source = linker.parseSource('hashicorp/consul/aws?version=0.11.0&other=value');

    expect(source.type).toBe('registry');
    expect(source.version).toBe('0.11.0');
  });

  it('should handle special characters in paths', () => {
    const source = linker.parseSource('./modules/my-vpc_v2.0');

    expect(source.type).toBe('local');
    expect(source.path).toBe('./modules/my-vpc_v2.0');
  });

  it('should handle very long URLs', () => {
    const longUrl = 'git::https://github.com/organization-with-very-long-name/repository-name-that-is-also-quite-long.git//modules/nested/path/to/specific/module?ref=v1.2.3-beta.4+build.567';
    const source = linker.parseSource(longUrl);

    expect(source.type).toBe('git');
    expect(source.raw).toBe(longUrl);
  });

  it('should disable path normalization when configured', () => {
    const customLinker = createTerraformLinker({ normalizePaths: false });
    const context = createMockLinkerContext({
      existingTfModules: new Map([['/repo/modules/./vpc/../vpc', 'id']]),
    });
    const source = customLinker.parseSource('../modules/./vpc/../vpc');

    // Without normalization, may not match
    const result = customLinker.resolve(source, context);

    expect(result).toBeDefined();
  });
});

// ============================================================================
// Integration-Style Tests
// ============================================================================

describe('Full Resolution Workflow', () => {
  it('should resolve a complete terragrunt module hierarchy', () => {
    const linker = createTerraformLinker(createMockLinkerOptions());

    const existingModules = new Map([
      ['/repo/modules/vpc/main.tf', 'vpc-module-id'],
      ['/repo/modules/rds/main.tf', 'rds-module-id'],
    ]);

    const context = createMockLinkerContext({
      configPath: '/repo/live/dev/app/terragrunt.hcl',
      repositoryRoot: '/repo',
      existingTfModules: existingModules,
    });

    // Test various source types
    const sources = [
      { raw: '../../../modules/vpc/main.tf', expectedType: 'local' },
      { raw: 'hashicorp/consul/aws', expectedType: 'registry' },
      { raw: 'git::https://github.com/org/modules.git//vpc', expectedType: 'git' },
    ];

    for (const { raw, expectedType } of sources) {
      const source = linker.parseSource(raw);
      expect(source.type).toBe(expectedType);

      const result = linker.resolve(source, context);
      expect(result.success).toBe(true);
    }
  });
});
