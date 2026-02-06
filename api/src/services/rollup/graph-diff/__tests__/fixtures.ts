/**
 * Graph Diff Test Fixtures
 * @module services/rollup/graph-diff/__tests__/fixtures
 *
 * Comprehensive test fixtures for the Graph Diff Computation system.
 * Provides factory functions for creating test nodes, edges, graphs,
 * snapshots, diff results, and identity objects.
 *
 * TASK-ROLLUP-005: Graph Diff Computation for incremental rollup execution
 */

import { randomUUID } from 'crypto';
import type {
  NodeType,
  TerraformResourceNode,
  TerraformDataNode,
  TerraformModuleNode,
  K8sDeploymentNode,
  K8sServiceNode,
  K8sConfigMapNode,
  GraphEdge,
  DependencyGraph,
  EdgeType,
  NodeLocation,
} from '../../../../types/graph.js';
import type { TenantId, RepositoryId, ScanId } from '../../../../types/entities.js';
import {
  type GraphDiffId,
  type GraphSnapshotId,
  type NodeIdentityKey,
  type EdgeIdentityKey,
  type NodeIdentity,
  type EdgeIdentity,
  type NodeDiff,
  type EdgeDiff,
  type NodeDiffSet,
  type EdgeDiffSet,
  type DiffSummary,
  type GraphDiffResult,
  type GraphSnapshot,
  type GraphSnapshotRef,
  type DiffTiming,
  type DiffComputationOptions,
  type AttributeChange,
  type DiffChangeType,
  createGraphDiffId,
  createGraphSnapshotId,
  createNodeIdentityKey,
  createEdgeIdentityKey,
  DEFAULT_DIFF_COMPUTATION_OPTIONS,
} from '../interfaces.js';

// ============================================================================
// ID Generators
// ============================================================================

/**
 * Create a test TenantId
 */
export function createTestTenantId(): TenantId {
  return randomUUID() as TenantId;
}

/**
 * Create a test RepositoryId
 */
export function createTestRepositoryId(): RepositoryId {
  return randomUUID() as RepositoryId;
}

/**
 * Create a test ScanId
 */
export function createTestScanId(): ScanId {
  return randomUUID() as ScanId;
}

/**
 * Create a test GraphDiffId
 */
export function createTestGraphDiffId(): GraphDiffId {
  return createGraphDiffId(`diff_${randomUUID()}`);
}

/**
 * Create a test GraphSnapshotId
 */
export function createTestGraphSnapshotId(): GraphSnapshotId {
  return createGraphSnapshotId(`snapshot_${randomUUID()}`);
}

// ============================================================================
// Node Location Factory
// ============================================================================

/**
 * Create a test NodeLocation
 */
export function createTestNodeLocation(
  overrides: Partial<NodeLocation> = {}
): NodeLocation {
  return {
    file: overrides.file ?? 'main.tf',
    lineStart: overrides.lineStart ?? 1,
    lineEnd: overrides.lineEnd ?? 10,
    columnStart: overrides.columnStart,
    columnEnd: overrides.columnEnd,
  };
}

// ============================================================================
// Node Fixtures
// ============================================================================

/**
 * Create a generic test node with configurable type
 */
export function createTestNode(
  overrides: Partial<NodeType> = {}
): NodeType {
  const id = (overrides as { id?: string }).id ?? `node_${randomUUID()}`;
  const name = (overrides as { name?: string }).name ?? 'test_resource.example';

  // Default to terraform_resource type
  return {
    id,
    name,
    type: 'terraform_resource',
    resourceType: 'aws_instance',
    provider: 'aws',
    dependsOn: [],
    location: createTestNodeLocation(),
    metadata: {
      arn: `arn:aws:ec2:us-east-1:123456789012:instance/i-${randomUUID().slice(0, 8)}`,
      instance_type: 't3.micro',
      tags: {
        Environment: 'test',
        Project: 'test-project',
      },
    },
    ...overrides,
  } as TerraformResourceNode;
}

/**
 * Create a test Terraform resource node
 */
export function createTestTerraformNode(
  overrides: Partial<TerraformResourceNode> = {}
): TerraformResourceNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'aws_s3_bucket.example';
  const resourceType = overrides.resourceType ?? 'aws_s3_bucket';

  return {
    id,
    name,
    type: 'terraform_resource',
    resourceType,
    provider: overrides.provider ?? 'aws',
    providerAlias: overrides.providerAlias,
    dependsOn: overrides.dependsOn ?? [],
    count: overrides.count,
    forEach: overrides.forEach,
    location: overrides.location ?? createTestNodeLocation(),
    metadata: overrides.metadata ?? {
      arn: `arn:aws:s3:::bucket-${randomUUID().slice(0, 8)}`,
      bucket: `bucket-${randomUUID().slice(0, 8)}`,
      region: 'us-east-1',
      tags: {
        Environment: 'production',
        Project: 'test-project',
      },
    },
  };
}

/**
 * Create a test Terraform data source node
 */
export function createTestTerraformDataNode(
  overrides: Partial<TerraformDataNode> = {}
): TerraformDataNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'data.aws_ami.latest';

  return {
    id,
    name,
    type: 'terraform_data',
    dataType: overrides.dataType ?? 'aws_ami',
    provider: overrides.provider ?? 'aws',
    providerAlias: overrides.providerAlias,
    location: overrides.location ?? createTestNodeLocation(),
    metadata: overrides.metadata ?? {
      arn: 'arn:aws:ec2:us-east-1::image/ami-12345678',
    },
  };
}

/**
 * Create a test Terraform module node
 */
export function createTestTerraformModuleNode(
  overrides: Partial<TerraformModuleNode> = {}
): TerraformModuleNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'module.vpc';

  return {
    id,
    name,
    type: 'terraform_module',
    source: overrides.source ?? './modules/vpc',
    sourceType: overrides.sourceType ?? 'local',
    version: overrides.version,
    providers: overrides.providers ?? {},
    location: overrides.location ?? createTestNodeLocation(),
    metadata: overrides.metadata ?? {},
  };
}

/**
 * Create a test Kubernetes deployment node
 */
export function createTestK8sNode(
  overrides: Partial<K8sDeploymentNode> = {}
): K8sDeploymentNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'nginx-deployment';

  return {
    id,
    name,
    type: 'k8s_deployment',
    namespace: overrides.namespace ?? 'default',
    replicas: overrides.replicas ?? 3,
    selector: overrides.selector ?? { app: 'nginx' },
    containers: overrides.containers ?? [
      {
        name: 'nginx',
        image: 'nginx:latest',
        ports: [{ containerPort: 80 }],
      },
    ],
    location: overrides.location ?? createTestNodeLocation({ file: 'deployment.yaml' }),
    metadata: overrides.metadata ?? {
      labels: {
        app: 'nginx',
        environment: 'production',
      },
    },
  };
}

/**
 * Create a test Kubernetes service node
 */
export function createTestK8sServiceNode(
  overrides: Partial<K8sServiceNode> = {}
): K8sServiceNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'nginx-service';

  return {
    id,
    name,
    type: 'k8s_service',
    namespace: overrides.namespace ?? 'default',
    serviceType: overrides.serviceType ?? 'ClusterIP',
    selector: overrides.selector ?? { app: 'nginx' },
    ports: overrides.ports ?? [
      {
        port: 80,
        targetPort: 80,
        protocol: 'TCP',
      },
    ],
    location: overrides.location ?? createTestNodeLocation({ file: 'service.yaml' }),
    metadata: overrides.metadata ?? {
      labels: {
        app: 'nginx',
      },
    },
  };
}

/**
 * Create a test Kubernetes ConfigMap node
 */
export function createTestK8sConfigMapNode(
  overrides: Partial<K8sConfigMapNode> = {}
): K8sConfigMapNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'app-config';

  return {
    id,
    name,
    type: 'k8s_configmap',
    namespace: overrides.namespace ?? 'default',
    dataKeys: overrides.dataKeys ?? ['config.yaml', 'settings.json'],
    location: overrides.location ?? createTestNodeLocation({ file: 'configmap.yaml' }),
    metadata: overrides.metadata ?? {
      labels: {
        app: 'myapp',
      },
    },
  };
}

/**
 * Create multiple test nodes
 */
export function createTestNodes(
  count: number,
  factory: (index: number) => NodeType = (i) =>
    createTestTerraformNode({ id: `node_${i}`, name: `aws_resource.resource_${i}` })
): NodeType[] {
  return Array.from({ length: count }, (_, i) => factory(i));
}

// ============================================================================
// Edge Fixtures
// ============================================================================

/**
 * Create a test edge between two nodes
 */
export function createTestEdge(
  source: string,
  target: string,
  type: EdgeType = 'depends_on',
  overrides: Partial<GraphEdge> = {}
): GraphEdge {
  return {
    id: overrides.id ?? `edge_${randomUUID()}`,
    source,
    target,
    type,
    label: overrides.label,
    metadata: overrides.metadata ?? {
      implicit: false,
      confidence: 100,
    },
  };
}

/**
 * Create multiple edges forming a chain
 */
export function createTestEdgeChain(
  nodeIds: string[],
  edgeType: EdgeType = 'depends_on'
): GraphEdge[] {
  const edges: GraphEdge[] = [];
  for (let i = 0; i < nodeIds.length - 1; i++) {
    edges.push(createTestEdge(nodeIds[i], nodeIds[i + 1], edgeType));
  }
  return edges;
}

/**
 * Create edges connecting a source to multiple targets
 */
export function createTestEdgeFanOut(
  sourceId: string,
  targetIds: string[],
  edgeType: EdgeType = 'depends_on'
): GraphEdge[] {
  return targetIds.map((targetId) => createTestEdge(sourceId, targetId, edgeType));
}

// ============================================================================
// Graph Fixtures
// ============================================================================

/**
 * Create a test dependency graph
 */
export function createTestGraph(
  nodeCount: number,
  edgeCount: number,
  overrides: Partial<DependencyGraph> = {}
): DependencyGraph {
  const nodes = new Map<string, NodeType>();
  const edges: GraphEdge[] = [];

  // Create nodes
  for (let i = 0; i < nodeCount; i++) {
    const node = createTestTerraformNode({
      id: `node_${i}`,
      name: `aws_resource.resource_${i}`,
      metadata: {
        arn: `arn:aws:service:us-east-1:123456789012:resource/resource-${i}`,
        id: `resource-${i}`,
        tags: {
          Environment: i % 2 === 0 ? 'production' : 'staging',
          Project: `project-${Math.floor(i / 10)}`,
        },
      },
    });
    nodes.set(node.id, node);
  }

  // Create edges (random connections)
  const nodeIds = Array.from(nodes.keys());
  for (let i = 0; i < edgeCount && nodeIds.length > 1; i++) {
    const sourceIndex = Math.floor(Math.random() * nodeIds.length);
    let targetIndex = Math.floor(Math.random() * nodeIds.length);
    while (targetIndex === sourceIndex) {
      targetIndex = Math.floor(Math.random() * nodeIds.length);
    }
    edges.push(createTestEdge(nodeIds[sourceIndex], nodeIds[targetIndex]));
  }

  // Compute node and edge counts
  const nodeCounts: Record<string, number> = {};
  nodes.forEach((node) => {
    nodeCounts[node.type] = (nodeCounts[node.type] || 0) + 1;
  });

  const edgeCounts: Record<string, number> = {};
  for (const edge of edges) {
    edgeCounts[edge.type] = (edgeCounts[edge.type] || 0) + 1;
  }

  return {
    id: overrides.id ?? `graph_${randomUUID()}`,
    nodes,
    edges,
    metadata: overrides.metadata ?? {
      createdAt: new Date(),
      sourceFiles: ['main.tf'],
      nodeCounts,
      edgeCounts: edgeCounts as Record<EdgeType, number>,
      buildTimeMs: 100,
    },
  };
}

/**
 * Create an empty test graph
 */
export function createTestEmptyGraph(
  overrides: Partial<DependencyGraph> = {}
): DependencyGraph {
  return {
    id: overrides.id ?? `graph_${randomUUID()}`,
    nodes: new Map(),
    edges: [],
    metadata: overrides.metadata ?? {
      createdAt: new Date(),
      sourceFiles: [],
      nodeCounts: {},
      edgeCounts: {} as Record<EdgeType, number>,
      buildTimeMs: 0,
    },
  };
}

/**
 * Create a test graph from specific nodes and edges
 */
export function createTestGraphFromNodes(
  nodes: NodeType[],
  edges: GraphEdge[] = [],
  overrides: Partial<DependencyGraph> = {}
): DependencyGraph {
  const nodeMap = new Map<string, NodeType>();
  const nodeCounts: Record<string, number> = {};

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    nodeCounts[node.type] = (nodeCounts[node.type] || 0) + 1;
  }

  const edgeCounts: Record<string, number> = {};
  for (const edge of edges) {
    edgeCounts[edge.type] = (edgeCounts[edge.type] || 0) + 1;
  }

  return {
    id: overrides.id ?? `graph_${randomUUID()}`,
    nodes: nodeMap,
    edges,
    metadata: overrides.metadata ?? {
      createdAt: new Date(),
      sourceFiles: ['main.tf'],
      nodeCounts,
      edgeCounts: edgeCounts as Record<EdgeType, number>,
      buildTimeMs: 100,
    },
  };
}

// ============================================================================
// Graph Snapshot Fixtures
// ============================================================================

/**
 * Create a test graph snapshot
 */
export function createTestSnapshot(
  graph: DependencyGraph,
  overrides: Partial<GraphSnapshot> = {}
): GraphSnapshot {
  return {
    id: overrides.id ?? createTestGraphSnapshotId(),
    tenantId: overrides.tenantId ?? createTestTenantId(),
    repositoryId: overrides.repositoryId,
    scanId: overrides.scanId,
    graph,
    createdAt: overrides.createdAt ?? new Date(),
    version: overrides.version ?? 1,
    metadata: overrides.metadata,
  };
}

/**
 * Create a test graph snapshot reference
 */
export function createTestSnapshotRef(
  overrides: Partial<GraphSnapshotRef> = {}
): GraphSnapshotRef {
  return {
    id: overrides.id ?? createTestGraphSnapshotId(),
    tenantId: overrides.tenantId ?? createTestTenantId(),
    nodeCount: overrides.nodeCount ?? 100,
    edgeCount: overrides.edgeCount ?? 150,
    createdAt: overrides.createdAt ?? new Date(),
    version: overrides.version ?? 1,
  };
}

/**
 * Create a pair of snapshots for diff testing
 */
export function createTestSnapshotPair(
  options: {
    baseNodeCount?: number;
    targetNodeCount?: number;
    commonNodes?: number;
    addedNodes?: number;
    removedNodes?: number;
    modifiedNodes?: number;
  } = {}
): { baseSnapshot: GraphSnapshot; targetSnapshot: GraphSnapshot } {
  const {
    baseNodeCount = 10,
    targetNodeCount = 12,
    commonNodes = 8,
    addedNodes = targetNodeCount - commonNodes,
    removedNodes = baseNodeCount - commonNodes,
  } = options;

  const tenantId = createTestTenantId();

  // Create base nodes
  const baseNodes: NodeType[] = [];
  for (let i = 0; i < baseNodeCount; i++) {
    baseNodes.push(
      createTestTerraformNode({
        id: `node_${i}`,
        name: `aws_resource.resource_${i}`,
        metadata: {
          arn: `arn:aws:service:us-east-1:123456789012:resource/resource-${i}`,
          version: 'v1',
        },
      })
    );
  }

  // Create target nodes (common + added + modified)
  const targetNodes: NodeType[] = [];
  // Common nodes (unchanged and modified)
  for (let i = removedNodes; i < baseNodeCount; i++) {
    const isModified = i < removedNodes + (options.modifiedNodes ?? 0);
    targetNodes.push(
      createTestTerraformNode({
        id: `node_${i}`,
        name: `aws_resource.resource_${i}`,
        metadata: {
          arn: `arn:aws:service:us-east-1:123456789012:resource/resource-${i}`,
          version: isModified ? 'v2' : 'v1',
          modified: isModified,
        },
      })
    );
  }
  // Added nodes
  for (let i = 0; i < addedNodes; i++) {
    targetNodes.push(
      createTestTerraformNode({
        id: `node_new_${i}`,
        name: `aws_resource.new_resource_${i}`,
        metadata: {
          arn: `arn:aws:service:us-east-1:123456789012:resource/new-resource-${i}`,
          version: 'v1',
        },
      })
    );
  }

  const baseGraph = createTestGraphFromNodes(baseNodes);
  const targetGraph = createTestGraphFromNodes(targetNodes);

  return {
    baseSnapshot: createTestSnapshot(baseGraph, {
      tenantId,
      version: 1,
    }),
    targetSnapshot: createTestSnapshot(targetGraph, {
      tenantId,
      version: 2,
    }),
  };
}

// ============================================================================
// Identity Fixtures
// ============================================================================

/**
 * Create a test node identity
 */
export function createTestNodeIdentity(
  overrides: Partial<NodeIdentity> = {}
): NodeIdentity {
  const nodeId = overrides.nodeId ?? `node_${randomUUID()}`;
  const nodeType = overrides.nodeType ?? 'terraform_resource';
  const name = overrides.name ?? 'aws_s3_bucket.example';
  const namespace = overrides.namespace;

  return {
    key: overrides.key ?? createNodeIdentityKey(nodeType, name, namespace),
    nodeId,
    nodeType,
    name,
    namespace,
    repositoryId: overrides.repositoryId,
    attributes: overrides.attributes ?? {},
    identityHash: overrides.identityHash ?? randomUUID().slice(0, 16),
  };
}

/**
 * Create a test edge identity
 */
export function createTestEdgeIdentity(
  overrides: Partial<EdgeIdentity> = {}
): EdgeIdentity {
  const sourceIdentity = overrides.sourceIdentity ?? createTestNodeIdentity();
  const targetIdentity = overrides.targetIdentity ?? createTestNodeIdentity();
  const edgeType: EdgeType = overrides.edgeType ?? 'depends_on';

  return {
    key: overrides.key ?? createEdgeIdentityKey(sourceIdentity.key, targetIdentity.key, edgeType),
    edgeId: overrides.edgeId ?? `edge_${randomUUID()}`,
    sourceIdentity,
    targetIdentity,
    edgeType,
    attributes: overrides.attributes ?? {},
    identityHash: overrides.identityHash ?? randomUUID().slice(0, 16),
  };
}

/**
 * Create multiple test node identities
 */
export function createTestNodeIdentities(count: number): NodeIdentity[] {
  return Array.from({ length: count }, (_, i) =>
    createTestNodeIdentity({
      nodeId: `node_${i}`,
      name: `resource.item_${i}`,
    })
  );
}

// ============================================================================
// Diff Fixtures
// ============================================================================

/**
 * Create a test attribute change
 */
export function createTestAttributeChange(
  overrides: Partial<AttributeChange> = {}
): AttributeChange {
  return {
    path: overrides.path ?? 'metadata.version',
    previousValue: overrides.previousValue ?? 'v1',
    newValue: overrides.newValue ?? 'v2',
    changeType: overrides.changeType ?? 'modified',
  };
}

/**
 * Create a test node diff
 */
export function createTestNodeDiff(
  changeType: DiffChangeType,
  overrides: Partial<NodeDiff> = {}
): NodeDiff {
  const identity = overrides.identity ?? createTestNodeIdentity();

  let baseNode: NodeType | null = null;
  let targetNode: NodeType | null = null;

  if (changeType === 'added') {
    targetNode = createTestTerraformNode({ id: identity.nodeId, name: identity.name });
  } else if (changeType === 'removed') {
    baseNode = createTestTerraformNode({ id: identity.nodeId, name: identity.name });
  } else {
    baseNode = createTestTerraformNode({
      id: identity.nodeId,
      name: identity.name,
      metadata: { version: 'v1' },
    });
    targetNode = createTestTerraformNode({
      id: identity.nodeId,
      name: identity.name,
      metadata: { version: 'v2' },
    });
  }

  return {
    changeType,
    identity,
    baseNode: overrides.baseNode !== undefined ? overrides.baseNode : baseNode,
    targetNode: overrides.targetNode !== undefined ? overrides.targetNode : targetNode,
    attributeChanges:
      changeType === 'modified'
        ? overrides.attributeChanges ?? [createTestAttributeChange()]
        : undefined,
  };
}

/**
 * Create a test edge diff
 */
export function createTestEdgeDiff(
  changeType: DiffChangeType,
  overrides: Partial<EdgeDiff> = {}
): EdgeDiff {
  const identity = overrides.identity ?? createTestEdgeIdentity();

  let baseEdge: GraphEdge | null = null;
  let targetEdge: GraphEdge | null = null;

  if (changeType === 'added') {
    targetEdge = createTestEdge(
      identity.sourceIdentity.nodeId,
      identity.targetIdentity.nodeId,
      identity.edgeType
    );
  } else if (changeType === 'removed') {
    baseEdge = createTestEdge(
      identity.sourceIdentity.nodeId,
      identity.targetIdentity.nodeId,
      identity.edgeType
    );
  } else {
    baseEdge = createTestEdge(
      identity.sourceIdentity.nodeId,
      identity.targetIdentity.nodeId,
      identity.edgeType,
      { metadata: { implicit: false, confidence: 90 } }
    );
    targetEdge = createTestEdge(
      identity.sourceIdentity.nodeId,
      identity.targetIdentity.nodeId,
      identity.edgeType,
      { metadata: { implicit: false, confidence: 100 } }
    );
  }

  return {
    changeType,
    identity,
    baseEdge: overrides.baseEdge !== undefined ? overrides.baseEdge : baseEdge,
    targetEdge: overrides.targetEdge !== undefined ? overrides.targetEdge : targetEdge,
    attributeChanges:
      changeType === 'modified' ? overrides.attributeChanges ?? [] : undefined,
  };
}

/**
 * Create a test node diff set
 */
export function createTestNodeDiffSet(
  counts: {
    added?: number;
    removed?: number;
    modified?: number;
    unchanged?: number;
  } = {},
  overrides: Partial<NodeDiffSet> = {}
): NodeDiffSet {
  const { added = 2, removed = 1, modified = 3, unchanged = 10 } = counts;

  const addedDiffs = Array.from({ length: added }, () =>
    createTestNodeDiff('added')
  );
  const removedDiffs = Array.from({ length: removed }, () =>
    createTestNodeDiff('removed')
  );
  const modifiedDiffs = Array.from({ length: modified }, () =>
    createTestNodeDiff('modified')
  );
  const unchangedDiffs = Array.from({ length: unchanged }, () =>
    createTestNodeDiff('unchanged')
  );

  const byIdentityKey = new Map<NodeIdentityKey, NodeDiff>();
  [...addedDiffs, ...removedDiffs, ...modifiedDiffs, ...unchangedDiffs].forEach(
    (diff) => {
      byIdentityKey.set(diff.identity.key, diff);
    }
  );

  return {
    added: overrides.added ?? addedDiffs,
    removed: overrides.removed ?? removedDiffs,
    modified: overrides.modified ?? modifiedDiffs,
    unchanged: overrides.unchanged ?? unchangedDiffs,
    baseNodeCount: overrides.baseNodeCount ?? removed + modified + unchanged,
    targetNodeCount: overrides.targetNodeCount ?? added + modified + unchanged,
    byIdentityKey: overrides.byIdentityKey ?? byIdentityKey,
  };
}

/**
 * Create a test edge diff set
 */
export function createTestEdgeDiffSet(
  counts: {
    added?: number;
    removed?: number;
    modified?: number;
    unchanged?: number;
  } = {},
  overrides: Partial<EdgeDiffSet> = {}
): EdgeDiffSet {
  const { added = 3, removed = 2, modified = 1, unchanged = 15 } = counts;

  const addedDiffs = Array.from({ length: added }, () =>
    createTestEdgeDiff('added')
  );
  const removedDiffs = Array.from({ length: removed }, () =>
    createTestEdgeDiff('removed')
  );
  const modifiedDiffs = Array.from({ length: modified }, () =>
    createTestEdgeDiff('modified')
  );
  const unchangedDiffs = Array.from({ length: unchanged }, () =>
    createTestEdgeDiff('unchanged')
  );

  const byIdentityKey = new Map<EdgeIdentityKey, EdgeDiff>();
  [...addedDiffs, ...removedDiffs, ...modifiedDiffs, ...unchangedDiffs].forEach(
    (diff) => {
      byIdentityKey.set(diff.identity.key, diff);
    }
  );

  return {
    added: overrides.added ?? addedDiffs,
    removed: overrides.removed ?? removedDiffs,
    modified: overrides.modified ?? modifiedDiffs,
    unchanged: overrides.unchanged ?? unchangedDiffs,
    baseEdgeCount: overrides.baseEdgeCount ?? removed + modified + unchanged,
    targetEdgeCount: overrides.targetEdgeCount ?? added + modified + unchanged,
    byIdentityKey: overrides.byIdentityKey ?? byIdentityKey,
  };
}

/**
 * Create a test diff summary
 */
export function createTestDiffSummary(
  overrides: Partial<DiffSummary> = {}
): DiffSummary {
  const baseNodeCount = overrides.baseNodeCount ?? 100;
  const targetNodeCount = overrides.targetNodeCount ?? 110;
  const nodesAdded = overrides.nodesAdded ?? 15;
  const nodesRemoved = overrides.nodesRemoved ?? 5;
  const nodesModified = overrides.nodesModified ?? 10;
  const nodesUnchanged = overrides.nodesUnchanged ?? 80;

  const baseEdgeCount = overrides.baseEdgeCount ?? 150;
  const targetEdgeCount = overrides.targetEdgeCount ?? 165;
  const edgesAdded = overrides.edgesAdded ?? 20;
  const edgesRemoved = overrides.edgesRemoved ?? 5;
  const edgesModified = overrides.edgesModified ?? 3;
  const edgesUnchanged = overrides.edgesUnchanged ?? 122;

  const nodeChanges = nodesAdded + nodesRemoved + nodesModified;
  const edgeChanges = edgesAdded + edgesRemoved + edgesModified;
  const nodeChangeRatio =
    overrides.nodeChangeRatio ?? nodeChanges / Math.max(baseNodeCount, 1);
  const edgeChangeRatio =
    overrides.edgeChangeRatio ?? edgeChanges / Math.max(baseEdgeCount, 1);
  const overallChangeRatio =
    overrides.overallChangeRatio ?? (nodeChangeRatio + edgeChangeRatio) / 2;

  return {
    baseNodeCount,
    targetNodeCount,
    nodesAdded,
    nodesRemoved,
    nodesModified,
    nodesUnchanged,
    baseEdgeCount,
    targetEdgeCount,
    edgesAdded,
    edgesRemoved,
    edgesModified,
    edgesUnchanged,
    nodeChangeRatio,
    edgeChangeRatio,
    overallChangeRatio,
    isSignificantChange: overrides.isSignificantChange ?? overallChangeRatio > 0.1,
    changesByNodeType: overrides.changesByNodeType ?? {
      terraform_resource: { added: 10, removed: 3, modified: 7 },
      terraform_data: { added: 5, removed: 2, modified: 3 },
    },
    changesByEdgeType: overrides.changesByEdgeType ?? {
      depends_on: { added: 12, removed: 3, modified: 2 },
      references: { added: 8, removed: 2, modified: 1 },
    },
  };
}

/**
 * Create a test diff timing
 */
export function createTestDiffTiming(
  overrides: Partial<DiffTiming> = {}
): DiffTiming {
  return {
    totalMs: overrides.totalMs ?? 150,
    nodeIdentityExtractionMs: overrides.nodeIdentityExtractionMs ?? 20,
    nodeComparisonMs: overrides.nodeComparisonMs ?? 50,
    edgeIdentityExtractionMs: overrides.edgeIdentityExtractionMs ?? 15,
    edgeComparisonMs: overrides.edgeComparisonMs ?? 40,
    summaryComputationMs: overrides.summaryComputationMs ?? 25,
    nodesPerSecond: overrides.nodesPerSecond ?? 10000,
    edgesPerSecond: overrides.edgesPerSecond ?? 15000,
  };
}

/**
 * Create a test diff computation options
 */
export function createTestDiffOptions(
  overrides: Partial<DiffComputationOptions> = {}
): DiffComputationOptions {
  return {
    ...DEFAULT_DIFF_COMPUTATION_OPTIONS,
    ...overrides,
  };
}

/**
 * Create a test graph diff result
 */
export function createTestDiffResult(
  overrides: Partial<GraphDiffResult> = {}
): GraphDiffResult {
  const tenantId = overrides.tenantId ?? createTestTenantId();
  const baseSnapshotId = overrides.baseSnapshotId ?? createTestGraphSnapshotId();
  const targetSnapshotId = overrides.targetSnapshotId ?? createTestGraphSnapshotId();

  return {
    id: overrides.id ?? createTestGraphDiffId(),
    tenantId,
    baseSnapshotId,
    targetSnapshotId,
    rollupId: overrides.rollupId,
    executionId: overrides.executionId,
    nodeDiffs: overrides.nodeDiffs ?? createTestNodeDiffSet(),
    edgeDiffs: overrides.edgeDiffs ?? createTestEdgeDiffSet(),
    summary: overrides.summary ?? createTestDiffSummary(),
    timing: overrides.timing ?? createTestDiffTiming(),
    computedAt: overrides.computedAt ?? new Date(),
    options: overrides.options ?? createTestDiffOptions(),
  };
}

// ============================================================================
// Scenario Fixtures
// ============================================================================

/**
 * Create fixtures for testing no-change scenario
 */
export function createNoChangeScenario(): {
  baseSnapshot: GraphSnapshot;
  targetSnapshot: GraphSnapshot;
  expectedSummary: Partial<DiffSummary>;
} {
  const nodes = createTestNodes(5);
  const edges = createTestEdgeChain(nodes.map((n) => n.id));
  const graph = createTestGraphFromNodes(nodes, edges);
  const tenantId = createTestTenantId();

  return {
    baseSnapshot: createTestSnapshot(graph, { tenantId, version: 1 }),
    targetSnapshot: createTestSnapshot(graph, { tenantId, version: 2 }),
    expectedSummary: {
      nodesAdded: 0,
      nodesRemoved: 0,
      nodesModified: 0,
      edgesAdded: 0,
      edgesRemoved: 0,
      edgesModified: 0,
      isSignificantChange: false,
    },
  };
}

/**
 * Create fixtures for testing full replacement scenario
 */
export function createFullReplacementScenario(): {
  baseSnapshot: GraphSnapshot;
  targetSnapshot: GraphSnapshot;
  expectedSummary: Partial<DiffSummary>;
} {
  const tenantId = createTestTenantId();

  // Base graph with nodes 0-4
  const baseNodes = createTestNodes(5, (i) =>
    createTestTerraformNode({
      id: `node_${i}`,
      name: `aws_resource.old_${i}`,
      metadata: { arn: `arn:aws:service:us-east-1:123456789012:resource/old-${i}` },
    })
  );
  const baseEdges = createTestEdgeChain(baseNodes.map((n) => n.id));
  const baseGraph = createTestGraphFromNodes(baseNodes, baseEdges);

  // Target graph with completely different nodes 5-9
  const targetNodes = createTestNodes(5, (i) =>
    createTestTerraformNode({
      id: `node_${i + 5}`,
      name: `aws_resource.new_${i}`,
      metadata: { arn: `arn:aws:service:us-east-1:123456789012:resource/new-${i}` },
    })
  );
  const targetEdges = createTestEdgeChain(targetNodes.map((n) => n.id));
  const targetGraph = createTestGraphFromNodes(targetNodes, targetEdges);

  return {
    baseSnapshot: createTestSnapshot(baseGraph, { tenantId, version: 1 }),
    targetSnapshot: createTestSnapshot(targetGraph, { tenantId, version: 2 }),
    expectedSummary: {
      nodesAdded: 5,
      nodesRemoved: 5,
      nodesModified: 0,
      nodesUnchanged: 0,
      isSignificantChange: true,
    },
  };
}

/**
 * Create fixtures for testing incremental addition scenario
 */
export function createIncrementalAdditionScenario(
  initialCount: number = 10,
  addCount: number = 5
): {
  baseSnapshot: GraphSnapshot;
  targetSnapshot: GraphSnapshot;
  expectedSummary: Partial<DiffSummary>;
} {
  const tenantId = createTestTenantId();

  // Base graph
  const baseNodes = createTestNodes(initialCount);
  const baseEdges = createTestEdgeChain(baseNodes.map((n) => n.id));
  const baseGraph = createTestGraphFromNodes(baseNodes, baseEdges);

  // Target graph = base + new nodes
  const newNodes = createTestNodes(addCount, (i) =>
    createTestTerraformNode({
      id: `node_new_${i}`,
      name: `aws_resource.new_${i}`,
    })
  );
  const targetNodes = [...baseNodes, ...newNodes];
  const newEdges = newNodes.map((n) =>
    createTestEdge(baseNodes[0].id, n.id, 'references')
  );
  const targetEdges = [...baseEdges, ...newEdges];
  const targetGraph = createTestGraphFromNodes(targetNodes, targetEdges);

  return {
    baseSnapshot: createTestSnapshot(baseGraph, { tenantId, version: 1 }),
    targetSnapshot: createTestSnapshot(targetGraph, { tenantId, version: 2 }),
    expectedSummary: {
      nodesAdded: addCount,
      nodesRemoved: 0,
      edgesAdded: addCount,
      edgesRemoved: 0,
    },
  };
}

/**
 * Create fixtures for testing large graph performance
 */
export function createLargeGraphScenario(
  nodeCount: number = 1000,
  changePercent: number = 10
): {
  baseSnapshot: GraphSnapshot;
  targetSnapshot: GraphSnapshot;
} {
  const tenantId = createTestTenantId();
  const changeCount = Math.floor((nodeCount * changePercent) / 100);

  // Create base graph
  const baseGraph = createTestGraph(nodeCount, Math.floor(nodeCount * 1.5));

  // Create target graph with some modifications
  const targetNodes = new Map(baseGraph.nodes);
  const targetEdges = [...baseGraph.edges];

  // Remove some nodes
  const nodeIds = Array.from(targetNodes.keys());
  for (let i = 0; i < changeCount / 2; i++) {
    targetNodes.delete(nodeIds[i]);
    // Also remove edges referencing deleted nodes
    const deletedNodeId = nodeIds[i];
    for (let j = targetEdges.length - 1; j >= 0; j--) {
      if (
        targetEdges[j].source === deletedNodeId ||
        targetEdges[j].target === deletedNodeId
      ) {
        targetEdges.splice(j, 1);
      }
    }
  }

  // Add some new nodes
  for (let i = 0; i < changeCount / 2; i++) {
    const newNode = createTestTerraformNode({
      id: `node_new_${i}`,
      name: `aws_resource.new_${i}`,
    });
    targetNodes.set(newNode.id, newNode);
    // Add edge to a random existing node
    const existingNodeIds = Array.from(targetNodes.keys());
    const randomTarget =
      existingNodeIds[Math.floor(Math.random() * existingNodeIds.length)];
    if (randomTarget !== newNode.id) {
      targetEdges.push(createTestEdge(newNode.id, randomTarget));
    }
  }

  const targetGraph: DependencyGraph = {
    id: `graph_${randomUUID()}`,
    nodes: targetNodes,
    edges: targetEdges,
    metadata: {
      createdAt: new Date(),
      sourceFiles: ['main.tf'],
      nodeCounts: {},
      edgeCounts: {} as Record<EdgeType, number>,
      buildTimeMs: 100,
    },
  };

  return {
    baseSnapshot: createTestSnapshot(baseGraph, { tenantId, version: 1 }),
    targetSnapshot: createTestSnapshot(targetGraph, { tenantId, version: 2 }),
  };
}

// ============================================================================
// Export Constants
// ============================================================================

/**
 * Sample ARNs for testing
 */
export const SAMPLE_ARNS = [
  'arn:aws:s3:::my-bucket',
  'arn:aws:s3:::my-bucket/path/to/object',
  'arn:aws:ec2:us-east-1:123456789012:instance/i-1234567890abcdef0',
  'arn:aws:lambda:us-east-1:123456789012:function:my-function',
  'arn:aws:iam::123456789012:user/johndoe',
  'arn:aws:rds:us-east-1:123456789012:db:mysql-db',
];

/**
 * Sample K8s namespaces for testing
 */
export const SAMPLE_K8S_NAMESPACES = [
  'default',
  'kube-system',
  'production',
  'staging',
  'monitoring',
];

/**
 * Sample edge types for testing
 */
export const SAMPLE_EDGE_TYPES: EdgeType[] = [
  'depends_on',
  'references',
  'module_call',
  'selector_match',
  'configmap_ref',
  'secret_ref',
];
