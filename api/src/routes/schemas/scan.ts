/**
 * Scan API Schemas
 * @module routes/schemas/scan
 *
 * TypeBox schemas for scan-related API endpoints.
 * Provides request/response validation for scan operations.
 */

import { Type, Static } from '@sinclair/typebox';
import { PaginationQuerySchema, PaginationInfoSchema, SortOrderSchema } from './common.js';

// ============================================================================
// Scan Status Schema
// ============================================================================

export const ScanStatusSchema = Type.Union([
  Type.Literal('pending'),
  Type.Literal('queued'),
  Type.Literal('running'),
  Type.Literal('completed'),
  Type.Literal('failed'),
  Type.Literal('cancelled'),
]);

export type ScanStatusType = Static<typeof ScanStatusSchema>;

// ============================================================================
// Scan Config Schema
// ============================================================================

export const ScanConfigSchema = Type.Partial(Type.Object({
  detectTypes: Type.Array(Type.Union([
    Type.Literal('terraform'),
    Type.Literal('kubernetes'),
    Type.Literal('helm'),
    Type.Literal('cloudformation'),
  ]), { description: 'Types of IaC to detect' }),
  includeImplicit: Type.Boolean({ description: 'Include implicit dependencies' }),
  minConfidence: Type.Number({ minimum: 0, maximum: 100, description: 'Minimum confidence threshold' }),
  maxDepth: Type.Number({ minimum: 1, maximum: 50, description: 'Maximum depth for module traversal' }),
  includePatterns: Type.Array(Type.String(), { description: 'File patterns to include' }),
  excludePatterns: Type.Array(Type.String(), { description: 'File patterns to exclude' }),
  analyzeHelmCharts: Type.Boolean({ description: 'Whether to analyze Helm charts' }),
  resolveRemoteModules: Type.Boolean({ description: 'Whether to resolve remote modules' }),
}));

export type ScanConfig = Static<typeof ScanConfigSchema>;

// ============================================================================
// Scan Progress Schema
// ============================================================================

export const ScanProgressSchema = Type.Object({
  phase: Type.String({ description: 'Current scan phase' }),
  percentage: Type.Number({ minimum: 0, maximum: 100, description: 'Percentage complete' }),
  filesProcessed: Type.Number({ description: 'Number of files processed' }),
  totalFiles: Type.Number({ description: 'Total files to process' }),
  currentFile: Type.Optional(Type.String({ description: 'Current file being processed' })),
  nodesDetected: Type.Number({ description: 'Nodes detected so far' }),
  edgesDetected: Type.Number({ description: 'Edges detected so far' }),
  errors: Type.Number({ description: 'Number of errors' }),
  warnings: Type.Number({ description: 'Number of warnings' }),
});

export type ScanProgress = Static<typeof ScanProgressSchema>;

// ============================================================================
// Scan Result Summary Schema
// ============================================================================

export const ScanResultSummarySchema = Type.Object({
  totalNodes: Type.Number(),
  totalEdges: Type.Number(),
  nodesByType: Type.Record(Type.String(), Type.Number()),
  edgesByType: Type.Record(Type.String(), Type.Number()),
  filesAnalyzed: Type.Number(),
  errorCount: Type.Number(),
  warningCount: Type.Number(),
  confidenceDistribution: Type.Object({
    certain: Type.Number(),
    high: Type.Number(),
    medium: Type.Number(),
    low: Type.Number(),
    uncertain: Type.Number(),
  }),
});

export type ScanResultSummary = Static<typeof ScanResultSummarySchema>;

// ============================================================================
// Request Schemas
// ============================================================================

/**
 * Create scan request
 */
export const CreateScanRequestSchema = Type.Object({
  repositoryId: Type.String({ format: 'uuid', description: 'Repository to scan' }),
  ref: Type.Optional(Type.String({ description: 'Branch, tag, or commit to scan' })),
  config: Type.Optional(ScanConfigSchema),
  priority: Type.Optional(Type.Union([
    Type.Literal('low'),
    Type.Literal('normal'),
    Type.Literal('high'),
  ], { default: 'normal', description: 'Scan priority' })),
  callbackUrl: Type.Optional(Type.String({ format: 'uri', description: 'URL to POST results to' })),
});

export type CreateScanRequest = Static<typeof CreateScanRequestSchema>;

/**
 * Cancel scan request
 */
export const CancelScanRequestSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500, description: 'Cancellation reason' })),
});

export type CancelScanRequest = Static<typeof CancelScanRequestSchema>;

/**
 * List scans query parameters
 */
export const ListScansQuerySchema = Type.Intersect([
  PaginationQuerySchema,
  Type.Object({
    repositoryId: Type.Optional(Type.String({ format: 'uuid', description: 'Filter by repository' })),
    status: Type.Optional(ScanStatusSchema),
    ref: Type.Optional(Type.String({ description: 'Filter by branch/ref' })),
    since: Type.Optional(Type.String({ format: 'date-time', description: 'Filter by start date' })),
    until: Type.Optional(Type.String({ format: 'date-time', description: 'Filter by end date' })),
    sortBy: Type.Optional(Type.Union([
      Type.Literal('createdAt'),
      Type.Literal('startedAt'),
      Type.Literal('completedAt'),
    ], { default: 'createdAt' })),
    sortOrder: Type.Optional(SortOrderSchema),
  }),
]);

export type ListScansQuery = Static<typeof ListScansQuerySchema>;

// ============================================================================
// Response Schemas
// ============================================================================

/**
 * Scan response schema
 */
export const ScanResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  repositoryId: Type.String({ format: 'uuid' }),
  status: ScanStatusSchema,
  ref: Type.String(),
  commitSha: Type.Optional(Type.String()),
  config: Type.Object({
    detectTypes: Type.Array(Type.String()),
    includeImplicit: Type.Boolean(),
    minConfidence: Type.Number(),
    maxDepth: Type.Number(),
  }),
  progress: Type.Optional(ScanProgressSchema),
  resultSummary: Type.Optional(ScanResultSummarySchema),
  errorMessage: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
  updatedAt: Type.String({ format: 'date-time' }),
});

export type ScanResponse = Static<typeof ScanResponseSchema>;

/**
 * Scan list response
 */
export const ScanListResponseSchema = Type.Object({
  data: Type.Array(ScanResponseSchema),
  pagination: PaginationInfoSchema,
});

export type ScanListResponse = Static<typeof ScanListResponseSchema>;

/**
 * Scan status response (lightweight)
 */
export const ScanStatusResponseSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  status: ScanStatusSchema,
  progress: ScanProgressSchema,
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  estimatedTimeRemaining: Type.Optional(Type.Number({ description: 'Estimated seconds remaining' })),
});

export type ScanStatusResponse = Static<typeof ScanStatusResponseSchema>;
