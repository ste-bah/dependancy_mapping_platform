/**
 * Graph Feature Types
 * Type definitions for dependency graph visualization
 * @module features/graph/types
 */

import type { Node, Edge, XYPosition } from '@xyflow/react';

// ============================================================================
// Node Types
// ============================================================================

/**
 * Possible node types in the dependency graph
 */
export type GraphNodeType =
  | 'terraform_resource'
  | 'terraform_module'
  | 'terraform_data_source'
  | 'helm_chart'
  | 'k8s_resource'
  | 'external_reference'
  | 'tg_config';

/**
 * All available node types as a constant array
 */
export const ALL_NODE_TYPES: readonly GraphNodeType[] = [
  'terraform_resource',
  'terraform_module',
  'terraform_data_source',
  'helm_chart',
  'k8s_resource',
  'external_reference',
  'tg_config',
] as const;

/**
 * Node location in source code
 */
export interface NodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
}

/**
 * Graph node from API
 */
export interface GraphNode {
  id: string;
  name: string;
  type: GraphNodeType;
  location?: NodeLocation;
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge types
 * Updated with Terragrunt-specific edge types from TASK-TG-008
 */
export type EdgeType =
  // Standard infrastructure edge types
  | 'DEPENDS_ON'
  | 'REFERENCES'
  | 'CONTAINS'
  | 'IMPORTS'
  // Terragrunt-specific edge types (TASK-TG-008)
  | 'tg_includes'       // Include block: child config -> parent config
  | 'tg_depends_on'     // Dependency block: config -> dependency config
  | 'tg_passes_input'   // Input flow: parent config -> child config
  | 'tg_sources';       // TF source: TG config -> TF module

/**
 * All available edge types as a constant array
 * Includes standard types + Terragrunt types from TASK-TG-008
 */
export const ALL_EDGE_TYPES: readonly EdgeType[] = [
  // Standard types
  'DEPENDS_ON',
  'REFERENCES',
  'CONTAINS',
  'IMPORTS',
  // Terragrunt types (TASK-TG-008)
  'tg_includes',
  'tg_depends_on',
  'tg_passes_input',
  'tg_sources',
] as const;

/**
 * Graph edge from API
 */
export interface GraphEdge {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: EdgeType;
  confidence: number; // 0-1
}

/**
 * Graph metadata from API response
 */
export interface GraphMetadata {
  scanId: string;
  repositoryId: string;
  generatedAt: string;
  nodeCount?: number;
  edgeCount?: number;
}

/**
 * Complete graph data from API
 */
export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata?: GraphMetadata;
}

// ============================================================================
// Terragrunt Node Types
// ============================================================================

/**
 * Terragrunt config node metadata structure
 * Matches backend TerragruntConfigNode interface
 */
export interface TerragruntConfigNodeData {
  /** Terraform source reference (local path, git URL, or registry) */
  terraformSource: string | null;
  /** Whether this config has remote_state block */
  hasRemoteState: boolean;
  /** Remote state backend type (e.g., 's3', 'gcs', 'azurerm') */
  remoteStateBackend: string | null;
  /** Number of include blocks in this config */
  includeCount: number;
  /** Number of dependency blocks in this config */
  dependencyCount: number;
  /** Number of inputs defined in this config */
  inputCount: number;
  /** Names of generate blocks in this config */
  generateBlocks: string[];
}

/**
 * Type guard to check if a node is a Terragrunt config node
 */
export function isTerragruntConfigNode(node: GraphNode): boolean {
  return node.type === 'tg_config';
}

/**
 * Extract Terragrunt-specific metadata from a node
 * Returns undefined if node is not a Terragrunt config node or metadata is missing
 */
export function getTerragruntMetadata(node: GraphNode): TerragruntConfigNodeData | undefined {
  if (!isTerragruntConfigNode(node) || !node.metadata) {
    return undefined;
  }

  const meta = node.metadata as Record<string, unknown>;

  // Validate required fields exist
  if (typeof meta.hasRemoteState !== 'boolean') {
    return undefined;
  }

  return {
    terraformSource: (meta.terraformSource as string | null) ?? null,
    hasRemoteState: meta.hasRemoteState,
    remoteStateBackend: (meta.remoteStateBackend as string | null) ?? null,
    includeCount: typeof meta.includeCount === 'number' ? meta.includeCount : 0,
    dependencyCount: typeof meta.dependencyCount === 'number' ? meta.dependencyCount : 0,
    inputCount: typeof meta.inputCount === 'number' ? meta.inputCount : 0,
    generateBlocks: Array.isArray(meta.generateBlocks) ? meta.generateBlocks as string[] : [],
  };
}

// ============================================================================
// React Flow Integration Types
// ============================================================================

/**
 * Custom node data that extends Record<string, unknown> for React Flow v12 compatibility.
 * Includes GraphNode properties plus UI state flags for rendering.
 */
export interface CustomNodeData extends Record<string, unknown> {
  /** Unique node identifier */
  id: string;
  /** Display name of the node */
  name: string;
  /** Type of infrastructure resource */
  type: GraphNodeType;
  /** Source code location */
  location?: NodeLocation;
  /** Additional metadata from the parser */
  metadata?: Record<string, unknown>;
  /** Whether this node is currently selected */
  selected?: boolean;
  /** Whether this node is highlighted (e.g., in blast radius) */
  highlighted?: boolean;
  /** Whether this node should appear dimmed (not in focus) */
  dimmed?: boolean;
}

/**
 * Custom edge data for React Flow
 */
export interface CustomEdgeData extends Record<string, unknown> {
  /** Edge relationship type */
  type: EdgeType;
  /** Confidence score of the relationship (0-1) */
  confidence: number;
  /** Whether this edge is highlighted */
  highlighted?: boolean;
}

/**
 * React Flow node type with custom data
 */
export type FlowNode = Node<CustomNodeData, 'customNode'>;

/**
 * React Flow edge type with custom data
 */
export type FlowEdge = Edge<CustomEdgeData>;

/**
 * Node position in the graph layout
 */
export interface NodePosition {
  nodeId: string;
  position: XYPosition;
}

/**
 * Graph layout result containing positioned nodes
 */
export interface GraphLayout {
  nodes: FlowNode[];
  edges: FlowEdge[];
  bounds: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  };
}

// ============================================================================
// Blast Radius
// ============================================================================

/**
 * Severity level for blast radius impact
 */
export type ImpactSeverity = 'critical' | 'high' | 'medium' | 'low' | 'minimal';

/**
 * Affected node with impact details
 */
export interface AffectedNode {
  /** Node ID */
  id: string;
  /** Node name */
  name: string;
  /** Node type */
  type: GraphNodeType;
  /** Whether directly dependent (1 hop) or transitive */
  isDirect: boolean;
  /** Number of hops from the source node */
  depth: number;
}

/**
 * Blast radius analysis result
 */
export interface BlastRadius {
  nodeId: string;
  directDependents: number;
  transitiveDependents: number;
  impactScore: number;
  affectedNodes: string[];
}

/**
 * Extended blast radius response with detailed affected nodes
 */
export interface BlastRadiusResponse {
  nodeId: string;
  directDependents: number;
  transitiveDependents: number;
  impactScore: number;
  severity: ImpactSeverity;
  affectedNodes: AffectedNode[];
}

/**
 * Calculate impact severity from score
 */
export function getImpactSeverity(score: number): ImpactSeverity {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'high';
  if (score >= 0.4) return 'medium';
  if (score >= 0.2) return 'low';
  return 'minimal';
}

// ============================================================================
// UI State Types
// ============================================================================

/**
 * Graph filter state
 */
export interface GraphFilters {
  nodeTypes: GraphNodeType[];
  search: string;
  showBlastRadius: boolean;
}

/**
 * Extended graph filters with additional options
 */
export interface ExtendedGraphFilters extends GraphFilters {
  /** Edge types to display */
  edgeTypes: EdgeType[];
  /** Minimum confidence threshold for edges (0-1) */
  minConfidence: number;
  /** Maximum traversal depth from selected node */
  maxDepth: number;
  /** Only show connected nodes */
  showConnectedOnly: boolean;
}

/**
 * Default graph filters
 */
export const defaultGraphFilters: GraphFilters = {
  nodeTypes: [
    'terraform_resource',
    'terraform_module',
    'terraform_data_source',
    'helm_chart',
    'k8s_resource',
    'external_reference',
    'tg_config',
  ],
  search: '',
  showBlastRadius: false,
};

/**
 * Default extended graph filters
 */
export const defaultExtendedGraphFilters: ExtendedGraphFilters = {
  ...defaultGraphFilters,
  edgeTypes: [...ALL_EDGE_TYPES],
  minConfidence: 0,
  maxDepth: Infinity,
  showConnectedOnly: false,
};

/**
 * Graph view state (pan/zoom)
 */
export interface GraphViewState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * Selection state for graph
 */
export interface GraphSelectionState {
  /** Currently selected node ID */
  selectedNodeId: string | null;
  /** Set of highlighted node IDs (e.g., blast radius) */
  highlightedNodeIds: Set<string>;
  /** Set of highlighted edge IDs */
  highlightedEdgeIds: Set<string>;
}

// ============================================================================
// Node Styling
// ============================================================================

/**
 * Color mapping for node types
 */
export const nodeColors: Record<GraphNodeType, string> = {
  terraform_resource: '#7B61FF',    // Purple
  terraform_module: '#FF6B6B',      // Red
  terraform_data_source: '#4ECDC4', // Teal
  helm_chart: '#45B7D1',            // Blue
  k8s_resource: '#96CEB4',          // Green
  external_reference: '#FFEAA7',    // Yellow
  tg_config: '#8B5CF6',             // Violet - Terragrunt Config
};

/**
 * Label mapping for node types
 */
export const nodeTypeLabels: Record<GraphNodeType, string> = {
  terraform_resource: 'TF Resource',
  terraform_module: 'TF Module',
  terraform_data_source: 'TF Data',
  helm_chart: 'Helm Chart',
  k8s_resource: 'K8s Resource',
  external_reference: 'External',
  tg_config: 'Terragrunt Config',
};

/**
 * Icon mapping for node types
 */
export const nodeTypeIcons: Record<GraphNodeType, string> = {
  terraform_resource: '📦',
  terraform_module: '📁',
  terraform_data_source: '📊',
  helm_chart: '⎈',
  k8s_resource: '☸️',
  external_reference: '🔗',
  tg_config: '🌿',
};

/**
 * Edge styling configuration
 */
export interface EdgeStyle {
  stroke: string;
  strokeWidth: number;
  animated: boolean;
  opacity: number;
}

/**
 * Default edge styles by type
 * Updated with Terragrunt-specific edge styles from TASK-TG-008
 */
export const edgeStyles: Record<EdgeType, Partial<EdgeStyle>> = {
  // Standard edge styles
  DEPENDS_ON: {
    stroke: '#6366F1',
    strokeWidth: 2,
    animated: true,
  },
  REFERENCES: {
    stroke: '#94A3B8',
    strokeWidth: 1,
    animated: false,
  },
  CONTAINS: {
    stroke: '#22C55E',
    strokeWidth: 1.5,
    animated: false,
  },
  IMPORTS: {
    stroke: '#F59E0B',
    strokeWidth: 1.5,
    animated: false,
  },
  // Terragrunt edge styles (TASK-TG-008)
  tg_includes: {
    stroke: '#8B5CF6',      // Violet - matches tg_config node color
    strokeWidth: 2,
    animated: false,
  },
  tg_depends_on: {
    stroke: '#A78BFA',      // Light violet - dependency relationship
    strokeWidth: 2,
    animated: true,         // Animated to show dependency flow
  },
  tg_passes_input: {
    stroke: '#C4B5FD',      // Lighter violet - input flow
    strokeWidth: 1.5,
    animated: true,         // Animated to show data flow
  },
  tg_sources: {
    stroke: '#7C3AED',      // Dark violet - source linkage
    strokeWidth: 1.5,
    animated: false,
  },
};

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard to check if a value is a valid GraphNodeType
 */
export function isGraphNodeType(value: unknown): value is GraphNodeType {
  return (
    typeof value === 'string' &&
    ALL_NODE_TYPES.includes(value as GraphNodeType)
  );
}

/**
 * Type guard to check if a value is a valid EdgeType
 */
export function isEdgeType(value: unknown): value is EdgeType {
  return (
    typeof value === 'string' &&
    ALL_EDGE_TYPES.includes(value as EdgeType)
  );
}

/**
 * Type guard to check if a value is a valid GraphNode
 */
export function isGraphNode(value: unknown): value is GraphNode {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    isGraphNodeType(obj.type)
  );
}

/**
 * Type guard to check if a value is a valid GraphEdge
 */
export function isGraphEdge(value: unknown): value is GraphEdge {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    typeof obj.sourceNodeId === 'string' &&
    typeof obj.targetNodeId === 'string' &&
    isEdgeType(obj.type) &&
    typeof obj.confidence === 'number' &&
    obj.confidence >= 0 &&
    obj.confidence <= 1
  );
}

/**
 * Type guard to check if a value is valid GraphData
 */
export function isGraphData(value: unknown): value is GraphData {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    Array.isArray(obj.nodes) &&
    Array.isArray(obj.edges) &&
    obj.nodes.every(isGraphNode) &&
    obj.edges.every(isGraphEdge)
  );
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Callback type for node selection
 */
export type NodeSelectHandler = (nodeId: string | null) => void;

/**
 * Callback type for filter changes
 */
export type FilterChangeHandler = (filters: Partial<GraphFilters>) => void;

/**
 * Callback type for extended filter changes
 */
export type ExtendedFilterChangeHandler = (filters: Partial<ExtendedGraphFilters>) => void;

/**
 * Graph action types for state management
 */
export type GraphAction =
  | { type: 'SELECT_NODE'; payload: string | null }
  | { type: 'SET_FILTERS'; payload: Partial<GraphFilters> }
  | { type: 'RESET_FILTERS' }
  | { type: 'SET_HIGHLIGHTED'; payload: Set<string> }
  | { type: 'CLEAR_HIGHLIGHTED' }
  | { type: 'SET_VIEW'; payload: GraphViewState }
  | { type: 'TOGGLE_BLAST_RADIUS' };

/**
 * Statistics for a graph
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<GraphNodeType, number>;
  edgesByType: Record<EdgeType, number>;
  avgDependencies: number;
  maxDependencies: number;
  isolatedNodes: number;
}
