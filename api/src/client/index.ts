/**
 * IaC Dependency Detection API Client SDK
 * @module @dmp/api-client
 *
 * TypeScript SDK for the IaC dependency detection REST API.
 * Provides a type-safe client for scanning repositories and querying dependency graphs.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { IaCClient, createClient } from '@dmp/api-client';
 * import type { ScanResponse, GraphResponse } from '@dmp/api-client';
 *
 * // Create client with API key authentication
 * const client = createClient({
 *   baseUrl: 'https://api.example.com',
 *   apiKey: process.env.IAC_API_KEY,
 * });
 *
 * // Or with OAuth token
 * const client = createClient({
 *   baseUrl: 'https://api.example.com',
 *   token: accessToken,
 * });
 *
 * // Add and scan a repository
 * const repo = await client.repositories.add({
 *   provider: 'github',
 *   owner: 'my-org',
 *   name: 'infrastructure',
 * });
 *
 * // Trigger a scan
 * const scan = await client.scans.create({
 *   repositoryId: repo.id,
 *   config: {
 *     detectTypes: ['terraform', 'kubernetes'],
 *     includeImplicit: true,
 *   },
 * });
 *
 * // Wait for completion
 * const completed = await client.scans.waitForCompletion(scan.id, {
 *   onProgress: (s) => console.log(`${s.progress?.percentage}% complete`),
 * });
 *
 * // Query the dependency graph
 * const graph = await client.graph.get(completed.id);
 * console.log(`Detected ${graph.stats.totalNodes} resources`);
 *
 * // Analyze impact of changes
 * const impact = await client.graph.analyzeImpact(completed.id, [nodeId]);
 * console.log(`Changes would impact ${impact.summary.totalImpacted} resources`);
 * ```
 */

// ============================================================================
// Client Exports
// ============================================================================

export {
  // Main client class
  IaCClient,
  // Factory function
  createClient,
  // Default export
  default,
  // Resource classes (for advanced usage)
  ScansApi,
  GraphApi,
  RepositoriesApi,
  HealthApi,
  // Configuration types
  type IaCClientConfig,
  type RequestOptions,
  // Error classes
  IaCApiError,
  NetworkError,
  ValidationError,
} from './api-client.js';

// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Scan types
  ScanConfig,
  CreateScanRequest,
  ScanProgress,
  ScanResultSummary,
  ScanStatus,
  ScanResponse,
  CancelScanRequest,
  ListScansQuery,
  // Graph types
  NodeLocation,
  GraphNode,
  GraphEdge,
  GraphStats,
  GraphResponse,
  NodeDetail,
  NodeFilterQuery,
  EdgeFilterQuery,
  TraversalQuery,
  TraversalResult,
  CycleDetectionResult,
  ImpactAnalysisResult,
  // Repository types
  GitProvider,
  RepositoryResponse,
  AddRepositoryRequest,
  UpdateRepositoryRequest,
  ListRepositoriesQuery,
  RepositoryDeletedResponse,
  // Webhook types
  WebhookAckResponse,
  WebhookEventType,
  WebhookPayloadBase,
  ScanStartedPayload,
  ScanProgressPayload,
  ScanCompletedPayload,
  ScanFailedPayload,
  WebhookPayload,
  // Pagination types
  PaginationInfo,
  PaginatedResponse,
  // Error types
  ApiErrorResponse,
  ErrorCode,
  // Health types
  HealthCheckResponse,
  DetailedHealthCheckResponse,
} from './types.js';

// Export error codes constant
export { ErrorCodes } from './types.js';

// ============================================================================
// Version Info
// ============================================================================

/**
 * SDK version
 */
export const VERSION = '0.1.0';

/**
 * API version supported by this SDK
 */
export const API_VERSION = 'v1';

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if an error is an IaCApiError
 */
export function isApiError(error: unknown): error is import('./api-client.js').IaCApiError {
  return error instanceof Error && error.name === 'IaCApiError';
}

/**
 * Check if an error is a NetworkError
 */
export function isNetworkError(error: unknown): error is import('./api-client.js').NetworkError {
  return error instanceof Error && error.name === 'NetworkError';
}

/**
 * Check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is import('./api-client.js').ValidationError {
  return error instanceof Error && error.name === 'ValidationError';
}

/**
 * Check if scan is in a terminal state
 */
export function isScanComplete(scan: { status: string }): boolean {
  return ['completed', 'failed', 'cancelled'].includes(scan.status);
}

/**
 * Check if scan succeeded
 */
export function isScanSuccessful(scan: { status: string }): boolean {
  return scan.status === 'completed';
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format a node for display
 */
export function formatNode(node: import('./types.js').GraphNode): string {
  return `${node.type}:${node.name} (${node.location.file}:${node.location.lineStart})`;
}

/**
 * Format an edge for display
 */
export function formatEdge(
  edge: import('./types.js').GraphEdge,
  nodes: Map<string, import('./types.js').GraphNode>
): string {
  const source = nodes.get(edge.source);
  const target = nodes.get(edge.target);
  const sourceName = source ? source.name : edge.source;
  const targetName = target ? target.name : edge.target;
  return `${sourceName} --[${edge.type}]--> ${targetName}`;
}

/**
 * Build a node lookup map from a graph response
 */
export function buildNodeMap(
  graph: import('./types.js').GraphResponse
): Map<string, import('./types.js').GraphNode> {
  return new Map(graph.nodes.map((node) => [node.id, node]));
}

/**
 * Filter nodes by type
 */
export function filterNodesByType(
  nodes: import('./types.js').GraphNode[],
  ...types: string[]
): import('./types.js').GraphNode[] {
  const typeSet = new Set(types);
  return nodes.filter((node) => typeSet.has(node.type));
}

/**
 * Filter edges by confidence threshold
 */
export function filterEdgesByConfidence(
  edges: import('./types.js').GraphEdge[],
  minConfidence: number
): import('./types.js').GraphEdge[] {
  return edges.filter((edge) => edge.confidence >= minConfidence);
}

/**
 * Get all nodes in a file
 */
export function getNodesInFile(
  nodes: import('./types.js').GraphNode[],
  filePath: string
): import('./types.js').GraphNode[] {
  return nodes.filter((node) => node.location.file === filePath);
}

/**
 * Calculate graph density (edges / possible edges)
 */
export function calculateDensity(nodeCount: number, edgeCount: number): number {
  if (nodeCount < 2) return 0;
  const maxEdges = nodeCount * (nodeCount - 1);
  return edgeCount / maxEdges;
}
