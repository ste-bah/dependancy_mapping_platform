/**
 * Graph API Types
 * Type definitions for API requests and responses
 * @module features/graph/types/api
 */

import type {
  GraphNode,
  GraphEdge,
  GraphMetadata,
  GraphNodeType,
  EdgeType,
  BlastRadius,
  AffectedNode,
  ImpactSeverity,
} from '../types';

// ============================================================================
// Request Types
// ============================================================================

/**
 * Parameters for fetching graph data
 */
export interface FetchGraphParams {
  /** Scan ID to fetch graph for */
  scanId: string;
  /** Filter by node types */
  nodeTypes?: GraphNodeType[];
  /** Filter by edge types */
  edgeTypes?: EdgeType[];
  /** Search query for filtering nodes */
  search?: string;
  /** Maximum depth for graph traversal */
  maxDepth?: number;
  /** Minimum confidence threshold for edges */
  minConfidence?: number;
  /** Include only connected nodes */
  connectedOnly?: boolean;
}

/**
 * Parameters for fetching node details
 */
export interface FetchNodeDetailParams {
  /** Scan ID */
  scanId: string;
  /** Node ID to fetch details for */
  nodeId: string;
  /** Include dependency tree */
  includeDependencies?: boolean;
  /** Include dependent tree */
  includeDependents?: boolean;
  /** Maximum depth for dependency traversal */
  maxDepth?: number;
}

/**
 * Parameters for calculating blast radius
 */
export interface CalculateBlastRadiusParams {
  /** Scan ID */
  scanId: string;
  /** Node ID to calculate blast radius for */
  nodeId: string;
  /** Maximum traversal depth */
  maxDepth?: number;
  /** Include detailed affected node information */
  includeDetails?: boolean;
}

/**
 * Parameters for searching nodes
 */
export interface SearchNodesParams {
  /** Scan ID */
  scanId: string;
  /** Search query */
  query: string;
  /** Maximum number of results */
  limit?: number;
  /** Filter by node types */
  nodeTypes?: GraphNodeType[];
}

// ============================================================================
// Response Types
// ============================================================================

/**
 * Standard API response wrapper
 */
export interface ApiResponseWrapper<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration: number;
  };
}

/**
 * Graph data response from API
 */
export interface GraphDataResponse {
  nodes: GraphNode[];
  edges: GraphEdge[];
  metadata: GraphMetadata;
}

/**
 * Node detail response from API
 */
export interface NodeDetailResponse extends GraphNode {
  /** Nodes this node depends on */
  dependencies: GraphNode[];
  /** Nodes that depend on this node */
  dependents: GraphNode[];
  /** Depth in the overall graph hierarchy */
  depth: number;
  /** Total transitive dependency count */
  totalDependencies?: number;
  /** Total transitive dependent count */
  totalDependents?: number;
}

/**
 * Blast radius response from API
 */
export interface BlastRadiusResponse extends BlastRadius {
  /** Severity classification */
  severity: ImpactSeverity;
  /** Detailed affected node information */
  affectedNodeDetails?: AffectedNode[];
}

/**
 * Node search result
 */
export interface NodeSearchResult {
  /** Matching node */
  node: GraphNode;
  /** Match score (lower is better) */
  score: number;
  /** Matched fields */
  matchedFields: string[];
}

/**
 * Search response from API
 */
export interface SearchNodesResponse {
  results: NodeSearchResult[];
  total: number;
  query: string;
}

/**
 * Graph statistics response
 */
export interface GraphStatsResponse {
  /** Total number of nodes */
  totalNodes: number;
  /** Total number of edges */
  totalEdges: number;
  /** Nodes grouped by type */
  nodesByType: Record<GraphNodeType, number>;
  /** Edges grouped by type */
  edgesByType: Record<EdgeType, number>;
  /** Average outgoing dependencies per node */
  avgDependencies: number;
  /** Maximum outgoing dependencies for any node */
  maxDependencies: number;
  /** Nodes with no connections */
  isolatedNodes: number;
  /** Average confidence score across all edges */
  avgConfidence: number;
}

// ============================================================================
// Query Key Types
// ============================================================================

/**
 * Query key tuple for graph data
 */
export type GraphQueryKey = readonly ['graph', 'data', string, Record<string, unknown> | undefined];

/**
 * Query key tuple for node detail
 */
export type NodeDetailQueryKey = readonly ['graph', 'node-detail', string, string];

/**
 * Query key tuple for blast radius
 */
export type BlastRadiusQueryKey = readonly ['graph', 'blast-radius', string, string];

/**
 * Query key tuple for node search
 */
export type SearchQueryKey = readonly ['graph', 'search', string, string];

// ============================================================================
// Error Types
// ============================================================================

/**
 * Graph-specific error codes
 */
export const GraphErrorCodes = {
  GRAPH_NOT_FOUND: 'GRAPH_NOT_FOUND',
  NODE_NOT_FOUND: 'NODE_NOT_FOUND',
  SCAN_NOT_FOUND: 'SCAN_NOT_FOUND',
  INVALID_NODE_TYPE: 'INVALID_NODE_TYPE',
  INVALID_EDGE_TYPE: 'INVALID_EDGE_TYPE',
  MAX_DEPTH_EXCEEDED: 'MAX_DEPTH_EXCEEDED',
  GRAPH_TOO_LARGE: 'GRAPH_TOO_LARGE',
  CALCULATION_TIMEOUT: 'CALCULATION_TIMEOUT',
} as const;

export type GraphErrorCode = (typeof GraphErrorCodes)[keyof typeof GraphErrorCodes];

/**
 * Graph-specific error response
 */
export interface GraphError {
  code: GraphErrorCode;
  message: string;
  nodeId?: string;
  scanId?: string;
  details?: Record<string, unknown>;
}

/**
 * Type guard for GraphError
 */
export function isGraphError(value: unknown): value is GraphError {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.code === 'string' &&
    Object.values(GraphErrorCodes).includes(obj.code as GraphErrorCode) &&
    typeof obj.message === 'string'
  );
}

// ============================================================================
// Mutation Types
// ============================================================================

/**
 * Node update request
 */
export interface UpdateNodeRequest {
  scanId: string;
  nodeId: string;
  updates: Partial<Pick<GraphNode, 'name' | 'metadata'>>;
}

/**
 * Batch node update request
 */
export interface BatchUpdateNodesRequest {
  scanId: string;
  updates: Array<{
    nodeId: string;
    updates: Partial<Pick<GraphNode, 'name' | 'metadata'>>;
  }>;
}

/**
 * Export graph request
 */
export interface ExportGraphRequest {
  scanId: string;
  format: 'json' | 'dot' | 'svg' | 'png';
  options?: {
    includeMetadata?: boolean;
    nodeTypes?: GraphNodeType[];
    edgeTypes?: EdgeType[];
  };
}

/**
 * Export graph response
 */
export interface ExportGraphResponse {
  format: string;
  data: string;
  filename: string;
  contentType: string;
}
