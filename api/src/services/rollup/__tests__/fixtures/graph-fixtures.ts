/**
 * Graph Test Fixtures
 * @module services/rollup/__tests__/fixtures/graph-fixtures
 *
 * Test fixtures for dependency graphs and nodes.
 */

import { randomUUID } from 'crypto';
import type {
  NodeType,
  TerraformResourceNode,
  TerraformDataNode,
  TerraformModuleNode,
  K8sDeploymentNode,
  K8sServiceNode,
  GraphEdge,
  DependencyGraph,
  NodeLocation,
  EdgeType,
} from '../../../../types/graph.js';
import type { RepositoryId, ScanId } from '../../../../types/entities.js';
import { createRepositoryId, createScanId } from './rollup-fixtures.js';

// ============================================================================
// Node Location Factory
// ============================================================================

export function createNodeLocation(
  overrides: Partial<NodeLocation> = {}
): NodeLocation {
  return {
    file: 'main.tf',
    lineStart: 1,
    lineEnd: 10,
    ...overrides,
  };
}

// ============================================================================
// Terraform Node Factories
// ============================================================================

export function createTerraformResourceNode(
  overrides: Partial<TerraformResourceNode> = {}
): TerraformResourceNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'aws_s3_bucket.example';

  return {
    id,
    name,
    type: 'terraform_resource',
    resourceType: 'aws_s3_bucket',
    provider: 'aws',
    dependsOn: [],
    location: createNodeLocation(),
    metadata: {
      arn: 'arn:aws:s3:::my-bucket',
      bucket: 'my-bucket',
      region: 'us-east-1',
      tags: {
        Environment: 'production',
        Project: 'test-project',
      },
    },
    ...overrides,
  };
}

export function createTerraformDataNode(
  overrides: Partial<TerraformDataNode> = {}
): TerraformDataNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'data.aws_ami.latest';

  return {
    id,
    name,
    type: 'terraform_data',
    dataType: 'aws_ami',
    provider: 'aws',
    location: createNodeLocation(),
    metadata: {
      arn: 'arn:aws:ec2:us-east-1::image/ami-12345678',
    },
    ...overrides,
  };
}

export function createTerraformModuleNode(
  overrides: Partial<TerraformModuleNode> = {}
): TerraformModuleNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'module.vpc';

  return {
    id,
    name,
    type: 'terraform_module',
    source: './modules/vpc',
    sourceType: 'local',
    providers: {},
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Kubernetes Node Factories
// ============================================================================

export function createK8sDeploymentNode(
  overrides: Partial<K8sDeploymentNode> = {}
): K8sDeploymentNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'nginx-deployment';

  return {
    id,
    name,
    type: 'k8s_deployment',
    namespace: 'default',
    replicas: 3,
    selector: { app: 'nginx' },
    containers: [
      {
        name: 'nginx',
        image: 'nginx:latest',
        ports: [{ containerPort: 80 }],
      },
    ],
    location: createNodeLocation({ file: 'deployment.yaml' }),
    metadata: {
      labels: {
        app: 'nginx',
        environment: 'production',
      },
    },
    ...overrides,
  };
}

export function createK8sServiceNode(
  overrides: Partial<K8sServiceNode> = {}
): K8sServiceNode {
  const id = overrides.id ?? `node_${randomUUID()}`;
  const name = overrides.name ?? 'nginx-service';

  return {
    id,
    name,
    type: 'k8s_service',
    namespace: 'default',
    serviceType: 'ClusterIP',
    selector: { app: 'nginx' },
    ports: [
      {
        port: 80,
        targetPort: 80,
        protocol: 'TCP',
      },
    ],
    location: createNodeLocation({ file: 'service.yaml' }),
    metadata: {
      labels: {
        app: 'nginx',
      },
    },
    ...overrides,
  };
}

// ============================================================================
// Edge Factory
// ============================================================================

export function createGraphEdge(
  overrides: Partial<GraphEdge> = {}
): GraphEdge {
  return {
    id: `edge_${randomUUID()}`,
    source: `node_${randomUUID()}`,
    target: `node_${randomUUID()}`,
    type: 'depends_on',
    metadata: {
      implicit: false,
      confidence: 100,
    },
    ...overrides,
  };
}

export function createEdgeBetweenNodes(
  sourceId: string,
  targetId: string,
  type: EdgeType = 'depends_on'
): GraphEdge {
  return createGraphEdge({
    source: sourceId,
    target: targetId,
    type,
  });
}

// ============================================================================
// Graph Factory
// ============================================================================

export function createEmptyGraph(
  overrides: Partial<DependencyGraph> = {}
): DependencyGraph {
  return {
    id: `graph_${randomUUID()}`,
    nodes: new Map(),
    edges: [],
    metadata: {
      createdAt: new Date(),
      sourceFiles: [],
      nodeCounts: {},
      edgeCounts: {} as Record<EdgeType, number>,
      buildTimeMs: 0,
    },
    ...overrides,
  };
}

export function createGraphWithNodes(
  nodes: NodeType[],
  edges: GraphEdge[] = []
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
    id: `graph_${randomUUID()}`,
    nodes: nodeMap,
    edges,
    metadata: {
      createdAt: new Date(),
      sourceFiles: ['main.tf'],
      nodeCounts,
      edgeCounts: edgeCounts as Record<EdgeType, number>,
      buildTimeMs: 100,
    },
  };
}

// ============================================================================
// Complex Graph Scenarios
// ============================================================================

export interface SourceGraphData {
  graph: DependencyGraph;
  repositoryId: RepositoryId;
  scanId: ScanId;
}

export function createMatchableGraphPair(): {
  graph1: SourceGraphData;
  graph2: SourceGraphData;
} {
  const repoId1 = createRepositoryId();
  const repoId2 = createRepositoryId();
  const scanId1 = createScanId();
  const scanId2 = createScanId();

  // Create nodes with matching ARNs
  const node1 = createTerraformResourceNode({
    id: 'node_1',
    name: 'aws_s3_bucket.main',
    metadata: {
      arn: 'arn:aws:s3:::shared-bucket',
      bucket: 'shared-bucket',
      tags: { Environment: 'production' },
    },
  });

  const node2 = createTerraformResourceNode({
    id: 'node_2',
    name: 'aws_s3_bucket.primary',
    metadata: {
      arn: 'arn:aws:s3:::shared-bucket',
      bucket: 'shared-bucket',
      tags: { Environment: 'production' },
    },
  });

  const node3 = createTerraformResourceNode({
    id: 'node_3',
    name: 'aws_instance.web',
    resourceType: 'aws_instance',
    metadata: {
      arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-abc123',
    },
  });

  const node4 = createTerraformResourceNode({
    id: 'node_4',
    name: 'aws_instance.app',
    resourceType: 'aws_instance',
    metadata: {
      arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-abc123',
    },
  });

  // Create edges
  const edge1 = createEdgeBetweenNodes('node_1', 'node_3', 'references');
  const edge2 = createEdgeBetweenNodes('node_2', 'node_4', 'references');

  return {
    graph1: {
      graph: createGraphWithNodes([node1, node3], [edge1]),
      repositoryId: repoId1,
      scanId: scanId1,
    },
    graph2: {
      graph: createGraphWithNodes([node2, node4], [edge2]),
      repositoryId: repoId2,
      scanId: scanId2,
    },
  };
}

export function createComplexGraph(nodeCount: number): DependencyGraph {
  const nodes: NodeType[] = [];
  const edges: GraphEdge[] = [];

  for (let i = 0; i < nodeCount; i++) {
    const node = createTerraformResourceNode({
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
    nodes.push(node);

    // Create edges to previous nodes
    if (i > 0) {
      const targetIndex = Math.floor(Math.random() * i);
      edges.push(createEdgeBetweenNodes(`node_${i}`, `node_${targetIndex}`));
    }
  }

  return createGraphWithNodes(nodes, edges);
}

// ============================================================================
// Blast Radius Graph Fixtures
// ============================================================================

export function createBlastRadiusGraph(): {
  nodes: Map<string, NodeType>;
  edges: GraphEdge[];
} {
  const nodes = new Map<string, NodeType>();
  const edges: GraphEdge[] = [];

  // Create a tree structure for blast radius testing
  // root -> level1_a, level1_b
  // level1_a -> level2_a, level2_b
  // level1_b -> level2_c
  // level2_a -> level3_a

  const nodeIds = [
    'root',
    'level1_a', 'level1_b',
    'level2_a', 'level2_b', 'level2_c',
    'level3_a',
  ];

  for (const id of nodeIds) {
    nodes.set(id, createTerraformResourceNode({
      id,
      name: `resource.${id}`,
    }));
  }

  edges.push(
    createEdgeBetweenNodes('root', 'level1_a', 'depends_on'),
    createEdgeBetweenNodes('root', 'level1_b', 'depends_on'),
    createEdgeBetweenNodes('level1_a', 'level2_a', 'depends_on'),
    createEdgeBetweenNodes('level1_a', 'level2_b', 'depends_on'),
    createEdgeBetweenNodes('level1_b', 'level2_c', 'depends_on'),
    createEdgeBetweenNodes('level2_a', 'level3_a', 'depends_on'),
  );

  return { nodes, edges };
}
