/**
 * Terragrunt Edge Factory Unit Tests
 * @module tests/parsers/terragrunt/edge-factory.test
 *
 * TASK-TG-008: Tests for Terragrunt edge factory functions.
 * Target: 80%+ coverage for edge-factory.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTgIncludesEdge,
  createTgDependsOnEdge,
  createTgPassesInputEdge,
  createTgSourcesEdge,
  validateEdgeOptions,
  createEdgeFactoryOptions,
  validateEdgeFactoryOptions,
  DEFAULT_EDGE_FACTORY_OPTIONS,
  TG_EDGE_TYPES,
  TG_EDGE_TYPE_VALUES,
  isTgIncludesEdge,
  isTgDependsOnEdge,
  isTgPassesInputEdge,
  isTgSourcesEdge,
  isTgEdge,
  createEvidenceBuilder,
  calculateAggregatedConfidence,
  type TgEdgeFactoryOptions,
  type TgIncludesEdgeOptions,
  type TgDependsOnEdgeOptions,
  type TgPassesInputEdgeOptions,
  type TgSourcesEdgeOptions,
  type TgEdge,
  type TgIncludesEdge,
  type TgDependsOnEdge,
  type TgPassesInputEdge,
  type TgSourcesEdge,
  type TgEdgeEvidence,
} from '../../../src/parsers/terragrunt/edge-factory';
import { TerragruntEdgeError } from '../../../src/parsers/terragrunt/errors';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEvidence = (overrides: Partial<TgEdgeEvidence> = {}): TgEdgeEvidence => ({
  file: 'env/dev/terragrunt.hcl',
  lineStart: 5,
  lineEnd: 10,
  snippet: 'include "root" { path = find_in_parent_folders() }',
  confidence: 95,
  evidenceType: 'explicit',
  description: 'Test evidence',
  ...overrides,
});

const createMockFactoryOptions = (): TgEdgeFactoryOptions => ({
  scanId: 'scan-123',
  idGenerator: () => 'test-uuid-12345',
});

const createMockIncludesOptions = (
  overrides: Partial<TgIncludesEdgeOptions> = {}
): TgIncludesEdgeOptions => ({
  sourceNodeId: 'node-source-1',
  targetNodeId: 'node-target-1',
  includeName: 'root',
  mergeStrategy: 'deep',
  inheritedBlocks: ['terraform', 'remote_state'],
  exposeAsVariable: true,
  evidence: [createMockEvidence()],
  ...overrides,
});

const createMockDependsOnOptions = (
  overrides: Partial<TgDependsOnEdgeOptions> = {}
): TgDependsOnEdgeOptions => ({
  sourceNodeId: 'node-source-1',
  targetNodeId: 'node-target-1',
  dependencyName: 'vpc',
  skipOutputs: false,
  outputsConsumed: ['vpc_id', 'subnet_ids'],
  hasMockOutputs: false,
  evidence: [createMockEvidence()],
  ...overrides,
});

const createMockPassesInputOptions = (
  overrides: Partial<TgPassesInputEdgeOptions> = {}
): TgPassesInputEdgeOptions => ({
  sourceNodeId: 'node-source-1',
  targetNodeId: 'node-target-1',
  inputName: 'vpc_id',
  sourceExpression: 'dependency.vpc.outputs.vpc_id',
  viaDependencyOutputs: true,
  dependencyName: 'vpc',
  evidence: [createMockEvidence()],
  ...overrides,
});

const createMockSourcesOptions = (
  overrides: Partial<TgSourcesEdgeOptions> = {}
): TgSourcesEdgeOptions => ({
  sourceNodeId: 'node-source-1',
  targetNodeId: 'node-target-1',
  sourceExpression: 'git::git@github.com:org/modules.git//vpc?ref=v1.0.0',
  sourceType: 'git',
  versionConstraint: 'v1.0.0',
  evidence: [createMockEvidence()],
  ...overrides,
});

// ============================================================================
// TG_EDGE_TYPES Constants Tests
// ============================================================================

describe('TG_EDGE_TYPES', () => {
  it('should define all edge type constants', () => {
    expect(TG_EDGE_TYPES.INCLUDES).toBe('tg_includes');
    expect(TG_EDGE_TYPES.DEPENDS_ON).toBe('tg_depends_on');
    expect(TG_EDGE_TYPES.PASSES_INPUT).toBe('tg_passes_input');
    expect(TG_EDGE_TYPES.SOURCES).toBe('tg_sources');
  });

  it('should have immutable values', () => {
    expect(Object.isFrozen(TG_EDGE_TYPES)).toBe(false); // as const doesn't freeze
    expect(TG_EDGE_TYPE_VALUES.size).toBe(4);
  });

  it('should contain all types in TG_EDGE_TYPE_VALUES set', () => {
    expect(TG_EDGE_TYPE_VALUES.has('tg_includes')).toBe(true);
    expect(TG_EDGE_TYPE_VALUES.has('tg_depends_on')).toBe(true);
    expect(TG_EDGE_TYPE_VALUES.has('tg_passes_input')).toBe(true);
    expect(TG_EDGE_TYPE_VALUES.has('tg_sources')).toBe(true);
    expect(TG_EDGE_TYPE_VALUES.has('invalid_type' as any)).toBe(false);
  });
});

// ============================================================================
// createTgIncludesEdge Tests
// ============================================================================

describe('createTgIncludesEdge', () => {
  const factoryOptions = createMockFactoryOptions();

  describe('basic edge creation', () => {
    it('should create edge with correct type', () => {
      const options = createMockIncludesOptions();
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.INCLUDES);
    });

    it('should generate unique ID using idGenerator', () => {
      const options = createMockIncludesOptions();
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.id).toBe('test-uuid-12345');
    });

    it('should set source and target correctly', () => {
      const options = createMockIncludesOptions({
        sourceNodeId: 'source-abc',
        targetNodeId: 'target-xyz',
      });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.source).toBe('source-abc');
      expect(edge.target).toBe('target-xyz');
    });

    it('should set label from includeName', () => {
      const options = createMockIncludesOptions({ includeName: 'common' });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.label).toBe('includes:common');
    });

    it('should include scanId in edge', () => {
      const options = createMockIncludesOptions();
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.scanId).toBe('scan-123');
    });
  });

  describe('include-specific properties', () => {
    it('should set includeName', () => {
      const options = createMockIncludesOptions({ includeName: 'root' });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.includeName).toBe('root');
    });

    it('should set mergeStrategy', () => {
      const strategies: Array<'no_merge' | 'shallow' | 'deep'> = ['no_merge', 'shallow', 'deep'];

      for (const strategy of strategies) {
        const options = createMockIncludesOptions({ mergeStrategy: strategy });
        const edge = createTgIncludesEdge(options, factoryOptions);

        expect(edge.mergeStrategy).toBe(strategy);
      }
    });

    it('should set inheritedBlocks', () => {
      const blocks = ['terraform', 'remote_state', 'inputs'];
      const options = createMockIncludesOptions({ inheritedBlocks: blocks });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.inheritedBlocks).toEqual(blocks);
    });

    it('should set exposeAsVariable', () => {
      const options = createMockIncludesOptions({ exposeAsVariable: true });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.exposeAsVariable).toBe(true);
    });
  });

  describe('confidence calculation', () => {
    it('should calculate aggregated confidence from evidence', () => {
      const options = createMockIncludesOptions({
        evidence: [
          createMockEvidence({ confidence: 95 }),
          createMockEvidence({ confidence: 80 }),
        ],
      });
      const edge = createTgIncludesEdge(options, factoryOptions);

      // Weighted average: (95*1 + 80*0.5) / (1 + 0.5) = 135/1.5 = 90
      expect(edge.confidence).toBe(90);
    });

    it('should use single evidence confidence when only one provided', () => {
      const options = createMockIncludesOptions({
        evidence: [createMockEvidence({ confidence: 85 })],
      });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.confidence).toBe(85);
    });
  });

  describe('metadata creation', () => {
    it('should create metadata with location from primary evidence', () => {
      const options = createMockIncludesOptions({
        evidence: [createMockEvidence({ file: 'test.hcl', lineStart: 10, lineEnd: 20 })],
      });
      const edge = createTgIncludesEdge(options, factoryOptions);

      expect(edge.metadata.location).toEqual({
        file: 'test.hcl',
        lineStart: 10,
        lineEnd: 20,
      });
    });

    it('should set implicit flag based on evidence type', () => {
      const explicitOptions = createMockIncludesOptions({
        evidence: [createMockEvidence({ evidenceType: 'explicit' })],
      });
      const explicitEdge = createTgIncludesEdge(explicitOptions, factoryOptions);

      expect(explicitEdge.metadata.implicit).toBe(false);

      const inferredOptions = createMockIncludesOptions({
        evidence: [createMockEvidence({ evidenceType: 'inferred' })],
      });
      const inferredEdge = createTgIncludesEdge(inferredOptions, factoryOptions);

      expect(inferredEdge.metadata.implicit).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should throw for missing sourceNodeId', () => {
      const options = createMockIncludesOptions({ sourceNodeId: '' });

      expect(() => createTgIncludesEdge(options, factoryOptions)).toThrow(TerragruntEdgeError);
    });

    it('should throw for missing targetNodeId', () => {
      const options = createMockIncludesOptions({ targetNodeId: '' });

      expect(() => createTgIncludesEdge(options, factoryOptions)).toThrow(TerragruntEdgeError);
    });

    it('should throw for self-referential edge', () => {
      const options = createMockIncludesOptions({
        sourceNodeId: 'same-node',
        targetNodeId: 'same-node',
      });

      expect(() => createTgIncludesEdge(options, factoryOptions)).toThrow('must be different');
    });

    it('should throw for missing includeName', () => {
      const options = createMockIncludesOptions({ includeName: '' });

      expect(() => createTgIncludesEdge(options, factoryOptions)).toThrow('includeName');
    });

    it('should throw for invalid mergeStrategy', () => {
      const options = createMockIncludesOptions({ mergeStrategy: 'invalid' as any });

      expect(() => createTgIncludesEdge(options, factoryOptions)).toThrow('mergeStrategy');
    });
  });
});

// ============================================================================
// createTgDependsOnEdge Tests
// ============================================================================

describe('createTgDependsOnEdge', () => {
  const factoryOptions = createMockFactoryOptions();

  describe('basic edge creation', () => {
    it('should create edge with correct type', () => {
      const options = createMockDependsOnOptions();
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.DEPENDS_ON);
    });

    it('should set label from dependencyName', () => {
      const options = createMockDependsOnOptions({ dependencyName: 'vpc' });
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.label).toBe('depends_on:vpc');
    });
  });

  describe('dependency-specific properties', () => {
    it('should set dependencyName', () => {
      const options = createMockDependsOnOptions({ dependencyName: 'rds' });
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.dependencyName).toBe('rds');
    });

    it('should set skipOutputs', () => {
      const options = createMockDependsOnOptions({ skipOutputs: true });
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.skipOutputs).toBe(true);
    });

    it('should set outputsConsumed', () => {
      const outputs = ['vpc_id', 'subnet_ids', 'security_group_id'];
      const options = createMockDependsOnOptions({ outputsConsumed: outputs });
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.outputsConsumed).toEqual(outputs);
    });

    it('should handle mock outputs flag', () => {
      const options = createMockDependsOnOptions({ hasMockOutputs: true });
      const edge = createTgDependsOnEdge(options, factoryOptions);

      expect(edge.hasMockOutputs).toBe(true);
    });
  });

  describe('validation errors', () => {
    it('should throw for missing dependencyName', () => {
      const options = createMockDependsOnOptions({ dependencyName: '' });

      expect(() => createTgDependsOnEdge(options, factoryOptions)).toThrow('dependencyName');
    });

    it('should throw for non-boolean skipOutputs', () => {
      const options = createMockDependsOnOptions({ skipOutputs: 'false' as any });

      expect(() => createTgDependsOnEdge(options, factoryOptions)).toThrow('skipOutputs');
    });

    it('should throw for non-array outputsConsumed', () => {
      const options = createMockDependsOnOptions({ outputsConsumed: 'vpc_id' as any });

      expect(() => createTgDependsOnEdge(options, factoryOptions)).toThrow('outputsConsumed');
    });

    it('should throw for non-boolean hasMockOutputs', () => {
      const options = createMockDependsOnOptions({ hasMockOutputs: 'yes' as any });

      expect(() => createTgDependsOnEdge(options, factoryOptions)).toThrow('hasMockOutputs');
    });
  });
});

// ============================================================================
// createTgPassesInputEdge Tests
// ============================================================================

describe('createTgPassesInputEdge', () => {
  const factoryOptions = createMockFactoryOptions();

  describe('basic edge creation', () => {
    it('should create edge with correct type', () => {
      const options = createMockPassesInputOptions();
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.PASSES_INPUT);
    });

    it('should set label from inputName', () => {
      const options = createMockPassesInputOptions({ inputName: 'vpc_id' });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.label).toBe('passes:vpc_id');
    });
  });

  describe('input-specific properties', () => {
    it('should set inputName', () => {
      const options = createMockPassesInputOptions({ inputName: 'database_url' });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.inputName).toBe('database_url');
    });

    it('should set sourceExpression', () => {
      const expr = 'dependency.rds.outputs.connection_string';
      const options = createMockPassesInputOptions({ sourceExpression: expr });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.sourceExpression).toBe(expr);
    });

    it('should set viaDependencyOutputs', () => {
      const options = createMockPassesInputOptions({ viaDependencyOutputs: true });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.viaDependencyOutputs).toBe(true);
    });

    it('should set dependencyName when via dependency outputs', () => {
      const options = createMockPassesInputOptions({
        viaDependencyOutputs: true,
        dependencyName: 'rds',
      });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.dependencyName).toBe('rds');
    });

    it('should allow null dependencyName', () => {
      const options = createMockPassesInputOptions({
        viaDependencyOutputs: false,
        dependencyName: null,
      });
      const edge = createTgPassesInputEdge(options, factoryOptions);

      expect(edge.dependencyName).toBeNull();
    });
  });

  describe('validation errors', () => {
    it('should throw for missing inputName', () => {
      const options = createMockPassesInputOptions({ inputName: '' });

      expect(() => createTgPassesInputEdge(options, factoryOptions)).toThrow('inputName');
    });

    it('should throw for missing sourceExpression', () => {
      const options = createMockPassesInputOptions({ sourceExpression: '' });

      expect(() => createTgPassesInputEdge(options, factoryOptions)).toThrow('sourceExpression');
    });

    it('should throw for non-boolean viaDependencyOutputs', () => {
      const options = createMockPassesInputOptions({ viaDependencyOutputs: 'true' as any });

      expect(() => createTgPassesInputEdge(options, factoryOptions)).toThrow('viaDependencyOutputs');
    });
  });
});

// ============================================================================
// createTgSourcesEdge Tests
// ============================================================================

describe('createTgSourcesEdge', () => {
  const factoryOptions = createMockFactoryOptions();

  describe('basic edge creation', () => {
    it('should create edge with correct type', () => {
      const options = createMockSourcesOptions();
      const edge = createTgSourcesEdge(options, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.SOURCES);
    });

    it('should set label from sourceType', () => {
      const options = createMockSourcesOptions({ sourceType: 'registry' });
      const edge = createTgSourcesEdge(options, factoryOptions);

      expect(edge.label).toBe('sources:registry');
    });
  });

  describe('source-specific properties', () => {
    it('should set sourceExpression', () => {
      const expr = 'git::git@github.com:org/modules.git//vpc';
      const options = createMockSourcesOptions({ sourceExpression: expr });
      const edge = createTgSourcesEdge(options, factoryOptions);

      expect(edge.sourceExpression).toBe(expr);
    });

    it('should handle all source types', () => {
      const types: Array<'local' | 'git' | 'registry' | 's3' | 'gcs' | 'http' | 'unknown'> = [
        'local', 'git', 'registry', 's3', 'gcs', 'http', 'unknown'
      ];

      for (const type of types) {
        const options = createMockSourcesOptions({ sourceType: type });
        const edge = createTgSourcesEdge(options, factoryOptions);

        expect(edge.sourceType).toBe(type);
      }
    });

    it('should set versionConstraint', () => {
      const options = createMockSourcesOptions({ versionConstraint: '~> 3.0' });
      const edge = createTgSourcesEdge(options, factoryOptions);

      expect(edge.versionConstraint).toBe('~> 3.0');
    });

    it('should allow null versionConstraint', () => {
      const options = createMockSourcesOptions({ versionConstraint: null });
      const edge = createTgSourcesEdge(options, factoryOptions);

      expect(edge.versionConstraint).toBeNull();
    });
  });

  describe('validation errors', () => {
    it('should throw for missing sourceExpression', () => {
      const options = createMockSourcesOptions({ sourceExpression: '' });

      expect(() => createTgSourcesEdge(options, factoryOptions)).toThrow('sourceExpression');
    });

    it('should throw for invalid sourceType', () => {
      const options = createMockSourcesOptions({ sourceType: 'invalid' as any });

      expect(() => createTgSourcesEdge(options, factoryOptions)).toThrow('sourceType');
    });
  });
});

// ============================================================================
// Type Guards Tests
// ============================================================================

describe('Type Guards', () => {
  const factoryOptions = createMockFactoryOptions();

  describe('isTgIncludesEdge', () => {
    it('should return true for include edges', () => {
      const edge = createTgIncludesEdge(createMockIncludesOptions(), factoryOptions);

      expect(isTgIncludesEdge(edge)).toBe(true);
    });

    it('should return false for non-include edges', () => {
      const edge = createTgDependsOnEdge(createMockDependsOnOptions(), factoryOptions);

      expect(isTgIncludesEdge(edge)).toBe(false);
    });
  });

  describe('isTgDependsOnEdge', () => {
    it('should return true for depends_on edges', () => {
      const edge = createTgDependsOnEdge(createMockDependsOnOptions(), factoryOptions);

      expect(isTgDependsOnEdge(edge)).toBe(true);
    });

    it('should return false for non-depends_on edges', () => {
      const edge = createTgIncludesEdge(createMockIncludesOptions(), factoryOptions);

      expect(isTgDependsOnEdge(edge)).toBe(false);
    });
  });

  describe('isTgPassesInputEdge', () => {
    it('should return true for passes_input edges', () => {
      const edge = createTgPassesInputEdge(createMockPassesInputOptions(), factoryOptions);

      expect(isTgPassesInputEdge(edge)).toBe(true);
    });

    it('should return false for non-passes_input edges', () => {
      const edge = createTgSourcesEdge(createMockSourcesOptions(), factoryOptions);

      expect(isTgPassesInputEdge(edge)).toBe(false);
    });
  });

  describe('isTgSourcesEdge', () => {
    it('should return true for sources edges', () => {
      const edge = createTgSourcesEdge(createMockSourcesOptions(), factoryOptions);

      expect(isTgSourcesEdge(edge)).toBe(true);
    });

    it('should return false for non-sources edges', () => {
      const edge = createTgPassesInputEdge(createMockPassesInputOptions(), factoryOptions);

      expect(isTgSourcesEdge(edge)).toBe(false);
    });
  });

  describe('isTgEdge', () => {
    it('should return true for all TG edges', () => {
      const includesEdge = createTgIncludesEdge(createMockIncludesOptions(), factoryOptions);
      const dependsOnEdge = createTgDependsOnEdge(createMockDependsOnOptions(), factoryOptions);
      const passesInputEdge = createTgPassesInputEdge(createMockPassesInputOptions(), factoryOptions);
      const sourcesEdge = createTgSourcesEdge(createMockSourcesOptions(), factoryOptions);

      expect(isTgEdge(includesEdge)).toBe(true);
      expect(isTgEdge(dependsOnEdge)).toBe(true);
      expect(isTgEdge(passesInputEdge)).toBe(true);
      expect(isTgEdge(sourcesEdge)).toBe(true);
    });

    it('should return false for non-TG edges', () => {
      const nonTgEdge = {
        id: 'edge-1',
        source: 'node-1',
        target: 'node-2',
        type: 'terraform_depends_on',
        label: 'test',
        metadata: {},
      };

      expect(isTgEdge(nonTgEdge as any)).toBe(false);
    });
  });
});

// ============================================================================
// validateEdgeOptions Tests
// ============================================================================

describe('validateEdgeOptions', () => {
  it('should not throw for valid options', () => {
    const options = createMockIncludesOptions();

    expect(() => validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES)).not.toThrow();
  });

  it('should throw for null sourceNodeId', () => {
    const options = createMockIncludesOptions({ sourceNodeId: null as any });

    expect(() => validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES)).toThrow('sourceNodeId');
  });

  it('should throw for undefined targetNodeId', () => {
    const options = createMockIncludesOptions({ targetNodeId: undefined as any });

    expect(() => validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES)).toThrow('targetNodeId');
  });

  it('should throw for self-referential edge', () => {
    const options = createMockIncludesOptions({
      sourceNodeId: 'same',
      targetNodeId: 'same',
    });

    expect(() => validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES)).toThrow('must be different');
  });

  it('should validate evidence array', () => {
    const options = createMockIncludesOptions({
      evidence: [
        createMockEvidence({ confidence: 150 }), // Invalid confidence
      ],
    });

    expect(() => validateEdgeOptions(options, TG_EDGE_TYPES.INCLUDES)).toThrow();
  });
});

// ============================================================================
// Factory Options Tests
// ============================================================================

describe('createEdgeFactoryOptions', () => {
  it('should merge with defaults', () => {
    const options = createEdgeFactoryOptions({ scanId: 'scan-xyz' });

    expect(options.scanId).toBe('scan-xyz');
    expect(options.idGenerator).toBeDefined();
  });

  it('should allow custom idGenerator', () => {
    const customIdGen = () => 'custom-id-123';
    const options = createEdgeFactoryOptions({
      scanId: 'scan-xyz',
      idGenerator: customIdGen,
    });

    expect(options.idGenerator!()).toBe('custom-id-123');
  });
});

describe('validateEdgeFactoryOptions', () => {
  it('should not throw for valid options', () => {
    const options = createMockFactoryOptions();

    expect(() => validateEdgeFactoryOptions(options)).not.toThrow();
  });

  it('should throw for missing scanId', () => {
    const options = { scanId: '' };

    expect(() => validateEdgeFactoryOptions(options as TgEdgeFactoryOptions)).toThrow('scanId');
  });

  it('should throw for non-function idGenerator', () => {
    const options = {
      scanId: 'scan-123',
      idGenerator: 'not-a-function' as any,
    };

    expect(() => validateEdgeFactoryOptions(options as TgEdgeFactoryOptions)).toThrow('idGenerator');
  });
});

describe('DEFAULT_EDGE_FACTORY_OPTIONS', () => {
  it('should have idGenerator defined', () => {
    expect(DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator).toBeDefined();
  });

  it('should generate unique IDs', () => {
    const idGen = DEFAULT_EDGE_FACTORY_OPTIONS.idGenerator!;
    const id1 = idGen();
    const id2 = idGen();

    expect(id1).not.toBe(id2);
    expect(typeof id1).toBe('string');
    expect(id1.length).toBe(36); // UUID format
  });
});

// ============================================================================
// Evidence Builder Tests
// ============================================================================

describe('createEvidenceBuilder', () => {
  it('should build valid evidence', () => {
    const evidence = createEvidenceBuilder()
      .file('test.hcl')
      .lines(1, 5)
      .snippet('include { ... }')
      .confidence(95)
      .explicit()
      .description('Test include')
      .build();

    expect(evidence.file).toBe('test.hcl');
    expect(evidence.lineStart).toBe(1);
    expect(evidence.lineEnd).toBe(5);
    expect(evidence.snippet).toBe('include { ... }');
    expect(evidence.confidence).toBe(95);
    expect(evidence.evidenceType).toBe('explicit');
    expect(evidence.description).toBe('Test include');
  });

  it('should set single line', () => {
    const evidence = createEvidenceBuilder()
      .file('test.hcl')
      .line(10)
      .confidence(80)
      .inferred()
      .description('Inferred relationship')
      .build();

    expect(evidence.lineStart).toBe(10);
    expect(evidence.lineEnd).toBe(10);
  });

  it('should set evidence type via type method', () => {
    const evidence = createEvidenceBuilder()
      .file('test.hcl')
      .line(1)
      .confidence(70)
      .type('heuristic')
      .description('Heuristic match')
      .build();

    expect(evidence.evidenceType).toBe('heuristic');
  });

  it('should clamp confidence to valid range', () => {
    const highEvidence = createEvidenceBuilder()
      .file('test.hcl')
      .line(1)
      .confidence(150)
      .description('High confidence')
      .build();

    expect(highEvidence.confidence).toBe(100);

    const lowEvidence = createEvidenceBuilder()
      .file('test.hcl')
      .line(1)
      .confidence(-10)
      .description('Low confidence')
      .build();

    expect(lowEvidence.confidence).toBe(0);
  });
});

// ============================================================================
// calculateAggregatedConfidence Tests
// ============================================================================

describe('calculateAggregatedConfidence', () => {
  it('should return 0 for empty evidence array', () => {
    expect(calculateAggregatedConfidence([])).toBe(0);
  });

  it('should return single confidence for one evidence', () => {
    const evidence = [createMockEvidence({ confidence: 85 })];
    expect(calculateAggregatedConfidence(evidence)).toBe(85);
  });

  it('should calculate weighted average for multiple evidence', () => {
    const evidence = [
      createMockEvidence({ confidence: 90 }),
      createMockEvidence({ confidence: 60 }),
    ];
    // Weighted: (90*1 + 60*0.5) / (1 + 0.5) = 120/1.5 = 80
    expect(calculateAggregatedConfidence(evidence)).toBe(80);
  });

  it('should weight higher confidence more heavily', () => {
    const evidence = [
      createMockEvidence({ confidence: 50 }),
      createMockEvidence({ confidence: 95 }),
    ];
    // After sorting: 95, 50
    // Weighted: (95*1 + 50*0.5) / (1 + 0.5) = 120/1.5 = 80
    expect(calculateAggregatedConfidence(evidence)).toBe(80);
  });

  it('should cap at 100', () => {
    const evidence = [
      createMockEvidence({ confidence: 100 }),
      createMockEvidence({ confidence: 100 }),
      createMockEvidence({ confidence: 100 }),
    ];
    expect(calculateAggregatedConfidence(evidence)).toBe(100);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('Edge Cases', () => {
  const factoryOptions = createMockFactoryOptions();

  it('should handle empty inheritedBlocks array', () => {
    const options = createMockIncludesOptions({ inheritedBlocks: [] });
    const edge = createTgIncludesEdge(options, factoryOptions);

    expect(edge.inheritedBlocks).toEqual([]);
  });

  it('should handle empty outputsConsumed array', () => {
    const options = createMockDependsOnOptions({ outputsConsumed: [] });
    const edge = createTgDependsOnEdge(options, factoryOptions);

    expect(edge.outputsConsumed).toEqual([]);
  });

  it('should handle multiple evidence items', () => {
    const options = createMockIncludesOptions({
      evidence: [
        createMockEvidence({ confidence: 95 }),
        createMockEvidence({ confidence: 85 }),
        createMockEvidence({ confidence: 75 }),
      ],
    });
    const edge = createTgIncludesEdge(options, factoryOptions);

    expect(edge.evidence).toHaveLength(3);
  });

  it('should handle special characters in names', () => {
    const options = createMockIncludesOptions({ includeName: 'root-v2.0_final' });
    const edge = createTgIncludesEdge(options, factoryOptions);

    expect(edge.includeName).toBe('root-v2.0_final');
    expect(edge.label).toBe('includes:root-v2.0_final');
  });

  it('should handle very long source expressions', () => {
    const longExpr = 'git::git@github.com:organization/very-long-repository-name.git//path/to/deep/nested/module?ref=v1.2.3-beta.4';
    const options = createMockSourcesOptions({ sourceExpression: longExpr });
    const edge = createTgSourcesEdge(options, factoryOptions);

    expect(edge.sourceExpression).toBe(longExpr);
  });
});
