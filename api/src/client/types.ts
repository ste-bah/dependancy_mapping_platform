/**
 * API Client Type Definitions
 * @module client/types
 *
 * Re-exports API types for SDK consumers.
 * Provides clean type definitions for request/response objects.
 */

// ============================================================================
// Scan Types
// ============================================================================

/**
 * Scan configuration options
 */
export interface ScanConfig {
  detectTypes?: ('terraform' | 'kubernetes' | 'helm' | 'cloudformation')[];
  includeImplicit?: boolean;
  minConfidence?: number;
  maxDepth?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  analyzeHelmCharts?: boolean;
  resolveRemoteModules?: boolean;
}

/**
 * Request to create a new scan
 */
export interface CreateScanRequest {
  repositoryId: string;
  ref?: string;
  config?: ScanConfig;
  priority?: 'low' | 'normal' | 'high';
  callbackUrl?: string;
}

/**
 * Scan progress information
 */
export interface ScanProgress {
  phase: string;
  percentage: number;
  filesProcessed: number;
  totalFiles: number;
  currentFile?: string;
  nodesDetected: number;
  edgesDetected: number;
  errors: number;
  warnings: number;
}

/**
 * Scan result summary
 */
export interface ScanResultSummary {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  filesAnalyzed: number;
  errorCount: number;
  warningCount: number;
  confidenceDistribution: {
    certain: number;
    high: number;
    medium: number;
    low: number;
    uncertain: number;
  };
}

/**
 * Scan status values
 */
export type ScanStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Scan response from the API
 */
export interface ScanResponse {
  id: string;
  repositoryId: string;
  status: ScanStatus;
  ref: string;
  commitSha?: string;
  config: {
    detectTypes: string[];
    includeImplicit: boolean;
    minConfidence: number;
    maxDepth: number;
  };
  progress?: ScanProgress;
  resultSummary?: ScanResultSummary;
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to cancel a scan
 */
export interface CancelScanRequest {
  reason?: string;
}

/**
 * Query parameters for listing scans
 */
export interface ListScansQuery {
  page?: number;
  pageSize?: number;
  repositoryId?: string;
  status?: ScanStatus;
  ref?: string;
  since?: string;
  until?: string;
  sortBy?: 'createdAt' | 'startedAt' | 'completedAt';
  sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Graph Types
// ============================================================================

/**
 * Node location in source code
 */
export interface NodeLocation {
  file: string;
  lineStart: number;
  lineEnd: number;
  columnStart?: number;
  columnEnd?: number;
}

/**
 * Graph node
 */
export interface GraphNode {
  id: string;
  type: string;
  name: string;
  location: NodeLocation;
  metadata?: Record<string, unknown>;
}

/**
 * Graph edge (dependency relationship)
 */
export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  label?: string;
  confidence: number;
  isImplicit: boolean;
  attribute?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Graph statistics
 */
export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  edgesByType: Record<string, number>;
  avgEdgesPerNode: number;
  density: number;
  hasCycles: boolean;
}

/**
 * Full graph response
 */
export interface GraphResponse {
  scanId: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  stats: GraphStats;
  metadata?: {
    ref?: string;
    commitSha?: string;
    generatedAt: string;
  };
}

/**
 * Node detail with relationships
 */
export interface NodeDetail {
  node: GraphNode;
  incomingEdges: Array<{
    id: string;
    source: string;
    type: string;
    label?: string;
    confidence: number;
  }>;
  outgoingEdges: Array<{
    id: string;
    target: string;
    type: string;
    label?: string;
    confidence: number;
  }>;
  dependencyCount: number;
  dependentCount: number;
}

/**
 * Node filter query parameters
 */
export interface NodeFilterQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  types?: string;
  filePath?: string;
  name?: string;
  search?: string;
}

/**
 * Edge filter query parameters
 */
export interface EdgeFilterQuery {
  page?: number;
  pageSize?: number;
  type?: string;
  types?: string;
  minConfidence?: number;
  isImplicit?: boolean;
}

/**
 * Traversal query parameters
 */
export interface TraversalQuery {
  maxDepth?: number;
  edgeTypes?: string;
  includeMetadata?: boolean;
}

/**
 * Traversal result
 */
export interface TraversalResult {
  startNode: string;
  direction: 'downstream' | 'upstream';
  nodes: GraphNode[];
  edges: GraphEdge[];
  paths: Array<{
    nodeIds: string[];
    length: number;
  }>;
  stats: {
    nodesVisited: number;
    edgesTraversed: number;
    maxDepthReached: number;
  };
}

/**
 * Cycle detection result
 */
export interface CycleDetectionResult {
  hasCycles: boolean;
  cycles: Array<{
    nodeIds: string[];
    edgeIds: string[];
    length: number;
  }>;
  stats: {
    cyclesFound: number;
    nodesInCycles: number;
    detectionTimeMs: number;
  };
}

/**
 * Impact analysis result
 */
export interface ImpactAnalysisResult {
  targetNodes: string[];
  directImpact: GraphNode[];
  transitiveImpact: GraphNode[];
  summary: {
    totalImpacted: number;
    impactByType: Record<string, number>;
    impactByDepth: Record<string, number>;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ============================================================================
// Repository Types
// ============================================================================

/**
 * Git provider type
 */
export type GitProvider = 'github' | 'gitlab' | 'bitbucket' | 'azure_devops';

/**
 * Repository response
 */
export interface RepositoryResponse {
  id: string;
  provider: GitProvider;
  providerId: string;
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  cloneUrl: string;
  htmlUrl: string;
  description?: string;
  isPrivate: boolean;
  isArchived: boolean;
  webhookEnabled: boolean;
  lastScan?: {
    id: string;
    status: string;
    ref: string;
    completedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Request to add a repository
 */
export interface AddRepositoryRequest {
  provider: GitProvider;
  owner: string;
  name: string;
  enableWebhook?: boolean;
  autoScan?: boolean;
}

/**
 * Request to update a repository
 */
export interface UpdateRepositoryRequest {
  enableWebhook?: boolean;
  defaultBranch?: string;
}

/**
 * Query parameters for listing repositories
 */
export interface ListRepositoriesQuery {
  page?: number;
  pageSize?: number;
  provider?: GitProvider;
  owner?: string;
  search?: string;
  hasWebhook?: boolean;
  sortBy?: 'name' | 'createdAt' | 'lastScannedAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Repository deletion response
 */
export interface RepositoryDeletedResponse {
  deleted: true;
  id: string;
  scansDeleted: number;
}

// ============================================================================
// Webhook Types
// ============================================================================

/**
 * Webhook acknowledgement response
 */
export interface WebhookAckResponse {
  received: true;
  eventId: string;
  action: 'scan_triggered' | 'ignored' | 'queued';
  scanId?: string;
  reason?: string;
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | 'scan.started'
  | 'scan.progress'
  | 'scan.completed'
  | 'scan.failed'
  | 'scan.cancelled'
  | 'repository.push'
  | 'repository.pr_opened'
  | 'repository.pr_merged';

/**
 * Base webhook payload
 */
export interface WebhookPayloadBase {
  eventId: string;
  eventType: WebhookEventType;
  tenantId: string;
  timestamp: string;
  version: '1.0';
}

/**
 * Scan started webhook payload
 */
export interface ScanStartedPayload extends WebhookPayloadBase {
  eventType: 'scan.started';
  data: {
    scanId: string;
    repositoryId: string;
    repositoryName: string;
    ref: string;
    initiatedBy: string;
  };
}

/**
 * Scan progress webhook payload
 */
export interface ScanProgressPayload extends WebhookPayloadBase {
  eventType: 'scan.progress';
  data: {
    scanId: string;
    phase: string;
    percentage: number;
    filesProcessed: number;
    totalFiles: number;
    nodesDetected: number;
    edgesDetected: number;
  };
}

/**
 * Scan completed webhook payload
 */
export interface ScanCompletedPayload extends WebhookPayloadBase {
  eventType: 'scan.completed';
  data: {
    scanId: string;
    repositoryId: string;
    repositoryName: string;
    ref: string;
    commitSha: string;
    summary: {
      totalNodes: number;
      totalEdges: number;
      filesAnalyzed: number;
      errors: number;
      warnings: number;
      duration: number;
    };
    graphUrl: string;
  };
}

/**
 * Scan failed webhook payload
 */
export interface ScanFailedPayload extends WebhookPayloadBase {
  eventType: 'scan.failed';
  data: {
    scanId: string;
    repositoryId: string;
    repositoryName: string;
    ref: string;
    error: {
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };
    partialResults?: {
      nodesDetected: number;
      edgesDetected: number;
      lastPhase: string;
    };
  };
}

/**
 * Union of all webhook payloads
 */
export type WebhookPayload =
  | ScanStartedPayload
  | ScanProgressPayload
  | ScanCompletedPayload
  | ScanFailedPayload;

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * Pagination info in responses
 */
export interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * API error response
 */
export interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Common error codes
 */
export const ErrorCodes = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  SCAN_FAILED: 'SCAN_FAILED',
  SCAN_TIMEOUT: 'SCAN_TIMEOUT',
  REPOSITORY_NOT_ACCESSIBLE: 'REPOSITORY_NOT_ACCESSIBLE',
  INVALID_REF: 'INVALID_REF',
  PARSE_ERROR: 'PARSE_ERROR',
  LIMIT_EXCEEDED: 'LIMIT_EXCEEDED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Health Types
// ============================================================================

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  uptime: number;
}

/**
 * Detailed health check response
 */
export interface DetailedHealthCheckResponse extends HealthCheckResponse {
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      message?: string;
    };
    memory: {
      status: 'up' | 'down';
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
  };
}
