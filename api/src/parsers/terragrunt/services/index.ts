/**
 * Terragrunt Services Module
 * @module parsers/terragrunt/services
 *
 * TASK-TG-001: Service layer exports for Terragrunt HCL parsing
 *
 * Provides:
 * - ParserService: Factory functions, batch parsing, caching
 * - HierarchyService: Configuration hierarchy resolution
 * - ValidationService: Block and file validation
 */

// ============================================================================
// Parser Service Exports
// ============================================================================

export {
  // Service class
  TerragruntParserService,

  // Types
  type BatchParseOptions,
  type BatchParseFileResult,
  type BatchParseResult,
  type AggregatedError,
  type QuickParseResult,

  // Factory functions
  getParserService,
  parseFile,
  parseContent,
  parseDirectory,
  quickParse,
  batchParse,
} from './parser.service';

// ============================================================================
// Hierarchy Service Exports
// ============================================================================

export {
  // Service class
  TerragruntHierarchyService,

  // Types
  type HierarchyNode,
  type MergedConfiguration,
  type MergeTrace,
  type DependencyNode,
  type DependencyGraph,
  type HierarchyOptions,

  // Factory functions
  createHierarchyService,
  buildHierarchy,
  getMergedConfiguration,
  buildDependencyGraph,
  getExecutionOrder,
} from './hierarchy.service';

// ============================================================================
// Validation Service Exports
// ============================================================================

export {
  // Service class
  TerragruntValidationService,

  // Types
  type ValidationSeverity,
  type ValidationIssue,
  type ValidationRule,
  type ValidationOptions,
  type ValidationResult,

  // Constants
  BUILTIN_RULES,

  // Factory functions
  createValidationService,
  validateFile,
  validateBlock,
  getValidationRules,
} from './validation.service';
