/**
 * TF-Helm Cross-Reference Detection Module
 * @module parsers/crossref
 *
 * Public exports for the Terraform-to-Helm cross-reference detection system.
 * This module provides types, interfaces, and utilities for detecting data flows
 * between Terraform outputs and Helm value inputs in CI/CD workflows.
 *
 * TASK-XREF-003: TF-Helm Cross-Reference Detection - Public API
 *
 * @example
 * ```typescript
 * import {
 *   ITfHelmDetector,
 *   TerraformToHelmFlow,
 *   TfHelmFlowPattern,
 *   createTfHelmFlowId,
 * } from '@parsers/crossref';
 *
 * // Use the detector interface for dependency injection
 * function analyzeWorkflow(detector: ITfHelmDetector) {
 *   const flows = detector.detect(workflow);
 *   const highConfidence = detector.getFlowsAboveConfidence(80);
 *   console.log(`Found ${flows.length} TF-Helm flows`);
 * }
 * ```
 */

// Export all types
export type {
  // Branded types
  TfHelmFlowId,
  TerraformOutputName,
  HelmValuePath,

  // Pattern types
  TfHelmFlowPattern,
  ConfidenceLevel,

  // Core flow types
  TerraformToHelmFlow,
  TerraformOutputInfo,
  TerraformOutputCommand,
  HelmValueSource,
  HelmValueCommand,
  HelmValueSourceType,

  // Evidence types
  FlowEvidence,
  FlowEvidenceType,

  // Context types
  WorkflowFlowContext,
  TfHelmDetectionContext,
  TerraformStepContext,
  HelmStepContext,

  // Result types
  TfHelmDetectionResult,
  DetectionSummary,
  DetectionMetadata,
  DetectionError,
  DetectionWarning,

  // Options
  TfHelmDetectorOptions,

  // Scoring types
  PartialFlow,
  ScoredFlow,
  ScoreBreakdown,

  // Variable types
  VariableOrigin,
  VariableOriginType,
  VariableTransformation,

  // Additional interface types (TASK-XREF-003)
  TerraformOutputRef,
  TerraformOutputType,
  HelmInputRef,
  HelmInputMethod,
  PipelineContext,
  PipelineType,
  ValueTransformation,
  TransformationType,
  ConfidenceScore,
  EvidencePointer,
  TfHelmEvidenceType,

  // Analyzer interfaces
  IFlowAnalyzer,
  TerraformCommandAnalysis,
  HelmValueAnalysis,
  IConfidenceScorer,
  IPatternDetector,

  // Job info types
  TfJobInfo,
  HelmJobInfo,

  // Statistics
  DetectionStatistics,
} from './types';

// Export functions and constants
export {
  // Factory functions
  createTfHelmFlowId,
  createTerraformOutputName,
  createHelmValuePath,
  getConfidenceLevel,
  createEmptyDetectionResult,

  // Type guards
  isTerraformToHelmFlow,
  isHighConfidenceFlow,
  isMediumConfidenceFlow,
  isLowConfidenceFlow,
  isDirectOutputPattern,
  isJobChainPattern,

  // Constants
  DEFAULT_TF_HELM_DETECTOR_OPTIONS,
  PATTERN_BASE_SCORES,
  EVIDENCE_TYPE_WEIGHTS,
  TF_OUTPUT_PATTERNS,
  HELM_SET_PATTERNS,
} from './types';

// ============================================================================
// Interfaces - Dependency injection contracts
// ============================================================================

export type {
  // Core Detector Interface
  ITfHelmDetector,

  // Evidence Collection Interface
  IEvidenceCollector,

  // Expression Analysis Interface
  IExpressionAnalyzer,

  // Workflow Analysis Interface
  IWorkflowAnalyzer,

  // Flow Repository Interface
  IFlowRepository,

  // Factory Interface
  ITfHelmDetectorFactory,

  // Supporting Types from Interfaces
  TerraformStepInfo,
  HelmStepInfo,
  TraceContext,
  ExpressionInfo,
  OutputReference,
  StepOutputReference,
  EnvReference,
} from './interfaces';

// ============================================================================
// Implementations
// ============================================================================

// Confidence Scorer
export {
  ConfidenceScorer,
  createConfidenceScorer,
  calculateFlowConfidence,
  scoreFlows,
  filterByConfidence,
  sortByConfidence,
  groupByConfidenceLevel,
  calculateAverageConfidence,
  DEFAULT_SCORING_WEIGHTS,
} from './confidence-scorer';

export type { ScoringWeights } from './confidence-scorer';

// Flow Analyzer
export {
  FlowAnalyzer,
  createFlowAnalyzer,
  TF_OUTPUT_PATTERNS as FLOW_ANALYZER_TF_PATTERNS,
  HELM_PATTERNS as FLOW_ANALYZER_HELM_PATTERNS,
  GHA_EXPR_PATTERNS as FLOW_ANALYZER_GHA_PATTERNS,
} from './flow-analyzer';

// TODO: Export remaining implementations once created
// export { EvidenceCollector } from './evidence-collector';
// export { ExpressionAnalyzer } from './expression-analyzer';
// export { WorkflowAnalyzer } from './workflow-analyzer';

// Pattern Detectors
export {
  createPatternDetectors,
  getPatternDetector,
  DirectSetPatternDetector,
  EnvVarPatternDetector,
  JsonFilePatternDetector,
  ArtifactPatternDetector,
  TF_OUTPUT_PATTERNS as PATTERN_TF_OUTPUT_PATTERNS,
  ENV_VAR_PATTERNS,
  HELM_VALUE_PATTERNS,
  ARTIFACT_PATTERNS,
} from './pattern-detectors';

// TfHelmDetector - Main Orchestrator
export {
  TfHelmDetector,
  createTfHelmDetector,
  createTfHelmDetectorWithDeps,
  detectTfHelmFlows,
  detectAndAnalyzeTfHelmFlows,
} from './tf-helm-detector';

export type { TfHelmDetectorDeps } from './tf-helm-detector';

// ============================================================================
// FEEDS_INTO Edge Type (TASK-XREF-006)
// ============================================================================

export {
  // Edge creation
  createFeedsIntoEdge,
  generateFeedsIntoEdgeId,

  // Validation
  validateFeedsIntoEdge,
  isValidEvidencePointer,
  isValidFeedsIntoMetadata,

  // Query builders
  buildFeedsIntoQuery,
  findTerraformInputsQuery,
  findHelmConsumersQuery,
  findFlowsByScanQuery,

  // Utility functions
  getFeedsIntoConfidenceLevel,
  areSameFlow,
  mergeFeedsIntoEdges,
  toDbInsertFormat,
} from './feeds-into-edge';

export type {
  // Core types
  FeedsIntoEdge,
  FeedsIntoMetadata,
  FeedsIntoEvidencePointer,
  FeedsIntoTransformation,
  FeedsIntoQueryOptions,

  // Enums as types
  FeedsIntoSourceType,
  FeedsIntoTargetType,
  FlowMechanism,
  FeedsIntoPipelineType,
  FeedsIntoTransformationType,

  // Aliases
  SourceType,
  TargetType,
  EdgePipelineType,
  EdgeTransformationType,
} from './feeds-into-edge';

// ============================================================================
// PIPELINE Node Types (TASK-XREF-007)
// ============================================================================

export {
  // ID generators
  generatePipelineNodeId,
  generateJobNodeId,
  generateEdgeId,

  // Trigger parsing
  parseTriggers,

  // Operation extraction
  extractOperations,

  // Node creation
  createPipelineNodes,

  // Type guards
  isPipelineNode,
  isPipelineJobNode,
  isPipelineContainsEdge,
  isJobDependsOnEdge,
  isOperatesOnEdge,

  // Utility functions
  getTerraformOperations,
  getHelmOperations,
  hasInfraOperations,

  // DB format converters
  pipelineNodeToDbFormat,
  jobNodeToDbFormat,
} from './pipeline-node';

export type {
  // Enums
  CIPipelineType,
  TriggerType,
  OperationType,

  // Trigger types
  PipelineTrigger,

  // Operation types
  JobOperation,
  JobArtifact,

  // Node metadata
  PipelineNodeMetadata,
  PipelineJobNodeMetadata,

  // Node types
  PipelineNode,
  PipelineJobNode,

  // Edge types
  PipelineContainsEdge,
  JobDependsOnEdge,
  OperatesOnEdge,
} from './pipeline-node';

// ============================================================================
// Job Linker (TASK-XREF-007)
// ============================================================================

export {
  // Path utilities
  normalizePath,
  getDirectory,
  arePathsRelated,
  calculatePathSimilarity,

  // Name utilities
  calculateNameSimilarity,

  // Linking functions
  linkJobToTerraform,
  linkJobToHelm,
  linkJobToInfrastructure,
  linkAllJobsToInfrastructure,

  // Query functions
  getOperatedNodes,
  getOperatingJobs,
  getLinkingStats,

  // Filter functions
  filterEdgesByConfidence,
  filterEdgesByOperationType,

  // Validation
  isValidTerraformNode,
  isValidHelmNode,
  isValidLinkMatch,

  // DB format
  operatesOnEdgeToDbFormat,

  // Constants
  DEFAULT_LINKING_OPTIONS,
} from './job-linker';

export type {
  // Node types for linking
  TerraformNode,
  HelmNode,

  // Result types
  LinkResult,
  LinkMatch,
  MatchReason,

  // Options
  LinkingOptions,

  // Statistics
  LinkingStats,
} from './job-linker';
