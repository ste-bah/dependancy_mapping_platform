/**
 * NodeMatcher Unit Tests
 * @module diff/__tests__/node-matcher.test
 *
 * TASK-ROLLUP-005: Diff Computation - Unit Tests for Node Matching
 *
 * Tests the NodeMatcher component for:
 * - Node indexing by stable identity key
 * - Identity extraction and key generation
 * - Finding added/removed/modified nodes
 * - Edge cases (empty graphs, single nodes, identical graphs)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createNodeMatcher,
  nodeKey,
  parseNodeKey,
  sameIdentity,
  groupNodesByType,
  groupNodesByFile,
  NodeMatcher,
  TRANSIENT_FIELDS,
  IDENTITY_FIELDS,
  COMPARABLE_FIELDS,
  type INodeMatcher,
} from '../node-matcher.js';
import type { NodeType, TerraformResourceNode, K8sDeploymentNode, TerraformVariableNode } from '../../types/graph.js';
import type { NodeIdentity, NodeModification, FieldChange } from '../types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Create a mock Terraform resource node for testing
 */
function createTerraformResourceNode(overrides: Partial<TerraformResourceNode> = {}): TerraformResourceNode {
  return {
    id: overrides.id ?? 'node-1',
    type: 'terraform_resource',
    name: overrides.name ?? 'my-bucket',
    location: overrides.location ?? {
      file: 'main.tf',
      lineStart: 1,
      lineEnd: 10,
      columnStart: 1,
      columnEnd: 1,
    },
    metadata: overrides.metadata ?? {},
    resourceType: overrides.resourceType ?? 'aws_s3_bucket',
    provider: overrides.provider ?? 'aws',
    dependsOn: overrides.dependsOn ?? [],
    ...(overrides.providerAlias !== undefined && { providerAlias: overrides.providerAlias }),
    ...(overrides.count !== undefined && { count: overrides.count }),
    ...(overrides.forEach !== undefined && { forEach: overrides.forEach }),
  };
}

/**
 * Create a mock K8s deployment node for testing
 */
function createK8sDeploymentNode(overrides: Partial<K8sDeploymentNode> = {}): K8sDeploymentNode {
  return {
    id: overrides.id ?? 'k8s-node-1',
    type: 'k8s_deployment',
    name: overrides.name ?? 'my-deployment',
    location: overrides.location ?? {
      file: 'deployment.yaml',
      lineStart: 1,
      lineEnd: 50,
    },
    metadata: overrides.metadata ?? {},
    namespace: overrides.namespace ?? 'default',
    replicas: overrides.replicas ?? 3,
    selector: overrides.selector ?? { app: 'my-app' },
    containers: overrides.containers ?? [
      { name: 'main', image: 'nginx:latest' },
    ],
  };
}

/**
 * Create a mock Terraform variable node for testing
 */
function createTerraformVariableNode(overrides: Partial<TerraformVariableNode> = {}): TerraformVariableNode {
  return {
    id: overrides.id ?? 'var-node-1',
    type: 'terraform_variable',
    name: overrides.name ?? 'instance_type',
    location: overrides.location ?? {
      file: 'variables.tf',
      lineStart: 1,
      lineEnd: 5,
    },
    metadata: overrides.metadata ?? {},
    variableType: overrides.variableType ?? 'string',
    default: overrides.default ?? 't3.micro',
    description: overrides.description ?? 'EC2 instance type',
    sensitive: overrides.sensitive ?? false,
    nullable: overrides.nullable ?? false,
  };
}

// ============================================================================
// Test Suite: Constants
// ============================================================================

describe('NodeMatcher Constants', () => {
  describe('TRANSIENT_FIELDS', () => {
    it('should include id field', () => {
      expect(TRANSIENT_FIELDS).toContain('id');
    });

    it('should include timestamp fields', () => {
      expect(TRANSIENT_FIELDS).toContain('createdAt');
      expect(TRANSIENT_FIELDS).toContain('updatedAt');
    });

    it('should include scanId field', () => {
      expect(TRANSIENT_FIELDS).toContain('scanId');
    });

    it('should be readonly array (as const assertion)', () => {
      // TypeScript 'as const' creates readonly type but doesn't freeze at runtime
      // Verify it's still an array that behaves as expected
      expect(Array.isArray(TRANSIENT_FIELDS)).toBe(true);
      expect(TRANSIENT_FIELDS.length).toBeGreaterThan(0);
    });
  });

  describe('IDENTITY_FIELDS', () => {
    it('should include type, name, and location.file', () => {
      expect(IDENTITY_FIELDS).toContain('type');
      expect(IDENTITY_FIELDS).toContain('name');
      expect(IDENTITY_FIELDS).toContain('location.file');
    });
  });

  describe('COMPARABLE_FIELDS', () => {
    it('should include location fields', () => {
      expect(COMPARABLE_FIELDS).toContain('location.lineStart');
      expect(COMPARABLE_FIELDS).toContain('location.lineEnd');
    });

    it('should include metadata', () => {
      expect(COMPARABLE_FIELDS).toContain('metadata');
    });
  });
});

// ============================================================================
// Test Suite: Factory Function
// ============================================================================

describe('createNodeMatcher', () => {
  it('should create a NodeMatcher instance', () => {
    const matcher = createNodeMatcher();
    expect(matcher).toBeDefined();
    expect(typeof matcher.indexNodes).toBe('function');
    expect(typeof matcher.extractIdentity).toBe('function');
    expect(typeof matcher.identityKey).toBe('function');
    expect(typeof matcher.findAdded).toBe('function');
    expect(typeof matcher.findRemoved).toBe('function');
    expect(typeof matcher.findModified).toBe('function');
    expect(typeof matcher.compareNodes).toBe('function');
    expect(typeof matcher.getFieldChanges).toBe('function');
  });

  it('should accept custom ignore fields', () => {
    const matcher = createNodeMatcher({
      ignoreFields: ['customField', 'anotherField'],
    });
    expect(matcher).toBeDefined();
  });

  it('should create matcher without options', () => {
    const matcher = createNodeMatcher();
    expect(matcher).toBeDefined();
  });
});

// ============================================================================
// Test Suite: Node Indexing
// ============================================================================

describe('NodeMatcher.indexNodes', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('indexing nodes by stable identity key', () => {
    it('should index nodes by type:name:filePath key', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];

      const index = matcher.indexNodes(nodes);

      expect(index.size).toBe(2);
      expect(index.has('terraform_resource:bucket-1:main.tf')).toBe(true);
      expect(index.has('terraform_resource:bucket-2:main.tf')).toBe(true);
    });

    it('should index different node types correctly', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ name: 'my-resource' }),
        createK8sDeploymentNode({ name: 'my-deployment' }),
        createTerraformVariableNode({ name: 'my-var' }),
      ];

      const index = matcher.indexNodes(nodes);

      expect(index.size).toBe(3);
      expect(index.has('terraform_resource:my-resource:main.tf')).toBe(true);
      expect(index.has('k8s_deployment:my-deployment:deployment.yaml')).toBe(true);
      expect(index.has('terraform_variable:my-var:variables.tf')).toBe(true);
    });

    it('should preserve node data in index', () => {
      const node = createTerraformResourceNode({
        name: 'test-bucket',
        resourceType: 'aws_s3_bucket',
        provider: 'aws',
      });

      const index = matcher.indexNodes([node]);
      const indexed = index.get('terraform_resource:test-bucket:main.tf');

      expect(indexed).toBeDefined();
      expect(indexed?.name).toBe('test-bucket');
      expect((indexed as TerraformResourceNode).resourceType).toBe('aws_s3_bucket');
      expect((indexed as TerraformResourceNode).provider).toBe('aws');
    });
  });

  describe('handling duplicate node keys', () => {
    it('should keep last node when duplicates exist (last wins)', () => {
      const node1 = createTerraformResourceNode({
        id: 'node-1',
        name: 'duplicate-bucket',
        resourceType: 'aws_s3_bucket',
      });
      const node2 = createTerraformResourceNode({
        id: 'node-2',
        name: 'duplicate-bucket',
        resourceType: 'google_storage_bucket',
      });

      const index = matcher.indexNodes([node1, node2]);

      expect(index.size).toBe(1);
      const indexed = index.get('terraform_resource:duplicate-bucket:main.tf') as TerraformResourceNode;
      expect(indexed.id).toBe('node-2');
      expect(indexed.resourceType).toBe('google_storage_bucket');
    });

    it('should handle multiple duplicates', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ id: 'node-1', name: 'bucket' }),
        createTerraformResourceNode({ id: 'node-2', name: 'bucket' }),
        createTerraformResourceNode({ id: 'node-3', name: 'bucket' }),
      ];

      const index = matcher.indexNodes(nodes);

      expect(index.size).toBe(1);
      expect(index.get('terraform_resource:bucket:main.tf')?.id).toBe('node-3');
    });
  });

  describe('handling empty node array', () => {
    it('should return empty map for empty array', () => {
      const index = matcher.indexNodes([]);

      expect(index.size).toBe(0);
      expect(index instanceof Map).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: Identity Extraction
// ============================================================================

describe('NodeMatcher.extractIdentity', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('extracting identity components', () => {
    it('should extract type, name, and filePath from Terraform node', () => {
      const node = createTerraformResourceNode({
        name: 'my-bucket',
        location: { file: 'infra/main.tf', lineStart: 1, lineEnd: 10 },
      });

      const identity = matcher.extractIdentity(node);

      expect(identity.type).toBe('terraform_resource');
      expect(identity.name).toBe('my-bucket');
      expect(identity.filePath).toBe('infra/main.tf');
    });

    it('should extract identity from K8s node', () => {
      const node = createK8sDeploymentNode({
        name: 'api-server',
        location: { file: 'k8s/deployment.yaml', lineStart: 1, lineEnd: 50 },
      });

      const identity = matcher.extractIdentity(node);

      expect(identity.type).toBe('k8s_deployment');
      expect(identity.name).toBe('api-server');
      expect(identity.filePath).toBe('k8s/deployment.yaml');
    });

    it('should handle complex file paths', () => {
      const node = createTerraformResourceNode({
        location: {
          file: 'modules/networking/vpc/main.tf',
          lineStart: 1,
          lineEnd: 10,
        },
      });

      const identity = matcher.extractIdentity(node);

      expect(identity.filePath).toBe('modules/networking/vpc/main.tf');
    });
  });

  describe('generating consistent identity keys', () => {
    it('should generate same key for same identity', () => {
      const identity1 = matcher.extractIdentity(
        createTerraformResourceNode({ name: 'bucket', location: { file: 'main.tf', lineStart: 1, lineEnd: 10 } })
      );
      const identity2 = matcher.extractIdentity(
        createTerraformResourceNode({ name: 'bucket', location: { file: 'main.tf', lineStart: 100, lineEnd: 150 } })
      );

      expect(matcher.identityKey(identity1)).toBe(matcher.identityKey(identity2));
    });

    it('should generate different keys for different names', () => {
      const identity1 = matcher.extractIdentity(createTerraformResourceNode({ name: 'bucket-1' }));
      const identity2 = matcher.extractIdentity(createTerraformResourceNode({ name: 'bucket-2' }));

      expect(matcher.identityKey(identity1)).not.toBe(matcher.identityKey(identity2));
    });

    it('should generate different keys for different files', () => {
      const identity1 = matcher.extractIdentity(
        createTerraformResourceNode({ location: { file: 'main.tf', lineStart: 1, lineEnd: 10 } })
      );
      const identity2 = matcher.extractIdentity(
        createTerraformResourceNode({ location: { file: 'other.tf', lineStart: 1, lineEnd: 10 } })
      );

      expect(matcher.identityKey(identity1)).not.toBe(matcher.identityKey(identity2));
    });

    it('should generate different keys for different types', () => {
      const tfIdentity = matcher.extractIdentity(
        createTerraformResourceNode({ name: 'my-resource', location: { file: 'main.tf', lineStart: 1, lineEnd: 10 } })
      );
      const varIdentity = matcher.extractIdentity(
        createTerraformVariableNode({ name: 'my-resource', location: { file: 'main.tf', lineStart: 1, lineEnd: 5 } })
      );

      expect(matcher.identityKey(tfIdentity)).not.toBe(matcher.identityKey(varIdentity));
    });
  });
});

// ============================================================================
// Test Suite: identityKey
// ============================================================================

describe('NodeMatcher.identityKey', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  it('should create key in format type:name:filePath', () => {
    const identity: NodeIdentity = {
      type: 'terraform_resource',
      name: 'my-bucket',
      filePath: 'main.tf',
    };

    const key = matcher.identityKey(identity);

    expect(key).toBe('terraform_resource:my-bucket:main.tf');
  });

  it('should handle filePaths with colons', () => {
    const identity: NodeIdentity = {
      type: 'terraform_resource',
      name: 'my-bucket',
      filePath: 'C:/Users/dev/main.tf',
    };

    const key = matcher.identityKey(identity);

    expect(key).toBe('terraform_resource:my-bucket:C:/Users/dev/main.tf');
  });

  it('should handle special characters in name', () => {
    const identity: NodeIdentity = {
      type: 'terraform_resource',
      name: 'my-bucket_v2.prod',
      filePath: 'main.tf',
    };

    const key = matcher.identityKey(identity);

    expect(key).toBe('terraform_resource:my-bucket_v2.prod:main.tf');
  });
});

// ============================================================================
// Test Suite: nodeKey Utility
// ============================================================================

describe('nodeKey utility function', () => {
  it('should compute key directly from node', () => {
    const node = createTerraformResourceNode({
      name: 'test-bucket',
      location: { file: 'infra/main.tf', lineStart: 1, lineEnd: 10 },
    });

    const key = nodeKey(node);

    expect(key).toBe('terraform_resource:test-bucket:infra/main.tf');
  });

  it('should produce same key as matcher methods', () => {
    const matcher = createNodeMatcher();
    const node = createTerraformResourceNode({ name: 'bucket' });

    const directKey = nodeKey(node);
    const matcherKey = matcher.identityKey(matcher.extractIdentity(node));

    expect(directKey).toBe(matcherKey);
  });
});

// ============================================================================
// Test Suite: parseNodeKey Utility
// ============================================================================

describe('parseNodeKey utility function', () => {
  it('should parse valid key into components', () => {
    const key = 'terraform_resource:my-bucket:main.tf';

    const identity = parseNodeKey(key);

    expect(identity).not.toBeNull();
    expect(identity?.type).toBe('terraform_resource');
    expect(identity?.name).toBe('my-bucket');
    expect(identity?.filePath).toBe('main.tf');
  });

  it('should handle filePath with colons', () => {
    const key = 'terraform_resource:my-bucket:C:/Users/dev/main.tf';

    const identity = parseNodeKey(key);

    expect(identity).not.toBeNull();
    expect(identity?.type).toBe('terraform_resource');
    expect(identity?.name).toBe('my-bucket');
    expect(identity?.filePath).toBe('C:/Users/dev/main.tf');
  });

  it('should return null for invalid key with fewer than 3 parts', () => {
    expect(parseNodeKey('terraform_resource:my-bucket')).toBeNull();
    expect(parseNodeKey('terraform_resource')).toBeNull();
    expect(parseNodeKey('')).toBeNull();
  });

  it('should return null for key with empty parts', () => {
    expect(parseNodeKey('::main.tf')).toBeNull();
    expect(parseNodeKey('terraform_resource::main.tf')).toBeNull();
    expect(parseNodeKey('terraform_resource:my-bucket:')).toBeNull();
  });

  it('should roundtrip with nodeKey', () => {
    const node = createTerraformResourceNode({
      name: 'test',
      location: { file: 'test.tf', lineStart: 1, lineEnd: 10 },
    });

    const key = nodeKey(node);
    const parsed = parseNodeKey(key);

    expect(parsed?.type).toBe(node.type);
    expect(parsed?.name).toBe(node.name);
    expect(parsed?.filePath).toBe(node.location.file);
  });
});

// ============================================================================
// Test Suite: Find Added Nodes
// ============================================================================

describe('NodeMatcher.findAdded', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('finding nodes in compare but not in base', () => {
    it('should find single added node', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const added = matcher.findAdded(baseIndex, compareIndex);

      expect(added).toHaveLength(1);
      expect(added[0].name).toBe('bucket-2');
    });

    it('should find multiple added nodes', () => {
      const baseNodes: NodeType[] = [];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
        createK8sDeploymentNode({ name: 'deployment-1' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const added = matcher.findAdded(baseIndex, compareIndex);

      expect(added).toHaveLength(3);
      const names = added.map(n => n.name).sort();
      expect(names).toEqual(['bucket-1', 'bucket-2', 'deployment-1']);
    });

    it('should identify added nodes by identity, not by id', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ id: 'id-1', name: 'bucket' }),
      ];
      // Same name, different id - should NOT be added
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ id: 'id-2', name: 'bucket' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const added = matcher.findAdded(baseIndex, compareIndex);

      expect(added).toHaveLength(0);
    });
  });

  describe('returning empty array when no additions', () => {
    it('should return empty array when graphs are identical', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];

      const baseIndex = matcher.indexNodes(nodes);
      const compareIndex = matcher.indexNodes(nodes);

      const added = matcher.findAdded(baseIndex, compareIndex);

      expect(added).toHaveLength(0);
    });

    it('should return empty array when compare has fewer nodes', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const added = matcher.findAdded(baseIndex, compareIndex);

      expect(added).toHaveLength(0);
    });
  });

  describe('handling large node sets efficiently', () => {
    it('should handle 1000 nodes efficiently', () => {
      const baseNodes: NodeType[] = Array.from({ length: 500 }, (_, i) =>
        createTerraformResourceNode({ id: `node-${i}`, name: `bucket-${i}` })
      );
      const compareNodes: NodeType[] = [
        ...Array.from({ length: 500 }, (_, i) =>
          createTerraformResourceNode({ id: `node-${i}`, name: `bucket-${i}` })
        ),
        ...Array.from({ length: 500 }, (_, i) =>
          createTerraformResourceNode({ id: `new-node-${i}`, name: `new-bucket-${i}` })
        ),
      ];

      const startTime = performance.now();

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);
      const added = matcher.findAdded(baseIndex, compareIndex);

      const duration = performance.now() - startTime;

      expect(added).toHaveLength(500);
      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });
  });
});

// ============================================================================
// Test Suite: Find Removed Nodes
// ============================================================================

describe('NodeMatcher.findRemoved', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('finding nodes in base but not in compare', () => {
    it('should find single removed node', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(1);
      expect(removed[0].name).toBe('bucket-2');
    });

    it('should find multiple removed nodes', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
        createK8sDeploymentNode({ name: 'deployment-1' }),
      ];
      const compareNodes: NodeType[] = [];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(3);
    });

    it('should identify removed nodes by identity', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket', location: { file: 'main.tf', lineStart: 1, lineEnd: 10 } }),
      ];
      // Same name, different file - should be removed (identity differs)
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket', location: { file: 'other.tf', lineStart: 1, lineEnd: 10 } }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(1);
      expect(removed[0].location.file).toBe('main.tf');
    });
  });

  describe('returning empty array when no removals', () => {
    it('should return empty array when compare has same nodes', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];

      const baseIndex = matcher.indexNodes(nodes);
      const compareIndex = matcher.indexNodes(nodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(0);
    });

    it('should return empty array when compare has more nodes', () => {
      const baseNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(0);
    });

    it('should return empty array for empty base', () => {
      const baseNodes: NodeType[] = [];
      const compareNodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      const removed = matcher.findRemoved(baseIndex, compareIndex);

      expect(removed).toHaveLength(0);
    });
  });
});

// ============================================================================
// Test Suite: Find Modified Nodes
// ============================================================================

describe('NodeMatcher.findModified', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('detecting field-level changes', () => {
    it('should detect resourceType change', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'aws_s3_bucket',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'google_storage_bucket',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('resourceType');
    });

    it('should detect provider change', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        provider: 'aws',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        provider: 'google',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('provider');
    });

    it('should detect metadata changes', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        metadata: { tags: ['prod'] },
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        metadata: { tags: ['dev', 'test'] },
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('metadata');
    });

    it('should detect multiple field changes', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'aws_s3_bucket',
        provider: 'aws',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'google_storage_bucket',
        provider: 'google',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('resourceType');
      expect(modified[0].changedFields).toContain('provider');
    });
  });

  describe('ignoring transient fields', () => {
    it('should ignore id field changes', () => {
      const baseNode = createTerraformResourceNode({
        id: 'old-id',
        name: 'bucket',
      });
      const compareNode = createTerraformResourceNode({
        id: 'new-id',
        name: 'bucket',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(0);
    });

    it('should ignore scanId field changes', () => {
      const baseNode = createTerraformResourceNode({ name: 'bucket' });
      const compareNode = createTerraformResourceNode({ name: 'bucket' });

      // Add scanId to both (simulating real scan data)
      (baseNode as Record<string, unknown>).scanId = 'scan-1';
      (compareNode as Record<string, unknown>).scanId = 'scan-2';

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(0);
    });

    it('should ignore timestamp field changes', () => {
      const baseNode = createTerraformResourceNode({ name: 'bucket' });
      const compareNode = createTerraformResourceNode({ name: 'bucket' });

      // Add timestamps
      (baseNode as Record<string, unknown>).createdAt = new Date('2024-01-01');
      (baseNode as Record<string, unknown>).updatedAt = new Date('2024-01-01');
      (compareNode as Record<string, unknown>).createdAt = new Date('2024-02-01');
      (compareNode as Record<string, unknown>).updatedAt = new Date('2024-02-01');

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(0);
    });
  });

  describe('tracking changed field names', () => {
    it('should include before and after states', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'aws_s3_bucket',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'google_storage_bucket',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified[0].before).toBeDefined();
      expect(modified[0].after).toBeDefined();
    });

    it('should include nodeId in modification', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'aws_s3_bucket',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'google_storage_bucket',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified[0].nodeId).toBe('terraform_resource:bucket:main.tf');
    });

    it('should include fieldChanges with details', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'aws_s3_bucket',
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        resourceType: 'google_storage_bucket',
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified[0].fieldChanges).toBeDefined();
      expect(modified[0].fieldChanges?.length).toBeGreaterThan(0);

      const resourceTypeChange = modified[0].fieldChanges?.find(fc => fc.field === 'resourceType');
      expect(resourceTypeChange).toBeDefined();
      expect(resourceTypeChange?.oldValue).toBe('aws_s3_bucket');
      expect(resourceTypeChange?.newValue).toBe('google_storage_bucket');
      expect(resourceTypeChange?.changeType).toBe('value_changed');
    });
  });

  describe('handling line number changes', () => {
    it('should detect lineStart changes', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        location: { file: 'main.tf', lineStart: 20, lineEnd: 30 },
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('location.lineStart');
      expect(modified[0].changedFields).toContain('location.lineEnd');
    });

    it('should detect column changes', () => {
      const baseNode = createTerraformResourceNode({
        name: 'bucket',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10, columnStart: 1, columnEnd: 50 },
      });
      const compareNode = createTerraformResourceNode({
        name: 'bucket',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10, columnStart: 5, columnEnd: 60 },
      });

      const baseIndex = matcher.indexNodes([baseNode]);
      const compareIndex = matcher.indexNodes([compareNode]);

      const modified = matcher.findModified(baseIndex, compareIndex);

      expect(modified).toHaveLength(1);
      expect(modified[0].changedFields).toContain('location.columnStart');
      expect(modified[0].changedFields).toContain('location.columnEnd');
    });
  });
});

// ============================================================================
// Test Suite: compareNodes
// ============================================================================

describe('NodeMatcher.compareNodes', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  it('should return empty array for identical nodes', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket' });
    const node2 = createTerraformResourceNode({ name: 'bucket' });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).toHaveLength(0);
  });

  it('should detect primitive field changes', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket', provider: 'aws' });
    const node2 = createTerraformResourceNode({ name: 'bucket', provider: 'google' });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).toContain('provider');
  });

  it('should detect array field changes', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket', dependsOn: ['a', 'b'] });
    const node2 = createTerraformResourceNode({ name: 'bucket', dependsOn: ['a', 'b', 'c'] });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).toContain('dependsOn');
  });

  it('should detect object field changes', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket', metadata: { env: 'prod' } });
    const node2 = createTerraformResourceNode({ name: 'bucket', metadata: { env: 'dev' } });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).toContain('metadata');
  });

  it('should ignore transient fields', () => {
    const node1 = createTerraformResourceNode({ id: 'id-1', name: 'bucket' });
    const node2 = createTerraformResourceNode({ id: 'id-2', name: 'bucket' });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).not.toContain('id');
    expect(changedFields).toHaveLength(0);
  });
});

// ============================================================================
// Test Suite: getFieldChanges
// ============================================================================

describe('NodeMatcher.getFieldChanges', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  it('should return empty array for identical nodes', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket' });
    const node2 = createTerraformResourceNode({ name: 'bucket' });

    const changes = matcher.getFieldChanges(node1, node2);

    expect(changes).toHaveLength(0);
  });

  it('should return detailed changes for value_changed', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket', provider: 'aws' });
    const node2 = createTerraformResourceNode({ name: 'bucket', provider: 'google' });

    const changes = matcher.getFieldChanges(node1, node2);

    const providerChange = changes.find(c => c.field === 'provider');
    expect(providerChange).toBeDefined();
    expect(providerChange?.oldValue).toBe('aws');
    expect(providerChange?.newValue).toBe('google');
    expect(providerChange?.changeType).toBe('value_changed');
  });

  it('should detect added fields', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket' });
    const node2 = createTerraformResourceNode({ name: 'bucket', providerAlias: 'west' });

    const changes = matcher.getFieldChanges(node1, node2);

    const aliasChange = changes.find(c => c.field === 'providerAlias');
    expect(aliasChange).toBeDefined();
    expect(aliasChange?.oldValue).toBeUndefined();
    expect(aliasChange?.newValue).toBe('west');
    expect(aliasChange?.changeType).toBe('added');
  });

  it('should detect removed fields', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket', providerAlias: 'west' });
    const node2 = createTerraformResourceNode({ name: 'bucket' });

    const changes = matcher.getFieldChanges(node1, node2);

    const aliasChange = changes.find(c => c.field === 'providerAlias');
    expect(aliasChange).toBeDefined();
    expect(aliasChange?.oldValue).toBe('west');
    expect(aliasChange?.newValue).toBeUndefined();
    expect(aliasChange?.changeType).toBe('removed');
  });

  it('should handle nested location changes', () => {
    const node1 = createTerraformResourceNode({
      name: 'bucket',
      location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
    });
    const node2 = createTerraformResourceNode({
      name: 'bucket',
      location: { file: 'main.tf', lineStart: 50, lineEnd: 60 },
    });

    const changes = matcher.getFieldChanges(node1, node2);

    const lineStartChange = changes.find(c => c.field === 'location.lineStart');
    expect(lineStartChange).toBeDefined();
    expect(lineStartChange?.oldValue).toBe(1);
    expect(lineStartChange?.newValue).toBe(50);
  });
});

// ============================================================================
// Test Suite: Edge Cases
// ============================================================================

describe('NodeMatcher Edge Cases', () => {
  let matcher: INodeMatcher;

  beforeEach(() => {
    matcher = createNodeMatcher();
  });

  describe('empty graphs', () => {
    it('should handle both graphs empty', () => {
      const baseIndex = matcher.indexNodes([]);
      const compareIndex = matcher.indexNodes([]);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });

    it('should handle empty base graph', () => {
      const baseIndex = matcher.indexNodes([]);
      const compareIndex = matcher.indexNodes([
        createTerraformResourceNode({ name: 'bucket' }),
      ]);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(1);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });

    it('should handle empty compare graph', () => {
      const baseIndex = matcher.indexNodes([
        createTerraformResourceNode({ name: 'bucket' }),
      ]);
      const compareIndex = matcher.indexNodes([]);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(1);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });
  });

  describe('single node graphs', () => {
    it('should handle single identical node', () => {
      const nodes = [createTerraformResourceNode({ name: 'bucket' })];
      const baseIndex = matcher.indexNodes(nodes);
      const compareIndex = matcher.indexNodes(nodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });

    it('should handle single modified node', () => {
      const baseNodes = [createTerraformResourceNode({ name: 'bucket', provider: 'aws' })];
      const compareNodes = [createTerraformResourceNode({ name: 'bucket', provider: 'google' })];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(1);
    });

    it('should handle single added node', () => {
      const baseNodes: NodeType[] = [];
      const compareNodes = [createTerraformResourceNode({ name: 'bucket' })];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(1);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
    });

    it('should handle single removed node', () => {
      const baseNodes = [createTerraformResourceNode({ name: 'bucket' })];
      const compareNodes: NodeType[] = [];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(1);
    });
  });

  describe('identical graphs (no changes)', () => {
    it('should find no changes for identical graphs', () => {
      const nodes: NodeType[] = [
        createTerraformResourceNode({ name: 'bucket-1' }),
        createTerraformResourceNode({ name: 'bucket-2' }),
        createK8sDeploymentNode({ name: 'deployment-1' }),
        createTerraformVariableNode({ name: 'var-1' }),
      ];

      const baseIndex = matcher.indexNodes(nodes);
      const compareIndex = matcher.indexNodes(nodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });

    it('should find no changes when only transient fields differ', () => {
      const baseNodes = [
        createTerraformResourceNode({ id: 'id-1', name: 'bucket' }),
      ];
      const compareNodes = [
        createTerraformResourceNode({ id: 'id-2', name: 'bucket' }),
      ];

      const baseIndex = matcher.indexNodes(baseNodes);
      const compareIndex = matcher.indexNodes(compareNodes);

      expect(matcher.findAdded(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findRemoved(baseIndex, compareIndex)).toHaveLength(0);
      expect(matcher.findModified(baseIndex, compareIndex)).toHaveLength(0);
    });
  });

  describe('nodes with special characters', () => {
    it('should handle nodes with special characters in name', () => {
      const nodes = [
        createTerraformResourceNode({ name: 'my-bucket_v2.0' }),
        createTerraformResourceNode({ name: 'bucket[0]' }),
        createTerraformResourceNode({ name: 'bucket.*.config' }),
      ];

      const index = matcher.indexNodes(nodes);

      expect(index.size).toBe(3);
    });

    it('should handle nodes with unicode in name', () => {
      const nodes = [
        createTerraformResourceNode({ name: 'bucket-' }),
      ];

      const index = matcher.indexNodes(nodes);

      expect(index.size).toBe(1);
      expect(index.has('terraform_resource:bucket-:main.tf')).toBe(true);
    });
  });
});

// ============================================================================
// Test Suite: sameIdentity Utility
// ============================================================================

describe('sameIdentity utility function', () => {
  it('should return true for nodes with same identity', () => {
    const node1 = createTerraformResourceNode({
      id: 'id-1',
      name: 'bucket',
      location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
    });
    const node2 = createTerraformResourceNode({
      id: 'id-2',
      name: 'bucket',
      location: { file: 'main.tf', lineStart: 50, lineEnd: 60 },
    });

    expect(sameIdentity(node1, node2)).toBe(true);
  });

  it('should return false for different names', () => {
    const node1 = createTerraformResourceNode({ name: 'bucket-1' });
    const node2 = createTerraformResourceNode({ name: 'bucket-2' });

    expect(sameIdentity(node1, node2)).toBe(false);
  });

  it('should return false for different files', () => {
    const node1 = createTerraformResourceNode({
      name: 'bucket',
      location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
    });
    const node2 = createTerraformResourceNode({
      name: 'bucket',
      location: { file: 'other.tf', lineStart: 1, lineEnd: 10 },
    });

    expect(sameIdentity(node1, node2)).toBe(false);
  });

  it('should return false for different types', () => {
    const node1 = createTerraformResourceNode({ name: 'my-thing' });
    const node2 = createTerraformVariableNode({ name: 'my-thing' });

    expect(sameIdentity(node1 as NodeType, node2 as NodeType)).toBe(false);
  });
});

// ============================================================================
// Test Suite: groupNodesByType Utility
// ============================================================================

describe('groupNodesByType utility function', () => {
  it('should group nodes by their type', () => {
    const nodes: NodeType[] = [
      createTerraformResourceNode({ name: 'bucket-1' }),
      createTerraformResourceNode({ name: 'bucket-2' }),
      createK8sDeploymentNode({ name: 'deployment-1' }),
      createTerraformVariableNode({ name: 'var-1' }),
    ];

    const grouped = groupNodesByType(nodes);

    expect(grouped.size).toBe(3);
    expect(grouped.get('terraform_resource')).toHaveLength(2);
    expect(grouped.get('k8s_deployment')).toHaveLength(1);
    expect(grouped.get('terraform_variable')).toHaveLength(1);
  });

  it('should return empty map for empty array', () => {
    const grouped = groupNodesByType([]);

    expect(grouped.size).toBe(0);
  });

  it('should handle single node', () => {
    const nodes = [createTerraformResourceNode({ name: 'bucket' })];

    const grouped = groupNodesByType(nodes);

    expect(grouped.size).toBe(1);
    expect(grouped.get('terraform_resource')).toHaveLength(1);
  });
});

// ============================================================================
// Test Suite: groupNodesByFile Utility
// ============================================================================

describe('groupNodesByFile utility function', () => {
  it('should group nodes by their file path', () => {
    const nodes: NodeType[] = [
      createTerraformResourceNode({ name: 'bucket-1', location: { file: 'main.tf', lineStart: 1, lineEnd: 10 } }),
      createTerraformResourceNode({ name: 'bucket-2', location: { file: 'main.tf', lineStart: 20, lineEnd: 30 } }),
      createTerraformResourceNode({ name: 'bucket-3', location: { file: 'other.tf', lineStart: 1, lineEnd: 10 } }),
    ];

    const grouped = groupNodesByFile(nodes);

    expect(grouped.size).toBe(2);
    expect(grouped.get('main.tf')).toHaveLength(2);
    expect(grouped.get('other.tf')).toHaveLength(1);
  });

  it('should return empty map for empty array', () => {
    const grouped = groupNodesByFile([]);

    expect(grouped.size).toBe(0);
  });

  it('should handle nested file paths', () => {
    const nodes: NodeType[] = [
      createTerraformResourceNode({
        name: 'bucket',
        location: { file: 'modules/vpc/main.tf', lineStart: 1, lineEnd: 10 },
      }),
    ];

    const grouped = groupNodesByFile(nodes);

    expect(grouped.size).toBe(1);
    expect(grouped.get('modules/vpc/main.tf')).toHaveLength(1);
  });
});

// ============================================================================
// Test Suite: Custom Ignore Fields
// ============================================================================

describe('NodeMatcher with custom ignore fields', () => {
  it('should ignore custom fields during comparison', () => {
    const matcher = createNodeMatcher({
      ignoreFields: ['resourceType'],
    });

    const node1 = createTerraformResourceNode({
      name: 'bucket',
      resourceType: 'aws_s3_bucket',
    });
    const node2 = createTerraformResourceNode({
      name: 'bucket',
      resourceType: 'google_storage_bucket',
    });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).not.toContain('resourceType');
  });

  it('should still detect non-ignored field changes', () => {
    const matcher = createNodeMatcher({
      ignoreFields: ['resourceType'],
    });

    const node1 = createTerraformResourceNode({
      name: 'bucket',
      provider: 'aws',
      resourceType: 'aws_s3_bucket',
    });
    const node2 = createTerraformResourceNode({
      name: 'bucket',
      provider: 'google',
      resourceType: 'google_storage_bucket',
    });

    const changedFields = matcher.compareNodes(node1, node2);

    expect(changedFields).toContain('provider');
    expect(changedFields).not.toContain('resourceType');
  });

  it('should combine custom ignore fields with transient fields', () => {
    const matcher = createNodeMatcher({
      ignoreFields: ['customField'],
    });

    const node1 = createTerraformResourceNode({ id: 'id-1', name: 'bucket' });
    const node2 = createTerraformResourceNode({ id: 'id-2', name: 'bucket' });

    // Add custom field
    (node1 as Record<string, unknown>).customField = 'value1';
    (node2 as Record<string, unknown>).customField = 'value2';

    const changedFields = matcher.compareNodes(node1, node2);

    // Both id and customField should be ignored
    expect(changedFields).not.toContain('id');
    expect(changedFields).not.toContain('customField');
    expect(changedFields).toHaveLength(0);
  });
});
