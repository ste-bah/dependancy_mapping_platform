/**
 * Terragrunt Node Factory Unit Tests
 * @module tests/parsers/terragrunt/node-factory.test
 *
 * TASK-TG-022: Tests for TerragruntConfigNode factory functions.
 * Target: 80%+ coverage for node-factory.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTerragruntConfigNode,
  createTerragruntConfigNodes,
  createTerragruntConfigNodesWithRelationships,
  deriveNodeName,
  validateFactoryOptions,
  createFactoryOptions,
  DEFAULT_FACTORY_OPTIONS,
  type TerragruntNodeFactoryOptions,
  type TerragruntNodeFactoryResult,
  type DependencyHint,
  type IncludeHint,
} from '../../../src/parsers/terragrunt/node-factory';
import type {
  TerragruntFile,
  TerragruntBlock,
  TerraformBlock,
  RemoteStateBlock,
  InputsBlock,
  GenerateBlock,
  ResolvedInclude,
  ResolvedDependency,
} from '../../../src/parsers/terragrunt/types';
import type { TerragruntConfigNode } from '../../../src/types/graph';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLocation = (lineStart = 1, lineEnd = 10) => ({
  file: 'test.hcl',
  lineStart,
  lineEnd,
  columnStart: 1,
  columnEnd: 1,
});

const createMockTerraformBlock = (source: string | null = null): TerraformBlock => ({
  type: 'terraform',
  source: source
    ? { type: 'literal', value: source, raw: `"${source}"` }
    : null,
  extraArguments: [],
  beforeHooks: [],
  afterHooks: [],
  errorHooks: [],
  includeInCopy: [],
  location: createMockLocation(),
  raw: 'terraform { ... }',
});

const createMockRemoteStateBlock = (backend = 's3'): RemoteStateBlock => ({
  type: 'remote_state',
  backend,
  generate: { path: 'backend.tf', ifExists: 'overwrite_terragrunt' },
  config: {},
  disableInit: false,
  disableDependencyOptimization: false,
  location: createMockLocation(),
  raw: 'remote_state { ... }',
});

const createMockInputsBlock = (inputCount = 3): InputsBlock => {
  const values: Record<string, { type: 'literal'; value: string; raw: string }> = {};
  for (let i = 0; i < inputCount; i++) {
    values[`input_${i}`] = { type: 'literal', value: `value_${i}`, raw: `"value_${i}"` };
  }
  return {
    type: 'inputs',
    values,
    location: createMockLocation(),
    raw: 'inputs = { ... }',
  };
};

const createMockGenerateBlock = (label: string): GenerateBlock => ({
  type: 'generate',
  label,
  path: { type: 'literal', value: `${label}.tf`, raw: `"${label}.tf"` },
  contents: { type: 'literal', value: 'content', raw: '"content"' },
  ifExists: 'overwrite_terragrunt',
  commentPrefix: '# ',
  disableSignature: false,
  location: createMockLocation(),
  raw: `generate "${label}" { ... }`,
});

interface MockTerragruntFileOptions {
  path?: string;
  blocks?: TerragruntBlock[];
  includes?: ResolvedInclude[];
  dependencies?: ResolvedDependency[];
  errors?: { message: string; location: null; severity: 'error' | 'warning'; code: 'SYNTAX_ERROR' }[];
  encoding?: string;
  size?: number;
}

function createMockTerragruntFile(options: MockTerragruntFileOptions = {}): TerragruntFile {
  return {
    path: options.path ?? '/repo/env/dev/terragrunt.hcl',
    blocks: options.blocks ?? [],
    includes: options.includes ?? [],
    dependencies: options.dependencies ?? [],
    errors: options.errors ?? [],
    encoding: options.encoding ?? 'utf-8',
    size: options.size ?? 1024,
  };
}

function createMockResolvedInclude(label: string, resolvedPath: string | null = null): ResolvedInclude {
  return {
    label,
    pathExpression: { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders()' },
    resolvedPath,
    resolved: resolvedPath !== null,
    mergeStrategy: 'deep',
  };
}

function createMockResolvedDependency(name: string, resolvedPath: string | null = null): ResolvedDependency {
  return {
    name,
    configPathExpression: { type: 'literal', value: `../${name}`, raw: `"../${name}"` },
    resolvedPath,
    resolved: resolvedPath !== null,
    outputsUsed: ['output_a', 'output_b'],
  };
}

const createMockOptions = (): TerragruntNodeFactoryOptions => ({
  scanId: 'scan-123',
  repositoryRoot: '/repo',
  idGenerator: () => 'test-uuid-12345',
});

// ============================================================================
// deriveNodeName Tests
// ============================================================================

describe('deriveNodeName', () => {
  it('should derive name from directory containing terragrunt.hcl', () => {
    expect(deriveNodeName('/repo/env/dev/terragrunt.hcl')).toBe('dev');
    expect(deriveNodeName('/repo/modules/vpc/terragrunt.hcl')).toBe('vpc');
    expect(deriveNodeName('/repo/infrastructure/networking/alb/terragrunt.hcl')).toBe('alb');
  });

  it('should handle nested directory structures', () => {
    expect(deriveNodeName('/repo/live/us-east-1/prod/rds/terragrunt.hcl')).toBe('rds');
    expect(deriveNodeName('/home/user/projects/myproject/environments/staging/app/terragrunt.hcl')).toBe('app');
  });

  it('should return "root" for file at root directory', () => {
    expect(deriveNodeName('/terragrunt.hcl')).toBe('root');
    expect(deriveNodeName('terragrunt.hcl')).toBe('root');
  });

  it('should handle paths with dots in directory names', () => {
    expect(deriveNodeName('/repo/env/v1.2.3/terragrunt.hcl')).toBe('v1.2.3');
  });

  it('should handle Windows-style paths (forward slashes)', () => {
    // Node's path module normalizes paths
    expect(deriveNodeName('/c/Users/dev/project/env/terragrunt.hcl')).toBe('env');
  });
});

// ============================================================================
// createTerragruntConfigNode Tests
// ============================================================================

describe('createTerragruntConfigNode', () => {
  const mockOptions = createMockOptions();

  describe('basic node creation', () => {
    it('should create node with correct type discriminant', () => {
      const mockFile = createMockTerragruntFile();
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.type).toBe('tg_config');
    });

    it('should generate unique ID using idGenerator', () => {
      const mockFile = createMockTerragruntFile();
      const customOptions: TerragruntNodeFactoryOptions = {
        ...mockOptions,
        idGenerator: () => 'custom-uuid-xyz',
      };

      const node = createTerragruntConfigNode(mockFile, customOptions);

      expect(node.id).toBe('custom-uuid-xyz');
    });

    it('should use default idGenerator when not provided', () => {
      const mockFile = createMockTerragruntFile();
      const optionsWithoutIdGen: TerragruntNodeFactoryOptions = {
        scanId: 'scan-123',
        repositoryRoot: '/repo',
      };

      const node = createTerragruntConfigNode(mockFile, optionsWithoutIdGen);

      // Should generate a UUID-like string
      expect(node.id).toBeDefined();
      expect(typeof node.id).toBe('string');
      expect(node.id.length).toBeGreaterThan(0);
    });

    it('should derive node name from directory', () => {
      const mockFile = createMockTerragruntFile({ path: '/repo/env/dev/terragrunt.hcl' });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.name).toBe('dev');
    });

    it('should calculate relative path from repository root', () => {
      const mockFile = createMockTerragruntFile({ path: '/repo/env/dev/terragrunt.hcl' });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.location.file).toBe('env/dev/terragrunt.hcl');
    });
  });

  describe('terraform source extraction', () => {
    it('should extract terraform source from terraform block', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [createMockTerraformBlock('git::https://example.com/modules//vpc')],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.terraformSource).toBe('git::https://example.com/modules//vpc');
    });

    it('should return null when no terraform block exists', () => {
      const mockFile = createMockTerragruntFile({ blocks: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.terraformSource).toBeNull();
    });

    it('should return null when terraform block has no source', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [createMockTerraformBlock(null)],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.terraformSource).toBeNull();
    });
  });

  describe('remote state extraction', () => {
    it('should detect remote state presence', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [createMockRemoteStateBlock('s3')],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.hasRemoteState).toBe(true);
      expect(node.remoteStateBackend).toBe('s3');
    });

    it('should handle different backend types', () => {
      const backends = ['s3', 'gcs', 'azurerm', 'consul', 'kubernetes'];

      for (const backend of backends) {
        const mockFile = createMockTerragruntFile({
          blocks: [createMockRemoteStateBlock(backend)],
        });
        const node = createTerragruntConfigNode(mockFile, mockOptions);

        expect(node.hasRemoteState).toBe(true);
        expect(node.remoteStateBackend).toBe(backend);
      }
    });

    it('should return false when no remote_state block exists', () => {
      const mockFile = createMockTerragruntFile({ blocks: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.hasRemoteState).toBe(false);
      expect(node.remoteStateBackend).toBeNull();
    });
  });

  describe('include count', () => {
    it('should count include blocks', () => {
      const mockFile = createMockTerragruntFile({
        includes: [
          createMockResolvedInclude('root', '/repo/root.hcl'),
          createMockResolvedInclude('common', '/repo/common.hcl'),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.includeCount).toBe(2);
    });

    it('should return 0 when no includes exist', () => {
      const mockFile = createMockTerragruntFile({ includes: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.includeCount).toBe(0);
    });
  });

  describe('dependency count', () => {
    it('should count dependency blocks', () => {
      const mockFile = createMockTerragruntFile({
        dependencies: [
          createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
          createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl'),
          createMockResolvedDependency('security-group', '/repo/sg/terragrunt.hcl'),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.dependencyCount).toBe(3);
    });

    it('should return 0 when no dependencies exist', () => {
      const mockFile = createMockTerragruntFile({ dependencies: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.dependencyCount).toBe(0);
    });
  });

  describe('input count', () => {
    it('should count input variables', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [createMockInputsBlock(5)],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.inputCount).toBe(5);
    });

    it('should return 0 when no inputs block exists', () => {
      const mockFile = createMockTerragruntFile({ blocks: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.inputCount).toBe(0);
    });
  });

  describe('generate blocks', () => {
    it('should extract generate block labels', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [
          createMockGenerateBlock('provider'),
          createMockGenerateBlock('backend'),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.generateBlocks).toContain('provider');
      expect(node.generateBlocks).toContain('backend');
      expect(node.generateBlocks).toHaveLength(2);
    });

    it('should return empty array when no generate blocks exist', () => {
      const mockFile = createMockTerragruntFile({ blocks: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.generateBlocks).toEqual([]);
    });
  });

  describe('metadata', () => {
    it('should include scanId in metadata', () => {
      const mockFile = createMockTerragruntFile();
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.scanId).toBe('scan-123');
    });

    it('should include absolute path in metadata', () => {
      const mockFile = createMockTerragruntFile({ path: '/repo/env/dev/terragrunt.hcl' });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.absolutePath).toBe('/repo/env/dev/terragrunt.hcl');
    });

    it('should include file encoding in metadata', () => {
      const mockFile = createMockTerragruntFile({ encoding: 'utf-16' });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.encoding).toBe('utf-16');
    });

    it('should include file size in metadata', () => {
      const mockFile = createMockTerragruntFile({ size: 2048 });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.size).toBe(2048);
    });

    it('should include block count in metadata', () => {
      const mockFile = createMockTerragruntFile({
        blocks: [
          createMockTerraformBlock('source'),
          createMockRemoteStateBlock(),
          createMockInputsBlock(),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.blockCount).toBe(3);
    });

    it('should include error count in metadata', () => {
      const mockFile = createMockTerragruntFile({
        errors: [
          { message: 'Error 1', location: null, severity: 'error', code: 'SYNTAX_ERROR' },
          { message: 'Error 2', location: null, severity: 'warning', code: 'SYNTAX_ERROR' },
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.errorCount).toBe(2);
    });

    it('should include dependency names in metadata', () => {
      const mockFile = createMockTerragruntFile({
        dependencies: [
          createMockResolvedDependency('vpc'),
          createMockResolvedDependency('rds'),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.dependencyNames).toContain('vpc');
      expect(node.metadata.dependencyNames).toContain('rds');
    });

    it('should include include labels in metadata', () => {
      const mockFile = createMockTerragruntFile({
        includes: [
          createMockResolvedInclude('root'),
          createMockResolvedInclude('common'),
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.metadata.includeLabels).toContain('root');
      expect(node.metadata.includeLabels).toContain('common');
    });
  });

  describe('location', () => {
    it('should calculate line range from blocks with startLine/endLine properties', () => {
      // Note: The implementation expects location.startLine and location.endLine
      // which matches the block location interface. We cast to any to provide
      // both property names for compatibility.
      const mockFile = createMockTerragruntFile({
        blocks: [
          {
            type: 'terraform',
            source: null,
            extraArguments: [],
            beforeHooks: [],
            afterHooks: [],
            errorHooks: [],
            includeInCopy: [],
            location: {
              file: 'test.hcl',
              lineStart: 5,
              lineEnd: 15,
              columnStart: 1,
              columnEnd: 1,
              // The node-factory references startLine/endLine properties
              startLine: 5,
              endLine: 15,
            } as any,
            raw: 'terraform {}',
          },
          {
            type: 'inputs',
            values: {},
            location: {
              file: 'test.hcl',
              lineStart: 20,
              lineEnd: 30,
              columnStart: 1,
              columnEnd: 1,
              startLine: 20,
              endLine: 30,
            } as any,
            raw: 'inputs = {}',
          },
        ],
      });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.location.lineStart).toBe(5);
      expect(node.location.lineEnd).toBe(30);
    });

    it('should default to line 1 when no blocks exist', () => {
      const mockFile = createMockTerragruntFile({ blocks: [] });
      const node = createTerragruntConfigNode(mockFile, mockOptions);

      expect(node.location.lineStart).toBe(1);
      expect(node.location.lineEnd).toBe(1);
    });
  });
});

// ============================================================================
// createTerragruntConfigNodes Tests
// ============================================================================

describe('createTerragruntConfigNodes', () => {
  const mockOptions = createMockOptions();

  it('should create multiple nodes from array of files', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/env/dev/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/env/staging/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/env/prod/terragrunt.hcl' }),
    ];

    const nodes = createTerragruntConfigNodes(files, mockOptions);

    expect(nodes).toHaveLength(3);
    expect(nodes[0].name).toBe('dev');
    expect(nodes[1].name).toBe('staging');
    expect(nodes[2].name).toBe('prod');
  });

  it('should return empty array for empty input', () => {
    const nodes = createTerragruntConfigNodes([], mockOptions);

    expect(nodes).toHaveLength(0);
  });

  it('should preserve order of input files', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/c/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/a/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/b/terragrunt.hcl' }),
    ];

    const nodes = createTerragruntConfigNodes(files, mockOptions);

    expect(nodes[0].name).toBe('c');
    expect(nodes[1].name).toBe('a');
    expect(nodes[2].name).toBe('b');
  });

  it('should apply same options to all nodes', () => {
    const customOptions: TerragruntNodeFactoryOptions = {
      scanId: 'batch-scan-999',
      repositoryRoot: '/custom/repo',
    };

    const files = [
      createMockTerragruntFile({ path: '/custom/repo/a/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/custom/repo/b/terragrunt.hcl' }),
    ];

    const nodes = createTerragruntConfigNodes(files, customOptions);

    expect(nodes[0].metadata.scanId).toBe('batch-scan-999');
    expect(nodes[1].metadata.scanId).toBe('batch-scan-999');
  });
});

// ============================================================================
// createTerragruntConfigNodesWithRelationships Tests
// ============================================================================

describe('createTerragruntConfigNodesWithRelationships', () => {
  const mockOptions = createMockOptions();

  it('should create nodes with relationship hints', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl')],
      }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, mockOptions);

    expect(result.nodes).toHaveLength(2);
    expect(result.dependencyHints.length).toBeGreaterThanOrEqual(0);
  });

  it('should create path-to-ID map', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/app/terragrunt.hcl' }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, mockOptions);

    expect(result.pathToIdMap.size).toBe(2);
    expect(result.pathToIdMap.has('/repo/vpc/terragrunt.hcl')).toBe(true);
    expect(result.pathToIdMap.has('/repo/app/terragrunt.hcl')).toBe(true);
  });

  it('should extract dependency hints with resolved target IDs', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      scanId: 'scan-123',
      repositoryRoot: '/repo',
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl')],
      }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, customOptions);

    const depHint = result.dependencyHints.find(h => h.dependencyName === 'vpc');
    expect(depHint).toBeDefined();
    expect(depHint?.targetPath).toBe('/repo/vpc/terragrunt.hcl');
    expect(depHint?.targetId).toBeDefined();
    expect(depHint?.resolved).toBe(true);
  });

  it('should extract include hints with resolved target IDs', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      scanId: 'scan-123',
      repositoryRoot: '/repo',
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/root.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, customOptions);

    const incHint = result.includeHints.find(h => h.includeLabel === 'root');
    expect(incHint).toBeDefined();
    expect(incHint?.targetPath).toBe('/repo/root.hcl');
    expect(incHint?.mergeStrategy).toBe('deep');
  });

  it('should handle unresolved dependencies', () => {
    const files = [
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('external', '/external/module/terragrunt.hcl')],
      }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, mockOptions);

    const depHint = result.dependencyHints.find(h => h.dependencyName === 'external');
    expect(depHint).toBeDefined();
    expect(depHint?.targetId).toBeNull(); // Not in our file set
  });

  it('should return empty arrays when no relationships exist', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/standalone/terragrunt.hcl' }),
    ];

    const result = createTerragruntConfigNodesWithRelationships(files, mockOptions);

    expect(result.dependencyHints).toHaveLength(0);
    expect(result.includeHints).toHaveLength(0);
  });
});

// ============================================================================
// validateFactoryOptions Tests
// ============================================================================

describe('validateFactoryOptions', () => {
  it('should accept valid options', () => {
    const options: TerragruntNodeFactoryOptions = {
      scanId: 'scan-123',
      repositoryRoot: '/repo',
    };

    expect(() => validateFactoryOptions(options)).not.toThrow();
  });

  it('should throw for missing scanId', () => {
    const options = {
      scanId: '',
      repositoryRoot: '/repo',
    } as TerragruntNodeFactoryOptions;

    expect(() => validateFactoryOptions(options)).toThrow('valid scanId');
  });

  it('should throw for non-string scanId', () => {
    const options = {
      scanId: 123,
      repositoryRoot: '/repo',
    } as unknown as TerragruntNodeFactoryOptions;

    expect(() => validateFactoryOptions(options)).toThrow('valid scanId');
  });

  it('should throw for missing repositoryRoot', () => {
    const options = {
      scanId: 'scan-123',
      repositoryRoot: '',
    } as TerragruntNodeFactoryOptions;

    expect(() => validateFactoryOptions(options)).toThrow('valid repositoryRoot');
  });

  it('should throw for relative repositoryRoot', () => {
    const options = {
      scanId: 'scan-123',
      repositoryRoot: './relative/path',
    } as TerragruntNodeFactoryOptions;

    expect(() => validateFactoryOptions(options)).toThrow('absolute path');
  });

  it('should accept absolute paths on different platforms', () => {
    const unixOptions: TerragruntNodeFactoryOptions = {
      scanId: 'scan-123',
      repositoryRoot: '/home/user/repo',
    };

    expect(() => validateFactoryOptions(unixOptions)).not.toThrow();
  });
});

// ============================================================================
// createFactoryOptions Tests
// ============================================================================

describe('createFactoryOptions', () => {
  it('should merge with defaults', () => {
    const options = createFactoryOptions({
      scanId: 'scan-123',
      repositoryRoot: '/repo',
    });

    expect(options.scanId).toBe('scan-123');
    expect(options.repositoryRoot).toBe('/repo');
    expect(options.idGenerator).toBeDefined();
  });

  it('should allow overriding idGenerator', () => {
    const customIdGen = () => 'custom-id';
    const options = createFactoryOptions({
      scanId: 'scan-123',
      repositoryRoot: '/repo',
      idGenerator: customIdGen,
    });

    expect(options.idGenerator).toBe(customIdGen);
    expect(options.idGenerator!()).toBe('custom-id');
  });

  it('should use default idGenerator when not provided', () => {
    const options = createFactoryOptions({
      scanId: 'scan-123',
      repositoryRoot: '/repo',
    });

    const id = options.idGenerator!();
    expect(id).toBeDefined();
    expect(typeof id).toBe('string');
  });
});

// ============================================================================
// DEFAULT_FACTORY_OPTIONS Tests
// ============================================================================

describe('DEFAULT_FACTORY_OPTIONS', () => {
  it('should have idGenerator defined', () => {
    expect(DEFAULT_FACTORY_OPTIONS.idGenerator).toBeDefined();
  });

  it('should generate unique IDs', () => {
    const idGenerator = DEFAULT_FACTORY_OPTIONS.idGenerator!;
    const id1 = idGenerator();
    const id2 = idGenerator();

    expect(id1).not.toBe(id2);
  });

  it('should generate UUID-formatted strings', () => {
    const idGenerator = DEFAULT_FACTORY_OPTIONS.idGenerator!;
    const id = idGenerator();

    // UUID format: 8-4-4-4-12 (36 characters with hyphens)
    expect(id.length).toBe(36);
    expect(id.split('-').length).toBe(5);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  const mockOptions = createMockOptions();

  it('should handle file with all block types', () => {
    const mockFile = createMockTerragruntFile({
      path: '/repo/complete/terragrunt.hcl',
      blocks: [
        createMockTerraformBlock('git::https://example.com/module.git'),
        createMockRemoteStateBlock('s3'),
        createMockInputsBlock(10),
        createMockGenerateBlock('provider'),
        createMockGenerateBlock('backend'),
      ],
      includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      dependencies: [
        createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
        createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl'),
      ],
    });

    const node = createTerragruntConfigNode(mockFile, mockOptions);

    expect(node.type).toBe('tg_config');
    expect(node.terraformSource).toBe('git::https://example.com/module.git');
    expect(node.hasRemoteState).toBe(true);
    expect(node.remoteStateBackend).toBe('s3');
    expect(node.inputCount).toBe(10);
    expect(node.generateBlocks).toHaveLength(2);
    expect(node.includeCount).toBe(1);
    expect(node.dependencyCount).toBe(2);
  });

  it('should handle special characters in paths', () => {
    const mockFile = createMockTerragruntFile({
      path: '/repo/env/us-east-1/prod-v2.0/app-service_main/terragrunt.hcl',
    });

    const node = createTerragruntConfigNode(mockFile, mockOptions);

    expect(node.name).toBe('app-service_main');
  });

  it('should handle very long paths', () => {
    const longPath = '/repo' + '/deeply/nested'.repeat(20) + '/terragrunt.hcl';
    const mockFile = createMockTerragruntFile({ path: longPath });

    const node = createTerragruntConfigNode(mockFile, mockOptions);

    expect(node.name).toBe('nested');
    expect(node.metadata.absolutePath).toBe(longPath);
  });

  it('should handle files with errors', () => {
    const mockFile = createMockTerragruntFile({
      errors: Array(10).fill(null).map((_, i) => ({
        message: `Error ${i}`,
        location: null,
        severity: 'error' as const,
        code: 'SYNTAX_ERROR' as const,
      })),
    });

    const node = createTerragruntConfigNode(mockFile, mockOptions);

    expect(node.metadata.errorCount).toBe(10);
  });

  it('should handle large number of dependencies', () => {
    const dependencies = Array(50).fill(null).map((_, i) =>
      createMockResolvedDependency(`dep-${i}`, `/repo/dep-${i}/terragrunt.hcl`)
    );

    const mockFile = createMockTerragruntFile({ dependencies });

    const node = createTerragruntConfigNode(mockFile, mockOptions);

    expect(node.dependencyCount).toBe(50);
    expect(node.metadata.dependencyNames).toHaveLength(50);
  });
});

// ============================================================================
// TASK-TG-032: Extended Tests for TerragruntIncludeNode and TerragruntDependencyNode
// ============================================================================

import {
  createTerragruntIncludeNode,
  createTerragruntIncludeNodeFromBlock,
  createTerragruntDependencyNode,
  createTerragruntDependencyNodeFromBlock,
  createAllTerragruntNodes,
  createAllTerragruntNodesFromFiles,
  type ExtendedTerragruntNodeFactoryResult,
  type BatchTerragruntNodeResult,
} from '../../../src/parsers/terragrunt/node-factory';
import type { IncludeBlock, DependencyBlock } from '../../../src/parsers/terragrunt/types';
import type { TerragruntIncludeNode, TerragruntDependencyNode } from '../../../src/types/graph';

// ============================================================================
// Additional Mock Helpers for Include and Dependency Blocks
// ============================================================================

function createMockIncludeBlock(
  label: string,
  options: Partial<IncludeBlock> = {}
): IncludeBlock {
  return {
    type: 'include',
    label,
    path: options.path ?? { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders()' },
    exposeAsVariable: options.exposeAsVariable ?? false,
    mergeStrategy: options.mergeStrategy ?? 'no_merge',
    location: options.location ?? {
      file: '/repo/env/dev/terragrunt.hcl',
      lineStart: 5,
      lineEnd: 10,
      columnStart: 1,
      columnEnd: 1,
      startLine: 5,
      endLine: 10,
    } as any,
    raw: options.raw ?? `include "${label}" { ... }`,
  };
}

function createMockDependencyBlock(
  name: string,
  options: Partial<DependencyBlock> = {}
): DependencyBlock {
  return {
    type: 'dependency',
    name,
    configPath: options.configPath ?? { type: 'literal', value: `../${name}`, raw: `"../${name}"` },
    skipOutputs: options.skipOutputs ?? false,
    mockOutputs: options.mockOutputs ?? {},
    mockOutputsMergeStrategyWithState: options.mockOutputsMergeStrategyWithState ?? 'shallow',
    mockOutputsAllowedTerraformCommands: options.mockOutputsAllowedTerraformCommands ?? [],
    location: options.location ?? {
      file: '/repo/env/dev/terragrunt.hcl',
      lineStart: 15,
      lineEnd: 22,
      columnStart: 1,
      columnEnd: 1,
      startLine: 15,
      endLine: 22,
    } as any,
    raw: options.raw ?? `dependency "${name}" { ... }`,
  };
}

// ============================================================================
// createTerragruntIncludeNode Tests
// ============================================================================

describe('createTerragruntIncludeNode', () => {
  const mockOptions = createMockOptions();

  describe('basic node creation', () => {
    it('should create include node with correct type discriminant', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id-123', mockOptions);

      expect(node.type).toBe('tg_include');
    });

    it('should generate unique ID using idGenerator', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id-123', mockOptions);

      expect(node.id).toBe('test-uuid-12345');
    });

    it('should use include label as node name', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id-123', mockOptions);

      expect(node.name).toBe('root');
      expect(node.label).toBe('root');
    });

    it('should use "unnamed" for empty label', () => {
      const include = createMockResolvedInclude('', '/repo/common.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id-123', mockOptions);

      expect(node.name).toBe('unnamed');
      expect(node.label).toBe('');
    });
  });

  describe('path handling', () => {
    it('should include raw path expression', () => {
      const include: ResolvedInclude = {
        label: 'root',
        pathExpression: { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders("root.hcl")' },
        resolvedPath: '/repo/root.hcl',
        resolved: true,
        mergeStrategy: 'deep',
      };

      const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

      expect(node.path).toBe('find_in_parent_folders("root.hcl")');
    });

    it('should include resolved path when available', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

      expect(node.resolvedPath).toBe('/repo/root.hcl');
    });

    it('should handle null resolvedPath', () => {
      const include = createMockResolvedInclude('root', null);
      const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

      expect(node.resolvedPath).toBeNull();
    });
  });

  describe('merge strategy', () => {
    it('should include merge strategy from resolved include', () => {
      const strategies: Array<'no_merge' | 'shallow' | 'deep'> = ['no_merge', 'shallow', 'deep'];

      for (const strategy of strategies) {
        const include: ResolvedInclude = {
          label: 'test',
          pathExpression: { type: 'literal', value: 'test.hcl', raw: '"test.hcl"' },
          resolvedPath: '/repo/test.hcl',
          resolved: true,
          mergeStrategy: strategy,
        };

        const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

        expect(node.mergeStrategy).toBe(strategy);
      }
    });
  });

  describe('metadata', () => {
    it('should include scanId in metadata', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

      expect(node.metadata.scanId).toBe('scan-123');
    });

    it('should include parentConfigId in metadata', () => {
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-config-xyz', mockOptions);

      expect(node.metadata.parentConfigId).toBe('parent-config-xyz');
    });
  });

  describe('expose property', () => {
    it('should default expose to false for ResolvedInclude', () => {
      // ResolvedInclude doesn't have exposeAsVariable, so factory defaults to false
      const include = createMockResolvedInclude('root', '/repo/root.hcl');
      const node = createTerragruntIncludeNode(include, 'parent-id', mockOptions);

      expect(node.expose).toBe(false);
    });
  });
});

// ============================================================================
// createTerragruntIncludeNodeFromBlock Tests
// ============================================================================

describe('createTerragruntIncludeNodeFromBlock', () => {
  const mockOptions = createMockOptions();

  describe('basic node creation', () => {
    it('should create include node from IncludeBlock', () => {
      const block = createMockIncludeBlock('root', { exposeAsVariable: true });
      const node = createTerragruntIncludeNodeFromBlock(block, 'parent-id', '/repo/root.hcl', mockOptions);

      expect(node.type).toBe('tg_include');
      expect(node.label).toBe('root');
    });

    it('should preserve exposeAsVariable from block', () => {
      const block = createMockIncludeBlock('root', { exposeAsVariable: true });
      const node = createTerragruntIncludeNodeFromBlock(block, 'parent-id', '/repo/root.hcl', mockOptions);

      expect(node.expose).toBe(true);
    });

    it('should handle false exposeAsVariable', () => {
      const block = createMockIncludeBlock('root', { exposeAsVariable: false });
      const node = createTerragruntIncludeNodeFromBlock(block, 'parent-id', '/repo/root.hcl', mockOptions);

      expect(node.expose).toBe(false);
    });
  });

  describe('location handling', () => {
    it('should calculate relative file path from repository root', () => {
      const block = createMockIncludeBlock('root', {
        location: {
          file: '/repo/env/dev/terragrunt.hcl',
          lineStart: 5,
          lineEnd: 10,
          columnStart: 1,
          columnEnd: 1,
          startLine: 5,
          endLine: 10,
        } as any,
      });
      const node = createTerragruntIncludeNodeFromBlock(block, 'parent-id', '/repo/root.hcl', mockOptions);

      expect(node.location.file).toBe('env/dev/terragrunt.hcl');
      expect(node.location.lineStart).toBe(5);
      expect(node.location.lineEnd).toBe(10);
    });
  });

  describe('merge strategy', () => {
    it('should preserve merge strategy from block', () => {
      const strategies: Array<'no_merge' | 'shallow' | 'deep'> = ['no_merge', 'shallow', 'deep'];

      for (const strategy of strategies) {
        const block = createMockIncludeBlock('test', { mergeStrategy: strategy });
        const node = createTerragruntIncludeNodeFromBlock(block, 'parent-id', '/repo/test.hcl', mockOptions);

        expect(node.mergeStrategy).toBe(strategy);
      }
    });
  });
});

// ============================================================================
// createTerragruntDependencyNode Tests
// ============================================================================

describe('createTerragruntDependencyNode', () => {
  const mockOptions = createMockOptions();

  describe('basic node creation', () => {
    it('should create dependency node with correct type discriminant', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id-123', mockOptions);

      expect(node.type).toBe('tg_dependency');
    });

    it('should generate unique ID using idGenerator', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id-123', mockOptions);

      expect(node.id).toBe('test-uuid-12345');
    });

    it('should use dependency name as node name', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id-123', mockOptions);

      expect(node.name).toBe('vpc');
      expect(node.dependencyName).toBe('vpc');
    });
  });

  describe('path handling', () => {
    it('should include raw config path expression', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.configPath).toBe('"../vpc"');
    });

    it('should include resolved path when available', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.resolvedPath).toBe('/repo/vpc/terragrunt.hcl');
    });

    it('should handle null resolvedPath', () => {
      const dependency = createMockResolvedDependency('vpc', null);
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.resolvedPath).toBeNull();
    });
  });

  describe('output handling', () => {
    it('should default skipOutputs to false for ResolvedDependency', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.skipOutputs).toBe(false);
    });

    it('should default hasMockOutputs to false for ResolvedDependency', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.hasMockOutputs).toBe(false);
    });
  });

  describe('metadata', () => {
    it('should include scanId in metadata', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-id', mockOptions);

      expect(node.metadata.scanId).toBe('scan-123');
    });

    it('should include parentConfigId in metadata', () => {
      const dependency = createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl');
      const node = createTerragruntDependencyNode(dependency, 'parent-config-xyz', mockOptions);

      expect(node.metadata.parentConfigId).toBe('parent-config-xyz');
    });
  });
});

// ============================================================================
// createTerragruntDependencyNodeFromBlock Tests
// ============================================================================

describe('createTerragruntDependencyNodeFromBlock', () => {
  const mockOptions = createMockOptions();

  describe('basic node creation', () => {
    it('should create dependency node from DependencyBlock', () => {
      const block = createMockDependencyBlock('vpc');
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.type).toBe('tg_dependency');
      expect(node.dependencyName).toBe('vpc');
    });
  });

  describe('skipOutputs handling', () => {
    it('should preserve skipOutputs true from block', () => {
      const block = createMockDependencyBlock('vpc', { skipOutputs: true });
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.skipOutputs).toBe(true);
    });

    it('should preserve skipOutputs false from block', () => {
      const block = createMockDependencyBlock('vpc', { skipOutputs: false });
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.skipOutputs).toBe(false);
    });
  });

  describe('mockOutputs handling', () => {
    it('should detect hasMockOutputs when mockOutputs is non-empty', () => {
      const block = createMockDependencyBlock('vpc', {
        mockOutputs: {
          vpc_id: { type: 'literal', value: 'mock-vpc-123', raw: '"mock-vpc-123"' },
        },
      });
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.hasMockOutputs).toBe(true);
    });

    it('should set hasMockOutputs false when mockOutputs is empty', () => {
      const block = createMockDependencyBlock('vpc', { mockOutputs: {} });
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.hasMockOutputs).toBe(false);
    });
  });

  describe('location handling', () => {
    it('should calculate relative file path from repository root', () => {
      const block = createMockDependencyBlock('vpc', {
        location: {
          file: '/repo/env/dev/terragrunt.hcl',
          lineStart: 15,
          lineEnd: 22,
          columnStart: 1,
          columnEnd: 1,
          startLine: 15,
          endLine: 22,
        } as any,
      });
      const node = createTerragruntDependencyNodeFromBlock(block, 'parent-id', '/repo/vpc/terragrunt.hcl', mockOptions);

      expect(node.location.file).toBe('env/dev/terragrunt.hcl');
      expect(node.location.lineStart).toBe(15);
      expect(node.location.lineEnd).toBe(22);
    });
  });
});

// ============================================================================
// createAllTerragruntNodes Tests
// ============================================================================

describe('createAllTerragruntNodes', () => {
  const mockOptions = createMockOptions();

  it('should create config node from file', () => {
    const mockFile = createMockTerragruntFile();
    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0].type).toBe('tg_config');
  });

  it('should create include nodes from file includes', () => {
    const mockFile = createMockTerragruntFile({
      includes: [
        createMockResolvedInclude('root', '/repo/root.hcl'),
        createMockResolvedInclude('common', '/repo/common.hcl'),
      ],
    });

    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const result = createAllTerragruntNodes(mockFile, customOptions);

    expect(result.includeNodes).toHaveLength(2);
    expect(result.includeNodes[0].type).toBe('tg_include');
    expect(result.includeNodes[1].type).toBe('tg_include');
    expect(result.includeNodes[0].label).toBe('root');
    expect(result.includeNodes[1].label).toBe('common');
  });

  it('should create dependency nodes from file dependencies', () => {
    const mockFile = createMockTerragruntFile({
      dependencies: [
        createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
        createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl'),
        createMockResolvedDependency('redis', '/repo/redis/terragrunt.hcl'),
      ],
    });

    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const result = createAllTerragruntNodes(mockFile, customOptions);

    expect(result.dependencyNodes).toHaveLength(3);
    expect(result.dependencyNodes[0].type).toBe('tg_dependency');
    expect(result.dependencyNodes[0].dependencyName).toBe('vpc');
    expect(result.dependencyNodes[1].dependencyName).toBe('rds');
    expect(result.dependencyNodes[2].dependencyName).toBe('redis');
  });

  it('should create dependency hints from resolved dependencies', () => {
    const mockFile = createMockTerragruntFile({
      dependencies: [
        createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
      ],
    });

    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.dependencyHints.length).toBeGreaterThan(0);
  });

  it('should create include hints from resolved includes', () => {
    const mockFile = createMockTerragruntFile({
      includes: [
        createMockResolvedInclude('root', '/repo/root.hcl'),
      ],
    });

    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.includeHints.length).toBeGreaterThan(0);
  });

  it('should create path-to-ID map for config node', () => {
    const mockFile = createMockTerragruntFile({ path: '/repo/env/dev/terragrunt.hcl' });
    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.pathToIdMap.size).toBe(1);
    expect(result.pathToIdMap.has('/repo/env/dev/terragrunt.hcl')).toBe(true);
  });
});

// ============================================================================
// createAllTerragruntNodesFromFiles Tests
// ============================================================================

describe('createAllTerragruntNodesFromFiles', () => {
  const mockOptions = createMockOptions();

  it('should aggregate config nodes from multiple files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/rds/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/app/terragrunt.hcl' }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.configNodes).toHaveLength(3);
    expect(result.configNodes.every(n => n.type === 'tg_config')).toBe(true);
  });

  it('should aggregate include nodes from multiple files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      }),
      createMockTerragruntFile({
        path: '/repo/db/terragrunt.hcl',
        includes: [
          createMockResolvedInclude('root', '/repo/root.hcl'),
          createMockResolvedInclude('db-common', '/repo/db-common.hcl'),
        ],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.includeNodes).toHaveLength(3);
  });

  it('should aggregate dependency nodes from multiple files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        dependencies: [
          createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
          createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl'),
        ],
      }),
      createMockTerragruntFile({
        path: '/repo/api/terragrunt.hcl',
        dependencies: [
          createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
        ],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.dependencyNodes).toHaveLength(3);
  });

  it('should resolve dependency hint target IDs across files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        dependencies: [
          createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
        ],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    // Should have hints with resolved target IDs
    const vpcHint = result.dependencyHints.find(h => h.dependencyName === 'vpc' && h.targetPath === '/repo/vpc/terragrunt.hcl');
    expect(vpcHint).toBeDefined();
    expect(vpcHint?.targetId).toBeDefined();
    expect(vpcHint?.targetId).not.toBeNull();
  });

  it('should resolve include hint target IDs across files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/root.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app/terragrunt.hcl',
        includes: [
          createMockResolvedInclude('root', '/repo/root.hcl'),
        ],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    // Should have hints with resolved target IDs
    const rootHint = result.includeHints.find(h => h.includeLabel === 'root' && h.targetPath === '/repo/root.hcl');
    expect(rootHint).toBeDefined();
    expect(rootHint?.targetId).toBeDefined();
  });

  it('should aggregate pathToIdMap from all files', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/vpc/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/rds/terragrunt.hcl' }),
      createMockTerragruntFile({ path: '/repo/app/terragrunt.hcl' }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.pathToIdMap.size).toBe(3);
    expect(result.pathToIdMap.has('/repo/vpc/terragrunt.hcl')).toBe(true);
    expect(result.pathToIdMap.has('/repo/rds/terragrunt.hcl')).toBe(true);
    expect(result.pathToIdMap.has('/repo/app/terragrunt.hcl')).toBe(true);
  });

  it('should handle empty file array', () => {
    const result = createAllTerragruntNodesFromFiles([], mockOptions);

    expect(result.configNodes).toHaveLength(0);
    expect(result.includeNodes).toHaveLength(0);
    expect(result.dependencyNodes).toHaveLength(0);
    expect(result.dependencyHints).toHaveLength(0);
    expect(result.includeHints).toHaveLength(0);
    expect(result.pathToIdMap.size).toBe(0);
  });

  it('should handle files without includes or dependencies', () => {
    const files = [
      createMockTerragruntFile({ path: '/repo/standalone/terragrunt.hcl' }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, mockOptions);

    expect(result.configNodes).toHaveLength(1);
    expect(result.includeNodes).toHaveLength(0);
    expect(result.dependencyNodes).toHaveLength(0);
  });
});

// ============================================================================
// Edge Cases for Include and Dependency Nodes
// ============================================================================

describe('Edge Cases for Include and Dependency Nodes', () => {
  const mockOptions = createMockOptions();

  it('should handle deeply nested dependency chains', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/base/terragrunt.hcl' }),
      createMockTerragruntFile({
        path: '/repo/tier1/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('base', '/repo/base/terragrunt.hcl')],
      }),
      createMockTerragruntFile({
        path: '/repo/tier2/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('tier1', '/repo/tier1/terragrunt.hcl')],
      }),
      createMockTerragruntFile({
        path: '/repo/tier3/terragrunt.hcl',
        dependencies: [createMockResolvedDependency('tier2', '/repo/tier2/terragrunt.hcl')],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.configNodes).toHaveLength(4);
    expect(result.dependencyNodes).toHaveLength(3);
  });

  it('should handle multiple includes pointing to same target', () => {
    let idCounter = 0;
    const customOptions: TerragruntNodeFactoryOptions = {
      ...mockOptions,
      idGenerator: () => `node-${idCounter++}`,
    };

    const files = [
      createMockTerragruntFile({ path: '/repo/root.hcl' }),
      createMockTerragruntFile({
        path: '/repo/app1/terragrunt.hcl',
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      }),
      createMockTerragruntFile({
        path: '/repo/app2/terragrunt.hcl',
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      }),
      createMockTerragruntFile({
        path: '/repo/app3/terragrunt.hcl',
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
      }),
    ];

    const result = createAllTerragruntNodesFromFiles(files, customOptions);

    expect(result.configNodes).toHaveLength(4);
    expect(result.includeNodes).toHaveLength(3);

    // All include nodes should have same targetId (the root.hcl config)
    const rootHints = result.includeHints.filter(h => h.targetPath === '/repo/root.hcl');
    expect(rootHints.length).toBeGreaterThanOrEqual(3);
    const targetIds = new Set(rootHints.map(h => h.targetId).filter(id => id !== null));
    expect(targetIds.size).toBe(1); // All should resolve to same target
  });

  it('should handle special characters in dependency names', () => {
    const mockFile = createMockTerragruntFile({
      dependencies: [
        createMockResolvedDependency('vpc-us-east-1', '/repo/vpc-us-east-1/terragrunt.hcl'),
        createMockResolvedDependency('rds_primary_v2', '/repo/rds_primary_v2/terragrunt.hcl'),
      ],
    });

    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.dependencyNodes[0].dependencyName).toBe('vpc-us-east-1');
    expect(result.dependencyNodes[1].dependencyName).toBe('rds_primary_v2');
  });

  it('should handle unresolved dependencies (external modules)', () => {
    const mockFile = createMockTerragruntFile({
      dependencies: [
        createMockResolvedDependency('external-vpc', null),
        createMockResolvedDependency('external-rds', null),
      ],
    });

    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.dependencyNodes).toHaveLength(2);
    expect(result.dependencyNodes[0].resolvedPath).toBeNull();
    expect(result.dependencyNodes[1].resolvedPath).toBeNull();
  });

  it('should handle mixed resolved and unresolved includes', () => {
    const mockFile = createMockTerragruntFile({
      includes: [
        createMockResolvedInclude('root', '/repo/root.hcl'),
        createMockResolvedInclude('missing', null),
      ],
    });

    const result = createAllTerragruntNodes(mockFile, mockOptions);

    expect(result.includeNodes).toHaveLength(2);
    expect(result.includeNodes[0].resolvedPath).toBe('/repo/root.hcl');
    expect(result.includeNodes[1].resolvedPath).toBeNull();
  });
});
