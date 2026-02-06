/**
 * Graph Services Index
 * Barrel export for all graph services with factory functions
 * @module features/graph/services
 */

// ============================================================================
// Graph Data Service
// ============================================================================

export {
  GraphDataService,
  createGraphDataService,
  type GraphDataServiceConfig,
  type GraphDataResult,
  type LayoutedGraphResult,
  type NodeDetail,
} from './graphDataService';

// ============================================================================
// Layout Service
// ============================================================================

export {
  LayoutService,
  createLayoutService,
  type LayoutServiceConfig,
  type LayoutPreset,
  type CycleDetectionResult,
  type OptimizationResult,
  type SubgraphLayoutResult,
} from './layoutService';

// ============================================================================
// Selection Service
// ============================================================================

export {
  SelectionService,
  createSelectionService,
  type SelectionServiceConfig,
  type SelectionMode,
  type PathResult,
  type ConnectedNodesResult,
  type SelectionUpdate,
} from './selectionService';

// ============================================================================
// Filter Service
// ============================================================================

export {
  FilterService,
  createFilterService,
  type FilterServiceConfig,
  type FilteredGraph,
  type FilterSummary,
} from './filterService';

// ============================================================================
// Blast Radius Service
// ============================================================================

export {
  BlastRadiusService,
  createBlastRadiusService,
  type BlastRadiusServiceConfig,
  type ImpactSummary,
  type VisualizedNode,
  type BlastRadiusResult,
} from './blastRadiusService';

// ============================================================================
// Export Service
// ============================================================================

export {
  ExportService,
  createExportService,
  type ExportServiceConfig,
  type ExportFormat,
  type ExportOptions,
  type ExportResult,
} from './exportService';

// ============================================================================
// Service Container
// ============================================================================

import { QueryClient } from '@tanstack/react-query';
import { GraphDataService } from './graphDataService';
import { LayoutService } from './layoutService';
import { SelectionService } from './selectionService';
import { FilterService } from './filterService';
import { BlastRadiusService } from './blastRadiusService';
import { ExportService } from './exportService';

/**
 * Service container configuration
 */
export interface GraphServicesConfig {
  /** React Query client */
  queryClient?: QueryClient;
  /** Use extended filters by default */
  useExtendedFilters?: boolean;
}

/**
 * Container holding all graph services
 */
export interface GraphServices {
  /** Graph data service for fetching and caching */
  data: GraphDataService;
  /** Layout service for positioning nodes */
  layout: LayoutService;
  /** Selection service for node/edge selection */
  selection: SelectionService;
  /** Filter service for filtering nodes/edges */
  filter: FilterService;
  /** Blast radius service for impact analysis */
  blastRadius: BlastRadiusService;
  /** Export service for exporting graph data */
  export: ExportService;
}

/**
 * Create all graph services with shared configuration
 *
 * @param config - Shared configuration
 * @returns Container with all services
 *
 * @example
 * ```ts
 * const services = createGraphServices({ queryClient });
 *
 * // Use individual services
 * const graphData = await services.data.getGraph('scan-123');
 * const layout = services.layout.calculateLayout(nodes, edges);
 * const filtered = services.filter.applyFilters(nodes, edges, filters);
 * ```
 */
export function createGraphServices(config: GraphServicesConfig = {}): GraphServices {
  const { queryClient, useExtendedFilters } = config;

  return {
    data: new GraphDataService({ queryClient }),
    layout: new LayoutService(),
    selection: new SelectionService(),
    filter: new FilterService({ useExtendedFilters }),
    blastRadius: new BlastRadiusService({ queryClient }),
    export: new ExportService(),
  };
}

/**
 * Singleton instance for convenience (requires initialization)
 */
let servicesInstance: GraphServices | null = null;

/**
 * Initialize the singleton services instance
 *
 * @param config - Configuration
 * @returns Initialized services
 */
export function initializeGraphServices(config: GraphServicesConfig): GraphServices {
  servicesInstance = createGraphServices(config);
  return servicesInstance;
}

/**
 * Get the singleton services instance
 *
 * @throws Error if not initialized
 * @returns Services instance
 */
export function getGraphServices(): GraphServices {
  if (!servicesInstance) {
    throw new Error(
      'Graph services not initialized. Call initializeGraphServices() first.'
    );
  }
  return servicesInstance;
}

/**
 * Check if services are initialized
 */
export function isGraphServicesInitialized(): boolean {
  return servicesInstance !== null;
}

/**
 * Reset services (useful for testing)
 */
export function resetGraphServices(): void {
  servicesInstance = null;
}
