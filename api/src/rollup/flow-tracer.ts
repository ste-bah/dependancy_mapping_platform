/**
 * End-to-End Flow Tracer
 * @module rollup/flow-tracer
 *
 * Traces end-to-end data flows from Terraform outputs through Helm to Kubernetes.
 * Supports pipeline aggregation and cross-tool path analysis.
 *
 * TASK-XREF-008: End-to-End Flow Tracing Implementation
 */

import { createHash } from 'crypto';
import {
  ToolType,
  GraphNodeRef,
  GraphEdgeRef,
  EndToEndFlow,
  FlowSourceType,
  FlowDestinationType,
  GraphQueryInterface,
  NODE_TYPE_TO_TOOL,
} from './types';
import { classifyNodeTool } from './cross-tool-rollup';

// ============================================================================
// Constants
// ============================================================================

/**
 * Node types that can be flow sources
 */
const FLOW_SOURCE_TYPES: readonly string[] = [
  'terraform_output',
  'terraform_resource',
  'tg_config',
];

/**
 * Node types that can be flow destinations
 */
const FLOW_DESTINATION_TYPES: readonly string[] = [
  'helm_release',
  'helm_chart',
  'k8s_deployment',
  'k8s_configmap',
  'k8s_secret',
  'argocd_application',
];

/**
 * Edge types that indicate data flow
 */
const DATA_FLOW_EDGE_TYPES: readonly string[] = [
  'FEEDS_INTO',
  'references',
  'output_value',
  'input_variable',
  'module_source',
  'configmap_ref',
  'secret_ref',
];

// ============================================================================
// Flow ID Generation
// ============================================================================

/**
 * Generate a unique flow ID from source and destination nodes.
 *
 * @param sourceId - Source node ID
 * @param destId - Destination node ID
 * @returns Deterministic flow ID
 */
export function generateFlowId(sourceId: string, destId: string): string {
  const combined = `flow:${sourceId}:${destId}`;
  const hash = createHash('sha256').update(combined).digest('hex').slice(0, 16);
  return `flow-${hash}`;
}

// ============================================================================
// Node Type Classification
// ============================================================================

/**
 * Determine the flow source type for a node.
 *
 * @param nodeType - The node's type
 * @returns Flow source type or null if not a source
 */
export function getFlowSourceType(nodeType: string): FlowSourceType | null {
  if (nodeType === 'terraform_output') {
    return 'terraform_output';
  }
  if (nodeType === 'terraform_resource') {
    return 'terraform_resource';
  }
  if (nodeType === 'tg_config' || nodeType.startsWith('tg_')) {
    return 'terragrunt_output';
  }
  return null;
}

/**
 * Determine the flow destination type for a node.
 *
 * @param nodeType - The node's type
 * @returns Flow destination type or null if not a destination
 */
export function getFlowDestinationType(nodeType: string): FlowDestinationType | null {
  if (nodeType === 'helm_release' || nodeType === 'helm_chart' || nodeType === 'helm_value') {
    return 'helm_release';
  }
  if (nodeType.startsWith('k8s_')) {
    return 'k8s_resource';
  }
  if (nodeType.startsWith('argocd_')) {
    return 'argocd_application';
  }
  return null;
}

/**
 * Check if a node can be a flow source.
 *
 * @param nodeType - The node's type
 * @returns True if the node can be a flow source
 */
export function isFlowSource(nodeType: string): boolean {
  return getFlowSourceType(nodeType) !== null;
}

/**
 * Check if a node can be a flow destination.
 *
 * @param nodeType - The node's type
 * @returns True if the node can be a flow destination
 */
export function isFlowDestination(nodeType: string): boolean {
  return getFlowDestinationType(nodeType) !== null;
}

// ============================================================================
// Single Flow Tracing
// ============================================================================

/**
 * Trace end-to-end flows starting from a specific Terraform node.
 *
 * @param terraformNodeId - ID of the Terraform node to trace from
 * @param graph - Graph query interface
 * @returns Array of end-to-end flows
 *
 * @example
 * const flows = await traceEndToEndFlows('tf-output-vpc-id', graph);
 * for (const flow of flows) {
 *   console.log(`${flow.source.node.name} -> ${flow.destination.node.name}`);
 * }
 */
export async function traceEndToEndFlows(
  terraformNodeId: string,
  graph: GraphQueryInterface
): Promise<readonly EndToEndFlow[]> {
  const sourceNode = await graph.getNode(terraformNodeId);
  if (!sourceNode) {
    return [];
  }

  const sourceType = getFlowSourceType(sourceNode.type);
  if (!sourceType) {
    return [];
  }

  const flows: EndToEndFlow[] = [];
  const visitedPaths = new Set<string>();

  // BFS to find all paths to destinations
  const queue: Array<{
    currentNodeId: string;
    path: GraphNodeRef[];
    edges: GraphEdgeRef[];
    pipeline?: GraphNodeRef;
  }> = [{ currentNodeId: terraformNodeId, path: [sourceNode], edges: [] }];

  const visited = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;

    // Limit path length to prevent infinite loops
    if (current.path.length > 10) continue;

    const outgoingEdges = await graph.getEdgesFromNode(current.currentNodeId, {
      edgeTypes: DATA_FLOW_EDGE_TYPES,
    });

    for (const edge of outgoingEdges) {
      const targetNode = await graph.getNode(edge.targetId);
      if (!targetNode) continue;

      // Skip if already in path (cycle prevention)
      if (current.path.some(n => n.id === edge.targetId)) continue;

      // Track pipelines encountered
      let pipeline = current.pipeline;
      if (classifyNodeTool(targetNode.type) === 'ci') {
        pipeline = targetNode;
      }

      const newPath = [...current.path, targetNode];
      const newEdges = [...current.edges, edge];

      // Check if this is a destination
      const destType = getFlowDestinationType(targetNode.type);
      if (destType) {
        // Create a path key to avoid duplicates
        const pathKey = `${sourceNode.id}:${targetNode.id}`;
        if (!visitedPaths.has(pathKey)) {
          visitedPaths.add(pathKey);

          // Calculate confidence based on edge confidences
          const avgConfidence = newEdges.length > 0
            ? newEdges.reduce((sum, e) => sum + e.confidence, 0) / newEdges.length
            : 0;

          flows.push({
            id: generateFlowId(sourceNode.id, targetNode.id),
            source: {
              type: sourceType,
              node: sourceNode,
            },
            destination: {
              type: destType,
              node: targetNode,
            },
            intermediates: newPath.slice(1, -1), // Exclude source and destination
            edges: newEdges,
            pipeline,
            confidence: avgConfidence,
          });
        }
      }

      // Continue searching if not visited
      if (!visited.has(edge.targetId)) {
        visited.add(edge.targetId);
        queue.push({
          currentNodeId: edge.targetId,
          path: newPath,
          edges: newEdges,
          pipeline,
        });
      }
    }
  }

  return flows;
}

// ============================================================================
// All Flows Tracing
// ============================================================================

/**
 * Trace all end-to-end flows in a scan.
 *
 * @param scanId - Scan identifier
 * @param graph - Graph query interface
 * @returns Array of all end-to-end flows
 *
 * @example
 * const allFlows = await traceAllEndToEndFlows('scan-123', graph);
 * console.log(`Found ${allFlows.length} end-to-end flows`);
 */
export async function traceAllEndToEndFlows(
  scanId: string,
  graph: GraphQueryInterface
): Promise<readonly EndToEndFlow[]> {
  const allFlows: EndToEndFlow[] = [];
  const seenFlowIds = new Set<string>();

  // Get all potential source nodes
  const sourceNodeTypes = ['terraform_output', 'terraform_resource', 'tg_config'];

  for (const nodeType of sourceNodeTypes) {
    const sourceNodes = await graph.getNodesByType(scanId, nodeType);

    for (const sourceNode of sourceNodes) {
      const flows = await traceEndToEndFlows(sourceNode.id, graph);

      for (const flow of flows) {
        if (!seenFlowIds.has(flow.id)) {
          seenFlowIds.add(flow.id);
          allFlows.push(flow);
        }
      }
    }
  }

  // Sort by confidence descending
  allFlows.sort((a, b) => b.confidence - a.confidence);

  return allFlows;
}

// ============================================================================
// Flow Aggregation by Pipeline
// ============================================================================

/**
 * Result of aggregating flows by pipeline
 */
export interface PipelineFlowAggregation {
  /** The pipeline node (if any) */
  readonly pipeline: GraphNodeRef | null;
  /** Flows orchestrated by this pipeline */
  readonly flows: readonly EndToEndFlow[];
  /** Total number of flows */
  readonly flowCount: number;
  /** Average confidence of flows */
  readonly avgConfidence: number;
  /** Unique source nodes */
  readonly sourceCount: number;
  /** Unique destination nodes */
  readonly destinationCount: number;
}

/**
 * Aggregate flows by their deployment pipeline.
 *
 * @param flows - Array of end-to-end flows
 * @returns Array of aggregations grouped by pipeline
 *
 * @example
 * const aggregations = aggregateFlowsByPipeline(flows);
 * for (const agg of aggregations) {
 *   console.log(`Pipeline: ${agg.pipeline?.name ?? 'Direct'}`);
 *   console.log(`  Flows: ${agg.flowCount}`);
 * }
 */
export function aggregateFlowsByPipeline(
  flows: readonly EndToEndFlow[]
): readonly PipelineFlowAggregation[] {
  // Group by pipeline ID (null for direct flows)
  const groupMap = new Map<string | null, EndToEndFlow[]>();

  for (const flow of flows) {
    const pipelineId = flow.pipeline?.id ?? null;
    const existing = groupMap.get(pipelineId) ?? [];
    existing.push(flow);
    groupMap.set(pipelineId, existing);
  }

  // Convert to aggregations
  const aggregations: PipelineFlowAggregation[] = [];

  for (const entry of Array.from(groupMap.entries())) {
    const [pipelineId, pipelineFlows] = entry;
    const pipeline = pipelineId !== null ? pipelineFlows[0].pipeline ?? null : null;

    const sourceIds = new Set(pipelineFlows.map(f => f.source.node.id));
    const destIds = new Set(pipelineFlows.map(f => f.destination.node.id));

    const totalConfidence = pipelineFlows.reduce((sum, f) => sum + f.confidence, 0);
    const avgConfidence = pipelineFlows.length > 0 ? totalConfidence / pipelineFlows.length : 0;

    aggregations.push({
      pipeline,
      flows: pipelineFlows,
      flowCount: pipelineFlows.length,
      avgConfidence,
      sourceCount: sourceIds.size,
      destinationCount: destIds.size,
    });
  }

  // Sort by flow count descending
  aggregations.sort((a, b) => b.flowCount - a.flowCount);

  return aggregations;
}

// ============================================================================
// Flow Filtering
// ============================================================================

/**
 * Options for filtering flows
 */
export interface FlowFilterOptions {
  /** Minimum confidence threshold */
  readonly minConfidence?: number;
  /** Filter by source tool type */
  readonly sourceTool?: ToolType;
  /** Filter by destination tool type */
  readonly destinationTool?: ToolType;
  /** Only include flows with pipelines */
  readonly requirePipeline?: boolean;
  /** Maximum number of results */
  readonly limit?: number;
}

/**
 * Filter flows based on criteria.
 *
 * @param flows - Flows to filter
 * @param options - Filter options
 * @returns Filtered flows
 */
export function filterFlows(
  flows: readonly EndToEndFlow[],
  options: FlowFilterOptions
): readonly EndToEndFlow[] {
  let result = [...flows];

  if (options.minConfidence !== undefined) {
    result = result.filter(f => f.confidence >= options.minConfidence!);
  }

  if (options.sourceTool !== undefined) {
    result = result.filter(f => classifyNodeTool(f.source.node.type) === options.sourceTool);
  }

  if (options.destinationTool !== undefined) {
    result = result.filter(f => classifyNodeTool(f.destination.node.type) === options.destinationTool);
  }

  if (options.requirePipeline) {
    result = result.filter(f => f.pipeline !== undefined);
  }

  if (options.limit !== undefined && options.limit > 0) {
    result = result.slice(0, options.limit);
  }

  return result;
}

// ============================================================================
// Flow Statistics
// ============================================================================

/**
 * Statistics about a collection of flows
 */
export interface FlowStatistics {
  /** Total number of flows */
  readonly totalFlows: number;
  /** Flows by source type */
  readonly bySourceType: Readonly<Record<FlowSourceType, number>>;
  /** Flows by destination type */
  readonly byDestinationType: Readonly<Record<FlowDestinationType, number>>;
  /** Average confidence across all flows */
  readonly avgConfidence: number;
  /** Number of flows with high confidence (>= 80) */
  readonly highConfidenceCount: number;
  /** Number of flows with medium confidence (50-79) */
  readonly mediumConfidenceCount: number;
  /** Number of flows with low confidence (< 50) */
  readonly lowConfidenceCount: number;
  /** Number of flows with pipeline orchestration */
  readonly pipelineOrchestratedCount: number;
  /** Average path length (number of edges) */
  readonly avgPathLength: number;
}

/**
 * Calculate statistics for a collection of flows.
 *
 * @param flows - Flows to analyze
 * @returns Flow statistics
 *
 * @example
 * const stats = calculateFlowStatistics(flows);
 * console.log(`Total flows: ${stats.totalFlows}`);
 * console.log(`High confidence: ${stats.highConfidenceCount}`);
 */
export function calculateFlowStatistics(
  flows: readonly EndToEndFlow[]
): FlowStatistics {
  const bySourceType: Record<FlowSourceType, number> = {
    terraform_resource: 0,
    terraform_output: 0,
    terragrunt_output: 0,
  };

  const byDestinationType: Record<FlowDestinationType, number> = {
    k8s_resource: 0,
    helm_release: 0,
    argocd_application: 0,
  };

  let totalConfidence = 0;
  let highConfidenceCount = 0;
  let mediumConfidenceCount = 0;
  let lowConfidenceCount = 0;
  let pipelineOrchestratedCount = 0;
  let totalPathLength = 0;

  for (const flow of flows) {
    // Count by source type
    bySourceType[flow.source.type]++;

    // Count by destination type
    byDestinationType[flow.destination.type]++;

    // Confidence statistics
    totalConfidence += flow.confidence;
    if (flow.confidence >= 80) {
      highConfidenceCount++;
    } else if (flow.confidence >= 50) {
      mediumConfidenceCount++;
    } else {
      lowConfidenceCount++;
    }

    // Pipeline orchestration
    if (flow.pipeline) {
      pipelineOrchestratedCount++;
    }

    // Path length
    totalPathLength += flow.edges.length;
  }

  return {
    totalFlows: flows.length,
    bySourceType,
    byDestinationType,
    avgConfidence: flows.length > 0 ? totalConfidence / flows.length : 0,
    highConfidenceCount,
    mediumConfidenceCount,
    lowConfidenceCount,
    pipelineOrchestratedCount,
    avgPathLength: flows.length > 0 ? totalPathLength / flows.length : 0,
  };
}

// ============================================================================
// Flow Visualization Helpers
// ============================================================================

/**
 * Convert a flow to a human-readable description.
 *
 * @param flow - The flow to describe
 * @returns Human-readable description
 */
export function describeFlow(flow: EndToEndFlow): string {
  const parts: string[] = [];

  parts.push(`${flow.source.node.name} (${flow.source.type})`);
  parts.push('->');

  for (const intermediate of flow.intermediates) {
    parts.push(`${intermediate.name}`);
    parts.push('->');
  }

  parts.push(`${flow.destination.node.name} (${flow.destination.type})`);

  if (flow.pipeline) {
    parts.push(`[via ${flow.pipeline.name}]`);
  }

  parts.push(`(${Math.round(flow.confidence)}%)`);

  return parts.join(' ');
}

/**
 * Get tool types crossed by a flow.
 *
 * @param flow - The flow to analyze
 * @returns Array of tool types in order
 */
export function getFlowToolPath(flow: EndToEndFlow): readonly ToolType[] {
  const tools: ToolType[] = [];
  const seenTools = new Set<ToolType>();

  // Add source tool
  const sourceTool = classifyNodeTool(flow.source.node.type);
  tools.push(sourceTool);
  seenTools.add(sourceTool);

  // Add intermediate tools
  for (const node of flow.intermediates) {
    const tool = classifyNodeTool(node.type);
    if (!seenTools.has(tool)) {
      tools.push(tool);
      seenTools.add(tool);
    }
  }

  // Add destination tool
  const destTool = classifyNodeTool(flow.destination.node.type);
  if (!seenTools.has(destTool)) {
    tools.push(destTool);
  }

  return tools;
}

/**
 * Check if a flow crosses tool boundaries.
 *
 * @param flow - The flow to check
 * @returns True if the flow crosses tool boundaries
 */
export function flowCrossesTools(flow: EndToEndFlow): boolean {
  const toolPath = getFlowToolPath(flow);
  return toolPath.length > 1;
}
