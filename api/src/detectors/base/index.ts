/**
 * Detector Base Module Exports
 * @module detectors/base
 */

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
} from './detector';
