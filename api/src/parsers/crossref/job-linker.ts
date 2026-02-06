/**
 * Job-to-Operation Linker
 * @module parsers/crossref/job-linker
 *
 * Links CI/CD pipeline jobs to Terraform and Helm infrastructure nodes.
 * Creates OPERATES_ON edges to represent the relationship between CI jobs
 * and the infrastructure they manage.
 *
 * TASK-XREF-007: PIPELINE Node Type Implementation - Job Linking
 */

import { createHash } from 'crypto';
import {
  PipelineJobNode,
  JobOperation,
  OperatesOnEdge,
  OperationType,
  generateEdgeId,
} from './pipeline-node';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Terraform node representation for linking
 */
export interface TerraformNode {
  /** Node ID */
  readonly id: string;
  /** Node type */
  readonly type: 'terraform_module' | 'terraform_resource' | 'terraform_output' | 'terragrunt_unit';
  /** Node name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Module path (directory) */
  readonly modulePath?: string;
  /** Metadata */
  readonly metadata?: {
    readonly moduleName?: string;
    readonly resourceType?: string;
    readonly outputName?: string;
    [key: string]: unknown;
  };
}

/**
 * Helm node representation for linking
 */
export interface HelmNode {
  /** Node ID */
  readonly id: string;
  /** Node type */
  readonly type: 'helm_release' | 'helm_chart' | 'helm_value' | 'helmfile_release';
  /** Node name */
  readonly name: string;
  /** Source file path */
  readonly filePath: string;
  /** Chart path */
  readonly chartPath?: string;
  /** Release name */
  readonly releaseName?: string;
  /** Metadata */
  readonly metadata?: {
    readonly chartName?: string;
    readonly namespace?: string;
    readonly valuePath?: string;
    [key: string]: unknown;
  };
}

/**
 * Link result containing edges and match details
 */
export interface LinkResult {
  /** Created edges */
  readonly edges: readonly OperatesOnEdge[];
  /** Match details for debugging */
  readonly matches: readonly LinkMatch[];
}

/**
 * Details about a single link match
 */
export interface LinkMatch {
  /** Job node ID */
  readonly jobNodeId: string;
  /** Target node ID */
  readonly targetNodeId: string;
  /** Operation that matched */
  readonly operation: JobOperation;
  /** How the match was determined */
  readonly matchReason: MatchReason;
  /** Confidence score */
  readonly confidence: number;
}

/**
 * Reasons for matching a job to a node
 */
export type MatchReason =
  | 'working_dir_match'      // Job working directory matches module path
  | 'path_reference'         // Job explicitly references the path
  | 'chart_name_match'       // Helm chart name matches
  | 'release_name_match'     // Helm release name matches
  | 'output_reference'       // Job references a specific output
  | 'resource_reference'     // Job references a specific resource
  | 'namespace_match'        // Kubernetes namespace matches
  | 'directory_proximity'    // Files are in same/nearby directories
  | 'name_similarity'        // Names are similar
  | 'inferred';              // Inferred from context

/**
 * Options for job linking
 */
export interface LinkingOptions {
  /** Minimum confidence threshold for creating edges */
  readonly minConfidence?: number;
  /** Enable fuzzy matching for paths */
  readonly fuzzyPathMatching?: boolean;
  /** Enable name similarity matching */
  readonly nameSimilarityMatching?: boolean;
  /** Maximum edges per job operation */
  readonly maxEdgesPerOperation?: number;
}

/**
 * Default linking options
 */
export const DEFAULT_LINKING_OPTIONS: Required<LinkingOptions> = {
  minConfidence: 50,
  fuzzyPathMatching: true,
  nameSimilarityMatching: true,
  maxEdgesPerOperation: 5,
};

/**
 * Statistics about job-to-infrastructure linking
 */
export interface LinkingStats {
  /** Total number of edges */
  readonly totalEdges: number;
  /** Count by operation type */
  readonly byOperationType: Record<OperationType, number>;
  /** Average confidence score */
  readonly averageConfidence: number;
  /** Count of high confidence edges (>=80) */
  readonly highConfidenceCount: number;
  /** Count of medium confidence edges (50-79) */
  readonly mediumConfidenceCount: number;
  /** Count of low confidence edges (<50) */
  readonly lowConfidenceCount: number;
  /** Number of unique source jobs */
  readonly uniqueJobs: number;
  /** Number of unique target nodes */
  readonly uniqueTargets: number;
}

// ============================================================================
// Path Matching Functions
// ============================================================================

/**
 * Normalize a file path for comparison.
 *
 * @param filePath - Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  return filePath
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .toLowerCase();
}

/**
 * Get the directory containing a file.
 *
 * @param filePath - File path
 * @returns Directory path
 */
export function getDirectory(filePath: string): string {
  const normalized = normalizePath(filePath);
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash >= 0 ? normalized.substring(0, lastSlash) : '.';
}

/**
 * Check if two paths are in the same or related directories.
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths are related
 */
export function arePathsRelated(path1: string, path2: string): boolean {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);

  // Exact match
  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.startsWith(norm2 + '/') || norm2.startsWith(norm1 + '/')) return true;

  // Same directory
  const dir1 = getDirectory(norm1);
  const dir2 = getDirectory(norm2);
  if (dir1 === dir2) return true;

  // Parent-child relationship
  if (dir1.startsWith(dir2 + '/') || dir2.startsWith(dir1 + '/')) return true;

  return false;
}

/**
 * Calculate path similarity score.
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns Similarity score (0-100)
 */
export function calculatePathSimilarity(path1: string, path2: string): number {
  const norm1 = normalizePath(path1);
  const norm2 = normalizePath(path2);

  // Exact match
  if (norm1 === norm2) return 100;

  // Split into segments
  const segments1 = norm1.split('/').filter(s => s.length > 0);
  const segments2 = norm2.split('/').filter(s => s.length > 0);

  // Count common segments
  let commonCount = 0;
  const minLength = Math.min(segments1.length, segments2.length);

  for (let i = 0; i < minLength; i++) {
    if (segments1[i] === segments2[i]) {
      commonCount++;
    } else {
      break;
    }
  }

  // Calculate similarity based on common prefix
  const maxLength = Math.max(segments1.length, segments2.length);
  return Math.round((commonCount / maxLength) * 100);
}

// ============================================================================
// Name Matching Functions
// ============================================================================

/**
 * Normalize a name for comparison.
 *
 * @param name - Name to normalize
 * @returns Normalized name
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[-_]/g, '')
    .replace(/\s+/g, '');
}

/**
 * Calculate name similarity using Levenshtein distance.
 *
 * @param name1 - First name
 * @param name2 - Second name
 * @returns Similarity score (0-100)
 */
export function calculateNameSimilarity(name1: string, name2: string): number {
  const norm1 = normalizeName(name1);
  const norm2 = normalizeName(name2);

  if (norm1 === norm2) return 100;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return 80;

  // Levenshtein distance
  const len1 = norm1.length;
  const len2 = norm2.length;

  if (len1 === 0 || len2 === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = norm1[i - 1] === norm2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  return Math.round(((maxLen - distance) / maxLen) * 100);
}

// ============================================================================
// Terraform Linking Functions
// ============================================================================

/**
 * Extract working directory from Terraform operation.
 *
 * @param operation - Job operation
 * @returns Working directory or undefined
 */
function extractTerraformWorkingDir(operation: JobOperation): string | undefined {
  if (operation.workingDir) {
    return operation.workingDir;
  }
  return undefined;
}

/**
 * Match a Terraform operation to Terraform nodes.
 *
 * @param jobNode - Pipeline job node
 * @param operation - Terraform operation
 * @param terraformNodes - Available Terraform nodes
 * @param options - Linking options
 * @returns Array of link matches
 */
function matchTerraformOperation(
  jobNode: PipelineJobNode,
  operation: JobOperation,
  terraformNodes: ReadonlyMap<string, TerraformNode>,
  options: Required<LinkingOptions>
): LinkMatch[] {
  const matches: LinkMatch[] = [];
  const workingDir = extractTerraformWorkingDir(operation);

  for (const [nodeId, tfNode] of Array.from(terraformNodes.entries())) {
    let confidence = 0;
    let matchReason: MatchReason = 'inferred';

    // Check working directory match
    if (workingDir && tfNode.modulePath) {
      const pathSimilarity = calculatePathSimilarity(workingDir, tfNode.modulePath);
      if (pathSimilarity >= 80) {
        confidence = Math.max(confidence, pathSimilarity);
        matchReason = 'working_dir_match';
      } else if (pathSimilarity >= 50 && options.fuzzyPathMatching) {
        confidence = Math.max(confidence, pathSimilarity);
        matchReason = 'directory_proximity';
      }
    }

    // Check file path proximity
    if (confidence < 50) {
      const jobDir = getDirectory(jobNode.filePath);
      const tfDir = getDirectory(tfNode.filePath);
      if (arePathsRelated(jobDir, tfDir)) {
        confidence = Math.max(confidence, 60);
        matchReason = 'directory_proximity';
      }
    }

    // Check output references
    if (operation.outputs && operation.outputs.length > 0 && tfNode.type === 'terraform_output') {
      const outputName = tfNode.metadata?.outputName ?? tfNode.name;
      if (operation.outputs.some(out => normalizeName(out) === normalizeName(outputName))) {
        confidence = Math.max(confidence, 90);
        matchReason = 'output_reference';
      }
    }

    // Check name similarity
    if (confidence < 50 && options.nameSimilarityMatching) {
      const nameSim = calculateNameSimilarity(jobNode.name, tfNode.name);
      if (nameSim >= 60) {
        confidence = Math.max(confidence, nameSim * 0.7);
        matchReason = 'name_similarity';
      }
    }

    // Add match if confidence meets threshold
    if (confidence >= options.minConfidence) {
      matches.push({
        jobNodeId: jobNode.id,
        targetNodeId: nodeId,
        operation,
        matchReason,
        confidence: Math.round(confidence),
      });
    }
  }

  // Sort by confidence and limit
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, options.maxEdgesPerOperation);
}

/**
 * Link a job to Terraform nodes based on its operations.
 *
 * @param job - Pipeline job node
 * @param terraformNodes - Map of Terraform nodes by ID
 * @param options - Linking options
 * @returns Array of OPERATES_ON edges
 */
export function linkJobToTerraform(
  job: PipelineJobNode,
  terraformNodes: ReadonlyMap<string, TerraformNode>,
  options?: LinkingOptions
): readonly OperatesOnEdge[] {
  const opts = { ...DEFAULT_LINKING_OPTIONS, ...options };
  const edges: OperatesOnEdge[] = [];

  // Get Terraform operations from the job
  const tfOperations = job.metadata.operations.filter(op => op.type === 'terraform');

  for (const operation of tfOperations) {
    const matches = matchTerraformOperation(job, operation, terraformNodes, opts);

    for (const match of matches) {
      edges.push({
        id: generateEdgeId('OPERATES_ON', job.id, match.targetNodeId),
        type: 'OPERATES_ON',
        sourceNodeId: job.id,
        targetNodeId: match.targetNodeId,
        confidence: match.confidence,
        metadata: {
          operation: operation.command,
          operationType: operation.type,
          stepIndex: operation.stepIndex,
        },
      });
    }
  }

  return edges;
}

// ============================================================================
// Helm Linking Functions
// ============================================================================

/**
 * Extract chart reference from Helm operation command.
 *
 * @param command - Helm command string
 * @returns Extracted chart reference or undefined
 */
function extractChartReference(command: string): string | undefined {
  // helm install/upgrade RELEASE CHART
  const installMatch = /(?:install|upgrade)\s+\S+\s+(\S+)/i.exec(command);
  if (installMatch) {
    return installMatch[1];
  }
  return undefined;
}

/**
 * Extract release name from Helm operation command.
 *
 * @param command - Helm command string
 * @returns Extracted release name or undefined
 */
function extractReleaseName(command: string): string | undefined {
  // helm install/upgrade RELEASE CHART
  const installMatch = /(?:install|upgrade)\s+(\S+)/i.exec(command);
  if (installMatch) {
    return installMatch[1];
  }

  // helm uninstall RELEASE
  const uninstallMatch = /uninstall\s+(\S+)/i.exec(command);
  if (uninstallMatch) {
    return uninstallMatch[1];
  }

  return undefined;
}

/**
 * Extract namespace from operation inputs or environment.
 *
 * @param operation - Job operation
 * @returns Namespace or undefined
 */
function extractNamespace(operation: JobOperation): string | undefined {
  // Check inputs for namespace references
  if (operation.inputs) {
    for (const input of operation.inputs) {
      if (input.toLowerCase().includes('namespace')) {
        return input;
      }
    }
  }
  return undefined;
}

/**
 * Match a Helm operation to Helm nodes.
 *
 * @param jobNode - Pipeline job node
 * @param operation - Helm operation
 * @param helmNodes - Available Helm nodes
 * @param options - Linking options
 * @returns Array of link matches
 */
function matchHelmOperation(
  jobNode: PipelineJobNode,
  operation: JobOperation,
  helmNodes: ReadonlyMap<string, HelmNode>,
  options: Required<LinkingOptions>
): LinkMatch[] {
  const matches: LinkMatch[] = [];

  for (const [nodeId, helmNode] of Array.from(helmNodes.entries())) {
    let confidence = 0;
    let matchReason: MatchReason = 'inferred';

    // Check chart name/path match
    if (helmNode.chartPath && operation.workingDir) {
      const pathSimilarity = calculatePathSimilarity(operation.workingDir, helmNode.chartPath);
      if (pathSimilarity >= 80) {
        confidence = Math.max(confidence, pathSimilarity);
        matchReason = 'chart_name_match';
      }
    }

    // Check release name match
    if (helmNode.releaseName) {
      const jobReleaseName = extractReleaseName(operation.command);
      if (jobReleaseName && normalizeName(jobReleaseName) === normalizeName(helmNode.releaseName)) {
        confidence = Math.max(confidence, 95);
        matchReason = 'release_name_match';
      }
    }

    // Check chart name in metadata
    if (helmNode.metadata?.chartName) {
      const chartRef = extractChartReference(operation.command);
      if (chartRef) {
        const chartName = helmNode.metadata.chartName;
        if (normalizeName(chartRef).includes(normalizeName(chartName)) ||
            normalizeName(chartName).includes(normalizeName(chartRef))) {
          confidence = Math.max(confidence, 85);
          matchReason = 'chart_name_match';
        }
      }
    }

    // Check namespace match
    if (helmNode.metadata?.namespace) {
      const opNamespace = extractNamespace(operation);
      if (opNamespace && normalizeName(opNamespace) === normalizeName(helmNode.metadata.namespace)) {
        confidence = Math.max(confidence, 75);
        matchReason = 'namespace_match';
      }
    }

    // Check file path proximity
    if (confidence < 50) {
      const jobDir = getDirectory(jobNode.filePath);
      const helmDir = getDirectory(helmNode.filePath);
      if (arePathsRelated(jobDir, helmDir)) {
        confidence = Math.max(confidence, 55);
        matchReason = 'directory_proximity';
      }
    }

    // Check name similarity
    if (confidence < 50 && options.nameSimilarityMatching) {
      const nameSim = calculateNameSimilarity(jobNode.name, helmNode.name);
      if (nameSim >= 60) {
        confidence = Math.max(confidence, nameSim * 0.7);
        matchReason = 'name_similarity';
      }
    }

    // Add match if confidence meets threshold
    if (confidence >= options.minConfidence) {
      matches.push({
        jobNodeId: jobNode.id,
        targetNodeId: nodeId,
        operation,
        matchReason,
        confidence: Math.round(confidence),
      });
    }
  }

  // Sort by confidence and limit
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, options.maxEdgesPerOperation);
}

/**
 * Link a job to Helm nodes based on its operations.
 *
 * @param job - Pipeline job node
 * @param helmNodes - Map of Helm nodes by ID
 * @param options - Linking options
 * @returns Array of OPERATES_ON edges
 */
export function linkJobToHelm(
  job: PipelineJobNode,
  helmNodes: ReadonlyMap<string, HelmNode>,
  options?: LinkingOptions
): readonly OperatesOnEdge[] {
  const opts = { ...DEFAULT_LINKING_OPTIONS, ...options };
  const edges: OperatesOnEdge[] = [];

  // Get Helm operations from the job
  const helmOperations = job.metadata.operations.filter(op => op.type === 'helm');

  for (const operation of helmOperations) {
    const matches = matchHelmOperation(job, operation, helmNodes, opts);

    for (const match of matches) {
      edges.push({
        id: generateEdgeId('OPERATES_ON', job.id, match.targetNodeId),
        type: 'OPERATES_ON',
        sourceNodeId: job.id,
        targetNodeId: match.targetNodeId,
        confidence: match.confidence,
        metadata: {
          operation: operation.command,
          operationType: operation.type,
          stepIndex: operation.stepIndex,
        },
      });
    }
  }

  return edges;
}

// ============================================================================
// Combined Linking Functions
// ============================================================================

/**
 * Link a job to all relevant infrastructure nodes.
 *
 * @param job - Pipeline job node
 * @param terraformNodes - Map of Terraform nodes
 * @param helmNodes - Map of Helm nodes
 * @param options - Linking options
 * @returns Link result with edges and match details
 */
export function linkJobToInfrastructure(
  job: PipelineJobNode,
  terraformNodes: ReadonlyMap<string, TerraformNode>,
  helmNodes: ReadonlyMap<string, HelmNode>,
  options?: LinkingOptions
): LinkResult {
  const opts = { ...DEFAULT_LINKING_OPTIONS, ...options };
  const allMatches: LinkMatch[] = [];
  const allEdges: OperatesOnEdge[] = [];

  // Link Terraform operations
  const tfOperations = job.metadata.operations.filter(op => op.type === 'terraform');
  for (const operation of tfOperations) {
    const matches = matchTerraformOperation(job, operation, terraformNodes, opts);
    allMatches.push(...matches);

    for (const match of matches) {
      allEdges.push({
        id: generateEdgeId('OPERATES_ON', job.id, match.targetNodeId),
        type: 'OPERATES_ON',
        sourceNodeId: job.id,
        targetNodeId: match.targetNodeId,
        confidence: match.confidence,
        metadata: {
          operation: operation.command,
          operationType: operation.type,
          stepIndex: operation.stepIndex,
        },
      });
    }
  }

  // Link Helm operations
  const helmOperations = job.metadata.operations.filter(op => op.type === 'helm');
  for (const operation of helmOperations) {
    const matches = matchHelmOperation(job, operation, helmNodes, opts);
    allMatches.push(...matches);

    for (const match of matches) {
      allEdges.push({
        id: generateEdgeId('OPERATES_ON', job.id, match.targetNodeId),
        type: 'OPERATES_ON',
        sourceNodeId: job.id,
        targetNodeId: match.targetNodeId,
        confidence: match.confidence,
        metadata: {
          operation: operation.command,
          operationType: operation.type,
          stepIndex: operation.stepIndex,
        },
      });
    }
  }

  return {
    edges: allEdges,
    matches: allMatches,
  };
}

/**
 * Link all jobs in a collection to infrastructure nodes.
 *
 * @param jobs - Array of pipeline job nodes
 * @param terraformNodes - Map of Terraform nodes
 * @param helmNodes - Map of Helm nodes
 * @param options - Linking options
 * @returns Combined link result
 */
export function linkAllJobsToInfrastructure(
  jobs: readonly PipelineJobNode[],
  terraformNodes: ReadonlyMap<string, TerraformNode>,
  helmNodes: ReadonlyMap<string, HelmNode>,
  options?: LinkingOptions
): LinkResult {
  const allEdges: OperatesOnEdge[] = [];
  const allMatches: LinkMatch[] = [];

  for (const job of jobs) {
    const result = linkJobToInfrastructure(job, terraformNodes, helmNodes, options);
    allEdges.push(...result.edges);
    allMatches.push(...result.matches);
  }

  return {
    edges: allEdges,
    matches: allMatches,
  };
}

// ============================================================================
// Query and Analysis Functions
// ============================================================================

/**
 * Get all infrastructure nodes operated on by a job.
 *
 * @param jobId - Job node ID
 * @param edges - All OPERATES_ON edges
 * @returns Array of target node IDs
 */
export function getOperatedNodes(
  jobId: string,
  edges: readonly OperatesOnEdge[]
): readonly string[] {
  return edges
    .filter(edge => edge.sourceNodeId === jobId)
    .map(edge => edge.targetNodeId);
}

/**
 * Get all jobs that operate on a specific infrastructure node.
 *
 * @param nodeId - Infrastructure node ID
 * @param edges - All OPERATES_ON edges
 * @returns Array of job node IDs
 */
export function getOperatingJobs(
  nodeId: string,
  edges: readonly OperatesOnEdge[]
): readonly string[] {
  return edges
    .filter(edge => edge.targetNodeId === nodeId)
    .map(edge => edge.sourceNodeId);
}

/**
 * Get statistics about job-to-infrastructure linking.
 *
 * @param edges - All OPERATES_ON edges
 * @returns Linking statistics
 */
export function getLinkingStats(edges: readonly OperatesOnEdge[]): LinkingStats {
  const byOperationType: Record<OperationType, number> = {
    terraform: 0,
    helm: 0,
    kubectl: 0,
    docker: 0,
    script: 0,
    other: 0,
  };

  let totalConfidence = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  const uniqueJobs = new Set<string>();
  const uniqueTargets = new Set<string>();

  for (const edge of edges) {
    byOperationType[edge.metadata.operationType]++;
    totalConfidence += edge.confidence;
    uniqueJobs.add(edge.sourceNodeId);
    uniqueTargets.add(edge.targetNodeId);

    if (edge.confidence >= 80) {
      highCount++;
    } else if (edge.confidence >= 50) {
      mediumCount++;
    } else {
      lowCount++;
    }
  }

  return {
    totalEdges: edges.length,
    byOperationType,
    averageConfidence: edges.length > 0 ? Math.round(totalConfidence / edges.length) : 0,
    highConfidenceCount: highCount,
    mediumConfidenceCount: mediumCount,
    lowConfidenceCount: lowCount,
    uniqueJobs: uniqueJobs.size,
    uniqueTargets: uniqueTargets.size,
  };
}

/**
 * Filter edges by confidence threshold.
 *
 * @param edges - Edges to filter
 * @param minConfidence - Minimum confidence (0-100)
 * @returns Filtered edges
 */
export function filterEdgesByConfidence(
  edges: readonly OperatesOnEdge[],
  minConfidence: number
): readonly OperatesOnEdge[] {
  return edges.filter(edge => edge.confidence >= minConfidence);
}

/**
 * Filter edges by operation type.
 *
 * @param edges - Edges to filter
 * @param operationType - Operation type to filter by
 * @returns Filtered edges
 */
export function filterEdgesByOperationType(
  edges: readonly OperatesOnEdge[],
  operationType: OperationType
): readonly OperatesOnEdge[] {
  return edges.filter(edge => edge.metadata.operationType === operationType);
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate a Terraform node for linking.
 *
 * @param node - Node to validate
 * @returns True if valid
 */
export function isValidTerraformNode(node: unknown): node is TerraformNode {
  if (typeof node !== 'object' || node === null) {
    return false;
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  const validTypes = ['terraform_module', 'terraform_resource', 'terraform_output', 'terragrunt_unit'];
  if (!validTypes.includes(obj.type as string)) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  if (typeof obj.filePath !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate a Helm node for linking.
 *
 * @param node - Node to validate
 * @returns True if valid
 */
export function isValidHelmNode(node: unknown): node is HelmNode {
  if (typeof node !== 'object' || node === null) {
    return false;
  }

  const obj = node as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }

  const validTypes = ['helm_release', 'helm_chart', 'helm_value', 'helmfile_release'];
  if (!validTypes.includes(obj.type as string)) {
    return false;
  }

  if (typeof obj.name !== 'string') {
    return false;
  }

  if (typeof obj.filePath !== 'string') {
    return false;
  }

  return true;
}

/**
 * Validate a link match.
 *
 * @param match - Match to validate
 * @returns True if valid
 */
export function isValidLinkMatch(match: unknown): match is LinkMatch {
  if (typeof match !== 'object' || match === null) {
    return false;
  }

  const obj = match as Record<string, unknown>;

  if (typeof obj.jobNodeId !== 'string') {
    return false;
  }

  if (typeof obj.targetNodeId !== 'string') {
    return false;
  }

  if (typeof obj.operation !== 'object' || obj.operation === null) {
    return false;
  }

  if (typeof obj.matchReason !== 'string') {
    return false;
  }

  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    return false;
  }

  return true;
}

// ============================================================================
// Database Format Functions
// ============================================================================

/**
 * Convert OPERATES_ON edge to database insert format.
 *
 * @param edge - Edge to convert
 * @param scanId - Scan ID
 * @param tenantId - Tenant ID
 * @returns Database row object
 */
export function operatesOnEdgeToDbFormat(
  edge: OperatesOnEdge,
  scanId: string,
  tenantId: string
): Record<string, unknown> {
  return {
    id: edge.id,
    scan_id: scanId,
    tenant_id: tenantId,
    original_id: edge.id,
    source_node_id: edge.sourceNodeId,
    target_node_id: edge.targetNodeId,
    type: edge.type,
    confidence: edge.confidence / 100,
    metadata: edge.metadata,
    operation: edge.metadata.operation,
    operation_type: edge.metadata.operationType,
    step_index: edge.metadata.stepIndex,
    created_at: new Date(),
  };
}

