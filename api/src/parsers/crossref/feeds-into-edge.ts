/**
 * FEEDS_INTO Edge Type for TF-Helm Data Flow
 * @module crossref/feeds-into-edge
 *
 * Defines the FEEDS_INTO edge type for tracking data flow between Terraform
 * outputs and Helm values. This edge type captures cross-tool data dependencies
 * with full metadata for transformation tracking, pipeline context, and evidence.
 *
 * TASK-XREF-006: FEEDS_INTO Edge Type Implementation
 */

import { createHash } from 'crypto';
import { TerraformToHelmFlow, FlowEvidence, PipelineType, TransformationType } from './types';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Source types that can produce data for FEEDS_INTO edges
 */
export type FeedsIntoSourceType = 'terraform_output' | 'terragrunt_output' | 'tf_state';

/**
 * Target types that can consume data via FEEDS_INTO edges
 */
export type FeedsIntoTargetType = 'helm_value' | 'helmfile_value' | 'k8s_configmap';

/**
 * Mechanism by which data flows from source to target
 */
export type FlowMechanism = 'ci_pipeline' | 'direct_reference' | 'state_query';

/**
 * CI/CD pipeline types where flows can be detected
 */
export type FeedsIntoPipelineType = PipelineType | 'jenkins' | 'azure_devops';

/**
 * Types of transformations applied to data during flow
 */
export type FeedsIntoTransformationType = TransformationType | 'yq' | 'custom';

/**
 * Evidence pointer for FEEDS_INTO edge validation
 */
export interface FeedsIntoEvidencePointer {
  /** Type of evidence */
  readonly type: 'ci_step' | 'script_line' | 'file_reference' | 'variable_assignment';
  /** Location where evidence was found */
  readonly location: {
    readonly filePath: string;
    readonly lineStart?: number;
    readonly lineEnd?: number;
  };
  /** Code snippet showing the evidence */
  readonly snippet?: string;
  /** Strength of this evidence (0-1) */
  readonly strength: number;
}

/**
 * Transformation details for data flowing through the edge
 */
export interface FeedsIntoTransformation {
  /** Type of transformation applied */
  readonly type: FeedsIntoTransformationType;
  /** Transformation expression (e.g., jq filter, sed pattern) */
  readonly expression?: string;
}

/**
 * Complete metadata for a FEEDS_INTO edge
 */
export interface FeedsIntoMetadata {
  // Source details
  /** Type of the source producing data */
  readonly sourceType: FeedsIntoSourceType;
  /** Name of the output being consumed */
  readonly sourceOutputName: string;
  /** Module/component path for the source */
  readonly sourceModulePath?: string;

  // Target details
  /** Type of the target consuming data */
  readonly targetType: FeedsIntoTargetType;
  /** Value path in the target (e.g., "image.tag") */
  readonly targetValuePath: string;
  /** Target chart or component name */
  readonly targetChart: string;

  // Flow details
  /** Mechanism for data flow */
  readonly flowMechanism: FlowMechanism;
  /** Pipeline type if flow is via CI/CD */
  readonly pipelineType?: FeedsIntoPipelineType;
  /** Pipeline file path */
  readonly pipelineFile?: string;
  /** Job name in the pipeline */
  readonly jobName?: string;

  // Transformation
  /** Transformation applied during flow */
  readonly transformation?: FeedsIntoTransformation;

  // Temporal info
  /** When this flow was first detected (ISO date string) */
  readonly firstDetected: string;
  /** When this flow was last verified (ISO date string) */
  readonly lastVerified: string;
}

/**
 * Complete FEEDS_INTO edge representation
 */
export interface FeedsIntoEdge {
  /** Unique edge identifier */
  readonly id: string;
  /** Edge type discriminator */
  readonly type: 'FEEDS_INTO';
  /** Source node ID (Terraform output node) */
  readonly sourceNodeId: string;
  /** Target node ID (Helm value node) */
  readonly targetNodeId: string;
  /** Scan ID this edge belongs to */
  readonly scanId: string;
  /** Complete edge metadata */
  readonly metadata: FeedsIntoMetadata;
  /** Confidence score (0-100) */
  readonly confidence: number;
  /** Evidence supporting this edge */
  readonly evidence: readonly FeedsIntoEvidencePointer[];
}

/**
 * Options for querying FEEDS_INTO edges
 */
export interface FeedsIntoQueryOptions {
  /** Minimum confidence threshold */
  readonly minConfidence?: number;
  /** Filter by source types */
  readonly sourceTypes?: readonly FeedsIntoSourceType[];
  /** Filter by target types */
  readonly targetTypes?: readonly FeedsIntoTargetType[];
  /** Filter by pipeline type */
  readonly pipelineType?: FeedsIntoPipelineType;
  /** Maximum results to return */
  readonly limit?: number;
}

// ============================================================================
// Edge Creation Functions
// ============================================================================

/**
 * Generate a deterministic edge ID based on source and target nodes.
 *
 * @param sourceNodeId - ID of the source node
 * @param targetNodeId - ID of the target node
 * @returns Deterministic edge ID
 *
 * @example
 * const edgeId = generateFeedsIntoEdgeId('node-tf-output-vpc_id', 'node-helm-value-vpc');
 * // Returns: 'feeds-into-a1b2c3d4e5f6...'
 */
export function generateFeedsIntoEdgeId(
  sourceNodeId: string,
  targetNodeId: string
): string {
  const combined = `FEEDS_INTO:${sourceNodeId}:${targetNodeId}`;
  const hash = createHash('sha256').update(combined).digest('hex').slice(0, 16);
  return `feeds-into-${hash}`;
}

/**
 * Map FlowEvidence to FeedsIntoEvidencePointer format.
 *
 * @param evidence - Flow evidence from detection
 * @returns Evidence pointer for FEEDS_INTO edge
 */
function mapFlowEvidenceToPointer(evidence: FlowEvidence): FeedsIntoEvidencePointer {
  // Map evidence type to pointer type
  let pointerType: FeedsIntoEvidencePointer['type'];
  switch (evidence.type) {
    case 'explicit_reference':
    case 'expression_match':
      pointerType = 'variable_assignment';
      break;
    case 'job_dependency':
    case 'step_proximity':
      pointerType = 'ci_step';
      break;
    case 'file_path_match':
    case 'artifact_path':
      pointerType = 'file_reference';
      break;
    default:
      pointerType = 'script_line';
  }

  return {
    type: pointerType,
    location: {
      filePath: evidence.location?.file ?? 'unknown',
      lineStart: evidence.location?.lineStart,
      lineEnd: evidence.location?.lineEnd,
    },
    snippet: evidence.snippet,
    strength: evidence.strength / 100, // Normalize to 0-1 range
  };
}

/**
 * Determine flow mechanism from TerraformToHelmFlow pattern.
 *
 * @param flow - Detected TF-Helm flow
 * @returns Flow mechanism type
 */
function determineFlowMechanism(flow: TerraformToHelmFlow): FlowMechanism {
  switch (flow.pattern) {
    case 'direct_output':
      return 'direct_reference';
    case 'job_chain':
    case 'artifact_transfer':
    case 'output_to_env':
    case 'output_to_file':
    case 'matrix_propagation':
      return 'ci_pipeline';
    default:
      return 'ci_pipeline';
  }
}

/**
 * Determine transformation type from flow pattern and evidence.
 *
 * @param flow - Detected TF-Helm flow
 * @returns Transformation info or undefined
 */
function determineTransformation(
  flow: TerraformToHelmFlow
): FeedsIntoTransformation | undefined {
  // Check evidence for transformation indicators
  for (const evidence of flow.evidence) {
    const snippet = evidence.snippet?.toLowerCase() ?? '';

    if (snippet.includes('jq ') || snippet.includes('jq.')) {
      return {
        type: 'jq',
        expression: extractTransformExpression(evidence.snippet ?? '', 'jq'),
      };
    }

    if (snippet.includes('yq ') || snippet.includes('yq.')) {
      return {
        type: 'yq',
        expression: extractTransformExpression(evidence.snippet ?? '', 'yq'),
      };
    }

    if (snippet.includes('envsubst')) {
      return { type: 'envsubst' };
    }

    if (snippet.includes('sed ') || snippet.includes("sed '")) {
      return {
        type: 'sed',
        expression: extractTransformExpression(evidence.snippet ?? '', 'sed'),
      };
    }

    if (snippet.includes('awk ') || snippet.includes("awk '")) {
      return {
        type: 'awk',
        expression: extractTransformExpression(evidence.snippet ?? '', 'awk'),
      };
    }
  }

  // Default to direct if no transformation detected
  if (flow.pattern === 'direct_output') {
    return { type: 'direct' };
  }

  return undefined;
}

/**
 * Extract transformation expression from snippet.
 *
 * @param snippet - Code snippet
 * @param tool - Transformation tool name
 * @returns Extracted expression or undefined
 */
function extractTransformExpression(snippet: string, tool: string): string | undefined {
  // Common patterns for extracting expressions
  const patterns: Record<string, RegExp> = {
    jq: /jq\s+['"]([^'"]+)['"]/,
    yq: /yq\s+['"]([^'"]+)['"]/,
    sed: /sed\s+['"]([^'"]+)['"]/,
    awk: /awk\s+['"]([^'"]+)['"]/,
  };

  const pattern = patterns[tool];
  if (!pattern) return undefined;

  const match = snippet.match(pattern);
  return match?.[1];
}

/**
 * Map pipeline pattern to pipeline type.
 *
 * @param flow - Detected TF-Helm flow
 * @returns Pipeline type or undefined
 */
function determinePipelineType(
  flow: TerraformToHelmFlow
): FeedsIntoPipelineType | undefined {
  const workflowFile = flow.workflowContext.workflowFile.toLowerCase();

  if (workflowFile.includes('.github/workflows')) {
    return 'github_actions';
  }
  if (workflowFile.includes('.gitlab-ci')) {
    return 'gitlab_ci';
  }
  if (workflowFile.includes('jenkinsfile') || workflowFile.includes('jenkins')) {
    return 'jenkins';
  }
  if (workflowFile.includes('azure-pipelines') || workflowFile.includes('.azure')) {
    return 'azure_devops';
  }

  return undefined;
}

/**
 * Create a FEEDS_INTO edge from a detected TerraformToHelmFlow.
 *
 * @param flow - Detected TF-Helm data flow
 * @param sourceNodeId - Database ID of the source node
 * @param targetNodeId - Database ID of the target node
 * @param scanId - Current scan ID
 * @returns Complete FEEDS_INTO edge
 *
 * @example
 * const edge = createFeedsIntoEdge(detectedFlow, 'node-123', 'node-456', 'scan-789');
 */
export function createFeedsIntoEdge(
  flow: TerraformToHelmFlow,
  sourceNodeId: string,
  targetNodeId: string,
  scanId: string
): FeedsIntoEdge {
  const now = new Date().toISOString();

  return {
    id: generateFeedsIntoEdgeId(sourceNodeId, targetNodeId),
    type: 'FEEDS_INTO',
    sourceNodeId,
    targetNodeId,
    scanId,
    metadata: {
      // Source details
      sourceType: 'terraform_output',
      sourceOutputName: flow.source.name,
      sourceModulePath: flow.source.workingDir,

      // Target details
      targetType: flow.target.sourceType === 'values_file' ? 'helmfile_value' : 'helm_value',
      targetValuePath: flow.target.path,
      targetChart: flow.target.chart ?? 'unknown',

      // Flow details
      flowMechanism: determineFlowMechanism(flow),
      pipelineType: determinePipelineType(flow),
      pipelineFile: flow.workflowContext.workflowFile,
      jobName: flow.source.jobId,

      // Transformation
      transformation: determineTransformation(flow),

      // Temporal info
      firstDetected: now,
      lastVerified: now,
    },
    confidence: flow.confidence,
    evidence: flow.evidence.map(mapFlowEvidenceToPointer),
  };
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Valid source types for FEEDS_INTO edges
 */
const VALID_SOURCE_TYPES: readonly FeedsIntoSourceType[] = [
  'terraform_output',
  'terragrunt_output',
  'tf_state',
];

/**
 * Valid target types for FEEDS_INTO edges
 */
const VALID_TARGET_TYPES: readonly FeedsIntoTargetType[] = [
  'helm_value',
  'helmfile_value',
  'k8s_configmap',
];

/**
 * Valid flow mechanisms
 */
const VALID_FLOW_MECHANISMS: readonly FlowMechanism[] = [
  'ci_pipeline',
  'direct_reference',
  'state_query',
];

/**
 * Valid evidence pointer types
 */
const VALID_EVIDENCE_TYPES: readonly FeedsIntoEvidencePointer['type'][] = [
  'ci_step',
  'script_line',
  'file_reference',
  'variable_assignment',
];

/**
 * Type guard to validate FeedsIntoEvidencePointer.
 *
 * @param value - Value to validate
 * @returns True if value is a valid FeedsIntoEvidencePointer
 */
export function isValidEvidencePointer(value: unknown): value is FeedsIntoEvidencePointer {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check type
  if (typeof obj.type !== 'string' || !VALID_EVIDENCE_TYPES.includes(obj.type as FeedsIntoEvidencePointer['type'])) {
    return false;
  }

  // Check location
  if (typeof obj.location !== 'object' || obj.location === null) {
    return false;
  }

  const location = obj.location as Record<string, unknown>;
  if (typeof location.filePath !== 'string') {
    return false;
  }

  // Check strength
  if (typeof obj.strength !== 'number' || obj.strength < 0 || obj.strength > 1) {
    return false;
  }

  // Optional fields
  if (obj.snippet !== undefined && typeof obj.snippet !== 'string') {
    return false;
  }

  return true;
}

/**
 * Type guard to validate FeedsIntoMetadata.
 *
 * @param value - Value to validate
 * @returns True if value is valid FeedsIntoMetadata
 */
export function isValidFeedsIntoMetadata(value: unknown): value is FeedsIntoMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Required source fields
  if (!VALID_SOURCE_TYPES.includes(obj.sourceType as FeedsIntoSourceType)) {
    return false;
  }
  if (typeof obj.sourceOutputName !== 'string' || obj.sourceOutputName.length === 0) {
    return false;
  }

  // Required target fields
  if (!VALID_TARGET_TYPES.includes(obj.targetType as FeedsIntoTargetType)) {
    return false;
  }
  if (typeof obj.targetValuePath !== 'string' || obj.targetValuePath.length === 0) {
    return false;
  }
  if (typeof obj.targetChart !== 'string') {
    return false;
  }

  // Required flow fields
  if (!VALID_FLOW_MECHANISMS.includes(obj.flowMechanism as FlowMechanism)) {
    return false;
  }

  // Required temporal fields
  if (typeof obj.firstDetected !== 'string' || typeof obj.lastVerified !== 'string') {
    return false;
  }

  // Validate ISO date format
  if (isNaN(Date.parse(obj.firstDetected as string)) || isNaN(Date.parse(obj.lastVerified as string))) {
    return false;
  }

  return true;
}

/**
 * Type guard to validate a complete FeedsIntoEdge.
 *
 * @param edge - Value to validate
 * @returns True if edge is a valid FeedsIntoEdge
 *
 * @example
 * if (validateFeedsIntoEdge(unknownEdge)) {
 *   // unknownEdge is now typed as FeedsIntoEdge
 *   console.log(unknownEdge.metadata.sourceOutputName);
 * }
 */
export function validateFeedsIntoEdge(edge: unknown): edge is FeedsIntoEdge {
  if (typeof edge !== 'object' || edge === null) {
    return false;
  }

  const obj = edge as Record<string, unknown>;

  // Check required string fields
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    return false;
  }
  if (obj.type !== 'FEEDS_INTO') {
    return false;
  }
  if (typeof obj.sourceNodeId !== 'string' || obj.sourceNodeId.length === 0) {
    return false;
  }
  if (typeof obj.targetNodeId !== 'string' || obj.targetNodeId.length === 0) {
    return false;
  }
  if (typeof obj.scanId !== 'string' || obj.scanId.length === 0) {
    return false;
  }

  // Check confidence
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 100) {
    return false;
  }

  // Check metadata
  if (!isValidFeedsIntoMetadata(obj.metadata)) {
    return false;
  }

  // Check evidence array
  if (!Array.isArray(obj.evidence)) {
    return false;
  }
  for (const ev of obj.evidence) {
    if (!isValidEvidencePointer(ev)) {
      return false;
    }
  }

  return true;
}

// ============================================================================
// Query Builder Functions
// ============================================================================

/**
 * Build SQL query for finding FEEDS_INTO edges with filters.
 *
 * @param options - Query filter options
 * @returns SQL query string
 *
 * @example
 * const query = buildFeedsIntoQuery({ minConfidence: 80, sourceTypes: ['terraform_output'] });
 */
export function buildFeedsIntoQuery(options: FeedsIntoQueryOptions): string {
  const conditions: string[] = ["type = 'FEEDS_INTO'"];
  const params: string[] = [];

  if (options.minConfidence !== undefined) {
    conditions.push(`confidence >= ${options.minConfidence / 100}`);
  }

  if (options.sourceTypes && options.sourceTypes.length > 0) {
    const sourceTypeList = options.sourceTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`metadata->>'sourceType' IN (${sourceTypeList})`);
  }

  if (options.targetTypes && options.targetTypes.length > 0) {
    const targetTypeList = options.targetTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`metadata->>'targetType' IN (${targetTypeList})`);
  }

  if (options.pipelineType) {
    conditions.push(`metadata->>'pipelineType' = '${options.pipelineType}'`);
  }

  let query = `
    SELECT e.*,
           src.name as source_name, src.file_path as source_file,
           tgt.name as target_name, tgt.file_path as target_file
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.confidence DESC, e.created_at DESC`;

  if (options.limit !== undefined && options.limit > 0) {
    query += ` LIMIT ${options.limit}`;
  }

  return query;
}

/**
 * Build SQL query to find Terraform inputs feeding into a specific Helm chart.
 *
 * @param helmNodeId - Target Helm node database ID
 * @param options - Optional query filters
 * @returns SQL query string
 *
 * @example
 * const query = findTerraformInputsQuery('helm-node-123', { minConfidence: 70 });
 */
export function findTerraformInputsQuery(
  helmNodeId: string,
  options?: FeedsIntoQueryOptions
): string {
  const conditions: string[] = [
    "e.type = 'FEEDS_INTO'",
    `e.target_node_id = '${helmNodeId}'`,
  ];

  if (options?.minConfidence !== undefined) {
    conditions.push(`e.confidence >= ${options.minConfidence / 100}`);
  }

  if (options?.sourceTypes && options.sourceTypes.length > 0) {
    const sourceTypeList = options.sourceTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`e.metadata->>'sourceType' IN (${sourceTypeList})`);
  }

  let query = `
    SELECT
      e.id as edge_id,
      e.confidence,
      e.metadata,
      e.evidence,
      src.id as source_node_id,
      src.name as source_name,
      src.file_path as source_file,
      src.metadata as source_metadata
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.confidence DESC`;

  if (options?.limit !== undefined && options.limit > 0) {
    query += ` LIMIT ${options.limit}`;
  }

  return query;
}

/**
 * Build SQL query to find Helm charts consuming a specific Terraform output.
 *
 * @param tfOutputNodeId - Source Terraform output node database ID
 * @param options - Optional query filters
 * @returns SQL query string
 *
 * @example
 * const query = findHelmConsumersQuery('tf-output-node-456', { targetTypes: ['helm_value'] });
 */
export function findHelmConsumersQuery(
  tfOutputNodeId: string,
  options?: FeedsIntoQueryOptions
): string {
  const conditions: string[] = [
    "e.type = 'FEEDS_INTO'",
    `e.source_node_id = '${tfOutputNodeId}'`,
  ];

  if (options?.minConfidence !== undefined) {
    conditions.push(`e.confidence >= ${options.minConfidence / 100}`);
  }

  if (options?.targetTypes && options.targetTypes.length > 0) {
    const targetTypeList = options.targetTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`e.metadata->>'targetType' IN (${targetTypeList})`);
  }

  if (options?.pipelineType) {
    conditions.push(`e.metadata->>'pipelineType' = '${options.pipelineType}'`);
  }

  let query = `
    SELECT
      e.id as edge_id,
      e.confidence,
      e.metadata,
      e.evidence,
      tgt.id as target_node_id,
      tgt.name as target_name,
      tgt.file_path as target_file,
      tgt.metadata as target_metadata
    FROM edges e
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.confidence DESC`;

  if (options?.limit !== undefined && options.limit > 0) {
    query += ` LIMIT ${options.limit}`;
  }

  return query;
}

/**
 * Build SQL query to find all data flows within a scan.
 *
 * @param scanId - Scan ID to query
 * @param options - Optional query filters
 * @returns SQL query string
 */
export function findFlowsByScanQuery(
  scanId: string,
  options?: FeedsIntoQueryOptions
): string {
  const conditions: string[] = [
    "e.type = 'FEEDS_INTO'",
    `e.scan_id = '${scanId}'`,
  ];

  if (options?.minConfidence !== undefined) {
    conditions.push(`e.confidence >= ${options.minConfidence / 100}`);
  }

  if (options?.sourceTypes && options.sourceTypes.length > 0) {
    const sourceTypeList = options.sourceTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`e.metadata->>'sourceType' IN (${sourceTypeList})`);
  }

  if (options?.targetTypes && options.targetTypes.length > 0) {
    const targetTypeList = options.targetTypes.map(t => `'${t}'`).join(', ');
    conditions.push(`e.metadata->>'targetType' IN (${targetTypeList})`);
  }

  let query = `
    SELECT
      e.*,
      src.name as source_name,
      src.file_path as source_file,
      src.type as source_type,
      tgt.name as target_name,
      tgt.file_path as target_file,
      tgt.type as target_type
    FROM edges e
    JOIN nodes src ON e.source_node_id = src.id
    JOIN nodes tgt ON e.target_node_id = tgt.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY e.confidence DESC, e.created_at DESC`;

  if (options?.limit !== undefined && options.limit > 0) {
    query += ` LIMIT ${options.limit}`;
  }

  return query;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get confidence level string from numeric score.
 *
 * @param confidence - Numeric confidence (0-100)
 * @returns Confidence level string
 */
export function getFeedsIntoConfidenceLevel(
  confidence: number
): 'high' | 'medium' | 'low' {
  if (confidence >= 80) return 'high';
  if (confidence >= 50) return 'medium';
  return 'low';
}

/**
 * Check if two FEEDS_INTO edges represent the same logical flow.
 *
 * @param edge1 - First edge
 * @param edge2 - Second edge
 * @returns True if edges represent the same flow
 */
export function areSameFlow(edge1: FeedsIntoEdge, edge2: FeedsIntoEdge): boolean {
  return (
    edge1.sourceNodeId === edge2.sourceNodeId &&
    edge1.targetNodeId === edge2.targetNodeId &&
    edge1.metadata.sourceOutputName === edge2.metadata.sourceOutputName &&
    edge1.metadata.targetValuePath === edge2.metadata.targetValuePath
  );
}

/**
 * Merge two FEEDS_INTO edges, keeping the higher confidence and newer verification.
 *
 * @param existing - Existing edge
 * @param newer - Newer edge to merge
 * @returns Merged edge
 */
export function mergeFeedsIntoEdges(
  existing: FeedsIntoEdge,
  newer: FeedsIntoEdge
): FeedsIntoEdge {
  const useNewer = newer.confidence > existing.confidence;
  const mergedEvidence = [
    ...existing.evidence,
    ...newer.evidence.filter(
      ne => !existing.evidence.some(
        ee => ee.type === ne.type && ee.location.filePath === ne.location.filePath
      )
    ),
  ];

  return {
    id: existing.id,
    type: 'FEEDS_INTO',
    sourceNodeId: existing.sourceNodeId,
    targetNodeId: existing.targetNodeId,
    scanId: newer.scanId, // Use newer scan ID
    metadata: {
      ...(useNewer ? newer.metadata : existing.metadata),
      firstDetected: existing.metadata.firstDetected,
      lastVerified: newer.metadata.lastVerified,
    },
    confidence: Math.max(existing.confidence, newer.confidence),
    evidence: mergedEvidence,
  };
}

/**
 * Convert FeedsIntoEdge to database insert format.
 *
 * @param edge - Edge to convert
 * @param tenantId - Tenant ID for multi-tenancy
 * @returns Database row object
 */
export function toDbInsertFormat(
  edge: FeedsIntoEdge,
  tenantId: string
): Record<string, unknown> {
  return {
    id: edge.id,
    scan_id: edge.scanId,
    tenant_id: tenantId,
    original_id: edge.id,
    source_node_id: edge.sourceNodeId,
    target_node_id: edge.targetNodeId,
    type: edge.type,
    confidence: edge.confidence / 100, // DB stores as decimal 0-1
    metadata: edge.metadata,
    evidence: edge.evidence,
    flow_mechanism: edge.metadata.flowMechanism,
    pipeline_type: edge.metadata.pipelineType ?? null,
    transformation_type: edge.metadata.transformation?.type ?? null,
    first_detected: edge.metadata.firstDetected,
    last_verified: edge.metadata.lastVerified,
    created_at: new Date(),
  };
}

// ============================================================================
// Type Exports
// ============================================================================

export type {
  FeedsIntoSourceType as SourceType,
  FeedsIntoTargetType as TargetType,
  FeedsIntoPipelineType as EdgePipelineType,
  FeedsIntoTransformationType as EdgeTransformationType,
};
