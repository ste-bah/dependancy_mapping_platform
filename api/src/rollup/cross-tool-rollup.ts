/**
 * Cross-Tool Rollup Query Implementation
 * @module rollup/cross-tool-rollup
 *
 * Implements cross-tool blast radius calculation, node classification,
 * and impact analysis across Terraform, Helm, Kubernetes, and CI/CD tools.
 *
 * TASK-XREF-008: Cross-Tool Rollup Query Implementation
 */

import {
  ToolType,
  GraphNodeRef,
  GraphEdgeRef,
  ImpactedNodes,
  CrossToolPath,
  CrossToolBlastRadius,
  CrossToolSummary,
  CrossToolConnection,
  BlastRadiusOptions,
  GraphQueryInterface,
  NODE_TYPE_TO_TOOL,
  CROSS_TOOL_EDGE_TYPES,
  createEmptyImpactedNodes,
  createEmptyCrossToolSummary,
} from './types';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default options for blast radius calculation
 */
const DEFAULT_BLAST_RADIUS_OPTIONS: Required<BlastRadiusOptions> = {
  maxDepth: 5,
  includeCI: true,
  minConfidence: 0.3,
  toolFilter: [],
};

/**
 * Minimum detection rate threshold for TF-Helm (65%)
 */
export const TF_HELM_DETECTION_TARGET = 0.65;

// ============================================================================
// Node Classification
// ============================================================================

/**
 * Classify a node type to its tool category.
 *
 * @param nodeType - The node type string
 * @returns The tool type classification
 *
 * @example
 * classifyNodeTool('terraform_resource') // Returns 'terraform'
 * classifyNodeTool('helm_release') // Returns 'helm'
 * classifyNodeTool('k8s_deployment') // Returns 'kubernetes'
 */
export function classifyNodeTool(nodeType: string): ToolType {
  const tool = NODE_TYPE_TO_TOOL[nodeType];
  if (tool) {
    return tool;
  }

  // Fallback classification based on prefix
  if (nodeType.startsWith('terraform_') || nodeType.startsWith('tg_')) {
    return 'terraform';
  }
  if (nodeType.startsWith('helm_')) {
    return 'helm';
  }
  if (nodeType.startsWith('k8s_')) {
    return 'kubernetes';
  }
  if (nodeType.startsWith('ci_')) {
    return 'ci';
  }
  if (nodeType.startsWith('argocd_')) {
    return 'argocd';
  }

  // Default to terraform for unknown types (most infrastructure-focused)
  return 'terraform';
}

/**
 * Check if an edge type crosses tool boundaries.
 *
 * @param edgeType - The edge type to check
 * @returns True if the edge typically crosses tool boundaries
 */
export function isCrossToolEdge(edgeType: string): boolean {
  return CROSS_TOOL_EDGE_TYPES.includes(edgeType);
}

/**
 * Check if two nodes belong to different tools.
 *
 * @param node1Type - First node's type
 * @param node2Type - Second node's type
 * @returns True if nodes belong to different tools
 */
export function areNodesDifferentTools(node1Type: string, node2Type: string): boolean {
  return classifyNodeTool(node1Type) !== classifyNodeTool(node2Type);
}

// ============================================================================
// Impact Summary Generation
// ============================================================================

/**
 * Generate a human-readable summary of impact by tool.
 *
 * @param impactByTool - Impact categorized by tool type
 * @param sourceNode - The source node being analyzed
 * @returns Human-readable summary string
 */
export function generateImpactSummary(
  impactByTool: Readonly<Record<ToolType, ImpactedNodes>>,
  sourceNode: GraphNodeRef
): string {
  const parts: string[] = [];
  const sourceTool = classifyNodeTool(sourceNode.type);

  parts.push(`Changes to ${sourceNode.name} (${sourceTool})`);

  const toolImpacts: string[] = [];
  const tools: ToolType[] = ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'];

  for (const tool of tools) {
    const impact = impactByTool[tool];
    if (impact && impact.count > 0) {
      const directCount = impact.direct.length;
      const transitiveCount = impact.transitive.length;
      if (directCount > 0 || transitiveCount > 0) {
        const details: string[] = [];
        if (directCount > 0) {
          details.push(`${directCount} direct`);
        }
        if (transitiveCount > 0) {
          details.push(`${transitiveCount} transitive`);
        }
        toolImpacts.push(`${tool}: ${details.join(', ')}`);
      }
    }
  }

  if (toolImpacts.length === 0) {
    parts.push('may impact no other resources');
  } else {
    parts.push(`may impact: ${toolImpacts.join('; ')}`);
  }

  return parts.join(' ');
}

// ============================================================================
// Critical Path Finding
// ============================================================================

/**
 * Find critical paths that span multiple tools from visited nodes.
 *
 * @param visited - Set of visited node IDs during traversal
 * @param sourceNode - The source node of the analysis
 * @param graph - Graph query interface
 * @returns Array of critical cross-tool paths
 */
export function findCriticalPaths(
  visited: ReadonlySet<string>,
  sourceNode: GraphNodeRef,
  graph: GraphQueryInterface
): readonly CrossToolPath[] {
  // This is a synchronous implementation that analyzes the visited set
  // For a full async implementation, see the async version below
  const paths: CrossToolPath[] = [];
  const visitedArray = Array.from(visited);

  // Simple path detection from visited nodes
  // Group nodes by their tool type
  const nodesByTool = new Map<ToolType, string[]>();
  const sourceTool = classifyNodeTool(sourceNode.type);

  // We can't do full path reconstruction without async queries,
  // so this is a simplified version that identifies potential paths
  // based on the visited nodes

  if (visitedArray.length > 0) {
    const path: CrossToolPath = {
      nodes: [sourceNode],
      edges: [],
      pathLength: 0,
      description: `Path starting from ${sourceNode.name}`,
      crossesTools: [sourceTool],
    };
    paths.push(path);
  }

  return paths;
}

/**
 * Find critical paths asynchronously with full graph access.
 *
 * @param sourceNode - The source node
 * @param impactByTool - Impact results by tool
 * @param graph - Graph query interface
 * @param maxPaths - Maximum number of paths to return
 * @returns Array of critical cross-tool paths
 */
export async function findCriticalPathsAsync(
  sourceNode: GraphNodeRef,
  impactByTool: Readonly<Record<ToolType, ImpactedNodes>>,
  graph: GraphQueryInterface,
  maxPaths: number = 10
): Promise<readonly CrossToolPath[]> {
  const paths: CrossToolPath[] = [];
  const sourceTool = classifyNodeTool(sourceNode.type);
  const tools: ToolType[] = ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'];

  // Find paths to nodes in different tool categories
  for (const tool of tools) {
    if (tool === sourceTool) continue;

    const impact = impactByTool[tool];
    if (!impact || impact.count === 0) continue;

    // Take first few direct impacts as path destinations
    const destinations = impact.direct.slice(0, Math.min(3, impact.direct.length));

    for (const dest of destinations) {
      // Try to construct path from source to destination
      const pathResult = await tracePath(sourceNode, dest, graph, 5);
      if (pathResult) {
        paths.push(pathResult);
        if (paths.length >= maxPaths) {
          return paths;
        }
      }
    }
  }

  return paths;
}

/**
 * Trace a path from source to destination node.
 */
async function tracePath(
  source: GraphNodeRef,
  destination: GraphNodeRef,
  graph: GraphQueryInterface,
  maxDepth: number
): Promise<CrossToolPath | null> {
  const visited = new Set<string>();
  const queue: Array<{
    nodeId: string;
    path: GraphNodeRef[];
    edges: GraphEdgeRef[];
  }> = [{ nodeId: source.id, path: [source], edges: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.nodeId === destination.id) {
      // Found path
      const toolsInPath = new Set<ToolType>();
      for (const node of current.path) {
        toolsInPath.add(classifyNodeTool(node.type));
      }

      return {
        nodes: current.path,
        edges: current.edges,
        pathLength: current.edges.length,
        description: `${source.name} -> ${destination.name}`,
        crossesTools: Array.from(toolsInPath),
      };
    }

    if (current.path.length >= maxDepth) continue;
    if (visited.has(current.nodeId)) continue;
    visited.add(current.nodeId);

    // Get outgoing edges
    const edges = await graph.getEdgesFromNode(current.nodeId);
    for (const edge of edges) {
      if (visited.has(edge.targetId)) continue;

      const targetNode = await graph.getNode(edge.targetId);
      if (!targetNode) continue;

      queue.push({
        nodeId: edge.targetId,
        path: [...current.path, targetNode],
        edges: [...current.edges, edge],
      });
    }
  }

  return null;
}

// ============================================================================
// Blast Radius Calculation
// ============================================================================

/**
 * Calculate the cross-tool blast radius for a node.
 *
 * Uses BFS traversal to find all impacted nodes, categorizing them by tool type.
 *
 * @param nodeId - ID of the node to analyze
 * @param graph - Graph query interface
 * @param options - Blast radius calculation options
 * @returns Cross-tool blast radius analysis
 *
 * @example
 * const radius = await calculateCrossToolBlastRadius('node-123', graph, { maxDepth: 3 });
 * console.log(`Total impact: ${radius.totalImpact} nodes`);
 * console.log(`Summary: ${radius.summary}`);
 */
export async function calculateCrossToolBlastRadius(
  nodeId: string,
  graph: GraphQueryInterface,
  options?: BlastRadiusOptions
): Promise<CrossToolBlastRadius> {
  const opts: Required<BlastRadiusOptions> = {
    ...DEFAULT_BLAST_RADIUS_OPTIONS,
    ...options,
    toolFilter: options?.toolFilter ?? [],
  };

  // Get source node
  const sourceNode = await graph.getNode(nodeId);
  if (!sourceNode) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  // Initialize impact tracking by tool
  const impactByTool: Record<ToolType, { direct: GraphNodeRef[]; transitive: GraphNodeRef[] }> = {
    terraform: { direct: [], transitive: [] },
    helm: { direct: [], transitive: [] },
    kubernetes: { direct: [], transitive: [] },
    ci: { direct: [], transitive: [] },
    argocd: { direct: [], transitive: [] },
  };

  // BFS traversal
  const visited = new Set<string>();
  const queue: Array<{ nodeId: string; depth: number }> = [{ nodeId: nodeId, depth: 0 }];
  visited.add(nodeId);

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (current.depth >= opts.maxDepth) continue;

    // Get outgoing edges (downstream dependencies)
    const edges = await graph.getEdgesFromNode(current.nodeId, {
      minConfidence: opts.minConfidence * 100, // Convert to 0-100 scale
    });

    for (const edge of edges) {
      if (visited.has(edge.targetId)) continue;

      const targetNode = await graph.getNode(edge.targetId);
      if (!targetNode) continue;

      const targetTool = classifyNodeTool(targetNode.type);

      // Apply tool filter if specified
      if (opts.toolFilter.length > 0 && !opts.toolFilter.includes(targetTool)) {
        continue;
      }

      // Skip CI nodes if not included
      if (!opts.includeCI && targetTool === 'ci') {
        continue;
      }

      visited.add(edge.targetId);

      // Categorize as direct or transitive
      if (current.depth === 0) {
        impactByTool[targetTool].direct.push(targetNode);
      } else {
        impactByTool[targetTool].transitive.push(targetNode);
      }

      // Add to queue for further traversal
      queue.push({ nodeId: edge.targetId, depth: current.depth + 1 });
    }

    // Also traverse incoming edges (upstream dependents)
    const incomingEdges = await graph.getEdgesToNode(current.nodeId, {
      minConfidence: opts.minConfidence * 100,
    });

    for (const edge of incomingEdges) {
      if (visited.has(edge.sourceId)) continue;

      const sourceNodeRef = await graph.getNode(edge.sourceId);
      if (!sourceNodeRef) continue;

      const srcTool = classifyNodeTool(sourceNodeRef.type);

      // Apply filters
      if (opts.toolFilter.length > 0 && !opts.toolFilter.includes(srcTool)) {
        continue;
      }
      if (!opts.includeCI && srcTool === 'ci') {
        continue;
      }

      visited.add(edge.sourceId);

      if (current.depth === 0) {
        impactByTool[srcTool].direct.push(sourceNodeRef);
      } else {
        impactByTool[srcTool].transitive.push(sourceNodeRef);
      }

      queue.push({ nodeId: edge.sourceId, depth: current.depth + 1 });
    }
  }

  // Convert to final format with counts
  const finalImpactByTool: Record<ToolType, ImpactedNodes> = {} as Record<ToolType, ImpactedNodes>;
  let totalImpact = 0;

  const tools: ToolType[] = ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'];
  for (const tool of tools) {
    const toolImpact = impactByTool[tool];
    const count = toolImpact.direct.length + toolImpact.transitive.length;
    totalImpact += count;

    finalImpactByTool[tool] = {
      direct: toolImpact.direct,
      transitive: toolImpact.transitive,
      count,
    };
  }

  // Find critical paths
  const criticalPaths = await findCriticalPathsAsync(
    sourceNode,
    finalImpactByTool,
    graph,
    10
  );

  // Generate summary
  const summary = generateImpactSummary(finalImpactByTool, sourceNode);

  return {
    sourceNode,
    impactByTool: finalImpactByTool,
    totalImpact,
    criticalPaths,
    summary,
    calculatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Cross-Tool Summary Generation
// ============================================================================

/**
 * Generate a comprehensive cross-tool summary for a scan.
 *
 * @param scanId - Scan identifier
 * @param graph - Graph query interface
 * @returns Cross-tool summary with statistics and detection rates
 *
 * @example
 * const summary = await generateCrossToolSummary('scan-123', graph);
 * console.log(`TF-Helm detection rate: ${summary.detectionRates.tfHelmDetection}%`);
 */
export async function generateCrossToolSummary(
  scanId: string,
  graph: GraphQueryInterface
): Promise<CrossToolSummary> {
  // Count nodes by category
  const terraformTypes = [
    'terraform_resource', 'terraform_data', 'terraform_module',
    'terraform_variable', 'terraform_output', 'terraform_local',
    'terraform_provider', 'tg_config', 'tg_include', 'tg_dependency'
  ];
  const helmTypes = ['helm_chart', 'helm_release', 'helm_value'];
  const k8sTypes = [
    'k8s_deployment', 'k8s_service', 'k8s_configmap', 'k8s_secret',
    'k8s_ingress', 'k8s_pod', 'k8s_statefulset', 'k8s_daemonset',
    'k8s_job', 'k8s_cronjob', 'k8s_namespace', 'k8s_serviceaccount',
    'k8s_role', 'k8s_rolebinding', 'k8s_clusterrole',
    'k8s_clusterrolebinding', 'k8s_persistentvolume',
    'k8s_persistentvolumeclaim', 'k8s_storageclass', 'k8s_networkpolicy'
  ];
  const ciTypes = ['ci_pipeline', 'ci_job'];

  // Count terraform resources
  let terraformResources = 0;
  for (const type of terraformTypes) {
    terraformResources += await graph.countNodes(scanId, type);
  }

  // Count helm charts
  let helmCharts = 0;
  for (const type of helmTypes) {
    helmCharts += await graph.countNodes(scanId, type);
  }

  // Count k8s resources
  let k8sResources = 0;
  for (const type of k8sTypes) {
    k8sResources += await graph.countNodes(scanId, type);
  }

  // Count pipelines
  let pipelines = 0;
  for (const type of ciTypes) {
    pipelines += await graph.countNodes(scanId, type);
  }

  // Count cross-tool edges
  let crossToolEdges = 0;
  for (const edgeType of CROSS_TOOL_EDGE_TYPES) {
    crossToolEdges += await graph.countEdges(scanId, edgeType);
  }

  // Count specific data flows
  const feedsIntoEdges = await graph.getEdgesByType(scanId, 'FEEDS_INTO');
  const operatesOnEdges = await graph.getEdgesByType(scanId, 'OPERATES_ON');

  // Analyze edge endpoints to categorize flows
  let tfToHelm = 0;
  let helmToK8s = 0;
  let ciToTf = 0;
  let ciToHelm = 0;
  let argocdToHelm = 0;

  // Analyze FEEDS_INTO edges (primarily TF -> Helm)
  for (const edge of feedsIntoEdges) {
    const sourceNode = await graph.getNode(edge.sourceId);
    const targetNode = await graph.getNode(edge.targetId);
    if (!sourceNode || !targetNode) continue;

    const sourceTool = classifyNodeTool(sourceNode.type);
    const targetTool = classifyNodeTool(targetNode.type);

    if (sourceTool === 'terraform' && targetTool === 'helm') {
      tfToHelm++;
    } else if (sourceTool === 'helm' && targetTool === 'kubernetes') {
      helmToK8s++;
    } else if (sourceTool === 'argocd' && targetTool === 'helm') {
      argocdToHelm++;
    }
  }

  // Analyze OPERATES_ON edges (CI -> TF/Helm)
  for (const edge of operatesOnEdges) {
    const sourceNode = await graph.getNode(edge.sourceId);
    const targetNode = await graph.getNode(edge.targetId);
    if (!sourceNode || !targetNode) continue;

    const sourceTool = classifyNodeTool(sourceNode.type);
    const targetTool = classifyNodeTool(targetNode.type);

    if (sourceTool === 'ci' && targetTool === 'terraform') {
      ciToTf++;
    } else if (sourceTool === 'ci' && targetTool === 'helm') {
      ciToHelm++;
    }
  }

  // Calculate top cross-tool connections
  const connectionMap = new Map<string, { count: number; totalConfidence: number }>();

  const allCrossToolEdges = [...feedsIntoEdges, ...operatesOnEdges];
  for (const edge of allCrossToolEdges) {
    const sourceNode = await graph.getNode(edge.sourceId);
    const targetNode = await graph.getNode(edge.targetId);
    if (!sourceNode || !targetNode) continue;

    const sourceTool = classifyNodeTool(sourceNode.type);
    const targetTool = classifyNodeTool(targetNode.type);

    if (sourceTool !== targetTool) {
      const key = `${sourceTool}:${targetTool}`;
      const existing = connectionMap.get(key) ?? { count: 0, totalConfidence: 0 };
      existing.count++;
      existing.totalConfidence += edge.confidence;
      connectionMap.set(key, existing);
    }
  }

  const topCrossToolConnections: CrossToolConnection[] = [];
  for (const entry of Array.from(connectionMap.entries())) {
    const [key, value] = entry;
    const [sourceType, targetType] = key.split(':') as [ToolType, ToolType];
    topCrossToolConnections.push({
      sourceType,
      targetType,
      edgeCount: value.count,
      avgConfidence: value.count > 0 ? value.totalConfidence / value.count : 0,
    });
  }

  // Sort by edge count descending
  topCrossToolConnections.sort((a, b) => b.edgeCount - a.edgeCount);

  // Calculate detection rates
  const potentialTfHelmConnections = Math.min(terraformResources, helmCharts);
  const tfHelmDetection = potentialTfHelmConnections > 0
    ? (tfToHelm / potentialTfHelmConnections) * 100
    : 0;

  const ciPatternDetection = pipelines > 0
    ? ((ciToTf + ciToHelm) / pipelines) * 100
    : 0;

  return {
    scanId,
    totals: {
      terraformResources,
      helmCharts,
      k8sResources,
      pipelines,
      crossToolEdges,
    },
    dataFlows: {
      tfToHelm,
      helmToK8s,
      ciToTf,
      ciToHelm,
      argocdToHelm,
    },
    topCrossToolConnections: topCrossToolConnections.slice(0, 10),
    detectionRates: {
      tfHelmDetection: Math.round(tfHelmDetection * 100) / 100,
      ciPatternDetection: Math.round(ciPatternDetection * 100) / 100,
    },
  };
}

// ============================================================================
// Filtering Utilities
// ============================================================================

/**
 * Filter nodes by tool type.
 *
 * @param nodes - Array of nodes to filter
 * @param toolType - Tool type to filter by
 * @returns Filtered array of nodes
 */
export function filterNodesByTool(
  nodes: readonly GraphNodeRef[],
  toolType: ToolType
): readonly GraphNodeRef[] {
  return nodes.filter(node => classifyNodeTool(node.type) === toolType);
}

/**
 * Group nodes by their tool type.
 *
 * @param nodes - Array of nodes to group
 * @returns Map of tool type to nodes
 */
export function groupNodesByTool(
  nodes: readonly GraphNodeRef[]
): ReadonlyMap<ToolType, readonly GraphNodeRef[]> {
  const result = new Map<ToolType, GraphNodeRef[]>();
  const tools: ToolType[] = ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'];

  for (const tool of tools) {
    result.set(tool, []);
  }

  for (const node of nodes) {
    const tool = classifyNodeTool(node.type);
    const existing = result.get(tool) ?? [];
    (existing as GraphNodeRef[]).push(node);
  }

  return result;
}

/**
 * Count nodes by tool type.
 *
 * @param nodes - Array of nodes to count
 * @returns Record of tool type to count
 */
export function countNodesByTool(
  nodes: readonly GraphNodeRef[]
): Readonly<Record<ToolType, number>> {
  const result: Record<ToolType, number> = {
    terraform: 0,
    helm: 0,
    kubernetes: 0,
    ci: 0,
    argocd: 0,
  };

  for (const node of nodes) {
    const tool = classifyNodeTool(node.type);
    result[tool]++;
  }

  return result;
}
