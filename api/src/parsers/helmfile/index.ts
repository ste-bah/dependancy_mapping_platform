/**
 * Helmfile Parser Module
 * @module parsers/helmfile
 *
 * Exports all Helmfile-related types and utilities for parsing
 * helmfile.yaml configurations.
 *
 * TASK-XREF-004: Helmfile parser for Helm release orchestration
 */

// Main parser and types
export {
  // Branded types
  type HelmfileId,
  type HelmfileReleaseId,

  // Core types
  type HelmDefaults,
  type SetValue,
  type HelmfileRelease,
  type HelmfileHook,
  type HelmfileEnvironment,
  type HelmRepository,
  type Helmfile,

  // Graph node types
  type HelmfileReleaseNode,
  type HelmfileDependsOnEdge,

  // Error types
  type HelmfileParseErrorCode,
  type HelmfileParseError,

  // Parse result types
  type HelmfileParseResult,
  type HelmfileParseMetadata,

  // Parser options
  type HelmfileParserOptions,
  DEFAULT_HELMFILE_PARSER_OPTIONS,

  // Parser class
  HelmfileParser,

  // Factory functions
  createHelmfileParser,
  parseHelmfileAsync,
  parseHelmfileSync,
  createHelmfileGraph,
  createHelmfileId,
  createHelmfileReleaseId,

  // ID generation helpers
  generateNodeId,
  generateEdgeId,
  resetIdCounters,

  // Need reference parsing
  type ParsedNeedReference,
  parseNeedReference,
  formatNeedReference,

  // Type guards
  isHelmfileReleaseNode,
  isHelmfileDependsOnEdge,
} from './helmfile-parser.js';
