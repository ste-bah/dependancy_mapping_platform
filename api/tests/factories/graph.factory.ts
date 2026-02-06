/**
 * Graph Test Factories
 * @module tests/factories/graph
 *
 * Factory functions for creating graph nodes and edges for testing.
 */

import type {
  NodeType,
  GraphEdge,
  EdgeType,
  DependencyGraph,
  GraphMetadata,
  EdgeMetadata,
  TerraformResourceNode,
  TerraformModuleNode,
  TerraformVariableNode,
  TerraformDataNode,
  K8sDeploymentNode,
  K8sServiceNode,
  K8sConfigMapNode,
  HelmChartNode,
  HelmReleaseNode,
  NodeLocation,
} from '@/types/graph';

// ============================================================================
// Edge Factories
// ============================================================================

let edgeCounter = 0;

export interface EdgeOptions {
  id?: string;
  source: string;
  target: string;
  type?: EdgeType;
  label?: string;
  metadata?: Partial<EdgeMetadata>;
}

export function createEdge(options: EdgeOptions): GraphEdge {
  edgeCounter++;
  const {
    id = `edge-${edgeCounter}`,
    source,
    target,
    type = 'references',
    label,
    metadata = {},
  } = options;

  return {
    id,
    source,
    target,
    type,
    label,
    metadata: {
      implicit: false,
      confidence: 100,
      ...metadata,
    },
  };
}

export function createReferenceEdge(
  source: string,
  target: string,
  attribute?: string
): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'references',
    metadata: {
      attribute,
      implicit: false,
      confidence: 95,
    },
  });
}

export function createDependsOnEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'depends_on',
    metadata: {
      implicit: false,
      confidence: 100,
    },
  });
}

export function createModuleCallEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'module_call',
    metadata: {
      implicit: false,
      confidence: 100,
    },
  });
}

export function createDataSourceEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'data_source',
    metadata: {
      implicit: false,
      confidence: 90,
    },
  });
}

export function createK8sSelectorEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'selector_match',
    metadata: {
      implicit: true,
      confidence: 85,
    },
  });
}

export function createConfigMapRefEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'configmap_ref',
    metadata: {
      implicit: false,
      confidence: 95,
    },
  });
}

export function createSecretRefEdge(source: string, target: string): GraphEdge {
  return createEdge({
    source,
    target,
    type: 'secret_ref',
    metadata: {
      implicit: false,
      confidence: 95,
    },
  });
}

// ============================================================================
// Node Location Factory
// ============================================================================

export function createNodeLocation(overrides: Partial<NodeLocation> = {}): NodeLocation {
  return {
    file: 'main.tf',
    lineStart: 1,
    lineEnd: 10,
    columnStart: 1,
    columnEnd: 1,
    ...overrides,
  };
}

// ============================================================================
// Terraform Node Factories
// ============================================================================

export function createTerraformResourceNode(
  resourceTypeOrOverrides?: string | Partial<TerraformResourceNode>,
  nameParam?: string,
  overrides: Partial<TerraformResourceNode> = {}
): TerraformResourceNode {
  // Support both old signature (resourceType, name, overrides) and new signature (overrides)
  if (typeof resourceTypeOrOverrides === 'object') {
    const opts = resourceTypeOrOverrides;
    return {
      type: 'terraform_resource',
      id: opts.id ?? 'aws_instance.web',
      name: opts.name ?? 'web',
      resourceType: opts.resourceType ?? 'aws_instance',
      provider: opts.provider ?? 'aws',
      dependsOn: opts.dependsOn ?? [],
      location: opts.location ?? createNodeLocation(),
      metadata: opts.metadata ?? {},
      ...opts,
    } as TerraformResourceNode;
  }

  const resourceType = resourceTypeOrOverrides ?? 'aws_instance';
  const name = nameParam ?? 'web';
  return {
    type: 'terraform_resource',
    id: `${resourceType}.${name}`,
    name,
    resourceType,
    provider: resourceType.split('_')[0],
    dependsOn: [],
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformModuleNode(
  nameOrOverrides?: string | Partial<TerraformModuleNode>,
  sourceParam?: string,
  overrides: Partial<TerraformModuleNode> = {}
): TerraformModuleNode {
  // Support both old signature (name, source, overrides) and new signature (overrides)
  if (typeof nameOrOverrides === 'object') {
    const opts = nameOrOverrides;
    const source = opts.source ?? './modules/vpc';
    return {
      type: 'terraform_module',
      id: opts.id ?? 'module.vpc',
      name: opts.name ?? 'vpc',
      source,
      sourceType: opts.sourceType ?? (source.startsWith('./') ? 'local' : 'registry'),
      version: opts.version,
      providers: opts.providers ?? {},
      location: opts.location ?? createNodeLocation(),
      metadata: opts.metadata ?? {},
      ...opts,
    } as TerraformModuleNode;
  }

  const name = nameOrOverrides ?? 'vpc';
  const source = sourceParam ?? './modules/vpc';
  return {
    type: 'terraform_module',
    id: `module.${name}`,
    name,
    source,
    sourceType: source.startsWith('./') ? 'local' : 'registry',
    providers: {},
    location: createNodeLocation(),
    metadata: {},
    ...overrides,
  };
}

export function createTerraformVariableNode(
  overrides: Partial<TerraformVariableNode> = {}
): TerraformVariableNode {
  return {
    type: 'terraform_variable',
    id: overrides.id ?? 'var.instance_type',
    name: overrides.name ?? 'instance_type',
    variableType: overrides.variableType ?? 'string',
    default: overrides.default,
    description: overrides.description,
    sensitive: overrides.sensitive ?? false,
    nullable: overrides.nullable ?? true,
    location: overrides.location ?? createNodeLocation({ file: 'variables.tf' }),
    metadata: overrides.metadata ?? {},
    ...overrides,
  } as TerraformVariableNode;
}

export function createTerraformDataNode(
  overrides: Partial<TerraformDataNode> = {}
): TerraformDataNode {
  return {
    type: 'terraform_data',
    id: overrides.id ?? 'data.aws_ami.latest',
    name: overrides.name ?? 'latest',
    dataType: overrides.dataType ?? 'aws_ami',
    provider: overrides.provider ?? 'aws',
    location: overrides.location ?? createNodeLocation({ file: 'data.tf' }),
    metadata: overrides.metadata ?? {},
    ...overrides,
  } as TerraformDataNode;
}

// ============================================================================
// Kubernetes Node Factories
// ============================================================================

export function createK8sDeploymentNode(
  name: string,
  namespace: string = 'default',
  overrides: Partial<K8sDeploymentNode> = {}
): K8sDeploymentNode {
  return {
    type: 'k8s_deployment',
    id: `${namespace}/${name}`,
    name,
    namespace,
    replicas: 1,
    selector: { app: name },
    containers: [
      {
        name: name,
        image: `${name}:latest`,
        ports: [{ containerPort: 8080 }],
      },
    ],
    location: createNodeLocation({ file: `${name}.yaml` }),
    metadata: {},
    ...overrides,
  };
}

export function createK8sServiceNode(
  name: string,
  namespace: string = 'default',
  overrides: Partial<K8sServiceNode> = {}
): K8sServiceNode {
  return {
    type: 'k8s_service',
    id: `${namespace}/${name}`,
    name,
    namespace,
    serviceType: 'ClusterIP',
    selector: { app: name },
    ports: [{ port: 80, targetPort: 8080 }],
    location: createNodeLocation({ file: `${name}.yaml` }),
    metadata: {},
    ...overrides,
  };
}

export function createK8sConfigMapNode(
  name: string,
  namespace: string = 'default',
  dataKeys: string[] = ['config.yaml'],
  overrides: Partial<K8sConfigMapNode> = {}
): K8sConfigMapNode {
  return {
    type: 'k8s_configmap',
    id: `${namespace}/${name}`,
    name,
    namespace,
    dataKeys,
    location: createNodeLocation({ file: `${name}.yaml` }),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Helm Node Factories
// ============================================================================

export function createHelmChartNode(
  name: string,
  version: string = '1.0.0',
  overrides: Partial<HelmChartNode> = {}
): HelmChartNode {
  return {
    type: 'helm_chart',
    id: `chart/${name}`,
    name,
    chartName: name,
    chartVersion: version,
    location: createNodeLocation({ file: 'Chart.yaml' }),
    metadata: {},
    ...overrides,
  };
}

export function createHelmReleaseNode(
  name: string,
  chartRef: string,
  namespace: string = 'default',
  overrides: Partial<HelmReleaseNode> = {}
): HelmReleaseNode {
  return {
    type: 'helm_release',
    id: `release/${namespace}/${name}`,
    name,
    chartRef,
    namespace,
    values: {},
    location: createNodeLocation({ file: 'helmfile.yaml' }),
    metadata: {},
    ...overrides,
  };
}

// ============================================================================
// Graph Metadata Factories
// ============================================================================

export function createGraphMetadata(
  overrides: Partial<GraphMetadata> = {}
): GraphMetadata {
  return {
    createdAt: new Date(),
    sourceFiles: ['main.tf'],
    nodeCounts: {},
    edgeCounts: {} as Record<EdgeType, number>,
    buildTimeMs: 100,
    ...overrides,
  };
}

// ============================================================================
// Dependency Graph Factories
// ============================================================================

export function createEmptyGraph(id: string = 'test-graph'): DependencyGraph {
  return {
    id,
    nodes: new Map(),
    edges: [],
    metadata: createGraphMetadata(),
  };
}

export function createGraphWithNodes(nodes: NodeType[]): DependencyGraph {
  const nodeMap = new Map<string, NodeType>();
  const nodeCounts: Record<string, number> = {};

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
  }

  return {
    id: `graph-${Date.now()}`,
    nodes: nodeMap,
    edges: [],
    metadata: createGraphMetadata({
      nodeCounts,
      sourceFiles: [...new Set(nodes.map(n => n.location.file))],
    }),
  };
}

export function createGraphWithEdges(
  nodes: NodeType[],
  edges: GraphEdge[]
): DependencyGraph {
  const nodeMap = new Map<string, NodeType>();
  const nodeCounts: Record<string, number> = {};
  const edgeCounts: Record<EdgeType, number> = {} as Record<EdgeType, number>;

  for (const node of nodes) {
    nodeMap.set(node.id, node);
    nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
  }

  for (const edge of edges) {
    edgeCounts[edge.type] = (edgeCounts[edge.type] ?? 0) + 1;
  }

  return {
    id: `graph-${Date.now()}`,
    nodes: nodeMap,
    edges,
    metadata: createGraphMetadata({
      nodeCounts,
      edgeCounts,
      sourceFiles: [...new Set(nodes.map(n => n.location.file))],
    }),
  };
}

// ============================================================================
// Pre-built Scenario Graphs
// ============================================================================

/**
 * Create a simple VPC graph with vpc -> subnet -> instance chain
 */
export function createSimpleVPCGraph(): DependencyGraph {
  const vpc = createTerraformResourceNode('aws_vpc', 'main');
  const subnet = createTerraformResourceNode('aws_subnet', 'public');
  const instance = createTerraformResourceNode('aws_instance', 'web');

  const edges = [
    createReferenceEdge(subnet.id, vpc.id, 'id'),
    createReferenceEdge(instance.id, subnet.id, 'id'),
  ];

  return createGraphWithEdges([vpc, subnet, instance], edges);
}

/**
 * Create a graph with a module call
 */
export function createModuleGraph(): DependencyGraph {
  const module = createTerraformModuleNode('networking', 'terraform-aws-modules/vpc/aws');
  const instance = createTerraformResourceNode('aws_instance', 'web');

  const edges = [
    createModuleCallEdge(instance.id, module.id),
  ];

  return createGraphWithEdges([module, instance], edges);
}

/**
 * Create a graph with a cycle (for cycle detection tests)
 */
export function createCyclicGraph(): DependencyGraph {
  const nodeA = createTerraformResourceNode('aws_security_group', 'a');
  const nodeB = createTerraformResourceNode('aws_security_group', 'b');
  const nodeC = createTerraformResourceNode('aws_security_group', 'c');

  const edges = [
    createReferenceEdge(nodeA.id, nodeB.id),
    createReferenceEdge(nodeB.id, nodeC.id),
    createReferenceEdge(nodeC.id, nodeA.id), // Creates cycle
  ];

  return createGraphWithEdges([nodeA, nodeB, nodeC], edges);
}

/**
 * Create a K8s application graph
 */
export function createK8sAppGraph(): DependencyGraph {
  const deployment = createK8sDeploymentNode('api');
  const service = createK8sServiceNode('api-svc');
  const configMap = createK8sConfigMapNode('api-config');

  const edges = [
    createK8sSelectorEdge(service.id, deployment.id),
    createConfigMapRefEdge(deployment.id, configMap.id),
  ];

  return createGraphWithEdges([deployment, service, configMap], edges);
}

/**
 * Create a Helm release graph
 */
export function createHelmReleaseGraph(): DependencyGraph {
  const chart = createHelmChartNode('nginx-ingress', '4.0.0');
  const release = createHelmReleaseNode('ingress', 'nginx-ingress', 'ingress-nginx');

  const edges = [
    createEdge({
      source: release.id,
      target: chart.id,
      type: 'module_source',
    }),
  ];

  return createGraphWithEdges([chart, release], edges);
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Reset edge counter (useful for test isolation)
 */
export function resetEdgeCounter(): void {
  edgeCounter = 0;
}

/**
 * Get all node IDs from a graph
 */
export function getNodeIds(graph: DependencyGraph): string[] {
  return Array.from(graph.nodes.keys());
}

/**
 * Get all edge pairs from a graph
 */
export function getEdgePairs(graph: DependencyGraph): Array<{ source: string; target: string }> {
  return graph.edges.map(e => ({ source: e.source, target: e.target }));
}

// ============================================================================
// Graph Builder Factory
// ============================================================================

/**
 * Graph builder for programmatic graph construction in tests
 */
export interface GraphBuilderInterface {
  addNode(node: NodeType): void;
  addEdge(edge: GraphEdge): void;
  build(): DependencyGraph;
}

class TestGraphBuilder implements GraphBuilderInterface {
  private nodes: Map<string, NodeType> = new Map();
  private edges: GraphEdge[] = [];
  private options: { validateOnAdd: boolean };

  constructor(options: { validateOnAdd?: boolean } = {}) {
    this.options = { validateOnAdd: options.validateOnAdd ?? true };
  }

  addNode(node: NodeType): void {
    if (this.options.validateOnAdd && this.nodes.has(node.id)) {
      throw new Error(`Node with id ${node.id} already exists`);
    }
    this.nodes.set(node.id, node);
  }

  addEdge(edge: GraphEdge): void {
    if (this.options.validateOnAdd) {
      if (!this.nodes.has(edge.source)) {
        throw new Error(`Source node ${edge.source} not found`);
      }
      if (!this.nodes.has(edge.target)) {
        throw new Error(`Target node ${edge.target} not found`);
      }
    }
    this.edges.push(edge);
  }

  build(): DependencyGraph {
    const nodeCounts: Record<string, number> = {};
    const edgeCounts: Record<EdgeType, number> = {} as Record<EdgeType, number>;
    const sourceFiles = new Set<string>();

    for (const node of this.nodes.values()) {
      nodeCounts[node.type] = (nodeCounts[node.type] ?? 0) + 1;
      sourceFiles.add(node.location.file);
    }

    for (const edge of this.edges) {
      edgeCounts[edge.type] = (edgeCounts[edge.type] ?? 0) + 1;
    }

    return {
      id: `graph-${Date.now()}`,
      nodes: new Map(this.nodes),
      edges: [...this.edges],
      metadata: {
        createdAt: new Date(),
        sourceFiles: Array.from(sourceFiles),
        nodeCounts,
        edgeCounts,
        buildTimeMs: 0,
      },
    };
  }
}

/**
 * Create a new graph builder for programmatic graph construction
 */
export function createGraphBuilder(
  options: { validateOnAdd?: boolean } = {}
): GraphBuilderInterface {
  return new TestGraphBuilder(options);
}
