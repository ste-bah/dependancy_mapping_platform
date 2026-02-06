/**
 * Scan History Components Index
 * Barrel export for scan history components
 * @module features/scan-history/components
 */

// ============================================================================
// Core Components
// ============================================================================

export { ScanHistoryPage } from './ScanHistoryPage';
export { ScanTimelineChart } from './ScanTimelineChart';
export { ScanListTable } from './ScanListTable';
export { ScanFilterPanel } from './ScanFilterPanel';
export { ScanComparisonPanel } from './ScanComparisonPanel';

// ============================================================================
// Error Components
// ============================================================================

export { ScanHistoryErrorBoundary } from './ScanHistoryErrorBoundary';
export {
  ScanHistoryErrorDisplay,
  ScanHistoryInlineError,
  NetworkErrorDisplay,
  NotFoundErrorDisplay,
  ServerErrorDisplay,
} from './ScanHistoryErrorDisplay';

// ============================================================================
// Re-export Types
// ============================================================================

export type { ScanHistoryPageProps } from '../types/components';
export type { ScanTimelineChartProps } from './ScanTimelineChart';
export type { ScanListTableProps } from './ScanListTable';
export type { ScanFilterPanelProps } from './ScanFilterPanel';
export type { ScanComparisonPanelProps } from './ScanComparisonPanel';
export type { ScanHistoryErrorBoundaryProps } from './ScanHistoryErrorBoundary';
export type {
  ScanHistoryErrorDisplayProps,
  ScanHistoryInlineErrorProps,
} from './ScanHistoryErrorDisplay';

// ============================================================================
// Default Export
// ============================================================================

export default {
  ScanHistoryPage,
  ScanTimelineChart,
  ScanListTable,
  ScanFilterPanel,
  ScanComparisonPanel,
  ScanHistoryErrorBoundary,
  ScanHistoryErrorDisplay,
  ScanHistoryInlineError,
};
