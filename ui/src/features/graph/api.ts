/**
 * Graph API Functions
 * API functions for graph data fetching and manipulation
 * @module features/graph/api
 */

import { get, buildQueryString } from '@/core/api/client';
import type { GraphData, GraphNode, BlastRadius, GraphFilters } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Node detail response from API
 */
export interface NodeDetailResponse extends GraphNode {
  dependencies: GraphNode[];
  dependents: GraphNode[];
  depth: number;
}

/**
 * Graph fetch options
 */
export interface FetchGraphOptions {
  /** Filter by node types */
  nodeTypes?: string[];
  /** Filter by search query */
  search?: string;
  /** Maximum depth for graph traversal */
  maxDepth?: number;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Fetch graph data for a scan
 * @param scanId - The scan ID to fetch graph for
 * @param options - Optional filter parameters
 * @returns Graph data with nodes and edges
 */
export async function fetchGraph(
  scanId: string,
  options: FetchGraphOptions = {}
): Promise<GraphData> {
  const params: Record<string, string | number | undefined> = {
    maxDepth: options.maxDepth,
  };

  if (options.search) {
    params.search = options.search;
  }

  if (options.nodeTypes && options.nodeTypes.length > 0) {
    params.nodeTypes = options.nodeTypes.join(',');
  }

  const queryString = buildQueryString(params);
  return get<GraphData>(`/scans/${scanId}/graph${queryString}`);
}

/**
 * Fetch detailed information for a specific node
 * @param scanId - The scan ID
 * @param nodeId - The node ID to fetch details for
 * @returns Node details with dependencies and dependents
 */
export async function fetchNodeDetail(
  scanId: string,
  nodeId: string
): Promise<NodeDetailResponse> {
  return get<NodeDetailResponse>(`/scans/${scanId}/graph/nodes/${nodeId}`);
}

/**
 * Calculate blast radius for a node
 * @param scanId - The scan ID
 * @param nodeId - The node ID to calculate blast radius for
 * @returns Blast radius analysis
 */
export async function calculateBlastRadius(
  scanId: string,
  nodeId: string
): Promise<BlastRadius> {
  return get<BlastRadius>(`/scans/${scanId}/graph/nodes/${nodeId}/blast-radius`);
}

// ============================================================================
// Query Keys
// ============================================================================

/**
 * Query key factory for graph data
 */
export const graphKeys = {
  all: ['graph'] as const,

  graphs: () => [...graphKeys.all, 'data'] as const,

  graph: (scanId: string, filters?: Partial<GraphFilters>) =>
    [...graphKeys.graphs(), scanId, filters] as const,

  nodeDetails: () => [...graphKeys.all, 'node-detail'] as const,

  nodeDetail: (scanId: string, nodeId: string) =>
    [...graphKeys.nodeDetails(), scanId, nodeId] as const,

  blastRadius: () => [...graphKeys.all, 'blast-radius'] as const,

  blastRadiusForNode: (scanId: string, nodeId: string) =>
    [...graphKeys.blastRadius(), scanId, nodeId] as const,
};
