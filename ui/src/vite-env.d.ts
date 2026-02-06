/// <reference types="vite/client" />

/**
 * Environment Variables Type Definitions
 * Defines all VITE_ prefixed environment variables
 */
interface ImportMetaEnv {
  /** Base URL for API requests (e.g., http://localhost:3000) */
  readonly VITE_API_URL: string;
  /** Legacy alias for API URL */
  readonly VITE_API_BASE_URL: string;
  /** Application name for display */
  readonly VITE_APP_NAME: string;
  /** Enable React Query DevTools */
  readonly VITE_ENABLE_DEVTOOLS: string;

  // ============================================================================
  // Graph Feature Environment Variables
  // ============================================================================

  /** Graph API base URL */
  readonly VITE_GRAPH_API_BASE_URL?: string;
  /** Graph API timeout in milliseconds */
  readonly VITE_GRAPH_API_TIMEOUT?: string;
  /** Graph API retry attempts */
  readonly VITE_GRAPH_API_RETRY_ATTEMPTS?: string;
  /** Enable request logging for graph API */
  readonly VITE_GRAPH_ENABLE_REQUEST_LOGGING?: string;

  /** Graph cache stale time in milliseconds */
  readonly VITE_GRAPH_CACHE_STALE_TIME?: string;
  /** Graph cache garbage collection time */
  readonly VITE_GRAPH_CACHE_GC_TIME?: string;
  /** Refetch graph data on window focus */
  readonly VITE_GRAPH_REFETCH_ON_FOCUS?: string;

  /** Maximum search results for graph */
  readonly VITE_GRAPH_MAX_SEARCH_RESULTS?: string;
  /** Debounce delay for graph operations */
  readonly VITE_GRAPH_DEBOUNCE_MS?: string;
  /** Animation duration for graph UI */
  readonly VITE_GRAPH_ANIMATION_DURATION?: string;

  /** Maximum nodes before disabling animations */
  readonly VITE_GRAPH_MAX_NODES_ANIMATION?: string;
  /** Maximum nodes before hiding labels */
  readonly VITE_GRAPH_MAX_NODES_LABELS?: string;
  /** Maximum blast radius depth */
  readonly VITE_GRAPH_MAX_BLAST_DEPTH?: string;

  /** Enable graph export feature */
  readonly VITE_GRAPH_ENABLE_EXPORT?: string;
  /** Enable cycle detection in graph */
  readonly VITE_GRAPH_ENABLE_CYCLE_DETECTION?: string;
  /** Enable cluster view feature */
  readonly VITE_GRAPH_ENABLE_CLUSTER_VIEW?: string;
  /** Enable blast radius analysis */
  readonly VITE_GRAPH_ENABLE_BLAST_RADIUS?: string;
  /** Enable advanced filters */
  readonly VITE_GRAPH_ENABLE_ADVANCED_FILTERS?: string;
  /** Enable performance monitoring */
  readonly VITE_GRAPH_ENABLE_PERFORMANCE_MONITORING?: string;
  /** Enable error reporting */
  readonly VITE_GRAPH_ENABLE_ERROR_REPORTING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
