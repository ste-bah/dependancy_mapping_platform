/**
 * Terragrunt Node Pipeline Integration Tests
 * @module tests/parsers/terragrunt/integration/terragrunt-node-pipeline.test
 *
 * Agent #34 of 47 | Phase 5: Testing
 *
 * Integration tests verifying TerragruntConfigNode interactions across modules:
 * - Parser -> Metadata Extractor -> Node Factory pipeline
 * - Node Factory -> Repository Helpers pipeline
 * - Type Guard integration with created nodes
 * - Frontend/Backend type consistency
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTerragruntConfigNode,
  createTerragruntConfigNodes,
  createTerragruntConfigNodesWithRelationships,
  deriveNodeName,
  validateFactoryOptions,
  type TerragruntNodeFactoryOptions,
} from '../../../../src/parsers/terragrunt/node-factory';
import {
  extractTerragruntMetadata,
  extractTerraformSource,
  extractRemoteStateInfo,
  countInputs,
  extractGenerateLabels,
  getConfigurationSummary,
  hasErrors,
  hasTerraformSource,
  hasRemoteState,
  hasDependencies,
  hasIncludes,
} from '../../../../src/parsers/terragrunt/metadata-extractor';
import {
  terragruntConfigNodeToInput,
  rowToTerragruntConfigNode,
  dbResultToTerragruntConfigNode,
  type TerragruntNodeRow,
  type TerragruntConfigNodeDbResult,
} from '../../../../src/repositories/terragrunt-node-helpers';
import { isTerragruntConfigNode, type TerragruntConfigNode, type NodeType } from '../../../../src/types/graph';
import type {
  TerragruntFile,
  TerragruntBlock,
  TerraformBlock,
  RemoteStateBlock,
  InputsBlock,
  GenerateBlock,
  LocalsBlock,
  ResolvedInclude,
  ResolvedDependency,
} from '../../../../src/parsers/terragrunt/types';
import { createScanId, createTenantId, type ScanId, type TenantId } from '../../../../src/types/entities';

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

const createMockLocalsBlock = (): LocalsBlock => ({
  type: 'locals',
  variables: {
    region: { type: 'literal', value: 'us-east-1', raw: '"us-east-1"' },
  },
  location: createMockLocation(),
  raw: 'locals { ... }',
});

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

// ============================================================================
// Parser to Metadata Extractor to Node Factory Pipeline
// ============================================================================

describe('Terragrunt Node Pipeline Integration', () => {
  describe('Parser to Node Factory Pipeline', () => {
    const factoryOptions: TerragruntNodeFactoryOptions = {
      scanId: 'scan-integration-test-123',
      repositoryRoot: '/repo',
      idGenerator: () => 'test-uuid-integration-001',
    };

    it('should create valid node from parsed file with complete metadata', () => {
      // Step 1: Simulate parsed file (parser output)
      const parsedFile = createMockTerragruntFile({
        path: '/repo/environments/production/vpc/terragrunt.hcl',
        blocks: [
          createMockTerraformBlock('git::https://github.com/acme/modules.git//vpc?ref=v1.2.0'),
          createMockRemoteStateBlock('s3'),
          createMockInputsBlock(5),
          createMockGenerateBlock('provider'),
          createMockGenerateBlock('backend'),
        ],
        includes: [
          createMockResolvedInclude('root', '/repo/root.hcl'),
          createMockResolvedInclude('env', '/repo/env.hcl'),
        ],
        dependencies: [
          createMockResolvedDependency('networking', '/repo/modules/networking/terragrunt.hcl'),
          createMockResolvedDependency('security', '/repo/modules/security/terragrunt.hcl'),
        ],
        encoding: 'utf-8',
        size: 2048,
      });

      // Step 2: Extract metadata (metadata-extractor integration)
      const metadata = extractTerragruntMetadata(parsedFile);

      // Verify metadata extraction
      expect(metadata.terraformSource).toBe('git::https://github.com/acme/modules.git//vpc?ref=v1.2.0');
      expect(metadata.hasRemoteState).toBe(true);
      expect(metadata.remoteStateBackend).toBe('s3');
      expect(metadata.includeCount).toBe(2);
      expect(metadata.dependencyCount).toBe(2);
      expect(metadata.inputCount).toBe(5);
      expect(metadata.generateBlocks).toContain('provider');
      expect(metadata.generateBlocks).toContain('backend');

      // Step 3: Create node (node-factory integration)
      const node = createTerragruntConfigNode(parsedFile, factoryOptions);

      // Verify node creation uses metadata correctly
      expect(node.type).toBe('tg_config');
      expect(node.name).toBe('vpc');
      expect(node.terraformSource).toBe(metadata.terraformSource);
      expect(node.hasRemoteState).toBe(metadata.hasRemoteState);
      expect(node.remoteStateBackend).toBe(metadata.remoteStateBackend);
      expect(node.includeCount).toBe(metadata.includeCount);
      expect(node.dependencyCount).toBe(metadata.dependencyCount);
      expect(node.inputCount).toBe(metadata.inputCount);
      expect(node.generateBlocks).toEqual(metadata.generateBlocks);

      // Verify node metadata contains scanId
      expect(node.metadata.scanId).toBe('scan-integration-test-123');
      expect(node.metadata.absolutePath).toBe('/repo/environments/production/vpc/terragrunt.hcl');
    });

    it('should handle parsed file with errors', () => {
      const parsedFileWithErrors = createMockTerragruntFile({
        path: '/repo/broken/terragrunt.hcl',
        blocks: [createMockTerraformBlock('source')],
        errors: [
          { message: 'Syntax error at line 5', location: null, severity: 'error', code: 'SYNTAX_ERROR' },
          { message: 'Unknown function', location: null, severity: 'warning', code: 'SYNTAX_ERROR' },
        ],
      });

      // Metadata should reflect errors
      const metadata = extractTerragruntMetadata(parsedFileWithErrors);
      expect(metadata.errorCount).toBe(2);
      expect(hasErrors(parsedFileWithErrors)).toBe(true);

      // Node should still be created with error metadata
      const node = createTerragruntConfigNode(parsedFileWithErrors, factoryOptions);
      expect(node.metadata.errorCount).toBe(2);
    });

    it('should create nodes for entire directory batch', () => {
      const parsedFiles = [
        createMockTerragruntFile({
          path: '/repo/vpc/terragrunt.hcl',
          blocks: [createMockTerraformBlock('../modules/vpc')],
        }),
        createMockTerragruntFile({
          path: '/repo/rds/terragrunt.hcl',
          blocks: [createMockTerraformBlock('../modules/rds')],
          dependencies: [createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl')],
        }),
        createMockTerragruntFile({
          path: '/repo/ecs/terragrunt.hcl',
          blocks: [createMockTerraformBlock('../modules/ecs')],
          dependencies: [
            createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl'),
            createMockResolvedDependency('rds', '/repo/rds/terragrunt.hcl'),
          ],
        }),
      ];

      const nodes = createTerragruntConfigNodes(parsedFiles, factoryOptions);

      expect(nodes).toHaveLength(3);
      expect(nodes[0].name).toBe('vpc');
      expect(nodes[0].dependencyCount).toBe(0);
      expect(nodes[1].name).toBe('rds');
      expect(nodes[1].dependencyCount).toBe(1);
      expect(nodes[2].name).toBe('ecs');
      expect(nodes[2].dependencyCount).toBe(2);
    });

    it('should extract relationship hints for dependency graph building', () => {
      let idCounter = 0;
      const relOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-rel-test',
        repositoryRoot: '/repo',
        idGenerator: () => `node-${idCounter++}`,
      };

      const parsedFiles = [
        createMockTerragruntFile({
          path: '/repo/vpc/terragrunt.hcl',
          blocks: [createMockTerraformBlock('../modules/vpc')],
        }),
        createMockTerragruntFile({
          path: '/repo/app/terragrunt.hcl',
          blocks: [createMockTerraformBlock('../modules/app')],
          dependencies: [createMockResolvedDependency('vpc', '/repo/vpc/terragrunt.hcl')],
          includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
        }),
      ];

      const result = createTerragruntConfigNodesWithRelationships(parsedFiles, relOptions);

      // Verify nodes created
      expect(result.nodes).toHaveLength(2);
      expect(result.pathToIdMap.size).toBe(2);

      // Verify dependency hints
      const vpcDep = result.dependencyHints.find(h => h.dependencyName === 'vpc');
      expect(vpcDep).toBeDefined();
      expect(vpcDep?.sourceId).toBeDefined();
      expect(vpcDep?.targetPath).toBe('/repo/vpc/terragrunt.hcl');
      expect(vpcDep?.targetId).toBeDefined();
      expect(vpcDep?.resolved).toBe(true);

      // Verify include hints
      expect(result.includeHints.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Node Factory to Repository Pipeline', () => {
    const scanId = createScanId('scan-repo-test-456');
    const tenantId = createTenantId('tenant-test-789');

    it('should convert node to valid DB input', () => {
      const parsedFile = createMockTerragruntFile({
        path: '/repo/module/terragrunt.hcl',
        blocks: [
          createMockTerraformBlock('git::https://example.com/module.git'),
          createMockRemoteStateBlock('gcs'),
          createMockInputsBlock(3),
          createMockGenerateBlock('versions'),
        ],
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
        dependencies: [createMockResolvedDependency('base', '/repo/base/terragrunt.hcl')],
      });

      const factoryOptions: TerragruntNodeFactoryOptions = {
        scanId: scanId,
        repositoryRoot: '/repo',
        idGenerator: () => 'node-uuid-abc123',
      };

      // Create node
      const node = createTerragruntConfigNode(parsedFile, factoryOptions);

      // Convert to DB input
      const dbInput = terragruntConfigNodeToInput(node, scanId, tenantId);

      // Verify DB input structure
      expect(dbInput.scanId).toBe(scanId);
      expect(dbInput.tenantId).toBe(tenantId);
      expect(dbInput.originalId).toBe('node-uuid-abc123');
      expect(dbInput.nodeType).toBe('tg_config');
      expect(dbInput.name).toBe('module');
      expect(dbInput.filePath).toBe('module/terragrunt.hcl');
      expect(dbInput.lineStart).toBeGreaterThanOrEqual(1);
      expect(dbInput.lineEnd).toBeGreaterThanOrEqual(1);

      // Verify metadata passthrough
      expect(dbInput.metadata.terraformSource).toBe('git::https://example.com/module.git');
      expect(dbInput.metadata.hasRemoteState).toBe(true);
      expect(dbInput.metadata.remoteStateBackend).toBe('gcs');
      expect(dbInput.metadata.includeCount).toBe(1);
      expect(dbInput.metadata.dependencyCount).toBe(1);
      expect(dbInput.metadata.inputCount).toBe(3);
      expect(dbInput.metadata.generateBlocks).toContain('versions');
    });

    it('should convert DB row back to TerragruntConfigNode', () => {
      const dbRow: TerragruntNodeRow = {
        id: 'db-node-id-001',
        scan_id: 'scan-db-test',
        tenant_id: 'tenant-db-test',
        original_id: 'original-node-id',
        node_type: 'tg_config',
        name: 'database',
        file_path: 'infrastructure/database/terragrunt.hcl',
        line_start: 1,
        line_end: 50,
        column_start: null,
        column_end: null,
        metadata: {
          scanId: 'scan-db-test',
          absolutePath: '/repo/infrastructure/database/terragrunt.hcl',
          encoding: 'utf-8',
          size: 1500,
          blockCount: 4,
          errorCount: 0,
          dependencyNames: ['vpc', 'security'],
          includeLabels: ['root'],
          terraformSource: 'git::https://example.com/rds-module.git',
          hasRemoteState: true,
          remoteStateBackend: 's3',
          includeCount: 1,
          dependencyCount: 2,
          inputCount: 8,
          generateBlocks: ['provider', 'backend'],
        },
        created_at: new Date(),
      };

      const node = rowToTerragruntConfigNode(dbRow);

      // Verify round-trip integrity
      expect(node.id).toBe('db-node-id-001');
      expect(node.type).toBe('tg_config');
      expect(node.name).toBe('database');
      expect(node.location.file).toBe('infrastructure/database/terragrunt.hcl');
      expect(node.location.lineStart).toBe(1);
      expect(node.location.lineEnd).toBe(50);
      expect(node.terraformSource).toBe('git::https://example.com/rds-module.git');
      expect(node.hasRemoteState).toBe(true);
      expect(node.remoteStateBackend).toBe('s3');
      expect(node.includeCount).toBe(1);
      expect(node.dependencyCount).toBe(2);
      expect(node.inputCount).toBe(8);
      expect(node.generateBlocks).toContain('provider');
      expect(node.generateBlocks).toContain('backend');
    });

    it('should convert DB function result to TerragruntConfigNode', () => {
      const dbResult: TerragruntConfigNodeDbResult = {
        node_id: 'func-result-id-001',
        node_name: 'api-gateway',
        file_path: 'services/api/terragrunt.hcl',
        terraform_source: 'git::https://example.com/api-module.git?ref=v2.0.0',
        has_remote_state: true,
        remote_state_backend: 'azurerm',
        include_count: 2,
        dependency_count: 3,
        input_count: 12,
        generate_blocks: ['provider', 'backend', 'versions'],
        line_start: 1,
        line_end: 75,
        created_at: new Date(),
        total_count: 1,
      };

      const node = dbResultToTerragruntConfigNode(dbResult);

      expect(node.id).toBe('func-result-id-001');
      expect(node.type).toBe('tg_config');
      expect(node.name).toBe('api-gateway');
      expect(node.location.file).toBe('services/api/terragrunt.hcl');
      expect(node.terraformSource).toBe('git::https://example.com/api-module.git?ref=v2.0.0');
      expect(node.hasRemoteState).toBe(true);
      expect(node.remoteStateBackend).toBe('azurerm');
      expect(node.includeCount).toBe(2);
      expect(node.dependencyCount).toBe(3);
      expect(node.inputCount).toBe(12);
      expect(node.generateBlocks).toHaveLength(3);
    });

    it('should handle DB row with null optional fields', () => {
      const dbRow: TerragruntNodeRow = {
        id: 'db-minimal-001',
        scan_id: 'scan-minimal',
        tenant_id: 'tenant-minimal',
        original_id: 'original-minimal',
        node_type: 'tg_config',
        name: 'minimal',
        file_path: 'minimal/terragrunt.hcl',
        line_start: 1,
        line_end: 5,
        column_start: null,
        column_end: null,
        metadata: {},
        created_at: new Date(),
      };

      const node = rowToTerragruntConfigNode(dbRow);

      // Verify defaults for missing metadata
      expect(node.terraformSource).toBeNull();
      expect(node.hasRemoteState).toBe(false);
      expect(node.remoteStateBackend).toBeNull();
      expect(node.includeCount).toBe(0);
      expect(node.dependencyCount).toBe(0);
      expect(node.inputCount).toBe(0);
      expect(node.generateBlocks).toEqual([]);
    });
  });

  describe('Type Guard Integration', () => {
    it('should correctly identify TerragruntConfigNode', () => {
      const parsedFile = createMockTerragruntFile({
        path: '/repo/module/terragrunt.hcl',
        blocks: [createMockTerraformBlock('module-source')],
      });

      const factoryOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-typeguard-test',
        repositoryRoot: '/repo',
      };

      const node = createTerragruntConfigNode(parsedFile, factoryOptions);

      // Type guard should work
      expect(isTerragruntConfigNode(node)).toBe(true);

      // Cast to NodeType to test discriminated union
      const nodeAsGeneric: NodeType = node;
      expect(isTerragruntConfigNode(nodeAsGeneric)).toBe(true);

      if (isTerragruntConfigNode(nodeAsGeneric)) {
        // TypeScript should narrow the type here
        expect(nodeAsGeneric.terraformSource).toBe('module-source');
        expect(nodeAsGeneric.hasRemoteState).toBe(false);
      }
    });

    it('should not identify other node types as TerragruntConfigNode', () => {
      // Mock a Terraform resource node
      const terraformNode = {
        id: 'tf-node-001',
        type: 'terraform_resource' as const,
        name: 'aws_instance.web',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
        metadata: {},
        resourceType: 'aws_instance',
        provider: 'aws',
        dependsOn: [],
      };

      expect(isTerragruntConfigNode(terraformNode as unknown as NodeType)).toBe(false);
    });

    it('should work with nodes from DB round-trip', () => {
      const dbRow: TerragruntNodeRow = {
        id: 'db-typeguard-001',
        scan_id: 'scan-tg',
        tenant_id: 'tenant-tg',
        original_id: 'orig-tg',
        node_type: 'tg_config',
        name: 'test-module',
        file_path: 'test/terragrunt.hcl',
        line_start: 1,
        line_end: 10,
        column_start: null,
        column_end: null,
        metadata: {
          terraformSource: 'test-source',
          hasRemoteState: false,
          remoteStateBackend: null,
        },
        created_at: new Date(),
      };

      const nodeFromDb = rowToTerragruntConfigNode(dbRow);

      expect(isTerragruntConfigNode(nodeFromDb)).toBe(true);
    });
  });

  describe('End-to-End Pipeline', () => {
    it('should process complete infrastructure hierarchy', () => {
      // Simulate a real infrastructure layout
      const infrastructureFiles = [
        createMockTerragruntFile({
          path: '/repo/live/us-east-1/prod/vpc/terragrunt.hcl',
          blocks: [
            createMockTerraformBlock('git::https://github.com/acme/tf-modules.git//vpc'),
            createMockRemoteStateBlock('s3'),
            createMockInputsBlock(8),
            createMockGenerateBlock('provider'),
          ],
        }),
        createMockTerragruntFile({
          path: '/repo/live/us-east-1/prod/rds/terragrunt.hcl',
          blocks: [
            createMockTerraformBlock('git::https://github.com/acme/tf-modules.git//rds'),
            createMockRemoteStateBlock('s3'),
            createMockInputsBlock(15),
          ],
          dependencies: [
            createMockResolvedDependency('vpc', '/repo/live/us-east-1/prod/vpc/terragrunt.hcl'),
          ],
        }),
        createMockTerragruntFile({
          path: '/repo/live/us-east-1/prod/ecs/terragrunt.hcl',
          blocks: [
            createMockTerraformBlock('git::https://github.com/acme/tf-modules.git//ecs'),
            createMockRemoteStateBlock('s3'),
            createMockInputsBlock(20),
            createMockGenerateBlock('provider'),
            createMockGenerateBlock('backend'),
          ],
          dependencies: [
            createMockResolvedDependency('vpc', '/repo/live/us-east-1/prod/vpc/terragrunt.hcl'),
            createMockResolvedDependency('rds', '/repo/live/us-east-1/prod/rds/terragrunt.hcl'),
          ],
          includes: [
            createMockResolvedInclude('root', '/repo/live/root.hcl'),
            createMockResolvedInclude('env', '/repo/live/us-east-1/prod/env.hcl'),
          ],
        }),
      ];

      let idCounter = 0;
      const factoryOptions: TerragruntNodeFactoryOptions = {
        scanId: 'scan-e2e-infra',
        repositoryRoot: '/repo',
        idGenerator: () => `node-e2e-${idCounter++}`,
      };

      // Step 1: Create nodes with relationships
      const result = createTerragruntConfigNodesWithRelationships(infrastructureFiles, factoryOptions);

      // Verify node count
      expect(result.nodes).toHaveLength(3);

      // Step 2: Verify VPC node (no dependencies)
      const vpcNode = result.nodes.find(n => n.name === 'vpc');
      expect(vpcNode).toBeDefined();
      expect(vpcNode?.dependencyCount).toBe(0);
      expect(vpcNode?.terraformSource).toContain('vpc');

      // Step 3: Verify RDS node (depends on VPC)
      const rdsNode = result.nodes.find(n => n.name === 'rds');
      expect(rdsNode).toBeDefined();
      expect(rdsNode?.dependencyCount).toBe(1);
      expect(rdsNode?.metadata.dependencyNames).toContain('vpc');

      // Step 4: Verify ECS node (depends on VPC and RDS)
      const ecsNode = result.nodes.find(n => n.name === 'ecs');
      expect(ecsNode).toBeDefined();
      expect(ecsNode?.dependencyCount).toBe(2);
      expect(ecsNode?.includeCount).toBe(2);
      expect(ecsNode?.generateBlocks).toHaveLength(2);

      // Step 5: Verify dependency hints for graph building
      expect(result.dependencyHints.length).toBe(3); // VPC->RDS, VPC->ECS, RDS->ECS
      const ecsDependencies = result.dependencyHints.filter(h => h.sourceId === ecsNode?.id);
      expect(ecsDependencies).toHaveLength(2);

      // Step 6: Convert to DB inputs
      const scanId = createScanId('scan-e2e-infra');
      const tenantId = createTenantId('tenant-e2e');

      const dbInputs = result.nodes.map(node =>
        terragruntConfigNodeToInput(node, scanId, tenantId)
      );

      expect(dbInputs).toHaveLength(3);
      expect(dbInputs.every(input => input.nodeType === 'tg_config')).toBe(true);
      expect(dbInputs.every(input => input.scanId === scanId)).toBe(true);
      expect(dbInputs.every(input => input.tenantId === tenantId)).toBe(true);

      // Step 7: Verify all nodes pass type guard
      expect(result.nodes.every(n => isTerragruntConfigNode(n))).toBe(true);
    });

    it('should preserve metadata through configuration summary', () => {
      const parsedFile = createMockTerragruntFile({
        path: '/repo/service/terragrunt.hcl',
        blocks: [
          createMockTerraformBlock('git::https://example.com/service.git'),
          createMockRemoteStateBlock('s3'),
          createMockInputsBlock(7),
          createMockGenerateBlock('provider'),
        ],
        includes: [createMockResolvedInclude('root')],
        dependencies: [
          createMockResolvedDependency('vpc'),
          createMockResolvedDependency('rds'),
        ],
        errors: [
          { message: 'Warning about deprecated attribute', location: null, severity: 'warning', code: 'SYNTAX_ERROR' },
        ],
      });

      // Extract metadata
      const metadata = extractTerragruntMetadata(parsedFile);

      // Generate summary
      const summary = getConfigurationSummary(metadata);

      // Verify summary contains key information
      expect(summary).toContain('Terraform module');
      expect(summary).toContain('s3 backend');
      expect(summary).toContain('2 dependencies');
      expect(summary).toContain('7 inputs');
      expect(summary).toContain('1 include');
      expect(summary).toContain('1 error');
    });
  });

  describe('Factory Options Validation Integration', () => {
    it('should validate options before batch processing', () => {
      const validOptions: TerragruntNodeFactoryOptions = {
        scanId: 'valid-scan-id',
        repositoryRoot: '/valid/absolute/path',
      };

      expect(() => validateFactoryOptions(validOptions)).not.toThrow();

      const files = [
        createMockTerragruntFile({ path: '/valid/absolute/path/a/terragrunt.hcl' }),
        createMockTerragruntFile({ path: '/valid/absolute/path/b/terragrunt.hcl' }),
      ];

      const nodes = createTerragruntConfigNodes(files, validOptions);
      expect(nodes).toHaveLength(2);
    });

    it('should reject invalid options early', () => {
      const invalidOptions = {
        scanId: '',
        repositoryRoot: './relative/path',
      } as TerragruntNodeFactoryOptions;

      expect(() => validateFactoryOptions(invalidOptions)).toThrow();
    });
  });

  describe('Metadata Extractor Integration', () => {
    it('should integrate utility functions with extracted metadata', () => {
      const parsedFile = createMockTerragruntFile({
        path: '/repo/full/terragrunt.hcl',
        blocks: [
          createMockTerraformBlock('git::https://example.com/module.git'),
          createMockRemoteStateBlock('s3'),
          createMockInputsBlock(5),
          createMockGenerateBlock('provider'),
        ],
        includes: [createMockResolvedInclude('root', '/repo/root.hcl')],
        dependencies: [createMockResolvedDependency('base', '/repo/base/terragrunt.hcl')],
      });

      // Test utility functions match metadata
      expect(hasTerraformSource(parsedFile)).toBe(true);
      expect(hasRemoteState(parsedFile)).toBe(true);
      expect(hasDependencies(parsedFile)).toBe(true);
      expect(hasIncludes(parsedFile)).toBe(true);
      expect(hasErrors(parsedFile)).toBe(false);

      // Extract individual components
      const blocks = parsedFile.blocks;
      expect(extractTerraformSource(blocks)).toBe('git::https://example.com/module.git');
      expect(extractRemoteStateInfo(blocks).remoteStateBackend).toBe('s3');
      expect(countInputs(blocks)).toBe(5);
      expect(extractGenerateLabels(blocks)).toContain('provider');
    });
  });
});
