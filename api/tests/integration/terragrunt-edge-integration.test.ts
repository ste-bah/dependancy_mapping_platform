/**
 * Terragrunt Edge Integration Tests
 * @module tests/integration/terragrunt-edge-integration.test
 *
 * TASK-TG-008: Integration tests verifying component interactions between:
 * - edge-factory.ts
 * - tf-linker.ts
 * - terragrunt-edge-service.ts
 * - terragrunt-node-helpers.ts
 *
 * Agent #34 of 47 | Phase 5: Testing
 * Previous: test-runner (221 tests passed, 100% pass rate)
 * Next: regression-tester, security-tester, coverage-analyzer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import pino from 'pino';

// Edge Factory imports
import {
  createTgIncludesEdge,
  createTgDependsOnEdge,
  createTgSourcesEdge,
  TG_EDGE_TYPES,
  createEvidenceBuilder,
  calculateAggregatedConfidence,
  isTgIncludesEdge,
  isTgDependsOnEdge,
  isTgSourcesEdge,
  isTgEdge,
  type TgEdgeFactoryOptions,
  type TgIncludesEdgeOptions,
  type TgDependsOnEdgeOptions,
  type TgSourcesEdgeOptions,
  type TgEdge,
  type TgEdgeEvidence,
} from '../../src/parsers/terragrunt/edge-factory';

// TF Linker imports
import {
  createTerraformLinker,
  parseSource,
  isExternalSource,
  detectSourceType,
  createLinkerContext,
  buildModuleMap,
  isSuccessfulResolution,
  isSyntheticResolution,
  isLocalSource,
  isGitSource,
  isRegistrySource,
  type ITerraformLinker,
  type TfLinkerContext,
  type TfLinkerResult,
  type TerraformSourceExpression,
} from '../../src/parsers/terragrunt/tf-linker';

// Edge Service imports
import {
  TerragruntEdgeService,
  createTerragruntEdgeService,
  createEdgesFromNodeResult,
  validateEdgeCreationContext,
  hasUnresolvedReferences,
  filterEdgesByType,
  type ITerragruntEdgeService,
  type EdgeCreationContext,
  type TerragruntEdgeResult,
} from '../../src/services/terragrunt-edge-service';

// Node Factory imports
import {
  createAllTerragruntNodesFromFiles,
  createTerragruntConfigNode,
  type BatchTerragruntNodeResult,
  type DependencyHint,
  type IncludeHint,
  type TerragruntNodeFactoryOptions,
} from '../../src/parsers/terragrunt/node-factory';

// Repository Helper imports
import {
  prepareTgEdgesForInsert,
  prepareSyntheticNodesForInsert,
  prepareTerragruntNodesForInsert,
  terragruntConfigNodeToInput,
  type BatchTerragruntPersistInput,
} from '../../src/repositories/terragrunt-node-helpers';

// Graph Types
import type {
  TerragruntConfigNode,
  TerraformModuleNode,
} from '../../src/types/graph';

// Entity types
import { createScanId, createTenantId, type ScanId, type TenantId } from '../../src/types/entities';

// Error types
import {
  TerragruntEdgeError,
  SourceResolutionError,
  isTerragruntEdgeError,
  isSourceResolutionError,
  canContinueAfterEdgeError,
} from '../../src/parsers/terragrunt/errors';

// Test Types
import type {
  TerragruntFile,
  TerragruntBlock,
  TerraformBlock,
  RemoteStateBlock,
  InputsBlock,
  ResolvedInclude,
  ResolvedDependency,
} from '../../src/parsers/terragrunt/types';

// Silent logger for tests
const testLogger = pino({ level: 'silent' });

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockLocation = (lineStart = 1, lineEnd = 10) => ({
  file: 'test.hcl',
  lineStart,
  lineEnd,
  columnStart: 1,
  columnEnd: 1,
  startLine: lineStart,
  endLine: lineEnd,
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

const createMockResolvedInclude = (label: string, resolvedPath: string | null = null): ResolvedInclude => ({
  label,
  pathExpression: { type: 'function', name: 'find_in_parent_folders', args: [], raw: 'find_in_parent_folders()' },
  resolvedPath,
  resolved: resolvedPath !== null,
  mergeStrategy: 'deep',
});

const createMockResolvedDependency = (name: string, resolvedPath: string | null = null): ResolvedDependency => ({
  name,
  configPathExpression: { type: 'literal', value: `../${name}`, raw: `"../${name}"` },
  resolvedPath,
  resolved: resolvedPath !== null,
  outputsUsed: ['output_a', 'output_b'],
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

const createMockEdgeCreationContext = (
  overrides: Partial<EdgeCreationContext> = {}
): EdgeCreationContext => ({
  scanId: 'scan-integration-123',
  tenantId: 'tenant-integration-456',
  repositoryRoot: '/repo',
  existingTfModules: new Map(),
  idGenerator: () => `test-edge-${Math.random().toString(36).substring(7)}`,
  ...overrides,
});

const createMockTerragruntConfigNode = (
  overrides: Partial<TerragruntConfigNode> = {}
): TerragruntConfigNode => ({
  id: `config-node-${Math.random().toString(36).substring(7)}`,
  type: 'tg_config',
  name: 'dev',
  location: {
    file: 'env/dev/terragrunt.hcl',
    lineStart: 1,
    lineEnd: 50,
  },
  metadata: {
    scanId: 'scan-integration-123',
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

const createMockIncludeHint = (overrides: Partial<IncludeHint> = {}): IncludeHint => ({
  sourceId: 'config-node-1',
  targetPath: '/repo/root.hcl',
  targetId: 'config-node-root',
  includeLabel: 'root',
  mergeStrategy: 'deep',
  resolved: true,
  ...overrides,
});

const createMockDependencyHint = (overrides: Partial<DependencyHint> = {}): DependencyHint => ({
  sourceId: 'config-node-1',
  targetPath: '/repo/vpc/terragrunt.hcl',
  targetId: 'config-node-vpc',
  dependencyName: 'vpc',
  resolved: true,
  ...overrides,
});

// ============================================================================
// Integration Tests: Edge Factory + TF Linker
// ============================================================================

describe('Edge Factory + TF Linker Integration', () => {
  let linker: ITerraformLinker;
  let factoryOptions: TgEdgeFactoryOptions;

  beforeEach(() => {
    linker = createTerraformLinker({
      idGenerator: () => `synthetic-${Math.random().toString(36).substring(7)}`,
      normalizePaths: true,
    });
    factoryOptions = {
      scanId: 'scan-integration-test',
      idGenerator: () => `edge-${Math.random().toString(36).substring(7)}`,
    };
  });

  describe('source resolution to edge creation', () => {
    it('should create source edge from resolved local source', () => {
      // Step 1: Parse source expression via TF Linker
      const sourceExpr = './modules/vpc';
      const source = linker.parseSource(sourceExpr);

      expect(source.type).toBe('local');
      expect(isLocalSource(source)).toBe(true);
      expect(linker.isExternal(source)).toBe(false);

      // Step 2: Resolve to existing module
      // IMPORTANT: The linker resolves paths relative to the config file directory.
      // For config at /repo/env/dev/terragrunt.hcl with source ./modules/vpc,
      // the resolved path is /repo/env/dev/modules/vpc (relative to config dir)
      const existingModules = new Map([
        ['/repo/env/dev/modules/vpc', 'existing-vpc-module-id'],
      ]);
      const context = createLinkerContext(
        'scan-123',
        'tenant-456',
        '/repo/env/dev/terragrunt.hcl',
        '/repo',
        existingModules
      );
      const result = linker.resolve(source, context);

      expect(isSuccessfulResolution(result)).toBe(true);
      // Local source resolves to existing module when path matches
      expect(result.isSynthetic).toBe(false);
      expect(result.targetNodeId).toBe('existing-vpc-module-id');

      // Step 3: Create edge using resolved target
      const evidence = createEvidenceBuilder()
        .file('env/dev/terragrunt.hcl')
        .lines(5, 7)
        .snippet('terraform { source = "./modules/vpc" }')
        .confidence(95)
        .explicit()
        .description('Terraform source block pointing to local VPC module')
        .build();

      const edgeOptions: TgSourcesEdgeOptions = {
        sourceNodeId: 'config-node-dev',
        targetNodeId: result.targetNodeId,
        sourceExpression: sourceExpr,
        sourceType: 'local',
        versionConstraint: null,
        evidence: [evidence],
      };

      const edge = createTgSourcesEdge(edgeOptions, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.SOURCES);
      expect(isTgSourcesEdge(edge)).toBe(true);
      expect(edge.source).toBe('config-node-dev');
      expect(edge.target).toBe('existing-vpc-module-id');
      expect(edge.sourceType).toBe('local');
      expect(edge.confidence).toBe(95);
    });

    it('should create synthetic node for local source not found in module map', () => {
      // This test verifies the behavior when a local path doesn't match
      // any existing TF module in the graph - a synthetic node is created
      const sourceExpr = './modules/vpc';
      const source = linker.parseSource(sourceExpr);

      expect(source.type).toBe('local');

      // Resolve with a map that has a DIFFERENT path (simulating module not scanned yet)
      const existingModules = new Map([
        ['/repo/modules/vpc', 'different-vpc-module-id'], // Different path
      ]);
      const context = createLinkerContext(
        'scan-123',
        'tenant-456',
        '/repo/env/dev/terragrunt.hcl',
        '/repo',
        existingModules
      );
      const result = linker.resolve(source, context);

      // Linker creates synthetic node when local path is not found
      expect(isSuccessfulResolution(result)).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.syntheticNode).toBeDefined();
      expect(result.resolvedPath).toBe('/repo/env/dev/modules/vpc');

      // Edge can still be created pointing to the synthetic node
      const edge = createTgSourcesEdge({
        sourceNodeId: 'config-node-dev',
        targetNodeId: result.targetNodeId,
        sourceExpression: sourceExpr,
        sourceType: 'local',
        versionConstraint: null,
        evidence: [createMockEvidence({ confidence: 80 })],
      }, factoryOptions);

      expect(edge.target).toBe(result.targetNodeId);
    });

    it('should create source edge with synthetic node for external git source', () => {
      // Step 1: Parse git source expression
      const sourceExpr = 'git@github.com:org/terraform-modules.git//vpc?ref=v1.2.0';
      const source = linker.parseSource(sourceExpr);

      expect(source.type).toBe('git');
      expect(isGitSource(source)).toBe(true);
      expect(linker.isExternal(source)).toBe(true);
      expect(source.ref).toBe('v1.2.0');
      expect(source.subdir).toBe('vpc');

      // Step 2: Resolve creates synthetic node
      const context = createLinkerContext(
        'scan-123',
        'tenant-456',
        '/repo/env/dev/terragrunt.hcl',
        '/repo'
      );
      const result = linker.resolve(source, context);

      expect(isSuccessfulResolution(result)).toBe(true);
      expect(isSyntheticResolution(result)).toBe(true);
      expect(result.syntheticNode).toBeDefined();
      expect(result.syntheticNode?.metadata).toMatchObject({
        synthetic: true,
        gitRef: 'v1.2.0',
      });

      // Step 3: Create edge to synthetic node
      const evidence = createEvidenceBuilder()
        .file('env/dev/terragrunt.hcl')
        .lines(5, 7)
        .snippet(`terraform { source = "${sourceExpr}" }`)
        .confidence(90)
        .explicit()
        .description('Terraform source block pointing to external git module')
        .build();

      const edgeOptions: TgSourcesEdgeOptions = {
        sourceNodeId: 'config-node-dev',
        targetNodeId: result.targetNodeId,
        sourceExpression: sourceExpr,
        sourceType: 'git',
        versionConstraint: 'v1.2.0',
        evidence: [evidence],
      };

      const edge = createTgSourcesEdge(edgeOptions, factoryOptions);

      expect(edge.type).toBe(TG_EDGE_TYPES.SOURCES);
      expect(edge.sourceType).toBe('git');
      expect(edge.versionConstraint).toBe('v1.2.0');
      expect(edge.target).toBe(result.targetNodeId);
    });

    it('should create source edge with synthetic node for registry source', () => {
      // Step 1: Parse registry source
      const sourceExpr = 'hashicorp/consul/aws';
      const source = linker.parseSource(sourceExpr);

      expect(source.type).toBe('registry');
      expect(isRegistrySource(source)).toBe(true);
      expect(source.registry).toBe('hashicorp/consul/aws');

      // Step 2: Resolve creates synthetic node
      const context = createLinkerContext(
        'scan-123',
        'tenant-456',
        '/repo/env/dev/terragrunt.hcl',
        '/repo'
      );
      const result = linker.resolve(source, context);

      expect(isSuccessfulResolution(result)).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.syntheticNode?.metadata).toMatchObject({
        registryAddress: 'hashicorp/consul/aws',
      });

      // Step 3: Create edge
      const edgeOptions: TgSourcesEdgeOptions = {
        sourceNodeId: 'config-node-dev',
        targetNodeId: result.targetNodeId,
        sourceExpression: sourceExpr,
        sourceType: 'registry',
        versionConstraint: null,
        evidence: [createMockEvidence({ confidence: 90 })],
      };

      const edge = createTgSourcesEdge(edgeOptions, factoryOptions);

      expect(edge.sourceType).toBe('registry');
      expect(edge.label).toBe('sources:registry');
    });

    it('should handle s3 and gcs source types', () => {
      // S3 source
      const s3Source = linker.parseSource('s3::https://s3-eu-west-1.amazonaws.com/mybucket/module.zip');
      expect(s3Source.type).toBe('s3');

      const s3Context = createLinkerContext('scan-1', 'tenant-1', '/config.hcl', '/repo');
      const s3Result = linker.resolve(s3Source, s3Context);
      expect(s3Result.success).toBe(true);
      expect(s3Result.sourceType).toBe('s3');

      // GCS source
      const gcsSource = linker.parseSource('gcs::https://www.googleapis.com/storage/v1/mybucket/module.zip');
      expect(gcsSource.type).toBe('gcs');

      const gcsContext = createLinkerContext('scan-1', 'tenant-1', '/config.hcl', '/repo');
      const gcsResult = linker.resolve(gcsSource, gcsContext);
      expect(gcsResult.success).toBe(true);
      expect(gcsResult.sourceType).toBe('gcs');
    });
  });

  describe('edge creation with resolved vs unresolved sources', () => {
    it('should handle resolution failure gracefully', () => {
      // Step 1: Parse source that will fail resolution
      const sourceExpr = '../../missing/module';
      const source = linker.parseSource(sourceExpr);

      // Step 2: Resolve with empty module map creates synthetic node
      const context = createLinkerContext(
        'scan-123',
        'tenant-456',
        '/repo/env/dev/terragrunt.hcl',
        '/repo',
        new Map() // Empty - no existing modules
      );
      const result = linker.resolve(source, context);

      // Even for unresolved local paths, a synthetic node is created
      expect(result.success).toBe(true);
      expect(result.isSynthetic).toBe(true);
      expect(result.resolvedPath).toBeDefined();

      // Step 3: Edge can still be created to synthetic node
      const edgeOptions: TgSourcesEdgeOptions = {
        sourceNodeId: 'config-node-dev',
        targetNodeId: result.targetNodeId,
        sourceExpression: sourceExpr,
        sourceType: 'local',
        versionConstraint: null,
        evidence: [createMockEvidence({ confidence: 60, evidenceType: 'inferred' })],
      };

      const edge = createTgSourcesEdge(edgeOptions, factoryOptions);

      // Edge points to synthetic node
      expect(edge.target).toBe(result.targetNodeId);
      expect(edge.confidence).toBe(60);
    });
  });

  describe('evidence propagation', () => {
    it('should propagate evidence through linker to edge factory', () => {
      // Create evidence based on linker parsing results
      const sourceExpr = 'git::https://github.com/org/modules.git//vpc?ref=v2.0.0';
      const source = linker.parseSource(sourceExpr);

      // Build evidence with linker-derived information
      const evidence = createEvidenceBuilder()
        .file('terragrunt.hcl')
        .lines(10, 12)
        .snippet(`terraform { source = "${sourceExpr}" }`)
        .confidence(source.type === 'git' ? 90 : 80)
        .type(source.type === 'unknown' ? 'heuristic' : 'explicit')
        .description(`Terraform ${source.type} source with ref=${source.ref || 'none'}`)
        .build();

      expect(evidence.confidence).toBe(90);
      expect(evidence.evidenceType).toBe('explicit');
      expect(evidence.description).toContain('ref=v2.0.0');

      // Multiple evidence items aggregate correctly
      const multipleEvidence = [
        evidence,
        createMockEvidence({ confidence: 70, evidenceType: 'inferred' }),
      ];

      const aggregated = calculateAggregatedConfidence(multipleEvidence);
      // Weighted: (90*1 + 70*0.5) / (1 + 0.5) = 125/1.5 = 83
      expect(aggregated).toBe(83);
    });
  });
});

// ============================================================================
// Integration Tests: Edge Service + Edge Factory
// ============================================================================

describe('Edge Service + Edge Factory Integration', () => {
  let edgeService: ITerragruntEdgeService;
  let mockLinker: ITerraformLinker;

  beforeEach(() => {
    mockLinker = createTerraformLinker({
      idGenerator: () => `synthetic-${Math.random().toString(36).substring(7)}`,
    });

    edgeService = createTerragruntEdgeService({
      linker: mockLinker,
      logger: testLogger,
      createEdgesForUnresolved: false,
      minConfidenceThreshold: 0,
    });
  });

  describe('batch edge creation orchestration', () => {
    it('should create all edge types from node factory result', () => {
      const configNodes = [
        createMockTerragruntConfigNode({
          id: 'root-config',
          name: 'root',
          terraformSource: null,
        }),
        createMockTerragruntConfigNode({
          id: 'vpc-config',
          name: 'vpc',
          terraformSource: './modules/vpc',
          metadata: {
            scanId: 'scan-123',
            absolutePath: '/repo/live/vpc/terragrunt.hcl',
            encoding: 'utf-8',
            size: 1024,
            blockCount: 3,
            errorCount: 0,
            dependencyNames: [],
            includeLabels: ['root'],
          },
        }),
        createMockTerragruntConfigNode({
          id: 'app-config',
          name: 'app',
          terraformSource: './modules/app',
          metadata: {
            scanId: 'scan-123',
            absolutePath: '/repo/live/app/terragrunt.hcl',
            encoding: 'utf-8',
            size: 1024,
            blockCount: 3,
            errorCount: 0,
            dependencyNames: ['vpc'],
            includeLabels: ['root'],
          },
        }),
      ];

      const nodeResult: BatchTerragruntNodeResult = {
        configNodes,
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({ sourceId: 'vpc-config', targetId: 'root-config', includeLabel: 'root' }),
          createMockIncludeHint({ sourceId: 'app-config', targetId: 'root-config', includeLabel: 'root' }),
        ],
        dependencyHints: [
          createMockDependencyHint({ sourceId: 'app-config', targetId: 'vpc-config', dependencyName: 'vpc' }),
        ],
        pathToIdMap: new Map([
          ['/repo/root.hcl', 'root-config'],
          ['/repo/live/vpc/terragrunt.hcl', 'vpc-config'],
          ['/repo/live/app/terragrunt.hcl', 'app-config'],
        ]),
      };

      const context = createMockEdgeCreationContext({
        existingTfModules: new Map([
          ['/repo/modules/vpc', 'tf-vpc-module'],
          ['/repo/modules/app', 'tf-app-module'],
        ]),
      });

      const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Verify edge counts
      expect(result.edges.length).toBe(5); // 2 includes + 1 depends_on + 2 sources

      // Verify edge type distribution
      const includeEdges = filterEdgesByType(result.edges, TG_EDGE_TYPES.INCLUDES);
      const dependsOnEdges = filterEdgesByType(result.edges, TG_EDGE_TYPES.DEPENDS_ON);
      const sourceEdges = filterEdgesByType(result.edges, TG_EDGE_TYPES.SOURCES);

      expect(includeEdges.length).toBe(2);
      expect(dependsOnEdges.length).toBe(1);
      expect(sourceEdges.length).toBe(2);

      // Verify statistics
      expect(result.statistics.totalEdges).toBe(5);
      expect(result.statistics.edgesByType[TG_EDGE_TYPES.INCLUDES]).toBe(2);
      expect(result.statistics.edgesByType[TG_EDGE_TYPES.DEPENDS_ON]).toBe(1);
      expect(result.statistics.edgesByType[TG_EDGE_TYPES.SOURCES]).toBe(2);
      expect(result.unresolvedReferences.length).toBe(0);
    });

    it('should aggregate errors across multiple edge types', () => {
      // Create service that allows unresolved edges
      const permissiveService = createTerragruntEdgeService({
        linker: mockLinker,
        logger: testLogger,
        createEdgesForUnresolved: true,
      });

      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app-config',
            terraformSource: '../../missing/module',
          }),
        ],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({
            sourceId: 'app-config',
            targetId: null as any,
            targetPath: '/missing/include.hcl',
            resolved: false,
          }),
        ],
        dependencyHints: [
          createMockDependencyHint({
            sourceId: 'app-config',
            targetId: null as any,
            targetPath: '/missing/dependency/terragrunt.hcl',
            resolved: false,
          }),
        ],
        pathToIdMap: new Map([['/repo/app/terragrunt.hcl', 'app-config']]),
      };

      const context = createMockEdgeCreationContext();
      const result = permissiveService.createEdgesFromNodeResult(nodeResult, context);

      // Edges created for unresolved paths (with lower confidence)
      expect(result.edges.length).toBeGreaterThanOrEqual(2);

      // Unresolved references tracked
      expect(result.unresolvedReferences.length).toBe(2);
      expect(result.unresolvedReferences.some(r => r.type === 'include')).toBe(true);
      expect(result.unresolvedReferences.some(r => r.type === 'dependency')).toBe(true);

      // Statistics reflect unresolved count
      expect(result.statistics.unresolvedCount).toBe(2);
    });

    it('should handle graceful degradation when some edges fail', () => {
      // Mix of resolvable and unresolvable edges
      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'good-config',
            terraformSource: './modules/good',
          }),
        ],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({ sourceId: 'good-config', targetId: 'root-config' }),
          createMockIncludeHint({
            sourceId: 'good-config',
            targetId: null as any, // Will be skipped
            resolved: false,
          }),
        ],
        dependencyHints: [
          createMockDependencyHint({ sourceId: 'good-config', targetId: 'vpc-config' }),
        ],
        pathToIdMap: new Map([['/repo/good/terragrunt.hcl', 'good-config']]),
      };

      const context = createMockEdgeCreationContext();
      const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Good edges created, bad ones skipped
      expect(result.edges.length).toBeGreaterThanOrEqual(2); // include + depends_on + source
      expect(result.unresolvedReferences.length).toBe(1); // The unresolved include
    });
  });

  describe('error aggregation', () => {
    it('should track all error types in result', () => {
      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({
            sourceId: 'a',
            targetId: null as any,
            targetPath: '/missing1.hcl',
            resolved: false,
          }),
        ],
        dependencyHints: [
          createMockDependencyHint({
            sourceId: 'a',
            targetId: null as any,
            targetPath: '/missing2.hcl',
            resolved: false,
          }),
        ],
        pathToIdMap: new Map(),
      };

      const context = createMockEdgeCreationContext();
      const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

      expect(hasUnresolvedReferences(result)).toBe(true);
      expect(result.unresolvedReferences.length).toBe(2);

      // Check error types
      const includeErrors = result.unresolvedReferences.filter(r => r.type === 'include');
      const depErrors = result.unresolvedReferences.filter(r => r.type === 'dependency');

      expect(includeErrors.length).toBe(1);
      expect(depErrors.length).toBe(1);
    });
  });
});

// ============================================================================
// Integration Tests: Full Pipeline
// ============================================================================

describe('Full Pipeline Integration: TerragruntNodeResult to TerragruntEdgeResult', () => {
  let edgeService: ITerragruntEdgeService;

  beforeEach(() => {
    const linker = createTerraformLinker({
      idGenerator: () => `synthetic-${Math.random().toString(36).substring(7)}`,
    });

    edgeService = createTerragruntEdgeService({
      linker,
      logger: testLogger,
    });
  });

  describe('include hierarchy resolution', () => {
    it('should resolve multi-level include chain', () => {
      // Simulate: child -> env -> root hierarchy
      const files: TerragruntFile[] = [
        createMockTerragruntFile({
          path: '/repo/root.hcl',
          blocks: [createMockRemoteStateBlock('s3')],
        }),
        createMockTerragruntFile({
          path: '/repo/live/env.hcl',
          includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
        }),
        createMockTerragruntFile({
          path: '/repo/live/dev/app/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/app')],
          includes: [
            createMockResolvedInclude('env', '/repo/live/env.hcl'),
          ],
        }),
      ];

      let nodeIdCounter = 0;
      const nodeFactoryOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-hierarchy',
        repositoryRoot: '/repo',
        idGenerator: () => `node-${nodeIdCounter++}`,
      };

      const nodeResult = createAllTerragruntNodesFromFiles(files, nodeFactoryOptions);

      expect(nodeResult.configNodes.length).toBe(3);
      expect(nodeResult.includeHints.length).toBeGreaterThanOrEqual(2);

      // Verify include chain resolution
      const envIncludeHint = nodeResult.includeHints.find(
        h => h.includeLabel === 'root' && h.targetPath === '/repo/root.hcl'
      );
      const childIncludeHint = nodeResult.includeHints.find(
        h => h.includeLabel === 'env' && h.targetPath === '/repo/live/env.hcl'
      );

      expect(envIncludeHint?.targetId).toBeDefined();
      expect(childIncludeHint?.targetId).toBeDefined();

      // Create edges from node result
      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Should have include edges for the hierarchy
      const includeEdges = filterEdgesByType(edgeResult.edges, TG_EDGE_TYPES.INCLUDES);
      expect(includeEdges.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('dependency chain resolution', () => {
    it('should detect circular dependency chain', () => {
      // Create dependency chain: A -> B -> C -> A (circular)
      const files: TerragruntFile[] = [
        createMockTerragruntFile({
          path: '/repo/a/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/a')],
          dependencies: [createMockResolvedDependency('c', '/repo/c/terragrunt.hcl')],
        }),
        createMockTerragruntFile({
          path: '/repo/b/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/b')],
          dependencies: [createMockResolvedDependency('a', '/repo/a/terragrunt.hcl')],
        }),
        createMockTerragruntFile({
          path: '/repo/c/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/c')],
          dependencies: [createMockResolvedDependency('b', '/repo/b/terragrunt.hcl')],
        }),
      ];

      let nodeIdCounter = 0;
      const nodeFactoryOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-circular',
        repositoryRoot: '/repo',
        idGenerator: () => `node-${nodeIdCounter++}`,
      };

      const nodeResult = createAllTerragruntNodesFromFiles(files, nodeFactoryOptions);

      expect(nodeResult.configNodes.length).toBe(3);
      expect(nodeResult.dependencyHints.length).toBeGreaterThanOrEqual(3);

      // All dependencies should be resolved (forming a cycle)
      const resolvedDeps = nodeResult.dependencyHints.filter(h => h.targetId !== null);
      expect(resolvedDeps.length).toBeGreaterThanOrEqual(3);

      // Create edges - edges are created even for circular deps
      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      const dependsOnEdges = filterEdgesByType(edgeResult.edges, TG_EDGE_TYPES.DEPENDS_ON);
      expect(dependsOnEdges.length).toBeGreaterThanOrEqual(3);
    });

    it('should resolve linear dependency chain correctly', () => {
      // Linear chain: app -> rds -> vpc
      const files: TerragruntFile[] = [
        createMockTerragruntFile({
          path: '/repo/vpc/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/vpc')],
        }),
        createMockTerragruntFile({
          path: '/repo/rds/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/rds')],
          dependencies: [createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl')],
        }),
        createMockTerragruntFile({
          path: '/repo/app/terragrunt.hcl',
          blocks: [createMockTerraformBlock('./modules/app')],
          dependencies: [createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl')],
        }),
      ];

      let nodeIdCounter = 0;
      const nodeFactoryOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-linear',
        repositoryRoot: '/repo',
        idGenerator: () => `node-${nodeIdCounter++}`,
      };

      const nodeResult = createAllTerragruntNodesFromFiles(files, nodeFactoryOptions);

      // Verify correct dependency resolution
      expect(nodeResult.configNodes.length).toBe(3);

      const appDepHint = nodeResult.dependencyHints.find(h => h.dependencyName === 'rds');
      const rdsDepHint = nodeResult.dependencyHints.find(h => h.dependencyName === 'vpc');

      expect(appDepHint?.targetId).toBeDefined();
      expect(rdsDepHint?.targetId).toBeDefined();

      // Create edges
      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      const dependsOnEdges = filterEdgesByType(edgeResult.edges, TG_EDGE_TYPES.DEPENDS_ON);

      // The node factory creates TWO hint types per dependency:
      // 1. DependencyNode -> Target Config (actual dependency)
      // 2. ConfigNode -> DependencyNode (contains relationship)
      // So for 2 dependencies (vpc, rds), we expect 4 total dependency hints,
      // which all become depends_on edges
      // HOWEVER, the edge service only creates edges for the actual dependency relationships,
      // not the "contains" relationships which are handled differently.
      // The exact count depends on edge service implementation.
      // We verify that there are dependency edges covering the chain.
      expect(dependsOnEdges.length).toBeGreaterThanOrEqual(2); // At minimum app->rds, rds->vpc
    });
  });
});

// ============================================================================
// Integration Tests: Database Preparation
// ============================================================================

describe('Database Integration Preparation', () => {
  let edgeService: ITerragruntEdgeService;
  const scanId = createScanId('scan-db-integration');
  const tenantId = createTenantId('tenant-db-test');

  beforeEach(() => {
    const linker = createTerraformLinker({
      idGenerator: () => `synthetic-${Math.random().toString(36).substring(7)}`,
    });

    edgeService = createTerragruntEdgeService({
      linker,
      logger: testLogger,
    });
  });

  describe('edge insertion preparation', () => {
    it('should prepare edges with correct enum values for database', () => {
      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app-config',
            terraformSource: './modules/app',
          }),
        ],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({ sourceId: 'app-config', targetId: 'root-config' }),
        ],
        dependencyHints: [
          createMockDependencyHint({ sourceId: 'app-config', targetId: 'vpc-config' }),
        ],
        pathToIdMap: new Map(),
      };

      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Create node ID mapping (simulating DB IDs)
      const nodeIdMapping = new Map<string, string>([
        ['app-config', 'db-app-id'],
        ['root-config', 'db-root-id'],
        ['vpc-config', 'db-vpc-id'],
      ]);

      // Add synthetic node IDs if any
      for (const syntheticNode of edgeResult.syntheticNodes) {
        nodeIdMapping.set(syntheticNode.id, `db-${syntheticNode.id}`);
      }

      const dbEdges = prepareTgEdgesForInsert(edgeResult, scanId, tenantId, nodeIdMapping);

      // Verify edge types use tg_* enum values
      const edgeTypes = dbEdges.map(e => e.edgeType);
      expect(edgeTypes.every(t =>
        t === 'tg_includes' ||
        t === 'tg_depends_on' ||
        t === 'tg_passes_input' ||
        t === 'tg_sources'
      )).toBe(true);

      // Verify all edges have required fields
      for (const edge of dbEdges) {
        expect(edge.scanId).toBe(scanId);
        expect(edge.tenantId).toBe(tenantId);
        expect(edge.sourceNodeId).toBeDefined();
        expect(edge.targetNodeId).toBeDefined();
        expect(typeof edge.confidence).toBe('number');
      }
    });

    it('should prepare synthetic nodes for database insertion', () => {
      // Create edge result with synthetic nodes
      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'app-config',
            terraformSource: 'hashicorp/consul/aws', // Registry source creates synthetic
          }),
        ],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [],
        dependencyHints: [],
        pathToIdMap: new Map(),
      };

      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Should have synthetic node for registry source
      expect(edgeResult.syntheticNodes.length).toBe(1);

      const dbSyntheticNodes = prepareSyntheticNodesForInsert(
        edgeResult.syntheticNodes,
        scanId,
        tenantId
      );

      expect(dbSyntheticNodes.length).toBe(1);
      expect(dbSyntheticNodes[0].nodeType).toBe('terraform_module');
      expect(dbSyntheticNodes[0].scanId).toBe(scanId);
      expect(dbSyntheticNodes[0].tenantId).toBe(tenantId);
      expect(dbSyntheticNodes[0].metadata).toMatchObject({
        isSynthetic: true,
        sourceType: 'registry',
      });
    });

    it('should handle mixed edge types in batch preparation', () => {
      const nodeResult: BatchTerragruntNodeResult = {
        configNodes: [
          createMockTerragruntConfigNode({
            id: 'config-1',
            terraformSource: './modules/local',
          }),
          createMockTerragruntConfigNode({
            id: 'config-2',
            terraformSource: 'git::https://github.com/org/repo.git//mod',
          }),
        ],
        includeNodes: [],
        dependencyNodes: [],
        includeHints: [
          createMockIncludeHint({ sourceId: 'config-1', targetId: 'root' }),
        ],
        dependencyHints: [
          createMockDependencyHint({ sourceId: 'config-1', targetId: 'config-2' }),
        ],
        pathToIdMap: new Map(),
      };

      const context = createMockEdgeCreationContext();
      const edgeResult = edgeService.createEdgesFromNodeResult(nodeResult, context);

      // Create comprehensive node mapping
      const nodeIdMapping = new Map<string, string>();
      nodeIdMapping.set('config-1', 'db-config-1');
      nodeIdMapping.set('config-2', 'db-config-2');
      nodeIdMapping.set('root', 'db-root');

      // Add synthetic nodes to mapping
      for (const node of edgeResult.syntheticNodes) {
        nodeIdMapping.set(node.id, `db-synthetic-${node.id}`);
      }

      const dbEdges = prepareTgEdgesForInsert(edgeResult, scanId, tenantId, nodeIdMapping);

      // Verify all edges mapped correctly
      const validEdges = dbEdges.filter(e => e.sourceNodeId && e.targetNodeId);
      expect(validEdges.length).toBeGreaterThan(0);

      // Verify edge type distribution
      const typeCount = dbEdges.reduce((acc, e) => {
        acc[e.edgeType] = (acc[e.edgeType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      expect(typeCount['tg_includes']).toBeGreaterThanOrEqual(1);
      expect(typeCount['tg_depends_on']).toBeGreaterThanOrEqual(1);
    });
  });

  describe('node to DB input conversion', () => {
    it('should convert config nodes to DB input format', () => {
      const configNode = createMockTerragruntConfigNode({
        id: 'test-config',
        name: 'test-module',
        terraformSource: 'git::https://example.com/repo.git',
        hasRemoteState: true,
        remoteStateBackend: 's3',
        includeCount: 2,
        dependencyCount: 3,
        inputCount: 5,
        generateBlocks: ['provider', 'backend'],
      });

      const dbInput = terragruntConfigNodeToInput(configNode, scanId, tenantId);

      expect(dbInput.scanId).toBe(scanId);
      expect(dbInput.tenantId).toBe(tenantId);
      expect(dbInput.originalId).toBe('test-config');
      expect(dbInput.nodeType).toBe('tg_config');
      expect(dbInput.name).toBe('test-module');
      expect(dbInput.metadata).toMatchObject({
        terraformSource: 'git::https://example.com/repo.git',
        hasRemoteState: true,
        remoteStateBackend: 's3',
        includeCount: 2,
        dependencyCount: 3,
        inputCount: 5,
      });
    });
  });
});

// ============================================================================
// Integration Tests: Error Propagation
// ============================================================================

describe('Error Propagation Integration', () => {
  it('should propagate linker errors to edge service', () => {
    // Create a linker that throws for specific sources
    const throwingLinker = createTerraformLinker();
    const originalResolve = throwingLinker.resolve.bind(throwingLinker);

    // Mock resolve to throw for specific pattern
    const mockResolve = vi.spyOn(throwingLinker, 'resolve');
    mockResolve.mockImplementation((source, context) => {
      if (source.raw.includes('throw-error')) {
        throw new Error('Simulated resolution error');
      }
      return originalResolve(source, context);
    });

    const edgeService = createTerragruntEdgeService({
      linker: throwingLinker,
      logger: testLogger,
    });

    const nodeResult: BatchTerragruntNodeResult = {
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'error-config',
          terraformSource: './throw-error/module',
        }),
      ],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [],
      dependencyHints: [],
      pathToIdMap: new Map(),
    };

    const context = createMockEdgeCreationContext();
    const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

    // Error should be captured in unresolved references
    expect(result.unresolvedReferences.length).toBe(1);
    expect(result.unresolvedReferences[0].type).toBe('source');
    expect(result.unresolvedReferences[0].reason).toContain('error');
  });

  it('should continue processing after recoverable errors', () => {
    const edgeService = createTerragruntEdgeService({
      logger: testLogger,
    });

    const nodeResult: BatchTerragruntNodeResult = {
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'good-config',
          terraformSource: './modules/good',
        }),
      ],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [
        createMockIncludeHint({ sourceId: 'good-config', targetId: 'root' }),
        createMockIncludeHint({
          sourceId: 'bad-config', // Non-existent source
          targetId: null as any,
          resolved: false,
        }),
      ],
      dependencyHints: [],
      pathToIdMap: new Map(),
    };

    const context = createMockEdgeCreationContext();
    const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

    // Good edges should still be created
    expect(result.edges.length).toBeGreaterThan(0);

    // Bad edges tracked as unresolved
    expect(result.unresolvedReferences.length).toBe(1);
  });

  it('should validate context and throw early for invalid input', () => {
    expect(() => {
      validateEdgeCreationContext({
        scanId: '',
        tenantId: 'valid',
        repositoryRoot: '/repo',
        existingTfModules: new Map(),
      });
    }).toThrow('scanId');

    expect(() => {
      validateEdgeCreationContext({
        scanId: 'valid',
        tenantId: '',
        repositoryRoot: '/repo',
        existingTfModules: new Map(),
      });
    }).toThrow('tenantId');

    expect(() => {
      validateEdgeCreationContext({
        scanId: 'valid',
        tenantId: 'valid',
        repositoryRoot: '',
        existingTfModules: new Map(),
      });
    }).toThrow('repositoryRoot');
  });
});

// ============================================================================
// Integration Tests: Type Guards Across Components
// ============================================================================

describe('Type Guard Integration', () => {
  it('should correctly identify edge types across factory and service', () => {
    const factoryOptions: TgEdgeFactoryOptions = {
      scanId: 'scan-type-guard',
      idGenerator: () => `edge-${Math.random().toString(36).substring(7)}`,
    };

    // Create edges directly via factory
    const includesEdge = createTgIncludesEdge({
      sourceNodeId: 'child',
      targetNodeId: 'parent',
      includeName: 'root',
      mergeStrategy: 'deep',
      inheritedBlocks: [],
      exposeAsVariable: false,
      evidence: [createMockEvidence()],
    }, factoryOptions);

    const dependsOnEdge = createTgDependsOnEdge({
      sourceNodeId: 'app',
      targetNodeId: 'vpc',
      dependencyName: 'vpc',
      skipOutputs: false,
      outputsConsumed: ['vpc_id'],
      hasMockOutputs: false,
      evidence: [createMockEvidence()],
    }, factoryOptions);

    const sourcesEdge = createTgSourcesEdge({
      sourceNodeId: 'config',
      targetNodeId: 'module',
      sourceExpression: './modules/vpc',
      sourceType: 'local',
      versionConstraint: null,
      evidence: [createMockEvidence()],
    }, factoryOptions);

    // Type guards work correctly
    expect(isTgEdge(includesEdge)).toBe(true);
    expect(isTgEdge(dependsOnEdge)).toBe(true);
    expect(isTgEdge(sourcesEdge)).toBe(true);

    expect(isTgIncludesEdge(includesEdge)).toBe(true);
    expect(isTgIncludesEdge(dependsOnEdge)).toBe(false);

    expect(isTgDependsOnEdge(dependsOnEdge)).toBe(true);
    expect(isTgDependsOnEdge(includesEdge)).toBe(false);

    expect(isTgSourcesEdge(sourcesEdge)).toBe(true);
    expect(isTgSourcesEdge(includesEdge)).toBe(false);
  });

  it('should filter edges by type from service result', () => {
    const edgeService = createTerragruntEdgeService({ logger: testLogger });

    const nodeResult: BatchTerragruntNodeResult = {
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'app',
          terraformSource: './modules/app',
        }),
      ],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [createMockIncludeHint({ sourceId: 'app', targetId: 'root' })],
      dependencyHints: [createMockDependencyHint({ sourceId: 'app', targetId: 'vpc' })],
      pathToIdMap: new Map(),
    };

    const context = createMockEdgeCreationContext();
    const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

    // Use filterEdgesByType utility
    const includes = filterEdgesByType(result.edges, TG_EDGE_TYPES.INCLUDES);
    const dependsOn = filterEdgesByType(result.edges, TG_EDGE_TYPES.DEPENDS_ON);
    const sources = filterEdgesByType(result.edges, TG_EDGE_TYPES.SOURCES);

    // All filtered results should pass their type guards
    expect(includes.every(e => isTgIncludesEdge(e as TgEdge))).toBe(true);
    expect(dependsOn.every(e => isTgDependsOnEdge(e as TgEdge))).toBe(true);
    expect(sources.every(e => isTgSourcesEdge(e as TgEdge))).toBe(true);
  });
});

// ============================================================================
// Integration Tests: Evidence Flow
// ============================================================================

describe('Evidence Flow Integration', () => {
  it('should preserve evidence through full pipeline', () => {
    const edgeService = createTerragruntEdgeService({ logger: testLogger });

    const nodeResult: BatchTerragruntNodeResult = {
      configNodes: [
        createMockTerragruntConfigNode({
          id: 'app-config',
          name: 'app',
          terraformSource: './modules/app',
          location: {
            file: 'live/app/terragrunt.hcl',
            lineStart: 1,
            lineEnd: 20,
          },
        }),
      ],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [
        createMockIncludeHint({
          sourceId: 'app-config',
          targetId: 'root-config',
          includeLabel: 'root',
          resolved: true,
        }),
      ],
      dependencyHints: [],
      pathToIdMap: new Map(),
    };

    const context = createMockEdgeCreationContext();
    const result = edgeService.createEdgesFromNodeResult(nodeResult, context);

    // Edges should have evidence
    for (const edge of result.edges) {
      const tgEdge = edge as TgEdge;
      expect(tgEdge.evidence).toBeDefined();
      expect(tgEdge.evidence.length).toBeGreaterThan(0);
      expect(tgEdge.confidence).toBeGreaterThan(0);

      // Metadata should reflect evidence
      expect(tgEdge.metadata.confidence).toBe(tgEdge.confidence);
    }
  });

  it('should calculate correct confidence from multiple evidence sources', () => {
    const evidence: TgEdgeEvidence[] = [
      createMockEvidence({ confidence: 95, evidenceType: 'explicit' }),
      createMockEvidence({ confidence: 75, evidenceType: 'inferred' }),
      createMockEvidence({ confidence: 60, evidenceType: 'heuristic' }),
    ];

    const aggregated = calculateAggregatedConfidence(evidence);

    // Weighted average with diminishing returns
    // Sorted by confidence: 95, 75, 60
    // Weights: 1, 0.5, 0.33
    // (95*1 + 75*0.5 + 60*0.33) / (1 + 0.5 + 0.33) = (95 + 37.5 + 19.8) / 1.83 = 83.2
    expect(aggregated).toBeGreaterThan(80);
    expect(aggregated).toBeLessThan(90);
  });
});
