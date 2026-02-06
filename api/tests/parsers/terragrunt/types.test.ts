/**
 * Terragrunt Types Unit Tests
 * @module tests/parsers/terragrunt/types.test
 *
 * Tests for type guards, branded types, constants, and utility functions.
 * Target: 80%+ coverage for types.ts
 */

import { describe, it, expect } from 'vitest';
import {
  // Type guards
  isTerraformBlock,
  isRemoteStateBlock,
  isIncludeBlock,
  isLocalsBlock,
  isDependencyBlock,
  isDependenciesBlock,
  isGenerateBlock,
  isInputsBlock,
  isIamRoleBlock,
  isRetryConfigBlock,
  isSimpleConfigBlock,
  isTerragruntFunction,
  getTerragruntFunctionDef,
  isParseSuccess,
  isParseFailure,
  // Branded type creators
  createTerragruntFilePath,
  createIncludeLabel,
  createDependencyName,
  createGenerateLabel,
  // Visitor utilities
  visitBlock,
  assertNeverBlock,
  getBlockType,
  // Constants
  TERRAGRUNT_FUNCTIONS,
  TERRAGRUNT_FUNCTION_NAMES,
  DEFAULT_TERRAGRUNT_PARSER_OPTIONS,
  // Types
  type TerragruntBlock,
  type TerraformBlock,
  type RemoteStateBlock,
  type IncludeBlock,
  type LocalsBlock,
  type DependencyBlock,
  type DependenciesBlock,
  type GenerateBlock,
  type InputsBlock,
  type IamRoleBlock,
  type RetryConfigBlock,
  type SimpleConfigBlock,
  type TerragruntBlockVisitor,
  type ParseResultType,
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

const createMockTerraformBlock = (): TerraformBlock => ({
  type: 'terraform',
  source: { type: 'literal', value: 'git::https://example.com/module.git', raw: '"git::https://example.com/module.git"' },
  extraArguments: [],
  beforeHooks: [],
  afterHooks: [],
  errorHooks: [],
  includeInCopy: [],
  location: createMockLocation(),
  raw: 'terraform { source = "..." }',
});

const createMockRemoteStateBlock = (): RemoteStateBlock => ({
  type: 'remote_state',
  backend: 's3',
  generate: { path: 'backend.tf', ifExists: 'overwrite_terragrunt' },
  config: {},
  disableInit: false,
  disableDependencyOptimization: false,
  location: createMockLocation(),
  raw: 'remote_state { ... }',
});

const createMockIncludeBlock = (): IncludeBlock => ({
  type: 'include',
  label: 'root',
  path: { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders()' },
  exposeAsVariable: true,
  mergeStrategy: 'deep',
  location: createMockLocation(),
  raw: 'include "root" { ... }',
});

const createMockLocalsBlock = (): LocalsBlock => ({
  type: 'locals',
  variables: {
    region: { type: 'literal', value: 'us-east-1', raw: '"us-east-1"' },
    env: { type: 'literal', value: 'prod', raw: '"prod"' },
  },
  location: createMockLocation(),
  raw: 'locals { ... }',
});

const createMockDependencyBlock = (): DependencyBlock => ({
  type: 'dependency',
  name: 'vpc',
  configPath: { type: 'literal', value: '../vpc', raw: '"../vpc"' },
  skipOutputs: false,
  mockOutputs: {},
  mockOutputsMergeStrategyWithState: 'no_merge',
  mockOutputsAllowedTerraformCommands: ['validate', 'plan'],
  location: createMockLocation(),
  raw: 'dependency "vpc" { ... }',
});

const createMockDependenciesBlock = (): DependenciesBlock => ({
  type: 'dependencies',
  paths: { type: 'array', elements: [], raw: '[]' },
  location: createMockLocation(),
  raw: 'dependencies { ... }',
});

const createMockGenerateBlock = (): GenerateBlock => ({
  type: 'generate',
  label: 'provider',
  path: { type: 'literal', value: 'provider.tf', raw: '"provider.tf"' },
  contents: { type: 'literal', value: 'provider "aws" {}', raw: '"provider \\"aws\\" {}"' },
  ifExists: 'overwrite_terragrunt',
  commentPrefix: '# ',
  disableSignature: false,
  location: createMockLocation(),
  raw: 'generate "provider" { ... }',
});

const createMockInputsBlock = (): InputsBlock => ({
  type: 'inputs',
  values: {
    region: { type: 'literal', value: 'us-east-1', raw: '"us-east-1"' },
  },
  location: createMockLocation(),
  raw: 'inputs = { ... }',
});

const createMockIamRoleBlock = (): IamRoleBlock => ({
  type: 'iam_role',
  roleArn: { type: 'literal', value: 'arn:aws:iam::123456789:role/terraform', raw: '"arn:aws:iam::123456789:role/terraform"' },
  sessionDuration: 3600,
  webIdentityToken: null,
  location: createMockLocation(),
  raw: 'iam_role { ... }',
});

const createMockRetryConfigBlock = (): RetryConfigBlock => ({
  type: 'retry_config',
  retryableErrors: ['.*TooManyRequestsException.*'],
  maxRetryAttempts: 3,
  sleepBetweenRetries: 5,
  location: createMockLocation(),
  raw: 'retry_config { ... }',
});

const createMockSimpleConfigBlock = (type: 'download_dir' | 'prevent_destroy' | 'skip'): SimpleConfigBlock => ({
  type,
  value: { type: 'literal', value: type === 'download_dir' ? '/tmp/.terragrunt' : true, raw: type === 'download_dir' ? '"/tmp/.terragrunt"' : 'true' },
  location: createMockLocation(),
  raw: `${type} = ...`,
});

// ============================================================================
// Type Guard Tests
// ============================================================================

describe('Type Guards', () => {
  describe('isTerraformBlock', () => {
    it('should return true for terraform blocks', () => {
      const block = createMockTerraformBlock();
      expect(isTerraformBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockRemoteStateBlock();
      expect(isTerraformBlock(block)).toBe(false);
    });
  });

  describe('isRemoteStateBlock', () => {
    it('should return true for remote_state blocks', () => {
      const block = createMockRemoteStateBlock();
      expect(isRemoteStateBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isRemoteStateBlock(block)).toBe(false);
    });
  });

  describe('isIncludeBlock', () => {
    it('should return true for include blocks', () => {
      const block = createMockIncludeBlock();
      expect(isIncludeBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isIncludeBlock(block)).toBe(false);
    });
  });

  describe('isLocalsBlock', () => {
    it('should return true for locals blocks', () => {
      const block = createMockLocalsBlock();
      expect(isLocalsBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isLocalsBlock(block)).toBe(false);
    });
  });

  describe('isDependencyBlock', () => {
    it('should return true for dependency blocks', () => {
      const block = createMockDependencyBlock();
      expect(isDependencyBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isDependencyBlock(block)).toBe(false);
    });
  });

  describe('isDependenciesBlock', () => {
    it('should return true for dependencies blocks', () => {
      const block = createMockDependenciesBlock();
      expect(isDependenciesBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isDependenciesBlock(block)).toBe(false);
    });
  });

  describe('isGenerateBlock', () => {
    it('should return true for generate blocks', () => {
      const block = createMockGenerateBlock();
      expect(isGenerateBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isGenerateBlock(block)).toBe(false);
    });
  });

  describe('isInputsBlock', () => {
    it('should return true for inputs blocks', () => {
      const block = createMockInputsBlock();
      expect(isInputsBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isInputsBlock(block)).toBe(false);
    });
  });

  describe('isIamRoleBlock', () => {
    it('should return true for iam_role blocks', () => {
      const block = createMockIamRoleBlock();
      expect(isIamRoleBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isIamRoleBlock(block)).toBe(false);
    });
  });

  describe('isRetryConfigBlock', () => {
    it('should return true for retry_config blocks', () => {
      const block = createMockRetryConfigBlock();
      expect(isRetryConfigBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isRetryConfigBlock(block)).toBe(false);
    });
  });

  describe('isSimpleConfigBlock', () => {
    it('should return true for download_dir blocks', () => {
      const block = createMockSimpleConfigBlock('download_dir');
      expect(isSimpleConfigBlock(block)).toBe(true);
    });

    it('should return true for prevent_destroy blocks', () => {
      const block = createMockSimpleConfigBlock('prevent_destroy');
      expect(isSimpleConfigBlock(block)).toBe(true);
    });

    it('should return true for skip blocks', () => {
      const block = createMockSimpleConfigBlock('skip');
      expect(isSimpleConfigBlock(block)).toBe(true);
    });

    it('should return false for other block types', () => {
      const block = createMockTerraformBlock();
      expect(isSimpleConfigBlock(block)).toBe(false);
    });
  });
});

// ============================================================================
// Function Utilities Tests
// ============================================================================

describe('Function Utilities', () => {
  describe('isTerragruntFunction', () => {
    it('should return true for valid Terragrunt functions', () => {
      expect(isTerragruntFunction('find_in_parent_folders')).toBe(true);
      expect(isTerragruntFunction('get_terragrunt_dir')).toBe(true);
      expect(isTerragruntFunction('get_aws_account_id')).toBe(true);
      expect(isTerragruntFunction('read_terragrunt_config')).toBe(true);
      expect(isTerragruntFunction('get_env')).toBe(true);
    });

    it('should return false for invalid function names', () => {
      expect(isTerragruntFunction('unknown_function')).toBe(false);
      expect(isTerragruntFunction('terraform_function')).toBe(false);
      expect(isTerragruntFunction('')).toBe(false);
    });
  });

  describe('getTerragruntFunctionDef', () => {
    it('should return function definition for valid functions', () => {
      const findDef = getTerragruntFunctionDef('find_in_parent_folders');
      expect(findDef).toBeDefined();
      expect(findDef?.name).toBe('find_in_parent_folders');
      expect(findDef?.category).toBe('path');
      expect(findDef?.minArgs).toBe(0);
      expect(findDef?.maxArgs).toBe(2);
      expect(findDef?.returnType).toBe('string');
    });

    it('should return undefined for invalid function names', () => {
      expect(getTerragruntFunctionDef('unknown_function')).toBeUndefined();
    });

    it('should return correct definitions for all 27 functions', () => {
      expect(TERRAGRUNT_FUNCTIONS).toHaveLength(27);

      for (const func of TERRAGRUNT_FUNCTIONS) {
        const def = getTerragruntFunctionDef(func.name);
        expect(def).toBeDefined();
        expect(def?.name).toBe(func.name);
      }
    });
  });

  describe('TERRAGRUNT_FUNCTION_NAMES set', () => {
    it('should contain all 27 function names', () => {
      expect(TERRAGRUNT_FUNCTION_NAMES.size).toBe(27);
    });

    it('should be consistent with TERRAGRUNT_FUNCTIONS array', () => {
      for (const func of TERRAGRUNT_FUNCTIONS) {
        expect(TERRAGRUNT_FUNCTION_NAMES.has(func.name)).toBe(true);
      }
    });
  });
});

// ============================================================================
// Parse Result Type Guards Tests
// ============================================================================

describe('Parse Result Type Guards', () => {
  describe('isParseSuccess', () => {
    it('should return true for successful results', () => {
      const result: ParseResultType<string> = {
        success: true,
        value: 'test',
        warnings: [],
      };
      expect(isParseSuccess(result)).toBe(true);
    });

    it('should return false for failed results', () => {
      const result: ParseResultType<string> = {
        success: false,
        error: {
          message: 'Error',
          location: null,
          severity: 'error',
          code: 'SYNTAX_ERROR',
        },
      };
      expect(isParseSuccess(result)).toBe(false);
    });
  });

  describe('isParseFailure', () => {
    it('should return true for failed results', () => {
      const result: ParseResultType<string> = {
        success: false,
        error: {
          message: 'Error',
          location: null,
          severity: 'error',
          code: 'SYNTAX_ERROR',
        },
      };
      expect(isParseFailure(result)).toBe(true);
    });

    it('should return false for successful results', () => {
      const result: ParseResultType<string> = {
        success: true,
        value: 'test',
        warnings: [],
      };
      expect(isParseFailure(result)).toBe(false);
    });
  });
});

// ============================================================================
// Branded Type Creators Tests
// ============================================================================

describe('Branded Type Creators', () => {
  describe('createTerragruntFilePath', () => {
    it('should create branded file path', () => {
      const path = createTerragruntFilePath('/path/to/terragrunt.hcl');
      expect(path).toBe('/path/to/terragrunt.hcl');
    });
  });

  describe('createIncludeLabel', () => {
    it('should create branded include label', () => {
      const label = createIncludeLabel('root');
      expect(label).toBe('root');
    });
  });

  describe('createDependencyName', () => {
    it('should create branded dependency name', () => {
      const name = createDependencyName('vpc');
      expect(name).toBe('vpc');
    });
  });

  describe('createGenerateLabel', () => {
    it('should create branded generate label', () => {
      const label = createGenerateLabel('provider');
      expect(label).toBe('provider');
    });
  });
});

// ============================================================================
// Visitor Pattern Tests
// ============================================================================

describe('Visitor Pattern', () => {
  describe('visitBlock', () => {
    it('should call correct visitor method for each block type', () => {
      const results: string[] = [];

      const visitor: TerragruntBlockVisitor<string> = {
        visitTerraform: () => 'terraform',
        visitRemoteState: () => 'remote_state',
        visitInclude: () => 'include',
        visitLocals: () => 'locals',
        visitDependency: () => 'dependency',
        visitDependencies: () => 'dependencies',
        visitGenerate: () => 'generate',
        visitInputs: () => 'inputs',
        visitIamRole: () => 'iam_role',
        visitRetryConfig: () => 'retry_config',
        visitSimpleConfig: () => 'simple_config',
      };

      results.push(visitBlock(createMockTerraformBlock(), visitor));
      results.push(visitBlock(createMockRemoteStateBlock(), visitor));
      results.push(visitBlock(createMockIncludeBlock(), visitor));
      results.push(visitBlock(createMockLocalsBlock(), visitor));
      results.push(visitBlock(createMockDependencyBlock(), visitor));
      results.push(visitBlock(createMockDependenciesBlock(), visitor));
      results.push(visitBlock(createMockGenerateBlock(), visitor));
      results.push(visitBlock(createMockInputsBlock(), visitor));
      results.push(visitBlock(createMockIamRoleBlock(), visitor));
      results.push(visitBlock(createMockRetryConfigBlock(), visitor));
      results.push(visitBlock(createMockSimpleConfigBlock('skip'), visitor));

      expect(results).toEqual([
        'terraform',
        'remote_state',
        'include',
        'locals',
        'dependency',
        'dependencies',
        'generate',
        'inputs',
        'iam_role',
        'retry_config',
        'simple_config',
      ]);
    });
  });

  describe('getBlockType', () => {
    it('should return correct block type', () => {
      expect(getBlockType(createMockTerraformBlock())).toBe('terraform');
      expect(getBlockType(createMockRemoteStateBlock())).toBe('remote_state');
      expect(getBlockType(createMockIncludeBlock())).toBe('include');
      expect(getBlockType(createMockLocalsBlock())).toBe('locals');
      expect(getBlockType(createMockDependencyBlock())).toBe('dependency');
      expect(getBlockType(createMockDependenciesBlock())).toBe('dependencies');
      expect(getBlockType(createMockGenerateBlock())).toBe('generate');
      expect(getBlockType(createMockInputsBlock())).toBe('inputs');
      expect(getBlockType(createMockIamRoleBlock())).toBe('iam_role');
      expect(getBlockType(createMockRetryConfigBlock())).toBe('retry_config');
      expect(getBlockType(createMockSimpleConfigBlock('skip'))).toBe('skip');
    });
  });

  describe('assertNeverBlock', () => {
    it('should throw error for unhandled block types', () => {
      const invalidBlock = { type: 'unknown' } as never;
      expect(() => assertNeverBlock(invalidBlock)).toThrow('Unhandled block type');
    });

    it('should use custom message if provided', () => {
      const invalidBlock = { type: 'unknown' } as never;
      expect(() => assertNeverBlock(invalidBlock, 'Custom error')).toThrow('Custom error');
    });
  });
});

// ============================================================================
// Default Options Tests
// ============================================================================

describe('Default Parser Options', () => {
  it('should have correct default values', () => {
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.errorRecovery).toBe(true);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.maxFileSize).toBe(10 * 1024 * 1024);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.encoding).toBe('utf-8');
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.includeRaw).toBe(true);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.resolveIncludes).toBe(true);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.maxIncludeDepth).toBe(10);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.resolveDependencies).toBe(true);
    expect(DEFAULT_TERRAGRUNT_PARSER_OPTIONS.baseDir).toBeDefined();
  });
});

// ============================================================================
// Function Category Tests
// ============================================================================

describe('Function Categories', () => {
  it('should have correct category for path functions', () => {
    const pathFunctions = TERRAGRUNT_FUNCTIONS.filter(f => f.category === 'path');
    expect(pathFunctions).toHaveLength(6);
    expect(pathFunctions.map(f => f.name)).toContain('find_in_parent_folders');
    expect(pathFunctions.map(f => f.name)).toContain('get_terragrunt_dir');
    expect(pathFunctions.map(f => f.name)).toContain('path_relative_to_include');
  });

  it('should have correct category for AWS functions', () => {
    const awsFunctions = TERRAGRUNT_FUNCTIONS.filter(f => f.category === 'aws');
    expect(awsFunctions).toHaveLength(8);
    expect(awsFunctions.map(f => f.name)).toContain('get_aws_account_id');
    expect(awsFunctions.map(f => f.name)).toContain('get_aws_region');
  });

  it('should have correct category for runtime functions', () => {
    const runtimeFunctions = TERRAGRUNT_FUNCTIONS.filter(f => f.category === 'runtime');
    expect(runtimeFunctions).toHaveLength(2);
    expect(runtimeFunctions.map(f => f.name)).toContain('get_env');
    expect(runtimeFunctions.map(f => f.name)).toContain('get_platform');
  });

  it('should have correct category for read functions', () => {
    const readFunctions = TERRAGRUNT_FUNCTIONS.filter(f => f.category === 'read');
    expect(readFunctions).toHaveLength(4);
    expect(readFunctions.map(f => f.name)).toContain('sops_decrypt_file');
    expect(readFunctions.map(f => f.name)).toContain('run_cmd');
  });

  it('should have correct category for utility functions', () => {
    const utilityFunctions = TERRAGRUNT_FUNCTIONS.filter(f => f.category === 'utility');
    expect(utilityFunctions).toHaveLength(3);
    expect(utilityFunctions.map(f => f.name)).toContain('mark_as_read');
    expect(utilityFunctions.map(f => f.name)).toContain('parse_aws_arn');
  });
});
