/**
 * Terragrunt Metadata Extractor Unit Tests
 * @module tests/parsers/terragrunt/metadata-extractor.test
 *
 * TASK-TG-007: Tests for pure functions that extract metadata from parsed Terragrunt files.
 * Target: 80%+ coverage for metadata-extractor.ts
 */

import { describe, it, expect } from 'vitest';
import {
  extractTerragruntMetadata,
  extractTerraformSource,
  extractRemoteStateInfo,
  countInputs,
  extractGenerateLabels,
  hasErrors,
  hasTerraformSource,
  hasRemoteState,
  hasDependencies,
  hasIncludes,
  getConfigurationSummary,
} from '../../../src/parsers/terragrunt/metadata-extractor';
import type {
  TerragruntFile,
  TerragruntBlock,
  TerraformBlock,
  RemoteStateBlock,
  InputsBlock,
  GenerateBlock,
  LocalsBlock,
  TerragruntNodeMetadata,
  ResolvedInclude,
  ResolvedDependency,
} from '../../../src/parsers/terragrunt/types';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLocation = () => ({
  file: 'test.hcl',
  lineStart: 1,
  lineEnd: 10,
  columnStart: 1,
  columnEnd: 1,
});

function createMockTerraformBlock(source: string | null = null): TerraformBlock {
  return {
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
  };
}

function createMockTerraformBlockWithFunctionSource(): TerraformBlock {
  return {
    type: 'terraform',
    source: {
      type: 'function',
      name: 'get_terragrunt_dir',
      args: [],
      raw: '${get_terragrunt_dir()}/../modules/vpc',
    },
    extraArguments: [],
    beforeHooks: [],
    afterHooks: [],
    errorHooks: [],
    includeInCopy: [],
    location: createMockLocation(),
    raw: 'terraform { ... }',
  };
}

function createMockTerraformBlockWithNonStringSource(): TerraformBlock {
  return {
    type: 'terraform',
    source: {
      type: 'literal',
      value: 12345, // Non-string literal (edge case)
      raw: '12345',
    },
    extraArguments: [],
    beforeHooks: [],
    afterHooks: [],
    errorHooks: [],
    includeInCopy: [],
    location: createMockLocation(),
    raw: 'terraform { ... }',
  };
}

function createMockRemoteStateBlock(backend: string): RemoteStateBlock {
  return {
    type: 'remote_state',
    backend,
    generate: { path: 'backend.tf', ifExists: 'overwrite_terragrunt' },
    config: {},
    disableInit: false,
    disableDependencyOptimization: false,
    location: createMockLocation(),
    raw: 'remote_state { ... }',
  };
}

function createMockInputsBlock(inputCount: number): InputsBlock {
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
}

function createMockGenerateBlock(label: string): GenerateBlock {
  return {
    type: 'generate',
    label,
    path: { type: 'literal', value: `${label}.tf`, raw: `"${label}.tf"` },
    contents: { type: 'literal', value: 'content', raw: '"content"' },
    ifExists: 'overwrite_terragrunt',
    commentPrefix: '# ',
    disableSignature: false,
    location: createMockLocation(),
    raw: `generate "${label}" { ... }`,
  };
}

function createMockLocalsBlock(): LocalsBlock {
  return {
    type: 'locals',
    variables: {
      region: { type: 'literal', value: 'us-east-1', raw: '"us-east-1"' },
    },
    location: createMockLocation(),
    raw: 'locals { ... }',
  };
}

function createMockResolvedInclude(label: string): ResolvedInclude {
  return {
    label,
    pathExpression: { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders()' },
    resolvedPath: '/repo/root.hcl',
    resolved: true,
    mergeStrategy: 'deep',
  };
}

function createMockResolvedDependency(name: string): ResolvedDependency {
  return {
    name,
    configPathExpression: { type: 'literal', value: `../${name}`, raw: `"../${name}"` },
    resolvedPath: `/repo/${name}/terragrunt.hcl`,
    resolved: true,
    outputsUsed: ['output_a', 'output_b'],
  };
}

interface MockTerragruntFileOptions {
  blocks?: TerragruntBlock[];
  includes?: ResolvedInclude[];
  dependencies?: ResolvedDependency[];
  errors?: { message: string; location: null; severity: 'error' | 'warning'; code: 'SYNTAX_ERROR' }[];
  encoding?: string;
  size?: number;
}

function createMockTerragruntFile(options: MockTerragruntFileOptions = {}): TerragruntFile {
  return {
    path: '/repo/env/dev/terragrunt.hcl',
    blocks: options.blocks ?? [],
    includes: options.includes ?? [],
    dependencies: options.dependencies ?? [],
    errors: options.errors ?? [],
    encoding: options.encoding ?? 'utf-8',
    size: options.size ?? 1024,
  };
}

// ============================================================================
// extractTerraformSource Tests
// ============================================================================

describe('extractTerraformSource', () => {
  it('should extract source from terraform block with literal value', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('git::https://example.com/modules//vpc?ref=v1.0.0'),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBe('git::https://example.com/modules//vpc?ref=v1.0.0');
  });

  it('should return null when no terraform block exists', () => {
    const blocks: TerragruntBlock[] = [
      createMockRemoteStateBlock('s3'),
      createMockInputsBlock(3),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBeNull();
  });

  it('should return null when terraform block has no source', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock(null),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBeNull();
  });

  it('should handle function expression source (return raw)', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlockWithFunctionSource(),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBe('${get_terragrunt_dir()}/../modules/vpc');
  });

  it('should handle non-string literal source by converting to string', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlockWithNonStringSource(),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBe('12345');
  });

  it('should return first terraform block source when multiple exist', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('first-module'),
      createMockTerraformBlock('second-module'),
    ];

    const source = extractTerraformSource(blocks);

    expect(source).toBe('first-module');
  });

  it('should handle various source formats', () => {
    const sourceFormats = [
      'git::https://github.com/org/repo.git//modules/vpc?ref=v1.0.0',
      'github.com/org/repo//modules/vpc',
      's3::https://s3-eu-west-1.amazonaws.com/bucket/module.zip',
      'gcs::https://www.googleapis.com/storage/v1/bucket/module.zip',
      'registry.terraform.io/hashicorp/consul/aws',
      '../local/path/to/module',
      '/absolute/path/to/module',
    ];

    for (const format of sourceFormats) {
      const blocks: TerragruntBlock[] = [createMockTerraformBlock(format)];
      const source = extractTerraformSource(blocks);
      expect(source).toBe(format);
    }
  });
});

// ============================================================================
// extractRemoteStateInfo Tests
// ============================================================================

describe('extractRemoteStateInfo', () => {
  it('should extract remote state info with S3 backend', () => {
    const blocks: TerragruntBlock[] = [
      createMockRemoteStateBlock('s3'),
    ];

    const info = extractRemoteStateInfo(blocks);

    expect(info.hasRemoteState).toBe(true);
    expect(info.remoteStateBackend).toBe('s3');
  });

  it('should extract remote state info with GCS backend', () => {
    const blocks: TerragruntBlock[] = [
      createMockRemoteStateBlock('gcs'),
    ];

    const info = extractRemoteStateInfo(blocks);

    expect(info.hasRemoteState).toBe(true);
    expect(info.remoteStateBackend).toBe('gcs');
  });

  it('should extract remote state info with Azure backend', () => {
    const blocks: TerragruntBlock[] = [
      createMockRemoteStateBlock('azurerm'),
    ];

    const info = extractRemoteStateInfo(blocks);

    expect(info.hasRemoteState).toBe(true);
    expect(info.remoteStateBackend).toBe('azurerm');
  });

  it('should return false when no remote_state block exists', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('source'),
      createMockInputsBlock(3),
    ];

    const info = extractRemoteStateInfo(blocks);

    expect(info.hasRemoteState).toBe(false);
    expect(info.remoteStateBackend).toBeNull();
  });

  it('should handle various backend types', () => {
    const backends = ['s3', 'gcs', 'azurerm', 'consul', 'kubernetes', 'http', 'pg', 'etcdv3'];

    for (const backend of backends) {
      const blocks: TerragruntBlock[] = [createMockRemoteStateBlock(backend)];
      const info = extractRemoteStateInfo(blocks);

      expect(info.hasRemoteState).toBe(true);
      expect(info.remoteStateBackend).toBe(backend);
    }
  });

  it('should return first remote_state block when multiple exist', () => {
    const blocks: TerragruntBlock[] = [
      createMockRemoteStateBlock('s3'),
      createMockRemoteStateBlock('gcs'),
    ];

    const info = extractRemoteStateInfo(blocks);

    expect(info.remoteStateBackend).toBe('s3');
  });
});

// ============================================================================
// countInputs Tests
// ============================================================================

describe('countInputs', () => {
  it('should count inputs correctly', () => {
    const blocks: TerragruntBlock[] = [
      createMockInputsBlock(5),
    ];

    const count = countInputs(blocks);

    expect(count).toBe(5);
  });

  it('should return 0 when no inputs block exists', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('source'),
      createMockRemoteStateBlock('s3'),
    ];

    const count = countInputs(blocks);

    expect(count).toBe(0);
  });

  it('should return 0 for empty inputs block', () => {
    const blocks: TerragruntBlock[] = [
      createMockInputsBlock(0),
    ];

    const count = countInputs(blocks);

    expect(count).toBe(0);
  });

  it('should handle large number of inputs', () => {
    const blocks: TerragruntBlock[] = [
      createMockInputsBlock(100),
    ];

    const count = countInputs(blocks);

    expect(count).toBe(100);
  });

  it('should return first inputs block count when multiple exist', () => {
    const blocks: TerragruntBlock[] = [
      createMockInputsBlock(3),
      createMockInputsBlock(7),
    ];

    const count = countInputs(blocks);

    expect(count).toBe(3);
  });
});

// ============================================================================
// extractGenerateLabels Tests
// ============================================================================

describe('extractGenerateLabels', () => {
  it('should extract labels from generate blocks', () => {
    const blocks: TerragruntBlock[] = [
      createMockGenerateBlock('provider'),
      createMockGenerateBlock('backend'),
    ];

    const labels = extractGenerateLabels(blocks);

    expect(labels).toContain('provider');
    expect(labels).toContain('backend');
    expect(labels).toHaveLength(2);
  });

  it('should return empty array when no generate blocks exist', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('source'),
      createMockRemoteStateBlock('s3'),
    ];

    const labels = extractGenerateLabels(blocks);

    expect(labels).toHaveLength(0);
  });

  it('should handle multiple generate blocks', () => {
    const blocks: TerragruntBlock[] = [
      createMockGenerateBlock('provider'),
      createMockGenerateBlock('backend'),
      createMockGenerateBlock('versions'),
      createMockGenerateBlock('data'),
    ];

    const labels = extractGenerateLabels(blocks);

    expect(labels).toHaveLength(4);
    expect(labels).toContain('provider');
    expect(labels).toContain('backend');
    expect(labels).toContain('versions');
    expect(labels).toContain('data');
  });

  it('should preserve order of labels', () => {
    const blocks: TerragruntBlock[] = [
      createMockGenerateBlock('z-block'),
      createMockGenerateBlock('a-block'),
      createMockGenerateBlock('m-block'),
    ];

    const labels = extractGenerateLabels(blocks);

    expect(labels[0]).toBe('z-block');
    expect(labels[1]).toBe('a-block');
    expect(labels[2]).toBe('m-block');
  });

  it('should filter out non-generate blocks', () => {
    const blocks: TerragruntBlock[] = [
      createMockTerraformBlock('source'),
      createMockGenerateBlock('provider'),
      createMockRemoteStateBlock('s3'),
      createMockGenerateBlock('backend'),
      createMockInputsBlock(3),
    ];

    const labels = extractGenerateLabels(blocks);

    expect(labels).toHaveLength(2);
  });
});

// ============================================================================
// extractTerragruntMetadata Tests
// ============================================================================

describe('extractTerragruntMetadata', () => {
  it('should extract complete metadata from file', () => {
    const file = createMockTerragruntFile({
      blocks: [
        createMockTerraformBlock('git::https://example.com/module.git'),
        createMockRemoteStateBlock('s3'),
        createMockInputsBlock(5),
        createMockGenerateBlock('provider'),
        createMockGenerateBlock('backend'),
      ],
      includes: [
        createMockResolvedInclude('root'),
        createMockResolvedInclude('common'),
      ],
      dependencies: [
        createMockResolvedDependency('vpc'),
        createMockResolvedDependency('rds'),
        createMockResolvedDependency('elasticache'),
      ],
      encoding: 'utf-8',
      size: 2048,
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.terraformSource).toBe('git::https://example.com/module.git');
    expect(metadata.hasRemoteState).toBe(true);
    expect(metadata.remoteStateBackend).toBe('s3');
    expect(metadata.includeCount).toBe(2);
    expect(metadata.dependencyCount).toBe(3);
    expect(metadata.inputCount).toBe(5);
    expect(metadata.generateBlocks).toHaveLength(2);
    expect(metadata.generateBlocks).toContain('provider');
    expect(metadata.generateBlocks).toContain('backend');
    expect(metadata.dependencyNames).toContain('vpc');
    expect(metadata.dependencyNames).toContain('rds');
    expect(metadata.dependencyNames).toContain('elasticache');
    expect(metadata.includeLabels).toContain('root');
    expect(metadata.includeLabels).toContain('common');
    expect(metadata.encoding).toBe('utf-8');
    expect(metadata.size).toBe(2048);
    expect(metadata.blockCount).toBe(5);
    expect(metadata.errorCount).toBe(0);
  });

  it('should handle empty file', () => {
    const file = createMockTerragruntFile();

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.terraformSource).toBeNull();
    expect(metadata.hasRemoteState).toBe(false);
    expect(metadata.remoteStateBackend).toBeNull();
    expect(metadata.includeCount).toBe(0);
    expect(metadata.dependencyCount).toBe(0);
    expect(metadata.inputCount).toBe(0);
    expect(metadata.generateBlocks).toHaveLength(0);
    expect(metadata.dependencyNames).toHaveLength(0);
    expect(metadata.includeLabels).toHaveLength(0);
    expect(metadata.blockCount).toBe(0);
    expect(metadata.errorCount).toBe(0);
  });

  it('should count errors correctly', () => {
    const file = createMockTerragruntFile({
      errors: [
        { message: 'Syntax error', location: null, severity: 'error', code: 'SYNTAX_ERROR' },
        { message: 'Warning', location: null, severity: 'warning', code: 'SYNTAX_ERROR' },
        { message: 'Another error', location: null, severity: 'error', code: 'SYNTAX_ERROR' },
      ],
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.errorCount).toBe(3);
  });

  it('should include all dependency names', () => {
    const file = createMockTerragruntFile({
      dependencies: [
        createMockResolvedDependency('alpha'),
        createMockResolvedDependency('beta'),
        createMockResolvedDependency('gamma'),
      ],
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.dependencyNames).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('should include all include labels', () => {
    const file = createMockTerragruntFile({
      includes: [
        createMockResolvedInclude('root'),
        createMockResolvedInclude('env'),
        createMockResolvedInclude(''),
      ],
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.includeLabels).toEqual(['root', 'env', '']);
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('hasErrors', () => {
  it('should return true when file has errors', () => {
    const file = createMockTerragruntFile({
      errors: [{ message: 'Error', location: null, severity: 'error', code: 'SYNTAX_ERROR' }],
    });

    expect(hasErrors(file)).toBe(true);
  });

  it('should return false when file has no errors', () => {
    const file = createMockTerragruntFile({ errors: [] });

    expect(hasErrors(file)).toBe(false);
  });
});

describe('hasTerraformSource', () => {
  it('should return true when terraform block has source', () => {
    const file = createMockTerragruntFile({
      blocks: [createMockTerraformBlock('module-source')],
    });

    expect(hasTerraformSource(file)).toBe(true);
  });

  it('should return false when no terraform block', () => {
    const file = createMockTerragruntFile({ blocks: [] });

    expect(hasTerraformSource(file)).toBe(false);
  });

  it('should return false when terraform block has no source', () => {
    const file = createMockTerragruntFile({
      blocks: [createMockTerraformBlock(null)],
    });

    expect(hasTerraformSource(file)).toBe(false);
  });
});

describe('hasRemoteState', () => {
  it('should return true when remote_state block exists', () => {
    const file = createMockTerragruntFile({
      blocks: [createMockRemoteStateBlock('s3')],
    });

    expect(hasRemoteState(file)).toBe(true);
  });

  it('should return false when no remote_state block', () => {
    const file = createMockTerragruntFile({ blocks: [] });

    expect(hasRemoteState(file)).toBe(false);
  });
});

describe('hasDependencies', () => {
  it('should return true when dependencies exist', () => {
    const file = createMockTerragruntFile({
      dependencies: [createMockResolvedDependency('vpc')],
    });

    expect(hasDependencies(file)).toBe(true);
  });

  it('should return false when no dependencies', () => {
    const file = createMockTerragruntFile({ dependencies: [] });

    expect(hasDependencies(file)).toBe(false);
  });
});

describe('hasIncludes', () => {
  it('should return true when includes exist', () => {
    const file = createMockTerragruntFile({
      includes: [createMockResolvedInclude('root')],
    });

    expect(hasIncludes(file)).toBe(true);
  });

  it('should return false when no includes', () => {
    const file = createMockTerragruntFile({ includes: [] });

    expect(hasIncludes(file)).toBe(false);
  });
});

// ============================================================================
// getConfigurationSummary Tests
// ============================================================================

describe('getConfigurationSummary', () => {
  it('should generate summary for Terraform module with backend', () => {
    const metadata: TerragruntNodeMetadata = {
      terraformSource: 'git::https://example.com/module.git',
      hasRemoteState: true,
      remoteStateBackend: 's3',
      includeCount: 0,
      dependencyCount: 0,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: [],
      encoding: 'utf-8',
      size: 1024,
      blockCount: 2,
      errorCount: 0,
    };

    const summary = getConfigurationSummary(metadata);

    expect(summary).toContain('Terraform module');
    expect(summary).toContain('s3 backend');
  });

  it('should generate summary for config without terraform source', () => {
    const metadata: TerragruntNodeMetadata = {
      terraformSource: null,
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 1,
      dependencyCount: 0,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: ['root'],
      encoding: 'utf-8',
      size: 512,
      blockCount: 1,
      errorCount: 0,
    };

    const summary = getConfigurationSummary(metadata);

    expect(summary).toContain('Terragrunt config');
    expect(summary).toContain('1 include');
  });

  it('should include dependency count with correct pluralization', () => {
    const metadata1: TerragruntNodeMetadata = {
      terraformSource: 'source',
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 0,
      dependencyCount: 1,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: ['vpc'],
      includeLabels: [],
      encoding: 'utf-8',
      size: 512,
      blockCount: 1,
      errorCount: 0,
    };

    const metadata3: TerragruntNodeMetadata = {
      ...metadata1,
      dependencyCount: 3,
      dependencyNames: ['vpc', 'rds', 'elasticache'],
    };

    expect(getConfigurationSummary(metadata1)).toContain('1 dependency');
    expect(getConfigurationSummary(metadata3)).toContain('3 dependencies');
  });

  it('should include input count with correct pluralization', () => {
    const metadata1: TerragruntNodeMetadata = {
      terraformSource: 'source',
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 0,
      dependencyCount: 0,
      inputCount: 1,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: [],
      encoding: 'utf-8',
      size: 512,
      blockCount: 1,
      errorCount: 0,
    };

    const metadata5: TerragruntNodeMetadata = {
      ...metadata1,
      inputCount: 5,
    };

    expect(getConfigurationSummary(metadata1)).toContain('1 input');
    expect(getConfigurationSummary(metadata5)).toContain('5 inputs');
  });

  it('should include include count with correct pluralization', () => {
    const metadata1: TerragruntNodeMetadata = {
      terraformSource: null,
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 1,
      dependencyCount: 0,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: ['root'],
      encoding: 'utf-8',
      size: 512,
      blockCount: 1,
      errorCount: 0,
    };

    const metadata2: TerragruntNodeMetadata = {
      ...metadata1,
      includeCount: 2,
      includeLabels: ['root', 'common'],
    };

    expect(getConfigurationSummary(metadata1)).toContain('1 include');
    expect(getConfigurationSummary(metadata2)).toContain('2 includes');
  });

  it('should include error count with correct pluralization', () => {
    const metadata1: TerragruntNodeMetadata = {
      terraformSource: 'source',
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 0,
      dependencyCount: 0,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: [],
      encoding: 'utf-8',
      size: 512,
      blockCount: 1,
      errorCount: 1,
    };

    const metadata3: TerragruntNodeMetadata = {
      ...metadata1,
      errorCount: 3,
    };

    expect(getConfigurationSummary(metadata1)).toContain('1 error');
    expect(getConfigurationSummary(metadata3)).toContain('3 errors');
  });

  it('should generate comprehensive summary', () => {
    const metadata: TerragruntNodeMetadata = {
      terraformSource: 'git::https://example.com/module.git',
      hasRemoteState: true,
      remoteStateBackend: 's3',
      includeCount: 2,
      dependencyCount: 3,
      inputCount: 5,
      generateBlocks: ['provider', 'backend'],
      dependencyNames: ['vpc', 'rds', 'elasticache'],
      includeLabels: ['root', 'common'],
      encoding: 'utf-8',
      size: 2048,
      blockCount: 10,
      errorCount: 1,
    };

    const summary = getConfigurationSummary(metadata);

    expect(summary).toContain('Terraform module');
    expect(summary).toContain('s3 backend');
    expect(summary).toContain('3 dependencies');
    expect(summary).toContain('5 inputs');
    expect(summary).toContain('2 includes');
    expect(summary).toContain('1 error');
  });

  it('should handle minimal config', () => {
    const metadata: TerragruntNodeMetadata = {
      terraformSource: null,
      hasRemoteState: false,
      remoteStateBackend: null,
      includeCount: 0,
      dependencyCount: 0,
      inputCount: 0,
      generateBlocks: [],
      dependencyNames: [],
      includeLabels: [],
      encoding: 'utf-8',
      size: 0,
      blockCount: 0,
      errorCount: 0,
    };

    const summary = getConfigurationSummary(metadata);

    expect(summary).toBe('Terragrunt config');
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  it('should handle file with only non-extractable blocks', () => {
    const file = createMockTerragruntFile({
      blocks: [createMockLocalsBlock()],
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.terraformSource).toBeNull();
    expect(metadata.hasRemoteState).toBe(false);
    expect(metadata.inputCount).toBe(0);
    expect(metadata.generateBlocks).toHaveLength(0);
    expect(metadata.blockCount).toBe(1);
  });

  it('should handle very large number of blocks', () => {
    const blocks: TerragruntBlock[] = [];
    for (let i = 0; i < 100; i++) {
      blocks.push(createMockGenerateBlock(`block-${i}`));
    }

    const file = createMockTerragruntFile({ blocks });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.generateBlocks).toHaveLength(100);
    expect(metadata.blockCount).toBe(100);
  });

  it('should handle mixed block types', () => {
    const file = createMockTerragruntFile({
      blocks: [
        createMockTerraformBlock('source'),
        createMockRemoteStateBlock('s3'),
        createMockInputsBlock(3),
        createMockGenerateBlock('provider'),
        createMockLocalsBlock(),
      ],
    });

    const metadata = extractTerragruntMetadata(file);

    expect(metadata.terraformSource).toBe('source');
    expect(metadata.hasRemoteState).toBe(true);
    expect(metadata.remoteStateBackend).toBe('s3');
    expect(metadata.inputCount).toBe(3);
    expect(metadata.generateBlocks).toHaveLength(1);
    expect(metadata.blockCount).toBe(5);
  });

  it('should preserve encoding from original file', () => {
    const encodings = ['utf-8', 'utf-16', 'ascii', 'latin1'];

    for (const encoding of encodings) {
      const file = createMockTerragruntFile({ encoding });
      const metadata = extractTerragruntMetadata(file);
      expect(metadata.encoding).toBe(encoding);
    }
  });

  it('should handle zero-size files', () => {
    const file = createMockTerragruntFile({ size: 0 });
    const metadata = extractTerragruntMetadata(file);
    expect(metadata.size).toBe(0);
  });

  it('should handle very large files', () => {
    const file = createMockTerragruntFile({ size: 10 * 1024 * 1024 }); // 10MB
    const metadata = extractTerragruntMetadata(file);
    expect(metadata.size).toBe(10 * 1024 * 1024);
  });
});

// ============================================================================
// Integration-like Tests
// ============================================================================

describe('Complete Workflow', () => {
  it('should extract all metadata from a realistic config', () => {
    const file = createMockTerragruntFile({
      blocks: [
        createMockTerraformBlock('git::https://github.com/acme/terraform-modules.git//modules/vpc?ref=v2.1.0'),
        createMockRemoteStateBlock('s3'),
        createMockInputsBlock(12),
        createMockGenerateBlock('provider'),
        createMockGenerateBlock('backend'),
        createMockGenerateBlock('versions'),
        createMockLocalsBlock(),
      ],
      includes: [
        createMockResolvedInclude('root'),
        createMockResolvedInclude('env'),
      ],
      dependencies: [
        createMockResolvedDependency('networking'),
        createMockResolvedDependency('security'),
        createMockResolvedDependency('iam'),
      ],
      errors: [],
      encoding: 'utf-8',
      size: 4096,
    });

    const metadata = extractTerragruntMetadata(file);

    // Verify all fields
    expect(metadata.terraformSource).toBe('git::https://github.com/acme/terraform-modules.git//modules/vpc?ref=v2.1.0');
    expect(metadata.hasRemoteState).toBe(true);
    expect(metadata.remoteStateBackend).toBe('s3');
    expect(metadata.includeCount).toBe(2);
    expect(metadata.dependencyCount).toBe(3);
    expect(metadata.inputCount).toBe(12);
    expect(metadata.generateBlocks).toEqual(['provider', 'backend', 'versions']);
    expect(metadata.dependencyNames).toEqual(['networking', 'security', 'iam']);
    expect(metadata.includeLabels).toEqual(['root', 'env']);
    expect(metadata.encoding).toBe('utf-8');
    expect(metadata.size).toBe(4096);
    expect(metadata.blockCount).toBe(7);
    expect(metadata.errorCount).toBe(0);

    // Verify utility functions
    expect(hasErrors(file)).toBe(false);
    expect(hasTerraformSource(file)).toBe(true);
    expect(hasRemoteState(file)).toBe(true);
    expect(hasDependencies(file)).toBe(true);
    expect(hasIncludes(file)).toBe(true);

    // Verify summary
    const summary = getConfigurationSummary(metadata);
    expect(summary).toContain('Terraform module');
    expect(summary).toContain('s3 backend');
    expect(summary).toContain('3 dependencies');
    expect(summary).toContain('12 inputs');
    expect(summary).toContain('2 includes');
  });
});
