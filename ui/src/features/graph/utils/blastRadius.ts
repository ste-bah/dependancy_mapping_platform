/**
 * Blast Radius Calculator
 * Client-side utilities for blast radius analysis
 * @module features/graph/utils/blastRadius
 */

import type {
  GraphNode,
  FlowNode,
  FlowEdge,
  BlastRadiusResponse,
  AffectedNode,
  ImpactSeverity,
} from '../types';
import { IMPACT_THRESHOLDS, MAX_BLAST_RADIUS_DEPTH, IMPACT_COLORS } from './constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Client-side blast radius calculation result
 */
export interface ClientBlastRadius {
  /** Source node ID */
  nodeId: string;
  /** Direct dependents count */
  directDependents: number;
  /** Transitive dependents count */
  transitiveDependents: number;
  /** Calculated impact score (0-1) */
  impactScore: number;
  /** Impact severity level */
  severity: ImpactSeverity;
  /** All affected node IDs */
  affectedNodeIds: Set<string>;
  /** Affected nodes by depth level */
  affectedByDepth: Map<number, string[]>;
}

// ============================================================================
// Affected Node Extraction
// ============================================================================

/**
 * Get set of all affected node IDs from blast radius response
 *
 * @param blastRadius - Blast radius response from API
 * @returns Set of affected node IDs
 *
 * @example
 * ```ts
 * const affectedIds = getAffectedNodeIds(blastRadiusData);
 * const isAffected = affectedIds.has(nodeId);
 * ```
 */
export function getAffectedNodeIds(blastRadius: BlastRadiusResponse): Set<string> {
  const ids = new Set<string>();

  if (!blastRadius || !blastRadius.affectedNodes) {
    return ids;
  }

  for (const affected of blastRadius.affectedNodes) {
    ids.add(affected.id);
  }

  return ids;
}

/**
 * Get affected nodes grouped by whether they are direct or transitive
 *
 * @param blastRadius - Blast radius response
 * @returns Object with direct and transitive node arrays
 */
export function getAffectedByType(blastRadius: BlastRadiusResponse): {
  direct: AffectedNode[];
  transitive: AffectedNode[];
} {
  const direct: AffectedNode[] = [];
  const transitive: AffectedNode[] = [];

  if (!blastRadius || !blastRadius.affectedNodes) {
    return { direct, transitive };
  }

  for (const affected of blastRadius.affectedNodes) {
    if (affected.isDirect) {
      direct.push(affected);
    } else {
      transitive.push(affected);
    }
  }

  return { direct, transitive };
}

/**
 * Get affected nodes grouped by depth level
 *
 * @param blastRadius - Blast radius response
 * @returns Map from depth level to array of affected nodes
 */
export function getAffectedByDepth(blastRadius: BlastRadiusResponse): Map<number, AffectedNode[]> {
  const byDepth = new Map<number, AffectedNode[]>();

  if (!blastRadius || !blastRadius.affectedNodes) {
    return byDepth;
  }

  for (const affected of blastRadius.affectedNodes) {
    const depth = affected.depth;
    const existing = byDepth.get(depth) ?? [];
    existing.push(affected);
    byDepth.set(depth, existing);
  }

  return byDepth;
}

// ============================================================================
// Impact Level Calculation
// ============================================================================

/**
 * Get the impact level (depth) of a specific node in blast radius
 *
 * @param nodeId - Node ID to check
 * @param blastRadius - Blast radius response
 * @returns Depth level (1 = direct, 2+ = transitive) or -1 if not affected
 *
 * @example
 * ```ts
 * const level = getImpactLevel('node-5', blastRadiusData);
 * if (level === 1) console.log('Direct dependent');
 * ```
 */
export function getImpactLevel(
  nodeId: string,
  blastRadius: BlastRadiusResponse
): number {
  if (!blastRadius || !blastRadius.affectedNodes) {
    return -1;
  }

  const affected = blastRadius.affectedNodes.find(n => n.id === nodeId);
  return affected ? affected.depth : -1;
}

/**
 * Determine impact severity from impact score
 *
 * @param score - Impact score (0-1)
 * @returns Impact severity level
 */
export function getImpactSeverityFromScore(score: number): ImpactSeverity {
  if (score >= IMPACT_THRESHOLDS.critical) return 'critical';
  if (score >= IMPACT_THRESHOLDS.high) return 'high';
  if (score >= IMPACT_THRESHOLDS.medium) return 'medium';
  if (score >= IMPACT_THRESHOLDS.low) return 'low';
  return 'minimal';
}

/**
 * Get color for impact severity
 *
 * @param severity - Impact severity level
 * @returns Hex color string
 */
export function getImpactColor(severity: ImpactSeverity): string {
  return IMPACT_COLORS[severity];
}

/**
 * Get color for impact score
 *
 * @param score - Impact score (0-1)
 * @returns Hex color string
 */
export function getImpactColorFromScore(score: number): string {
  return getImpactColor(getImpactSeverityFromScore(score));
}

// ============================================================================
// Sorting and Ranking
// ============================================================================

/**
 * Sort nodes by their impact level in blast radius
 * Nodes with higher impact (lower depth) come first
 *
 * @param nodes - Array of GraphNodes to sort
 * @param blastRadius - Blast radius response
 * @returns Sorted array (does not mutate original)
 *
 * @example
 * ```ts
 * const sorted = sortByImpact(allNodes, blastRadiusData);
 * // Direct dependents first, then transitive by depth
 * ```
 */
export function sortByImpact(
  nodes: GraphNode[],
  blastRadius: BlastRadiusResponse
): GraphNode[] {
  // Build depth lookup
  const depthLookup = new Map<string, number>();

  if (blastRadius && blastRadius.affectedNodes) {
    for (const affected of blastRadius.affectedNodes) {
      depthLookup.set(affected.id, affected.depth);
    }
  }

  // Sort: affected nodes first (by depth), then unaffected
  return [...nodes].sort((a, b) => {
    const depthA = depthLookup.get(a.id) ?? Infinity;
    const depthB = depthLookup.get(b.id) ?? Infinity;
    return depthA - depthB;
  });
}

/**
 * Sort FlowNodes by impact
 *
 * @param nodes - Array of FlowNodes to sort
 * @param blastRadius - Blast radius response
 * @returns Sorted array
 */
export function sortFlowNodesByImpact(
  nodes: FlowNode[],
  blastRadius: BlastRadiusResponse
): FlowNode[] {
  const depthLookup = new Map<string, number>();

  if (blastRadius && blastRadius.affectedNodes) {
    for (const affected of blastRadius.affectedNodes) {
      depthLookup.set(affected.id, affected.depth);
    }
  }

  return [...nodes].sort((a, b) => {
    const depthA = depthLookup.get(a.id) ?? Infinity;
    const depthB = depthLookup.get(b.id) ?? Infinity;
    return depthA - depthB;
  });
}

// ============================================================================
// Client-Side Calculation
// ============================================================================

/**
 * Calculate blast radius client-side from graph data
 * Useful for preview or when API is unavailable
 *
 * @param startNodeId - Starting node ID
 * @param edges - All graph edges
 * @param totalNodes - Total number of nodes in graph
 * @param maxDepth - Maximum traversal depth
 * @returns Client-side blast radius result
 */
export function calculateClientBlastRadius(
  startNodeId: string,
  edges: FlowEdge[],
  totalNodes: number,
  maxDepth: number = MAX_BLAST_RADIUS_DEPTH
): ClientBlastRadius {
  // Build reverse adjacency (target -> sources)
  const dependents = new Map<string, string[]>();

  for (const edge of edges) {
    const existing = dependents.get(edge.source) ?? [];
    existing.push(edge.target);
    dependents.set(edge.source, existing);
  }

  // BFS to find all affected nodes
  const affectedByDepth = new Map<number, string[]>();
  const visited = new Set<string>([startNodeId]);
  let frontier = [startNodeId];
  let depth = 1;
  let directCount = 0;
  let transitiveCount = 0;

  while (frontier.length > 0 && depth <= maxDepth) {
    const nextFrontier: string[] = [];
    const depthNodes: string[] = [];

    for (const nodeId of frontier) {
      const deps = dependents.get(nodeId) ?? [];

      for (const depId of deps) {
        if (!visited.has(depId)) {
          visited.add(depId);
          nextFrontier.push(depId);
          depthNodes.push(depId);

          if (depth === 1) {
            directCount++;
          } else {
            transitiveCount++;
          }
        }
      }
    }

    if (depthNodes.length > 0) {
      affectedByDepth.set(depth, depthNodes);
    }

    frontier = nextFrontier;
    depth++;
  }

  // Remove start node from visited (it's not "affected")
  visited.delete(startNodeId);

  // Calculate impact score
  const totalAffected = directCount + transitiveCount;
  const impactScore = totalNodes > 1 ? totalAffected / (totalNodes - 1) : 0;
  const severity = getImpactSeverityFromScore(impactScore);

  return {
    nodeId: startNodeId,
    directDependents: directCount,
    transitiveDependents: transitiveCount,
    impactScore,
    severity,
    affectedNodeIds: visited,
    affectedByDepth,
  };
}

/**
 * Convert client blast radius to API-compatible format
 *
 * @param clientResult - Client-side calculation result
 * @param nodeMap - Map of node ID to node data
 * @returns BlastRadiusResponse format
 */
export function clientBlastRadiusToResponse(
  clientResult: ClientBlastRadius,
  nodeMap: Map<string, GraphNode | FlowNode>
): BlastRadiusResponse {
  const affectedNodes: AffectedNode[] = [];

  for (const [depth, nodeIds] of clientResult.affectedByDepth) {
    for (const nodeId of nodeIds) {
      const node = nodeMap.get(nodeId);
      if (node) {
        const data = 'data' in node ? node.data : node;
        affectedNodes.push({
          id: nodeId,
          name: data.name,
          type: data.type,
          isDirect: depth === 1,
          depth,
        });
      }
    }
  }

  return {
    nodeId: clientResult.nodeId,
    directDependents: clientResult.directDependents,
    transitiveDependents: clientResult.transitiveDependents,
    impactScore: clientResult.impactScore,
    severity: clientResult.severity,
    affectedNodes,
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a node is in the blast radius
 *
 * @param nodeId - Node ID to check
 * @param blastRadius - Blast radius response
 * @returns True if node is affected
 */
export function isNodeAffected(
  nodeId: string,
  blastRadius: BlastRadiusResponse | null
): boolean {
  if (!blastRadius || !blastRadius.affectedNodes) {
    return false;
  }

  return blastRadius.affectedNodes.some(n => n.id === nodeId);
}

/**
 * Check if a node is directly affected (depth 1)
 *
 * @param nodeId - Node ID to check
 * @param blastRadius - Blast radius response
 * @returns True if node is a direct dependent
 */
export function isDirectlyAffected(
  nodeId: string,
  blastRadius: BlastRadiusResponse | null
): boolean {
  if (!blastRadius || !blastRadius.affectedNodes) {
    return false;
  }

  return blastRadius.affectedNodes.some(n => n.id === nodeId && n.isDirect);
}

/**
 * Get summary statistics from blast radius
 *
 * @param blastRadius - Blast radius response
 * @returns Summary object
 */
export function getBlastRadiusSummary(blastRadius: BlastRadiusResponse): {
  totalAffected: number;
  directPercent: number;
  transitivePercent: number;
  maxDepth: number;
  severity: ImpactSeverity;
  color: string;
} {
  const totalAffected = blastRadius.directDependents + blastRadius.transitiveDependents;
  const directPercent = totalAffected > 0
    ? (blastRadius.directDependents / totalAffected) * 100
    : 0;
  const transitivePercent = totalAffected > 0
    ? (blastRadius.transitiveDependents / totalAffected) * 100
    : 0;

  let maxDepth = 0;
  if (blastRadius.affectedNodes) {
    for (const node of blastRadius.affectedNodes) {
      maxDepth = Math.max(maxDepth, node.depth);
    }
  }

  return {
    totalAffected,
    directPercent,
    transitivePercent,
    maxDepth,
    severity: blastRadius.severity,
    color: getImpactColor(blastRadius.severity),
  };
}

/**
 * Get edges that connect affected nodes (for highlighting)
 *
 * @param edges - All edges
 * @param affectedIds - Set of affected node IDs
 * @returns Edge IDs that should be highlighted
 */
export function getAffectedEdgeIds(
  edges: FlowEdge[],
  affectedIds: Set<string>
): Set<string> {
  const edgeIds = new Set<string>();

  for (const edge of edges) {
    if (affectedIds.has(edge.source) && affectedIds.has(edge.target)) {
      edgeIds.add(edge.id);
    }
  }

  return edgeIds;
}
