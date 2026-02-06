/**
 * Terragrunt Node Repository Helpers Tests
 * @module tests/repositories/terragrunt-node-helpers
 *
 * TASK-TG-032: Unit tests for repository mapper functions.
 * Tests for terragruntIncludeNodeToInput, rowToTerragruntIncludeNode,
 * terragruntDependencyNodeToInput, and rowToTerragruntDependencyNode.
 *
 * Coverage targets: 90% for all mapper functions
 */

import { describe, it, expect } from 'vitest';
import {
  rowToTerragruntConfigNode,
  terragruntConfigNodeToInput,
  terragruntIncludeNodeToInput,
  rowToTerragruntIncludeNode,
  terragruntDependencyNodeToInput,
  rowToTerragruntDependencyNode,
  prepareTerragruntNodesForInsert,
  prepareTerragruntEdgesForInsert,
  calculateNodeCounts,
  type TerragruntNodeRow,
  type NodeRow,
  type BatchTerragruntPersistInput,
} from '../../src/repositories/terragrunt-node-helpers';
import {
  isTerragruntConfigNode,
  isTerragruntIncludeNode,
  isTerragruntDependencyNode,
  type TerragruntConfigNode,
  type TerragruntIncludeNode,
  type TerragruntDependencyNode,
} from '../../src/types/graph';
import type { ScanId, TenantId, DbNodeId } from '../../src/types/entities';

// ============================================================================
// Test Fixtures
// ============================================================================

const SCAN_ID = 'scan-test-123' as ScanId;
const TENANT_ID = 'tenant-test-456' as TenantId;

function createMockTerragruntIncludeNode(
  overrides: Partial<TerragruntIncludeNode> = {}
): TerragruntIncludeNode {
  return {
    id: 'include-node-123',
    type: 'tg_include',
    name: 'root',
    location: {
      file: 'env/dev/terragrunt.hcl',
      lineStart: 5,
      lineEnd: 10,
      columnStart: 1,
      columnEnd: 50,
    },
    metadata: {
      scanId: 'scan-123',
      parentConfigId: 'parent-config-456',
    },
    label: 'root',
    path: 'find_in_parent_folders("root.hcl")',
    resolvedPath: '/repo/root.hcl',
    expose: true,
    mergeStrategy: 'deep',
    ...overrides,
  };
}

function createMockTerragruntDependencyNode(
  overrides: Partial<TerragruntDependencyNode> = {}
): TerragruntDependencyNode {
  return {
    id: 'dep-node-123',
    type: 'tg_dependency',
    name: 'vpc',
    location: {
      file: 'env/dev/terragrunt.hcl',
      lineStart: 15,
      lineEnd: 25,
      columnStart: 1,
      columnEnd: 50,
    },
    metadata: {
      scanId: 'scan-123',
      parentConfigId: 'parent-config-456',
    },
    dependencyName: 'vpc',
    configPath: '../vpc',
    resolvedPath: '/repo/vpc/terragrunt.hcl',
    skipOutputs: false,
    hasMockOutputs: true,
    ...overrides,
  };
}

function createMockTerragruntConfigNode(
  overrides: Partial<TerragruntConfigNode> = {}
): TerragruntConfigNode {
  return {
    id: 'config-node-123',
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
      blockCount: 5,
      errorCount: 0,
      dependencyNames: ['vpc', 'rds'],
      includeLabels: ['root', 'common'],
    },
    terraformSource: 'git::https://example.com/modules//vpc',
    hasRemoteState: true,
    remoteStateBackend: 's3',
    includeCount: 2,
    dependencyCount: 2,
    inputCount: 10,
    generateBlocks: Object.freeze(['provider', 'backend']),
    ...overrides,
  };
}

function createMockIncludeNodeRow(
  overrides: Partial<NodeRow> = {}
): NodeRow {
  return {
    id: 'db-id-123',
    scan_id: 'scan-123',
    tenant_id: 'tenant-456',
    original_id: 'include-node-123',
    node_type: 'tg_include',
    name: 'root',
    file_path: 'env/dev/terragrunt.hcl',
    line_start: 5,
    line_end: 10,
    column_start: 1,
    column_end: 50,
    metadata: {
      label: 'root',
      path: 'find_in_parent_folders("root.hcl")',
      resolvedPath: '/repo/root.hcl',
      expose: true,
      mergeStrategy: 'deep',
      scanId: 'scan-123',
      parentConfigId: 'parent-config-456',
    },
    created_at: new Date('2024-01-15T12:00:00Z'),
    ...overrides,
  };
}

function createMockDependencyNodeRow(
  overrides: Partial<NodeRow> = {}
): NodeRow {
  return {
    id: 'db-id-456',
    scan_id: 'scan-123',
    tenant_id: 'tenant-456',
    original_id: 'dep-node-123',
    node_type: 'tg_dependency',
    name: 'vpc',
    file_path: 'env/dev/terragrunt.hcl',
    line_start: 15,
    line_end: 25,
    column_start: 1,
    column_end: 50,
    metadata: {
      dependencyName: 'vpc',
      configPath: '../vpc',
      resolvedPath: '/repo/vpc/terragrunt.hcl',
      skipOutputs: false,
      hasMockOutputs: true,
      scanId: 'scan-123',
      parentConfigId: 'parent-config-456',
    },
    created_at: new Date('2024-01-15T12:00:00Z'),
    ...overrides,
  };
}

// ============================================================================
// terragruntIncludeNodeToInput Tests
// ============================================================================

describe('terragruntIncludeNodeToInput', () => {
  it('should convert TerragruntIncludeNode to CreateNodeInput', () => {
    const node = createMockTerragruntIncludeNode();

    const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.scanId).toBe(SCAN_ID);
    expect(input.tenantId).toBe(TENANT_ID);
    expect(input.originalId).toBe(node.id);
    expect(input.nodeType).toBe('tg_include');
    expect(input.name).toBe(node.name);
  });

  it('should include include-specific properties in metadata', () => {
    const node = createMockTerragruntIncludeNode();

    const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.label).toBe(node.label);
    expect(input.metadata.path).toBe(node.path);
    expect(input.metadata.resolvedPath).toBe(node.resolvedPath);
    expect(input.metadata.expose).toBe(node.expose);
    expect(input.metadata.mergeStrategy).toBe(node.mergeStrategy);
  });

  it('should map file path from location', () => {
    const node = createMockTerragruntIncludeNode({
      location: {
        file: 'custom/path/terragrunt.hcl',
        lineStart: 10,
        lineEnd: 20,
      },
    });

    const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.filePath).toBe('custom/path/terragrunt.hcl');
    expect(input.lineStart).toBe(10);
    expect(input.lineEnd).toBe(20);
  });

  it('should handle null resolvedPath', () => {
    const node = createMockTerragruntIncludeNode({ resolvedPath: null });

    const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.resolvedPath).toBeNull();
  });

  it('should handle all merge strategies', () => {
    const strategies: Array<'no_merge' | 'shallow' | 'deep'> = ['no_merge', 'shallow', 'deep'];

    for (const strategy of strategies) {
      const node = createMockTerragruntIncludeNode({ mergeStrategy: strategy });

      const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

      expect(input.metadata.mergeStrategy).toBe(strategy);
    }
  });

  it('should handle expose true and false', () => {
    const nodeExposed = createMockTerragruntIncludeNode({ expose: true });
    const nodeNotExposed = createMockTerragruntIncludeNode({ expose: false });

    const inputExposed = terragruntIncludeNodeToInput(nodeExposed, SCAN_ID, TENANT_ID);
    const inputNotExposed = terragruntIncludeNodeToInput(nodeNotExposed, SCAN_ID, TENANT_ID);

    expect(inputExposed.metadata.expose).toBe(true);
    expect(inputNotExposed.metadata.expose).toBe(false);
  });

  it('should preserve parent metadata', () => {
    const node = createMockTerragruntIncludeNode({
      metadata: {
        scanId: 'original-scan',
        parentConfigId: 'original-parent',
        customField: 'custom-value',
      },
    });

    const input = terragruntIncludeNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.customField).toBe('custom-value');
  });
});

// ============================================================================
// rowToTerragruntIncludeNode Tests
// ============================================================================

describe('rowToTerragruntIncludeNode', () => {
  it('should convert database row to TerragruntIncludeNode', () => {
    const row = createMockIncludeNodeRow();

    const node = rowToTerragruntIncludeNode(row);

    expect(node.type).toBe('tg_include');
    expect(node.name).toBe('root');
    expect(isTerragruntIncludeNode(node)).toBe(true);
  });

  it('should use original_id as node id when available', () => {
    const row = createMockIncludeNodeRow({ original_id: 'original-include-id' });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.id).toBe('original-include-id');
  });

  it('should fallback to db id when original_id is null', () => {
    const row = createMockIncludeNodeRow({ original_id: null, id: 'fallback-id' });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.id).toBe('fallback-id');
  });

  it('should extract label from metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { label: 'custom-label' },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.label).toBe('custom-label');
  });

  it('should fallback to name when label is missing', () => {
    const row = createMockIncludeNodeRow({
      name: 'fallback-name',
      metadata: {},
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.label).toBe('fallback-name');
  });

  it('should extract path from metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { path: 'find_in_parent_folders("custom.hcl")' },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.path).toBe('find_in_parent_folders("custom.hcl")');
  });

  it('should default to empty string when path is missing', () => {
    const row = createMockIncludeNodeRow({ metadata: {} });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.path).toBe('');
  });

  it('should extract resolvedPath from metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { resolvedPath: '/custom/resolved/path.hcl' },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.resolvedPath).toBe('/custom/resolved/path.hcl');
  });

  it('should handle null resolvedPath in metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { resolvedPath: null },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.resolvedPath).toBeNull();
  });

  it('should extract expose from metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { expose: true },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.expose).toBe(true);
  });

  it('should default expose to false when missing', () => {
    const row = createMockIncludeNodeRow({ metadata: {} });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.expose).toBe(false);
  });

  it('should extract mergeStrategy from metadata', () => {
    const row = createMockIncludeNodeRow({
      metadata: { mergeStrategy: 'deep' },
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.mergeStrategy).toBe('deep');
  });

  it('should default mergeStrategy to no_merge when missing', () => {
    const row = createMockIncludeNodeRow({ metadata: {} });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.mergeStrategy).toBe('no_merge');
  });

  it('should map location correctly', () => {
    const row = createMockIncludeNodeRow({
      file_path: 'test/path.hcl',
      line_start: 100,
      line_end: 200,
      column_start: 5,
      column_end: 45,
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.location.file).toBe('test/path.hcl');
    expect(node.location.lineStart).toBe(100);
    expect(node.location.lineEnd).toBe(200);
    expect(node.location.columnStart).toBe(5);
    expect(node.location.columnEnd).toBe(45);
  });

  it('should omit column properties when null', () => {
    const row = createMockIncludeNodeRow({
      column_start: null,
      column_end: null,
    });

    const node = rowToTerragruntIncludeNode(row);

    expect(node.location.columnStart).toBeUndefined();
    expect(node.location.columnEnd).toBeUndefined();
  });
});

// ============================================================================
// terragruntDependencyNodeToInput Tests
// ============================================================================

describe('terragruntDependencyNodeToInput', () => {
  it('should convert TerragruntDependencyNode to CreateNodeInput', () => {
    const node = createMockTerragruntDependencyNode();

    const input = terragruntDependencyNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.scanId).toBe(SCAN_ID);
    expect(input.tenantId).toBe(TENANT_ID);
    expect(input.originalId).toBe(node.id);
    expect(input.nodeType).toBe('tg_dependency');
    expect(input.name).toBe(node.name);
  });

  it('should include dependency-specific properties in metadata', () => {
    const node = createMockTerragruntDependencyNode();

    const input = terragruntDependencyNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.dependencyName).toBe(node.dependencyName);
    expect(input.metadata.configPath).toBe(node.configPath);
    expect(input.metadata.resolvedPath).toBe(node.resolvedPath);
    expect(input.metadata.skipOutputs).toBe(node.skipOutputs);
    expect(input.metadata.hasMockOutputs).toBe(node.hasMockOutputs);
  });

  it('should map file path from location', () => {
    const node = createMockTerragruntDependencyNode({
      location: {
        file: 'custom/path/terragrunt.hcl',
        lineStart: 30,
        lineEnd: 40,
      },
    });

    const input = terragruntDependencyNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.filePath).toBe('custom/path/terragrunt.hcl');
    expect(input.lineStart).toBe(30);
    expect(input.lineEnd).toBe(40);
  });

  it('should handle null resolvedPath', () => {
    const node = createMockTerragruntDependencyNode({ resolvedPath: null });

    const input = terragruntDependencyNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.resolvedPath).toBeNull();
  });

  it('should handle skipOutputs true and false', () => {
    const nodeSkip = createMockTerragruntDependencyNode({ skipOutputs: true });
    const nodeNoSkip = createMockTerragruntDependencyNode({ skipOutputs: false });

    const inputSkip = terragruntDependencyNodeToInput(nodeSkip, SCAN_ID, TENANT_ID);
    const inputNoSkip = terragruntDependencyNodeToInput(nodeNoSkip, SCAN_ID, TENANT_ID);

    expect(inputSkip.metadata.skipOutputs).toBe(true);
    expect(inputNoSkip.metadata.skipOutputs).toBe(false);
  });

  it('should handle hasMockOutputs true and false', () => {
    const nodeWithMock = createMockTerragruntDependencyNode({ hasMockOutputs: true });
    const nodeNoMock = createMockTerragruntDependencyNode({ hasMockOutputs: false });

    const inputWithMock = terragruntDependencyNodeToInput(nodeWithMock, SCAN_ID, TENANT_ID);
    const inputNoMock = terragruntDependencyNodeToInput(nodeNoMock, SCAN_ID, TENANT_ID);

    expect(inputWithMock.metadata.hasMockOutputs).toBe(true);
    expect(inputNoMock.metadata.hasMockOutputs).toBe(false);
  });

  it('should preserve parent metadata', () => {
    const node = createMockTerragruntDependencyNode({
      metadata: {
        scanId: 'original-scan',
        parentConfigId: 'original-parent',
        customField: 'custom-value',
      },
    });

    const input = terragruntDependencyNodeToInput(node, SCAN_ID, TENANT_ID);

    expect(input.metadata.customField).toBe('custom-value');
  });
});

// ============================================================================
// rowToTerragruntDependencyNode Tests
// ============================================================================

describe('rowToTerragruntDependencyNode', () => {
  it('should convert database row to TerragruntDependencyNode', () => {
    const row = createMockDependencyNodeRow();

    const node = rowToTerragruntDependencyNode(row);

    expect(node.type).toBe('tg_dependency');
    expect(node.name).toBe('vpc');
    expect(isTerragruntDependencyNode(node)).toBe(true);
  });

  it('should use original_id as node id when available', () => {
    const row = createMockDependencyNodeRow({ original_id: 'original-dep-id' });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.id).toBe('original-dep-id');
  });

  it('should fallback to db id when original_id is null', () => {
    const row = createMockDependencyNodeRow({ original_id: null, id: 'fallback-id' });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.id).toBe('fallback-id');
  });

  it('should extract dependencyName from metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { dependencyName: 'custom-dependency' },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.dependencyName).toBe('custom-dependency');
  });

  it('should fallback to name when dependencyName is missing', () => {
    const row = createMockDependencyNodeRow({
      name: 'fallback-name',
      metadata: {},
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.dependencyName).toBe('fallback-name');
  });

  it('should extract configPath from metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { configPath: '../custom-path' },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.configPath).toBe('../custom-path');
  });

  it('should default to empty string when configPath is missing', () => {
    const row = createMockDependencyNodeRow({ metadata: {} });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.configPath).toBe('');
  });

  it('should extract resolvedPath from metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { resolvedPath: '/custom/resolved/path.hcl' },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.resolvedPath).toBe('/custom/resolved/path.hcl');
  });

  it('should handle null resolvedPath in metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { resolvedPath: null },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.resolvedPath).toBeNull();
  });

  it('should extract skipOutputs from metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { skipOutputs: true },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.skipOutputs).toBe(true);
  });

  it('should default skipOutputs to false when missing', () => {
    const row = createMockDependencyNodeRow({ metadata: {} });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.skipOutputs).toBe(false);
  });

  it('should extract hasMockOutputs from metadata', () => {
    const row = createMockDependencyNodeRow({
      metadata: { hasMockOutputs: true },
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.hasMockOutputs).toBe(true);
  });

  it('should default hasMockOutputs to false when missing', () => {
    const row = createMockDependencyNodeRow({ metadata: {} });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.hasMockOutputs).toBe(false);
  });

  it('should map location correctly', () => {
    const row = createMockDependencyNodeRow({
      file_path: 'test/path.hcl',
      line_start: 100,
      line_end: 200,
      column_start: 5,
      column_end: 45,
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.location.file).toBe('test/path.hcl');
    expect(node.location.lineStart).toBe(100);
    expect(node.location.lineEnd).toBe(200);
    expect(node.location.columnStart).toBe(5);
    expect(node.location.columnEnd).toBe(45);
  });

  it('should omit column properties when null', () => {
    const row = createMockDependencyNodeRow({
      column_start: null,
      column_end: null,
    });

    const node = rowToTerragruntDependencyNode(row);

    expect(node.location.columnStart).toBeUndefined();
    expect(node.location.columnEnd).toBeUndefined();
  });
});

// ============================================================================
// Round-Trip Conversion Tests
// ============================================================================

describe('Round-Trip Conversion', () => {
  describe('TerragruntIncludeNode round-trip', () => {
    it('should preserve all properties through node -> input -> row -> node', () => {
      const originalNode = createMockTerragruntIncludeNode();

      // Node to Input
      const input = terragruntIncludeNodeToInput(originalNode, SCAN_ID, TENANT_ID);

      // Simulate row (as would be returned from DB)
      const row: NodeRow = {
        id: 'db-generated-id',
        scan_id: input.scanId as string,
        tenant_id: input.tenantId as string,
        original_id: input.originalId as string,
        node_type: input.nodeType,
        name: input.name,
        file_path: input.filePath,
        line_start: input.lineStart,
        line_end: input.lineEnd,
        column_start: (input as any).columnStart ?? null,
        column_end: (input as any).columnEnd ?? null,
        metadata: input.metadata,
        created_at: new Date(),
      };

      // Row back to Node
      const recoveredNode = rowToTerragruntIncludeNode(row);

      // Verify key properties are preserved
      expect(recoveredNode.type).toBe(originalNode.type);
      expect(recoveredNode.id).toBe(originalNode.id);
      expect(recoveredNode.name).toBe(originalNode.name);
      expect(recoveredNode.label).toBe(originalNode.label);
      expect(recoveredNode.path).toBe(originalNode.path);
      expect(recoveredNode.resolvedPath).toBe(originalNode.resolvedPath);
      expect(recoveredNode.expose).toBe(originalNode.expose);
      expect(recoveredNode.mergeStrategy).toBe(originalNode.mergeStrategy);
    });
  });

  describe('TerragruntDependencyNode round-trip', () => {
    it('should preserve all properties through node -> input -> row -> node', () => {
      const originalNode = createMockTerragruntDependencyNode();

      // Node to Input
      const input = terragruntDependencyNodeToInput(originalNode, SCAN_ID, TENANT_ID);

      // Simulate row (as would be returned from DB)
      const row: NodeRow = {
        id: 'db-generated-id',
        scan_id: input.scanId as string,
        tenant_id: input.tenantId as string,
        original_id: input.originalId as string,
        node_type: input.nodeType,
        name: input.name,
        file_path: input.filePath,
        line_start: input.lineStart,
        line_end: input.lineEnd,
        column_start: (input as any).columnStart ?? null,
        column_end: (input as any).columnEnd ?? null,
        metadata: input.metadata,
        created_at: new Date(),
      };

      // Row back to Node
      const recoveredNode = rowToTerragruntDependencyNode(row);

      // Verify key properties are preserved
      expect(recoveredNode.type).toBe(originalNode.type);
      expect(recoveredNode.id).toBe(originalNode.id);
      expect(recoveredNode.name).toBe(originalNode.name);
      expect(recoveredNode.dependencyName).toBe(originalNode.dependencyName);
      expect(recoveredNode.configPath).toBe(originalNode.configPath);
      expect(recoveredNode.resolvedPath).toBe(originalNode.resolvedPath);
      expect(recoveredNode.skipOutputs).toBe(originalNode.skipOutputs);
      expect(recoveredNode.hasMockOutputs).toBe(originalNode.hasMockOutputs);
    });
  });
});

// ============================================================================
// prepareTerragruntNodesForInsert Tests
// ============================================================================

describe('prepareTerragruntNodesForInsert', () => {
  it('should convert all node types to CreateNodeInput', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [createMockTerragruntConfigNode()],
      includeNodes: [createMockTerragruntIncludeNode()],
      dependencyNodes: [createMockTerragruntDependencyNode()],
    };

    const nodeInputs = prepareTerragruntNodesForInsert(input, SCAN_ID, TENANT_ID);

    expect(nodeInputs).toHaveLength(3);
    expect(nodeInputs[0].nodeType).toBe('tg_config');
    expect(nodeInputs[1].nodeType).toBe('tg_include');
    expect(nodeInputs[2].nodeType).toBe('tg_dependency');
  });

  it('should handle empty input arrays', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
    };

    const nodeInputs = prepareTerragruntNodesForInsert(input, SCAN_ID, TENANT_ID);

    expect(nodeInputs).toHaveLength(0);
  });

  it('should handle multiple nodes of each type', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [
        createMockTerragruntConfigNode({ id: 'config-1' }),
        createMockTerragruntConfigNode({ id: 'config-2' }),
      ],
      includeNodes: [
        createMockTerragruntIncludeNode({ id: 'include-1' }),
        createMockTerragruntIncludeNode({ id: 'include-2' }),
        createMockTerragruntIncludeNode({ id: 'include-3' }),
      ],
      dependencyNodes: [
        createMockTerragruntDependencyNode({ id: 'dep-1' }),
      ],
    };

    const nodeInputs = prepareTerragruntNodesForInsert(input, SCAN_ID, TENANT_ID);

    expect(nodeInputs).toHaveLength(6);
    expect(nodeInputs.filter(n => n.nodeType === 'tg_config')).toHaveLength(2);
    expect(nodeInputs.filter(n => n.nodeType === 'tg_include')).toHaveLength(3);
    expect(nodeInputs.filter(n => n.nodeType === 'tg_dependency')).toHaveLength(1);
  });

  it('should apply same scanId and tenantId to all nodes', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [createMockTerragruntConfigNode()],
      includeNodes: [createMockTerragruntIncludeNode()],
      dependencyNodes: [createMockTerragruntDependencyNode()],
    };

    const nodeInputs = prepareTerragruntNodesForInsert(input, SCAN_ID, TENANT_ID);

    expect(nodeInputs.every(n => n.scanId === SCAN_ID)).toBe(true);
    expect(nodeInputs.every(n => n.tenantId === TENANT_ID)).toBe(true);
  });
});

// ============================================================================
// prepareTerragruntEdgesForInsert Tests
// ============================================================================

describe('prepareTerragruntEdgesForInsert', () => {
  const nodeIdMapping = new Map<string, DbNodeId>([
    ['source-node', 'db-source-id' as DbNodeId],
    ['target-node', 'db-target-id' as DbNodeId],
  ]);

  it('should create edges from dependency hints', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      dependencyHints: [
        {
          sourceId: 'source-node',
          targetId: 'target-node',
          dependencyName: 'vpc',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges).toHaveLength(1);
    expect(edges[0].edgeType).toBe('tg_depends_on');
    expect(edges[0].sourceNodeId).toBe('db-source-id');
    expect(edges[0].targetNodeId).toBe('db-target-id');
  });

  it('should create edges from include hints', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [
        {
          sourceId: 'source-node',
          targetId: 'target-node',
          includeLabel: 'root',
          mergeStrategy: 'deep',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges).toHaveLength(1);
    expect(edges[0].edgeType).toBe('tg_includes');
  });

  it('should skip hints with null targetId', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      dependencyHints: [
        {
          sourceId: 'source-node',
          targetId: null,
          dependencyName: 'external',
        },
      ],
      includeHints: [
        {
          sourceId: 'source-node',
          targetId: null,
          includeLabel: 'missing',
          mergeStrategy: 'deep',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges).toHaveLength(0);
  });

  it('should skip hints when node IDs not in mapping', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      dependencyHints: [
        {
          sourceId: 'unknown-source',
          targetId: 'unknown-target',
          dependencyName: 'vpc',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges).toHaveLength(0);
  });

  it('should include dependency name in edge metadata', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      dependencyHints: [
        {
          sourceId: 'source-node',
          targetId: 'target-node',
          dependencyName: 'my-vpc',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges[0].metadata.dependencyName).toBe('my-vpc');
    expect(edges[0].metadata.edgeSource).toBe('terragrunt_dependency_block');
  });

  it('should include merge strategy in include edge metadata', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
      includeHints: [
        {
          sourceId: 'source-node',
          targetId: 'target-node',
          includeLabel: 'root',
          mergeStrategy: 'shallow',
        },
      ],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges[0].metadata.includeLabel).toBe('root');
    expect(edges[0].metadata.mergeStrategy).toBe('shallow');
    expect(edges[0].metadata.edgeSource).toBe('terragrunt_include_block');
  });

  it('should handle empty hints', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
    };

    const edges = prepareTerragruntEdgesForInsert(input, SCAN_ID, TENANT_ID, nodeIdMapping);

    expect(edges).toHaveLength(0);
  });
});

// ============================================================================
// calculateNodeCounts Tests
// ============================================================================

describe('calculateNodeCounts', () => {
  it('should calculate correct counts for all node types', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [
        createMockTerragruntConfigNode({ id: '1' }),
        createMockTerragruntConfigNode({ id: '2' }),
      ],
      includeNodes: [
        createMockTerragruntIncludeNode({ id: '1' }),
        createMockTerragruntIncludeNode({ id: '2' }),
        createMockTerragruntIncludeNode({ id: '3' }),
      ],
      dependencyNodes: [
        createMockTerragruntDependencyNode({ id: '1' }),
      ],
    };

    const counts = calculateNodeCounts(input);

    expect(counts.config).toBe(2);
    expect(counts.include).toBe(3);
    expect(counts.dependency).toBe(1);
    expect(counts.total).toBe(6);
  });

  it('should handle empty arrays', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [],
      includeNodes: [],
      dependencyNodes: [],
    };

    const counts = calculateNodeCounts(input);

    expect(counts.config).toBe(0);
    expect(counts.include).toBe(0);
    expect(counts.dependency).toBe(0);
    expect(counts.total).toBe(0);
  });

  it('should handle only config nodes', () => {
    const input: BatchTerragruntPersistInput = {
      configNodes: [createMockTerragruntConfigNode()],
      includeNodes: [],
      dependencyNodes: [],
    };

    const counts = calculateNodeCounts(input);

    expect(counts.config).toBe(1);
    expect(counts.include).toBe(0);
    expect(counts.dependency).toBe(0);
    expect(counts.total).toBe(1);
  });
});
