/**
 * Scan Test Service
 * @module e2e/services/scan-test-service
 *
 * Service for executing scan pipeline E2E tests:
 * - Execute complete scan pipelines
 * - Verify graph generation correctness
 * - Validate evidence pointers
 * - Measure scan performance
 *
 * TASK-E2E-001: End-to-end testing infrastructure
 * Agent #22 of 47 | Phase 4: Implementation
 */

import type { Result, AsyncResult } from '../../api/src/types/utility.js';
import { success, failure, isSuccess } from '../../api/src/types/utility.js';
import type {
  TenantId,
  RepositoryId,
  ScanId,
} from '../../api/src/types/entities.js';
import type { TestDatabase, SeedData, SeedResult } from '../domain/test-database.js';
import type { MockProvider } from '../domain/mock-provider.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Scan test service configuration
 */
export interface ScanTestServiceConfig {
  /** Base URL for the API */
  readonly apiBaseUrl: string;
  /** Timeout for scan operations in milliseconds */
  readonly scanTimeout: number;
  /** Polling interval for scan status in milliseconds */
  readonly pollInterval: number;
  /** Maximum poll attempts */
  readonly maxPollAttempts: number;
  /** Enable performance measurement */
  readonly measurePerformance: boolean;
  /** Verbose logging */
  readonly verbose: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_SCAN_TEST_CONFIG: ScanTestServiceConfig = {
  apiBaseUrl: 'http://localhost:3000',
  scanTimeout: 120000, // 2 minutes
  pollInterval: 1000,
  maxPollAttempts: 120,
  measurePerformance: true,
  verbose: false,
};

/**
 * Scan test input
 */
export interface ScanTestInput {
  /** Tenant ID for the test */
  readonly tenantId: TenantId;
  /** Repository to scan */
  readonly repository: ScanRepositoryInput;
  /** Expected results */
  readonly expectations: ScanExpectations;
  /** Authentication token */
  readonly authToken: string;
  /** Fixture files to use */
  readonly fixtureFiles?: Map<string, string>;
}

/**
 * Repository input for scan
 */
export interface ScanRepositoryInput {
  readonly owner: string;
  readonly name: string;
  readonly ref?: string;
  readonly commitSha: string;
  readonly provider?: 'github' | 'gitlab' | 'bitbucket';
}

/**
 * Expected scan results
 */
export interface ScanExpectations {
  /** Expected minimum node count */
  readonly minNodes?: number;
  /** Expected maximum node count */
  readonly maxNodes?: number;
  /** Expected minimum edge count */
  readonly minEdges?: number;
  /** Expected maximum edge count */
  readonly maxEdges?: number;
  /** Expected node types */
  readonly nodeTypes?: ReadonlyArray<string>;
  /** Expected edge types */
  readonly edgeTypes?: ReadonlyArray<string>;
  /** Expected file patterns */
  readonly filePatterns?: ReadonlyArray<string>;
  /** Minimum average confidence */
  readonly minAverageConfidence?: number;
  /** Maximum scan duration in milliseconds */
  readonly maxDurationMs?: number;
}

/**
 * Scan test result
 */
export interface ScanTestResult {
  /** Whether the test passed */
  readonly passed: boolean;
  /** Scan ID if created */
  readonly scanId?: ScanId;
  /** Repository ID if created */
  readonly repositoryId?: RepositoryId;
  /** Graph validation result */
  readonly graphValidation: GraphValidationResult;
  /** Evidence validation result */
  readonly evidenceValidation: EvidenceValidationResult;
  /** Performance metrics */
  readonly performance: ScanPerformanceMetrics;
  /** Failures encountered */
  readonly failures: ReadonlyArray<ScanTestFailure>;
  /** Total test duration in milliseconds */
  readonly durationMs: number;
}

/**
 * Graph validation result
 */
export interface GraphValidationResult {
  readonly valid: boolean;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly nodeTypes: ReadonlyArray<string>;
  readonly edgeTypes: ReadonlyArray<string>;
  readonly orphanedNodes: number;
  readonly invalidEdges: number;
  readonly cycleCount: number;
  readonly issues: ReadonlyArray<string>;
}

/**
 * Evidence validation result
 */
export interface EvidenceValidationResult {
  readonly valid: boolean;
  readonly totalEdges: number;
  readonly edgesWithEvidence: number;
  readonly edgesWithSourceFile: number;
  readonly edgesWithTargetFile: number;
  readonly edgesWithExpression: number;
  readonly edgesWithLineNumbers: number;
  readonly averageConfidence: number;
  readonly confidenceDistribution: ConfidenceDistribution;
  readonly issues: ReadonlyArray<string>;
}

/**
 * Confidence distribution
 */
export interface ConfidenceDistribution {
  readonly certain: number; // >= 95%
  readonly high: number; // >= 80%
  readonly medium: number; // >= 60%
  readonly low: number; // >= 40%
  readonly uncertain: number; // < 40%
}

/**
 * Scan performance metrics
 */
export interface ScanPerformanceMetrics {
  readonly totalDurationMs: number;
  readonly discoveryDurationMs?: number;
  readonly parsingDurationMs?: number;
  readonly detectionDurationMs?: number;
  readonly graphBuildDurationMs?: number;
  readonly persistenceDurationMs?: number;
  readonly filesProcessed: number;
  readonly filesPerSecond: number;
  readonly nodesPerSecond: number;
  readonly edgesPerSecond: number;
  readonly memoryUsageMb?: number;
  readonly withinBudget: boolean;
}

/**
 * Scan test failure
 */
export interface ScanTestFailure {
  readonly category: 'graph' | 'evidence' | 'performance' | 'api' | 'timeout';
  readonly message: string;
  readonly expected?: unknown;
  readonly actual?: unknown;
  readonly context?: Record<string, unknown>;
}

/**
 * Scan status response (from API)
 */
export interface ScanStatusResponse {
  readonly id: ScanId;
  readonly status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  readonly progress?: {
    readonly phase: string;
    readonly percentage: number;
    readonly filesProcessed?: number;
    readonly totalFiles?: number;
  };
  readonly error?: string;
}

/**
 * Graph response (from API)
 */
export interface GraphResponse {
  readonly scanId: ScanId;
  readonly nodes: ReadonlyArray<GraphNodeResponse>;
  readonly edges: ReadonlyArray<GraphEdgeResponse>;
  readonly metadata: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly nodeCounts: Record<string, number>;
    readonly edgeCounts: Record<string, number>;
  };
}

/**
 * Graph node response
 */
export interface GraphNodeResponse {
  readonly id: string;
  readonly type: string;
  readonly name: string;
  readonly qualifiedName: string;
  readonly filePath: string;
  readonly lineStart: number;
  readonly lineEnd: number;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Graph edge response
 */
export interface GraphEdgeResponse {
  readonly id: string;
  readonly sourceNodeId: string;
  readonly targetNodeId: string;
  readonly type: string;
  readonly confidence: number;
  readonly evidence?: {
    readonly sourceFile?: string;
    readonly targetFile?: string;
    readonly expression?: string;
    readonly sourceLineStart?: number;
    readonly sourceLineEnd?: number;
    readonly targetLineStart?: number;
    readonly targetLineEnd?: number;
  };
  readonly metadata?: Record<string, unknown>;
}

/**
 * Service error
 */
export interface ScanTestServiceError {
  readonly code: ScanTestServiceErrorCode;
  readonly message: string;
  readonly cause?: Error;
  readonly context?: Record<string, unknown>;
}

/**
 * Error codes
 */
export type ScanTestServiceErrorCode =
  | 'REPOSITORY_CREATE_FAILED'
  | 'SCAN_CREATE_FAILED'
  | 'SCAN_POLL_FAILED'
  | 'SCAN_TIMEOUT'
  | 'SCAN_FAILED'
  | 'GRAPH_FETCH_FAILED'
  | 'VALIDATION_FAILED'
  | 'API_ERROR'
  | 'INTERNAL_ERROR';

// ============================================================================
// Interface
// ============================================================================

/**
 * Scan test service interface
 */
export interface IScanTestService {
  /**
   * Execute a complete scan test
   */
  executeScanTest(input: ScanTestInput): AsyncResult<ScanTestResult, ScanTestServiceError>;

  /**
   * Validate an existing graph
   */
  validateGraph(
    graph: GraphResponse,
    expectations: ScanExpectations
  ): Result<GraphValidationResult, ScanTestServiceError>;

  /**
   * Validate evidence pointers
   */
  validateEvidence(
    edges: ReadonlyArray<GraphEdgeResponse>,
    minConfidence?: number
  ): Result<EvidenceValidationResult, ScanTestServiceError>;

  /**
   * Measure scan performance
   */
  measurePerformance(
    scanId: ScanId,
    authToken: string
  ): AsyncResult<ScanPerformanceMetrics, ScanTestServiceError>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Scan test service implementation
 */
export class ScanTestService implements IScanTestService {
  private readonly config: ScanTestServiceConfig;

  constructor(
    private readonly database?: TestDatabase,
    private readonly mocks?: MockProvider,
    config?: Partial<ScanTestServiceConfig>
  ) {
    this.config = { ...DEFAULT_SCAN_TEST_CONFIG, ...config };
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  /**
   * Execute a complete scan test
   */
  async executeScanTest(
    input: ScanTestInput
  ): AsyncResult<ScanTestResult, ScanTestServiceError> {
    const startTime = Date.now();
    const failures: ScanTestFailure[] = [];

    let scanId: ScanId | undefined;
    let repositoryId: RepositoryId | undefined;
    let graph: GraphResponse | undefined;

    try {
      this.log('Starting scan test', { repository: `${input.repository.owner}/${input.repository.name}` });

      // Step 1: Create or get repository
      const repoResult = await this.createOrGetRepository(input);
      if (!repoResult.success) {
        return failure(repoResult.error);
      }
      repositoryId = repoResult.value;

      // Step 2: Initiate scan
      const scanResult = await this.initiateScan(repositoryId, input);
      if (!scanResult.success) {
        return failure(scanResult.error);
      }
      scanId = scanResult.value;

      // Step 3: Wait for scan completion
      const statusResult = await this.waitForScanCompletion(scanId, input.authToken);
      if (!statusResult.success) {
        failures.push({
          category: 'api',
          message: statusResult.error.message,
          context: { scanId },
        });
        return this.buildFailedResult(failures, startTime, scanId, repositoryId);
      }

      // Step 4: Fetch graph
      const graphResult = await this.fetchGraph(scanId, input.authToken);
      if (!graphResult.success) {
        failures.push({
          category: 'api',
          message: graphResult.error.message,
          context: { scanId },
        });
        return this.buildFailedResult(failures, startTime, scanId, repositoryId);
      }
      graph = graphResult.value;

      // Step 5: Validate graph
      const graphValidation = this.validateGraph(graph, input.expectations);
      if (!graphValidation.success) {
        failures.push({
          category: 'graph',
          message: graphValidation.error.message,
        });
      }

      // Step 6: Validate evidence
      const evidenceValidation = this.validateEvidence(
        graph.edges,
        input.expectations.minAverageConfidence
      );
      if (!evidenceValidation.success) {
        failures.push({
          category: 'evidence',
          message: evidenceValidation.error.message,
        });
      }

      // Step 7: Measure performance
      let performance: ScanPerformanceMetrics;
      if (this.config.measurePerformance) {
        const perfResult = await this.measurePerformance(scanId, input.authToken);
        performance = perfResult.success
          ? perfResult.value
          : this.createDefaultPerformanceMetrics(graph, startTime);

        // Check performance expectations
        if (input.expectations.maxDurationMs && performance.totalDurationMs > input.expectations.maxDurationMs) {
          failures.push({
            category: 'performance',
            message: `Scan exceeded duration budget: ${performance.totalDurationMs}ms > ${input.expectations.maxDurationMs}ms`,
            expected: input.expectations.maxDurationMs,
            actual: performance.totalDurationMs,
          });
        }
      } else {
        performance = this.createDefaultPerformanceMetrics(graph, startTime);
      }

      // Add validation failures
      if (graphValidation.success && !graphValidation.value.valid) {
        for (const issue of graphValidation.value.issues) {
          failures.push({ category: 'graph', message: issue });
        }
      }

      if (evidenceValidation.success && !evidenceValidation.value.valid) {
        for (const issue of evidenceValidation.value.issues) {
          failures.push({ category: 'evidence', message: issue });
        }
      }

      const durationMs = Date.now() - startTime;

      return success({
        passed: failures.length === 0,
        scanId,
        repositoryId,
        graphValidation: graphValidation.success
          ? graphValidation.value
          : this.createEmptyGraphValidation(),
        evidenceValidation: evidenceValidation.success
          ? evidenceValidation.value
          : this.createEmptyEvidenceValidation(),
        performance,
        failures,
        durationMs,
      });
    } catch (error) {
      failures.push({
        category: 'api',
        message: error instanceof Error ? error.message : String(error),
      });
      return this.buildFailedResult(failures, startTime, scanId, repositoryId);
    }
  }

  /**
   * Validate an existing graph
   */
  validateGraph(
    graph: GraphResponse,
    expectations: ScanExpectations
  ): Result<GraphValidationResult, ScanTestServiceError> {
    const issues: string[] = [];
    const nodeIds = new Set(graph.nodes.map((n) => n.id));
    const nodeTypes = [...new Set(graph.nodes.map((n) => n.type))];
    const edgeTypes = [...new Set(graph.edges.map((e) => e.type))];

    // Check node count bounds
    if (expectations.minNodes !== undefined && graph.nodes.length < expectations.minNodes) {
      issues.push(`Node count ${graph.nodes.length} is below minimum ${expectations.minNodes}`);
    }
    if (expectations.maxNodes !== undefined && graph.nodes.length > expectations.maxNodes) {
      issues.push(`Node count ${graph.nodes.length} exceeds maximum ${expectations.maxNodes}`);
    }

    // Check edge count bounds
    if (expectations.minEdges !== undefined && graph.edges.length < expectations.minEdges) {
      issues.push(`Edge count ${graph.edges.length} is below minimum ${expectations.minEdges}`);
    }
    if (expectations.maxEdges !== undefined && graph.edges.length > expectations.maxEdges) {
      issues.push(`Edge count ${graph.edges.length} exceeds maximum ${expectations.maxEdges}`);
    }

    // Check expected node types
    if (expectations.nodeTypes) {
      for (const expectedType of expectations.nodeTypes) {
        if (!nodeTypes.includes(expectedType)) {
          issues.push(`Expected node type "${expectedType}" not found in graph`);
        }
      }
    }

    // Check expected edge types
    if (expectations.edgeTypes) {
      for (const expectedType of expectations.edgeTypes) {
        if (!edgeTypes.includes(expectedType)) {
          issues.push(`Expected edge type "${expectedType}" not found in graph`);
        }
      }
    }

    // Find orphaned nodes (nodes with no edges)
    const connectedNodes = new Set<string>();
    for (const edge of graph.edges) {
      connectedNodes.add(edge.sourceNodeId);
      connectedNodes.add(edge.targetNodeId);
    }
    const orphanedNodes = graph.nodes.filter((n) => !connectedNodes.has(n.id)).length;

    // Find invalid edges (edges referencing non-existent nodes)
    let invalidEdges = 0;
    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
        invalidEdges++;
      }
    }

    if (invalidEdges > 0) {
      issues.push(`Found ${invalidEdges} edges with invalid node references`);
    }

    // Detect cycles (simple DFS-based detection)
    const cycleCount = this.detectCycles(graph.nodes, graph.edges);

    return success({
      valid: issues.length === 0,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
      nodeTypes,
      edgeTypes,
      orphanedNodes,
      invalidEdges,
      cycleCount,
      issues,
    });
  }

  /**
   * Validate evidence pointers
   */
  validateEvidence(
    edges: ReadonlyArray<GraphEdgeResponse>,
    minConfidence?: number
  ): Result<EvidenceValidationResult, ScanTestServiceError> {
    const issues: string[] = [];
    let edgesWithEvidence = 0;
    let edgesWithSourceFile = 0;
    let edgesWithTargetFile = 0;
    let edgesWithExpression = 0;
    let edgesWithLineNumbers = 0;
    let totalConfidence = 0;

    const distribution: ConfidenceDistribution = {
      certain: 0,
      high: 0,
      medium: 0,
      low: 0,
      uncertain: 0,
    };

    for (const edge of edges) {
      totalConfidence += edge.confidence;

      // Categorize confidence
      if (edge.confidence >= 0.95) distribution.certain++;
      else if (edge.confidence >= 0.8) distribution.high++;
      else if (edge.confidence >= 0.6) distribution.medium++;
      else if (edge.confidence >= 0.4) distribution.low++;
      else distribution.uncertain++;

      if (edge.evidence) {
        edgesWithEvidence++;
        if (edge.evidence.sourceFile) edgesWithSourceFile++;
        if (edge.evidence.targetFile) edgesWithTargetFile++;
        if (edge.evidence.expression) edgesWithExpression++;
        if (edge.evidence.sourceLineStart !== undefined || edge.evidence.targetLineStart !== undefined) {
          edgesWithLineNumbers++;
        }
      }
    }

    const averageConfidence = edges.length > 0 ? totalConfidence / edges.length : 0;

    // Check minimum confidence
    if (minConfidence !== undefined && averageConfidence < minConfidence) {
      issues.push(
        `Average confidence ${(averageConfidence * 100).toFixed(1)}% is below minimum ${(minConfidence * 100).toFixed(1)}%`
      );
    }

    // Check evidence completeness
    const evidenceRatio = edges.length > 0 ? edgesWithEvidence / edges.length : 1;
    if (evidenceRatio < 0.9) {
      issues.push(
        `Only ${(evidenceRatio * 100).toFixed(1)}% of edges have evidence (expected >= 90%)`
      );
    }

    const sourceFileRatio = edges.length > 0 ? edgesWithSourceFile / edges.length : 1;
    if (sourceFileRatio < 0.9) {
      issues.push(
        `Only ${(sourceFileRatio * 100).toFixed(1)}% of edges have source file pointers`
      );
    }

    return success({
      valid: issues.length === 0,
      totalEdges: edges.length,
      edgesWithEvidence,
      edgesWithSourceFile,
      edgesWithTargetFile,
      edgesWithExpression,
      edgesWithLineNumbers,
      averageConfidence,
      confidenceDistribution: distribution,
      issues,
    });
  }

  /**
   * Measure scan performance
   */
  async measurePerformance(
    scanId: ScanId,
    authToken: string
  ): AsyncResult<ScanPerformanceMetrics, ScanTestServiceError> {
    try {
      // Fetch scan metrics from API
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/v1/scans/${scanId}/metrics`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        // If metrics endpoint not available, create default metrics
        return success(this.createDefaultPerformanceMetrics(undefined, Date.now()));
      }

      const data = await response.json();

      return success({
        totalDurationMs: data.totalDurationMs ?? 0,
        discoveryDurationMs: data.discoveryDurationMs,
        parsingDurationMs: data.parsingDurationMs,
        detectionDurationMs: data.detectionDurationMs,
        graphBuildDurationMs: data.graphBuildDurationMs,
        persistenceDurationMs: data.persistenceDurationMs,
        filesProcessed: data.filesProcessed ?? 0,
        filesPerSecond: data.filesPerSecond ?? 0,
        nodesPerSecond: data.nodesPerSecond ?? 0,
        edgesPerSecond: data.edgesPerSecond ?? 0,
        memoryUsageMb: data.memoryUsageMb,
        withinBudget: data.withinBudget ?? true,
      });
    } catch (error) {
      return failure({
        code: 'API_ERROR',
        message: `Failed to fetch performance metrics: ${error instanceof Error ? error.message : String(error)}`,
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async createOrGetRepository(
    input: ScanTestInput
  ): AsyncResult<RepositoryId, ScanTestServiceError> {
    try {
      const response = await fetch(`${this.config.apiBaseUrl}/api/v1/repositories`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${input.authToken}`,
          'Content-Type': 'application/json',
          'X-Tenant-Id': input.tenantId,
        },
        body: JSON.stringify({
          provider: input.repository.provider ?? 'github',
          owner: input.repository.owner,
          name: input.repository.name,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return failure({
          code: 'REPOSITORY_CREATE_FAILED',
          message: `Failed to create repository: ${response.status} ${response.statusText}`,
          context: { error: errorData },
        });
      }

      const data = await response.json();
      return success(data.id as RepositoryId);
    } catch (error) {
      return failure({
        code: 'REPOSITORY_CREATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private async initiateScan(
    repositoryId: RepositoryId,
    input: ScanTestInput
  ): AsyncResult<ScanId, ScanTestServiceError> {
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/v1/repositories/${repositoryId}/scans`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.authToken}`,
            'Content-Type': 'application/json',
            'X-Tenant-Id': input.tenantId,
          },
          body: JSON.stringify({
            ref: input.repository.ref ?? 'main',
            commitSha: input.repository.commitSha,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return failure({
          code: 'SCAN_CREATE_FAILED',
          message: `Failed to initiate scan: ${response.status} ${response.statusText}`,
          context: { error: errorData },
        });
      }

      const data = await response.json();
      return success(data.id as ScanId);
    } catch (error) {
      return failure({
        code: 'SCAN_CREATE_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private async waitForScanCompletion(
    scanId: ScanId,
    authToken: string
  ): AsyncResult<ScanStatusResponse, ScanTestServiceError> {
    const startTime = Date.now();
    let attempts = 0;

    while (attempts < this.config.maxPollAttempts) {
      // Check timeout
      if (Date.now() - startTime > this.config.scanTimeout) {
        return failure({
          code: 'SCAN_TIMEOUT',
          message: `Scan timed out after ${this.config.scanTimeout}ms`,
          context: { scanId, attempts },
        });
      }

      try {
        const response = await fetch(
          `${this.config.apiBaseUrl}/api/v1/scans/${scanId}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          attempts++;
          await this.delay(this.config.pollInterval);
          continue;
        }

        const data: ScanStatusResponse = await response.json();

        if (data.status === 'completed') {
          return success(data);
        }

        if (data.status === 'failed') {
          return failure({
            code: 'SCAN_FAILED',
            message: data.error ?? 'Scan failed without error message',
            context: { scanId },
          });
        }

        if (data.status === 'cancelled') {
          return failure({
            code: 'SCAN_FAILED',
            message: 'Scan was cancelled',
            context: { scanId },
          });
        }

        this.log(`Scan progress: ${data.progress?.percentage ?? 0}%`, {
          phase: data.progress?.phase,
        });
      } catch (error) {
        this.log('Poll error', { error: error instanceof Error ? error.message : String(error) });
      }

      attempts++;
      await this.delay(this.config.pollInterval);
    }

    return failure({
      code: 'SCAN_POLL_FAILED',
      message: `Failed to get scan status after ${attempts} attempts`,
      context: { scanId },
    });
  }

  private async fetchGraph(
    scanId: ScanId,
    authToken: string
  ): AsyncResult<GraphResponse, ScanTestServiceError> {
    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/api/v1/scans/${scanId}/graph`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return failure({
          code: 'GRAPH_FETCH_FAILED',
          message: `Failed to fetch graph: ${response.status} ${response.statusText}`,
          context: { error: errorData },
        });
      }

      const data = await response.json();
      return success(data as GraphResponse);
    } catch (error) {
      return failure({
        code: 'GRAPH_FETCH_FAILED',
        message: error instanceof Error ? error.message : String(error),
        cause: error instanceof Error ? error : undefined,
      });
    }
  }

  private detectCycles(
    nodes: ReadonlyArray<GraphNodeResponse>,
    edges: ReadonlyArray<GraphEdgeResponse>
  ): number {
    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const node of nodes) {
      adjacency.set(node.id, []);
    }
    for (const edge of edges) {
      const neighbors = adjacency.get(edge.sourceNodeId);
      if (neighbors) {
        neighbors.push(edge.targetNodeId);
      }
    }

    // DFS to detect cycles
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    let cycleCount = 0;

    const hasCycle = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) {
        return true;
      }
      if (visited.has(nodeId)) {
        return false;
      }

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjacency.get(nodeId) ?? [];
      for (const neighbor of neighbors) {
        if (hasCycle(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) {
          cycleCount++;
        }
      }
    }

    return cycleCount;
  }

  private buildFailedResult(
    failures: ScanTestFailure[],
    startTime: number,
    scanId?: ScanId,
    repositoryId?: RepositoryId
  ): Result<ScanTestResult, ScanTestServiceError> {
    return success({
      passed: false,
      scanId,
      repositoryId,
      graphValidation: this.createEmptyGraphValidation(),
      evidenceValidation: this.createEmptyEvidenceValidation(),
      performance: this.createDefaultPerformanceMetrics(undefined, startTime),
      failures,
      durationMs: Date.now() - startTime,
    });
  }

  private createEmptyGraphValidation(): GraphValidationResult {
    return {
      valid: false,
      nodeCount: 0,
      edgeCount: 0,
      nodeTypes: [],
      edgeTypes: [],
      orphanedNodes: 0,
      invalidEdges: 0,
      cycleCount: 0,
      issues: ['Graph validation not performed'],
    };
  }

  private createEmptyEvidenceValidation(): EvidenceValidationResult {
    return {
      valid: false,
      totalEdges: 0,
      edgesWithEvidence: 0,
      edgesWithSourceFile: 0,
      edgesWithTargetFile: 0,
      edgesWithExpression: 0,
      edgesWithLineNumbers: 0,
      averageConfidence: 0,
      confidenceDistribution: { certain: 0, high: 0, medium: 0, low: 0, uncertain: 0 },
      issues: ['Evidence validation not performed'],
    };
  }

  private createDefaultPerformanceMetrics(
    graph: GraphResponse | undefined,
    startTime: number
  ): ScanPerformanceMetrics {
    const duration = Date.now() - startTime;
    const nodeCount = graph?.nodes.length ?? 0;
    const edgeCount = graph?.edges.length ?? 0;

    return {
      totalDurationMs: duration,
      filesProcessed: 0,
      filesPerSecond: 0,
      nodesPerSecond: duration > 0 ? (nodeCount / duration) * 1000 : 0,
      edgesPerSecond: duration > 0 ? (edgeCount / duration) * 1000 : 0,
      withinBudget: true,
    };
  }

  private log(message: string, data?: Record<string, unknown>): void {
    if (this.config.verbose) {
      console.log(`[ScanTestService] ${message}`, data ?? '');
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a new scan test service
 */
export function createScanTestService(
  database?: TestDatabase,
  mocks?: MockProvider,
  config?: Partial<ScanTestServiceConfig>
): IScanTestService {
  return new ScanTestService(database, mocks, config);
}

/**
 * Type guard for ScanTestServiceError
 */
export function isScanTestServiceError(value: unknown): value is ScanTestServiceError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value
  );
}
