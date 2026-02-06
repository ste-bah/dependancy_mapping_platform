/**
 * Blast Radius Service
 * Manages blast radius calculations and visualization
 * @module features/graph/services/blastRadiusService
 */

import { QueryClient } from '@tanstack/react-query';
import { calculateBlastRadius, graphKeys } from '../api';
import type {
  FlowNode,
  FlowEdge,
  BlastRadiusResponse,
  AffectedNode,
  ImpactSeverity,
  GraphNodeType,
} from '../types';
import {
  getAffectedNodeIds,
  getAffectedByType,
  getAffectedByDepth,
  getImpactLevel,
  getImpactSeverityFromScore,
  getImpactColor,
  sortFlowNodesByImpact,
  calculateClientBlastRadius,
  clientBlastRadiusToResponse,
  isNodeAffected,
  isDirectlyAffected,
  getBlastRadiusSummary,
  getAffectedEdgeIds,
  createNodeMap,
  type ClientBlastRadius,
} from '../utils';
import { CACHE_TIMES, IMPACT_THRESHOLDS } from '../utils/constants';

// ============================================================================
// Types
// ============================================================================

/**
 * Impact summary for UI display
 */
export interface ImpactSummary {
  /** Total affected nodes */
  totalAffected: number;
  /** Direct dependents count */
  directCount: number;
  /** Transitive dependents count */
  transitiveCount: number;
  /** Percentage of direct vs total */
  directPercent: number;
  /** Maximum depth of impact */
  maxDepth: number;
  /** Impact severity level */
  severity: ImpactSeverity;
  /** Color for severity */
  color: string;
  /** Impact score (0-1) */
  score: number;
  /** Breakdown by node type */
  byType: Record<GraphNodeType, number>;
}

/**
 * Visualized node with blast radius styling
 */
export interface VisualizedNode extends FlowNode {
  /** Impact depth (0 = source, 1 = direct, 2+ = transitive) */
  impactDepth: number;
  /** Is directly affected */
  isDirect: boolean;
  /** Impact color */
  impactColor: string;
}

/**
 * Blast radius calculation result
 */
export interface BlastRadiusResult {
  /** Blast radius response data */
  data: BlastRadiusResponse;
  /** Affected node IDs */
  affectedIds: Set<string>;
  /** Affected edge IDs */
  affectedEdgeIds: Set<string>;
  /** Impact summary */
  summary: ImpactSummary;
}

/**
 * Blast radius service configuration
 */
export interface BlastRadiusServiceConfig {
  /** React Query client for cache operations */
  queryClient?: QueryClient;
  /** Use client-side calculation as fallback */
  useClientFallback?: boolean;
  /** Maximum traversal depth */
  maxDepth?: number;
}

// ============================================================================
// Service Implementation
// ============================================================================

/**
 * Service for managing blast radius calculations and visualization
 *
 * @example
 * ```ts
 * const service = new BlastRadiusService({ queryClient });
 *
 * // Calculate blast radius
 * const result = await service.calculateBlastRadius('scan-123', 'node-456');
 *
 * // Get impact summary
 * const summary = service.getImpactSummary(result.data);
 *
 * // Visualize impact on nodes
 * const visualized = service.visualizeImpact(nodes, result.data);
 * ```
 */
export class BlastRadiusService {
  private queryClient: QueryClient | undefined;
  private useClientFallback: boolean;
  private maxDepth: number;

  constructor(config: BlastRadiusServiceConfig = {}) {
    this.queryClient = config.queryClient;
    this.useClientFallback = config.useClientFallback ?? true;
    this.maxDepth = config.maxDepth ?? 10;
  }

  // ==========================================================================
  // Blast Radius Calculation
  // ==========================================================================

  /**
   * Calculate blast radius for a node
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID to calculate blast radius for
   * @returns Blast radius result with summary
   */
  async calculateBlastRadius(
    scanId: string,
    nodeId: string
  ): Promise<BlastRadiusResult> {
    const response = await calculateBlastRadius(scanId, nodeId);

    const affectedIds = getAffectedNodeIds(response);
    affectedIds.add(nodeId); // Include source node

    return {
      data: response,
      affectedIds,
      affectedEdgeIds: new Set(), // Will be calculated when edges available
      summary: this.getImpactSummary(response),
    };
  }

  /**
   * Calculate blast radius with edges for full visualization
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID
   * @param edges - Graph edges for edge highlighting
   * @returns Full blast radius result
   */
  async calculateBlastRadiusWithEdges(
    scanId: string,
    nodeId: string,
    edges: FlowEdge[]
  ): Promise<BlastRadiusResult> {
    const result = await this.calculateBlastRadius(scanId, nodeId);

    // Calculate affected edges
    result.affectedEdgeIds = getAffectedEdgeIds(edges, result.affectedIds);

    return result;
  }

  /**
   * Calculate blast radius client-side (no API call)
   *
   * @param nodeId - Node ID
   * @param nodes - All nodes
   * @param edges - All edges
   * @returns Blast radius result
   */
  calculateClientBlastRadius(
    nodeId: string,
    nodes: FlowNode[],
    edges: FlowEdge[]
  ): BlastRadiusResult {
    const clientResult = calculateClientBlastRadius(
      nodeId,
      edges,
      nodes.length,
      this.maxDepth
    );

    const nodeMap = createNodeMap(nodes);
    const response = clientBlastRadiusToResponse(clientResult, nodeMap);

    const affectedIds = new Set(clientResult.affectedNodeIds);
    affectedIds.add(nodeId);

    return {
      data: response,
      affectedIds,
      affectedEdgeIds: getAffectedEdgeIds(edges, affectedIds),
      summary: this.getImpactSummary(response),
    };
  }

  // ==========================================================================
  // Affected Nodes Operations
  // ==========================================================================

  /**
   * Get affected nodes from blast radius
   *
   * @param blastRadius - Blast radius response
   * @param nodes - All nodes
   * @returns Affected FlowNodes
   */
  getAffectedNodes(
    blastRadius: BlastRadiusResponse,
    nodes: FlowNode[]
  ): FlowNode[] {
    const affectedIds = getAffectedNodeIds(blastRadius);
    return nodes.filter((node) => affectedIds.has(node.id));
  }

  /**
   * Get affected nodes sorted by impact
   *
   * @param blastRadius - Blast radius response
   * @param nodes - All nodes
   * @returns Sorted affected nodes
   */
  getAffectedNodesSorted(
    blastRadius: BlastRadiusResponse,
    nodes: FlowNode[]
  ): FlowNode[] {
    const affected = this.getAffectedNodes(blastRadius, nodes);
    return sortFlowNodesByImpact(affected, blastRadius);
  }

  /**
   * Get affected nodes grouped by type (direct/transitive)
   *
   * @param blastRadius - Blast radius response
   * @returns Grouped affected nodes
   */
  getAffectedByType(blastRadius: BlastRadiusResponse): {
    direct: AffectedNode[];
    transitive: AffectedNode[];
  } {
    return getAffectedByType(blastRadius);
  }

  /**
   * Get affected nodes grouped by depth
   *
   * @param blastRadius - Blast radius response
   * @returns Map of depth to affected nodes
   */
  getAffectedByDepth(blastRadius: BlastRadiusResponse): Map<number, AffectedNode[]> {
    return getAffectedByDepth(blastRadius);
  }

  /**
   * Check if a node is affected
   *
   * @param nodeId - Node ID to check
   * @param blastRadius - Blast radius response
   * @returns True if affected
   */
  isNodeAffected(nodeId: string, blastRadius: BlastRadiusResponse | null): boolean {
    return isNodeAffected(nodeId, blastRadius);
  }

  /**
   * Check if a node is directly affected (depth 1)
   *
   * @param nodeId - Node ID to check
   * @param blastRadius - Blast radius response
   * @returns True if directly affected
   */
  isDirectlyAffected(
    nodeId: string,
    blastRadius: BlastRadiusResponse | null
  ): boolean {
    return isDirectlyAffected(nodeId, blastRadius);
  }

  /**
   * Get impact level for a node
   *
   * @param nodeId - Node ID
   * @param blastRadius - Blast radius response
   * @returns Depth level or -1 if not affected
   */
  getImpactLevel(nodeId: string, blastRadius: BlastRadiusResponse): number {
    return getImpactLevel(nodeId, blastRadius);
  }

  // ==========================================================================
  // Impact Summary
  // ==========================================================================

  /**
   * Get comprehensive impact summary
   *
   * @param blastRadius - Blast radius response
   * @returns Impact summary for UI
   */
  getImpactSummary(blastRadius: BlastRadiusResponse): ImpactSummary {
    const baseSummary = getBlastRadiusSummary(blastRadius);

    // Calculate breakdown by type
    const byType: Record<GraphNodeType, number> = {
      terraform_resource: 0,
      terraform_module: 0,
      terraform_data_source: 0,
      helm_chart: 0,
      k8s_resource: 0,
      external_reference: 0,
      tg_config: 0,
    };

    if (blastRadius.affectedNodes) {
      for (const node of blastRadius.affectedNodes) {
        if (node.type in byType) {
          byType[node.type]++;
        }
      }
    }

    return {
      totalAffected: baseSummary.totalAffected,
      directCount: blastRadius.directDependents,
      transitiveCount: blastRadius.transitiveDependents,
      directPercent: baseSummary.directPercent,
      maxDepth: baseSummary.maxDepth,
      severity: baseSummary.severity,
      color: baseSummary.color,
      score: blastRadius.impactScore,
      byType,
    };
  }

  /**
   * Get severity for an impact score
   *
   * @param score - Impact score (0-1)
   * @returns Severity level
   */
  getSeverity(score: number): ImpactSeverity {
    return getImpactSeverityFromScore(score);
  }

  /**
   * Get color for severity
   *
   * @param severity - Severity level
   * @returns Hex color
   */
  getSeverityColor(severity: ImpactSeverity): string {
    return getImpactColor(severity);
  }

  /**
   * Get severity thresholds
   */
  getSeverityThresholds(): typeof IMPACT_THRESHOLDS {
    return { ...IMPACT_THRESHOLDS };
  }

  // ==========================================================================
  // Visualization
  // ==========================================================================

  /**
   * Apply impact visualization to nodes
   *
   * @param nodes - All nodes
   * @param blastRadius - Blast radius response
   * @returns Nodes with impact visualization data
   */
  visualizeImpact(
    nodes: FlowNode[],
    blastRadius: BlastRadiusResponse
  ): VisualizedNode[] {
    const affectedIds = getAffectedNodeIds(blastRadius);

    // Build depth lookup
    const depthLookup = new Map<string, number>();
    const directLookup = new Set<string>();

    if (blastRadius.affectedNodes) {
      for (const affected of blastRadius.affectedNodes) {
        depthLookup.set(affected.id, affected.depth);
        if (affected.isDirect) {
          directLookup.add(affected.id);
        }
      }
    }

    return nodes.map((node) => {
      const isAffected = affectedIds.has(node.id);
      const isSource = node.id === blastRadius.nodeId;
      const isDirect = directLookup.has(node.id);
      const depth = depthLookup.get(node.id) ?? (isSource ? 0 : -1);

      // Determine color based on position
      let impactColor = '#6B7280'; // Gray for unaffected
      if (isSource) {
        impactColor = '#EF4444'; // Red for source
      } else if (isDirect) {
        impactColor = '#F97316'; // Orange for direct
      } else if (isAffected) {
        impactColor = '#EAB308'; // Yellow for transitive
      }

      return {
        ...node,
        impactDepth: depth,
        isDirect,
        impactColor,
        data: {
          ...node.data,
          highlighted: isAffected || isSource,
          dimmed: !isAffected && !isSource,
        },
      } as VisualizedNode;
    });
  }

  /**
   * Get visualization for edges
   *
   * @param edges - All edges
   * @param blastRadius - Blast radius response
   * @returns Edges with highlighting
   */
  visualizeEdgeImpact(
    edges: FlowEdge[],
    blastRadius: BlastRadiusResponse
  ): FlowEdge[] {
    const affectedIds = getAffectedNodeIds(blastRadius);
    affectedIds.add(blastRadius.nodeId);

    const affectedEdgeIds = getAffectedEdgeIds(edges, affectedIds);

    return edges.map((edge) => ({
      ...edge,
      data: {
        ...edge.data,
        type: edge.data?.type ?? 'DEPENDS_ON',
        confidence: edge.data?.confidence ?? 1,
        highlighted: affectedEdgeIds.has(edge.id),
      },
      style: {
        ...edge.style,
        opacity: affectedEdgeIds.has(edge.id) ? 1 : 0.3,
        stroke: affectedEdgeIds.has(edge.id) ? '#F59E0B' : edge.style?.stroke,
        strokeWidth: affectedEdgeIds.has(edge.id) ? 2 : 1,
      },
    }));
  }

  // ==========================================================================
  // Cache Operations
  // ==========================================================================

  /**
   * Prefetch blast radius data
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID
   */
  async prefetch(scanId: string, nodeId: string): Promise<void> {
    if (!this.queryClient) {
      return;
    }

    await this.queryClient.prefetchQuery({
      queryKey: graphKeys.blastRadiusForNode(scanId, nodeId),
      queryFn: () => calculateBlastRadius(scanId, nodeId),
      staleTime: CACHE_TIMES.blastRadiusStale,
    });
  }

  /**
   * Get cached blast radius data
   *
   * @param scanId - Scan ID
   * @param nodeId - Node ID
   * @returns Cached data or undefined
   */
  getCached(scanId: string, nodeId: string): BlastRadiusResponse | undefined {
    if (!this.queryClient) {
      return undefined;
    }

    return this.queryClient.getQueryData<BlastRadiusResponse>(
      graphKeys.blastRadiusForNode(scanId, nodeId)
    );
  }

  /**
   * Invalidate blast radius cache for a scan
   *
   * @param scanId - Scan ID
   */
  invalidateCache(scanId: string): void {
    if (!this.queryClient) {
      return;
    }

    this.queryClient.invalidateQueries({
      queryKey: ['graph', 'blast-radius', scanId],
    });
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Compare blast radius severity
   *
   * @param a - First blast radius
   * @param b - Second blast radius
   * @returns Negative if a is more severe, positive if b is more severe
   */
  compareSeverity(a: BlastRadiusResponse, b: BlastRadiusResponse): number {
    return b.impactScore - a.impactScore;
  }

  /**
   * Check if impact is critical
   *
   * @param blastRadius - Blast radius response
   * @returns True if critical impact
   */
  isCritical(blastRadius: BlastRadiusResponse): boolean {
    return blastRadius.impactScore >= IMPACT_THRESHOLDS.critical;
  }

  /**
   * Check if impact is high or above
   *
   * @param blastRadius - Blast radius response
   * @returns True if high+ impact
   */
  isHighOrAbove(blastRadius: BlastRadiusResponse): boolean {
    return blastRadius.impactScore >= IMPACT_THRESHOLDS.high;
  }

  /**
   * Get maximum depth setting
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }

  /**
   * Set maximum depth
   */
  setMaxDepth(depth: number): void {
    this.maxDepth = Math.max(1, depth);
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Create a new BlastRadiusService instance
 *
 * @param config - Service configuration
 * @returns BlastRadiusService instance
 */
export function createBlastRadiusService(
  config: BlastRadiusServiceConfig = {}
): BlastRadiusService {
  return new BlastRadiusService(config);
}

export default BlastRadiusService;
