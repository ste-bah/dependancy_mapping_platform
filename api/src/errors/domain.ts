/**
 * Domain Error Classes
 * @module errors/domain
 *
 * Domain-specific error classes for the IaC dependency detection system.
 * These errors represent business logic and domain-level failures.
 *
 * TASK-DETECT: Error handling infrastructure
 */

import { BaseError, ErrorContext, SourceLocation } from './base';
import {
  ErrorCode,
  ParserErrorCodes,
  DetectionErrorCodes,
  ScoringErrorCodes,
  GraphErrorCodes,
  ScanErrorCodes,
} from './codes';

// ============================================================================
// Parser Errors
// ============================================================================

/**
 * Base class for parser-related errors
 */
export class ParseError extends BaseError {
  public readonly location: SourceLocation | null;
  public readonly severity: 'error' | 'warning';

  constructor(
    message: string,
    code: ErrorCode = ParserErrorCodes.PARSE_ERROR,
    location: SourceLocation | null = null,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'ParseError';
    this.location = location;
    this.severity = 'error';
  }

  toJSON() {
    return {
      ...super.toJSON(),
      location: this.location,
      severity: this.severity,
    };
  }
}

/**
 * HCL/Terraform parsing error
 */
export class HCLParseError extends ParseError {
  constructor(
    message: string,
    location: SourceLocation | null = null,
    context: ErrorContext = {}
  ) {
    super(message, ParserErrorCodes.INVALID_HCL, location, context);
    this.name = 'HCLParseError';
  }
}

/**
 * YAML/Kubernetes parsing error
 */
export class YAMLParseError extends ParseError {
  constructor(
    message: string,
    location: SourceLocation | null = null,
    context: ErrorContext = {}
  ) {
    super(message, ParserErrorCodes.INVALID_YAML, location, context);
    this.name = 'YAMLParseError';
  }
}

/**
 * Helm chart parsing error
 */
export class HelmParseError extends ParseError {
  public readonly chartName?: string;

  constructor(
    message: string,
    chartName?: string,
    location: SourceLocation | null = null,
    context: ErrorContext = {}
  ) {
    super(message, ParserErrorCodes.INVALID_CHART, location, context);
    this.name = 'HelmParseError';
    this.chartName = chartName;
  }
}

/**
 * File processing error (size, encoding, read)
 */
export class FileProcessingError extends ParseError {
  public readonly filePath: string;
  public readonly fileSize?: number;

  constructor(
    message: string,
    filePath: string,
    code: ErrorCode = ParserErrorCodes.FILE_READ_ERROR,
    context: ErrorContext = {}
  ) {
    super(message, code, { file: filePath, lineStart: 0, lineEnd: 0 }, context);
    this.name = 'FileProcessingError';
    this.filePath = filePath;
  }

  static fileTooLarge(filePath: string, size: number, maxSize: number): FileProcessingError {
    const error = new FileProcessingError(
      `File size ${size} exceeds maximum ${maxSize} bytes`,
      filePath,
      ParserErrorCodes.FILE_TOO_LARGE
    );
    (error as { fileSize: number }).fileSize = size;
    return error;
  }
}

// ============================================================================
// Detection Errors
// ============================================================================

/**
 * Base class for detection-related errors
 */
export class DetectionError extends BaseError {
  public readonly recoverable: boolean;
  public readonly location?: SourceLocation;

  constructor(
    message: string,
    code: ErrorCode = DetectionErrorCodes.DETECTION_ERROR,
    context: ErrorContext = {},
    recoverable = true
  ) {
    super(message, code, context, true);
    this.name = 'DetectionError';
    this.recoverable = recoverable;
    this.location = context.details?.location as SourceLocation | undefined;
  }
}

/**
 * Unresolved reference error
 */
export class UnresolvedReferenceError extends DetectionError {
  public readonly referenceType: string;
  public readonly referenceName: string;
  public readonly suggestions?: string[];

  constructor(
    referenceType: string,
    referenceName: string,
    location?: SourceLocation,
    suggestions?: string[],
    context: ErrorContext = {}
  ) {
    super(
      `Unresolved ${referenceType} reference: ${referenceName}`,
      DetectionErrorCodes.UNRESOLVED_REFERENCE,
      { ...context, details: { ...context.details, location } }
    );
    this.name = 'UnresolvedReferenceError';
    this.referenceType = referenceType;
    this.referenceName = referenceName;
    this.suggestions = suggestions;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      referenceType: this.referenceType,
      referenceName: this.referenceName,
      suggestions: this.suggestions,
    };
  }
}

/**
 * Circular reference error
 */
export class CircularReferenceError extends DetectionError {
  public readonly cycle: string[];

  constructor(cycle: string[], context: ErrorContext = {}) {
    const cycleStr = cycle.join(' -> ');
    super(
      `Circular reference detected: ${cycleStr}`,
      DetectionErrorCodes.CIRCULAR_REFERENCE,
      context,
      false // Not recoverable
    );
    this.name = 'CircularReferenceError';
    this.cycle = cycle;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      cycle: this.cycle,
    };
  }
}

/**
 * Module resolution error
 */
export class ModuleResolutionError extends DetectionError {
  public readonly modulePath: string;
  public readonly sourceType: 'local' | 'remote' | 'registry';

  constructor(
    modulePath: string,
    sourceType: 'local' | 'remote' | 'registry',
    context: ErrorContext = {}
  ) {
    super(
      `Failed to resolve module: ${modulePath}`,
      DetectionErrorCodes.MODULE_RESOLUTION_ERROR,
      context
    );
    this.name = 'ModuleResolutionError';
    this.modulePath = modulePath;
    this.sourceType = sourceType;
  }
}

/**
 * Detection timeout error
 */
export class DetectionTimeoutError extends DetectionError {
  public readonly timeoutMs: number;
  public readonly phase: string;

  constructor(timeoutMs: number, phase: string, context: ErrorContext = {}) {
    super(
      `Detection timed out after ${timeoutMs}ms during ${phase}`,
      DetectionErrorCodes.DETECTION_TIMEOUT,
      context,
      false // Not recoverable in the same run
    );
    this.name = 'DetectionTimeoutError';
    this.timeoutMs = timeoutMs;
    this.phase = phase;
  }
}

// ============================================================================
// Scoring Errors
// ============================================================================

/**
 * Base class for scoring-related errors
 */
export class ScoringError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = ScoringErrorCodes.SCORING_ERROR,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'ScoringError';
  }
}

/**
 * Invalid evidence error
 */
export class InvalidEvidenceError extends ScoringError {
  public readonly evidenceId: string;
  public readonly reason: string;

  constructor(evidenceId: string, reason: string, context: ErrorContext = {}) {
    super(
      `Invalid evidence ${evidenceId}: ${reason}`,
      ScoringErrorCodes.INVALID_EVIDENCE,
      context
    );
    this.name = 'InvalidEvidenceError';
    this.evidenceId = evidenceId;
    this.reason = reason;
  }
}

/**
 * Rule evaluation error
 */
export class RuleEvaluationError extends ScoringError {
  public readonly ruleId: string;
  public readonly ruleName: string;

  constructor(ruleId: string, ruleName: string, cause: Error, context: ErrorContext = {}) {
    super(
      `Failed to evaluate rule ${ruleName}: ${cause.message}`,
      ScoringErrorCodes.RULE_EVALUATION_ERROR,
      { ...context, cause }
    );
    this.name = 'RuleEvaluationError';
    this.ruleId = ruleId;
    this.ruleName = ruleName;
  }
}

// ============================================================================
// Graph Errors
// ============================================================================

/**
 * Base class for graph-related errors
 */
export class GraphError extends BaseError {
  constructor(
    message: string,
    code: ErrorCode = GraphErrorCodes.GRAPH_ERROR,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'GraphError';
  }
}

/**
 * Node not found error
 */
export class NodeNotFoundError extends GraphError {
  public readonly nodeId: string;

  constructor(nodeId: string, context: ErrorContext = {}) {
    super(`Node not found: ${nodeId}`, GraphErrorCodes.NODE_NOT_FOUND, context);
    this.name = 'NodeNotFoundError';
    this.nodeId = nodeId;
  }
}

/**
 * Edge not found error
 */
export class EdgeNotFoundError extends GraphError {
  public readonly edgeId: string;

  constructor(edgeId: string, context: ErrorContext = {}) {
    super(`Edge not found: ${edgeId}`, GraphErrorCodes.EDGE_NOT_FOUND, context);
    this.name = 'EdgeNotFoundError';
    this.edgeId = edgeId;
  }
}

/**
 * Dangling edge error (references non-existent node)
 */
export class DanglingEdgeError extends GraphError {
  public readonly edgeId: string;
  public readonly missingNodeId: string;
  public readonly nodeType: 'source' | 'target';

  constructor(
    edgeId: string,
    missingNodeId: string,
    nodeType: 'source' | 'target',
    context: ErrorContext = {}
  ) {
    super(
      `Edge ${edgeId} references non-existent ${nodeType} node: ${missingNodeId}`,
      GraphErrorCodes.DANGLING_EDGE,
      context
    );
    this.name = 'DanglingEdgeError';
    this.edgeId = edgeId;
    this.missingNodeId = missingNodeId;
    this.nodeType = nodeType;
  }
}

/**
 * Graph validation error
 */
export class GraphValidationError extends GraphError {
  public readonly validationErrors: Array<{
    code: string;
    message: string;
    nodeId?: string;
    edgeId?: string;
  }>;

  constructor(
    validationErrors: Array<{ code: string; message: string; nodeId?: string; edgeId?: string }>,
    context: ErrorContext = {}
  ) {
    super(
      `Graph validation failed with ${validationErrors.length} error(s)`,
      GraphErrorCodes.GRAPH_VALIDATION_ERROR,
      context
    );
    this.name = 'GraphValidationError';
    this.validationErrors = validationErrors;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      validationErrors: this.validationErrors,
    };
  }
}

// ============================================================================
// Scan Errors
// ============================================================================

/**
 * Base class for scan-related errors
 */
export class ScanError extends BaseError {
  public readonly scanId?: string;

  constructor(
    message: string,
    code: ErrorCode = ScanErrorCodes.SCAN_ERROR,
    scanId?: string,
    context: ErrorContext = {}
  ) {
    super(message, code, context, true);
    this.name = 'ScanError';
    this.scanId = scanId;
  }
}

/**
 * Scan not found error
 */
export class ScanNotFoundError extends ScanError {
  constructor(scanId: string, context: ErrorContext = {}) {
    super(`Scan not found: ${scanId}`, ScanErrorCodes.SCAN_NOT_FOUND, scanId, context);
    this.name = 'ScanNotFoundError';
  }
}

/**
 * Scan already running error
 */
export class ScanAlreadyRunningError extends ScanError {
  public readonly repositoryId: string;

  constructor(repositoryId: string, existingScanId: string, context: ErrorContext = {}) {
    super(
      `A scan is already running for repository ${repositoryId}`,
      ScanErrorCodes.SCAN_ALREADY_RUNNING,
      existingScanId,
      context
    );
    this.name = 'ScanAlreadyRunningError';
    this.repositoryId = repositoryId;
  }
}

/**
 * Scan failed error
 */
export class ScanFailedError extends ScanError {
  public readonly phase: string;
  public readonly partialResults?: {
    nodesDetected: number;
    edgesDetected: number;
  };

  constructor(
    message: string,
    scanId: string,
    phase: string,
    partialResults?: { nodesDetected: number; edgesDetected: number },
    context: ErrorContext = {}
  ) {
    super(message, ScanErrorCodes.SCAN_FAILED, scanId, context);
    this.name = 'ScanFailedError';
    this.phase = phase;
    this.partialResults = partialResults;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      scanId: this.scanId,
      phase: this.phase,
      partialResults: this.partialResults,
    };
  }
}

/**
 * Scan timeout error
 */
export class ScanTimeoutError extends ScanError {
  public readonly timeoutMs: number;
  public readonly phase: string;

  constructor(
    scanId: string,
    timeoutMs: number,
    phase: string,
    context: ErrorContext = {}
  ) {
    super(
      `Scan timed out after ${timeoutMs}ms during ${phase}`,
      ScanErrorCodes.SCAN_TIMEOUT,
      scanId,
      context
    );
    this.name = 'ScanTimeoutError';
    this.timeoutMs = timeoutMs;
    this.phase = phase;
  }
}

/**
 * Partial scan failure (some files failed, some succeeded)
 */
export class PartialScanFailureError extends ScanError {
  public readonly successCount: number;
  public readonly failureCount: number;
  public readonly failures: Array<{
    file: string;
    error: string;
  }>;

  constructor(
    scanId: string,
    successCount: number,
    failures: Array<{ file: string; error: string }>,
    context: ErrorContext = {}
  ) {
    super(
      `Scan partially failed: ${failures.length} files failed, ${successCount} succeeded`,
      ScanErrorCodes.PARTIAL_SCAN_FAILURE,
      scanId,
      context
    );
    this.name = 'PartialScanFailureError';
    this.successCount = successCount;
    this.failureCount = failures.length;
    this.failures = failures;
  }
}
