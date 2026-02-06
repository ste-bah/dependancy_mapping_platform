/**
 * Cross-Tool Rollup Query Types
 * @module rollup/types
 *
 * Type definitions for cross-tool rollup queries that span Terraform, Helm,
 * and CI/CD in the unified graph. Supports blast radius calculation,
 * end-to-end flow tracing, and cross-tool impact reports.
 *
 * TASK-XREF-008: Cross-Tool Rollup Query Types
 */

// ============================================================================
// Tool Type Classification
// ============================================================================

/**
 * Supported tool types in the unified graph
 */
export type ToolType = 'terraform' | 'helm' | 'kubernetes' | 'ci' | 'argocd';

/**
 * Node types mapped to their tool classification
 */
export const NODE_TYPE_TO_TOOL: Readonly<Record<string, ToolType>> = {
  // Terraform
  terraform_resource: 'terraform',
  terraform_data: 'terraform',
  terraform_module: 'terraform',
  terraform_variable: 'terraform',
  terraform_output: 'terraform',
  terraform_local: 'terraform',
  terraform_provider: 'terraform',
  // Terragrunt (classified as terraform)
  tg_config: 'terraform',
  tg_include: 'terraform',
  tg_dependency: 'terraform',
  // Helm
  helm_chart: 'helm',
  helm_release: 'helm',
  helm_value: 'helm',
  // Kubernetes
  k8s_deployment: 'kubernetes',
  k8s_service: 'kubernetes',
  k8s_configmap: 'kubernetes',
  k8s_secret: 'kubernetes',
  k8s_ingress: 'kubernetes',
  k8s_pod: 'kubernetes',
  k8s_statefulset: 'kubernetes',
  k8s_daemonset: 'kubernetes',
  k8s_job: 'kubernetes',
  k8s_cronjob: 'kubernetes',
  k8s_namespace: 'kubernetes',
  k8s_serviceaccount: 'kubernetes',
  k8s_role: 'kubernetes',
  k8s_rolebinding: 'kubernetes',
  k8s_clusterrole: 'kubernetes',
  k8s_clusterrolebinding: 'kubernetes',
  k8s_persistentvolume: 'kubernetes',
  k8s_persistentvolumeclaim: 'kubernetes',
  k8s_storageclass: 'kubernetes',
  k8s_networkpolicy: 'kubernetes',
  // CI/CD
  ci_pipeline: 'ci',
  ci_job: 'ci',
  // ArgoCD
  argocd_application: 'argocd',
  argocd_project: 'argocd',
  argocd_repository: 'argocd',
};

/**
 * Edge types that cross tool boundaries
 */
export const CROSS_TOOL_EDGE_TYPES: readonly string[] = [
  'FEEDS_INTO',        // TF -> Helm
  'OPERATES_ON',       // CI -> TF/Helm
  'PIPELINE_CONTAINS', // CI pipeline structure
  'tg_sources',        // TG -> TF
  'module_source',     // Helm release -> chart
];

// ============================================================================
// Graph Node and Edge References
// ============================================================================

/**
 * Reference to a graph node with essential fields
 */
export interface GraphNodeRef {
  /** Unique node identifier */
  readonly id: string;
  /** Node type (e.g., terraform_resource, helm_release) */
  readonly type: string;
  /** Node name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
}

/**
 * Reference to a graph edge with essential fields
 */
export interface GraphEdgeRef {
  /** Unique edge identifier */
  readonly id: string;
  /** Source node ID */
  readonly sourceId: string;
  /** Target node ID */
  readonly targetId: string;
  /** Edge type */
  readonly type: string;
  /** Confidence score (0-100) */
  readonly confidence: number;
}

// ============================================================================
// Impact Analysis Types
// ============================================================================

/**
 * Collection of impacted nodes categorized by relationship
 */
export interface ImpactedNodes {
  /** Directly connected nodes (depth 1) */
  readonly direct: readonly GraphNodeRef[];
  /** Transitively connected nodes (depth > 1) */
  readonly transitive: readonly GraphNodeRef[];
  /** Total count of impacted nodes */
  readonly count: number;
}

/**
 * Path through the graph crossing tool boundaries
 */
export interface CrossToolPath {
  /** Ordered list of nodes in the path */
  readonly nodes: readonly GraphNodeRef[];
  /** Edges connecting the nodes */
  readonly edges: readonly GraphEdgeRef[];
  /** Number of edges in the path */
  readonly pathLength: number;
  /** Human-readable description of the path */
  readonly description: string;
  /** Tool types crossed by this path */
  readonly crossesTools: readonly ToolType[];
}

/**
 * Complete cross-tool blast radius analysis
 */
export interface CrossToolBlastRadius {
  /** Node that was analyzed */
  readonly sourceNode: GraphNodeRef;
  /** Impact categorized by tool type */
  readonly impactByTool: Readonly<Record<ToolType, ImpactedNodes>>;
  /** Total count of all impacted nodes */
  readonly totalImpact: number;
  /** Critical paths that span multiple tools */
  readonly criticalPaths: readonly CrossToolPath[];
  /** Human-readable summary of the impact */
  readonly summary: string;
  /** ISO timestamp of when analysis was performed */
  readonly calculatedAt: string;
}

// ============================================================================
// End-to-End Flow Types
// ============================================================================

/**
 * Source types for end-to-end flows
 */
export type FlowSourceType = 'terraform_resource' | 'terraform_output' | 'terragrunt_output';

/**
 * Destination types for end-to-end flows
 */
export type FlowDestinationType = 'k8s_resource' | 'helm_release' | 'argocd_application';

/**
 * End-to-end data flow from infrastructure to deployment
 */
export interface EndToEndFlow {
  /** Unique flow identifier */
  readonly id: string;
  /** Source of the data flow */
  readonly source: {
    readonly type: FlowSourceType;
    readonly node: GraphNodeRef;
  };
  /** Destination of the data flow */
  readonly destination: {
    readonly type: FlowDestinationType;
    readonly node: GraphNodeRef;
  };
  /** Intermediate nodes in the flow */
  readonly intermediates: readonly GraphNodeRef[];
  /** Edges that make up the flow */
  readonly edges: readonly GraphEdgeRef[];
  /** Pipeline that orchestrates this flow (if any) */
  readonly pipeline?: GraphNodeRef;
  /** Confidence in the flow detection (0-100) */
  readonly confidence: number;
}

// ============================================================================
// Summary and Statistics Types
// ============================================================================

/**
 * Connection between two tool types
 */
export interface CrossToolConnection {
  /** Source tool type */
  readonly sourceType: ToolType;
  /** Target tool type */
  readonly targetType: ToolType;
  /** Number of edges connecting these tools */
  readonly edgeCount: number;
  /** Average confidence of these edges */
  readonly avgConfidence: number;
}

/**
 * Summary of cross-tool relationships in a scan
 */
export interface CrossToolSummary {
  /** Scan identifier */
  readonly scanId: string;
  /** Total counts by category */
  readonly totals: {
    readonly terraformResources: number;
    readonly helmCharts: number;
    readonly k8sResources: number;
    readonly pipelines: number;
    readonly crossToolEdges: number;
  };
  /** Data flow counts between tools */
  readonly dataFlows: {
    readonly tfToHelm: number;
    readonly helmToK8s: number;
    readonly ciToTf: number;
    readonly ciToHelm: number;
    readonly argocdToHelm: number;
  };
  /** Top connections ordered by edge count */
  readonly topCrossToolConnections: readonly CrossToolConnection[];
  /** Detection rate metrics */
  readonly detectionRates: {
    /** TF-to-Helm detection rate (target >= 65%) */
    readonly tfHelmDetection: number;
    /** CI pattern detection rate */
    readonly ciPatternDetection: number;
  };
}

// ============================================================================
// Query Options
// ============================================================================

/**
 * Options for blast radius calculation
 */
export interface BlastRadiusOptions {
  /** Maximum traversal depth (default: 5) */
  readonly maxDepth?: number;
  /** Include CI/CD nodes in analysis (default: true) */
  readonly includeCI?: boolean;
  /** Minimum confidence threshold (default: 0.3) */
  readonly minConfidence?: number;
  /** Filter to specific tool types */
  readonly toolFilter?: readonly ToolType[];
}

/**
 * Options for edge queries
 */
export interface EdgeQueryOptions {
  /** Filter by edge types */
  readonly edgeTypes?: readonly string[];
  /** Minimum confidence threshold */
  readonly minConfidence?: number;
  /** Maximum number of edges to return */
  readonly limit?: number;
}

// ============================================================================
// Graph Query Interface
// ============================================================================

/**
 * Interface for querying the unified graph.
 * Used by rollup functions to access graph data.
 */
export interface GraphQueryInterface {
  /**
   * Get a node by its ID
   */
  getNode(nodeId: string): Promise<GraphNodeRef | null>;

  /**
   * Get edges originating from a node
   */
  getEdgesFromNode(
    nodeId: string,
    options?: EdgeQueryOptions
  ): Promise<readonly GraphEdgeRef[]>;

  /**
   * Get edges targeting a node
   */
  getEdgesToNode(
    nodeId: string,
    options?: EdgeQueryOptions
  ): Promise<readonly GraphEdgeRef[]>;

  /**
   * Get all nodes of a specific type in a scan
   */
  getNodesByType(
    scanId: string,
    nodeType: string
  ): Promise<readonly GraphNodeRef[]>;

  /**
   * Get all edges of a specific type in a scan
   */
  getEdgesByType(
    scanId: string,
    edgeType: string
  ): Promise<readonly GraphEdgeRef[]>;

  /**
   * Count nodes in a scan, optionally by type
   */
  countNodes(scanId: string, nodeType?: string): Promise<number>;

  /**
   * Count edges in a scan, optionally by type
   */
  countEdges(scanId: string, edgeType?: string): Promise<number>;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an empty ImpactedNodes structure
 */
export function createEmptyImpactedNodes(): ImpactedNodes {
  return {
    direct: [],
    transitive: [],
    count: 0,
  };
}

/**
 * Create an empty CrossToolSummary structure
 */
export function createEmptyCrossToolSummary(scanId: string): CrossToolSummary {
  return {
    scanId,
    totals: {
      terraformResources: 0,
      helmCharts: 0,
      k8sResources: 0,
      pipelines: 0,
      crossToolEdges: 0,
    },
    dataFlows: {
      tfToHelm: 0,
      helmToK8s: 0,
      ciToTf: 0,
      ciToHelm: 0,
      argocdToHelm: 0,
    },
    topCrossToolConnections: [],
    detectionRates: {
      tfHelmDetection: 0,
      ciPatternDetection: 0,
    },
  };
}

/**
 * Create a GraphNodeRef from basic properties
 */
export function createGraphNodeRef(
  id: string,
  type: string,
  name: string,
  filePath: string
): GraphNodeRef {
  return { id, type, name, filePath };
}

/**
 * Create a GraphEdgeRef from basic properties
 */
export function createGraphEdgeRef(
  id: string,
  sourceId: string,
  targetId: string,
  type: string,
  confidence: number
): GraphEdgeRef {
  return { id, sourceId, targetId, type, confidence };
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a value is a valid ToolType
 */
export function isToolType(value: unknown): value is ToolType {
  return (
    typeof value === 'string' &&
    ['terraform', 'helm', 'kubernetes', 'ci', 'argocd'].includes(value)
  );
}

/**
 * Check if a value is a valid GraphNodeRef
 */
export function isGraphNodeRef(value: unknown): value is GraphNodeRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GraphNodeRef).id === 'string' &&
    typeof (value as GraphNodeRef).type === 'string' &&
    typeof (value as GraphNodeRef).name === 'string' &&
    typeof (value as GraphNodeRef).filePath === 'string'
  );
}

/**
 * Check if a value is a valid GraphEdgeRef
 */
export function isGraphEdgeRef(value: unknown): value is GraphEdgeRef {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as GraphEdgeRef).id === 'string' &&
    typeof (value as GraphEdgeRef).sourceId === 'string' &&
    typeof (value as GraphEdgeRef).targetId === 'string' &&
    typeof (value as GraphEdgeRef).type === 'string' &&
    typeof (value as GraphEdgeRef).confidence === 'number'
  );
}

/**
 * Check if a value is a valid CrossToolBlastRadius
 */
export function isCrossToolBlastRadius(value: unknown): value is CrossToolBlastRadius {
  return (
    typeof value === 'object' &&
    value !== null &&
    'sourceNode' in value &&
    'impactByTool' in value &&
    'totalImpact' in value &&
    'criticalPaths' in value &&
    'summary' in value &&
    'calculatedAt' in value
  );
}

/**
 * Check if a value is a valid EndToEndFlow
 */
export function isEndToEndFlow(value: unknown): value is EndToEndFlow {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as EndToEndFlow).id === 'string' &&
    'source' in value &&
    'destination' in value &&
    Array.isArray((value as EndToEndFlow).intermediates) &&
    Array.isArray((value as EndToEndFlow).edges) &&
    typeof (value as EndToEndFlow).confidence === 'number'
  );
}

/**
 * Check if a value is a valid CrossToolSummary
 */
export function isCrossToolSummary(value: unknown): value is CrossToolSummary {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as CrossToolSummary).scanId === 'string' &&
    'totals' in value &&
    'dataFlows' in value &&
    'topCrossToolConnections' in value &&
    'detectionRates' in value
  );
}
