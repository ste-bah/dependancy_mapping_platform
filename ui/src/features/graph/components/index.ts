/**
 * Graph Components Index
 * Barrel export for graph components
 * @module features/graph/components
 */

// ============================================================================
// Core Components
// ============================================================================

export { CustomNode, type CustomNodeType } from './CustomNode';
export { GraphCanvas } from './GraphCanvas';
export { FilterPanel } from './FilterPanel';
export { SearchBar } from './SearchBar';
export { DetailPanel } from './DetailPanel';

// ============================================================================
// State Components
// ============================================================================

export { GraphSkeleton, type GraphSkeletonProps } from './GraphSkeleton';
export { GraphEmptyState } from './GraphEmptyState';
export {
  GraphErrorBoundary,
  GraphErrorDisplay,
  GraphInlineError,
  type GraphErrorBoundaryProps,
  type GraphErrorDisplayProps,
  type GraphInlineErrorProps,
} from './GraphErrorBoundary';

// ============================================================================
// UI Components
// ============================================================================

export {
  GraphToolbar,
  GraphToolbarCompact,
  type GraphToolbarCompactProps,
} from './GraphToolbar';
export {
  GraphLegend,
  GraphLegendInline,
  type GraphLegendInlineProps,
} from './GraphLegend';

// ============================================================================
// Re-export Types
// ============================================================================

// Re-export types from main types file for convenience
export type { CustomNodeData } from '../types';
export type { GraphCanvasProps } from './GraphCanvas';
export type { FilterPanelProps } from './FilterPanel';
export type { SearchBarProps } from './SearchBar';
export type { DetailPanelProps } from './DetailPanel';

// Re-export component props types from types/components
export type {
  GraphToolbarProps,
  GraphLegendProps,
  GraphEmptyProps,
  GraphErrorProps,
  GraphLoadingProps,
} from '../types/components';
