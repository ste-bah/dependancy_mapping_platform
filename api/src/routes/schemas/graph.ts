/**
 * Graph API Schemas
 * @module routes/schemas/graph
 *
 * TypeBox schemas for dependency graph API endpoints.
 * Provides request/response validation for graph queries and traversals.
 */

import { Type, Static } from '@sinclair/typebox';
import { PaginationQuerySchema, PaginationInfoSchema } from './common.js';

// ============================================================================
// Node Schemas
// ============================================================================

/**
 * Node location schema
 */
export const NodeLocationSchema = Type.Object({
  file: Type.String({ description: 'Source file path' }),
  lineStart: Type.Number({ description: 'Starting line number' }),
  lineEnd: Type.Number({ description: 'Ending line number' }),
  columnStart: Type.Optional(Type.Number({ description: 'Starting column' })),
  columnEnd: Type.Optional(Type.Number({ description: 'Ending column' })),
});

export type NodeLocation = Static<typeof NodeLocationSchema>;

/**
 * Graph node response schema
 */
export const GraphNodeSchema = Type.Object({
  id: Type.String({ description: 'Node identifier' }),
  type: Type.String({ description: 'Node type' }),
  name: Type.String({ description: 'Node name' }),
  location: NodeLocationSchema,
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type GraphNode = Static<typeof GraphNodeSchema>;

/**
 * Detailed node response with relationships
 */
export const NodeDetailSchema = Type.Object({
  node: GraphNodeSchema,
  incomingEdges: Type.Array(Type.Object({
    id: Type.String(),
    source: Type.String(),
    type: Type.String(),
    label: Type.Optional(Type.String()),
    confidence: Type.Number(),
  })),
  outgoingEdges: Type.Array(Type.Object({
    id: Type.String(),
    target: Type.String(),
    type: Type.String(),
    label: Type.Optional(Type.String()),
    confidence: Type.Number(),
  })),
  dependencyCount: Type.Number({ description: 'Number of downstream dependencies' }),
  dependentCount: Type.Number({ description: 'Number of upstream dependents' }),
});

export type NodeDetail = Static<typeof NodeDetailSchema>;

// ============================================================================
// Edge Schemas
// ============================================================================

/**
 * Graph edge response schema
 */
export const GraphEdgeSchema = Type.Object({
  id: Type.String({ description: 'Edge identifier' }),
  source: Type.String({ description: 'Source node ID' }),
  target: Type.String({ description: 'Target node ID' }),
  type: Type.String({ description: 'Edge type' }),
  label: Type.Optional(Type.String({ description: 'Edge label' })),
  confidence: Type.Number({ minimum: 0, maximum: 100, description: 'Confidence score' }),
  isImplicit: Type.Boolean({ description: 'Whether this is an implicit dependency' }),
  attribute: Type.Optional(Type.String({ description: 'Referenced attribute' })),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type GraphEdge = Static<typeof GraphEdgeSchema>;

// ============================================================================
// Query Parameter Schemas
// ============================================================================

/**
 * Node filter query parameters
 */
export const NodeFilterQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(Type.String({ description: 'Filter by node type' })),
    types: Type.Optional(Type.String({ description: 'Filter by multiple types (comma-separated)' })),
    filePath: Type.Optional(Type.String({ description: 'Filter by file path pattern' })),
    name: Type.Optional(Type.String({ description: 'Filter by name pattern' })),
    search: Type.Optional(Type.String({ description: 'Search in name and file path' })),
  }),
]);

export type NodeFilterQuery = Static<typeof NodeFilterQuerySchema>;

/**
 * Edge filter query parameters
 */
export const EdgeFilterQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    type: Type.Optional(Type.String({ description: 'Filter by edge type' })),
    types: Type.Optional(Type.String({ description: 'Filter by multiple types (comma-separated)' })),
    minConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: 'Minimum confidence' })),
    isImplicit: Type.Optional(Type.Boolean({ description: 'Filter by implicit status' })),
  }),
]);

export type EdgeFilterQuery = Static<typeof EdgeFilterQuerySchema>;

/**
 * Traversal query parameters
 */
export const TraversalQuerySchema = Type.Object({
  maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 20, default: 5, description: 'Maximum traversal depth' })),
  edgeTypes: Type.Optional(Type.String({ description: 'Edge types to follow (comma-separated)' })),
  includeMetadata: Type.Optional(Type.Boolean({ default: true, description: 'Include node metadata' })),
});

export type TraversalQuery = Static<typeof TraversalQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Full graph response schema
 */
export const GraphResponseSchema = Type.Object({
  scanId: Type.String({ format: 'uuid' }),
  nodes: Type.Array(GraphNodeSchema),
  edges: Type.Array(GraphEdgeSchema),
  stats: Type.Object({
    totalNodes: Type.Number(),
    totalEdges: Type.Number(),
    nodesByType: Type.Record(Type.String(), Type.Number()),
    edgesByType: Type.Record(Type.String(), Type.Number()),
    avgEdgesPerNode: Type.Number(),
    density: Type.Number(),
    hasCycles: Type.Boolean(),
  }),
  metadata: Type.Optional(Type.Object({
    ref: Type.Optional(Type.String()),
    commitSha: Type.Optional(Type.String()),
    generatedAt: Type.String({ format: 'date-time' }),
  })),
});

export type GraphResponse = Static<typeof GraphResponseSchema>;

/**
 * Node list response
 */
export const NodeListResponseSchema = Type.Object({
  data: Type.Array(GraphNodeSchema),
  pagination: PaginationInfoSchema,
});

export type NodeListResponse = Static<typeof NodeListResponseSchema>;

/**
 * Edge list response
 */
export const EdgeListResponseSchema = Type.Object({
  data: Type.Array(GraphEdgeSchema),
  pagination: PaginationInfoSchema,
});

export type EdgeListResponse = Static<typeof EdgeListResponseSchema>;

/**
 * Traversal result (dependencies/dependents)
 */
export const TraversalResultSchema = Type.Object({
  startNode: Type.String({ description: 'Starting node ID' }),
  direction: Type.Union([Type.Literal('downstream'), Type.Literal('upstream')]),
  nodes: Type.Array(GraphNodeSchema),
  edges: Type.Array(GraphEdgeSchema),
  paths: Type.Array(Type.Object({
    nodeIds: Type.Array(Type.String()),
    length: Type.Number(),
  })),
  stats: Type.Object({
    nodesVisited: Type.Number(),
    edgesTraversed: Type.Number(),
    maxDepthReached: Type.Number(),
  }),
});

export type TraversalResult = Static<typeof TraversalResultSchema>;

/**
 * Cycle detection result
 */
export const CycleDetectionResultSchema = Type.Object({
  hasCycles: Type.Boolean(),
  cycles: Type.Array(Type.Object({
    nodeIds: Type.Array(Type.String()),
    edgeIds: Type.Array(Type.String()),
    length: Type.Number(),
  })),
  stats: Type.Object({
    cyclesFound: Type.Number(),
    nodesInCycles: Type.Number(),
    detectionTimeMs: Type.Number(),
  }),
});

export type CycleDetectionResult = Static<typeof CycleDetectionResultSchema>;

/**
 * Impact analysis result
 */
export const ImpactAnalysisResultSchema = Type.Object({
  targetNodes: Type.Array(Type.String({ description: 'Nodes being analyzed' })),
  directImpact: Type.Array(GraphNodeSchema),
  transitiveImpact: Type.Array(GraphNodeSchema),
  summary: Type.Object({
    totalImpacted: Type.Number(),
    impactByType: Type.Record(Type.String(), Type.Number()),
    impactByDepth: Type.Record(Type.String(), Type.Number()),
    riskLevel: Type.Union([
      Type.Literal('low'),
      Type.Literal('medium'),
      Type.Literal('high'),
      Type.Literal('critical'),
    ]),
  }),
});

export type ImpactAnalysisResult = Static<typeof ImpactAnalysisResultSchema>;
