/**
 * Detectors Module Exports
 * @module detectors
 *
 * Central exports for all detector infrastructure and implementations.
 * TASK-DETECT: Detector infrastructure for IaC dependency detection
 */

// Base detector infrastructure
export {
  // Types
  type DetectionResult,
  type DetectionSuccess,
  type DetectionFailure,
  type DetectionError,
  type DetectionErrorCode,
  type DetectionMetadata,
  type IDetector,
  type DetectionContext,
  type DetectionOptions,
  type IEvidenceCollector,

  // Classes
  BaseDetector,
  EvidenceCollector,

  // Constants
  DEFAULT_DETECTION_OPTIONS,
  DEFAULT_SCORING_RULES,

  // Type Guards
  isDetectionSuccess,
  isDetectionFailure,

  // Factory Functions
  createDetectionContext,
} from './base/index.js';

// Detector types (TASK-DETECT-002, 003, 004)
export {
  // Branded types
  type ReferenceId,
  type DataSourceId,
  type ModuleCallId,

  // Resource reference types (TASK-DETECT-002)
  type ResourceReferenceType,
  type ResourceReference,
  type ResourceReferenceParts,
  type ReferenceEvidence,
  type ReferenceResolution,
  type ReferenceResolutionError,
  type ReferenceErrorCode,
  type CrossReference,
  type CrossReferenceType,
  type CrossReferenceContext,
  type ModuleHierarchyEntry,
  type ResourceIndexEntry,
  type ModuleOutputEntry,

  // Data source types (TASK-DETECT-003)
  type DataSourceNode,
  type DataSourceFilter,
  type DataSourceDependency,
  type FilterDependency,

  // Module dependency types (TASK-DETECT-004)
  type ModuleDependency,
  type ModuleSourceInfo,
  type ModuleInputDependency,
  type ModuleOutputConsumer,
  type ModuleProviderDependency,
  type IteratorDependency,

  // Detection options
  type ReferenceDetectionOptions,
  type DataSourceDetectionOptions,
  type ModuleDetectionOptions,

  // Detection results
  type ReferenceDetectionResult,
  type UnresolvedReference,
  type ReferenceDetectionStats,
  type DataSourceDetectionResult,
  type DataSourceDetectionStats,
  type ModuleDetectionResult,
  type ModuleDetectionStats,

  // Constants
  DEFAULT_REFERENCE_DETECTION_OPTIONS,
  DEFAULT_DATA_SOURCE_DETECTION_OPTIONS,
  DEFAULT_MODULE_DETECTION_OPTIONS,

  // Type guards
  isResourceReference,
  isDataSourceNode,
  isModuleDependency,
  isCrossReference,

  // Factory functions
  createReferenceId,
  createDataSourceId,
  createModuleCallId,
  createEmptyReferenceStats,
  createEmptyDataSourceStats,
  createEmptyModuleStats,

  // Utility functions
  referenceTypeToEdgeType,
  crossRefTypeToEdgeType,
} from './types.js';

// Reference Resolver (TASK-DETECT-003)
export {
  ReferenceResolver,
  type ReferenceResolverInput,
  createReferenceResolver,
  resolveReferences,
} from './reference-resolver.js';

// Data Source Detector (TASK-DETECT-004)
export {
  DataSourceDetector,
  type DataSourceDetectorInput,
  createDataSourceDetector,
  detectDataSources,
  PROVIDER_DATA_SOURCES,
  OUTPUT_ATTRIBUTES,
} from './data-source-detector.js';
