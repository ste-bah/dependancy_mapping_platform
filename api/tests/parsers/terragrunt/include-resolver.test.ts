/**
 * Terragrunt Include Resolver Unit Tests
 * @module tests/parsers/terragrunt/include-resolver.test
 *
 * Tests for path resolution, circular dependency detection, and
 * configuration hierarchy resolution.
 * Target: 80%+ coverage for include-resolver.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as path from 'path';
import * as fs from 'fs';
import {
  IncludeResolver,
  createIncludeResolver,
  resolveReferences,
  type ResolutionOptions,
  type PathEvaluationContext,
} from '../../../src/parsers/terragrunt/include-resolver';
import type {
  TerragruntFile,
  IncludeBlock,
  DependencyBlock,
  DependenciesBlock,
  TerragruntParseError,
} from '../../../src/parsers/terragrunt/types';
import type { HCLExpression } from '../../../src/parsers/terraform/types';

// Mock fs module
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    promises: {
      readdir: vi.fn(),
    },
  };
});

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

const createLiteralExpression = (value: string): HCLExpression => ({
  type: 'literal',
  value,
  raw: `"${value}"`,
});

const createFunctionExpression = (name: string, args: HCLExpression[] = []): HCLExpression => ({
  type: 'function',
  name,
  args,
  raw: `${name}()`,
});

const createMockIncludeBlock = (label: string, pathExpr: HCLExpression): IncludeBlock => ({
  type: 'include',
  label,
  path: pathExpr,
  exposeAsVariable: false,
  mergeStrategy: 'no_merge',
  location: createMockLocation(),
  raw: 'include {}',
});

const createMockDependencyBlock = (name: string, configPath: HCLExpression): DependencyBlock => ({
  type: 'dependency',
  name,
  configPath,
  skipOutputs: false,
  mockOutputs: {},
  mockOutputsMergeStrategyWithState: 'no_merge',
  mockOutputsAllowedTerraformCommands: [],
  location: createMockLocation(),
  raw: 'dependency {}',
});

const createMockDependenciesBlock = (paths: HCLExpression): DependenciesBlock => ({
  type: 'dependencies',
  paths,
  location: createMockLocation(),
  raw: 'dependencies {}',
});

const createMockTerragruntFile = (
  filePath: string,
  blocks: (IncludeBlock | DependencyBlock | DependenciesBlock)[] = []
): TerragruntFile => ({
  path: filePath,
  blocks,
  includes: [],
  dependencies: [],
  errors: [],
  encoding: 'utf-8',
  size: 100,
});

// ============================================================================
// IncludeResolver Tests
// ============================================================================

describe('IncludeResolver', () => {
  describe('instantiation', () => {
    it('should create resolver with default options', () => {
      const resolver = new IncludeResolver();
      expect(resolver).toBeDefined();
    });

    it('should create resolver with custom options', () => {
      const resolver = new IncludeResolver({
        baseDir: '/custom/path',
        maxDepth: 5,
        resolveFileSystem: false,
      });
      expect(resolver).toBeDefined();
    });

    it('should create resolver using factory function', () => {
      const resolver = createIncludeResolver();
      expect(resolver).toBeInstanceOf(IncludeResolver);
    });
  });

  describe('resolveInclude', () => {
    let resolver: IncludeResolver;
    let context: PathEvaluationContext;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: false });
      context = {
        terragruntDir: '/project/modules/vpc',
        originalTerragruntDir: '/project/modules/vpc',
        repoRoot: '/project',
        locals: {},
      };
    });

    it('should resolve literal path', () => {
      const block = createMockIncludeBlock('root', createLiteralExpression('../common.hcl'));
      const result = resolver.resolveInclude(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toContain('common.hcl');
    });

    it('should resolve get_terragrunt_dir function', () => {
      const block = createMockIncludeBlock(
        'root',
        createFunctionExpression('get_terragrunt_dir')
      );
      const result = resolver.resolveInclude(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toBe('/project/modules/vpc');
    });

    it('should resolve get_original_terragrunt_dir function', () => {
      const block = createMockIncludeBlock(
        'root',
        createFunctionExpression('get_original_terragrunt_dir')
      );
      const result = resolver.resolveInclude(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toBe('/project/modules/vpc');
    });

    it('should resolve get_path_to_repo_root function', () => {
      const block = createMockIncludeBlock(
        'root',
        createFunctionExpression('get_path_to_repo_root')
      );
      const result = resolver.resolveInclude(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toBe('../..');
    });

    it('should resolve get_path_from_repo_root function', () => {
      const block = createMockIncludeBlock(
        'root',
        createFunctionExpression('get_path_from_repo_root')
      );
      const result = resolver.resolveInclude(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toBe('modules/vpc');
    });

    it('should preserve include label', () => {
      const block = createMockIncludeBlock('custom_label', createLiteralExpression('../common.hcl'));
      const result = resolver.resolveInclude(block, context);

      expect(result.label).toBe('custom_label');
    });

    it('should preserve merge strategy', () => {
      const block: IncludeBlock = {
        ...createMockIncludeBlock('root', createLiteralExpression('../common.hcl')),
        mergeStrategy: 'deep',
      };
      const result = resolver.resolveInclude(block, context);

      expect(result.mergeStrategy).toBe('deep');
    });
  });

  describe('resolveDependency', () => {
    let resolver: IncludeResolver;
    let context: PathEvaluationContext;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: false });
      context = {
        terragruntDir: '/project/modules/rds',
        originalTerragruntDir: '/project/modules/rds',
        repoRoot: '/project',
        locals: {},
      };
    });

    it('should resolve literal dependency path', () => {
      const block = createMockDependencyBlock('vpc', createLiteralExpression('../vpc'));
      const result = resolver.resolveDependency(block, context);

      expect(result.resolved).toBe(true);
      expect(result.name).toBe('vpc');
      expect(result.resolvedPath).toContain('vpc');
    });

    it('should handle function-based paths', () => {
      const block = createMockDependencyBlock(
        'common',
        createFunctionExpression('get_terragrunt_dir')
      );
      const result = resolver.resolveDependency(block, context);

      expect(result.resolved).toBe(true);
      expect(result.resolvedPath).toBe('/project/modules/rds');
    });
  });

  describe('resolveAll', () => {
    let resolver: IncludeResolver;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: false });
    });

    it('should resolve all includes and dependencies', () => {
      const file = createMockTerragruntFile('/project/modules/rds/terragrunt.hcl', [
        createMockIncludeBlock('root', createLiteralExpression('../../common.hcl')),
        createMockDependencyBlock('vpc', createLiteralExpression('../vpc')),
        createMockDependencyBlock('security', createLiteralExpression('../security')),
      ]);

      const result = resolver.resolveAll(file);

      expect(result.includes).toHaveLength(1);
      expect(result.dependencies).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle files with no includes or dependencies', () => {
      const file = createMockTerragruntFile('/project/modules/base/terragrunt.hcl', []);

      const result = resolver.resolveAll(file);

      expect(result.includes).toHaveLength(0);
      expect(result.dependencies).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should resolve dependencies block with array of paths', () => {
      const pathsExpr: HCLExpression = {
        type: 'array',
        elements: [
          createLiteralExpression('../vpc'),
          createLiteralExpression('../security'),
        ],
        raw: '["../vpc", "../security"]',
      };

      const file = createMockTerragruntFile('/project/modules/rds/terragrunt.hcl', [
        createMockDependenciesBlock(pathsExpr),
      ]);

      const result = resolver.resolveAll(file);

      expect(result.dependencies.length).toBeGreaterThan(0);
    });
  });

  describe('circular dependency detection', () => {
    it('should detect circular includes', () => {
      const visitedPaths = new Set(['/project/modules/vpc/terragrunt.hcl']);
      const resolver = new IncludeResolver({
        resolveFileSystem: false,
        visitedPaths,
      });

      const file = createMockTerragruntFile('/project/modules/rds/terragrunt.hcl', [
        createMockIncludeBlock('vpc', createLiteralExpression('/project/modules/vpc/terragrunt.hcl')),
      ]);

      const result = resolver.resolveAll(file);

      expect(result.circularWarnings.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'CIRCULAR_INCLUDE')).toBe(true);
    });

    it('should detect circular dependencies', () => {
      const visitedPaths = new Set(['/project/modules/vpc']);
      const resolver = new IncludeResolver({
        resolveFileSystem: false,
        visitedPaths,
      });

      const file = createMockTerragruntFile('/project/modules/rds/terragrunt.hcl', [
        createMockDependencyBlock('vpc', createLiteralExpression('/project/modules/vpc')),
      ]);

      const result = resolver.resolveAll(file);

      expect(result.circularWarnings.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.code === 'CIRCULAR_DEPENDENCY')).toBe(true);
    });
  });

  describe('findRepoRoot', () => {
    let resolver: IncludeResolver;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: true });
      vi.mocked(fs.existsSync).mockReset();
    });

    it('should find .git directory', () => {
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return String(p).endsWith('project/.git');
      });

      const root = resolver.findRepoRoot('/home/user/project/modules/vpc');

      expect(root).toBe('/home/user/project');
    });

    it('should return null if no .git found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      const root = resolver.findRepoRoot('/some/random/path');

      expect(root).toBeNull();
    });
  });

  describe('evaluatePath', () => {
    let resolver: IncludeResolver;
    let context: PathEvaluationContext;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: false });
      context = {
        terragruntDir: '/project/modules/vpc',
        originalTerragruntDir: '/project/modules/vpc',
        repoRoot: '/project',
        locals: {
          'my_path': '/custom/path',
        },
      };
    });

    it('should evaluate literal paths', () => {
      const result = resolver.evaluatePath(createLiteralExpression('../common.hcl'), context);

      expect(result).not.toBeNull();
      expect(result).toContain('common.hcl');
    });

    it('should evaluate local references', () => {
      const refExpr: HCLExpression = {
        type: 'reference',
        parts: ['local', 'my_path'],
        raw: 'local.my_path',
      };

      const result = resolver.evaluatePath(refExpr, context);

      expect(result).toBe('/custom/path');
    });

    it('should return null for complex expressions', () => {
      const conditionalExpr: HCLExpression = {
        type: 'conditional',
        condition: { type: 'reference', parts: ['var', 'enabled'], raw: 'var.enabled' },
        trueResult: createLiteralExpression('path1'),
        falseResult: createLiteralExpression('path2'),
        raw: 'var.enabled ? "path1" : "path2"',
      };

      const result = resolver.evaluatePath(conditionalExpr, context);

      expect(result).toBeNull();
    });

    it('should handle template expressions', () => {
      const templateExpr: HCLExpression = {
        type: 'template',
        parts: [
          '../',
          { type: 'literal', value: 'common', raw: 'common' },
          '.hcl',
        ],
        raw: '"../${common}.hcl"',
      };

      const result = resolver.evaluatePath(templateExpr, context);

      expect(result).toContain('common.hcl');
    });

    it('should handle path_relative_to_include as unresolvable', () => {
      const funcExpr = createFunctionExpression('path_relative_to_include');
      const result = resolver.evaluatePath(funcExpr, context);

      expect(result).toBeNull();
    });

    it('should handle path_relative_from_include as unresolvable', () => {
      const funcExpr = createFunctionExpression('path_relative_from_include');
      const result = resolver.evaluatePath(funcExpr, context);

      expect(result).toBeNull();
    });

    it('should return null for unknown functions', () => {
      const funcExpr = createFunctionExpression('unknown_function');
      const result = resolver.evaluatePath(funcExpr, context);

      expect(result).toBeNull();
    });
  });

  describe('find_in_parent_folders evaluation', () => {
    let resolver: IncludeResolver;

    beforeEach(() => {
      resolver = new IncludeResolver({ resolveFileSystem: false });
    });

    it('should resolve find_in_parent_folders with default filename', () => {
      const context: PathEvaluationContext = {
        terragruntDir: '/project/modules/vpc',
        originalTerragruntDir: '/project/modules/vpc',
        repoRoot: '/project',
        locals: {},
      };

      const funcExpr = createFunctionExpression('find_in_parent_folders');
      const result = resolver.evaluatePath(funcExpr, context);

      // When not resolving filesystem, returns first candidate
      expect(result).toContain('terragrunt.hcl');
    });

    it('should resolve find_in_parent_folders with custom filename', () => {
      const context: PathEvaluationContext = {
        terragruntDir: '/project/modules/vpc',
        originalTerragruntDir: '/project/modules/vpc',
        repoRoot: '/project',
        locals: {},
      };

      const funcExpr = createFunctionExpression('find_in_parent_folders', [
        createLiteralExpression('common.hcl'),
      ]);

      const result = resolver.evaluatePath(funcExpr, context);

      expect(result).toContain('common.hcl');
    });
  });
});

// ============================================================================
// resolveReferences Tests
// ============================================================================

describe('resolveReferences', () => {
  it('should resolve references using factory function', () => {
    const file = createMockTerragruntFile('/project/terragrunt.hcl', [
      createMockIncludeBlock('root', createLiteralExpression('../common.hcl')),
    ]);

    const result = resolveReferences(file, { resolveFileSystem: false });

    expect(result).toBeDefined();
    expect(result.includes).toBeDefined();
    expect(result.dependencies).toBeDefined();
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  let resolver: IncludeResolver;

  beforeEach(() => {
    resolver = new IncludeResolver({ resolveFileSystem: false });
  });

  it('should handle absolute paths', () => {
    const context: PathEvaluationContext = {
      terragruntDir: '/project/modules/vpc',
      originalTerragruntDir: '/project/modules/vpc',
      repoRoot: '/project',
      locals: {},
    };

    const result = resolver.evaluatePath(createLiteralExpression('/absolute/path/file.hcl'), context);

    expect(result).toBe(path.normalize('/absolute/path/file.hcl'));
  });

  it('should handle non-string literal expressions', () => {
    const context: PathEvaluationContext = {
      terragruntDir: '/project/modules/vpc',
      originalTerragruntDir: '/project/modules/vpc',
      repoRoot: '/project',
      locals: {},
    };

    const numericExpr: HCLExpression = {
      type: 'literal',
      value: 123,
      raw: '123',
    };

    const result = resolver.evaluatePath(numericExpr, context);

    expect(result).toBeNull();
  });

  it('should handle missing repo root gracefully', () => {
    const context: PathEvaluationContext = {
      terragruntDir: '/project/modules/vpc',
      originalTerragruntDir: '/project/modules/vpc',
      repoRoot: null,
      locals: {},
    };

    const funcExpr = createFunctionExpression('get_path_to_repo_root');
    const result = resolver.evaluatePath(funcExpr, context);

    expect(result).toBeNull();
  });

  it('should handle empty include label', () => {
    const block = createMockIncludeBlock('', createLiteralExpression('../common.hcl'));
    const context: PathEvaluationContext = {
      terragruntDir: '/project/modules/vpc',
      originalTerragruntDir: '/project/modules/vpc',
      repoRoot: '/project',
      locals: {},
    };

    const result = resolver.resolveInclude(block, context);

    expect(result.label).toBe('');
  });

  it('should handle deeply nested local references', () => {
    const context: PathEvaluationContext = {
      terragruntDir: '/project/modules/vpc',
      originalTerragruntDir: '/project/modules/vpc',
      repoRoot: '/project',
      locals: {
        'nested.path': '/nested/path/value',
      },
    };

    const refExpr: HCLExpression = {
      type: 'reference',
      parts: ['local', 'nested', 'path'],
      raw: 'local.nested.path',
    };

    const result = resolver.evaluatePath(refExpr, context);

    expect(result).toBe('/nested/path/value');
  });

  it('should handle non-array dependencies block', () => {
    const nonArrayExpr: HCLExpression = {
      type: 'literal',
      value: '../single-path',
      raw: '"../single-path"',
    };

    const file = createMockTerragruntFile('/project/modules/rds/terragrunt.hcl', [
      createMockDependenciesBlock(nonArrayExpr),
    ]);

    const result = resolver.resolveAll(file);

    // Should handle gracefully without crashing
    expect(result).toBeDefined();
  });
});
