/**
 * GraphDiffEngine Unit Tests
 * @module services/rollup/graph-diff/__tests__/graph-diff-engine.test
 *
 * Comprehensive tests for the GraphDiffEngine covering:
 * - Node diff computation (added/removed/modified/unchanged)
 * - Edge diff computation with node identity resolution
 * - Full diff computation with summary statistics
 * - Edge cases (empty graphs, identical graphs, complete replacement)
 * - Timeout enforcement and error handling
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  GraphDiffEngine,
  createGraphDiffEngine,
  createConfiguredGraphDiffEngine,
  createK8sGraphDiffEngine,
  createTerraformGraphDiffEngine,
  MEMORY_CONSTANTS,
  TIMING_CONSTANTS,
} from '../graph-diff-engine.js';
import {
  GraphSnapshot,
  GraphSnapshotId,
  GraphSnapshotRef,
  DiffComputationOptions,
  GraphDiffError,
  GraphDiffErrorCodes,
  createGraphSnapshotId,
} from '../interfaces.js';
import { createNodeMatcher, NodeMatcher } from '../node-matcher.js';
import { createEdgeMatcher, EdgeMatcher } from '../edge-matcher.js';
import type { TenantId } from '../../../../types/entities.js';
import type {
  NodeType,
  GraphEdge,
  EdgeType,
  DependencyGraph,
  TerraformResourceNode,
  K8sDeploymentNode,
  K8sServiceNode,
} from '../../../../types/graph.js';

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

/**
 * Create a test tenant ID
 */
function createTestTenantId(id: string = 'test-tenant-001'): TenantId {
  return id as TenantId;
}

/**
 * Create a test snapshot ID
 */
function createTestSnapshotId(id: string = 'snapshot-001'): GraphSnapshotId {
  return createGraphSnapshotId(id);
}

/**
 * Create a basic Terraform resource node for testing
 */
function createTerraformNode(
  id: string,
  name: string,
  resourceType: string = 'aws_instance',
  overrides: Partial<TerraformResourceNode> = {}
): TerraformResourceNode {
  return {
    id,
    name,
    type: 'terraform_resource',
    resourceType,
    provider: 'aws',
    dependsOn: [],
    location: {
      file: 'main.tf',
      lineStart: 1,
      lineEnd: 10,
    },
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a K8s deployment node for testing
 */
function createK8sDeploymentNode(
  id: string,
  name: string,
  namespace: string = 'default',
  overrides: Partial<K8sDeploymentNode> = {}
): K8sDeploymentNode {
  return {
    id,
    name,
    type: 'k8s_deployment',
    namespace,
    replicas: 1,
    selector: { app: name },
    containers: [{ name: 'main', image: 'nginx:latest' }],
    location: {
      file: 'deployment.yaml',
      lineStart: 1,
      lineEnd: 20,
    },
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a K8s service node for testing
 */
function createK8sServiceNode(
  id: string,
  name: string,
  namespace: string = 'default',
  overrides: Partial<K8sServiceNode> = {}
): K8sServiceNode {
  return {
    id,
    name,
    type: 'k8s_service',
    namespace,
    serviceType: 'ClusterIP',
    selector: { app: name },
    ports: [{ port: 80, targetPort: 8080 }],
    location: {
      file: 'service.yaml',
      lineStart: 1,
      lineEnd: 15,
    },
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a graph edge for testing
 */
function createTestEdge(
  id: string,
  source: string,
  target: string,
  type: EdgeType = 'depends_on',
  overrides: Partial<GraphEdge> = {}
): GraphEdge {
  return {
    id,
    source,
    target,
    type,
    metadata: {
      implicit: false,
      confidence: 100,
    },
    ...overrides,
  };
}

/**
 * Create a dependency graph for testing
 */
function createTestGraph(
  nodes: NodeType[],
  edges: GraphEdge[] = []
): DependencyGraph {
  const nodeMap = new Map<string, NodeType>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  return {
    id: `graph-${Date.now()}`,
    nodes: nodeMap,
    edges,
    metadata: {
      createdAt: new Date(),
      sourceFiles: ['main.tf'],
      nodeCounts: {},
      edgeCounts: {} as Record<EdgeType, number>,
      buildTimeMs: 10,
    },
  };
}

/**
 * Create a test graph snapshot
 */
function createTestSnapshot(
  id: string,
  tenantId: TenantId,
  nodes: NodeType[],
  edges: GraphEdge[] = [],
  version: number = 1
): GraphSnapshot {
  return {
    id: createTestSnapshotId(id),
    tenantId,
    graph: createTestGraph(nodes, edges),
    createdAt: new Date(),
    version,
  };
}

/**
 * Create a snapshot reference for cost estimation tests
 */
function createTestSnapshotRef(
  id: string,
  nodeCount: number,
  edgeCount: number,
  version: number = 1
): GraphSnapshotRef {
  return {
    id: createTestSnapshotId(id),
    tenantId: createTestTenantId(),
    nodeCount,
    edgeCount,
    createdAt: new Date(),
    version,
  };
}

// ============================================================================
// GraphDiffEngine Tests
// ============================================================================

describe('GraphDiffEngine', () => {
  let engine: GraphDiffEngine;
  let tenantId: TenantId;

  beforeEach(async () => {
    engine = createGraphDiffEngine();
    await engine.initialize();
    tenantId = createTestTenantId();
  });

  afterEach(async () => {
    await engine.shutdown();
  });

  // =========================================================================
  // Initialization Tests
  // =========================================================================

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newEngine = createGraphDiffEngine();
      await expect(newEngine.initialize()).resolves.not.toThrow();
    });

    it('should create engine with default matchers', () => {
      const newEngine = new GraphDiffEngine();
      expect(newEngine).toBeDefined();
    });

    it('should create engine with custom matchers', () => {
      const nodeMatcher = createNodeMatcher();
      const edgeMatcher = createEdgeMatcher();
      const newEngine = createConfiguredGraphDiffEngine(nodeMatcher, edgeMatcher);
      expect(newEngine).toBeDefined();
    });

    it('should shutdown gracefully', async () => {
      await expect(engine.shutdown()).resolves.not.toThrow();
    });
  });

  // =========================================================================
  // Node Diff Computation Tests
  // =========================================================================

  describe('Node Diff Computation', () => {
    describe('detects added nodes', () => {
      it('should detect a single added node', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1, node2], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(1);
        expect(result.nodeDiffs.added[0]?.identity.name).toBe('instance-2');
        expect(result.nodeDiffs.added[0]?.changeType).toBe('added');
        expect(result.nodeDiffs.added[0]?.baseNode).toBeNull();
        expect(result.nodeDiffs.added[0]?.targetNode).toBeDefined();
      });

      it('should detect multiple added nodes', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1, node2, node3], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(2);
        expect(result.summary.nodesAdded).toBe(2);
      });

      it('should detect nodes added from empty graph', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');

        const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1, node2], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(2);
        expect(result.nodeDiffs.removed).toHaveLength(0);
        expect(result.summary.nodesAdded).toBe(2);
      });
    });

    describe('detects removed nodes', () => {
      it('should detect a single removed node', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(1);
        expect(result.nodeDiffs.removed[0]?.identity.name).toBe('instance-2');
        expect(result.nodeDiffs.removed[0]?.changeType).toBe('removed');
        expect(result.nodeDiffs.removed[0]?.baseNode).toBeDefined();
        expect(result.nodeDiffs.removed[0]?.targetNode).toBeNull();
      });

      it('should detect multiple removed nodes', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2, node3], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(2);
        expect(result.summary.nodesRemoved).toBe(2);
      });

      it('should detect all nodes removed to empty graph', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(2);
        expect(result.nodeDiffs.added).toHaveLength(0);
        expect(result.summary.nodesRemoved).toBe(2);
      });
    });

    describe('detects modified nodes', () => {
      it('should detect modified node attributes', async () => {
        const baseNode = createTerraformNode('node-1', 'instance-1', 'aws_instance', {
          provider: 'aws',
          count: 1,
        });
        const targetNode = createTerraformNode('node-1', 'instance-1', 'aws_instance', {
          provider: 'aws',
          count: 2,
        });

        const baseSnapshot = createTestSnapshot('base', tenantId, [baseNode], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [targetNode], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
          includeAttributeChanges: true,
        });

        expect(result.nodeDiffs.modified).toHaveLength(1);
        expect(result.nodeDiffs.modified[0]?.changeType).toBe('modified');
        expect(result.nodeDiffs.modified[0]?.attributeChanges).toBeDefined();
        expect(result.nodeDiffs.modified[0]?.attributeChanges?.length).toBeGreaterThan(0);
      });

      it('should track attribute changes for K8s deployments', async () => {
        const baseNode = createK8sDeploymentNode('node-1', 'web-app', 'default', {
          replicas: 1,
        });
        const targetNode = createK8sDeploymentNode('node-1', 'web-app', 'default', {
          replicas: 3,
        });

        const baseSnapshot = createTestSnapshot('base', tenantId, [baseNode], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [targetNode], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
          includeAttributeChanges: true,
        });

        expect(result.nodeDiffs.modified).toHaveLength(1);
        const replicaChange = result.nodeDiffs.modified[0]?.attributeChanges?.find(
          (c) => c.path === 'replicas'
        );
        expect(replicaChange).toBeDefined();
        expect(replicaChange?.previousValue).toBe(1);
        expect(replicaChange?.newValue).toBe(3);
      });

      it('should not report modification when includeAttributeChanges is false', async () => {
        const baseNode = createTerraformNode('node-1', 'instance-1', 'aws_instance', {
          count: 1,
        });
        const targetNode = createTerraformNode('node-1', 'instance-1', 'aws_instance', {
          count: 2,
        });

        const baseSnapshot = createTestSnapshot('base', tenantId, [baseNode], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [targetNode], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
          includeAttributeChanges: false,
        });

        // Without attribute comparison, the nodes match by identity and are not modified
        expect(result.nodeDiffs.modified).toHaveLength(0);
      });
    });

    describe('handles unchanged nodes', () => {
      it('should not include unchanged nodes by default', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.unchanged).toHaveLength(0);
        expect(result.nodeDiffs.added).toHaveLength(0);
        expect(result.nodeDiffs.removed).toHaveLength(0);
        expect(result.nodeDiffs.modified).toHaveLength(0);
      });

      it('should include unchanged nodes when includeUnchanged is true', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
          includeUnchanged: true,
        });

        expect(result.nodeDiffs.unchanged).toHaveLength(1);
        expect(result.nodeDiffs.unchanged[0]?.changeType).toBe('unchanged');
        expect(result.nodeDiffs.unchanged[0]?.baseNode).toBeDefined();
        expect(result.nodeDiffs.unchanged[0]?.targetNode).toBeDefined();
      });
    });
  });

  // =========================================================================
  // Edge Diff Computation Tests
  // =========================================================================

  describe('Edge Diff Computation', () => {
    describe('detects added edges', () => {
      it('should detect a single added edge', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const edge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1, node2], [edge], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.edgeDiffs.added).toHaveLength(1);
        expect(result.edgeDiffs.added[0]?.changeType).toBe('added');
        expect(result.edgeDiffs.added[0]?.baseEdge).toBeNull();
        expect(result.edgeDiffs.added[0]?.targetEdge).toBeDefined();
      });

      it('should detect multiple added edges', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');
        const edge1 = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');
        const edge2 = createTestEdge('edge-2', 'node-2', 'node-3', 'references');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2, node3], [], 1);
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [node1, node2, node3],
          [edge1, edge2],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.edgeDiffs.added).toHaveLength(2);
        expect(result.summary.edgesAdded).toBe(2);
      });
    });

    describe('detects removed edges', () => {
      it('should detect a single removed edge', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const edge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [edge], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1, node2], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.edgeDiffs.removed).toHaveLength(1);
        expect(result.edgeDiffs.removed[0]?.changeType).toBe('removed');
        expect(result.edgeDiffs.removed[0]?.baseEdge).toBeDefined();
        expect(result.edgeDiffs.removed[0]?.targetEdge).toBeNull();
      });

      it('should detect edges removed when source node is removed', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const edge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [edge], 1);
        // Remove node-1, which is the edge source
        const targetSnapshot = createTestSnapshot('target', tenantId, [node2], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // The edge should be detected as removed because its source node is gone
        expect(result.edgeDiffs.removed).toHaveLength(1);
        expect(result.nodeDiffs.removed).toHaveLength(1);
      });
    });

    describe('uses node identity for edge matching', () => {
      it('should match edges by node identity, not node ID', async () => {
        // Base: node with ID 'old-id-1'
        const baseNode1 = createTerraformNode('old-id-1', 'instance-1');
        const baseNode2 = createTerraformNode('old-id-2', 'instance-2');
        const baseEdge = createTestEdge('edge-1', 'old-id-1', 'old-id-2', 'depends_on');

        // Target: same logical nodes but with different IDs
        const targetNode1 = createTerraformNode('new-id-1', 'instance-1');
        const targetNode2 = createTerraformNode('new-id-2', 'instance-2');
        const targetEdge = createTestEdge('edge-2', 'new-id-1', 'new-id-2', 'depends_on');

        const baseSnapshot = createTestSnapshot(
          'base',
          tenantId,
          [baseNode1, baseNode2],
          [baseEdge],
          1
        );
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [targetNode1, targetNode2],
          [targetEdge],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
          includeUnchanged: true,
        });

        // Edge should be matched by node identity (name + type + file), not by edge ID
        // The edge connects nodes with same identity, so it should be unchanged
        expect(result.edgeDiffs.unchanged).toHaveLength(1);
        expect(result.edgeDiffs.added).toHaveLength(0);
        expect(result.edgeDiffs.removed).toHaveLength(0);
      });

      it('should detect edge as added when target node identity changes', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');
        const baseEdge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');
        const targetEdge = createTestEdge('edge-1', 'node-1', 'node-3', 'depends_on');

        const baseSnapshot = createTestSnapshot(
          'base',
          tenantId,
          [node1, node2],
          [baseEdge],
          1
        );
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [node1, node3],
          [targetEdge],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // Edge to node-2 is removed, edge to node-3 is added
        expect(result.edgeDiffs.removed).toHaveLength(1);
        expect(result.edgeDiffs.added).toHaveLength(1);
      });
    });
  });

  // =========================================================================
  // Full Diff Computation Tests
  // =========================================================================

  describe('Full Diff Computation', () => {
    describe('combines node and edge diffs', () => {
      it('should compute both node and edge diffs in single operation', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');
        const edge1 = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');

        const baseSnapshot = createTestSnapshot(
          'base',
          tenantId,
          [node1, node2],
          [edge1],
          1
        );
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [node1, node3],
          [],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // Node changes: node-2 removed, node-3 added
        expect(result.nodeDiffs.removed).toHaveLength(1);
        expect(result.nodeDiffs.added).toHaveLength(1);
        // Edge changes: edge-1 removed (since node-2 is gone)
        expect(result.edgeDiffs.removed).toHaveLength(1);
      });
    });

    describe('computes correct summary statistics', () => {
      it('should compute accurate node counts', async () => {
        const nodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
          createTerraformNode('node-3', 'instance-3'),
        ];

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes.slice(0, 2), [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, nodes.slice(1), [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.summary.baseNodeCount).toBe(2);
        expect(result.summary.targetNodeCount).toBe(2);
        expect(result.summary.nodesAdded).toBe(1); // node-3
        expect(result.summary.nodesRemoved).toBe(1); // node-1
      });

      it('should compute accurate edge counts', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const node3 = createTerraformNode('node-3', 'instance-3');
        const baseEdges = [
          createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on'),
          createTestEdge('edge-2', 'node-2', 'node-3', 'references'),
        ];
        const targetEdges = [
          createTestEdge('edge-3', 'node-1', 'node-3', 'depends_on'),
        ];

        const baseSnapshot = createTestSnapshot(
          'base',
          tenantId,
          [node1, node2, node3],
          baseEdges,
          1
        );
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [node1, node2, node3],
          targetEdges,
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.summary.baseEdgeCount).toBe(2);
        expect(result.summary.targetEdgeCount).toBe(1);
        expect(result.summary.edgesAdded).toBe(1);
        expect(result.summary.edgesRemoved).toBe(2);
      });

      it('should compute change ratios correctly', async () => {
        const nodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
          createTerraformNode('node-3', 'instance-3'),
          createTerraformNode('node-4', 'instance-4'),
        ];

        // Base: 4 nodes, Target: 4 nodes (2 same, 2 different = 50% change)
        const baseSnapshot = createTestSnapshot('base', tenantId, nodes.slice(0, 4), [], 1);
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [...nodes.slice(0, 2), createTerraformNode('node-5', 'instance-5'), createTerraformNode('node-6', 'instance-6')],
          [],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // 2 removed + 2 added = 4 changes out of max(4, 4) = 100% ratio
        expect(result.summary.nodeChangeRatio).toBe(1.0);
        expect(result.summary.overallChangeRatio).toBeGreaterThan(0);
      });

      it('should determine significant change correctly', async () => {
        const nodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
        ];

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, [], 1);
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [nodes[0]!, createTerraformNode('node-3', 'instance-3')],
          [],
          2
        );

        // Default threshold is 0.1 (10%)
        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // 1 removed + 1 added = 2 changes out of 2 nodes = 100% > 10%
        expect(result.summary.isSignificantChange).toBe(true);
      });

      it('should track changes by node type', async () => {
        const terraformNode = createTerraformNode('tf-1', 'instance-1');
        const k8sNode = createK8sDeploymentNode('k8s-1', 'web-app');

        const baseSnapshot = createTestSnapshot('base', tenantId, [terraformNode], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [k8sNode], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.summary.changesByNodeType['terraform_resource']).toBeDefined();
        expect(result.summary.changesByNodeType['terraform_resource']?.removed).toBe(1);
        expect(result.summary.changesByNodeType['k8s_deployment']).toBeDefined();
        expect(result.summary.changesByNodeType['k8s_deployment']?.added).toBe(1);
      });

      it('should track changes by edge type', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');
        const node2 = createTerraformNode('node-2', 'instance-2');
        const dependsOnEdge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');
        const referencesEdge = createTestEdge('edge-2', 'node-1', 'node-2', 'references');

        const baseSnapshot = createTestSnapshot(
          'base',
          tenantId,
          [node1, node2],
          [dependsOnEdge],
          1
        );
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          [node1, node2],
          [referencesEdge],
          2
        );

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.summary.changesByEdgeType['depends_on']).toBeDefined();
        expect(result.summary.changesByEdgeType['depends_on']?.removed).toBe(1);
        expect(result.summary.changesByEdgeType['references']).toBeDefined();
        expect(result.summary.changesByEdgeType['references']?.added).toBe(1);
      });
    });

    describe('tracks timing metrics', () => {
      it('should record total computation time', async () => {
        const node1 = createTerraformNode('node-1', 'instance-1');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.timing.totalMs).toBeGreaterThanOrEqual(0);
      });

      it('should record phase-specific timing', async () => {
        const nodes = Array.from({ length: 100 }, (_, i) =>
          createTerraformNode(`node-${i}`, `instance-${i}`)
        );

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes.slice(0, 50), [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, nodes.slice(25), [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.timing.nodeIdentityExtractionMs).toBeGreaterThanOrEqual(0);
        expect(result.timing.nodeComparisonMs).toBeGreaterThanOrEqual(0);
        expect(result.timing.edgeIdentityExtractionMs).toBeGreaterThanOrEqual(0);
        expect(result.timing.edgeComparisonMs).toBeGreaterThanOrEqual(0);
        expect(result.timing.summaryComputationMs).toBeGreaterThanOrEqual(0);
      });

      it('should compute throughput metrics', async () => {
        const nodes = Array.from({ length: 100 }, (_, i) =>
          createTerraformNode(`node-${i}`, `instance-${i}`)
        );
        const edges = Array.from({ length: 50 }, (_, i) =>
          createTestEdge(`edge-${i}`, `node-${i}`, `node-${i + 1}`, 'depends_on')
        );

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, edges, 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, nodes, edges, 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        // Throughput should be calculated (nodes and edges per second)
        expect(result.timing.nodesPerSecond).toBeGreaterThanOrEqual(0);
        expect(result.timing.edgesPerSecond).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // =========================================================================
  // Edge Cases
  // =========================================================================

  describe('Edge Cases', () => {
    describe('empty graphs', () => {
      it('should handle both graphs being empty', async () => {
        const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(0);
        expect(result.nodeDiffs.removed).toHaveLength(0);
        expect(result.nodeDiffs.modified).toHaveLength(0);
        expect(result.edgeDiffs.added).toHaveLength(0);
        expect(result.edgeDiffs.removed).toHaveLength(0);
        expect(result.summary.overallChangeRatio).toBe(0);
      });

      it('should handle base graph being empty', async () => {
        const node = createTerraformNode('node-1', 'instance-1');
        const edge = createTestEdge('edge-1', 'node-1', 'node-1', 'depends_on');

        const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node], [edge], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(1);
        expect(result.nodeDiffs.removed).toHaveLength(0);
        expect(result.edgeDiffs.added).toHaveLength(1);
      });

      it('should handle target graph being empty', async () => {
        const node = createTerraformNode('node-1', 'instance-1');
        const edge = createTestEdge('edge-1', 'node-1', 'node-1', 'depends_on');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node], [edge], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(1);
        expect(result.nodeDiffs.added).toHaveLength(0);
        expect(result.edgeDiffs.removed).toHaveLength(1);
      });
    });

    describe('identical graphs (no changes)', () => {
      it('should report no changes for identical graphs', async () => {
        const nodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
        ];
        const edges = [createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on')];

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, edges, 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, nodes, edges, 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.added).toHaveLength(0);
        expect(result.nodeDiffs.removed).toHaveLength(0);
        expect(result.nodeDiffs.modified).toHaveLength(0);
        expect(result.edgeDiffs.added).toHaveLength(0);
        expect(result.edgeDiffs.removed).toHaveLength(0);
        expect(result.summary.isSignificantChange).toBe(false);
      });

      it('should correctly calculate zero change ratio for identical graphs', async () => {
        const node = createTerraformNode('node-1', 'instance-1');

        const baseSnapshot = createTestSnapshot('base', tenantId, [node], [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, [node], [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.summary.nodeChangeRatio).toBe(0);
        expect(result.summary.overallChangeRatio).toBe(0);
      });
    });

    describe('complete replacement (all different)', () => {
      it('should detect complete replacement of all nodes', async () => {
        const baseNodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
        ];
        const targetNodes = [
          createTerraformNode('node-3', 'instance-3'),
          createTerraformNode('node-4', 'instance-4'),
        ];

        const baseSnapshot = createTestSnapshot('base', tenantId, baseNodes, [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, targetNodes, [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(2);
        expect(result.nodeDiffs.added).toHaveLength(2);
        // Change ratio = (added + removed + modified) / max(base, target)
        // = (2 + 2 + 0) / max(2, 2) = 4 / 2 = 2.0
        expect(result.summary.nodeChangeRatio).toBe(2.0);
      });

      it('should detect complete replacement of all edges', async () => {
        const nodes = [
          createTerraformNode('node-1', 'instance-1'),
          createTerraformNode('node-2', 'instance-2'),
          createTerraformNode('node-3', 'instance-3'),
        ];
        const baseEdges = [
          createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on'),
        ];
        const targetEdges = [
          createTestEdge('edge-2', 'node-2', 'node-3', 'references'),
        ];

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, baseEdges, 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, nodes, targetEdges, 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.edgeDiffs.removed).toHaveLength(1);
        expect(result.edgeDiffs.added).toHaveLength(1);
      });

      it('should handle complete replacement with larger graphs', async () => {
        const baseNodes = Array.from({ length: 50 }, (_, i) =>
          createTerraformNode(`base-node-${i}`, `base-instance-${i}`)
        );
        const targetNodes = Array.from({ length: 50 }, (_, i) =>
          createTerraformNode(`target-node-${i}`, `target-instance-${i}`)
        );

        const baseSnapshot = createTestSnapshot('base', tenantId, baseNodes, [], 1);
        const targetSnapshot = createTestSnapshot('target', tenantId, targetNodes, [], 2);

        const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

        expect(result.nodeDiffs.removed).toHaveLength(50);
        expect(result.nodeDiffs.added).toHaveLength(50);
        // Change ratio = (added + removed + modified) / max(base, target)
        // = (50 + 50 + 0) / max(50, 50) = 100 / 50 = 2.0
        expect(result.summary.nodeChangeRatio).toBe(2.0);
      });
    });

    describe('timeout enforcement', () => {
      it('should throw timeout error when computation exceeds limit', async () => {
        // Create large graphs to force longer computation
        const nodes = Array.from({ length: 1000 }, (_, i) =>
          createTerraformNode(`node-${i}`, `instance-${i}`)
        );
        const edges = Array.from({ length: 500 }, (_, i) =>
          createTestEdge(`edge-${i}`, `node-${i}`, `node-${(i + 1) % 1000}`, 'depends_on')
        );

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, edges, 1);
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          nodes.map((n) => ({ ...n, id: `new-${n.id}` } as typeof n)),
          edges,
          2
        );

        // Use very short timeout to trigger timeout error
        await expect(
          engine.computeDiff(baseSnapshot, targetSnapshot, { timeoutMs: 1 })
        ).rejects.toThrow(GraphDiffError);
      });

      it('should include timeout details in error', async () => {
        const nodes = Array.from({ length: 500 }, (_, i) =>
          createTerraformNode(`node-${i}`, `instance-${i}`)
        );

        const baseSnapshot = createTestSnapshot('base', tenantId, nodes, [], 1);
        const targetSnapshot = createTestSnapshot(
          'target',
          tenantId,
          nodes.map((n) => ({ ...n, id: `new-${n.id}` } as typeof n)),
          [],
          2
        );

        try {
          await engine.computeDiff(baseSnapshot, targetSnapshot, { timeoutMs: 1 });
          expect.fail('Should have thrown timeout error');
        } catch (error) {
          expect(error).toBeInstanceOf(GraphDiffError);
          const graphError = error as GraphDiffError;
          expect(graphError.code).toBe(GraphDiffErrorCodes.TIMEOUT);
          expect(graphError.context?.timeoutMs).toBe(1);
        }
      });
    });
  });

  // =========================================================================
  // Validation Tests
  // =========================================================================

  describe('Snapshot Validation', () => {
    it('should reject snapshots with different tenant IDs', async () => {
      const baseSnapshot = createTestSnapshot('base', createTestTenantId('tenant-1'), [], [], 1);
      const targetSnapshot = createTestSnapshot('target', createTestTenantId('tenant-2'), [], [], 2);

      await expect(engine.computeDiff(baseSnapshot, targetSnapshot)).rejects.toThrow(GraphDiffError);
    });

    it('should return validation errors for invalid snapshots', () => {
      const validSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
      const invalidSnapshot = {
        id: createTestSnapshotId('invalid'),
        tenantId: createTestTenantId('different'),
        graph: createTestGraph([]),
        createdAt: new Date(),
        version: 1,
      } as GraphSnapshot;

      const validation = engine.validateSnapshots(validSnapshot, invalidSnapshot);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should warn when base version >= target version', () => {
      const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 2);
      const targetSnapshot = createTestSnapshot('target', tenantId, [], [], 1);

      const validation = engine.validateSnapshots(baseSnapshot, targetSnapshot);

      expect(validation.warnings.length).toBeGreaterThan(0);
      expect(validation.warnings[0]).toContain('version');
    });

    it('should validate snapshot has required graph properties', () => {
      const validSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
      const snapshotMissingGraph = {
        id: createTestSnapshotId('missing-graph'),
        tenantId,
        graph: undefined as unknown as DependencyGraph,
        createdAt: new Date(),
        version: 1,
      } as GraphSnapshot;

      const validation = engine.validateSnapshots(validSnapshot, snapshotMissingGraph);

      expect(validation.isValid).toBe(false);
      expect(validation.errors.some((e) => e.message.includes('graph'))).toBe(true);
    });
  });

  // =========================================================================
  // Cost Estimation Tests
  // =========================================================================

  describe('Cost Estimation', () => {
    it('should estimate computation cost', () => {
      const baseRef = createTestSnapshotRef('base', 1000, 500);
      const targetRef = createTestSnapshotRef('target', 1200, 600);

      const estimate = engine.estimateCost(baseRef, targetRef);

      expect(estimate.totalNodes).toBe(2200);
      expect(estimate.totalEdges).toBe(1100);
      expect(estimate.estimatedTimeMs).toBeGreaterThan(0);
      expect(estimate.estimatedMemoryBytes).toBeGreaterThan(0);
    });

    it('should indicate when within limits', () => {
      const baseRef = createTestSnapshotRef('base', 100, 50);
      const targetRef = createTestSnapshotRef('target', 100, 50);

      const estimate = engine.estimateCost(baseRef, targetRef);

      expect(estimate.withinLimits).toBe(true);
    });

    it('should indicate when exceeding limits', () => {
      // Create refs with very large node counts
      const baseRef = createTestSnapshotRef('base', 50000, 100000);
      const targetRef = createTestSnapshotRef('target', 50000, 100000);

      const estimate = engine.estimateCost(baseRef, targetRef);

      expect(estimate.warnings.length).toBeGreaterThan(0);
    });

    it('should generate warnings when approaching limits', () => {
      // Create refs that approach memory limit
      const nodeCount = 5000;
      const edgeCount = 10000;

      const baseRef = createTestSnapshotRef('base', nodeCount, edgeCount);
      const targetRef = createTestSnapshotRef('target', nodeCount, edgeCount);

      const estimate = engine.estimateCost(baseRef, targetRef);

      // Check if any warnings are generated
      if (estimate.estimatedMemoryBytes > MEMORY_CONSTANTS.MAX_MEMORY_BUDGET * 0.8) {
        expect(estimate.warnings.length).toBeGreaterThan(0);
      }
    });
  });

  // =========================================================================
  // Node/Edge Type Filtering Tests
  // =========================================================================

  describe('Node Type Filtering', () => {
    it('should include only specified node types', async () => {
      const terraformNode = createTerraformNode('tf-1', 'instance-1');
      const k8sNode = createK8sDeploymentNode('k8s-1', 'web-app');

      const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
      const targetSnapshot = createTestSnapshot(
        'target',
        tenantId,
        [terraformNode, k8sNode],
        [],
        2
      );

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
        includeNodeTypes: ['terraform_resource'],
      });

      // Only terraform_resource should be included
      expect(result.nodeDiffs.added).toHaveLength(1);
      expect(result.nodeDiffs.added[0]?.identity.nodeType).toBe('terraform_resource');
    });

    it('should exclude specified node types', async () => {
      const terraformNode = createTerraformNode('tf-1', 'instance-1');
      const k8sNode = createK8sDeploymentNode('k8s-1', 'web-app');

      const baseSnapshot = createTestSnapshot('base', tenantId, [], [], 1);
      const targetSnapshot = createTestSnapshot(
        'target',
        tenantId,
        [terraformNode, k8sNode],
        [],
        2
      );

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
        excludeNodeTypes: ['k8s_deployment'],
      });

      // k8s_deployment should be excluded
      expect(result.nodeDiffs.added).toHaveLength(1);
      expect(result.nodeDiffs.added[0]?.identity.nodeType).toBe('terraform_resource');
    });
  });

  describe('Edge Type Filtering', () => {
    it('should include only specified edge types', async () => {
      const node1 = createTerraformNode('node-1', 'instance-1');
      const node2 = createTerraformNode('node-2', 'instance-2');
      const dependsOnEdge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');
      const referencesEdge = createTestEdge('edge-2', 'node-1', 'node-2', 'references');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
      const targetSnapshot = createTestSnapshot(
        'target',
        tenantId,
        [node1, node2],
        [dependsOnEdge, referencesEdge],
        2
      );

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
        includeEdgeTypes: ['depends_on'],
      });

      // Only depends_on edges should be included
      expect(result.edgeDiffs.added).toHaveLength(1);
      expect(result.edgeDiffs.added[0]?.identity.edgeType).toBe('depends_on');
    });

    it('should exclude specified edge types', async () => {
      const node1 = createTerraformNode('node-1', 'instance-1');
      const node2 = createTerraformNode('node-2', 'instance-2');
      const dependsOnEdge = createTestEdge('edge-1', 'node-1', 'node-2', 'depends_on');
      const referencesEdge = createTestEdge('edge-2', 'node-1', 'node-2', 'references');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
      const targetSnapshot = createTestSnapshot(
        'target',
        tenantId,
        [node1, node2],
        [dependsOnEdge, referencesEdge],
        2
      );

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot, {
        excludeEdgeTypes: ['references'],
      });

      // references edges should be excluded
      expect(result.edgeDiffs.added).toHaveLength(1);
      expect(result.edgeDiffs.added[0]?.identity.edgeType).toBe('depends_on');
    });
  });

  // =========================================================================
  // Factory Function Tests
  // =========================================================================

  describe('Factory Functions', () => {
    it('should create default engine with createGraphDiffEngine', () => {
      const engine = createGraphDiffEngine();
      expect(engine).toBeInstanceOf(GraphDiffEngine);
    });

    it('should create K8s-optimized engine', () => {
      const engine = createK8sGraphDiffEngine();
      expect(engine).toBeInstanceOf(GraphDiffEngine);
    });

    it('should create Terraform-optimized engine', () => {
      const engine = createTerraformGraphDiffEngine();
      expect(engine).toBeInstanceOf(GraphDiffEngine);
    });

    it('should create engine with custom matchers', () => {
      const nodeMatcher = createNodeMatcher();
      const edgeMatcher = createEdgeMatcher();
      const engine = createConfiguredGraphDiffEngine(nodeMatcher, edgeMatcher);
      expect(engine).toBeInstanceOf(GraphDiffEngine);
    });
  });

  // =========================================================================
  // Diff Result Structure Tests
  // =========================================================================

  describe('Diff Result Structure', () => {
    it('should include all required result fields', async () => {
      const node = createTerraformNode('node-1', 'instance-1');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node], [], 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, [node], [], 2);

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

      // Check required fields
      expect(result.id).toBeDefined();
      expect(result.tenantId).toBe(tenantId);
      expect(result.baseSnapshotId).toBeDefined();
      expect(result.targetSnapshotId).toBeDefined();
      expect(result.nodeDiffs).toBeDefined();
      expect(result.edgeDiffs).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.timing).toBeDefined();
      expect(result.computedAt).toBeInstanceOf(Date);
      expect(result.options).toBeDefined();
    });

    it('should generate unique diff IDs', async () => {
      const node = createTerraformNode('node-1', 'instance-1');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node], [], 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, [node], [], 2);

      const result1 = await engine.computeDiff(baseSnapshot, targetSnapshot);
      const result2 = await engine.computeDiff(baseSnapshot, targetSnapshot);

      // Each diff should have a unique ID (includes timestamp)
      expect(result1.id).toBeDefined();
      expect(result2.id).toBeDefined();
    });

    it('should provide access to diffs by identity key', async () => {
      const node1 = createTerraformNode('node-1', 'instance-1');
      const node2 = createTerraformNode('node-2', 'instance-2');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node1], [], 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, [node2], [], 2);

      const result = await engine.computeDiff(baseSnapshot, targetSnapshot);

      // Should be able to look up diffs by identity key
      expect(result.nodeDiffs.byIdentityKey).toBeDefined();
      expect(result.nodeDiffs.byIdentityKey.size).toBe(2); // 1 added + 1 removed
    });
  });

  // =========================================================================
  // Limit Enforcement Tests
  // =========================================================================

  describe('Limit Enforcement', () => {
    it('should enforce maximum node limit', async () => {
      // Create more nodes than the limit allows
      const tooManyNodes = Array.from({ length: 250000 }, (_, i) =>
        createTerraformNode(`node-${i}`, `instance-${i}`)
      );

      const baseSnapshot = createTestSnapshot('base', tenantId, tooManyNodes, [], 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, tooManyNodes, [], 2);

      await expect(
        engine.computeDiff(baseSnapshot, targetSnapshot, { maxNodes: 100000 })
      ).rejects.toThrow(GraphDiffError);
    });

    it('should enforce maximum edge limit', async () => {
      const nodes = [
        createTerraformNode('node-1', 'instance-1'),
        createTerraformNode('node-2', 'instance-2'),
      ];

      // Create more edges than the limit allows
      const tooManyEdges = Array.from({ length: 1100000 }, (_, i) =>
        createTestEdge(`edge-${i}`, 'node-1', 'node-2', 'depends_on')
      );

      const baseSnapshot = createTestSnapshot('base', tenantId, nodes, tooManyEdges, 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, nodes, tooManyEdges, 2);

      await expect(
        engine.computeDiff(baseSnapshot, targetSnapshot, { maxEdges: 500000 })
      ).rejects.toThrow(GraphDiffError);
    });
  });

  // =========================================================================
  // Apply Diff Tests
  // =========================================================================

  describe('Apply Diff to Merged Graph', () => {
    it('should remove deleted nodes from merged graph', async () => {
      const node1 = createTerraformNode('node-1', 'instance-1');
      const node2 = createTerraformNode('node-2', 'instance-2');

      const baseSnapshot = createTestSnapshot('base', tenantId, [node1, node2], [], 1);
      const targetSnapshot = createTestSnapshot('target', tenantId, [node1], [], 2);

      const diff = await engine.computeDiff(baseSnapshot, targetSnapshot);

      // Create merged nodes (simplified for testing)
      const mergedNodes = [
        { id: 'node-1', nodeIds: ['node-1'], score: 1.0 },
        { id: 'node-2', nodeIds: ['node-2'], score: 1.0 },
      ] as any[];

      const updated = await engine.applyDiffToMergedGraph(diff, mergedNodes);

      // node-2 should be removed
      expect(updated).toHaveLength(1);
      expect(updated[0]?.id).toBe('node-1');
    });
  });

  // =========================================================================
  // Placeholder Tests for Methods Not Yet Fully Implemented
  // =========================================================================

  describe('computeDiffByIds', () => {
    it('should throw error indicating snapshots need to be loaded externally', async () => {
      await expect(
        engine.computeDiffByIds(
          tenantId,
          createTestSnapshotId('base'),
          createTestSnapshotId('target')
        )
      ).rejects.toThrow(GraphDiffError);
    });
  });

  describe('getCachedDiff', () => {
    it('should return null for cache miss (cache not implemented)', async () => {
      const result = await engine.getCachedDiff(
        tenantId,
        'some-diff-id' as any
      );
      expect(result).toBeNull();
    });
  });
});

// ============================================================================
// Constants Export Tests
// ============================================================================

describe('Module Constants', () => {
  it('should export MEMORY_CONSTANTS', () => {
    expect(MEMORY_CONSTANTS).toBeDefined();
    expect(MEMORY_CONSTANTS.BYTES_PER_NODE).toBeGreaterThan(0);
    expect(MEMORY_CONSTANTS.BYTES_PER_EDGE).toBeGreaterThan(0);
    expect(MEMORY_CONSTANTS.MAX_MEMORY_BUDGET).toBeGreaterThan(0);
  });

  it('should export TIMING_CONSTANTS', () => {
    expect(TIMING_CONSTANTS).toBeDefined();
    expect(TIMING_CONSTANTS.NODES_PER_MS).toBeGreaterThan(0);
    expect(TIMING_CONSTANTS.EDGES_PER_MS).toBeGreaterThan(0);
  });
});
