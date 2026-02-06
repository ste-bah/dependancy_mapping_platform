/**
 * NodeMatcher Unit Tests
 * @module services/rollup/graph-diff/__tests__/node-matcher.test
 *
 * Comprehensive unit tests for NodeMatcher implementation.
 * Tests identity extraction, index building, equivalence checking,
 * and attribute comparison functionality.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 * NFR-PERF-008: Optimized for 100K nodes < 500ms benchmark target
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  NodeMatcher,
  createNodeMatcher,
  createConfiguredNodeMatcher,
  createK8sNodeMatcher,
  createTerraformNodeMatcher,
  createNodeIdentityKeyFromParts,
  normalizeFilePath,
  fnv1aHash,
  getNestedValue,
  deepEqual,
  getAllPaths,
  extractNamespace,
  getNodeCategory,
  DEFAULT_IGNORE_ATTRIBUTES,
  type NodeIdentityIndex,
  type AttributeChanges,
} from '../node-matcher.js';
import type { NodeIdentity, NodeIdentityConfig } from '../interfaces.js';
import type { NodeType, TerraformResourceNode, K8sDeploymentNode, HelmChartNode } from '../../../../types/graph.js';
import type { RepositoryId } from '../../../../types/entities.js';

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a mock Terraform resource node for testing
 */
function createTerraformNode(overrides: Partial<TerraformResourceNode> = {}): TerraformResourceNode {
  return {
    id: 'tf-node-1',
    name: 'aws_s3_bucket.example',
    type: 'terraform_resource',
    resourceType: 'aws_s3_bucket',
    provider: 'aws',
    dependsOn: [],
    location: {
      file: 'main.tf',
      lineStart: 1,
      lineEnd: 10,
    },
    metadata: {
      arn: 'arn:aws:s3:::my-bucket',
      bucket: 'my-bucket',
    },
    ...overrides,
  };
}

/**
 * Creates a mock K8s Deployment node for testing
 */
function createK8sDeploymentNode(overrides: Partial<K8sDeploymentNode> = {}): K8sDeploymentNode {
  return {
    id: 'k8s-node-1',
    name: 'nginx-deployment',
    type: 'k8s_deployment',
    namespace: 'production',
    replicas: 3,
    selector: { app: 'nginx' },
    containers: [{ name: 'nginx', image: 'nginx:latest' }],
    location: {
      file: 'deployment.yaml',
      lineStart: 1,
      lineEnd: 50,
    },
    metadata: {
      labels: { app: 'nginx', environment: 'production' },
    },
    ...overrides,
  };
}

/**
 * Creates a mock Helm Chart node for testing
 */
function createHelmChartNode(overrides: Partial<HelmChartNode> = {}): HelmChartNode {
  return {
    id: 'helm-node-1',
    name: 'nginx-chart',
    type: 'helm_chart',
    chartName: 'nginx',
    chartVersion: '1.0.0',
    repository: 'https://charts.bitnami.com/bitnami',
    location: {
      file: 'Chart.yaml',
      lineStart: 1,
      lineEnd: 20,
    },
    metadata: {},
    ...overrides,
  };
}

/**
 * Creates a repository ID for testing
 */
function createRepositoryId(id: string = 'repo-1'): RepositoryId {
  return id as RepositoryId;
}

// ============================================================================
// NodeMatcher Tests
// ============================================================================

describe('NodeMatcher', () => {
  let matcher: NodeMatcher;

  beforeEach(() => {
    matcher = new NodeMatcher();
  });

  // ==========================================================================
  // Constructor Tests
  // ==========================================================================

  describe('constructor', () => {
    it('should create matcher with default configuration', () => {
      const m = new NodeMatcher();
      expect(m).toBeInstanceOf(NodeMatcher);
    });

    it('should create matcher with custom configuration', () => {
      const config: NodeIdentityConfig = {
        useNamespace: true,
        useRepositoryId: true,
        customAttributes: ['provider', 'resourceType'],
      };
      const m = new NodeMatcher(config);
      expect(m).toBeInstanceOf(NodeMatcher);
    });

    it('should accept empty configuration', () => {
      const m = new NodeMatcher({});
      expect(m).toBeInstanceOf(NodeMatcher);
    });
  });

  // ==========================================================================
  // Identity Extraction Tests
  // ==========================================================================

  describe('extractIdentity', () => {
    describe('Terraform Nodes', () => {
      it('should extract correct identity from terraform resource node', () => {
        const node = createTerraformNode();
        const identity = matcher.extractIdentity(node);

        expect(identity.nodeId).toBe('tf-node-1');
        expect(identity.nodeType).toBe('terraform_resource');
        expect(identity.name).toBe('aws_s3_bucket.example');
        expect(identity.key).toContain('terraform_resource');
        expect(identity.key).toContain('aws_s3_bucket.example');
        expect(identity.identityHash).toBeDefined();
      });

      it('should extract resourceType as attribute', () => {
        const node = createTerraformNode({ resourceType: 'aws_ec2_instance' });
        const identity = matcher.extractIdentity(node);

        expect(identity.attributes.resourceType).toBe('aws_ec2_instance');
      });

      it('should handle terraform data node', () => {
        const node = {
          id: 'tf-data-1',
          name: 'data.aws_ami.latest',
          type: 'terraform_data' as const,
          dataType: 'aws_ami',
          provider: 'aws',
          location: { file: 'data.tf', lineStart: 1, lineEnd: 10 },
          metadata: {},
        };
        const identity = matcher.extractIdentity(node);

        expect(identity.nodeType).toBe('terraform_data');
        expect(identity.attributes.resourceType).toBe('aws_ami');
      });
    });

    describe('Kubernetes Nodes', () => {
      it('should extract correct identity from k8s deployment node', () => {
        const node = createK8sDeploymentNode();
        const identity = matcher.extractIdentity(node);

        expect(identity.nodeId).toBe('k8s-node-1');
        expect(identity.nodeType).toBe('k8s_deployment');
        expect(identity.name).toBe('nginx-deployment');
        expect(identity.namespace).toBe('production');
      });

      it('should include namespace in identity key when useNamespace is true', () => {
        const namespaceConfig: NodeIdentityConfig = { useNamespace: true };
        const m = new NodeMatcher(namespaceConfig);

        const node = createK8sDeploymentNode({ namespace: 'staging' });
        const identity = m.extractIdentity(node);

        expect(identity.namespace).toBe('staging');
        expect(identity.key).toContain('staging');
      });

      it('should handle missing namespace gracefully', () => {
        const node = createK8sDeploymentNode({ namespace: undefined });
        const identity = matcher.extractIdentity(node);

        expect(identity.namespace).toBeUndefined();
        expect(identity.key).toBeDefined();
      });

      it('should handle k8s service node', () => {
        const node = {
          id: 'k8s-svc-1',
          name: 'nginx-service',
          type: 'k8s_service' as const,
          namespace: 'default',
          serviceType: 'ClusterIP' as const,
          selector: { app: 'nginx' },
          ports: [{ port: 80, targetPort: 80 }],
          location: { file: 'service.yaml', lineStart: 1, lineEnd: 20 },
          metadata: {},
        };
        const identity = matcher.extractIdentity(node);

        expect(identity.nodeType).toBe('k8s_service');
        expect(identity.namespace).toBe('default');
      });
    });

    describe('Helm Nodes', () => {
      it('should extract correct identity from helm chart node', () => {
        const node = createHelmChartNode();
        const identity = matcher.extractIdentity(node);

        expect(identity.nodeId).toBe('helm-node-1');
        expect(identity.nodeType).toBe('helm_chart');
        expect(identity.name).toBe('nginx-chart');
        expect(identity.attributes.resourceType).toBe('nginx');
      });
    });

    describe('File Path Normalization', () => {
      it('should normalize file paths consistently', () => {
        const node1 = createTerraformNode({
          id: 'node-1',
          location: { file: './src/main.tf', lineStart: 1, lineEnd: 10 },
        });
        const node2 = createTerraformNode({
          id: 'node-2',
          location: { file: 'src/main.tf', lineStart: 1, lineEnd: 10 },
        });

        const identity1 = matcher.extractIdentity(node1);
        const identity2 = matcher.extractIdentity(node2);

        // Keys should be the same after path normalization
        expect(identity1.key).toBe(identity2.key);
      });

      it('should normalize windows paths to unix style', () => {
        const node = createTerraformNode({
          location: { file: 'src\\modules\\main.tf', lineStart: 1, lineEnd: 10 },
        });
        const identity = matcher.extractIdentity(node);

        expect(identity.key).not.toContain('\\');
      });

      it('should handle trailing slashes in paths', () => {
        const node1 = createTerraformNode({
          id: 'node-1',
          location: { file: 'src/', lineStart: 1, lineEnd: 10 },
        });
        const node2 = createTerraformNode({
          id: 'node-2',
          location: { file: 'src', lineStart: 1, lineEnd: 10 },
        });

        const identity1 = matcher.extractIdentity(node1);
        const identity2 = matcher.extractIdentity(node2);

        expect(identity1.key).toBe(identity2.key);
      });

      it('should lowercase file paths', () => {
        const node1 = createTerraformNode({
          id: 'node-1',
          location: { file: 'SRC/Main.tf', lineStart: 1, lineEnd: 10 },
        });
        const node2 = createTerraformNode({
          id: 'node-2',
          location: { file: 'src/main.tf', lineStart: 1, lineEnd: 10 },
        });

        const identity1 = matcher.extractIdentity(node1);
        const identity2 = matcher.extractIdentity(node2);

        expect(identity1.key).toBe(identity2.key);
      });
    });

    describe('Repository ID Handling', () => {
      it('should include repository ID in identity when provided', () => {
        const node = createTerraformNode();
        const repoId = createRepositoryId('my-repo');
        const identity = matcher.extractIdentity(node, repoId);

        expect(identity.repositoryId).toBe('my-repo');
      });

      it('should handle missing repository ID gracefully', () => {
        const node = createTerraformNode();
        const identity = matcher.extractIdentity(node);

        expect(identity.repositoryId).toBeUndefined();
      });
    });

    describe('Custom Attributes', () => {
      it('should extract custom attributes when configured', () => {
        const config: NodeIdentityConfig = {
          customAttributes: ['provider', 'resourceType'],
        };
        const m = new NodeMatcher(config);

        const node = createTerraformNode({
          provider: 'aws',
          resourceType: 'aws_s3_bucket',
        });
        const identity = m.extractIdentity(node);

        expect(identity.attributes).toHaveProperty('provider');
        expect(identity.attributes).toHaveProperty('resourceType');
      });

      it('should handle nested custom attributes', () => {
        const config: NodeIdentityConfig = {
          customAttributes: ['metadata.labels.app'],
        };
        const m = new NodeMatcher(config);

        const node = createK8sDeploymentNode({
          metadata: { labels: { app: 'nginx' } },
        });
        const identity = m.extractIdentity(node);

        expect(identity.attributes.metadata).toBeDefined();
      });
    });
  });

  // ==========================================================================
  // Batch Identity Extraction Tests
  // ==========================================================================

  describe('extractIdentities', () => {
    it('should extract identities from multiple nodes', () => {
      const nodes = [
        createTerraformNode({ id: 'node-1', name: 'resource-1' }),
        createTerraformNode({ id: 'node-2', name: 'resource-2' }),
        createK8sDeploymentNode({ id: 'node-3' }),
      ];

      const identities = matcher.extractIdentities(nodes);

      expect(identities.size).toBe(3);
      expect(identities.has('node-1')).toBe(true);
      expect(identities.has('node-2')).toBe(true);
      expect(identities.has('node-3')).toBe(true);
    });

    it('should handle empty node array', () => {
      const identities = matcher.extractIdentities([]);

      expect(identities.size).toBe(0);
    });

    it('should pass repository ID to all extractions', () => {
      const nodes = [
        createTerraformNode({ id: 'node-1' }),
        createTerraformNode({ id: 'node-2' }),
      ];
      const repoId = createRepositoryId('shared-repo');

      const identities = matcher.extractIdentities(nodes, repoId);

      for (const [, identity] of identities) {
        expect(identity.repositoryId).toBe('shared-repo');
      }
    });
  });

  // ==========================================================================
  // Index Building Tests
  // ==========================================================================

  describe('buildIndex', () => {
    it('should create O(1) lookup index', () => {
      const nodes = new Map<string, NodeType>([
        ['node-1', createTerraformNode({ id: 'node-1', name: 'resource-1' })],
        ['node-2', createTerraformNode({ id: 'node-2', name: 'resource-2' })],
        ['node-3', createK8sDeploymentNode({ id: 'node-3' })],
      ]);

      const index = matcher.buildIndex(nodes);

      expect(index.byIdentityKey.size).toBe(3);
      expect(index.byNodeId.size).toBe(3);
      expect(index.identities.length).toBe(3);
    });

    it('should track statistics correctly', () => {
      const nodes = new Map<string, NodeType>([
        ['node-1', createTerraformNode({ id: 'node-1' })],
        ['node-2', createTerraformNode({ id: 'node-2' })],
        ['node-3', createK8sDeploymentNode({ id: 'node-3', namespace: 'production' })],
        ['node-4', createK8sDeploymentNode({ id: 'node-4', namespace: 'staging' })],
      ]);

      const index = matcher.buildIndex(nodes);

      expect(index.stats.totalNodes).toBe(4);
      expect(index.stats.byNodeType['terraform_resource']).toBe(2);
      expect(index.stats.byNodeType['k8s_deployment']).toBe(2);
      expect(index.stats.byNamespace['production']).toBe(1);
      expect(index.stats.byNamespace['staging']).toBe(1);
    });

    it('should track build time', () => {
      const nodes = new Map<string, NodeType>([
        ['node-1', createTerraformNode({ id: 'node-1' })],
      ]);

      const index = matcher.buildIndex(nodes);

      expect(index.stats.buildTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle duplicate identities', () => {
      // Create two nodes with the same identity (same type, name, file)
      const nodes = new Map<string, NodeType>([
        ['node-1', createTerraformNode({ id: 'node-1', name: 'same-resource' })],
        ['node-2', createTerraformNode({ id: 'node-2', name: 'same-resource' })],
      ]);

      const index = matcher.buildIndex(nodes);

      // Duplicates should be tracked
      expect(index.stats.duplicateIdentities).toBe(1);
      // Only unique identities in byIdentityKey
      expect(index.stats.uniqueIdentities).toBe(1);
    });

    it('should handle empty nodes map', () => {
      const nodes = new Map<string, NodeType>();

      const index = matcher.buildIndex(nodes);

      expect(index.stats.totalNodes).toBe(0);
      expect(index.stats.uniqueIdentities).toBe(0);
      expect(index.stats.duplicateIdentities).toBe(0);
    });

    it('should support reverse lookup by node ID', () => {
      const nodes = new Map<string, NodeType>([
        ['node-1', createTerraformNode({ id: 'node-1', name: 'resource-1' })],
      ]);

      const index = matcher.buildIndex(nodes);
      const identity = index.byNodeId.get('node-1');

      expect(identity).toBeDefined();
      expect(identity?.nodeId).toBe('node-1');
    });
  });

  // ==========================================================================
  // Equivalence Check Tests
  // ==========================================================================

  describe('areEquivalent', () => {
    it('should return true for equivalent nodes', () => {
      const node1 = createTerraformNode({
        id: 'node-1',
        name: 'aws_s3_bucket.main',
      });
      const node2 = createTerraformNode({
        id: 'node-2',
        name: 'aws_s3_bucket.main',
      });

      expect(matcher.areEquivalent(node1, node2)).toBe(true);
    });

    it('should return false for nodes with different names', () => {
      const node1 = createTerraformNode({
        id: 'node-1',
        name: 'aws_s3_bucket.bucket_a',
      });
      const node2 = createTerraformNode({
        id: 'node-2',
        name: 'aws_s3_bucket.bucket_b',
      });

      expect(matcher.areEquivalent(node1, node2)).toBe(false);
    });

    it('should return false for nodes with different types', () => {
      const node1 = createTerraformNode({ id: 'node-1' });
      const node2 = createK8sDeploymentNode({ id: 'node-2', name: 'aws_s3_bucket.example' });

      expect(matcher.areEquivalent(node1, node2)).toBe(false);
    });

    it('should return false for nodes with different file paths', () => {
      const node1 = createTerraformNode({
        id: 'node-1',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
      });
      const node2 = createTerraformNode({
        id: 'node-2',
        location: { file: 'other.tf', lineStart: 1, lineEnd: 10 },
      });

      expect(matcher.areEquivalent(node1, node2)).toBe(false);
    });

    it('should consider namespace for k8s nodes when configured', () => {
      const m = new NodeMatcher({ useNamespace: true });

      const node1 = createK8sDeploymentNode({
        id: 'node-1',
        name: 'nginx',
        namespace: 'production',
      });
      const node2 = createK8sDeploymentNode({
        id: 'node-2',
        name: 'nginx',
        namespace: 'staging',
      });

      expect(m.areEquivalent(node1, node2)).toBe(false);
    });
  });

  describe('identitiesMatch', () => {
    it('should return true for matching identity keys', () => {
      const node1 = createTerraformNode({ id: 'node-1' });
      const node2 = createTerraformNode({ id: 'node-2' });

      const identity1 = matcher.extractIdentity(node1);
      const identity2 = matcher.extractIdentity(node2);

      expect(matcher.identitiesMatch(identity1, identity2)).toBe(true);
    });

    it('should return false for different identity keys', () => {
      const node1 = createTerraformNode({ id: 'node-1', name: 'resource-a' });
      const node2 = createTerraformNode({ id: 'node-2', name: 'resource-b' });

      const identity1 = matcher.extractIdentity(node1);
      const identity2 = matcher.extractIdentity(node2);

      expect(matcher.identitiesMatch(identity1, identity2)).toBe(false);
    });
  });

  // ==========================================================================
  // Attribute Comparison Tests
  // ==========================================================================

  describe('compareAttributes', () => {
    it('should detect added attributes', () => {
      const baseNode = createTerraformNode({
        id: 'node-1',
        metadata: { existing: 'value' },
      });
      const compareNode = createTerraformNode({
        id: 'node-2',
        metadata: { existing: 'value', newAttr: 'new-value' },
      });

      const result = matcher.compareAttributes(baseNode, compareNode);

      expect(result.hasChanges).toBe(true);
      const addedChanges = result.changes.filter((c) => c.changeType === 'added');
      expect(addedChanges.length).toBeGreaterThan(0);
      expect(result.summary.added).toBeGreaterThan(0);
    });

    it('should detect removed attributes', () => {
      const baseNode = createTerraformNode({
        id: 'node-1',
        metadata: { existing: 'value', toRemove: 'will-be-removed' },
      });
      const compareNode = createTerraformNode({
        id: 'node-2',
        metadata: { existing: 'value' },
      });

      const result = matcher.compareAttributes(baseNode, compareNode);

      expect(result.hasChanges).toBe(true);
      const removedChanges = result.changes.filter((c) => c.changeType === 'removed');
      expect(removedChanges.length).toBeGreaterThan(0);
      expect(result.summary.removed).toBeGreaterThan(0);
    });

    it('should detect modified attributes', () => {
      const baseNode = createTerraformNode({
        id: 'node-1',
        metadata: { value: 'original' },
      });
      const compareNode = createTerraformNode({
        id: 'node-2',
        metadata: { value: 'modified' },
      });

      const result = matcher.compareAttributes(baseNode, compareNode);

      expect(result.hasChanges).toBe(true);
      const modifiedChanges = result.changes.filter((c) => c.changeType === 'modified');
      expect(modifiedChanges.length).toBeGreaterThan(0);
      expect(result.summary.modified).toBeGreaterThan(0);
    });

    it('should return no changes for identical nodes', () => {
      const node1 = createTerraformNode({ id: 'node-1' });
      const node2 = createTerraformNode({ id: 'node-1' });

      const result = matcher.compareAttributes(node1, node2);

      // Should have no changes since nodes are identical (same id will be ignored)
      expect(result.summary.added).toBe(0);
      expect(result.summary.removed).toBe(0);
    });

    it('should respect ignore list', () => {
      const baseNode = createTerraformNode({
        id: 'node-1',
        location: { file: 'main.tf', lineStart: 1, lineEnd: 10 },
      });
      const compareNode = createTerraformNode({
        id: 'node-1',
        location: { file: 'main.tf', lineStart: 5, lineEnd: 15 },
      });

      // Line changes should be ignored by default
      const result = matcher.compareAttributes(baseNode, compareNode);

      // location.lineStart and location.lineEnd should be ignored
      const lineChanges = result.changes.filter(
        (c) => c.path.includes('lineStart') || c.path.includes('lineEnd')
      );
      expect(lineChanges.length).toBe(0);
    });

    it('should ignore id attribute by default', () => {
      const baseNode = createTerraformNode({ id: 'node-1' });
      const compareNode = createTerraformNode({ id: 'node-2' });

      const result = matcher.compareAttributes(baseNode, compareNode);

      const idChanges = result.changes.filter((c) => c.path === 'id');
      expect(idChanges.length).toBe(0);
    });

    it('should use custom ignore list when provided', () => {
      const baseNode = createTerraformNode({
        id: 'node-1',
        metadata: { ignoreMe: 'value1' },
      });
      const compareNode = createTerraformNode({
        id: 'node-2',
        metadata: { ignoreMe: 'value2' },
      });

      const result = matcher.compareAttributes(
        baseNode,
        compareNode,
        [...DEFAULT_IGNORE_ATTRIBUTES, 'metadata.ignoreMe']
      );

      const ignoredChanges = result.changes.filter(
        (c) => c.path === 'metadata.ignoreMe'
      );
      expect(ignoredChanges.length).toBe(0);
    });

    it('should detect nested attribute changes', () => {
      const baseNode = createK8sDeploymentNode({
        id: 'node-1',
        metadata: {
          labels: { app: 'nginx', version: 'v1' },
        },
      });
      const compareNode = createK8sDeploymentNode({
        id: 'node-2',
        metadata: {
          labels: { app: 'nginx', version: 'v2' },
        },
      });

      const result = matcher.compareAttributes(baseNode, compareNode);

      const versionChange = result.changes.find(
        (c) => c.path.includes('version')
      );
      expect(versionChange).toBeDefined();
    });

    it('should handle array attribute changes', () => {
      const baseNode = createK8sDeploymentNode({
        id: 'node-1',
        containers: [{ name: 'container-1', image: 'image:v1' }],
      });
      const compareNode = createK8sDeploymentNode({
        id: 'node-2',
        containers: [{ name: 'container-1', image: 'image:v2' }],
      });

      const result = matcher.compareAttributes(baseNode, compareNode);

      // Arrays should be detected as changed
      const containerChanges = result.changes.filter(
        (c) => c.path === 'containers'
      );
      expect(containerChanges.length).toBeGreaterThan(0);
    });
  });

  describe('compareNodes', () => {
    it('should return attribute changes between two nodes', () => {
      const node1 = createTerraformNode({
        id: 'node-1',
        metadata: { value: 'original' },
      });
      const node2 = createTerraformNode({
        id: 'node-2',
        metadata: { value: 'changed' },
      });

      const changes = matcher.compareNodes(node1, node2);

      expect(Array.isArray(changes)).toBe(true);
      expect(changes.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Configuration Tests
  // ==========================================================================

  describe('configure', () => {
    it('should update matcher configuration', () => {
      const m = new NodeMatcher();

      m.configure({
        useNamespace: true,
        customAttributes: ['provider'],
      });

      // Verify configuration was applied by checking identity extraction
      const node = createK8sDeploymentNode({ namespace: 'test-ns' });
      const identity = m.extractIdentity(node);

      expect(identity.namespace).toBe('test-ns');
    });

    it('should merge with existing configuration', () => {
      const m = new NodeMatcher({ useNamespace: true });

      m.configure({ customAttributes: ['provider'] });

      // Original config should still apply
      const node = createK8sDeploymentNode({ namespace: 'test-ns' });
      const identity = m.extractIdentity(node);

      expect(identity.namespace).toBe('test-ns');
    });
  });

  // ==========================================================================
  // Node Validation Tests
  // ==========================================================================

  describe('validateNode', () => {
    it('should validate a valid node', () => {
      const node = createTerraformNode();
      const result = matcher.validateNode(node);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject node without id', () => {
      const node = createTerraformNode({ id: '' });
      const result = matcher.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('id');
    });

    it('should reject node without name', () => {
      const node = createTerraformNode({ name: '' });
      const result = matcher.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('name');
    });

    it('should reject node without type', () => {
      const node = { ...createTerraformNode(), type: '' } as unknown as NodeType;
      const result = matcher.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('type');
    });

    it('should reject node without location.file', () => {
      const node = createTerraformNode({
        location: { file: '', lineStart: 1, lineEnd: 10 },
      });
      const result = matcher.validateNode(node);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('location.file');
    });
  });

  // ==========================================================================
  // Supported Node Types Tests
  // ==========================================================================

  describe('getSupportedNodeTypes', () => {
    it('should return all supported terraform node types', () => {
      const types = matcher.getSupportedNodeTypes();

      expect(types).toContain('terraform_resource');
      expect(types).toContain('terraform_data');
      expect(types).toContain('terraform_module');
      expect(types).toContain('terraform_variable');
      expect(types).toContain('terraform_output');
      expect(types).toContain('terraform_local');
      expect(types).toContain('terraform_provider');
    });

    it('should return all supported k8s node types', () => {
      const types = matcher.getSupportedNodeTypes();

      expect(types).toContain('k8s_deployment');
      expect(types).toContain('k8s_service');
      expect(types).toContain('k8s_configmap');
      expect(types).toContain('k8s_secret');
      expect(types).toContain('k8s_ingress');
      expect(types).toContain('k8s_pod');
      expect(types).toContain('k8s_statefulset');
    });

    it('should return all supported helm node types', () => {
      const types = matcher.getSupportedNodeTypes();

      expect(types).toContain('helm_chart');
      expect(types).toContain('helm_release');
      expect(types).toContain('helm_value');
    });
  });

  // ==========================================================================
  // Find Matching Node Tests
  // ==========================================================================

  describe('findMatchingNode', () => {
    it('should find matching node in target index', () => {
      const sourceNode = createTerraformNode({ id: 'source-1', name: 'shared-resource' });
      const targetNode = createTerraformNode({ id: 'target-1', name: 'shared-resource' });

      const sourceIdentity = matcher.extractIdentity(sourceNode);
      const targetNodes = new Map<string, NodeType>([['target-1', targetNode]]);
      const targetIndex = matcher.buildIndex(targetNodes);

      const match = matcher.findMatchingNode(sourceIdentity, targetIndex);

      expect(match).toBeDefined();
      expect(match?.id).toBe('target-1');
    });

    it('should return undefined when no match exists', () => {
      const sourceNode = createTerraformNode({ id: 'source-1', name: 'unique-resource' });
      const targetNode = createTerraformNode({ id: 'target-1', name: 'different-resource' });

      const sourceIdentity = matcher.extractIdentity(sourceNode);
      const targetNodes = new Map<string, NodeType>([['target-1', targetNode]]);
      const targetIndex = matcher.buildIndex(targetNodes);

      const match = matcher.findMatchingNode(sourceIdentity, targetIndex);

      expect(match).toBeUndefined();
    });
  });
});

// ============================================================================
// Factory Function Tests
// ============================================================================

describe('Factory Functions', () => {
  describe('createNodeMatcher', () => {
    it('should create matcher with default configuration', () => {
      const matcher = createNodeMatcher();
      expect(matcher).toBeInstanceOf(NodeMatcher);
    });
  });

  describe('createConfiguredNodeMatcher', () => {
    it('should create matcher with custom configuration', () => {
      const config: NodeIdentityConfig = {
        useNamespace: true,
        customAttributes: ['provider'],
      };
      const matcher = createConfiguredNodeMatcher(config);

      expect(matcher).toBeInstanceOf(NodeMatcher);
    });
  });

  describe('createK8sNodeMatcher', () => {
    it('should create matcher optimized for K8s resources', () => {
      const matcher = createK8sNodeMatcher();

      // K8s matcher should include namespace in identity
      const node = createK8sDeploymentNode({ namespace: 'production' });
      const identity = matcher.extractIdentity(node);

      expect(identity.namespace).toBe('production');
      expect(identity.key).toContain('production');
    });
  });

  describe('createTerraformNodeMatcher', () => {
    it('should create matcher optimized for Terraform resources', () => {
      const matcher = createTerraformNodeMatcher();

      const node = createTerraformNode({
        provider: 'aws',
        resourceType: 'aws_s3_bucket',
      });
      const identity = matcher.extractIdentity(node);

      // Terraform matcher should not include namespace
      expect(identity.namespace).toBeUndefined();
    });
  });

  describe('createNodeIdentityKeyFromParts', () => {
    it('should create identity key from individual components', () => {
      const key = createNodeIdentityKeyFromParts(
        'terraform_resource',
        'aws_s3_bucket.main',
        'main.tf'
      );

      expect(key).toContain('terraform_resource');
      expect(key).toContain('aws_s3_bucket.main');
      expect(key).toContain('main.tf');
    });

    it('should include namespace when provided', () => {
      const key = createNodeIdentityKeyFromParts(
        'k8s_deployment',
        'nginx',
        'deployment.yaml',
        'production'
      );

      expect(key).toContain('production');
    });

    it('should normalize file path', () => {
      const key1 = createNodeIdentityKeyFromParts(
        'terraform_resource',
        'resource',
        './src/main.tf'
      );
      const key2 = createNodeIdentityKeyFromParts(
        'terraform_resource',
        'resource',
        'src/main.tf'
      );

      expect(key1).toBe(key2);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('normalizeFilePath', () => {
    it('should normalize leading ./', () => {
      expect(normalizeFilePath('./src/main.tf')).toBe('src/main.tf');
    });

    it('should normalize backslashes to forward slashes', () => {
      expect(normalizeFilePath('src\\modules\\main.tf')).toBe('src/modules/main.tf');
    });

    it('should remove trailing slash', () => {
      expect(normalizeFilePath('src/modules/')).toBe('src/modules');
    });

    it('should lowercase the path', () => {
      expect(normalizeFilePath('SRC/Main.TF')).toBe('src/main.tf');
    });

    it('should handle combined normalizations', () => {
      expect(normalizeFilePath('.\\SRC\\Main.TF/')).toBe('src/main.tf');
    });
  });

  describe('fnv1aHash', () => {
    it('should return consistent hash for same input', () => {
      const hash1 = fnv1aHash('test-input');
      const hash2 = fnv1aHash('test-input');

      expect(hash1).toBe(hash2);
    });

    it('should return different hashes for different inputs', () => {
      const hash1 = fnv1aHash('input-1');
      const hash2 = fnv1aHash('input-2');

      expect(hash1).not.toBe(hash2);
    });

    it('should return 8-character hex string', () => {
      const hash = fnv1aHash('test');

      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });
  });

  describe('getNestedValue', () => {
    it('should get top-level value', () => {
      const obj = { name: 'test' };
      expect(getNestedValue(obj, 'name')).toBe('test');
    });

    it('should get nested value', () => {
      const obj = { level1: { level2: { value: 'deep' } } };
      expect(getNestedValue(obj, 'level1.level2.value')).toBe('deep');
    });

    it('should return undefined for missing path', () => {
      const obj = { name: 'test' };
      expect(getNestedValue(obj, 'missing.path')).toBeUndefined();
    });

    it('should return undefined for null intermediate', () => {
      const obj = { level1: null };
      expect(getNestedValue(obj as Record<string, unknown>, 'level1.value')).toBeUndefined();
    });
  });

  describe('deepEqual', () => {
    it('should return true for equal primitives', () => {
      expect(deepEqual('test', 'test')).toBe(true);
      expect(deepEqual(123, 123)).toBe(true);
      expect(deepEqual(true, true)).toBe(true);
    });

    it('should return false for different primitives', () => {
      expect(deepEqual('a', 'b')).toBe(false);
      expect(deepEqual(1, 2)).toBe(false);
    });

    it('should return true for equal arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    });

    it('should return false for different arrays', () => {
      expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    });

    it('should return true for equal objects', () => {
      expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    });

    it('should return false for different objects', () => {
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false);
      expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    });

    it('should handle nested structures', () => {
      const obj1 = { a: { b: { c: 1 } } };
      const obj2 = { a: { b: { c: 1 } } };
      const obj3 = { a: { b: { c: 2 } } };

      expect(deepEqual(obj1, obj2)).toBe(true);
      expect(deepEqual(obj1, obj3)).toBe(false);
    });

    it('should handle null and undefined', () => {
      expect(deepEqual(null, null)).toBe(true);
      expect(deepEqual(undefined, undefined)).toBe(true);
      expect(deepEqual(null, undefined)).toBe(false);
    });
  });

  describe('getAllPaths', () => {
    it('should get all paths in flat object', () => {
      const obj = { a: 1, b: 2 };
      const paths = getAllPaths(obj);

      expect(paths.has('a')).toBe(true);
      expect(paths.has('b')).toBe(true);
    });

    it('should get all paths in nested object', () => {
      const obj = { level1: { level2: 'value' } };
      const paths = getAllPaths(obj);

      expect(paths.has('level1.level2')).toBe(true);
    });

    it('should handle arrays as leaf nodes', () => {
      const obj = { items: [1, 2, 3] };
      const paths = getAllPaths(obj);

      expect(paths.has('items')).toBe(true);
    });
  });

  describe('extractNamespace', () => {
    it('should extract namespace from k8s node', () => {
      const node = createK8sDeploymentNode({ namespace: 'production' });
      expect(extractNamespace(node)).toBe('production');
    });

    it('should extract namespace from metadata', () => {
      const node = createTerraformNode({
        metadata: { namespace: 'staging' },
      });
      expect(extractNamespace(node)).toBe('staging');
    });

    it('should return undefined when no namespace', () => {
      const node = createTerraformNode();
      expect(extractNamespace(node)).toBeUndefined();
    });
  });

  describe('getNodeCategory', () => {
    it('should return terraform for terraform nodes', () => {
      const node = createTerraformNode();
      expect(getNodeCategory(node)).toBe('terraform');
    });

    it('should return kubernetes for k8s nodes', () => {
      const node = createK8sDeploymentNode();
      expect(getNodeCategory(node)).toBe('kubernetes');
    });

    it('should return helm for helm nodes', () => {
      const node = createHelmChartNode();
      expect(getNodeCategory(node)).toBe('helm');
    });
  });
});

// ============================================================================
// Performance Tests
// ============================================================================

describe('Performance', () => {
  it('should build index for 1000 nodes under 100ms', () => {
    const nodes = new Map<string, NodeType>();
    for (let i = 0; i < 1000; i++) {
      const node = createTerraformNode({
        id: `node-${i}`,
        name: `resource-${i}`,
        location: { file: `file-${i % 10}.tf`, lineStart: 1, lineEnd: 10 },
      });
      nodes.set(`node-${i}`, node);
    }

    const matcher = new NodeMatcher();
    const start = performance.now();
    const index = matcher.buildIndex(nodes);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(100);
    expect(index.stats.totalNodes).toBe(1000);
  });

  it('should extract identities for 1000 nodes under 50ms', () => {
    const nodes: NodeType[] = [];
    for (let i = 0; i < 1000; i++) {
      nodes.push(
        createTerraformNode({
          id: `node-${i}`,
          name: `resource-${i}`,
        })
      );
    }

    const matcher = new NodeMatcher();
    const start = performance.now();
    const identities = matcher.extractIdentities(nodes);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(50);
    expect(identities.size).toBe(1000);
  });
});

// ============================================================================
// Edge Cases Tests
// ============================================================================

describe('Edge Cases', () => {
  let matcher: NodeMatcher;

  beforeEach(() => {
    matcher = new NodeMatcher();
  });

  it('should handle node with empty metadata', () => {
    const node = createTerraformNode({ metadata: {} });
    const identity = matcher.extractIdentity(node);

    expect(identity).toBeDefined();
  });

  it('should handle node with special characters in name', () => {
    const node = createTerraformNode({
      name: 'resource::with::colons',
    });
    const identity = matcher.extractIdentity(node);

    expect(identity.name).toBe('resource::with::colons');
  });

  it('should handle node with unicode characters', () => {
    const node = createTerraformNode({
      name: 'resource-with-unicode-\u00e9\u00e8',
    });
    const identity = matcher.extractIdentity(node);

    expect(identity.name).toBe('resource-with-unicode-\u00e9\u00e8');
  });

  it('should handle very long names', () => {
    const longName = 'a'.repeat(1000);
    const node = createTerraformNode({ name: longName });
    const identity = matcher.extractIdentity(node);

    expect(identity.name).toBe(longName);
    expect(identity.identityHash).toBeDefined();
  });

  it('should handle deeply nested metadata', () => {
    const deepMetadata: Record<string, unknown> = {};
    let current = deepMetadata;
    for (let i = 0; i < 10; i++) {
      current[`level${i}`] = {};
      current = current[`level${i}`] as Record<string, unknown>;
    }
    current.value = 'deep';

    const node = createTerraformNode({ metadata: deepMetadata });
    const result = matcher.compareAttributes(node, createTerraformNode());

    expect(result).toBeDefined();
  });
});
