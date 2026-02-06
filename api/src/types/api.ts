/**
 * API Request/Response Type Definitions
 * @module types/api
 *
 * Type definitions for API requests, responses, and webhook payloads.
 * Follows the established TypeBox patterns from auth.ts and repository.ts.
 *
 * Provides comprehensive typing for the TASK-DETECT API endpoints.
 */

import { Type, Static } from '@sinclair/typebox';
import {
  ScanId,
  ScanStatus,
  ScanConfig,
  ScanProgress,
  ScanResultSummary,
  RepositoryId,
  TenantId,
  ScanStatusSchema,
} from './entities';
import { NodeTypeName, EdgeType } from './graph';

// ============================================================================
// Generic API Response Types
// ============================================================================

/**
 * Standard API error response
 */
export const ApiErrorSchema = Type.Object({
  code: Type.String({ description: 'Error code for programmatic handling' }),
  message: Type.String({ description: 'Human-readable error message' }),
  details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  field: Type.Optional(Type.String({ description: 'Field that caused the error' })),
  timestamp: Type.String({ format: 'date-time' }),
  requestId: Type.String({ description: 'Request ID for support' }),
});

export type ApiError = Static<typeof ApiErrorSchema>;

/**
 * Standard API success response wrapper
 */
export const ApiSuccessSchema = <T extends ReturnType<typeof Type.Object>>(dataSchema: T) =>
  Type.Object({
    success: Type.Literal(true),
    data: dataSchema,
    meta: Type.Optional(Type.Object({
      requestId: Type.String(),
      timestamp: Type.String({ format: 'date-time' }),
      duration: Type.Number({ description: 'Request duration in ms' }),
    })),
  });

/**
 * Standard API failure response wrapper
 */
export const ApiFailureSchema = Type.Object({
  success: Type.Literal(false),
  error: ApiErrorSchema,
});

/**
 * Pagination parameters
 */
export const PaginationParamsSchema = Type.Object({
  page: Type.Optional(Type.Number({ minimum: 1, default: 1 })),
  pageSize: Type.Optional(Type.Number({ minimum: 1, maximum: 100, default: 20 })),
  cursor: Type.Optional(Type.String({ description: 'Cursor for cursor-based pagination' })),
});

export type PaginationParams = Static<typeof PaginationParamsSchema>;

/**
 * Pagination info in response
 */
export const PaginationInfoSchema = Type.Object({
  page: Type.Number(),
  pageSize: Type.Number(),
  total: Type.Number(),
  totalPages: Type.Number(),
  hasNext: Type.Boolean(),
  hasPrevious: Type.Boolean(),
  nextCursor: Type.Optional(Type.String()),
  previousCursor: Type.Optional(Type.String()),
});

export type PaginationInfo = Static<typeof PaginationInfoSchema>;

/**
 * Paginated response wrapper
 */
export const PaginatedResponseSchema = <T extends ReturnType<typeof Type.Object>>(itemSchema: T) =>
  Type.Object({
    success: Type.Literal(true),
    data: Type.Array(itemSchema),
    pagination: PaginationInfoSchema,
  });

// ============================================================================
// Scan API Types
// ============================================================================

/**
 * Scan request schema
 */
export const ScanRequestSchema = Type.Object({
  repositoryId: Type.String({ format: 'uuid', description: 'Repository to scan' }),
  ref: Type.Optional(Type.String({ description: 'Branch, tag, or commit to scan (defaults to default branch)' })),
  config: Type.Optional(Type.Partial(Type.Object({
    detectTypes: Type.Array(Type.Union([
      Type.Literal('terraform'),
      Type.Literal('kubernetes'),
      Type.Literal('helm'),
      Type.Literal('cloudformation'),
    ])),
    includeImplicit: Type.Boolean(),
    minConfidence: Type.Number({ minimum: 0, maximum: 100 }),
    maxDepth: Type.Number({ minimum: 1, maximum: 50 }),
    includePatterns: Type.Array(Type.String()),
    excludePatterns: Type.Array(Type.String()),
    analyzeHelmCharts: Type.Boolean(),
    resolveRemoteModules: Type.Boolean(),
  }))),
  priority: Type.Optional(Type.Union([
    Type.Literal('low'),
    Type.Literal('normal'),
    Type.Literal('high'),
  ], { default: 'normal' })),
  callbackUrl: Type.Optional(Type.String({ format: 'uri', description: 'URL to POST results to' })),
});

export type ScanRequest = Static<typeof ScanRequestSchema>;

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
  progress: Type.Optional(Type.Object({
    phase: Type.String(),
    percentage: Type.Number(),
    filesProcessed: Type.Number(),
    totalFiles: Type.Number(),
    nodesDetected: Type.Number(),
    edgesDetected: Type.Number(),
  })),
  resultSummary: Type.Optional(Type.Object({
    totalNodes: Type.Number(),
    totalEdges: Type.Number(),
    filesAnalyzed: Type.Number(),
    errorCount: Type.Number(),
    warningCount: Type.Number(),
  })),
  errorMessage: Type.Optional(Type.String()),
  startedAt: Type.Optional(Type.String({ format: 'date-time' })),
  completedAt: Type.Optional(Type.String({ format: 'date-time' })),
  createdAt: Type.String({ format: 'date-time' }),
});

export type ScanResponse = Static<typeof ScanResponseSchema>;

/**
 * Scan list query parameters
 */
export const ScanListQuerySchema = Type.Intersect([
  PaginationParamsSchema,
  Type.Object({
    repositoryId: Type.Optional(Type.String({ format: 'uuid' })),
    status: Type.Optional(ScanStatusSchema),
    ref: Type.Optional(Type.String()),
    since: Type.Optional(Type.String({ format: 'date-time' })),
    until: Type.Optional(Type.String({ format: 'date-time' })),
    sortBy: Type.Optional(Type.Union([
      Type.Literal('createdAt'),
      Type.Literal('startedAt'),
      Type.Literal('completedAt'),
    ], { default: 'createdAt' })),
    sortOrder: Type.Optional(Type.Union([
      Type.Literal('asc'),
      Type.Literal('desc'),
    ], { default: 'desc' })),
  }),
]);

export type ScanListQuery = Static<typeof ScanListQuerySchema>;

/**
 * Scan cancel request
 */
export const ScanCancelRequestSchema = Type.Object({
  reason: Type.Optional(Type.String({ maxLength: 500 })),
});

export type ScanCancelRequest = Static<typeof ScanCancelRequestSchema>;

// ============================================================================
// Graph Query API Types
// ============================================================================

/**
 * Graph query request schema
 */
export const GraphQueryRequestSchema = Type.Object({
  scanId: Type.String({ format: 'uuid', description: 'Scan ID to query' }),
  query: Type.Optional(Type.Object({
    nodeTypes: Type.Optional(Type.Array(Type.String(), { description: 'Filter by node types' })),
    edgeTypes: Type.Optional(Type.Array(Type.String(), { description: 'Filter by edge types' })),
    filePath: Type.Optional(Type.String({ description: 'Filter by file path pattern' })),
    namePattern: Type.Optional(Type.String({ description: 'Filter by name pattern (regex)' })),
    minConfidence: Type.Optional(Type.Number({ minimum: 0, maximum: 100 })),
    includeMetadata: Type.Optional(Type.Boolean({ default: true })),
  })),
  traversal: Type.Optional(Type.Object({
    startNodeId: Type.Optional(Type.String({ description: 'Start node for traversal' })),
    direction: Type.Optional(Type.Union([
      Type.Literal('upstream'),
      Type.Literal('downstream'),
      Type.Literal('both'),
    ], { default: 'both' })),
    maxDepth: Type.Optional(Type.Number({ minimum: 1, maximum: 20, default: 5 })),
    edgeTypes: Type.Optional(Type.Array(Type.String())),
  })),
  format: Type.Optional(Type.Union([
    Type.Literal('full'),
    Type.Literal('compact'),
    Type.Literal('adjacency'),
  ], { default: 'full' })),
});

export type GraphQueryRequest = Static<typeof GraphQueryRequestSchema>;

/**
 * Graph node response
 */
export const GraphNodeResponseSchema = Type.Object({
  id: Type.String(),
  type: Type.String(),
  name: Type.String(),
  location: Type.Object({
    file: Type.String(),
    lineStart: Type.Number(),
    lineEnd: Type.Number(),
    columnStart: Type.Optional(Type.Number()),
    columnEnd: Type.Optional(Type.Number()),
  }),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type GraphNodeResponse = Static<typeof GraphNodeResponseSchema>;

/**
 * Graph edge response
 */
export const GraphEdgeResponseSchema = Type.Object({
  id: Type.String(),
  source: Type.String(),
  target: Type.String(),
  type: Type.String(),
  label: Type.Optional(Type.String()),
  confidence: Type.Number(),
  isImplicit: Type.Boolean(),
  metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type GraphEdgeResponse = Static<typeof GraphEdgeResponseSchema>;

/**
 * Graph query response
 */
export const GraphQueryResponseSchema = Type.Object({
  scanId: Type.String({ format: 'uuid' }),
  nodes: Type.Array(GraphNodeResponseSchema),
  edges: Type.Array(GraphEdgeResponseSchema),
  stats: Type.Object({
    totalNodes: Type.Number(),
    totalEdges: Type.Number(),
    nodesByType: Type.Record(Type.String(), Type.Number()),
    edgesByType: Type.Record(Type.String(), Type.Number()),
  }),
  query: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
});

export type GraphQueryResponse = Static<typeof GraphQueryResponseSchema>;

/**
 * Node detail request parameters
 */
export const NodeDetailParamsSchema = Type.Object({
  scanId: Type.String({ format: 'uuid' }),
  nodeId: Type.String(),
});

export type NodeDetailParams = Static<typeof NodeDetailParamsSchema>;

/**
 * Node detail response
 */
export const NodeDetailResponseSchema = Type.Object({
  node: GraphNodeResponseSchema,
  incomingEdges: Type.Array(GraphEdgeResponseSchema),
  outgoingEdges: Type.Array(GraphEdgeResponseSchema),
  relatedNodes: Type.Array(GraphNodeResponseSchema),
});

export type NodeDetailResponse = Static<typeof NodeDetailResponseSchema>;

// ============================================================================
// Webhook Payload Types
// ============================================================================

/**
 * Webhook event types
 */
export const WebhookEventType = {
  SCAN_STARTED: 'scan.started',
  SCAN_PROGRESS: 'scan.progress',
  SCAN_COMPLETED: 'scan.completed',
  SCAN_FAILED: 'scan.failed',
  SCAN_CANCELLED: 'scan.cancelled',
  REPOSITORY_PUSH: 'repository.push',
  REPOSITORY_PR_OPENED: 'repository.pr_opened',
  REPOSITORY_PR_MERGED: 'repository.pr_merged',
} as const;

export type WebhookEventType = typeof WebhookEventType[keyof typeof WebhookEventType];

/**
 * Base webhook payload
 */
export const WebhookPayloadBaseSchema = Type.Object({
  eventId: Type.String({ format: 'uuid' }),
  eventType: Type.String(),
  tenantId: Type.String({ format: 'uuid' }),
  timestamp: Type.String({ format: 'date-time' }),
  version: Type.Literal('1.0'),
});

/**
 * Scan started webhook payload
 */
export const ScanStartedPayloadSchema = Type.Intersect([
  WebhookPayloadBaseSchema,
  Type.Object({
    eventType: Type.Literal('scan.started'),
    data: Type.Object({
      scanId: Type.String({ format: 'uuid' }),
      repositoryId: Type.String({ format: 'uuid' }),
      repositoryName: Type.String(),
      ref: Type.String(),
      initiatedBy: Type.String({ format: 'uuid' }),
    }),
  }),
]);

export type ScanStartedPayload = Static<typeof ScanStartedPayloadSchema>;

/**
 * Scan progress webhook payload
 */
export const ScanProgressPayloadSchema = Type.Intersect([
  WebhookPayloadBaseSchema,
  Type.Object({
    eventType: Type.Literal('scan.progress'),
    data: Type.Object({
      scanId: Type.String({ format: 'uuid' }),
      phase: Type.String(),
      percentage: Type.Number({ minimum: 0, maximum: 100 }),
      filesProcessed: Type.Number(),
      totalFiles: Type.Number(),
      nodesDetected: Type.Number(),
      edgesDetected: Type.Number(),
    }),
  }),
]);

export type ScanProgressPayload = Static<typeof ScanProgressPayloadSchema>;

/**
 * Scan completed webhook payload
 */
export const ScanCompletedPayloadSchema = Type.Intersect([
  WebhookPayloadBaseSchema,
  Type.Object({
    eventType: Type.Literal('scan.completed'),
    data: Type.Object({
      scanId: Type.String({ format: 'uuid' }),
      repositoryId: Type.String({ format: 'uuid' }),
      repositoryName: Type.String(),
      ref: Type.String(),
      commitSha: Type.String(),
      summary: Type.Object({
        totalNodes: Type.Number(),
        totalEdges: Type.Number(),
        filesAnalyzed: Type.Number(),
        errors: Type.Number(),
        warnings: Type.Number(),
        duration: Type.Number({ description: 'Duration in milliseconds' }),
      }),
      graphUrl: Type.String({ format: 'uri', description: 'URL to view the graph' }),
    }),
  }),
]);

export type ScanCompletedPayload = Static<typeof ScanCompletedPayloadSchema>;

/**
 * Scan failed webhook payload
 */
export const ScanFailedPayloadSchema = Type.Intersect([
  WebhookPayloadBaseSchema,
  Type.Object({
    eventType: Type.Literal('scan.failed'),
    data: Type.Object({
      scanId: Type.String({ format: 'uuid' }),
      repositoryId: Type.String({ format: 'uuid' }),
      repositoryName: Type.String(),
      ref: Type.String(),
      error: Type.Object({
        code: Type.String(),
        message: Type.String(),
        details: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
      }),
      partialResults: Type.Optional(Type.Object({
        nodesDetected: Type.Number(),
        edgesDetected: Type.Number(),
        lastPhase: Type.String(),
      })),
    }),
  }),
]);

export type ScanFailedPayload = Static<typeof ScanFailedPayloadSchema>;

/**
 * Repository push webhook payload (from Git provider)
 */
export const RepositoryPushPayloadSchema = Type.Object({
  provider: Type.Union([
    Type.Literal('github'),
    Type.Literal('gitlab'),
    Type.Literal('bitbucket'),
  ]),
  event: Type.Literal('push'),
  repository: Type.Object({
    id: Type.String(),
    name: Type.String(),
    fullName: Type.String(),
    cloneUrl: Type.String({ format: 'uri' }),
    htmlUrl: Type.String({ format: 'uri' }),
  }),
  ref: Type.String({ description: 'refs/heads/main format' }),
  before: Type.String({ description: 'Previous commit SHA' }),
  after: Type.String({ description: 'New commit SHA' }),
  commits: Type.Array(Type.Object({
    id: Type.String(),
    message: Type.String(),
    author: Type.Object({
      name: Type.String(),
      email: Type.String({ format: 'email' }),
    }),
    timestamp: Type.String({ format: 'date-time' }),
    added: Type.Array(Type.String()),
    modified: Type.Array(Type.String()),
    removed: Type.Array(Type.String()),
  })),
  pusher: Type.Object({
    name: Type.String(),
    email: Type.Optional(Type.String({ format: 'email' })),
  }),
  sender: Type.Object({
    login: Type.String(),
    id: Type.Number(),
    avatarUrl: Type.Optional(Type.String({ format: 'uri' })),
  }),
});

export type RepositoryPushPayload = Static<typeof RepositoryPushPayloadSchema>;

/**
 * Union of all webhook payloads
 */
export type WebhookPayload =
  | ScanStartedPayload
  | ScanProgressPayload
  | ScanCompletedPayload
  | ScanFailedPayload;

// ============================================================================
// Bulk Operation Types
// ============================================================================

/**
 * Batch scan request
 */
export const BatchScanRequestSchema = Type.Object({
  repositoryIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1, maxItems: 50 }),
  ref: Type.Optional(Type.String()),
  config: Type.Optional(Type.Partial(Type.Object({
    detectTypes: Type.Array(Type.String()),
    includeImplicit: Type.Boolean(),
    minConfidence: Type.Number(),
  }))),
});

export type BatchScanRequest = Static<typeof BatchScanRequestSchema>;

/**
 * Batch scan response
 */
export const BatchScanResponseSchema = Type.Object({
  submitted: Type.Array(Type.Object({
    repositoryId: Type.String({ format: 'uuid' }),
    scanId: Type.String({ format: 'uuid' }),
  })),
  failed: Type.Array(Type.Object({
    repositoryId: Type.String({ format: 'uuid' }),
    error: Type.String(),
  })),
  summary: Type.Object({
    total: Type.Number(),
    submitted: Type.Number(),
    failed: Type.Number(),
  }),
});

export type BatchScanResponse = Static<typeof BatchScanResponseSchema>;

// ============================================================================
// Export Types
// ============================================================================

/**
 * Graph export format
 */
export const GraphExportFormat = {
  JSON: 'json',
  DOT: 'dot',
  MERMAID: 'mermaid',
  CYTOSCAPE: 'cytoscape',
  D3: 'd3',
} as const;

export type GraphExportFormat = typeof GraphExportFormat[keyof typeof GraphExportFormat];

/**
 * Graph export request
 */
export const GraphExportRequestSchema = Type.Object({
  scanId: Type.String({ format: 'uuid' }),
  format: Type.Union([
    Type.Literal('json'),
    Type.Literal('dot'),
    Type.Literal('mermaid'),
    Type.Literal('cytoscape'),
    Type.Literal('d3'),
  ], { default: 'json' }),
  options: Type.Optional(Type.Object({
    includeMetadata: Type.Optional(Type.Boolean({ default: true })),
    nodeTypes: Type.Optional(Type.Array(Type.String())),
    edgeTypes: Type.Optional(Type.Array(Type.String())),
    compactOutput: Type.Optional(Type.Boolean({ default: false })),
    groupByFile: Type.Optional(Type.Boolean({ default: false })),
    groupByModule: Type.Optional(Type.Boolean({ default: false })),
  })),
});

export type GraphExportRequest = Static<typeof GraphExportRequestSchema>;

// ============================================================================
// Statistics API Types
// ============================================================================

/**
 * Repository statistics
 */
export const RepositoryStatsSchema = Type.Object({
  repositoryId: Type.String({ format: 'uuid' }),
  totalScans: Type.Number(),
  lastScanAt: Type.Optional(Type.String({ format: 'date-time' })),
  averageScanDuration: Type.Number({ description: 'Average duration in ms' }),
  averageNodeCount: Type.Number(),
  averageEdgeCount: Type.Number(),
  scanHistory: Type.Array(Type.Object({
    scanId: Type.String({ format: 'uuid' }),
    status: ScanStatusSchema,
    nodeCount: Type.Number(),
    edgeCount: Type.Number(),
    duration: Type.Number(),
    createdAt: Type.String({ format: 'date-time' }),
  })),
});

export type RepositoryStats = Static<typeof RepositoryStatsSchema>;

/**
 * Tenant statistics
 */
export const TenantStatsSchema = Type.Object({
  tenantId: Type.String({ format: 'uuid' }),
  period: Type.Object({
    start: Type.String({ format: 'date-time' }),
    end: Type.String({ format: 'date-time' }),
  }),
  repositories: Type.Number(),
  totalScans: Type.Number(),
  successfulScans: Type.Number(),
  failedScans: Type.Number(),
  totalNodes: Type.Number(),
  totalEdges: Type.Number(),
  apiRequests: Type.Number(),
  storageUsed: Type.Number({ description: 'Storage in bytes' }),
  usage: Type.Object({
    scansRemaining: Type.Number(),
    apiRequestsRemaining: Type.Number(),
    storageRemaining: Type.Number(),
  }),
});

export type TenantStats = Static<typeof TenantStatsSchema>;

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Type guard for ApiError
 */
export function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    'timestamp' in value
  );
}

/**
 * Type guard for WebhookPayload
 */
export function isWebhookPayload(value: unknown): value is WebhookPayload {
  return (
    typeof value === 'object' &&
    value !== null &&
    'eventId' in value &&
    'eventType' in value &&
    'tenantId' in value &&
    'version' in value
  );
}

/**
 * Type guard for ScanRequest
 */
export function isScanRequest(value: unknown): value is ScanRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'repositoryId' in value
  );
}

/**
 * Type guard for GraphQueryRequest
 */
export function isGraphQueryRequest(value: unknown): value is GraphQueryRequest {
  return (
    typeof value === 'object' &&
    value !== null &&
    'scanId' in value
  );
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create an API error response
 * @example
 * const error = createApiError('NOT_FOUND', 'Resource not found', 'req-123');
 */
export function createApiError(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
  field?: string
): ApiError {
  return {
    code,
    message,
    details,
    field,
    timestamp: new Date().toISOString(),
    requestId,
  };
}

/**
 * Create pagination info
 * @example
 * const pagination = createPaginationInfo(1, 20, 100);
 */
export function createPaginationInfo(
  page: number,
  pageSize: number,
  total: number
): PaginationInfo {
  const totalPages = Math.ceil(total / pageSize);
  return {
    page,
    pageSize,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  // Client errors
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',

  // Domain errors
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  REPOSITORY_NOT_ACCESSIBLE: 'REPOSITORY_NOT_ACCESSIBLE',
  INVALID_REF: 'INVALID_REF',
  PARSE_ERROR: 'PARSE_ERROR',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
