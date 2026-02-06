/**
 * Terragrunt Edge Service Unit Tests
 * @module tests/services/terragrunt-edge-service.test
 *
 * TASK-TG-008: Tests for TerragruntEdgeService orchestration.
 * Target: 80%+ coverage for terragrunt-edge-service.ts
 */

import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import pino from 'pino';
import {
  TerragruntEdgeService,
  createTerragruntEdgeService,
  createEdgesFromNodeResult,
  validateEdgeCreationContext,
  hasUnresolvedReferences,
  filterEdgesByType,
  DEFAULT_EDGE_SERVICE_OPTIONS,
  type ITerragruntEdgeService,
  type EdgeCreationContext,
  type TerragruntEdgeResult,
  type TerragruntEdgeServiceOptions,
  TG_EDGE_TYPES,
  type TgEdge,
} from '../../src/services/terragrunt-edge-service';
import {
  type BatchTerragruntNodeResult,
  type DependencyHint,
  type IncludeHint,
} from '../../src/parsers/terragrunt/node-factory';
import type { TerragruntConfigNode } from '../../src/types/graph';
import {
  createTerraformLinker,
  type ITerraformLinker,
  type TfLinkerResult,
  type TerraformSourceExpression,
  type TfLinkerContext,
} from '../../src/parsers/terragrunt/tf-linker';
import { TerragruntEdgeError, SourceResolutionError } from '../../src/parsers/terragrunt/errors';

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockEdgeCreationContext = (
  overrides: Partial<EdgeCreationContext> = {}
): EdgeCreationContext => ({
  scanId: 'scan-123',
  tenantId: 'tenant-456',
  repositoryRoot: '/repo',
  existingTfModules: new Map(),
  idGenerator: () => 'test-edge-id',
  ...overrides,
});

const createMockTerragruntConfigNode = (
  overrides: Partial<TerragruntConfigNode> = {}
): TerragruntConfigNode => ({
  id: 'config-node-1',
  type: 'tg_config',
  name: 'dev',
  location: {
    file: 'env/dev/terragrunt.hcl',
    lineStart: 1,
    lineEnd: 50,
  },
  metadata: {
    scanId: 'scan-123',
    absolutePath: '/repo/env/dev/terragrunt.hcl',
    encoding: 'utf-8',
    size: 1024,
    blockCount: 3,
    errorCount: 0,
    dependencyNames: [],
    includeLabels: [],
  },
  terraformSource: null,
  hasRemoteState: false,
  remoteStateBackend: null,
  includeCount: 0,
  dependencyCount: 0,
  inputCount: 0,
  generateBlocks: [],
  ...overrides,
});

const createMockIncludeHint = (
  overrides: Partial<IncludeHint> = {}
): IncludeHint => ({
  sourceId: 'config-node-1',
  targetPath: '/repo/root.hcl',
  targetId: 'config-node-root',
  includeLabel: 'root',
  mergeStrategy: 'deep',
  resolved: true,
  ...overrides,
});

const createMockDependencyHint = (
  overrides: Partial<DependencyHint> = {}
): DependencyHint => ({
  sourceId: 'config-node-1',
  targetPath: '/repo/vpc/terragrunt.hcl',
  targetId: 'config-node-vpc',
  dependencyName: 'vpc',
  resolved: true,
  ...overrides,
});

const createMockBatchNodeResult = (
  overrides: Partial<BatchTerragruntNodeResult> = {}
): BatchTerragruntNodeResult => ({
  configNodes: [createMockTerragruntConfigNode()],
  includeNodes: [],
  dependencyNodes: [],
  dependencyHints: [],
  includeHints: [],
  pathToIdMap: new Map([['/repo/env/dev/terragrunt.hcl', 'config-node-1']]),
  ...overrides,
});

const createMockLinker = (): ITerraformLinker => ({
  parseSource: vi.fn((raw: string) => ({
    raw,
    type: 'local' as const,
    path: raw,
  })),
  isExternal: vi.fn(() => false),
  resolve: vi.fn(() => ({
    targetNodeId: 'resolved-tf-module-id',
    isSynthetic: false,
    sourceType: 'local' as const,
    resolvedPath: '/repo/modules/vpc',
    success: true,
  })),
});

// Silent logger for tests
const testLogger = pino({ level: 'silent' });

// ============================================================================
// TerragruntEdgeService Constructor Tests
// ============================================================================

describe('TerragruntEdgeService', () => {
  describe('constructor', () => {
    it('should create service with default options', () => {
      const service = new TerragruntEdgeService();
      expect(service).toBeInstanceOf(TerragruntEdgeService);
    });

    it('should accept custom linker', () => {
      const customLinker = createMockLinker();
      const service = new TerragruntEdgeService({
        linker: customLinker,
        logger: testLogger,
      });

      expect(service).toBeInstanceOf(TerragruntEdgeService);
    });

    it('should accept custom options', () => {
      const service = new TerragruntEdgeService({
        createEdgesForUnresolved: true,
        minConfidenceThreshold: 50,
        logger: testLogger,
      });

      expect(service).toBeInstanceOf(TerragruntEdgeService);
    });
  });
});

// ============================================================================
// createEdgesFromNodeResult Tests
// ============================================================================

describe('createEdgesFromNodeResult', () => {
  let service: ITerragruntEdgeService;
  let mockLinker: ITerraformLinker;

  beforeEach(() => {
    mockLinker = createMockLinker();
    service = createTerragruntEdgeService({
      linker: mockLinker,
      logger: testLogger,
    });
  });

  describe('include edges', () => {
    it('should create include edges from include hints', () => {
      const nodeResult = createMockBatchNodeResult({
        includeHints: [
          createMockIncludeHint({
            sourceId: 'child-config',
            targetId: 'parent-config',
            includeLabel: 'root',
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      expect(result.edges.length).toBeGreaterThanOrEqual(1);
      const includeEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.INCLUDES);
      expect(includeEdges.length).toBe(1);
      expect(includeEdges[0].source).toBe('child-config');
      expect(includeEdges[0].target).toBe('parent-config');
    });

    it('should skip unresolved include hints by default', () => {
      const nodeResult = createMockBatchNodeResult({
        includeHints: [
          createMockIncludeHint({
            targetId: null as any,
            resolved: false,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      const includeEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.INCLUDES);
      expect(includeEdges.length).toBe(0);
    });

    it('should create edges for unresolved hints when configured', () => {
      const customService = createTerragruntEdgeService({
        createEdgesForUnresolved: true,
        linker: mockLinker,
        logger: testLogger,
      });

      const nodeResult = createMockBatchNodeResult({
        includeHints: [
          createMockIncludeHint({
            sourceId: 'child',
            targetId: undefined as any,
            targetPath: '/repo/missing.hcl',
            resolved: false,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = customService.createEdgesFromNodeResult(nodeResult, context);

      const includeEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.INCLUDES);
      expect(includeEdges.length).toBe(1);
      expect(includeEdges[0].target).toContain('unresolved:');
    });

    it('should track unresolved includes', () => {
      const nodeResult = createMockBatchNodeResult({
        includeHints: [
          createMockIncludeHint({
            targetId: null as any,
            targetPath: '/repo/missing.hcl',
            resolved: false,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      expect(result.unresolvedReferences.length).toBe(1);
      expect(result.unresolvedReferences[0].type).toBe('include');
    });
  });

  describe('dependency edges', () => {
    it('should create dependency edges from dependency hints', () => {
      const nodeResult = createMockBatchNodeResult({
        dependencyHints: [
          createMockDependencyHint({
            sourceId: 'app-config',
            targetId: 'vpc-config',
            dependencyName: 'vpc',
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      const dependencyEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.DEPENDS_ON);
      expect(dependencyEdges.length).toBe(1);
      expect(dependencyEdges[0].source).toBe('app-config');
      expect(dependencyEdges[0].target).toBe('vpc-config');
    });

    it('should skip unresolved dependency hints by default', () => {
      const nodeResult = createMockBatchNodeResult({
        dependencyHints: [
          createMockDependencyHint({
            targetId: null as any,
            resolved: false,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      const dependencyEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.DEPENDS_ON);
      expect(dependencyEdges.length).toBe(0);
    });

    it('should track unresolved dependencies', () => {
      const nodeResult = createMockBatchNodeResult({
        dependencyHints: [
          createMockDependencyHint({
            targetId: null as any,
            targetPath: '/external/module',
            resolved: false,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      expect(result.unresolvedReferences.some(r => r.type === 'dependency')).toBe(true);
    });
  });

  describe('source edges', () => {
    it('should create source edges from config nodes with terraform.source', () => {
      const nodeResult = createMockBatchNodeResult({
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app-config',
            terraformSource: '../../modules/app',
            metadata: {
              scanId: 'scan-123',
              absolutePath: '/repo/env/dev/terragrunt.hcl',
              encoding: 'utf-8',
              size: 1024,
              blockCount: 3,
              errorCount: 0,
              dependencyNames: [],
              includeLabels: [],
            },
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      const sourceEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.SOURCES);
      expect(sourceEdges.length).toBe(1);
      expect(sourceEdges[0].source).toBe('app-config');
    });

    it('should skip config nodes without terraform.source', () => {
      const nodeResult = createMockBatchNodeResult({
        configNodes: [
          createMockTerragruntConfigNode({
            terraformSource: null,
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      const sourceEdges = result.edges.filter(e => e.type === TG_EDGE_TYPES.SOURCES);
      expect(sourceEdges.length).toBe(0);
    });

    it('should create synthetic nodes for external sources', () => {
      const externalLinker = createMockLinker();
      (externalLinker.resolve as Mock).mockReturnValue({
        targetNodeId: 'synthetic-node-id',
        isSynthetic: true,
        syntheticNode: {
          id: 'synthetic-node-id',
          type: 'terraform_module',
          name: 'consul',
          location: { file: 'hashicorp/consul/aws', lineStart: 0, lineEnd: 0 },
          metadata: { synthetic: true },
          source: 'hashicorp/consul/aws',
          sourceType: 'registry',
          version: '0.11.0',
          providers: {},
        },
        sourceType: 'registry',
        success: true,
      });
      (externalLinker.parseSource as Mock).mockReturnValue({
        raw: 'hashicorp/consul/aws',
        type: 'registry',
        registry: 'hashicorp/consul/aws',
      });

      const customService = createTerragruntEdgeService({
        linker: externalLinker,
        logger: testLogger,
      });

      const nodeResult = createMockBatchNodeResult({
        configNodes: [
          createMockTerragruntConfigNode({
            terraformSource: 'hashicorp/consul/aws',
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = customService.createEdgesFromNodeResult(nodeResult, context);

      expect(result.syntheticNodes.length).toBe(1);
      expect(result.syntheticNodes[0].id).toBe('synthetic-node-id');
    });

    it('should track unresolved source references', () => {
      const failingLinker = createMockLinker();
      (failingLinker.resolve as Mock).mockReturnValue({
        targetNodeId: '',
        isSynthetic: false,
        sourceType: 'local',
        success: false,
        error: 'Local path not found',
      });

      const customService = createTerragruntEdgeService({
        linker: failingLinker,
        logger: testLogger,
      });

      const nodeResult = createMockBatchNodeResult({
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app-config',
            terraformSource: '../../missing/module',
          }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = customService.createEdgesFromNodeResult(nodeResult, context);

      expect(result.unresolvedReferences.some(r => r.type === 'source')).toBe(true);
    });
  });

  describe('statistics', () => {
    it('should calculate correct statistics', () => {
      const nodeResult = createMockBatchNodeResult({
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app',
            terraformSource: '../../modules/app',
          }),
        ],
        includeHints: [
          createMockIncludeHint({ sourceId: 'app', targetId: 'root' }),
        ],
        dependencyHints: [
          createMockDependencyHint({ sourceId: 'app', targetId: 'vpc' }),
          createMockDependencyHint({ sourceId: 'app', targetId: 'rds' }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      expect(result.statistics.totalEdges).toBeGreaterThan(0);
      expect(result.statistics.edgesByType).toBeDefined();
      expect(result.statistics.processingTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average confidence', () => {
      const nodeResult = createMockBatchNodeResult({
        includeHints: [
          createMockIncludeHint({ sourceId: 'a', targetId: 'b' }),
        ],
      });
      const context = createMockEdgeCreationContext();

      const result = service.createEdgesFromNodeResult(nodeResult, context);

      expect(result.statistics.averageConfidence).toBeGreaterThan(0);
      expect(result.statistics.averageConfidence).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================================================
// createIncludeEdges Tests
// ============================================================================

describe('createIncludeEdges', () => {
  let service: TerragruntEdgeService;

  beforeEach(() => {
    service = new TerragruntEdgeService({ logger: testLogger });
  });

  it('should create edges with correct properties', () => {
    const hints = [
      createMockIncludeHint({
        sourceId: 'child',
        targetId: 'parent',
        includeLabel: 'root',
        mergeStrategy: 'deep',
      }),
    ];
    const factoryOptions = { scanId: 'scan-123' };

    const edges = service.createIncludeEdges(hints, factoryOptions);

    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe(TG_EDGE_TYPES.INCLUDES);
    expect(edges[0].source).toBe('child');
    expect(edges[0].target).toBe('parent');
  });

  it('should filter by confidence threshold', () => {
    const customService = new TerragruntEdgeService({
      minConfidenceThreshold: 80,
      createEdgesForUnresolved: true,
      logger: testLogger,
    });

    const hints = [
      createMockIncludeHint({
        sourceId: 'a',
        targetId: undefined as any,
        resolved: false, // Low confidence unresolved
      }),
    ];
    const factoryOptions = { scanId: 'scan-123' };

    const edges = customService.createIncludeEdges(hints, factoryOptions);

    // Should be filtered out due to low confidence
    expect(edges.length).toBe(0);
  });
});

// ============================================================================
// createDependencyEdges Tests
// ============================================================================

describe('createDependencyEdges', () => {
  let service: TerragruntEdgeService;

  beforeEach(() => {
    service = new TerragruntEdgeService({ logger: testLogger });
  });

  it('should create edges with correct properties', () => {
    const hints = [
      createMockDependencyHint({
        sourceId: 'app',
        targetId: 'vpc',
        dependencyName: 'vpc',
      }),
    ];
    const factoryOptions = { scanId: 'scan-123' };

    const edges = service.createDependencyEdges(hints, factoryOptions);

    expect(edges.length).toBe(1);
    expect(edges[0].type).toBe(TG_EDGE_TYPES.DEPENDS_ON);
    expect(edges[0].source).toBe('app');
    expect(edges[0].target).toBe('vpc');
  });

  it('should handle multiple dependency hints', () => {
    const hints = [
      createMockDependencyHint({ sourceId: 'app', targetId: 'vpc', dependencyName: 'vpc' }),
      createMockDependencyHint({ sourceId: 'app', targetId: 'rds', dependencyName: 'rds' }),
      createMockDependencyHint({ sourceId: 'app', targetId: 'redis', dependencyName: 'redis' }),
    ];
    const factoryOptions = { scanId: 'scan-123' };

    const edges = service.createDependencyEdges(hints, factoryOptions);

    expect(edges.length).toBe(3);
  });
});

// ============================================================================
// createSourceEdges Tests
// ============================================================================

describe('createSourceEdges', () => {
  let service: TerragruntEdgeService;
  let mockLinker: ITerraformLinker;

  beforeEach(() => {
    mockLinker = createMockLinker();
    service = new TerragruntEdgeService({
      linker: mockLinker,
      logger: testLogger,
    });
  });

  it('should create source edges for configs with terraform.source', () => {
    const configNodes = [
      createMockTerragruntConfigNode({
        id: 'app',
        terraformSource: './modules/app',
      }),
    ];
    const context = createMockEdgeCreationContext();
    const factoryOptions = { scanId: 'scan-123' };

    const result = service.createSourceEdges(configNodes, context, factoryOptions);

    expect(result.edges.length).toBe(1);
    expect(result.edges[0].type).toBe(TG_EDGE_TYPES.SOURCES);
  });

  it('should collect synthetic nodes', () => {
    const syntheticLinker = createMockLinker();
    (syntheticLinker.resolve as Mock).mockReturnValue({
      targetNodeId: 'synthetic-id',
      isSynthetic: true,
      syntheticNode: {
        id: 'synthetic-id',
        type: 'terraform_module',
        name: 'external',
        location: { file: 'external', lineStart: 0, lineEnd: 0 },
        metadata: { synthetic: true },
        source: 'git::https://github.com/org/repo.git',
        sourceType: 'git',
        providers: {},
      },
      sourceType: 'git',
      success: true,
    });
    (syntheticLinker.parseSource as Mock).mockReturnValue({
      raw: 'git::https://github.com/org/repo.git',
      type: 'git',
      gitUrl: 'https://github.com/org/repo.git',
    });

    const customService = new TerragruntEdgeService({
      linker: syntheticLinker,
      logger: testLogger,
    });

    const configNodes = [
      createMockTerragruntConfigNode({
        terraformSource: 'git::https://github.com/org/repo.git',
      }),
    ];
    const context = createMockEdgeCreationContext();
    const factoryOptions = { scanId: 'scan-123' };

    const result = customService.createSourceEdges(configNodes, context, factoryOptions);

    expect(result.syntheticNodes.length).toBe(1);
  });

  it('should track unresolved sources', () => {
    const failingLinker = createMockLinker();
    (failingLinker.resolve as Mock).mockReturnValue({
      targetNodeId: '',
      isSynthetic: false,
      sourceType: 'local',
      success: false,
      error: 'Module not found',
    });

    const customService = new TerragruntEdgeService({
      linker: failingLinker,
      logger: testLogger,
    });

    const configNodes = [
      createMockTerragruntConfigNode({
        id: 'app',
        terraformSource: './missing/module',
      }),
    ];
    const context = createMockEdgeCreationContext();
    const factoryOptions = { scanId: 'scan-123' };

    const result = customService.createSourceEdges(configNodes, context, factoryOptions);

    expect(result.unresolved.length).toBe(1);
    expect(result.unresolved[0].sourceNodeId).toBe('app');
  });

  it('should map github source type to git', () => {
    const githubLinker = createMockLinker();
    (githubLinker.resolve as Mock).mockReturnValue({
      targetNodeId: 'github-module',
      isSynthetic: true,
      syntheticNode: {
        id: 'github-module',
        type: 'terraform_module',
        name: 'repo',
        location: { file: 'github', lineStart: 0, lineEnd: 0 },
        metadata: { synthetic: true },
        source: 'github.com/org/repo',
        sourceType: 'github',
        providers: {},
      },
      sourceType: 'github',
      success: true,
    });
    (githubLinker.parseSource as Mock).mockReturnValue({
      raw: 'github.com/org/repo',
      type: 'github',
      gitUrl: 'github.com/org/repo.git',
    });

    const customService = new TerragruntEdgeService({
      linker: githubLinker,
      logger: testLogger,
    });

    const configNodes = [
      createMockTerragruntConfigNode({
        terraformSource: 'github.com/org/repo',
      }),
    ];
    const context = createMockEdgeCreationContext();
    const factoryOptions = { scanId: 'scan-123' };

    const result = customService.createSourceEdges(configNodes, context, factoryOptions);

    expect(result.edges.length).toBe(1);
    // github type should be mapped to 'git' in the edge
    expect((result.edges[0] as any).sourceType).toBe('git');
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('createTerragruntEdgeService', () => {
  it('should create service with default options', () => {
    const service = createTerragruntEdgeService();
    expect(service).toBeDefined();
  });

  it('should create service with custom options', () => {
    const service = createTerragruntEdgeService({
      createEdgesForUnresolved: true,
      minConfidenceThreshold: 75,
    });
    expect(service).toBeDefined();
  });
});

describe('createEdgesFromNodeResult (convenience)', () => {
  it('should create edges using default service', () => {
    const nodeResult = createMockBatchNodeResult({
      includeHints: [createMockIncludeHint()],
    });
    const context = createMockEdgeCreationContext();

    const result = createEdgesFromNodeResult(nodeResult, context);

    expect(result.edges.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// Validation Function Tests
// ============================================================================

describe('validateEdgeCreationContext', () => {
  it('should not throw for valid context', () => {
    const context = createMockEdgeCreationContext();
    expect(() => validateEdgeCreationContext(context)).not.toThrow();
  });

  it('should throw for missing scanId', () => {
    const context = createMockEdgeCreationContext({ scanId: '' });
    expect(() => validateEdgeCreationContext(context)).toThrow('scanId');
  });

  it('should throw for missing tenantId', () => {
    const context = createMockEdgeCreationContext({ tenantId: '' });
    expect(() => validateEdgeCreationContext(context)).toThrow('tenantId');
  });

  it('should throw for missing repositoryRoot', () => {
    const context = createMockEdgeCreationContext({ repositoryRoot: '' });
    expect(() => validateEdgeCreationContext(context)).toThrow('repositoryRoot');
  });

  it('should throw for non-Map existingTfModules', () => {
    const context = createMockEdgeCreationContext({
      existingTfModules: {} as any,
    });
    expect(() => validateEdgeCreationContext(context)).toThrow('existingTfModules');
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('hasUnresolvedReferences', () => {
  it('should return true when there are unresolved references', () => {
    const result: TerragruntEdgeResult = {
      edges: [],
      syntheticNodes: [],
      unresolvedReferences: [
        {
          type: 'include',
          sourceNodeId: 'node-1',
          targetPath: '/missing.hcl',
          reason: 'Not found',
        },
      ],
      statistics: {
        totalEdges: 0,
        edgesByType: {
          tg_includes: 0,
          tg_depends_on: 0,
          tg_passes_input: 0,
          tg_sources: 0,
        },
        syntheticNodesCreated: 0,
        unresolvedCount: 1,
        averageConfidence: 0,
        processingTimeMs: 0,
        sourceTypeBreakdown: {
          local: 0,
          registry: 0,
          git: 0,
          github: 0,
          s3: 0,
          gcs: 0,
          http: 0,
          unknown: 0,
        },
      },
    };

    expect(hasUnresolvedReferences(result)).toBe(true);
  });

  it('should return false when there are no unresolved references', () => {
    const result: TerragruntEdgeResult = {
      edges: [],
      syntheticNodes: [],
      unresolvedReferences: [],
      statistics: {
        totalEdges: 0,
        edgesByType: {
          tg_includes: 0,
          tg_depends_on: 0,
          tg_passes_input: 0,
          tg_sources: 0,
        },
        syntheticNodesCreated: 0,
        unresolvedCount: 0,
        averageConfidence: 0,
        processingTimeMs: 0,
        sourceTypeBreakdown: {
          local: 0,
          registry: 0,
          git: 0,
          github: 0,
          s3: 0,
          gcs: 0,
          http: 0,
          unknown: 0,
        },
      },
    };

    expect(hasUnresolvedReferences(result)).toBe(false);
  });
});

describe('filterEdgesByType', () => {
  it('should filter edges by type', () => {
    const edges: TgEdge[] = [
      {
        id: 'edge-1',
        source: 'a',
        target: 'b',
        type: TG_EDGE_TYPES.INCLUDES,
        label: 'includes:root',
        metadata: {},
        scanId: 'scan-123',
        confidence: 95,
        evidence: [],
        includeName: 'root',
        mergeStrategy: 'deep',
        inheritedBlocks: [],
        exposeAsVariable: false,
      },
      {
        id: 'edge-2',
        source: 'c',
        target: 'd',
        type: TG_EDGE_TYPES.DEPENDS_ON,
        label: 'depends_on:vpc',
        metadata: {},
        scanId: 'scan-123',
        confidence: 95,
        evidence: [],
        dependencyName: 'vpc',
        skipOutputs: false,
        outputsConsumed: [],
        hasMockOutputs: false,
      },
    ];

    const includeEdges = filterEdgesByType(edges, TG_EDGE_TYPES.INCLUDES);
    expect(includeEdges.length).toBe(1);
    expect(includeEdges[0].id).toBe('edge-1');

    const dependencyEdges = filterEdgesByType(edges, TG_EDGE_TYPES.DEPENDS_ON);
    expect(dependencyEdges.length).toBe(1);
    expect(dependencyEdges[0].id).toBe('edge-2');
  });
});

// ============================================================================
// DEFAULT_EDGE_SERVICE_OPTIONS Tests
// ============================================================================

describe('DEFAULT_EDGE_SERVICE_OPTIONS', () => {
  it('should have expected default values', () => {
    expect(DEFAULT_EDGE_SERVICE_OPTIONS.createEdgesForUnresolved).toBe(false);
    expect(DEFAULT_EDGE_SERVICE_OPTIONS.minConfidenceThreshold).toBe(0);
    expect(DEFAULT_EDGE_SERVICE_OPTIONS.linker).toBeDefined();
    expect(DEFAULT_EDGE_SERVICE_OPTIONS.logger).toBeDefined();
  });
});

// ============================================================================
// Edge Cases and Error Handling
// ============================================================================

describe('Edge Cases and Error Handling', () => {
  let service: TerragruntEdgeService;

  beforeEach(() => {
    service = new TerragruntEdgeService({ logger: testLogger });
  });

  it('should handle empty node result', () => {
    const nodeResult = createMockBatchNodeResult({
      configNodes: [],
      includeHints: [],
      dependencyHints: [],
    });
    const context = createMockEdgeCreationContext();

    const result = service.createEdgesFromNodeResult(nodeResult, context);

    expect(result.edges).toHaveLength(0);
    expect(result.syntheticNodes).toHaveLength(0);
    expect(result.unresolvedReferences).toHaveLength(0);
  });

  it('should handle linker errors gracefully', () => {
    const errorLinker = createMockLinker();
    (errorLinker.resolve as Mock).mockImplementation(() => {
      throw new Error('Linker crashed');
    });

    const customService = new TerragruntEdgeService({
      linker: errorLinker,
      logger: testLogger,
    });

    const nodeResult = createMockBatchNodeResult({
      configNodes: [
        createMockTerragruntConfigNode({
          terraformSource: './modules/app',
        }),
      ],
    });
    const context = createMockEdgeCreationContext();

    const result = customService.createEdgesFromNodeResult(nodeResult, context);

    // Should not throw, but record as unresolved
    expect(result.unresolvedReferences.length).toBeGreaterThan(0);
  });

  it('should handle multiple edge types in single result', () => {
    const nodeResult = createMockBatchNodeResult({
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'app',
          terraformSource: './modules/app',
        }),
      ],
      includeHints: [
        createMockIncludeHint({ sourceId: 'app', targetId: 'root' }),
      ],
      dependencyHints: [
        createMockDependencyHint({ sourceId: 'app', targetId: 'vpc' }),
      ],
    });
    const context = createMockEdgeCreationContext();

    const result = service.createEdgesFromNodeResult(nodeResult, context);

    const includeCount = result.edges.filter(e => e.type === TG_EDGE_TYPES.INCLUDES).length;
    const dependencyCount = result.edges.filter(e => e.type === TG_EDGE_TYPES.DEPENDS_ON).length;
    const sourceCount = result.edges.filter(e => e.type === TG_EDGE_TYPES.SOURCES).length;

    expect(includeCount).toBe(1);
    expect(dependencyCount).toBe(1);
    expect(sourceCount).toBe(1);
  });

  it('should handle special characters in paths', () => {
    const nodeResult = createMockBatchNodeResult({
      dependencyHints: [
        createMockDependencyHint({
          sourceId: 'app',
          targetId: 'vpc-us-east-1_v2.0',
          dependencyName: 'vpc-us-east-1_v2.0',
        }),
      ],
    });
    const context = createMockEdgeCreationContext();

    const result = service.createEdgesFromNodeResult(nodeResult, context);

    expect(result.edges.length).toBe(1);
  });

  it('should track source type breakdown in statistics', () => {
    const mixedLinker = createMockLinker();
    let callCount = 0;
    (mixedLinker.resolve as Mock).mockImplementation(() => {
      callCount++;
      return {
        targetNodeId: `node-${callCount}`,
        isSynthetic: true,
        syntheticNode: {
          id: `node-${callCount}`,
          type: 'terraform_module',
          name: `module-${callCount}`,
          location: { file: 'test', lineStart: 0, lineEnd: 0 },
          metadata: { synthetic: true },
          source: 'test',
          sourceType: callCount === 1 ? 'local' : 'git',
          providers: {},
        },
        sourceType: callCount === 1 ? 'local' : 'git',
        success: true,
      };
    });
    (mixedLinker.parseSource as Mock).mockImplementation((raw: string) => ({
      raw,
      type: raw.includes('git') ? 'git' : 'local',
    }));

    const customService = new TerragruntEdgeService({
      linker: mixedLinker,
      logger: testLogger,
    });

    const nodeResult = createMockBatchNodeResult({
      configNodes: [
        createMockTerragruntConfigNode({ id: 'a', terraformSource: './local/mod' }),
        createMockTerragruntConfigNode({ id: 'b', terraformSource: 'git::https://example.com' }),
      ],
    });
    const context = createMockEdgeCreationContext();

    const result = customService.createEdgesFromNodeResult(nodeResult, context);

    expect(result.statistics.sourceTypeBreakdown).toBeDefined();
  });
});

// ============================================================================
// Integration-Style Tests
// ============================================================================

describe('Full Edge Creation Workflow', () => {
  it('should handle complete terragrunt project structure', () => {
    const mockLinker = createMockLinker();
    const service = createTerragruntEdgeService({
      linker: mockLinker,
      logger: testLogger,
    });

    // Simulate a typical terragrunt project
    const nodeResult = createMockBatchNodeResult({
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'root',
          name: 'root',
          terraformSource: null,
        }),
        createMockTerragruntConfigNode({
          id: 'vpc',
          name: 'vpc',
          terraformSource: '../../modules/vpc',
        }),
        createMockTerragruntConfigNode({
          id: 'app',
          name: 'app',
          terraformSource: '../../modules/app',
        }),
      ],
      includeHints: [
        createMockIncludeHint({ sourceId: 'vpc', targetId: 'root', includeLabel: 'root' }),
        createMockIncludeHint({ sourceId: 'app', targetId: 'root', includeLabel: 'root' }),
      ],
      dependencyHints: [
        createMockDependencyHint({ sourceId: 'app', targetId: 'vpc', dependencyName: 'vpc' }),
      ],
      pathToIdMap: new Map([
        ['/repo/root.hcl', 'root'],
        ['/repo/env/dev/vpc/terragrunt.hcl', 'vpc'],
        ['/repo/env/dev/app/terragrunt.hcl', 'app'],
      ]),
    });

    const context = createMockEdgeCreationContext({
      existingTfModules: new Map([
        ['/repo/modules/vpc', 'tf-vpc-module'],
        ['/repo/modules/app', 'tf-app-module'],
      ]),
    });

    const result = service.createEdgesFromNodeResult(nodeResult, context);

    // Should have:
    // - 2 include edges (vpc->root, app->root)
    // - 1 dependency edge (app->vpc)
    // - 2 source edges (vpc->tf-vpc, app->tf-app)
    expect(result.edges.length).toBe(5);
    expect(result.statistics.edgesByType[TG_EDGE_TYPES.INCLUDES]).toBe(2);
    expect(result.statistics.edgesByType[TG_EDGE_TYPES.DEPENDS_ON]).toBe(1);
    expect(result.statistics.edgesByType[TG_EDGE_TYPES.SOURCES]).toBe(2);
    expect(result.unresolvedReferences.length).toBe(0);
  });
});
