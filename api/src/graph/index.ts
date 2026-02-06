/**
 * Graph Builder Module Exports
 * @module graph
 *
 * Dependency graph construction and manipulation.
 * TASK-DETECT-010: Graph builder for IaC dependency detection
 */

export {
  // Classes
  GraphBuilder,
  GraphMerger,
  GraphValidator,

  // Interfaces
  type IGraphBuilder,
  type IGraphMerger,
  type IGraphValidator,
  type GraphBuilderOptions,
  type MergeOptions,
  type ValidationResult,

  // Factory Functions
  createGraphBuilder,
  createEmptyGraph,
  mergeGraphs,
} from './graph-builder';
